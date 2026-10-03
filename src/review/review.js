// Game review: look back at the finished game on the 3D board. A move strip under the board (mistakes orange, blunders red),
// back and forward, the gold arrow with one friendly sentence on a marked move, and a Details toggle (evaluation graph, best
// line, accuracy). The analysis is Hard's search in a Worker (engine.js), the strip fills in live.
//
// Steps: the cursor is { ply, suggest }. ply is the position on the board (0 the start, n after n moves). A marked move has an
// extra step in front of it, { ply: n - 1, suggest: true }: the board before the move, the gold arrow on the better move and the
// sentence. Forward from there plays the move that was really played. Everything else is one step per move.
//
// The game object is borrowed while the review is open: the computer is switched off, moves are refused, positions are set with
// loadFen / playMoves (instant). Closing the review plays the game back, so the board, the move list and the game over card
// are as they were.
import { Chess } from '../rules.js';
import { t, onLanguage, sanDisplay, translateTree } from '../i18n.js';
import { reviewGame, sentenceFacts } from './classify.js';
import { sentence } from './strings.js';
import { createEngine } from './engine.js';
import './review.css';

const el = (tag, cls, text) => {
  const e = document.createElement(tag);
  if (cls) e.className = cls;
  if (text != null) e.textContent = text;
  return e;
};
const sqName = (s) => 'abcdefgh'[s & 7] + ((s >> 3) + 1);
const MARKED = (k) => k === 'mistake' || k === 'blunder';

