# ChordPro Editor Brainstorm

This is a brainstorm document for how the ChordPro editor could become much more powerful, more discoverable, and more musician-friendly.

It mixes:

- **current editor behavior**
- **near-term improvements**
- **bigger feature ideas**
- **help / onboarding ideas**

> **Status as of March 16, 2026:** **Phase 1, Phase 2, and Phase 3 are now COMPLETE.**
>
> **Phase 3 completion update** — the advanced editor now spans both the original textarea workflow and a richer CodeMirror foundation:
> - smart suggestions for missing metadata, unlabeled sections, likely choruses, and malformed chord spellings
> - one-click inline fixes in the validation panel for common syntax issues and chord spelling cleanup
> - cursor-aware help cards for directives, sections, chords, and lyric lines
> - a structured section organizer with drag-and-drop reordering, auto-numbered duplication, and fold/expand controls
> - an arrangement builder that assembles section order, supports repeat markers like `Chorus ×2`, and saves arrangements as new variations
> - CodeMirror 6 as the advanced editing surface with native line numbers, active-line state, custom ChordPro decorations, and inline diagnostics while beginner mode preserves the textarea fallback
>
> **Phase 1** — syntax highlighting (tokenizer + overlay), inline validation panel, collapsible help section (4 tabs), 7 keyboard shortcuts, expanded insert menu, and 79 new tests. See `202603161-tasks.md` Section 4.
>
> **Phase 2** — command palette (Ctrl+Space & slash commands, 35 commands, recent history), split preview (edit/split/preview modes with scroll sync), line numbers & section navigation (gutter, current line highlight, section jump dropdown), context menu (chord/section/lyrics/line context-aware actions), auto-format (directive normalization, metadata ordering, whitespace cleanup, format-on-save), and 81 new tests. See `202603161-tasks.md` Section 5.

> **CodeMirror decision note** — CodeMirror 6 won over Monaco because it is lighter, easier to embed inside the existing React/Tailwind surface, and flexible enough to reuse the existing ChordPro tokenizer and validation pipeline.

---

# 1) Current editor baseline

From the current implementation, the editor already has a few strong foundations:

- Metadata sync into top directives:
  - `{title: ...}`
  - `{artist: ...}`
  - `{key: ...}`
  - `{tempo: ...}`
- Section insert dropdown for common labels such as:
  - Verse
  - Chorus
  - Bridge
  - Intro
  - Outro
  - Tag
  - Vamp
  - Coda
- Text-selection chord insertion popup
- Monospace editing surface
- Chord validation hinting for inserted chords
- A separate renderer/viewer already exists and supports transposition

That means the next step is not starting from zero. The next step is making it feel like a **real writing tool**, not just a textarea with helpers.

---

# 2) Main goals

If we want to enhance the editor as much as possible, the top goals should probably be:

- Make editing faster
- Make formatting more consistent
- Make features more discoverable
- Reduce ChordPro syntax mistakes
- Help beginners without slowing down power users
- Keep the experience good on desktop and tablet

---

# 3) Visual improvements inside the editor

## Syntax coloring

A very high-value improvement would be syntax highlighting.

Possible color categories:

- **Chord tokens** like `[G]`, `[C#m]`, `[Bb/F]`
  - bright accent color
- **Directives** like `{title: ...}`, `{comment: ...}`
  - different accent color
- **Comments / section headers** like `{comment: Chorus}`
  - bold + tinted background line
- **Lyrics text**
  - normal foreground color
- **Invalid syntax**
  - red underline or red gutter marker
- **Whitespace / alignment hints**
  - optional subtle markers

### Why this matters

- Makes structure instantly visible
- Reduces editing errors
- Helps users understand ChordPro faster

### Brainstorm options

- Lightweight custom syntax highlighting over textarea
- Code editor component later, such as Monaco or CodeMirror
- “Simple mode” and “Advanced mode” display options

---

## Color themes for sections

Section headers could be visually emphasized.

Ideas:

- Verse lines get one subtle label color
- Chorus lines get another
- Bridge gets another
- Instrumental sections get a muted style
- Repeated section names get consistent styling

