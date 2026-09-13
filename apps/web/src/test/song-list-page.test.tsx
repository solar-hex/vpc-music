import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, waitFor, fireEvent } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { MemoryRouter } from "react-router-dom";
import { SongListPage } from "@/pages/songs/SongListPage";
import { LIBRARY_CACHE_KEY, resetSongLibraryCache } from "@/hooks/useSongLibrary";

// ---------- Mocks ----------
const mockList = vi.fn();
vi.mock("@/lib/api-client", () => ({
  songsApi: {
    list: (...args: any[]) => mockList(...args),
  },
}));

let mockAuthValue: any;
vi.mock("@/contexts/AuthContext", () => ({
  useAuth: () => mockAuthValue,
}));

const musicianAuth = {
  user: { id: "u1", email: "keys@test.com", displayName: "Keys", role: "member" },
  activeOrg: { id: "org1", name: "Test Church", role: "musician" },
};
const observerAuth = {
  user: { id: "u2", email: "guest@test.com", displayName: "Guest", role: "member" },
  activeOrg: { id: "org1", name: "Test Church", role: "observer" },
};

const library = [
  { id: "s1", title: "Amazing Grace", artist: "John Newton", key: "G", content: "", isDraft: false },
  { id: "s2", title: "Blessed Assurance", artist: null, key: "D", content: "", isDraft: false },
  { id: "s3", title: "Above All", artist: "Paul Baloche", key: "A", content: "", isDraft: false },
  { id: "s4", title: "Zion Draft", artist: null, key: "C", content: "", isDraft: true },
  { id: "s5", title: "Words Only Hymn", artist: null, key: null, content: "", isDraft: false, status: "missing_chords" },
];

function renderList(path = "/songs") {
  return render(
    <MemoryRouter initialEntries={[path]}>
      <SongListPage />
    </MemoryRouter>,
  );
}

const rowLink = (title: string) => screen.getByRole("link", { name: new RegExp(title) });

