import { useEffect, useMemo, useRef, useState, type ChangeEvent, type FormEvent } from "react";
import { Link, useBeforeUnload, useBlocker, useLocation, useNavigate, useParams } from "react-router-dom";
import { toast } from "sonner";
import { ArrowLeft, Save, Upload } from "lucide-react";
import { songsApi, type DuplicateSongMatch, type Song, type SongVariation } from "@/lib/api-client";
import { useAuth } from "@/contexts/AuthContext";
import { useConnectivity } from "@/contexts/ConnectivityContext";
import { ChordProEditor } from "@/components/songs/ChordProEditor";
import { TagInput } from "@/components/songs/TagInput";
import { AdvancedSongProperties } from "@/components/songs/AdvancedSongProperties";
import { SongFilesSection } from "@/components/songs/SongFilesSection";
import { TapTempoPad } from "@/components/songs/TapTempoPad";
import { hasDirective, readDirective } from "@/lib/chart-directives";
import { ConfirmDialog } from "@/components/shared/ConfirmDialog";
import { ResponsiveModal } from "@/components/ui/ResponsiveModal";
import { invalidateSongLibrary } from "@/hooks/useSongLibrary";
import { bulkImport, IMPORT_ACCEPT, IMPORT_FORMATS_LABEL, previewImportFile, type BulkImportItem, type ImportPreview } from "@/lib/song-import";
import { enqueueOfflineSongEdit, isOfflineRequestError, loadCachedSong, saveCachedSong } from "@/lib/offline-cache";
import { CHROMATIC_FLAT, CHROMATIC_SHARP, formatTagField, parseTagField, themeLabel } from "@vpc-music/shared";
import { useTheme } from "@/contexts/ThemeContext";

/** The plain tags a person typed, from the comma-separated input. */
function splitPlainTags(value: string): string[] {
  return value
    .split(",")
    .map((tag) => tag.trim())
    .filter(Boolean);
}
type PendingInterruption = { type: "leave-page" } | { type: "replace-import"; files: File[] };

type ConflictState = {
  currentSong: Song;
  pendingSongData: Partial<Song>;
};


/**
 * Create or edit a song: a short metadata form, one ChordPro editor, and a
 * file import. Unsaved changes are guarded; edits made offline are queued.
 */
