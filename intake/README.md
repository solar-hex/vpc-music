# `intake/` — drop anything here

One place for loose files: PDFs, Word documents, `.chrd`, `.onsong`, audio,
whatever turns up in an email or a shared folder. Put it in `inbox/` and run:

```bash
pnpm intake            # dry run — says what it would do, moves nothing
pnpm intake --apply    # files everything and records the decision
```

Every file leaves the inbox for exactly one of these:

| Folder | What it means |
|---|---|
| `processed/` | Converted to a chart. Point `corpus:build` at it to add to the library. |
| `duplicate/` | The library already has this song. The log names the match, and says whether it was exact or only probable. |
| `media/` | Audio, images, or a PDF that is engraved notation with no text. `corpus:media` uploads these. |
| `rejected/` | Nothing here can read it. A `.why.txt` sits beside the file with the reason. |

`log.ndjson` is append-only: one line per decision, with the file's hash, so
you can always see what happened to something and when.

## What it will not do

- **Unpack archives.** A `.zip` is rejected with a note — extract it and drop
  the contents in, so you can see what you are adding.
- **Decide a close call.** A title that is merely *similar* to one in the
  library is filed as `duplicate` and flagged `probable`, never deleted.
- **Convert a chord-chart PDF.** Those carry real text, but the extractor is
  not built yet, so they go to `media/` with a note rather than being silently
  dropped.
- **Overwrite anything.** A second file with the same name is filed as
  `name (2).ext`.

Nothing in here is committed except this README — the folders are a workspace,
not a record. The record is the corpus.
