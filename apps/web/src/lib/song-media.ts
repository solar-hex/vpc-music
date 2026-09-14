/**
 * Reads a song's media out of its ChordPro directives and turns directive keys
 * into things a singer can tap.
 *
 * Songs carry media as custom directives: `{x_audio_soprano: …}`,
 * `{x_chart_chord_chart: …}`. The server addresses a file by that directive KEY
 * and never classifies anything, so all of the work below exists only to draw
 * buttons — which is why it lives in the web app rather than in `shared/`
 * (see the same reasoning in `apps/api/src/corpus/mediaParts.js`).
 *
 * The corpus keys are messy, because a dedupe merged folders from differently
 * named uploads. Real examples this has to read: `soprano`, `full_mix`,
 * `loop_144_5bpm` (a decimal point flattened to `_`), `drum_loop_150bpm`,
 * `thank_you_the_cross_loop_48_bpm`, `jesus_geoffery_golden_alto`,
 * `speak_the_name_soprano_100`.
 */

export type AudioPartId =
  | "soprano"
  | "alto"
  | "tenor"
  | "baritone"
  | "bass"
  | "full-mix"
  | "instrumental"
  | "stem"
  | "loop"
  | "drum-loop"
  | "click"
  | "other";

export type ChartPartId = "chord-chart" | "number-chart" | "rhythm-chart" | "vocals-with-chords" | "vocals" | "erv" | "other";

export interface SongAudioTrack {
  /** The directive key — the path segment the media route resolves. */
  directive: string;
  part: AudioPartId;
  label: string;
  bpm: number | null;
  /** A second or later file claiming the same part. */
  alternate: boolean;
}

/** An instrument stem's name from its key: `x_audio_stem_lead_vocal` → "Lead vocal". */
function stemName(directiveKey: string): string {
  const name = directiveKey.replace(/^x_audio_stem_/, "").replace(/_/g, " ").trim();
  return name ? name.charAt(0).toUpperCase() + name.slice(1) : "Stem";
}

export interface SongChartDoc {
  directive: string;
  part: ChartPartId;
  label: string;
}

export interface SongMedia {
  audio: SongAudioTrack[];
  charts: SongChartDoc[];
  /** `{x_dropbox: …}` — the shared folder the originals came from. */
  dropboxUrl: string | null;
}

/** A singer's order: voices high to low, then the whole song, then practice aids. */
const AUDIO_ORDER: AudioPartId[] = ["soprano", "alto", "tenor", "baritone", "bass", "full-mix", "instrumental", "stem", "loop", "drum-loop", "click", "other"];

const AUDIO_LABELS: Record<AudioPartId, string> = {
  soprano: "Soprano",
  alto: "Alto",
  tenor: "Tenor",
  baritone: "Baritone",
  bass: "Bass",
  "full-mix": "Full mix",
  instrumental: "Instrumental",
  stem: "Stem",
  loop: "Loop",
  "drum-loop": "Drums",
  click: "Click",
  // A recording we could not place. Named for what it is rather than "Extra",
  // which told a musician nothing.
  other: "Recording",
};

/** Chords first, because that is what a musician reaches for. */
const CHART_ORDER: ChartPartId[] = ["chord-chart", "number-chart", "rhythm-chart", "vocals-with-chords", "vocals", "erv", "other"];

const CHART_LABELS: Record<ChartPartId, string> = {
  "chord-chart": "Chord chart",
  "number-chart": "Number chart",
  "rhythm-chart": "Rhythm chart",
  "vocals-with-chords": "Vocals with chords",
  vocals: "Vocals",
  erv: "Easy-read vocals",
  other: "Other chart",
};

const VOICES = ["soprano", "alto", "tenor", "baritone", "bass"] as const;

function isUrl(value: unknown): value is string {
  return typeof value === "string" && /^https?:\/\//i.test(value.trim());
}

/**
 * A tempo embedded in a loop's key, or null. Handles every spelling the corpus
 * holds: `loop_144_5bpm` (144.5), `loop_48bpm`, `loop_48_bpm`, `bpm77`,
 * `loop76bpm`. Kept to 30–300 BPM, the same gate the corpus uses when it reads
 * a tempo out of a filename, so a stray `_3_4` time signature is never a tempo.
 */
export function bpmFromKey(key: string): number | null {
  const m = key.match(/(\d{2,3})(?:_(\d))?_?bpm/) ?? key.match(/bpm_?(\d{2,3})(?:_(\d))?/);
  if (!m) return null;
  const value = Number(m[2] ? `${m[1]}.${m[2]}` : m[1]);
  return value >= 30 && value <= 300 ? value : null;
}

/**
 * Which part an audio directive is. The voice has to be the LAST word of the
 * key, bounded by underscores, so `jesus_soprano` is a soprano and a key
 * containing `altogether` is not an alto.
 */
