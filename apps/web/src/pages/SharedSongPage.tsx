import { useState, useEffect, useRef } from "react";
import { useParams, Link } from "react-router-dom";
import { shareApi, type Song } from "@/lib/api-client";
import { ChordProRenderer, AutoScroll, type ChordProRendererHandle } from "@/components/songs/ChordProRenderer";
import { TempoIndicator } from "@/components/songs/TempoIndicator";
import { ThemeToggleButton } from "@/components/ui/ThemeToggleButton";
import { useKeyboardShortcuts } from "@/hooks/useKeyboardShortcuts";
import { Eye, EyeOff, Music, Printer, Hash } from "lucide-react";

/**
 * Public read-only song viewer — accessed via a share token.
 *
 * Features:
 * - Transpose, chord toggle, font-size control, auto-scroll
 * - No edit, delete, upload, export, or library navigation
 * - Renders outside the AppShell — standalone page
 */
export function SharedSongPage() {
  const { token } = useParams<{ token: string }>();
  const [song, setSong] = useState<Song | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [showChords, setShowChords] = useState(true);
  const [nashville, setNashville] = useState(false);
  const [fontSize, setFontSize] = useState(16);
  const scrollRef = useRef<HTMLDivElement>(null);
  const chordProRef = useRef<ChordProRendererHandle>(null);

  // Keyboard shortcuts & foot pedal support
  useKeyboardShortcuts({
    scrollRef,
    onTransposeUp: () => chordProRef.current?.transposeUp(),
    onTransposeDown: () => chordProRef.current?.transposeDown(),
  });

  useEffect(() => {
    if (!token) return;
    setLoading(true);
    shareApi
      .getShared(token)
      .then((res) => setSong(res.song))
      .catch((err) => setError(err.message || "This link is invalid or has expired."))
      .finally(() => setLoading(false));
  }, [token]);

  if (loading) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-[hsl(var(--background))]">
        <div className="h-8 w-8 animate-spin rounded-full border-4 border-[hsl(var(--muted))] border-t-[hsl(var(--secondary))]" />
      </div>
    );
  }

  if (error || !song) {
    return (
      <div className="flex min-h-screen flex-col items-center justify-center bg-[hsl(var(--background))] px-4 text-center">
        <Music className="h-12 w-12 text-[hsl(var(--muted-foreground))] mb-4" />
        <h1 className="text-xl font-semibold text-[hsl(var(--foreground))] mb-2">
          Link Unavailable
        </h1>
        <p className="text-[hsl(var(--muted-foreground))] max-w-md">
          {error || "This shared song link is invalid or has expired."}
        </p>
        <Link
          to="/"
          className="mt-6 text-sm text-[hsl(var(--secondary))] hover:underline"
        >
          Go to VPC Music
        </Link>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-[hsl(var(--background))]">
      {/* Minimal header */}
      <header className="border-b border-[hsl(var(--border))] bg-[hsl(var(--card))]">
        <div className="mx-auto max-w-4xl px-4 py-3 flex items-center gap-3">
          <Music className="h-5 w-5 text-[hsl(var(--secondary))]" />
          <span className="text-sm font-medium text-[hsl(var(--muted-foreground))]">
            Shared Song
          </span>
          <div className="flex-1" />
          <ThemeToggleButton position="inline" />
        </div>
      </header>

      <main className="mx-auto max-w-4xl px-4 py-6 space-y-4">
        {/* Song metadata */}
        <div className="space-y-1 print-meta">
          <h1 className="text-2xl font-brand text-[hsl(var(--foreground))]">
            {song.title}
          </h1>
          <div className="flex flex-wrap gap-3 text-sm text-[hsl(var(--muted-foreground))]">
            {song.artist && <span>{song.artist}</span>}
            {song.category && <span>Category: {song.category}</span>}
            {song.aka && <span>AKA: {song.aka}</span>}
            {song.shout && <span>Shout: {song.shout}</span>}
            {song.key && <span>Key: {song.key}</span>}
            {song.tempo && <TempoIndicator tempo={song.tempo} />}
          </div>
        </div>

        {/* Toolbar — view-only controls */}
        <div className="flex flex-wrap items-center gap-3 print-hidden">
          <AutoScroll containerRef={scrollRef} />
          <button
            onClick={() => setShowChords((v) => !v)}
            className="inline-flex items-center gap-1.5 rounded-md border border-[hsl(var(--border))] px-3 py-1.5 text-xs hover:bg-[hsl(var(--muted))] transition-colors"
            title={showChords ? "Hide chords" : "Show chords"}
          >
            {showChords ? (
              <EyeOff className="h-3.5 w-3.5" />
            ) : (
              <Eye className="h-3.5 w-3.5" />
            )}
            Chords
          </button>
          {showChords && song.key && (
            <button
              onClick={() => setNashville((v) => !v)}
              className={`inline-flex items-center gap-1.5 rounded-md border px-3 py-1.5 text-xs transition-colors ${
                nashville
                  ? "border-[hsl(var(--secondary))] bg-[hsl(var(--secondary))] text-[hsl(var(--secondary-foreground))]"
                  : "border-[hsl(var(--border))] hover:bg-[hsl(var(--muted))]"
              }`}
              title={nashville ? "Show chord names" : "Show Nashville numbers"}
            >
              <Hash className="h-3.5 w-3.5" />
              Nashville
            </button>
          )}
          <select
            value={fontSize}
            onChange={(e) => setFontSize(Number(e.target.value))}
            className="rounded-md border border-[hsl(var(--input))] bg-[hsl(var(--background))] px-2 py-1.5 text-xs"
            title="Font size"
          >
            {[12, 14, 16, 18, 20, 24].map((s) => (
              <option key={s} value={s}>
                {s}px
              </option>
            ))}
          </select>
          <button
            onClick={() => window.print()}
            className="inline-flex items-center gap-1.5 rounded-md border border-[hsl(var(--border))] px-3 py-1.5 text-xs hover:bg-[hsl(var(--muted))] transition-colors"
            title="Print chord chart"
          >
            <Printer className="h-3.5 w-3.5" /> Print
          </button>
        </div>

        {/* ChordPro renderer */}
        <div
          ref={scrollRef}
          className="rounded-lg border border-[hsl(var(--border))] bg-[hsl(var(--card))] p-6 overflow-y-auto print-sheet"
          style={{ maxHeight: "max(320px, calc(100dvh - 280px))" }}
        >
          <ChordProRenderer
            ref={chordProRef}
            content={song.content}
            songKey={song.key}
            showChords={showChords}
            nashville={nashville}
            fontSize={fontSize}
          />
        </div>

        {/* Footer */}
        <p className="text-center text-xs text-[hsl(var(--muted-foreground))] pt-4 print-hidden">
          Powered by{" "}
          <Link to="/" className="text-[hsl(var(--secondary))] hover:underline">
            VPC Music
          </Link>
        </p>
      </main>
    </div>
  );
}
