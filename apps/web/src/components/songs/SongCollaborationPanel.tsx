import { useEffect, useMemo, useState } from "react";
import { MessageSquare, Flag, NotebookPen, Plus, Reply, CheckCircle2, RotateCcw, Trash2, X } from "lucide-react";
import { songCollaborationApi, type SongCollaborationItem } from "@/lib/api-client";
import { getArrangementSectionChoices } from "@/utils/chordpro-arrangement";
import { toast } from "sonner";

interface SongCollaborationPanelProps {
  songId: string;
  sourceContent: string;
  canEdit: boolean;
  /** Omit the internal section header (when hosted inside a CollapsibleSection). */
  hideHeader?: boolean;
}

type ComposerState = {
  type: SongCollaborationItem["type"];
  parentId?: string;
  anchor: string;
  title: string;
  content: string;
};

const DEFAULT_COMPOSER: ComposerState = {
  type: "comment",
  anchor: "",
  title: "",
  content: "",
};

function formatTimestamp(value?: string) {
  if (!value) {
    return "Just now";
  }

  return new Date(value).toLocaleString(undefined, {
    month: "short",
    day: "numeric",
    hour: "numeric",
    minute: "2-digit",
  });
}

function getEmptyState(type: SongCollaborationItem["type"]) {
  if (type === "rehearsal_marker") {
    return "No rehearsal markers yet.";
  }
  if (type === "rehearsal_note") {
    return "No rehearsal notes yet.";
  }
  return "No comment threads yet.";
}

