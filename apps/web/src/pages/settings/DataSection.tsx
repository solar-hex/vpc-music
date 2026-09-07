import { useState } from "react";
import { toast } from "sonner";
import { Database, Download, Upload } from "lucide-react";
import { useAuth } from "@/contexts/AuthContext";
import { useSongLibrary } from "@/hooks/useSongLibrary";
import { ImportSongsDialog } from "@/components/songs/ImportSongsDialog";
import { songsApi } from "@/lib/api-client";
import { SettingsSection } from "./SettingsSection";

type ExportFormat = "chordpro" | "onsong" | "text";

const FORMATS: { value: ExportFormat; label: string }[] = [
  { value: "chordpro", label: "ChordPro" },
  { value: "onsong", label: "OnSong" },
  { value: "text", label: "Plain text" },
];

/** Import chart files, or download the whole library as a ZIP. */
export function DataSection() {
  const { user, activeOrg } = useAuth();
  const { songs } = useSongLibrary();
  const canEdit = user?.role === "owner" || activeOrg?.role === "admin" || activeOrg?.role === "musician";
  const [importOpen, setImportOpen] = useState(false);
  const [format, setFormat] = useState<ExportFormat>("chordpro");
  const [downloading, setDownloading] = useState(false);

  const handleDownload = async () => {
    if (songs.length === 0) {
      toast.error("There are no songs to download yet");
      return;
    }
    setDownloading(true);
    try {
      const res = await songsApi.exportZip(
        songs.map((song) => song.id),
        format,
      );
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const blob = await res.blob();
      const url = URL.createObjectURL(blob);
      const anchor = document.createElement("a");
      anchor.href = url;
      anchor.download = `${(activeOrg?.name || "songs").replace(/[^\w.-]+/g, "_")}-${format}.zip`;
      anchor.click();
      URL.revokeObjectURL(url);
    } catch {
      toast.error("Download failed");
    } finally {
      setDownloading(false);
    }
  };

  return (
    <SettingsSection id="data" title="Data" icon={Database}>
      {canEdit && (
        <div className="space-y-2">
          <p className="text-sm text-[hsl(var(--foreground))]">
            Bring charts in from files: ChordPro, OnSong, OpenSong, the old <code className="font-mono">.chrd</code> sheets, PDF or plain text.
          </p>
          <button type="button" onClick={() => setImportOpen(true)} className="btn-primary btn-sm">
            <Upload className="h-4 w-4" /> Import songs
          </button>
        </div>
      )}
      <div className="space-y-2 border-t border-[hsl(var(--border))] pt-4 first:border-t-0 first:pt-0">
        <p className="text-sm text-[hsl(var(--foreground))]">Download the whole library ({songs.length} songs) as a ZIP.</p>
        <div className="flex flex-wrap items-center gap-2">
          <select value={format} onChange={(event) => setFormat(event.target.value as ExportFormat)} className="select w-auto" aria-label="Download format">
            {FORMATS.map((option) => (
              <option key={option.value} value={option.value}>
                {option.label}
              </option>
            ))}
          </select>
          <button type="button" onClick={() => void handleDownload()} disabled={downloading} className="btn-outline btn-sm">
            <Download className="h-4 w-4" /> {downloading ? "Preparing..." : "Download library"}
          </button>
        </div>
      </div>
      <ImportSongsDialog open={importOpen} onClose={() => setImportOpen(false)} />
    </SettingsSection>
  );
}