Example concept:

- Verse = blue chip
- Chorus = green chip
- Bridge = purple chip
- Intro/Outro = amber chip

This could be editor-only, preview-only, or both.

---

## Inline error and warning states

The editor should help users catch mistakes while typing.

Examples:

- Unknown directive
- Missing closing `]` in a chord
- Unbalanced `{` and `}`
- Chord token that looks malformed
- Duplicate conflicting top directives
- Empty `{comment: }`
- Suspicious spacing / accidental double blank section headers

Possible UI:

- red underline
- warning badge in gutter
- small error list under editor
- “Problems” panel for ChordPro issues

---

## Better line structure cues

Helpful visual hints:

- show line numbers
- show section dividers
- optional ruler / wrap guide
- optional lyric/chord alignment guides
- current line highlight
- highlight matching bracket/brace

---

# 4) Context menu ideas

A right-click context menu could be very useful.

## On selected lyrics

- Insert chord before selection
- Wrap selection with chord
- Add repeated phrase marker
- Convert selection to comment/header
- Duplicate selection as chorus/tag

## On a line

- Convert line to `{comment: ...}`
- Insert line above
- Insert line below
- Duplicate section
- Delete section
- Move section up
- Move section down

## On a section header

- Rename section
- Duplicate section
- Collapse section
- Reorder section
- Mark section as instrumental

## On top directives
n- Insert title
- Insert artist
- Insert key
- Insert tempo
- Normalize directive order
- Remove duplicate directives

## On chords

- Transpose chord up
- Transpose chord down
- Convert enharmonic spelling
- Convert slash chord formatting
- Normalize capitalization

---

# 5) Keyboard shortcut ideas

Keyboard shortcuts could make this editor dramatically faster.

## Core editing shortcuts

- `Ctrl+S` / `Cmd+S`
  - save song
- `Ctrl+/`
  - toggle selected line(s) into `{comment: ...}` or out of it
- `Ctrl+Shift+V`
  - insert Verse section
- `Ctrl+Shift+C`
  - insert Chorus section
- `Ctrl+Shift+B`
  - insert Bridge section
- `Ctrl+Shift+I`
  - insert Intro
- `Ctrl+Shift+O`
  - insert Outro

## Chord shortcuts

- `Ctrl+K`
  - insert chord on current selection
- `Alt+Up`
  - transpose selected chord / line up
- `Alt+Down`
  - transpose selected chord / line down
- `Ctrl+Alt+Up`
  - transpose entire document up
- `Ctrl+Alt+Down`
  - transpose entire document down

## Formatting shortcuts

- `Tab`
  - indent line or section
- `Shift+Tab`
  - outdent line or section
- `Ctrl+Shift+L`
  - normalize whitespace / line spacing
- `Ctrl+Shift+F`
  - format document
- `Ctrl+D`
  - duplicate current line or section

## Navigation shortcuts

- `Ctrl+1`
  - jump to first verse
- `Ctrl+2`
  - jump to chorus
- `Ctrl+3`
  - jump to bridge
- `F1`
  - open editor help
- `Ctrl+P`
  - quick jump to section by name

## Advanced shortcuts

- `Ctrl+Shift+M`
  - insert metadata block
- `Ctrl+Shift+R`
  - show renderer preview
- `Ctrl+Shift+H`
  - toggle helper panel
- `Ctrl+Space`
  - open insert command palette

---

# 6) Insert menu / command palette ideas

A command palette would be excellent.

Something like:

- Insert Verse
- Insert Chorus
- Insert Bridge
- Insert Tag
- Insert Intro
- Insert Outro
- Insert Instrumental
- Insert Metadata Block
- Insert Capo directive
- Insert Time Signature directive
- Insert Subtitles / alternate title
- Insert repeat markers
- Insert page break marker
- Insert rehearsal note

This could be opened from:

- toolbar button
- `/` slash command style
- `Ctrl+Space`

---

# 7) Help section ideas

The user asked about a help section below. That is a very good idea.

## Option A: Always-visible help panel below editor

This could show:

