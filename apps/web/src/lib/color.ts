/**
 * Pick a readable text color for an arbitrary hex background.
 *
 * Song surfaces (editor preview, print view) use the user-chosen
 * `--page-background-color`, which is independent of the app theme — a dark
 * blue "stage" page in light mode, or the default light-gray page in dark
 * mode. Text on those surfaces must contrast the *surface*, not the theme,
 * or it ghosts (near-white app foreground on a light page background).
 *
 * Returns the brand foreground pair: dark navy on light surfaces, the
 * light-gray foreground on dark surfaces.
 */
export function contrastingTextColor(background: string): string {
  const hex = background.replace("#", "");
  if (!/^[0-9a-f]{6}$/i.test(hex)) return "#000435";
  const red = Number.parseInt(hex.slice(0, 2), 16);
  const green = Number.parseInt(hex.slice(2, 4), 16);
  const blue = Number.parseInt(hex.slice(4, 6), 16);
  const luminance = (0.2126 * red + 0.7152 * green + 0.0722 * blue) / 255;
  return luminance > 0.6 ? "#000435" : "#f8f9fa";
}
