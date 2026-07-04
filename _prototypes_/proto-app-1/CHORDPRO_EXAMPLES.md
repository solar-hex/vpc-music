# ChordPro Export Examples

## Example 1: Full Song Export

### Input Song Data
```typescript
{
  title: "Goodness of God",
  artist: "Bethel Music",
  key: "Ab",
  bpm: 68,
  genre: "Worship",
  description: "A modern worship song celebrating God's faithfulness",
  intro: "Start with soft instrumental intro",
  introKey: "Ambient pads with strings",
  instruments: ["Acoustic Guitar", "Keys", "Bass", "Drums"],
  sections: [
    {
      label: "Verse 1",
      lines: [
        { chords: "Ab Eb", lyrics: "I love You Lord" },
        { chords: "Fm Db", lyrics: "Oh Your mercy never fails me" }
      ]
    },
    {
      label: "Chorus",
      lines: [
        { chords: "Ab Eb", lyrics: "'Cause Your goodness is running" }
      ]
    }
  ]
}
```

### ChordPro Export Output
```
{title: Goodness of God}
{artist: Bethel Music}
{key: Ab}
{tempo: 68}
{meta: genre Worship}
{meta: instruments Acoustic Guitar, Keys, Bass, Drums}
{comment: A modern worship song celebrating God's faithfulness}
{comment: Intro: Start with soft instrumental intro}
{comment: Intro Key: Ambient pads with strings}

{start_of_section: Verse 1}
[Ab]I [Eb]love You Lord
[Fm]Oh Your [Db]mercy never fails me
{end_of_section}

{start_of_section: Chorus}
[Ab]'Cause Your goodness is [Eb]running
{end_of_section}
```

### Text Export Output
```
Goodness of God
by Bethel Music
Key: Ab | BPM: 68
Genre: Worship

A modern worship song celebrating God's faithfulness

Instruments: Acoustic Guitar, Keys, Bass, Drums

Intro: Start with soft instrumental intro
Intro Key: Ambient pads with strings

[Verse 1]
  Ab Eb
  I love You Lord
  Fm Db
  Oh Your mercy never fails me

[Chorus]
  Ab Eb
  'Cause Your goodness is running
```

---

## Example 2: Simple Worship Song

### ChordPro Format
```
{title: Holy Forever}
{artist: Cory Asbury}
{key: C}
{tempo: 76}
{meta: genre Worship}

{comment: Simple, powerful worship song with emotional depth}

{start_of_section: Verse 1}
[C]Jesus You're holy [G]forever
[C]You're holy [G]forever
[Am]In every [F]season
{end_of_section}

{start_of_section: Chorus}
[C]Holy, [G]holy forever
[Am]You are [F]worthy
{end_of_section}
```

---

## Example 3: Complex Chord Progressions

### ChordPro Format with Advanced Chords
```
{title: Pieces}
{artist: Red Rocks Worship}
{key: G}
{tempo: 84}

{start_of_section: Verse}
[Gmaj7]You take the [Gmaj7/B]pieces
[Cmaj7]Of a [D]broken [G]heart
[Gmaj7]You make something [Em7]beautiful
{end_of_section}

{start_of_section: Chorus}
[Gmaj7]Out of the [Cmaj7]ashes
[D/F#]You restore [Em7]me
[Am7]In your [D]love
{end_of_section}

{start_of_section: Bridge}
[Gmaj7]All of my [Cmaj7]broken
[D]Pieces you've [Bm7]made whole
{end_of_section}
```

**Supported Chord Types:**
- Extended: `Cmaj7`, `Cm7`, `Csus4`, `Cadd9`
- Alterations: `C#`, `Db`, `C+`, `Cdim`
- Slash chords: `C/E`, `F#/A#`, `G/B`
- Complex: `Cmaj7sus4`, `Em7b5`, `Dm7/G`

---

## Example 4: Minimal Export (Lyrics Only)

### ChordPro Format
```
{title: Jesus Paid It All}
{artist: Marvis Isaacs}
{key: E}

{start_of_section: Verse}
I hear the Savior say
Your strength indeed is small
Child of weakness, watch and pray
Find in Me your all in all
{end_of_section}

{start_of_section: Chorus}
Jesus paid it all
All to Him I owe
Sin had left a crimson stain
He washed it white as snow
{end_of_section}
```

---

## Example 5: Complex Structure with Multiple Choruses

### ChordPro Format
```
{title: Reckless Love}
{artist: Cory Asbury}
{key: C}
{tempo: 100}

{start_of_section: Intro}
[C][G/B][Am][F]
{end_of_section}

{start_of_section: Verse 1}
[C]Before I spoke a [G/B]word
[Am]You were singing [F]over me
[C]You have been so, so [G/B]good to me
[Am]All my life, [F]all my life
{end_of_section}

{start_of_section: Pre-Chorus}
[C]Before I made a [G/B]mess
[Am]Of my life, [F]You were already there
{end_of_section}

{start_of_section: Chorus}
[C]Oh, the overwhelming, [G/B]never-ending
[Am]Reckless love of [F]God
[C]It chases me [G/B]down
[Am]Fights 'til I'm [F]found
[C]Leaves the ninety-[G/B]nine
{end_of_section}

{start_of_section: Verse 2}
[C]I couldn't earn this [G/B]
[Am]I don't deserve [F]this
[C]You gave me Jesus, you [G/B]gave me Jesus
{end_of_section}

{start_of_section: Bridge}
[C]There's no shadow You [G/B]won't light up
[Am]Mountain You won't [F]climb
[C]If You ever want to [G/B]look
[Am]Right into the [F]depths of me
{end_of_section}
```

