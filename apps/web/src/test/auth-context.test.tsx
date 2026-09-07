import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, act, waitFor } from "@testing-library/react";
import { useState } from "react";
import { AuthProvider, useAuth } from "@/contexts/AuthContext";

// ---------- Mocks ----------
const mockMe = vi.fn();
const mockLogin = vi.fn();
const mockRegister = vi.fn();
const mockLogout = vi.fn();
const mockSetActiveOrganizationId = vi.fn();

vi.mock("@/lib/api-client", () => ({
  authApi: {
    me: (...args: any[]) => mockMe(...args),
    login: (...args: any[]) => mockLogin(...args),
    register: (...args: any[]) => mockRegister(...args),
    logout: (...args: any[]) => mockLogout(...args),
  },
  setActiveOrganizationId: (...args: any[]) => mockSetActiveOrganizationId(...args),
}));

// ---------- Test helpers ----------
const fakeOrg = { id: "org-1", name: "Test Church", role: "admin" as const };
const fakeUser = {
  id: "u-1",
  email: "test@example.com",
  displayName: "Test User",
  role: "owner" as const,
  organizations: [fakeOrg],
};

function AuthConsumer() {
  const { user, isAuthenticated, isLoading, activeOrg, login, register, logout, refreshUser, setUser } = useAuth();
  const [loginError, setLoginError] = useState<string | null>(null);
  return (
    <div>
      <span data-testid="loading">{String(isLoading)}</span>
      <span data-testid="authenticated">{String(isAuthenticated)}</span>
      <span data-testid="user">{user ? user.displayName : "none"}</span>
      <span data-testid="active-org">{activeOrg ? activeOrg.name : "none"}</span>
      <span data-testid="login-error">{loginError ?? "none"}</span>
      <button data-testid="login" onClick={() => login("a@b.com", "pw").catch((e: Error) => setLoginError(e.message))}>Login</button>
      <button data-testid="register" onClick={() => register("a@b.com", "pw", "New")}>Register</button>
      <button data-testid="logout" onClick={() => logout()}>Logout</button>
      <button data-testid="refresh" onClick={() => refreshUser()}>Refresh</button>
      <button data-testid="set-user" onClick={() => setUser({ ...fakeUser, displayName: "Manual" })}>SetUser</button>
    </div>
  );
}

function renderWithAuth() {
  return render(
    <AuthProvider>
      <AuthConsumer />
    </AuthProvider>,
  );
}

