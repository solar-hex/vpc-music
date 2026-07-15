import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, fireEvent, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { MemoryRouter } from "react-router-dom";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { AppShell } from "@/components/layout/AppShell";

// ---------- Mocks ----------
const mockLogout = vi.fn();
const mockNavigate = vi.fn();
const mockToggleTheme = vi.fn();
const mockSwitchOrg = vi.fn();
const mockRefreshUser = vi.fn();
const mockCreateOrg = vi.fn();

let mockAuthValue: any = {
  user: {
    displayName: "John",
    email: "john@test.com",
    role: "member",
    organizations: [
      { id: "org1", name: "Test Church", role: "admin" },
      { id: "org2", name: "North Campus", role: "musician" },
    ],
  },
  activeOrg: { id: "org1", name: "Test Church", role: "admin" },
  switchOrg: mockSwitchOrg,
  refreshUser: mockRefreshUser,
  logout: mockLogout,
};

vi.mock("@/contexts/AuthContext", () => ({
  useAuth: () => mockAuthValue,
}));

vi.mock("@/contexts/ThemeContext", () => ({
  useTheme: () => ({
    resolvedTheme: "dark",
    toggleTheme: mockToggleTheme,
  }),
}));

let mockConnectivityValue = {
  isOnline: true,
  syncingOfflineEdits: false,
  pendingOfflineEditCount: 0,
  refreshPendingOfflineEditCount: vi.fn(),
};

vi.mock("@/contexts/ConnectivityContext", () => ({
  useConnectivity: () => mockConnectivityValue,
}));

vi.mock("react-router-dom", async () => {
  const actual = await vi.importActual("react-router-dom");
  return {
    ...actual,
    useNavigate: () => mockNavigate,
    Outlet: () => <div data-testid="outlet">Page Content</div>,
  };
});

vi.mock("sonner", () => ({
  toast: { success: vi.fn(), error: vi.fn() },
}));

vi.mock("@/lib/api-client", () => ({
  orgsApi: {
    create: (...args: any[]) => mockCreateOrg(...args),
  },
  notificationsApi: {
    list: vi.fn().mockResolvedValue({ notifications: [] }),
    unreadCount: vi.fn().mockResolvedValue({ count: 0 }),
    markRead: vi.fn(),
    markAllRead: vi.fn(),
    delete: vi.fn(),
    clearAll: vi.fn(),
  },
  assistantApi: {
    chat: vi.fn().mockResolvedValue({ reply: "", actions: [] }),
  },
}));

function renderShell() {
  const queryClient = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  return render(
    <QueryClientProvider client={queryClient}>
      <MemoryRouter initialEntries={["/dashboard"]}>
        <AppShell />
      </MemoryRouter>
    </QueryClientProvider>,
  );
}