export function createReview({ game, hint, engine = null }) {
  const eng = engine || createEngine();
  const listeners = [];
  let active = false;
  let moves = [], fens = [], positions = [], result = null;
  let cursor = { ply: 0, suggest: false };
  let details = false;
  let saved = null;           // what the game looked like before: { vsComputer, computerColor, level, startFen, ucis }
  let internal = 0;           // > 0 while the review itself changes the game, so its events are not the player's
  let lineCache = new Map();  // fen -> SAN moves
  let analysed = 0;

  const emit = () => listeners.forEach((fn) => fn(state()));
  const marks = () => (result ? result.moves : []);
  const kindOf = (i) => marks()[i]?.kind || null;

  // the list of steps, from the marks known now
  function steps() {
    const list = [{ ply: 0, suggest: false }];
    for (let i = 0; i < moves.length; i++) {
      if (MARKED(kindOf(i))) list.push({ ply: i, suggest: true });
      list.push({ ply: i + 1, suggest: false });
    }
    return list;
  }
  const same = (a, b) => a.ply === b.ply && a.suggest === b.suggest;
  const index = () => Math.max(0, steps().findIndex((s) => same(s, cursor)));
  // the move this step is about (1 based), 0 at the start
  const moveNo = () => (cursor.suggest ? cursor.ply + 1 : cursor.ply);

  function facts() {
    const n = moveNo();
    if (!n) return null;
    const m = marks()[n - 1];
    if (!m || !MARKED(m.kind) || !m.bestMove) return null;
    const reply = positions[n];
    const f = sentenceFacts(fens[n - 1], moves[n - 1], m.bestMove, reply?.best || null, reply ? reply.score : 0);
    return { ...f, kind: m.kind };
  }

  function state() {
    const f = active ? facts() : null;
    const n = moveNo();
    return {
      active, ply: cursor.ply, suggest: cursor.suggest, details, total: moves.length, moveNo: n,
      analysed, done: analysed >= fens.length && fens.length > 0,
      kinds: moves.map((_, i) => kindOf(i)),
      marked: n && f ? f.kind : null,
      facts: f, text: f ? sentence(f) : '',
      evals: result ? result.evals : [], accuracy: result ? result.accuracy : { w: null, b: null },
      line: lineCache.get(fens[cursor.ply]) || null,
      index: index(), steps: steps().length,
    };
  }

  // ---- the board
  function show(target) {
    const ply = target.ply;
    const cur = game.getState();
    internal++;
    try {
      if (game.chess.fen() === fens[ply] && cur.fen === fens[ply]) { /* already there */ }
      else if (ply === cursor.ply + 1 && game.chess.fen() === fens[cursor.ply]) game.playMoves([sqName(moves[ply - 1].from) + sqName(moves[ply - 1].to) + (moves[ply - 1].promo || '')], { instant: true });
      else if (ply === cursor.ply - 1 && game.chess.history.length && game.chess.fen() === fens[cursor.ply]) game.undo();
      else game.loadFen(fens[ply]);
    } finally { internal--; }
    cursor = { ply, suggest: !!target.suggest };
    const f = facts();
    if (cursor.suggest && f) {
      const b = marks()[cursor.ply].bestMove;
      hint.show(b.from, b.to);
    } else hint.hide();
    wantLine();
    emit();
  }

  function wantLine() {
    if (!details) return;
    const fen = fens[cursor.ply];
    const p = positions[cursor.ply];
    if (!p || !p.best || lineCache.has(fen)) return;
    eng.line(fen, p.best, 5).then((san) => { lineCache.set(fen, san); if (active) emit(); });
  }

  // ---- the analysis
  function onPosition(i, r) {
    positions[i] = r;
    analysed = positions.filter(Boolean).length;
    result = reviewGame(positions, moves);
    // the arrow of a marked step waits for its numbers: stay on a step that exists
    if (cursor.suggest && !MARKED(kindOf(cursor.ply))) cursor = { ply: cursor.ply + 1, suggest: false };
    if (cursor.suggest) { const b = marks()[cursor.ply]?.bestMove; if (b) hint.show(b.from, b.to); }
    if (positions[cursor.ply]) wantLine();
    emit();
  }

  // ---- open and close
  function canOpen() { return !!game.chess.history.length; }
  function open({ at = 0 } = {}) {
    if (active || !canOpen()) return false;
    const live = game.chess;
    const c = new Chess(live.fen());
    c.history = live.history.slice();
    c.trackKeys = false;
    const mv = live.history.map((h) => ({ from: h.m.from, to: h.m.to, promo: h.m.promo || null, san: h.m.san, color: h.m.color }));
    while (c.history.length) c._unmake();
    const startFen = c.fen();
    const walk = new Chess(startFen);
    walk.trackKeys = false;
    const fl = [walk.fen()];
    for (const m of mv) { walk.play(m); fl.push(walk.fen()); }
    const st = game.getState();
    saved = { vsComputer: st.vsComputer, computerColor: st.computerColor, level: st.level, startFen, mode: game.mode };
    moves = mv; fens = fl; positions = new Array(fl.length).fill(null); result = reviewGame(positions, moves); analysed = 0;
    lineCache = new Map();
    active = true;
    details = false;
    const card = document.getElementById('banner');
    if (card) card.hidden = true;
    internal++;
    try {
      game.setVsComputer(false);
      game.setMoveGuard(() => false);
    } finally { internal--; }
    cursor = { ply: moves.length, suggest: false };
    show({ ply: Math.min(at, moves.length), suggest: false });
    eng.analyze(fens, { onPosition, onDone: () => emit() });
    return true;
  }

  function close({ restore = true } = {}) {
    if (!active) return;
    eng.cancel();
    hint.hide();
    active = false;
    internal++;
    try {
      game.setMoveGuard(null);
      if (restore) {
        game.loadFen(saved.startFen);
        game.playMoves(moves.map((m) => sqName(m.from) + sqName(m.to) + (m.promo || '')), { instant: true });
      }
      if (saved.vsComputer) game.setVsComputer(true, { color: saved.computerColor, level: saved.level || undefined });
    } finally { internal--; }
    emit();
  }

  // ---- stepping
  function go(i) {
    const list = steps();
    const s = list[Math.max(0, Math.min(list.length - 1, i))];
    if (s) show(s);
  }
  function goMove(n) {   // a strip chip or a graph point: move n (1 based), or 0 for the start
    if (!n) return show({ ply: 0, suggest: false });
    show({ ply: n - 1 + (MARKED(kindOf(n - 1)) ? 0 : 1), suggest: MARKED(kindOf(n - 1)) });
  }
  const next = () => go(index() + 1);
  const prev = () => go(index() - 1);
  function setDetails(on) { details = !!on; wantLine(); emit(); }

  // the player starts a new game or loads one: the review is over, nothing to restore
  game.on('newgame', () => { if (active && !internal) close({ restore: false }); });
  game.on('gameover', () => { if (active) { const b = document.getElementById('banner'); if (b) b.hidden = true; } });

  return {
    open, close, next, prev, go, goMove, setDetails, canOpen, state,
    on(fn) { listeners.push(fn); },
    get active() { return active; },
    get engine() { return eng; },
    get sanList() { return moves.map((m) => m.san); },
  };
}

