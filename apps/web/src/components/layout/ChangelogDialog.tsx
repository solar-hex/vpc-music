import { useEffect } from "react";
import { X } from "lucide-react";
// Single source of truth: the repo-root CHANGELOG.md, imported as raw text.
import changelogRaw from "../../../../../CHANGELOG.md?raw";

type Block =
  | { kind: "h2" | "h3" | "p"; text: string }
  | { kind: "ul"; items: string[] };

/**
 * Minimal Markdown → blocks parser for the subset the changelog uses:
 * `##`/`###` headings, `-` bullet lists, and plain paragraphs. HTML comments
 * (e.g. the changelog cursor marker) are stripped. Inline `code` and **bold**
 * are handled at render time. Everything before the first `##` (the file's
 * `# Changelog` title + intro) is dropped — the dialog supplies its own title.
 */
function parseChangelog(md: string): Block[] {
  const cleaned = md.replace(/<!--[\s\S]*?-->/g, "");
  const lines = cleaned.split("\n");
  const blocks: Block[] = [];
  let para: string[] = [];
  let list: string[] | null = null;
  let started = false;

  const flushPara = () => {
    if (para.length) blocks.push({ kind: "p", text: para.join(" ") });
    para = [];
  };
  const flushList = () => {
    if (list && list.length) blocks.push({ kind: "ul", items: list });
    list = null;
  };

  for (const raw of lines) {
    const line = raw.trim();
    const heading = /^(#{1,3})\s+(.*)$/.exec(line);
    if (heading && heading[1].length <= 2) started = started || heading[1].length === 2;
    if (!started) continue;

    if (!line) {
      flushPara();
      flushList();
      continue;
    }
    if (heading) {
      flushPara();
      flushList();
      const level = heading[1].length;
      if (level >= 2) blocks.push({ kind: level === 2 ? "h2" : "h3", text: heading[2] });
      continue;
    }
    const bullet = /^[-*]\s+(.*)$/.exec(line);
    if (bullet) {
      flushPara();
      if (!list) list = [];
      list.push(bullet[1]);
      continue;
    }
    flushList();
    para.push(line);
  }
  flushPara();
  flushList();
  return blocks;
}

/** Render inline `code` spans and **bold** runs; everything else is plain text. */
function renderInline(text: string): React.ReactNode[] {
  return text.split(/(`[^`]+`)/g).flatMap((chunk, i) => {
    if (chunk.startsWith("`") && chunk.endsWith("`")) {
      return [
        <code
          key={`c${i}`}
          className="rounded bg-[hsl(var(--muted))] px-1 py-0.5 font-mono text-[0.8em] text-[hsl(var(--foreground))]"
        >
          {chunk.slice(1, -1)}
        </code>,
      ];
    }
    return chunk.split(/(\*\*[^*]+\*\*)/g).map((run, j) =>
      run.startsWith("**") && run.endsWith("**") ? (
        <strong key={`b${i}-${j}`} className="font-semibold text-[hsl(var(--foreground))]">
          {run.slice(2, -2)}
        </strong>
      ) : (
        <span key={`t${i}-${j}`}>{run}</span>
      ),
    );
  });
}

const BLOCKS = parseChangelog(changelogRaw);

export default function ChangelogDialog({ onClose }: { onClose: () => void }) {
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, [onClose]);

  return (
    <div
      className="modal-backdrop"
      role="dialog"
      aria-modal="true"
      aria-labelledby="changelog-title"
      onClick={onClose}
    >
      <div className="modal-content flex max-h-[80vh] w-full max-w-2xl flex-col" onClick={(e) => e.stopPropagation()}>
        <div className="mb-3 flex items-center justify-between gap-3">
          <div>
            <h2 id="changelog-title" className="text-lg font-brand text-[hsl(var(--foreground))]">
              What&apos;s new
            </h2>
            <p className="text-xs text-[hsl(var(--muted-foreground))]">Recent changes to VPC Music</p>
          </div>
          <button
            onClick={onClose}
            className="btn-icon rounded-md text-[hsl(var(--muted-foreground))] hover:text-[hsl(var(--foreground))]"
            aria-label="Close"
          >
            <X className="h-4 w-4" />
          </button>
        </div>

        <div className="-mr-2 space-y-1 overflow-y-auto pr-2 text-sm leading-relaxed">
          {BLOCKS.map((block, i) => {
            if (block.kind === "h2") {
              return (
                <h3
                  key={i}
                  className="border-b border-[hsl(var(--border))] pb-1 pt-4 text-sm font-semibold text-[hsl(var(--foreground))]"
                >
                  {block.text}
                </h3>
              );
            }
            if (block.kind === "h3") {
              return (
                <h4 key={i} className="pt-3 text-xs font-semibold uppercase tracking-wide text-[hsl(var(--secondary))]">
                  {renderInline(block.text)}
                </h4>
              );
            }
            if (block.kind === "ul") {
              return (
                <ul key={i} className="list-disc space-y-1 pl-5 text-[hsl(var(--muted-foreground))]">
                  {block.items.map((item, j) => (
                    <li key={j}>{renderInline(item)}</li>
                  ))}
                </ul>
              );
            }
            return (
              <p key={i} className="text-[hsl(var(--muted-foreground))]">
                {renderInline(block.text)}
              </p>
            );
          })}
        </div>
      </div>
    </div>
  );
}
