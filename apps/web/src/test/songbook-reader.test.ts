/**
 * The standalone songbook must work as a plain file with no network and no
 * build step, so it is tested the way it is used: render the generated HTML
 * into a document and drive it.
 */
import { describe, expect, it, beforeAll } from "vitest";
// @ts-expect-error — plain .mjs build script, no types
import { buildHtml } from "../../../../scripts/corpus-reader.mjs";
// @ts-expect-error — plain .mjs build script, no types
import { bundleEngine } from "../../../../scripts/corpus-reader.mjs";

const SONGS = [
  {
    id: "aaaaaaaa-0000-5000-8000-000000000000",
    t: "God is Great",
    k: "F",
    a: null,
    d: 0,
    s: "chrd",
    c: "{title: God is Great}\n{key: F}\n\n{comment: Chorus}\n[F]God is [Bb]great and [F]greatly to be [Bb]praised\n",
  },
  {
    id: "bbbbbbbb-0000-5000-8000-000000000000",
    t: "Amazing Grace",
    k: "G",
    a: "John Newton",
    d: 0,
    s: "chrd",
    c: "{title: Amazing Grace}\n{key: G}\n{artist: John Newton}\n\n{comment: Verse 1}\n[G]Amazing grace how [C]sweet the sound\n",
  },
  {
    id: "cccccccc-0000-5000-8000-000000000000",
    t: "Lyrics Only Draft",
    k: null,
    a: null,
    d: 1,
    s: "docx",
    c: "{title: Lyrics Only Draft}\n\n{comment: Chorus}\nNo chords here at all\n",
  },
];

let html: string;

beforeAll(async () => {
  // The real bundled engine — this is what ships inside the file.
  const engine = await bundleEngine();
  html = buildHtml({ engine, songs: SONGS, builtFrom: SONGS.length });
}, 60_000);

function mount() {
  document.documentElement.innerHTML = html
    .replace(/^[\s\S]*?<body>/, "")
    .replace(/<\/body>[\s\S]*$/, "");
  // Execute the page's scripts in order, as a browser would. Indirect eval
  // runs in global scope, so the engine's `var VPCShared` becomes a global
  // exactly as a real <script> tag would make it.
  const globalEval = eval;
  for (const match of html.matchAll(/<script>([\s\S]*?)<\/script>/g)) {
    globalEval(match[1]);
  }
}

describe("standalone songbook", () => {
  it("is one self-contained file with no external references", () => {
    expect(html).not.toMatch(/<script[^>]+src=/);
    expect(html).not.toMatch(/<link[^>]+href=/);
    expect(html).not.toMatch(/https?:\/\/(?!www\.w3\.org)/);
  });

  it("embeds every song", () => {
    expect(html).toContain("God is Great");
    expect(html).toContain("Amazing Grace");
  });

  it("lists non-draft songs and hides drafts", () => {
    mount();
    const rows = document.querySelectorAll(".row");
    expect(rows.length).toBe(2); // the draft is hidden
    expect(document.querySelector("#count")?.textContent).toBe("2 of 3");
  });

  it("opens a chart with its chords positioned over the lyrics", () => {
    mount();
    const row = document.querySelector<HTMLElement>('.row[data-id="aaaaaaaa-0000-5000-8000-000000000000"]')!;
    row.dispatchEvent(new MouseEvent("click", { bubbles: true }));

    expect(document.querySelector("#doc h1")?.textContent).toBe("God is Great");
    expect(document.querySelector("#key")?.textContent).toBe("F");
    const chords = [...document.querySelectorAll("#doc .ch")].map((e) => e.textContent).filter(Boolean);
    expect(chords).toEqual(["F", "Bb", "F", "Bb"]);
  });

  it("transposes with the same engine the app uses", () => {
    mount();
    document
      .querySelector<HTMLElement>('.row[data-id="aaaaaaaa-0000-5000-8000-000000000000"]')!
      .dispatchEvent(new MouseEvent("click", { bubbles: true }));
    const up = document.querySelector<HTMLElement>('[data-act="up"]')!;
    up.dispatchEvent(new MouseEvent("click", { bubbles: true }));
    up.dispatchEvent(new MouseEvent("click", { bubbles: true }));

    expect(document.querySelector("#key")?.textContent).toBe("G");
    const chords = [...document.querySelectorAll("#doc .ch")].map((e) => e.textContent).filter(Boolean);
    expect(chords).toEqual(["G", "C", "G", "C"]);
  });

  it("searches titles and lyrics", () => {
    mount();
    const q = document.querySelector<HTMLInputElement>("#q")!;
    q.value = "amazing";
    q.dispatchEvent(new Event("input", { bubbles: true }));
    expect(document.querySelectorAll(".row").length).toBe(1);

    // lyric search, not just titles
    q.value = "greatly to be";
    q.dispatchEvent(new Event("input", { bubbles: true }));
    expect(document.querySelectorAll(".row").length).toBe(1);
    expect(document.querySelector(".row b")?.textContent).toBe("God is Great");
  });

  it("shows drafts only when asked", () => {
    mount();
    const toggle = document.querySelector<HTMLInputElement>("#drafts")!;
    toggle.checked = true;
    toggle.dispatchEvent(new Event("change", { bubbles: true }));
    expect(document.querySelectorAll(".row").length).toBe(3);
  });

  it("renders a lyrics-only song without inventing chords", () => {
    mount();
    const toggle = document.querySelector<HTMLInputElement>("#drafts")!;
    toggle.checked = true;
    toggle.dispatchEvent(new Event("change", { bubbles: true }));
    document
      .querySelector<HTMLElement>('.row[data-id="cccccccc-0000-5000-8000-000000000000"]')!
      .dispatchEvent(new MouseEvent("click", { bubbles: true }));

    expect(document.querySelector("#doc h1")?.textContent).toBe("Lyrics Only Draft");
    const chords = [...document.querySelectorAll("#doc .ch")].map((e) => e.textContent).filter(Boolean);
    expect(chords).toEqual([]);
    expect(document.querySelector("#doc")?.textContent).toContain("No chords here at all");
  });
});
