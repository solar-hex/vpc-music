import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { render, screen, waitFor, fireEvent } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { MemoryRouter, Route, Routes, useLocation } from "react-router-dom";
import { SharedSongPage } from "@/pages/SharedSongPage";

// ---------- Mocks ----------
const mockGetShared = vi.fn();

vi.mock("@/lib/api-client", () => ({
  shareApi: {
    getShared: (...args: any[]) => mockGetShared(...args),
    mediaHref: (token: string, key: string) => `/api/shared/${token}/media/${key}`,
  },
}));

vi.mock("@/contexts/ThemeContext", () => ({
  useTheme: () => ({ resolvedTheme: "light", toggleTheme: vi.fn(), keyNotation: "flats", pageWidth: "centered" }),
}));

// The renderer is covered by its own test; here it reports what it was asked to draw.
vi.mock("@/components/songs/ChordProRenderer", () => ({
  ChordProRenderer: ({ content, transpose, nashville }: any) => (
    <div data-testid="chordpro-renderer" data-transpose={transpose ?? 0} data-nashville={String(Boolean(nashville))}>
      {content}
    </div>
  ),
  chartSections: () => [{ id: "section-0", label: "Verse 1" }],
}));

const SHARED = {
  title: "Covered",
  artist: "Mark Yandris",
  year: null,
  key: "Eb",
  tempo: 143,
  status: null,
  content: [
    "{title: Covered}",
    "{x_audio_soprano: https://media.invalid/x_audio_soprano}",
    "{x_chart_chord_chart: https://media.invalid/x_chart_chord_chart}",
    "",
    "{comment: Verse 1}",
    "[Eb]No more sacrificing lambs,",
  ].join("\n"),
};

function LocationProbe() {
  const location = useLocation();
  return <div data-testid="location">{`${location.pathname}${location.search}`}</div>;
}

function renderShared(path = "/shared/tok-abc") {
  return render(
    <MemoryRouter initialEntries={[path]}>
      <Routes>
        <Route
          path="/shared/:token"
          element={
            <>
              <SharedSongPage />
              <LocationProbe />
            </>
          }
        />
      </Routes>
    </MemoryRouter>,
  );
}

const loaded = () => screen.findByRole("heading", { name: "Covered" });

describe("SharedSongPage", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    localStorage.clear();
    mockGetShared.mockResolvedValue({ song: SHARED, shared: true });
    vi.spyOn(HTMLMediaElement.prototype, "play").mockImplementation(() => Promise.resolve());
    vi.spyOn(HTMLMediaElement.prototype, "pause").mockImplementation(() => {});
    vi.spyOn(HTMLMediaElement.prototype, "load").mockImplementation(() => {});
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it("shows a spinner while the chart loads", () => {
    mockGetShared.mockReturnValue(new Promise(() => {}));
    renderShared();
    expect(screen.getByRole("status", { name: "Loading chart" })).toBeInTheDocument();
  });

  it("shows the chart with its credits and says it is view only", async () => {
    renderShared();
    await loaded();
    expect(mockGetShared).toHaveBeenCalledWith("tok-abc");
    expect(screen.getByText("Key of Eb")).toBeInTheDocument();
    expect(screen.getByText("Mark Yandris")).toBeInTheDocument();
    expect(screen.getByText("Shared · view only")).toBeInTheDocument();
    expect(screen.getByTestId("chordpro-renderer")).toHaveTextContent("No more sacrificing lambs");
  });

  it("has the reading controls a member has, and no way into the library", async () => {
    renderShared();
    await loaded();
    expect(screen.getByRole("button", { name: /change key/i })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Transpose up" })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Nashville numbers" })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Comments" })).toBeInTheDocument();
    expect(screen.getByRole("navigation", { name: /song sections/i })).toBeInTheDocument();
    expect(screen.queryByRole("link", { name: /search songs/i })).not.toBeInTheDocument();
  });

  it("offers print and the song's PDF, and nothing that edits, downloads or shares", async () => {
    const user = userEvent.setup();
    renderShared();
    await loaded();
    await user.click(screen.getByRole("button", { name: /more actions/i }));
    const items = screen.getAllByRole("menuitem").map((item) => item.textContent?.trim());
    expect(items).toEqual(expect.arrayContaining(["Print", "Chord chart (PDF)"]));
    for (const forbidden of [/edit/i, /delete/i, /share/i, /download/i, /dropbox/i, /log a play/i]) {
      expect(items.some((item) => forbidden.test(item ?? ""))).toBe(false);
    }
  });

  it("changes key, and keeps the key in the address", async () => {
    renderShared();
    await loaded();
    fireEvent.click(screen.getByRole("button", { name: "Transpose up" }));
    await waitFor(() => expect(screen.getByTestId("location")).toHaveTextContent("/shared/tok-abc?key=E"));
    expect(screen.getByTestId("chordpro-renderer")).toHaveAttribute("data-transpose", "1");
  });

  it("opens in the key the link was sent in", async () => {
    renderShared("/shared/tok-abc?key=G");
    await loaded();
    expect(screen.getByText("Key of G")).toBeInTheDocument();
    expect(screen.getByTestId("chordpro-renderer")).toHaveAttribute("data-transpose", "4");
  });

  it("plays practice audio through the share link, not the member route", async () => {
    renderShared();
    await loaded();
    fireEvent.click(screen.getByRole("button", { name: "Play Soprano" }));
    expect(document.querySelector("audio")?.getAttribute("src")).toBe("/api/shared/tok-abc/media/x_audio_soprano");
  });

  it("explains a link that was turned off", async () => {
    mockGetShared.mockRejectedValue(Object.assign(new Error("This share link has been turned off"), { status: 410 }));
    renderShared();
    expect(await screen.findByRole("heading", { name: "This link isn't working" })).toBeInTheDocument();
    expect(screen.getByText(/sharing for this chart has been turned off/i)).toBeInTheDocument();
  });

  it("explains a link that does not exist", async () => {
    mockGetShared.mockRejectedValue(Object.assign(new Error("Invalid or expired share link"), { status: 404 }));
    renderShared();
    expect(await screen.findByText(/the link may be incomplete/i)).toBeInTheDocument();
  });

  it("keeps the page out of search engines while it is open", async () => {
    const { unmount } = renderShared();
    await loaded();
    expect(document.head.querySelector('meta[name="robots"]')).toHaveAttribute("content", "noindex, nofollow");
    unmount();
    expect(document.head.querySelector('meta[name="robots"]')).toBeNull();
  });
});
