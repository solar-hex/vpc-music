import {
  createContext,
  useContext,
  useState,
  useEffect,
  useCallback,
  type ReactNode,
} from "react";
import { authApi, setActiveOrganizationId } from "@/lib/api-client";

const ORG_STORAGE_KEY = "vpc-music-active-org-id";

export interface OrgMembership {
  id: string;
  name: string;
  role: "admin" | "musician" | "observer";
}

export interface User {
  id: string;
  email: string;
  displayName: string;
  role: "owner" | "member";
  organizations?: OrgMembership[];
}

interface AuthContextValue {
  user: User | null;
  isAuthenticated: boolean;
  isLoading: boolean;
  /** The active org (persisted selection, or first org, or null) */
  activeOrg: OrgMembership | null;
  /** Switch the active org by ID */
  switchOrg: (orgId: string) => void;
  login: (email: string, password: string) => Promise<void>;
  register: (email: string, password: string, displayName?: string) => Promise<void>;
  logout: () => Promise<void>;
  refreshUser: () => Promise<void>;
  setUser: (user: User) => void;
}

const AuthContext = createContext<AuthContextValue | undefined>(undefined);

/** Resolve the active org from localStorage or fall back to the first org */
function resolveActiveOrg(orgs: OrgMembership[] | undefined): OrgMembership | null {
  if (!orgs || orgs.length === 0) return null;

  const savedId = localStorage.getItem(ORG_STORAGE_KEY);
  if (savedId) {
    const match = orgs.find((o) => o.id === savedId);
    if (match) return match;
  }
  return orgs[0];
}

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [selectedOrgId, setSelectedOrgId] = useState<string | null>(
    () => localStorage.getItem(ORG_STORAGE_KEY),
  );

  // Derive active org
  const activeOrg: OrgMembership | null = (() => {
    const orgs = user?.organizations;
    if (!orgs || orgs.length === 0) return null;
    if (selectedOrgId) {
      const match = orgs.find((o) => o.id === selectedOrgId);
      if (match) return match;
    }
    return orgs[0];
  })();

  // Keep api-client in sync with active org
  useEffect(() => {
    setActiveOrganizationId(activeOrg?.id ?? null);
  }, [activeOrg?.id]);

  const switchOrg = useCallback((orgId: string) => {
    localStorage.setItem(ORG_STORAGE_KEY, orgId);
    setSelectedOrgId(orgId);
  }, []);

  // On mount, try to restore session from cookie
  const refreshUser = useCallback(async () => {
    try {
      const { user: me } = await authApi.me();
      setUser(me);
    } catch {
      setUser(null);
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    refreshUser();
  }, [refreshUser]);

  const login = useCallback(
    async (email: string, password: string) => {
      await authApi.login(email, password);
      // The login response omits `organizations` (only /auth/me includes
      // it) — refetch so activeOrg is correct immediately, instead of
      // showing "No organization yet" until the next reload.
      await refreshUser();
    },
    [refreshUser]
  );

  const register = useCallback(
    async (email: string, password: string, displayName?: string) => {
      await authApi.register({ email, password, displayName });
      await refreshUser();
    },
    [refreshUser]
  );

  const logout = useCallback(async () => {
    await authApi.logout();
    setUser(null);
    localStorage.removeItem(ORG_STORAGE_KEY);
    setSelectedOrgId(null);
  }, []);

  return (
    <AuthContext.Provider
      value={{
        user,
        isAuthenticated: !!user,
        isLoading,
        activeOrg,
        switchOrg,
        login,
        register,
        logout,
        refreshUser,
        setUser,
      }}
    >
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error("useAuth must be used within AuthProvider");
  return ctx;
}
