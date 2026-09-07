import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { MemoryRouter } from "react-router-dom";
import { AppShell } from "@/components/layout/AppShell";

// ---------- Mocks ----------
const mockLogout = vi.fn();
const mockNavigate = vi.fn();
let mockAuthValue: any;
let mockConnectivityValue: any;

vi.mock("@/contexts/AuthContext", () => ({
  useAuth: () => mockAuthValue,
}));

vi.mock("@/contexts/ConnectivityContext", () => ({
  useConnectivity: () => mockConnectivityValue,
}));

vi.mock("@/contexts/ThemeContext", () => ({
  useTheme: () => ({ resolvedTheme: "dark", toggleTheme: vi.fn() }),
}));

vi.mock("react-router-dom", async () => {
  const actual = await vi.importActual<typeof import("react-router-dom")>("react-router-dom");
  return {
    ...actual,
    useNavigate: () => mockNavigate,
    Outlet: () => <div data-testid="outlet">Page Content</div>,
  };
});

vi.mock("sonner", () => ({
  toast: { success: vi.fn(), error: vi.fn() },
}));

function renderShell(path = "/songs") {
  return render(
    <MemoryRouter initialEntries={[path]}>
      <AppShell />
    </MemoryRouter>,
  );
}

describe("AppShell", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockLogout.mockResolvedValue(undefined);
    mockAuthValue = {
      user: { id: "u1", displayName: "John Smith", email: "john@test.com", role: "member", organizations: [{ id: "org1", name: "Test Church", role: "musician" }] },
      activeOrg: { id: "org1", name: "Test Church", role: "musician" },
      logout: mockLogout,
    };
    mockConnectivityValue = { isOnline: true, syncingOfflineEdits: false, pendingOfflineEditCount: 0 };
  });

  it("renders the page inside a header that links home to the song list", () => {
    renderShell();
    expect(screen.getByTestId("outlet")).toBeInTheDocument();
    expect(screen.getByRole("link", { name: /vpc music home/i })).toHaveAttribute("href", "/songs");
  });

  it("has no sidebar navigation, org switcher or notification bell", () => {
    renderShell();
    expect(screen.queryByRole("link", { name: /dashboard/i })).not.toBeInTheDocument();
    expect(screen.queryByRole("link", { name: /set lists/i })).not.toBeInTheDocument();
    expect(screen.queryByRole("link", { name: /artists/i })).not.toBeInTheDocument();
    expect(screen.queryByText(/north campus|new organization/i)).not.toBeInTheDocument();
    expect(screen.queryByRole("button", { name: /notifications/i })).not.toBeInTheDocument();
  });

  it("offers New song to musicians and admins but not observers", () => {
    renderShell();
    expect(screen.getByRole("link", { name: /new song/i })).toHaveAttribute("href", "/songs/new");
    mockAuthValue = { ...mockAuthValue, activeOrg: { id: "org1", name: "Test Church", role: "observer" } };
    renderShell();
    expect(screen.getAllByRole("link", { name: /new song/i })).toHaveLength(1);
  });

  it("shows the user's initials and an account menu with Settings and Sign out", async () => {
    const user = userEvent.setup();
    renderShell();
    expect(screen.getByText("JS")).toBeInTheDocument();
    await user.click(screen.getByRole("button", { name: /account menu/i }));
    await user.click(screen.getByRole("menuitem", { name: "Settings" }));
    expect(mockNavigate).toHaveBeenCalledWith("/settings");
    await user.click(screen.getByRole("button", { name: /account menu/i }));
    await user.click(screen.getByRole("menuitem", { name: "Sign out" }));
    await waitFor(() => expect(mockLogout).toHaveBeenCalled());
    expect(mockNavigate).toHaveBeenCalledWith("/login");
  });

  it("shows the offline banner when offline and the pending-sync banner when edits are queued", () => {
    mockConnectivityValue = { isOnline: false, syncingOfflineEdits: false, pendingOfflineEditCount: 0 };
    renderShell();
    expect(screen.getByRole("status")).toHaveTextContent(/offline/i);
    mockConnectivityValue = { isOnline: true, syncingOfflineEdits: false, pendingOfflineEditCount: 2 };
    renderShell();
    expect(screen.getAllByRole("status").at(-1)).toHaveTextContent("2 offline edits waiting to sync.");
  });

  it("tells a user with no team to ask for an invite, but still shows settings", () => {
    mockAuthValue = { ...mockAuthValue, user: { ...mockAuthValue.user, organizations: [] }, activeOrg: null };
    renderShell("/songs");
    expect(screen.getByText(/ask your worship leader for an invite/i)).toBeInTheDocument();
    expect(screen.queryByTestId("outlet")).not.toBeInTheDocument();
    renderShell("/settings");
    expect(screen.getByTestId("outlet")).toBeInTheDocument();
  });
});
