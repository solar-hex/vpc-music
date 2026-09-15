import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { render, screen, waitFor, fireEvent, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { MemoryRouter, Route, Routes, useLocation } from "react-router-dom";
import { SongChartPage } from "@/pages/songs/SongChartPage";
import { CHART_PREFS_KEY } from "@/lib/chart-prefs";

// ---------- Mocks ----------
const mockGet = vi.fn();
const mockDelete = vi.fn();
const mockExportChordPro = vi.fn();
const mockExportPdf = vi.fn();
const mockShareCreate = vi.fn();
const mockLogPlay = vi.fn();
const mockNavigate = vi.fn();
const mockLoadCachedSong = vi.fn();
const mockSaveCachedSong = vi.fn();
const mockIsOfflineRequestError = vi.fn();
const mockToggleTheme = vi.fn();
let mockPageWidth: "centered" | "full" = "centered";

let mockAuthValue: any;

vi.mock("@/lib/api-client", () => ({
  songsApi: {
    get: (...args: any[]) => mockGet(...args),
    delete: (...args: any[]) => mockDelete(...args),
    exportChordPro: (...args: any[]) => mockExportChordPro(...args),
    exportOnSong: vi.fn(),
    exportText: vi.fn(),
    exportPdf: (...args: any[]) => mockExportPdf(...args),
    mediaHref: (id: string, key: string) => `/api/songs/${id}/media/${key}`,
  },
  shareApi: { create: (...args: any[]) => mockShareCreate(...args), stopSharing: vi.fn() },
  songUsageApi: { log: (...args: any[]) => mockLogPlay(...args) },
}));

vi.mock("react-router-dom", async () => {
  const actual = await vi.importActual<typeof import("react-router-dom")>("react-router-dom");
  return { ...actual, useNavigate: () => mockNavigate };
});

vi.mock("sonner", () => ({
  toast: { success: vi.fn(), error: vi.fn(), info: vi.fn() },
}));

vi.mock("@/contexts/AuthContext", () => ({
  useAuth: () => mockAuthValue,
}));

vi.mock("@/contexts/ThemeContext", () => ({
  useTheme: () => ({ resolvedTheme: "light", toggleTheme: mockToggleTheme, pageWidth: mockPageWidth }),
}));

vi.mock("@/contexts/ConnectivityContext", () => ({
  useConnectivity: () => ({ isOnline: true, pendingOfflineEditCount: 0, syncingOfflineEdits: false }),
}));

vi.mock("@/lib/offline-cache", () => ({
  loadCachedSong: (...args: any[]) => mockLoadCachedSong(...args),
  saveCachedSong: (...args: any[]) => mockSaveCachedSong(...args),
  isOfflineRequestError: (...args: any[]) => mockIsOfflineRequestError(...args),
}));

// The renderer is covered by its own test; here it reports the props it received.
vi.mock("@/components/songs/ChordProRenderer", () => ({
  ChordProRenderer: ({ content, transpose, nashville, fontSize, showComments, wrap }: any) => (
    <div
      data-testid="chordpro-renderer"
      data-transpose={transpose ?? 0}
      data-nashville={String(Boolean(nashville))}
      data-font-size={fontSize}
      data-show-comments={String(showComments)}
      data-wrap={String(wrap)}
    >
      {content}
    </div>
  ),
  chartSections: () => [
    { id: "section-0", label: "Verse 1" },
    { id: "section-1", label: "Chorus" },
  ],
}));

const musicianAuth = {
  user: { id: "u1", email: "keys@test.com", displayName: "Keys", role: "member" },
  activeOrg: { id: "org1", name: "Test Church", role: "musician" },
};
const observerAuth = {
  user: { id: "u2", email: "guest@test.com", displayName: "Guest", role: "member" },
  activeOrg: { id: "org1", name: "Test Church", role: "observer" },
};

const song = {
  id: "song-1",
  title: "Amazing Grace",
  artist: "John Newton",
  year: "1779",
  key: "G",
  tempo: 72,
  content: "{title: Amazing Grace}\n\n{comment: Verse 1}\nA[G]mazing [G7]grace",
  isDraft: false,
};

function LocationProbe() {
  const location = useLocation();
  return <div data-testid="location">{`${location.pathname}${location.search}`}</div>;
}

function renderChart(path = "/songs/song-1") {
  return render(
    <MemoryRouter initialEntries={[path]}>
      <Routes>
        <Route
          path="/songs/:id"
          element={
            <>
              <SongChartPage />
              <LocationProbe />
            </>
          }
        />
      </Routes>
    </MemoryRouter>,
  );
}

const renderer = () => screen.getByTestId("chordpro-renderer");
const location = () => screen.getByTestId("location").textContent;

describe("SongChartPage", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    localStorage.clear();
    mockAuthValue = musicianAuth;
    mockGet.mockResolvedValue({ song, variations: [] });
    mockIsOfflineRequestError.mockReturnValue(false);
    mockShareCreate.mockResolvedValue({ shareUrl: "/shared/tok123", shareToken: {} });
    mockLogPlay.mockResolvedValue({ usage: {} });
    mockDelete.mockResolvedValue({ message: "ok" });
    mockPageWidth = "centered";
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  describe("title block and chart", () => {
    it("shows the key, title, artist and year above a full-width chart", async () => {
      renderChart();
      await waitFor(() => expect(screen.getByRole("heading", { name: "Amazing Grace" })).toBeInTheDocument());
      expect(screen.getByText("Key of G")).toBeInTheDocument();
      expect(screen.getByText("John Newton / 1779")).toBeInTheDocument();
      expect(screen.getByLabelText("Tempo 72 BPM")).toBeInTheDocument();
      expect(renderer().getAttribute("data-transpose")).toBe("0");
      expect(renderer().getAttribute("data-wrap")).toBe("false");
      expect(mockSaveCachedSong).toHaveBeenCalled();
    });

    it("keeps the chart in a centered column unless the account chose full width", async () => {
      const { unmount } = renderChart();
      await waitFor(() => expect(screen.getByRole("heading", { name: "Amazing Grace" })).toBeInTheDocument());
      expect(screen.getByTestId("chart-sheet")).toHaveClass("max-w-3xl");
      unmount();

      mockPageWidth = "full";
      renderChart();
      await waitFor(() => expect(screen.getByRole("heading", { name: "Amazing Grace" })).toBeInTheDocument());
      expect(screen.getByTestId("chart-sheet")).toHaveClass("max-w-none");
    });

    it("marks drafts", async () => {
      mockGet.mockResolvedValue({ song: { ...song, isDraft: true }, variations: [] });
      renderChart();
      await waitFor(() => expect(screen.getByText("Draft")).toBeInTheDocument());
    });

    it("renders the section jump bar from the chart's sections", async () => {
      renderChart();
      await waitFor(() => expect(screen.getByRole("navigation", { name: /song sections/i })).toBeInTheDocument());
      expect(screen.getByRole("button", { name: "Top" })).toBeInTheDocument();
      expect(screen.getByRole("button", { name: "Verse 1" })).toBeInTheDocument();
      expect(screen.getByRole("button", { name: "Chorus" })).toBeInTheDocument();
    });

    it("uses the default variation's chart and key when one is set", async () => {
      mockGet.mockResolvedValue({
        song: { ...song, defaultVariationId: "v1" },
        variations: [{ id: "v1", songId: "song-1", name: "Acoustic", content: "[D]Acoustic chart", key: "D" }],
      });
      renderChart();
      await waitFor(() => expect(renderer()).toHaveTextContent("[D]Acoustic chart"));
      expect(screen.getByText("Key of D")).toBeInTheDocument();
    });
  });

  describe("transposition via the URL", () => {
    it("reads ?key= and transposes to it", async () => {
      renderChart("/songs/song-1?key=Bb");
      await waitFor(() => expect(renderer().getAttribute("data-transpose")).toBe("3"));
      expect(screen.getByText(/Key of Bb/)).toBeInTheDocument();
      expect(screen.getByText(/originally G/)).toBeInTheDocument();
    });

    it("ignores an invalid ?key=", async () => {
      renderChart("/songs/song-1?key=H");
      await waitFor(() => expect(renderer().getAttribute("data-transpose")).toBe("0"));
    });

    it("transpose up and down write the next key into the URL with target-key spelling", async () => {
      renderChart();
      await waitFor(() => screen.getByRole("button", { name: /transpose up/i }));
      fireEvent.click(screen.getByRole("button", { name: /transpose up/i }));
      expect(location()).toBe("/songs/song-1?key=Ab");
      expect(renderer().getAttribute("data-transpose")).toBe("1");
      expect(screen.getByText(/Key of Ab/)).toBeInTheDocument();
      fireEvent.click(screen.getByRole("button", { name: /transpose down/i }));
      expect(location()).toBe("/songs/song-1");
      expect(renderer().getAttribute("data-transpose")).toBe("0");
    });

    it("arrow keys transpose like the toolbar buttons", async () => {
      renderChart();
      await waitFor(() => screen.getByRole("button", { name: /transpose up/i }));
      fireEvent.keyDown(document, { key: "ArrowRight" });
      expect(location()).toBe("/songs/song-1?key=Ab");
      fireEvent.keyDown(document, { key: "ArrowLeft" });
      expect(location()).toBe("/songs/song-1");
    });

    it("the key picker sets the key directly", async () => {
      const user = userEvent.setup();
      renderChart();
      await waitFor(() => screen.getByRole("button", { name: /change key/i }));
      await user.click(screen.getByRole("button", { name: /change key/i }));
      await user.click(screen.getByRole("button", { name: /^D$/ }));
      expect(location()).toBe("/songs/song-1?key=D");
      expect(renderer().getAttribute("data-transpose")).toBe("7");
    });

    it("a keyless chart transposes with ?t= and keeps the key picker disabled", async () => {
      mockGet.mockResolvedValue({ song: { ...song, key: null }, variations: [] });
      renderChart();
      await waitFor(() => screen.getByRole("button", { name: /transpose up/i }));
      expect(screen.getByRole("button", { name: /no key/i })).toBeDisabled();
      expect(screen.getByRole("button", { name: /nashville numbers/i })).toBeDisabled();
      fireEvent.click(screen.getByRole("button", { name: /transpose up/i }));
      expect(location()).toBe("/songs/song-1?t=1");
      expect(renderer().getAttribute("data-transpose")).toBe("1");
      fireEvent.click(screen.getByRole("button", { name: /transpose down/i }));
      expect(location()).toBe("/songs/song-1");
    });

    it("the search button carries the key back only after the key changed", async () => {
      renderChart();
      await waitFor(() => screen.getByRole("link", { name: /search songs/i }));
      expect(screen.getByRole("link", { name: /search songs/i })).toHaveAttribute("href", "/songs");
      fireEvent.click(screen.getByRole("button", { name: /transpose up/i }));
      expect(screen.getByRole("link", { name: /search songs/i })).toHaveAttribute("href", "/songs?key=Ab");
    });
  });

  describe("view preferences", () => {
    it("toggles Nashville numbers and remembers it", async () => {
      renderChart();
      await waitFor(() => screen.getByRole("button", { name: /nashville numbers/i }));
      fireEvent.click(screen.getByRole("button", { name: /nashville numbers/i }));
      expect(renderer().getAttribute("data-nashville")).toBe("true");
      expect(JSON.parse(localStorage.getItem(CHART_PREFS_KEY)!)).toMatchObject({ nashville: true });
    });

    it("toggles comments", async () => {
      renderChart();
      await waitFor(() => screen.getByRole("button", { name: /^comments$/i }));
      expect(renderer().getAttribute("data-show-comments")).toBe("true");
      fireEvent.click(screen.getByRole("button", { name: /^comments$/i }));
      expect(renderer().getAttribute("data-show-comments")).toBe("false");
    });

    it("cycles the text size and restores it on the next visit", async () => {
      renderChart();
      await waitFor(() => screen.getByRole("button", { name: /text size/i }));
      fireEvent.click(screen.getByRole("button", { name: /text size/i }));
      expect(renderer().getAttribute("data-font-size")).toBe("18");
      expect(JSON.parse(localStorage.getItem(CHART_PREFS_KEY)!)).toMatchObject({ fontSize: 18 });
    });

    it("toggles the theme from the toolbar", async () => {
      renderChart();
      await waitFor(() => screen.getByRole("button", { name: /toggle theme/i }));
      fireEvent.click(screen.getByRole("button", { name: /toggle theme/i }));
      expect(mockToggleTheme).toHaveBeenCalled();
    });
  });

  describe("practice audio and original charts", () => {
    const S3 = "https://s3.us-central-1.wasabisys.com/proj-vpcmusic/v1/prd/media/songs/amazing-grace";
    const withMedia = {
      ...song,
      content: [
        "{title: Amazing Grace}",
        `{x_audio_tenor: ${S3}/audio/tenor.mp3}`,
        `{x_audio_soprano: ${S3}/audio/soprano.mp3}`,
        `{x_audio_alto: ${S3}/audio/alto.mp3}`,
        `{x_chart_number_chart: ${S3}/charts/number_chart.pdf}`,
        `{x_chart_chord_chart: ${S3}/charts/chord_chart.pdf}`,
        "{x_dropbox: https://www.dropbox.com/scl/fo/abc}",
        "",
        "{comment: Verse 1}",
        "A[G]mazing [G7]grace",
      ].join("\n"),
    };

    it("docks the parts between the chart and the section bar, soprano first", async () => {
      mockGet.mockResolvedValue({ song: withMedia, variations: [] });
      renderChart();
      const bar = await screen.findByTestId("song-audio-bar");
      const parts = within(bar).getAllByRole("button").map((b) => b.getAttribute("aria-label"));
      expect(parts).toEqual(["Play Soprano", "Play Alto", "Play Tenor"]);

      const jumpBar = screen.getByRole("navigation", { name: "Song sections" });
      // The bar comes before the jump bar in the document, so it sits above it.
      expect(bar.compareDocumentPosition(jumpBar) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy();
    });

    it("shows no audio bar for a song without audio", async () => {
      renderChart();
      await waitFor(() => expect(screen.getByRole("heading", { name: "Amazing Grace" })).toBeInTheDocument());
      expect(screen.queryByTestId("song-audio-bar")).not.toBeInTheDocument();
    });

    it("lists the original charts in the More menu, chords first, opened through the signed route", async () => {
      const openSpy = vi.spyOn(window, "open").mockImplementation(() => null);
      mockGet.mockResolvedValue({ song: withMedia, variations: [] });
      const user = userEvent.setup();
      renderChart();
      await waitFor(() => screen.getByRole("button", { name: /more actions/i }));
      await user.click(screen.getByRole("button", { name: /more actions/i }));
      const items = screen.getAllByRole("menuitem").map((i) => i.textContent);
      expect(items.indexOf("Chord chart (PDF)")).toBeLessThan(items.indexOf("Number chart (PDF)"));
      await user.click(screen.getByRole("menuitem", { name: "Chord chart (PDF)" }));
      expect(openSpy).toHaveBeenCalledWith("/api/songs/song-1/media/x_chart_chord_chart", "_blank", "noopener");
    });

    it("lists files attached in the editor, and calls a photo chart just a chart", async () => {
      const openSpy = vi.spyOn(window, "open").mockImplementation(() => null);
      const store = "https://s3.us-central-1.wasabisys.com/proj-vpcmusic/v1/prd/media/songs/x";
      mockGet.mockResolvedValue({
        song: { ...song, content: `${song.content}
{x_chart_rhythm_chart: ${store}/charts/rhythm.jpg}
{x_file_arrangement_notes: ${store}/files/notes.docx}` },
        variations: [],
      });
      const user = userEvent.setup();
      renderChart();
      await waitFor(() => screen.getByRole("button", { name: /more actions/i }));
      await user.click(screen.getByRole("button", { name: /more actions/i }));
      const items = screen.getAllByRole("menuitem").map((i) => i.textContent);
      expect(items).toContain("Rhythm chart");
      await user.click(screen.getByRole("menuitem", { name: "Arrangement notes" }));
      expect(openSpy).toHaveBeenCalledWith("/api/songs/song-1/media/x_file_arrangement_notes", "_blank", "noopener");
    });

    it("links to the song's shared Dropbox folder as a resource, after the charts", async () => {
      const openSpy = vi.spyOn(window, "open").mockImplementation(() => null);
      mockGet.mockResolvedValue({ song: withMedia, variations: [] });
      const user = userEvent.setup();
      renderChart();
      await waitFor(() => screen.getByRole("button", { name: /more actions/i }));
      await user.click(screen.getByRole("button", { name: /more actions/i }));
      const items = screen.getAllByRole("menuitem").map((i) => i.textContent);
      expect(items.indexOf("All song files (Dropbox)")).toBeGreaterThan(items.indexOf("Number chart (PDF)"));
      await user.click(screen.getByRole("menuitem", { name: "All song files (Dropbox)" }));
      expect(openSpy).toHaveBeenCalledWith("https://www.dropbox.com/scl/fo/abc", "_blank", "noopener");
    });

    it("offers the Dropbox folder even for a song with no chart PDFs", async () => {
      mockGet.mockResolvedValue({
        song: { ...song, content: `${song.content}\n{x_dropbox: https://www.dropbox.com/scl/fo/only}` },
        variations: [],
      });
      const user = userEvent.setup();
      renderChart();
      await waitFor(() => screen.getByRole("button", { name: /more actions/i }));
      await user.click(screen.getByRole("button", { name: /more actions/i }));
      expect(screen.getByRole("menuitem", { name: "All song files (Dropbox)" })).toBeInTheDocument();
      expect(screen.queryByRole("menuitem", { name: /\(PDF\)/ })).not.toBeInTheDocument();
    });

    it("offers no chart entries for a song without them", async () => {
      const user = userEvent.setup();
      renderChart();
      await waitFor(() => screen.getByRole("button", { name: /more actions/i }));
      await user.click(screen.getByRole("button", { name: /more actions/i }));
      expect(screen.queryByRole("menuitem", { name: /\(PDF\)/ })).not.toBeInTheDocument();
    });
  });

  describe("More menu", () => {
    it("prints", async () => {
      const printSpy = vi.spyOn(window, "print").mockImplementation(() => {});
      const user = userEvent.setup();
      renderChart();
      await waitFor(() => screen.getByRole("button", { name: /more actions/i }));
      await user.click(screen.getByRole("button", { name: /more actions/i }));
      await user.click(screen.getByRole("menuitem", { name: "Print" }));
      expect(printSpy).toHaveBeenCalledOnce();
    });

    it("downloads the ChordPro file", async () => {
      mockExportChordPro.mockResolvedValue({ ok: true, blob: async () => new Blob(["x"]) });
      const createObjectURL = vi.fn(() => "blob:chart");
      const revokeObjectURL = vi.fn();
      Object.assign(URL, { createObjectURL, revokeObjectURL });
      const clickSpy = vi.spyOn(HTMLAnchorElement.prototype, "click").mockImplementation(() => {});
      const user = userEvent.setup();
      renderChart();
      await waitFor(() => screen.getByRole("button", { name: /more actions/i }));
      await user.click(screen.getByRole("button", { name: /more actions/i }));
      await user.click(screen.getByRole("menuitem", { name: "Download ChordPro (.cho)" }));
      await waitFor(() => expect(clickSpy).toHaveBeenCalled());
      expect(mockExportChordPro).toHaveBeenCalledWith("song-1", undefined);
      expect(revokeObjectURL).toHaveBeenCalledWith("blob:chart");
    });

    it("shares the chart through a dialog, with the key on screen in the link", async () => {
      const user = userEvent.setup();
      renderChart("/songs/song-1?key=A");
      await waitFor(() => screen.getByRole("button", { name: /more actions/i }));
      await user.click(screen.getByRole("button", { name: /more actions/i }));
      await user.click(screen.getByRole("menuitem", { name: "Share chart" }));
      await waitFor(() => expect(mockShareCreate).toHaveBeenCalledWith("song-1"));
      expect(await screen.findByLabelText("Share link")).toHaveValue(`${window.location.origin}/shared/tok123?key=A`);
      expect(screen.getByText("Opens in the key of A.")).toBeInTheDocument();
    });

    it("logs a play through the dialog", async () => {
      const user = userEvent.setup();
      renderChart();
      await waitFor(() => screen.getByRole("button", { name: /more actions/i }));
      await user.click(screen.getByRole("button", { name: /more actions/i }));
      await user.click(screen.getByRole("menuitem", { name: "Log a play" }));
      await user.type(screen.getByLabelText(/notes/i), "Second service");
      await user.click(screen.getByRole("button", { name: "Log play" }));
      await waitFor(() => expect(mockLogPlay).toHaveBeenCalledWith("song-1", expect.objectContaining({ notes: "Second service" })));
      expect(mockLogPlay.mock.calls[0][1].usedAt).toMatch(/^\d{4}-\d{2}-\d{2}$/);
    });

    it("edits and deletes with confirmation", async () => {
      const user = userEvent.setup();
      renderChart();
      await waitFor(() => screen.getByRole("button", { name: /more actions/i }));
      await user.click(screen.getByRole("button", { name: /more actions/i }));
      await user.click(screen.getByRole("menuitem", { name: "Edit" }));
      expect(mockNavigate).toHaveBeenCalledWith("/songs/song-1/edit");

      await user.click(screen.getByRole("button", { name: /more actions/i }));
      await user.click(screen.getByRole("menuitem", { name: "Delete" }));
      await user.click(screen.getByRole("button", { name: "Delete song" }));
      await waitFor(() => expect(mockDelete).toHaveBeenCalledWith("song-1"));
      expect(mockNavigate).toHaveBeenCalledWith("/songs");
    });

    it("hides editing actions from observers", async () => {
      mockAuthValue = observerAuth;
      const user = userEvent.setup();
      renderChart();
      await waitFor(() => screen.getByRole("button", { name: /more actions/i }));
      await user.click(screen.getByRole("button", { name: /more actions/i }));
      expect(screen.getByRole("menuitem", { name: "Print" })).toBeInTheDocument();
      expect(screen.queryByRole("menuitem", { name: "Edit" })).not.toBeInTheDocument();
      expect(screen.queryByRole("menuitem", { name: "Delete" })).not.toBeInTheDocument();
      expect(screen.queryByRole("menuitem", { name: "Share chart" })).not.toBeInTheDocument();
      expect(screen.queryByRole("menuitem", { name: "Log a play" })).not.toBeInTheDocument();
    });
  });

  describe("loading states", () => {
    it("falls back to the cached chart when offline", async () => {
      mockGet.mockRejectedValue(new Error("Failed to fetch"));
      mockIsOfflineRequestError.mockReturnValue(true);
      mockLoadCachedSong.mockReturnValue({ response: { song: { ...song, title: "Cached Grace" }, variations: [] } });
      renderChart();
      await waitFor(() => expect(screen.getByRole("heading", { name: "Cached Grace" })).toBeInTheDocument());
    });

    it("shows a not-found state with a way back", async () => {
      mockGet.mockRejectedValue(new Error("HTTP 404"));
      renderChart();
      await waitFor(() => expect(screen.getByText("Song not found.")).toBeInTheDocument());
      fireEvent.click(screen.getByRole("button", { name: /back to songs/i }));
      expect(mockNavigate).toHaveBeenCalledWith("/songs");
    });
  });
});
