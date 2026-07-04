/**
 * Advanced Setlist Helpers
 * Provides utilities for setlist management, key transposition, and worship flow calculations
 */

import type { Song, Setlist } from './use-setlist-storage'

// Musical Keys
const CHROMATIC_SCALE = ['C', 'C#', 'D', 'D#', 'E', 'F', 'F#', 'G', 'G#', 'A', 'A#', 'B']
const FLAT_SCALE = ['C', 'Db', 'D', 'Eb', 'E', 'F', 'Gb', 'G', 'Ab', 'A', 'Bb', 'B']

/**
 * Transpose a key by semitones
 * @param key - Original key (e.g., "C", "D", "F#")
 * @param semitones - Number of semitones to transpose (positive or negative)
 * @returns Transposed key
 */
export function transposeKey(key: string, semitones: number): string {
  const scale = key.includes('b') ? FLAT_SCALE : CHROMATIC_SCALE
  const index = scale.indexOf(key)
  if (index === -1) return key
  const newIndex = (index + semitones + 12 * 10) % 12
  return scale[newIndex]
}

/**
 * Calculate semitone difference between two keys
 * @param fromKey - Original key
 * @param toKey - Target key
 * @returns Number of semitones (positive = up, negative = down)
 */
export function calculateSemitones(fromKey: string, toKey: string): number {
  const scale = CHROMATIC_SCALE
  const fromIndex = scale.indexOf(fromKey.replace('b', '#'))
  const toIndex = scale.indexOf(toKey.replace('b', '#'))
  if (fromIndex === -1 || toIndex === -1) return 0
  let diff = toIndex - fromIndex
  if (diff > 6) diff -= 12
  if (diff < -6) diff += 12
  return diff
}

/**
 * Get capo position for a given transposition
 * @param semitones - Number of semitones to transpose
 * @returns Capo position (0 = no capo, 1-12 = fret number)
 */
export function getCapoPosition(semitones: number): number {
  return Math.abs(semitones % 12)
}

/**
 * Convert to Nashville number system
 * Converts standard notation to numerical notation based on the key
 * @param chords - Array of chord names
 * @param key - Song key
 * @returns Array of Nashville numbers
 */
export function convertToNashvilleNumbers(chords: string[], key: string): string[] {
  const scale = CHROMATIC_SCALE
  const keyIndex = scale.indexOf(key)
  if (keyIndex === -1) return chords

  const numberMap: { [key: string]: string } = {
    '0': '1',
    '2': '2',
    '4': '3',
    '5': '4',
    '7': '5',
    '9': '6',
    '11': '7',
  }

  return chords.map(chord => {
    const chordRoot = chord.charAt(0)
    const chordIndex = scale.indexOf(chordRoot)
    if (chordIndex === -1) return chord
    const relativeIndex = (chordIndex - keyIndex + 12) % 12
    const numberLabel = numberMap[relativeIndex] || chord
    const suffix = chord.slice(1)
    return numberLabel + suffix
  })
}

/**
 * Calculate total setlist duration
 * @param setlist - Setlist to calculate
 * @returns Total duration in seconds
 */
export function calculateSetlistDuration(setlist: Setlist): number {
  return setlist.songs.reduce((total, song) => total + (song.duration || 0), 0)
}

/**
 * Calculate average BPM
 * @param setlist - Setlist to calculate
 * @returns Average BPM
 */
export function calculateAverageBpm(setlist: Setlist): number {
  const songsWithBpm = setlist.songs.filter(s => s.bpm)
  if (songsWithBpm.length === 0) return 0
  const total = songsWithBpm.reduce((sum, song) => sum + (song.bpm || 0), 0)
  return Math.round(total / songsWithBpm.length)
}

/**
 * Get key range for setlist
 * @param setlist - Setlist to analyze
 * @returns String representing key range (e.g., "C to G")
 */
export function getKeyRange(setlist: Setlist): string {
  const keys = setlist.songs
    .map(s => s.keyOverride || s.originalKey)
    .filter((k, idx, arr) => arr.indexOf(k) === idx)
  
  if (keys.length === 0) return 'N/A'
  if (keys.length === 1) return keys[0]
  return `${keys[0]} to ${keys[keys.length - 1]}`
}

/**
 * Calculate flow score (0-100) based on key changes, BPM variations, and tags
 * Higher score = smoother worship flow
 * @param setlist - Setlist to analyze
 * @returns Flow score (0-100)
 */
export function calculateFlowScore(setlist: Setlist): number {
  let score = 100
  const songs = setlist.songs

  if (songs.length < 2) return score

  // Penalize for too many key changes
  let keyChanges = 0
  for (let i = 1; i < songs.length; i++) {
    const prevKey = songs[i - 1].keyOverride || songs[i - 1].originalKey
    const currKey = songs[i].keyOverride || songs[i].originalKey
    if (prevKey !== currKey) keyChanges++
  }
  score -= Math.min(keyChanges * 5, 20)

  // Penalize for drastic BPM changes (>20 BPM jump)
  for (let i = 1; i < songs.length; i++) {
    const prevBpm = songs[i - 1].bpm || 0
    const currBpm = songs[i].bpm || 0
    if (prevBpm && currBpm && Math.abs(prevBpm - currBpm) > 20) {
      score -= 10
    }
  }

  // Bonus for consistent tags/themes
  const tagCounts = new Map<string, number>()
  songs.forEach(song => {
    song.tags?.forEach(tag => {
      tagCounts.set(tag, (tagCounts.get(tag) || 0) + 1)
    })
  })
  const maxTagCount = Math.max(...Array.from(tagCounts.values()), 0)
  if (maxTagCount >= songs.length * 0.5) {
    score += 10
  }

  return Math.max(0, Math.min(100, score))
}

