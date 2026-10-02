// HUD: glass panels, move list, captured pieces, sliders, presets, menus, banners.
// On phones (device.phone) the same cards are moved into a bottom sheet (Menu) and a status line plus a thumb bar are added,
// see buildPhone() at the end of createUI. Desktop and tablets keep the columns.
import { device } from './device.js';
import { PRESETS } from './controls.js';
const GLYPH = { k: '♚', q: '♛', r: '♜', b: '♝', n: '♞', p: '♟' };
const g = (t) => GLYPH[t] + '︎';
const VAL = { q: 9, r: 5, b: 3, n: 3, p: 1, k: 0 };
const PHONE_KEYS = [
  ['Tap a piece', 'Select it, then tap a square'], ['Drag', 'Orbit camera'], ['Two fingers', 'Pinch to zoom'],
  ['Undo', 'Take back a move'], ['Flip', 'View from the other side'], ['Views', 'Cycle the camera views'],
];
const PHONE_TEXT = { newAsk: 'Start a new game?', yes: 'Yes', cancel: 'Cancel' };
const ICON = {
  undo: '<path d="M9 14 4 9l5-5"/><path d="M4 9h10.5a5.5 5.5 0 0 1 0 11H11"/>',
  new: '<path d="M12 5v14M5 12h14"/>',
  flip: '<path d="M8 20V6M4 10l4-4 4 4"/><path d="M16 4v14M12 14l4 4 4-4"/>',
  views: '<path d="M2 12s4-7 10-7 10 7 10 7-4 7-10 7S2 12 2 12z"/><circle cx="12" cy="12" r="3"/>',
  menu: '<path d="M4 7h16M4 12h16M4 17h16"/>',
};
const PIECE_NAME = { q: 'Queen', r: 'Rook', b: 'Bishop', n: 'Knight' };

const KEYS = [
  ['Drag', 'Orbit camera'], ['Shift + drag / right drag', 'Rotate board'], ['Wheel / pinch', 'Zoom'],
  ['Q / E', 'Board roll (Z)'], ['W / S', 'Board pitch (X)'], ['A / D', 'Board yaw (Y)'],
  ['Arrow keys', 'Orbit camera'], ['+ / -', 'Zoom'], ['R', 'Reset view'], ['F', 'Flip to other side'],
  ['V', 'Top down'], ['1 to 5', 'View presets'], ['Space', 'Auto spin'], ['U', 'Undo'], ['N', 'New game'], ['H', 'Hide / show HUD'],
];

function el(tag, cls, html) {
  const e = document.createElement(tag);
  if (cls) e.className = cls;
  if (html != null) e.innerHTML = html;
  return e;
}

