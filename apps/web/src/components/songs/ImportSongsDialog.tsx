import { useRef, useState, type ChangeEvent } from "react";
import { Link, useNavigate } from "react-router-dom";
import { toast } from "sonner";
import { Upload } from "lucide-react";
import { ResponsiveModal } from "@/components/ui/ResponsiveModal";
import { invalidateSongLibrary } from "@/hooks/useSongLibrary";
import { bulkImport, IMPORT_ACCEPT, IMPORT_FORMATS_LABEL, previewImportFile, type BulkImportItem } from "@/lib/song-import";

interface ImportSongsDialogProps {
  open: boolean;
  onClose: () => void;
}

/**
 * Import chart files. One file opens in the editor for review before it is
 * saved; several files import straight into the library with a progress list.
 */
export function ImportSongsDialog({ open, onClose }: ImportSongsDialogProps) {
  const navigate = useNavigate();
  const inputRef = useRef<HTMLInputElement>(null);
  const [busy, setBusy] = useState(false);
  const [items, setItems] = useState<BulkImportItem[]>([]);
  const [completed, setCompleted] = useState(0);
  const [currentFile, setCurrentFile] = useState("");

  const handleFiles = async (event: ChangeEvent<HTMLInputElement>) => {
    const files = Array.from(event.target.files || []);
    event.target.value = "";
    if (files.length === 0) return;
    setBusy(true);
    try {
      if (files.length === 1) {
        const preview = await previewImportFile(files[0]);
        onClose();
        navigate("/songs/new", { state: { importPreview: preview } });
        return;
      }
      setItems(files.map((file) => ({ filename: file.name, status: "pending" })));
      setCompleted(0);
      const result = await bulkImport(files, (nextItems, nextCompleted, nextCurrent) => {
        setItems(nextItems);
        setCompleted(nextCompleted);
        setCurrentFile(nextCurrent);
      });
      invalidateSongLibrary();
      if (result.successCount > 0) toast.success(`Imported ${result.successCount} of ${files.length} files`);
      else toast.error("None of the files could be imported");
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Import failed");
    } finally {
      setBusy(false);
      setCurrentFile("");
    }
  };

  const handleClose = () => {
    if (busy) return;
    setItems([]);
    setCompleted(0);
    onClose();
  };

  return (
    <ResponsiveModal
      open={open}
      onClose={handleClose}
      title="Import songs"
      description={`One file opens in the editor to review before saving. Several files import straight into the library. Formats: ${IMPORT_FORMATS_LABEL}.`}
    >
      <div className="space-y-4">
        <input
          ref={inputRef}
          type="file"
          accept={IMPORT_ACCEPT}
          multiple
          onChange={handleFiles}
          disabled={busy}
          className="sr-only"
          aria-label="Choose files to import"
          data-testid="import-file-input"
        />
        <button type="button" onClick={() => inputRef.current?.click()} disabled={busy} className="btn-primary w-full gap-2">
          <Upload className="h-4 w-4" />
          {busy ? "Importing…" : "Choose files"}
        </button>

        {items.length > 0 && (
          <div className="space-y-2" data-testid="bulk-import-status">
            <div className="flex items-center justify-between text-xs text-[hsl(var(--muted-foreground))]">
              <span>
                {completed} of {items.length} done{currentFile ? ` · importing ${currentFile}` : ""}
              </span>
              <span>{items.filter((item) => item.status === "success").length} imported</span>
            </div>
            <div className="h-1.5 overflow-hidden rounded-full bg-[hsl(var(--muted))]">
              <div className="h-full bg-[hsl(var(--secondary))] transition-all" style={{ width: `${Math.round((completed / items.length) * 100)}%` }} />
            </div>
            <ul className="max-h-60 space-y-1 overflow-y-auto text-sm">
              {items.map((item) => (
                <li key={item.filename} className="flex items-center justify-between gap-3">
                  <span className="truncate">{item.filename}</span>
                  {item.status === "success" && item.songId ? (
                    <Link to={`/songs/${item.songId}`} className="shrink-0 text-[hsl(var(--secondary))] hover:underline" onClick={handleClose}>
                      Open
                    </Link>
                  ) : (
                    <span className={`shrink-0 text-xs ${item.status === "error" ? "text-[hsl(var(--destructive))]" : "text-[hsl(var(--muted-foreground))]"}`}>
                      {item.status === "error" ? item.message : item.status === "processing" ? "Importing…" : item.status === "pending" ? "Waiting" : item.message}
                    </span>
                  )}
                </li>
              ))}
            </ul>
          </div>
        )}
      </div>
    </ResponsiveModal>
  );
}
