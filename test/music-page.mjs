// Background music in the real page: node test/music-page.mjs [--port=5404] [--base=http://...]
// Quiet before the first gesture; starts after it; Mute, the Music switch and a hidden tab stop it (and resume it); the sliders
// change and persist the settings; a sound effect ducks the music bus; German labels; no console error or warning.
// Exit codes: 0 pass, 1 a check failed.
import { reporter, launchBrowser, watchPage, startServer, build, sleep } from '../tools/_lib.mjs';
const args = process.argv.slice(2);
const PORT = Number((args.find((a) => a.startsWith('--port=')) || '--port=5404').slice(7));
const R = reporter();
const OUT = '.tmp/music-dist';
const BASE = (args.find((a) => a.startsWith('--base=')) || '').slice(7).replace(/\/$/, '');
if (!BASE && !args.includes('--skip-build')) build(OUT);
const server = BASE ? { stop() {} } : await startServer({ mode: 'preview', port: PORT, outDir: OUT });
const browser = await launchBrowser({ w: 1280, h: 720 });
try {
  const page = await browser.newPage();
  const w = await watchPage(page);
  const load = async (query = '', lang = 'en') => {
    await page.evaluateOnNewDocument((l) => { try { if (!sessionStorage.getItem('m')) { localStorage.clear(); sessionStorage.setItem('m', '1'); } localStorage.setItem('chess3d.lang', l); } catch (e) { /* ignore */ } }, lang);
    await page.goto(`${BASE || `http://127.0.0.1:${PORT}`}/?quality=low&manual=1&ai=0${query}`, { waitUntil: 'domcontentloaded', timeout: 120000 });
    await page.waitForFunction('window.__chessReady === true && !!window.__chess.step', { timeout: 120000 });
  };
  const ev = (fn, ...a) => page.evaluate(fn, ...a);
  const until = (fn, ms = 20000) => page.waitForFunction(fn, { timeout: ms }).then(() => true, () => false);
  await load();
  const m0 = await ev(() => { const m = window.__chess.music; return { has: !!m, state: m.state, ac: window.__chess.audio.ac === null, on: m.settings.on, box: !!document.querySelector('[data-settings="music"] [data-music-on]'), sliders: document.querySelectorAll('[data-settings="music"] input[type=range]').length, labels: [...document.querySelectorAll('[data-settings="music"] label')].map((l) => l.textContent.trim()) }; });
  R.expect('music exists, on by default, silent before a gesture, controls mounted', m0.has && m0.on && m0.ac && m0.state === 'idle' && m0.box && m0.sliders === 4, 'idle, 4 sliders and a switch', JSON.stringify(m0));
  R.expect('English labels: Volume, Tone, Tempo, Room', ['Volume', 'Tone', 'Tempo', 'Room'].every((l) => m0.labels.includes(l)), 'present', m0.labels.join('|'));
  const playing = () => ev(() => window.__chess.music.state === 'playing');
  await ev(() => { document.body.dispatchEvent(new PointerEvent('pointerdown', { bubbles: true })); window.dispatchEvent(new KeyboardEvent('keydown', { key: 'a' })); });
  R.expect('the music starts after the first gesture and schedules notes', await until(() => window.__chess.music.state === 'playing' && window.__chess.music.notes > 4, 30000), 'playing, notes scheduled', JSON.stringify(await ev(() => ({ s: window.__chess.music.state, n: window.__chess.music.notes, p: window.__chess.music.piece, ac: window.__chess.audio.ac && window.__chess.audio.ac.state }))));
  const notes = () => ev(() => window.__chess.music.notes);
  // Mute
  await ev(() => window.__chess.audio.setMuted(true));
  const n1 = await notes(); await sleep(1700);   // real time: a leaking scheduler would add notes within two ticks (TICK 800 ms)
  R.expect('Mute pauses the music, no new notes', (await ev(() => window.__chess.music.state)) === 'paused' && (await notes()) === n1, 'paused, flat', `${n1} -> ${await notes()}`);
  await ev(() => window.__chess.audio.setMuted(false));
  R.expect('unmuting resumes it', await until(() => window.__chess.music.state === 'playing' && window.__chess.music.notes > 0), 'playing again');
  // Music switch
  await ev(() => document.querySelector('[data-music-on]').click());
  const n2 = await notes(); await sleep(1700);   // real time: a leaking scheduler would add notes within two ticks (TICK 800 ms)
  const off = await ev(() => ({ s: window.__chess.music.state, on: window.__chess.music.settings.on, stored: JSON.parse(localStorage.getItem('chess3d.music') || '{}').on, dis: document.querySelector('#music-volume').disabled }));
  R.expect('the Music switch stops it, saves, greys the sliders', off.s === 'paused' && !off.on && off.stored === false && off.dis && (await notes()) === n2, 'paused, saved off', JSON.stringify(off));
  await ev(() => document.querySelector('[data-music-on]').click());
  R.expect('switching on starts it again', await until(() => window.__chess.music.state === 'playing' && !document.querySelector('#music-volume').disabled), 'playing');
  // hidden tab
  await ev(() => { Object.defineProperty(document, 'hidden', { configurable: true, get: () => true }); document.dispatchEvent(new Event('visibilitychange')); });
  const n3 = await notes(); await sleep(1700);   // real time, two scheduler ticks
  R.expect('a hidden tab pauses the music', (await ev(() => window.__chess.music.state)) === 'paused' && (await notes()) === n3, 'paused', `${n3} -> ${await notes()}`);
  await ev(() => { Object.defineProperty(document, 'hidden', { configurable: true, get: () => false }); document.dispatchEvent(new Event('visibilitychange')); });
  R.expect('a visible tab resumes it', await until(() => window.__chess.music.state === 'playing'), 'playing');
  // sliders and persistence
  const sl = await ev(() => {
    const set = (id, v) => { const i = document.querySelector(id); i.value = v; i.dispatchEvent(new Event('input', { bubbles: true })); };
    set('#music-volume', 55); set('#music-klang', 80); set('#music-tempo', 90); set('#music-room', 40);
    const s = window.__chess.music.settings, st = JSON.parse(localStorage.getItem('chess3d.music'));
    return { s: { ...s }, st, outs: [...document.querySelectorAll('.mrow output')].map((o) => o.textContent) };
  });
  R.expect('sliders change the settings (Klang runs bright to warm) and save them', Math.abs(sl.s.vol - 0.55) < 1e-9 && Math.abs(sl.s.klang - 0.2) < 1e-9 && Math.abs(sl.s.tempo - 0.9) < 1e-9 && Math.abs(sl.s.raum - 0.4) < 1e-9 && Math.abs(sl.st.tempo - 0.9) < 1e-9, 'vol .55 klang .2 tempo .9 raum .4', JSON.stringify(sl));
  R.expect('tempo output reads like 0.90x', sl.outs.includes('0.90x'), '0.90x', sl.outs.join(' '));
  // ducking
  const duck = await ev(async () => { const { audio, sfx } = window.__chess; sfx.play('capture'); const end = performance.now() + 1000; while (audio.bus.music.gain.value >= 0.85 && performance.now() < end) await new Promise((r) => requestAnimationFrame(() => r())); return audio.bus.music.gain.value; });
  R.expect('a sound effect ducks the music bus', duck < 0.85, 'gain below 0.85', String(duck));
  // reload: settings come back
  await load();
  const back = await ev(() => ({ ...window.__chess.music.settings, v: document.querySelector('#music-volume').value, t: document.querySelector('#music-tempo').value }));
  R.expect('settings are remembered per device', back.vol === 0.55 && back.tempo === 0.9 && back.v === '55' && back.t === '90', 'restored', JSON.stringify(back));
  // German
  await load('', 'de');
  const de = await ev(() => [...document.querySelectorAll('[data-settings="music"] label, [data-settings="music"] em')].map((l) => l.textContent.trim()));
  R.expect('German labels: Lautstärke, Klang, Tempo, Raum', ['Lautstärke', 'Klang', 'Tempo', 'Raum'].every((l) => de.includes(l)), 'present', de.join('|'));
  R.expect('no console errors or warnings', w.errs.length === 0 && w.warns.length === 0, 'clean', [...w.errs, ...w.warns].slice(0, 3).join(' | '));
  process.exitCode = R.summary().nf ? 1 : 0;
} finally { await browser.close(); server.stop(); }