describe("SongListPage", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    localStorage.clear();
    resetSongLibraryCache();
    mockAuthValue = musicianAuth;
    mockList.mockImplementation((params: any) => {
      if (params?.q) return Promise.resolve({ songs: [], total: 0 });
      return Promise.resolve({ songs: library, total: library.length });
    });
  });

  it("loads the whole library once and lists it A to Z with key pills, drafts hidden", async () => {
    renderList();
    await waitFor(() => expect(rowLink("Amazing Grace")).toBeInTheDocument());
    expect(mockList).toHaveBeenCalledWith({ sort: "title", limit: 5000 });
    expect(mockList).toHaveBeenCalledTimes(1);

    const titles = screen.getAllByRole("link").map((link) => link.textContent).filter((text) => /Grace|Assurance|Above|Zion/.test(text || ""));
    expect(titles[0]).toContain("Above All");
    expect(titles[1]).toContain("Amazing Grace");
    expect(titles[2]).toContain("Blessed Assurance");
    expect(screen.queryByText("Zion Draft")).not.toBeInTheDocument();
    expect(screen.getByRole("region", { name: /starting with A/i })).toBeInTheDocument();
    expect(screen.getByRole("region", { name: /starting with B/i })).toBeInTheDocument();
    expect(rowLink("Amazing Grace")).toHaveTextContent("John Newton");
    expect(rowLink("Amazing Grace")).toHaveTextContent("G");
    expect(rowLink("Amazing Grace")).toHaveAttribute("href", "/songs/s1");
    // The count names what this list IS — the ready songs — and links to the
    // other view, so the hidden drafts are one tap away rather than lost.
    const counts = screen.getByRole("link", { name: /ready/ });
    expect(counts).toHaveTextContent("4 ready");
    expect(counts).toHaveTextContent("1 need work");
    expect(counts).toHaveAttribute("href", "/library");
  });

  it("filters instantly as you type, without calling the server for short queries", async () => {
    renderList();
    await waitFor(() => rowLink("Amazing Grace"));
    fireEvent.change(screen.getByRole("searchbox", { name: /search songs/i }), { target: { value: "gr" } });
    expect(screen.getByRole("link", { name: /Amazing Grace/ })).toBeInTheDocument();
    expect(screen.queryByRole("link", { name: /Blessed Assurance/ })).not.toBeInTheDocument();
    expect(mockList).toHaveBeenCalledTimes(1);
    fireEvent.click(screen.getByRole("button", { name: /clear search/i }));
    expect(screen.getByRole("link", { name: /Blessed Assurance/ })).toBeInTheDocument();
  });

  it("matches on artist and ignores accents and apostrophes", async () => {
    renderList();
    await waitFor(() => rowLink("Amazing Grace"));
    fireEvent.change(screen.getByRole("searchbox", { name: /search songs/i }), { target: { value: "balóche" } });
    expect(screen.getByRole("link", { name: /Above All/ })).toBeInTheDocument();
    expect(screen.queryByRole("link", { name: /Amazing Grace/ })).not.toBeInTheDocument();
  });

  it("reveals drafts on request, with a badge and a count", async () => {
    renderList();
    await waitFor(() => rowLink("Amazing Grace"));
    fireEvent.click(screen.getByRole("button", { name: "Show drafts (1)" }));
    expect(rowLink("Zion Draft")).toHaveTextContent("Draft");
    fireEvent.click(screen.getByRole("button", { name: "Hide drafts" }));
    expect(screen.queryByText("Zion Draft")).not.toBeInTheDocument();
  });

  it("says when a song is a lyrics sheet rather than a chart", async () => {
    // 194 songs are complete lyrics with no chords. Without the badge they
    // look like a chart that failed to load.
    renderList();
    await waitFor(() => rowLink("Words Only Hymn"));
    expect(rowLink("Words Only Hymn")).toHaveTextContent("Lyrics only");
    expect(rowLink("Amazing Grace")).not.toHaveTextContent("Lyrics only");
  });

  it("carries a key from the chart page into every song link", async () => {
    renderList("/songs?key=Bb");
    await waitFor(() => rowLink("Amazing Grace"));
    expect(screen.getByText("Opening songs in Bb")).toBeInTheDocument();
    expect(rowLink("Amazing Grace")).toHaveAttribute("href", "/songs/s1?key=Bb");
    expect(screen.getByRole("link", { name: "Clear" })).toHaveAttribute("href", "/songs");
  });

  it("adds an 'Also found in lyrics' group from the server after typing settles", async () => {
    mockList.mockImplementation((params: any) => {
      if (params?.q) {
        // the server matches titles too; Amazing Grace is already shown by title
        return Promise.resolve({ songs: [library[0], { id: "s9", title: "Nothing But The Blood", key: "E", content: "", isDraft: false }], total: 2 });
      }
      return Promise.resolve({ songs: library, total: library.length });
    });
    renderList();
    await waitFor(() => rowLink("Amazing Grace"));
    fireEvent.change(screen.getByRole("searchbox", { name: /search songs/i }), { target: { value: "grace" } });
    await waitFor(() => expect(screen.getByRole("region", { name: /also found in lyrics/i })).toBeInTheDocument());
    expect(mockList).toHaveBeenCalledWith({ q: "grace", limit: 25, sort: "title" });
    expect(rowLink("Nothing But The Blood")).toBeInTheDocument();
    // a song already matched by title is not repeated in the lyrics group
    expect(screen.getAllByRole("link", { name: /Amazing Grace/ })).toHaveLength(1);
  });

  it("focuses the search box when / is pressed", async () => {
    renderList();
    await waitFor(() => rowLink("Amazing Grace"));
    const box = screen.getByRole("searchbox", { name: /search songs/i });
    box.blur();
    fireEvent.keyDown(document, { key: "/" });
    expect(document.activeElement).toBe(box);
  });

  it("offers New song to editors", async () => {
    renderList();
    await waitFor(() => rowLink("Amazing Grace"));
    expect(screen.getByRole("link", { name: /new song/i })).toHaveAttribute("href", "/songs/new");
  });

  it("does not offer New song to observers", async () => {
    mockAuthValue = observerAuth;
    renderList();
    await waitFor(() => rowLink("Amazing Grace"));
    expect(screen.queryByRole("link", { name: /new song/i })).not.toBeInTheDocument();
  });

  it("shows an empty state for an empty library and for no matches", async () => {
    mockList.mockResolvedValue({ songs: [], total: 0 });
    renderList();
    await waitFor(() => expect(screen.getByText("No songs yet.")).toBeInTheDocument());
    expect(screen.getByRole("link", { name: /add the first song/i })).toBeInTheDocument();
  });

  it("says when nothing matches", async () => {
    renderList();
    await waitFor(() => rowLink("Amazing Grace"));
    fireEvent.change(screen.getByRole("searchbox", { name: /search songs/i }), { target: { value: "zz" } });
    expect(screen.getByText('No songs match "zz".')).toBeInTheDocument();
  });

  it("serves the saved copy when offline", async () => {
    localStorage.setItem(LIBRARY_CACHE_KEY, JSON.stringify({ songs: library.slice(0, 2), fetchedAt: "2020-01-01T00:00:00.000Z" }));
    mockList.mockRejectedValue(new Error("Failed to fetch"));
    const user = userEvent.setup();
    renderList();
    expect(rowLink("Amazing Grace")).toBeInTheDocument();
    await waitFor(() => expect(screen.getByText(/offline copy/)).toBeInTheDocument());
    await user.type(screen.getByRole("searchbox", { name: /search songs/i }), "bless");
    expect(rowLink("Blessed Assurance")).toBeInTheDocument();
  });
});