---

## Example 6: Instrumental Changes with Comments

### ChordPro Format
```
{title: Way Maker}
{artist: Sinéad Coates}
{key: Bb}
{tempo: 96}

{comment: Powerful modern hymn with dynamic arrangement}

{start_of_section: Verse 1}
[Bb]Way maker, miracle worker
[Gm]Promise keeper, light in the [Bb]darkness
[Bb]My God, that is [F]who You [Bb]are
{end_of_section}

{start_of_section: Verse 1 (Acoustic)}
{comment: Stripped down version - vocals and acoustic guitar only}
[Bb]Way maker, miracle worker
[Gm]Promise keeper, light in the [Bb]darkness
{end_of_section}

{start_of_section: Verse 1 (Full)}
{comment: Full arrangement with all instruments}
[Bb]Way maker, miracle worker
[Gm]Promise keeper, light in the [Bb]darkness
[Bb]My God, that is [F]who You [Bb]are
{end_of_section}
```

---

## Example 7: Transposed Export

### Original Key (C Major)
```
{title: Blessed Assurance}
{key: C}
{start_of_section: Verse}
[C]Blessed assurance, [F]Jesus is mine
[C]Oh, what a foretaste [G]of glory [C]divine
{end_of_section}
```

### Transposed to D Major (+2 semitones)
```
{title: Blessed Assurance}
{key: D}
{meta: transposition +2}
{start_of_section: Verse}
[D]Blessed assurance, [G]Jesus is mine
[D]Oh, what a foretaste [A]of glory [D]divine
{end_of_section}
```

---

## Text Export Examples

### Minimal Text Export
```
Amazing Grace
by John Newton
Key: G

[Verse 1]
  G
  Amazing grace, how sweet the sound
  D
  That saved a wretch like me
  G
  I once was lost, but now am found
  D G
  Was blind, but now I see

[Chorus]
  G
  Amazing grace
  D G
  How sweet the sound
```

### Detailed Text Export
```
Goodness of God
by Bethel Music
Key: Ab | BPM: 68
Genre: Worship

A modern worship song celebrating God's faithfulness. Known for its powerful chorus and emotional depth, it's become a staple in contemporary worship services.

Instruments: Acoustic Guitar, Electric Guitar, Keyboard, Drums, Bass, Strings, Vocals

Intro: Start with a soft instrumental intro. Build gently with the verse, letting the vocals take the lead.
Intro Key: Ambient pads with subtle strings

[Verse 1]
  Ab Eb
  I love You Lord
  Fm Db
  Oh Your mercy never fails me
  Ab Eb
  All my days
  Fm Db
  I've been held in Your hands

[Chorus]
  Ab Eb
  'Cause Your goodness is running after me
  Fm Db
  Your goodness is running after me
```

---

## App Compatibility Notes

### OnSong Import
- Direct import from ChordPro files
- Metadata read correctly
- Section labels preserved
- Chords transposed properly
- BPM and key recognized

### BandHelper Import
- Supports ChordPro format
- All sections recognized
- Chord formatting preserved
- Metadata populates correctly
- Ready for collaboration

### SongBook Import
- ChordPro file support
- Section organization maintained
- Chord display accurate
- Metadata stored
- Print-friendly formatting

### Roadie Transposition
- Recognizes keys and BPM
- Transposition calculations work
- Capo position suggestions accurate
- Song structure preserved

---

## Testing Checklist

When exporting songs, verify:

- [ ] Title matches song title
- [ ] Artist is correctly shown
- [ ] Key is properly formatted
- [ ] BPM is accurate
- [ ] Sections are labeled correctly
- [ ] Chords are above lyrics
- [ ] Complex chords are preserved
- [ ] Slash chords format correctly
- [ ] Metadata is complete
- [ ] Description is helpful
- [ ] Instruments list is accurate
- [ ] Intro instructions are clear
- [ ] File downloads successfully
- [ ] Clipboard copy works
- [ ] Email shares properly
- [ ] App import succeeds

---

## Troubleshooting Export Issues

### Problem: Chords not aligned
**Solution:** Ensure lyrics and chords have matching word count

### Problem: Section labels missing
**Solution:** Check that song sections have proper labels in app

### Problem: File won't open in app
**Solution:** 
1. Verify `.chordpro` file extension
2. Try plain text format as backup
3. Check app's import documentation

### Problem: Transposition not working
**Solution:** 
1. Verify chords are in recognized format
2. Check that key is properly set
3. Try transposing within app instead

### Problem: Special characters corrupted
**Solution:** 
1. Use UTF-8 encoding
2. Try plain text export
3. Copy to clipboard instead of download
