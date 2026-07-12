import { useState, useMemo } from "react";
import { useNavigate } from "react-router-dom";
import { setlistsApi, type Setlist } from "@/lib/api-client";
import { useApiList } from "@/hooks/useApiList";
import { useAuth } from "@/contexts/AuthContext";
import { SetlistCard } from "@/components/setlists/SetlistCard";
import { ArchivedSetlistsPanel } from "@/components/setlists/ArchivedSetlistsPanel";
import { SetlistTrashPanel } from "@/components/setlists/SetlistTrashPanel";
import { toast } from "sonner";
import { Plus, ListMusic, Archive, Trash2, Search } from "lucide-react";
import { CardGrid } from "@/components/shared/CardGrid";
import { EmptyState } from "@/components/shared/EmptyState";

type SortMode = "edited" | "alphabetical" | "duration" | "songs";

const SORT_LABELS: Record<SortMode, string> = {
  edited: "Last edited",
  alphabetical: "A–Z",
  duration: "Duration",
  songs: "Song count",
};

function sortSetlists(setlists: Setlist[], mode: SortMode): Setlist[] {
  const sorted = [...setlists];
  switch (mode) {
    case "alphabetical":
      return sorted.sort((a, b) => a.name.localeCompare(b.name));
    case "duration":
      return sorted.sort((a, b) => (b.totalDuration ?? 0) - (a.totalDuration ?? 0));
    case "songs":
      return sorted.sort((a, b) => (b.songCount ?? 0) - (a.songCount ?? 0));
    case "edited":
    default:
      return sorted.sort(
        (a, b) => new Date(b.updatedAt ?? 0).getTime() - new Date(a.updatedAt ?? 0).getTime(),
      );
  }
}

/**
 * Setlist Hub — the setlists landing page: searchable/sortable grid of active
 * setlists with archive and trash management.
 */
