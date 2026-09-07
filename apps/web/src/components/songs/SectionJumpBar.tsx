export interface JumpSection {
  id: string;
  label: string;
}

interface SectionJumpBarProps {
  sections: JumpSection[];
  /** `null` means "Top". */
  onJump: (sectionId: string | null) => void;
}

/**
 * The old site's bottom bar: "Top" plus one button per section header, so a
 * musician can jump to the bridge with one thumb. Hidden in print.
 */
export function SectionJumpBar({ sections, onJump }: SectionJumpBarProps) {
  return (
    <nav
      aria-label="Song sections"
      className="print-hidden shrink-0 border-t border-[hsl(var(--border))] bg-[hsl(var(--card))]/95 backdrop-blur"
    >
      <div className="flex gap-2 overflow-x-auto px-3 py-2 pb-[max(0.5rem,env(safe-area-inset-bottom))]">
        <button type="button" className="btn-outline btn-sm shrink-0" onClick={() => onJump(null)}>
          Top
        </button>
        {sections.map((section) => (
          <button
            key={section.id}
            type="button"
            className="btn-outline btn-sm shrink-0 whitespace-nowrap"
            onClick={() => onJump(section.id)}
          >
            {section.label}
          </button>
        ))}
      </div>
    </nav>
  );
}

/**
 * Scroll a section into view inside the chart's scroll container and flash
 * it, or scroll back to the top when `sectionId` is null.
 */
export function jumpToSection(container: HTMLElement | null, sectionId: string | null) {
  if (sectionId === null) {
    container?.scrollTo({ top: 0, behavior: "smooth" });
    return;
  }
  const target = document.getElementById(sectionId);
  if (!target) return;
  target.scrollIntoView({ behavior: "smooth", block: "start" });
  target.classList.remove("section-flash");
  // Restart the animation even when the same section is tapped twice.
  void target.offsetWidth;
  target.classList.add("section-flash");
  target.addEventListener("animationend", () => target.classList.remove("section-flash"), { once: true });
}