/**
 * Get instrument inventory for setlist
 * @param setlist - Setlist to analyze
 * @returns Map of instrument name to count
 */
export function getInstrumentInventory(setlist: Setlist): Map<string, number> {
  const inventory = new Map<string, number>()
  setlist.songs.forEach(song => {
    song.instruments?.forEach(instrument => {
      inventory.set(instrument, (inventory.get(instrument) || 0) + 1)
    })
  })
  return inventory
}

/**
 * Get vocalist assignments for setlist
 * @param setlist - Setlist to analyze
 * @returns Map of vocalist name to count
 */
export function getVocalistInventory(setlist: Setlist): Map<string, number> {
  const inventory = new Map<string, number>()
  setlist.songs.forEach(song => {
    if (song.vocalLead) {
      inventory.set(song.vocalLead, (inventory.get(song.vocalLead) || 0) + 1)
    }
    song.harmonies?.forEach(vocalist => {
      inventory.set(vocalist, (inventory.get(vocalist) || 0) + 1)
    })
  })
  return inventory
}

/**
 * Calculate rehearsal completion percentage
 * @param setlist - Setlist to analyze
 * @returns Percentage of songs in READY status (0-100)
 */
export function getRehearsalCompletionPercentage(setlist: Setlist): number {
  if (setlist.songs.length === 0) return 0
  const readySongs = setlist.songs.filter(s => s.status === 'READY').length
  return Math.round((readySongs / setlist.songs.length) * 100)
}

/**
 * Get all missing elements for setlist
 * @param setlist - Setlist to analyze
 * @returns Object with arrays of missing items
 */
export function getMissingElements(
  setlist: Setlist
): {
  missingChords: Song[]
  missingVocalists: Song[]
  missingInstruments: Song[]
  needsReview: Song[]
} {
  return {
    missingChords: setlist.songs.filter(s => s.status === 'MISSING_CHORDS'),
    missingVocalists: setlist.songs.filter(s => !s.vocalLead),
    missingInstruments: setlist.songs.filter(s => !s.instruments || s.instruments.length === 0),
    needsReview: setlist.songs.filter(s => s.status === 'NEEDS_REVIEW'),
  }
}

/**
 * Format duration in MM:SS format
 * @param seconds - Duration in seconds
 * @returns Formatted string (e.g., "3:45")
 */
export function formatDuration(seconds: number): string {
  const mins = Math.floor(seconds / 60)
  const secs = seconds % 60
  return `${mins}:${secs.toString().padStart(2, '0')}`
}

/**
 * Format total duration as HH:MM:SS
 * @param seconds - Duration in seconds
 * @returns Formatted string (e.g., "1:23:45")
 */
export function formatTotalDuration(seconds: number): string {
  const hours = Math.floor(seconds / 3600)
  const mins = Math.floor((seconds % 3600) / 60)
  const secs = seconds % 60
  if (hours > 0) {
    return `${hours}:${mins.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`
  }
  return `${mins}:${secs.toString().padStart(2, '0')}`
}

/**
 * Suggest capo options for easier playing
 * @param originalKey - Original song key
 * @param targetKey - Target key
 * @returns Array of suggested capo positions with resulting key
 */
export function suggestCapoOptions(originalKey: string, targetKey: string): Array<{
  capo: number
  resultingKey: string
  difficulty: 'EASY' | 'MODERATE' | 'DIFFICULT'
}> {
  const semitones = calculateSemitones(originalKey, targetKey)
  const capo = getCapoPosition(semitones)
  
  const options = []
  
  // Best option
  options.push({
    capo,
    resultingKey: transposeKey(originalKey, capo),
    difficulty: capo <= 2 ? 'EASY' : capo <= 5 ? 'MODERATE' : 'DIFFICULT',
  })
  
  // Alternative: transpose down instead of up
  if (semitones > 6) {
    const altCapo = getCapoPosition(semitones - 12)
    options.push({
      capo: altCapo,
      resultingKey: transposeKey(originalKey, altCapo),
      difficulty: altCapo <= 2 ? 'EASY' : 'MODERATE',
    })
  }
  
  return options
}

/**
 * Clone a setlist with optional modifications
 * @param setlist - Setlist to clone
 * @param modifications - Optional modifications to apply
 * @returns Cloned setlist
 */
export function cloneSetlist(
  setlist: Setlist,
  modifications?: Partial<Setlist>
): Setlist {
  return {
    ...setlist,
    id: `${setlist.id}-clone-${Date.now()}`,
    title: `${setlist.title} (Copy)`,
    createdDate: new Date().toISOString(),
    modifiedDate: new Date().toISOString(),
    songs: setlist.songs.map((song, idx) => ({
      ...song,
      position: idx + 1,
    })),
    ...modifications,
  }
}
