# Lyrics Modal - Full View Experience

## Overview

The **LyricsModal** component provides an immersive, full-screen lyrics viewing experience for every song in the VPC Music app. When users click any song from the song library, dashboard, setlists, or search results, the modal opens with that song's complete lyrics, chords, and metadata.

## Features

### Core Functionality
- **Dynamic Song Selection**: Each song opens with its own dedicated lyrics modal
- **Independent Rendering**: Separate content for each song - no static placeholders
- **Persistent State**: Modal preserves song selection during navigation
- **Chord Notation Integration**: Automatically applies user's Sharp (#) or Flat (♭) preference
- **Real-time Transposition**: Transpose chords with live preview

### UI Components

#### Header (Sticky)
- Song title and artist
- Current transposition level with +/- controls
- Reset button when transposed
- Close button
- Toggle buttons for Chords and Auto-scroll visibility

#### Controls
**Transposition**
- Up/Down chevron buttons to change key
- Display showing current semitone offset
- Reset button clears transposition

**Toggles**
- **Chords**: Show/hide chord lines
- **Auto-scroll**: Automatic scrolling feature (prepared for future audio sync)

#### Content Area
- Scrollable lyrics sections
- Each section has a label (Verse 1, Chorus, etc.)
- Chords displayed above lyrics in blue
- Responsive line-breaking and spacing

#### Footer Navigation (When Available)
- **Previous** button: Navigate to previous song
- **Next** button: Navigate to next song
- Display of current song's BPM

### Responsive Design

**Mobile**
- Full-screen modal covering entire viewport
- Optimized touch controls
- Compact header with essential controls

**Tablet/Desktop**
- Centered floating modal with max-width
- 90% of viewport height maximum
- Subtle backdrop blur

## Implementation

### Component Props

```tsx
interface LyricsModalProps {
  song: any | null              // Currently selected song object
  isOpen: boolean               // Modal visibility state
  onClose: () => void           // Handler to close modal
  onPrevSong?: () => void       // Optional: Previous song navigation
  onNextSong?: () => void       // Optional: Next song navigation
}
```

### Usage Example

```tsx
import { LyricsModal } from '@/components/lyrics-modal'

export function SongsPage() {
  const [selectedSong, setSelectedSong] = useState<Song | null>(null)
  const [lyricsModalOpen, setLyricsModalOpen] = useState(false)

  const handleSelectSong = (song: Song) => {
    setSelectedSong(song)
    setLyricsModalOpen(true)
  }

  return (
    <>
      {/* Song list/grid here */}
      <SongCard 
        song={song}
        onClick={() => handleSelectSong(song)}
      />

      {/* Lyrics Modal */}
      <LyricsModal
        song={selectedSong}
        isOpen={lyricsModalOpen}
        onClose={() => {
          setLyricsModalOpen(false)
          setSelectedSong(null)
        }}
        onPrevSong={handlePrevious}
        onNextSong={handleNext}
      />
    </>
  )
}
```

## Integration Points

### Songs Page (`app/songs/page.tsx`)
- Full lyrics experience with navigation between songs
- All 5 Musician Features available
- Chord transposition and notation preferences applied

### Dashboard (`app/dashboard/page.tsx`)
- Recent songs quick-access with lyrics modal
- One-click song opening from dashboard

### Future Integration Points
- **Setlist View**: Click any song in a setlist to view full lyrics
- **Search Results**: Direct lyrics access from song search
- **Mobile App**: Full-screen lyrics display on mobile devices

## Song Data Structure

The component expects songs with this structure:

```tsx
interface Song {
  id: string
  title: string
  artist: string
  key: string
  bpm?: number
  sections?: SongSection[]
}

interface SongSection {
  label: string                    // e.g., "Verse 1", "Chorus"
  lines: {
    chords?: string               // Chord notation (e.g., "Am Dm G")
    lyrics: string                // Actual lyrics text
  }[]
}
```

## Transposition System

### How It Works
1. User clicks ▲/▼ buttons to adjust transposition
2. Current offset displayed as ±N semitones
3. Chords are transposed in real-time using chromatic scale
4. Transposition persists across all sections
5. Reset button clears transposition

### Chromatic Scale
```
C → C# → D → D# → E → F → F# → G → G# → A → A# → B → C
```

### Chord Modifiers Handled
- Sharps and flats: C#, Db, F#, Bb
- Extensions: maj7, m7, sus4, add9, dim, aug
- Bass notes: C/E, Am/G
- Complex combinations: Cmaj7/E, F#m7sus4

## Chord Notation Preferences

The modal automatically applies the user's chord notation preference:

- **Sharp**: C#, F#, G#, A#, D#
- **Flat**: Db, Gb, Ab, Bb, Eb

Preference is persisted in localStorage and synced across all components using the `useDisplayChordNotation` hook.

## Performance Considerations

- Lazy loading of lyrics sections with staggered animations
- Efficient chord transposition with memoization
- Responsive scrolling without performance degradation
- Smooth transitions between songs using Framer Motion

## Accessibility

- Semantic HTML structure with proper ARIA labels
- Keyboard navigation support for all controls
- Focus management on modal open/close
- High contrast text on dark backgrounds
- Screen reader friendly content presentation

## Future Enhancements

1. **Audio Sync**: Real-time lyrics sync with audio playback
2. **Setlist Integration**: Navigate through setlist songs directly
3. **Chord Variations**: Display finger position guides
4. **Sharing**: Share lyrics with team members
5. **Favorites**: Save favorite songs with transposition presets
6. **Export**: Download lyrics as PDF or text file

## Troubleshooting

### Modal Not Opening
- Verify `isOpen` prop is set to true
- Check that `song` object is not null
- Ensure component is wrapped with `ChordNotationProvider`

### Chords Not Displaying
- Verify `showChords` toggle is enabled (default: true)
- Check song's sections have chord data
- Verify chord notation preference is saved

### Transposition Not Applying
- Ensure chords follow valid chord notation format
- Check that display chord function is properly integrated
- Verify CHROMATIC scale constants are defined

## Code Location

- **Component**: `/components/lyrics-modal.tsx`
- **Songs Page**: `/app/songs/page.tsx`
- **Dashboard**: `/app/dashboard/page.tsx`
- **Chord Context**: `/lib/chord-notation-context.tsx`
- **Display Hook**: `/lib/use-display-chord-notation.ts`