- Common ChordPro examples
- Shortcuts list
- Insert examples
- Tips for best formatting
- Section examples
- Directive examples

### Pros

- Very discoverable
- Great for beginners
- Easy to scan while editing

### Cons

- Takes vertical space
- Can feel noisy for advanced users

---

## Option B: Collapsible “Editor Help” section below

Probably the best default.

Sections inside it:

- **Quick Tips**
- **Keyboard Shortcuts**
- **Common Directives**
- **Section Templates**
- **Chord Entry Tips**
- **Examples**

This could remember open/closed state.

---

## Option C: Side panel help drawer

A right-side help drawer could contain:

- syntax guide
- shortcuts
- insert tools
- quick templates
- validation problems

This is especially good on desktop.

---

## Option D: Contextual help based on cursor position

Very powerful later.

Examples:

- Cursor in top metadata area → show directive help
- Cursor in section header → show section tools
- Selected lyric text → show chord insertion tips
- Invalid syntax → show how to fix it

---

# 8) Help content ideas

## Quick tips block

Possible content:

- Select a word, then add a chord to place it before the lyric
- Use section markers like `{comment: Chorus}` to structure songs
- Keep metadata at the top: title, artist, key, tempo
- Use consistent section names so the renderer stays clean
- Preview often to catch spacing and formatting issues

## Common directive cheat sheet

Examples:

- `{title: Amazing Grace}`
- `{artist: John Newton}`
- `{key: G}`
- `{tempo: 72}`
- `{comment: Verse 1}`
- `{comment: Chorus}`

## Section templates

Examples users can click to insert:

- Verse template
- Chorus template
- Bridge template
- Intro/Outro template
- Full song skeleton

## Keyboard shortcuts cheat sheet

Grouped by:

- editing
- insert
- navigation
- transpose
- formatting

## “Why this matters” tips

Examples:

- Consistent section labels help live navigation later
- Clean directives improve export quality
- Accurate key and tempo help the team prepare faster

---

# 9) Preview enhancements tied to the editor

A stronger editor usually needs a stronger preview.

## Live split view

- Editor on left
- Preview on right
- Scroll sync optional

## Toggle modes

- Edit only
- Preview only
- Split view
- Focus mode

## Preview options

- Show/hide chords
- Nashville view
- Transpose preview without changing source
- Print preview
- Mobile/tablet preview

## Live validation preview

- Warn when preview rendering differs from expected structure
- Highlight the current editor section in preview
- Click preview section to jump editor cursor there

---

# 10) Smart formatting and automation ideas

## Auto-format document

A formatter could:

- normalize directive order
- normalize blank lines
- standardize section labels
- trim trailing whitespace
- fix inconsistent spacing around directives
- normalize chord casing and spacing

## Template library

Templates could include:

- standard worship song skeleton
- hymn layout
- verse/chorus/bridge pop structure
- instrumental chart template
- acoustic arrangement template

## Reusable snippets

Examples:

- verse snippet
- chorus snippet
- bridge snippet
- call-and-response snippet
- repeat / tag snippet

## Intelligent suggestions

Potential future smart helpers:

- suggest section names based on repeated content
- detect likely chorus from repeated lines
- suggest missing metadata
- detect duplicate lines and offer a chorus extraction
- detect malformed chord spellings and suggest fixes

---

# 11) Editing workflow ideas for musicians

## Section organizer mode

A separate structured view above or beside the editor:

- Verse 1
- Chorus
- Verse 2
- Chorus
- Bridge
- Chorus

Actions:

- drag to reorder
- duplicate section
- rename section
- collapse/expand section
- jump to section

## Arrangement mode

Let a user build an arrangement without changing core lyrics.

Examples:

- Song content stays canonical
- Arrangement defines order:
  - Intro
  - Verse 1
  - Chorus
  - Verse 2
  - Chorus x2
  - Bridge
  - Chorus

This could pair very well with variations.

## Rehearsal notes layer

Optional editor-side notes not embedded in the main ChordPro text:

- “Piano starts alone”
- “Drums in at chorus”
- “Repeat bridge softly”

