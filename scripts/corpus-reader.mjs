/**
 * corpus:reader — build a standalone offline songbook.
 *
 * Emits ONE self-contained HTML file with every chart embedded. No server, no
 * network, no install: open it from a laptop, a USB stick or a phone's
 * downloads folder and it works, forever.
 *
 * This is deliberately distinct from the PWA. The PWA is the *app* working
 * offline; the songbook is a *document* that outlives the app, the database
 * and the hosting.
 *
 *   pnpm corpus:reader [--out <file>] [--corpus <dir>]
 *
 * The chart engine is the real one: shared/index.js is bundled straight in, so
 * transposition here behaves exactly as it does in the app.
 */
import { existsSync } from "node:fs";
import { mkdir, readFile, readdir, writeFile } from "node:fs/promises";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";
import { spawnSync } from "node:child_process";

const __dirname = dirname(fileURLToPath(import.meta.url));
export const repoRoot = resolve(__dirname, "..");

/** esbuild ships as a platform binary inside the pnpm store. */
export async function findEsbuild(root = repoRoot) {
  const base = join(root, "node_modules", ".pnpm");
  if (!existsSync(base)) return null;
  for (const entry of await readdir(base)) {
    if (!entry.startsWith("@esbuild+")) continue;
    for (const candidate of [
      join(base, entry, "node_modules", "@esbuild", entry.split("@esbuild+")[1].split("@")[0], "esbuild.exe"),
      join(base, entry, "node_modules", "@esbuild", entry.split("@esbuild+")[1].split("@")[0], "bin", "esbuild"),
    ]) {
      if (existsSync(candidate)) return candidate;
    }
  }
  return null;
}

/** Bundle the shared chart engine as an IIFE for the browser. */
export async function bundleEngine(root = repoRoot) {
  const esbuild = await findEsbuild(root);
  if (!esbuild) throw new Error("esbuild binary not found under node_modules/.pnpm");
  const out = join(root, "node_modules", ".cache", "vpc-songbook-engine.js");
  await mkdir(dirname(out), { recursive: true });
  const result = spawnSync(
    esbuild,
    [
      join(root, "shared", "index.js"),
      "--bundle",
      "--format=iife",
      "--global-name=VPCShared",
      "--platform=browser",
      "--minify",
      `--outfile=${out}`,
    ],
    { encoding: "utf8" },
  );
  if (result.status !== 0) throw new Error(`esbuild failed: ${result.stderr || result.stdout}`);
  return readFile(out, "utf8");
}

/** Read every committed corpus song, newest source type first. */
export async function loadCorpusSongs(corpusRoot) {
  const manifestDir = join(corpusRoot, "manifest");
  if (!existsSync(manifestDir)) throw new Error(`No corpus manifests at ${manifestDir}`);
  const songs = [];
  for (const file of (await readdir(manifestDir)).sort()) {
    if (!file.endsWith(".json")) continue;
    const manifest = JSON.parse(await readFile(join(manifestDir, file), "utf8"));
    for (const song of manifest.songs) {
      const path = join(corpusRoot, song.file);
      if (!existsSync(path)) continue;
      songs.push({
        id: song.songId,
        t: song.title,
        k: song.metadata.key || null,
        a: song.metadata.artist || null,
        d: song.metadata.isDraft ? 1 : 0,
        s: manifest.sourceType,
        c: await readFile(path, "utf8"),
      });
    }
  }
  songs.sort((a, b) => a.t.localeCompare(b.t, "en", { sensitivity: "base" }));
  return songs;
}

