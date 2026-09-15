import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, fireEvent, waitFor, within } from "@testing-library/react";
import { useState } from "react";
import { SongFilesSection, freeDirective } from "@/components/songs/SongFilesSection";

const requestUpload = vi.fn();
const uploadFile = vi.fn();
vi.mock("@/lib/api-client", () => ({
  songsApi: {
    requestUpload: (...args: unknown[]) => requestUpload(...args),
    mediaHref: (id: string, key: string) => `/api/songs/${id}/media/${key}`,
  },
  uploadFile: (...args: unknown[]) => uploadFile(...args),
}));

const toast = vi.hoisted(() => ({ success: vi.fn(), error: vi.fn() }));
vi.mock("sonner", () => ({ toast }));

const STORE = "https://s3.us-central-1.wasabisys.com/proj-vpcmusic/v1/prd/media/songs/way-maker--12345678";
const SAVED = [
  "{title: Way Maker}",
  `{x_audio_way_maker_alto: ${STORE}/audio/alto.mp3}`,
  `{x_chart_chord_chart: ${STORE}/charts/chord-chart.pdf}`,
  `{x_audio_loop_72bpm: ${STORE}/audio/loop-72bpm.mp3}`,
  "",
  "[E]Way maker",
].join("\n");

let latest = "";
function Editor({ songId = "song-1", initial = SAVED }: { songId?: string | null; initial?: string }) {
  const [content, setContent] = useState(initial);
  latest = content;
  return <SongFilesSection songId={songId} content={content} savedContent={SAVED} onContentChange={setContent} />;
}

const rowOf = (label: string) => screen.getByText(label, { selector: "span" }).closest("li") as HTMLElement;
const choose = (rowKey: string, name: string, type = "audio/mpeg") =>
  fireEvent.change(screen.getByTestId(`file-input-${rowKey}`), { target: { files: [new File(["bytes"], name, { type })] } });

describe("SongFilesSection", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    requestUpload.mockImplementation(async (_id: string, data: { slot?: string; filename: string }) => ({
      uploadUrl: "https://signed.example/put",
      method: "PUT",
      headers: { "Content-Type": "audio/mpeg" },
      url: `${STORE}/uploaded/${data.slot ?? data.filename}`,
      directive: data.slot ? `x_${data.slot.includes("chart") || data.slot === "vocals" ? "chart" : "audio"}_${data.slot}` : `x_file_${data.filename.replace(/\.\w+$/, "").toLowerCase()}`,
      kind: "audio",
    }));
    uploadFile.mockImplementation(async (_ticket: unknown, _file: File, onProgress?: (f: number) => void) => {
      onProgress?.(0.5);
    });
  });

  it("asks a new song to be saved before it takes files", () => {
    render(<Editor songId={null} initial="" />);
    expect(screen.getByText(/Save the song first/)).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: /Add/ })).not.toBeInTheDocument();
  });

  it("asks for each part and chart by name, finding the ones the chart already has", () => {
    render(<Editor />);
    // the corpus's song-name-prefixed alto still counts as the alto
    expect(within(rowOf("Alto")).getByRole("link", { name: "Play" })).toHaveAttribute("href", "/api/songs/song-1/media/x_audio_way_maker_alto");
    expect(within(rowOf("Chord chart")).getByRole("link", { name: "Open" })).toBeInTheDocument();
    expect(within(rowOf("Soprano")).getByText("None")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Add Soprano" })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Replace Alto" })).toBeInTheDocument();
    // anything else the song carries is listed under other files
    expect(within(screen.getByRole("list", { name: "Other files" })).getByText("Loop 72")).toBeInTheDocument();
  });

  it("uploads a part and writes its link into the chart under the part's name", async () => {
    render(<Editor />);
    choose("soprano", "Soprano take 3.mp3");
    await waitFor(() => expect(latest).toContain(`{x_audio_soprano: ${STORE}/uploaded/soprano}`));
    expect(requestUpload).toHaveBeenCalledWith("song-1", { slot: "soprano", filename: "Soprano take 3.mp3", size: 5 });
    expect(within(rowOf("Soprano")).getByText("Added. Save the song to keep it.")).toBeInTheDocument();
    expect(toast.success).toHaveBeenCalledWith("Soprano added. Save the song to keep it.");
  });

  it("replaces a part in the line the chart already uses for it", async () => {
    render(<Editor />);
    choose("alto", "new alto.mp3");
    await waitFor(() => expect(latest).toContain(`{x_audio_way_maker_alto: ${STORE}/uploaded/alto}`));
    expect(latest.match(/_alto:/g)).toHaveLength(1);
  });

  it("removes a file's link from the chart", () => {
    render(<Editor />);
    fireEvent.click(screen.getByRole("button", { name: "Remove Chord chart" }));
    expect(latest).not.toContain("x_chart_chord_chart");
    expect(within(rowOf("Chord chart")).getByText("None")).toBeInTheDocument();
  });

  it("adds any other file under its own name, never over one already there", async () => {
    render(<Editor />);
    choose("new-file", "Notes.docx", "application/msword");
    await waitFor(() => expect(latest).toContain(`{x_file_notes: ${STORE}/uploaded/Notes.docx}`));
    choose("new-file", "Notes.docx", "application/msword");
    await waitFor(() => expect(latest).toContain("{x_file_notes_2:"));
    expect(requestUpload).toHaveBeenLastCalledWith("song-1", { slot: undefined, filename: "Notes.docx", size: 5 });
  });

  it("says what went wrong when an upload fails, and leaves the chart alone", async () => {
    uploadFile.mockRejectedValueOnce(new Error("The upload could not reach storage"));
    render(<Editor />);
    choose("tenor", "tenor.mp3");
    expect(await within(rowOf("Tenor")).findByRole("alert")).toHaveTextContent("The upload could not reach storage");
    expect(latest).toBe(SAVED);
  });

  it("shows progress while a file goes up, and can cancel it", async () => {
    let finish: () => void = () => {};
    uploadFile.mockImplementationOnce(
      (_ticket: unknown, _file: File, onProgress: (f: number) => void, signal: AbortSignal) =>
        new Promise<void>((resolve, reject) => {
          onProgress(0.4);
          finish = resolve;
          signal.addEventListener("abort", () => reject(new Error("Upload cancelled")));
        }),
    );
    render(<Editor />);
    choose("tenor", "tenor.mp3");
    expect(await screen.findByRole("progressbar", { name: "Uploading Tenor" })).toBeInTheDocument();
    expect(within(rowOf("Tenor")).getByText("40%")).toBeInTheDocument();
    fireEvent.click(within(rowOf("Tenor")).getByRole("button", { name: "Cancel" }));
    await waitFor(() => expect(screen.queryByRole("progressbar")).not.toBeInTheDocument());
    expect(within(rowOf("Tenor")).queryByRole("alert")).not.toBeInTheDocument();
    expect(latest).toBe(SAVED);
    finish();
  });
});

describe("freeDirective", () => {
  it("numbers a name that is taken", () => {
    expect(freeDirective("{x_file_notes: a}\n{x_file_notes_2: b}", "x_file_notes")).toBe("x_file_notes_3");
    expect(freeDirective("{title: X}", "x_file_notes")).toBe("x_file_notes");
  });
});
