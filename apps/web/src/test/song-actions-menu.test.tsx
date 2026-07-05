import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, fireEvent, waitFor } from "@testing-library/react";
import { SongActionsMenu } from "@/components/songs/SongActionsMenu";
import type { Song } from "@/lib/api-client";

const mockFavorite = vi.fn();
const mockUnfavorite = vi.fn();
const mockSetStatus = vi.fn();
const mockArchive = vi.fn();
const mockUnarchive = vi.fn();
const mockDelete = vi.fn();
const mockRestore = vi.fn();

vi.mock("@/lib/api-client", () => ({
  songsApi: {
    favorite: (...args: any[]) => mockFavorite(...args),
    unfavorite: (...args: any[]) => mockUnfavorite(...args),
    setStatus: (...args: any[]) => mockSetStatus(...args),
    archive: (...args: any[]) => mockArchive(...args),
    unarchive: (...args: any[]) => mockUnarchive(...args),
    delete: (...args: any[]) => mockDelete(...args),
    restore: (...args: any[]) => mockRestore(...args),
  },
}));

vi.mock("sonner", () => ({
  toast: { success: vi.fn(), error: vi.fn() },
}));

const song: Song = { id: "s1", title: "Amazing Grace", content: "[G]Amazing", isFavorite: false };

function openMenu(props: Partial<Parameters<typeof SongActionsMenu>[0]> = {}) {
  render(<SongActionsMenu song={song} canEdit {...props} />);
  fireEvent.click(screen.getByLabelText("Actions for Amazing Grace"));
}

describe("SongActionsMenu", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("favorites a song and reports the change", async () => {
    mockFavorite.mockResolvedValue({ message: "ok" });
    const onChanged = vi.fn();
    openMenu({ onChanged });

    fireEvent.click(screen.getByText("Add to favorites"));

    await waitFor(() => {
      expect(mockFavorite).toHaveBeenCalledWith("s1");
      expect(onChanged).toHaveBeenCalledWith(expect.objectContaining({ isFavorite: true }));
    });
  });

  it("sets a status from the submenu", async () => {
    mockSetStatus.mockResolvedValue({ song: { ...song, status: "in_rehearsal" } });
    const onChanged = vi.fn();
    openMenu({ onChanged });

    fireEvent.click(screen.getByText("Set status"));
    fireEvent.click(screen.getByText("In Rehearsal"));

    await waitFor(() => {
      expect(mockSetStatus).toHaveBeenCalledWith("s1", "in_rehearsal");
      expect(onChanged).toHaveBeenCalledWith(expect.objectContaining({ status: "in_rehearsal" }));
    });
  });

  it("moves a song to trash and reports removal", async () => {
    mockDelete.mockResolvedValue({ message: "ok" });
    const onRemoved = vi.fn();
    openMenu({ onRemoved });

    fireEvent.click(screen.getByText("Move to trash"));

    await waitFor(() => {
      expect(mockDelete).toHaveBeenCalledWith("s1");
      expect(onRemoved).toHaveBeenCalledWith(expect.objectContaining({ id: "s1" }));
    });
  });

  it("hides edit-only actions when canEdit is false, keeps favorite", () => {
    openMenu({ canEdit: false });

    expect(screen.getByText("Add to favorites")).toBeInTheDocument();
    expect(screen.queryByText("Set status")).not.toBeInTheDocument();
    expect(screen.queryByText("Archive")).not.toBeInTheDocument();
    expect(screen.queryByText("Move to trash")).not.toBeInTheDocument();
  });
});
