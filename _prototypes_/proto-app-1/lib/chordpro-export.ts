'use client'

/**
 * ChordPro Export Service
 * Converts app song format to standard ChordPro format
 * Compatible with: OnSong, BandHelper, SongBook, ChordPro, and other readers
 */

interface Song {
  id: string
  key: string
  title: string
  artist: string
  genre?: string
  bpm?: number
  description?: string
  intro?: string
  introKey?: string
  instruments?: string[]
  sections?: {
    label: string
    lines: { chords?: string; lyrics: string }[]
  }[]
}

interface ExportOptions {
  format: 'chordpro' | 'text'
  includeMetadata: boolean
  includeInstructions: boolean
  transposedBy?: number
}

/**
 * Formats a chord line for ChordPro format
 * Handles chord-above-lyrics positioning
 */
function formatChordLine(chords: string, lyrics: string): string {
  if (!chords || !chords.trim()) {
    return lyrics
  }

  const chordArray = chords.split(/\s+/)
  const lyricWords = lyrics.split(/(\s+)/)
  let result = ''
  let chordIdx = 0

  for (let i = 0; i < lyricWords.length; i++) {
    const word = lyricWords[i]

    if (chordIdx < chordArray.length && word && word.trim()) {
      const chord = chordArray[chordIdx]
      result += `[${chord}]${word}`
      chordIdx++
    } else {
      result += word
    }
  }

  // Add remaining chords
  while (chordIdx < chordArray.length) {
    result += ` [${chordArray[chordIdx]}]`
    chordIdx++
  }

  return result
}

/**
 * Converts app song format to ChordPro format
 * ChordPro format: https://www.chordpro.org/
 */
export function convertToChordPro(song: Song, options: ExportOptions = { format: 'chordpro', includeMetadata: true, includeInstructions: true }): string {
  const lines: string[] = []

  // Add metadata directives
  if (options.includeMetadata) {
    lines.push(`{title: ${song.title}}`)
    lines.push(`{artist: ${song.artist}}`)

    if (song.key) {
      lines.push(`{key: ${song.key}}`)
    }

    if (song.bpm) {
      lines.push(`{tempo: ${song.bpm}}`)
    }

    if (song.genre) {
      lines.push(`{meta: genre ${song.genre}}`)
    }

    if (song.instruments && song.instruments.length > 0) {
      lines.push(`{meta: instruments ${song.instruments.join(', ')}}`)
    }

    if (song.description) {
      // Replace newlines for inline comment
      const desc = song.description.replace(/\n/g, ' ')
      lines.push(`{comment: ${desc}}`)
    }

    lines.push('') // Blank line for readability
  }

  // Add intro/setup instructions
  if (options.includeInstructions) {
    if (song.intro) {
      lines.push(`{comment: Intro: ${song.intro}}`)
    }

    if (song.introKey) {
      lines.push(`{comment: Intro Key: ${song.introKey}}`)
    }

    if (song.intro || song.introKey) {
      lines.push('')
    }
  }

  // Add song sections
  if (song.sections && song.sections.length > 0) {
    for (const section of song.sections) {
      // Section label
      lines.push(`{start_of_section: ${section.label}}`)

      // Section content
      for (const line of section.lines) {
        if (line.chords) {
          // Format chord+lyrics line
          lines.push(formatChordLine(line.chords, line.lyrics))
        } else {
          // Lyrics only
          lines.push(line.lyrics)
        }
      }

      lines.push(`{end_of_section}`)
      lines.push('')
    }
  }

  return lines.join('\n')
}

/**
 * Converts app song format to plain text format
 * Useful for quick sharing or simple viewers
 */
