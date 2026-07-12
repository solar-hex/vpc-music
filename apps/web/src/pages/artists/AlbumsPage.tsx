import { useEffect, useState } from "react";
import { toast } from "sonner";
import { albumsApi, artistsApi, type Album, type Artist } from "@/lib/api-client";
import { useAuth } from "@/contexts/AuthContext";
import { ConfirmDialog } from "@/components/shared/ConfirmDialog";
import { Disc3, Plus, Pencil, Trash2, X } from "lucide-react";

export function AlbumFormDialog({
  album,
  defaultArtistId,
  onClose,
  onSaved,
}: {
  album: Album | null;
  defaultArtistId?: string;
  onClose: () => void;
  onSaved: () => void;
}) {
  const [title, setTitle] = useState(album?.title ?? "");
  const [year, setYear] = useState(album?.year ? String(album.year) : "");
  const [artistId, setArtistId] = useState(album?.artistId ?? defaultArtistId ?? "");
  const [coverUrl, setCoverUrl] = useState(album?.coverUrl ?? "");
  const [artists, setArtists] = useState<Artist[]>([]);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    artistsApi.list().then((res) => setArtists(res.artists)).catch(() => {});
  }, []);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!title.trim()) {
      toast.error("Album title is required");
      return;
    }
    setSaving(true);
    try {
      const payload = {
        title: title.trim(),
        year: /^\d{4}$/.test(year) ? Number(year) : null,
        artistId: artistId || null,
        coverUrl: coverUrl.trim() || null,
      };
      if (album) {
        await albumsApi.update(album.id, payload);
        toast.success("Album updated");
      } else {
        await albumsApi.create(payload);
        toast.success("Album added");
      }
      onSaved();
      onClose();
    } catch (err: any) {
      toast.error(err.message || "Failed to save album");
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="modal-backdrop" role="dialog" aria-modal="true" aria-labelledby="album-form-title">
      <form onSubmit={handleSubmit} className="modal-content max-w-md space-y-4">
        <div className="flex items-center justify-between">
          <h3 id="album-form-title" className="text-lg font-brand">
            {album ? "Edit album" : "Add album"}
          </h3>
          <button type="button" onClick={onClose} disabled={saving} className="btn-icon rounded-md text-[hsl(var(--muted-foreground))]" aria-label="Close">
            <X className="h-4 w-4" />
          </button>
        </div>
        <label className="space-y-2 block">
          <span className="text-sm font-medium">Title *</span>
          <input type="text" value={title} onChange={(e) => setTitle(e.target.value)} className="input w-full" autoFocus disabled={saving} />
        </label>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <label className="space-y-2 block">
            <span className="text-sm font-medium">Artist</span>
            <select value={artistId} onChange={(e) => setArtistId(e.target.value)} className="input w-full" disabled={saving}>
              <option value="">—</option>
              {artists.map((artist) => (
                <option key={artist.id} value={artist.id}>
                  {artist.name}
                </option>
              ))}
            </select>
          </label>
          <label className="space-y-2 block">
            <span className="text-sm font-medium">Year</span>
            <input type="number" min="1900" max="2100" value={year} onChange={(e) => setYear(e.target.value)} className="input w-full" placeholder="2024" disabled={saving} />
          </label>
        </div>
        <label className="space-y-2 block">
          <span className="text-sm font-medium">Cover image URL</span>
          <input type="url" value={coverUrl} onChange={(e) => setCoverUrl(e.target.value)} className="input w-full" placeholder="https://…" disabled={saving} />
        </label>
        <div className="flex justify-end gap-2">
          <button type="button" onClick={onClose} disabled={saving} className="btn-outline btn-sm">
            Cancel
          </button>
          <button type="submit" disabled={saving || !title.trim()} className="btn-primary btn-sm">
            {saving ? "Saving..." : album ? "Save" : "Add album"}
          </button>
        </div>
      </form>
    </div>
  );
}

