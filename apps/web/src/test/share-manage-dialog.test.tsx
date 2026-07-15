import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, waitFor, fireEvent } from "@testing-library/react";
import { ShareManageDialog } from "@/components/songs/ShareManageDialog";
import type { OrgUser, ShareTeam, ShareToken, SongTeamShare } from "@/lib/api-client";

// ---------- API mocks ----------
const mockList = vi.fn();
const mockCreate = vi.fn();
const mockRevoke = vi.fn();
const mockUpdate = vi.fn();
const mockListDirect = vi.fn();
const mockCreateDirect = vi.fn();
const mockRemoveDirect = vi.fn();
const mockListTeams = vi.fn();
const mockCreateTeam = vi.fn();
const mockDeleteTeam = vi.fn();
const mockListTeamShares = vi.fn();
const mockCreateTeamShare = vi.fn();
const mockRemoveTeamShare = vi.fn();
const mockListUsers = vi.fn();

vi.mock("@/lib/api-client", () => ({
  annotationsApi: {
    get: vi.fn().mockResolvedValue({ annotation: null }),
    save: vi.fn().mockResolvedValue({ annotation: { id: "a1", data: [] } }),
  },
  adminApi: {
    listUsers: (...args: any[]) => mockListUsers(...args),
  },
  shareApi: {
    list: (...args: any[]) => mockList(...args),
    create: (...args: any[]) => mockCreate(...args),
    revoke: (...args: any[]) => mockRevoke(...args),
    update: (...args: any[]) => mockUpdate(...args),
    listDirect: (...args: any[]) => mockListDirect(...args),
    createDirect: (...args: any[]) => mockCreateDirect(...args),
    removeDirect: (...args: any[]) => mockRemoveDirect(...args),
    listTeams: (...args: any[]) => mockListTeams(...args),
    createTeam: (...args: any[]) => mockCreateTeam(...args),
    deleteTeam: (...args: any[]) => mockDeleteTeam(...args),
    listTeamShares: (...args: any[]) => mockListTeamShares(...args),
    createTeamShare: (...args: any[]) => mockCreateTeamShare(...args),
    removeTeamShare: (...args: any[]) => mockRemoveTeamShare(...args),
  },
}));

vi.mock("sonner", () => ({
  toast: { success: vi.fn(), error: vi.fn() },
}));

// ---------- Helpers ----------
const SONG_ID = "song-1";

const activeToken: ShareToken = {
  id: "t1",
  token: "abc123",
  songId: SONG_ID,
  label: "For band",
  expiresAt: new Date(Date.now() + 86400000 * 30).toISOString(),
  revoked: false,
  createdAt: "2025-01-15T00:00:00Z",
};

const revokedToken: ShareToken = {
  id: "t2",
  token: "def456",
  songId: SONG_ID,
  label: "Old link",
  expiresAt: null,
  revoked: true,
  createdAt: "2025-01-10T00:00:00Z",
};

const expiredToken: ShareToken = {
  id: "t3",
  token: "ghi789",
  songId: SONG_ID,
  label: "Expired link",
  expiresAt: "2024-01-01T00:00:00Z",
  revoked: false,
  createdAt: "2024-01-01T00:00:00Z",
};

const unlabeledToken: ShareToken = {
  id: "t4",
  token: "jkl012",
  songId: SONG_ID,
  label: null,
  expiresAt: null,
  revoked: false,
  createdAt: "2025-06-01T00:00:00Z",
};

const orgMembers: OrgUser[] = [
  {
    id: "user-1",
    email: "owner@test.com",
    displayName: "Owner User",
    globalRole: "owner",
    orgRole: "admin",
    hasPassword: true,
    createdAt: "2026-03-16T00:00:00Z",
  },
  {
    id: "user-2",
    email: "shared@test.com",
    displayName: "Shared User",
    globalRole: "member",
    orgRole: "musician",
    hasPassword: true,
    createdAt: "2026-03-16T00:00:00Z",
  },
];

const shareTeam: ShareTeam = {
  id: "team-1",
  name: "Vocals",
  members: [
    { userId: "user-2", email: "shared@test.com", displayName: "Shared User" },
  ],
  memberUserIds: ["user-2"],
  memberNames: ["Shared User"],
  memberCount: 1,
  createdAt: "2026-03-16T00:00:00Z",
  updatedAt: "2026-03-16T00:00:00Z",
};

const teamShare: SongTeamShare = {
  id: "ts-1",
  teamId: "team-1",
  teamName: "Vocals",
  createdAt: "2026-03-16T00:00:00Z",
};