describe("AppShell", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockLogout.mockResolvedValue(undefined);
    mockCreateOrg.mockResolvedValue({ organization: { id: "org3", name: "New Org" } });
    mockRefreshUser.mockResolvedValue(undefined);
    mockAuthValue = {
      user: {
        displayName: "John",
        email: "john@test.com",
        role: "member",
        organizations: [
          { id: "org1", name: "Test Church", role: "admin" },
          { id: "org2", name: "North Campus", role: "musician" },
        ],
      },
      activeOrg: { id: "org1", name: "Test Church", role: "admin" },
      switchOrg: mockSwitchOrg,
      refreshUser: mockRefreshUser,
      logout: mockLogout,
    };
    mockConnectivityValue = {
      isOnline: true,
      syncingOfflineEdits: false,
      pendingOfflineEditCount: 0,
      refreshPendingOfflineEditCount: vi.fn(),
    };
  });

  // ===================== POSITIVE =====================

  describe("positive", () => {
    // Desktop sidebar and mobile drawer both render in jsdom (visibility is
    // CSS-only), so shared elements appear twice — query with getAllBy*.

    it("renders logo and brand name", () => {
      renderShell();
      expect(screen.getAllByText("VPC Music").length).toBeGreaterThan(0);
      expect(screen.getAllByAltText("").length).toBeGreaterThan(0); // logo img
    });

    it("renders nav links in sections", () => {
      renderShell();
      expect(screen.getAllByText("Dashboard").length).toBeGreaterThan(0);
      expect(screen.getAllByText("Songs").length).toBeGreaterThan(0);
      expect(screen.getAllByText("Set Lists").length).toBeGreaterThan(0);
      expect(screen.getAllByText("Settings").length).toBeGreaterThan(0);
      // Section headings
      expect(screen.getAllByText("Planning").length).toBeGreaterThan(0);
      expect(screen.getAllByText("Library").length).toBeGreaterThan(0);
    });

    it("shows Administration link for org admins", () => {
      renderShell();
      expect(screen.getAllByText("Administration").length).toBeGreaterThan(0);
    });

    it("renders outlet for child routes", () => {
      renderShell();
      expect(screen.getByTestId("outlet")).toBeInTheDocument();
    });

    it("shows user display name", () => {
      renderShell();
      expect(screen.getAllByText("John").length).toBeGreaterThan(0);
    });

    it("shows the role badge", () => {
      renderShell();
      const badges = screen.getAllByTestId("role-badge");
      expect(badges.length).toBeGreaterThan(0);
      expect(badges[0]).toHaveTextContent(/worship leader/i);
    });

    it("renders theme toggle button", () => {
      renderShell();
      expect(screen.getAllByLabelText("Toggle theme").length).toBeGreaterThan(0);
    });

    it("calls toggleTheme when button clicked", () => {
      renderShell();
      fireEvent.click(screen.getAllByLabelText("Toggle theme")[0]);
      expect(mockToggleTheme).toHaveBeenCalledOnce();
    });

    it("renders sign out button", () => {
      renderShell();
      expect(screen.getAllByTitle("Sign out").length).toBeGreaterThan(0);
    });

    it("opens the mobile drawer from the hamburger button", async () => {
      renderShell();
      const user = userEvent.setup();
      const drawer = document.getElementById("mobile-nav-drawer");
      expect(drawer?.className).toContain("-translate-x-full");
      await user.click(screen.getByLabelText("Open menu"));
      expect(drawer?.className).toContain("translate-x-0");
    });

    it("renders the org switcher with the active organization", () => {
      renderShell();
      expect(screen.getAllByText("Test Church").length).toBeGreaterThan(0);
    });

    it("switches organizations from the org switcher menu", async () => {
      renderShell();
      const user = userEvent.setup();

      await user.click(screen.getAllByRole("button", { name: /test church/i })[0]);
      await user.click(screen.getByRole("button", { name: "North Campus" }));

      expect(mockSwitchOrg).toHaveBeenCalledWith("org2");
    });

    it("creates a new organization from the org switcher", async () => {
      renderShell();
      const user = userEvent.setup();

      await user.click(screen.getAllByRole("button", { name: /test church/i })[0]);
      await user.click(screen.getByRole("button", { name: /new organization/i }));
      expect(screen.getByRole("dialog", { name: /create organization/i })).toBeInTheDocument();
      await user.type(screen.getByPlaceholderText(/organization name/i), "New Org");
      await user.click(screen.getByRole("button", { name: /^create$/i }));

      await waitFor(() => {
        expect(mockCreateOrg).toHaveBeenCalledWith("New Org");
        expect(mockSwitchOrg).toHaveBeenCalledWith("org3");
        expect(mockRefreshUser).toHaveBeenCalled();
      });
    });

    it("shows empty-org onboarding when the user has no organizations", () => {
      mockAuthValue = {
        user: {
          displayName: "John",
          email: "john@test.com",
          role: "member",
          organizations: [],
        },
        activeOrg: null,
        switchOrg: mockSwitchOrg,
        refreshUser: mockRefreshUser,
        logout: mockLogout,
      };

      renderShell();
      expect(screen.getByText(/no organization yet/i)).toBeInTheDocument();
      expect(screen.getByRole("button", { name: /create organization/i })).toBeInTheDocument();
    });

    it("opens the create organization dialog from empty-org onboarding", async () => {
      mockAuthValue = {
        user: {
          displayName: "John",
          email: "john@test.com",
          role: "member",
          organizations: [],
        },
        activeOrg: null,
        switchOrg: mockSwitchOrg,
        refreshUser: mockRefreshUser,
        logout: mockLogout,
      };

      renderShell();
      const user = userEvent.setup();

      await user.click(screen.getByRole("button", { name: /create organization/i }));

      expect(screen.getByRole("dialog", { name: /create organization/i })).toBeInTheDocument();
    });

    it("shows an offline banner when disconnected", () => {
      mockConnectivityValue.isOnline = false;
      renderShell();

      expect(screen.getByText(/you’re offline|you're offline/i)).toBeInTheDocument();
    });

    it("shows queued offline edit count when back online", () => {
      mockConnectivityValue.pendingOfflineEditCount = 2;
      renderShell();

      expect(screen.getByText(/2 offline edits waiting to sync/i)).toBeInTheDocument();
    });
  });

  // ===================== NEGATIVE =====================

  describe("negative", () => {
    it("calls logout and navigates on sign out", async () => {
      renderShell();
      fireEvent.click(screen.getAllByTitle("Sign out")[0]);

      await waitFor(() => {
        expect(mockLogout).toHaveBeenCalled();
        expect(mockNavigate).toHaveBeenCalledWith("/");
      });
    });

    it("does not show nav links that don't exist", () => {
      mockAuthValue = {
        user: {
          displayName: "John",
          email: "john@test.com",
          role: "member",
          organizations: [{ id: "org1", name: "Test Church", role: "observer" }],
        },
        activeOrg: { id: "org1", name: "Test Church", role: "observer" },
        switchOrg: mockSwitchOrg,
        refreshUser: mockRefreshUser,
        logout: mockLogout,
      };

      renderShell();
      expect(screen.queryByText("Administration")).not.toBeInTheDocument();
      expect(screen.queryByText("Profile")).not.toBeInTheDocument();
    });
  });
});
