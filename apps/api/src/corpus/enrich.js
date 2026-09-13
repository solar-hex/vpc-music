/**
 * Put everything about a song into its own ChordPro file.
 *
 * The `.chopro` file is the complete record, not just the chart text: artist,
 * tempo, derived themes, media links and where it came from all live in the
 * file's directive block. The manifest becomes an index of the files rather
 * than a second home for their metadata.
 *
 * Two constraints from the engine shape the scheme, both verified:
 *  - a directive key appears at most once — `parseChordPro` keeps the LAST
 *    value, so repeated `{x_media: …}` would silently collapse. Every media
 *    file therefore gets its own key.
 *  - `x_`-prefixed directives are captured, preserved and re-serialised, and
 *    nothing in the app renders unknown directives, so they stay invisible on
 *    the chart while travelling with it.
 */

/** Directives the app itself understands, in the order they should be written. */
const CORE_ORDER = ["title", "subtitle", "artist", "key", "tempo", "time", "year", "capo", "ccli", "copyright"];

/** Directive keys must be a single safe token. */
export function directiveSlug(value) {
  return String(value || "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "_")
    .replace(/^_+|_+$/g, "");
}

/**
 * Split a ChordPro document into its leading directive block and the rest,
 * so enrichment rewrites only the header and never touches the chart.
 */
export function splitHeader(content) {
  const lines = String(content || "").split("\n");
  const header = [];
  let i = 0;
  for (; i < lines.length; i += 1) {
    const line = lines[i].trim();
    if (!line) { if (header.length > 0) { i += 1; break; } continue; }
    if (/^\{[a-z_0-9]+\s*:/i.test(line)) header.push(line);
    else break;
  }
  return { header, body: lines.slice(i).join("\n").replace(/^\n+/, "") };
}

export function parseHeader(headerLines) {
  const map = new Map();
  for (const line of headerLines) {
    const m = line.match(/^\{([a-z_0-9]+)\s*:\s*([\s\S]*?)\}$/i);
    if (m) map.set(m[1].toLowerCase(), m[2].trim());
  }
  return map;
}

/**
 * A stable, readable key for one media file:
 *   audio/alto.m4a            -> x_audio_alto
 *   audio/loop-77bpm.mp3      -> x_audio_loop_77bpm
 *   charts/chord-chart.pdf    -> x_chart_chord_chart
 */
export function mediaDirectiveKey(objectKey) {
  const parts = String(objectKey).split("/");
  const leaf = parts.pop().replace(/\.[^.]+$/, "");
  const kind = parts.pop() || "media";
  const prefix = kind === "charts" ? "chart" : kind === "audio" ? "audio" : directiveSlug(kind);
  return `x_${prefix}_${directiveSlug(leaf)}`;
}

/**
 * Build the enriched header for one song.
 *
 * @param {object} spec
 * @param {string} spec.content        the converted ChordPro
 * @param {object} spec.metadata       title/artist/key/tempo/year from conversion
 * @param {string[]} [spec.aka]        other names this song answers to
 * @param {string} [spec.verified]     how an independent source confirmed it
 * @param {string[]} [spec.themes]     derived theme ids
 * @param {Array<{key,url,bpm?}>} [spec.media]
 * @param {string} [spec.sourcePath]   path inside the source tree
 * @param {string} [spec.sourceType]   chrd | docx | …
 * @param {string} [spec.dropboxUrl]   an alternative place to find the original
 * @returns {string} the whole file
 */
export function enrichChordPro(spec) {
  const { header, body } = splitHeader(spec.content);
  const existing = parseHeader(header);
  const out = new Map();

  // Core metadata: what the conversion found wins, then whatever the file
  // already carried (a hand-edit must not be thrown away).
  const core = {
    title: spec.metadata?.title ?? existing.get("title"),
    artist: spec.metadata?.artist ?? existing.get("artist"),
    key: spec.metadata?.key ?? existing.get("key"),
    tempo: spec.metadata?.tempo ?? existing.get("tempo"),
    year: spec.metadata?.year ?? existing.get("year"),
    subtitle: existing.get("subtitle"),
    time: existing.get("time"),
    capo: existing.get("capo"),
    ccli: existing.get("ccli"),
    copyright: existing.get("copyright"),
  };
  for (const k of CORE_ORDER) {
    const v = core[k];
    if (v !== undefined && v !== null && String(v).trim() !== "") out.set(k, String(v).trim());
  }

  // A tempo we worked out from a media filename is still a tempo, but say so.
  if (!out.has("tempo") && spec.derivedTempo) {
    out.set("tempo", String(spec.derivedTempo));
    out.set("x_tempo_source", "derived from media filename");
  }

  /*
   * Other names this song answers to. The church's own list calls it "I See A
   * Crimson Stream Of Blood" and the chart is titled "I See A Crimson Stream";
   * without this, searching the first finds nothing and the gap report keeps
   * reporting a song we have as missing.
   *
   * Semicolons separate them, because an alternate title often contains a
   * comma. Reviewed in `corpus/aliases.json`, never guessed here.
   */
  if (spec.aka?.length) {
    const seen = new Set([String(out.get("title") || "").toLowerCase()]);
    const names = [];
    for (const name of spec.aka) {
      const text = String(name || "").trim();
      if (!text || seen.has(text.toLowerCase())) continue;
      seen.add(text.toLowerCase());
      names.push(text);
    }
    if (names.length > 0) out.set("x_aka", names.join("; "));
  }

  /*
   * Properties of the song rather than subjects of it. `unlisted` is the old
   * site's tilde — a `~` in front of the filename kept a song out of the
   * default list — and `secular` is its `~z_` variant. Both survived only as a
   * character inside the source path, which is recoverable but not usable.
   */
  if (spec.flags?.length) out.set("x_flag", [...new Set(spec.flags)].sort().join(", "));

  // Why this chart is trusted, travelling with the chart rather than sitting in
  // a report nobody opens.
  if (spec.verified) out.set("x_verified", spec.verified);

  if (spec.themes?.length) out.set("x_theme", [...spec.themes].join(", "));
  if (spec.sourceType && spec.sourcePath) {
    out.set("x_source", `${spec.sourceType}:${spec.sourcePath}`);
  }
  if (spec.dropboxUrl) out.set("x_dropbox", spec.dropboxUrl);

  // One directive per media file, sorted so a rebuild is byte-identical.
  for (const item of [...(spec.media || [])].sort((a, b) => a.key.localeCompare(b.key))) {
    const key = mediaDirectiveKey(item.key);
    if (!out.has(key)) out.set(key, item.url);
  }

  // Anything a human added that we do not manage is preserved, at the end.
  for (const [k, v] of existing) {
    if (!out.has(k)) out.set(k, v);
  }

  const headerText = [...out.entries()].map(([k, v]) => `{${k}: ${v}}`).join("\n");
  return `${headerText}\n\n${body}`.replace(/\n{3,}/g, "\n\n").replace(/\s*$/, "\n");
}

/** Read the media links back out of a chart. */
export function mediaLinksFrom(directives) {
  const out = [];
  for (const [k, v] of Object.entries(directives || {})) {
    if (!/^x_(audio|chart|media)_/.test(k)) continue;
    const [, kind, ...rest] = k.split("_");
    out.push({ kind, part: rest.join("_"), url: v });
  }
  return out.sort((a, b) => a.kind.localeCompare(b.kind) || a.part.localeCompare(b.part));
}

/** Themes recorded in a chart, as ids. */
export function themesFrom(directives) {
  return String(directives?.x_theme || "")
    .split(",")
    .map((s) => s.trim())
    .filter(Boolean);
}
