/** Type declarations for @vpc-music/shared (plain JS package) */
declare module "@vpc-music/shared" {
  // ── Music Constants ────────────────────────────
  export const CHROMATIC_SHARP: string[];
  export const CHROMATIC_FLAT: string[];
  export const ALL_KEYS: string[];
  export const NASHVILLE_NUMBERS: string[];
  export const CHORD_REGEX: RegExp;
  export const SECTION_KEYWORDS: string[];
  export const PRESET_TAGS: string[];

  // ── Roles ──────────────────────────────────────
  export const ROLES: Record<string, string>;
  export const ROLE_LABELS: Record<string, string>;
  export const ROLE_DESCRIPTIONS: Record<string, string>;
  export function roleLabel(role: string): string;

  // ── Permissions ────────────────────────────────
  export interface PermissionDefinition {
    id: string;
    label: string;
    description: string;
  }
  export interface PermissionCategory {
    key: string;
    label: string;
    permissions: PermissionDefinition[];
  }
  export const PERMISSION_CATEGORIES: PermissionCategory[];
  export const ALL_PERMISSIONS: string[];
  export const ROLE_PERMISSION_DEFAULTS: Record<string, string[]>;
  export function hasPermission(
    customPermissions: string[] | null | undefined,
    baseRole: string,
    permission: string,
  ): boolean;

  // ── Song Schema (Zod) ─────────────────────────
  export const songSchema: any;
  export const songVariationSchema: any;

  // ── ChordPro Parser ────────────────────────────
  export interface ChordPosition {
    chord: string;
    position: number;
  }

  export interface ChordProLine {
    chords: ChordPosition[];
    lyrics: string;
  }

  export interface ChordProSection {
    name: string;
    lines: ChordProLine[];
  }

  export interface ChordProDocument {
    directives: Record<string, string>;
    sections: ChordProSection[];
  }

  export interface LegacyChrdMetadata {
    title: string;
    artist: string | null;
    key: string | null;
    tempo: number | null;
    year: string | null;
    isDraft: boolean;
  }

  export interface LegacyChrdConversionResult {
    title: string;
    chordProContent: string;
    metadata: LegacyChrdMetadata;
    warnings: string[];
  }

  export function parseChordPro(input: string): ChordProDocument;
  export function toChordProString(doc: ChordProDocument): string;
  export function convertChrdToChordPro(filename: string, input: string): LegacyChrdConversionResult;

  // ── Structured chart AST (lossless) ────────────
  export interface BarToken {
    type: "chord" | "text";
    value: string;
  }
  export interface BarRow {
    measures: BarToken[][];
  }
  export type ChartLinePart =
    | { type: "text"; text: string }
    | { type: "token"; value: string; isChord: boolean };
  export type ChartLine = { raw: string } & (
    | { type: "blank" }
    | { type: "comment"; text: string }
    | { type: "directive"; key: string; value: string }
    | { type: "section"; name: string }
    | { type: "bars"; measures: BarToken[][] }
    | { type: "lyric"; parts: ChartLinePart[] }
  );
  export interface Chart {
    lines: ChartLine[];
  }
  export function parseBarLine(line: string): BarRow | null;
  export function parseChart(text: string): Chart;
  export function chartToText(chart: Chart): string;
  export function transposeChart(chart: Chart, steps: number, preferFlats?: boolean): Chart;

  // ── Transpose ──────────────────────────────────
  export function transposeChord(chord: string, semitones: number, preferFlats?: boolean): string;
  export function transposeChordPro(input: string, semitones: number, preferFlats?: boolean): string;
  export function isChordToken(token: string): boolean;
  export function isSectionToken(token: string): boolean;
  export function interval(fromKey: string, toKey: string): number;
  export function keyPrefersFlats(key: string): boolean;
  export function transposeKeyName(key: string, semitones: number, preferFlats?: boolean): string;

