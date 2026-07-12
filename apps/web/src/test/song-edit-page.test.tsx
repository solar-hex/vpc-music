import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { createMemoryRouter, RouterProvider } from "react-router-dom";
import { SongEditPage } from "@/pages/songs/SongEditPage";

// ---------- Mocks ----------
const mockGet = vi.fn();
const mockCreate = vi.fn();
const mockUpdate = vi.fn();
const mockVariationCreate = vi.fn();
const mockVariationUpdate = vi.fn();
const mockNavigate = vi.fn();
const mockImportChrd = vi.fn();
const mockPreviewImportChrd = vi.fn();
const mockImportOnSong = vi.fn();
const mockPreviewImportOnSong = vi.fn();
const mockImportPdf = vi.fn();
const mockPreviewImportPdf = vi.fn();
const mockFindDuplicates = vi.fn();

vi.mock("@/lib/api-client", () => ({
  songsApi: {
    get: (...args: any[]) => mockGet(...args),
    create: (...args: any[]) => mockCreate(...args),
    update: (...args: any[]) => mockUpdate(...args),
    findDuplicates: (...args: any[]) => mockFindDuplicates(...args),
    getTags: () => Promise.resolve({ tags: ["worship", "hymn", "contemporary"] }),
    importChrd: (...args: any[]) => mockImportChrd(...args),
    previewImportChrd: (...args: any[]) => mockPreviewImportChrd(...args),
    importOnSong: (...args: any[]) => mockImportOnSong(...args),
    previewImportOnSong: (...args: any[]) => mockPreviewImportOnSong(...args),
    importPdf: (...args: any[]) => mockImportPdf(...args),
    previewImportPdf: (...args: any[]) => mockPreviewImportPdf(...args),
  },
  variationsApi: {
    create: (...args: any[]) => mockVariationCreate(...args),
    update: (...args: any[]) => mockVariationUpdate(...args),
  },
}));

vi.mock("@/components/songs/ChordProRenderer", () => ({
  ChordProRenderer: ({ content, songKey }: { content: string; songKey?: string }) => (
    <div data-testid="import-preview-renderer">
      preview:{content}::{songKey || ""}
    </div>
  ),
}));

vi.mock("react-router-dom", async () => {
  const actual = await vi.importActual("react-router-dom");
  return {
    ...actual,
    useNavigate: () => mockNavigate,
  };
});

vi.mock("sonner", () => ({
  toast: { success: vi.fn(), error: vi.fn(), info: vi.fn() },
}));

