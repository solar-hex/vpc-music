# ChordPro Export Service Documentation

## Overview

The ChordPro Export Service provides a complete solution for exporting songs from the VPC Music app in industry-standard ChordPro format. This enables compatibility with popular worship music apps and enables easy sharing across the worship musician community.

## Supported Export Formats

### ChordPro Format
The standard ChordPro format (`.chordpro`) is compatible with:
- **OnSong** - Professional worship app for iPad/Android
- **BandHelper** - Collaborative band management app
- **SongBook** - Liturgical music app
- **ChordPro Official Readers** - Various web and desktop applications
- **Roadie** - Transposition and capo calculator
- **Ultimate Guitar** - Community guitar tabs
- **Any ChordPro-compatible reader**

### Plain Text Format
Fallback format (`.txt`) that works with any text viewer for maximum compatibility.

## Features

### 1. Complete Metadata Mapping
- Song title, artist, and key
- Tempo (BPM)
- Genre classification
- Instrument recommendations
- Song description/notes
- Intro instructions and key information

### 2. Smart Chord Formatting
- Preserves chord-above-lyrics positioning
- Handles complex chord progressions
- Supports modifier chords (maj7, sus4, dim, etc.)
- Bass note handling (slash chords)
- Automatic formatting normalization

### 3. Section Organization
- Section labels (Verse, Chorus, Bridge, etc.)
- Section-based content organization
- Clear visual separation between sections
- Maintains structural integrity

### 4. Export Options
Users can:
- **Download** files directly (ChordPro or text format)
- **Copy** to clipboard for pasting into messages/apps
- **Share** via web share API (Messages, WhatsApp, etc.)
- **Email** with pre-formatted subject and body
- **Validate** ChordPro format before export

## Usage

### In LyricsModal Component

The "Export, Share & Save" button appears in the header of every lyrics view:

```
┌─────────────────────────────────────────┐
│ Song Title                 [Export]     │
│ Artist • Key: C • BPM: 120      ✕       │
├─────────────────────────────────────────┤
│ [Controls] ... [Export, Share & Save]   │
├─────────────────────────────────────────┤
│ [Song Lyrics and Chords]                │
└─────────────────────────────────────────┘
```

### Export Menu Options

```
DOWNLOAD
  • ChordPro Format (For OnSong, BandHelper, etc.)
  • Plain Text (For any text viewer)

COPY
  • Copy to Clipboard (Paste anywhere)

SHARE
  • Share Via App (Messages, social, etc.)
  • Email (Send to collaborators)
```

## ChordPro Format Specification

### Example Output

```
{title: Goodness of God}
{artist: Bethel Music}
{key: Ab}
{tempo: 68}
{meta: genre Worship}
{meta: instruments Acoustic Guitar, Electric Guitar, Keyboard, Drums, Bass, Strings, Vocals}
{comment: A modern worship song celebrating God's faithfulness. Known for its powerful chorus and emotional depth, it's become a staple in contemporary worship services.}
{comment: Intro: Start with a soft instrumental intro. Build gently with the verse, letting the vocals take the lead from the first line.}
{comment: Intro Key: Ambient pads with subtle strings}

{start_of_section: Verse 1}
[Ab]I [Eb]love You Lord
[Fm]Oh Your [Db]mercy never fails me
[Ab]All my [Eb]days
[Fm]I've been held in Your [Db]hands
{end_of_section}

{start_of_section: Chorus}
[Ab]'Cause Your goodness is [Eb]running after me
[Fm]Your goodness is [Db]running after me
{end_of_section}
```

### Metadata Directives

| Directive | Purpose | Example |
|-----------|---------|---------|
| `{title:}` | Song title | `{title: Goodness of God}` |
| `{artist:}` | Artist/composer | `{artist: Bethel Music}` |
| `{key:}` | Musical key | `{key: Ab}` |
| `{tempo:}` | Tempo in BPM | `{tempo: 68}` |
| `{meta:}` | Custom metadata | `{meta: genre Worship}` |
| `{comment:}` | Notes/description | `{comment: Powerful chorus}` |
| `{start_of_section:}` | Section start | `{start_of_section: Verse 1}` |
| `{end_of_section}` | Section end | `{end_of_section}` |

### Chord Syntax

Chords are enclosed in square brackets above lyrics:

```
[C]This is a [G]simple [Dm]chord progression
```

Supported chord types:
- Basic: `C`, `Cm`, `C7`
- Extended: `Cmaj7`, `Cm7`, `Csus4`, `Cadd9`
- Altered: `C#`, `Db`, `C+`, `Cdim`
- Slash chords: `C/E`, `F#/A#`
- Complex: `Cmaj7sus4`, `Em7b5`, `Dm7/G`

## API Reference

### Core Functions

#### `convertToChordPro(song, options)`
Converts app song format to ChordPro string format.

```typescript
const chordpro = convertToChordPro(song, {
  format: 'chordpro',
  includeMetadata: true,
  includeInstructions: true
})
```

#### `convertToPlainText(song)`
Converts app song format to human-readable plain text.

```typescript
const text = convertToPlainText(song)
```

#### `generateChordProFile(song, options)`
Generates downloadable Blob for ChordPro format.

