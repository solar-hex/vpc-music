import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, fireEvent, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { MemoryRouter } from "react-router-dom";
import { LoginPage } from "@/pages/auth/LoginPage";

// ---------- Mocks ----------
const mockLogin = vi.fn();
const mockRefreshUser = vi.fn();
const mockNavigate = vi.fn();

vi.mock("@/contexts/AuthContext", () => ({
  useAuth: () => ({
    login: mockLogin,
    refreshUser: mockRefreshUser,
    isAuthenticated: false,
  }),
}));

vi.mock("react-router-dom", async () => {
  const actual = await vi.importActual("react-router-dom");
  return {
    ...actual,
    useNavigate: () => mockNavigate,
  };
});

vi.mock("sonner", () => ({
  toast: { success: vi.fn(), error: vi.fn() },
}));

vi.mock("@/contexts/ThemeContext", () => ({
  useTheme: () => ({ resolvedTheme: "dark", toggleTheme: vi.fn() }),
}));

const mockOpenOAuthPopup = vi.fn();
vi.mock("@/lib/oauth-popup", () => ({
  openOAuthPopup: (...args: unknown[]) => mockOpenOAuthPopup(...args),
}));

function renderLogin() {
  return render(
    <MemoryRouter>
      <LoginPage />
    </MemoryRouter>,
  );
}

