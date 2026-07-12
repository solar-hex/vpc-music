import { useState, useEffect, useMemo, useRef } from "react";
import { useParams, useNavigate, Link, useSearchParams, useBeforeUnload, useBlocker } from "react-router-dom";
import { songsApi, variationsApi, type DuplicateSongMatch, type Song, type SongVariation } from "@/lib/api-client";
import { useAuth } from "@/contexts/AuthContext";
import { useConnectivity } from "@/contexts/ConnectivityContext";
import { ALL_KEYS, parseChordPro } from "@vpc-music/shared";
import { toast } from "sonner";
import { ArrowLeft, Save, Upload, Layers } from "lucide-react";
import { ConfirmDialog } from "@/components/shared/ConfirmDialog";
import { ChordProEditor } from "@/components/songs/ChordProEditor";
import { ChordProRenderer } from "@/components/songs/ChordProRenderer";
import { StaffNotationEditor } from "@/components/songs/StaffNotation";
import { ArrangementBuilder } from "@/components/songs/ArrangementBuilder";
import { TagInput } from "@/components/songs/TagInput";
import { enqueueOfflineSongEdit, isOfflineRequestError, loadCachedSong, saveCachedSong } from "@/lib/offline-cache";
import { buildArrangementContent, buildArrangementSummary, getArrangementSectionChoices, type ArrangementItem } from "@/utils/chordpro-arrangement";

type BulkImportItem = {
  filename: string;
  status: "pending" | "processing" | "success" | "error";
  songId?: string;
  songTitle?: string;
  message?: string;
};

type ImportPreviewState = {
  filename: string;
  sourceLabel: string;
};

type PendingEditInterruption =
  | { type: "leave-page" }
  | { type: "switch-variation"; variationId: string }
  | { type: "replace-import"; files: File[] };

type ConflictState = {
  currentSong: Song;
  pendingSongData: Partial<Song>;
  fieldSelections: Record<string, "mine" | "server">;
};

