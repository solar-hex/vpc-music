import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, waitFor, fireEvent } from "@testing-library/react";
import { TeamSection } from "@/pages/settings/TeamSection";

// ---------- Mocks ----------
const mockListUsers = vi.fn();
const mockInvite = vi.fn();
const mockInviteBulk = vi.fn();
const mockResendInvite = vi.fn();
const mockUpdateRole = vi.fn();
const mockRemoveMember = vi.fn();
const mockUpdateOrg = vi.fn();

vi.mock("@/lib/api-client", () => ({
  adminApi: {
    listUsers: (...args: any[]) => mockListUsers(...args),
    invite: (...args: any[]) => mockInvite(...args),
    inviteBulk: (...args: any[]) => mockInviteBulk(...args),
    resendInvite: (...args: any[]) => mockResendInvite(...args),
    updateRole: (...args: any[]) => mockUpdateRole(...args),
    removeMember: (...args: any[]) => mockRemoveMember(...args),
  },
  orgsApi: {
    update: (...args: any[]) => mockUpdateOrg(...args),
  },
}));

vi.mock("sonner", () => ({
  toast: { success: vi.fn(), error: vi.fn() },
}));

const mockRefreshUser = vi.fn();
let mockAuthValue: any;
vi.mock("@/contexts/AuthContext", () => ({
  useAuth: () => mockAuthValue,
}));

const membersList = [
  { id: "u1", email: "admin@test.com", displayName: "Admin User", globalRole: "owner", orgRole: "admin", hasPassword: true, createdAt: "2025-01-01T00:00:00Z" },
  { id: "u2", email: "musician@test.com", displayName: "Band Member", globalRole: "member", orgRole: "musician", hasPassword: true, createdAt: "2025-02-01T00:00:00Z" },
  { id: "u3", email: "invited@test.com", displayName: "New Person", globalRole: "member", orgRole: "observer", hasPassword: false, createdAt: "2025-06-01T00:00:00Z" },
];

async function renderLoaded() {
  const view = render(<TeamSection />);
  await waitFor(() => expect(screen.getByText("Band Member")).toBeInTheDocument());
  return view;
}

function fillInvite(email: string, name: string) {
  fireEvent.change(screen.getByLabelText("Email address"), { target: { value: email } });
  fireEvent.change(screen.getByLabelText("Display name for the invite"), { target: { value: name } });
  fireEvent.click(screen.getByRole("button", { name: "Send invite" }));
}

