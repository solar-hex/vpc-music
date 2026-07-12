import { useEffect, useState } from "react";
import { toast } from "sonner";
import { songsApi, setlistsApi, type Setlist } from "@/lib/api-client";
import { formatDuration } from "@/utils/capo";
import { Upload, FileDown, FileSpreadsheet } from "lucide-react";

interface CsvSongRow {
  title: string;
  artist?: string;
  key?: string;
  tempo?: number;
  content?: string;
  tags?: string;
}

/** Minimal CSV parser handling quoted fields and commas within quotes. */
export function parseCsv(text: string): string[][] {
  const rows: string[][] = [];
  let row: string[] = [];
  let field = "";
  let inQuotes = false;

  for (let i = 0; i < text.length; i++) {
    const char = text[i];
    if (inQuotes) {
      if (char === '"') {
        if (text[i + 1] === '"') {
          field += '"';
          i++;
        } else {
          inQuotes = false;
        }
      } else {
        field += char;
      }
    } else if (char === '"') {
      inQuotes = true;
    } else if (char === ",") {
      row.push(field);
      field = "";
    } else if (char === "\n" || char === "\r") {
      if (char === "\r" && text[i + 1] === "\n") i++;
      row.push(field);
      field = "";
      if (row.some((cell) => cell.trim() !== "")) rows.push(row);
      row = [];
    } else {
      field += char;
    }
  }
  row.push(field);
  if (row.some((cell) => cell.trim() !== "")) rows.push(row);
  return rows;
}

export function csvRowsToSongs(rows: string[][]): { songs: CsvSongRow[]; error?: string } {
  if (rows.length < 2) return { songs: [], error: "The file needs a header row and at least one song." };
  const header = rows[0].map((cell) => cell.trim().toLowerCase());
  const titleIdx = header.indexOf("title");
  if (titleIdx === -1) return { songs: [], error: 'The header row must include a "title" column.' };

  const idx = (name: string) => header.indexOf(name);
  const songs = rows
    .slice(1)
    .map((row) => {
      const tempoRaw = idx("tempo") !== -1 ? row[idx("tempo")]?.trim() : "";
      return {
        title: row[titleIdx]?.trim() ?? "",
        artist: idx("artist") !== -1 ? row[idx("artist")]?.trim() : undefined,
        key: idx("key") !== -1 ? row[idx("key")]?.trim() : undefined,
        tempo: /^\d+$/.test(tempoRaw) ? Number(tempoRaw) : undefined,
        content: idx("content") !== -1 ? row[idx("content")]?.trim() : undefined,
        tags: idx("tags") !== -1 ? row[idx("tags")]?.trim() : undefined,
      };
    })
    .filter((song) => song.title);

  return { songs };
}

