// The background music: public domain piano pieces played by the synthesized piano (src/music/piano.js) as a quiet bed under the game.
//
//   const music = createMusic({ audio })     one per page; audio.onUnlock starts it after the first tap or key
//   music.settings                           { on, vol, klang, tempo, raum }, stored per device (localStorage, guarded)
//   music.set({ on, vol, klang, tempo, raum })   change and save; vol, klang and raum are 0 to 1, tempo about 0.8 to 1.1
//   music.onChange(fn)                       fn(settings) after every change
//   music.state                              'idle' | 'playing' | 'gap' | 'paused', with .piece (id) for tests and the settings UI
//   music.skip()                             next piece now
//   music.pieceSet, music.PIECE_IDS          the set this page plays ('a' or 'b') and its piece ids; `?musicset=a|b` picks it, for this load only
//
// Endless random playlist (every piece once per round, never the same twice in a row) with 4 to 8 s of silence between pieces.
// Notes are scheduled with the audio clock 2.5 s ahead by one 0.8 s timer: nothing runs per frame. It pauses while the tab is
// hidden, while Mute is on, and while the Music switch is off (pausing drops the piano, so no scheduled note leaks out later).
// Ducking is not done here: audio.play() dips audio.bus.music for every sound effect, the battle scenes keep it low.
import { device } from '../device.js';
import { createPiano, DEFAULT_KLANG, DEFAULT_RAUM } from './piano.js';
import { prepare } from './score.js';
import { SETS, chooseSet, setIds } from './pieces/index.js';
export { SETS, chooseSet };

export const TEMPO_MIN = 0.8, TEMPO_MAX = 1.1;
const STORE = 'chess3d.music';
const AHEAD = 2.5, TICK = 800;
const DEFAULTS = { on: true, vol: 0.3, klang: DEFAULT_KLANG, tempo: 1, raum: DEFAULT_RAUM };
const clamp = (v, a, b) => Math.max(a, Math.min(b, v));
const num = (v, d) => (Number.isFinite(+v) && v !== null && v !== '' ? +v : d);
const level = (vol) => 0.9 * clamp(vol, 0, 1) ** 1.6;   // slider position to bus gain: a gentle curve, 0.3 is a quiet bed

function load() {
  try {
    const v = JSON.parse(localStorage.getItem(STORE) || '{}');
    return normalise({ ...DEFAULTS, ...v });
  } catch (e) { return { ...DEFAULTS }; }
}
function normalise(s) {
  return { on: s.on !== false, vol: clamp(num(s.vol, DEFAULTS.vol), 0, 1), klang: clamp(num(s.klang, DEFAULTS.klang), 0, 1), tempo: clamp(num(s.tempo, 1), TEMPO_MIN, TEMPO_MAX), raum: clamp(num(s.raum, DEFAULTS.raum), 0, 1) };
}
function save(s) { try { localStorage.setItem(STORE, JSON.stringify(s)); } catch (e) { /* private window or blocked storage */ } }