function renderDialog(open = true) {
  const onClose = vi.fn();
  const result = render(
    <ShareManageDialog songId={SONG_ID} open={open} onClose={onClose} />,
  );
  return { ...result, onClose };
}

describe("ShareManageDialog", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockList.mockResolvedValue({ shares: [] });
    mockListDirect.mockResolvedValue({ directShares: [] });
    mockListTeams.mockResolvedValue({ teams: [] });
    mockListTeamShares.mockResolvedValue({ teamShares: [] });
    mockListUsers.mockResolvedValue({ users: orgMembers });
    mockCreate.mockResolvedValue({ shareToken: activeToken, shareUrl: "/shared/abc123" });
    mockUpdate.mockResolvedValue({ shareToken: { ...activeToken, label: "Updated" } });
    mockRevoke.mockResolvedValue({ message: "ok" });
    mockCreateDirect.mockResolvedValue({
      directShare: { id: "ds-1", userId: "user-2", email: "shared@test.com", displayName: "Shared User", createdAt: "2026-03-16T00:00:00Z" },
    });
    mockRemoveDirect.mockResolvedValue({ message: "ok" });
    mockCreateTeam.mockResolvedValue({ team: shareTeam });
    mockDeleteTeam.mockResolvedValue({ message: "ok" });
    mockCreateTeamShare.mockResolvedValue({ teamShare });
    mockRemoveTeamShare.mockResolvedValue({ message: "ok" });
  });

  // ===================== RENDERING =====================

  describe("rendering", () => {
    it("renders nothing when closed", () => {
      renderDialog(false);
      expect(screen.queryByText("Manage Share Links")).not.toBeInTheDocument();
    });

    it("renders dialog when open", async () => {
      renderDialog();
      expect(screen.getByText("Manage Share Links")).toBeInTheDocument();
    });

    it("renders create-new-link section", async () => {
      renderDialog();
      expect(screen.getByText("Create New Link")).toBeInTheDocument();
      expect(screen.getByText("Share with Specific Users")).toBeInTheDocument();
      expect(screen.getByPlaceholderText("Label (optional)")).toBeInTheDocument();
      expect(screen.getByPlaceholderText("User email")).toBeInTheDocument();
      expect(screen.getByText("Create")).toBeInTheDocument();
    });

    it("renders expiry dropdown options", async () => {
      renderDialog();
      const select = screen.getByDisplayValue("No expiry");
      expect(select).toBeInTheDocument();
      expect(select.querySelectorAll("option").length).toBe(5);
    });

    it("renders Done button in footer", () => {
      renderDialog();
      expect(screen.getByText("Done")).toBeInTheDocument();
    });

    it("shows empty state when no tokens exist", async () => {
      renderDialog();
      await waitFor(() => {
        expect(screen.getByText("No share links yet. Create one above.")).toBeInTheDocument();
      });
    });

    it("renders active tokens with correct status", async () => {
      mockList.mockResolvedValue({ shares: [activeToken] });
      renderDialog();
      await waitFor(() => {
        expect(screen.getByText("For band")).toBeInTheDocument();
        expect(screen.getByText("Active")).toBeInTheDocument();
      });
    });

    it("renders revoked tokens with correct status", async () => {
      mockList.mockResolvedValue({ shares: [revokedToken] });
      renderDialog();
      await waitFor(() => {
        expect(screen.getByText("Old link")).toBeInTheDocument();
        expect(screen.getByText("Revoked")).toBeInTheDocument();
      });
    });

    it("renders expired tokens with correct status", async () => {
      mockList.mockResolvedValue({ shares: [expiredToken] });
      renderDialog();
      await waitFor(() => {
        expect(screen.getByText("Expired link")).toBeInTheDocument();
        expect(screen.getByText("Expired")).toBeInTheDocument();
      });
    });

    it("renders unlabeled tokens as Untitled link", async () => {
      mockList.mockResolvedValue({ shares: [unlabeledToken] });
      renderDialog();
      await waitFor(() => {
        expect(screen.getByText("Untitled link")).toBeInTheDocument();
      });
    });

    it("separates active and revoked sections with headings", async () => {
      mockList.mockResolvedValue({ shares: [activeToken, revokedToken] });
      renderDialog();
      await waitFor(() => {
        expect(screen.getByText(/Active \(1\)/)).toBeInTheDocument();
        expect(screen.getByText(/Revoked \(1\)/)).toBeInTheDocument();
      });
    });

    it("shows Copy, Open, and Revoke actions only on active non-expired tokens", async () => {
      mockList.mockResolvedValue({ shares: [activeToken] });
      renderDialog();
      await waitFor(() => {
        expect(screen.getByText("Copy")).toBeInTheDocument();
        expect(screen.getByText("Open")).toBeInTheDocument();
        expect(screen.getByText("Revoke")).toBeInTheDocument();
      });
    });

    it("hides action buttons on revoked tokens", async () => {
      mockList.mockResolvedValue({ shares: [revokedToken] });
      renderDialog();
      await waitFor(() => {
        expect(screen.getByText("Old link")).toBeInTheDocument();
      });
      expect(screen.queryByText("Copy")).not.toBeInTheDocument();
      expect(screen.queryByText("Revoke")).not.toBeInTheDocument();
    });

    it("hides action buttons on expired tokens", async () => {
      mockList.mockResolvedValue({ shares: [expiredToken] });
      renderDialog();
      await waitFor(() => {
        expect(screen.getByText("Expired link")).toBeInTheDocument();
      });
      expect(screen.queryByText("Copy")).not.toBeInTheDocument();
      expect(screen.queryByText("Revoke")).not.toBeInTheDocument();
    });
  });

  // ===================== INTERACTIONS =====================

  describe("interactions", () => {
    it("loads shares on open", async () => {
      renderDialog();
      await waitFor(() => {
        expect(mockList).toHaveBeenCalledWith(SONG_ID);
        expect(mockListDirect).toHaveBeenCalledWith(SONG_ID);
        expect(mockListTeams).toHaveBeenCalledWith();
        expect(mockListTeamShares).toHaveBeenCalledWith(SONG_ID);
        expect(mockListUsers).toHaveBeenCalledWith();
      });
    });

    it("calls onClose when X button clicked", async () => {
      const { onClose } = renderDialog();
      // X button is the first button (close icon)
      const closeButton = screen.getByRole("button", { name: "" });
      fireEvent.click(closeButton);
      expect(onClose).toHaveBeenCalled();
    });

    it("calls onClose when Done button clicked", () => {
      const { onClose } = renderDialog();
      fireEvent.click(screen.getByText("Done"));
      expect(onClose).toHaveBeenCalled();
    });

    it("creates a new share link with label and expiry", async () => {
      renderDialog();
      await waitFor(() => {
        expect(mockList).toHaveBeenCalled();
      });

      fireEvent.change(screen.getByPlaceholderText("Label (optional)"), {
        target: { value: "Sunday rehearsal" },
      });
      fireEvent.change(screen.getByDisplayValue("No expiry"), {
        target: { value: "7" },
      });
      fireEvent.click(screen.getByText("Create"));

      await waitFor(() => {
        expect(mockCreate).toHaveBeenCalledWith(SONG_ID, {
          label: "Sunday rehearsal",
          expiresInDays: 7,
        });
      });
    });

    it("creates a share link without label or expiry", async () => {
      renderDialog();
      await waitFor(() => {
        expect(mockList).toHaveBeenCalled();
      });

      fireEvent.click(screen.getByText("Create"));

      await waitFor(() => {
        expect(mockCreate).toHaveBeenCalledWith(SONG_ID, {});
      });
    });

    it("reloads shares after creation", async () => {
      renderDialog();
      await waitFor(() => {
        expect(mockList).toHaveBeenCalledTimes(1);
      });

      fireEvent.click(screen.getByText("Create"));

      await waitFor(() => {
        expect(mockList).toHaveBeenCalledTimes(2);
      });
    });

    it("copies share link to clipboard", async () => {
      mockList.mockResolvedValue({ shares: [activeToken] });
      const writeText = vi.fn().mockResolvedValue(undefined);
      Object.assign(navigator, { clipboard: { writeText } });

      renderDialog();
      await waitFor(() => {
        expect(screen.getByText("Copy")).toBeInTheDocument();
      });

      fireEvent.click(screen.getByText("Copy"));

      await waitFor(() => {
        expect(writeText).toHaveBeenCalledWith(
          expect.stringContaining("/shared/abc123"),
        );
      });
    });

    it("shows Copied text after copying", async () => {
      mockList.mockResolvedValue({ shares: [activeToken] });
      Object.assign(navigator, {
        clipboard: { writeText: vi.fn().mockResolvedValue(undefined) },
      });

      renderDialog();
      await waitFor(() => {
        expect(screen.getByText("Copy")).toBeInTheDocument();
      });

      fireEvent.click(screen.getByText("Copy"));

      await waitFor(() => {
        expect(screen.getByText("Copied")).toBeInTheDocument();
      });
    });

    it("revokes a share link after modal confirmation", async () => {
      mockList.mockResolvedValue({ shares: [activeToken] });

      renderDialog();
      await waitFor(() => {
        expect(screen.getByText("Revoke")).toBeInTheDocument();
      });

      fireEvent.click(screen.getByText("Revoke"));
      fireEvent.click(screen.getByRole("button", { name: /revoke link/i }));

      await waitFor(() => {
        expect(mockRevoke).toHaveBeenCalledWith(SONG_ID, "t1");
      });
    });

    it("does not revoke when the modal is cancelled", async () => {
      mockList.mockResolvedValue({ shares: [activeToken] });

      renderDialog();
      await waitFor(() => {
        expect(screen.getByText("Revoke")).toBeInTheDocument();
      });

      fireEvent.click(screen.getByText("Revoke"));
      fireEvent.click(screen.getByRole("button", { name: /cancel/i }));

      expect(mockRevoke).not.toHaveBeenCalled();
    });

    it("opens inline edit mode on label click", async () => {
      mockList.mockResolvedValue({ shares: [activeToken] });

      renderDialog();
      await waitFor(() => {
        expect(screen.getByText("For band")).toBeInTheDocument();
      });

      fireEvent.click(screen.getByText("For band"));

      await waitFor(() => {
        expect(screen.getByPlaceholderText("Enter label...")).toBeInTheDocument();
        expect(screen.getByText("Save")).toBeInTheDocument();
        expect(screen.getByText("Cancel")).toBeInTheDocument();
      });
    });

    it("saves label on Save click", async () => {
      mockList.mockResolvedValue({ shares: [activeToken] });

      renderDialog();
      await waitFor(() => {
        expect(screen.getByText("For band")).toBeInTheDocument();
      });

      fireEvent.click(screen.getByText("For band"));

      const labelInput = screen.getByPlaceholderText("Enter label...");
      fireEvent.change(labelInput, { target: { value: "Updated name" } });
      fireEvent.click(screen.getByText("Save"));

      await waitFor(() => {
        expect(mockUpdate).toHaveBeenCalledWith(SONG_ID, "t1", {
          label: "Updated name",
        });
      });
    });

    it("saves label on Enter keypress", async () => {
      mockList.mockResolvedValue({ shares: [activeToken] });

      renderDialog();
      await waitFor(() => {
        expect(screen.getByText("For band")).toBeInTheDocument();
      });

      fireEvent.click(screen.getByText("For band"));

      const labelInput = screen.getByPlaceholderText("Enter label...");
      fireEvent.change(labelInput, { target: { value: "New label" } });
      fireEvent.keyDown(labelInput, { key: "Enter" });

      await waitFor(() => {
        expect(mockUpdate).toHaveBeenCalledWith(SONG_ID, "t1", {
          label: "New label",
        });
      });
    });

    it("cancels edit on Cancel click", async () => {
      mockList.mockResolvedValue({ shares: [activeToken] });

      renderDialog();
      await waitFor(() => {
        expect(screen.getByText("For band")).toBeInTheDocument();
      });

      fireEvent.click(screen.getByText("For band"));
      expect(screen.getByPlaceholderText("Enter label...")).toBeInTheDocument();

      fireEvent.click(screen.getByText("Cancel"));

      await waitFor(() => {
        expect(screen.queryByPlaceholderText("Enter label...")).not.toBeInTheDocument();
        expect(screen.getByText("For band")).toBeInTheDocument();
      });
    });

    it("cancels edit on Escape keypress", async () => {
      mockList.mockResolvedValue({ shares: [activeToken] });

      renderDialog();
      await waitFor(() => {
        expect(screen.getByText("For band")).toBeInTheDocument();
      });

      fireEvent.click(screen.getByText("For band"));

      const labelInput = screen.getByPlaceholderText("Enter label...");
      fireEvent.keyDown(labelInput, { key: "Escape" });

      await waitFor(() => {
        expect(screen.queryByPlaceholderText("Enter label...")).not.toBeInTheDocument();
      });
    });

    it("shows error toast on create failure", async () => {
      mockCreate.mockRejectedValue(new Error("Server error"));
      const { toast } = await import("sonner");

      renderDialog();
      await waitFor(() => {
        expect(mockList).toHaveBeenCalled();
      });

      fireEvent.click(screen.getByText("Create"));

      await waitFor(() => {
        expect(toast.error).toHaveBeenCalledWith("Server error");
      });
    });

    it("shows error toast on list failure", async () => {
      mockList.mockRejectedValue(new Error("Network error"));
      const { toast } = await import("sonner");

      renderDialog();

      await waitFor(() => {
        expect(toast.error).toHaveBeenCalledWith("Failed to load sharing settings");
      });
    });

    it("creates a direct user share from the email input", async () => {
      renderDialog();

      await waitFor(() => {
        expect(mockListDirect).toHaveBeenCalled();
      });

      fireEvent.change(screen.getByPlaceholderText("User email"), {
        target: { value: "shared@test.com" },
      });
      fireEvent.click(screen.getAllByText("Share")[0]);

      await waitFor(() => {
        expect(mockCreateDirect).toHaveBeenCalledWith(SONG_ID, { email: "shared@test.com" });
      });

      expect(screen.getByText("Shared User")).toBeInTheDocument();
    });

    it("removes a direct user share after modal confirmation", async () => {
      mockListDirect.mockResolvedValue({
        directShares: [{ id: "ds-1", userId: "user-2", email: "shared@test.com", displayName: "Shared User", createdAt: "2026-03-16T00:00:00Z" }],
      });

      renderDialog();

      await waitFor(() => {
        expect(screen.getByText("Shared User")).toBeInTheDocument();
      });

      fireEvent.click(screen.getByText("Remove"));
      fireEvent.click(screen.getByRole("button", { name: /remove share/i }));

      await waitFor(() => {
        expect(mockRemoveDirect).toHaveBeenCalledWith(SONG_ID, "ds-1");
      });
    });

    it("creates a reusable share team", async () => {
      renderDialog();

      await waitFor(() => {
        expect(mockListUsers).toHaveBeenCalled();
      });

      fireEvent.change(screen.getByPlaceholderText("Band, vocals, youth team..."), {
        target: { value: "Vocals" },
      });

      const memberSelect = screen.getAllByRole("listbox")[0] as HTMLSelectElement;
      Array.from(memberSelect.options).forEach((option) => {
        option.selected = option.value === "user-2";
      });
      fireEvent.change(memberSelect);

      fireEvent.click(screen.getByText("Create Team"));

      await waitFor(() => {
        expect(mockCreateTeam).toHaveBeenCalledWith({
          name: "Vocals",
          userIds: ["user-2"],
        });
      });

      expect(screen.getAllByText("Vocals").length).toBeGreaterThan(0);
    });

    it("shares a song with a reusable team", async () => {
      mockListTeams.mockResolvedValue({ teams: [shareTeam] });
      renderDialog();

      await waitFor(() => {
        expect(screen.getByText("Share with Teams")).toBeInTheDocument();
      });

      fireEvent.change(screen.getByDisplayValue("Select a team"), {
        target: { value: "team-1" },
      });
      fireEvent.click(screen.getAllByText("Share")[1]);

      await waitFor(() => {
        expect(mockCreateTeamShare).toHaveBeenCalledWith(SONG_ID, { teamId: "team-1" });
      });

      expect(screen.getAllByText("Vocals").length).toBeGreaterThan(0);
    });

    it("removes a team share after modal confirmation", async () => {
      mockListTeamShares.mockResolvedValue({ teamShares: [teamShare] });

      renderDialog();

      await waitFor(() => {
        expect(screen.getByText("Vocals")).toBeInTheDocument();
      });

      fireEvent.click(screen.getAllByText("Remove")[0]);
      fireEvent.click(screen.getByRole("button", { name: /remove team share/i }));

      await waitFor(() => {
        expect(mockRemoveTeamShare).toHaveBeenCalledWith(SONG_ID, "ts-1");
      });
    });
  });

  // ===================== SOURCE-LEVEL =====================

  describe("source-level checks", () => {
    it("PATCH route exists in share routes", async () => {
      const fs = await import("fs");
      const src = fs.readFileSync("../api/src/features/share/routes.js", "utf-8");
      expect(src).toContain("shareRoutes.patch(");
      expect(src).toContain("/api/songs/:id/shares/:tokenId");
    });

    it("shareApi.update method exists in api-client", async () => {
      const fs = await import("fs");
      const src = fs.readFileSync("src/lib/api-client.ts", "utf-8");
      expect(src).toContain("update:");
      expect(src).toContain("method: \"PATCH\"");
    });

    it("ShareManageDialog is wired into SongViewPage", async () => {
      const fs = await import("fs");
      const src = fs.readFileSync("src/pages/songs/SongViewPage.tsx", "utf-8");
      expect(src).toContain("ShareManageDialog");
      expect(src).toContain("showShareManage");
    });
  });
});