vi.mock("@vpc-music/shared", () => ({
  transposeKeyName: (key: string) => key,
  keyPrefersFlats: () => false,
  ALL_KEYS: ["C", "D", "E", "F", "G", "A", "B"],
  CHORD_REGEX: /^[A-G][b#]?(?:m|min|maj|dim|aug|sus[24]?|add)?[0-9]?(?:\/[A-G][b#]?)?$/,
  PRESET_TAGS: ["worship", "praise", "hymn", "classic", "contemporary"],
  parseChordPro: (input: string) => ({
    directives: {
      ...(input.match(/\{title:\s*(.*?)\}/i)?.[1] ? { title: input.match(/\{title:\s*(.*?)\}/i)?.[1] } : {}),
      ...(input.match(/\{key:\s*(.*?)\}/i)?.[1] ? { key: input.match(/\{key:\s*(.*?)\}/i)?.[1] } : {}),
      ...(input.match(/\{artist:\s*(.*?)\}/i)?.[1] ? { artist: input.match(/\{artist:\s*(.*?)\}/i)?.[1] } : {}),
      ...(input.match(/\{tempo:\s*(.*?)\}/i)?.[1] ? { tempo: input.match(/\{tempo:\s*(.*?)\}/i)?.[1] } : {}),
    },
    sections: [],
  }),
}));

let mockAuthValue: any = {
  user: { id: "u1", email: "test@test.com", displayName: "Test", role: "owner" },
  activeOrg: { id: "org1", name: "Test Church", role: "admin" },
};
vi.mock("@/contexts/AuthContext", () => ({
  useAuth: () => mockAuthValue,
}));

const mockRefreshPendingOfflineEditCount = vi.fn();
let mockConnectivityValue = {
  isOnline: true,
  syncingOfflineEdits: false,
  pendingOfflineEditCount: 0,
  refreshPendingOfflineEditCount: mockRefreshPendingOfflineEditCount,
};

vi.mock("@/contexts/ConnectivityContext", () => ({
  useConnectivity: () => mockConnectivityValue,
}));

const mockEnqueueOfflineSongEdit = vi.fn();
const mockSaveCachedSong = vi.fn();
const mockLoadCachedSong = vi.fn();
const mockIsOfflineRequestError = vi.fn();

vi.mock("@/lib/offline-cache", () => ({
  enqueueOfflineSongEdit: (...args: any[]) => mockEnqueueOfflineSongEdit(...args),
  saveCachedSong: (...args: any[]) => mockSaveCachedSong(...args),
  loadCachedSong: (...args: any[]) => mockLoadCachedSong(...args),
  isOfflineRequestError: (...args: any[]) => mockIsOfflineRequestError(...args),
}));

function renderNewSong() {
  const router = createMemoryRouter(
    [
      { path: "/songs/new", element: <SongEditPage /> },
      { path: "/songs", element: <div>Songs List</div> },
    ],
    { initialEntries: ["/songs/new"] },
  );

  return render(
    <RouterProvider router={router} />,
  );
}

function renderEditSong(id = "song-1") {
  const router = createMemoryRouter(
    [
      { path: "/songs/:id/edit", element: <SongEditPage /> },
      { path: "/songs/:id", element: <div>Song View</div> },
      { path: "/songs", element: <div>Songs List</div> },
    ],
    { initialEntries: [`/songs/${id}/edit`] },
  );

  return render(
    <RouterProvider router={router} />,
  );
}

function renderEditSongVariation(id = "song-1", variationId = "v1") {
  const router = createMemoryRouter(
    [
      { path: "/songs/:id/edit", element: <SongEditPage /> },
      { path: "/songs/:id", element: <div>Song View</div> },
      { path: "/songs", element: <div>Songs List</div> },
    ],
    { initialEntries: [`/songs/${id}/edit?variation=${variationId}`] },
  );

  return render(
    <RouterProvider router={router} />,
  );
}

describe("SongEditPage", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockImportChrd.mockResolvedValue({ song: { id: "imported-chrd" } });
    mockPreviewImportChrd.mockResolvedValue({
      chordPro: "{title: Test}\n{key: G}\n\n[G]Hello",
      metadata: { title: "Test", key: "G", artist: null, tempo: null },
    });
    mockImportOnSong.mockResolvedValue({ song: { id: "imported-onsong" }, chordPro: "{title: Test}" });
    mockPreviewImportOnSong.mockResolvedValue({
      chordPro: "{title: Test Song}\n{key: C}\n\n[C]Hello",
      metadata: { title: "Test Song", key: "C", artist: null, tempo: null },
    });
    mockImportPdf.mockResolvedValue({ song: { id: "imported-pdf" }, chordPro: "{title: Test}" });
    mockPreviewImportPdf.mockResolvedValue({
      chordPro: "{title: PDF Song}\n{tempo: 88}\n\n[C]Hello",
      metadata: { title: "PDF Song", key: null, artist: null, tempo: 88 },
    });
    mockVariationCreate.mockResolvedValue({ variation: { id: "arr-1", name: "Sunday arrangement", content: "{comment: Chorus}" } });
    mockFindDuplicates.mockResolvedValue({ matches: [] });
    mockConnectivityValue = {
      isOnline: true,
      syncingOfflineEdits: false,
      pendingOfflineEditCount: 0,
      refreshPendingOfflineEditCount: mockRefreshPendingOfflineEditCount,
    };
    mockLoadCachedSong.mockReturnValue(null);
    mockIsOfflineRequestError.mockReturnValue(false);
  });

  // ===================== POSITIVE — New Song =====================

  describe("positive — create new song", () => {
    it("renders New Song heading", () => {
      renderNewSong();
      expect(screen.getByText("New Song")).toBeInTheDocument();
    });

    it("renders all form fields", () => {
      renderNewSong();
      expect(screen.getByPlaceholderText("Song title")).toBeInTheDocument();
      expect(screen.getByPlaceholderText("Wedding, Church, Special Event")).toBeInTheDocument();
      expect(screen.getByText("Select key")).toBeInTheDocument();
      expect(screen.getByPlaceholderText("120")).toBeInTheDocument();
      expect(screen.getByPlaceholderText("Artist or composer")).toBeInTheDocument();
      expect(screen.getByPlaceholderText("Optional alternate names, comma separated")).toBeInTheDocument();
      expect(screen.getByPlaceholderText("Optional spoken cue or callout")).toBeInTheDocument();
      expect(screen.getByText("Tags")).toBeInTheDocument();
    });

    it("renders Create Song button", () => {
      renderNewSong();
      expect(screen.getByRole("button", { name: /create song/i })).toBeInTheDocument();
    });

    it("has cancel link back to songs", () => {
      renderNewSong();
      expect(screen.getByRole("link", { name: /cancel/i })).toHaveAttribute("href", "/songs");
    });

    it("creates song and navigates on success", async () => {
      mockCreate.mockResolvedValue({ song: { id: "new-1" } });
      renderNewSong();
      const user = userEvent.setup();
      await user.type(screen.getByPlaceholderText("Song title"), "New Song Title");
      await user.type(screen.getByPlaceholderText("Wedding, Church, Special Event"), "Church");
      await user.type(screen.getByPlaceholderText("Optional alternate names, comma separated"), "Grace Song, Old Hymn");
      await user.type(screen.getByPlaceholderText("Optional spoken cue or callout"), "Band comes in loud");
      await user.click(screen.getByRole("button", { name: /create song/i }));

      await waitFor(() => {
        expect(mockCreate).toHaveBeenCalledWith(expect.objectContaining({
          title: "New Song Title",
          category: "Church",
          aka: "Grace Song, Old Hymn",
          shout: "Band comes in loud",
        }));
        expect(mockNavigate).toHaveBeenCalledWith("/songs/new-1");
      });
    });

    it("creates song with tags added through the tag input", async () => {
      mockCreate.mockResolvedValue({ song: { id: "new-2" } });
      renderNewSong();
      const user = userEvent.setup();

      await user.type(screen.getByPlaceholderText("Song title"), "Tagged Song");
      await user.type(screen.getByTestId("tag-text-input"), "worship");
      await user.keyboard("{Enter}");
      await user.type(screen.getByTestId("tag-text-input"), "Choir");
      await user.keyboard("{Enter}");
      await user.click(screen.getByRole("button", { name: /create song/i }));

      await waitFor(() => {
        expect(mockCreate).toHaveBeenCalledWith(expect.objectContaining({
          title: "Tagged Song",
          tags: "worship,choir",
        }));
        expect(mockNavigate).toHaveBeenCalledWith("/songs/new-2");
      });
    });

    it("has file import label", () => {
      renderNewSong();
      expect(screen.getByText("Import file")).toBeInTheDocument();
    });

    it("renders draft checkbox", () => {
      renderNewSong();
      expect(screen.getByText(/save as draft/i)).toBeInTheDocument();
    });
  });

  // ===================== POSITIVE — Edit Song =====================

  describe("positive — edit existing song", () => {
    const existingSong = {
      id: "song-1",
      title: "Amazing Grace",
      aka: "Grace Song, Old Hymn",
      category: "Church",
      key: "G",
      tempo: 72,
      artist: "Newton",
      shout: "Choir echoes",
      tags: "hymn",
      content: "[G]Amazing",
      isDraft: false,
    };
    const existingVariation = {
      id: "v1",
      songId: "song-1",
      name: "Acoustic",
      key: "C",
      content: "[C]Amazing",
    };

    it("renders Edit Song heading", async () => {
      mockGet.mockResolvedValue({ song: existingSong, variations: [] });
      renderEditSong();
      await waitFor(() => {
        expect(screen.getByText("Edit Song")).toBeInTheDocument();
      });
    });

    it("populates form with existing data", async () => {
      mockGet.mockResolvedValue({ song: existingSong, variations: [] });
      renderEditSong();
      await waitFor(() => {
        expect(screen.getByDisplayValue("Amazing Grace")).toBeInTheDocument();
        expect(screen.getByDisplayValue("Church")).toBeInTheDocument();
        expect(screen.getByDisplayValue("Newton")).toBeInTheDocument();
        expect(screen.getByDisplayValue("Grace Song, Old Hymn")).toBeInTheDocument();
        expect(screen.getByDisplayValue("Choir echoes")).toBeInTheDocument();
        // Tags render as pills in TagInput, not plain input values
        expect(screen.getByText("hymn")).toBeInTheDocument();
      });
    });

    it("renders Update Song button", async () => {
      mockGet.mockResolvedValue({ song: existingSong, variations: [] });
      renderEditSong();
      await waitFor(() => {
        expect(screen.getByRole("button", { name: /update song/i })).toBeInTheDocument();
      });
    });

    it("shows the selected variation clearly when editing a variation", async () => {
      mockGet.mockResolvedValue({ song: existingSong, variations: [existingVariation] });
      renderEditSongVariation();

      await waitFor(() => {
        expect(screen.getByText("Variation: Acoustic")).toBeInTheDocument();
        expect(screen.getByDisplayValue("Acoustic (C)")).toBeInTheDocument();
        expect(screen.getByTestId("chordpro-editor")).toHaveValue("[C]Amazing");
      });
    });

    it("saves variation content separately from the base song", async () => {
      mockGet.mockResolvedValue({ song: existingSong, variations: [existingVariation] });
      mockUpdate.mockResolvedValue({ song: existingSong });
      mockVariationUpdate.mockResolvedValue({ variation: existingVariation });
      renderEditSongVariation();
      const user = userEvent.setup();

      const editor = await screen.findByTestId("chordpro-editor");
      await user.clear(editor);
      await user.type(editor, "[C]Grace");
      await user.click(screen.getByRole("button", { name: /update song/i }));

      await waitFor(() => {
        expect(mockUpdate).toHaveBeenCalledWith("song-1", {
          title: "Amazing Grace",
          aka: "Grace Song, Old Hymn",
          category: "Church",
          tempo: 72,
          artist: "Newton",
          shout: "Choir echoes",
          tags: "hymn",
          energy: null,
          isDraft: false,
        });
        expect(mockVariationUpdate).toHaveBeenCalledWith("song-1", "v1", {
          content: expect.stringContaining("Grace"),
          key: "C",
        });
        expect(mockNavigate).toHaveBeenCalledWith("/songs/song-1?variation=v1");
      });
    });

    it("updates tags when adding another tag to an existing song", async () => {
      mockGet.mockResolvedValue({ song: existingSong, variations: [] });
      mockUpdate.mockResolvedValue({ song: { ...existingSong, tags: "hymn,choir" } });
      renderEditSong();
      const user = userEvent.setup();

      await screen.findByText("hymn");
      await user.type(screen.getByTestId("tag-text-input"), "choir");
      await user.keyboard("{Enter}");
      await user.click(screen.getByRole("button", { name: /update song/i }));

      await waitFor(() => {
        expect(mockUpdate).toHaveBeenCalledWith("song-1", expect.objectContaining({
          tags: "hymn,choir",
        }));
        expect(mockNavigate).toHaveBeenCalledWith("/songs/song-1");
      });
    });

    it("updates the song category", async () => {
      mockGet.mockResolvedValue({ song: existingSong, variations: [] });
      mockUpdate.mockResolvedValue({ song: { ...existingSong, category: "Special Event" } });
      renderEditSong();
      const user = userEvent.setup();

      await screen.findByDisplayValue("Church");
      await user.clear(screen.getByPlaceholderText("Wedding, Church, Special Event"));
      await user.type(screen.getByPlaceholderText("Wedding, Church, Special Event"), "Special Event");
      await user.click(screen.getByRole("button", { name: /update song/i }));

      await waitFor(() => {
        expect(mockUpdate).toHaveBeenCalledWith("song-1", expect.objectContaining({
          category: "Special Event",
        }));
      });
    });

    it("clears tags when all existing tag pills are removed", async () => {
      mockGet.mockResolvedValue({ song: { ...existingSong, tags: "hymn,worship" }, variations: [] });
      mockUpdate.mockResolvedValue({ song: { ...existingSong, tags: null } });
      renderEditSong();
      const user = userEvent.setup();

      await screen.findByText("hymn");
      await user.click(screen.getByTestId("tag-remove-hymn"));
      await user.click(screen.getByTestId("tag-remove-worship"));
      await user.click(screen.getByRole("button", { name: /update song/i }));

      await waitFor(() => {
        expect(mockUpdate).toHaveBeenCalledWith("song-1", expect.objectContaining({
          tags: undefined,
        }));
        expect(mockNavigate).toHaveBeenCalledWith("/songs/song-1");
      });
    });

    it("renders the arrangement builder for existing songs with named sections", async () => {
      mockGet.mockResolvedValue({
        song: {
          ...existingSong,
          content: `{title: Amazing Grace}\n{artist: Newton}\n{key: G}\n\n{comment: Verse 1}\n[G]Amazing grace\n\n{comment: Chorus}\n[C]I once was lost`,
        },
        variations: [],
      });
      renderEditSong();

      await waitFor(() => {
        const builder = screen.getByTestId("arrangement-builder");
        expect(builder).toBeInTheDocument();
        expect(within(builder).getByRole("button", { name: /^verse 1$/i })).toBeInTheDocument();
        expect(within(builder).getByRole("button", { name: /^chorus$/i })).toBeInTheDocument();
      });
    });

    it("saves an arrangement as a new variation with repeat markers", async () => {
      mockGet.mockResolvedValue({
        song: {
          ...existingSong,
          content: `{title: Amazing Grace}\n{artist: Newton}\n{key: G}\n\n{comment: Verse 1}\n[G]Amazing grace\n\n{comment: Chorus}\n[C]I once was lost`,
        },
        variations: [],
      });
      mockVariationCreate.mockResolvedValue({ variation: { id: "arr-1", name: "Sunday arrangement", content: "{comment: Chorus ×2}" } });
      renderEditSong();
      const user = userEvent.setup();

      const builder = await screen.findByTestId("arrangement-builder");
      await user.click(within(builder).getByRole("button", { name: /^verse 1$/i }));
      await user.click(within(builder).getByRole("button", { name: /^chorus$/i }));
      await user.click(within(builder).getByRole("button", { name: /increase repeats for chorus/i }));
      await user.clear(within(builder).getByPlaceholderText("Sunday arrangement"));
      await user.type(within(builder).getByPlaceholderText("Sunday arrangement"), "Sunday arrangement");
      await user.click(within(builder).getByRole("button", { name: /save arrangement as variation/i }));

      await waitFor(() => {
        expect(mockVariationCreate).toHaveBeenCalledWith("song-1", expect.objectContaining({
          key: "G",
          content: expect.stringContaining("{comment: Chorus ×2}"),
        }));
        expect(mockVariationCreate.mock.calls[0][1].name).toContain("Sunday arrangement");
        expect(mockNavigate).toHaveBeenCalledWith("/songs/song-1?variation=arr-1");
      });
    });
  });

  // ===================== NEGATIVE =====================

  describe("negative", () => {
    it("shows error when title is empty on create", async () => {
      const { toast } = await import("sonner");
      renderNewSong();
      const user = userEvent.setup();
      // Submit without filling title — HTML required validation may prevent,
      // but the component also checks title.trim()
      // Force by directly submitting with empty title (button should have required on input)
      const titleInput = screen.getByPlaceholderText("Song title");
      await user.clear(titleInput);
      // Type and clear to trigger state
      await user.type(titleInput, " ");
      await user.click(screen.getByRole("button", { name: /create song/i }));

      // The form has HTML required attribute, but if it submits with whitespace,
      // the component checks title.trim()
      await waitFor(() => {
        expect(toast.error).toHaveBeenCalledWith("Title is required");
      });
    });

    it("shows error toast on create failure", async () => {
      const { toast } = await import("sonner");
      mockCreate.mockRejectedValue(new Error("Validation failed"));
      renderNewSong();
      const user = userEvent.setup();
      await user.type(screen.getByPlaceholderText("Song title"), "Valid Title");
      await user.click(screen.getByRole("button", { name: /create song/i }));

      await waitFor(() => {
        expect(toast.error).toHaveBeenCalledWith("Validation failed");
      });
    });

    it("shows loading spinner when editing and loading data", () => {
      mockGet.mockReturnValue(new Promise(() => {}));
      renderEditSong();
      expect(document.querySelector(".spinner")).toBeInTheDocument();
    });

    it("disables save button while saving", async () => {
      mockCreate.mockReturnValue(new Promise(() => {}));
      renderNewSong();
      const user = userEvent.setup();
      await user.type(screen.getByPlaceholderText("Song title"), "Test");
      await user.click(screen.getByRole("button", { name: /create song/i }));

      await waitFor(() => {
        expect(screen.getByRole("button", { name: /saving/i })).toBeDisabled();
      });
    });

    it("warns before leaving with unsaved changes via browser unload", async () => {
      renderNewSong();
      const user = userEvent.setup();

      await user.type(screen.getByPlaceholderText("Song title"), "Unsaved title");

      const event = new Event("beforeunload", { cancelable: true });
      window.dispatchEvent(event);

      expect(event.defaultPrevented).toBe(true);
    });

    it("prompts before cancel navigation when there are unsaved changes", async () => {
      renderNewSong();
      const user = userEvent.setup();

      await user.type(screen.getByPlaceholderText("Song title"), "Unsaved title");
      await user.click(screen.getByRole("link", { name: /cancel/i }));

      expect(screen.getByRole("dialog", { name: /discard unsaved changes/i })).toBeInTheDocument();
      expect(screen.queryByText("Songs List")).not.toBeInTheDocument();
      expect(screen.getByText("New Song")).toBeInTheDocument();
    });

    it("prompts before switching variation targets when there are unsaved changes", async () => {
      const existingSong = {
        id: "song-1",
        title: "Amazing Grace",
        key: "G",
        tempo: 72,
        artist: "Newton",
        tags: "hymn",
        content: "[G]Amazing",
        isDraft: false,
      };
      const existingVariation = {
        id: "v1",
        songId: "song-1",
        name: "Acoustic",
        key: "C",
        content: "[C]Amazing",
      };

      mockGet.mockResolvedValue({ song: existingSong, variations: [existingVariation] });
      renderEditSongVariation();
      const user = userEvent.setup();

      const editor = await screen.findByTestId("chordpro-editor");
      await user.type(editor, " changed");
      await user.selectOptions(screen.getByLabelText(/working on/i), "");

      expect(screen.getByRole("dialog", { name: /switch editing targets/i })).toBeInTheDocument();
      expect(screen.getByDisplayValue("Acoustic (C)")).toBeInTheDocument();
    });

    it("shows possible duplicate matches while editing", async () => {
      mockFindDuplicates.mockResolvedValue({
        matches: [
          {
            id: "song-2",
            title: "Amazing Grace",
            aka: "Grace Song",
            artist: "Newton",
            key: "G",
            overallScore: 0.92,
            titleScore: 0.92,
            lyricScore: 0.4,
            matchedOn: ["title", "lyrics"],
          },
        ],
      });

      renderNewSong();
      const user = userEvent.setup();

      await user.type(screen.getByPlaceholderText("Song title"), "Amazing Grace");
      await user.type(screen.getByTestId("chordpro-editor"), "Amazing grace how sweet the sound that saved a wretch like me");

      await waitFor(() => {
        expect(mockFindDuplicates).toHaveBeenCalled();
        expect(screen.getByTestId("duplicate-detection-card")).toBeInTheDocument();
        expect(screen.getByText(/92% match/i)).toBeInTheDocument();
      });
    });

    it("queues an existing song edit when offline", async () => {
      const existingSong = {
        id: "song-1",
        title: "Amazing Grace",
        key: "G",
        tempo: 72,
        artist: "Newton",
        tags: "hymn",
        content: "[G]Amazing",
        isDraft: false,
        updatedAt: "2026-03-16T10:00:00.000Z",
      };

      mockConnectivityValue.isOnline = false;
      mockGet.mockResolvedValue({ song: existingSong, variations: [] });
      renderEditSong();
      const user = userEvent.setup();

      await screen.findByDisplayValue("Amazing Grace");
      await user.clear(screen.getByPlaceholderText("Song title"));
      await user.type(screen.getByPlaceholderText("Song title"), "Amazing Grace Updated");
      await user.click(screen.getByRole("button", { name: /update song/i }));

      await waitFor(() => {
        expect(mockEnqueueOfflineSongEdit).toHaveBeenCalledWith(expect.objectContaining({
          songId: "song-1",
          organizationId: "org1",
        }));
        expect(mockRefreshPendingOfflineEditCount).toHaveBeenCalled();
        expect(mockNavigate).toHaveBeenCalledWith("/songs/song-1");
      });
    });

    it("shows a merge dialog when the server reports a conflict", async () => {
      const existingSong = {
        id: "song-1",
        title: "Amazing Grace",
        key: "G",
        tempo: 72,
        artist: "Newton",
        tags: "hymn",
        content: "[G]Amazing",
        isDraft: false,
        updatedAt: "2026-03-16T10:00:00.000Z",
      };

      mockGet.mockResolvedValue({ song: existingSong, variations: [] });
      mockUpdate.mockRejectedValue({
        status: 409,
        message: "Conflict",
        body: {
          currentSong: {
            ...existingSong,
            title: "Amazing Grace Server",
            updatedAt: "2026-03-16T11:00:00.000Z",
          },
        },
      });

      renderEditSong();
      const user = userEvent.setup();

      await screen.findByDisplayValue("Amazing Grace");
      await user.clear(screen.getByPlaceholderText("Song title"));
      await user.type(screen.getByPlaceholderText("Song title"), "Amazing Grace Local");
      await user.click(screen.getByRole("button", { name: /update song/i }));

      await waitFor(() => {
        expect(screen.getByRole("dialog", { name: /resolve song edit conflict/i })).toBeInTheDocument();
        expect(screen.getByText("Amazing Grace Local")).toBeInTheDocument();
        expect(screen.getByText("Amazing Grace Server")).toBeInTheDocument();
      });
    });
  });

  describe("PDF import", () => {
    it("accepts .pdf files in the import input", () => {
      renderNewSong();
      const fileInput = document.querySelector('input[type="file"]') as HTMLInputElement;
      expect(fileInput).toBeInTheDocument();
      expect(fileInput.accept).toContain(".pdf");
    });

    it("shows supported formats including .pdf in the label", () => {
      renderNewSong();
      expect(screen.getByText(/\.pdf/i)).toBeInTheDocument();
    });

    it("loads a PDF into the form preview instead of navigating immediately", async () => {
      renderNewSong();
      const fileInput = document.querySelector('input[type="file"]') as HTMLInputElement;
      const file = new File(["fake-pdf-content"], "preview.pdf", { type: "application/pdf" });

      await userEvent.upload(fileInput, file);

      await waitFor(() => {
        expect(mockPreviewImportPdf).toHaveBeenCalled();
      });

      expect(mockNavigate).not.toHaveBeenCalled();
      expect(screen.getByDisplayValue("PDF Song")).toBeInTheDocument();
      expect(screen.getByDisplayValue("88")).toBeInTheDocument();
      expect(screen.getByTestId("import-preview-card")).toBeInTheDocument();
      expect(screen.getByText(/Loaded from preview\.pdf via PDF/i)).toBeInTheDocument();
    });
  });

  describe("OnSong/OpenSong import", () => {
    it("accepts .onsong and .xml files in the import input", () => {
      renderNewSong();
      const fileInput = document.querySelector('input[type="file"]') as HTMLInputElement;
      expect(fileInput.multiple).toBe(true);
      expect(fileInput.accept).toContain(".onsong");
      expect(fileInput.accept).toContain(".xml");
    });

    it("shows supported formats including .onsong and .xml in the label", () => {
      renderNewSong();
      expect(screen.getByText(/\.onsong/i)).toBeInTheDocument();
      expect(screen.getByText(/\.xml/i)).toBeInTheDocument();
    });

    it("imports .onsong files into the preview flow and keeps the user on the form", async () => {
      renderNewSong();
      const fileInput = document.querySelector('input[type="file"]') as HTMLInputElement;
      const file = new File(["Title: Test Song\n\nVerse 1:\n[C]Hello"], "test.onsong", { type: "text/plain" });

      await userEvent.upload(fileInput, file);

      await waitFor(() => {
        expect(mockPreviewImportOnSong).toHaveBeenCalledWith({
          filename: "test.onsong",
          content: "Title: Test Song\n\nVerse 1:\n[C]Hello",
        });
      });

      expect(mockNavigate).not.toHaveBeenCalled();
      expect(screen.getByDisplayValue("Test Song")).toBeInTheDocument();
      expect(screen.getByDisplayValue("C")).toBeInTheDocument();
      expect(screen.getByTestId("import-preview-card")).toBeInTheDocument();
      expect(screen.getByText(/Loaded from test\.onsong via OnSong/i)).toBeInTheDocument();
      expect(screen.getByTestId("import-preview-renderer")).toHaveTextContent("{title: Test Song}");
    });

    it("bulk imports multiple files and shows progress results", async () => {
      mockCreate.mockResolvedValue({ song: { id: "bulk-chopro", title: "Alpha Song" } });
      mockImportOnSong.mockResolvedValue({ song: { id: "bulk-onsong", title: "Beta Song" }, chordPro: "{title: Beta Song}" });
      mockImportChrd.mockResolvedValue({ song: { id: "bulk-chrd", title: "Gamma Song" } });

      renderNewSong();
      const fileInput = document.querySelector('input[type="file"]') as HTMLInputElement;

      const chordProFile = new File(["{title: Alpha Song}\n{key: G}\n\n[G]Hello"], "alpha.chopro", { type: "text/plain" });
      const onSongFile = new File(["Title: Beta Song\n\nVerse 1:\n[C]World"], "beta.onsong", { type: "text/plain" });
      const chrdFile = new File(["Gamma Song\nG D\nAmazing grace"], "gamma.chrd", { type: "text/plain" });

      await userEvent.upload(fileInput, [chordProFile, onSongFile, chrdFile]);

      await waitFor(() => {
        expect(mockCreate).toHaveBeenCalledWith({
          title: "Alpha Song",
          artist: undefined,
          key: "G",
          tempo: undefined,
          content: "{title: Alpha Song}\n{key: G}\n\n[G]Hello",
        });
        expect(mockImportOnSong).toHaveBeenCalledWith({
          filename: "beta.onsong",
          content: "Title: Beta Song\n\nVerse 1:\n[C]World",
        });
        expect(mockImportChrd).toHaveBeenCalledWith({
          filename: "gamma.chrd",
          content: "Gamma Song\nG D\nAmazing grace",
        });
      });

      expect(mockNavigate).not.toHaveBeenCalled();
      expect(screen.getByTestId("bulk-import-status")).toBeInTheDocument();
      expect(screen.getByText("Bulk import progress")).toBeInTheDocument();
      expect(screen.getByText("3 of 3 completed")).toBeInTheDocument();
      expect(screen.getByText("Imported as Alpha Song")).toBeInTheDocument();
      expect(screen.getByText("Imported as Beta Song")).toBeInTheDocument();
      expect(screen.getByText("Imported as Gamma Song")).toBeInTheDocument();
      expect(screen.getAllByText("Open song")).toHaveLength(3);
    });
  });
});