export function audioPartOf(directiveKey: string): AudioPartId {
  let rest = directiveKey.replace(/^x_audio_/, "");
  // Trailing dedupe counters and time signatures: `…_soprano_100`, `…_alto_2`.
  rest = rest.replace(/(_\d+)+$/, "");

  const voiceAtEnd = (value: string) => {
    const match = value.match(new RegExp(`(?:^|_)(${VOICES.join("|")})$`));
    return (match?.[1] as AudioPartId | undefined) ?? null;
  };

  // Checked before voices, or `stem_lead_vocal` would never be a stem and
  // `stem_bass` would read as a bass singer.
  if (/^stem_/.test(rest)) return "stem";

  const voice = voiceAtEnd(rest);
  if (voice) return voice;

  if (/(^|_)drum_loop/.test(rest)) return "drum-loop";
  if (/(^|_)loop/.test(rest)) return "loop";
  if (/(^|_)full_mix($|_)/.test(rest)) return "full-mix";
  if (/(^|_)instrumental($|_)/.test(rest)) return "instrumental";
  if (/(^|_)click($|_)/.test(rest)) return "click";

  // One retry for a trailing key name: `we_want_you_alto_eb`.
  const withoutKey = rest.replace(/_[a-g](?:b|sharp)?$/, "");
  if (withoutKey !== rest) {
    const retried = voiceAtEnd(withoutKey);
    if (retried) return retried;
  }
  return "other";
}

export function chartPartOf(directiveKey: string): ChartPartId {
  const rest = directiveKey.replace(/^x_chart_/, "");
  if (/vocals_with_chords/.test(rest)) return "vocals-with-chords";
  if (/(^|_)chord_chart/.test(rest)) return "chord-chart";
  if (/(^|_)numbers?_chart/.test(rest)) return "number-chart";
  if (/(^|_)rhythm_chart/.test(rest)) return "rhythm-chart";
  if (/(^|_)erv($|_)/.test(rest)) return "erv";
  if (/(^|_)vocals($|_)/.test(rest)) return "vocals";
  return "other";
}

/**
 * When two files claim one part, the shorter key wins: it is the clean one the
 * dedupe merged into, and the song-name-prefixed ones came along with it.
 */
function byPrimary(a: string, b: string) {
  return a.length - b.length || a.localeCompare(b);
}

export function songMedia(directives: Record<string, string> | undefined | null): SongMedia {
  const entries = Object.entries(directives || {});

  const audioByPart = new Map<AudioPartId, string[]>();
  const chartByPart = new Map<ChartPartId, string[]>();

  for (const [key, value] of entries) {
    if (!isUrl(value)) continue;
    if (key.startsWith("x_audio_")) {
      const part = audioPartOf(key);
      audioByPart.set(part, [...(audioByPart.get(part) || []), key]);
    } else if (key.startsWith("x_chart_")) {
      const part = chartPartOf(key);
      chartByPart.set(part, [...(chartByPart.get(part) || []), key]);
    }
  }

  const audio: SongAudioTrack[] = [];
  for (const part of AUDIO_ORDER) {
    const keys = (audioByPart.get(part) || []).sort(byPrimary);
    // Loops and drum loops are distinguished by tempo, so order those by it.
    if (part === "loop" || part === "drum-loop") {
      keys.sort((a, b) => (bpmFromKey(a) ?? Infinity) - (bpmFromKey(b) ?? Infinity) || byPrimary(a, b));
    }
    keys.forEach((directive, index) => {
      const bpm = part === "loop" || part === "drum-loop" ? bpmFromKey(directive) : null;
      // Stems are told apart by instrument, loops by tempo, the rest by an ordinal.
      if (part === "stem") {
        audio.push({ directive, part, label: stemName(directive), bpm: null, alternate: false });
        return;
      }
      const base = AUDIO_LABELS[part];
      const tempo = bpm !== null ? ` ${bpm}` : "";
      const isTempoPart = part === "loop" || part === "drum-loop";
      const ordinal = !isTempoPart && index > 0 ? ` ${index + 1}` : "";
      audio.push({
        directive,
        part,
        label: `${base}${tempo}${ordinal}`,
        bpm,
        alternate: !isTempoPart && index > 0,
      });
    });
  }

  // Charts show one per kind. Extra copies are corpus duplication, not a
  // feature; one song carries fifteen, and the fix for that is in the corpus.
  const charts: SongChartDoc[] = [];
  for (const part of CHART_ORDER) {
    const keys = (chartByPart.get(part) || []).sort(byPrimary);
    if (keys.length === 0) continue;
    charts.push({ directive: keys[0], part, label: CHART_LABELS[part] });
  }

  const dropbox = directives?.x_dropbox;
  return { audio, charts, dropboxUrl: isUrl(dropbox) ? dropbox.trim() : null };
}
