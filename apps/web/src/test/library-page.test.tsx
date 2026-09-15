import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, waitFor, fireEvent } from "@testing-library/react";
import { MemoryRouter, useLocation } from "react-router-dom";
import { LibraryPage } from "@/pages/songs/LibraryPage";
import { resetSongLibraryCache } from "@/hooks/useSongLibrary";

const mockList = vi.fn();
vi.mock("@/lib/api-client", () => ({
  songsApi: { list: (...args: any[]) => mockList(...args) },
}));

let mockRole = "musician";
vi.mock("@/contexts/AuthContext", () => ({
  useAuth: () => ({ user: { role: "member" }, activeOrg: { role: mockRole } }),
}));

const library = [
  { id: "s1", title: "Amazing Grace", artist: "John Newton", key: "G", tempo: 68, tags: "theme:grace-mercy", year: "1779", content: "" },
  { id: "s2", title: "Way Maker", artist: "Sinach", key: "E", tempo: 72, tags: "theme:faith-trust", content: "" },
  { id: "s3", title: "Holy Ghost", key: "Bb", tempo: 150, tags: "theme:holy-spirit", content: "" },
  { id: "s4", title: "Nothing But The Blood", content: "", isDraft: true },
];

/** MemoryRouter never touches window.location, so read the URL from the router. */
function UrlProbe() {
  const location = useLocation();
  return <span data-testid="url">{location.search}</span>;
}

function renderLibrary(path = "/library") {
  return render(
    <MemoryRouter initialEntries={[path]}>
      <LibraryPage />
      <UrlProbe />
    </MemoryRouter>,
  );
}

const url = () => screen.getByTestId("url").textContent || "";

const rowLink = (title: string) => screen.queryByRole("link", { name: new RegExp(title) });