describe("AuthContext", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    // Default: no existing session
    mockMe.mockRejectedValue(new Error("not authenticated"));
  });

  // ===================== LIFECYCLE =====================

  describe("lifecycle — initial load", () => {
    it("starts in loading state", () => {
      // Keep the me() promise pending
      mockMe.mockReturnValue(new Promise(() => {}));
      renderWithAuth();
      expect(screen.getByTestId("loading").textContent).toBe("true");
      expect(screen.getByTestId("authenticated").textContent).toBe("false");
    });

    it("resolves to unauthenticated when session restore fails", async () => {
      renderWithAuth();
      await waitFor(() =>
        expect(screen.getByTestId("loading").textContent).toBe("false"),
      );
      expect(screen.getByTestId("authenticated").textContent).toBe("false");
      expect(screen.getByTestId("user").textContent).toBe("none");
    });

    it("resolves to authenticated when session restores", async () => {
      mockMe.mockResolvedValue({ user: fakeUser });
      renderWithAuth();
      await waitFor(() =>
        expect(screen.getByTestId("loading").textContent).toBe("false"),
      );
      expect(screen.getByTestId("authenticated").textContent).toBe("true");
      expect(screen.getByTestId("user").textContent).toBe("Test User");
    });

    it("calls authApi.me once on mount", async () => {
      renderWithAuth();
      await waitFor(() =>
        expect(screen.getByTestId("loading").textContent).toBe("false"),
      );
      expect(mockMe).toHaveBeenCalledTimes(1);
    });
  });

  // ===================== ACTIVE ORG =====================

  describe("activeOrg derivation", () => {
    it("derives active org from first organization", async () => {
      mockMe.mockResolvedValue({ user: fakeUser });
      renderWithAuth();
      await waitFor(() =>
        expect(screen.getByTestId("active-org").textContent).toBe("Test Church"),
      );
    });

    it("returns null when user has no organizations", async () => {
      mockMe.mockResolvedValue({ user: { ...fakeUser, organizations: [] } });
      renderWithAuth();
      await waitFor(() =>
        expect(screen.getByTestId("loading").textContent).toBe("false"),
      );
      expect(screen.getByTestId("active-org").textContent).toBe("none");
    });

    it("returns null when user is not authenticated", async () => {
      renderWithAuth();
      await waitFor(() =>
        expect(screen.getByTestId("loading").textContent).toBe("false"),
      );
      expect(screen.getByTestId("active-org").textContent).toBe("none");
    });

    it("syncs setActiveOrganizationId with active org id", async () => {
      mockMe.mockResolvedValue({ user: fakeUser });
      renderWithAuth();
      await waitFor(() =>
        expect(screen.getByTestId("authenticated").textContent).toBe("true"),
      );
      await waitFor(() => {
        expect(mockSetActiveOrganizationId).toHaveBeenCalledWith("org-1");
      });
    });

    it("syncs null when no active org", async () => {
      renderWithAuth();
      await waitFor(() =>
        expect(screen.getByTestId("loading").textContent).toBe("false"),
      );
      expect(mockSetActiveOrganizationId).toHaveBeenCalledWith(null);
    });
  });

  // ===================== LOGIN =====================

  describe("login", () => {
    it("sets user on successful login", async () => {
      mockLogin.mockResolvedValue({ user: fakeUser });
      renderWithAuth();
      await waitFor(() =>
        expect(screen.getByTestId("loading").textContent).toBe("false"),
      );

      await act(async () => {
        screen.getByTestId("login").click();
      });
      expect(mockLogin).toHaveBeenCalledWith("a@b.com", "pw");
      expect(screen.getByTestId("user").textContent).toBe("Test User");
      expect(screen.getByTestId("authenticated").textContent).toBe("true");
    });

    it("takes the team from the login response, without waiting for a reload", async () => {
      // Regression: POST /auth/login used to answer without `organizations`,
      // so a seeded member landed on "You're not on the team yet" until the
      // next GET /auth/me. The API now returns the team from every auth
      // response; this pins the client half of that contract.
      mockLogin.mockResolvedValue({ user: fakeUser });
      renderWithAuth();
      await waitFor(() => expect(screen.getByTestId("loading").textContent).toBe("false"));

      await act(async () => {
        screen.getByTestId("login").click();
      });
      expect(screen.getByTestId("active-org").textContent).toBe("Test Church");
      expect(mockSetActiveOrganizationId).toHaveBeenLastCalledWith("org-1");
      expect(mockMe).toHaveBeenCalledTimes(1); // the mount restore only
    });

    it("does not set user on login failure", async () => {
      mockLogin.mockRejectedValue(new Error("Invalid credentials"));
      renderWithAuth();
      await waitFor(() =>
        expect(screen.getByTestId("loading").textContent).toBe("false"),
      );

      await act(async () => {
        screen.getByTestId("login").click();
      });
      // Error is caught by the consumer and displayed
      await waitFor(() =>
        expect(screen.getByTestId("login-error").textContent).toBe("Invalid credentials"),
      );
      // User should remain null since login failed
      expect(screen.getByTestId("authenticated").textContent).toBe("false");
      expect(screen.getByTestId("user").textContent).toBe("none");
    });
  });

  // ===================== REGISTER =====================

  describe("register", () => {
    it("sets user on successful registration", async () => {
      const newUser = { ...fakeUser, id: "u-2", displayName: "New" };
      mockRegister.mockResolvedValue({ user: newUser });
      renderWithAuth();
      await waitFor(() =>
        expect(screen.getByTestId("loading").textContent).toBe("false"),
      );

      await act(async () => {
        screen.getByTestId("register").click();
      });
      expect(mockRegister).toHaveBeenCalledWith({ email: "a@b.com", password: "pw", displayName: "New" });
      expect(screen.getByTestId("user").textContent).toBe("New");
    });
  });

  // ===================== LOGOUT =====================

  describe("logout", () => {
    it("clears user on logout", async () => {
      mockMe.mockResolvedValue({ user: fakeUser });
      mockLogout.mockResolvedValue(undefined);
      renderWithAuth();
      await waitFor(() =>
        expect(screen.getByTestId("authenticated").textContent).toBe("true"),
      );

      await act(async () => {
        screen.getByTestId("logout").click();
      });
      expect(mockLogout).toHaveBeenCalled();
      expect(screen.getByTestId("authenticated").textContent).toBe("false");
      expect(screen.getByTestId("user").textContent).toBe("none");
    });
  });

  // ===================== REFRESH =====================

  describe("refreshUser", () => {
    it("re-fetches user from me endpoint", async () => {
      mockMe.mockResolvedValueOnce({ user: fakeUser });
      renderWithAuth();
      await waitFor(() =>
        expect(screen.getByTestId("authenticated").textContent).toBe("true"),
      );

      const updatedUser = { ...fakeUser, displayName: "Updated" };
      mockMe.mockResolvedValueOnce({ user: updatedUser });

      await act(async () => {
        screen.getByTestId("refresh").click();
      });
      await waitFor(() =>
        expect(screen.getByTestId("user").textContent).toBe("Updated"),
      );
    });

    it("clears user if refresh fails", async () => {
      mockMe.mockResolvedValueOnce({ user: fakeUser });
      renderWithAuth();
      await waitFor(() =>
        expect(screen.getByTestId("authenticated").textContent).toBe("true"),
      );

      mockMe.mockRejectedValueOnce(new Error("session expired"));

      await act(async () => {
        screen.getByTestId("refresh").click();
      });
      await waitFor(() =>
        expect(screen.getByTestId("authenticated").textContent).toBe("false"),
      );
    });
  });

  // ===================== SET USER =====================

  describe("setUser", () => {
    it("directly sets user without API call", async () => {
      renderWithAuth();
      await waitFor(() =>
        expect(screen.getByTestId("loading").textContent).toBe("false"),
      );

      await act(async () => {
        screen.getByTestId("set-user").click();
      });
      expect(screen.getByTestId("user").textContent).toBe("Manual");
      expect(screen.getByTestId("authenticated").textContent).toBe("true");
    });
  });

  // ===================== USE AUTH HOOK =====================

  describe("useAuth hook", () => {
    it("throws when used outside AuthProvider", () => {
      // Suppress React error boundary console output
      const spy = vi.spyOn(console, "error").mockImplementation(() => {});
      expect(() => render(<AuthConsumer />)).toThrow(
        "useAuth must be used within AuthProvider",
      );
      spy.mockRestore();
    });
  });
});
