// HUD: glass panels, move list, captured pieces, sliders, presets, menus, banners.
// On phones (device.phone) the same cards are moved into a bottom sheet (Menu) and a status line plus a thumb bar are added,
// see buildPhone() at the end of createUI. Desktop and tablets keep the columns.
import { device } from './device.js';
import './learn/strings.js';
import { t, setLanguage, onLanguage, translateTree, sanDisplay, i18n } from './i18n.js';
const GLYPH = { k: '♚', q: '♛', r: '♜', b: '♝', n: '♞', p: '♟' };
const g = (t) => GLYPH[t] + '︎';
const VAL = { q: 9, r: 5, b: 3, n: 3, p: 1, k: 0 };
const PHONE_KEYS = [
  ['phone.tapPiece', 'Tap a piece', 'Select it, then tap a square'], ['phone.drag', 'Drag', 'Orbit camera'],
  ['phone.two', 'Two fingers', 'Pinch to zoom'], ['phone.undo', 'Undo', 'Take back a move'],
  ['phone.flip', 'Flip', 'View from the other side'], ['phone.views', 'Views', 'Cycle the camera views'],
];
const ICON = {
  undo: '<path d="M9 14 4 9l5-5"/><path d="M4 9h10.5a5.5 5.5 0 0 1 0 11H11"/>',
  new: '<path d="M12 5v14M5 12h14"/>',
  flip: '<path d="M8 20V6M4 10l4-4 4 4"/><path d="M16 4v14M12 14l4 4 4-4"/>',
  views: '<path d="M2 12s4-7 10-7 10 7 10 7-4 7-10 7S2 12 2 12z"/><circle cx="12" cy="12" r="3"/>',
  learn: '<path d="M4 5.5C4 4.7 4.7 4 5.5 4H11v15H5.5A1.5 1.5 0 0 0 4 20.5z"/><path d="M20 5.5c0-.8-.7-1.5-1.5-1.5H13v15h5.5a1.5 1.5 0 0 1 1.5 1.5z"/>',
  menu: '<path d="M4 7h16M4 12h16M4 17h16"/>',
  good: '<path d="M9 18h6M10 21h4"/><path d="M12 3a6 6 0 0 0-3.5 10.9c.6.5 1 1.2 1 2v.1h5v-.1c0-.8.4-1.5 1-2A6 6 0 0 0 12 3z"/>',
};
const PIECE_NAME = { q: 'Queen', r: 'Rook', b: 'Bishop', n: 'Knight' };
const pieceName = (p) => t(`piece.${p}`, PIECE_NAME[p]);

const KEYS = [
  ['key.drag', 'Drag', 'Orbit camera'], ['key.shiftDrag', 'Shift + drag / right drag', 'Rotate board'], ['key.wheel', 'Wheel / pinch', 'Zoom'],
  ['key.qe', 'Q / E', 'Board roll (Z)'], ['key.ws', 'W / S', 'Board pitch (X)'], ['key.ad', 'A / D', 'Board yaw (Y)'],
  ['key.arrows', 'Arrow keys', 'Orbit camera'], ['key.plusMinus', '+ / -', 'Zoom'], ['key.r', 'R', 'Reset view'], ['key.f', 'F', 'Flip to other side'],
  ['key.v', 'V', 'Top down'], ['key.1to5', '1 to 5', 'View presets'], ['key.space', 'Space', 'Auto spin'], ['key.u', 'U', 'Undo'],
  ['key.n', 'N', 'New game'], ['key.h', 'H', 'Hide / show HUD'],
];
const keyRows = (rows) => rows.map(([k, kf, df]) => `<dt>${t(k, kf)}</dt><dd>${t(k + 'D', df)}</dd>`).join('');

function el(tag, cls, html) {
  const e = document.createElement(tag);
  if (cls) e.className = cls;
  if (html != null) e.innerHTML = html;
  return e;
}

