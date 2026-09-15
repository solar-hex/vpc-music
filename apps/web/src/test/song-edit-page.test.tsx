import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, waitFor, fireEvent } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { createMemoryRouter, RouterProvider } from "react-router-dom";
import { SongEditPage } from "@/pages/songs/SongEditPage";

// ---------- Mocks ----------
const mockGet = vi.fn();
const mockCreate = vi.fn();
const mockUpdate = vi.fn();
const mockNavigate = vi.fn();
const mockImportChrd = vi.fn();
const mockPreviewImportChrd = vi.fn();
const mockImportOnSong = vi.fn();
const mockPreviewImportOnSong = vi.fn();
const mockFindDuplicates = vi.fn();
const mockInvalidateLibrary = vi.fn();

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
    importPdf: vi.fn(),
    previewImportPdf: vi.fn(),
  },
}));

vi.mock("@/hooks/useSongLibrary", () => ({
  invalidateSongLibrary: (...args: any[]) => mockInvalidateLibrary(...args),
}));

// The editor has its own tests; a textarea stands in for it here.
vi.mock("@/components/songs/ChordProEditor", () => ({
  ChordProEditor: ({ value, onChange }: { value: string; onChange: (value: string) => void }) => (
    <textarea aria-label="ChordPro" value={value} onChange={(event) => onChange(event.target.value)} />
  ),
}));

vi.mock("react-router-dom", async () => {
  const actual = await vi.importActual<typeof import("react-router-dom")>("react-router-dom");
  return { ...actual, useNavigate: () => mockNavigate };
});

vi.mock("sonner", () => ({
  toast: { success: vi.fn(), error: vi.fn(), info: vi.fn() },
}));

vi.mock("@vpc-music/shared", async (importOriginal) => ({
  // Everything not stubbed below is the real engine (the chart directive reader, for one).
  ...(await importOriginal<Record<string, unknown>>()),
  CHROMATIC_SHARP: ["C", "D", "E", "F", "G", "A", "B"],
  CHROMATIC_FLAT: ["C", "D", "E", "F", "G", "A", "B"],
  // The real implementations: the point of the tag tests below is that the
  // machine-maintained namespaces survive an edit, which a stub would hide.
  parseTagField: (raw: string | null | undefined) => {
    const parts = String(raw || "").split(",").map((s) => s.trim()).filter(Boolean);
    const tags: string[] = [], themes: string[] = [], negated: string[] = [], flags: string[] = [];
    for (const part of parts) {
      const lower = part.toLowerCase();
      if (lower.startsWith("!theme:")) negated.push(lower.slice(7));
      else if (lower.startsWith("theme:")) themes.push(lower.slice(6));
      else if (lower.startsWith("flag:")) flags.push(lower.slice(5));
      else tags.push(part);
    }
    return { tags, themes, negated, flags };
  },
  formatTagField: ({ tags = [], themes = [], negated = [], flags = [] }: any) =>
    [
      ...tags,
      ...[...new Set(flags as string[])].sort().map((f) => `flag:${f}`),
      ...[...new Set(themes as string[])].sort().map((t) => `theme:${t}`),
      ...[...new Set(negated as string[])].sort().map((t) => `!theme:${t}`),
    ].join(", "),
  themeLabel: (id: string) => id.replace(/-/g, " "),
  PRESET_TAGS: ["worship", "praise", "hymn"],
  parseChordPro: (input: string) => ({
    directives: {
      ...(input.match(/\{title:\s*(.*?)\}/i)?.[1] ? { title: input.match(/\{title:\s*(.*?)\}/i)?.[1] } : {}),
      ...(input.match(/\{key:\s*(.*?)\}/i)?.[1] ? { key: input.match(/\{key:\s*(.*?)\}/i)?.[1] } : {}),
    },
    sections: [],
    chordDefinitions: {},
  }),
}));

let mockAuthValue: any;
vi.mock("@/contexts/ThemeContext", () => ({
  useTheme: () => ({ keyNotation: "flats" }),
}));

