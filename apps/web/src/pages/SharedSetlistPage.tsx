import { useEffect, useState } from "react";
import { useParams } from "react-router-dom";
import { setlistsApi } from "@/lib/api-client";
import { ChordProRenderer } from "@/components/songs/ChordProRenderer";
import { composeTranspose } from "@vpc-music/shared";
import { ThemedLogo } from "@/components/ui/ThemedLogo";
import { Printer, ListMusic } from "lucide-react";

type SharedSetlist = Awaited<ReturnType<typeof setlistsApi.getShared>>;

/**
 * Public read-only setlist view (/shared/setlist/:token). No login — the
 * token is the credential. A guest musician gets the running order plus
 * every chart, ready to scroll through or print.
 */
export function SharedSetlistPage() {
  const { token } = useParams<{ token: string }>();
  const [data, setData] = useState<SharedSetlist | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!token) return;
    setlistsApi
      .getShared(token)
      .then(setData)
      .catch((err: any) => setError(err?.message || "This link is invalid or has expired."));
  }, [token]);

  if (error) {
    return (
      <div className="min-h-screen flex flex-col items-center justify-center gap-3 bg-[hsl(var(--background))] text-[hsl(var(--foreground))] p-6">
        <ListMusic className="h-10 w-10 text-[hsl(var(--muted-foreground))]" />
        <p className="text-sm text-[hsl(var(--muted-foreground))]">{error}</p>
      </div>
    );
  }

  if (!data) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-[hsl(var(--background))]">
        <div className="spinner" />
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-[hsl(var(--background))] text-[hsl(var(--foreground))]">
      <div className="mx-auto max-w-3xl space-y-6 p-4 sm:p-6">
        {/* Header */}
        <div className="flex flex-wrap items-center gap-3 print-hidden">
          <ThemedLogo className="h-8 w-8 rounded-md" alt="VPC Music" />
          <div className="min-w-0 flex-1">
            <h1 className="truncate text-xl font-brand">{data.setlist.name}</h1>
            <p className="text-xs text-[hsl(var(--muted-foreground))]">
              {data.songs.length} song{data.songs.length === 1 ? "" : "s"} · shared read-only
            </p>
          </div>
          <button onClick={() => window.print()} className="btn-outline btn-sm" title="Print set list">
            <Printer className="h-3.5 w-3.5" /> Print
          </button>
        </div>

        {/* Running order */}
        <div className="list-container print-meta">
          {data.songs.map((item, idx) => (
            <a key={item.id} href={`#song-${idx}`} className="list-item text-sm hover:bg-[hsl(var(--muted))]">
              <span className="w-6 text-center text-xs text-[hsl(var(--muted-foreground))] tabular-nums">{idx + 1}</span>
              <span className="min-w-0 flex-1 truncate font-medium">{item.title}</span>
              <span className="shrink-0 text-xs text-[hsl(var(--muted-foreground))]">
                {[item.keyOverride || item.songKey, item.tempo && `${item.tempo} BPM`, item.capo ? `Capo ${item.capo}` : null]
                  .filter(Boolean)
                  .join(" · ")}
              </span>
            </a>
          ))}
        </div>

        {/* Charts */}
        {data.songs.map((item, idx) => {
          const baseTranspose = composeTranspose({
            sourceKey: item.songKey ?? null,
            overrideKey: item.keyOverride ?? item.songKey ?? null,
          }).semis;
          return (
            <section key={item.id} id={`song-${idx}`} className="card card-body-lg print-sheet space-y-2">
              <div className="flex flex-wrap items-baseline gap-2">
                <h2 className="text-lg font-brand">
                  {idx + 1}. {item.title}
                </h2>
                <span className="text-xs text-[hsl(var(--muted-foreground))]">
                  {[item.artist, item.keyOverride || item.songKey ? `Key ${item.keyOverride || item.songKey}` : null]
                    .filter(Boolean)
                    .join(" · ")}
                </span>
              </div>
              {item.notes && <p className="text-xs italic text-[hsl(var(--muted-foreground))]">{item.notes}</p>}
              <ChordProRenderer
                content={item.content}
                songKey={item.songKey}
                baseTranspose={baseTranspose}
                showControls={false}
              />
            </section>
          );
        })}
      </div>
    </div>
  );
}