This is now implemented as a parallel collaboration layer on SongViewPage alongside per-section comment threads and rehearsal markers, so teams can keep rehearsal context outside the canonical ChordPro source.

---

# 12) Accessibility and usability ideas

## Accessibility improvements

- keyboard-first controls
- strong focus states
- large touch targets on tablet
- high contrast syntax themes
- screen-reader labels for insert actions
- help content that explains each action plainly

## Tablet-friendly editing

- larger insert buttons
- sticky toolbar
- quick-access section chips
- bottom sheet insert menu
- easier touch selection behavior

## Beginner / advanced modes

- **Beginner mode**
  - fewer controls
  - obvious help
  - examples shown by default
- **Advanced mode**
  - shortcuts
  - structured insert tools
  - power-user commands
  - less visual clutter

---

# 13) Suggested phased roadmap

## Phase 1: High value, low risk

- Add collapsible help section below the editor
- Add keyboard shortcut help
- Add more insert items
- Add syntax coloring for chords/directives/comments
- Add inline validation warnings
- Add clickable templates/snippets

## Phase 2: Power-user improvements

- Add command palette
- Add formatting command
- Add line numbers and section navigation
- Add split view preview
- Add context menu insert tools
- Add shortcut-driven section insertion

## Phase 3: Advanced editing system

- Move to richer code-editor foundation ✅ *(advanced mode now uses a CodeMirror 6 surface while beginner mode keeps the textarea fallback for compatibility and simpler onboarding)*
- Add structured section organizer ✅ *(advanced-mode organizer panel with previews, jump-to-line, and duplicate actions implemented)*
- Add drag/drop section reordering ✅ *(organizer cards now reorder the underlying ChordPro source while preserving metadata)*
- Add duplicate section workflow ✅ *(sections duplicate inline with auto-numbered labels such as Verse 2 / Chorus 2)*
- Add section folding/collapse ✅ *(collapsed sections now render as condensed placeholders in a temporary read-only editor view until expanded)*
- Add smart suggestions ✅ *(metadata nudges, section naming, likely chorus detection, chord spelling fixes implemented on the current editor foundation)*
- Add arrangement mode ✅ *(SongEditPage now builds arrangement sequences, supports repeat markers, previews the generated chart, and saves it as a variation)*
- Add contextual help system ✅ *(cursor-aware help cards + inline validation fixes implemented)*

---

# 14) Best overall recommendation

If we want the biggest win without overbuilding immediately, the best next package is probably:

## Recommended first bundle

- **Syntax highlighting** for chords, directives, and comments
- **Collapsible help section below the editor**
- **Keyboard shortcuts** for section insert and chord insertion
- **Command snippets/templates**
- **Inline validation warnings**
- **Split editor/preview toggle**

That combination would make the editor feel much more polished very quickly.

---

# 15) Practical UI concept

A possible final layout could be:

## Top toolbar

- Insert Section
- Insert Directive
- Templates
- Preview toggle
- Format
- Help

## Main editor area

- syntax-colored editing surface
- line numbers
- section highlighting
- inline warnings

## Right-side optional panel

- live preview
- problems
- quick section list

## Bottom collapsible help

- shortcuts
- examples
- directive cheat sheet
- tips

---

# 16) Questions for the next pass

When we turn this brainstorm into implementation decisions, these are the key questions:

- Do we want to stay with a textarea-based editor, or move to a richer editor component?
- Do we want the help section always visible, collapsible, or in a side drawer?
- Which shortcuts should be universal and which should be optional?
- Should formatting be automatic or manual?
- Should section organization stay text-first, or become structured?
- How much tablet optimization do we want in the first round?
- Should arrangement editing live inside the song editor, or inside variations?

---

# 17) Short summary

The ChordPro editor could become significantly better by focusing on four pillars:

- **Visual clarity** — syntax colors, warnings, section emphasis
- **Faster editing** — shortcuts, context actions, templates, command palette
- **Better guidance** — help panel, examples, tips, cheat sheets
- **Better workflow** — split preview, formatting tools, section organization

If we do that well, the editor stops feeling like a plain text box and starts feeling like a purpose-built worship chart editor.