const PAGE_CSS = `
:root{--bg:#faf9f7;--fg:#1b1b1f;--muted:#6b6b76;--line:#e3e1dd;--chord:#c0392b;--second:#8e44ad;--accent:#2f6f4f;--card:#fff}
@media(prefers-color-scheme:dark){:root{--bg:#14151a;--fg:#e9e8e6;--muted:#9a9aa4;--line:#2b2c34;--chord:#ff7a6b;--second:#c58cf0;--accent:#7fd0a5;--card:#1b1d23}}
*{box-sizing:border-box}
body{margin:0;background:var(--bg);color:var(--fg);font:16px/1.5 -apple-system,BlinkMacSystemFont,"Segoe UI",Roboto,sans-serif}
.wrap{display:flex;height:100vh;overflow:hidden}
.list{width:340px;border-right:1px solid var(--line);display:flex;flex-direction:column;background:var(--card)}
.search{padding:12px;border-bottom:1px solid var(--line)}
.search input{width:100%;padding:10px 12px;font-size:16px;border:1px solid var(--line);border-radius:8px;background:var(--bg);color:var(--fg)}
.meta{padding:6px 12px;font-size:12px;color:var(--muted);border-bottom:1px solid var(--line);display:flex;gap:12px;align-items:center}
.meta label{display:flex;gap:5px;align-items:center;cursor:pointer}
.rows{overflow-y:auto;flex:1}
.row{padding:9px 12px;border-bottom:1px solid var(--line);cursor:pointer}
.row:hover{background:var(--bg)}
.row.on{background:var(--bg);box-shadow:inset 3px 0 0 var(--accent)}
.row b{font-weight:600;font-size:15px}
.row .sub{font-size:12px;color:var(--muted);margin-top:1px}
.pill{float:right;font-size:11px;color:var(--muted);border:1px solid var(--line);border-radius:99px;padding:1px 7px}
.chart{flex:1;display:flex;flex-direction:column;overflow:hidden}
.bar{display:flex;gap:8px;align-items:center;padding:10px 14px;border-bottom:1px solid var(--line);background:var(--card);flex-wrap:wrap}
.bar button{font:inherit;font-size:14px;padding:6px 11px;border:1px solid var(--line);background:var(--bg);color:var(--fg);border-radius:7px;cursor:pointer}
.bar button:hover{border-color:var(--accent)}
.bar button.on{border-color:var(--accent);color:var(--accent)}
.bar .k{font-weight:700;color:var(--accent);min-width:58px;text-align:center}
.bar .sp{flex:1}
.doc{overflow-y:auto;padding:22px 26px 80px}
h1{font-size:22px;margin:0 0 2px}
.by{color:var(--muted);font-size:13px;margin-bottom:18px}
.sec{margin:18px 0 4px;font-weight:700;color:var(--accent);font-size:13px;letter-spacing:.08em;text-transform:uppercase}
.ln{font-family:ui-monospace,SFMono-Regular,Menlo,Consolas,monospace;white-space:pre-wrap;margin:0 0 2px;line-height:1.35}
.seg{display:inline-block;vertical-align:bottom}
.ch{display:block;color:var(--chord);font-weight:700;height:1.25em}
.ch.s{color:var(--second)}
.note{font-style:italic;color:var(--muted);margin:3px 0}
.empty{color:var(--muted);padding:40px;text-align:center}
.back{display:none}
@media(max-width:760px){
  .wrap.showing .list{display:none}.wrap:not(.showing) .chart{display:none}
  .list{width:100%;border:0}.back{display:inline-block}
}
@media print{.list,.bar{display:none}.doc{overflow:visible;padding:0}body{background:#fff;color:#000}}
`;

