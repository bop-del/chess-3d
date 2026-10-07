// Background music in the real page: node test/music-page.mjs [--port=5404] [--base=http://...]
// Quiet before the first gesture; starts after it; Mute, the Music switch and a hidden tab stop it (and resume it); the sliders
// change and persist the settings; a sound effect ducks the music bus; German labels; no console error or warning.
// ?musicset=a|b picks the pieces (no flag: set b, unknown: ignored, nothing stored), a piece is its own lazy chunk, and every piece of
// set b is rendered offline with the real piano (test/music-render.js): level, no clipping, no silence of 3 s inside the piece, nothing
// ringing on after the end, no click; --skip-render leaves that part out, --render-only runs just that part (CHE-305), a row per piece, a heartbeat every 15 s,
// MUSIC_RENDER_MS (240000) as its deadline. Exit codes: 0 pass, 1 a check failed.
import { createServer } from 'node:http';
import { readFileSync } from 'node:fs';
import { extname, join } from 'node:path';
import { reporter, launchBrowser, watchPage, startServer, build, sleep, ROOT } from '../tools/_lib.mjs';
import { SETS } from '../src/music/pieces/index.js';
const args = process.argv.slice(2);
const PORT = Number((args.find((a) => a.startsWith('--port=')) || '--port=5404').slice(7));
const RENDER_ONLY = args.includes('--render-only'), SKIP_RENDER = args.includes('--skip-render');   // the smoke groups `music` (--skip-render) and `music render` (--render-only), CHE-305
const R = reporter();
const OUT = '.tmp/music-dist';
const BASE = (args.find((a) => a.startsWith('--base=')) || '').slice(7).replace(/\/$/, '');
if (!BASE && !RENDER_ONLY && !args.includes('--skip-build')) build(OUT);
const server = BASE || RENDER_ONLY ? { stop() {} } : await startServer({ mode: 'preview', port: PORT, outDir: OUT });
const browser = await launchBrowser({ w: 1280, h: 720 });
try {
  const renderPieces = async () => {
    // every piece of set b rendered offline with the real piano: a small static server for the music modules, no game page
    const srv = createServer((q, r) => {
      const u = q.url.split('?')[0];
      if (u === '/favicon.ico') { r.statusCode = 204; return r.end(); }   // Chrome asks for it on a bare page: not a missing asset
      if (u === '/') { r.setHeader('content-type', 'text/html'); return r.end('<!doctype html><title>music render</title>'); }
      try { const b = readFileSync(join(ROOT, u.replace(/\.\./g, ''))); r.setHeader('content-type', extname(u) === '.js' ? 'text/javascript' : 'text/plain'); r.end(b); } catch (e) { r.statusCode = 404; r.end('not found'); }
    });
    await new Promise((ok) => srv.listen(0, '127.0.0.1', ok));
    const rp = await browser.newPage();
    const rerr = []; rp.on('pageerror', (e) => rerr.push(e.message)); rp.on('console', (m) => { if (m.type() === 'error') rerr.push(m.text()); });
    try {
      await rp.goto(`http://127.0.0.1:${srv.address().port}/`);
      const ids = Object.keys(SETS.b);   // all at once: the contexts render on their own threads (about 70 s instead of 200 s)
      const check = (id, r) => {
        const bad = [];
        if (!(r.peak > 0.05 && r.peak < 0.95)) bad.push(`peak ${r.peak.toFixed(2)} outside 0.05 to 0.95`);
        if (r.clipped > 0) bad.push(`${r.clipped} clipped samples`);
        if (r.silence >= 3) bad.push(`${r.silence.toFixed(1)} s of silence inside the piece`);
        if (r.tail > 4) bad.push(`sound ${r.tail.toFixed(1)} s after the end`);
        if (r.lastStart > r.seconds) bad.push('a note starts after the end');
        if (r.step > 0.45) bad.push(`click: step ${r.step.toFixed(2)} of the peak`);
        R.expect(`set b ${id}, rendered offline: peak ${r.peak.toFixed(2)}, longest silence ${r.silence.toFixed(1)} s, step ${r.step.toFixed(2)}`, bad.length === 0, 'no clipping, silence under 3 s, no click', bad.join('; '));
      };
      // CHE-305: a row per piece as it finishes, a heartbeat every 15 s (the runner kills a child silent for 60 s), a deadline that FAILs
      const RENDER_MS = Number(process.env.MUSIC_RENDER_MS || 240000), tr = Date.now(), pending = new Set(ids), results = {};
      const renders = ids.map((id) => rp.evaluate(async (id) => { const { renderPiece } = await import('/test/music-render.js'); const p = (await import(`/src/music/pieces/${id}.js`)).default; return renderPiece(p); }, id)
        .then((r) => { results[id] = r; pending.delete(id); check(id, r); }));
      const beat = setInterval(() => console.log(`music render: ${ids.length - pending.size} of ${ids.length} pieces done, ${Math.round((Date.now() - tr) / 1000)} s`), 15000);
      let timer;
      const late = new Promise((ok) => { timer = setTimeout(() => ok('late'), RENDER_MS); });
      const done = await Promise.race([Promise.all(renders).then(() => 'done'), late]);
      clearInterval(beat); clearTimeout(timer);
      renders.forEach((p) => p.catch(() => {}));   // a render still running when the deadline hits may reject once the browser closes
      if (done === 'late') R.fail(`set b offline render finished within ${RENDER_MS / 1000} s`, `still running after ${Math.round((Date.now() - tr) / 1000)} s: ${[...pending].join(', ')}`);
      const peaks = ids.filter((id) => results[id]).map((id) => results[id].peak);
      const lo = Math.min(...peaks), hi = Math.max(...peaks);
      if (done === 'done') R.expect('set b pieces are about equally loud (loudest peak at most 1.6 times the quietest)', hi / lo <= 1.6, 'ratio at most 1.6', `${lo.toFixed(2)} to ${hi.toFixed(2)}`);
      R.expect('the offline page logged no error', rerr.length === 0, 'clean', rerr.slice(0, 2).join(' | '));
    } finally { srv.close(); }
  };
  if (RENDER_ONLY) await renderPieces();
  else {
    const page = await browser.newPage();
    const w = await watchPage(page);
    const chunks = [];   // piece chunks requested by the page, by piece id (vite names a chunk <id>-<hash>.js)
    page.on('request', (rq) => { const id = [...Object.keys(SETS.a), ...Object.keys(SETS.b)].find((k) => rq.url().includes(`/assets/${k}-`)); if (id) chunks.push(id); });
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
    // ?musicset: the set for this load only
    const info = () => ev(() => ({ set: window.__chess.music.pieceSet, ids: window.__chess.music.PIECE_IDS, stored: Object.keys(localStorage).filter((k) => /musicset|pieceset/i.test(k) || /musicset|pieceset/i.test(localStorage.getItem(k) || '')) }));
    const gesture = () => ev(() => { document.body.dispatchEvent(new PointerEvent('pointerdown', { bubbles: true })); window.dispatchEvent(new KeyboardEvent('keydown', { key: 'a' })); });
    const A = Object.keys(SETS.a), B = Object.keys(SETS.b), same = (x, y) => x.length === y.length && x.every((v, i) => v === y[i]);
    for (const [q, want, label] of [['&musicset=a', 'a', 'musicset=a'], ['&musicset=b', 'b', 'musicset=b'], ['', 'b', 'no flag'], ['&musicset=zzz', 'b', 'an unknown value'], ['&musicset=', 'b', 'an empty value'], ['&musicset=A', 'a', 'a capital letter']]) {
      await load(q);
      const i = await info();
      R.expect(`${label}: the player has set ${want} (${want === 'a' ? 'today\'s five' : 'the calm set'}), nothing stored`, i.set === want && same(i.ids, want === 'a' ? A : B) && i.stored.length === 0, `set ${want}`, JSON.stringify(i));
    }
    for (const [q, set, label] of [['&musicset=a', A, 'set a'], ['', B, 'the default set b']]) {
      await load(q);
      chunks.length = 0;
      const before = chunks.length;
      await gesture();
      const ok = await until(() => window.__chess.music.state === 'playing' && window.__chess.music.notes > 4, 30000);
      const got = await ev(() => window.__chess.music.piece);
      R.expect(`${label}: the first piece played belongs to it and is its own lazy chunk (no other piece loaded)`, ok && set.includes(got) && before === 0 && chunks.length === 1 && chunks[0] === got, `${set.join('|')} one chunk`, `${got} chunks ${chunks.join(',') || 'none'}`);
    }
    await load('&musicset=a');
    const ls = await ev(() => JSON.stringify(Object.fromEntries(Object.keys(localStorage).map((k) => [k, localStorage.getItem(k)]))));
    R.expect('the set is for this load only: no storage key or value names it', !/musicset|pieceset/i.test(ls), 'none', ls.slice(0, 120));
    await load();
    R.expect('the next load without the flag is back on set b', (await info()).set === 'b', 'b');
    // German
    await load('', 'de');
    const de = await ev(() => [...document.querySelectorAll('[data-settings="music"] label, [data-settings="music"] em')].map((l) => l.textContent.trim()));
    R.expect('German labels: Lautstärke, Klang, Tempo, Raum', ['Lautstärke', 'Klang', 'Tempo', 'Raum'].every((l) => de.includes(l)), 'present', de.join('|'));
    if (!SKIP_RENDER) await renderPieces();
    // ?sound=0 (CHE-240): muted for this load only, nothing stored, music stays quiet after a gesture, the switch turns it on
    await load('&sound=0');
    await ev(() => { document.body.dispatchEvent(new PointerEvent('pointerdown', { bubbles: true })); window.dispatchEvent(new KeyboardEvent('keydown', { key: 'a' })); });
    await sleep(1700);
    const s0 = await ev(() => ({ muted: window.__chess.audio.muted, stored: localStorage.getItem('chess3d.muted'), state: window.__chess.music.state, notes: window.__chess.music.notes, box: document.querySelector('[data-audio-mute]')?.checked }));
    R.expect('?sound=0 mutes music and effects for this load, stores nothing, the switch shows it', s0.muted === true && s0.stored !== '1' && s0.state !== 'playing' && s0.notes === 0 && s0.box === true, 'muted, no notes, nothing stored', JSON.stringify(s0));
    await ev(() => window.__chess.audio.setMuted(false));
    R.expect('with ?sound=0 the player can still turn sound on', await until(() => window.__chess.music.state === 'playing' && window.__chess.music.notes > 0, 30000), 'playing after unmuting');
    R.expect('no console errors or warnings', w.errs.length === 0 && w.warns.length === 0, 'clean', [...w.errs, ...w.warns].slice(0, 3).join(' | '));
  }
  process.exitCode = R.summary().nf ? 1 : 0;
} finally { await browser.close(); server.stop(); }