export function createMusic({ audio, search = typeof location === 'undefined' ? '' : location.search }) {
  const settings = load();
  const pieceSet = chooseSet(new URLSearchParams(search).get('musicset')), PIECE_IDS = setIds(pieceSet);
  const listeners = [];
  let vol = null, piano = null;
  let piece = null, events = null, idx = 0, anchorQ = 0, anchorT = 0, endT = 0, resumeQ = 0;
  let timer = 0, gapUntil = 0, token = 0, loading = false, first = true;
  let playlist = [], lastId = '';
  const music = { settings, state: 'idle', piece: '', notes: 0, pieceSet, PIECE_IDS };   // notes: count of keys scheduled so far (tests)

  const spq = () => 60 / (piece.bpm * settings.tempo);
  const canPlay = () => settings.on && !audio.muted && !document.hidden && !!audio.ac && audio.ac.state === 'running';

  function nextId() {
    if (!playlist.length) {
      playlist = [...PIECE_IDS];
      for (let i = playlist.length - 1; i > 0; i--) { const j = Math.floor(Math.random() * (i + 1)); [playlist[i], playlist[j]] = [playlist[j], playlist[i]]; }
      if (playlist.length > 1 && playlist[playlist.length - 1] === lastId) playlist.unshift(playlist.pop());
    }
    return (lastId = playlist.pop());
  }

  function ensureGraph() {
    const ac = audio.ac;
    if (!vol) { vol = ac.createGain(); vol.gain.value = 0; vol.connect(audio.bus.music); }
    if (!piano) piano = createPiano(ac, vol, { lite: device.touch, klang: settings.klang, raum: settings.raum });
  }
  const rampTo = (secs) => { const g = vol.gain, now = audio.ac.currentTime; g.cancelScheduledValues(now); g.setValueAtTime(g.value, now); g.linearRampToValueAtTime(level(settings.vol), now + secs); };

  async function startPiece() {
    if (loading) return;
    loading = true;
    const mine = token;
    try {
      const mod = await SETS[pieceSet][nextId()]();
      if (mine !== token) return;
      piece = mod.default; events = prepare(piece); idx = 0; music.piece = piece.id;
      if (!canPlay()) { resumeQ = 0; music.state = 'paused'; return; }
      ensureGraph();
      anchorQ = 0; anchorT = audio.ac.currentTime + (first ? 1.5 : 0.4);
      endT = anchorT + piece.quarters * spq() + 3;
      music.state = 'playing';
    } catch (e) { piece = null; gapUntil = audio.ac.currentTime + 30; music.state = 'gap'; } finally { loading = false; }
  }

  function tick() {
    if (!canPlay()) return;
    const ac = audio.ac, now = ac.currentTime;
    if (!piece) { if (music.state !== 'gap' || now >= gapUntil) startPiece(); return; }
    if (music.state !== 'playing') return;
    const s = spq(), horizon = now + AHEAD;
    while (idx < events.length) {
      const e = events[idx], at = anchorT + (e.q - anchorQ) * s + e.roll;
      if (at > horizon) break;
      idx++;
      if (at >= now - 0.05) { music.notes++; piano.note(e.m, Math.max(at, now + 0.01), Math.max(0.12, e.hq * s + e.add), e.vel); }
    }
    if (idx >= events.length && now >= anchorT + (piece.quarters - anchorQ) * s + 3) {   // the last chord has died away
      piece = null; music.piece = ''; music.state = 'gap'; gapUntil = now + 4 + Math.random() * 4; first = false;
    }
  }

  const qNow = () => (piece ? anchorQ + Math.max(0, audio.ac.currentTime - anchorT) / spq() : 0);

  function start() {
    if (timer || !canPlay()) return;
    ensureGraph();
    if (piece && music.state === 'paused') {   // resume where it stopped
      anchorQ = resumeQ; anchorT = audio.ac.currentTime + 0.3;
      idx = events.findIndex((e) => e.q >= resumeQ); if (idx < 0) idx = events.length;
      music.state = 'playing';
    } else if (!piece) music.state = music.state === 'gap' ? 'gap' : 'idle';
    rampTo(first ? 5 : 0.8);
    timer = setInterval(tick, TICK);
    tick();
  }

  function pause() {
    if (!timer && music.state !== 'playing') return;
    clearInterval(timer); timer = 0; token++; loading = false;
    if (piece && music.state === 'playing') { resumeQ = qNow(); music.state = 'paused'; }
    const p = piano, v = vol, ac = audio.ac;
    piano = null;
    if (v && ac) { const now = ac.currentTime; v.gain.cancelScheduledValues(now); v.gain.setValueAtTime(v.gain.value, now); v.gain.linearRampToValueAtTime(0, now + 0.15); }
    if (p) setTimeout(() => p.dispose(), 250);   // after the fade: scheduled notes never sound again
  }

  function sync() { if (canPlay()) start(); else pause(); }

  function set(partial = {}) {
    const before = { ...settings };
    Object.assign(settings, normalise({ ...settings, ...partial }));
    save(settings);
    if (audio.ac && vol && settings.vol !== before.vol && timer) { const g = vol.gain, now = audio.ac.currentTime; g.cancelScheduledValues(now); g.setValueAtTime(g.value, now); g.linearRampToValueAtTime(level(settings.vol), now + 0.08); }
    if (piano && settings.klang !== before.klang) piano.setKlang(settings.klang);
    if (piano && settings.raum !== before.raum) piano.setRaum(settings.raum);
    if (piece && timer && music.state === 'playing' && settings.tempo !== before.tempo) {   // re-anchor so the position does not jump
      const old = 60 / (piece.bpm * before.tempo), now = audio.ac.currentTime;
      anchorQ += Math.max(0, now - anchorT) / old; anchorT = now;
      idx = events.findIndex((e) => e.q >= anchorQ); if (idx < 0) idx = events.length;
    }
    if (settings.on !== before.on) { if (settings.on) audio.unlock?.(); sync(); }
    listeners.forEach((fn) => fn({ ...settings }));
  }

  function skip() {
    if (!timer) return;
    piece = null; music.piece = ''; token++; loading = false; gapUntil = 0; music.state = 'gap';
    if (piano) { const p = piano; piano = null; const v = vol, now = audio.ac.currentTime; v.gain.cancelScheduledValues(now); v.gain.setValueAtTime(v.gain.value, now); v.gain.linearRampToValueAtTime(0, now + 0.12); setTimeout(() => { p.dispose(); if (timer) { ensureGraph(); rampTo(0.6); tick(); } }, 200); }
  }

  Object.defineProperty(music, 'playing', { get: () => !!timer && music.state === 'playing' });
  music.set = set;
  music.skip = skip;
  music.sync = sync;
  music.onChange = (fn) => { listeners.push(fn); };
  document.addEventListener('visibilitychange', sync);
  audio.onUnlock(() => { audio.ac.addEventListener?.('statechange', sync); sync(); });
  audio.onMute(sync);
  return music;
}
