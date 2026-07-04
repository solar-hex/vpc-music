'use client'

import { useChordNotation, convertChordNotation, convertAllChordsInText } from '@/lib/chord-notation-context'

/**
 * Hook to get the current chord notation and apply it
 * Usage: const { displayChord, displayText } = useDisplayChordNotation()
 */
export function useDisplayChordNotation() {
  const { notation } = useChordNotation()

  /**
   * Convert a single chord to the user's preferred notation
   */
  const displayChord = (chord: string) => {
    if (notation === 'sharp') {
      // Convert to sharp if needed
      return convertChordNotation(chord, 'sharp')
    } else {
      // Convert to flat if needed
      return convertChordNotation(chord, 'flat')
    }
  }

  /**
   * Convert all chords in a text block to the user's preferred notation
   */
  const displayText = (text: string) => {
    // Detect current notation in text (simplified - assumes it starts with first chord encountered)
    const chordPattern = /([A-G](?:[#b])?(?:m|M|maj|min|add|sus|aug|dim|7|9|11|13|6)?(?:\(.*?\))?)/
    const match = text.match(chordPattern)
    
    if (match && match[0]) {
      const firstChord = match[0]
      // Detect if first chord has sharp or flat
      const currentNotation = firstChord.includes('#') ? 'sharp' : firstChord.includes('b') ? 'flat' : notation
      
      if (currentNotation !== notation) {
        return convertAllChordsInText(text, currentNotation, notation)
      }
    }
    
    return text
  }

  return { displayChord, displayText, notation }
}