vi.mock("@/contexts/AuthContext", () => ({
  useAuth: () => mockAuthValue,
}));

const mockRefreshPendingOfflineEditCount = vi.fn();
let mockConnectivityValue: any;
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

const existingSong = {
  id: "song-1",
  title: "Amazing Grace",
  key: "G",
  tempo: 72,
  artist: "John Newton",
  year: "1779",
  tags: "hymn",
  content: "{title: Amazing Grace}\n[G]Amazing grace",
  isDraft: false,
  updatedAt: "2026-01-01T00:00:00.000Z",
};

function renderAt(initialEntry: string | { pathname: string; state?: unknown }) {
  const router = createMemoryRouter(
    [
      { path: "/songs/new", element: <SongEditPage /> },
      { path: "/songs/:id/edit", element: <SongEditPage /> },
      { path: "/songs/:id", element: <div>Song View</div> },
      { path: "/songs", element: <div>Songs List</div> },
    ],
    { initialEntries: [initialEntry as any] },
  );
  return render(<RouterProvider router={router} />);
}

const renderNew = () => renderAt("/songs/new");
const renderEdit = () => renderAt("/songs/song-1/edit");

function chooseFiles(input: HTMLElement, files: File[]) {
  Object.defineProperty(input, "files", { value: files, configurable: true });
  fireEvent.change(input);
}