describe("LibraryPage", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    localStorage.clear();
    resetSongLibraryCache();
    mockList.mockResolvedValue({ songs: library, total: library.length });
  });

  it("reads the library the app already has, rather than asking for statistics", async () => {
    renderLibrary();
    await waitFor(() => expect(rowLink("Amazing Grace")).toBeInTheDocument());
    expect(mockList).toHaveBeenCalledTimes(1);
    expect(mockList).toHaveBeenCalledWith({ sort: "title", limit: 5000 });
  });

  it("shows what the library knows and what it is missing", async () => {
    renderLibrary();
    await waitFor(() => expect(rowLink("Amazing Grace")).toBeInTheDocument());
    // 2 of 4 have an artist; 1 of 4 has a year.
    // The actionable number is what is LEFT, not what is covered.
    expect(screen.getByRole("button", { name: /Artist/ })).toHaveTextContent("2 to go");
    // Year is deliberately not scored: 888 of 889 songs will never have one, so
    // it only ever docked every song five points and asked for the impossible.
    expect(screen.queryByRole("button", { name: /Year/ })).not.toBeInTheDocument();
    // Two of four carry both a title and an artist, so only two are findable by name.
    expect(screen.getByText("title + artist").previousSibling).toHaveTextContent("2");
    expect(screen.getByText("songs").previousSibling).toHaveTextContent("4");
  });

  it("says what each song still needs, not just how far along it is", async () => {
    renderLibrary();
    await waitFor(() => expect(rowLink("Amazing Grace")).toBeInTheDocument());
    // A percentage tells you a song is unfinished; this tells you what to do.
    expect(rowLink("Holy Ghost")).toHaveTextContent("needs");
    expect(rowLink("Holy Ghost")).toHaveTextContent("artist");
    // Amazing Grace has every field, so it asks for nothing.
    expect(rowLink("Amazing Grace")).not.toHaveTextContent("needs");
  });

  it("shows drafts by default — this is the everything list", async () => {
    // The song list is the ready library; this one has to include what that
    // one hides, or the hidden songs have nowhere to be found.
    renderLibrary();
    await waitFor(() => expect(rowLink("Amazing Grace")).toBeInTheDocument());
    expect(rowLink("Nothing But The Blood")).toBeInTheDocument(); // isDraft
    expect(screen.getByText(/4 of 4 songs/)).toBeInTheDocument();
  });

  it("turns a coverage row into the songs behind it", async () => {
    renderLibrary();
    await waitFor(() => expect(rowLink("Amazing Grace")).toBeInTheDocument());
    fireEvent.click(screen.getByRole("button", { name: /Artist/ }));
    await waitFor(() => expect(rowLink("Amazing Grace")).not.toBeInTheDocument());
    expect(rowLink("Holy Ghost")).toBeInTheDocument();
    expect(rowLink("Nothing But The Blood")).toBeInTheDocument();
    expect(screen.getByText(/2 of 4 songs/)).toBeInTheDocument();
  });

  it("filters by a theme chip and keeps the choice in the URL", async () => {
    renderLibrary();
    await waitFor(() => expect(rowLink("Amazing Grace")).toBeInTheDocument());
    fireEvent.click(screen.getByRole("button", { name: /Filters/ }));
    fireEvent.click(screen.getByRole("button", { name: /Holy Spirit 1/ }));
    await waitFor(() => expect(rowLink("Amazing Grace")).not.toBeInTheDocument());
    expect(rowLink("Holy Ghost")).toBeInTheDocument();
    expect(url()).toContain("theme=holy-spirit");
  });

  it("marks a lyrics sheet and filters to just those", async () => {
    // Scoped fixture: the shared one feeds a dozen count assertions, and a
    // fifth song would move every one of them.
    mockList.mockResolvedValue({
      songs: [
        { id: "a", title: "Has Chords", key: "G", content: "" },
        { id: "b", title: "Words Only Hymn", content: "", status: "missing_chords" },
      ],
      total: 2,
    });
    renderLibrary();
    await waitFor(() => expect(rowLink("Words Only Hymn")).toBeInTheDocument());
    expect(rowLink("Words Only Hymn")).toHaveTextContent("Lyrics only");
    expect(rowLink("Has Chords")).not.toHaveTextContent("Lyrics only");

    fireEvent.click(screen.getByRole("button", { name: /Filters/ }));
    fireEvent.click(screen.getByRole("button", { name: /Lyrics only/ }));
    await waitFor(() => expect(rowLink("Has Chords")).not.toBeInTheDocument());
    expect(rowLink("Words Only Hymn")).toBeInTheDocument();
    expect(url()).toContain("content=lyrics");
  });

  it("opens with the filters a link carries", async () => {
    renderLibrary("/library?key=Bb");
    await waitFor(() => expect(rowLink("Holy Ghost")).toBeInTheDocument());
    expect(rowLink("Amazing Grace")).not.toBeInTheDocument();
    expect(screen.getByText(/1 of 4 songs/)).toBeInTheDocument();
  });

  it("searches across title, artist and theme", async () => {
    renderLibrary();
    await waitFor(() => expect(rowLink("Amazing Grace")).toBeInTheDocument());
    fireEvent.change(screen.getByRole("searchbox", { name: /search the library/i }), { target: { value: "sinach" } });
    await waitFor(() => expect(rowLink("Way Maker")).toBeInTheDocument());
    expect(rowLink("Amazing Grace")).not.toBeInTheDocument();
  });

  it("clears everything at once", async () => {
    renderLibrary("/library?key=Bb&missing=artist");
    await waitFor(() => expect(rowLink("Holy Ghost")).toBeInTheDocument());
    fireEvent.click(screen.getByRole("button", { name: /clear all/i }));
    await waitFor(() => expect(rowLink("Amazing Grace")).toBeInTheDocument());
    expect(screen.getByText(/4 of 4 songs/)).toBeInTheDocument();
  });

  it("lists the least complete song first, and links every row to its chart", async () => {
    renderLibrary();
    await waitFor(() => expect(rowLink("Amazing Grace")).toBeInTheDocument());
    const titles = screen.getAllByRole("link").map((link) => link.textContent || "").filter((text) => /Grace|Maker|Ghost|Blood/.test(text));
    expect(titles[0]).toContain("Nothing But The Blood");
    // Amazing Grace and Way Maker are both complete now, so the tie breaks A-Z.
    expect(titles[titles.length - 1]).toContain("Way Maker");
    expect(rowLink("Amazing Grace")).toHaveAttribute("href", "/songs/s1");
  });

  it("offers the duplicate review to people who can edit songs, and only them", async () => {
    renderLibrary();
    await waitFor(() => expect(rowLink("Amazing Grace")).toBeInTheDocument());
    expect(screen.getByRole("link", { name: "Possible duplicates" })).toHaveAttribute("href", "/library/duplicates");

    mockRole = "observer";
    try {
      renderLibrary();
      await waitFor(() => expect(screen.getAllByRole("link", { name: /Amazing Grace/ }).length).toBeGreaterThan(1));
      expect(screen.getAllByRole("link", { name: "Possible duplicates" })).toHaveLength(1);
    } finally {
      mockRole = "musician";
    }
  });
});
