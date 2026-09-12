/**
 * Classify a media file into a normalised part, and build its object-store key.
 *
 * The source trees name the same concepts a dozen ways —
 *   "Power In The Name - Alto.m4a", "Hes-In-The-Room - Alto.mp3",
 *   "My-Help-loop-bpm77.mp3", "Hallowed Be Your Name (Loop) 67.5 BPM.wav"
 * — so normalising on the way in is most of what makes the store browsable.
 *
 * Node-only and dependency-free, but deliberately NOT in shared/: the web app
 * never needs it, and shared/ costs a sync + a hand-maintained .d.ts entry.
 */
import { basename, extname } from "node:path";

/** Vocal parts, in the order a musician would list them. */
export const VOCAL_PARTS = ["soprano", "alto", "tenor", "baritone", "bass"];

/**
 * Beats per minute encoded in a filename, or null.
 * Handles "80BPM", "bpm77", "67.5 BPM", "(141.5bpm)", "- 76 BPM ".
 * Requires the literal "bpm" so track numbers ("01-Glory") never match.
 */
export function extractBpm(filename) {
  const name = String(filename);
  const m =
    name.match(/(\d{2,3}(?:\.\d+)?)\s*bpm/i) || name.match(/bpm[\s_-]*(\d{2,3}(?:\.\d+)?)/i);
  if (!m) return null;
  const value = Number.parseFloat(m[1]);
  // Below 30 or above 300 it is not a tempo — almost certainly a track or year.
  if (!Number.isFinite(value) || value < 30 || value > 300) return null;
  return value;
}

/**
 * Normalised audio part.
 * @returns {{ part: string, bpm: number|null, instrument: string|null }}
 */
export function classifyAudioPart(filePath) {
  const name = basename(String(filePath));
  const stem = name.slice(0, name.length - extname(name).length);
  const flat = stem.toLowerCase();
  const bpm = extractBpm(name);
  const inStemsFolder = /[\\/]?[\w-]*stems?[\\/]/i.test(String(filePath));

  for (const part of VOCAL_PARTS) {
    // Word-boundary so "bass" does not match "bassoon" and "alto" not "altogether".
    if (new RegExp(`(^|[^a-z])${part}([^a-z]|$)`, "i").test(flat)) {
      return { part, bpm, instrument: null };
    }
  }

  if (/\bclick\b/i.test(flat)) return { part: "click", bpm, instrument: null };
  if (/\bloop\b/i.test(flat)) {
    const drum = /\bdrums?\b/i.test(flat);
    return { part: drum ? "drum-loop" : "loop", bpm, instrument: null };
  }
  if (inStemsFolder) {
    return { part: "stem", bpm, instrument: slug(stem) || null };
  }
  if (/\binstrumental\b/i.test(flat)) return { part: "instrumental", bpm, instrument: null };
  if (/\b(vocals?|vox)\b/i.test(flat)) return { part: "vocals", bpm, instrument: null };

  return { part: "full-mix", bpm, instrument: null };
}

/**
 * UPCI PDFs encode their part in the filename. Only chord and number charts
 * carry an extractable text layer; the rest are engraved notation.
 */
export function classifyPdfPart(filePath) {
  // Strip every non-alphanumeric so "Way Maker - Chord Chart",
  // "Way-Maker-Chord-Chart" and "WayMakerChordChart" all read the same.
  const n = basename(String(filePath)).toLowerCase().replace(/[^a-z0-9]/g, "");
  if (n.includes("numberchart") || n.includes("numberschart")) return "number-chart";
  if (n.includes("chordchart")) return "chord-chart";
  if (n.includes("rhythmchart") || n.includes("rhythm")) return "rhythm-chart";
  if (n.includes("vocalswithchords")) return "vocals-with-chords";
  if (n.includes("erv") || n.includes("easyreadvocal")) return "erv";
  if (n.includes("vocal")) return "vocals";
  if (n.includes("lyric")) return "lyrics";
  return "other";
}

/**
 * True when a PDF part type is engraved notation with no text layer.
 * Measured: rhythm charts and vocals embed Sibelius music fonts and contain
 * zero text-show operators, so they can never become songs.
 */
export function isNotationOnly(pdfPart) {
  return pdfPart === "rhythm-chart" || pdfPart === "vocals" || pdfPart === "vocals-with-chords";
}

function slug(value) {
  return String(value || "")
    .normalize("NFKD")
    .replace(/[̀-ͯ]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
}

/**
 * Object-store key for one media file.
 *
 * Song-attached media mirrors the corpus naming exactly, so one identity
 * threads the chart file, the database row and the object store:
 *   <root>/media/songs/<slug>--<id8>/audio/alto.m4a
 *   <root>/media/songs/<slug>--<id8>/charts/chord-chart.pdf
 *
 * Files we cannot attach to a song stay visible rather than being dropped:
 *   <root>/media/songs/<slug>/...            (no chart yet)
 *   <root>/media/library/<original path>      (not song-specific)
 *   <root>/media/unmatched/<original path>    (no song recognised)
 *
 * @param {{ rootPath?: string, songSlug?: string, songId?: string,
 *           kind: "audio"|"charts"|"source", part?: string,
 *           instrument?: string|null, bpm?: number|null,
 *           ext: string, originalPath?: string }} spec
 */
export function mediaKey(spec) {
  const root = (spec.rootPath || "").replace(/^\/+|\/+$/g, "");
  const prefix = root ? `${root}/media` : "media";
  const ext = spec.ext.startsWith(".") ? spec.ext.toLowerCase() : `.${spec.ext.toLowerCase()}`;

  // Material that belongs to no particular song (chorusbooks, lessons,
  // policies) keeps its original shape under library/.
  if (spec.kind === "library") {
    const original = String(spec.originalPath || "").replace(/^\/+/, "");
    return `${prefix}/library/${original}`;
  }

  // No recognisable song at all — visible, never dropped.
  if (!spec.songSlug) {
    const original = String(spec.originalPath || "").replace(/^\/+/, "");
    return `${prefix}/unmatched/${original}`;
  }

  // Most source songs have no chart in the corpus yet, so the id is optional:
  // the folder is still keyed by song, and gains its id once a chart exists.
  const folder = spec.songId
    ? `${spec.songSlug}--${String(spec.songId).slice(0, 8)}`
    : spec.songSlug;

  if (spec.kind === "source") {
    return `${prefix}/songs/${folder}/source/${basename(String(spec.originalPath || ""))}`;
  }

  let leaf = spec.part || "file";
  if (spec.part === "stem" && spec.instrument) leaf = `stem-${spec.instrument}`;
  // A song can carry several loops at different tempos; keep them distinct.
  if ((spec.part === "loop" || spec.part === "drum-loop") && spec.bpm) {
    leaf = `${spec.part}-${String(spec.bpm).replace(/\.0$/, "")}bpm`;
  }
  return `${prefix}/songs/${folder}/${spec.kind}/${leaf}${ext}`;
}
