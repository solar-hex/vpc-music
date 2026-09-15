import { useMemo, useRef, useState, type ReactNode } from "react";
import { useSearchParams } from "react-router-dom";
import { FileText, FolderOpen, Printer } from "lucide-react";
import { useTheme } from "@/contexts/ThemeContext";
import { pageWidthClass } from "@/lib/page-width";
import { useKeyboardShortcuts } from "@/hooks/useKeyboardShortcuts";
import { useWakeLock } from "@/hooks/useWakeLock";
import { nextFontSize, useChartPrefs } from "@/lib/chart-prefs";
import { ChordProRenderer, chartSections } from "@/components/songs/ChordProRenderer";
import { ChartToolbar } from "@/components/songs/ChartToolbar";
import { SectionJumpBar, jumpToSection } from "@/components/songs/SectionJumpBar";
import { KeyPickerSheet } from "@/components/songs/KeyPickerSheet";
import { ChordDiagramSheet } from "@/components/songs/ChordDiagramSheet";
import { SongAudioBar } from "@/components/songs/SongAudioBar";
import { TempoIndicator } from "@/components/songs/TempoIndicator";
import { songMedia } from "@/lib/song-media";
import type { ActionMenuEntry } from "@/components/ui/ActionMenu";
import { ALL_KEYS, composeTranspose, normalizeEnharmonicKey, parseChordPro, parseKeyRoot, spellForTarget } from "@vpc-music/shared";

/** "Bb", "C#m" -> the canonical spelling, or null when it is not a key we can transpose to. */
function validKey(value: string | null): string | null {
  if (!value) return null;
  const parsed = parseKeyRoot(value);
  if (!parsed) return null;
  const root = normalizeEnharmonicKey(parsed.root);
  if (!ALL_KEYS.includes(root)) return null;
  return parsed.isMinor ? `${root}m` : root;
}

export interface ChartViewProps {
  /** Remounts per chart, so nothing plays and nothing is marked broken from the last one. */
  chartId: string;
  title: string;
  artist?: string | null;
  year?: string | null;
  tempo?: number | null;
  /** Beside the credits: Draft, Lyrics only, View only. */
  badges?: ReactNode;
  content: string;
  originalKey: string | null;
  /** A member's chart links back to the song list; a share link has no list behind it. */
  showSearch?: boolean;
  /** Where one of this chart's media directives plays or opens from. */
  mediaHref: (directive: string) => string;
  /** The team's Dropbox folder. Never on a share link: it opens far more than one song. */
  showDropbox?: boolean;
  /** More-menu entries after Print (downloads). */
  menuBefore?: ActionMenuEntry[];
  /** More-menu entries after the song's resources (share, edit, delete). */
  menuAfter?: ActionMenuEntry[];
  /** One of the host's dialogs is open, so page turns and transpose keys pause. */
  hostModalOpen?: boolean;
  /** Under the toolbar. */
  banner?: ReactNode;
  /** The host's own dialogs. */
  children?: ReactNode;
}

/**
 * The lead sheet: a chart that fills the screen, the old site's toolbar on top
 * and its section jump bar underneath. Everything a musician does while
 * reading lives here — key picker, transpose, Nashville, comments, text size,
 * keep-awake, practice audio, print — so a member's chart and a share link are
 * the same chart. Only what surrounds it differs: a member can search, download
 * and edit; a share link can do none of those.
 *
 * Transposition lives in the URL (`?key=Bb`, or `?t=2` for keyless charts) so a
 * link or a reload lands on the same key.
 */
