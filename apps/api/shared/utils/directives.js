/**
 * Read and write one property of a chart where it lives: a `{name: value}`
 * directive in the chart text.
 *
 * The chart is the complete record of a song, so a property like the time
 * signature, or the song a copy was merged into, is kept in the chart rather
 * than in a side column. The editor, the API and the corpus tools all go
 * through these, so a directive is found and written the same way everywhere.
 */

function directivePattern(name, flags = "i") {
  const escaped = String(name).replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
  // One optional space after the colon belongs to the format; anything else is
  // the value, trailing spaces included, so a field being typed into keeps them.
  return new RegExp(`^\\s*\\{\\s*${escaped}\\s*:[ \\t]?(.*)\\}\\s*$`, flags);
}

/** The value of a directive, or "" when the chart has none. The last one wins, as in the parser. */
export function readDirective(content, name) {
  let value = "";
  const pattern = directivePattern(name);
  for (const line of String(content ?? "").split("\n")) {
    const match = line.match(pattern);
    if (match) value = match[1];
  }
  return value;
}

/** Whether the chart has the directive at all, even an empty one. */
export function hasDirective(content, name) {
  const pattern = directivePattern(name);
  return String(content ?? "").split("\n").some((line) => pattern.test(line));
}

/**
 * The chart with a directive set to a value. An empty value removes the
 * directive. A directive a chart repeats is left once, where it was first. A
 * new one goes at the end of the directive block at the top of the chart.
 */
export function writeDirective(content, name, value) {
  // A brace or a line break would end the directive early and spill into the chart.
  const clean = String(value ?? "").replace(/[{}\r\n]/g, "");
  const pattern = directivePattern(name);
  const lines = String(content ?? "").split("\n");

  const kept = [];
  let placed = false;
  for (const line of lines) {
    if (!pattern.test(line)) {
      kept.push(line);
      continue;
    }
    if (!placed && clean.trim()) kept.push(`{${name}: ${clean}}`);
    placed = true;
  }
  if (placed || !clean.trim()) return kept.join("\n");

  let insertAt = 0;
  while (insertAt < kept.length && /^\s*\{\s*[a-z_]+\s*:/i.test(kept[insertAt])) insertAt += 1;
  kept.splice(insertAt, 0, `{${name}: ${clean}}`);
  return kept.join("\n");
}