export function SetlistHubPage() {
  const { user, activeOrg } = useAuth();
  const canEdit = user?.role === "owner" || activeOrg?.role === "admin" || activeOrg?.role === "musician";
  const isAdmin = user?.role === "owner" || activeOrg?.role === "admin";
  const navigate = useNavigate();
  const isNew = window.location.pathname.endsWith("/new");

  const { data: setlists, setData: setSetlists, loading, refresh } = useApiList<Setlist[]>(
    () => setlistsApi.list({ view: "active" }).then((res) => res.setlists),
    [],
  );
  const [query, setQuery] = useState("");
  const [sortMode, setSortMode] = useState<SortMode>("edited");
  const [showArchived, setShowArchived] = useState(false);
  const [showTrash, setShowTrash] = useState(false);

  // Create-new modal state
  const [showCreate, setShowCreate] = useState(isNew);
  const [newName, setNewName] = useState("");
  const [newCategory, setNewCategory] = useState("");
  const [newLeader, setNewLeader] = useState("");
  const [creating, setCreating] = useState(false);

  const handleCreate = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newName.trim()) return;
    setCreating(true);
    try {
      const res = await setlistsApi.create({
        name: newName.trim(),
        category: newCategory.trim() || undefined,
        leader: newLeader.trim() || undefined,
      });
      toast.success("Setlist created!");
      navigate(`/setlists/${res.setlist.id}`);
    } catch (err: any) {
      toast.error(err.message || "Failed to create");
    } finally {
      setCreating(false);
    }
  };

  const handleArchive = async (setlist: Setlist) => {
    try {
      await setlistsApi.archive(setlist.id);
      setSetlists((prev) => prev.filter((s) => s.id !== setlist.id));
      toast.success(`"${setlist.name}" archived`, {
        action: {
          label: "Undo",
          onClick: async () => {
            await setlistsApi.unarchive(setlist.id).catch(() => {});
            refresh();
          },
        },
      });
    } catch (err: any) {
      toast.error(err.message || "Failed to archive");
    }
  };

  const handleTrash = async (setlist: Setlist) => {
    try {
      await setlistsApi.delete(setlist.id);
      setSetlists((prev) => prev.filter((s) => s.id !== setlist.id));
      toast.success(`"${setlist.name}" moved to trash`, {
        action: {
          label: "Undo",
          onClick: async () => {
            await setlistsApi.restore(setlist.id).catch(() => {});
            refresh();
          },
        },
      });
    } catch (err: any) {
      toast.error(err.message || "Failed to delete");
    }
  };

  const visibleSetlists = useMemo(() => {
    const filtered = query
      ? setlists.filter(
          (s) =>
            s.name.toLowerCase().includes(query.toLowerCase()) ||
            (s.category ?? "").toLowerCase().includes(query.toLowerCase()) ||
            (s.leader ?? "").toLowerCase().includes(query.toLowerCase()),
        )
      : setlists;
    return sortSetlists(filtered, sortMode);
  }, [setlists, query, sortMode]);

  return (
    <div className="space-y-4">
      {/* Header */}
      <div className="page-header">
        <h2 className="page-title">Setlists</h2>
        <div className="flex flex-wrap items-center gap-2">
          <button type="button" onClick={() => setShowArchived(true)} className="btn-outline">
            <Archive className="h-4 w-4" /> Archive
          </button>
          {canEdit && (
            <button type="button" onClick={() => setShowTrash(true)} className="btn-outline">
              <Trash2 className="h-4 w-4" /> Trash
            </button>
          )}
          {canEdit && (
            <button onClick={() => setShowCreate(true)} className="btn-primary">
              <Plus className="h-4 w-4" /> New Setlist
            </button>
          )}
        </div>
      </div>

      {/* Search + sort */}
      <div className="flex flex-wrap items-center gap-2">
        <div className="relative flex-1 min-w-[200px]">
          <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 h-4 w-4 text-[hsl(var(--muted-foreground))]" />
          <input
            type="search"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Search setlists…"
            className="input w-full pl-8"
            aria-label="Search setlists"
          />
        </div>
        <select
          value={sortMode}
          onChange={(e) => setSortMode(e.target.value as SortMode)}
          className="input w-auto"
          aria-label="Sort setlists"
        >
          {(Object.keys(SORT_LABELS) as SortMode[]).map((mode) => (
            <option key={mode} value={mode}>
              Sort: {SORT_LABELS[mode]}
            </option>
          ))}
        </select>
      </div>

      {/* Grid */}
      {loading ? (
        <div className="flex items-center justify-center py-12">
          <div className="spinner" />
        </div>
      ) : visibleSetlists.length === 0 ? (
        <EmptyState
          icon={ListMusic}
          message={query ? "No setlists match your search." : "No setlists yet."}
          action={
            canEdit && !query ? (
              <button onClick={() => setShowCreate(true)} className="btn-primary">
                <Plus className="h-4 w-4" /> Create Setlist
              </button>
            ) : undefined
          }
        />
      ) : (
        <CardGrid>
          {visibleSetlists.map((sl) => (
            <SetlistCard
              key={sl.id}
              setlist={sl}
              canEdit={!!canEdit}
              onArchive={handleArchive}
              onTrash={handleTrash}
            />
          ))}
        </CardGrid>
      )}

      {/* Create Modal */}
      {showCreate && (
        <div className="modal-backdrop">
          <form onSubmit={handleCreate} className="modal-content max-w-sm space-y-4">
            <h3 className="text-lg font-brand text-[hsl(var(--foreground))]">New Setlist</h3>
            <div className="space-y-2">
              <label className="text-sm font-medium text-[hsl(var(--foreground))]">Name *</label>
              <input
                type="text"
                required
                value={newName}
                onChange={(e) => setNewName(e.target.value)}
                className="input"
                placeholder="Sunday Morning Service"
                autoFocus
              />
            </div>
            <div className="space-y-2">
              <label className="text-sm font-medium text-[hsl(var(--foreground))]">Category</label>
              <input
                type="text"
                value={newCategory}
                onChange={(e) => setNewCategory(e.target.value)}
                className="input"
                placeholder="Sunday, Midweek, Special"
              />
            </div>
            <div className="space-y-2">
              <label className="text-sm font-medium text-[hsl(var(--foreground))]">Leader</label>
              <input
                type="text"
                value={newLeader}
                onChange={(e) => setNewLeader(e.target.value)}
                className="input"
                placeholder="Who leads this set"
              />
            </div>
            <div className="flex gap-3">
              <button type="submit" disabled={creating} className="btn-primary flex-1">
                {creating ? "Creating..." : "Create"}
              </button>
              <button
                type="button"
                onClick={() => {
                  setShowCreate(false);
                  if (isNew) navigate("/setlists");
                }}
                className="btn-outline"
              >
                Cancel
              </button>
            </div>
          </form>
        </div>
      )}

      <ArchivedSetlistsPanel
        open={showArchived}
        onClose={() => setShowArchived(false)}
        canEdit={!!canEdit}
        onChanged={refresh}
      />
      <SetlistTrashPanel
        open={showTrash}
        onClose={() => setShowTrash(false)}
        canEdit={!!canEdit}
        isAdmin={!!isAdmin}
        onChanged={refresh}
      />
    </div>
  );
}
