import { useCallback, useEffect, useRef, useState } from "react";
import { Link, useBeforeUnload, useBlocker, useNavigate, useParams } from "react-router-dom";
import { toast } from "sonner";
import { ArrowLeft } from "lucide-react";
import { readDirective } from "@vpc-music/shared";
import { songsApi, type Song } from "@/lib/api-client";
import { useAuth } from "@/contexts/AuthContext";
import { invalidateSongLibrary } from "@/hooks/useSongLibrary";
import { ConfirmDialog } from "@/components/shared/ConfirmDialog";
import { copyAcross, describeCopy, sourceLabel } from "@/lib/duplicates";
import { cn } from "@/lib/utils";

type Side = "left" | "right";
const SIDES: Side[] = ["left", "right"];
const otherSide = (side: Side): Side => (side === "left" ? "right" : "left");

/**
 * Two possible copies of one song, side by side.
 *
 * Pick the one to keep, bring over anything it is missing (edit either chart
 * directly, or copy a selection across), then merge: the kept song saves the
 * chart on its side and the other copy is archived, pointing at it. Or say they
 * are different songs, and the pair stops being offered.
 *
 * Plain text areas on purpose. Copy and paste is the whole job, and a person
 * reading two charts line by line needs nothing a text box does not do.
 */
export function CompareSongsPage() {
  const { leftId = "", rightId = "" } = useParams<{ leftId: string; rightId: string }>();
  const navigate = useNavigate();
  const { user, activeOrg } = useAuth();
  const canEdit = user?.role === "owner" || activeOrg?.role === "admin" || activeOrg?.role === "musician";

  const [songs, setSongs] = useState<Record<Side, Song> | null>(null);
  const [texts, setTexts] = useState<Record<Side, string>>({ left: "", right: "" });
  const [keep, setKeep] = useState<Side>("left");
  const [view, setView] = useState<Side>("left");
  const [loadError, setLoadError] = useState<string | null>(null);
  const [confirm, setConfirm] = useState<"merge" | "distinct" | null>(null);
  const [busy, setBusy] = useState(false);
  const [announcement, setAnnouncement] = useState("");
  const areas = { left: useRef<HTMLTextAreaElement>(null), right: useRef<HTMLTextAreaElement>(null) };
  const leaving = useRef(false);

  const load = useCallback(async () => {
    setLoadError(null);
    setSongs(null);
    try {
      const [left, right] = await Promise.all([songsApi.get(leftId), songsApi.get(rightId)]);
      if (left.song.isArchived || right.song.isArchived) {
        setLoadError("One of these songs has already been merged or archived.");
        return;
      }
      setSongs({ left: left.song, right: right.song });
      setTexts({ left: left.song.content, right: right.song.content });
    } catch (err) {
      setLoadError(err instanceof Error && (err as { status?: number }).status === 404 ? "One of these songs no longer exists." : "Could not open these songs.");
    }
  }, [leftId, rightId]);

  useEffect(() => {
    if (canEdit) void load();
  }, [canEdit, load]);

  const edited = (side: Side) => Boolean(songs) && texts[side] !== songs![side].content;
  const dirty = edited("left") || edited("right");

  useBeforeUnload((event) => {
    if (!dirty || leaving.current) return;
    event.preventDefault();
  });
  const blocker = useBlocker(() => dirty && !leaving.current);

  const pairUrl = `/library/duplicates/${leftId}/${rightId}`;

  const copy = (from: Side) => {
    const source = areas[from].current;
    const target = areas[otherSide(from)].current;
    if (!source || !target) return;
    const result = copyAcross(
      { value: source.value, selectionStart: source.selectionStart, selectionEnd: source.selectionEnd },
      { value: target.value, selectionStart: target.selectionStart, selectionEnd: target.selectionEnd },
    );
    if (!result.copied) {
      toast.info("Select some text, or put the cursor on a line, to copy it across.");
      return;
    }
    setTexts((current) => ({ ...current, [otherSide(from)]: result.value }));
    const message = `Copied ${describeCopy(result.copied)} to “${songs?.[otherSide(from)].title}”`;
    setAnnouncement(message);
    // The other chart is hidden on a phone, so say where the text went.
    if (window.matchMedia?.("(max-width: 767px)").matches) toast.success(message);
    requestAnimationFrame(() => {
      target.setSelectionRange(result.caret, result.caret);
    });
  };

  const merge = async () => {
    if (!songs) return;
    const kept = songs[keep];
    const other = songs[otherSide(keep)];
    setBusy(true);
    try {
      const result = await songsApi.merge(kept.id, {
        otherId: other.id,
        content: texts[keep],
        keptUpdatedAt: kept.updatedAt,
        otherUpdatedAt: other.updatedAt,
      });
      invalidateSongLibrary();
      leaving.current = true;
      toast.success(`Merged into “${result.song.title}”`, {
        description: `“${other.title}” is archived.`,
        action: {
          label: "Undo",
          onClick: () => {
            void (async () => {
              try {
                await songsApi.unmerge(other.id);
                await songsApi.update(kept.id, {
                  content: kept.content,
                  title: kept.title,
                  artist: kept.artist ?? null,
                  key: kept.key ?? null,
                  tempo: kept.tempo ?? null,
                  year: kept.year ?? null,
                  aka: kept.aka ?? null,
                  forceOverwrite: true,
                });
                invalidateSongLibrary();
                toast.success("Merge undone");
                navigate(pairUrl);
              } catch {
                toast.error("Could not undo the merge");
              }
            })();
          },
        },
      });
      navigate("/library/duplicates");
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Could not merge these songs");
    } finally {
      setBusy(false);
      setConfirm(null);
    }
  };

  const markDifferent = async () => {
    if (!songs) return;
    setBusy(true);
    try {
      await songsApi.markDistinct(songs.left.id, songs.right.id);
      leaving.current = true;
      toast.success("Marked as different songs", {
        action: {
          label: "Undo",
          onClick: () => {
            void songsApi
              .markDistinct(leftId, rightId, false)
              .then(() => navigate(pairUrl))
              .catch(() => toast.error("Could not undo that"));
          },
        },
      });
      navigate("/library/duplicates");
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Could not mark these songs");
    } finally {
      setBusy(false);
      setConfirm(null);
    }
  };

  const back = (
    <Link to="/library/duplicates" className="inline-flex items-center gap-1 text-sm text-[hsl(var(--muted-foreground))] hover:text-[hsl(var(--foreground))]">
      <ArrowLeft className="h-4 w-4" /> Possible duplicates
    </Link>
  );

  if (!canEdit) {
    return (
      <div className="space-y-3">
        {back}
        <p className="text-sm">Only people who can edit songs can merge them.</p>
      </div>
    );
  }
  if (loadError) {
    return (
      <div className="space-y-3">
        {back}
        <p className="text-sm">{loadError}</p>
      </div>
    );
  }
  if (!songs) {
    return (
      <div className="flex justify-center py-12" role="status" aria-label="Opening both songs">
        <div className="spinner" />
      </div>
    );
  }

  const kept = songs[keep];
  const other = songs[otherSide(keep)];
  const mergeDescription = [
    `“${kept.title}” keeps the chart on the ${keep}${edited(keep) ? ", with your changes" : ""}.`,
    `“${other.title}” is archived and can be brought back.`,
    edited(otherSide(keep)) ? `Changes you made to “${other.title}” here are not kept.` : "",
  ]
    .filter(Boolean)
    .join(" ");

  return (
    <div className="space-y-3 pb-4">
      <header className="space-y-1">
        {back}
        <h1 className="page-title">Compare copies</h1>
        <p className="text-xs text-[hsl(var(--muted-foreground))]">
          Pick the one to keep, bring over anything it is missing, then merge. Edit either chart here, or select text and
          copy it across; with nothing selected, the line the cursor is on is copied.
        </p>
      </header>

      <div role="tablist" aria-label="Which copy to show" className="grid grid-cols-2 gap-1 rounded-lg border border-[hsl(var(--border))] p-1 md:hidden">
        {SIDES.map((side) => (
          <button
            key={side}
            type="button"
            role="tab"
            aria-selected={view === side}
            onClick={() => setView(side)}
            className={cn("truncate rounded-md px-2 py-1.5 text-sm", view === side ? "bg-[hsl(var(--muted))] font-medium" : "text-[hsl(var(--muted-foreground))]")}
          >
            {side === "left" ? "Left" : "Right"}: {songs[side].title}
          </button>
        ))}
      </div>

      <div className="grid gap-3 md:grid-cols-2">
        {SIDES.map((side) => {
          const song = songs[side];
          const details = [
            song.artist,
            song.key ? `Key of ${song.key}` : null,
            song.tempo ? `${song.tempo} bpm` : null,
            song.isDraft ? "Draft" : "Listed",
            sourceLabel(readDirective(song.content, "x_source").split(":")[0] || "app"),
          ].filter(Boolean);
          return (
            <section
              key={side}
              aria-label={`${side === "left" ? "Left" : "Right"} copy: ${song.title}`}
              className={cn(
                "card flex-col gap-2 p-3",
                view === side ? "flex" : "hidden md:flex",
                keep === side && "ring-2 ring-[hsl(var(--primary))]",
              )}
            >
              <label className="flex items-center gap-2 text-sm font-medium">
                <input type="radio" name="keep" checked={keep === side} onChange={() => setKeep(side)} />
                Keep this one
              </label>
              <div>
                <Link to={`/songs/${song.id}`} target="_blank" rel="noreferrer" className="font-semibold text-[hsl(var(--foreground))] underline-offset-2 hover:underline">
                  {song.title}
                </Link>
                <div className="text-xs text-[hsl(var(--muted-foreground))]">{details.join(" · ")}</div>
              </div>
              <textarea
                ref={areas[side]}
                aria-label={`Chart text for ${song.title}`}
                value={texts[side]}
                onChange={(event) => setTexts((current) => ({ ...current, [side]: event.target.value }))}
                spellCheck={false}
                wrap="off"
                className="min-h-[55vh] w-full resize-y overflow-auto rounded-md border border-[hsl(var(--border))] bg-[hsl(var(--background))] p-2 font-mono text-xs leading-5 text-[hsl(var(--foreground))]"
              />
              <div className="flex flex-wrap items-center justify-between gap-2">
                <button type="button" className="btn-outline btn-sm" onClick={() => copy(side)}>
                  {side === "left" ? "Copy to right →" : "← Copy to left"}
                </button>
                {edited(side) && (
                  <button
                    type="button"
                    className="btn-ghost btn-sm"
                    onClick={() => setTexts((current) => ({ ...current, [side]: song.content }))}
                  >
                    Undo my changes
                  </button>
                )}
              </div>
            </section>
          );
        })}
      </div>

      <p className="sr-only" aria-live="polite">
        {announcement}
      </p>

      <div className="sticky bottom-0 z-10 -mx-3 flex flex-wrap items-center justify-end gap-2 border-t border-[hsl(var(--border))] bg-[hsl(var(--background))] px-3 py-3 sm:-mx-6 sm:px-6">
        <button type="button" className="btn-outline" disabled={busy} onClick={() => (dirty ? setConfirm("distinct") : void markDifferent())}>
          Not duplicates
        </button>
        <button type="button" className="btn-primary" disabled={busy} onClick={() => setConfirm("merge")}>
          Merge, keep “{kept.title}”
        </button>
      </div>

      <ConfirmDialog
        open={confirm === "merge"}
        title="Merge these songs?"
        description={mergeDescription}
        confirmLabel="Merge"
        destructive={false}
        busy={busy}
        onConfirm={merge}
        onClose={() => setConfirm(null)}
      />
      <ConfirmDialog
        open={confirm === "distinct"}
        title="Mark as different songs?"
        description="They stop being offered as duplicates. Changes you made to the charts here are not saved."
        confirmLabel="Mark as different"
        destructive={false}
        busy={busy}
        onConfirm={markDifferent}
        onClose={() => setConfirm(null)}
      />
      <ConfirmDialog
        open={blocker.state === "blocked"}
        title="Leave without merging?"
        description="Changes you made to the charts here are not saved."
        confirmLabel="Leave"
        onConfirm={() => blocker.proceed?.()}
        onClose={() => blocker.reset?.()}
      />
    </div>
  );
}
