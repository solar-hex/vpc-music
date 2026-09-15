import { useMemo, useRef, useState, type Dispatch, type SetStateAction } from "react";
import { toast } from "sonner";
import { FileAudio, FileText, Paperclip } from "lucide-react";
import { hasDirective, parseChordPro, readDirective, writeDirective } from "@vpc-music/shared";
import { songsApi, uploadFile } from "@/lib/api-client";
import { songMedia, type AudioPartId, type ChartPartId } from "@/lib/song-media";

interface SongFilesSectionProps {
  /** Null for a song that has not been saved yet: files hang off a saved song. */
  songId: string | null;
  content: string;
  /** The chart as last saved, so a row can tell a new file from a saved one. */
  savedContent: string;
  onContentChange: Dispatch<SetStateAction<string>>;
}

type Kind = "audio" | "chart" | "file";

const PART_SLOTS: { slot: string; label: string; part: AudioPartId }[] = [
  { slot: "soprano", label: "Soprano", part: "soprano" },
  { slot: "alto", label: "Alto", part: "alto" },
  { slot: "tenor", label: "Tenor", part: "tenor" },
  { slot: "full_mix", label: "Full mix", part: "full-mix" },
];

const CHART_SLOTS: { slot: string; label: string; part: ChartPartId }[] = [
  { slot: "chord_chart", label: "Chord chart", part: "chord-chart" },
  { slot: "number_chart", label: "Number chart", part: "number-chart" },
  { slot: "rhythm_chart", label: "Rhythm chart", part: "rhythm-chart" },
  { slot: "vocals", label: "Vocal chart", part: "vocals" },
];

const ACCEPT: Record<Kind, string> = {
  audio: "audio/*,.mp3,.m4a,.wav,.aac,.ogg,.flac,.aif,.aiff",
  chart: "application/pdf,image/png,image/jpeg,image/webp,.pdf,.png,.jpg,.jpeg,.webp",
  file: "audio/*,video/mp4,video/quicktime,application/pdf,image/png,image/jpeg,image/webp,.mp3,.m4a,.wav,.aac,.ogg,.flac,.aif,.aiff,.pdf,.png,.jpg,.jpeg,.webp,.docx,.doc,.txt,.chopro,.mp4,.m4v,.mov,.mid",
};

/** `x_file_notes` taken? Then `x_file_notes_2`, and so on. */
export function freeDirective(content: string, directive: string): string {
  if (!hasDirective(content, directive)) return directive;
  let n = 2;
  while (hasDirective(content, `${directive}_${n}`)) n += 1;
  return `${directive}_${n}`;
}

interface Upload {
  fraction: number;
  controller: AbortController;
}

/**
 * The files a song carries, asked for by name: the voice parts and full mix a
 * choir rehearses with, the chord, number, rhythm and vocal charts, and then
 * anything else. Nobody has to know that an alto part is `{x_audio_alto:}`.
 *
 * A file goes straight to storage, then its link is written into the chart,
 * and the song keeps it when it is saved, exactly like any other change in the
 * editor. Removing a file takes its link out of the chart; the stored file is
 * left alone, so nothing another song or an old link points at disappears.
 */