const PAGE_JS = `
const $=(s)=>document.querySelector(s);
const S=window.__SONGS__;
const T=VPCShared;
let cur=null,steps=0,override=null,showChords=true,showNotes=true,showDrafts=false;

function norm(s){return (s||"").toLowerCase().replace(/[^a-z0-9]+/g," ").trim()}
function matches(song,q){
  if(!q)return true;
  const hay=norm(song.t+" "+(song.a||"")+" "+song.c);
  return q.split(/\\s+/).every(t=>hay.includes(t));
}
function renderList(){
  const q=norm($("#q").value);
  const rows=S.filter(s=>(showDrafts||!s.d)&&matches(s,q));
  $("#count").textContent=rows.length+" of "+S.length;
  $("#rows").innerHTML=rows.map(s=>
    '<div class="row'+(cur&&cur.id===s.id?' on':'')+'" data-id="'+s.id+'">'+
    (s.k?'<span class="pill">'+s.k+'</span>':'')+
    '<b>'+esc(s.t)+'</b>'+
    (s.a||s.d?'<div class="sub">'+[s.a?esc(s.a):'',s.d?'draft':''].filter(Boolean).join(' · ')+'</div>':'')+
    '</div>').join('')||'<div class="empty">No songs match.</div>';
}
function esc(t){return String(t).replace(/[&<>"]/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;'}[c]))}

function open(id){
  cur=S.find(s=>s.id===id);steps=0;override=null;
  document.querySelector('.wrap').classList.add('showing');
  renderList();renderChart();
}
function displayKey(){
  if(!cur)return"";
  if(!cur.k)return steps?(steps>0?"+"+steps:String(steps)):"";
  return T.transposeKeyName(cur.k,steps,T.keyPrefersFlats(override||cur.k));
}
function renderChart(){
  if(!cur){$("#doc").innerHTML='<div class="empty">Choose a song.</div>';$("#bar").style.display="none";return}
  $("#bar").style.display="flex";
  $("#key").textContent=displayKey()||"—";
  let src=cur.c;
  if(steps){
    const sp=cur.k?T.spellForTarget(cur.k,steps):{preferFlats:false};
    src=T.transposeChordPro(src,steps,sp.preferFlats);
  }
  const doc=T.parseChordPro(src);
  const d=doc.directives||{};
  let html='<h1>'+esc(d.title||cur.t)+'</h1>';
  const by=[d.artist,d.subtitle,d.year].filter(Boolean).join(' · ');
  if(by)html+='<div class="by">'+esc(by)+'</div>';
  for(const sec of doc.sections){
    if(sec.name)html+='<div class="sec">'+esc(sec.name)+'</div>';
    for(const ln of sec.lines){
      if(ln.note){if(showNotes)html+='<div class="note">'+esc(ln.note)+'</div>';continue}
      html+=line(ln);
    }
  }
  $("#doc").innerHTML=html;$("#doc").scrollTop=0;
}
function line(ln){
  const lyric=ln.lyrics||"";
  const chords=(ln.chords||[]).slice().sort((a,b)=>a.position-b.position);
  if(!chords.length||!showChords)return '<p class="ln">'+(esc(lyric)||'&nbsp;')+'</p>';
  // Split the lyric at each chord position; the chord sits above its segment.
  let out='',i=0;
  const pri=chords.filter(c=>!T.isSecondaryToken(c.chord));
  const sec=chords.filter(c=>T.isSecondaryToken(c.chord));
  const marks=[...new Set(pri.concat(sec).map(c=>Math.min(c.position,lyric.length)))].sort((a,b)=>a-b);
  if(marks[0]>0){out+='<span class="seg"><span class="ch"></span>'+esc(lyric.slice(0,marks[0]))+'</span>';i=marks[0]}
  marks.forEach((m,idx)=>{
    const end=idx+1<marks.length?marks[idx+1]:lyric.length;
    const p=pri.find(c=>Math.min(c.position,lyric.length)===m);
    const s=sec.find(c=>Math.min(c.position,lyric.length)===m);
    const txt=esc(lyric.slice(m,end))||'&nbsp;';
    out+='<span class="seg">'+
      (s?'<span class="ch s">'+esc(s.chord.replace(/^\\*/,""))+'</span>':'')+
      '<span class="ch">'+(p?esc(p.chord):'')+'</span>'+txt+'</span>';
    i=end;
  });
  return '<p class="ln">'+out+'</p>';
}
function nudge(n){steps+=n;renderChart()}

// Re-running this script must not stack a second set of listeners on document
// (it would double every keypress and click). Harmless in a browser, essential
// when the page is mounted repeatedly.
if(window.__vpcUnbind)window.__vpcUnbind();
const onClick=e=>{
  const row=e.target.closest('.row');if(row)return open(row.dataset.id);
  const b=e.target.closest('[data-act]');if(!b)return;
  const a=b.dataset.act;
  if(a==='up')nudge(1);
  else if(a==='down')nudge(-1);
  else if(a==='reset'){steps=0;renderChart()}
  else if(a==='chords'){showChords=!showChords;b.classList.toggle('on',!showChords);renderChart()}
  else if(a==='notes'){showNotes=!showNotes;b.classList.toggle('on',!showNotes);renderChart()}
  else if(a==='print')window.print();
  else if(a==='back')document.querySelector('.wrap').classList.remove('showing');
};
const onInput=e=>{if(e.target.id==='q')renderList()};
const onChange=e=>{if(e.target.id==='drafts'){showDrafts=e.target.checked;renderList()}};
const onKey=e=>{
  if(e.target.tagName==='INPUT')return;
  if(e.key==='/'){e.preventDefault();$("#q").focus()}
  if(e.key==='+'||e.key==='=')nudge(1);
  if(e.key==='-')nudge(-1);
};
document.addEventListener('click',onClick);
document.addEventListener('input',onInput);
document.addEventListener('change',onChange);
document.addEventListener('keydown',onKey);
window.__vpcUnbind=()=>{
  document.removeEventListener('click',onClick);
  document.removeEventListener('input',onInput);
  document.removeEventListener('change',onChange);
  document.removeEventListener('keydown',onKey);
};
renderList();renderChart();
`;

