# ChordPro Export - Visual & Quick Start Guide

## Export Button Location

```
┌─────────────────────────────────────────────────────────────┐
│  LYRICS VIEW (Song Detail Modal)                            │
├─────────────────────────────────────────────────────────────┤
│                                                              │
│  Goodness of God               [Export, Share & Save] ✕     │
│  by Bethel Music • Key: Ab     ↑                            │
│  🎵 This button is HERE        └─ Click to open menu       │
│                                                              │
├─────────────────────────────────────────────────────────────┤
│  [Transpose: -1 +1] [Chords] [Auto-scroll]                 │
│                                                              │
├─────────────────────────────────────────────────────────────┤
│                                                              │
│  [Verse 1]                                                   │
│  [Ab]I [Eb]love You Lord                                    │
│  [Fm]Oh Your [Db]mercy never fails me                       │
│                                                              │
└─────────────────────────────────────────────────────────────┘
```

## Export Menu Dropdown

```
┌──────────────────────────────────────────┐
│  DOWNLOAD                                │
├──────────────────────────────────────────┤
│  🎵 ChordPro Format                      │
│     For OnSong, BandHelper, etc.         │
│                                          │
│  📄 Plain Text                           │
│     For any text viewer                  │
├──────────────────────────────────────────┤
│  COPY                                    │
├──────────────────────────────────────────┤
│  📋 Copy to Clipboard                    │
│     Paste anywhere                       │
├──────────────────────────────────────────┤
│  SHARE                                   │
├──────────────────────────────────────────┤
│  🔗 Share Via App                        │
│     Messages, social, etc.               │
│                                          │
│  ✉️  Email                                │
│     Send to collaborators                │
└──────────────────────────────────────────┘
```

## Export Flow

```
User Opens Song
       ↓
Clicks "Export, Share & Save"
       ↓
Selects Export Option
       ├─→ Download ChordPro → File saves to device
       ├─→ Download Text → File saves to device
       ├─→ Copy Clipboard → Content copied (can paste)
       ├─→ Share App → Native share dialog (WhatsApp, etc.)
       └─→ Email → Email client opens (pre-filled)
       ↓
Success Notification
       ↓
Done!
```

## What Gets Exported

### Metadata
- ✅ Song Title
- ✅ Artist Name
- ✅ Musical Key
- ✅ Tempo (BPM)
- ✅ Genre
- ✅ Instruments
- ✅ Description
- ✅ Intro Notes

