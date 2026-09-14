/**
 * How wide a page's content runs on a large screen.
 *
 * Centered is the default: a reading column that looks the same on every
 * page and keeps a chart's lines where the eye expects them. Full width is an
 * account choice for someone on a wide monitor or a tablet in landscape who
 * would rather use the whole screen. Phones are narrower than the column
 * either way, so this only changes anything from tablet width up.
 *
 * Kept out of ThemeContext on purpose: a dozen tests mock that module with
 * just `useTheme`, and a helper exported from it would vanish under the mock.
 */
export type PageWidth = "centered" | "full";

export const PAGE_WIDTHS: { value: PageWidth; label: string }[] = [
  { value: "centered", label: "Centered" },
  { value: "full", label: "Full width" },
];

export function isPageWidth(value: unknown): value is PageWidth {
  return value === "centered" || value === "full";
}

/** The max-width class for a page's content. Anything unrecognised is centered. */
export function pageWidthClass(width: PageWidth | undefined): string {
  return width === "full" ? "max-w-none" : "max-w-3xl";
}
