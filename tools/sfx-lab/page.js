// The listening page (German UI). Built into one html file by tools/sfx-lab/build.mjs.
import { audio } from '../../src/audio.js';
import { VARIANTS } from './variants.js';
import { VOICE_NAMES, IDS, voiceFn } from './core.js';

const LABEL = { whoosh: 'Whoosh', swing: 'Hieb', clang: 'Klirren', slice: 'Schnitt', splat: 'Platscher', crack: 'Riss', shatter: 'Zersplittern', thud: 'Aufprall', magic: 'Zauber' };
// A short typical sequence per voice. Entries are [voice, seconds from the start, opts]: the voice under test is the variant, the others are today's.
const SCENE = {
  whoosh:  [['whoosh', 0], ['slice', 0.38], ['splat', 0.62]],
  swing:   [['swing', 0], ['swing', 0.28], ['clang', 0.5]],
  clang:   [['whoosh', 0], ['clang', 0.36], ['swing', 1.0], ['clang', 1.2, { pitch: 1.12 }]],
  slice:   [['whoosh', 0], ['slice', 0.38], ['splat', 0.6]],
  splat:   [['swing', 0], ['slice', 0.2], ['splat', 0.4], ['thud', 1.0, { volume: 0.7 }]],
  crack:   [['whoosh', 0], ['crack', 0.38], ['shatter', 0.46]],
  shatter: [['whoosh', 0], ['shatter', 0.38], ['thud', 1.3, { volume: 0.7 }]],
  thud:    [['whoosh', 0], ['thud', 0.36], ['thud', 0.9, { volume: 0.6, pitch: 1.2 }]],
  magic:   [['swing', 0], ['magic', 0.25], ['thud', 1.15, { volume: 0.6 }]],
};
const STORE = 'sfxlab.picks';

audio.muted = false;   // a sound page: the game's stored mute switch does not apply here
let volume = 0.8;
const picks = {};
window.__picks = picks;
try { Object.assign(picks, JSON.parse(localStorage.getItem(STORE) || '{}')); } catch (e) { /* no storage */ }

const $ = (s, el = document) => el.querySelector(s);
const el = (tag, cls, html) => { const n = document.createElement(tag); if (cls) n.className = cls; if (html != null) n.innerHTML = html; return n; };

function applyVolume() { if (audio.master) audio.master.gain.value = volume; }
async function ready() {
  await audio.unlock();
  applyVolume();
  return audio.ac && audio.ac.state === 'running';
}

let busyTimer = 0;
function flash(btn, secs) {
  btn.classList.add('on');
  setTimeout(() => btn.classList.remove('on'), Math.max(150, secs * 1000));
}

async function playOne(voice, id, btn) {
  if (!(await ready())) return;
  const len = audio.play(voiceFn(voice, id), { bus: 'scene', name: voice });
  if (len) flash(btn, len);
}
async function playScene(voice, id, btn) {
  if (!(await ready())) return;
  let end = 0;
  for (const [name, at, opts = {}] of SCENE[voice]) {
    const fn = name === voice ? voiceFn(voice, id) : voiceFn(name, 'heute');
    const len = audio.play(fn, { bus: 'scene', name, at, ...opts });
    if (len) end = Math.max(end, at + len);
  }
  flash(btn, end);
}

function summary() {
  return VOICE_NAMES.map((v) => `${v}=${picks[v] || '-'}`).join(', ');
}
function refresh() {
  const n = VOICE_NAMES.filter((v) => picks[v]).length;
  $('#count').textContent = `${n} von ${VOICE_NAMES.length} gewählt`;
  try { localStorage.setItem(STORE, JSON.stringify(picks)); } catch (e) { /* no storage */ }
}

function build() {
  const root = $('#voices');
  for (const v of VOICE_NAMES) {
    const d = VARIANTS[v];
    const sec = el('section', 'voice');
    sec.id = 'v-' + v;
    sec.innerHTML = `<h2>${LABEL[v]} <code>${v}</code></h2><p class="desc">${d.desc}</p>`;
    const list = el('div', 'rows');
    for (const id of IDS) {
      const name = id === 'heute' ? 'Heute' : `${id.toUpperCase()} ${d.variants[id].name}`;
      const row = el('div', 'row' + (id === d.proposal ? ' proposal' : ''));
      const play = el('button', 'play', `<span class="ic">▶</span><span class="nm">${name}</span>${id === d.proposal ? '<span class="tag">Vorschlag</span>' : ''}`);
      play.type = 'button';
      play.dataset.voice = v; play.dataset.id = id;
      play.addEventListener('click', () => playOne(v, id, play));
      const scene = el('button', 'scene', 'Szene');
      scene.type = 'button';
      scene.addEventListener('click', () => playScene(v, id, scene));
      const pick = el('label', 'pick', `<input type="radio" name="pick-${v}" value="${id}"><span>Wahl</span>`);
      const input = $('input', pick);
      input.checked = picks[v] === id;
      input.addEventListener('change', () => { picks[v] = id; refresh(); });
      row.append(play, scene, pick);
      list.append(row);
    }
    sec.append(list);
    root.append(sec);
  }
  const vol = $('#vol');
  vol.addEventListener('input', () => { volume = vol.value / 100; $('#volv').textContent = vol.value + ' %'; applyVolume(); });
  $('#copy').addEventListener('click', async () => {
    const text = summary();
    let ok = false;
    try { await navigator.clipboard.writeText(text); ok = true; } catch (e) {
      const ta = el('textarea'); ta.value = text; document.body.append(ta); ta.select();
      try { ok = document.execCommand('copy'); } catch (err) { /* blocked */ }
      ta.remove();
    }
    $('#copied').textContent = ok ? 'Kopiert: ' + text : 'Kopieren ging nicht, hier zum Abtippen: ' + text;
  });
  refresh();
}
build();