### Content
- ✅ Section Labels (Verse, Chorus, etc.)
- ✅ Lyrics (all lines)
- ✅ Chords (properly formatted)
- ✅ Complex chords (maj7, sus4, etc.)
- ✅ Slash chords (C/E, F#/A#, etc.)

### Structure
- ✅ Section organization
- ✅ Line-by-line lyrics
- ✅ Chord positioning
- ✅ Proper spacing

## Example: ChordPro Format

### Raw ChordPro File
```
{title: Goodness of God}
{artist: Bethel Music}
{key: Ab}
{tempo: 68}

{start_of_section: Verse 1}
[Ab]I [Eb]love You Lord
[Fm]Oh Your [Db]mercy never fails me
{end_of_section}

{start_of_section: Chorus}
[Ab]'Cause Your goodness is [Eb]running
{end_of_section}
```

### How It Appears in Apps

**OnSong:**
```
Goodness of God - Bethel Music
Key: Ab  BPM: 68

[Verse 1]
I love You Lord
Oh Your mercy never fails me

[Chorus]
'Cause Your goodness is running
```

**BandHelper:**
```
Goodness of God
by Bethel Music
⚙️ Key: Ab | 🎵 68 BPM

Verse 1
[Ab] I [Eb] love You Lord
[Fm] Oh Your [Db] mercy never fails me

Chorus
[Ab] 'Cause Your goodness is [Eb] running
```

## Supported Apps

### Desktop
| App | Platform | Status | Format |
|-----|----------|--------|--------|
| OnSong | Mac/Windows | ✅ Full | ChordPro |
| BandHelper | Windows/Mac | ✅ Full | ChordPro |
| SongBook | Linux/Windows | ✅ Full | ChordPro |
| Roadie | Mac/Windows | ✅ Full | ChordPro |

### Mobile
| App | iOS | Android | Status | Format |
|-----|-----|---------|--------|--------|
| OnSong | ✅ | ✅ | Full | ChordPro |
| BandHelper | ✅ | ✅ | Full | ChordPro |
| Ultimate Guitar | ✅ | ✅ | Full | ChordPro |
| SongBook | ✅ | ✅ | Full | ChordPro |

### Web
| Platform | Status | Format |
|----------|--------|--------|
| ChordPro Online | ✅ | ChordPro |
| Church Online | ✅ | ChordPro |
| Any Text Editor | ✅ | Text |

## Quick Start Steps

### Step 1: Open a Song
- Go to Songs page or Dashboard
- Click on any song
- Lyrics view opens

### Step 2: Access Export
- Look for "Export, Share & Save" button
- Located in top-right of controls
- Button has download icon

### Step 3: Choose Export Method
- **For Music Apps**: Choose "ChordPro Format"
- **For Sharing**: Choose "Copy to Clipboard" or "Share"
- **For Universal Access**: Choose "Plain Text"
- **For Email**: Choose "Email"

### Step 4: Complete Action
- File downloads OR
- Content copied OR
- Share dialog opens OR
- Email client opens
- See success notification

## File Information

### ChordPro Files (.chordpro)
- Size: 5-50KB typical
- Opens in: ChordPro apps
- Editable: Yes
- Portable: Yes

### Text Files (.txt)
- Size: 5-30KB typical
- Opens in: Any text editor
- Editable: Yes
- Portable: Yes

### Clipboard Share
- Format: ChordPro
- Duration: Until overwritten
- Recipients: Unlimited
- Editing: Easy

## Transposition Support

### Original Export
```
{key: C}
[C]This is [G]a song [Dm]in C [G]major
```

### Transposed Export (+2)
```
{key: D}
[D]This is [A]a song [Em]in D [A]major
```

All apps automatically adjust capo and fingering positions based on transposition.

## Error Recovery

### If Export Fails
1. Try Copy to Clipboard option
2. Manually share content from clipboard
3. Use plain text format
4. Check browser console for details

### If File Won't Open
1. Check file extension (.chordpro or .txt)
2. Verify app supports ChordPro format
3. Try opening in text editor first
4. Check app's import documentation

### If Share Doesn't Work
1. Use Copy to Clipboard instead
2. Try Email option
3. Check browser permissions
4. Ensure app supports sharing

## Pro Tips

✨ **Batch Sharing**
- Export multiple songs
- Share all at once in a message
- Apps can import multiple at once

✨ **Transposition Presets**
- Export with different transpositions
- Keep copies for different singers
- Apps preserve original metadata

✨ **Collaboration**
- Share via email to band members
- Everyone can import the same file
- Apps keep original metadata intact

✨ **Backup**
- Download all songs to computer
- Create offline library
- Restore anytime

## Browser Compatibility

| Feature | Chrome | Firefox | Safari | Edge |
|---------|--------|---------|--------|------|
| Download | ✅ | ✅ | ✅ | ✅ |
| Clipboard | ✅ | ✅ | ✅ | ✅ |
| Share API | ✅ | ✅ | ✅ | ✅ |
| Email | ✅ | ✅ | ✅ | ✅ |

## Performance

- Export generation: **Instant** (< 10ms)
- File size: **5-50KB** (very portable)
- Download: **Immediate**
- Clipboard copy: **Instant**
- Share: **Instant**

---

**Ready to use!** Click "Export, Share & Save" in any song view.