export function buildHtml({ engine, songs, builtFrom }) {
  return `<!doctype html>
<html lang="en"><head><meta charset="utf-8">
<meta name="viewport" content="width=device-width,initial-scale=1">
<title>VPC Songbook</title>
<style>${PAGE_CSS}</style></head>
<body>
<div class="wrap">
  <aside class="list">
    <div class="search"><input id="q" placeholder="Search titles and lyrics…" autocomplete="off"></div>
    <div class="meta"><span id="count"></span><span style="flex:1"></span>
      <label><input type="checkbox" id="drafts"> drafts</label></div>
    <div class="rows" id="rows"></div>
  </aside>
  <main class="chart">
    <div class="bar" id="bar" style="display:none">
      <button class="back" data-act="back">‹ Songs</button>
      <button data-act="down">−</button>
      <span class="k" id="key"></span>
      <button data-act="up">+</button>
      <button data-act="reset">Reset</button>
      <span class="sp"></span>
      <button data-act="chords">Chords</button>
      <button data-act="notes">Notes</button>
      <button data-act="print">Print</button>
    </div>
    <div class="doc" id="doc"></div>
  </main>
</div>
<script>${engine}</script>
<script>window.__SONGS__=${JSON.stringify(songs)};</script>
<script>${PAGE_JS}</script>
<!-- built from ${builtFrom} songs -->
</body></html>
`;
}

async function runCli() {
  const argv = process.argv.slice(2);
  const arg = (flag, fallback) => {
    const i = argv.indexOf(flag);
    return i === -1 ? fallback : argv[i + 1];
  };
  const corpusRoot = resolve(process.cwd(), arg("--corpus", join(repoRoot, "corpus")));
  const outFile = resolve(process.cwd(), arg("--out", join(repoRoot, "dist", "songbook.html")));

  const songs = await loadCorpusSongs(corpusRoot);
  const engine = await bundleEngine();
  const html = buildHtml({ engine, songs, builtFrom: songs.length });

  await mkdir(dirname(outFile), { recursive: true });
  await writeFile(outFile, html, "utf8");
  const mb = (Buffer.byteLength(html) / 1048576).toFixed(2);
  console.log(`songs:  ${songs.length}`);
  console.log(`engine: ${(Buffer.byteLength(engine) / 1024).toFixed(0)} kB`);
  console.log(`output: ${outFile}  (${mb} MB)`);
  console.log(`Open it with no network at all — it is entirely self-contained.`);
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  runCli().catch((error) => {
    console.error(error instanceof Error ? error.message : String(error));
    process.exit(1);
  });
}
