# Chord Notation Preference System

## Overview

The VPC Music app now includes a comprehensive chord notation preference system that allows users to choose between Sharp (#) and Flat (♭) notation for all chord symbols throughout the application.

## How It Works

### 1. **User Setting**
- Users can configure their chord notation preference in **Settings > Chord Notation**
- Two options available:
  - **Sharp (#)**: C#, F#, G#, D#, A#, E# (raised notes)
  - **Flat (♭)**: Db, Gb, Ab, Eb, Bb, F (lowered notes)
- The preference is **automatically saved** to localStorage and persists across sessions

### 2. **Global Context**
- The `ChordNotationProvider` in `lib/chord-notation-context.tsx` manages the user's preference globally
- Available everywhere via the `useChordNotation()` hook
- Real-time updates: changing the setting immediately applies everywhere

### 3. **Display Hook**
- `useDisplayChordNotation()` hook in `lib/use-display-chord-notation.ts` handles conversion
- Use `displayChord(chord)` to convert a single chord
- Use `displayText(text)` to convert all chords in a text block

## Implementation Guide

### Basic Usage in Components

```typescript
'use client'

import { useDisplayChordNotation } from '@/lib/use-display-chord-notation'

export function MyComponent() {
  const { displayChord, displayText, notation } = useDisplayChordNotation()

  // Display a single chord
  const chord = displayChord('C#m7')  // Shows "Dbm7" if user prefers flats

  // Display text with multiple chords
  const lyricLine = displayText('C# - F# - G# progression')

  return <div>{chord}</div>
}
```

### Integration Points

#### 1. **Song Display (app/songs/page.tsx)**
Already integrated! Chords are automatically converted when displayed.

#### 2. **Setlists (app/setlist-hub/page.tsx, app/setlists/page.tsx)**
Add to components that display setlist chords:

```typescript
import { useDisplayChordNotation } from '@/lib/use-display-chord-notation'

export function SetlistSongCard({ song }) {
  const { displayChord } = useDisplayChordNotation()

  return (
    <div>
      <p>Key: {displayChord(song.key)}</p>
    </div>
  )
}
```

#### 3. **Live Lyric Views**
For any real-time chord display:

```typescript
const { displayChord, notation } = useDisplayChordNotation()

// Re-render when notation changes (it's part of the context)
useEffect(() => {
  // Component automatically updates when notation changes
}, [notation])
```

#### 4. **Transpose Functions**
Update transpose results to apply notation preference:

```typescript
import { useDisplayChordNotation } from '@/lib/use-display-chord-notation'

function TransposedChord({ chord, semitones }) {
  const { displayChord } = useDisplayChordNotation()
  const transposed = transposeChord(chord, semitones)
  
  return <span>{displayChord(transposed)}</span>
}
```

#### 5. **Chord Sheet Exports/PDFs**
When exporting chords:

```typescript
const { displayText } = useDisplayChordNotation()

const exportedLyrics = lyrics.map(line => ({
  chords: displayText(line.chords),
  lyrics: line.lyrics
}))
```

## Technical Details

### Chord Conversion Logic

The system handles complex chord notations:

- **Basic Notes**: C, C#/Db, D, D#/Eb, E, F, F#/Gb, G, G#/Ab, A, A#/Bb, B
- **With Modifiers**: m7, maj7, sus4, add9, dim, aug, etc.
- **Bass Notes**: Chords with slashes (e.g., C#/F# → Db/Gb)

### Storage

- Preference saved to `localStorage` with key: `chordNotationPreference`
- Value: `'sharp'` or `'flat'`
- Automatically loaded on app start

### Real-time Updates

- Any component using `useChordNotation()` or `useDisplayChordNotation()` hooks automatically updates when the setting changes
- No page refresh needed
- Changes apply immediately across all tabs/views

## Files Modified/Created

### New Files
- `lib/chord-notation-context.tsx` - Global context and conversion logic
- `lib/use-display-chord-notation.ts` - Hook for component usage

### Modified Files
- `app/layout.tsx` - Added ChordNotationProvider wrapper
- `app/settings/page.tsx` - Added Chord Notation settings section
- `app/songs/page.tsx` - Integrated chord notation display

## Best Practices

1. **Always use the hook** - Don't manually convert chords in components
2. **Use displayText for lyrics** - Automatically handles multiple chords
3. **Test both notations** - Ensure all chord displays work in both modes
4. **Consider chord complexity** - The conversion handles modifiers correctly
5. **Real-time testing** - Change settings while viewing songs to test integration

## User Experience

Users will see:
1. Setting option in Settings → Chord Notation
2. Live preview of Sharp vs Flat examples
3. Auto-apply info box explaining where it's used
4. Immediate updates everywhere when changed
5. Persistent preference across sessions

## Troubleshooting

### Chords not updating?
- Ensure component uses `useDisplayChordNotation()` hook
- Check that chord format is valid (e.g., "C#m7" not "C sharp minor 7")
- Verify localStorage is enabled in browser

### Complex chords showing wrong format?
- Check chord notation in data (should start with base note)
- Ensure modifiers are recognized (m, maj, sus, add, etc.)
- Some custom notations may not convert; add to SHARP_TO_FLAT mapping if needed
