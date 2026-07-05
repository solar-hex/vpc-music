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

  // ── Transpose ──────────────────────────────────
  export function transposeChord(chord: string, semitones: number): string;
  export function transposeChordPro(input: string, semitones: number): string;

  // ── Nashville Number System ────────────────────
  export function chordToNashville(chord: string, key: string): string;
  export function nashvilleChordPro(input: string, key: string): string;

  // ── OnSong Converter ──────────────────────────
  export function chordProToOnSong(input: string): string;
  export function onSongToChordPro(input: string): string;

  // ── Plain Text Export ─────────────────────────
  export function chordProToPlainText(input: string, options?: { lyricsOnly?: boolean }): string;
}
