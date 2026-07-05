import { useState } from "react";
import { toast } from "sonner";
import { X, Guitar, Timer, Mic2, HandHeart, Music2, AlarmClock, Sparkles, StickyNote, Trash2, Plus } from "lucide-react";
import {
  setlistsApi,
  type SetlistSongItem,
  type SetlistArrangement,
  type TransitionCue,
  type TransitionCueType,
} from "@/lib/api-client";
import { suggestCapoOptions, formatDuration } from "@/utils/capo";

const ARRANGEMENTS: { value: SetlistArrangement; label: string }[] = [
  { value: "ACOUSTIC", label: "Acoustic" },
  { value: "ELECTRIC", label: "Electric" },
  { value: "FULL_BAND", label: "Full Band" },
  { value: "STRIPPED_DOWN", label: "Stripped Down" },
];

const CUE_TYPES: { value: TransitionCueType; label: string; icon: typeof Mic2 }[] = [
  { value: "SPEAKING", label: "Speaking", icon: Mic2 },
  { value: "PRAYER", label: "Prayer", icon: HandHeart },
  { value: "INSTRUMENTAL", label: "Instrumental", icon: Music2 },
  { value: "COUNTDOWN", label: "Countdown", icon: AlarmClock },
  { value: "SPONTANEOUS", label: "Spontaneous", icon: Sparkles },
  { value: "NOTE", label: "Note", icon: StickyNote },
];

export function cueTypeLabel(type: TransitionCueType): string {
  return CUE_TYPES.find((c) => c.value === type)?.label ?? type;
}

/**
 * Per-setlist-song performance tools: capo suggestions, arrangement style,
 * planned duration, and transition cues into the next song.
 */
