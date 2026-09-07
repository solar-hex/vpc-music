import { useState, type FormEvent } from "react";
import { ResponsiveModal } from "@/components/ui/ResponsiveModal";

interface LogPlayDialogProps {
  open: boolean;
  onClose: () => void;
  onSubmit: (data: { usedAt: string; notes?: string }) => Promise<void>;
}

function todayIso() {
  const now = new Date();
  const offset = now.getTimezoneOffset() * 60000;
  return new Date(now.getTime() - offset).toISOString().slice(0, 10);
}

/** "We played this song on <date>": the one manual entry point for play tracking. */
export function LogPlayDialog({ open, onClose, onSubmit }: LogPlayDialogProps) {
  const [usedAt, setUsedAt] = useState(todayIso);
  const [notes, setNotes] = useState("");
  const [busy, setBusy] = useState(false);

  const handleSubmit = async (event: FormEvent) => {
    event.preventDefault();
    if (!usedAt) return;
    setBusy(true);
    try {
      await onSubmit({ usedAt, notes: notes.trim() || undefined });
      setNotes("");
      onClose();
    } finally {
      setBusy(false);
    }
  };

  return (
    <ResponsiveModal open={open} onClose={onClose} title="Log a play" description="Record that this song was played.">
      <form onSubmit={handleSubmit} className="space-y-3">
        <label className="block text-sm">
          <span className="mb-1 block text-[hsl(var(--muted-foreground))]">Date</span>
          <input type="date" value={usedAt} onChange={(event) => setUsedAt(event.target.value)} className="input w-full" required />
        </label>
        <label className="block text-sm">
          <span className="mb-1 block text-[hsl(var(--muted-foreground))]">Notes (optional)</span>
          <input
            type="text"
            value={notes}
            onChange={(event) => setNotes(event.target.value)}
            className="input w-full"
            placeholder="Sunday morning, second service"
          />
        </label>
        <div className="flex justify-end gap-3">
          <button type="button" onClick={onClose} className="btn-outline" disabled={busy}>
            Cancel
          </button>
          <button type="submit" className="btn-primary" disabled={busy || !usedAt}>
            {busy ? "Saving..." : "Log play"}
          </button>
        </div>
      </form>
    </ResponsiveModal>
  );
}
