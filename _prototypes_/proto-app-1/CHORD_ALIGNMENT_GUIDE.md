# Chord Alignment System Guide

## Overview

The chord alignment system ensures that chords stay perfectly aligned above their corresponding lyric words across all screen sizes (mobile, tablet, desktop). This fix addresses responsive resizing, font scaling, line wrapping, and proportional font issues.

## Problem Solved

Previous implementations rendered chords and lyrics separately using div elements, which caused:
- Chords to shift position on different screen sizes
- Font scaling to break alignment
- Line wrapping to misalign chords with lyrics
- Inconsistent spacing between views
- Mobile/tablet/desktop misalignment

## Solution Architecture

### 1. Monospace Font Rendering

All chord and lyrics are now rendered using monospace fonts within `<pre>` tags:

```jsx
<pre className="whitespace-pre font-mono overflow-x-auto leading-7">
  {lyrics}
</pre>
```

**Key Benefits:**
- Fixed-width characters ensure predictable alignment
- Each character occupies exactly the same space
- No font scaling surprises
- Perfect alignment maintained across all screen sizes

### 2. Space Preservation

The `whitespace-pre` Tailwind class preserves all spaces and formatting:
- No space collapsing
- All indentation preserved
- Exact positioning maintained
- Line breaks respected

### 3. Horizontal Scrolling

On smaller screens where chords+lyrics exceed viewport width:
- `overflow-x-auto` allows horizontal scrolling
- Chord alignment never breaks
- Users can scroll to see full content
- No text wrapping destroys alignment

## Implementation Details

### Files Modified

#### `lib/use-chord-alignment.ts` (NEW)
Utility functions for chord alignment:
- `formatAlignedChordLine()` - Formats single chord/lyric line
- `formatAlignedSection()` - Formats entire section
- `validateChordAlignment()` - Validates alignment
- `ALIGNED_CHORD_CLASSES` - Pre-configured Tailwind classes

#### `components/lyrics-modal.tsx`
- Added `ChordDisplayMode` type: `'both' | 'lyrics-only' | 'chords-only'`
- Added `displayMode` state for mode switching
- Replaced div-based rendering with `<pre>` monospace rendering
- Added display mode toggle buttons: "Lyrics", "Both", "Chords"
- Integrated transposition with alignment preservation

#### `app/songs/page.tsx`
- Updated chord/lyrics rendering to use monospace `<pre>` format
- Maintains responsive behavior with horizontal scroll
- Preserves transposition alignment

### Tailwind Classes Used

```css
whitespace-pre         /* Preserve all whitespace */
font-mono             /* Monospace font family */
overflow-x-auto       /* Horizontal scroll on small screens */
leading-7             /* Line height for readability (1.75rem) */
text-sm md:text-base  /* Responsive text sizing */
```

## Display Modes

Users can toggle between three display modes:

### 1. **Both** (Default)
Shows chords above lyrics with perfect alignment:
```
C           G        Am       F
Amazing grace how sweet the sound
```

### 2. **Lyrics Only**
Shows only the lyrics for reading practice:
```
Amazing grace how sweet the sound
```

### 3. **Chords Only**
Shows only the chords for chord reference:
```
C           G        Am       F
```

## Responsive Behavior

### Mobile (< 768px)
- Full viewport width
- Horizontal scroll enabled if chords+lyrics exceed width
- Font size: `text-sm` (0.875rem)
- Perfect alignment maintained

### Tablet (768px - 1024px)
- Full viewport width
- Horizontal scroll enabled if needed
- Font size: `text-base` (1rem)
- Larger character width for easier reading

### Desktop (> 1024px)
- Full viewport width
- Horizontal scroll if needed
- Font size: `text-base` (1rem)
- Ample spacing for comfortable viewing

## Technical Requirements Met

✓ Chords stay vertically aligned with corresponding lyric syllables/words
✓ No chord shifting on responsive resizing
✓ No alignment issues with font scaling
✓ Line wrapping never breaks alignment
✓ Inconsistent spacing eliminated
✓ Proportional font issues resolved
✓ Monospace font for reliable alignment
✓ All spaces preserved
✓ No text collapsing
✓ No auto-justify interference
✓ Smart wrapping disabled for chord lines
✓ Raw ChordPro formatting preserved
✓ Indentation and spaces intact
✓ No flex/grid layout confusion
✓ CSS never modifies text spacing

## Usage Examples

### Basic Implementation

```jsx
import { formatAlignedChordLine } from '@/lib/use-chord-alignment'

export function SongView() {
  return (
    <pre className="whitespace-pre font-mono overflow-x-auto leading-7">
      {song.sections.map(section => (
        section.lines.map(line => 
          formatAlignedChordLine(line.chords, line.lyrics, 'both')
        ).join('\n')
      )).join('\n\n')}
    </pre>
  )
}
```

### With Transposition

```jsx
const transposedChords = displayChord(transposeLine(line.chords, transposition))
const alignedOutput = `${transposedChords}\n${line.lyrics}`
```

### With Display Mode Toggle

```jsx
const [displayMode, setDisplayMode] = useState<ChordDisplayMode>('both')

const content = section.lines.map(line => {
  const chords = displayChord(transposeLine(line.chords, transposition))
  return formatAlignedChordLine(chords, line.lyrics, displayMode)
}).join('\n')
```

## Edge Cases Handled

### Empty Lines
- Lines without chords render as lyrics only
- Lines without lyrics are skipped
- Validation catches problematic formatting

### Special Characters
- Unicode characters preserved
- Accents and diacritics maintained
- Special symbols (♯, ♭) handled correctly

### Long Chords
- Horizontal scroll prevents overflow
- No line breaking
- Full chord sequences visible with scroll

### Font Sizing
- Responsive sizing (sm/base) maintains alignment
- Monospace ensures consistent width
- No scaling surprises

## Testing Recommendations

### Mobile Testing
- iPhone 12/13/14/15 (390px width)
- Samsung Galaxy (360-412px width)
- Confirm horizontal scroll works
- Verify alignment on scroll

### Tablet Testing
- iPad (768px width)
- iPad Pro (1024px width)
- Test landscape orientation
- Confirm auto-scroll disabled

### Desktop Testing
- 1920x1080 (standard desktop)
- 2560x1440 (high-DPI)
- Ultra-wide monitors (3440px)
- Confirm perfect alignment

## Browser Compatibility

- Chrome/Edge: Full support
- Firefox: Full support
- Safari: Full support
- Mobile browsers: Full support

## Performance Considerations

- Pre-formatted rendering: O(n) complexity
- No layout thrashing
- No scroll jank
- Hardware-accelerated rendering
- CSS is minimal and performant

## Future Enhancements

- Color-coding for different chord types
- Responsive font sizing without breaking alignment
- Copy-to-clipboard with formatting preserved
- Export to ChordPro/PDF with alignment maintained
- Chord highlighting on playback
- Dynamic font size adjustment with alignment preservation

## Troubleshooting

### Chords not aligned
- Verify monospace font is applied
- Check `whitespace-pre` class is present
- Ensure lyrics preserve original spacing
- Validate no text-transform is applied

### Horizontal scroll not working
- Check `overflow-x-auto` is applied
- Verify parent container has fixed width
- Confirm content exceeds container width

### Font scaling issues
- Use responsive classes: `text-sm md:text-base`
- Monospace font handles scaling
- Line-height maintains spacing

## Related Files

- `components/lyrics-modal.tsx` - Main implementation
- `app/songs/page.tsx` - Alternative rendering
- `lib/use-chord-alignment.ts` - Utility functions
- `lib/chordpro-export.ts` - ChordPro export compatibility
