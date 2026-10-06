// Living pieces (CHE-238): in Blocks and Pixelwelt a piece plays a signature move (themes/blocks/moves.js) when nobody moves.
// After IDLE_FIRST seconds without a move or a piece pick one random piece of either colour (never the selected one) plays it, then
// the next one GAPS[0] seconds later and every GAPS[1] seconds after that, never two at once. Only a move or a piece pick starts the wait again. Paused during a move, a capture scene and with
// Symbols on. Never automatic with ?manual=1 or under automation (navigator.webdriver) unless ?living=1; ?living=0 turns it off for
// this load. The Options switch "Living pieces" is stored per browser like the other settings.
// ?sig=<piece>[.<square>] plays one move at once (test hook: sig=knight, sig=pawn.e2). In the Pixelwelt the birds (themes/pixel/birds.js)
// follow the same switch but keep their own timer.
import { translateTree, addDE } from './i18n.js';
import { playSignature } from './themes/blocks/rig.js';
import { TYPE_NAMES, moveOf } from './themes/blocks/moves.js';
import { living } from './living-state.js';

addDE({ 'living.label': 'Figuren-Leben' });

export const IDLE_FIRST = 15, GAPS = [10, 10];   // owner 2026-10-06: first show after 15 s, the next 10 s later, then every 10 s
const KEY = 'chess3d.living';
const readStored = () => { try { return localStorage.getItem(KEY) !== '0'; } catch (e) { return true; } };
const writeStored = (on) => { try { localStorage.setItem(KEY, on ? '1' : '0'); } catch (e) { /* storage blocked */ } };
const BY_NAME = Object.fromEntries(Object.entries(TYPE_NAMES).flatMap(([t, n]) => [[n, t], [t, t]]));

export function createLiving({ game, themes, views, ui, flags = {}, manual = false } = {}) {
  const flagOn = flags.living === '1', flagOff = flags.living === '0';
  const underTest = typeof navigator !== 'undefined' && navigator.webdriver;
  living.auto = flagOn || (!manual && !underTest && !flagOff);
  living.on = flagOff ? false : flagOn ? true : readStored();
  let idle = 0, wait = IDLE_FIRST, shows = 0, active = 0, clock = 0;   // seconds without input, the wait until the next show, seconds the running show still lasts
  const log = [];

  const isLiveTheme = () => { const id = themes?.current?.(); return id === 'blocks' || id === 'pixel'; };
  const paused = () => !isLiveTheme() || !!game.busy || !!views?.isSymbols?.();

  // the figures on the board (not the ones in a tray), each with its inner group, which is what the rig is keyed by
  function pieces() {
    const sel = game.getState?.().selected ?? null, out = [];
    for (const wrap of game.root.children) {
      const obj = wrap.children.find((c) => c.userData?.hit)?.userData.pieceObj;
      const inner = wrap.children[0];
      if (!obj || obj.sq < 0 || !wrap.visible || obj.trayTo) continue;
      const name = game.sqName(obj.sq);
      if (Math.abs(wrap.position.x) > 4 || Math.abs(wrap.position.z) > 4) continue;
      out.push({ obj, inner, name, selected: name === sel });
    }
    return out;
  }
  function start(piece) {
    const dur = playSignature(piece.inner);
    if (!dur) return 0;
    active = dur + 0.2;
    log.push({ type: piece.obj.type, color: piece.obj.color, square: piece.name, at: clock });
    return dur;
  }
  /** Plays one move on purpose ('pawn', 'knight.g1', or 'p'): returns its duration, 0 when nothing could play. */
  function play(spec, squareArg) {
    const [what, sq] = String(spec).split('.');
    const type = BY_NAME[what];
    if (!type || !moveOf(type)) return 0;
    const want = squareArg || sq;
    const list = pieces().filter((p) => p.obj.type === type && (!want || p.name === want));
    list.sort((a, b) => (a.obj.color === 'w' ? 0 : 1) - (b.obj.color === 'w' ? 0 : 1) || a.obj.sq - b.obj.sq);
    const piece = list.find((p) => p.obj.color === 'w' && !want) || list[0];
    return piece ? start(piece) : 0;
  }
  function fire() {
    const list = pieces().filter((p) => !p.selected);
    if (!list.length) return 0;
    const piece = list[Math.floor(living.rand() * list.length)];
    return start(piece);
  }
  function reset() { idle = 0; wait = IDLE_FIRST; shows = 0; }
  function tick(dt) {
    clock += dt;
    living.paused = paused();
    if (active > 0) active = Math.max(0, active - dt);
    if (!living.on || !living.auto || living.paused) return;
    idle += dt;
    if (idle < wait || active > 0) return;   // the gap runs from the start of a show; a running one is never joined by another
    if (fire()) { idle = 0; wait = GAPS[Math.min(shows++, GAPS.length - 1)]; } else idle = wait - 1;   // nothing to play: try again in a second
  }

  game.onMove(reset);
  game.onSelect?.(reset);   // only a move or a piece pick starts the wait again: camera drags, menu taps and keys do not

  // the Options switch, mounted like the trays one
  const row = document.createElement('label');
  row.className = 'switch';
  row.innerHTML = '<input type="checkbox" data-living><span class="track"><i></i></span><em data-i18n="living.label">Living pieces</em>';
  const box = row.querySelector('input');
  box.checked = living.on;
  const setOn = (on, { store = true } = {}) => { living.on = on; box.checked = on; if (store) writeStored(on); reset(); };
  box.addEventListener('change', () => setOn(box.checked));
  ui?.mountSettings?.('living', row);
  translateTree(row);

  const api = {
    tick, play, fire, reset, log, setOn,
    setAuto(on) { living.auto = !!on; reset(); },
    state: () => ({ on: living.on, auto: living.auto, paused: living.paused, idle, wait, active }),
    bird: (variant) => themes?.world?.birds?.play?.(variant) ?? 0,
    get element() { return row; },
  };
  // ?sig= plays at once (after the pieces stand); the birds module reads ?birds= itself
  if (flags.sig) setTimeout(() => play(flags.sig), 400);
  return api;
}