export function createUI({ game, controls, stage, quality = 'high' }) {
  const hud = document.getElementById('hud');
  hud.innerHTML = '';

  // ------------------------------------------------------------ left column
  const left = el('aside', 'col left');
  left.innerHTML = `
    <section class="card brand">
      <div class="brand-row">
        <div class="logo" aria-hidden="true">${g('n')}</div>
        <div><h1>Chess 3D</h1><p class="sub">Studio edition</p></div>
        <button class="icon-btn" id="btn-hide" title="Hide HUD (H)" aria-label="Hide HUD">&#x2715;</button>
      </div>
      <div class="turn" id="turn"><i class="dot w"></i><div><b id="turn-main">White to move</b><small id="turn-sub">&nbsp;</small></div></div>
    </section>

    <div class="tools" id="tools">
    <section class="card" data-card="view">
      <header><h2>View</h2><span class="chev"></span></header>
      <div class="body">
        <div class="presets" id="presets"></div>
        <label class="switch lockrow" title="Stop all camera gestures; taps still move pieces"><input type="checkbox" id="chk-lock"><span class="track"><i></i></span><em>Lock view</em></label>
        <div class="row three">
          <button class="btn" id="btn-flip" title="Flip to the other side (F)">Flip</button>
          <button class="btn toggle" id="btn-spin" title="Auto spin (Space)">Spin</button>
          <button class="btn" id="btn-reset" title="Reset view (R)">Reset</button>
        </div>
      </div>
    </section>

    <section class="card" data-card="gimbal">
      <header><h2>Board gimbal</h2><span class="chev"></span></header>
      <div class="body sliders" id="sliders"></div>
    </section>

    <section class="card" data-card="scene">
      <header><h2>Scene</h2><span class="chev"></span></header>
      <div class="body">
        <label class="field"><span>Lighting</span><select id="sel-light"></select></label>
        <label class="field"><span>Quality</span><select id="sel-quality">
          <option value="low">Low</option><option value="medium">Medium</option><option value="high">High</option></select></label>
      </div>
    </section>
    </div>`;

  // ------------------------------------------------------------ right column
  const right = el('aside', 'col right');
  right.innerHTML = `
    <section class="card" data-card="game">
      <header><h2>Game</h2><span class="chev"></span></header>
      <div class="body">
        <div class="row three">
          <button class="btn primary" id="btn-new" title="New game (N)">New game</button>
          <button class="btn" id="btn-undo" title="Undo (U)">Undo</button>
          <button class="btn" id="btn-help" title="Keyboard shortcuts (?)">Keys</button>
        </div>
        <div class="row ai">
          <label class="switch"><input type="checkbox" id="chk-ai"><span class="track"><i></i></span><em>vs computer</em></label>
          <select id="sel-ai-color" title="Your side"><option value="w">Play white</option><option value="b">Play black</option></select>
          <select id="sel-ai-level" title="Strength"><option value="2">Easy ~900</option><option value="3">Normal ~1200</option><option value="4">Hard ~1450</option></select>
        </div>
      </div>
    </section>

    <section class="card grow" data-card="moves">
      <header><h2>Moves</h2><span class="chev"></span></header>
      <div class="body">
        <ol class="moves" id="moves"></ol>
      </div>
    </section>

    <section class="card" data-card="captured">
      <header><h2>Captured</h2><span class="chev"></span></header>
      <div class="body">
        <div class="cap"><span class="who">By white</span><span class="glyphs b" id="cap-b"></span><span class="adv" id="adv-w"></span></div>
        <div class="cap"><span class="who">By black</span><span class="glyphs w" id="cap-w"></span><span class="adv" id="adv-b"></span></div>
      </div>
    </section>`;

  const help = el('div', 'help card');
  help.hidden = true;
  help.innerHTML = `<header><h2>Keyboard and mouse</h2></header><dl>${KEYS.map(([k, v]) => `<dt>${k}</dt><dd>${v}</dd>`).join('')}</dl>`;

  const showBtn = el('button', 'show-btn', 'Show HUD');
  showBtn.hidden = true;
  const drawerBtn = el('button', 'drawer-btn', 'Controls');

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
  for (const name of controls.presets) {
    const b = el('button', 'btn preset', name);
    b.addEventListener('click', () => controls.setPreset(name));
    presetBox.append(b);
  }
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
    row.innerHTML = `<label for="sl-${axis}"><b>${label}</b><span>${hint}</span></label>
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
  resetG.addEventListener('click', () => controls.levelBoard());
  sliderBox.append(resetG);

  // ------------------------------------------------------------ scene selects
  const selLight = $('#sel-light'), selQuality = $('#sel-quality');
  const presets = stage.lightingPresets || [];
  for (const n of presets) selLight.append(new Option(n, n));
  selLight.parentElement.hidden = !presets.length;
  selLight.addEventListener('change', () => stage.setLightingPreset?.(selLight.value));
  selQuality.value = quality;
  selQuality.addEventListener('change', () => stage.setQuality?.(selQuality.value));

  // ------------------------------------------------------------ game buttons
  $('#btn-new').addEventListener('click', () => { game.newGame(); hideBanner(); });
  $('#btn-undo').addEventListener('click', () => { game.undo(); hideBanner(); });
  $('#btn-help').addEventListener('click', toggleHelp);
  const chkAi = $('#chk-ai'), selAiColor = $('#sel-ai-color'), selAiLevel = $('#sel-ai-level');
  function applyAi() {
    const human = selAiColor.value;
    game.setVsComputer(chkAi.checked, { color: human === 'w' ? 'b' : 'w', depth: +selAiLevel.value });
    if (chkAi.checked) controls.setPreset(human === 'w' ? 'White view' : 'Black view');
  }
  chkAi.addEventListener('change', applyAi);
  selAiColor.addEventListener('change', () => { if (chkAi.checked) applyAi(); });
  selAiLevel.addEventListener('change', () => { if (chkAi.checked) applyAi(); });

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
  function render(st) {
    // turn
    const white = st.turn === 'w';
    const dot = $('.turn .dot');
    dot.className = 'dot ' + st.turn;
    let main = white ? 'White to move' : 'Black to move', sub = ' ';
    if (st.over) {
      const w = st.over.winner;
      main = st.over.reason === 'checkmate' ? `Checkmate. ${w === 'w' ? 'White' : 'Black'} wins` : 'Draw';
      sub = st.over.reason === 'checkmate' ? 'Game over' : st.over.reason;
    } else if (st.thinking) { sub = 'Computer is thinking'; }
    else if (st.check) sub = 'Check';
    else if (st.vsComputer) sub = st.turn === st.computerColor ? 'Computer to move' : 'Your move';
    $('#turn-main').textContent = main;
    $('#turn-sub').textContent = sub;
    $('.turn').classList.toggle('check', !!st.check && !st.over);
    $('.turn').classList.toggle('think', !!st.thinking);

    // moves
    const key = st.moves.join(' ');
    if (key !== lastMovesKey) {
      lastMovesKey = key;
      movesEl.innerHTML = '';
      for (let i = 0; i < st.moves.length; i += 2) {
        const li = el('li');
        li.innerHTML = `<span class="n">${i / 2 + 1}.</span><span class="m">${st.moves[i]}</span><span class="m">${st.moves[i + 1] || ''}</span>`;
        if (i + 1 >= st.moves.length - 1) li.classList.add('latest');
        movesEl.append(li);
      }
      const latest = movesEl.querySelector('.latest');
      if (latest) latest.scrollIntoView({ block: 'nearest' });
      if (!st.moves.length) movesEl.append(el('li', 'empty', 'No moves yet. Click a piece to begin.'));
    }
    // captured: st.captured.b = black pieces lost (captured by white)
    const sortFn = (a, b) => VAL[b] - VAL[a];
    $('#cap-b').innerHTML = [...st.captured.b].sort(sortFn).map((t) => `<i>${g(t)}</i>`).join('');
    $('#cap-w').innerHTML = [...st.captured.w].sort(sortFn).map((t) => `<i>${g(t)}</i>`).join('');
    $('#adv-w').textContent = st.advantage > 0 ? `+${st.advantage}` : '';
    $('#adv-b').textContent = st.advantage < 0 ? `+${-st.advantage}` : '';

    $('#btn-undo').disabled = !st.canUndo;
    if (st.check && !lastCheck && !st.over) toast('Check');
    lastCheck = st.check;
    if (chkAi.checked !== st.vsComputer) chkAi.checked = st.vsComputer;
    phoneUI?.status(st);
  }
  game.on('change', render);
  render(game.getState());

  // ------------------------------------------------------------ promotion chooser
  const promoEl = document.getElementById('promo');
  let promoCancel = null;
  game.on('promotion', ({ color, choose }) => {
    promoEl.innerHTML = `<div class="promo-card"><h3>Promote pawn</h3><div class="promo-row">${['q', 'r', 'b', 'n']
      .map((t) => `<button data-p="${t}" class="pbtn ${color}" title="${PIECE_NAME[t]}"><span>${g(t)}</span><small>${PIECE_NAME[t]}</small></button>`).join('')}</div></div>`;
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
    const title = mate ? 'Checkmate' : 'Draw';
    const sub = mate ? `${st.winner === 'w' ? 'White' : 'Black'} wins` : st.reason.charAt(0).toUpperCase() + st.reason.slice(1);
    banner.innerHTML = `<div class="banner-card"><small>${st.result}</small><h2>${title}</h2><p>${sub}</p>
      <div class="row"><button class="btn primary" id="bn-new">New game</button><button class="btn" id="bn-view">Review board</button></div></div>`;
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
    const btn = {};
    for (const [id, label] of [['undo', 'Undo'], ['new', 'New game'], ['flip', 'Flip'], ['views', 'Views'], ['menu', 'Menu']]) {
      const b = el('button', 'tb', `<svg viewBox="0 0 24 24" aria-hidden="true">${ICON[id]}</svg><span>${label}</span>`);
      b.dataset.act = id;
      bar.append(b);
      btn[id] = b;
    }
    const confirmBox = el('div', 'pconfirm');
    confirmBox.hidden = true;
    confirmBox.setAttribute('role', 'alertdialog');
    confirmBox.innerHTML = `<p>${PHONE_TEXT.newAsk}</p><div class="row"><button class="btn primary" data-a="yes">${PHONE_TEXT.yes}</button><button class="btn" data-a="no">${PHONE_TEXT.cancel}</button></div>`;
    const probe = el('div', 'pframe');
    probe.setAttribute('aria-hidden', 'true');

    const scrim = el('div', 'pscrim');
    const sheet = el('section', 'psheet');
    sheet.setAttribute('role', 'dialog');
    sheet.setAttribute('aria-label', 'Menu');
    sheet.innerHTML = '<div class="psheet-head"><i class="grip"></i><b>Menu</b><button class="psheet-x" aria-label="Close menu">&#x2715;</button></div><div class="psheet-body"></div>';
    const sheetBody = sheet.querySelector('.psheet-body');

    // sections: the existing cards move here. Gimbal sliders join the View card, captured pieces stay in the 3D trays.
    const gameC = cardOf('game'), movesC = cardOf('moves'), viewC = cardOf('view'), sceneC = cardOf('scene');
    viewC.querySelector('h2').textContent = 'View and gimbal';
    const sl = $('#sliders');
    sl.classList.remove('body');
    viewC.querySelector('.body').append(sl);
    const helpC = el('section', 'card');
    helpC.dataset.card = 'help';
    helpC.innerHTML = `<header><h2>Help</h2><span class="chev"></span></header><div class="body"><dl class="keys">${PHONE_KEYS.map(([k, v]) => `<dt>${k}</dt><dd>${v}</dd>`).join('')}</dl></div>`;
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

    hud.append(status, bar, probe, scrim, sheet, confirmBox);

    // sheet open and close; swipe down on the header closes it
    const isOpen = () => sheet.classList.contains('open');
    function close() { confirmBox.hidden = true; sheet.classList.remove('open'); scrim.classList.remove('open'); btn.menu.classList.remove('on'); }
    function open(card) {
      sheet.classList.add('open'); scrim.classList.add('open'); btn.menu.classList.add('on');
      if (card) openCard(card);
      if (!movesC.classList.contains('collapsed')) movesEl.scrollTop = movesEl.scrollHeight;
    }
    scrim.addEventListener('click', close);
    sheet.querySelector('.psheet-x').addEventListener('click', close);
    const head = sheet.querySelector('.psheet-head');
    let drag = null;
    head.addEventListener('pointerdown', (e) => {
      if (e.target.closest('.psheet-x')) return;
      drag = { y: e.clientY, dy: 0 };
      try { head.setPointerCapture(e.pointerId); } catch (err) { /* ignore */ }
      sheet.style.transition = 'none';
    });
    head.addEventListener('pointermove', (e) => {
      if (!drag) return;
      drag.dy = Math.max(0, e.clientY - drag.y);
      sheet.style.transform = `translateY(${drag.dy}px)`;
    });
    const release = () => {
      if (!drag) return;
      const far = drag.dy > 70;
      drag = null;
      sheet.style.transition = ''; sheet.style.transform = '';
      if (far) close();
    };
    head.addEventListener('pointerup', release);
    head.addEventListener('pointercancel', release);

    // thumb bar
    let vi = -1;
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
      // the preset after the one in view: the last one picked while the camera is still moving, else the nearest one to the camera
      if (!controls.animating) {
        const c = controls.camera;
        let best = -1, bd = 0.4;
        controls.presets.forEach((n, i) => {
          const P = PRESETS[n];
          const dy = Math.abs(Math.atan2(Math.sin(c.yaw - P.yaw), Math.cos(c.yaw - P.yaw)));
          const d = dy * Math.max(0.2, Math.cos(P.pitch)) + Math.abs(c.pitch - P.pitch);
          if (d < bd) { bd = d; best = i; }
        });
        vi = best;
      }
      vi = (vi + 1) % controls.presets.length;
      controls.setPreset(controls.presets[vi]);
      toast(controls.presets[vi], 'info');
    });
    btn.menu.addEventListener('click', () => (isOpen() ? close() : open()));

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
      const last = st.moves.length ? `Last: ${st.moves[st.moves.length - 1]}` : '';
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
      status: statusRender, close, frame,
      toggleHelp() { if (isOpen() && !helpC.classList.contains('collapsed')) close(); else open(helpC); },
    };
  }
  if (device.phone) {
    phoneUI = buildPhone();
    phoneUI.status(game.getState());
  }

  // CONTRACT (lead): other modules mount their own panels and settings blocks. Desktop: a panel goes into the right
  // column above the move list, a settings block into the Scene card. Phone: both become sections of the Menu sheet.
  function mountPanel(id, element, { title = id } = {}) {
    const card = el('section', 'card');
    card.dataset.card = id;
    card.innerHTML = `<header><h2>${title}</h2><span class="chev"></span></header><div class="body"></div>`;
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

  return { sync, toast, toggleHud, toggleHelp, render, mountPanel, mountSettings };
}