export function createUI({ game, controls, stage, quality = 'high', views }) {
  const hud = document.getElementById('hud');
  hud.innerHTML = '';

  // ------------------------------------------------------------ left column
  const left = el('aside', 'col left');
  left.innerHTML = `
    <section class="card brand">
      <div class="brand-row">
        <div class="logo" aria-hidden="true">${g('n')}</div>
        <div><h1 data-i18n="hud.title">Chess 3D</h1><p class="sub" data-i18n="hud.sub">Studio edition</p></div>
        <button class="icon-btn" id="btn-hide" title="Hide HUD (H)" aria-label="Hide HUD" data-i18n-title="hud.hide" data-i18n-aria="hud.hideLabel">&#x2715;</button>
      </div>
      <div class="lang" role="group" aria-label="Language" data-i18n-aria="lang.label"><button class="lang-btn" data-lang="en" aria-label="English">EN</button><button class="lang-btn" data-lang="de" aria-label="Deutsch">DE</button></div>
      <div class="turn" id="turn"><i class="dot w"></i><div><b id="turn-main">White to move</b><small id="turn-sub">&nbsp;</small></div></div>
    </section>

    <div class="tools" id="tools">
    <section class="card" data-card="view">
      <header><h2 data-i18n="hud.view">View</h2><span class="chev"></span></header>
      <div class="body">
        <div class="presets" id="presets"></div>
        <label class="switch lockrow" title="Stop all camera gestures; taps still move pieces" data-i18n-title="hud.lockTitle"><input type="checkbox" id="chk-lock"><span class="track"><i></i></span><em data-i18n="hud.lockView">Lock view</em></label>
        <div class="row three">
          <button class="btn" id="btn-flip" title="Flip to the other side (F)" data-i18n="hud.flip" data-i18n-title="hud.flipTitle">Flip</button>
          <button class="btn toggle" id="btn-spin" title="Auto spin (Space)" data-i18n="hud.spin" data-i18n-title="hud.spinTitle">Spin</button>
          <button class="btn" id="btn-reset" title="Reset view (R)" data-i18n="hud.reset" data-i18n-title="hud.resetTitle">Reset</button>
        </div>
      </div>
    </section>

    <section class="card" data-card="gimbal">
      <header><h2 data-i18n="hud.gimbal">Board gimbal</h2><span class="chev"></span></header>
      <div class="body sliders" id="sliders"></div>
    </section>

    <section class="card" data-card="scene">
      <header><h2 data-i18n="hud.scene">Scene</h2><span class="chev"></span></header>
      <div class="body">
        <label class="field"><span data-i18n="hud.lighting">Lighting</span><select id="sel-light"></select></label>
        <label class="field"><span data-i18n="hud.quality">Quality</span><select id="sel-quality">
          <option value="low" data-i18n="hud.low">Low</option><option value="medium" data-i18n="hud.medium">Medium</option><option value="high" data-i18n="hud.high">High</option></select></label>
      </div>
    </section>
    </div>`;

  // ------------------------------------------------------------ right column
  const right = el('aside', 'col right');
  right.innerHTML = `
    <section class="card" data-card="game">
      <header><h2 data-i18n="hud.game">Game</h2><span class="chev"></span></header>
      <div class="body">
        <div class="row three">
          <button class="btn primary" id="btn-new" title="New game (N)" data-i18n="hud.newGame" data-i18n-title="hud.newGameTitle">New game</button>
          <button class="btn" id="btn-undo" title="Undo (U)" data-i18n="hud.undo" data-i18n-title="hud.undoTitle">Undo</button>
          <button class="btn" id="btn-help" title="Keyboard shortcuts (?)" data-i18n="hud.keys" data-i18n-title="hud.keysTitle">Keys</button>
        </div>
        <div class="row good">
          <button class="btn" id="btn-good" title="Show one good move" data-i18n-title="good.title"><svg viewBox="0 0 24 24" aria-hidden="true">${ICON.good}</svg><span data-i18n="good.label">Good move?</span></button>
        </div>
        <div class="row ai">
          <label class="switch"><input type="checkbox" id="chk-ai"><span class="track"><i></i></span><em data-i18n="hud.vsComputer">vs computer</em></label>
          <select id="sel-ai-color" title="Your side" data-i18n-title="hud.yourSide"><option value="w" data-i18n="hud.playWhite">Play white</option><option value="b" data-i18n="hud.playBlack">Play black</option></select>
          <select id="sel-ai-level" title="Strength" data-i18n-title="hud.strength"><option value="novice" data-i18n="hud.novice">Novice ~700</option><option value="easy" data-i18n="hud.easy">Easy ~900</option><option value="normal" data-i18n="hud.normal">Normal ~1200</option><option value="hard" data-i18n="hud.hard">Hard ~1450</option></select>
        </div>
      </div>
    </section>

    <section class="card grow" data-card="moves">
      <header><h2 data-i18n="hud.moves">Moves</h2><span class="chev"></span></header>
      <div class="body">
        <ol class="moves" id="moves"></ol>
      </div>
    </section>

    <section class="card" data-card="captured">
      <header><h2 data-i18n="hud.captured">Captured</h2><span class="chev"></span></header>
      <div class="body">
        <div class="cap"><span class="who" data-i18n="hud.byWhite">By white</span><span class="glyphs b" id="cap-b"></span><span class="adv" id="adv-w"></span></div>
        <div class="cap"><span class="who" data-i18n="hud.byBlack">By black</span><span class="glyphs w" id="cap-w"></span><span class="adv" id="adv-b"></span></div>
      </div>
    </section>`;

  const help = el('div', 'help card');
  help.hidden = true;
  help.innerHTML = `<header><h2 data-i18n="hud.keyboardMouse">Keyboard and mouse</h2></header><dl id="help-keys">${keyRows(KEYS)}</dl>`;

  const showBtn = el('button', 'show-btn', 'Show HUD');
  showBtn.dataset.i18n = 'hud.show';
  showBtn.hidden = true;
  const drawerBtn = el('button', 'drawer-btn', 'Controls');
  drawerBtn.dataset.i18n = 'hud.controls';

  hud.append(left, right, help, showBtn, drawerBtn);

  const $ = (sel, root = hud) => root.querySelector(sel);

  // ------------------------------------------------------------ collapsible cards
  const narrow = () => window.matchMedia('(max-width: 900px)').matches;
  if (!device.phone) hud.querySelectorAll('.card[data-card] > header').forEach((h) => {
    h.addEventListener('click', () => h.parentElement.classList.toggle('collapsed'));
  });
  if (narrow() && !device.phone) right.querySelectorAll('.card[data-card]').forEach((c) => { if (c.dataset.card !== 'game') c.classList.add('collapsed'); });
  drawerBtn.addEventListener('click', () => { $('#tools').style.bottom = `${right.offsetHeight + 20}px`; left.classList.toggle('open'); drawerBtn.classList.toggle('on', left.classList.contains('open')); });
  // expose toolbox on narrow screens as a sheet

  let phoneUI = null;   // set by buildPhone() on phones

  // ------------------------------------------------------------ presets and view buttons
  const presetBox = $('#presets');
  const buildViewButtons = () => {
    presetBox.textContent = '';
    for (const v of views.list()) {
      const b = el('button', 'btn preset', t(`preset.${v.label}`, v.label));
      b.dataset.preset = v.label;
      b.dataset.view = v.id;
      b.addEventListener('click', () => views.set(v.id));
      presetBox.append(b);
    }
    markView();
  };
  const markView = () => presetBox.querySelectorAll('[data-view]').forEach((b) => b.classList.toggle('on', b.dataset.view === views.current()));
  views.on(() => { buildViewButtons(); });
  buildViewButtons();
  $('#btn-flip').addEventListener('click', () => controls.flip());
  $('#btn-reset').addEventListener('click', () => controls.reset());
  $('#btn-spin').addEventListener('click', () => controls.toggleSpin());

  // Lock view (touch only, the row is hidden by CSS otherwise): stops orbit, pinch, twist and wheel. Remembered per device.
  const chkLock = $('#chk-lock');
  try { chkLock.checked = localStorage.getItem('chess3d.lockView') === '1'; } catch (e) { /* storage blocked */ }
  const applyLock = () => controls.setLocked?.(chkLock.checked);
  chkLock.addEventListener('change', () => {
    applyLock();
    try { localStorage.setItem('chess3d.lockView', chkLock.checked ? '1' : '0'); } catch (e) { /* storage blocked */ }
  });
  if (device.touch) applyLock();

  // ------------------------------------------------------------ gimbal sliders
  const sliderBox = $('#sliders');
  const AXES = [['x', 'X', 'pitch'], ['y', 'Y', 'yaw'], ['z', 'Z', 'roll']];
  const sliders = {};
  for (const [axis, label, hint] of AXES) {
    const row = el('div', 'slider');
    row.innerHTML = `<label for="sl-${axis}"><b>${label}</b><span data-i18n="hud.${hint}">${hint}</span></label>
      <input type="range" id="sl-${axis}" min="-180" max="180" step="1" value="0">
      <output id="out-${axis}">0&deg;</output>`;
    sliderBox.append(row);
    const input = row.querySelector('input'), out = row.querySelector('output');
    sliders[axis] = { input, out, sliding: false };
    input.addEventListener('pointerdown', () => { sliders[axis].sliding = true; });
    window.addEventListener('pointerup', () => { sliders[axis].sliding = false; });
    input.addEventListener('input', () => { controls.setGimbal(axis, +input.value); out.innerHTML = `${input.value}&deg;`; });
    input.addEventListener('dblclick', () => { controls.setGimbal(axis, 0); });
    input.addEventListener('keydown', (e) => e.stopPropagation());
  }
  const resetG = el('button', 'btn small', 'Level board');
  resetG.dataset.i18n = 'hud.levelBoard';
  resetG.addEventListener('click', () => controls.levelBoard());
  sliderBox.append(resetG);

  // ------------------------------------------------------------ scene selects
  const selLight = $('#sel-light'), selQuality = $('#sel-quality');
  const presets = stage.lightingPresets || [];
  for (const n of presets) selLight.append(new Option(t(`light.${n}`, n), n));
  selLight.parentElement.hidden = !presets.length;
  selLight.addEventListener('change', () => stage.setLightingPreset?.(selLight.value));
  selQuality.value = quality;
  selQuality.addEventListener('change', () => stage.setQuality?.(selQuality.value));

  // ------------------------------------------------------------ game buttons
  $('#btn-new').addEventListener('click', () => { game.newGame(); hideBanner(); });
  $('#btn-undo').addEventListener('click', () => { game.undo(); hideBanner(); });
  $('#btn-help').addEventListener('click', toggleHelp);
  const storeLevel = (v) => { try { localStorage.setItem('chess3d.level', v); } catch (e) { /* storage may be blocked */ } };
  // "Good move?" helper (src/goodmove.js, bound from main.js): the desktop button and the phone bulb do the same thing
  let goodMove = null, goodKey = '';
  const goodBtns = [$('#btn-good')];
  function syncGood() {
    if (!goodMove) return;
    const think = goodMove.state() === 'thinking', can = goodMove.canAsk();
    const key = `${think}|${can}|${goodMove.state()}`;
    if (key === goodKey) return;
    goodKey = key;
    for (const b of goodBtns) {
      b.disabled = !can;
      b.classList.toggle('think', think);
      b.classList.toggle('on', goodMove.state() === 'showing');
      b.setAttribute('aria-busy', think ? 'true' : 'false');
    }
  }
  function bindGoodMove(gm) {
    goodMove = gm;
    for (const b of goodBtns) b.addEventListener('click', () => gm.ask());
    gm.on(syncGood);
    syncGood();
  }
  const chkAi = $('#chk-ai'), selAiColor = $('#sel-ai-color'), selAiLevel = $('#sel-ai-level');
  function applyAi() {
    const human = selAiColor.value;
    game.setVsComputer(chkAi.checked, { color: human === 'w' ? 'b' : 'w', level: selAiLevel.value });
    if (chkAi.checked) controls.setPreset(human === 'w' ? 'White view' : 'Black view');
  }
  chkAi.addEventListener('change', applyAi);
  selAiColor.addEventListener('change', () => { if (chkAi.checked) applyAi(); });
  selAiLevel.addEventListener('change', () => { storeLevel(selAiLevel.value); if (chkAi.checked) applyAi(); });

  // ------------------------------------------------------------ hud visibility / help
  function toggleHud(force) {
    const hide = force ?? !hud.classList.contains('hidden');
    hud.classList.toggle('hidden', hide);
    showBtn.hidden = !hide;
    if (hide) { help.hidden = true; phoneUI?.close(); }
    phoneUI?.frame();
  }
  function toggleHelp() { if (phoneUI) phoneUI.toggleHelp(); else help.hidden = !help.hidden; }
  $('#btn-hide').addEventListener('click', () => toggleHud(true));
  showBtn.addEventListener('click', () => toggleHud(false));
  controls.hooks.undo = () => { game.undo(); hideBanner(); };
  controls.hooks.newGame = () => { game.newGame(); hideBanner(); };
  controls.hooks.toggleHud = () => toggleHud();
  controls.hooks.toggleHelp = toggleHelp;
  window.addEventListener('keydown', (e) => { if (e.key === 'Escape') { help.hidden = true; phoneUI?.close(); hideBanner(); game.pendingPromotion && promoCancel?.(); } });

  // ------------------------------------------------------------ state rendering
  const movesEl = $('#moves');
  let lastMovesKey = null;
  let lastCheck = false;
  const sideName = (w) => (w === 'w' ? t('side.white', 'White') : t('side.black', 'Black'));
  function render(st) {
    // turn
    const white = st.turn === 'w';
    const dot = $('.turn .dot');
    dot.className = 'dot ' + st.turn;
    let main = white ? t('turn.white', 'White to move') : t('turn.black', 'Black to move'), sub = ' ';
    if (st.over) {
      const w = st.over.winner;
      main = st.over.reason === 'checkmate' ? t('turn.checkmate', 'Checkmate. {side} wins', { side: sideName(w) }) : t('turn.draw', 'Draw');
      sub = st.over.reason === 'checkmate' ? t('turn.gameOver', 'Game over') : t(`reason.${st.over.reason}`, st.over.reason);
    } else if (st.thinking) { sub = t('turn.thinking', 'Computer is thinking'); }
    else if (st.check) sub = t('turn.check', 'Check');
    else if (st.vsComputer) sub = st.turn === st.computerColor ? t('turn.computerMove', 'Computer to move') : t('turn.yourMove', 'Your move');
    $('#turn-main').textContent = main;
    $('#turn-sub').textContent = sub;
    $('.turn').classList.toggle('check', !!st.check && !st.over);
    $('.turn').classList.toggle('think', !!st.thinking);

    // moves
    const key = i18n.language + '|' + st.moves.join(' ');
    if (key !== lastMovesKey) {
      lastMovesKey = key;
      movesEl.innerHTML = '';
      for (let i = 0; i < st.moves.length; i += 2) {
        const li = el('li');
        li.innerHTML = `<span class="n">${i / 2 + 1}.</span><span class="m">${sanDisplay(st.moves[i])}</span><span class="m">${sanDisplay(st.moves[i + 1] || '')}</span>`;
        if (i + 1 >= st.moves.length - 1) li.classList.add('latest');
        movesEl.append(li);
      }
      const latest = movesEl.querySelector('.latest');
      if (latest) latest.scrollIntoView({ block: 'nearest' });
      if (!st.moves.length) movesEl.append(el('li', 'empty', t('moves.empty', 'No moves yet. Click a piece to begin.')));
    }
    // captured: st.captured.b = black pieces lost (captured by white)
    const sortFn = (a, b) => VAL[b] - VAL[a];
    $('#cap-b').innerHTML = [...st.captured.b].sort(sortFn).map((t) => `<i>${g(t)}</i>`).join('');
    $('#cap-w').innerHTML = [...st.captured.w].sort(sortFn).map((t) => `<i>${g(t)}</i>`).join('');
    $('#adv-w').textContent = st.advantage > 0 ? `+${st.advantage}` : '';
    $('#adv-b').textContent = st.advantage < 0 ? `+${-st.advantage}` : '';

    $('#btn-undo').disabled = !st.canUndo;
    if (st.check && !lastCheck && !st.over) toast(t('turn.check', 'Check'));
    lastCheck = st.check;
    if (chkAi.checked !== st.vsComputer) chkAi.checked = st.vsComputer;
    if (st.level && selAiLevel.value !== st.level) selAiLevel.value = st.level;
    syncGood();
    phoneUI?.status(st);
  }
  game.on('change', render);
  render(game.getState());

  // ------------------------------------------------------------ promotion chooser
  const promoEl = document.getElementById('promo');
  let promoCancel = null;
  game.on('promotion', ({ color, choose }) => {
    promoEl.innerHTML = `<div class="promo-card"><h3>${t('promo.title', 'Promote pawn')}</h3><div class="promo-row">${['q', 'r', 'b', 'n']
      .map((p) => `<button data-p="${p}" class="pbtn ${color}" title="${pieceName(p)}"><span>${g(p)}</span><small>${pieceName(p)}</small></button>`).join('')}</div></div>`;
    promoEl.hidden = false;
    const done = (p) => { promoEl.hidden = true; promoCancel = null; choose(p); };
    promoCancel = () => done(null);
    promoEl.querySelectorAll('button').forEach((b) => b.addEventListener('click', () => done(b.dataset.p)));
    promoEl.onclick = (e) => { if (e.target === promoEl) done(null); };
  });

  // ------------------------------------------------------------ banner
  const banner = document.getElementById('banner');
  function hideBanner() { banner.hidden = true; }
  game.on('gameover', (st) => {
    const mate = st.reason === 'checkmate';
    const title = mate ? t('banner.checkmate', 'Checkmate') : t('banner.draw', 'Draw');
    const cap = (x) => x.charAt(0).toUpperCase() + x.slice(1);
    const sub = mate ? t('banner.wins', '{side} wins', { side: sideName(st.winner) }) : t(`reason.${st.reason}`, cap(st.reason));
    banner.innerHTML = `<div class="banner-card"><small>${st.result}</small><h2>${title}</h2><p>${sub}</p>
      <div class="row"><button class="btn primary" id="bn-new">${t('hud.newGame', 'New game')}</button><button class="btn" id="bn-view">${t('banner.review', 'Review board')}</button></div></div>`;
    banner.hidden = false;
    banner.querySelector('#bn-new').onclick = () => { game.newGame(); hideBanner(); };
    banner.querySelector('#bn-view').onclick = hideBanner;
  });
  game.on('newgame', hideBanner);

  // ------------------------------------------------------------ toast
  const toastEl = document.getElementById('toast');
  let toastT = 0;
  function toast(msg, kind) {
    toastEl.textContent = msg;
    toastEl.classList.toggle('info', kind === 'info');
    toastEl.classList.add('show');
    clearTimeout(toastT);
    toastT = setTimeout(() => toastEl.classList.remove('show'), 1400);
  }

  // ------------------------------------------------------------ per-frame control sync
  let lastSig = '';
  function sync() {
    syncGood();   // busy and the computer's turn change without a game event
    const d = controls.gimbalDeg;
    const sig = `${d.x.toFixed(0)}|${d.y.toFixed(0)}|${d.z.toFixed(0)}|${controls.spin}`;
    if (sig === lastSig) return;
    lastSig = sig;
    for (const [axis] of AXES) {
      const s = sliders[axis];
      const v = Math.round(d[axis]);
      if (!s.sliding) s.input.value = v;
      s.out.innerHTML = `${v}&deg;`;
    }
    $('#btn-spin').classList.toggle('on', controls.spin);
  }

  // ------------------------------------------------------------ phone HUD
  // Status line on top, thumb bar (Undo, New game, Flip, Views, Menu) at the bottom (a column on the right in landscape) and a
  // Menu bottom sheet that takes over the existing cards: Game, Moves, View and gimbal, Scene, Help. A hidden probe element
  // (.pframe) is positioned by the stylesheet to the free area between them; its rectangle goes to controls.setFrame.
  function buildPhone() {
    const cardOf = (n) => hud.querySelector(`.card[data-card="${n}"]`);
    const status = el('div', 'pstatus');
    status.setAttribute('role', 'status');
    status.innerHTML = '<i class="dot w"></i><b class="ps-main">White to move</b><span class="ps-sub"></span><span class="ps-last"></span>';
    const bar = el('nav', 'pbar');
    bar.setAttribute('aria-label', 'Game controls');
    bar.dataset.i18nAria = 'phone.controls';
    const btn = {};
    for (const [id, label, key] of [['undo', 'Undo', 'hud.undo'], ['new', 'New game', 'hud.newGame'], ['flip', 'Flip', 'hud.flip'], ['views', 'Views', 'phone.views'], ['learn', 'Learn', 'learn.button'], ['menu', 'Menu', 'phone.menu']]) {
      const b = el('button', 'tb', `<svg viewBox="0 0 24 24" aria-hidden="true">${ICON[id]}</svg><span data-i18n="${key}">${label}</span>`);
      b.dataset.act = id;
      bar.append(b);
      btn[id] = b;
    }
    const confirmBox = el('div', 'pconfirm');
    confirmBox.hidden = true;
    confirmBox.setAttribute('role', 'alertdialog');
    confirmBox.innerHTML = '<p data-i18n="phone.newAsk">Start a new game?</p><div class="row"><button class="btn primary" data-a="yes" data-i18n="phone.yes">Yes</button><button class="btn" data-a="no" data-i18n="phone.cancel">Cancel</button></div>';
    const probe = el('div', 'pframe');
    probe.setAttribute('aria-hidden', 'true');

    const scrim = el('div', 'pscrim');
    const sheet = el('section', 'psheet');
    sheet.setAttribute('role', 'dialog');
    sheet.setAttribute('aria-label', 'Menu');
    sheet.dataset.i18nAria = 'phone.menu';
    sheet.innerHTML = '<div class="psheet-head"><i class="grip"></i><b data-i18n="phone.menu">Menu</b><button class="psheet-x" aria-label="Close menu" data-i18n-aria="phone.closeMenu">&#x2715;</button></div><div class="psheet-body"></div>';
    const sheetBody = sheet.querySelector('.psheet-body');
    // Learn sheet: the second bottom sheet, filled by src/learn (tabs Openings, Mine, Practise). Only one sheet is open at a time.
    const learnSheet = el('section', 'psheet plearn');
    learnSheet.setAttribute('role', 'dialog');
    learnSheet.setAttribute('aria-label', 'Learn');
    learnSheet.dataset.i18nAria = 'learn.title';
    learnSheet.innerHTML = '<div class="psheet-head"><i class="grip"></i><b data-i18n="learn.title">Learn</b><button class="psheet-x" aria-label="Close" data-i18n-aria="learn.close">&#x2715;</button></div><div class="psheet-body"></div>';
    const learnBody = learnSheet.querySelector('.psheet-body');

    // sections: the existing cards move here. Gimbal sliders join the View card, captured pieces stay in the 3D trays.
    const gameC = cardOf('game'), movesC = cardOf('moves'), viewC = cardOf('view'), sceneC = cardOf('scene');
    viewC.querySelector('h2').dataset.i18n = 'phone.viewGimbal';
    viewC.querySelector('h2').textContent = 'View and gimbal';
    const sl = $('#sliders');
    sl.classList.remove('body');
    viewC.querySelector('.body').append(sl);
    const helpC = el('section', 'card');
    helpC.dataset.card = 'help';
    helpC.innerHTML = `<header><h2 data-i18n="phone.help">Help</h2><span class="chev"></span></header><div class="body"><dl class="keys" id="phone-keys">${keyRows(PHONE_KEYS)}</dl></div>`;
    const cards = [gameC, movesC, viewC, sceneC, helpC];
    sheetBody.append(...cards);
    const openCard = (c) => {
      cards.forEach((x) => x.classList.toggle('collapsed', x !== c));
      sheetBody.scrollTop = Math.max(0, c.offsetTop - sheetBody.offsetTop - 4);
    };
    openCard(gameC);
    for (const c of cards) {
      c.querySelector('header').addEventListener('click', () => { if (c.classList.contains('collapsed')) openCard(c); else c.classList.add('collapsed'); });
    }

    // the "Good move?" bulb: a 44 px target at the right end of the status line
    const bulb = el('button', 'pgood', `<svg viewBox="0 0 24 24" aria-hidden="true">${ICON.good}</svg>`);
    bulb.dataset.i18nAria = 'good.title';
    bulb.setAttribute('aria-label', 'Show one good move');
    goodBtns.push(bulb);
    if (goodMove) bulb.addEventListener('click', () => goodMove.ask());

    hud.append(status, bulb, bar, probe, scrim, sheet, learnSheet, confirmBox);

    // sheet open and close; swipe down on the header closes it
    const isOpen = () => sheet.classList.contains('open');
    const isLearnOpen = () => learnSheet.classList.contains('open');
    function close() {
      confirmBox.hidden = true;
      sheet.classList.remove('open'); learnSheet.classList.remove('open'); scrim.classList.remove('open');
      btn.menu.classList.remove('on'); btn.learn.classList.remove('on');
    }
    function open(card) {
      close();
      sheet.classList.add('open'); scrim.classList.add('open'); btn.menu.classList.add('on');
      const lb = hud.querySelector('.lang');   // the language switch stays the first thing in the sheet, whatever mounted since
      if (lb && sheetBody.firstElementChild !== lb) sheetBody.prepend(lb);
      if (card) openCard(card);
      if (!movesC.classList.contains('collapsed')) movesEl.scrollTop = movesEl.scrollHeight;
    }
    function openLearn() {
      close();
      learnSheet.classList.add('open'); scrim.classList.add('open'); btn.learn.classList.add('on');
    }
    scrim.addEventListener('click', close);
    for (const sh of [sheet, learnSheet]) {
      sh.querySelector('.psheet-x').addEventListener('click', close);
      const head = sh.querySelector('.psheet-head');
      let drag = null;
      head.addEventListener('pointerdown', (e) => {
        if (e.target.closest('.psheet-x')) return;
        drag = { y: e.clientY, dy: 0 };
        try { head.setPointerCapture(e.pointerId); } catch (err) { /* ignore */ }
        sh.style.transition = 'none';
      });
      head.addEventListener('pointermove', (e) => {
        if (!drag) return;
        drag.dy = Math.max(0, e.clientY - drag.y);
        sh.style.transform = `translateY(${drag.dy}px)`;
      });
      const release = () => {
        if (!drag) return;
        const far = drag.dy > 70;
        drag = null;
        sh.style.transition = ''; sh.style.transform = '';
        if (far) close();
      };
      head.addEventListener('pointerup', release);
      head.addEventListener('pointercancel', release);
    }

    // thumb bar
    btn.undo.addEventListener('click', () => { game.undo(); hideBanner(); });
    // New game: one tap at the start or after the game ended, a small confirm while a game is in progress
    const startNew = () => { confirmBox.hidden = true; game.newGame(); hideBanner(); close(); };
    const askNew = () => {
      const st = game.getState();
      if (st.moves.length && !st.over) { confirmBox.hidden = !confirmBox.hidden; } else startNew();
    };
    confirmBox.querySelector('[data-a=yes]').addEventListener('click', startNew);
    confirmBox.querySelector('[data-a=no]').addEventListener('click', () => { confirmBox.hidden = true; });
    btn.new.addEventListener('click', askNew);
    sheetBody.addEventListener('click', (e) => {
      if (!e.target.closest('#btn-new')) return;
      e.stopPropagation();
      askNew();
    }, true);
    btn.flip.addEventListener('click', () => controls.flip());
    btn.views.addEventListener('click', () => {
      views.next();
      toast(t(`preset.${views.label()}`, views.label()), 'info');
    });
    btn.menu.addEventListener('click', () => (isOpen() ? close() : open()));
    btn.learn.addEventListener('click', () => (isLearnOpen() ? close() : openLearn()));

    // free area for the camera
    function frame() {
      if (hud.classList.contains('hidden')) { controls.setFrame({}); return; }
      const r = probe.getBoundingClientRect();
      const W = document.documentElement.clientWidth, H = document.documentElement.clientHeight;
      controls.setFrame({ top: r.top, left: r.left, right: W - r.right, bottom: H - r.bottom });
    }
    if (window.ResizeObserver) new ResizeObserver(frame).observe(probe);
    addEventListener('resize', frame);
    addEventListener('orientationchange', () => setTimeout(frame, 150));
    frame();

    let lastKey = '';
    function statusRender(st) {
      const sub = $('#turn-sub').textContent.trim();
      const main = $('#turn-main').textContent;
      const last = st.moves.length ? t('phone.last', 'Last: {move}', { move: sanDisplay(st.moves[st.moves.length - 1]) }) : '';
      const key = `${st.turn}|${main}|${sub}|${last}|${!!st.check}|${!!st.thinking}`;
      btn.undo.disabled = !st.canUndo;
      if (key === lastKey) return;
      lastKey = key;
      status.querySelector('.dot').className = 'dot ' + st.turn;
      status.querySelector('.ps-main').textContent = main;
      status.querySelector('.ps-sub').textContent = sub;
      status.querySelector('.ps-last').textContent = last;
      status.classList.toggle('check', !!st.check && !st.over);
      status.classList.toggle('think', !!st.thinking);
    }
    return {
      status: statusRender, close, frame, resetStatus() { lastKey = ''; },
      learn: { body: learnBody, open: openLearn, close, get isOpen() { return isLearnOpen(); } },
      toggleHelp() { if (isOpen() && !helpC.classList.contains('collapsed')) close(); else open(helpC); },
    };
  }
  if (device.phone) {
    phoneUI = buildPhone();
    phoneUI.status(game.getState());
  }

  // ------------------------------------------------------------ language switch
  // The two buttons sit in the brand card (desktop) and move into the Menu sheet on phones. Everything marked data-i18n is
  // translated in place; the parts built from tables or state (key help, preset and lighting names, move list, status) are redone.
  const langBox = $('.lang');
  if (phoneUI) hud.querySelector('.psheet-body').prepend(langBox);
  langBox.addEventListener('click', (e) => {
    const b = e.target.closest('[data-lang]');
    if (b) setLanguage(b.dataset.lang);
  });
  function applyLanguage() {
    langBox.querySelectorAll('[data-lang]').forEach((b) => b.classList.toggle('on', b.dataset.lang === i18n.language));
    $('#help-keys').innerHTML = keyRows(KEYS);
    const pk = $('#phone-keys');
    if (pk) pk.innerHTML = keyRows(PHONE_KEYS);
    presetBox.querySelectorAll('[data-preset]').forEach((b) => { b.textContent = t(`preset.${b.dataset.preset}`, b.dataset.preset); });
    [...selLight.options].forEach((o) => { o.textContent = t(`light.${o.value}`, o.value); });
    translateTree(hud);
    phoneUI?.resetStatus();
    lastMovesKey = null;
    render(game.getState());
  }
  onLanguage(applyLanguage);
  applyLanguage();

  // CONTRACT (lead): other modules mount their own panels and settings blocks. Desktop: a panel goes into the right
  // column above the move list, a settings block into the Scene card. Phone: both become sections of the Menu sheet.
  function mountPanel(id, element, { title = id } = {}) {
    const card = el('section', 'card');
    card.dataset.card = id;
    card.innerHTML = `<header><h2>${title}</h2><span class="chev"></span></header><div class="body"></div>`;
    translateTree(card);
    card.querySelector('.body').append(element);
    card.querySelector('header').addEventListener('click', () => card.classList.toggle('collapsed'));
    const sheetBody = hud.querySelector('.psheet-body');
    if (document.body.classList.contains('phone') && sheetBody) sheetBody.append(card);
    else right.insertBefore(card, right.querySelector('.card[data-card="moves"]'));
    return card;
  }
  function mountSettings(id, element) {
    element.dataset.settings = id;
    const scene = hud.querySelector('.card[data-card="scene"] .body') || hud.querySelector('.card[data-card="scene"]');
    scene.append(element);
    return element;
  }

  // Phone only: the Learn sheet { body, open(), close(), isOpen }, null elsewhere. src/learn fills the body.
  return { sync, toast, toggleHud, toggleHelp, render, mountPanel, mountSettings, learnSheet: phoneUI ? phoneUI.learn : null, bindGoodMove };
}
