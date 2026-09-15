import { createContext, useContext, useState, useEffect, useCallback, type ReactNode } from "react";
import { clearOfflineLibrary } from "@/lib/offline-library";
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
  /** Single-church mode: the user's first (and only) team, or null. */
  activeOrg: OrgMembership | null;
  login: (email: string, password: string) => Promise<void>;
  register: (email: string, password: string, displayName?: string) => Promise<void>;
  logout: () => Promise<void>;
  refreshUser: () => Promise<void>;
  setUser: (user: User | null) => void;
}

const AuthContext = createContext<AuthContextValue | undefined>(undefined);

function firstOrg(user: User | null): OrgMembership | null {
  return user?.organizations?.[0] ?? null;
}

/**
 * Seed the API client (and the localStorage key it reads on module load)
 * before React commits the new user, so a page's own mount effect never
 * fires an org-scoped request without the org header.
 */
function applyUser(user: User | null) {
  const org = firstOrg(user);
  setActiveOrganizationId(org?.id ?? null);
  try {
    if (org) localStorage.setItem(ORG_STORAGE_KEY, org.id);
    else localStorage.removeItem(ORG_STORAGE_KEY);
  } catch {
    // Storage unavailable: the in-memory client state is still set.
  }
}

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUserState] = useState<User | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  const setUser = useCallback((next: User | null) => {
    applyUser(next);
    setUserState(next);
  }, []);

  // On mount, try to restore the session from the cookie
  const refreshUser = useCallback(async () => {
    try {
      const { user: me } = await authApi.me();
      setUser(me);
    } catch {
      setUser(null);
    } finally {
      setIsLoading(false);
    }
  }, [setUser]);

  useEffect(() => {
    refreshUser();
  }, [refreshUser]);

  const login = useCallback(
    async (email: string, password: string) => {
      const { user: loggedIn } = await authApi.login(email, password);
      setUser(loggedIn);
    },
    [setUser],
  );

  const register = useCallback(
    async (email: string, password: string, displayName?: string) => {
      const { user: created } = await authApi.register({ email, password, displayName });
      setUser(created);
    },
    [setUser],
  );

  const logout = useCallback(async () => {
    await authApi.logout();
    // The next person to sign in on this device should not find this person's charts.
    void clearOfflineLibrary();
    setUser(null);
  }, [setUser]);

  return (
    <AuthContext.Provider
      value={{
        user,
        isAuthenticated: !!user,
        isLoading,
        activeOrg: firstOrg(user),
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