export function SongCollaborationPanel({ songId, sourceContent, canEdit, hideHeader = false }: SongCollaborationPanelProps) {
  const [items, setItems] = useState<SongCollaborationItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [supported, setSupported] = useState(true);
  const [composer, setComposer] = useState<ComposerState | null>(null);
  const [saving, setSaving] = useState(false);
  const [busyId, setBusyId] = useState<string | null>(null);

  const sectionOptions = useMemo(() => {
    const names = getArrangementSectionChoices(sourceContent).map((section) => section.name);
    return ["", ...Array.from(new Set(names))];
  }, [sourceContent]);

  useEffect(() => {
    let active = true;
    setLoading(true);
    setSupported(true);

    songCollaborationApi
      .list(songId)
      .then((res) => {
        if (!active) {
          return;
        }
        setItems(res.items);
      })
      .catch(() => {
        if (!active) {
          return;
        }
        setSupported(false);
      })
      .finally(() => {
        if (active) {
          setLoading(false);
        }
      });

    return () => {
      active = false;
    };
  }, [songId]);

  const markers = items.filter((item) => item.type === "rehearsal_marker");
  const notes = items.filter((item) => item.type === "rehearsal_note");
  const comments = items.filter((item) => item.type === "comment");
  const rootThreads = comments.filter((item) => !item.parentId);

  const openComposer = (type: SongCollaborationItem["type"], overrides?: Partial<ComposerState>) => {
    setComposer({ ...DEFAULT_COMPOSER, type, ...overrides });
  };

  const closeComposer = () => {
    setComposer(null);
  };

  const handleSave = async () => {
    if (!composer || !composer.content.trim()) {
      toast.error("Content is required");
      return;
    }

    setSaving(true);
    try {
      const res = await songCollaborationApi.create(songId, {
        type: composer.type,
        anchor: composer.anchor || undefined,
        title: composer.title || undefined,
        content: composer.content.trim(),
        parentId: composer.parentId,
      });
      setItems((prev) => [...prev, res.item]);
      closeComposer();
      toast.success(
        composer.type === "comment"
          ? composer.parentId
            ? "Reply added"
            : "Comment thread started"
          : composer.type === "rehearsal_marker"
            ? "Rehearsal marker added"
            : "Rehearsal note added",
      );
    } catch (error: any) {
      toast.error(error.message || "Failed to save collaboration item");
    } finally {
      setSaving(false);
    }
  };

  const handleToggleStatus = async (item: SongCollaborationItem) => {
    setBusyId(item.id);
    try {
      const res = await songCollaborationApi.update(songId, item.id, {
        status: item.status === "resolved" ? "open" : "resolved",
      });
      setItems((prev) => prev.map((entry) => (entry.id === item.id ? res.item : entry)));
    } catch (error: any) {
      toast.error(error.message || "Failed to update thread");
    } finally {
      setBusyId(null);
    }
  };

  const handleDelete = async (item: SongCollaborationItem) => {
    setBusyId(item.id);
    try {
      await songCollaborationApi.delete(songId, item.id);
      setItems((prev) => prev.filter((entry) => entry.id !== item.id && entry.parentId !== item.id));
      toast.success("Collaboration item deleted");
    } catch (error: any) {
      toast.error(error.message || "Failed to delete collaboration item");
    } finally {
      setBusyId(null);
    }
  };

  if (!supported && !loading) {
    return null;
  }

  const renderList = (type: SongCollaborationItem["type"], list: SongCollaborationItem[]) => {
    if (loading) {
      return <p className="text-xs text-[hsl(var(--muted-foreground))]">Loading…</p>;
    }

    if (list.length === 0) {
      return <p className="text-xs text-[hsl(var(--muted-foreground))]">{getEmptyState(type)}</p>;
    }

    return (
      <div className="space-y-2">
        {list.map((item) => (
          <div key={item.id} className="rounded-lg border border-[hsl(var(--border))] bg-[hsl(var(--card))] p-3">
            <div className="flex items-start justify-between gap-3">
              <div className="space-y-1">
                <div className="flex flex-wrap items-center gap-2 text-xs text-[hsl(var(--muted-foreground))]">
                  {item.anchor && <span className="badge-muted">{item.anchor}</span>}
                  {item.title && <span className="font-medium text-[hsl(var(--foreground))]">{item.title}</span>}
                </div>
                <p className="text-sm text-[hsl(var(--foreground))] whitespace-pre-wrap">{item.content}</p>
                <p className="text-[11px] text-[hsl(var(--muted-foreground))]">
                  {item.authorName || "Team member"} · {formatTimestamp(item.createdAt)}
                </p>
              </div>
              {canEdit && (
                <button
                  onClick={() => handleDelete(item)}
                  disabled={busyId === item.id}
                  className="rounded p-1 text-[hsl(var(--muted-foreground))] hover:text-[hsl(var(--destructive))] transition-colors"
                  title="Delete item"
                >
                  <Trash2 className="h-3.5 w-3.5" />
                </button>
              )}
            </div>
          </div>
        ))}
      </div>
    );
  };

  return (
    <div className="space-y-3 print-hidden" data-testid="song-collaboration-panel">
      <div className="flex flex-wrap items-center justify-between gap-3">
        {!hideHeader && (
          <h3 className="section-title">
            <MessageSquare className="section-title-icon" /> Collaboration & Rehearsal
            <span className="text-xs font-normal text-[hsl(var(--muted-foreground))]">
              ({items.length})
            </span>
          </h3>
        )}
        {canEdit && (
          <div className="flex flex-wrap gap-2">
            <button onClick={() => openComposer("comment")} className="btn-outline btn-sm border-dashed">
              <Plus className="h-3 w-3" /> New Thread
            </button>
            <button onClick={() => openComposer("rehearsal_marker")} className="btn-outline btn-sm border-dashed">
              <Flag className="h-3 w-3" /> Mark Section
            </button>
            <button onClick={() => openComposer("rehearsal_note")} className="btn-outline btn-sm border-dashed">
              <NotebookPen className="h-3 w-3" /> Add Rehearsal Note
            </button>
          </div>
        )}
      </div>

      <div className="grid gap-3 xl:grid-cols-[1fr_1fr_1.4fr]">
        <div className="card card-body space-y-3">
          <div className="flex items-center gap-2 text-sm font-semibold text-[hsl(var(--foreground))]">
            <Flag className="h-4 w-4 text-[hsl(var(--secondary))]" /> Rehearsal Markers
          </div>
          {renderList("rehearsal_marker", markers)}
        </div>

        <div className="card card-body space-y-3">
          <div className="flex items-center gap-2 text-sm font-semibold text-[hsl(var(--foreground))]">
            <NotebookPen className="h-4 w-4 text-[hsl(var(--secondary))]" /> Notes Layer
          </div>
          {renderList("rehearsal_note", notes)}
        </div>

        <div className="card card-body space-y-3">
          <div className="flex items-center gap-2 text-sm font-semibold text-[hsl(var(--foreground))]">
            <MessageSquare className="h-4 w-4 text-[hsl(var(--secondary))]" /> Comment Threads
          </div>
          {loading ? (
            <p className="text-xs text-[hsl(var(--muted-foreground))]">Loading…</p>
          ) : rootThreads.length === 0 ? (
            <p className="text-xs text-[hsl(var(--muted-foreground))]">No comment threads yet.</p>
          ) : (
            <div className="space-y-3">
              {rootThreads.map((thread) => {
                const replies = comments.filter((item) => item.parentId === thread.id);
                return (
                  <div key={thread.id} className="rounded-lg border border-[hsl(var(--border))] bg-[hsl(var(--card))] p-3">
                    <div className="flex items-start justify-between gap-3">
                      <div className="space-y-1">
                        <div className="flex flex-wrap items-center gap-2 text-xs text-[hsl(var(--muted-foreground))]">
                          {thread.anchor && <span className="badge-muted">{thread.anchor}</span>}
                          <span className={`badge-muted ${thread.status === "resolved" ? "!text-green-700 dark:!text-green-300" : ""}`}>
                            {thread.status === "resolved" ? "Resolved" : "Open"}
                          </span>
                        </div>
                        <p className="text-sm text-[hsl(var(--foreground))] whitespace-pre-wrap">{thread.content}</p>
                        <p className="text-[11px] text-[hsl(var(--muted-foreground))]">
                          {thread.authorName || "Team member"} · {formatTimestamp(thread.createdAt)}
                        </p>
                      </div>
                      {canEdit && (
                        <div className="flex items-center gap-1">
                          <button
                            onClick={() => openComposer("comment", { anchor: thread.anchor || "", parentId: thread.id })}
                            className="rounded p-1 text-[hsl(var(--muted-foreground))] hover:text-[hsl(var(--foreground))] transition-colors"
                            title="Reply"
                          >
                            <Reply className="h-3.5 w-3.5" />
                          </button>
                          <button
                            onClick={() => handleToggleStatus(thread)}
                            disabled={busyId === thread.id}
                            className="rounded p-1 text-[hsl(var(--muted-foreground))] hover:text-[hsl(var(--foreground))] transition-colors"
                            title={thread.status === "resolved" ? "Reopen thread" : "Resolve thread"}
                          >
                            {thread.status === "resolved" ? <RotateCcw className="h-3.5 w-3.5" /> : <CheckCircle2 className="h-3.5 w-3.5" />}
                          </button>
                          <button
                            onClick={() => handleDelete(thread)}
                            disabled={busyId === thread.id}
                            className="rounded p-1 text-[hsl(var(--muted-foreground))] hover:text-[hsl(var(--destructive))] transition-colors"
                            title="Delete thread"
                          >
                            <Trash2 className="h-3.5 w-3.5" />
                          </button>
                        </div>
                      )}
                    </div>

                    {replies.length > 0 && (
                      <div className="mt-3 space-y-2 border-l border-[hsl(var(--border))] pl-3">
                        {replies.map((reply) => (
                          <div key={reply.id} className="rounded-md bg-[hsl(var(--muted))] px-3 py-2">
                            <p className="text-sm text-[hsl(var(--foreground))] whitespace-pre-wrap">{reply.content}</p>
                            <p className="mt-1 text-[11px] text-[hsl(var(--muted-foreground))]">
                              {reply.authorName || "Team member"} · {formatTimestamp(reply.createdAt)}
                            </p>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          )}
        </div>
      </div>

      {composer && (
        <div className="modal-backdrop print-hidden">
          <div className="modal-content max-w-lg">
            <div className="mb-4 flex items-center justify-between gap-3">
              <div>
                <h3 className="text-lg font-brand text-[hsl(var(--foreground))]">
                  {composer.type === "comment"
                    ? composer.parentId
                      ? "Reply to Thread"
                      : "Start Comment Thread"
                    : composer.type === "rehearsal_marker"
                      ? "Add Rehearsal Marker"
                      : "Add Rehearsal Note"}
                </h3>
                <p className="text-xs text-[hsl(var(--muted-foreground))]">
                  Keep rehearsal details outside the main ChordPro content.
                </p>
              </div>
              <button onClick={closeComposer} className="text-[hsl(var(--muted-foreground))] hover:text-[hsl(var(--foreground))]">
                <X className="h-5 w-5" />
              </button>
            </div>

            <div className="space-y-3">
              <div>
                <label className="mb-1 block text-sm font-medium text-[hsl(var(--foreground))]">
                  Section
                </label>
                <select
                  value={composer.anchor}
                  onChange={(event) => setComposer((prev) => (prev ? { ...prev, anchor: event.target.value } : prev))}
                  className="select"
                >
                  <option value="">General song</option>
                  {sectionOptions.filter(Boolean).map((option) => (
                    <option key={option} value={option}>
                      {option}
                    </option>
                  ))}
                </select>
              </div>

              {composer.type !== "comment" && (
                <div>
                  <label className="mb-1 block text-sm font-medium text-[hsl(var(--foreground))]">
                    Label
                  </label>
                  <input
                    value={composer.title}
                    onChange={(event) => setComposer((prev) => (prev ? { ...prev, title: event.target.value } : prev))}
                    className="input"
                    placeholder={composer.type === "rehearsal_marker" ? "Cutoff, transition, cue…" : "Optional note label"}
                  />
                </div>
              )}

              <div>
                <label className="mb-1 block text-sm font-medium text-[hsl(var(--foreground))]">
                  {composer.type === "rehearsal_marker" ? "Reminder" : composer.type === "rehearsal_note" ? "Note" : "Comment"}
                </label>
                <textarea
                  value={composer.content}
                  onChange={(event) => setComposer((prev) => (prev ? { ...prev, content: event.target.value } : prev))}
                  rows={4}
                  className="input"
                  placeholder={composer.type === "comment" ? "Share an arrangement or rehearsal idea…" : "Capture what the team should remember…"}
                />
              </div>

              <div className="flex justify-end gap-2 pt-2">
                <button onClick={closeComposer} className="btn-outline btn-sm">
                  Cancel
                </button>
                <button onClick={handleSave} disabled={saving} className="btn-primary btn-sm">
                  {saving ? "Saving..." : "Save"}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}