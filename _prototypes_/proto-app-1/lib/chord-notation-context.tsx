'use client'

import React, { createContext, useContext, useState, useEffect } from 'react'

export type ChordNotation = 'sharp' | 'flat'

interface ChordNotationContextValue {
  notation: ChordNotation
  setNotation: (notation: ChordNotation) => void
}

const ChordNotationContext = createContext<ChordNotationContextValue | null>(null)

// Chord mapping for conversion
const SHARP_TO_FLAT: Record<string, string> = {
  'C#': 'Db',
  'D#': 'Eb',
  'E#': 'F',
  'F#': 'Gb',
  'G#': 'Ab',
  'A#': 'Bb',
  'B#': 'C',
}

const FLAT_TO_SHARP: Record<string, string> = {
  'Db': 'C#',
  'Eb': 'D#',
  'F': 'E#',
  'Gb': 'F#',
  'Ab': 'G#',
  'Bb': 'A#',
  'C': 'B#',
}

export function ChordNotationProvider({ children }: { children: React.ReactNode }) {
  const [notation, setNotationState] = useState<ChordNotation>('sharp')
  const [isLoaded, setIsLoaded] = useState(false)

  // Load from localStorage on mount
  useEffect(() => {
    if (typeof window !== 'undefined') {
      const stored = localStorage.getItem('chordNotationPreference')
      if (stored === 'flat' || stored === 'sharp') {
        setNotationState(stored)
      }
      setIsLoaded(true)
    }
  }, [])

  const setNotation = (newNotation: ChordNotation) => {
    setNotationState(newNotation)
    if (typeof window !== 'undefined') {
      localStorage.setItem('chordNotationPreference', newNotation)
    }
  }

  if (!isLoaded) return <>{children}</>

  return (
    <ChordNotationContext.Provider value={{ notation, setNotation }}>
      {children}
    </ChordNotationContext.Provider>
  )
}

export function useChordNotation() {
  const ctx = useContext(ChordNotationContext)
  
  // Return a safe default during SSR/prerendering
  if (!ctx) {
    return {
      notation: 'sharp' as ChordNotation,
      setNotation: () => {},
    }
  }
  
  return ctx
}

/**
 * Convert a chord symbol from sharp to flat notation or vice versa
 * @param chord The chord symbol to convert (e.g., "C#m7", "Db", "G#sus4")
 * @param toNotation Target notation type
 * @returns Converted chord symbol
 */
export function convertChordNotation(chord: string, toNotation: ChordNotation): string {
  if (!chord) return chord

  // Handle chords with modifiers (e.g., "C#m7", "Dbmaj7", "G#sus4")
  // Extract the base note (first 1-2 characters)
  let baseNote = chord.slice(0, 2) // Could be "C#", "Db", etc.
  if (chord.length > 0 && !['#', 'b'].includes(chord[1])) {
    baseNote = chord[0]
  }

  const modifiers = chord.slice(baseNote.length) // The rest (m7, maj7, sus4, etc.)

  if (toNotation === 'flat') {
    // Convert sharp to flat
    const flatNote = SHARP_TO_FLAT[baseNote] || baseNote
    return flatNote + modifiers
  } else {
    // Convert flat to sharp
    const sharpNote = FLAT_TO_SHARP[baseNote] || baseNote
    return sharpNote + modifiers
  }
}

/**
 * Convert all chords in a text to the specified notation
 * @param text Text containing chord symbols
 * @param fromNotation Current notation type
 * @param toNotation Target notation type
 * @returns Text with converted chords
 */
export function convertAllChordsInText(
  text: string,
  fromNotation: ChordNotation,
  toNotation: ChordNotation
): string {
  if (fromNotation === toNotation) return text

  // Find and replace chord symbols
  // Match patterns like: C#, Db, G#m7, Bbmaj7, etc.
  const chordPattern = /([A-G](?:[#b])?(?:m|M|maj|min|add|sus|aug|dim|7|9|11|13|6)?(?:\(.*?\))?)/g

  return text.replace(chordPattern, (match) => {
    // Only convert if it looks like a chord
    if (/^[A-G]/.test(match)) {
      return convertChordNotation(match, toNotation)
    }
    return match
  })
}
