import { useCallback, useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { ArrowLeftRight, CopyCheck } from "lucide-react";
import { songsApi, type DuplicatePair } from "@/lib/api-client";
import { useAuth } from "@/contexts/AuthContext";
import { EmptyState } from "@/components/shared/EmptyState";
import { overlapLabel, sourceLabel } from "@/lib/duplicates";

/**
 * Songs that may be copies of one another, judged by their words with the
 * chords stripped, so "Press On" and the Word sheet named "We press on" are
 * found even though the titles differ. Each pair opens side by side, where a
 * person merges them or marks them as different songs.
 */
export function DuplicatesPage() {
  const { user, activeOrg } = useAuth();
  const canEdit = user?.role === "owner" || activeOrg?.role === "admin" || activeOrg?.role === "musician";
  const [pairs, setPairs] = useState<DuplicatePair[] | null>(null);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    setError(null);
    try {
      const { pairs: found } = await songsApi.duplicates();
      setPairs(found);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not look for duplicates");
    }
  }, []);

  useEffect(() => {
    if (canEdit) void load();
  }, [canEdit, load]);

  return (
    <div className="space-y-4">
      <header className="space-y-1">
        <div className="flex items-baseline justify-between gap-3">
          <h1 className="page-title">Possible duplicates</h1>
          <Link to="/library" className="text-sm text-[hsl(var(--muted-foreground))] underline hover:text-[hsl(var(--foreground))]">
            Every song
          </Link>
        </div>
        <p className="text-xs text-[hsl(var(--muted-foreground))]">
          Songs whose words mostly match, with the chords ignored. Open a pair to merge the two into one song, or to mark
          them as different songs, like a new recording by the same artist.
        </p>
      </header>

      {!canEdit ? (
        <EmptyState icon={CopyCheck} message="Only people who can edit songs can review duplicates." />
      ) : error ? (
        <div className="card space-y-3 p-4 text-sm">
          <p>{error}</p>
          <button type="button" className="btn-outline btn-sm" onClick={() => void load()}>
            Try again
          </button>
        </div>
      ) : pairs === null ? (
        <div className="flex justify-center py-12" role="status" aria-label="Looking for duplicates">
          <div className="spinner" />
        </div>
      ) : pairs.length === 0 ? (
        <EmptyState icon={CopyCheck} message="No possible duplicates. Every song's words are its own." />
      ) : (
        <>
          <p className="text-sm text-[hsl(var(--muted-foreground))]">
            {pairs.length === 1 ? "1 pair to look at" : `${pairs.length} pairs to look at`}, most alike first.
          </p>
          <ul className="divide-y divide-[hsl(var(--border))] rounded-lg border border-[hsl(var(--border))] bg-[hsl(var(--card))]">
            {pairs.map((pair) => {
              const differentArtists = Boolean(pair.left.artist && pair.right.artist && pair.left.artist.toLowerCase() !== pair.right.artist.toLowerCase());
              return (
                <li key={`${pair.left.id}-${pair.right.id}`}>
                  <Link
                    to={`/library/duplicates/${pair.left.id}/${pair.right.id}`}
                    className="block px-3 py-3 hover:bg-[hsl(var(--muted))] focus-visible:bg-[hsl(var(--muted))]"
                  >
                    <div className="flex flex-wrap items-center gap-x-2 gap-y-1 font-medium text-[hsl(var(--foreground))]">
                      <span>{pair.left.title}</span>
                      <ArrowLeftRight className="h-3.5 w-3.5 shrink-0 text-[hsl(var(--muted-foreground))]" aria-label="and" />
                      <span>{pair.right.title}</span>
                    </div>
                    <div className="mt-1 flex flex-wrap gap-1.5 text-xs">
                      <span className="badge-muted">{overlapLabel(pair.overlap)}</span>
                      {!pair.titlesAgree && <span className="badge-muted">Titles differ</span>}
                      {differentArtists && <span className="badge-muted">Different artists</span>}
                      <span className="text-[hsl(var(--muted-foreground))]">
                        {sourceLabel(pair.left.source)} · {sourceLabel(pair.right.source)}
                      </span>
                    </div>
                  </Link>
                </li>
              );
            })}
          </ul>
        </>
      )}
    </div>
  );
}
