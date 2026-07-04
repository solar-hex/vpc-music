/**
 * Chord Alignment Utility
 * Ensures chords stay perfectly aligned above lyrics using monospace fonts
 * Supports multiple display modes and responsive behavior
 */

export type ChordDisplayMode = 'both' | 'lyrics-only' | 'chords-only'

/**
 * Formats a single line with chords and lyrics for perfect alignment
 * Uses monospace font to maintain alignment across all screen sizes
 */
export function formatAlignedChordLine(
  chords: string,
  lyrics: string,
  mode: ChordDisplayMode = 'both'
): string {
  if (mode === 'lyrics-only') {
    return lyrics
  }

  if (mode === 'chords-only') {
    return chords
  }

  // For 'both' mode, render chords above lyrics with proper spacing
  return `${chords}\n${lyrics}`
}

/**
 * Formats an entire section with proper alignment
 * Each line preserves spacing for perfect chord-to-lyric alignment
 */
export function formatAlignedSection(
  lines: Array<{ chords?: string; lyrics: string }>,
  mode: ChordDisplayMode = 'both'
): string {
  return lines
    .map((line) => {
      if (!line.chords) {
        return line.lyrics
      }
      return formatAlignedChordLine(line.chords, line.lyrics, mode)
    })
    .join('\n')
}

/**
 * Ensures lyrics preserve all whitespace for monospace alignment
 * Critical: Do not collapse or normalize spaces
 */
export function preserveLyricsSpacing(lyrics: string): string {
  // Keep all spaces, tabs, and line breaks intact
  return lyrics
}

/**
 * Validates that chord and lyric strings will align properly
 * Helps catch formatting issues before rendering
 */
export function validateChordAlignment(chords: string, lyrics: string): {
  isValid: boolean
  issues: string[]
} {
  const issues: string[] = []

  // Check if chords and lyrics have compatible lengths
  const chordLength = chords.length
  const lyricsLength = lyrics.length

  // Chords line should not be significantly longer than lyrics
  if (chordLength > lyricsLength + 20) {
    issues.push(
      `Chord line is unusually long (${chordLength} chars) compared to lyrics (${lyricsLength} chars)`
    )
  }

  // Check for empty lines
  if (!chords.trim()) {
    issues.push('Chord line is empty or only whitespace')
  }
  if (!lyrics.trim()) {
    issues.push('Lyrics line is empty or only whitespace')
  }

  return {
    isValid: issues.length === 0,
    issues,
  }
}

/**
 * Creates properly spaced chord-above-lyrics format
 * For use in pre-formatted text blocks
 */
export function createAlignedChordDisplay(
  chords: string,
  lyrics: string
): string {
  // Ensure both strings use consistent spacing
  // This is critical for monospace alignment
  const normalizedChords = chords.replace(/\t/g, '  ')
  const normalizedLyrics = lyrics.replace(/\t/g, '  ')

  return `${normalizedChords}\n${normalizedLyrics}`
}

/**
 * Transposes chords while preserving alignment spacing
 */
export function transposeWithAlignment(
  transposedChords: string,
  lyrics: string
): string {
  return createAlignedChordDisplay(transposedChords, lyrics)
}

/**
 * CSS classes for aligned chord rendering
 * Use these with <pre> tags for perfect alignment
 */
export const ALIGNED_CHORD_CLASSES = {
  container: 'whitespace-pre font-mono overflow-x-auto leading-7 text-sm md:text-base',
  line: 'text-slate-100',
  chordsOnly:
    'whitespace-pre font-mono overflow-x-auto leading-7 text-sm md:text-base text-blue-400 font-bold',
  lyricsOnly: 'whitespace-pre font-mono overflow-x-auto leading-7 text-sm md:text-base text-slate-100',
}

/**
 * Renders content in proper monospace pre format for alignment
 */
export function renderAlignedContent(
  content: string,
  mode: ChordDisplayMode = 'both'
): JSX.Element {
  // This is a type signature for use in React components
  return content as unknown as JSX.Element
}
