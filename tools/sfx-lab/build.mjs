// Builds the listening page for the battle sounds into ONE html file (inline JS and CSS, no network): .tmp/sfx-lab/index.html (CHE-261).
// Today's voices come from the real src/battle/sfx.js and src/audio.js, bundled at build time.
//   node tools/sfx-lab/build.mjs
import { build } from 'esbuild';
import { mkdirSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { ROOT } from '../_lib.mjs';

const OUT = join(ROOT, '.tmp', 'sfx-lab');
mkdirSync(OUT, { recursive: true });
const js = (await build({ entryPoints: [join(ROOT, 'tools/sfx-lab/page.js')], bundle: true, format: 'iife', write: false, target: 'es2020', minify: false, legalComments: 'none' })).outputFiles[0].text;

const css = `
:root{color-scheme:light;--bg:#f6f4ef;--surface:#ffffff;--text:#1d1b17;--muted:#6a655c;--line:#ddd7ca;--accent:#b4531c;--accent-text:#ffffff;--tag:#e8f1dc;--tag-text:#35560f;--on:#ffe3c4}
@media (prefers-color-scheme: dark){:root:not([data-theme="light"]){color-scheme:dark;--bg:#15130f;--surface:#201d17;--text:#efe9dc;--muted:#a39b8b;--line:#38332a;--accent:#e08a4a;--accent-text:#1a1208;--tag:#2c3a1c;--tag-text:#c9e3a2;--on:#4a3418}}
:root[data-theme="dark"]{color-scheme:dark;--bg:#15130f;--surface:#201d17;--text:#efe9dc;--muted:#a39b8b;--line:#38332a;--accent:#e08a4a;--accent-text:#1a1208;--tag:#2c3a1c;--tag-text:#c9e3a2;--on:#4a3418}
*{box-sizing:border-box}
html{-webkit-text-size-adjust:100%}
body{margin:0;background:var(--bg);color:var(--text);font:16px/1.45 system-ui,-apple-system,"Segoe UI",Roboto,sans-serif;overflow-x:hidden}
main{max-width:760px;margin:0 auto;padding:0 16px 48px}
header{padding:20px 0 8px}
h1{font-size:1.5rem;margin:0 0 4px}
.lead{margin:0;color:var(--muted)}
.bar{position:sticky;top:0;z-index:5;background:var(--bg);border-bottom:1px solid var(--line);padding:10px 0;margin:8px 0 4px;display:grid;grid-template-columns:1fr auto;gap:8px 12px;align-items:center}
.bar label.vol{display:flex;align-items:center;gap:10px;min-height:44px}
.bar input[type=range]{flex:1;min-width:0;height:44px;accent-color:var(--accent)}
#volv{width:3.2em;text-align:right;color:var(--muted);font-variant-numeric:tabular-nums}
.bar .meta{grid-column:1/-1;display:flex;flex-wrap:wrap;gap:8px 12px;align-items:center}
#count{color:var(--muted)}
button{font:inherit;color:var(--text);background:var(--surface);border:1px solid var(--line);border-radius:10px;min-height:44px;padding:0 14px;cursor:pointer;touch-action:manipulation}
button:active{transform:translateY(1px)}
button.main{background:var(--accent);color:var(--accent-text);border-color:var(--accent);font-weight:600}
#copied{margin:6px 0 0;color:var(--muted);font-size:.9rem;overflow-wrap:anywhere;min-height:1.4em}
.voice{background:var(--surface);border:1px solid var(--line);border-radius:14px;padding:14px 12px 10px;margin:14px 0}
.voice h2{font-size:1.15rem;margin:0 0 2px}
.voice h2 code{font-size:.8rem;font-weight:400;color:var(--muted);margin-left:6px}
.desc{margin:0 0 10px;color:var(--muted);font-size:.95rem}
.rows{display:grid;gap:6px}
.row{display:grid;grid-template-columns:minmax(0,1fr) auto auto;gap:6px;align-items:stretch}
.row.proposal .play{border-color:var(--accent)}
.play{display:flex;align-items:center;gap:10px;text-align:left;min-width:0}
.play .nm{flex:1;min-width:0;overflow:hidden;text-overflow:ellipsis;white-space:nowrap}
.play .ic{color:var(--accent);width:1.2em;text-align:center}
.tag{font-size:.72rem;background:var(--tag);color:var(--tag-text);border-radius:6px;padding:2px 6px;white-space:nowrap}
.scene{min-width:64px}
button.on{background:var(--on)}
.pick{display:flex;align-items:center;gap:6px;min-height:44px;min-width:44px;padding:0 10px;border:1px solid var(--line);border-radius:10px;cursor:pointer;background:var(--surface)}
.pick input{width:22px;height:22px;margin:0;accent-color:var(--accent)}
.pick:has(input:checked){border-color:var(--accent);background:var(--on)}
@media (max-width:420px){.pick span{display:none}.scene{min-width:56px;padding:0 10px}}
footer{color:var(--muted);font-size:.85rem;margin-top:24px}
`;

const html = `<!doctype html>
<html lang="de">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1, viewport-fit=cover">
<title>Kampfklang Auswahl</title>
<style>${css}</style>
</head>
<body>
<main>
<header>
<h1>Kampfklänge</h1>
<p class="lead">Neun Stimmen der Kampfszenen. Pro Stimme: der Klang von heute und sechs neue. Auf die Titel tippen zum Hören, "Szene" spielt ihn im Zusammenhang, "Wahl" markiert deinen Favoriten. "Vorschlag" ist meine Empfehlung.</p>
</header>
<div class="bar">
<label class="vol">Lautstärke <input id="vol" type="range" min="0" max="100" value="80" aria-label="Lautstärke"><span id="volv">80 %</span></label>
<div class="meta"><span id="count"></span><button id="copy" class="main" type="button">Auswahl kopieren</button></div>
</div>
<p id="copied" aria-live="polite"></p>
<div id="voices"></div>
<footer>Alles wird im Browser erzeugt, keine Audiodateien. Der erste Tipp schaltet den Ton frei.</footer>
</main>
<script>${js.replace(/<\/script/g, '<\\/script')}</script>
</body>
</html>
`;
const file = join(OUT, 'index.html');
writeFileSync(file, html);
console.log(`wrote ${file} (${(html.length / 1024).toFixed(0)} KB)`);
