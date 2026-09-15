import { useEffect, useState } from "react";
import { useParams } from "react-router-dom";
import { Music } from "lucide-react";
import { shareApi, type SharedSong } from "@/lib/api-client";
import { ChartView } from "@/components/songs/ChartView";
import { songStatusLabel } from "@vpc-music/shared";

/**
 * One chart, opened from a share link, by someone who may not be on the team.
 *
 * It is the same lead sheet a member reads — key picker, transpose, Nashville,
 * comments, text size, keep-awake, the song's practice audio and PDFs, print —
 * with nothing around it: no search, no downloads, no editing, and no way to
 * reach any other song. The server sends only this chart, without the team's
 * Dropbox folder, and plays its media through the link, so turning the link
 * off stops all of it.
 */
export function SharedSongPage() {
  const { token = "" } = useParams<{ token: string }>();
  const [song, setSong] = useState<SharedSong | null>(null);
  const [problem, setProblem] = useState<"gone" | "missing" | null>(null);
  const [loading, setLoading] = useState(true);

  // A share link is a private address; keep it out of search engines.
  useEffect(() => {
    const meta = document.createElement("meta");
    meta.name = "robots";
    meta.content = "noindex, nofollow";
    document.head.appendChild(meta);
    return () => meta.remove();
  }, []);

  useEffect(() => {
    let current = true;
    setLoading(true);
    setProblem(null);
    shareApi
      .getShared(token)
      .then((res) => current && setSong(res.song))
      .catch((error: { status?: number }) => current && setProblem(error?.status === 410 ? "gone" : "missing"))
      .finally(() => current && setLoading(false));
    return () => {
      current = false;
    };
  }, [token]);

  if (loading) {
    return (
      <div className="fixed inset-0 z-40 flex items-center justify-center bg-[hsl(var(--background))]" role="status" aria-label="Loading chart">
        <div className="spinner" />
      </div>
    );
  }

  if (!song) {
    return (
      <div className="fixed inset-0 z-40 flex flex-col items-center justify-center gap-3 bg-[hsl(var(--background))] px-6 text-center text-[hsl(var(--foreground))]">
        <Music className="h-10 w-10 text-[hsl(var(--muted-foreground))]" aria-hidden="true" />
        <h1 className="text-xl font-semibold">This link isn't working</h1>
        <p className="max-w-sm text-sm text-[hsl(var(--muted-foreground))]">
          {problem === "gone"
            ? "Sharing for this chart has been turned off. Ask the person who sent it for a new link."
            : "The link may be incomplete. Check you copied all of it, or ask for a new one."}
        </p>
      </div>
    );
  }

  const statusLabel = songStatusLabel(song.status);

  return (
    <ChartView
      chartId={token}
      title={song.title}
      artist={song.artist}
      year={song.year}
      tempo={song.tempo}
      badges={
        <>
          {statusLabel && <span className="badge-muted">{statusLabel}</span>}
          <span className="badge-muted print-hidden">Shared · view only</span>
        </>
      }
      content={song.content}
      originalKey={song.key}
      mediaHref={(directive) => shareApi.mediaHref(token, directive)}
    />
  );
}
