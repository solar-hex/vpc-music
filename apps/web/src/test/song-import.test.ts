import { describe, it, expect, vi, beforeEach } from "vitest";
import { bulkImport, fileExtension, IMPORT_ACCEPT, importFileAsSong, isSupportedImportFile, previewImportFile } from "@/lib/song-import";

const mockCreate = vi.fn();
const mockImportChrd = vi.fn();
const mockPreviewImportChrd = vi.fn();
const mockImportOnSong = vi.fn();
const mockPreviewImportOnSong = vi.fn();
const mockImportPdf = vi.fn();
const mockPreviewImportPdf = vi.fn();

vi.mock("@/lib/api-client", () => ({
  songsApi: {
    create: (...args: any[]) => mockCreate(...args),
    importChrd: (...args: any[]) => mockImportChrd(...args),
    previewImportChrd: (...args: any[]) => mockPreviewImportChrd(...args),
    importOnSong: (...args: any[]) => mockImportOnSong(...args),
    previewImportOnSong: (...args: any[]) => mockPreviewImportOnSong(...args),
    importPdf: (...args: any[]) => mockImportPdf(...args),
    previewImportPdf: (...args: any[]) => mockPreviewImportPdf(...args),
  },
}));

const file = (name: string, text = "body") => new File([text], name, { type: "text/plain" });

describe("song-import", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockPreviewImportChrd.mockResolvedValue({ chordPro: "{title: A}\n[G]x", metadata: { title: "A", key: "G" } });
    mockPreviewImportOnSong.mockResolvedValue({ chordPro: "{title: B}", metadata: { title: "B" } });
    mockPreviewImportPdf.mockResolvedValue({ chordPro: "{title: C}", metadata: { title: "C", tempo: 88 } });
    mockCreate.mockResolvedValue({ song: { id: "s-cho", title: "From ChordPro" } });
    mockImportChrd.mockResolvedValue({ song: { id: "s-chrd", title: "From chrd" } });
    mockImportOnSong.mockResolvedValue({ song: { id: "s-onsong", title: "From OnSong" } });
    mockImportPdf.mockResolvedValue({ song: { id: "s-pdf", title: "From PDF" } });
  });

  it("knows the supported extensions", () => {
    expect(IMPORT_ACCEPT).toBe(".cho,.chordpro,.chopro,.onsong,.xml,.chrd,.txt,.pdf");
    expect(fileExtension("Song.Final.CHRD")).toBe("chrd");
    expect(isSupportedImportFile("a.pdf")).toBe(true);
    expect(isSupportedImportFile("a.docx")).toBe(false);
  });

  it("previews each format through the right converter", async () => {
    const chordpro = await previewImportFile(file("grace.cho", "{title: Amazing Grace}\n{key: G}\n{tempo: 72}\n[G]Amazing"));
    expect(chordpro).toMatchObject({ sourceLabel: "ChordPro", metadata: { title: "Amazing Grace", key: "G", tempo: 72 } });
    expect(mockPreviewImportChrd).not.toHaveBeenCalled();

    expect((await previewImportFile(file("x.chrd"))).sourceLabel).toBe(".chrd");
    expect(mockPreviewImportChrd).toHaveBeenCalledWith({ filename: "x.chrd", content: "body" });
    expect((await previewImportFile(file("x.txt"))).sourceLabel).toBe("Plain text");
    expect((await previewImportFile(file("x.onsong"))).sourceLabel).toBe("OnSong");
    expect((await previewImportFile(file("x.xml"))).sourceLabel).toBe("OpenSong XML");
    expect((await previewImportFile(file("x.pdf"))).metadata).toEqual({ title: "C", tempo: 88 });
    await expect(previewImportFile(file("x.docx"))).rejects.toThrow(/Unsupported file format/);
  });

  it("imports each format straight into the library", async () => {
    expect(await importFileAsSong(file("a.cho", "{title: T}\n{artist: X}\n[C]la"))).toEqual({ songId: "s-cho", songTitle: "From ChordPro" });
    expect(mockCreate).toHaveBeenCalledWith(expect.objectContaining({ title: "T", artist: "X", content: "{title: T}\n{artist: X}\n[C]la" }));
    expect(await importFileAsSong(file("a.chrd"))).toEqual({ songId: "s-chrd", songTitle: "From chrd" });
    expect(await importFileAsSong(file("a.onsong"))).toEqual({ songId: "s-onsong", songTitle: "From OnSong" });
    expect(await importFileAsSong(file("a.pdf"))).toEqual({ songId: "s-pdf", songTitle: "From PDF" });
    await expect(importFileAsSong(file("empty.chrd", "   "))).rejects.toThrow("File is empty");
  });

  it("bulk imports in order, reporting progress and collecting failures", async () => {
    mockImportOnSong.mockRejectedValue(new Error("bad file"));
    const progress = vi.fn();
    const result = await bulkImport([file("one.chrd"), file("two.onsong"), file("three.chrd")], progress);
    expect(result.successCount).toBe(2);
    expect(result.items.map((item) => item.status)).toEqual(["success", "error", "success"]);
    expect(result.items[1].message).toBe("bad file");
    expect(result.items[0]).toMatchObject({ songId: "s-chrd", songTitle: "From chrd" });
    // processing + done for each file
    expect(progress).toHaveBeenCalledTimes(6);
    expect(progress.mock.calls[0][2]).toBe("one.chrd");
    expect(progress.mock.calls.at(-1)?.[1]).toBe(3);
  });
});
