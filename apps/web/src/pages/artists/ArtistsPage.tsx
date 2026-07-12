import { useEffect, useMemo, useState } from "react";
import { Link } from "react-router-dom";
import { toast } from "sonner";
import { artistsApi, type Artist } from "@/lib/api-client";
import { useAuth } from "@/contexts/AuthContext";
import { ConfirmDialog } from "@/components/shared/ConfirmDialog";
import { Search, Plus, MicVocal, BadgeCheck, Pencil, Trash2 } from "lucide-react";
import { EmptyState } from "@/components/shared/EmptyState";

function artistInitials(name: string): string {
  return name
    .split(/\s+/)
    .slice(0, 2)
    .map((s) => s[0]?.toUpperCase() || "")
    .join("");
}

function ArtistFormDialog({
  artist,
  onClose,
  onSaved,
}: {
  /** null = create mode */
  artist: Artist | null;
  onClose: () => void;
  onSaved: () => void;
}) {
  const [name, setName] = useState(artist?.name ?? "");
  const [genre, setGenre] = useState(artist?.genre ?? "");
  const [website, setWebsite] = useState(artist?.website ?? "");
  const [bio, setBio] = useState(artist?.bio ?? "");
  const [verified, setVerified] = useState(artist?.verified ?? false);
  const [saving, setSaving] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!name.trim()) {
      toast.error("Artist name is required");
      return;
    }
    setSaving(true);
    try {
      const payload = {
        name: name.trim(),
        genre: genre.trim() || null,
        website: website.trim() || null,
        bio: bio.trim() || null,
        verified,
      };
      if (artist) {
        await artistsApi.update(artist.id, payload);
        toast.success("Artist updated");
      } else {
        await artistsApi.create(payload);
        toast.success("Artist added");
      }
      onSaved();
      onClose();
    } catch (err: any) {
      toast.error(err.message || "Failed to save artist");
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="modal-backdrop" role="dialog" aria-modal="true" aria-labelledby="artist-form-title">
      <form onSubmit={handleSubmit} className="modal-content max-w-md space-y-4">
        <h3 id="artist-form-title" className="text-lg font-brand text-[hsl(var(--foreground))]">
          {artist ? "Edit artist" : "Add artist"}
        </h3>
        <label className="space-y-2 block">
          <span className="text-sm font-medium">Name *</span>
          <input type="text" value={name} onChange={(e) => setName(e.target.value)} className="input w-full" placeholder="Artist or band name" autoFocus disabled={saving} />
        </label>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <label className="space-y-2 block">
            <span className="text-sm font-medium">Genre</span>
            <input type="text" value={genre} onChange={(e) => setGenre(e.target.value)} className="input w-full" placeholder="Worship, Hymn…" disabled={saving} />
          </label>
          <label className="space-y-2 block">
            <span className="text-sm font-medium">Website</span>
            <input type="url" value={website} onChange={(e) => setWebsite(e.target.value)} className="input w-full" placeholder="https://…" disabled={saving} />
          </label>
        </div>
        <label className="space-y-2 block">
          <span className="text-sm font-medium">Bio</span>
          <textarea value={bio} onChange={(e) => setBio(e.target.value)} className="input w-full min-h-[70px]" placeholder="Short description…" disabled={saving} />
        </label>
        <label className="flex items-center gap-2 text-sm">
          <input type="checkbox" checked={verified} onChange={(e) => setVerified(e.target.checked)} className="rounded accent-[hsl(var(--secondary))]" disabled={saving} />
          Verified artist
        </label>
        <div className="flex justify-end gap-2">
          <button type="button" onClick={onClose} disabled={saving} className="btn-outline btn-sm">
            Cancel
          </button>
          <button type="submit" disabled={saving || !name.trim()} className="btn-primary btn-sm">
            {saving ? "Saving..." : artist ? "Save" : "Add artist"}
          </button>
        </div>
      </form>
    </div>
  );
}

