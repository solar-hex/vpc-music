import { useEffect, useMemo, useState } from "react";
import { Link } from "react-router-dom";
import { toast } from "sonner";
import { mediaApi, songsApi, type MediaFile, type MediaType, type Song } from "@/lib/api-client";
import { useApiList } from "@/hooks/useApiList";
import { useAuth } from "@/contexts/AuthContext";
import { CardGrid } from "@/components/shared/CardGrid";
import { ConfirmDialog } from "@/components/shared/ConfirmDialog";
import { FolderOpen, Upload, FileText, Music4, AudioLines, File, Trash2, Link2, AlertCircle } from "lucide-react";
import { EmptyState } from "@/components/shared/EmptyState";

export const MEDIA_TYPE_LABELS: Record<MediaType, string> = {
  chart: "Chart",
  lyrics: "Lyrics",
  audio: "Audio",
  backing_track: "Backing track",
  stem: "Stem",
  other: "Other",
};

export function mediaTypeIcon(type: MediaType) {
  switch (type) {
    case "chart":
      return FileText;
    case "lyrics":
      return FileText;
    case "audio":
    case "backing_track":
    case "stem":
      return AudioLines;
    default:
      return File;
  }
}

export function formatBytes(bytes?: number | null): string {
  if (!bytes) return "";
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(0)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

/** Songs → Media library: every file in the org, filterable by type. */
export function MediaLibraryPage() {
  const { user, activeOrg } = useAuth();
  const canEdit = user?.role === "owner" || activeOrg?.role === "admin" || activeOrg?.role === "musician";
  const { data: files, setData: setFiles, loading, refresh } = useApiList<MediaFile[]>(
    () => mediaApi.list().then((res) => res.media),
    [],
  );
  const [songs, setSongs] = useState<Song[]>([]);
  const [typeFilter, setTypeFilter] = useState<MediaType | "">("");
  const [uploading, setUploading] = useState(false);
  const [pendingDelete, setPendingDelete] = useState<MediaFile | null>(null);
  const [deleting, setDeleting] = useState(false);

  useEffect(() => {
    songsApi
      .list({ limit: 500 })
      .then((res) => setSongs(res.songs))
      .catch(() => {});
  }, []);

  const visible = useMemo(
    () => (typeFilter ? files.filter((file) => file.type === typeFilter) : files),
    [files, typeFilter],
  );
  const unattachedCount = files.filter((file) => !file.songId).length;

  const handleUpload = async (file: File) => {
    setUploading(true);
    try {
      await mediaApi.upload(file);
      toast.success(`Uploaded ${file.name}`);
      refresh();
    } catch (err: any) {
      toast.error(err.message || "Upload failed");
    } finally {
      setUploading(false);
    }
  };

  const handleAttach = async (mediaFile: MediaFile, songId: string) => {
    try {
      await mediaApi.update(mediaFile.id, { songId: songId || null });
      setFiles((prev) =>
        prev.map((f) =>
          f.id === mediaFile.id
            ? { ...f, songId: songId || null, songTitle: songs.find((s) => s.id === songId)?.title ?? null }
            : f,
        ),
      );
      toast.success(songId ? "File linked" : "File unlinked");
    } catch (err: any) {
      toast.error(err.message || "Failed to update file");
    }
  };

  const handleRetype = async (mediaFile: MediaFile, type: MediaType) => {
    try {
      await mediaApi.update(mediaFile.id, { type });
      setFiles((prev) => prev.map((f) => (f.id === mediaFile.id ? { ...f, type } : f)));
    } catch (err: any) {
      toast.error(err.message || "Failed to update type");
    }
  };

  const handleDelete = async () => {
    if (!pendingDelete) return;
    setDeleting(true);
    try {
      await mediaApi.delete(pendingDelete.id);
      setFiles((prev) => prev.filter((f) => f.id !== pendingDelete.id));
      toast.success("File deleted");
      setPendingDelete(null);
    } catch (err: any) {
      toast.error(err.message || "Failed to delete");
    } finally {
      setDeleting(false);
    }
  };

  return (
    <div className="space-y-4">
      <div className="page-header">
        <h3 className="section-title">
          <FolderOpen className="section-title-icon" /> Media Library
        </h3>
        <div className="flex flex-wrap items-center gap-2">
          <select
            value={typeFilter}
            onChange={(e) => setTypeFilter(e.target.value as MediaType | "")}
            className="select w-auto"
            aria-label="Filter by type"
          >
            <option value="">All types</option>
            {(Object.keys(MEDIA_TYPE_LABELS) as MediaType[]).map((type) => (
              <option key={type} value={type}>
                {MEDIA_TYPE_LABELS[type]}
              </option>
            ))}
          </select>
          {canEdit && (
            <label className="btn-primary btn-sm cursor-pointer">
              <Upload className="h-4 w-4" /> {uploading ? "Uploading…" : "Upload"}
              <input
                type="file"
                className="hidden"
                disabled={uploading}
                onChange={(e) => {
                  const file = e.target.files?.[0];
                  if (file) void handleUpload(file);
                  e.target.value = "";
                }}
              />
            </label>
          )}
        </div>
      </div>

      {unattachedCount > 0 && (
        <p className="flex items-center gap-1.5 text-sm text-amber-600 dark:text-amber-400">
          <AlertCircle className="h-4 w-4" /> {unattachedCount} file{unattachedCount !== 1 ? "s" : ""} not linked to a song yet.
        </p>
      )}

      {loading ? (
        <div className="flex justify-center py-12"><div className="spinner" /></div>
      ) : visible.length === 0 ? (
        <EmptyState
          icon={FolderOpen}
          message="Charts, lyrics, and audio for the whole library live here."
          action={
            canEdit ? (
              <label className="btn-primary cursor-pointer">
                <Upload className="h-4 w-4" /> Upload a file
                <input
                  type="file"
                  className="hidden"
                  onChange={(e) => {
                    const file = e.target.files?.[0];
                    if (file) void handleUpload(file);
                    e.target.value = "";
                  }}
                />
              </label>
            ) : undefined
          }
        />
      ) : (
        <CardGrid>
          {visible.map((file) => {
            const Icon = mediaTypeIcon(file.type);
            return (
              <div key={file.id} className={`card card-body space-y-2 ${!file.songId ? "border-amber-500/40" : ""}`}>
                <div className="flex items-center gap-2">
                  <Icon className="h-4 w-4 text-[hsl(var(--secondary))] shrink-0" />
                  <a href={file.fileUrl} target="_blank" rel="noreferrer" className="min-w-0 flex-1 truncate text-sm font-medium hover:text-[hsl(var(--secondary))]" title={file.filename}>
                    {file.filename}
                  </a>
                  {canEdit && (
                    <button onClick={() => setPendingDelete(file)} className="btn-icon rounded-md text-[hsl(var(--muted-foreground))] hover:text-[hsl(var(--destructive))]" title="Delete file">
                      <Trash2 className="h-3.5 w-3.5" />
                    </button>
                  )}
                </div>
                <div className="flex items-center gap-2 text-xs text-[hsl(var(--muted-foreground))]">
                  {canEdit ? (
                    <select
                      value={file.type}
                      onChange={(e) => void handleRetype(file, e.target.value as MediaType)}
                      className="input !py-0.5 !px-1.5 text-xs w-auto"
                      aria-label="File type"
                    >
                      {(Object.keys(MEDIA_TYPE_LABELS) as MediaType[]).map((type) => (
                        <option key={type} value={type}>
                          {MEDIA_TYPE_LABELS[type]}
                        </option>
                      ))}
                    </select>
                  ) : (
                    <span className="badge badge-muted">{MEDIA_TYPE_LABELS[file.type]}</span>
                  )}
                  {file.sizeBytes ? <span>{formatBytes(file.sizeBytes)}</span> : null}
                </div>
                <div className="flex items-center gap-1.5 text-xs">
                  <Link2 className="h-3 w-3 text-[hsl(var(--muted-foreground))] shrink-0" />
                  {canEdit ? (
                    <select
                      value={file.songId ?? ""}
                      onChange={(e) => void handleAttach(file, e.target.value)}
                      className="input !py-0.5 !px-1.5 text-xs flex-1 min-w-0"
                      aria-label={`Song for ${file.filename}`}
                    >
                      <option value="">Not linked</option>
                      {songs.map((song) => (
                        <option key={song.id} value={song.id}>
                          {song.title}
                        </option>
                      ))}
                    </select>
                  ) : file.songId ? (
                    <Link to={`/songs/${file.songId}`} className="link-accent truncate">
                      {file.songTitle}
                    </Link>
                  ) : (
                    <span className="text-[hsl(var(--muted-foreground))]">Not linked</span>
                  )}
                </div>
              </div>
            );
          })}
        </CardGrid>
      )}

      <ConfirmDialog
        open={Boolean(pendingDelete)}
        title={pendingDelete ? `Delete "${pendingDelete.filename}"?` : "Delete file?"}
        description="The file is removed from storage. This cannot be undone."
        confirmLabel="Delete file"
        busy={deleting}
        onClose={() => {
          if (!deleting) setPendingDelete(null);
        }}
        onConfirm={handleDelete}
      />
    </div>
  );
}