  // ── chords: consolidated chord + chart API (namespaced facade) ──
  export interface ParsedChord {
    root: string;
    quality: string;
    bass?: string;
    raw: string;
  }
  export interface ChartWithDirectives extends Chart {
    directives: Record<string, string>;
  }
  export const chords: {
    interval(fromKey: string, toKey: string): number;
    preferFlats(key: string): boolean;
    parseChord(chord: string): ParsedChord | null;
    transposeChord(chord: string | ParsedChord, semitones: number, preferFlats?: boolean): string;
    parseChart(text: string): ChartWithDirectives;
    transposeChart(chart: Chart, semitones: number, preferFlats?: boolean): ChartWithDirectives;
    toText(chart: Chart): string;
  };

  // ── Set flow analysis ──────────────────────────
  export const DEFAULT_GAP_SECONDS: number;
  export interface FlowItem {
    songId?: string | null;
    title?: string;
    key?: string | null;
    bpm?: number | null;
    energy?: number | null;
    durationSeconds?: number | null;
    talkSeconds?: number | null;
    status?: string | null;
  }
  export interface FlowTransition {
    fromIndex: number;
    toIndex: number;
    fromKey: string | null;
    toKey: string | null;
    distance: number | null;
    quality: "smooth" | "ok" | "notable" | "harsh" | "unknown";
  }
  export interface FlowSignal {
    type: string;
    severity: "warn" | "info";
    index?: number;
    message: string;
  }
  export interface FlowResult {
    curve: (number | null)[];
    keys: (string | null)[];
    transitions: FlowTransition[];
    timing: {
      musicSeconds: number;
      gapSeconds: number;
      totalSeconds: number;
      targetSeconds: number | null;
      overBySeconds: number | null;
      underBySeconds: number | null;
    };
    signals: FlowSignal[];
  }
  export function keyPitchClass(key: string | null | undefined): { pitch: number; minor: boolean } | null;
  export function circlePosition(key: string | null | undefined): number | null;
  export function circleDistance(fromKey: string | null | undefined, toKey: string | null | undefined): number | null;
  export function transitionQuality(fromKey: string | null | undefined, toKey: string | null | undefined): FlowTransition["quality"];
  export function songEnergy(item: { bpm?: number | null; energy?: number | null }): number | null;
  export function analyze(
    items: FlowItem[],
    options?: { targetSeconds?: number | null; recentlyPlayed?: string[]; gapSeconds?: number },
  ): FlowResult;

  // ── flow: consolidated set-flow API (namespaced facade) ──
  export interface KeyTransitionGrade {
    grade: "same" | "smooth" | "ok" | "notable" | "harsh" | "unknown";
    note?: string;
  }
  export interface SetFlowItem {
    song_id?: string | number | null;
    songId?: string | number | null;
    title?: string;
    song_key?: string | null;
    key?: string | null;
    bpm?: number | null;
    energy?: number | null;
    duration_seconds?: number | null;
    durationSeconds?: number | null;
    talk_seconds?: number | null;
    talkSeconds?: number | null;
    status?: string | null;
  }
  export interface SetFlowTransition {
    fromIndex: number;
    toIndex: number;
    from: string | null;
    to: string | null;
    grade: KeyTransitionGrade["grade"];
    note?: string;
  }
  export interface SetFlowResult extends Omit<FlowResult, "transitions"> {
    transitions: SetFlowTransition[];
  }
  export const flow: {
    analyze(
      items: SetFlowItem[],
      options?: { targetSeconds?: number | null; recentlyPlayed?: (string | number)[]; gapSeconds?: number },
    ): SetFlowResult;
    keyTransition(fromKey: string, toKey: string): KeyTransitionGrade;
    fmt(seconds: number): string;
  };

  // ── Nashville Number System ────────────────────
  export function chordToNashville(chord: string, key: string): string;
  export function nashvilleChordPro(input: string, key: string): string;

  // ── OnSong Converter ──────────────────────────
  export function chordProToOnSong(input: string): string;
  export function onSongToChordPro(input: string): string;

  // ── Plain Text Export ─────────────────────────
  export function chordProToPlainText(input: string, options?: { lyricsOnly?: boolean }): string;
}