export function ChartView({
  chartId,
  title,
  artist,
  year,
  tempo,
  badges,
  content,
  originalKey,
  showSearch = false,
  mediaHref,
  showDropbox = false,
  menuBefore = [],
  menuAfter = [],
  hostModalOpen = false,
  banner,
  children,
}: ChartViewProps) {
  const [searchParams, setSearchParams] = useSearchParams();
  const { resolvedTheme, toggleTheme, keyNotation, pageWidth } = useTheme();
  const [prefs, updatePrefs] = useChartPrefs();
  const { supported: keepAwakeSupported } = useWakeLock(prefs.keepAwake);
  const [keyPickerOpen, setKeyPickerOpen] = useState(false);
  const [tappedChord, setTappedChord] = useState<string | null>(null);
  const scrollRef = useRef<HTMLDivElement>(null);

  // Transposition: the URL is the single source of truth.
  const overrideKey = originalKey ? validKey(searchParams.get("key")) : null;
  const nudge = originalKey ? 0 : Number.parseInt(searchParams.get("t") || "0", 10) || 0;
  const { semis, displayKey } = composeTranspose({ sourceKey: originalKey, overrideKey, nudge });

  const setKeyParam = (key: string | null) => {
    const next = new URLSearchParams(searchParams);
    if (key && originalKey && normalizeEnharmonicKey(key) !== normalizeEnharmonicKey(originalKey)) {
      next.set("key", key);
    } else {
      next.delete("key");
    }
    setSearchParams(next, { replace: true });
  };

  const shift = (delta: number) => {
    if (originalKey) {
      setKeyParam(spellForTarget(originalKey, semis + delta).targetKey);
      return;
    }
    const next = new URLSearchParams(searchParams);
    const value = (((semis + delta) % 12) + 12) % 12;
    if (value === 0) next.delete("t");
    else next.set("t", String(value));
    setSearchParams(next, { replace: true });
  };

  useKeyboardShortcuts({
    scrollRef,
    onTransposeUp: () => shift(1),
    onTransposeDown: () => shift(-1),
    enabled: !(hostModalOpen || keyPickerOpen || tappedChord !== null),
  });

  const sections = useMemo(() => chartSections(content), [content]);
  // Parsed once: the chord shapes and the media links both come off the same
  // document, instead of parsing the whole chart twice.
  const parsedChart = useMemo(() => parseChordPro(content), [content]);
  const media = useMemo(() => songMedia(parsedChart.directives), [parsedChart]);
  const dropboxUrl = showDropbox ? media.dropboxUrl : null;

  // The old site carried the current key back to the search page.
  const searchHref = showSearch ? (semis !== 0 && displayKey ? `/songs?key=${encodeURIComponent(displayKey)}` : "/songs") : null;

  const menuItems: ActionMenuEntry[] = [
    { label: "Print", icon: <Printer />, onSelect: () => window.print() },
    ...menuBefore,
    // Resources: the publisher's original charts, and (for members) the shared
    // Dropbox folder the song came from. In the menu rather than the audio bar
    // because they open outside the app and are an occasional reference.
    ...(media.charts.length > 0 || dropboxUrl
      ? ([
          "separator",
          ...media.charts.map(
            (doc): ActionMenuEntry => ({
              label: `${doc.label} (PDF)`,
              icon: <FileText />,
              onSelect: () => window.open(mediaHref(doc.directive), "_blank", "noopener"),
            }),
          ),
          ...(dropboxUrl
            ? [
                {
                  label: "All song files (Dropbox)",
                  icon: <FolderOpen />,
                  onSelect: () => window.open(dropboxUrl, "_blank", "noopener"),
                } satisfies ActionMenuEntry,
              ]
            : []),
        ] satisfies ActionMenuEntry[])
      : []),
    ...(menuAfter.length > 0 ? (["separator", ...menuAfter] satisfies ActionMenuEntry[]) : []),
  ];

  return (
    <div className="chart-page fixed inset-0 z-40 flex flex-col bg-[hsl(var(--background))] text-[hsl(var(--foreground))]">
      <ChartToolbar
        searchHref={searchHref}
        displayKey={displayKey}
        onOpenKeyPicker={() => setKeyPickerOpen(true)}
        onTransposeUp={() => shift(1)}
        onTransposeDown={() => shift(-1)}
        nashville={prefs.nashville && Boolean(originalKey)}
        nashvilleDisabled={!originalKey}
        onToggleNashville={() => updatePrefs({ nashville: !prefs.nashville })}
        showComments={prefs.showComments}
        onToggleComments={() => updatePrefs({ showComments: !prefs.showComments })}
        fontSize={prefs.fontSize}
        onCycleFontSize={() => updatePrefs({ fontSize: nextFontSize(prefs.fontSize) })}
        keepAwake={prefs.keepAwake}
        keepAwakeSupported={keepAwakeSupported}
        onToggleKeepAwake={() => updatePrefs({ keepAwake: !prefs.keepAwake })}
        resolvedTheme={resolvedTheme}
        onToggleTheme={toggleTheme}
        menuItems={menuItems}
      />
      {banner}

      <div ref={scrollRef} className="chart-scroll flex-1 overflow-auto">
        <div className={`chart-sheet mx-auto ${pageWidthClass(pageWidth)} px-4 py-4 sm:px-6`} data-testid="chart-sheet">
          <div className="print-meta mb-4 space-y-1">
            {displayKey && (
              <div className="text-xs font-semibold uppercase tracking-wide text-[hsl(var(--muted-foreground))]">
                Key of {displayKey}
                {semis !== 0 && originalKey ? <span className="normal-case tracking-normal"> (originally {originalKey})</span> : null}
              </div>
            )}
            <h1 className="page-title">{title}</h1>
            <div className="flex flex-wrap items-center gap-x-3 gap-y-1 text-sm text-[hsl(var(--muted-foreground))]">
              {(artist || year) && <span>{[artist, year].filter(Boolean).join(" / ")}</span>}
              {tempo ? <TempoIndicator tempo={tempo} /> : null}
              {badges}
            </div>
          </div>

          <div className="print-sheet">
            <ChordProRenderer
              content={content}
              songKey={originalKey}
              transpose={semis}
              nashville={prefs.nashville && Boolean(originalKey)}
              fontSize={prefs.fontSize}
              showComments={prefs.showComments}
              wrap={false}
              onChordTap={setTappedChord}
            />
          </div>
        </div>
      </div>

      <SongAudioBar key={chartId} mediaHref={mediaHref} tracks={media.audio} />
      <SectionJumpBar sections={sections} onJump={(sectionId) => jumpToSection(scrollRef.current, sectionId)} />

      <KeyPickerSheet
        open={keyPickerOpen}
        onClose={() => setKeyPickerOpen(false)}
        currentKey={displayKey}
        originalKey={originalKey}
        notation={keyNotation}
        onPick={(key) => setKeyParam(key)}
      />
      <ChordDiagramSheet chord={tappedChord} definitions={parsedChart.chordDefinitions} onClose={() => setTappedChord(null)} />
      {children}
    </div>
  );
}
