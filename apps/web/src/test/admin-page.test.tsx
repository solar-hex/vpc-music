import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, waitFor, fireEvent } from "@testing-library/react";
import { MemoryRouter, Route, Routes } from "react-router-dom";
import { AdminPage } from "@/pages/admin/AdminPage";

// ---------- Mocks ----------
const mockListUsers = vi.fn();
const mockInvite = vi.fn();
const mockUpdateRole = vi.fn();
const mockRemoveMember = vi.fn();

vi.mock("@/lib/api-client", () => ({
  adminApi: {
    listUsers: (...args: any[]) => mockListUsers(...args),
    invite: (...args: any[]) => mockInvite(...args),
    updateRole: (...args: any[]) => mockUpdateRole(...args),
    updateCustomRole: vi.fn(),
    removeMember: (...args: any[]) => mockRemoveMember(...args),
  },
  rolesApi: {
    list: vi.fn().mockResolvedValue({ roles: [] }),
    create: vi.fn(),
    update: vi.fn(),
    delete: vi.fn(),
  },
}));

vi.mock("sonner", () => ({
  toast: { success: vi.fn(), error: vi.fn() },
}));

// Auth mock — defaults to admin
let mockAuthValue: any = {
  user: { id: "u1", email: "admin@test.com", displayName: "Admin", role: "owner" as const },
  isAuthenticated: true,
  isLoading: false,
  activeOrg: { id: "org1", name: "Test Church", role: "admin" as const },
  login: vi.fn(),
  register: vi.fn(),
  logout: vi.fn(),
  refreshUser: vi.fn(),
  setUser: vi.fn(),
};

vi.mock("@/contexts/AuthContext", () => ({
  useAuth: () => mockAuthValue,
}));

// ---------- Helpers ----------
function renderPage() {
  return render(
    <MemoryRouter initialEntries={["/admin"]}>
      <Routes>
        <Route path="/admin" element={<AdminPage />} />
      </Routes>
    </MemoryRouter>,
  );
}

const membersList = [
  {
    id: "u1",
    email: "admin@test.com",
    displayName: "Admin User",
    globalRole: "owner",
    orgRole: "admin",
    hasPassword: true,
    createdAt: "2025-01-01T00:00:00Z",
  },
  {
    id: "u2",
    email: "musician@test.com",
    displayName: "Band Member",
    globalRole: "member",
    orgRole: "musician",
    hasPassword: true,
    createdAt: "2025-02-01T00:00:00Z",
  },
  {
    id: "u3",
    email: "invited@test.com",
    displayName: "New Person",
    globalRole: "member",
    orgRole: "observer",
    hasPassword: false,
    createdAt: "2025-06-01T00:00:00Z",
  },
];

