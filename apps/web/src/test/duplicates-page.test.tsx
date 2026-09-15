import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, waitFor, fireEvent } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import { DuplicatesPage } from "@/pages/songs/DuplicatesPage";

const mockDuplicates = vi.fn();
vi.mock("@/lib/api-client", () => ({
  songsApi: { duplicates: (...args: unknown[]) => mockDuplicates(...args) },
}));

let mockRole = "musician";
vi.mock("@/contexts/AuthContext", () => ({
  useAuth: () => ({ user: { role: "member" }, activeOrg: { role: mockRole } }),
}));

const song = (over: Record<string, unknown>) => ({
  id: "x", title: "X", artist: null, key: null, tempo: null, isDraft: false, status: null, source: "chrd", chords: 10, ...over,
});

const PAIRS = [
  {
    overlap: 1,
    shared: 22,
    titlesAgree: false,
    left: song({ id: "press-on", title: "Press On", source: "chrd" }),
    right: song({ id: "we-press-on", title: "We press on", source: "docx", chords: 0 }),
  },
  {
    overlap: 0.91,
    shared: 88,
    titlesAgree: true,
    left: song({ id: "covered-1", title: "Covered", artist: "Mattoon Youth Choir", source: "pdf" }),
    right: song({ id: "covered-2", title: "Covered", artist: "Mark Yandris", source: "pdf" }),
  },
];

const renderPage = () =>
  render(
    <MemoryRouter>
      <DuplicatesPage />
    </MemoryRouter>,
  );

describe("DuplicatesPage", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockRole = "musician";
    mockDuplicates.mockResolvedValue({ pairs: PAIRS });
  });

  it("lists each pair, most alike first, linking to the side-by-side view", async () => {
    renderPage();
    const first = await screen.findByRole("link", { name: /Press On.*We press on/ });
    expect(first).toHaveAttribute("href", "/library/duplicates/press-on/we-press-on");
    expect(first).toHaveTextContent("100% of the words match");
    expect(first).toHaveTextContent("Titles differ");
    expect(first).toHaveTextContent("Church chart · Word lyric sheet");
    expect(screen.getByText(/2 pairs to look at/)).toBeInTheDocument();
  });

  it("points out two recordings by different artists", async () => {
    renderPage();
    const covered = await screen.findByRole("link", { name: /Covered.*Covered/ });
    expect(covered).toHaveTextContent("Different artists");
    expect(covered).toHaveTextContent("91% of the words match");
    expect(covered).not.toHaveTextContent("Titles differ");
  });

  it("says so when there is nothing to review", async () => {
    mockDuplicates.mockResolvedValue({ pairs: [] });
    renderPage();
    expect(await screen.findByText(/No possible duplicates/)).toBeInTheDocument();
  });

  it("offers a retry when the search fails", async () => {
    mockDuplicates.mockRejectedValueOnce(new Error("Network down"));
    renderPage();
    expect(await screen.findByText("Network down")).toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: "Try again" }));
    await waitFor(() => expect(screen.getByRole("link", { name: /Press On/ })).toBeInTheDocument());
  });

  it("does not ask the server for an observer, and says why", async () => {
    mockRole = "observer";
    renderPage();
    expect(screen.getByText(/Only people who can edit songs/)).toBeInTheDocument();
    expect(mockDuplicates).not.toHaveBeenCalled();
  });
});
