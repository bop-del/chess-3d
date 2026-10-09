// Showcase mode (CHE-374, ?showcase=1 or ?showcase=trailer, ?showgame=<id>): the app plays a famous game by itself under a
// camera that glides as one unbroken flight. A title card over an establishing orbit, then every move with its own shot (dolly, crane, over the shoulder,
// bird's eye, hero arcs), the battle scenes on captures (their close-up is flown by the showcase camera), slow motion on
// the decisive moves and the mate, the move names in German and English as a lower third, an end card. A tap or a key ends
// it and the normal game comes back. It drives the real game (game.playSan), so every theme and piece set works with it.
//
// Hooks into the app (all undone by stop()): game.update and battle.update are wrapped to scale time (slow motion and the
// trailer's fast montage), the computer, Living pieces and Symbols are off, the HUD is hidden, the battle director's camera
// calls go to the showcase camera (camera.js).
import { createShowCamera, ease, SHOTS, squarePos } from './camera.js';
import { EXTRA_SHOTS } from './shots-extra.js';
Object.assign(SHOTS, EXTRA_SHOTS);   // pushin, reveal, lowtrack, whip, spiral
import { createOverlay } from './overlay.js';
import { gameById } from './games.js';
import { moveName, moveNumber, sanFor, titleLine } from './names.js';
import { i18n } from '../i18n.js';

const DEG = Math.PI / 180;
const TITLE = 5.2;            // seconds of the title card and the establishing orbit
const MONTAGE_SPEED = 6;      // the trailer plays the quiet part of the game this much faster
const TRAILER_QUIET = 1.8, TRAILER_FIGHT = 2.2;   // the trailer after the montage: quiet moves and minor captures run faster too
const SLOW = 0.3;             // time scale of a slow motion move
const MATE_HOLD = 6;          // the mate shot before the end card
const GLIDE = 1.5;            // seconds of the glide from one shot into the next (the camera never cuts: one unbroken flight)
const ROTATION = ['lowtrack', 'dolly', 'crane', 'reveal', 'over', 'dolly', 'top', 'lowtrack', 'crane', 'wide'];
const END_TEXT = {
  '1-0': { en: 'White wins with checkmate', de: 'Weiß gewinnt durch Schachmatt' },
  '0-1': { en: 'Black wins with checkmate', de: 'Schwarz gewinnt durch Schachmatt' },
};