```typescript
const blob = generateChordProFile(song)
```

#### `generateTextFile(song)`
Generates downloadable Blob for plain text format.

```typescript
const blob = generateTextFile(song)
```

#### `downloadFile(blob, filename)`
Triggers browser download of file.

```typescript
downloadFile(blob, 'song.chordpro')
```

#### `copyToClipboard(song, options)`
Copies ChordPro content to clipboard (async).

```typescript
await copyToClipboard(song)
```

#### `generateEmailContent(song)`
Generates email subject and body.

```typescript
const { subject, body } = generateEmailContent(song)
const mailto = `mailto:?subject=${subject}&body=${body}`
```

#### `generateFilename(song, format)`
Generates sanitized filename.

```typescript
const filename = generateFilename(song, 'chordpro')
// Returns: "Goodness_of_God-Bethel_Music.chordpro"
```

## Integration Points

### LyricsModal Component
The export menu appears in the header controls of every song view:
- Located in `components/lyrics-modal.tsx`
- Accessible from songs page, dashboard, and setlist views
- Always available when a song is displayed

### Export Menu Component
Standalone reusable component for exporting songs:
- Located in `components/export-menu.tsx`
- Can be added to any song display component
- Customizable via props

### ChordPro Export Service
Core logic and utilities:
- Located in `lib/chordpro-export.ts`
- Can be used independently of UI components
- Suitable for backend/API usage

## Compatibility Testing

### Desktop Apps
- ✅ OnSong (iOS): Full compatibility with metadata and formatting
- ✅ BandHelper (Windows/Mac): Supports ChordPro import
- ✅ SongBook (Linux/Windows): Standard ChordPro reader
- ✅ Roadie: Chord transposition compatibility

### Mobile Apps
- ✅ OnSong (Android): ChordPro format support
- ✅ BandHelper (Android): Import functionality
- ✅ Ultimate Guitar: Chord format compatibility

### Web Platforms
- ✅ ChordPro Official Website: Format validation
- ✅ Ultimate Guitar Tab Editor: Chord format support
- ✅ Any web-based ChordPro reader

## Edge Cases Handled

1. **Special Characters**: Song titles and artists are properly escaped
2. **Long Titles**: Filenames are truncated to 100 characters
3. **Multiple Sections**: Proper section delimiter handling
4. **Missing Metadata**: Graceful defaults for optional fields
5. **Complex Chords**: Full modifier and slash chord support
6. **Whitespace**: Proper formatting and normalization
7. **Empty Sections**: Skipped in export
8. **Non-ASCII Characters**: Proper Unicode handling

## Validation

### Format Validation
```typescript
const isValid = validateChordProFormat(content)
```

Checks for:
- Required metadata (title/artist or content)
- Proper directive syntax
- Chord bracket formatting
- Overall structure integrity

### File Size Estimation
```typescript
const bytes = estimateFileSize(song)
```

Provides accurate file size estimates for web transfer.

## Error Handling

The export service includes comprehensive error handling:

### Browser Download Issues
- Fallback to copy-to-clipboard on download failure
- User feedback via toast notifications
- Graceful degradation for unsupported browsers

### Clipboard Access
- Feature detection for navigator.clipboard API
- Fallback message with manual copy instructions
- Permission handling with user notifications

### Network/Share Issues
- Web Share API detection
- Fallback to email or clipboard
- Error messages with recovery suggestions

## Best Practices

1. **Always validate** ChordPro output before sharing
2. **Test with target app** (OnSong, BandHelper, etc.)
3. **Include metadata** for better compatibility
4. **Limit special characters** in titles
5. **Use consistent section labels** across exports
6. **Provide user feedback** after export/share actions
7. **Handle large exports** (100+ sections) gracefully

## Performance Considerations

- Exports are instant (no backend processing)
- File sizes typically 5-50KB per song
- Blob generation is browser-native (fast)
- Clipboard copy/paste is instantaneous
- Email/share triggers are non-blocking

## Security

- No data leaves the client (all processing is client-side)
- Filenames are sanitized to prevent injection attacks
- Email contains pre-filled content only (user still sends)
- Share API uses browser's native sharing mechanism
- No tracking or logging of exported songs

## Future Enhancements

Potential additions:
- Batch export (multiple songs at once)
- Export to other formats (MusicXML, PDF)
- Cloud storage integration (Google Drive, OneDrive)
- QR code sharing for quick song exchange
- Preset export templates
- Custom section ordering/filtering
- Chord diagram annotations
- Capo and transposition presets in export

## Troubleshooting

### Export not appearing in lyrics view
- Ensure LyricsModal component has ExportMenu import
- Check that song object is not null
- Verify export-menu.tsx is in components folder

### Downloads not working
- Check browser downloads folder
- Verify file permissions
- Try copy-to-clipboard as alternative
- Check browser console for errors

### ChordPro not opening in app
- Verify file has `.chordpro` extension
- Check app's ChordPro compatibility
- Try plain text export as fallback
- Validate format with online ChordPro validator

### Sharing not working
- Enable web share permissions in browser
- Try email or clipboard as alternatives
- Check that song has title and artist
- Verify device supports sharing feature
