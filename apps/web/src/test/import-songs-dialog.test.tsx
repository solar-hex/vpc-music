import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, waitFor, fireEvent } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import { ImportSongsDialog } from "@/components/songs/ImportSongsDialog";

const mockNavigate = vi.fn();
const mockPreview = vi.fn();
const mockBulk = vi.fn();
const mockInvalidate = vi.fn();

vi.mock("react-router-dom", async () => {
  const actual = await vi.importActual<typeof import("react-router-dom")>("react-router-dom");
  return { ...actual, useNavigate: () => mockNavigate };
});

vi.mock("@/lib/song-import", () => ({
  IMPORT_ACCEPT: ".cho,.chrd",
  IMPORT_FORMATS_LABEL: ".cho, .chrd",
  previewImportFile: (...args: any[]) => mockPreview(...args),
  bulkImport: (...args: any[]) => mockBulk(...args),
}));

vi.mock("@/hooks/useSongLibrary", () => ({
  invalidateSongLibrary: (...args: any[]) => mockInvalidate(...args),
}));

vi.mock("sonner", () => ({
  toast: { success: vi.fn(), error: vi.fn() },
}));

function chooseFiles(files: File[]) {
  const input = screen.getByTestId("import-file-input");
  Object.defineProperty(input, "files", { value: files, configurable: true });
  fireEvent.change(input);
}

describe("ImportSongsDialog", () => {
  const onClose = vi.fn();

  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("previews a single file and opens the editor with it", async () => {
    const preview = { filename: "a.chrd", sourceLabel: ".chrd", chordPro: "[G]x", metadata: { title: "A" } };
    mockPreview.mockResolvedValue(preview);
    render(
      <MemoryRouter>
        <ImportSongsDialog open onClose={onClose} />
      </MemoryRouter>,
    );
    chooseFiles([new File(["x"], "a.chrd")]);
    await waitFor(() => expect(mockNavigate).toHaveBeenCalledWith("/songs/new", { state: { importPreview: preview } }));
    expect(onClose).toHaveBeenCalled();
  });

  it("bulk imports several files, shows progress and refreshes the library", async () => {
    mockBulk.mockImplementation(async (_files: File[], onProgress: any) => {
      const items = [
        { filename: "a.chrd", status: "success", songId: "s1", songTitle: "A" },
        { filename: "b.chrd", status: "error", message: "bad" },
      ];
      onProgress(items, 2, "");
      return { items, successCount: 1 };
    });
    render(
      <MemoryRouter>
        <ImportSongsDialog open onClose={onClose} />
      </MemoryRouter>,
    );
    chooseFiles([new File(["x"], "a.chrd"), new File(["y"], "b.chrd")]);
    await waitFor(() => expect(screen.getByTestId("bulk-import-status")).toHaveTextContent("2 of 2 done"));
    expect(screen.getByRole("link", { name: "Open" })).toHaveAttribute("href", "/songs/s1");
    expect(screen.getByText("bad")).toBeInTheDocument();
    expect(mockInvalidate).toHaveBeenCalled();
    expect(mockNavigate).not.toHaveBeenCalled();
  });

  it("reports a preview failure", async () => {
    mockPreview.mockRejectedValue(new Error("Unsupported file format"));
    render(
      <MemoryRouter>
        <ImportSongsDialog open onClose={onClose} />
      </MemoryRouter>,
    );
    chooseFiles([new File(["x"], "a.docx")]);
    const { toast } = await import("sonner");
    await waitFor(() => expect(toast.error).toHaveBeenCalledWith("Unsupported file format"));
    expect(onClose).not.toHaveBeenCalled();
  });
});
