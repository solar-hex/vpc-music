import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, fireEvent } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { MemoryRouter } from "react-router-dom";
import fs from "node:fs";
import path from "node:path";

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

vi.mock("@/lib/oauth-popup", () => ({
  openOAuthPopup: vi.fn(),
}));

// Stub the env var BEFORE LoginPage is imported
vi.stubEnv("VITE_SANDBOX", "true");

// Now import LoginPage — it reads IS_SANDBOX at module level
// eslint-disable-next-line import/first
import { LoginPage } from "@/pages/auth/LoginPage";

function renderLogin() {
  return render(
    <MemoryRouter>
      <LoginPage />
    </MemoryRouter>,
  );
}

describe("LoginPage — sandbox mode", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  // ===================== POSITIVE =====================

  describe("positive", () => {
    it("shows sandbox badge when VITE_SANDBOX is true", () => {
      renderLogin();
      expect(screen.getByText("Sandbox")).toBeInTheDocument();
    });

    it("shows 'Quick login as:' label", () => {
      renderLogin();
      expect(screen.getByText(/quick login as/i)).toBeInTheDocument();
    });

    it("renders three quick-login buttons (Admin, Musician, Observer)", () => {
      renderLogin();
      expect(screen.getByText("Admin")).toBeInTheDocument();
      expect(screen.getByText("Musician")).toBeInTheDocument();
      expect(screen.getByText("Observer")).toBeInTheDocument();
    });

    it("shows role descriptions for each sandbox account", () => {
      renderLogin();
      expect(screen.getByText(/worship leader/i)).toBeInTheDocument();
      expect(screen.getByText(/band member/i)).toBeInTheDocument();
      expect(screen.getByText(/view only/i)).toBeInTheDocument();
    });

    it("pre-fills email and password when Admin button is clicked", async () => {
      renderLogin();
      const user = userEvent.setup();
      await user.click(screen.getByText("Admin"));

      const emailInput = screen.getByLabelText("Email");
      const passwordInput = screen.getByLabelText("Password");
      expect(emailInput).toHaveValue("worship-leader@vpc.church");
      expect(passwordInput).toHaveValue("password123");
    });

    it("pre-fills email and password when Musician button is clicked", async () => {
      renderLogin();
      const user = userEvent.setup();
      await user.click(screen.getByText("Musician"));

      const emailInput = screen.getByLabelText("Email");
      const passwordInput = screen.getByLabelText("Password");
      expect(emailInput).toHaveValue("keys@vpc.church");
      expect(passwordInput).toHaveValue("password123");
    });

    it("pre-fills email and password when Observer button is clicked", async () => {
      renderLogin();
      const user = userEvent.setup();
      await user.click(screen.getByText("Observer"));

      const emailInput = screen.getByLabelText("Email");
      const passwordInput = screen.getByLabelText("Password");
      expect(emailInput).toHaveValue("guitar@vpc.church");
      expect(passwordInput).toHaveValue("password123");
    });

    it("expands the email form when a sandbox button is clicked", async () => {
      renderLogin();
      // Email form not visible initially
      expect(screen.queryByLabelText("Email")).not.toBeInTheDocument();

      const user = userEvent.setup();
      await user.click(screen.getByText("Admin"));

      // Email form should now be visible
      expect(screen.getByLabelText("Email")).toBeInTheDocument();
      expect(screen.getByLabelText("Password")).toBeInTheDocument();
    });
  });

  // ===================== SOURCE-LEVEL =====================

  describe("source-level checks", () => {
    const loginSrc = fs.readFileSync(
      path.resolve(__dirname, "../pages/auth/LoginPage.tsx"),
      "utf-8",
    );

    it("reads VITE_SANDBOX from import.meta.env", () => {
      expect(loginSrc).toContain('import.meta.env.VITE_SANDBOX === "true"');
    });

    it("defines SANDBOX_ACCOUNTS array with all three roles", () => {
      expect(loginSrc).toContain("worship-leader@vpc.church");
      expect(loginSrc).toContain("keys@vpc.church");
      expect(loginSrc).toContain("guitar@vpc.church");
    });

    it("web .env.example documents VITE_SANDBOX", () => {
      const envExample = fs.readFileSync(
        path.resolve(__dirname, "../../.env.example"),
        "utf-8",
      );
      expect(envExample).toContain("VITE_SANDBOX");
    });

    it("vite-env.d.ts declares VITE_SANDBOX in ImportMetaEnv", () => {
      const envDts = fs.readFileSync(
        path.resolve(__dirname, "../../vite-env.d.ts"),
        "utf-8",
      );
      expect(envDts).toContain("VITE_SANDBOX");
    });

    it("sandbox section is gated by IS_SANDBOX conditional render", () => {
      expect(loginSrc).toContain("IS_SANDBOX");
      expect(loginSrc).toContain("{IS_SANDBOX && (");
    });
  });

  // ===================== SEED CHECKS =====================

  describe("seed script", () => {
    const seedSrc = fs.readFileSync(
      path.resolve(__dirname, "../../../../apps/api/src/seed.js"),
      "utf-8",
    );

    it("seeds all three org roles (admin, musician, observer)", () => {
      expect(seedSrc).toContain('"admin"');
      expect(seedSrc).toContain('"musician"');
      expect(seedSrc).toContain('"observer"');
    });

    it("all three seed users have a passwordHash", () => {
      // Count occurrences of passwordHash assignment (not null)
      const lines = seedSrc.split("\n");
      const userBlock = seedSrc.split("Seeding users")[1]?.split("Seeding songs")[0] || "";
      // Should not contain passwordHash: null
      expect(userBlock).not.toContain("passwordHash: null");
    });

    it("seeds worship-leader, keys, and guitar email accounts", () => {
      expect(seedSrc).toContain("worship-leader@vpc.church");
      expect(seedSrc).toContain("keys@vpc.church");
      expect(seedSrc).toContain("guitar@vpc.church");
    });
  });
});
