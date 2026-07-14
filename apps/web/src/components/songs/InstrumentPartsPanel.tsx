import { useState, useEffect } from "react";
import { instrumentPartsApi, type InstrumentPart, type SongTier } from "@/lib/api-client";
import { ChordProRenderer } from "@/components/songs/ChordProRenderer";
import { StaffNotation } from "@/components/songs/StaffNotation";
import { toast } from "sonner";
import { Guitar, Plus, Pencil, X, ChevronDown, Check } from "lucide-react";

const ICON_CHOICES = ["🎸", "🎹", "🎻", "🥁", "🎺", "🎷", "🎤", "🪕", "🎼", "🎵"];
const COLOR_CHOICES = ["#6b5bff", "#e5484d", "#12a594", "#f76b15", "#8e4ec6", "#0091ff", "#f5a623", "#30a46c"];

const TIER_LABEL: Record<SongTier, string> = {
  personal: "Private",
  organization: "Shared with org",
  global: "Core library",
};

/**
 * Per-musician instrument layers over a song's chart (story 5). A musician adds
 * their own part (icon + color + notes + optional staff notation), toggles their
 * layer on, and can peek at other musicians' shared parts. A single part can be
 * promoted on its own (personal → org → global).
 */
export function InstrumentPartsPanel({
  songId,
  songKey,
  baseTranspose,
  showChords,
  nashville,
  fontSize,
  isOwner,
  isAdmin,
  currentUserId,
}: {
  songId: string;
  songKey?: string | null;
  baseTranspose: number;
  showChords: boolean;
  nashville: boolean;
  fontSize: number;
  isOwner: boolean;
  isAdmin: boolean;
  currentUserId?: string;
}) {
  const [open, setOpen] = useState(false);
  const [parts, setParts] = useState<InstrumentPart[]>([]);
  const [enabled, setEnabled] = useState<Set<string>>(new Set());
  const [loaded, setLoaded] = useState(false);
  const [showForm, setShowForm] = useState(false);
  const [editing, setEditing] = useState<InstrumentPart | null>(null);
  const [saving, setSaving] = useState(false);

  // form fields
  const [name, setName] = useState("");
  const [icon, setIcon] = useState(ICON_CHOICES[0]);
  const [color, setColor] = useState(COLOR_CHOICES[0]);
  const [content, setContent] = useState("");
  const [abc, setAbc] = useState("");

  useEffect(() => {
    if (!open || loaded) return;
    instrumentPartsApi
      .list(songId)
      .then((res) => {
        setParts(res.parts);
        // Default: show my own layers.
        setEnabled(new Set(res.parts.filter((p) => p.isMine).map((p) => p.id)));
      })
      .catch(() => toast.error("Failed to load instrument parts"))
      .finally(() => setLoaded(true));
  }, [open, loaded, songId]);

  const resetForm = () => {
    setEditing(null);
    setName("");
    setIcon(ICON_CHOICES[0]);
    setColor(COLOR_CHOICES[0]);
    setContent("");
    setAbc("");
  };

  const openNew = () => {
    resetForm();
    setShowForm(true);
  };

  const openEdit = (part: InstrumentPart) => {
    setEditing(part);
    setName(part.name);
    setIcon(part.icon || ICON_CHOICES[0]);
    setColor(part.color || COLOR_CHOICES[0]);
    setContent(part.content || "");
    setAbc(part.abcNotation || "");
    setShowForm(true);
  };

  const save = async () => {
    if (!name.trim()) {
      toast.error("Give your instrument a name");
      return;
    }
    setSaving(true);
    const payload = {
      name: name.trim(),
      icon,
      color,
      content: content.trim() || null,
      abcNotation: abc.trim() || null,
    };
    try {
      if (editing) {
        const res = await instrumentPartsApi.update(songId, editing.id, payload);
        setParts((prev) => prev.map((p) => (p.id === editing.id ? res.part : p)));
        toast.success("Instrument part updated");
      } else {
        const res = await instrumentPartsApi.create(songId, payload);
        setParts((prev) => [...prev, res.part]);
        setEnabled((prev) => new Set(prev).add(res.part.id));
        toast.success("Instrument part added");
      }
      setShowForm(false);
      resetForm();
    } catch (err: any) {
      toast.error(err?.message || "Failed to save");
    } finally {
      setSaving(false);
    }
  };

  const remove = async (part: InstrumentPart) => {
    try {
      await instrumentPartsApi.delete(songId, part.id);
      setParts((prev) => prev.filter((p) => p.id !== part.id));
      toast.success("Instrument part removed");
    } catch (err: any) {
      toast.error(err?.message || "Failed to remove");
    }
  };

  const changeTier = async (part: InstrumentPart, tier: SongTier) => {
    try {
      const res = await instrumentPartsApi.setTier(songId, part.id, tier);
      setParts((prev) => prev.map((p) => (p.id === part.id ? res.part : p)));
      toast.success(`Part is now ${TIER_LABEL[tier].toLowerCase()}`);
    } catch (err: any) {
      toast.error(err?.message || "Failed to change tier");
    }
  };

  const toggle = (id: string) =>
    setEnabled((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });

  const canManage = (part: InstrumentPart) => part.isMine || isAdmin || isOwner;
  const enabledParts = parts.filter((p) => enabled.has(p.id));

  return (
    <div className="space-y-2 print-hidden">
      <button onClick={() => setOpen((v) => !v)} className="section-title w-full text-left" aria-expanded={open}>
        <Guitar className="section-title-icon" /> Instrument Parts
        {parts.length > 0 && (
          <span className="text-xs font-normal text-[hsl(var(--muted-foreground))]">({parts.length})</span>
        )}
        <ChevronDown className={`h-4 w-4 transition-transform ${open ? "rotate-180" : ""}`} />
      </button>

      {open && (
        <div className="space-y-3">
          {/* Legend / toggles */}
          <div className="flex flex-wrap items-center gap-2">
            {parts.map((part) => {
              const on = enabled.has(part.id);
              return (
                <button
                  key={part.id}
                  onClick={() => toggle(part.id)}
                  className="inline-flex items-center gap-1.5 rounded-full border px-3 py-1.5 text-xs font-medium transition-colors"
                  style={{
                    borderColor: part.color || "hsl(var(--border))",
                    backgroundColor: on ? `${part.color || "#6b5bff"}22` : "transparent",
                    color: on ? part.color || "inherit" : "hsl(var(--muted-foreground))",
                  }}
                  title={`${on ? "Hide" : "Show"} ${part.name}`}
                >
                  <span>{part.icon || "🎵"}</span>
                  {part.name}
                  {!part.isMine && part.authorName && (
                    <span className="opacity-70">· {part.authorName}</span>
                  )}
                  {on && <Check className="h-3 w-3" />}
                </button>
              );
            })}
            <button onClick={openNew} className="btn-outline btn-sm border-dashed">
              <Plus className="h-3 w-3" /> Add instrument
            </button>
          </div>

          {/* Manage row for each part the user can edit/promote */}
          {parts.some((p) => canManage(p)) && (
            <div className="list-container">
              {parts.filter((p) => canManage(p)).map((part) => (
                <div key={part.id} className="flex flex-wrap items-center gap-2 px-3 py-2 text-sm">
                  <span className="inline-flex items-center gap-1.5">
                    <span>{part.icon || "🎵"}</span>
                    <span className="font-medium">{part.name}</span>
                  </span>
                  <div className="flex-1" />
                  <select
                    value={part.tier}
                    onChange={(e) => changeTier(part, e.target.value as SongTier)}
                    className="select btn-sm w-auto"
                    aria-label={`Sharing tier for ${part.name}`}
                  >
                    <option value="personal">Private (only me)</option>
                    <option value="organization">Share with org</option>
                    {(isOwner || part.tier === "global") && <option value="global">Core library</option>}
                  </select>
                  <button
                    onClick={() => openEdit(part)}
                    className="btn-icon btn-ghost h-8 w-8"
                    title="Edit part"
                    aria-label={`Edit ${part.name}`}
                  >
                    <Pencil className="h-3.5 w-3.5" />
                  </button>
                  <button
                    onClick={() => remove(part)}
                    className="btn-icon btn-ghost h-8 w-8 hover:text-[hsl(var(--destructive))]"
                    title="Delete part"
                    aria-label={`Delete ${part.name}`}
                  >
                    <X className="h-3.5 w-3.5" />
                  </button>
                </div>
              ))}
            </div>
          )}

          {loaded && parts.length === 0 && (
            <p className="text-xs text-[hsl(var(--muted-foreground))]">
              No instrument parts yet. Add your own notes as a layer over the chart.
            </p>
          )}

          {/* Enabled layers rendered in addition to the base chart */}
          {enabledParts.map((part) => (
            <div
              key={part.id}
              className="rounded-md border-l-4 bg-[hsl(var(--muted))]/30 p-3"
              style={{ borderColor: part.color || "hsl(var(--border))" }}
            >
              <div className="mb-2 flex items-center gap-1.5 text-xs font-semibold" style={{ color: part.color || "inherit" }}>
                <span>{part.icon || "🎵"}</span>
                {part.name}
                {!part.isMine && part.authorName && (
                  <span className="font-normal opacity-70">· {part.authorName}</span>
                )}
              </div>
              {part.content ? (
                <ChordProRenderer
                  content={part.content}
                  songKey={songKey}
                  baseTranspose={baseTranspose}
                  showChords={showChords}
                  nashville={nashville}
                  fontSize={fontSize}
                  showControls={false}
                />
              ) : (
                <p className="text-xs text-[hsl(var(--muted-foreground))]">No chord notes for this part.</p>
              )}
              {part.abcNotation && (
                <div className="mt-2">
                  <StaffNotation abc={part.abcNotation} />
                </div>
              )}
            </div>
          ))}
        </div>
      )}

      {/* Add / edit form */}
      {showForm && (
        <div className="modal-backdrop print-hidden">
          <div className="modal-content max-w-lg max-h-[90vh] overflow-y-auto">
            <div className="mb-4 flex items-center justify-between">
              <h3 className="text-lg font-brand text-[hsl(var(--foreground))]">
                {editing ? "Edit instrument part" : "Add instrument part"}
              </h3>
              <button onClick={() => setShowForm(false)} className="text-[hsl(var(--muted-foreground))] hover:text-[hsl(var(--foreground))]" aria-label="Close">
                <X className="h-5 w-5" />
              </button>
            </div>

            <div className="space-y-4">
              <div className="grid gap-4 sm:grid-cols-2">
                <div className="space-y-1">
                  <label className="block text-sm font-medium">Instrument name *</label>
                  <input
                    value={name}
                    onChange={(e) => setName(e.target.value)}
                    placeholder="e.g. Bass, My keys"
                    className="input"
                  />
                </div>
                <div className="space-y-1">
                  <label className="block text-sm font-medium">Icon</label>
                  <div className="flex flex-wrap gap-1">
                    {ICON_CHOICES.map((ic) => (
                      <button
                        key={ic}
                        onClick={() => setIcon(ic)}
                        className={`h-9 w-9 rounded-md text-lg transition-all ${
                          icon === ic ? "ring-2 ring-[hsl(var(--secondary))]" : "hover:bg-[hsl(var(--muted))]"
                        }`}
                        aria-label={`Icon ${ic}`}
                      >
                        {ic}
                      </button>
                    ))}
                  </div>
                </div>
              </div>

              <div className="space-y-1">
                <label className="block text-sm font-medium">Color</label>
                <div className="flex flex-wrap gap-2">
                  {COLOR_CHOICES.map((c) => (
                    <button
                      key={c}
                      onClick={() => setColor(c)}
                      className={`h-7 w-7 rounded-full transition-all ${
                        color === c ? "ring-2 ring-offset-2 ring-[hsl(var(--secondary))] ring-offset-[hsl(var(--card))]" : "hover:scale-110"
                      }`}
                      style={{ backgroundColor: c }}
                      aria-label={`Color ${c}`}
                    />
                  ))}
                </div>
              </div>

              <div className="space-y-1">
                <label className="block text-sm font-medium">Your notes (ChordPro)</label>
                <textarea
                  value={content}
                  onChange={(e) => setContent(e.target.value)}
                  rows={6}
                  placeholder="[G]Your [C]part's chords over the [D]lyrics"
                  className="input font-mono text-sm"
                />
              </div>

              <div className="space-y-1">
                <label className="block text-sm font-medium">
                  Staff notation (ABC) <span className="text-xs text-[hsl(var(--muted-foreground))]">— optional</span>
                </label>
                <textarea
                  value={abc}
                  onChange={(e) => setAbc(e.target.value)}
                  rows={4}
                  placeholder="X:1&#10;K:G&#10;G2 A2 B2 c2 |"
                  className="input font-mono text-sm"
                />
              </div>

              <div className="flex gap-3">
                <button onClick={save} disabled={saving || !name.trim()} className="btn-primary">
                  {saving ? "Saving…" : editing ? "Update part" : "Add part"}
                </button>
                <button onClick={() => setShowForm(false)} className="btn-outline">
                  Cancel
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