describe("LoginPage", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  // ===================== POSITIVE =====================

  describe("positive", () => {
    it("renders logo and heading", () => {
      renderLogin();
      expect(screen.getByAltText("VPC Music")).toBeInTheDocument();
      expect(screen.getByText("VPC Music")).toBeInTheDocument();
    });

    it("renders Continue with Google button", () => {
      renderLogin();
      expect(screen.getByRole("button", { name: /continue with google/i })).toBeInTheDocument();
    });

    it("renders 'or' divider", () => {
      renderLogin();
      expect(screen.getByText("or")).toBeInTheDocument();
    });

    it("renders 'Sign in with email' button initially", () => {
      renderLogin();
      expect(screen.getByRole("button", { name: /sign in with email/i })).toBeInTheDocument();
    });

    it("does not show email/password form until email button is clicked", () => {
      renderLogin();
      expect(screen.queryByLabelText("Email")).not.toBeInTheDocument();
      expect(screen.queryByLabelText("Password")).not.toBeInTheDocument();
    });

    it("expands email form when 'Sign in with email' is clicked", async () => {
      renderLogin();
      const user = userEvent.setup();
      await user.click(screen.getByRole("button", { name: /sign in with email/i }));

      expect(screen.getByLabelText("Email")).toBeInTheDocument();
      expect(screen.getByLabelText("Password")).toBeInTheDocument();
      expect(screen.getByRole("button", { name: /sign in$/i })).toBeInTheDocument();
    });

    it("has forgot password link in expanded form", async () => {
      renderLogin();
      const user = userEvent.setup();
      await user.click(screen.getByRole("button", { name: /sign in with email/i }));
      expect(screen.getByText(/forgot password/i)).toHaveAttribute("href", "/forgot-password");
    });

    it("does not render a sign-up link", () => {
      renderLogin();
      expect(screen.queryByRole("link", { name: /sign up/i })).not.toBeInTheDocument();
    });

    it("has a link back to the home page", () => {
      renderLogin();
      expect(screen.getByRole("link", { name: /back to home/i })).toHaveAttribute("href", "/");
    });

    it("calls login on email form submit", async () => {
      mockLogin.mockResolvedValue(undefined);
      renderLogin();
      const user = userEvent.setup();
      await user.click(screen.getByRole("button", { name: /sign in with email/i }));
      await user.type(screen.getByLabelText("Email"), "test@example.com");
      await user.type(screen.getByLabelText("Password"), "password123");
      await user.click(screen.getByRole("button", { name: /^sign in$/i }));

      await waitFor(() => {
        expect(mockLogin).toHaveBeenCalledWith("test@example.com", "password123");
      });
    });

    it("navigates to dashboard on email login success", async () => {
      mockLogin.mockResolvedValue(undefined);
      renderLogin();
      const user = userEvent.setup();
      await user.click(screen.getByRole("button", { name: /sign in with email/i }));
      await user.type(screen.getByLabelText("Email"), "test@example.com");
      await user.type(screen.getByLabelText("Password"), "pass1234");
      await user.click(screen.getByRole("button", { name: /^sign in$/i }));

      await waitFor(() => {
        expect(mockNavigate).toHaveBeenCalledWith("/dashboard");
      });
    });

    it("shows Signing in... while loading", async () => {
      mockLogin.mockReturnValue(new Promise(() => {})); // never resolves
      renderLogin();
      const user = userEvent.setup();
      await user.click(screen.getByRole("button", { name: /sign in with email/i }));
      await user.type(screen.getByLabelText("Email"), "a@b.com");
      await user.type(screen.getByLabelText("Password"), "12345678");
      await user.click(screen.getByRole("button", { name: /^sign in$/i }));

      await waitFor(() => {
        expect(screen.getByRole("button", { name: /signing in/i })).toBeDisabled();
      });
    });

    it("calls openOAuthPopup and navigates on Google login success", async () => {
      const fakeUser = { id: "1", email: "test@gmail.com", displayName: "Test", role: "member" };
      mockOpenOAuthPopup.mockResolvedValue({ success: true, user: fakeUser, token: "tok" });
      renderLogin();
      const user = userEvent.setup();
      await user.click(screen.getByRole("button", { name: /continue with google/i }));

      await waitFor(() => {
        expect(mockOpenOAuthPopup).toHaveBeenCalledWith("google");
        // The OAuth callback payload omits `organizations` — the page must
        // refetch via /auth/me (refreshUser) instead of setUser()-ing the
        // partial payload directly.
        expect(mockRefreshUser).toHaveBeenCalled();
        expect(mockNavigate).toHaveBeenCalledWith("/dashboard");
      });
    });
  });

  // ===================== NEGATIVE =====================

  describe("negative", () => {
    it("shows error toast on email login failure", async () => {
      const { toast } = await import("sonner");
      mockLogin.mockRejectedValue(new Error("Invalid credentials"));
      renderLogin();
      const user = userEvent.setup();
      await user.click(screen.getByRole("button", { name: /sign in with email/i }));
      await user.type(screen.getByLabelText("Email"), "bad@example.com");
      await user.type(screen.getByLabelText("Password"), "wrongpass");
      await user.click(screen.getByRole("button", { name: /^sign in$/i }));

      await waitFor(() => {
        expect(toast.error).toHaveBeenCalledWith("Invalid credentials");
      });
    });

    it("shows generic error when no message available", async () => {
      const { toast } = await import("sonner");
      mockLogin.mockRejectedValue(new Error(""));
      renderLogin();
      const user = userEvent.setup();
      await user.click(screen.getByRole("button", { name: /sign in with email/i }));
      await user.type(screen.getByLabelText("Email"), "a@b.com");
      await user.type(screen.getByLabelText("Password"), "12345678");
      await user.click(screen.getByRole("button", { name: /^sign in$/i }));

      await waitFor(() => {
        expect(toast.error).toHaveBeenCalledWith("Login failed");
      });
    });

    it("re-enables button after failed email login", async () => {
      mockLogin.mockRejectedValue(new Error("fail"));
      renderLogin();
      const user = userEvent.setup();
      await user.click(screen.getByRole("button", { name: /sign in with email/i }));
      await user.type(screen.getByLabelText("Email"), "a@b.com");
      await user.type(screen.getByLabelText("Password"), "12345678");
      await user.click(screen.getByRole("button", { name: /^sign in$/i }));

      await waitFor(() => {
        expect(screen.getByRole("button", { name: /^sign in$/i })).not.toBeDisabled();
      });
    });

    it("shows error modal when Google OAuth returns an error", async () => {
      mockOpenOAuthPopup.mockResolvedValue({ success: false, error: "No account found for this email. Contact your worship team lead to get added." });
      renderLogin();
      const user = userEvent.setup();
      await user.click(screen.getByRole("button", { name: /continue with google/i }));

      await waitFor(() => {
        expect(screen.getByRole("dialog", { name: /sign-in error/i })).toBeInTheDocument();
        expect(screen.getByText("Unable to sign in")).toBeInTheDocument();
        expect(screen.getByText(/contact your worship team lead/i)).toBeInTheDocument();
      });
    });

    it("closes error modal when OK is clicked", async () => {
      mockOpenOAuthPopup.mockResolvedValue({ success: false, error: "No account found" });
      renderLogin();
      const user = userEvent.setup();
      await user.click(screen.getByRole("button", { name: /continue with google/i }));

      await waitFor(() => {
        expect(screen.getByRole("dialog")).toBeInTheDocument();
      });

      await user.click(screen.getByRole("button", { name: /ok/i }));

      await waitFor(() => {
        expect(screen.queryByRole("dialog")).not.toBeInTheDocument();
      });
    });

    it("shows error toast when Google OAuth popup throws", async () => {
      const { toast } = await import("sonner");
      mockOpenOAuthPopup.mockRejectedValue(new Error("Popup blocked"));
      renderLogin();
      const user = userEvent.setup();
      await user.click(screen.getByRole("button", { name: /continue with google/i }));

      await waitFor(() => {
        expect(toast.error).toHaveBeenCalledWith("Google sign-in failed. Please try again.");
      });
    });

    it("does not navigate when user closes Google popup without completing", async () => {
      mockOpenOAuthPopup.mockResolvedValue({ success: false });
      renderLogin();
      const user = userEvent.setup();
      await user.click(screen.getByRole("button", { name: /continue with google/i }));

      await waitFor(() => {
        expect(mockNavigate).not.toHaveBeenCalled();
      });
    });
  });
});