/** Artist directory — browse, search, and manage the artists behind the library. */
export function ArtistsPage() {
  const { user, activeOrg } = useAuth();
  const canEdit = user?.role === "owner" || activeOrg?.role === "admin" || activeOrg?.role === "musician";
  const [artists, setArtists] = useState<Artist[]>([]);
  const [loading, setLoading] = useState(true);
  const [query, setQuery] = useState("");
  const [genreFilter, setGenreFilter] = useState("");
  const [formArtist, setFormArtist] = useState<Artist | null | undefined>(undefined); // undefined = closed, null = create
  const [pendingDelete, setPendingDelete] = useState<Artist | null>(null);
  const [deleting, setDeleting] = useState(false);

  const refresh = () => {
    artistsApi
      .list()
      .then((res) => setArtists(res.artists))
      .catch(() => {})
      .finally(() => setLoading(false));
  };

  useEffect(() => {
    refresh();
  }, []);

  const genres = useMemo(
    () => [...new Set(artists.map((a) => a.genre).filter(Boolean))] as string[],
    [artists],
  );

  const visible = useMemo(() => {
    let filtered = artists;
    if (query) filtered = filtered.filter((a) => a.name.toLowerCase().includes(query.toLowerCase()));
    if (genreFilter) filtered = filtered.filter((a) => a.genre === genreFilter);
    return filtered;
  }, [artists, query, genreFilter]);

  const handleDelete = async () => {
    if (!pendingDelete) return;
    setDeleting(true);
    try {
      await artistsApi.delete(pendingDelete.id);
      setArtists((prev) => prev.filter((a) => a.id !== pendingDelete.id));
      toast.success("Artist deleted");
      setPendingDelete(null);
    } catch (err: any) {
      toast.error(err.message || "Failed to delete artist");
    } finally {
      setDeleting(false);
    }
  };

  return (
    <div className="space-y-4">
      <div className="page-header">
        <h2 className="page-title">Artists</h2>
        {canEdit && (
          <button onClick={() => setFormArtist(null)} className="btn-primary">
            <Plus className="h-4 w-4" /> Add Artist
          </button>
        )}
      </div>

      <div className="flex flex-wrap items-center gap-2">
        <div className="relative flex-1 min-w-[200px]">
          <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 h-4 w-4 text-[hsl(var(--muted-foreground))]" />
          <input
            type="search"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Search artists…"
            className="input w-full pl-8"
            aria-label="Search artists"
          />
        </div>
        {genres.length > 0 && (
          <select value={genreFilter} onChange={(e) => setGenreFilter(e.target.value)} className="select w-auto" aria-label="Filter by genre">
            <option value="">All genres</option>
            {genres.map((genre) => (
              <option key={genre} value={genre}>
                {genre}
              </option>
            ))}
          </select>
        )}
      </div>

      {loading ? (
        <div className="flex items-center justify-center py-12">
          <div className="spinner" />
        </div>
      ) : visible.length === 0 ? (
        <EmptyState
          icon={MicVocal}
          message={query || genreFilter ? "No artists match your search." : "No artists yet. Add the artists behind your library."}
          action={
            canEdit && !query && !genreFilter ? (
              <button onClick={() => setFormArtist(null)} className="btn-primary">
                <Plus className="h-4 w-4" /> Add Artist
              </button>
            ) : undefined
          }
        />
      ) : (
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
          {visible.map((artist) => (
            <div key={artist.id} className="card-interactive card-body relative group">
              <Link to={`/artists/${artist.id}`} className="flex items-center gap-3 w-full text-left">
                <div className="flex items-center justify-center h-10 w-10 rounded-full bg-[hsl(var(--secondary))]/20 text-[hsl(var(--secondary))] text-sm font-bold shrink-0">
                  {artistInitials(artist.name)}
                </div>
                <div className="min-w-0 flex-1">
                  <div className="font-medium truncate flex items-center gap-1.5">
                    {artist.name}
                    {artist.verified && <BadgeCheck className="h-3.5 w-3.5 text-[hsl(var(--secondary))] shrink-0" />}
                  </div>
                  <div className="text-xs text-[hsl(var(--muted-foreground))]">
                    {[artist.genre, `${artist.songCount ?? 0} song${(artist.songCount ?? 0) !== 1 ? "s" : ""}`]
                      .filter(Boolean)
                      .join(" Â· ")}
                  </div>
                </div>
              </Link>
              {canEdit && (
                <div className="absolute top-3 right-3 flex items-center gap-1 opacity-0 group-hover:opacity-100 focus-within:opacity-100 transition-opacity">
                  <button
                    onClick={() => setFormArtist(artist)}
                    className="text-[hsl(var(--muted-foreground))] hover:text-[hsl(var(--foreground))] transition-colors"
                    title="Edit"
                  >
                    <Pencil className="h-4 w-4" />
                  </button>
                  <button
                    onClick={() => setPendingDelete(artist)}
                    className="text-[hsl(var(--muted-foreground))] hover:text-[hsl(var(--destructive))] transition-colors"
                    title="Delete"
                  >
                    <Trash2 className="h-4 w-4" />
                  </button>
                </div>
              )}
            </div>
          ))}
        </div>
      )}

      {formArtist !== undefined && (
        <ArtistFormDialog artist={formArtist} onClose={() => setFormArtist(undefined)} onSaved={refresh} />
      )}

      <ConfirmDialog
        open={Boolean(pendingDelete)}
        title={pendingDelete ? `Delete "${pendingDelete.name}"?` : "Delete artist?"}
        description="Songs stay in the library — they just lose the link to this artist."
        confirmLabel="Delete artist"
        busy={deleting}
        onClose={() => {
          if (!deleting) setPendingDelete(null);
        }}
        onConfirm={handleDelete}
      />
    </div>
  );
}
