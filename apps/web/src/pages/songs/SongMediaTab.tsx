import { useEffect, useState } from "react";
import { useParams, Link } from "react-router-dom";
import { toast } from "sonner";
import { mediaApi, songsApi, type MediaFile, type MediaType, type Song } from "@/lib/api-client";
import { useAuth } from "@/contexts/AuthContext";
import { StaffNotation } from "@/components/songs/StaffNotation";
import { MEDIA_TYPE_LABELS, mediaTypeIcon, formatBytes } from "./MediaLibraryPage";
import { Upload, Trash2, ArrowLeft, FolderOpen } from "lucide-react";

const PREVIEWABLE_IMAGE = /\.(png|jpe?g|gif|webp|svg)$/i;
const PREVIEWABLE_PDF = /\.pdf$/i;
const PREVIEWABLE_TEXT = /\.(txt|cho|chordpro|chopro|onsong)$/i;

function MediaPreview({ file }: { file: MediaFile }) {
  const [text, setText] = useState<string | null>(null);
  const isAudio = file.mimeType?.startsWith("audio/") || ["audio", "backing_track", "stem"].includes(file.type);
  const isImage = PREVIEWABLE_IMAGE.test(file.filename) || file.mimeType?.startsWith("image/");
  const isPdf = PREVIEWABLE_PDF.test(file.filename) || file.mimeType === "application/pdf";
  const isText = PREVIEWABLE_TEXT.test(file.filename) || file.mimeType?.startsWith("text/");

  useEffect(() => {
    if (!isText || isImage || isPdf) return;
    fetch(file.fileUrl)
      .then((res) => (res.ok ? res.text() : null))
      .then((content) => setText(content ? content.slice(0, 4000) : null))
      .catch(() => setText(null));
  }, [file.fileUrl, isText, isImage, isPdf]);

  if (isAudio) {
    return <audio controls src={file.fileUrl} className="w-full" preload="none" />;
  }
  if (isImage) {
    return <img src={file.fileUrl} alt={file.filename} className="max-h-72 rounded-md border border-[hsl(var(--border))]" />;
  }
  if (isPdf) {
    return <iframe src={file.fileUrl} title={file.filename} className="h-72 w-full rounded-md border border-[hsl(var(--border))] bg-white" />;
  }
  if (isText && text) {
    return (
      <pre className="max-h-72 overflow-auto rounded-md border border-[hsl(var(--border))] bg-[hsl(var(--muted))] p-3 text-xs whitespace-pre-wrap">
        {text}
      </pre>
    );
  }
  return null;
}

/** Song detail → Charts & media: attached files by type, with upload + preview. */
export function SongMediaTab() {
  const { id } = useParams<{ id: string }>();
  const { user, activeOrg } = useAuth();
  const canEdit = user?.role === "owner" || activeOrg?.role === "admin" || activeOrg?.role === "musician";
  const [song, setSong] = useState<Song | null>(null);
  const [files, setFiles] = useState<MediaFile[]>([]);
  const [loading, setLoading] = useState(true);
  const [uploading, setUploading] = useState(false);
  const [uploadType, setUploadType] = useState<MediaType>("chart");

  const refresh = () => {
    if (!id) return;
    mediaApi
      .list({ songId: id })
      .then((res) => setFiles(res.media))
      .catch(() => {})
      .finally(() => setLoading(false));
  };

  useEffect(() => {
    refresh();
    if (id) {
      songsApi.get(id).then((res) => setSong(res.song)).catch(() => {});
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [id]);

  const handleUpload = async (file: File) => {
    if (!id) return;
    setUploading(true);
    try {
      await mediaApi.upload(file, { songId: id, type: uploadType });
      toast.success(`Uploaded ${file.name}`);
      refresh();
    } catch (err: any) {
      toast.error(err.message || "Upload failed");
    } finally {
      setUploading(false);
    }
  };

  const handleDelete = async (mediaFile: MediaFile) => {
    try {
      await mediaApi.delete(mediaFile.id);
      setFiles((prev) => prev.filter((f) => f.id !== mediaFile.id));
      toast.success("File deleted");
    } catch (err: any) {
      toast.error(err.message || "Failed to delete");
    }
  };

  const byType = (Object.keys(MEDIA_TYPE_LABELS) as MediaType[])
    .map((type) => ({ type, items: files.filter((file) => file.type === type) }))
    .filter((group) => group.items.length > 0);

  return (
    <div className="space-y-5">
      <div className="page-header">
        <div className="min-w-0">
          <Link to={`/songs/${id}`} className="link-accent inline-flex items-center gap-1 text-sm">
            <ArrowLeft className="h-4 w-4" /> {song?.title ?? "Song"}
          </Link>
        </div>
        {canEdit && (
          <div className="flex items-center gap-2">
            <select value={uploadType} onChange={(e) => setUploadType(e.target.value as MediaType)} className="select w-auto" aria-label="Upload type">
              {(Object.keys(MEDIA_TYPE_LABELS) as MediaType[]).map((type) => (
                <option key={type} value={type}>
                  {MEDIA_TYPE_LABELS[type]}
                </option>
              ))}
            </select>
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
          </div>
        )}
      </div>

      {song?.abcNotation && (
        <section className="space-y-2">
          <h4 className="text-sm font-semibold uppercase tracking-wider text-[hsl(var(--muted-foreground))]">Staff notation</h4>
          <StaffNotation abc={song.abcNotation} />
        </section>
      )}

      {loading ? (
        <div className="flex justify-center py-12"><div className="spinner" /></div>
      ) : files.length === 0 && !song?.abcNotation ? (
        <div className="card-empty">
          <FolderOpen className="mx-auto h-10 w-10 text-[hsl(var(--muted-foreground))] mb-2" />
          <p className="text-sm text-[hsl(var(--muted-foreground))]">
            Charts, lyric sheets, and audio for this song live here.
          </p>
          {canEdit && (
            <label className="btn-primary mt-4 cursor-pointer">
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
          )}
        </div>
      ) : (
        byType.map((group) => (
          <section key={group.type} className="space-y-2">
            <h4 className="text-sm font-semibold uppercase tracking-wider text-[hsl(var(--muted-foreground))]">
              {MEDIA_TYPE_LABELS[group.type]}
              {group.items.length > 1 ? ` (${group.items.length})` : ""}
            </h4>
            <div className="space-y-3">
              {group.items.map((file) => {
                const Icon = mediaTypeIcon(file.type);
                return (
                  <div key={file.id} className="card card-body space-y-2">
                    <div className="flex items-center gap-2">
                      <Icon className="h-4 w-4 text-[hsl(var(--secondary))] shrink-0" />
                      <a href={file.fileUrl} target="_blank" rel="noreferrer" className="min-w-0 flex-1 truncate text-sm font-medium hover:text-[hsl(var(--secondary))]">
                        {file.filename}
                      </a>
                      <span className="text-xs text-[hsl(var(--muted-foreground))]">{formatBytes(file.sizeBytes)}</span>
                      {canEdit && (
                        <button onClick={() => void handleDelete(file)} className="btn-icon rounded-md text-[hsl(var(--muted-foreground))] hover:text-[hsl(var(--destructive))]" title="Delete file">
                          <Trash2 className="h-3.5 w-3.5" />
                        </button>
                      )}
                    </div>
                    <MediaPreview file={file} />
                  </div>
                );
              })}
            </div>
          </section>
        ))
      )}
    </div>
  );
}