/** Settings → Import & export: CSV song import + printable set list export. */
export function SettingsDataTab() {
  const [importing, setImporting] = useState(false);
  const [importSummary, setImportSummary] = useState<string | null>(null);
  const [setlists, setSetlists] = useState<Setlist[]>([]);
  const [exportSetlistId, setExportSetlistId] = useState("");

  useEffect(() => {
    setlistsApi
      .list({ view: "active" })
      .then((res) => setSetlists(res.setlists))
      .catch(() => {});
  }, []);

  const handleCsvFile = async (file: File) => {
    setImporting(true);
    setImportSummary(null);
    try {
      const text = await file.text();
      const { songs, error } = csvRowsToSongs(parseCsv(text));
      if (error) {
        toast.error(error);
        return;
      }
      let created = 0;
      const failures: string[] = [];
      for (const song of songs) {
        try {
          await songsApi.create({
            title: song.title,
            artist: song.artist || undefined,
            key: song.key || undefined,
            tempo: song.tempo,
            tags: song.tags || undefined,
            content: song.content || `{title: ${song.title}}\n`,
          });
          created++;
        } catch {
          failures.push(song.title);
        }
      }
      setImportSummary(
        `Imported ${created} of ${songs.length} songs.${failures.length ? ` Failed: ${failures.slice(0, 5).join(", ")}${failures.length > 5 ? "…" : ""}` : ""}`,
      );
      toast.success(`Imported ${created} song${created !== 1 ? "s" : ""}`);
    } catch (err: any) {
      toast.error(err.message || "Import failed");
    } finally {
      setImporting(false);
    }
  };

  const handleExportPdf = async () => {
    if (!exportSetlistId) return;
    try {
      const res = await setlistsApi.get(exportSetlistId);
      const { setlist, songs } = res;
      const rows = songs
        .map(
          (item, index) => `
            <tr>
              <td>${index + 1}</td>
              <td>${item.songTitle ?? item.slotLabel ?? "—"}</td>
              <td>${item.key || item.songKey || ""}</td>
              <td>${item.duration ? formatDuration(item.duration) : ""}</td>
              <td>${item.notes || ""}</td>
            </tr>`,
        )
        .join("");
      const win = window.open("", "_blank");
      if (!win) {
        toast.error("Allow pop-ups to export the set list");
        return;
      }
      win.document.write(`<!doctype html><html><head><title>${setlist.name}</title>
        <style>
          body { font-family: Georgia, serif; margin: 40px; color: #14243d; }
          h1 { border-bottom: 2px solid #EF9F27; padding-bottom: 8px; }
          table { width: 100%; border-collapse: collapse; margin-top: 16px; font-family: Arial, sans-serif; font-size: 13px; }
          th, td { text-align: left; padding: 6px 10px; border-bottom: 1px solid #c9d4e4; }
          th { text-transform: uppercase; font-size: 11px; color: #7a8ba5; }
          .notes { margin-top: 16px; font-size: 13px; }
        </style></head><body>
        <h1>${setlist.name}</h1>
        <table><thead><tr><th>#</th><th>Song</th><th>Key</th><th>Duration</th><th>Notes</th></tr></thead>
        <tbody>${rows}</tbody></table>
        ${setlist.notes ? `<p class="notes"><strong>Notes:</strong> ${setlist.notes}</p>` : ""}
      </body></html>`);
      win.document.close();
      win.focus();
      win.print();
    } catch (err: any) {
      toast.error(err.message || "Export failed");
    }
  };

  return (
    <div className="space-y-8 max-w-2xl">
      {/* CSV import */}
      <section className="space-y-3 rounded-lg border border-[hsl(var(--border))] bg-[hsl(var(--card))] p-6">
        <h3 className="flex items-center gap-2 text-lg font-brand text-[hsl(var(--foreground))]">
          <FileSpreadsheet className="h-5 w-5 text-[hsl(var(--secondary))]" />
          Import songs from CSV
        </h3>
        <p className="text-sm text-[hsl(var(--muted-foreground))]">
          Header row required. Recognized columns: <code>title</code> (required), <code>artist</code>, <code>key</code>,{" "}
          <code>tempo</code>, <code>tags</code>, <code>content</code> (ChordPro).
        </p>
        <label className="btn-primary btn-sm w-fit cursor-pointer">
          <Upload className="h-4 w-4" /> {importing ? "Importing…" : "Choose CSV file"}
          <input
            type="file"
            accept=".csv,text/csv"
            className="hidden"
            disabled={importing}
            onChange={(e) => {
              const file = e.target.files?.[0];
              if (file) void handleCsvFile(file);
              e.target.value = "";
            }}
          />
        </label>
        {importSummary && <p className="text-sm text-[hsl(var(--muted-foreground))]">{importSummary}</p>}
      </section>

      {/* Set list export */}
      <section className="space-y-3 rounded-lg border border-[hsl(var(--border))] bg-[hsl(var(--card))] p-6">
        <h3 className="flex items-center gap-2 text-lg font-brand text-[hsl(var(--foreground))]">
          <FileDown className="h-5 w-5 text-[hsl(var(--secondary))]" />
          Export a set list as PDF
        </h3>
        <p className="text-sm text-[hsl(var(--muted-foreground))]">
          Opens a print-ready sheet — title, songs in order, keys, durations, and notes. Use your browser's
          "Save as PDF" destination.
        </p>
        <div className="flex flex-wrap items-center gap-2">
          <select
            value={exportSetlistId}
            onChange={(e) => setExportSetlistId(e.target.value)}
            className="input w-auto min-w-[220px]"
            aria-label="Set list to export"
          >
            <option value="">Choose a set list…</option>
            {setlists.map((setlist) => (
              <option key={setlist.id} value={setlist.id}>
                {setlist.name}
              </option>
            ))}
          </select>
          <button onClick={handleExportPdf} disabled={!exportSetlistId} className="btn-outline btn-sm">
            <FileDown className="h-4 w-4" /> Export
          </button>
        </div>
      </section>
    </div>
  );
}
