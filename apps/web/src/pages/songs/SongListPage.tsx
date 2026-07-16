import { useState, useEffect } from "react";
import { Link } from "react-router-dom";
import { adminApi, shareApi, songsApi, type OrgUser, type OrganizationShareTarget, type Song, type SongGroup, type SongStatus } from "@/lib/api-client";
import { ConfirmDialog } from "@/components/shared/ConfirmDialog";
import { TempoIndicator } from "@/components/songs/TempoIndicator";
import { SongStatusBadge, SONG_STATUS_CONFIGS } from "@/components/songs/SongStatusBadge";
import { SongActionsMenu } from "@/components/songs/SongActionsMenu";
import { SongFilterToolbar, type FilterChip, type SongSortMode } from "@/components/songs/SongFilterToolbar";
import { useAuth } from "@/contexts/AuthContext";
import { Plus, Music, Download, ChevronDown, Pencil, Share2, Trash2, Star } from "lucide-react";
import { EmptyState } from "@/components/shared/EmptyState";
import { toast } from "sonner";

const PAGE_SIZE = 50;

export function SongListPage() {
  const { user, activeOrg } = useAuth();
  const canEdit = user?.role === "owner" || activeOrg?.role === "admin" || activeOrg?.role === "musician";
  const canDelegateGroupManagement = user?.role === "owner" || activeOrg?.role === "admin";
  const canBatchShareToOrganizations = user?.role === "owner" || activeOrg?.role === "admin";
  const [songs, setSongs] = useState<Song[]>([]);
  const [availableGroups, setAvailableGroups] = useState<SongGroup[]>([]);
  const [shareTargets, setShareTargets] = useState<OrganizationShareTarget[]>([]);
  const [orgMembers, setOrgMembers] = useState<OrgUser[]>([]);
  const [availableCategories, setAvailableCategories] = useState<string[]>([]);
  const [availableTags, setAvailableTags] = useState<string[]>([]);
  const [total, setTotal] = useState(0);
  const [loading, setLoading] = useState(true);
  const [q, setQ] = useState("");
  const [libraryScope, setLibraryScope] = useState<"organization" | "shared">("organization");
  const [groupFilter, setGroupFilter] = useState("");
  const [categoryFilter, setCategoryFilter] = useState("");
  const [keyFilter, setKeyFilter] = useState("");
  const [tagFilter, setTagFilter] = useState("");
  const [tempoMin, setTempoMin] = useState("");
  const [tempoMax, setTempoMax] = useState("");
  const [sort, setSort] = useState<SongSortMode>("lastEdited");
  const [statusFilter, setStatusFilter] = useState<SongStatus | "">("");
  const [favoritesOnly, setFavoritesOnly] = useState(false);
  const [showArchived, setShowArchived] = useState(false);
  const [debouncedQ, setDebouncedQ] = useState("");
  const [page, setPage] = useState(0);
  const [selectedSongIds, setSelectedSongIds] = useState<string[]>([]);
  const [showExportMenu, setShowExportMenu] = useState(false);
  const [showGroupsModal, setShowGroupsModal] = useState(false);
  const [showOrgShareModal, setShowOrgShareModal] = useState(false);
  const [newGroupName, setNewGroupName] = useState("");
  const [creatingGroup, setCreatingGroup] = useState(false);
  const [groupActionId, setGroupActionId] = useState<string | null>(null);
  const [editingGroupId, setEditingGroupId] = useState<string | null>(null);
  const [editingGroupName, setEditingGroupName] = useState("");
  const [managerSelections, setManagerSelections] = useState<Record<string, string[]>>({});
  const [organizationShareCounts, setOrganizationShareCounts] = useState<Record<string, number>>({});
  const [organizationShareActions, setOrganizationShareActions] = useState<Record<string, "share" | "unshare">>({});
  const [loadingShareTargets, setLoadingShareTargets] = useState(false);
  const [sharingToOrganizations, setSharingToOrganizations] = useState(false);
  const [pendingDeleteGroup, setPendingDeleteGroup] = useState<SongGroup | null>(null);

  const parsedTempoMin = /^\d+$/.test(tempoMin) ? Number.parseInt(tempoMin, 10) : undefined;
  const parsedTempoMax = /^\d+$/.test(tempoMax) ? Number.parseInt(tempoMax, 10) : undefined;
  const isSharedScope = libraryScope === "shared";
  const hasActiveFilters = Boolean(
    debouncedQ || groupFilter || categoryFilter || keyFilter || tagFilter || tempoMin || tempoMax ||
    statusFilter || favoritesOnly || showArchived || isSharedScope,
  );
  const totalPages = Math.max(1, Math.ceil(total / PAGE_SIZE));
  const pageStart = total === 0 ? 0 : page * PAGE_SIZE + 1;
  const pageEnd = total === 0 ? 0 : Math.min(total, (page + 1) * PAGE_SIZE);
  const canManageAnyGroup = canEdit || availableGroups.some((group) => group.canManage);

  const loadGroups = async () => {
    try {
      const res = await songsApi.getGroups();
      setAvailableGroups(res.groups);
      setManagerSelections(
        Object.fromEntries(
          res.groups.map((group) => [group.id, group.managerUserIds ?? []])
        )
      );
    } catch {
      setAvailableGroups([]);
      setManagerSelections({});
    }
  };

  // Debounce search input
  useEffect(() => {
    const t = setTimeout(() => setDebouncedQ(q), 300);
    return () => clearTimeout(t);
  }, [q]);

  useEffect(() => {
    let cancelled = false;

    loadGroups().catch(() => {
      if (!cancelled) {
        setAvailableGroups([]);
        setManagerSelections({});
      }
    });

    if (canDelegateGroupManagement) {
      adminApi
        .listUsers()
        .then((res) => {
          if (!cancelled) {
            setOrgMembers(res.users);
          }
        })
        .catch(() => {
          if (!cancelled) {
            setOrgMembers([]);
          }
        });
    } else if (!cancelled) {
      setOrgMembers([]);
    }

    songsApi
      .getCategories()
      .then((res) => {
        if (!cancelled) {
          setAvailableCategories(res.categories);
        }
      })
      .catch(() => {
        if (!cancelled) {
          setAvailableCategories([]);
        }
      });

    songsApi
      .getTags()
      .then((res) => {
        if (!cancelled) {
          setAvailableTags(res.tags);
        }
      })
      .catch(() => {
        if (!cancelled) {
          setAvailableTags([]);
        }
      });

    return () => {
      cancelled = true;
    };
  }, [canDelegateGroupManagement]);

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    songsApi
      .list({
        q: debouncedQ || undefined,
        scope: isSharedScope ? "shared" : undefined,
        groupId: groupFilter || undefined,
        category: categoryFilter || undefined,
        key: keyFilter || undefined,
        tag: tagFilter || undefined,
        tempoMin: parsedTempoMin,
        tempoMax: parsedTempoMax,
        status: statusFilter || undefined,
        favorites: favoritesOnly || undefined,
        archived: showArchived || undefined,
        sort,
        limit: PAGE_SIZE,
        offset: page * PAGE_SIZE,
      })
      .then((res) => {
        if (!cancelled) {
          setSongs(res.songs);
          setTotal(res.total);
        }
      })
      .catch(() => {})
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [debouncedQ, libraryScope, groupFilter, categoryFilter, keyFilter, tagFilter, parsedTempoMin, parsedTempoMax, statusFilter, favoritesOnly, showArchived, sort, page]);

  useEffect(() => {
    setPage(0);
  }, [debouncedQ, libraryScope, groupFilter, categoryFilter, keyFilter, tagFilter, parsedTempoMin, parsedTempoMax, statusFilter, favoritesOnly, showArchived, sort]);

  useEffect(() => {
    if (isSharedScope && groupFilter) {
      setGroupFilter("");
    }
  }, [isSharedScope, groupFilter]);

  useEffect(() => {
    setSelectedSongIds((previous) => previous.filter((songId) => songs.some((song) => song.id === songId)));
  }, [songs]);

  useEffect(() => {
    if (!showOrgShareModal) {
      return;
    }

    let cancelled = false;
    setLoadingShareTargets(true);
    Promise.all([
      shareApi.listOrganizationTargets(),
      shareApi.listBatchOrganizationShares(selectedSongIds),
    ])
      .then(([targetsRes, sharesRes]) => {
        if (!cancelled) {
          setShareTargets(targetsRes.organizations);

          const counts = sharesRes.shares.reduce<Record<string, number>>((accumulator, share) => {
            accumulator[share.organizationId] = (accumulator[share.organizationId] ?? 0) + 1;
            return accumulator;
          }, {});

          setOrganizationShareCounts(counts);
        }
      })
      .catch(() => {
        if (!cancelled) {
          setShareTargets([]);
          setOrganizationShareCounts({});
          toast.error("Failed to load organizations");
        }
      })
      .finally(() => {
        if (!cancelled) {
          setLoadingShareTargets(false);
        }
      });

    return () => {
      cancelled = true;
    };
  }, [showOrgShareModal, selectedSongIds]);

  const visibleSongIds = songs.map((song) => song.id);
  const allVisibleSelected = songs.length > 0 && visibleSongIds.every((songId) => selectedSongIds.includes(songId));
  const getSongViewHref = (songId: string) => {
    if (!keyFilter) {
      return `/songs/${songId}`;
    }

    const next = new URLSearchParams({ key: keyFilter });
    return `/songs/${songId}?${next.toString()}`;
  };

  const toggleSongSelection = (songId: string) => {
    setSelectedSongIds((previous) => (
      previous.includes(songId)
        ? previous.filter((id) => id !== songId)
        : [...previous, songId]
    ));
  };

  const toggleSelectAllVisible = () => {
    setSelectedSongIds((previous) => {
      if (allVisibleSelected) {
        return previous.filter((songId) => !visibleSongIds.includes(songId));
      }

      const next = new Set(previous);
      for (const songId of visibleSongIds) {
        next.add(songId);
      }
      return [...next];
    });
  };

  const handleExportZip = async (format: "chordpro" | "onsong" | "text") => {
    const exportIds = songs.filter((song) => selectedSongIds.includes(song.id)).map((song) => song.id);
    if (exportIds.length === 0) {
      return;
    }

    try {
      const res = await songsApi.exportZip(exportIds, format);
      if (!res.ok) {
        const body = await res.json().catch(() => ({}));
        throw new Error(body?.error?.message || "Export failed");
      }

      const blob = await res.blob();
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = `song-library-${format}.zip`;
      a.click();
      URL.revokeObjectURL(url);
      toast.success("Song library zip exported");
    } catch (err: any) {
      toast.error(err.message || "Export failed");
    }

    setShowExportMenu(false);
  };

  const closeOrgShareModal = () => {
    if (sharingToOrganizations) {
      return;
    }

    setShowOrgShareModal(false);
    setOrganizationShareActions({});
    setOrganizationShareCounts({});
  };

  const setOrganizationShareAction = (organizationId: string, action: "share" | "unshare") => {
    setOrganizationShareActions((previous) => ({
      ...previous,
      [organizationId]: action,
    }));
  };

  const clearOrganizationShareAction = (organizationId: string) => {
    setOrganizationShareActions((previous) => {
      const next = { ...previous };
      delete next[organizationId];
      return next;
    });
  };

  const handleBatchShareToOrganizations = async () => {
    if (selectedSongIds.length === 0) {
      toast.error("Select at least one song first");
      return;
    }

    const addOrganizationIds = Object.entries(organizationShareActions)
      .filter(([, action]) => action === "share")
      .map(([organizationId]) => organizationId);
    const removeOrganizationIds = Object.entries(organizationShareActions)
      .filter(([, action]) => action === "unshare")
      .map(([organizationId]) => organizationId);

    if (addOrganizationIds.length === 0 && removeOrganizationIds.length === 0) {
      toast.error("Choose at least one share change");
      return;
    }

    setSharingToOrganizations(true);
    try {
      const result = await shareApi.updateBatchOrganizationShares({
        songIds: selectedSongIds,
        addOrganizationIds,
        removeOrganizationIds,
      });

      if (result.createdShares === 0 && (result.removedShares ?? 0) === 0) {
        toast.success("No organization share changes were needed");
      } else if (result.createdShares > 0 && (result.removedShares ?? 0) > 0) {
        toast.success(`Updated organization sharing (${result.createdShares} added, ${result.removedShares} removed)`);
      } else if ((result.removedShares ?? 0) > 0) {
        toast.success(`Removed ${result.removedShares} organization share${result.removedShares === 1 ? "" : "s"}`);
      } else if (result.skippedShares > 0) {
        toast.success(`Created ${result.createdShares} new organization share${result.createdShares === 1 ? "" : "s"}`);
      } else {
        toast.success(`Shared ${selectedSongIds.length} song${selectedSongIds.length === 1 ? "" : "s"} with more organizations`);
      }

      setOrganizationShareActions({});
      setShowOrgShareModal(false);
    } catch (err: any) {
      toast.error(err.message || "Failed to update song sharing");
    } finally {
      setSharingToOrganizations(false);
    }
  };

  const handleCreateGroup = async () => {
    const name = newGroupName.trim();
    if (!name) {
      toast.error("Group name is required");
      return;
    }

    setCreatingGroup(true);
    try {
      const { group } = await songsApi.createGroup({ name });
      if (selectedSongIds.length > 0) {
        await songsApi.addSongsToGroup(group.id, selectedSongIds);
      }
      await loadGroups();
      setNewGroupName("");
      toast.success(selectedSongIds.length > 0 ? "Group created and songs added" : "Group created");
    } catch (err: any) {
      toast.error(err.message || "Failed to create group");
    } finally {
      setCreatingGroup(false);
    }
  };

  const handleAddSelectedToGroup = async (groupId: string) => {
    if (selectedSongIds.length === 0) {
      toast.error("Select at least one song first");
      return;
    }

    setGroupActionId(groupId);
    try {
      const result = await songsApi.addSongsToGroup(groupId, selectedSongIds);
      await loadGroups();
      if (result.addedSongIds.length === 0) {
        toast.success("Selected songs were already in that group");
      } else {
        toast.success(`Added ${result.addedSongIds.length} song${result.addedSongIds.length === 1 ? "" : "s"} to the group`);
      }
    } catch (err: any) {
      toast.error(err.message || "Failed to add songs to group");
    } finally {
      setGroupActionId(null);
    }
  };

  const handleSaveGroupName = async (groupId: string) => {
    const name = editingGroupName.trim();
    if (!name) {
      toast.error("Group name is required");
      return;
    }

    setGroupActionId(groupId);
    try {
      await songsApi.updateGroup(groupId, { name });
      await loadGroups();
      setEditingGroupId(null);
      setEditingGroupName("");
      toast.success("Group updated");
    } catch (err: any) {
      toast.error(err.message || "Failed to update group");
    } finally {
      setGroupActionId(null);
    }
  };

  const handleDeleteGroup = async () => {
    if (!pendingDeleteGroup) {
      return;
    }

    setGroupActionId(pendingDeleteGroup.id);
    try {
      await songsApi.deleteGroup(pendingDeleteGroup.id);
      if (groupFilter === pendingDeleteGroup.id) {
        setGroupFilter("");
      }
      await loadGroups();
      toast.success("Group deleted");
      setPendingDeleteGroup(null);
    } catch (err: any) {
      toast.error(err.message || "Failed to delete group");
    } finally {
      setGroupActionId(null);
    }
  };

  const handleManagerSelectionChange = (groupId: string, values: string[]) => {
    setManagerSelections((previous) => ({
      ...previous,
      [groupId]: values,
    }));
  };

  const handleSaveGroupManagers = async (groupId: string) => {
    setGroupActionId(groupId);
    try {
      await songsApi.updateGroupManagers(groupId, managerSelections[groupId] ?? []);
      await loadGroups();
      toast.success("Delegated managers updated");
    } catch (err: any) {
      toast.error(err.message || "Failed to update delegated managers");
    } finally {
      setGroupActionId(null);
    }
  };

  const handleStatusChange = (next: { statusFilter: SongStatus | ""; favoritesOnly: boolean; showArchived: boolean }) => {
    setStatusFilter(next.statusFilter);
    setFavoritesOnly(next.favoritesOnly);
    setShowArchived(next.showArchived);
  };

  const handleResetAdvanced = () => {
    setGroupFilter("");
    setCategoryFilter("");
    setKeyFilter("");
    setTagFilter("");
    setTempoMin("");
    setTempoMax("");
  };

  const handleClearAll = () => {
    setQ("");
    setLibraryScope("organization");
    handleResetAdvanced();
    handleStatusChange({ statusFilter: "", favoritesOnly: false, showArchived: false });
  };

  // Active-filter chips shown below the toolbar. Sort is a view preference,
  // not a filter, so it's intentionally excluded; Search already has its own
  // inline clear button, so it doesn't get a redundant chip here.
  const filterChips: FilterChip[] = [
    isSharedScope
      ? { key: "scope", label: "Organization: Shared with me", onRemove: () => setLibraryScope("organization") }
      : null,
    favoritesOnly
      ? { key: "status", label: "Status: Favorites", onRemove: () => setFavoritesOnly(false) }
      : showArchived
      ? { key: "status", label: "Status: Archived", onRemove: () => setShowArchived(false) }
      : statusFilter
      ? { key: "status", label: `Status: ${SONG_STATUS_CONFIGS[statusFilter].label}`, onRemove: () => setStatusFilter("") }
      : null,
    groupFilter
      ? {
          key: "group",
          label: `Group: ${availableGroups.find((g) => g.id === groupFilter)?.name ?? groupFilter}`,
          onRemove: () => setGroupFilter(""),
        }
      : null,
    categoryFilter
      ? { key: "category", label: `Category: ${categoryFilter}`, onRemove: () => setCategoryFilter("") }
      : null,
    keyFilter ? { key: "key", label: `Key: ${keyFilter}`, onRemove: () => setKeyFilter("") } : null,
    tagFilter ? { key: "tag", label: `Tag: ${tagFilter}`, onRemove: () => setTagFilter("") } : null,
    tempoMin || tempoMax
      ? {
          key: "bpm",
          label: `BPM: ${tempoMin || "…"}–${tempoMax || "…"}`,
          onRemove: () => {
            setTempoMin("");
            setTempoMax("");
          },
        }
      : null,
  ].filter((chip): chip is FilterChip => chip !== null);

  return (
    <div className="space-y-4">
      {/* Header */}
      <div className="page-header">
        <h2 className="page-title">Songs</h2>
        {canEdit && (
          <Link
            to="/songs/new"
            className="btn-primary"
          >
            <Plus className="h-4 w-4" /> New Song
          </Link>
        )}
      </div>

      {/* Filters */}
      <SongFilterToolbar
        q={q}
        onQChange={setQ}
        libraryScope={libraryScope}
        onLibraryScopeChange={setLibraryScope}
        statusFilter={statusFilter}
        favoritesOnly={favoritesOnly}
        showArchived={showArchived}
        onStatusChange={handleStatusChange}
        sort={sort}
        onSortChange={setSort}
        isSharedScope={isSharedScope}
        groupFilter={groupFilter}
        onGroupFilterChange={setGroupFilter}
        categoryFilter={categoryFilter}
        onCategoryFilterChange={setCategoryFilter}
        keyFilter={keyFilter}
        onKeyFilterChange={setKeyFilter}
        tagFilter={tagFilter}
        onTagFilterChange={setTagFilter}
        tempoMin={tempoMin}
        onTempoMinChange={setTempoMin}
        tempoMax={tempoMax}
        onTempoMaxChange={setTempoMax}
        onResetAdvanced={handleResetAdvanced}
        availableGroups={availableGroups}
        availableCategories={availableCategories}
        availableTags={availableTags}
        chips={filterChips}
        onClearAll={handleClearAll}
        onManageGroups={canManageAnyGroup ? () => setShowGroupsModal(true) : undefined}
      />

      {/* Results */}
      {loading ? (
        <div className="py-12 flex justify-center">
          <div className="spinner" />
        </div>
      ) : songs.length === 0 ? (
        <EmptyState
          icon={Music}
          message={
            isSharedScope
              ? "No shared songs yet."
              : hasActiveFilters
              ? "No songs match your search."
              : "No songs yet. Import your library to get started."
          }
          action={
            !hasActiveFilters && canEdit ? (
              <Link to="/songs/new" className="btn-primary">
                <Plus className="h-4 w-4" /> Create Song
              </Link>
            ) : undefined
          }
        />
      ) : (
        <>
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div className="text-xs text-[hsl(var(--muted-foreground))]">
              {total} song{total !== 1 ? "s" : ""}
              {selectedSongIds.length > 0 ? ` · ${selectedSongIds.length} selected` : ""}
              {total > 0 ? ` · Showing ${pageStart}-${pageEnd}` : ""}
            </div>

            <div className="flex flex-wrap items-center gap-3">
              <label className="inline-flex items-center gap-2 text-xs text-[hsl(var(--muted-foreground))]">
                <input
                  type="checkbox"
                  aria-label="Select all visible songs"
                  checked={allVisibleSelected}
                  onChange={toggleSelectAllVisible}
                />
                Select all
              </label>

              {canBatchShareToOrganizations && !isSharedScope && (
                <button
                  type="button"
                  onClick={() => setShowOrgShareModal(true)}
                  className="btn-outline btn-sm disabled:cursor-not-allowed disabled:opacity-50"
                  disabled={selectedSongIds.length === 0}
                >
                  <Share2 className="h-3.5 w-3.5" /> Share to Organizations{selectedSongIds.length > 0 ? ` (${selectedSongIds.length})` : ""}
                </button>
              )}

              <div className="relative">
                <button
                  type="button"
                  onClick={() => setShowExportMenu((value) => !value)}
                  className="btn-outline btn-sm disabled:cursor-not-allowed disabled:opacity-50"
                  disabled={selectedSongIds.length === 0}
                >
                  <Download className="h-3.5 w-3.5" /> Export ZIP{selectedSongIds.length > 0 ? ` (${selectedSongIds.length})` : ""} <ChevronDown className="h-3.5 w-3.5" />
                </button>

                {showExportMenu && selectedSongIds.length > 0 && (
                  <div className="fixed inset-x-4 bottom-4 z-50 rounded-xl border border-[hsl(var(--border))] bg-[hsl(var(--card))] p-1 shadow-lg sm:absolute sm:inset-x-auto sm:bottom-auto sm:right-0 sm:z-20 sm:mt-2 sm:w-48">
                    <button
                      type="button"
                      onClick={() => handleExportZip("chordpro")}
                      className="flex w-full items-center rounded-lg px-3 py-2 text-left text-sm text-[hsl(var(--foreground))] hover:bg-[hsl(var(--muted))]"
                    >
                      ChordPro ZIP (.zip)
                    </button>
                    <button
                      type="button"
                      onClick={() => handleExportZip("onsong")}
                      className="flex w-full items-center rounded-lg px-3 py-2 text-left text-sm text-[hsl(var(--foreground))] hover:bg-[hsl(var(--muted))]"
                    >
                      OnSong ZIP (.zip)
                    </button>
                    <button
                      type="button"
                      onClick={() => handleExportZip("text")}
                      className="flex w-full items-center rounded-lg px-3 py-2 text-left text-sm text-[hsl(var(--foreground))] hover:bg-[hsl(var(--muted))]"
                    >
                      Plain Text ZIP (.zip)
                    </button>
                  </div>
                )}
              </div>
            </div>
          </div>
          <div className="list-container">
            {songs.map((song) => (
              <div
                key={song.id}
                className="list-item"
              >
                <input
                  type="checkbox"
                  aria-label={`Select ${song.title}`}
                  checked={selectedSongIds.includes(song.id)}
                  onChange={() => toggleSongSelection(song.id)}
                />
                <Link
                  to={getSongViewHref(song.id)}
                  className="flex min-w-0 flex-1 items-center gap-3"
                >
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center gap-2 min-w-0">
                      <span className="font-medium text-[hsl(var(--foreground))] truncate">
                        {song.title}
                      </span>
                      {song.isFavorite && (
                        <Star className="h-3.5 w-3.5 shrink-0 fill-[hsl(var(--secondary))] text-[hsl(var(--secondary))]" aria-label="Favorite" />
                      )}
                      <SongStatusBadge status={song.status} isArchived={song.isArchived} />
                    </div>
                    <div className="mt-0.5 text-xs text-[hsl(var(--muted-foreground))]">
                      {[
                        song.artist,
                        song.sharedWithMe && song.organizationName ? `Shared from: ${song.organizationName}` : null,
                        song.category ? `Category: ${song.category}` : null,
                        song.aka ? `AKA: ${song.aka}` : null,
                        song.tags,
                      ].filter(Boolean).join(" · ")}
                    </div>
                  </div>
                  <div className="ml-4 flex items-center gap-3 text-xs text-[hsl(var(--muted-foreground))] shrink-0">
                    {song.key && (
                      <span className="badge-key">{song.key}</span>
                    )}
                    {song.tempo && <TempoIndicator tempo={song.tempo} />}
                  </div>
                </Link>
                {!isSharedScope && (
                  <SongActionsMenu
                    song={song}
                    canEdit={!!canEdit}
                    onChanged={(updated) =>
                      setSongs((prev) => prev.map((s) => (s.id === updated.id ? { ...s, ...updated } : s)))
                    }
                    onRemoved={(removed) => {
                      setSongs((prev) => prev.filter((s) => s.id !== removed.id));
                      setTotal((prev) => Math.max(0, prev - 1));
                    }}
                  />
                )}
              </div>
            ))}
          </div>
          {total > PAGE_SIZE && (
            <div className="flex flex-wrap items-center justify-between gap-3 pt-2">
              <p className="text-xs text-[hsl(var(--muted-foreground))]" aria-live="polite">
                Page {page + 1} of {totalPages}
              </p>
              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={() => setPage((current) => Math.max(0, current - 1))}
                  disabled={page === 0}
                  className="btn-outline btn-sm disabled:cursor-not-allowed disabled:opacity-50"
                >
                  Previous
                </button>
                <button
                  type="button"
                  onClick={() => setPage((current) => Math.min(totalPages - 1, current + 1))}
                  disabled={page >= totalPages - 1}
                  className="btn-outline btn-sm disabled:cursor-not-allowed disabled:opacity-50"
                >
                  Next
                </button>
              </div>
            </div>
          )}
        </>
      )}

      {showGroupsModal && (
        <div className="modal-backdrop">
          <div className="modal-content max-w-2xl space-y-4">
            <div className="flex items-start justify-between gap-3">
              <div>
                <h3 className="text-lg font-brand text-[hsl(var(--foreground))]">Song Groups</h3>
                <p className="text-sm text-[hsl(var(--muted-foreground))]">
                  Create reusable song collections and add selected songs into them.
                </p>
              </div>
              <button
                type="button"
                onClick={() => {
                  setShowGroupsModal(false);
                  setEditingGroupId(null);
                  setEditingGroupName("");
                }}
                className="btn-outline btn-sm"
              >
                Close
              </button>
            </div>

            <div className="card card-body space-y-3">
              <div className="space-y-1">
                <h4 className="text-sm font-semibold text-[hsl(var(--foreground))]">Create group</h4>
                {selectedSongIds.length > 0 && (
                  <p className="text-xs text-[hsl(var(--muted-foreground))]">
                    New groups will automatically include the {selectedSongIds.length} selected song{selectedSongIds.length === 1 ? "" : "s"}.
                  </p>
                )}
              </div>
              <div className="flex flex-wrap gap-2">
                <input
                  type="text"
                  value={newGroupName}
                  onChange={(e) => setNewGroupName(e.target.value)}
                  placeholder="Wedding set, youth night, choir rehearsal..."
                  className="input min-w-64 flex-1"
                />
                <button
                  type="button"
                  onClick={handleCreateGroup}
                  disabled={creatingGroup}
                  className="btn-primary btn-sm"
                >
                  <Plus className="h-3.5 w-3.5" /> {creatingGroup ? "Creating..." : "Create Group"}
                </button>
              </div>
            </div>

            <div className="space-y-2">
              <div className="flex items-center justify-between gap-3">
                <h4 className="text-sm font-semibold text-[hsl(var(--foreground))]">Existing groups</h4>
                {selectedSongIds.length > 0 && (
                  <span className="text-xs text-[hsl(var(--muted-foreground))]">
                    {selectedSongIds.length} selected song{selectedSongIds.length === 1 ? "" : "s"} ready to add
                  </span>
                )}
              </div>

              {availableGroups.length === 0 ? (
                <div className="card-empty py-8">
                  <p className="text-sm text-[hsl(var(--muted-foreground))]">No song groups yet.</p>
                </div>
              ) : (
                <div className="list-container">
                  {availableGroups.map((group) => {
                    const isEditing = editingGroupId === group.id;
                    const isBusy = groupActionId === group.id;
                    const canManageGroup = canEdit || group.canManage;
                    const delegatedManagers = group.managerNames ?? [];

                    return (
                      <div key={group.id} className="list-item gap-3">
                        <div className="min-w-0 flex-1 space-y-1">
                          {isEditing ? (
                            <div className="flex flex-wrap items-center gap-2">
                              <input
                                type="text"
                                value={editingGroupName}
                                onChange={(e) => setEditingGroupName(e.target.value)}
                                className="input min-w-56 flex-1"
                                aria-label={`Rename ${group.name}`}
                              />
                              <button
                                type="button"
                                onClick={() => handleSaveGroupName(group.id)}
                                disabled={isBusy}
                                className="btn-primary btn-sm"
                              >
                                Save
                              </button>
                              <button
                                type="button"
                                onClick={() => {
                                  setEditingGroupId(null);
                                  setEditingGroupName("");
                                }}
                                className="btn-outline btn-sm"
                              >
                                Cancel
                              </button>
                            </div>
                          ) : (
                            <>
                              <p className="font-medium text-[hsl(var(--foreground))]">{group.name}</p>
                              <p className="text-xs text-[hsl(var(--muted-foreground))]">
                                {group.songCount ?? 0} song{group.songCount === 1 ? "" : "s"}
                              </p>
                              {delegatedManagers.length > 0 && (
                                <p className="text-xs text-[hsl(var(--muted-foreground))]">
                                  Delegated managers: {delegatedManagers.join(", ")}
                                </p>
                              )}
                              {!canManageGroup && (
                                <p className="text-xs text-[hsl(var(--muted-foreground))]">
                                  Managed by delegated users or organization editors.
                                </p>
                              )}
                            </>
                          )}
                        </div>

                        {!isEditing && canManageGroup && (
                          <div className="flex flex-wrap items-center gap-2">
                            {selectedSongIds.length > 0 && (
                              <button
                                type="button"
                                onClick={() => handleAddSelectedToGroup(group.id)}
                                disabled={isBusy}
                                className="btn-outline btn-sm"
                              >
                                Add Selected
                              </button>
                            )}
                            <button
                              type="button"
                              onClick={() => {
                                setEditingGroupId(group.id);
                                setEditingGroupName(group.name);
                              }}
                              className="btn-outline btn-sm"
                              aria-label={`Rename ${group.name}`}
                            >
                              <Pencil className="h-3.5 w-3.5" /> Rename
                            </button>
                            <button
                              type="button"
                              onClick={() => setPendingDeleteGroup(group)}
                              disabled={isBusy}
                              className="btn-destructive btn-sm"
                              aria-label={`Delete ${group.name}`}
                            >
                              <Trash2 className="h-3.5 w-3.5" /> Delete
                            </button>
                          </div>
                        )}

                        {canDelegateGroupManagement && !isEditing && (
                          <div className="w-full space-y-2 border-t border-[hsl(var(--border))] pt-3">
                            <div className="flex flex-wrap items-center justify-between gap-2">
                              <p className="text-xs font-medium text-[hsl(var(--foreground))]">
                                Delegated group managers
                              </p>
                              <button
                                type="button"
                                onClick={() => handleSaveGroupManagers(group.id)}
                                disabled={isBusy}
                                className="btn-outline btn-sm"
                              >
                                Save Managers
                              </button>
                            </div>
                            <p className="text-xs text-[hsl(var(--muted-foreground))]">
                              Assign specific users who can manage this group even without broader song-edit access.
                            </p>
                            <select
                              multiple
                              aria-label={`Delegated managers for ${group.name}`}
                              value={managerSelections[group.id] ?? []}
                              onChange={(e) => handleManagerSelectionChange(group.id, Array.from(e.target.selectedOptions).map((option) => option.value))}
                              className="select min-h-32 w-full"
                            >
                              {orgMembers.map((member) => (
                                <option key={member.id} value={member.id}>
                                  {(member.displayName || member.email)} — {member.orgRole}
                                </option>
                              ))}
                            </select>
                          </div>
                        )}
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
          </div>
        </div>
      )}

      {showOrgShareModal && (
        <div className="modal-backdrop">
          <div className="modal-content max-w-2xl space-y-4">
            <div className="flex items-start justify-between gap-3">
              <div>
                <h3 className="text-lg font-brand text-[hsl(var(--foreground))]">Edit organization sharing</h3>
                <p className="text-sm text-[hsl(var(--muted-foreground))]">
                  Shared songs will appear in the recipient organization&apos;s Shared with me library.
                </p>
              </div>
              <button
                type="button"
                onClick={closeOrgShareModal}
                className="btn-outline btn-sm"
                disabled={sharingToOrganizations}
              >
                Close
              </button>
            </div>

            <div className="card card-body space-y-3">
              <p className="text-sm text-[hsl(var(--foreground))]">
                {selectedSongIds.length} selected song{selectedSongIds.length === 1 ? "" : "s"}
              </p>
              <p className="text-xs text-[hsl(var(--muted-foreground))]">
                Add or remove organization access for the selected songs.
              </p>
            </div>

            {loadingShareTargets ? (
              <div className="flex justify-center py-10">
                <div className="spinner" />
              </div>
            ) : shareTargets.length === 0 ? (
              <div className="card-empty py-10">
                <p className="text-sm text-[hsl(var(--muted-foreground))]">No other organizations are available to receive shared songs yet.</p>
              </div>
            ) : (
              <div className="list-container max-h-80 overflow-y-auto">
                {shareTargets.map((organization) => {
                  const sharedCount = organizationShareCounts[organization.id] ?? 0;
                  const pendingAction = organizationShareActions[organization.id] ?? null;
                  const statusLabel = pendingAction === "share"
                    ? `Pending: share with all ${selectedSongIds.length} selected song${selectedSongIds.length === 1 ? "" : "s"}`
                    : pendingAction === "unshare"
                    ? "Pending: remove from all selected songs"
                    : sharedCount === 0
                    ? "Not currently shared"
                    : sharedCount === selectedSongIds.length
                    ? `Shared with all ${selectedSongIds.length} selected song${selectedSongIds.length === 1 ? "" : "s"}`
                    : `Shared with ${sharedCount} of ${selectedSongIds.length} selected songs`;

                  return (
                    <div key={organization.id} className="list-item gap-3">
                      <div className="min-w-0 flex-1">
                        <p className="font-medium text-[hsl(var(--foreground))]">{organization.name}</p>
                        <p className="text-xs text-[hsl(var(--muted-foreground))]">{statusLabel}</p>
                      </div>
                      <div className="flex flex-wrap gap-2">
                        <button
                          type="button"
                          onClick={() => setOrganizationShareAction(organization.id, "share")}
                          className="btn-outline btn-sm"
                          aria-label={`Share selected songs with ${organization.name}`}
                        >
                          Share selected
                        </button>
                        <button
                          type="button"
                          onClick={() => setOrganizationShareAction(organization.id, "unshare")}
                          className="btn-outline btn-sm"
                          aria-label={`Remove selected songs from ${organization.name}`}
                        >
                          Unshare selected
                        </button>
                        {pendingAction && (
                          <button
                            type="button"
                            onClick={() => clearOrganizationShareAction(organization.id)}
                            className="btn-outline btn-sm"
                            aria-label={`Clear pending changes for ${organization.name}`}
                          >
                            Reset
                          </button>
                        )}
                      </div>
                    </div>
                  );
                })}
              </div>
            )}

            <div className="flex flex-wrap justify-end gap-2">
              <button
                type="button"
                onClick={closeOrgShareModal}
                className="btn-outline btn-sm"
                disabled={sharingToOrganizations}
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={handleBatchShareToOrganizations}
                className="btn-primary btn-sm"
                disabled={sharingToOrganizations || loadingShareTargets || shareTargets.length === 0}
              >
                <Share2 className="h-3.5 w-3.5" /> {sharingToOrganizations ? "Saving..." : "Save share changes"}
              </button>
            </div>
          </div>
        </div>
      )}

      <ConfirmDialog
        open={Boolean(pendingDeleteGroup)}
        title={pendingDeleteGroup ? `Delete \"${pendingDeleteGroup.name}\"?` : "Delete song group?"}
        description="Songs will remain in the library. Only the group will be removed."
        confirmLabel="Delete group"
        busy={groupActionId === pendingDeleteGroup?.id}
        onClose={() => {
          if (!groupActionId) {
            setPendingDeleteGroup(null);
          }
        }}
        onConfirm={handleDeleteGroup}
      />
    </div>
  );
}
