import { songsApi } from "@/lib/api-client";
import { parseChordPro } from "@vpc-music/shared";

/**
 * File import shared by the editor page, the import dialog and settings.
 * One file becomes a preview to review in the editor; many files import
 * straight into the library one after another.
 */
export const SUPPORTED_EXTENSIONS = ["cho", "chordpro", "chopro", "onsong", "xml", "chrd", "txt", "pdf"] as const;
export const IMPORT_ACCEPT = SUPPORTED_EXTENSIONS.map((extension) => `.${extension}`).join(",");
export const IMPORT_FORMATS_LABEL = SUPPORTED_EXTENSIONS.map((extension) => `.${extension}`).join(", ");

export interface ImportPreviewMetadata {
  title?: string | null;
  artist?: string | null;
  key?: string | null;
  tempo?: number | null;
  year?: string | null;
  isDraft?: boolean;
}

/** Serializable, so it can travel in router navigation state. */
export interface ImportPreview {
  filename: string;
  sourceLabel: string;
  chordPro: string;
  metadata: ImportPreviewMetadata;
}

export interface BulkImportItem {
  filename: string;
  status: "pending" | "processing" | "success" | "error";
  songId?: string;
  songTitle?: string;
  message?: string;
}

export function fileExtension(filename: string) {
  return filename.split(".").pop()?.toLowerCase() || "";
}

export function isSupportedImportFile(filename: string) {
  return (SUPPORTED_EXTENSIONS as readonly string[]).includes(fileExtension(filename));
}

export async function readFileText(file: File): Promise<string> {
  if (typeof file.text === "function") return file.text();
  return new Promise<string>((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(String(reader.result || ""));
    reader.onerror = () => reject(reader.error || new Error("Failed to read file"));
    reader.readAsText(file);
  });
}

function chordProMetadata(chordPro: string, filename: string): ImportPreviewMetadata {
  const parsed = parseChordPro(chordPro);
  const tempoRaw = parsed.directives.tempo || "";
  return {
    title: parsed.directives.title || parsed.directives.t || filename.replace(/\.(cho|chordpro|chopro)$/i, "") || "Untitled",
    artist: parsed.directives.artist || parsed.directives.a || null,
    key: parsed.directives.key || parsed.directives.k || null,
    tempo: /^\d+$/.test(tempoRaw) ? Number(tempoRaw) : null,
    year: parsed.directives.year || null,
  };
}

const UNSUPPORTED = () => new Error(`Unsupported file format. Use ${IMPORT_FORMATS_LABEL}`);

/** Convert one file to ChordPro without saving anything. */
export async function previewImportFile(file: File): Promise<ImportPreview> {
  const extension = fileExtension(file.name);

  if (extension === "cho" || extension === "chordpro" || extension === "chopro") {
    const text = await readFileText(file);
    return { filename: file.name, sourceLabel: "ChordPro", chordPro: text, metadata: chordProMetadata(text, file.name) };
  }

  if (extension === "pdf") {
    const preview = await songsApi.previewImportPdf(file);
    return { filename: file.name, sourceLabel: "PDF", chordPro: preview.chordPro, metadata: preview.metadata ?? {} };
  }

  if (extension === "onsong" || extension === "xml") {
    const text = await readFileText(file);
    const preview = await songsApi.previewImportOnSong({ filename: file.name, content: text });
    return {
      filename: file.name,
      sourceLabel: extension === "xml" ? "OpenSong XML" : "OnSong",
      chordPro: preview.chordPro,
      metadata: preview.metadata ?? {},
    };
  }

  if (extension === "chrd" || extension === "txt") {
    const text = await readFileText(file);
    const preview = await songsApi.previewImportChrd({ filename: file.name, content: text });
    return {
      filename: file.name,
      sourceLabel: extension === "txt" ? "Plain text" : ".chrd",
      chordPro: preview.chordPro,
      metadata: preview.metadata ?? {},
    };
  }

  throw UNSUPPORTED();
}

/** Import one file straight into the library. */
export async function importFileAsSong(file: File): Promise<{ songId: string; songTitle: string }> {
  const extension = fileExtension(file.name);

  if (extension === "pdf") {
    const res = await songsApi.importPdf(file);
    return { songId: res.song.id, songTitle: res.song.title || file.name };
  }

  const text = await readFileText(file);
  if (!text.trim()) throw new Error("File is empty");

  if (extension === "cho" || extension === "chordpro" || extension === "chopro") {
    const metadata = chordProMetadata(text, file.name);
    const res = await songsApi.create({
      title: metadata.title || "Untitled",
      artist: metadata.artist || undefined,
      key: metadata.key || undefined,
      tempo: metadata.tempo || undefined,
      year: metadata.year || undefined,
      content: text,
    });
    return { songId: res.song.id, songTitle: res.song.title || file.name };
  }

  if (extension === "onsong" || extension === "xml") {
    const res = await songsApi.importOnSong({ filename: file.name, content: text });
    return { songId: res.song.id, songTitle: res.song.title || file.name };
  }

  if (extension === "chrd" || extension === "txt") {
    const res = await songsApi.importChrd({ filename: file.name, content: text });
    return { songId: res.song.id, songTitle: res.song.title || file.name };
  }

  throw UNSUPPORTED();
}

/** Import several files one after another, reporting progress after each. */
export async function bulkImport(
  files: File[],
  onProgress?: (items: BulkImportItem[], completed: number, currentFile: string) => void,
): Promise<{ items: BulkImportItem[]; successCount: number }> {
  let items: BulkImportItem[] = files.map((file) => ({ filename: file.name, status: "pending" }));
  let completed = 0;
  let successCount = 0;
  const update = (filename: string, patch: Partial<BulkImportItem>, currentFile: string) => {
    items = items.map((item) => (item.filename === filename ? { ...item, ...patch } : item));
    onProgress?.(items, completed, currentFile);
  };

  for (const file of files) {
    update(file.name, { status: "processing", message: undefined }, file.name);
    try {
      const result = await importFileAsSong(file);
      successCount += 1;
      completed += 1;
      update(file.name, { status: "success", songId: result.songId, songTitle: result.songTitle, message: "Imported" }, "");
    } catch (error) {
      completed += 1;
      update(file.name, { status: "error", message: error instanceof Error ? error.message : "Import failed" }, "");
    }
  }

  return { items, successCount };
}