export function SongEditPage() {
  const { id } = useParams<{ id: string }>();
  const isNew = !id;
  const navigate = useNavigate();
  const location = useLocation();
  const { user, activeOrg } = useAuth();
  const { isOnline, refreshPendingOfflineEditCount } = useConnectivity();
  const canEdit = user?.role === "owner" || activeOrg?.role === "admin" || activeOrg?.role === "musician";
  const backHref = id ? `/songs/${id}` : "/songs";

  const [title, setTitle] = useState("");
  const [key, setKey] = useState("");
  const { keyNotation } = useTheme();
  const keyOptions = useMemo(() => {
    const roots = keyNotation === "sharps" ? CHROMATIC_SHARP : CHROMATIC_FLAT;
    const options = [...roots, ...roots.map((root) => `${root}m`)];
    // A stored key spelled the other way stays selectable.
    if (key && !options.includes(key)) options.unshift(key);
    return options;
  }, [keyNotation, key]);
  const [tempo, setTempo] = useState("");
  const [artist, setArtist] = useState("");
  const [year, setYear] = useState("");
  // `tags` holds only the plain, human tags. The machine-maintained
  // namespaces live in `derivedTags` and are written straight back on save.
  const [tags, setTags] = useState("");
  const [derivedTags, setDerivedTags] = useState<{ themes: string[]; negated: string[]; flags: string[] }>({
    themes: [],
    negated: [],
    flags: [],
  });
  const [content, setContent] = useState("");
  const [isDraft, setIsDraft] = useState(false);
  const [loading, setLoading] = useState(!isNew);
  const [saving, setSaving] = useState(false);
  const [songRecord, setSongRecord] = useState<Song | null>(null);
  const [variations, setVariations] = useState<SongVariation[]>([]);
  const [importPreview, setImportPreview] = useState<{ filename: string; sourceLabel: string } | null>(null);
  const [bulkItems, setBulkItems] = useState<BulkImportItem[]>([]);
  const [bulkCompleted, setBulkCompleted] = useState(0);
  const [bulkCurrentFile, setBulkCurrentFile] = useState("");
  const [isBulkImporting, setIsBulkImporting] = useState(false);
  const [duplicateMatches, setDuplicateMatches] = useState<DuplicateSongMatch[]>([]);
  const [checkingDuplicates, setCheckingDuplicates] = useState(false);
  const [pendingInterruption, setPendingInterruption] = useState<PendingInterruption | null>(null);
  const [conflict, setConflict] = useState<ConflictState | null>(null);
  const [resolvingConflict, setResolvingConflict] = useState(false);
  const allowNavigationRef = useRef(false);
  const formRef = useRef<HTMLFormElement>(null);

  const metadata = useMemo(() => ({ title, artist, key, tempo }), [title, artist, key, tempo]);

  const initialFormState = useMemo(
    () => ({
      title: songRecord?.title || "",
      key: songRecord?.key || "",
      tempo: songRecord?.tempo ? String(songRecord.tempo) : "",
      artist: songRecord?.artist || "",
      year: songRecord?.year || "",
      tags: parseTagField(songRecord?.tags).tags.join(", "),
      content: songRecord?.content || "",
      isDraft: Boolean(songRecord?.isDraft),
    }),
    [songRecord],
  );
  const currentFormState = useMemo(
    () => ({ title, key, tempo, artist, year, tags, content, isDraft }),
    [title, key, tempo, artist, year, tags, content, isDraft],
  );
  const isDirty = useMemo(() => {
    if (isNew) return Boolean(title.trim() || key || tempo || artist.trim() || year.trim() || tags.trim() || content.trim() || isDraft);
    return JSON.stringify(currentFormState) !== JSON.stringify(initialFormState);
  }, [isNew, title, key, tempo, artist, year, tags, content, isDraft, currentFormState, initialFormState]);
  const shouldWarnOnLeave = isDirty && !saving && !allowNavigationRef.current;

  useBeforeUnload(
    (event) => {
      if (!shouldWarnOnLeave) return;
      event.preventDefault();
      event.returnValue = "";
    },
    { capture: true },
  );
  const blocker = useBlocker(shouldWarnOnLeave);

  useEffect(() => {
    if (blocker.state === "blocked") setPendingInterruption({ type: "leave-page" });
  }, [blocker]);

  // Observers cannot edit
  useEffect(() => {
    if (canEdit) return;
    toast.error("You don't have permission to edit songs");
    navigate(backHref, { replace: true });
  }, [canEdit, backHref, navigate]);

  const applySongFormValues = (song: Song) => {
    setSongRecord(song);
    setTitle(song.title || "");
    setKey(song.key || "");
    setTempo(song.tempo ? String(song.tempo) : "");
    setArtist(song.artist || "");
    setYear(song.year || "");
    const parsedTags = parseTagField(song.tags);
    setTags(parsedTags.tags.join(", "));
    setDerivedTags({ themes: parsedTags.themes, negated: parsedTags.negated, flags: parsedTags.flags });
    setContent(song.content || "");
    setIsDraft(Boolean(song.isDraft));
  };

  const applyImportPreview = (preview: ImportPreview) => {
    setTitle(preview.metadata.title || "");
    setArtist(preview.metadata.artist || "");
    setKey(preview.metadata.key || "");
    setTempo(preview.metadata.tempo ? String(preview.metadata.tempo) : "");
    setYear(preview.metadata.year || "");
    setContent(preview.chordPro);
    setImportPreview({ filename: preview.filename, sourceLabel: preview.sourceLabel });
  };

  // A file chosen from the song list arrives here as navigation state.
  useEffect(() => {
    const preview = (location.state as { importPreview?: ImportPreview } | null)?.importPreview;
    if (isNew && preview) applyImportPreview(preview);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Load the existing song
  useEffect(() => {
    if (!id) return;
    songsApi
      .get(id)
      .then((res) => {
        saveCachedSong(res);
        setVariations(res.variations || []);
        applySongFormValues(res.song);
      })
      .catch((error) => {
        const cached = loadCachedSong(id);
        if (cached && isOfflineRequestError(error)) {
          setVariations(cached.response.variations || []);
          applySongFormValues(cached.response.song);
          toast.info("Loaded the cached song for offline editing");
          return;
        }
        toast.error("Song not found");
      })
      .finally(() => setLoading(false));
  }, [id]);

  // Duplicate check for new songs: the classic double-entry guard
  useEffect(() => {
    if (!isNew) return;
    const normalizedTitle = title.trim();
    const normalizedContent = content.trim();
    const enoughContent = normalizedContent.split(/\s+/).filter(Boolean).length >= 8;
    if (normalizedTitle.length < 3 && !enoughContent) {
      setDuplicateMatches([]);
      setCheckingDuplicates(false);
      return;
    }
    let cancelled = false;
    setCheckingDuplicates(true);
    const timeout = window.setTimeout(() => {
      songsApi
        .findDuplicates({ title: normalizedTitle || undefined, content: enoughContent ? normalizedContent : undefined })
        .then((res) => {
          if (!cancelled) setDuplicateMatches(res.matches);
        })
        .catch(() => {
          if (!cancelled) setDuplicateMatches([]);
        })
        .finally(() => {
          if (!cancelled) setCheckingDuplicates(false);
        });
    }, 350);
    return () => {
      cancelled = true;
      window.clearTimeout(timeout);
    };
  }, [isNew, title, content]);

  const pendingSongData = (): Partial<Song> => ({
    title: title.trim(),
    key: key || undefined,
    tempo: tempo ? Number(tempo) : undefined,
    artist: artist.trim() || undefined,
    year: year.trim() || undefined,
    // Only the plain tags are editable here. Themes, the tombstones that
    // record a rejected theme, and flags are machine-maintained by the corpus
    // loader, so they are carried through untouched: writing back just what
    // the pills show would silently delete them.
    tags: formatTagField({ ...derivedTags, tags: splitPlainTags(tags) }) || undefined,
    // Alternate titles live in the chart as {x_aka:}; the song list searches a
    // column. Sent whenever the chart has the line or had it when the song was
    // opened, so adding, changing and removing all reach search, and a song
    // that never had one is left alone.
    ...(hasDirective(content, "x_aka") || hasDirective(songRecord?.content ?? "", "x_aka")
      ? { aka: readDirective(content, "x_aka").trim() || null }
      : {}),
    content,
    isDraft,
  });

  const finishAndOpen = (songId: string) => {
    invalidateSongLibrary();
    allowNavigationRef.current = true;
    navigate(`/songs/${songId}`);
  };

  const saveOfflineEdit = () => {
    if (!id || !songRecord || !activeOrg?.id) return false;
    const data = pendingSongData();
    enqueueOfflineSongEdit({
      songId: id,
      songTitle: title.trim() || songRecord.title,
      organizationId: activeOrg.id,
      lastKnownUpdatedAt: songRecord.updatedAt ?? null,
      songData: data,
    });
    const cachedSong: Song = { ...songRecord, ...data, updatedAt: songRecord.updatedAt || new Date().toISOString() };
    saveCachedSong({ song: cachedSong, variations });
    applySongFormValues(cachedSong);
    refreshPendingOfflineEditCount();
    toast.success("Saved on this device; it will sync when you reconnect");
    allowNavigationRef.current = true;
    navigate(`/songs/${id}`);
    return true;
  };

  const handleSubmit = async (event: FormEvent) => {
    event.preventDefault();
    if (!title.trim()) {
      toast.error("Title is required");
      return;
    }
    setSaving(true);
    try {
      const data = pendingSongData();
      if (isNew) {
        if (!isOnline) {
          toast.error("Creating a song needs a connection");
          return;
        }
        const res = await songsApi.create(data);
        toast.success("Song created");
        finishAndOpen(res.song.id);
        return;
      }
      if (!isOnline || !navigator.onLine) {
        if (saveOfflineEdit()) return;
      }
      await songsApi.update(id!, { ...data, lastKnownUpdatedAt: songRecord?.updatedAt });
      toast.success("Song saved");
      finishAndOpen(id!);
    } catch (error: any) {
      if (!isNew && isOfflineRequestError(error) && saveOfflineEdit()) return;
      if (!isNew && error?.status === 409 && error?.body?.currentSong) {
        setConflict({ currentSong: error.body.currentSong, pendingSongData: pendingSongData() });
        return;
      }
      toast.error(error?.message || "Failed to save");
    } finally {
      setSaving(false);
    }
  };

  const overwriteConflict = async () => {
    if (!id || !conflict) return;
    setResolvingConflict(true);
    try {
      await songsApi.update(id, { ...conflict.pendingSongData, forceOverwrite: true });
      toast.success("Song saved");
      setConflict(null);
      finishAndOpen(id);
    } catch (error: any) {
      toast.error(error?.message || "Failed to save");
    } finally {
      setResolvingConflict(false);
    }
  };

  const reloadTheirVersion = () => {
    if (!conflict) return;
    applySongFormValues(conflict.currentSong);
    setConflict(null);
    toast.info("Loaded the latest version of the song");
  };

  const processImportFiles = async (files: File[]) => {
    if (files.length === 1) {
      try {
        applyImportPreview(await previewImportFile(files[0]));
        toast.success("File loaded. Review the chart, then save.");
      } catch (error: any) {
        toast.error(error?.message || "Import failed");
      }
      return;
    }
    setIsBulkImporting(true);
    setBulkItems(files.map((file) => ({ filename: file.name, status: "pending" })));
    setBulkCompleted(0);
    const result = await bulkImport(files, (items, completed, currentFile) => {
      setBulkItems(items);
      setBulkCompleted(completed);
      setBulkCurrentFile(currentFile);
    });
    setIsBulkImporting(false);
    setBulkCurrentFile("");
    invalidateSongLibrary();
    if (result.successCount > 0) toast.success(`Imported ${result.successCount} of ${files.length} files`);
    else toast.error("None of the files could be imported");
  };

  const handleImport = async (event: ChangeEvent<HTMLInputElement>) => {
    const files = Array.from(event.target.files || []);
    event.target.value = "";
    if (files.length === 0) return;
    if (isDirty) {
      setPendingInterruption({ type: "replace-import", files });
      return;
    }
    await processImportFiles(files);
  };

  const confirmInterruption = async () => {
    const interruption = pendingInterruption;
    setPendingInterruption(null);
    if (!interruption) return;
    if (interruption.type === "leave-page") {
      allowNavigationRef.current = true;
      blocker.proceed?.();
      return;
    }
    await processImportFiles(interruption.files);
  };

  const cancelInterruption = () => {
    if (pendingInterruption?.type === "leave-page" && blocker.state === "blocked") blocker.reset();
    setPendingInterruption(null);
  };

  if (loading) {
    return (
      <div className="flex justify-center py-12">
        <div className="spinner" />
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center gap-2">
        <Link to={backHref} className="btn-icon btn-ghost h-11 w-11" aria-label="Back">
          <ArrowLeft className="h-5 w-5" />
        </Link>
        <h1 className="page-title">{isNew ? "New Song" : "Edit Song"}</h1>
      </div>

      <form ref={formRef} onSubmit={handleSubmit} className="space-y-4">
        <div className="grid gap-3 sm:grid-cols-2">
          <label className="block text-sm sm:col-span-2">
            <span className="mb-1 block text-[hsl(var(--muted-foreground))]">Title *</span>
            <input value={title} onChange={(event) => setTitle(event.target.value)} className="input w-full" aria-label="Title" />
          </label>
          <label className="block text-sm">
            <span className="mb-1 block text-[hsl(var(--muted-foreground))]">Artist</span>
            <input value={artist} onChange={(event) => setArtist(event.target.value)} className="input w-full" aria-label="Artist" />
          </label>
          <label className="block text-sm">
            <span className="mb-1 block text-[hsl(var(--muted-foreground))]">Year</span>
            <input value={year} onChange={(event) => setYear(event.target.value)} className="input w-full" aria-label="Year" placeholder="1779" />
          </label>
          <label className="block text-sm">
            <span className="mb-1 block text-[hsl(var(--muted-foreground))]">Key</span>
            <select value={key} onChange={(event) => setKey(event.target.value)} className="select w-full" aria-label="Key">
              <option value="">No key</option>
              {keyOptions.map((option) => (
                <option key={option} value={option}>
                  {option}
                </option>
              ))}
            </select>
          </label>
          <div className="text-sm">
            <label htmlFor="song-tempo" className="mb-1 block text-[hsl(var(--muted-foreground))]">Tempo (BPM)</label>
            <div className="flex flex-wrap items-center gap-2">
              <input id="song-tempo" type="number" min={20} max={300} value={tempo} onChange={(event) => setTempo(event.target.value)} className="input w-24" aria-label="Tempo" />
              <TapTempoPad onTempo={(bpm) => setTempo(String(bpm))} />
            </div>
          </div>
          <div className="text-sm sm:col-span-2">
            <span className="mb-1 block text-[hsl(var(--muted-foreground))]">Tags</span>
            <TagInput value={tags} onChange={setTags} />
            {derivedTags.themes.length > 0 && (
              <p className="mt-1.5 text-xs text-[hsl(var(--muted-foreground))]">
                Themes found in the lyrics: {derivedTags.themes.map(themeLabel).join(", ")}. These are kept automatically.
              </p>
            )}
          </div>
          <AdvancedSongProperties content={content} onChange={setContent} />
          <SongFilesSection songId={id ?? null} content={content} savedContent={songRecord?.content ?? ""} onContentChange={setContent} />
        </div>

        <label className="flex items-center gap-2 text-sm">
          <input type="checkbox" checked={isDraft} onChange={(event) => setIsDraft(event.target.checked)} />
          Save as draft (hidden from the song list unless drafts are shown)
        </label>

        {isNew && (checkingDuplicates || duplicateMatches.length > 0) && (
          <div className="card card-body space-y-2" data-testid="duplicate-detection-card">
            <h3 className="text-sm font-semibold">Possible duplicates</h3>
            {duplicateMatches.length === 0 ? (
              <p className="text-xs text-[hsl(var(--muted-foreground))]">Checking the library…</p>
            ) : (
              <ul className="space-y-1 text-sm">
                {duplicateMatches.map((match) => (
                  <li key={match.id}>
                    <Link to={`/songs/${match.id}`} className="text-[hsl(var(--secondary))] hover:underline">
                      {match.title}
                    </Link>
                    {match.artist ? <span className="text-[hsl(var(--muted-foreground))]"> · {match.artist}</span> : null}
                  </li>
                ))}
              </ul>
            )}
          </div>
        )}

        <div className="card card-body flex flex-wrap items-center gap-3">
          <label className="btn-outline cursor-pointer gap-2">
            <Upload className="h-4 w-4" />
            Import file
            <input type="file" accept={IMPORT_ACCEPT} multiple onChange={handleImport} disabled={isBulkImporting} className="sr-only" data-testid="song-import-input" />
          </label>
          <span className="text-xs text-[hsl(var(--muted-foreground))]">
            One file loads here to review; several files import straight into the library. Formats: {IMPORT_FORMATS_LABEL}.
          </span>
        </div>

        {(isBulkImporting || bulkItems.length > 0) && (
          <div className="card card-body space-y-2" data-testid="bulk-import-status">
            <div className="flex items-center justify-between text-xs text-[hsl(var(--muted-foreground))]">
              <span>
                {bulkCompleted} of {bulkItems.length} done{bulkCurrentFile ? ` · importing ${bulkCurrentFile}` : ""}
              </span>
              <span>{bulkItems.filter((item) => item.status === "success").length} imported</span>
            </div>
            <ul className="space-y-1 text-sm">
              {bulkItems.map((item) => (
                <li key={item.filename} className="flex items-center justify-between gap-3">
                  <span className="truncate">{item.filename}</span>
                  {item.status === "success" && item.songId ? (
                    <Link to={`/songs/${item.songId}`} className="shrink-0 text-[hsl(var(--secondary))] hover:underline">
                      Open song
                    </Link>
                  ) : (
                    <span className={`shrink-0 text-xs ${item.status === "error" ? "text-[hsl(var(--destructive))]" : "text-[hsl(var(--muted-foreground))]"}`}>
                      {item.status === "error" ? item.message : item.status === "processing" ? "Importing…" : item.status === "pending" ? "Waiting" : item.message}
                    </span>
                  )}
                </li>
              ))}
            </ul>
          </div>
        )}

        {importPreview && (
          <div className="rounded-md border border-[hsl(var(--secondary))]/40 bg-[hsl(var(--secondary))]/10 px-3 py-2 text-sm" data-testid="import-preview-card">
            Loaded from {importPreview.filename} via {importPreview.sourceLabel}. Review the chart below, then save.
          </div>
        )}

        <ChordProEditor value={content} onChange={setContent} metadata={metadata} onSave={() => formRef.current?.requestSubmit()} />

        <div className="flex flex-wrap gap-3">
          <button type="submit" className="btn-primary gap-2" disabled={saving}>
            <Save className="h-4 w-4" />
            {saving ? "Saving..." : isNew ? "Create Song" : "Update Song"}
          </button>
          <Link to={backHref} className="btn-outline">
            Cancel
          </Link>
        </div>
      </form>

      <ConfirmDialog
        open={pendingInterruption?.type === "leave-page"}
        title="Discard unsaved changes?"
        description="Your edits will be lost if you leave now."
        confirmLabel="Leave without saving"
        onConfirm={confirmInterruption}
        onClose={cancelInterruption}
      />
      <ConfirmDialog
        open={pendingInterruption?.type === "replace-import"}
        title="Replace what you have typed?"
        description="The imported file will replace the current form contents."
        confirmLabel="Replace"
        destructive={false}
        onConfirm={confirmInterruption}
        onClose={cancelInterruption}
      />
      <ResponsiveModal
        open={conflict !== null}
        onClose={() => setConflict(null)}
        title="This song changed while you were editing"
        description="Someone else saved this song after you opened it. Reload their version to see it, or overwrite it with yours."
      >
        <div className="flex flex-wrap justify-end gap-3">
          <button type="button" onClick={reloadTheirVersion} className="btn-outline" disabled={resolvingConflict}>
            Reload their version
          </button>
          <button type="button" onClick={() => void overwriteConflict()} className="btn-primary" disabled={resolvingConflict}>
            {resolvingConflict ? "Saving..." : "Overwrite with mine"}
          </button>
        </div>
      </ResponsiveModal>
    </div>
  );
}