export function SetlistItemTools({
  setlistId,
  item,
  onClose,
  onSaved,
}: {
  setlistId: string;
  item: SetlistSongItem;
  onClose: () => void;
  onSaved: (item: SetlistSongItem) => void;
}) {
  const effectiveKey = item.key || item.songKey || "";
  const [capo, setCapo] = useState<number | null>(item.capo ?? null);
  const [arrangement, setArrangement] = useState<SetlistArrangement | "">(item.arrangement ?? "");
  const [durationMin, setDurationMin] = useState(item.duration ? String(Math.round(item.duration / 60)) : "");
  const [cues, setCues] = useState<TransitionCue[]>(item.transitionCues ?? []);
  const [saving, setSaving] = useState(false);

  const capoOptions = effectiveKey ? suggestCapoOptions(effectiveKey) : [];

  const addCue = (type: TransitionCueType) => {
    setCues((prev) => [...prev, { type }]);
  };

  const updateCue = (index: number, patch: Partial<TransitionCue>) => {
    setCues((prev) => prev.map((cue, i) => (i === index ? { ...cue, ...patch } : cue)));
  };

  const removeCue = (index: number) => {
    setCues((prev) => prev.filter((_, i) => i !== index));
  };

  const handleSave = async () => {
    setSaving(true);
    try {
      const res = await setlistsApi.updateSong(setlistId, item.id, {
        capo,
        arrangement: arrangement || null,
        duration: /^\d+$/.test(durationMin) ? Number(durationMin) * 60 : null,
        transitionCues: cues,
      });
      toast.success("Song settings saved");
      onSaved(res.item);
      onClose();
    } catch (err: any) {
      toast.error(err.message || "Failed to save");
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="modal-backdrop" role="dialog" aria-modal="true" aria-labelledby="setlist-item-tools-title">
      <div className="modal-content max-w-lg space-y-4 max-h-[90vh] overflow-y-auto">
        <div className="flex items-start justify-between">
          <div>
            <h3 id="setlist-item-tools-title" className="text-lg font-semibold text-[hsl(var(--foreground))]">
              {item.songTitle}
            </h3>
            <p className="text-sm text-[hsl(var(--muted-foreground))]">
              Performance tools{effectiveKey ? ` · Key of ${effectiveKey}` : ""}
            </p>
          </div>
          <button onClick={onClose} disabled={saving} className="btn-icon rounded-md text-[hsl(var(--muted-foreground))]" aria-label="Close">
            <X className="h-5 w-5" />
          </button>
        </div>

        {/* Capo suggestions */}
        <div className="space-y-2">
          <span className="text-sm font-medium flex items-center gap-1.5">
            <Guitar className="h-4 w-4 text-[hsl(var(--secondary))]" /> Capo
          </span>
          <div className="flex flex-wrap gap-1.5">
            <button
              type="button"
              onClick={() => setCapo(null)}
              className={`badge cursor-pointer ${capo === null ? "bg-[hsl(var(--secondary))]/20 text-[hsl(var(--secondary))]" : "badge-muted"}`}
            >
              No capo
            </button>
            {capoOptions.map((option) => (
              <button
                key={option.capo}
                type="button"
                onClick={() => setCapo(option.capo)}
                className={`badge cursor-pointer ${capo === option.capo ? "bg-[hsl(var(--secondary))]/20 text-[hsl(var(--secondary))]" : "badge-muted"}`}
                title={`Play ${option.shapeKey} shapes · ${option.difficulty.toLowerCase()}`}
              >
                Fret {option.capo} · play {option.shapeKey}
              </button>
            ))}
          </div>
          {capoOptions.length === 0 && effectiveKey && (
            <p className="text-xs text-[hsl(var(--muted-foreground))]">No easier open-chord shapes for this key.</p>
          )}
        </div>

        {/* Arrangement + duration */}
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <label className="space-y-2 block">
            <span className="text-sm font-medium">Arrangement</span>
            <select
              value={arrangement}
              onChange={(e) => setArrangement(e.target.value as SetlistArrangement | "")}
              className="input w-full"
              disabled={saving}
            >
              <option value="">—</option>
              {ARRANGEMENTS.map((a) => (
                <option key={a.value} value={a.value}>
                  {a.label}
                </option>
              ))}
            </select>
          </label>
          <label className="space-y-2 block">
            <span className="text-sm font-medium flex items-center gap-1.5">
              <Timer className="h-4 w-4 text-[hsl(var(--secondary))]" /> Planned minutes
            </span>
            <input
              type="number"
              min="1"
              value={durationMin}
              onChange={(e) => setDurationMin(e.target.value)}
              placeholder="e.g. 5"
              className="input w-full"
              disabled={saving}
            />
          </label>
        </div>

        {/* Transition cues */}
        <div className="space-y-2">
          <span className="text-sm font-medium">Transition to next song</span>
          {cues.map((cue, index) => (
            <div key={index} className="flex items-center gap-2">
              <span className="badge badge-muted shrink-0 w-28 justify-center">{cueTypeLabel(cue.type)}</span>
              <input
                type="text"
                value={cue.text ?? ""}
                onChange={(e) => updateCue(index, { text: e.target.value })}
                placeholder="Cue details…"
                className="input flex-1 text-xs py-1"
                disabled={saving}
              />
              <input
                type="number"
                min="1"
                value={cue.durationSec ?? ""}
                onChange={(e) => updateCue(index, { durationSec: e.target.value ? Number(e.target.value) : undefined })}
                placeholder="sec"
                className="input w-16 text-xs py-1"
                disabled={saving}
                aria-label="Cue duration in seconds"
              />
              <button onClick={() => removeCue(index)} className="btn-icon rounded-md text-[hsl(var(--muted-foreground))] hover:text-[hsl(var(--destructive))]" aria-label="Remove cue" disabled={saving}>
                <Trash2 className="h-3.5 w-3.5" />
              </button>
            </div>
          ))}
          <div className="flex flex-wrap gap-1.5">
            {CUE_TYPES.map((cueType) => {
              const Icon = cueType.icon;
              return (
                <button
                  key={cueType.value}
                  type="button"
                  onClick={() => addCue(cueType.value)}
                  className="badge badge-muted cursor-pointer hover:bg-[hsl(var(--muted))]"
                  disabled={saving}
                >
                  <Plus className="h-3 w-3" /> <Icon className="h-3 w-3" /> {cueType.label}
                </button>
              );
            })}
          </div>
        </div>

        {item.duration ? (
          <p className="text-xs text-[hsl(var(--muted-foreground))]">
            Currently planned: {formatDuration(item.duration)}
          </p>
        ) : null}

        <div className="flex justify-end gap-2">
          <button onClick={onClose} disabled={saving} className="btn-outline btn-sm">
            Cancel
          </button>
          <button onClick={handleSave} disabled={saving} className="btn-primary btn-sm">
            {saving ? "Saving..." : "Save"}
          </button>
        </div>
      </div>
    </div>
  );
}