export function SongEditPage() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const { user, activeOrg } = useAuth();
  const { isOnline, refreshPendingOfflineEditCount } = useConnectivity();
  const canEdit = user?.role === "owner" || activeOrg?.role === "admin" || activeOrg?.role === "musician";
  const [searchParams, setSearchParams] = useSearchParams();
  const isNew = !id;
  const requestedVariationId = searchParams.get("variation");

  const [title, setTitle] = useState("");
  const [aka, setAka] = useState("");
  const [category, setCategory] = useState("");
  const [key, setKey] = useState("");
  const [tempo, setTempo] = useState("");
  const [artist, setArtist] = useState("");
  const [shout, setShout] = useState("");
  const [tags, setTags] = useState("");
  const [content, setContent] = useState("");
  const [abcNotation, setAbcNotation] = useState("");
  const [energyValue, setEnergyValue] = useState("");
  const [isDraft, setIsDraft] = useState(false);
  const [loading, setLoading] = useState(!isNew);
  const [saving, setSaving] = useState(false);
  const [songRecord, setSongRecord] = useState<Song | null>(null);
  const [variations, setVariations] = useState<SongVariation[]>([]);
  const [editingVariationId, setEditingVariationId] = useState<string | null>(null);
  const [bulkImportItems, setBulkImportItems] = useState<BulkImportItem[]>([]);
  const [bulkImportCompleted, setBulkImportCompleted] = useState(0);
  const [bulkImportCurrentFile, setBulkImportCurrentFile] = useState("");
  const [isBulkImporting, setIsBulkImporting] = useState(false);
  const [importPreview, setImportPreview] = useState<ImportPreviewState | null>(null);
  const [duplicateMatches, setDuplicateMatches] = useState<DuplicateSongMatch[]>([]);
  const [checkingDuplicates, setCheckingDuplicates] = useState(false);
  const [pendingInterruption, setPendingInterruption] = useState<PendingEditInterruption | null>(null);
  const [conflictState, setConflictState] = useState<ConflictState | null>(null);
  const [arrangementItems, setArrangementItems] = useState<ArrangementItem[]>([]);
  const [arrangementVariationName, setArrangementVariationName] = useState("");
  const [savingArrangement, setSavingArrangement] = useState(false);
  const allowNavigationRef = useRef(false);
  const formRef = useRef<HTMLFormElement>(null);

  const metadata = useMemo(
    () => ({ title, artist, key, tempo }),
    [title, artist, key, tempo],
  );
  const currentVariation = useMemo(
    () => variations.find((variation) => variation.id === editingVariationId) ?? null,
    [variations, editingVariationId],
  );
  const arrangementSections = useMemo(() => getArrangementSectionChoices(content), [content]);
  const arrangementSummary = useMemo(
    () => buildArrangementSummary(arrangementItems, arrangementSections),
    [arrangementItems, arrangementSections],
  );
  const arrangementPreviewContent = useMemo(
    () => buildArrangementContent(content, arrangementItems),
    [arrangementItems, content],
  );
  const initialFormState = useMemo(
    () => ({
      title: songRecord?.title || "",
      aka: songRecord?.aka || "",
      category: songRecord?.category || "",
      key: currentVariation?.key || songRecord?.key || "",
      tempo: songRecord?.tempo ? String(songRecord.tempo) : "",
      artist: songRecord?.artist || "",
      shout: songRecord?.shout || "",
      tags: songRecord?.tags || "",
      content: currentVariation?.content || songRecord?.content || "",
      abcNotation: songRecord?.abcNotation || "",
      isDraft: !!songRecord?.isDraft,
    }),
    [currentVariation, songRecord],
  );
  const currentFormState = useMemo(
    () => ({
      title,
      aka,
      category,
      key,
      tempo,
      artist,
      shout,
      tags,
      content,
      abcNotation,
      isDraft,
    }),
    [title, aka, category, key, tempo, artist, shout, tags, content, abcNotation, isDraft],
  );
  const isDirty = useMemo(() => {
    if (isNew) {
      return Boolean(title.trim() || aka.trim() || category.trim() || key || tempo || artist.trim() || shout.trim() || tags.trim() || content.trim() || abcNotation.trim() || isDraft);
    }

    return JSON.stringify(currentFormState) !== JSON.stringify(initialFormState);
  }, [aka, abcNotation, category, content, currentFormState, initialFormState, isDraft, isNew, key, tags, tempo, title, artist, shout]);
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

  const applySongFormValues = (song: Song) => {
    setSongRecord(song);
    setTitle(song.title || "");
    setAka(song.aka || "");
    setCategory(song.category || "");
    setTempo(song.tempo ? String(song.tempo) : "");
    setArtist(song.artist || "");
    setShout(song.shout || "");
    setTags(song.tags || "");
    if (!editingVariationId) {
      setKey(song.key || "");
      setContent(song.content || "");
    }
    setAbcNotation(song.abcNotation || "");
    setEnergyValue(song.energy ? String(song.energy) : "");
    setIsDraft(!!song.isDraft);
  };

  const getPendingSongData = () => ({
    title: title.trim(),
    aka: aka.trim() || undefined,
    category: category.trim() || undefined,
    tempo: tempo ? Number(tempo) : undefined,
    artist: artist.trim() || undefined,
    shout: shout.trim() || undefined,
    tags: tags.trim() || undefined,
    abcNotation: abcNotation.trim() || undefined,
    energy: /^[1-5]$/.test(energyValue) ? Number(energyValue) : null,
    isDraft,
    ...(currentVariation ? {} : { key: key || undefined, content }),
  });

  const summarizeConflictValue = (value: unknown) => {
    if (typeof value === "boolean") {
      return value ? "Yes" : "No";
    }

    const text = value == null || value === "" ? "—" : String(value);
    return text.length > 120 ? `${text.slice(0, 117)}...` : text;
  };

  const saveOfflineEdit = () => {
    if (!id || !songRecord || !activeOrg?.id) {
      return false;
    }

    if (currentVariation) {
      toast.error("Offline queueing is currently limited to the main song version");
      return false;
    }

    const pendingSongData = getPendingSongData();
    enqueueOfflineSongEdit({
      songId: id,
      songTitle: title.trim() || songRecord.title,
      organizationId: activeOrg.id,
      lastKnownUpdatedAt: songRecord.updatedAt ?? null,
      songData: pendingSongData,
    });

    const cachedSong: Song = {
      ...songRecord,
      ...pendingSongData,
      updatedAt: songRecord.updatedAt || new Date().toISOString(),
    };
    saveCachedSong({ song: cachedSong, variations });
    applySongFormValues(cachedSong);
    refreshPendingOfflineEditCount();
    toast.success("Song edit queued for sync when you reconnect");
    allowNavigationRef.current = true;
    navigate(`/songs/${id}`);
    return true;
  };

  useEffect(() => {
    setArrangementItems((current) => current.filter((item) => arrangementSections.some((section) => section.id === item.sectionId)));
  }, [arrangementSections]);

  useEffect(() => {
    if (!arrangementVariationName.trim()) {
      const baseTitle = title.trim() || songRecord?.title || "Song";
      setArrangementVariationName(`${baseTitle} Arrangement`);
    }
  }, [arrangementVariationName, songRecord?.title, title]);

  useEffect(() => {
    if (blocker.state !== "blocked") return;

    setPendingInterruption({ type: "leave-page" });
  }, [blocker]);

  // Redirect observers away from edit pages
  useEffect(() => {
    if (canEdit) return;
    toast.error("You don't have permission to edit songs");
    navigate(id ? `/songs/${id}` : "/songs", { replace: true });
  }, [canEdit, id, navigate]);

  // Load existing song
  useEffect(() => {
    if (!id) return;
    songsApi
      .get(id)
      .then((res) => {
        const s = res.song;
        saveCachedSong(res);
        setVariations(res.variations || []);
        applySongFormValues(s);
      })
      .catch((error) => {
        const cached = loadCachedSong(id);
        if (cached && isOfflineRequestError(error)) {
          setVariations(cached.response.variations || []);
          applySongFormValues(cached.response.song);
          toast.info("Loaded cached song for offline editing");
          return;
        }

        toast.error("Song not found");
      })
      .finally(() => setLoading(false));
  }, [id]);

  useEffect(() => {
    if (!songRecord) return;
    const selectedVariation = requestedVariationId
      ? variations.find((variation) => variation.id === requestedVariationId) ?? null
      : null;

    setEditingVariationId(selectedVariation?.id ?? null);
    setKey(selectedVariation?.key || songRecord.key || "");
    setContent(selectedVariation?.content || songRecord.content);
  }, [requestedVariationId, variations, songRecord]);

  const handleEditTargetChange = (variationId: string) => {
    if (shouldWarnOnLeave) {
      setPendingInterruption({ type: "switch-variation", variationId });
      return;
    }

    continueVariationSwitch(variationId);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!title.trim()) {
      toast.error("Title is required");
      return;
    }
    setSaving(true);
    try {
      const sharedSongData = getPendingSongData();

      if (isNew) {
        if (!isOnline) {
          toast.error("Creating new songs requires a connection");
          return;
        }

        const data: Partial<Song> = {
          ...sharedSongData,
          key: key || undefined,
          content,
        };
        const res = await songsApi.create(data);
        toast.success("Song created!");
        allowNavigationRef.current = true;
        navigate(`/songs/${res.song.id}`);
      } else if (currentVariation) {
        if (!isOnline) {
          toast.error("Variation edits require a connection right now");
          return;
        }

        await Promise.all([
          songsApi.update(id!, {
            ...sharedSongData,
            lastKnownUpdatedAt: songRecord?.updatedAt,
          }),
          variationsApi.update(id!, currentVariation.id, {
            content,
            key: key || undefined,
          }),
        ]);
        toast.success(`Updated variation: ${currentVariation.name}`);
        allowNavigationRef.current = true;
        navigate(`/songs/${id}?variation=${currentVariation.id}`);
      } else {
        const data: Partial<Song> = {
          ...sharedSongData,
          key: key || undefined,
          content,
        };
        if (!isOnline || !navigator.onLine) {
          if (saveOfflineEdit()) {
            return;
          }
        }

        await songsApi.update(id!, {
          ...data,
          lastKnownUpdatedAt: songRecord?.updatedAt,
        });
        toast.success("Song updated!");
        allowNavigationRef.current = true;
        navigate(`/songs/${id}`);
      }
    } catch (err: any) {
      if (!isNew && !currentVariation && isOfflineRequestError(err) && saveOfflineEdit()) {
        return;
      }

      if (!isNew && !currentVariation && err?.status === 409 && err?.body?.currentSong) {
        const pendingSongData = getPendingSongData();
        const changedFields = Object.keys(pendingSongData).filter((field) => pendingSongData[field as keyof typeof pendingSongData] !== undefined);
        setConflictState({
          currentSong: err.body.currentSong,
          pendingSongData,
          fieldSelections: Object.fromEntries(changedFields.map((field) => [field, "mine"])),
        });
        toast.error("This song changed since you opened it. Review the merge options.");
        return;
      }

      toast.error(err.message || "Failed to save");
    } finally {
      setSaving(false);
    }
  };

  const readFileText = async (file: File) => {
    if (typeof file.text === "function") {
      return file.text();
    }

    return new Promise<string>((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = () => resolve(String(reader.result || ""));
      reader.onerror = () => reject(reader.error || new Error("Failed to read file"));
      reader.readAsText(file);
    });
  };

  const getFileExtension = (filename: string) => filename.split(".").pop()?.toLowerCase() || "";

  const createSongFromChordProFile = async (file: File, chordProContent: string) => {
    const parsed = parseChordPro(chordProContent);
    const title = parsed.directives.title || parsed.directives.t || file.name.replace(/\.(cho|chordpro|chopro)$/i, "") || "Untitled";
    const artist = parsed.directives.artist || parsed.directives.a || undefined;
    const key = parsed.directives.key || parsed.directives.k || undefined;
    const tempoRaw = parsed.directives.tempo || "";
    const tempo = /^\d+$/.test(tempoRaw) ? Number(tempoRaw) : undefined;

    return songsApi.create({
      title,
      artist,
      key,
      tempo,
      content: chordProContent,
    });
  };

  const applyImportPreview = ({
    filename,
    sourceLabel,
    chordPro,
    previewMetadata,
  }: {
    filename: string;
    sourceLabel: string;
    chordPro: string;
    previewMetadata?: {
      title?: string | null;
      artist?: string | null;
      key?: string | null;
      tempo?: number | null;
    };
  }) => {
    setTitle(previewMetadata?.title || "");
    setArtist(previewMetadata?.artist || "");
    setKey(previewMetadata?.key || "");
    setTempo(previewMetadata?.tempo ? String(previewMetadata.tempo) : "");
    setContent(chordPro);
    setImportPreview({ filename, sourceLabel });
  };

  const continueVariationSwitch = (variationId: string) => {
    const nextVariationId = variationId || null;
    const nextVariation = nextVariationId
      ? variations.find((variation) => variation.id === nextVariationId) ?? null
      : null;

    setEditingVariationId(nextVariation?.id ?? null);
    setKey(nextVariation?.key || songRecord?.key || "");
    setContent(nextVariation?.content || songRecord?.content || "");

    const nextSearchParams = new URLSearchParams(searchParams);
    if (nextVariation?.id) {
      nextSearchParams.set("variation", nextVariation.id);
    } else {
      nextSearchParams.delete("variation");
    }
    setSearchParams(nextSearchParams, { replace: true });
  };

  const handleAddArrangementSection = (sectionId: string) => {
    setArrangementItems((current) => [
      ...current,
      { id: `arrangement-${Date.now()}-${current.length}`, sectionId, repeatCount: 1 },
    ]);
  };

  const handleMoveArrangementItem = (itemId: string, direction: -1 | 1) => {
    setArrangementItems((current) => {
      const index = current.findIndex((item) => item.id === itemId);
      const nextIndex = index + direction;
      if (index < 0 || nextIndex < 0 || nextIndex >= current.length) {
        return current;
      }

      const next = [...current];
      const [moved] = next.splice(index, 1);
      next.splice(nextIndex, 0, moved);
      return next;
    });
  };

  const handleChangeArrangementRepeat = (itemId: string, delta: -1 | 1) => {
    setArrangementItems((current) => current.map((item) => (
      item.id === itemId
        ? { ...item, repeatCount: Math.max(1, item.repeatCount + delta) }
        : item
    )));
  };

  const handleRemoveArrangementItem = (itemId: string) => {
    setArrangementItems((current) => current.filter((item) => item.id !== itemId));
  };

  const handleSaveArrangementVariation = async () => {
    if (!id) {
      toast.error("Save the song before creating an arrangement variation");
      return;
    }
    if (!isOnline) {
      toast.error("Arrangement variations require a connection right now");
      return;
    }
    if (arrangementItems.length === 0) {
      toast.error("Add at least one section to the arrangement first");
      return;
    }
    if (!arrangementVariationName.trim()) {
      toast.error("Variation name is required");
      return;
    }

    setSavingArrangement(true);
    try {
      const response = await variationsApi.create(id, {
        name: arrangementVariationName.trim(),
        key: key || undefined,
        content: arrangementPreviewContent,
      });
      setVariations((current) => [...current, response.variation]);
      toast.success(`Created arrangement variation: ${response.variation.name}`);
      allowNavigationRef.current = true;
      navigate(`/songs/${id}?variation=${response.variation.id}`);
    } catch (err: any) {
      toast.error(err.message || "Failed to save arrangement variation");
    } finally {
      setSavingArrangement(false);
    }
  };

  const processImportFiles = async (files: File[]) => {
    if (files.length === 0) {
      return;
    }

    if (files.length > 1) {
      await handleBulkImport(files);
      return;
    }

    const [file] = files;
    const ext = getFileExtension(file.name);

    if (ext === "cho" || ext === "chordpro" || ext === "chopro") {
      const text = await readFileText(file);
      const parsed = parseChordPro(text);
      applyImportPreview({
        filename: file.name,
        sourceLabel: "ChordPro",
        chordPro: text,
        previewMetadata: {
          title: parsed.directives.title || parsed.directives.t || file.name.replace(/\.(cho|chordpro|chopro)$/i, ""),
          artist: parsed.directives.artist || parsed.directives.a || null,
          key: parsed.directives.key || parsed.directives.k || null,
          tempo: /^\d+$/.test(parsed.directives.tempo || "") ? Number(parsed.directives.tempo) : null,
        },
      });
      toast.success("ChordPro file loaded — review the preview and save when ready");
      return;
    }

    if (ext === "pdf") {
      try {
        toast.info("Processing PDF — this may take a moment…");
        const preview = await songsApi.previewImportPdf(file);
        applyImportPreview({
          filename: file.name,
          sourceLabel: "PDF",
          chordPro: preview.chordPro,
          previewMetadata: preview.metadata,
        });
        toast.success("PDF imported — review the preview and save when ready");
      } catch (err: any) {
        toast.error(err.message || "PDF import failed");
      }
      return;
    }

    if (ext === "onsong" || ext === "xml") {
      try {
        const text = await readFileText(file);
        const preview = await songsApi.previewImportOnSong({
          filename: file.name,
          content: text,
        });
        applyImportPreview({
          filename: file.name,
          sourceLabel: ext === "xml" ? "OpenSong XML" : "OnSong",
          chordPro: preview.chordPro,
          previewMetadata: preview.metadata,
        });
        toast.success("OnSong/OpenSong file imported — review the preview and save when ready");
      } catch (err: any) {
        toast.error(err.message || "Import failed");
      }
      return;
    }

    if (ext === "chrd" || ext === "txt") {
      try {
        const text = await readFileText(file);
        const preview = await songsApi.previewImportChrd({
          filename: file.name,
          content: text,
        });
        applyImportPreview({
          filename: file.name,
          sourceLabel: ext === "txt" ? "Plain text / .chrd conversion" : ".chrd",
          chordPro: preview.chordPro,
          previewMetadata: preview.metadata,
        });
        toast.success("File imported — review the preview and save when ready");
      } catch (err: any) {
        toast.error(err.message || "Import failed");
      }
      return;
    }

    toast.error("Unsupported file format. Use .cho, .chordpro, .chopro, .onsong, .xml, .chrd, .txt, or .pdf");
  };

  const importFileForBulk = async (file: File) => {
    const ext = getFileExtension(file.name);

    if (ext === "pdf") {
      const res = await songsApi.importPdf(file);
      return { songId: res.song.id, songTitle: res.song.title || file.name };
    }

    const text = await readFileText(file);

    if (!text.trim()) {
      throw new Error("File is empty");
    }

    if (ext === "cho" || ext === "chordpro" || ext === "chopro") {
      const res = await createSongFromChordProFile(file, text);
      return { songId: res.song.id, songTitle: res.song.title || file.name };
    }

    if (ext === "onsong" || ext === "xml") {
      const res = await songsApi.importOnSong({ filename: file.name, content: text });
      return { songId: res.song.id, songTitle: res.song.title || file.name };
    }

    if (ext === "chrd" || ext === "txt") {
      const res = await songsApi.importChrd({ filename: file.name, content: text });
      return { songId: res.song.id, songTitle: res.song.title || file.name };
    }

    throw new Error("Unsupported file format");
  };

  const handleBulkImport = async (files: File[]) => {
    setIsBulkImporting(true);
    setBulkImportCompleted(0);
    setBulkImportCurrentFile("");
    setBulkImportItems(
      files.map((file) => ({
        filename: file.name,
        status: "pending",
      })),
    );

    let successCount = 0;

    for (const file of files) {
      setBulkImportCurrentFile(file.name);
      setBulkImportItems((current) => current.map((item) => (
        item.filename === file.name ? { ...item, status: "processing", message: undefined } : item
      )));

      try {
        const result = await importFileForBulk(file);
        successCount += 1;
        setBulkImportItems((current) => current.map((item) => (
          item.filename === file.name
            ? {
                ...item,
                status: "success",
                songId: result.songId,
                songTitle: result.songTitle,
                message: "Imported",
              }
            : item
        )));
      } catch (err: any) {
        setBulkImportItems((current) => current.map((item) => (
          item.filename === file.name
            ? {
                ...item,
                status: "error",
                message: err?.message || "Import failed",
              }
            : item
        )));
      } finally {
        setBulkImportCompleted((value) => value + 1);
      }
    }

    setBulkImportCurrentFile("");
    setIsBulkImporting(false);

    if (successCount > 0) {
      toast.success(`Bulk import finished — ${successCount} of ${files.length} files imported`);
    } else {
      toast.error("Bulk import failed for all files");
    }
  };

  const handleImport = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = Array.from(e.target.files || []);
    if (files.length === 0) return;

    if (isDirty) {
      setPendingInterruption({ type: "replace-import", files });
      e.target.value = "";
      return;
    }

    await processImportFiles(files);
    e.target.value = ""; // reset file input
  };

  useEffect(() => {
    const normalizedTitle = title.trim();
    const normalizedContent = content.trim();
    const enoughContent = normalizedContent.split(/\s+/).filter(Boolean).length >= 8;

    if ((!normalizedTitle || normalizedTitle.length < 3) && !enoughContent) {
      setDuplicateMatches([]);
      setCheckingDuplicates(false);
      return;
    }

    let cancelled = false;
    setCheckingDuplicates(true);

    const timeout = window.setTimeout(() => {
      songsApi
        .findDuplicates({
          title: normalizedTitle || undefined,
          content: enoughContent ? normalizedContent : undefined,
          excludeSongId: id,
        })
        .then((res) => {
          if (!cancelled) {
            setDuplicateMatches(res.matches);
          }
        })
        .catch(() => {
          if (!cancelled) {
            setDuplicateMatches([]);
          }
        })
        .finally(() => {
          if (!cancelled) {
            setCheckingDuplicates(false);
          }
        });
    }, 350);

    return () => {
      cancelled = true;
      window.clearTimeout(timeout);
    };
  }, [content, id, title]);

  const handleConfirmPendingInterruption = async () => {
    if (!pendingInterruption) {
      return;
    }

    if (pendingInterruption.type === "leave-page") {
      allowNavigationRef.current = true;
      setPendingInterruption(null);
      blocker.proceed?.();
      return;
    }

    if (pendingInterruption.type === "switch-variation") {
      continueVariationSwitch(pendingInterruption.variationId);
      setPendingInterruption(null);
      return;
    }

    if (pendingInterruption.type === "replace-import") {
      const files = pendingInterruption.files;
      setPendingInterruption(null);
      await processImportFiles(files);
    }
  };

  const handleClosePendingInterruption = () => {
    if (pendingInterruption?.type === "leave-page" && blocker.state === "blocked") {
      blocker.reset();
    }

    setPendingInterruption(null);
  };

  const handleConflictFieldSelection = (field: string, selection: "mine" | "server") => {
    setConflictState((current) => (
      current
        ? {
            ...current,
            fieldSelections: {
              ...current.fieldSelections,
              [field]: selection,
            },
          }
        : current
    ));
  };

  const handleUseServerVersion = () => {
    if (!conflictState) {
      return;
    }

    applySongFormValues(conflictState.currentSong);
    setConflictState(null);
    toast.info("Loaded the latest server version into the editor");
  };

  const handleSaveMergedConflict = async (forceMine = false) => {
    if (!id || !conflictState) {
      return;
    }

    const mergedPayload = forceMine
      ? conflictState.pendingSongData
      : Object.fromEntries(
          Object.entries(conflictState.fieldSelections).map(([field, selection]) => {
            const mineValue = conflictState.pendingSongData[field as keyof Song];
            const serverValue = conflictState.currentSong[field as keyof Song];
            return [field, selection === "mine" ? mineValue : serverValue];
          }),
        );

    setSaving(true);
    try {
      const response = await songsApi.update(id, {
        ...mergedPayload,
        forceOverwrite: true,
      });
      saveCachedSong({ song: response.song, variations });
      applySongFormValues(response.song);
      setConflictState(null);
      toast.success(forceMine ? "Overwrote the song with your changes" : "Merged and saved song changes");
      allowNavigationRef.current = true;
      navigate(`/songs/${id}`);
    } catch (err: any) {
      toast.error(err.message || "Failed to resolve conflict");
    } finally {
      setSaving(false);
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center py-20">
        <div className="spinner" />
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {/* Header */}
      <div className="flex items-center gap-3">
        <Link
          to={isNew ? "/songs" : currentVariation ? `/songs/${id}?variation=${currentVariation.id}` : `/songs/${id}`}
          className="link-muted inline-flex items-center gap-1"
        >
          <ArrowLeft className="h-4 w-4" /> {isNew ? "Songs" : "Back"}
        </Link>
        <h2 className="page-title">
          {isNew ? "New Song" : "Edit Song"}
        </h2>
      </div>

      <form ref={formRef} onSubmit={handleSubmit} className="space-y-6">
        {!isNew && variations.length > 0 && (
          <div className="space-y-3 card card-body">
            <div className="flex flex-wrap items-start justify-between gap-3">
              <div className="space-y-1">
                <div className="inline-flex items-center gap-2 text-sm font-medium text-[hsl(var(--foreground))]">
                  <Layers className="h-4 w-4" /> Editing target
                </div>
                <p className="text-xs text-[hsl(var(--muted-foreground))]">
                  Choose whether you are editing the original song or a specific variation.
                </p>
              </div>
              <span className="badge-muted">
                {currentVariation ? `Variation: ${currentVariation.name}` : "Original song"}
              </span>
            </div>

            <div className="flex flex-col gap-2 sm:flex-row sm:items-center">
              <label htmlFor="edit-target" className="text-sm font-medium text-[hsl(var(--foreground))]">
                Working on
              </label>
              <select
                id="edit-target"
                value={editingVariationId || ""}
                onChange={(e) => handleEditTargetChange(e.target.value)}
                className="select sm:max-w-sm"
              >
                <option value="">Original song</option>
                {variations.map((variation) => (
                  <option key={variation.id} value={variation.id}>
                    {variation.name}
                    {variation.key ? ` (${variation.key})` : ""}
                  </option>
                ))}
              </select>
            </div>

            {currentVariation && (
              <p className="text-xs text-[hsl(var(--muted-foreground))]">
                You are editing the content and key for <span className="font-medium text-[hsl(var(--foreground))]">{currentVariation.name}</span>.
                Title, alternate names, artist, shout, tempo, tags, and draft status still belong to the main song.
              </p>
            )}
          </div>
        )}

        {/* Metadata grid */}
        <div className="grid gap-4 sm:grid-cols-2">
          <div className="space-y-2 sm:col-span-2">
            <label className="text-sm font-medium text-[hsl(var(--foreground))]">Title *</label>
            <input
              type="text"
              required
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              className="input"
              placeholder="Song title"
            />
          </div>

          <div className="space-y-2">
            <label className="text-sm font-medium text-[hsl(var(--foreground))]">Category</label>
            <input
              type="text"
              value={category}
              onChange={(e) => setCategory(e.target.value)}
              className="input"
              placeholder="Wedding, Church, Special Event"
            />
          </div>

          <div className="space-y-2">
            <label className="text-sm font-medium text-[hsl(var(--foreground))]">Key</label>
            <select
              value={key}
              onChange={(e) => setKey(e.target.value)}
              className="select"
            >
              <option value="">Select key</option>
              {ALL_KEYS.map((k) => (
                <option key={k} value={k}>
                  {k}
                </option>
              ))}
            </select>
          </div>

          <div className="space-y-2">
            <label className="text-sm font-medium text-[hsl(var(--foreground))]">Tempo (BPM)</label>
            <input
              type="number"
              min="20"
              max="300"
              value={tempo}
              onChange={(e) => setTempo(e.target.value)}
              className="input"
              placeholder="120"
            />
          </div>

          <div className="space-y-2">
            <label className="text-sm font-medium text-[hsl(var(--foreground))]" htmlFor="song-energy">Energy</label>
            <select
              id="song-energy"
              value={energyValue}
              onChange={(e) => setEnergyValue(e.target.value)}
              className="input"
            >
              <option value="">Auto (from BPM)</option>
              <option value="1">1 — Reflective</option>
              <option value="2">2 — Gentle</option>
              <option value="3">3 — Mid</option>
              <option value="4">4 — Driving</option>
              <option value="5">5 — Full send</option>
            </select>
          </div>

          <div className="space-y-2">
            <label className="text-sm font-medium text-[hsl(var(--foreground))]">Artist</label>
            <input
              type="text"
              value={artist}
              onChange={(e) => setArtist(e.target.value)}
              className="input"
              placeholder="Artist or composer"
            />
          </div>

          <div className="space-y-2 sm:col-span-2">
            <label className="text-sm font-medium text-[hsl(var(--foreground))]">AKA / alternate names</label>
            <input
              type="text"
              value={aka}
              onChange={(e) => setAka(e.target.value)}
              className="input"
              placeholder="Optional alternate names, comma separated"
            />
          </div>

          <div className="space-y-2 sm:col-span-2">
            <label className="text-sm font-medium text-[hsl(var(--foreground))]">Associated shout</label>
            <input
              type="text"
              value={shout}
              onChange={(e) => setShout(e.target.value)}
              className="input"
              placeholder="Optional spoken cue or callout"
            />
          </div>

          <div className="md:col-span-2">
            <TagInput value={tags} onChange={setTags} />
          </div>
        </div>

        {(checkingDuplicates || duplicateMatches.length > 0) && (
          <div className="card card-body space-y-3" data-testid="duplicate-detection-card">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <div>
                <h3 className="text-sm font-semibold text-[hsl(var(--foreground))]">Possible duplicates</h3>
                <p className="text-xs text-[hsl(var(--muted-foreground))]">
                  Check these matches before saving a second copy of the same song.
                </p>
              </div>
              {checkingDuplicates && <span className="badge-muted">Checking…</span>}
            </div>

            {duplicateMatches.length === 0 ? (
              <p className="text-xs text-[hsl(var(--muted-foreground))]">No close matches found yet.</p>
            ) : (
              <ul className="space-y-2">
                {duplicateMatches.map((match) => (
                  <li key={match.id} className="rounded-2xl border border-[hsl(var(--border))] px-3 py-3">
                    <div className="flex flex-wrap items-center justify-between gap-3">
                      <div className="space-y-1">
                        <Link to={`/songs/${match.id}`} className="font-medium text-[hsl(var(--foreground))] hover:text-[hsl(var(--secondary))]">
                          {match.title}
                        </Link>
                        <div className="flex flex-wrap items-center gap-2 text-xs text-[hsl(var(--muted-foreground))]">
                          <span className="badge-muted">{Math.round(match.overallScore * 100)}% match</span>
                          <span>Matched on {match.matchedOn.join(" + ")}</span>
                          {match.artist && <span>· {match.artist}</span>}
                          {match.key && <span>· Key {match.key}</span>}
                        </div>
                        {match.aka && (
                          <p className="text-xs text-[hsl(var(--muted-foreground))]">AKA: {match.aka}</p>
                        )}
                      </div>
                      <Link to={`/songs/${match.id}`} className="btn-outline btn-sm">
                        Review song
                      </Link>
                    </div>
                  </li>
                ))}
              </ul>
            )}
          </div>
        )}

        {/* Import */}
        <div className="flex items-center gap-3">
          <label className="btn-outline cursor-pointer">
            <Upload className="h-4 w-4" />
            Import file
            <input
              type="file"
              multiple
              accept=".cho,.chordpro,.chopro,.onsong,.xml,.chrd,.txt,.pdf"
              onChange={handleImport}
              disabled={isBulkImporting}
              className="hidden"
            />
          </label>
          <span className="text-xs text-[hsl(var(--muted-foreground))]">
            Choose one file to review here, or select multiple files to bulk import: .cho, .chordpro, .chopro, .onsong, .xml, .chrd, .txt, .pdf
          </span>
        </div>

        {(isBulkImporting || bulkImportItems.length > 0) && (
          <div className="card card-body space-y-3" data-testid="bulk-import-status">
            <div className="flex flex-wrap items-center justify-between gap-3">
              <div>
                <h3 className="text-sm font-semibold text-[hsl(var(--foreground))]">Bulk import progress</h3>
                <p className="text-xs text-[hsl(var(--muted-foreground))]">
                  {bulkImportCompleted} of {bulkImportItems.length} completed
                  {bulkImportCurrentFile ? ` — importing ${bulkImportCurrentFile}` : ""}
                </p>
              </div>
              <span className="badge-muted">
                {bulkImportItems.filter((item) => item.status === "success").length} imported
              </span>
            </div>

            <div className="h-2 overflow-hidden rounded-full bg-[hsl(var(--muted))]">
              <div
                className="h-full bg-[hsl(var(--secondary))] transition-all"
                style={{ width: `${bulkImportItems.length > 0 ? Math.round((bulkImportCompleted / bulkImportItems.length) * 100) : 0}%` }}
              />
            </div>

            <ul className="space-y-2 text-sm">
              {bulkImportItems.map((item) => (
                <li key={item.filename} className="flex flex-wrap items-center justify-between gap-2 rounded-xl border border-[hsl(var(--border))] px-3 py-2">
                  <div className="space-y-1">
                    <p className="font-medium text-[hsl(var(--foreground))]">{item.filename}</p>
                    <p className="text-xs text-[hsl(var(--muted-foreground))]">
                      {item.status === "pending" && "Queued"}
                      {item.status === "processing" && "Importing..."}
                      {item.status === "success" && (item.songTitle ? `Imported as ${item.songTitle}` : "Imported")}
                      {item.status === "error" && (item.message || "Import failed")}
                    </p>
                  </div>

                  {item.songId ? (
                    <Link to={`/songs/${item.songId}`} className="link-muted text-xs font-medium">
                      Open song
                    </Link>
                  ) : (
                    <span className="badge-muted">{item.status}</span>
                  )}
                </li>
              ))}
            </ul>
          </div>
        )}

        {importPreview && (
          <div className="card card-body space-y-4" data-testid="import-preview-card">
            <div className="flex flex-wrap items-start justify-between gap-3">
              <div className="space-y-1">
                <h3 className="text-sm font-semibold text-[hsl(var(--foreground))]">Import preview</h3>
                <p className="text-xs text-[hsl(var(--muted-foreground))]">
                  Loaded from {importPreview.filename} via {importPreview.sourceLabel}. Review the rendered chart below, adjust anything you need, then save.
                </p>
              </div>
              <button
                type="button"
                className="btn-outline text-xs"
                onClick={() => setImportPreview(null)}
              >
                Hide preview
              </button>
            </div>

            <div className="grid gap-3 text-xs text-[hsl(var(--muted-foreground))] sm:grid-cols-3">
              <div>
                <span className="font-medium text-[hsl(var(--foreground))]">Title:</span> {title || "—"}
              </div>
              <div>
                <span className="font-medium text-[hsl(var(--foreground))]">Key:</span> {key || "—"}
              </div>
              <div>
                <span className="font-medium text-[hsl(var(--foreground))]">Tempo:</span> {tempo || "—"}
              </div>
            </div>

            <div className="rounded-2xl border border-[hsl(var(--border))] bg-[hsl(var(--card))] p-4">
              <ChordProRenderer content={content} songKey={key || undefined} />
            </div>
          </div>
        )}

        {/* ChordPro editor */}
        <ChordProEditor
          value={content}
          onChange={setContent}
          metadata={metadata}
          onSave={() => formRef.current?.requestSubmit()}
        />

        {!isNew && arrangementSections.length > 0 && (
          <div className="space-y-4">
            <ArrangementBuilder
              sections={arrangementSections}
              items={arrangementItems}
              summary={arrangementSummary}
              variationName={arrangementVariationName}
              onVariationNameChange={setArrangementVariationName}
              onAddSection={handleAddArrangementSection}
              onMoveItem={handleMoveArrangementItem}
              onChangeRepeat={handleChangeArrangementRepeat}
              onRemoveItem={handleRemoveArrangementItem}
              onSaveVariation={() => void handleSaveArrangementVariation()}
              saving={savingArrangement}
            />

            {arrangementItems.length > 0 && (
              <div className="card card-body space-y-3" data-testid="arrangement-preview-card">
                <div className="space-y-1">
                  <h3 className="text-sm font-semibold text-[hsl(var(--foreground))]">Arrangement preview</h3>
                  <p className="text-xs text-[hsl(var(--muted-foreground))]">{arrangementSummary}</p>
                </div>
                <div className="rounded-2xl border border-[hsl(var(--border))] bg-[hsl(var(--card))] p-4">
                  <ChordProRenderer content={arrangementPreviewContent} songKey={key || undefined} />
                </div>
              </div>
            )}
          </div>
        )}

        {/* Staff notation (ABC) — optional, main song version only */}
        {!currentVariation && (
          <StaffNotationEditor value={abcNotation} onChange={setAbcNotation} disabled={saving} />
        )}

        {/* Draft toggle */}
        <label className="flex items-center gap-2 text-sm text-[hsl(var(--foreground))]">
          <input
            type="checkbox"
            checked={isDraft}
            onChange={(e) => setIsDraft(e.target.checked)}
            className="rounded accent-[hsl(var(--secondary))]"
          />
          Save as draft
        </label>

        {/* Submit */}
        <div className="flex gap-3">
          <button
            type="submit"
            disabled={saving}
            className="btn-primary"
          >
            <Save className="h-4 w-4" />
            {saving ? "Saving..." : isNew ? "Create Song" : "Update Song"}
          </button>
          <Link
            to={isNew ? "/songs" : currentVariation ? `/songs/${id}?variation=${currentVariation.id}` : `/songs/${id}`}
            className="btn-outline"
          >
            Cancel
          </Link>
        </div>
      </form>

      <ConfirmDialog
        open={!!pendingInterruption}
        title={
          pendingInterruption?.type === "leave-page"
            ? "Discard unsaved changes?"
            : pendingInterruption?.type === "switch-variation"
              ? "Switch editing targets?"
              : "Replace the current draft with this import?"
        }
        description={
          pendingInterruption?.type === "leave-page"
            ? "You have unsaved changes. Leave this page and discard them, or stay here to keep editing."
            : pendingInterruption?.type === "switch-variation"
              ? "You have unsaved changes. Switching editing targets will discard them."
              : "Importing this file will replace the current unsaved form values."
        }
        confirmLabel={pendingInterruption?.type === "leave-page" ? "Leave page" : pendingInterruption?.type === "switch-variation" ? "Switch target" : "Replace with import"}
        cancelLabel="Stay here"
        destructive={pendingInterruption?.type !== "replace-import"}
        onConfirm={() => void handleConfirmPendingInterruption()}
        onClose={handleClosePendingInterruption}
      />

      {conflictState && (
        <div className="modal-backdrop" role="dialog" aria-modal="true" aria-labelledby="song-conflict-title">
          <div className="modal-content max-w-3xl space-y-4">
            <div className="space-y-1">
              <h3 id="song-conflict-title" className="text-lg font-semibold text-[hsl(var(--foreground))]">
                Resolve song edit conflict
              </h3>
              <p className="text-sm text-[hsl(var(--muted-foreground))]">
                Someone else saved this song after you opened it. Compare each changed field, choose which version to keep, then save the merged copy.
              </p>
            </div>

            <div className="max-h-[60vh] space-y-3 overflow-y-auto pr-1">
              {Object.keys(conflictState.fieldSelections).map((field) => (
                <div key={field} className="rounded-2xl border border-[hsl(var(--border))] p-3">
                  <div className="mb-2 flex items-center justify-between gap-3">
                    <span className="text-sm font-medium capitalize text-[hsl(var(--foreground))]">{field}</span>
                    <span className="badge-muted">{conflictState.fieldSelections[field] === "mine" ? "Keeping mine" : "Using server"}</span>
                  </div>

                  <div className="grid gap-3 md:grid-cols-2">
                    <button
                      type="button"
                      className={`rounded-xl border px-3 py-3 text-left ${conflictState.fieldSelections[field] === "mine" ? "border-[hsl(var(--secondary))] bg-[hsl(var(--secondary))]/10" : "border-[hsl(var(--border))]"}`}
                      onClick={() => handleConflictFieldSelection(field, "mine")}
                    >
                      <div className="mb-1 text-xs font-semibold uppercase tracking-wide text-[hsl(var(--muted-foreground))]">Your edit</div>
                      <div className="text-sm text-[hsl(var(--foreground))] whitespace-pre-wrap">{summarizeConflictValue(conflictState.pendingSongData[field as keyof Song])}</div>
                    </button>
                    <button
                      type="button"
                      className={`rounded-xl border px-3 py-3 text-left ${conflictState.fieldSelections[field] === "server" ? "border-[hsl(var(--secondary))] bg-[hsl(var(--secondary))]/10" : "border-[hsl(var(--border))]"}`}
                      onClick={() => handleConflictFieldSelection(field, "server")}
                    >
                      <div className="mb-1 text-xs font-semibold uppercase tracking-wide text-[hsl(var(--muted-foreground))]">Latest server version</div>
                      <div className="text-sm text-[hsl(var(--foreground))] whitespace-pre-wrap">{summarizeConflictValue(conflictState.currentSong[field as keyof Song])}</div>
                    </button>
                  </div>
                </div>
              ))}
            </div>

            <div className="flex flex-wrap justify-end gap-3">
              <button type="button" className="btn-outline" onClick={() => setConflictState(null)}>
                Close
              </button>
              <button type="button" className="btn-outline" onClick={handleUseServerVersion}>
                Load server version
              </button>
              <button type="button" className="btn-outline" onClick={() => void handleSaveMergedConflict(true)} disabled={saving}>
                Overwrite with my changes
              </button>
              <button type="button" className="btn-primary" onClick={() => void handleSaveMergedConflict(false)} disabled={saving}>
                Save merged copy
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