describe("SongEditPage", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockAuthValue = {
      user: { id: "u1", email: "test@test.com", displayName: "Test", role: "member" },
      activeOrg: { id: "org1", name: "Test Church", role: "musician" },
    };
    mockConnectivityValue = { isOnline: true, syncingOfflineEdits: false, pendingOfflineEditCount: 0, refreshPendingOfflineEditCount: mockRefreshPendingOfflineEditCount };
    mockGet.mockResolvedValue({ song: existingSong, variations: [] });
    mockCreate.mockResolvedValue({ song: { id: "new-1" } });
    mockUpdate.mockResolvedValue({ song: existingSong });
    mockFindDuplicates.mockResolvedValue({ matches: [] });
    mockPreviewImportChrd.mockResolvedValue({
      chordPro: "{title: Imported}\n{key: D}\n\n[D]Hello",
      metadata: { title: "Imported", key: "D", artist: "Someone", tempo: 90 },
    });
    mockImportChrd.mockResolvedValue({ song: { id: "imported-1", title: "First" } });
    mockImportOnSong.mockResolvedValue({ song: { id: "imported-2", title: "Second" } });
    mockLoadCachedSong.mockReturnValue(null);
    mockIsOfflineRequestError.mockReturnValue(false);
  });

  describe("new song", () => {
    it("renders the short form: title, artist, year, key, tempo, tags, draft, import", () => {
      renderNew();
      expect(screen.getByRole("heading", { name: "New Song" })).toBeInTheDocument();
      for (const label of ["Title", "Artist", "Year", "Key", "Tempo", "ChordPro"]) {
        expect(screen.getByLabelText(label)).toBeInTheDocument();
      }
      expect(screen.getAllByText("Tags").length).toBeGreaterThan(0);
      expect(screen.getByRole("checkbox", { name: /save as draft/i })).not.toBeChecked();
      expect(screen.getByText("Import file")).toBeInTheDocument();
      expect(screen.getByText(/\.chrd, \.txt, \.pdf/)).toBeInTheDocument();
      expect(screen.getByRole("button", { name: "Create Song" })).toBeInTheDocument();
      expect(screen.getByRole("link", { name: "Cancel" })).toHaveAttribute("href", "/songs");
      // trimmed fields are gone
      expect(screen.queryByLabelText(/category|energy|aka|shout/i)).not.toBeInTheDocument();
    });

    it("requires a title", async () => {
      renderNew();
      fireEvent.click(screen.getByRole("button", { name: "Create Song" }));
      const { toast } = await import("sonner");
      expect(toast.error).toHaveBeenCalledWith("Title is required");
      expect(mockCreate).not.toHaveBeenCalled();
    });

    it("creates the song, refreshes the list and opens the chart", async () => {
      const user = userEvent.setup();
      renderNew();
      await user.type(screen.getByLabelText("Title"), "New Hymn");
      await user.type(screen.getByLabelText("Year"), "1901");
      await user.selectOptions(screen.getByLabelText("Key"), "D");
      fireEvent.change(screen.getByLabelText("ChordPro"), { target: { value: "[D]La" } });
      await user.click(screen.getByRole("checkbox", { name: /save as draft/i }));
      await user.click(screen.getByRole("button", { name: "Create Song" }));
      await waitFor(() => expect(mockCreate).toHaveBeenCalled());
      expect(mockCreate.mock.calls[0][0]).toMatchObject({ title: "New Hymn", key: "D", year: "1901", content: "[D]La", isDraft: true });
      expect(mockInvalidateLibrary).toHaveBeenCalled();
      expect(mockNavigate).toHaveBeenCalledWith("/songs/new-1");
    });

    it("shows an error toast when creating fails", async () => {
      mockCreate.mockRejectedValue(new Error("Server exploded"));
      const user = userEvent.setup();
      renderNew();
      await user.type(screen.getByLabelText("Title"), "Boom");
      await user.click(screen.getByRole("button", { name: "Create Song" }));
      const { toast } = await import("sonner");
      await waitFor(() => expect(toast.error).toHaveBeenCalledWith("Server exploded"));
    });

    it("prefills from an import preview passed in navigation state", () => {
      renderAt({
        pathname: "/songs/new",
        state: { importPreview: { filename: "grace.chrd", sourceLabel: ".chrd", chordPro: "[G]Hello", metadata: { title: "Grace", key: "G", artist: "Newton", tempo: 72, year: "1779" } } },
      });
      expect(screen.getByLabelText("Title")).toHaveValue("Grace");
      expect(screen.getByLabelText("Artist")).toHaveValue("Newton");
      expect(screen.getByLabelText("Year")).toHaveValue("1779");
      expect(screen.getByLabelText("Key")).toHaveValue("G");
      expect(screen.getByLabelText("Tempo")).toHaveValue(72);
      expect(screen.getByLabelText("ChordPro")).toHaveValue("[G]Hello");
      expect(screen.getByTestId("import-preview-card")).toHaveTextContent("grace.chrd");
    });

    it("looks for duplicates while typing a title", async () => {
      mockFindDuplicates.mockResolvedValue({ matches: [{ id: "s2", title: "Amazing Grace", artist: "John Newton" }] });
      const user = userEvent.setup();
      renderNew();
      await user.type(screen.getByLabelText("Title"), "Amazing");
      await waitFor(() => expect(mockFindDuplicates).toHaveBeenCalledWith(expect.objectContaining({ title: "Amazing" })));
      await waitFor(() => expect(screen.getByTestId("duplicate-detection-card")).toHaveTextContent("Amazing Grace"));
      expect(screen.getByRole("link", { name: "Amazing Grace" })).toHaveAttribute("href", "/songs/s2");
    });

    it("loads a single imported file into the form", async () => {
      renderNew();
      chooseFiles(screen.getByTestId("song-import-input"), [new File(["x"], "grace.chrd", { type: "text/plain" })]);
      await waitFor(() => expect(mockPreviewImportChrd).toHaveBeenCalledWith({ filename: "grace.chrd", content: "x" }));
      await waitFor(() => expect(screen.getByLabelText("Title")).toHaveValue("Imported"));
      expect(screen.getByLabelText("Key")).toHaveValue("D");
      expect(screen.getByLabelText("Tempo")).toHaveValue(90);
      expect(screen.getByLabelText("ChordPro")).toHaveValue("{title: Imported}\n{key: D}\n\n[D]Hello");
      expect(screen.getByTestId("import-preview-card")).toHaveTextContent(".chrd");
    });

    it("asks before an import replaces what was typed", async () => {
      const user = userEvent.setup();
      renderNew();
      await user.type(screen.getByLabelText("Title"), "Typed");
      chooseFiles(screen.getByTestId("song-import-input"), [new File(["x"], "grace.chrd", { type: "text/plain" })]);
      expect(await screen.findByText("Replace what you have typed?")).toBeInTheDocument();
      expect(mockPreviewImportChrd).not.toHaveBeenCalled();
      await user.click(screen.getByRole("button", { name: "Replace" }));
      await waitFor(() => expect(screen.getByLabelText("Title")).toHaveValue("Imported"));
    });

    it("bulk imports several files and links to each song", async () => {
      renderNew();
      chooseFiles(screen.getByTestId("song-import-input"), [
        new File(["a"], "first.chrd", { type: "text/plain" }),
        new File(["b"], "second.onsong", { type: "text/plain" }),
      ]);
      await waitFor(() => expect(screen.getByTestId("bulk-import-status")).toHaveTextContent("2 of 2 done"));
      expect(mockImportChrd).toHaveBeenCalledWith({ filename: "first.chrd", content: "a" });
      expect(mockImportOnSong).toHaveBeenCalledWith({ filename: "second.onsong", content: "b" });
      expect(screen.getAllByRole("link", { name: "Open song" })).toHaveLength(2);
      expect(mockInvalidateLibrary).toHaveBeenCalled();
    });
  });

  describe("advanced properties", () => {
    const chart = ["{title: Amazing Grace}", "{time: 3/4}", "{x_album: Hymns}", "{x_aka: Amazing Grace (My Chains Are Gone)}", "", "[G]Amazing grace"].join("\n");
    const openAdvanced = async () => {
      await waitFor(() => expect(screen.getByRole("heading", { name: "Edit Song" })).toBeInTheDocument());
      fireEvent.click(screen.getByText("Advanced"));
    };
    const chordPro = () => screen.getByLabelText("ChordPro") as HTMLTextAreaElement;

    beforeEach(() => {
      mockGet.mockResolvedValue({ song: { ...existingSong, content: chart, aka: "Amazing Grace (My Chains Are Gone)" }, variations: [] });
    });

    it("sits folded under the tags, saying how many are set", async () => {
      renderEdit();
      await waitFor(() => expect(screen.getByRole("heading", { name: "Edit Song" })).toBeInTheDocument());
      const section = screen.getByTestId("advanced-properties");
      expect(section).not.toHaveAttribute("open");
      expect(section).toHaveTextContent("3 set");
    });

    it("shows the properties the chart already carries", async () => {
      renderEdit();
      await openAdvanced();
      expect(screen.getByLabelText("Time signature")).toHaveValue("3/4");
      expect(screen.getByLabelText("Album")).toHaveValue("Hymns");
      expect(screen.getByLabelText("Alternate titles")).toHaveValue("Amazing Grace (My Chains Are Gone)");
      expect(screen.getByLabelText("Songwriters")).toHaveValue("");
    });

    it("writes a property into the chart, and the chart is what gets saved", async () => {
      const user = userEvent.setup();
      renderEdit();
      await openAdvanced();
      await user.type(screen.getByLabelText("Songwriters"), "John Newton");
      expect(chordPro().value).toContain("{x_writers: John Newton}");
      await user.click(screen.getByRole("button", { name: "Update Song" }));
      await waitFor(() => expect(mockUpdate).toHaveBeenCalled());
      expect(mockUpdate.mock.calls[0][1].content).toContain("{x_writers: John Newton}");
    });

    it("removes a property's line when the field is cleared", async () => {
      const user = userEvent.setup();
      renderEdit();
      await openAdvanced();
      await user.clear(screen.getByLabelText("Album"));
      expect(chordPro().value).not.toContain("x_album");
    });

    it("fills the field when the line is typed into the chart", async () => {
      renderEdit();
      await openAdvanced();
      fireEvent.change(chordPro(), { target: { value: `{ccli: 22025}\n${chart}` } });
      expect(screen.getByLabelText("CCLI song number")).toHaveValue("22025");
    });

    it("keeps the song list's search in step with alternate titles", async () => {
      const user = userEvent.setup();
      renderEdit();
      await openAdvanced();
      await user.clear(screen.getByLabelText("Alternate titles"));
      await user.click(screen.getByRole("button", { name: "Update Song" }));
      await waitFor(() => expect(mockUpdate).toHaveBeenCalled());
      expect(mockUpdate.mock.calls[0][1].aka).toBeNull();
    });

    it("leaves a song's search titles alone when it never had the line", async () => {
      mockGet.mockResolvedValue({ song: existingSong, variations: [] });
      const user = userEvent.setup();
      renderEdit();
      await waitFor(() => expect(screen.getByRole("heading", { name: "Edit Song" })).toBeInTheDocument());
      await user.click(screen.getByRole("button", { name: "Update Song" }));
      await waitFor(() => expect(mockUpdate).toHaveBeenCalled());
      expect(mockUpdate.mock.calls[0][1]).not.toHaveProperty("aka");
    });
  });

  describe("existing song", () => {
    it("loads the song into the form and saves changes", async () => {
      const user = userEvent.setup();
      renderEdit();
      await waitFor(() => expect(screen.getByRole("heading", { name: "Edit Song" })).toBeInTheDocument());
      expect(screen.getByLabelText("Title")).toHaveValue("Amazing Grace");
      expect(screen.getByLabelText("Year")).toHaveValue("1779");
      expect(screen.getByLabelText("Key")).toHaveValue("G");
      expect(screen.getByRole("link", { name: "Cancel" })).toHaveAttribute("href", "/songs/song-1");
      await user.clear(screen.getByLabelText("Year"));
      await user.type(screen.getByLabelText("Year"), "1780");
      await user.click(screen.getByRole("button", { name: "Update Song" }));
      await waitFor(() => expect(mockUpdate).toHaveBeenCalled());
      expect(mockUpdate.mock.calls[0][0]).toBe("song-1");
      expect(mockUpdate.mock.calls[0][1]).toMatchObject({ title: "Amazing Grace", year: "1780", lastKnownUpdatedAt: existingSong.updatedAt });
      expect(mockInvalidateLibrary).toHaveBeenCalled();
      expect(mockNavigate).toHaveBeenCalledWith("/songs/song-1");
    });

    it("shows only the plain tags, and keeps themes and flags through a save", async () => {
      // The corpus loader maintains theme:, !theme: and flag: entries in the
      // same column. They must not appear as editable pills, and must survive
      // an edit that never touches tags.
      mockGet.mockResolvedValue({
        song: { ...existingSong, tags: "hymn,theme:grace,!theme:healing,flag:unlisted" },
        variations: [],
      });
      const user = userEvent.setup();
      renderEdit();
      await waitFor(() => expect(screen.getByRole("heading", { name: "Edit Song" })).toBeInTheDocument());

      expect(screen.getByText("hymn")).toBeInTheDocument();
      expect(screen.queryByText("theme:grace")).not.toBeInTheDocument();
      expect(screen.queryByText("!theme:healing")).not.toBeInTheDocument();
      expect(screen.queryByText("flag:unlisted")).not.toBeInTheDocument();
      expect(screen.getByText(/themes found in the lyrics/i)).toHaveTextContent("grace");

      await user.clear(screen.getByLabelText("Year"));
      await user.type(screen.getByLabelText("Year"), "1780");
      await user.click(screen.getByRole("button", { name: "Update Song" }));

      await waitFor(() => expect(mockUpdate).toHaveBeenCalled());
      const saved = mockUpdate.mock.calls[0][1].tags as string;
      expect(saved).toContain("hymn");
      expect(saved).toContain("theme:grace");
      expect(saved).toContain("!theme:healing");
      expect(saved).toContain("flag:unlisted");
    });

    it("warns before leaving with unsaved changes", async () => {
      const user = userEvent.setup();
      renderEdit();
      await waitFor(() => screen.getByRole("heading", { name: "Edit Song" }));
      await user.type(screen.getByLabelText("Title"), "!");
      await user.click(screen.getByRole("link", { name: "Cancel" }));
      expect(await screen.findByText("Discard unsaved changes?")).toBeInTheDocument();
      await user.click(screen.getByRole("button", { name: "Leave without saving" }));
      await waitFor(() => expect(screen.getByText("Song View")).toBeInTheDocument());
    });

    it("queues the edit on this device when offline", async () => {
      mockConnectivityValue = { ...mockConnectivityValue, isOnline: false };
      const user = userEvent.setup();
      renderEdit();
      await waitFor(() => screen.getByRole("heading", { name: "Edit Song" }));
      await user.type(screen.getByLabelText("Title"), "!");
      await user.click(screen.getByRole("button", { name: "Update Song" }));
      await waitFor(() => expect(mockEnqueueOfflineSongEdit).toHaveBeenCalled());
      expect(mockEnqueueOfflineSongEdit.mock.calls[0][0]).toMatchObject({ songId: "song-1", organizationId: "org1", songData: expect.objectContaining({ title: "Amazing Grace!" }) });
      expect(mockUpdate).not.toHaveBeenCalled();
      expect(mockNavigate).toHaveBeenCalledWith("/songs/song-1");
    });

    it("offers reload or overwrite when the server reports a conflict", async () => {
      const serverSong = { ...existingSong, title: "Amazing Grace (theirs)", updatedAt: "2026-02-01T00:00:00.000Z" };
      mockUpdate.mockRejectedValueOnce(Object.assign(new Error("Conflict"), { status: 409, body: { currentSong: serverSong } }));
      const user = userEvent.setup();
      renderEdit();
      await waitFor(() => screen.getByRole("heading", { name: "Edit Song" }));
      await user.type(screen.getByLabelText("Title"), "!");
      await user.click(screen.getByRole("button", { name: "Update Song" }));
      expect(await screen.findByText("This song changed while you were editing")).toBeInTheDocument();

      await user.click(screen.getByRole("button", { name: "Overwrite with mine" }));
      await waitFor(() => expect(mockUpdate).toHaveBeenCalledTimes(2));
      expect(mockUpdate.mock.calls[1][1]).toMatchObject({ title: "Amazing Grace!", forceOverwrite: true });
      expect(mockNavigate).toHaveBeenCalledWith("/songs/song-1");
    });

    it("can reload the server's version instead", async () => {
      const serverSong = { ...existingSong, title: "Amazing Grace (theirs)" };
      mockUpdate.mockRejectedValueOnce(Object.assign(new Error("Conflict"), { status: 409, body: { currentSong: serverSong } }));
      const user = userEvent.setup();
      renderEdit();
      await waitFor(() => screen.getByRole("heading", { name: "Edit Song" }));
      await user.type(screen.getByLabelText("Title"), "!");
      await user.click(screen.getByRole("button", { name: "Update Song" }));
      await user.click(await screen.findByRole("button", { name: "Reload their version" }));
      expect(screen.getByLabelText("Title")).toHaveValue("Amazing Grace (theirs)");
      expect(mockUpdate).toHaveBeenCalledTimes(1);
    });

    it("uses the cached song when offline", async () => {
      mockGet.mockRejectedValue(new Error("Failed to fetch"));
      mockIsOfflineRequestError.mockReturnValue(true);
      mockLoadCachedSong.mockReturnValue({ response: { song: { ...existingSong, title: "Cached Grace" }, variations: [] } });
      renderEdit();
      await waitFor(() => expect(screen.getByLabelText("Title")).toHaveValue("Cached Grace"));
    });

    it("sends observers back to the chart", async () => {
      mockAuthValue = { ...mockAuthValue, activeOrg: { id: "org1", name: "Test Church", role: "observer" } };
      renderEdit();
      await waitFor(() => expect(mockNavigate).toHaveBeenCalledWith("/songs/song-1", { replace: true }));
    });
  });
});
