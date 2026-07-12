import { useEffect, useState } from "react";
import { Outlet, useParams, Link, useOutletContext } from "react-router-dom";
import { toast } from "sonner";
import { artistsApi, albumsApi, type Artist, type ArtistSong, type Album } from "@/lib/api-client";
import { useAuth } from "@/contexts/AuthContext";
import { SectionTabs } from "@/components/layout/SectionTabs";
import { AlbumCard, AlbumFormDialog } from "./AlbumsPage";
import { ConfirmDialog } from "@/components/shared/ConfirmDialog";
import { ArrowLeft, BadgeCheck, Music, TrendingUp, Globe, Plus, Disc3 } from "lucide-react";

interface ArtistOutletContext {
  artist: Artist;
  songs: ArtistSong[];
  canEdit: boolean;
  refresh: () => void;
}

function artistInitials(name: string): string {
  return name
    .split(/\s+/)
    .slice(0, 2)
    .map((s) => s[0]?.toUpperCase() || "")
    .join("");
}

/** Artist detail layout: Profile / Songs / Albums as nested routes. */
export function ArtistDetailLayout() {
  const { id } = useParams<{ id: string }>();
  const { user, activeOrg } = useAuth();
  const canEdit = user?.role === "owner" || activeOrg?.role === "admin" || activeOrg?.role === "musician";
  const [artist, setArtist] = useState<Artist | null>(null);
  const [songs, setSongs] = useState<ArtistSong[]>([]);
  const [loading, setLoading] = useState(true);

  const refresh = () => {
    if (!id) return;
    artistsApi
      .get(id)
      .then((res) => {
        setArtist(res.artist);
        setSongs(res.songs);
      })
      .catch(() => {})
      .finally(() => setLoading(false));
  };

  useEffect(() => {
    refresh();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [id]);

  if (loading) {
    return <div className="flex justify-center py-12"><div className="spinner" /></div>;
  }
  if (!artist) {
    return (
      <div className="card-empty">
        <p className="text-sm text-[hsl(var(--muted-foreground))]">This artist isn't in your organization.</p>
        <Link to="/artists" className="btn-primary mt-4">
          All artists
        </Link>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <Link to="/artists" className="link-accent inline-flex items-center gap-1 text-sm">
        <ArrowLeft className="h-4 w-4" /> All artists
      </Link>
      <div className="flex items-center gap-3">
        {artist.imageUrl ? (
          <img src={artist.imageUrl} alt="" className="h-14 w-14 rounded-full object-cover" />
        ) : (
          <div className="flex h-14 w-14 items-center justify-center rounded-full bg-[hsl(var(--secondary))]/20 text-lg font-bold text-[hsl(var(--secondary))]">
            {artistInitials(artist.name)}
          </div>
        )}
        <div>
          <h2 className="page-title flex items-center gap-2">
            {artist.name}
            {artist.verified && <BadgeCheck className="h-5 w-5 text-[hsl(var(--secondary))]" />}
          </h2>
          <p className="text-sm text-[hsl(var(--muted-foreground))]">
            {[artist.genre, `${songs.length} song${songs.length !== 1 ? "s" : ""}`].filter(Boolean).join(" · ")}
          </p>
        </div>
      </div>

      <SectionTabs
        tabs={[
          { to: "", label: "Profile" },
          { to: "songs", label: "Songs" },
          { to: "albums", label: "Albums" },
        ]}
      />
      <Outlet context={{ artist, songs, canEdit: !!canEdit, refresh } satisfies ArtistOutletContext} />
    </div>
  );
}

/** Artist → Profile: editable bio, image, genre, website. */
export function ArtistProfileTab() {
  const { artist, canEdit, refresh } = useOutletContext<ArtistOutletContext>();
  const [bio, setBio] = useState(artist.bio ?? "");
  const [genre, setGenre] = useState(artist.genre ?? "");
  const [website, setWebsite] = useState(artist.website ?? "");
  const [imageUrl, setImageUrl] = useState(artist.imageUrl ?? "");
  const [saving, setSaving] = useState(false);

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    setSaving(true);
    try {
      await artistsApi.update(artist.id, {
        bio: bio.trim() || null,
        genre: genre.trim() || null,
        website: website.trim() || null,
        imageUrl: imageUrl.trim() || null,
      });
      toast.success("Profile saved");
      refresh();
    } catch (err: any) {
      toast.error(err.message || "Failed to save");
    } finally {
      setSaving(false);
    }
  };

  if (!canEdit) {
    return (
      <div className="space-y-4 max-w-xl">
        {artist.bio ? <p className="text-sm whitespace-pre-wrap">{artist.bio}</p> : <p className="text-sm text-[hsl(var(--muted-foreground))]">No bio yet.</p>}
        {artist.website && (
          <a href={artist.website} target="_blank" rel="noreferrer" className="link-accent inline-flex items-center gap-1 text-sm">
            <Globe className="h-3.5 w-3.5" /> {artist.website}
          </a>
        )}
      </div>
    );
  }

  return (
    <form onSubmit={handleSave} className="space-y-4 max-w-xl">
      <label className="space-y-2 block">
        <span className="text-sm font-medium">Bio</span>
        <textarea value={bio} onChange={(e) => setBio(e.target.value)} className="input w-full min-h-[100px]" placeholder="Short description…" disabled={saving} />
      </label>
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        <label className="space-y-2 block">
          <span className="text-sm font-medium">Genre</span>
          <input type="text" value={genre} onChange={(e) => setGenre(e.target.value)} className="input w-full" disabled={saving} />
        </label>
        <label className="space-y-2 block">
          <span className="text-sm font-medium">Website</span>
          <input type="url" value={website} onChange={(e) => setWebsite(e.target.value)} className="input w-full" placeholder="https://…" disabled={saving} />
        </label>
      </div>
      <label className="space-y-2 block">
        <span className="text-sm font-medium">Image URL</span>
        <input type="url" value={imageUrl} onChange={(e) => setImageUrl(e.target.value)} className="input w-full" placeholder="https://…" disabled={saving} />
      </label>
      <button type="submit" disabled={saving} className="btn-primary btn-sm">
        {saving ? "Saving..." : "Save profile"}
      </button>
    </form>
  );
}

/** Artist → Songs: all songs by this artist. */
export function ArtistSongsTab() {
  const { artist, songs } = useOutletContext<ArtistOutletContext>();

  if (songs.length === 0) {
    return (
      <div className="card-empty">
        <Music className="mx-auto h-10 w-10 text-[hsl(var(--muted-foreground))] mb-2" />
        <p className="text-sm text-[hsl(var(--muted-foreground))]">
          No songs are linked to {artist.name} yet.
        </p>
        <Link to="/songs" className="btn-primary mt-4">
          Browse songs
        </Link>
      </div>
    );
  }

  return (
    <div className="list-container">
      {songs.map((song) => (
        <Link key={song.id} to={`/songs/${song.id}`} className="list-item hover:bg-[hsl(var(--muted))]">
          <span className="flex-1 truncate text-sm font-medium">{song.title}</span>
          <span className="flex items-center gap-2 text-xs text-[hsl(var(--muted-foreground))]">
            {song.key && <span className="badge-key">{song.key}</span>}
            {song.useCount ? (
              <span className="inline-flex items-center gap-1">
                <TrendingUp className="h-3 w-3" /> {song.useCount}×
              </span>
            ) : null}
          </span>
        </Link>
      ))}
    </div>
  );
}

/** Artist → Albums: this artist's albums. */
export function ArtistAlbumsTab() {
  const { artist, canEdit } = useOutletContext<ArtistOutletContext>();
  const [albums, setAlbums] = useState<Album[]>([]);
  const [loading, setLoading] = useState(true);
  const [formAlbum, setFormAlbum] = useState<Album | null | undefined>(undefined);
  const [pendingDelete, setPendingDelete] = useState<Album | null>(null);
  const [deleting, setDeleting] = useState(false);

  const refresh = () => {
    albumsApi
      .list({ artistId: artist.id })
      .then((res) => setAlbums(res.albums))
      .catch(() => {})
      .finally(() => setLoading(false));
  };

  useEffect(() => {
    refresh();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [artist.id]);

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
      {canEdit && (
        <button onClick={() => setFormAlbum(null)} className="btn-primary btn-sm">
          <Plus className="h-4 w-4" /> Add album
        </button>
      )}
      {loading ? (
        <div className="flex justify-center py-8"><div className="spinner" /></div>
      ) : albums.length === 0 ? (
        <div className="card-empty">
          <Disc3 className="mx-auto h-10 w-10 text-[hsl(var(--muted-foreground))] mb-2" />
          <p className="text-sm text-[hsl(var(--muted-foreground))]">No albums for {artist.name} yet.</p>
        </div>
      ) : (
        <div className="grid gap-3 sm:grid-cols-2">
          {albums.map((album) => (
            <AlbumCard key={album.id} album={album} canEdit={canEdit} onEdit={setFormAlbum} onDelete={setPendingDelete} />
          ))}
        </div>
      )}

      {formAlbum !== undefined && (
        <AlbumFormDialog album={formAlbum} defaultArtistId={artist.id} onClose={() => setFormAlbum(undefined)} onSaved={refresh} />
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