export function convertToPlainText(song: Song): string {
  const lines: string[] = []

  // Header
  lines.push(`${song.title}`)
  lines.push(`by ${song.artist}`)

  if (song.key || song.bpm) {
    let keyBpmLine = ''
    if (song.key) keyBpmLine += `Key: ${song.key}`
    if (song.bpm) keyBpmLine += (keyBpmLine ? ` | ` : '') + `BPM: ${song.bpm}`
    lines.push(keyBpmLine)
  }

  if (song.genre) {
    lines.push(`Genre: ${song.genre}`)
  }

  lines.push('') // Separator

  // Description
  if (song.description) {
    lines.push(song.description)
    lines.push('')
  }

  // Instruments
  if (song.instruments && song.instruments.length > 0) {
    lines.push(`Instruments: ${song.instruments.join(', ')}`)
    lines.push('')
  }

  // Intro instructions
  if (song.intro) {
    lines.push(`Intro: ${song.intro}`)
  }

  if (song.introKey) {
    lines.push(`Intro Key: ${song.introKey}`)
  }

  if (song.intro || song.introKey) {
    lines.push('') // Separator
  }

  // Sections
  if (song.sections && song.sections.length > 0) {
    for (const section of song.sections) {
      lines.push(`[${section.label}]`)

      for (const line of section.lines) {
        if (line.chords) {
          // Display chords on separate line for clarity
          lines.push(`  ${line.chords}`)
          lines.push(`  ${line.lyrics}`)
        } else {
          lines.push(`  ${line.lyrics}`)
        }
      }

      lines.push('') // Blank line between sections
    }
  }

  return lines.join('\n')
}

/**
 * Generates a downloadable file blob for the song
 */
export function generateChordProFile(song: Song, options?: ExportOptions): Blob {
  const content = convertToChordPro(song, options)
  return new Blob([content], { type: 'text/plain;charset=utf-8' })
}

/**
 * Generates a downloadable text file blob for the song
 */
export function generateTextFile(song: Song): Blob {
  const content = convertToPlainText(song)
  return new Blob([content], { type: 'text/plain;charset=utf-8' })
}

/**
 * Triggers browser download of file
 */
export function downloadFile(blob: Blob, filename: string): void {
  const url = URL.createObjectURL(blob)
  const link = document.createElement('a')
  link.href = url
  link.download = filename
  document.body.appendChild(link)
  link.click()
  document.body.removeChild(link)
  URL.revokeObjectURL(url)
}

/**
 * Export song to clipboard in ChordPro format
 */
export async function copyToClipboard(song: Song, options?: ExportOptions): Promise<void> {
  const content = convertToChordPro(song, options)
  try {
    await navigator.clipboard.writeText(content)
  } catch (err) {
    console.error('Failed to copy to clipboard:', err)
    throw new Error('Failed to copy to clipboard')
  }
}

/**
 * Generate email-shareable ChordPro content
 */
export function generateEmailContent(song: Song): { subject: string; body: string } {
  const content = convertToChordPro(song)

  return {
    subject: `Song: ${song.title} by ${song.artist}`,
    body: `Here's a ChordPro file for "${song.title}" by ${song.artist}:\n\n${content}`,
  }
}

/**
 * Generate share URL-encoded string for messaging apps
 */
export function generateShareUrl(song: Song): string {
  const content = convertToChordPro(song)
  return encodeURIComponent(content)
}

/**
 * Validate ChordPro format output
 */
export function validateChordProFormat(content: string): boolean {
  // Check for required metadata
  const hasMeta = /\{title:/.test(content) || /\{artist:/.test(content)

  // Check for either chords or lyrics
  const hasContent = /\[.+?\]/.test(content) || /\w+/.test(content)

  return hasMeta || hasContent
}

/**
 * Get file size estimate for ChordPro export
 */
export function estimateFileSize(song: Song): number {
  const content = convertToChordPro(song)
  return new Blob([content]).size
}

/**
 * Generate filename with sanitization
 */
export function generateFilename(song: Song, format: 'chordpro' | 'txt' = 'chordpro'): string {
  const sanitized = `${song.title}-${song.artist}`.replace(/[^a-zA-Z0-9-_]/g, '_').slice(0, 100)
  const ext = format === 'chordpro' ? 'chordpro' : 'txt'
  return `${sanitized}.${ext}`
}