// ---------------------------------------------------------------- the DOM
export function mountReview({ game, gimbal, createHint, engine = null, onInset = null, onMoves = null, host = null }) {
  const hint = createHint({ gimbal, persist: false });
  const review = createReview({ game, hint, engine });

  const root = el('section', 'rv');
  root.hidden = true;
  root.setAttribute('aria-label', 'Game review');
  root.setAttribute('data-i18n-aria', 'review.title');
  const msg = el('p', 'rv-msg');
  msg.setAttribute('role', 'status');
  const detailsBox = el('div', 'rv-details');
  detailsBox.hidden = true;
  const strip = el('div', 'rv-strip');
  strip.setAttribute('role', 'listbox');
  const ctl = el('div', 'rv-ctl');
  const mk = (cls, label, key, text) => {
    const b = el('button', 'btn rv-btn ' + cls, text);
    b.type = 'button';
    b.setAttribute('aria-label', label);
    b.setAttribute('data-i18n-aria', key);
    return b;
  };
  const bStart = mk('rv-start', 'To the start', 'review.start', '⏮');
  const bBack = mk('rv-back', 'One move back', 'review.back', '◀');
  const bFwd = mk('rv-fwd', 'One move forward', 'review.forward', '▶');
  const pos = el('span', 'rv-pos');
  const bDet = el('button', 'btn rv-btn rv-det toggle', 'Details');
  bDet.type = 'button';
  bDet.setAttribute('data-i18n', 'review.details');
  const bClose = mk('rv-close', 'Close', 'review.close', '✕');
  ctl.append(bStart, bBack, pos, bFwd, bDet, bClose);
  root.append(msg, detailsBox, strip, ctl);
  document.body.appendChild(root);
  // the strip floats over the bottom of the canvas: tell the camera how much, so the board frame stays above it (it follows the
  // strip's height: the message wraps, Details opens)
  const inset = () => onInset?.(root.hidden ? 0 : innerHeight - root.getBoundingClientRect().top + 8);
  if (onInset && window.ResizeObserver) new ResizeObserver(inset).observe(root);

  // the details: graph, best line, accuracy
  const SVGNS = 'http://www.w3.org/2000/svg';
  const graphWrap = el('div', 'rv-graph');
  const svg = document.createElementNS(SVGNS, 'svg');
  svg.setAttribute('viewBox', '0 0 300 70');
  svg.setAttribute('preserveAspectRatio', 'none');
  svg.setAttribute('role', 'img');
  svg.setAttribute('data-i18n-aria', 'review.graph');
  graphWrap.appendChild(svg);
  const graphLabel = el('div', 'rv-glabel');
  const lineBox = el('div', 'rv-line');
  const accBox = el('div', 'rv-acc');
  detailsBox.append(graphLabel, graphWrap, lineBox, accBox);

  const chips = [];
  function buildStrip(s) {
    strip.textContent = '';
    chips.length = 0;
    for (let i = 0; i < s.total; i++) {
      const wMove = i % 2 === 0;
      if (wMove) strip.appendChild(el('span', 'rv-no', String(i / 2 + 1) + '.'));
      const b = el('button', 'rv-chip');
      b.type = 'button';
      b.dataset.move = String(i + 1);
      b.setAttribute('role', 'option');
      b.addEventListener('click', () => review.goMove(i + 1));
      strip.appendChild(b);
      chips.push(b);
    }
  }
  let built = -1;
  const KIND_LABEL = { mistake: ['review.mistake', 'Mistake'], blunder: ['review.blunder', 'Blunder'] };

  function drawGraph(s) {
    svg.textContent = '';
    const n = s.evals.length;
    if (n < 2) return;
    const W = 300, H = 70, X = (i) => (n === 1 ? 0 : (i / (n - 1)) * W);
    const Y = (cp) => H / 2 - Math.tanh(cp / 450) * (H / 2 - 3);   // soft cap: a queen up and a mate both stay on the chart
    const known = s.evals.map((v, i) => (v == null ? null : [X(i), Y(v)])).filter(Boolean);
    const mid = document.createElementNS(SVGNS, 'line');
    mid.setAttribute('x1', 0); mid.setAttribute('x2', W); mid.setAttribute('y1', H / 2); mid.setAttribute('y2', H / 2); mid.setAttribute('class', 'rv-mid');
    svg.appendChild(mid);
    if (known.length) {
      const area = document.createElementNS(SVGNS, 'path');
      area.setAttribute('class', 'rv-area');
      area.setAttribute('d', `M${known[0][0]},${H / 2} ` + known.map((p) => `L${p[0].toFixed(1)},${p[1].toFixed(1)}`).join(' ') + ` L${known[known.length - 1][0]},${H / 2} Z`);
      svg.appendChild(area);
      const line = document.createElementNS(SVGNS, 'polyline');
      line.setAttribute('class', 'rv-evline');
      line.setAttribute('points', known.map((p) => p[0].toFixed(1) + ',' + p[1].toFixed(1)).join(' '));
      svg.appendChild(line);
    }
    s.kinds.forEach((k, i) => {
      if (!MARKED(k) || s.evals[i + 1] == null) return;
      const c = document.createElementNS(SVGNS, 'circle');
      c.setAttribute('cx', X(i + 1)); c.setAttribute('cy', Y(s.evals[i + 1])); c.setAttribute('r', 3); c.setAttribute('class', 'rv-dot ' + k);
      svg.appendChild(c);
    });
    const cur = document.createElementNS(SVGNS, 'line');
    cur.setAttribute('x1', X(s.ply)); cur.setAttribute('x2', X(s.ply)); cur.setAttribute('y1', 0); cur.setAttribute('y2', H); cur.setAttribute('class', 'rv-cur');
    svg.appendChild(cur);
  }
  // tap or drag on the graph jumps to the nearest position
  function graphAt(ev) {
    const r = graphWrap.getBoundingClientRect();
    const s = review.state();
    const n = s.evals.length;
    if (n < 2) return;
    const i = Math.round(((ev.clientX - r.left) / r.width) * (n - 1));
    const ply = Math.max(0, Math.min(n - 1, i));
    review.goMove(ply);
  }
  let dragging = false;
  graphWrap.addEventListener('pointerdown', (e) => { dragging = true; graphWrap.setPointerCapture?.(e.pointerId); graphAt(e); });
  graphWrap.addEventListener('pointermove', (e) => { if (dragging) graphAt(e); });
  const endDrag = () => { dragging = false; };
  graphWrap.addEventListener('pointerup', endDrag);
  graphWrap.addEventListener('pointercancel', endDrag);

  const pct = (v) => (v == null ? '-' : Math.round(v) + '%');

  // desktop: the Details box lives in the panel beside the board, so it never covers it; elsewhere it stays in the strip
  let wasActive = false, wasDetails = false;
  function placeDetails(s) {
    const slot = host?.slot() || null;
    if (slot) {
      slot.hidden = !(s.active && s.details);
      if (detailsBox.parentNode !== slot) slot.append(detailsBox);
    } else if (detailsBox.parentNode !== root) root.insertBefore(detailsBox, strip);
  }
  function render() {
    const s = review.state();
    root.hidden = !s.active;
    document.body.classList.toggle('reviewing', s.active);
    if (!s.active) {
      built = -1; wasActive = wasDetails = false;
      onMoves?.(null);
      placeDetails(s);
      inset();
      return;
    }
    if (!wasActive) host?.reveal();
    if (s.details && !wasDetails) host?.reveal({ unfold: true });
    wasActive = true; wasDetails = s.details;
    onMoves?.({ sans: review.sanList, kinds: s.kinds, cur: s.moveNo, pick: (n) => review.goMove(n) });
    placeDetails(s);
    if (built !== s.total) { buildStrip(s); built = s.total; }
    const sanList = review.sanList;
    s.kinds.forEach((k, i) => {
      const b = chips[i];
      b.textContent = sanDisplay(sanList[i]);
      b.className = 'rv-chip' + (MARKED(k) ? ' ' + k : '') + (k === null ? ' wait' : '') + (s.moveNo === i + 1 ? ' cur' : '');
      b.setAttribute('aria-selected', s.moveNo === i + 1 ? 'true' : 'false');
      if (MARKED(k)) b.title = t(KIND_LABEL[k][0], KIND_LABEL[k][1]);
    });
    const curChip = chips[s.moveNo - 1];
    if (curChip) { const l = curChip.offsetLeft, w = curChip.offsetWidth; if (l < strip.scrollLeft || l + w > strip.scrollLeft + strip.clientWidth) strip.scrollLeft = l - strip.clientWidth / 2 + w / 2; }
    pos.textContent = s.moveNo ? t('review.moveOf', 'Move {n} of {total}', { n: s.moveNo, total: s.total }) : t('review.startPos', 'Start');
    bStart.disabled = s.index === 0;
    bBack.disabled = s.index === 0;
    bFwd.disabled = s.index >= s.steps - 1;
    bDet.classList.toggle('on', s.details);
    bDet.setAttribute('aria-pressed', s.details ? 'true' : 'false');
    // message: the sentence of a marked move, else how far the analysis is
    msg.className = 'rv-msg' + (s.marked ? ' ' + s.marked : '');
    if (s.marked) {
      msg.textContent = '';
      const tag = el('b', 'rv-tag ' + s.marked, t(KIND_LABEL[s.marked][0], KIND_LABEL[s.marked][1]));
      msg.append(tag, ' ', s.text);
    } else if (!s.done) msg.textContent = t('review.analysing', 'Looking at the game: {n} of {total}', { n: s.analysed, total: s.total + 1 });
    else msg.textContent = t('review.ready', 'Analysis done');
    detailsBox.hidden = !s.details;
    if (s.details) {
      graphLabel.textContent = t('review.graph', 'Evaluation') + '  ·  ' + t('review.graphHint', 'Tap to jump');
      drawGraph(s);
      lineBox.textContent = '';
      lineBox.append(el('b', null, t('review.line', 'Best line') + ' '));
      const fen0 = s.line;
      lineBox.append(fen0 && fen0.length ? lineText(s, fen0) : t(s.ply >= s.total && s.done ? 'review.noLine' : 'review.waiting', s.ply >= s.total && s.done ? 'The game ends here.' : 'Not worked out yet'));
      accBox.textContent = '';
      accBox.append(el('b', null, t('review.accuracy', 'Accuracy') + ' '), t('review.white', 'White') + ' ' + pct(s.accuracy.w) + '  ·  ' + t('review.black', 'Black') + ' ' + pct(s.accuracy.b));
    }
  }
  // "12. Nf3 Nc6 13. Bb5": the move numbers follow the position the line starts from
  function lineText(s, sanMoves) {
    const startFull = Math.floor(s.ply / 2) + 1;
    let whiteFirst = s.ply % 2 === 0;
    const out = [];
    sanMoves.forEach((m, i) => {
      const white = whiteFirst ? i % 2 === 0 : i % 2 === 1;
      const no = startFull + Math.floor((i + (whiteFirst ? 0 : 1)) / 2);
      if (white) out.push(no + '.');
      else if (i === 0) out.push(no + '...');
      out.push(sanDisplay(m));
    });
    return out.join(' ');
  }

  bStart.addEventListener('click', () => review.goMove(0));
  bBack.addEventListener('click', () => review.prev());
  bFwd.addEventListener('click', () => review.next());
  bDet.addEventListener('click', () => review.setDetails(!review.state().details));
  bClose.addEventListener('click', () => review.close());
  window.addEventListener('keydown', (e) => {
    if (!review.active) return;
    if (e.key === 'ArrowLeft') { review.prev(); e.preventDefault(); }
    else if (e.key === 'ArrowRight') { review.next(); e.preventDefault(); }
    else if (e.key === 'Escape') { review.close(); e.preventDefault(); }
  });
  review.on(render);
  host?.on(() => { if (review.active) { placeDetails(review.state()); inset(); } });
  onLanguage(() => { translateTree(root); render(); });
  translateTree(root);

  // the button on the game over card, next to New game
  game.on('gameover', () => {
    if (review.active) return;
    const row = document.querySelector('#banner .banner-card .row');
    if (!row || row.querySelector('#bn-review-game')) return;
    const b = el('button', 'btn', t('review.button', 'Review the game'));
    b.id = 'bn-review-game';
    b.type = 'button';
    b.addEventListener('click', () => { document.getElementById('banner').hidden = true; review.open(); });
    row.insertBefore(b, row.children[1] || null);
  });
  return review;
}
