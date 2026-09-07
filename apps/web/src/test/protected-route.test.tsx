import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import { ProtectedRoute } from "@/components/shared/ProtectedRoute";

// ---------- Mocks ----------
const mockUseAuth = vi.fn();
vi.mock("@/contexts/AuthContext", () => ({
  useAuth: () => mockUseAuth(),
}));

function renderProtected(children = <div>Protected Content</div>) {
  return render(
    <MemoryRouter>
      <ProtectedRoute>{children}</ProtectedRoute>
    </MemoryRouter>,
  );
}

describe("ProtectedRoute", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  // ===================== POSITIVE =====================

  describe("positive — authenticated", () => {
    it("renders children when authenticated", () => {
      mockUseAuth.mockReturnValue({ isAuthenticated: true, isLoading: false });
      renderProtected();
      expect(screen.getByText("Protected Content")).toBeInTheDocument();
    });

    it("renders custom children correctly", () => {
      mockUseAuth.mockReturnValue({ isAuthenticated: true, isLoading: false });
      renderProtected(
        <div>
          <h1>Dashboard</h1>
          <p>Welcome</p>
        </div>,
      );
      expect(screen.getByText("Dashboard")).toBeInTheDocument();
      expect(screen.getByText("Welcome")).toBeInTheDocument();
    });
  });

  // ===================== NEGATIVE =====================

  describe("negative — unauthenticated", () => {
    it("does not render children when unauthenticated", () => {
      mockUseAuth.mockReturnValue({ isAuthenticated: false, isLoading: false });
      renderProtected();
      expect(screen.queryByText("Protected Content")).not.toBeInTheDocument();
    });

    it("redirects via Navigate (no children visible)", () => {
      mockUseAuth.mockReturnValue({ isAuthenticated: false, isLoading: false });
      renderProtected();
      // Navigate replaces content
      expect(screen.queryByText("Protected Content")).not.toBeInTheDocument();
    });
  });

  describe("negative — loading", () => {
    it("shows loading spinner when isLoading", () => {
      mockUseAuth.mockReturnValue({ isAuthenticated: false, isLoading: true });
      renderProtected();
      expect(document.querySelector(".animate-spin")).toBeInTheDocument();
    });

    it("does not render children while loading", () => {
      mockUseAuth.mockReturnValue({ isAuthenticated: false, isLoading: true });
      renderProtected();
      expect(screen.queryByText("Protected Content")).not.toBeInTheDocument();
    });

    it("does not redirect while loading", () => {
      mockUseAuth.mockReturnValue({ isAuthenticated: false, isLoading: true });
      renderProtected();
      // Should show spinner, not redirect — children are absent, spinner is present
      expect(document.querySelector(".animate-spin")).toBeInTheDocument();
    });
  });
});