describe("TeamSection", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockListUsers.mockResolvedValue({ users: membersList });
    mockInvite.mockResolvedValue({
      user: { id: "u4", email: "new@test.com", orgRole: "musician" },
      inviteUrl: "http://localhost/reset-password?token=invite-token&invite=1",
      message: "Invite created for new@test.com",
    });
    mockInviteBulk.mockResolvedValue({ invited: 2, results: [{ status: "invited" }, { status: "invited" }] });
    mockResendInvite.mockResolvedValue({ message: "Invite resent", inviteUrl: "http://localhost/reset-password?token=again" });
    mockUpdateRole.mockResolvedValue({ message: "Role updated" });
    mockRemoveMember.mockResolvedValue({ message: "User removed" });
    mockUpdateOrg.mockResolvedValue({ organization: { id: "org1", name: "Renamed Church" } });
    mockAuthValue = {
      user: { id: "u1", email: "admin@test.com", displayName: "Admin", role: "owner" },
      activeOrg: { id: "org1", name: "Test Church", role: "admin" },
      refreshUser: mockRefreshUser,
    };
  });

  it("lists the members with their state", async () => {
    await renderLoaded();
    expect(screen.getByText("Members (3)")).toBeInTheDocument();
    expect(screen.getByText("Admin User")).toBeInTheDocument();
    expect(screen.getByText("New Person")).toBeInTheDocument();
    expect(screen.getByText("musician@test.com")).toBeInTheDocument();
    expect(screen.getByText("(you)")).toBeInTheDocument();
    expect(screen.getByText("Invited")).toBeInTheDocument();
    expect(screen.getByLabelText("Role for Admin User")).toBeDisabled();
    expect(screen.getByLabelText("Role for Band Member")).toHaveValue("musician");
  });

  it("shows the empty state", async () => {
    mockListUsers.mockResolvedValue({ users: [] });
    render(<TeamSection />);
    expect(await screen.findByText("No members yet. Invite someone above.")).toBeInTheDocument();
  });

  it("reports a load failure", async () => {
    const { toast } = await import("sonner");
    mockListUsers.mockRejectedValue(new Error("Network error"));
    render(<TeamSection />);
    await waitFor(() => expect(toast.error).toHaveBeenCalledWith("Failed to load team members"));
  });

  it("invites a member, shows the link and reloads the list", async () => {
    await renderLoaded();
    expect(mockListUsers).toHaveBeenCalledTimes(1);
    fillInvite("new@test.com", "New Guy");
    await waitFor(() => {
      expect(mockInvite).toHaveBeenCalledWith({ email: "new@test.com", displayName: "New Guy", role: "musician" });
    });
    expect(await screen.findByText(/reset-password\?token=invite-token&invite=1/)).toBeInTheDocument();
    await waitFor(() => expect(mockListUsers).toHaveBeenCalledTimes(2));
  });

  it("requires an email and a name for an invite", async () => {
    const { toast } = await import("sonner");
    await renderLoaded();
    fireEvent.click(screen.getByRole("button", { name: "Send invite" }));
    expect(toast.error).toHaveBeenCalledWith("Email is required");
    fireEvent.change(screen.getByLabelText("Email address"), { target: { value: "x@test.com" } });
    fireEvent.click(screen.getByRole("button", { name: "Send invite" }));
    expect(toast.error).toHaveBeenCalledWith("Display name is required");
    expect(mockInvite).not.toHaveBeenCalled();
  });

  it("reports an invite failure", async () => {
    const { toast } = await import("sonner");
    mockInvite.mockRejectedValue(new Error("Already a member"));
    await renderLoaded();
    fillInvite("existing@test.com", "Existing Member");
    await waitFor(() => expect(toast.error).toHaveBeenCalledWith("Already a member"));
  });

  it("invites several people at once", async () => {
    await renderLoaded();
    fireEvent.click(screen.getByRole("button", { name: "Invite several at once" }));
    fireEvent.change(screen.getByLabelText("Bulk invite emails"), {
      target: { value: "jane@church.org, Jane Smith\nmark@church.org\n" },
    });
    fireEvent.change(screen.getByLabelText("Role for all:"), { target: { value: "observer" } });
    fireEvent.click(screen.getByRole("button", { name: "Send invites" }));
    await waitFor(() => {
      expect(mockInviteBulk).toHaveBeenCalledWith([
        { email: "jane@church.org", displayName: "Jane Smith", role: "observer" },
        { email: "mark@church.org", displayName: "mark@church.org", role: "observer" },
      ]);
    });
    await waitFor(() => expect(mockListUsers).toHaveBeenCalledTimes(2));
  });

  it("changes a member's role", async () => {
    await renderLoaded();
    fireEvent.change(screen.getByLabelText("Role for Band Member"), { target: { value: "admin" } });
    await waitFor(() => expect(mockUpdateRole).toHaveBeenCalledWith("u2", "admin"));
    expect(screen.getByLabelText("Role for Band Member")).toHaveValue("admin");
  });

  it("resends an invite to someone who has not set a password", async () => {
    await renderLoaded();
    expect(screen.queryByLabelText("Resend invite to Band Member")).not.toBeInTheDocument();
    fireEvent.click(screen.getByLabelText("Resend invite to New Person"));
    await waitFor(() => expect(mockResendInvite).toHaveBeenCalledWith("u3"));
    expect(await screen.findByText(/token=again/)).toBeInTheDocument();
  });

  it("removes a member after confirmation", async () => {
    await renderLoaded();
    expect(screen.getByLabelText("Remove Admin User from the team")).toBeDisabled();
    fireEvent.click(screen.getByLabelText("Remove Band Member from the team"));
    fireEvent.click(screen.getByRole("button", { name: "Remove member" }));
    await waitFor(() => expect(mockRemoveMember).toHaveBeenCalledWith("u2"));
    await waitFor(() => expect(screen.queryByText("Band Member")).not.toBeInTheDocument());
  });

  it("keeps the member when the confirmation is cancelled", async () => {
    await renderLoaded();
    fireEvent.click(screen.getByLabelText("Remove Band Member from the team"));
    fireEvent.click(screen.getByRole("button", { name: /cancel/i }));
    expect(mockRemoveMember).not.toHaveBeenCalled();
    expect(screen.getByText("Band Member")).toBeInTheDocument();
  });

  it("renames the team", async () => {
    await renderLoaded();
    const input = screen.getByLabelText("Team name");
    expect(input).toHaveValue("Test Church");
    fireEvent.change(input, { target: { value: "Renamed Church" } });
    fireEvent.click(screen.getByRole("button", { name: "Rename" }));
    await waitFor(() => {
      expect(mockUpdateOrg).toHaveBeenCalledWith("org1", { name: "Renamed Church" });
      expect(mockRefreshUser).toHaveBeenCalled();
    });
  });

  it("rejects an empty team name", async () => {
    const { toast } = await import("sonner");
    await renderLoaded();
    fireEvent.change(screen.getByLabelText("Team name"), { target: { value: "   " } });
    fireEvent.click(screen.getByRole("button", { name: "Rename" }));
    expect(toast.error).toHaveBeenCalledWith("Team name is required");
    expect(mockUpdateOrg).not.toHaveBeenCalled();
  });
});