export function startShowcase({ game, controls, stage, gimbal, battle, ui, views, living, themes, mode = '1', gameId = null, onEnd = null }) {
  // that glides from every shot into the next
  const data = gameById(gameId);
  const trailer = mode === 'trailer';
  // the trailer jumps over the quiet part: from a few plies before the first big moment the game plays at normal speed
  const firstBig = Math.min(...(data.key?.length ? data.key : [data.sans.length - 1]), ...(data.slow || []));
  const montageEnd = trailer ? Math.max(0, (data.trailerFrom ?? firstBig - 2)) : 0;
  const mateHold = trailer ? 4 : MATE_HOLD, titleDur = trailer ? 4.6 : TITLE;
  const lang = i18n.language === 'de' ? 'de' : 'en';

  // ---------------------------------------------------------------- take over the app
  const undo = [];
  // the game on the board when the showcase starts (from the menu, in the middle of a game) comes back exactly when it ends
  const saved = game.getState();
  game.setVsComputer(false);
  game.finishAnimations();
  game.newGame({ instant: true });
  if (views?.isSymbols?.()) { views.setSymbols(false, { remember: false }); undo.push(() => views.setSymbols(true, { remember: false })); }
  const livingWasOn = living?.state?.().on;
  if (living && livingWasOn) { living.setOn(false, { store: false }); undo.push(() => living.setOn(true, { store: false })); }
  const hud = document.getElementById('hud'), banner = document.getElementById('banner');
  const hudVis = hud?.style.visibility ?? '';
  if (hud) { hud.style.visibility = 'hidden'; undo.push(() => { hud.style.visibility = hudVis; }); }
  // the game's own toasts ('Check') stay quiet: the lower third says it
  const toastEl = document.getElementById('toast');
  if (toastEl) { const v = toastEl.style.visibility; toastEl.style.visibility = 'hidden'; undo.push(() => { toastEl.style.visibility = v; }); }
  // time scale: the game and the battle scenes run on scaled time
  let ts = 1, tsTarget = 1;   // the title runs in real time, the montage speeds up with the first ply
  const gUpdate = game.update, bUpdate = battle?.update;
  game.update = (dt) => gUpdate(dt * ts);
  undo.push(() => { game.update = gUpdate; });
  if (battle) { battle.update = (dt) => bUpdate(dt * ts); undo.push(() => { battle.update = bUpdate; }); }
  // no battle scene during the trailer's montage
  const hook = battle?.handler, hookEnabled = hook?.enabled;
  let montage = montageEnd > 0;
  if (hook && hookEnabled) { hook.enabled = () => !montage && hookEnabled(); undo.push(() => { hook.enabled = hookEnabled; }); }
  const camera = createShowCamera({ stage, gimbal, controls, pieces: () => game.root.children, world: () => themes?.world?.group || null });
  const overlay = createOverlay({ lang, look: themes?.current?.() === 'pixel' ? 'pixel' : 'classic' });

  // ---------------------------------------------------------------- the timeline
  // phase: 'title' -> per ply 'lead' (the shot starts) -> 'move' (until the game is not busy) -> 'hold' -> ... -> 'mate' -> 'end'
  const st = { phase: 'title', t: 0, ply: -1, running: true, rot: 0, side: 1, shots: [] };
  overlay.letterbox(true);
  overlay.title({ title: data.title, line: { en: titleLine(data, 'en'), de: titleLine(data, 'de') }, year: data.year });
  overlay.hint({ en: 'Tap to end', de: 'Tippen zum Beenden' });
  shot('establish', { dur: titleDur + 0.6 });

  function shot(kind, opts, how) { camera.play(kind, opts, how || (st.shots.length ? { glide: GLIDE } : undefined)); st.shots.push(kind); }
  const battleOn = () => !!hook && (!hookEnabled || hookEnabled()) && !montage;

  function plan(i) {
    const san = data.sans[i];
    const m = game.chess.moveFromSan(san);
    const color = i % 2 ? 'b' : 'w';
    const from = game.sqName(m.from), to = game.sqName(m.to);
    const fromX = (m.from & 7) - 3.5, fromZ = 3.5 - (m.from >> 3), toX = (m.to & 7) - 3.5, toZ = 3.5 - (m.to >> 3);
    const p = {
      san, from, to, color, fromX, fromZ, toX, toZ, capture: san.includes('x'), check: san.includes('+'), mate: san.includes('#'),
      key: (data.key || []).includes(i), slow: (data.slow || []).includes(i), note: data.notes?.[i] || null,
      lead: 0.45, hold: 0.55,
    };
    // the king this move checks (it does not move with the check, so the square before the move is right)
    if (p.check || p.mate) { const k = game.chess.kingSquare?.(color === 'w' ? 'b' : 'w'); if (k != null) p.king = game.sqName(k); }
    if (p.key || p.slow) { p.lead = 0.9; p.hold = trailer ? 0.9 : 1.3; }
    if (p.check) p.hold = Math.max(p.hold, 0.8);
    return p;
  }
  // the shot for a ply: montage plies share calm wide shots, big moments get hero arcs, the rest rotate through the list
  // the dolly's side: near an edge of the board the camera stands outside, looking in (the moving piece in front of the board)
  function dollySide(p) {
    const mx = (p.fromX + p.toX) / 2, mz = (p.fromZ + p.toZ) / 2;
    if (Math.max(Math.abs(mx), Math.abs(mz)) < 2.5) return st.side;
    const dx = p.toX - p.fromX, dz = p.toZ - p.fromZ;
    return (-dz * mx + dx * mz) >= 0 ? 1 : -1;
  }
  function shotFor(i, p) {
    const yawSide = p.color === 'w' ? 0 : Math.PI;
    if (i < montageEnd) {
      // the montage: a new angle every 5 plies, alternating a wide drift and a turning bird's eye, so a phone still follows it
      if (i % 5 === 0) {
        const n = i / 5;
        // white stays at the bottom in every angle, so the board never flips under a phone viewer
        if (n % 2) shot('top', { dur: 3, yaw: (n % 4 === 1 ? 0.25 : -0.25), pitch: 62 * DEG });
        else shot('wide', { dur: 3, yaw: n % 4 === 0 ? -0.5 : 0.5, drift: 0.3, pitch: 40 * DEG });
      }
      return;
    }
    // a check or the mate: push in from behind the attacker towards the king, both in frame
    if ((p.mate || p.check) && p.king && (p.slow || p.key || p.mate)) { shot('matepush', { at: p.king, from: p.to, dur: p.mate ? 3.6 : 3.2 }); st.rot++; return; }
    if (p.slow || (p.key && st.rot % 2 === 0)) {
      // the hero arc looks across the path of the move (the open board it crosses), from the mover's side
      const dx = p.toX - p.fromX, dz = p.toZ - p.fromZ;
      let yaw = Math.atan2(-dz, dx);
      if (Math.cos(yaw - yawSide) < 0) yaw += Math.PI;
      shot('hero', { at: p.to, yaw, dur: p.slow ? 2.6 : 3.2 }); st.rot++; return;
    }
    if (p.capture && battleOn()) { shot('dolly', { from: p.from, to: p.to, side: dollySide(p), dur: 2.2 }); st.side *= -1; return; }
    if (p.key) { shot('spiral', { at: p.to, dur: 3.6 }); st.rot++; return; }
    if (p.check && p.king) { shot('pushin', { at: p.king, from: p.to, dur: 2.6 }); return; }
    if (i < 8 && i % 2 === 1) return;          // the first moves: one shot for two plies
    const kind = ROTATION[st.rot++ % ROTATION.length];
    if (kind === 'wide') shot('wide', { yaw: yawSide + 0.45 * st.side, focus: squarePos(p.to) });
    else if (kind === 'top') shot('top', { at: p.to, yaw: yawSide });
    else if (kind === 'crane') shot('crane', { at: p.to, from: p.from });
    else if (kind === 'over') shot('over', { from: p.from, to: p.to, color: p.color });
    else if (kind === 'lowtrack') shot('lowtrack', { from: p.from, to: p.to, color: p.color });
    else if (kind === 'reveal') shot('reveal', { at: p.to, dur: 3 });
    else { shot('dolly', { from: p.from, to: p.to, side: dollySide(p) }); st.side *= -1; }
  }
  // the battle director sends the camera back: pull up and away from the fight over the capture square
  // after the mate the theme's checkmate finale (Pixelwelt, Wild) may borrow the camera the same way: back to the end orbit then
  camera.onRestore(() => {
    if (st.phase === 'move' && st.cur) shot('crane', { at: st.cur.to, from: st.cur.from, dur: 2.4 }, { glide: 0.6 });
    else if (st.phase === 'mate' || st.phase === 'end') shot('end', { yaw: 0.4 }, { glide: 1.2 });
  });

  function startPly(i) {
    st.ply = i; st.t = 0; st.phase = 'lead';
    if (montage && i >= montageEnd) montage = false;
    const p = st.cur = plan(i);
    shotFor(i, p);
    tsTarget = pace(p);
  }
  // the time scale of a ply: slow motion starts with the move itself (playMove), the lead in runs at the pace of the trailer
  function pace(p) {
    if (montage) return MONTAGE_SPEED;
    if (!trailer || p.slow) return 1;
    return p.capture ? TRAILER_FIGHT : p.key ? 1 : TRAILER_QUIET;
  }
  function playMove() {
    const p = st.cur, i = st.ply;
    if (p.slow) { tsTarget = p.mate && trailer ? 0.42 : SLOW; overlay.slow(true); }
    const rec = game.playSan(p.san);
    if (!rec) { console.warn('showcase: illegal move', p.san); return finishGame(); }
    if (st.shots.at(-1) === 'dolly') camera.track(rec.piece.group);   // the dolly keeps the moving piece in frame
    if (montage) overlay.clearLower();   // the fast montage has no names: they would flash by unread
    else overlay.lower({
      num: moveNumber(i), side: p.color, big: p.key || p.slow || p.mate, note: p.note,
      san: { en: sanFor(p.san, 'en'), de: sanFor(p.san, 'de') }, name: { en: moveName(p.san, 'en'), de: moveName(p.san, 'de') },
    });
    st.phase = 'move'; st.t = 0;
  }
  function finishGame() {
    st.phase = 'mate'; st.t = 0;
    tsTarget = trailer ? 1 : 0.75;   // the slow mate move is over: the camera leaves in calm, not slow, time
    const last = st.cur;
    const king = game.chess.kingSquare?.(game.chess.turn);
    shot('mate', { at: king != null ? game.sqName(king) : last.to, yaw: (last.color === 'w' ? 0 : Math.PI) + 0.4, dur: mateHold }, { glide: 0.5 });
  }
  function toEnd() {
    st.phase = 'end'; st.t = 0;
    tsTarget = 1; overlay.slow(false); overlay.clearLower(); overlay.hint(null);
    st.endCard = 0.45;   // the end card comes in once the lower third has gone (update)
    shot('end', { yaw: 0.4 }, { glide: 1.2 });
  }
  function showEndCard() {
    overlay.end({ result: data.result, text: END_TEXT[data.result] || { en: 'Game over', de: 'Partie vorbei' } });
  }

  function update(dt) {
    if (!st.running) return;
    ts += (tsTarget - ts) * (1 - Math.exp(-dt * (tsTarget < ts ? 9 : 4)));
    if (Math.abs(ts - tsTarget) < 0.01) ts = tsTarget;
    const sdt = dt * ts;
    st.t += sdt;
    if (st.phase === 'title') {
      if (st.t > titleDur - 1.5 && !st.titleOut) { st.titleOut = true; overlay.hideTitle(); }
      if (st.t >= titleDur) startPly(0);
    } else if (st.phase === 'lead') {
      if (st.t >= st.cur.lead) playMove();
    } else if (st.phase === 'move') {
      if (st.cur.mate && st.t > 0.75 && tsTarget < 1) tsTarget = 1;   // the bishop has landed: the king falls at normal pace
      if (!game.busy) {
        st.phase = 'hold'; st.t = 0;
        if (st.cur.slow && !st.cur.mate) tsTarget = pace({ ...st.cur, slow: false, key: false, capture: false });   // the slow move has landed: the hold runs at the normal pace
      }
    } else if (st.phase === 'hold') {
      if (st.t >= st.cur.hold) {
        if (st.cur.slow && !st.cur.mate) overlay.slow(false);
        if (st.ply + 1 < data.sans.length) startPly(st.ply + 1);
        else finishGame();
      }
    } else if (st.phase === 'end') {
      if (st.endCard > 0 && (st.endCard -= dt) <= 0) showEndCard();
    } else if (st.phase === 'mate') {
      if (st.t >= mateHold) toEnd();
    }
    camera.update(sdt, dt);
    overlay.update(dt);
  }

  // the gameover card of the normal game stays hidden: the end card is the showcase's own
  game.on('gameover', () => { if (st.running && banner) banner.hidden = true; });

  // a tap or a key ends the showcase (before the board or a battle scene sees it)
  const onInput = (e) => {
    if (e.type === 'keydown' && ['Shift', 'Control', 'Alt', 'Meta'].includes(e.key)) return;
    e.preventDefault(); e.stopImmediatePropagation();
    stop();
  };
  window.addEventListener('pointerdown', onInput, true);
  window.addEventListener('keydown', onInput, true);

  function stop() {
    if (!st.running) return;
    st.running = false; st.phase = 'stopped';
    window.removeEventListener('pointerdown', onInput, true);
    window.removeEventListener('keydown', onInput, true);
    try { battle?.skip(); } catch (e) { /* no scene running */ }
    game.finishAnimations();
    camera.dispose();
    overlay.dispose();
    for (const fn of undo.reverse()) { try { fn(); } catch (e) { console.warn('showcase: restore failed', e); } }
    if (banner) banner.hidden = true;
    restoreGame(saved);
    onEnd?.();
  }

  // the saved game: replayed from the start position move by move (undo keeps working); a game that did not start there
  // (a loaded position) gets its position back instead
  function restoreGame(g) {
    game.newGame({ instant: true });
    for (const san of g.moves) if (!game.playSan(san, { animate: false })) break;
    if (game.getState().fen !== g.fen) { try { game.loadFen(g.fen); } catch (e) { console.warn('showcase: position not restored', e); } }
    game.finishAnimations();
    game.setVsComputer(g.vsComputer, { color: g.computerColor, ...(g.level ? { level: g.level } : { depth: g.depth }) });
  }

  return {
    update, stop, camera, overlay, game: data,
    get state() { return { phase: st.phase, ply: st.ply, running: st.running, timeScale: ts, shot: camera.shot, shots: st.shots.slice(), montage, trailer }; },
  };
}
export { ease };