describe("AdminPage", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockListUsers.mockResolvedValue({ users: membersList });
    mockInvite.mockResolvedValue({
      user: { id: "u4", email: "new@test.com", orgRole: "musician" },
      inviteUrl: "http://localhost/reset-password?token=invite-token&invite=1",
      message: "Invite created for new@test.com",
    });
    mockUpdateRole.mockResolvedValue({ message: "Role updated" });
    mockRemoveMember.mockResolvedValue({ message: "User removed" });
    // Reset to admin auth
    mockAuthValue = {
      user: { id: "u1", email: "admin@test.com", displayName: "Admin", role: "owner" },
      isAuthenticated: true,
      isLoading: false,
      activeOrg: { id: "org1", name: "Test Church", role: "admin" },
      login: vi.fn(),
      register: vi.fn(),
      logout: vi.fn(),
      refreshUser: vi.fn(),
      setUser: vi.fn(),
    };
  });

  // ===================== RENDERING =====================

  describe("rendering", () => {
    it("renders the page header", async () => {
      renderPage();
      expect(screen.getByText("Team Management")).toBeInTheDocument();
    });

    it("shows org name in subheading", async () => {
      renderPage();
      expect(screen.getByText("Test Church")).toBeInTheDocument();
    });

    it("renders invite section", async () => {
      renderPage();
      expect(screen.getByText("Invite Member")).toBeInTheDocument();
      expect(screen.getByText(/required fields are marked/i)).toBeInTheDocument();
      expect(screen.getByPlaceholderText("Email address *")).toBeInTheDocument();
      expect(screen.getByPlaceholderText("Display name *")).toBeInTheDocument();
      expect(screen.getByText("Send Email Invite")).toBeInTheDocument();
    });

    it("renders role selector in invite form", async () => {
      renderPage();
      const selects = screen.getAllByDisplayValue("Musician");
      expect(selects.length).toBeGreaterThan(0);
      expect(screen.getByRole("option", { name: "Worship Leader" })).toBeInTheDocument();
    });

    it("loads and displays members", async () => {
      renderPage();
      await waitFor(() => {
        expect(screen.getByText("Admin User")).toBeInTheDocument();
        expect(screen.getByText("Band Member")).toBeInTheDocument();
        expect(screen.getByText("New Person")).toBeInTheDocument();
        expect(screen.getAllByText("Worship Leader").length).toBeGreaterThan(0);
      });
    });

    it("shows member count", async () => {
      renderPage();
      await waitFor(() => {
        expect(screen.getByText("Members (3)")).toBeInTheDocument();
      });
    });

    it("shows member emails", async () => {
      renderPage();
      await waitFor(() => {
        expect(screen.getByText("admin@test.com")).toBeInTheDocument();
        expect(screen.getByText("musician@test.com")).toBeInTheDocument();
        expect(screen.getByText("invited@test.com")).toBeInTheDocument();
      });
    });

    it("shows (you) badge for current user", async () => {
      renderPage();
      await waitFor(() => {
        expect(screen.getByText("(you)")).toBeInTheDocument();
      });
    });

    it("shows Invited badge for users without password", async () => {
      renderPage();
      await waitFor(() => {
        expect(screen.getByText("Invited")).toBeInTheDocument();
      });
    });

    it("shows loading spinner initially", () => {
      mockListUsers.mockReturnValue(new Promise(() => {}));
      renderPage();
      expect(document.querySelector(".animate-spin")).toBeInTheDocument();
    });

    it("shows empty state when no members", async () => {
      mockListUsers.mockResolvedValue({ users: [] });
      renderPage();
      await waitFor(() => {
        expect(screen.getByText("No members yet. Invite someone above.")).toBeInTheDocument();
      });
    });
  });

  // ===================== ACCESS CONTROL =====================

  describe("access control", () => {
    it("shows access denied for non-admin org role", () => {
      mockAuthValue = {
        ...mockAuthValue,
        user: { id: "u2", email: "m@test.com", displayName: "M", role: "member" },
        activeOrg: { id: "org1", name: "Test Church", role: "musician" },
      };
      renderPage();
      expect(screen.getByText("Access Denied")).toBeInTheDocument();
      expect(screen.queryByText("Team Management")).not.toBeInTheDocument();
    });

    it("shows access denied for observers", () => {
      mockAuthValue = {
        ...mockAuthValue,
        user: { id: "u3", email: "o@test.com", displayName: "O", role: "member" },
        activeOrg: { id: "org1", name: "Test Church", role: "observer" },
      };
      renderPage();
      expect(screen.getByText("Access Denied")).toBeInTheDocument();
    });

    it("allows global owner even if org role is not admin", () => {
      mockAuthValue = {
        ...mockAuthValue,
        user: { id: "u1", email: "admin@test.com", displayName: "Admin", role: "owner" },
        activeOrg: { id: "org1", name: "Test Church", role: "musician" },
      };
      renderPage();
      expect(screen.getByText("Team Management")).toBeInTheDocument();
    });
  });

  // ===================== INTERACTIONS =====================

  describe("interactions", () => {
    it("invites a new member", async () => {
      renderPage();
      await waitFor(() => expect(mockListUsers).toHaveBeenCalled());

      fireEvent.change(screen.getByPlaceholderText("Email address *"), {
        target: { value: "new@test.com" },
      });
      fireEvent.change(screen.getByPlaceholderText("Display name *"), {
        target: { value: "New Guy" },
      });
      fireEvent.submit(screen.getByPlaceholderText("Email address *").closest("form")!);

      await waitFor(() => {
        expect(mockInvite).toHaveBeenCalledWith({
          email: "new@test.com",
          displayName: "New Guy",
          role: "musician",
        });
      });
    });

    it("shows invite URL after successful invite", async () => {
      renderPage();
      await waitFor(() => expect(mockListUsers).toHaveBeenCalled());

      fireEvent.change(screen.getByPlaceholderText("Email address *"), {
        target: { value: "new@test.com" },
      });
      fireEvent.change(screen.getByPlaceholderText("Display name *"), {
        target: { value: "New Guy" },
      });
      fireEvent.submit(screen.getByPlaceholderText("Email address *").closest("form")!);

      await waitFor(() => {
        expect(screen.getByText(/reset-password\?token=invite-token&invite=1/)).toBeInTheDocument();
      });
    });

    it("reloads members after invite", async () => {
      renderPage();
      await waitFor(() => expect(mockListUsers).toHaveBeenCalledTimes(1));

      fireEvent.change(screen.getByPlaceholderText("Email address *"), {
        target: { value: "new@test.com" },
      });
      fireEvent.change(screen.getByPlaceholderText("Display name *"), {
        target: { value: "New Guy" },
      });
      fireEvent.submit(screen.getByPlaceholderText("Email address *").closest("form")!);

      await waitFor(() => {
        expect(mockListUsers).toHaveBeenCalledTimes(2);
      });
    });

    it("changes a member role", async () => {
      renderPage();
      await waitFor(() => {
        expect(screen.getByText("Band Member")).toBeInTheDocument();
      });

      // Find the role selector for the musician (u2) — it's the non-disabled one showing "Musician"
      const selects = screen.getAllByDisplayValue("Musician");
      // The first match in the invite form, the second is the member row
      const memberSelect = selects[selects.length - 1];
      fireEvent.change(memberSelect, { target: { value: "admin" } });

      await waitFor(() => {
        expect(mockUpdateRole).toHaveBeenCalledWith("u2", "admin");
        expect(screen.getAllByDisplayValue("Worship Leader").length).toBeGreaterThan(0);
      });
    });

    it("removes a member after confirmation", async () => {
      renderPage();
      await waitFor(() => {
        expect(screen.getByText("Band Member")).toBeInTheDocument();
      });

      // Find remove buttons (excluding the disabled one for self)
      const removeButtons = screen.getAllByTitle("Remove from organization");
      fireEvent.click(removeButtons[0]);
      fireEvent.click(screen.getByRole("button", { name: /remove member/i }));

      await waitFor(() => {
        expect(mockRemoveMember).toHaveBeenCalledWith("u2");
      });
    });

    it("does not remove member when the modal is cancelled", async () => {
      renderPage();
      await waitFor(() => {
        expect(screen.getByText("Band Member")).toBeInTheDocument();
      });

      const removeButtons = screen.getAllByTitle("Remove from organization");
      fireEvent.click(removeButtons[0]);
      fireEvent.click(screen.getByRole("button", { name: /cancel/i }));

      expect(mockRemoveMember).not.toHaveBeenCalled();
    });

    it("shows error toast on invite failure", async () => {
      mockInvite.mockRejectedValue(new Error("Already a member"));
      const { toast } = await import("sonner");

      renderPage();
      await waitFor(() => expect(mockListUsers).toHaveBeenCalled());

      fireEvent.change(screen.getByPlaceholderText("Email address *"), {
        target: { value: "existing@test.com" },
      });
      fireEvent.change(screen.getByPlaceholderText("Display name *"), {
        target: { value: "Existing Member" },
      });
      fireEvent.submit(screen.getByPlaceholderText("Email address *").closest("form")!);

      await waitFor(() => {
        expect(toast.error).toHaveBeenCalledWith("Already a member");
      });
    });

    it("shows error toast on list load failure", async () => {
      mockListUsers.mockRejectedValue(new Error("Network error"));
      const { toast } = await import("sonner");

      renderPage();

      await waitFor(() => {
        expect(toast.error).toHaveBeenCalledWith("Failed to load team members");
      });
    });
  });

  // ===================== SOURCE-LEVEL =====================

  describe("source-level checks", () => {
    it("admin route exists in router", async () => {
      const fs = await import("fs");
      const src = fs.readFileSync("src/router.tsx", "utf-8");
      expect(src).toContain('path: "/admin"');
      expect(src).toContain("AdminPage");
    });

    it("adminApi methods exist in api-client", async () => {
      const fs = await import("fs");
      const src = fs.readFileSync("src/lib/api-client.ts", "utf-8");
      expect(src).toContain("adminApi");
      expect(src).toContain("listUsers:");
      expect(src).toContain("invite:");
      expect(src).toContain("updateRole:");
      expect(src).toContain("removeMember:");
    });

    it("Admin nav link is conditional on admin role in the sidebar", async () => {
      const fs = await import("fs");
      const src = fs.readFileSync("src/components/layout/Sidebar.tsx", "utf-8");
      expect(src).toContain("isAdmin");
      expect(src).toContain('to: "/admin"');
      expect(src).toContain("adminOnly: true");
    });
  });
});