export function SongFilesSection({ songId, content, savedContent, onContentChange }: SongFilesSectionProps) {
  const media = useMemo(() => songMedia(parseChordPro(content).directives), [content]);
  const [uploads, setUploads] = useState<Record<string, Upload>>({});
  const [errors, setErrors] = useState<Record<string, string>>({});
  const inputs = useRef<Record<string, HTMLInputElement | null>>({});

  if (!songId) {
    return (
      <section className="rounded-md border border-[hsl(var(--border))] p-3 text-sm sm:col-span-2" aria-label="Recordings and charts">
        <h2 className="font-medium text-[hsl(var(--foreground))]">Recordings and charts</h2>
        <p className="mt-1 text-xs text-[hsl(var(--muted-foreground))]">
          Save the song first, then add its voice parts, full mix and charts here.
        </p>
      </section>
    );
  }

  const start = async (rowKey: string, label: string, file: File, options: { slot?: string; directive?: string }) => {
    const controller = new AbortController();
    setErrors(({ [rowKey]: _gone, ...rest }) => rest);
    setUploads((current) => ({ ...current, [rowKey]: { fraction: 0, controller } }));
    try {
      const ticket = await songsApi.requestUpload(songId, { slot: options.slot, filename: file.name, size: file.size });
      await uploadFile(
        ticket,
        file,
        (fraction) => setUploads((current) => (current[rowKey] ? { ...current, [rowKey]: { ...current[rowKey], fraction } } : current)),
        controller.signal,
      );
      onContentChange((current) => {
        const directive = options.directive ?? (options.slot ? ticket.directive : freeDirective(current, ticket.directive));
        return writeDirective(current, directive, ticket.url);
      });
      toast.success(`${label} added. Save the song to keep it.`);
    } catch (err) {
      if (!controller.signal.aborted) {
        setErrors((current) => ({ ...current, [rowKey]: err instanceof Error ? err.message : "The upload failed" }));
      }
    } finally {
      setUploads(({ [rowKey]: _done, ...rest }) => rest);
    }
  };

  const pick = (rowKey: string) => inputs.current[rowKey]?.click();

  const row = (spec: { rowKey: string; label: string; kind: Kind; directive: string | null; slot?: string; replaceable: boolean }) => {
    const { rowKey, label, kind, directive, slot, replaceable } = spec;
    const value = directive ? readDirective(content, directive).trim() : "";
    const saved = Boolean(value) && readDirective(savedContent, directive!).trim() === value;
    const upload = uploads[rowKey];
    const Icon = kind === "audio" ? FileAudio : kind === "chart" ? FileText : Paperclip;
    return (
      <li key={rowKey} className="flex flex-wrap items-center gap-x-3 gap-y-1 py-2">
        <Icon className="h-4 w-4 shrink-0 text-[hsl(var(--muted-foreground))]" aria-hidden="true" />
        <span className="min-w-[7rem] text-sm font-medium text-[hsl(var(--foreground))]">{label}</span>
        <span className="min-w-0 flex-1 text-xs text-[hsl(var(--muted-foreground))]">
          {upload ? (
            <span className="flex items-center gap-2">
              <progress className="h-1.5 w-24" max={1} value={upload.fraction} aria-label={`Uploading ${label}`} />
              {Math.round(upload.fraction * 100)}%
            </span>
          ) : value ? (
            saved ? (
              <a href={songsApi.mediaHref(songId, directive!)} target="_blank" rel="noreferrer" className="underline hover:text-[hsl(var(--foreground))]">
                {kind === "audio" ? "Play" : "Open"}
              </a>
            ) : (
              "Added. Save the song to keep it."
            )
          ) : (
            "None"
          )}
        </span>
        <span className="flex gap-1.5">
          {upload ? (
            <button type="button" className="btn-ghost btn-sm" onClick={() => upload.controller.abort()}>
              Cancel
            </button>
          ) : (
            <>
              {(replaceable || !value) && (
                <button type="button" className="btn-outline btn-sm" onClick={() => pick(rowKey)} aria-label={`${value ? "Replace" : "Add"} ${label}`}>
                  {value ? "Replace" : "Add"}
                </button>
              )}
              {value && (
                <button type="button" className="btn-ghost btn-sm" onClick={() => onContentChange((current) => writeDirective(current, directive!, ""))} aria-label={`Remove ${label}`}>
                  Remove
                </button>
              )}
            </>
          )}
          <input
            ref={(element) => {
              inputs.current[rowKey] = element;
            }}
            type="file"
            accept={ACCEPT[kind]}
            className="sr-only"
            tabIndex={-1}
            aria-hidden="true"
            data-testid={`file-input-${rowKey}`}
            onChange={(event) => {
              const file = event.target.files?.[0];
              event.target.value = "";
              if (file) void start(rowKey, label, file, { slot, directive: directive ?? undefined });
            }}
          />
        </span>
        {errors[rowKey] && <p className="basis-full text-xs text-[hsl(var(--destructive))]" role="alert">{errors[rowKey]}</p>}
      </li>
    );
  };

  const slotAudio = new Set(PART_SLOTS.map((s) => s.part));
  const slotCharts = new Set(CHART_SLOTS.map((s) => s.part));
  const otherAudio = media.audio.filter((track) => track.alternate || !slotAudio.has(track.part));
  const otherCharts = media.charts.filter((doc) => !slotCharts.has(doc.part));

  return (
    <section className="rounded-md border border-[hsl(var(--border))] p-3 sm:col-span-2" aria-label="Recordings and charts">
      <h2 className="text-sm font-medium text-[hsl(var(--foreground))]">Recordings and charts</h2>
      <p className="mt-0.5 text-xs text-[hsl(var(--muted-foreground))]">
        Voice parts and the full mix play under the chart; charts open from its menu.
      </p>

      <ul className="mt-2 divide-y divide-[hsl(var(--border))]" aria-label="Voice parts">
        {PART_SLOTS.map((spec) =>
          row({
            rowKey: spec.slot,
            label: spec.label,
            kind: "audio",
            slot: spec.slot,
            directive: media.audio.find((track) => track.part === spec.part && !track.alternate)?.directive ?? null,
            replaceable: true,
          }),
        )}
      </ul>
      <ul className="mt-1 divide-y divide-[hsl(var(--border))] border-t border-[hsl(var(--border))]" aria-label="Charts">
        {CHART_SLOTS.map((spec) =>
          row({
            rowKey: spec.slot,
            label: spec.label,
            kind: "chart",
            slot: spec.slot,
            directive: media.charts.find((doc) => doc.part === spec.part)?.directive ?? null,
            replaceable: true,
          }),
        )}
      </ul>

      <div className="mt-1 border-t border-[hsl(var(--border))] pt-2">
        <div className="flex items-center justify-between gap-2">
          <h3 className="text-sm font-medium text-[hsl(var(--foreground))]">Other files</h3>
          <button type="button" className="btn-outline btn-sm" onClick={() => pick("new-file")} disabled={Boolean(uploads["new-file"])}>
            {uploads["new-file"] ? `Uploading ${Math.round(uploads["new-file"].fraction * 100)}%` : "Add a file"}
          </button>
          <input
            ref={(element) => {
              inputs.current["new-file"] = element;
            }}
            type="file"
            accept={ACCEPT.file}
            className="sr-only"
            tabIndex={-1}
            aria-hidden="true"
            data-testid="file-input-new-file"
            onChange={(event) => {
              const file = event.target.files?.[0];
              event.target.value = "";
              if (file) void start("new-file", file.name, file, {});
            }}
          />
        </div>
        {errors["new-file"] && <p className="mt-1 text-xs text-[hsl(var(--destructive))]" role="alert">{errors["new-file"]}</p>}
        {otherAudio.length + otherCharts.length + media.files.length === 0 ? (
          <p className="mt-1 text-xs text-[hsl(var(--muted-foreground))]">Loops, other parts, lead sheets, notes: anything else the song needs.</p>
        ) : (
          <ul className="divide-y divide-[hsl(var(--border))]" aria-label="Other files">
            {otherAudio.map((track) => row({ rowKey: track.directive, label: track.label, kind: "audio", directive: track.directive, replaceable: false }))}
            {otherCharts.map((doc) => row({ rowKey: doc.directive, label: doc.label, kind: "chart", directive: doc.directive, replaceable: false }))}
            {media.files.map((doc) => row({ rowKey: doc.directive, label: doc.label, kind: "file", directive: doc.directive, replaceable: false }))}
          </ul>
        )}
      </div>
    </section>
  );
}