export function AlbumCard({
  album,
  canEdit,
  onEdit,
  onDelete,
}: {
  album: Album;
  canEdit: boolean;
  onEdit?: (album: Album) => void;
  onDelete?: (album: Album) => void;
}) {
  return (
    <div className="card card-body space-y-2 relative group">
      <div className="flex items-center gap-3">
        {album.coverUrl ? (
          <img src={album.coverUrl} alt="" className="h-12 w-12 rounded-md object-cover shrink-0" />
        ) : (
          <div className="flex h-12 w-12 items-center justify-center rounded-md bg-[hsl(var(--secondary))]/15 shrink-0">
            <Disc3 className="h-6 w-6 text-[hsl(var(--secondary))]" />
          </div>
        )}
        <div className="min-w-0 flex-1">
          <div className="font-medium truncate">{album.title}</div>
          <div className="text-xs text-[hsl(var(--muted-foreground))]">
            {[album.artistName, album.year, `${album.trackCount ?? 0} track${(album.trackCount ?? 0) !== 1 ? "s" : ""}`]
              .filter(Boolean)
              .join(" · ")}
          </div>
        </div>
      </div>
      {canEdit && onEdit && onDelete && (
        <div className="absolute top-3 right-3 flex items-center gap-1 opacity-0 group-hover:opacity-100 focus-within:opacity-100 transition-opacity">
          <button onClick={() => onEdit(album)} className="text-[hsl(var(--muted-foreground))] hover:text-[hsl(var(--foreground))]" title="Edit">
            <Pencil className="h-4 w-4" />
          </button>
          <button onClick={() => onDelete(album)} className="text-[hsl(var(--muted-foreground))] hover:text-[hsl(var(--destructive))]" title="Delete">
            <Trash2 className="h-4 w-4" />
          </button>
        </div>
      )}
    </div>
  );
}

/** Artists → Albums: all albums across artists. */
export function AlbumsPage() {
  const { user, activeOrg } = useAuth();
  const canEdit = user?.role === "owner" || activeOrg?.role === "admin" || activeOrg?.role === "musician";
  const [albums, setAlbums] = useState<Album[]>([]);
  const [loading, setLoading] = useState(true);
  const [formAlbum, setFormAlbum] = useState<Album | null | undefined>(undefined);
  const [pendingDelete, setPendingDelete] = useState<Album | null>(null);
  const [deleting, setDeleting] = useState(false);

  const refresh = () => {
    albumsApi
      .list()
      .then((res) => setAlbums(res.albums))
      .catch(() => {})
      .finally(() => setLoading(false));
  };

  useEffect(() => {
    refresh();
  }, []);

  const handleDelete = async () => {
    if (!pendingDelete) return;
    setDeleting(true);
    try {
      await albumsApi.delete(pendingDelete.id);
      setAlbums((prev) => prev.filter((album) => album.id !== pendingDelete.id));
      toast.success("Album deleted");
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
          <Disc3 className="section-title-icon" /> Albums
        </h3>
        {canEdit && (
          <button onClick={() => setFormAlbum(null)} className="btn-primary btn-sm">
            <Plus className="h-4 w-4" /> Add album
          </button>
        )}
      </div>

      {loading ? (
        <div className="flex justify-center py-12"><div className="spinner" /></div>
      ) : albums.length === 0 ? (
        <div className="card-empty">
          <Disc3 className="mx-auto h-10 w-10 text-[hsl(var(--muted-foreground))] mb-2" />
          <p className="text-sm text-[hsl(var(--muted-foreground))]">
            Group songs by the records they came from.
          </p>
          {canEdit && (
            <button onClick={() => setFormAlbum(null)} className="btn-primary mt-4">
              <Plus className="h-4 w-4" /> Add album
            </button>
          )}
        </div>
      ) : (
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
          {albums.map((album) => (
            <AlbumCard key={album.id} album={album} canEdit={!!canEdit} onEdit={setFormAlbum} onDelete={setPendingDelete} />
          ))}
        </div>
      )}

      {formAlbum !== undefined && (
        <AlbumFormDialog album={formAlbum} onClose={() => setFormAlbum(undefined)} onSaved={refresh} />
      )}

      <ConfirmDialog
        open={Boolean(pendingDelete)}
        title={pendingDelete ? `Delete "${pendingDelete.title}"?` : "Delete album?"}
        description="Songs stay in the library — they just lose the album link."
        confirmLabel="Delete album"
        busy={deleting}
        onClose={() => {
          if (!deleting) setPendingDelete(null);
        }}
        onConfirm={handleDelete}
      />
    </div>
  );
}
