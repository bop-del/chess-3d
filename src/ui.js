// HUD: glass panels, move list, captured pieces, sliders, presets, menus, banners.
// On phones (device.phone) the same cards are moved into a bottom sheet (Menu) and a status line plus a thumb bar are added,
// see buildPhone() at the end of createUI. Desktop and tablets keep the columns.
import { device } from './device.js';
import './learn/strings.js';
import { t, setLanguage, onLanguage, translateTree, sanDisplay, i18n } from './i18n.js';
import { createDesktop, chipGroup, VIEW_ICONS } from './panel.js';
import { onlineServer } from './online/store.js';
import './menu-a.css';
const GLYPH = { k: '♚', q: '♛', r: '♜', b: '♝', n: '♞', p: '♟' };
const g = (t) => GLYPH[t] + '︎';
const VAL = { q: 9, r: 5, b: 3, n: 3, p: 1, k: 0 };
const PHONE_KEYS = [
  ['phone.tapPiece', 'Tap a piece', 'Select it, then tap a square'], ['phone.drag', 'Drag', 'Orbit camera'],
  ['phone.two', 'Two fingers', 'Pinch to zoom'], ['phone.undo', 'Undo', 'Take back a move'],
  ['phone.views', 'Views', 'Cycle the camera views'],
];
const ICON = {
  undo: '<path d="M9 14 4 9l5-5"/><path d="M4 9h10.5a5.5 5.5 0 0 1 0 11H11"/>',
  new: '<path d="M12 5v14M5 12h14"/>',
  symbols: '<rect x="4" y="4" width="16" height="16" rx="1"/><path d="M12 8v1.5M10.5 9.5h3M10 16h4M10.7 11.5h2.6l.7 4.5h-4l.7-4.5Z"/>',
  pieces: '<path d="M12 3v4M10 5h4M8 20h8M9 20l-1-6c0-2 1-3 2-3.5h4c1 .5 2 1.5 2 3.5l-1 6"/>',
  flip: '<path d="M8 20V6M4 10l4-4 4 4"/><path d="M16 4v14M12 14l4 4 4-4"/>',
  views: '<path d="M2 12s4-7 10-7 10 7 10 7-4 7-10 7S2 12 2 12z"/><circle cx="12" cy="12" r="3"/>',
  learn: '<path d="M4 5.5C4 4.7 4.7 4 5.5 4H11v15H5.5A1.5 1.5 0 0 0 4 20.5z"/><path d="M20 5.5c0-.8-.7-1.5-1.5-1.5H13v15h5.5a1.5 1.5 0 0 1 1.5 1.5z"/>',
  menu: '<path d="M4 7h16M4 12h16M4 17h16"/>',
  options: '<circle cx="12" cy="12" r="3"/><path d="M12 2v3M12 19v3M2 12h3M19 12h3M4.9 4.9l2.1 2.1M17 17l2.1 2.1M4.9 19.1 7 17M17 7l2.1-2.1"/>',
  show: '<path d="M7 4.5v15l12-7.5z"/>',
  end: '<path d="M6 6l12 12M18 6 6 18"/>',
  next: '<path d="M5 12h14M13 6l6 6-6 6"/>',
  online: '<circle cx="12" cy="12" r="9"/><path d="M3 12h18M12 3c2.5 2.6 3.8 5.6 3.8 9s-1.3 6.4-3.8 9c-2.5-2.6-3.8-5.6-3.8-9S9.5 5.6 12 3Z"/>',
  path: '<circle cx="6" cy="18" r="2"/><circle cx="18" cy="6" r="2"/><path d="M6 16c0-7 12-2 12-8"/>',
  good: '<path d="M9 18h6M10 21h4"/><path d="M12 3a6 6 0 0 0-3.5 10.9c.6.5 1 1.2 1 2v.1h5v-.1c0-.8.4-1.5 1-2A6 6 0 0 0 12 3z"/>',
};
const PIECE_NAME = { q: 'Queen', r: 'Rook', b: 'Bishop', n: 'Knight' };
const pieceName = (p) => t(`piece.${p}`, PIECE_NAME[p]);

const KEYS = [
  ['key.drag', 'Drag', 'Orbit camera'], ['key.shiftDrag', 'Shift + drag / right drag', 'Rotate board'], ['key.wheel', 'Wheel / pinch', 'Zoom'],
  ['key.qe', 'Q / E', 'Board roll (Z)'], ['key.ws', 'W / S', 'Board pitch (X)'], ['key.ad', 'A / D', 'Board yaw (Y)'],
  ['key.arrows', 'Arrow keys', 'Orbit camera'], ['key.plusMinus', '+ / -', 'Zoom'], ['key.r', 'R', 'Reset view'], ['key.f', 'F', 'Flip to other side'],
  ['key.v', 'V', 'Top down'], ['key.1to5', '1 to 5', 'View presets'], ['key.space', 'Space', 'Auto spin'], ['key.u', 'U', 'Undo'],
  ['key.n', 'N', 'Play'], ['key.h', 'H', 'Hide / show HUD'],
];
// the H key folds the panel on desktop and tablets, and hides the whole HUD on phones (which have no key)
const deskKeys = () => KEYS.map((r) => (r[0] === 'key.h' ? ['key.h', 'H', 'Fold / unfold the panel'] : r));
const keyRows = (rows) => rows.map(([k, kf, df]) => `<dt>${t(k, kf)}</dt><dd>${k === 'key.h' && df.startsWith('Fold') ? t('key.hDesk', df) : t(k + 'D', df)}</dd>`).join('');
const LIGHT_COLOR = { Studio: '#f5ead2', Gallery: '#cfd6e6', Sunset: '#e9a25b', Night: '#5b6fb3' };

function el(tag, cls, html) {
  const e = document.createElement(tag);
  if (cls) e.className = cls;
  if (html != null) e.innerHTML = html;
  return e;
}

export function createUI({ game, controls, stage, quality = 'high', views }) {
  const hud = document.getElementById('hud');
  hud.innerHTML = '';
  // Desktops and tablets get the one panel of src/panel.js. Phones keep the columns' cards, which buildPhone() below moves
  // into the Menu sheet. Both layouts use the same ids, so the wiring below serves either.
  const desk = !device.phone;
  const manual = new URLSearchParams(location.search).get('manual') === '1';
  // Menu structure A (CHE-223, default since CHE-226): "three equal places". Play, View (phone), Options and Learn are the places.
  // ?menu=old brings back the old menu for one release. See docs/ARCHITECTURE.md, Menu structure A.
  const menuA = new URLSearchParams(location.search).get('menu') !== 'old';
  document.body.classList.toggle('menu-a', menuA);
  // Online play (CHE-271): only with ?online=<server url> (remembered for the session) and menu A. Without it nothing here changes.
  const online = menuA ? onlineServer() : '';
  let onlineBoard = false;   // the board shows an online game: Back and Good move? are off (src/online/match.js sets it)
  let left = null, right = null, help = null, drawerBtn = null, dsk = null;
  const showBtn = el('button', 'show-btn', 'Show HUD');
  showBtn.dataset.i18n = 'hud.show';
  showBtn.hidden = true;

  // desktop: the camera's free area is the canvas minus the panel on the right and, while the game review is open, its strip below
  let deskW = 0, deskBottom = 0;
  const hostFns = [];   // told when the desktop panel changes width (folded or unfolded): the review moves its Details box
  const deskFrame = () => controls.setFrame({ ...(deskW ? { right: deskW } : {}), ...(deskBottom ? { bottom: deskBottom } : {}) });
  if (desk) {
    dsk = createDesktop({ hud, keyRows: () => keyRows(deskKeys()), onLayout: (w) => { deskW = w; deskFrame(); hostFns.forEach((fn) => fn()); }, fade: !manual, menuA, online: !!online });
    hud.append(showBtn);
  } else {
  // ------------------------------------------------------------ left column
  left = el('aside', 'col left');
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
  right = el('aside', 'col right');
  right.innerHTML = `
    <section class="card" data-card="game">
      <header><h2 data-i18n="hud.game">Game</h2><span class="chev"></span></header>
      <div class="body">
        <div class="row three">
          <button class="btn primary" id="btn-new" title="Play (N)" data-i18n="hud.newGame" data-i18n-title="hud.newGameTitle">Play</button>
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

  help = el('div', 'help card');
  help.hidden = true;
  help.innerHTML = `<header><h2 data-i18n="hud.keyboardMouse">Keyboard and mouse</h2></header><dl id="help-keys">${keyRows(KEYS)}</dl>`;

  drawerBtn = el('button', 'drawer-btn', 'Controls');
  drawerBtn.dataset.i18n = 'hud.controls';

  hud.append(left, right, help, showBtn, drawerBtn);
  }

  const $ = (sel, root = hud) => root.querySelector(sel);

  // ------------------------------------------------------------ collapsible cards
  const narrow = () => window.matchMedia('(max-width: 900px)').matches;
  if (!desk && !device.phone) hud.querySelectorAll('.card[data-card] > header').forEach((h) => {
    h.addEventListener('click', () => h.parentElement.classList.toggle('collapsed'));
  });
  if (!desk && narrow() && !device.phone) right.querySelectorAll('.card[data-card]').forEach((c) => { if (c.dataset.card !== 'game') c.classList.add('collapsed'); });
  if (drawerBtn) drawerBtn.addEventListener('click', () => { $('#tools').style.bottom = `${right.offsetHeight + 20}px`; left.classList.toggle('open'); drawerBtn.classList.toggle('on', left.classList.contains('open')); });
  // expose toolbox on narrow screens as a sheet

  let phoneUI = null;   // set by buildPhone() on phones

  // ------------------------------------------------------------ presets and view buttons
  const presetBox = $('#presets');
  // desktop: the same list also fills the picker on the view bar, and the bar shows the current view's name
  const vmenu = dsk ? dsk.vmenu : null;
  const viewName = (v) => t(`preset.${v.label}`, v.label);
  const buildViewButtons = () => {
    presetBox.textContent = '';
    if (vmenu) vmenu.textContent = '';
    for (const v of views.list()) {
      const b = el('button', desk ? 'view' : 'btn preset');
      b.type = 'button';
      if (desk) b.innerHTML = `${VIEW_ICONS[v.id] || ''}<span>${viewName(v)}</span>`; else b.textContent = viewName(v);
      b.dataset.preset = v.label;
      b.dataset.view = v.id;
      b.addEventListener('click', () => views.set(v.id));
      presetBox.append(b);
      if (vmenu) {
        const m = el('button', 'vm-item', `${VIEW_ICONS[v.id] || ''}<span>${viewName(v)}</span>`);
        m.type = 'button'; m.setAttribute('role', 'menuitemradio'); m.dataset.vview = v.id;
        m.addEventListener('click', () => views.set(v.id));
        vmenu.append(m);
      }
    }
    markView();
  };
  const markView = () => {
    presetBox.querySelectorAll('[data-view]').forEach((b) => b.classList.toggle('on', b.dataset.view === views.current()));
    if (!dsk) return;
    vmenu.querySelectorAll('[data-vview]').forEach((b) => { const on = b.dataset.vview === views.current(); b.classList.toggle('on', on); b.setAttribute('aria-checked', String(on)); });
    const cur = views.entry(views.current());
    if (cur) dsk.viewsName.textContent = viewName(cur);
  };
  // Symbols/Pieces toggle: thumb bar button on a phone, view bar button on desktop (CHE-158). It names what a tap shows next.
  const symBtn = () => document.getElementById('btn-symbols');
  const markSymbols = () => {
    const b = symBtn(); if (!b) return;
    const on = views.isSymbols();
    b.classList.toggle('on', on);
    if (b.classList.contains('tb')) {
      const key = on ? 'tb.pieces' : 'tb.symbols';
      const sp = b.querySelector('span'); sp.dataset.i18n = key; sp.textContent = t(key, on ? 'Pieces' : 'Symbols');
      b.querySelector('svg').innerHTML = on ? ICON.pieces : ICON.symbols;
      b.setAttribute('aria-label', t(key, on ? 'Pieces' : 'Symbols')); b.dataset.i18nAria = key; b.dataset.i18nTitle = key;
    } else {
      b.setAttribute('aria-pressed', String(on));
      b.title = t(on ? 'hud.piecesTitle' : 'hud.symbolsTitle', on ? 'Show the pieces again' : 'Show symbols instead of pieces');
      b.dataset.i18nTitle = on ? 'hud.piecesTitle' : 'hud.symbolsTitle';
    }
  };
  views.on(() => { buildViewButtons(); markSymbols(); });
  views.onSymbols(markSymbols);
  buildViewButtons();
  $('#btn-flip')?.addEventListener('click', () => controls.flip());
  document.getElementById('btn-symbols')?.addEventListener('click', (e) => { if (!e.currentTarget.classList.contains('tb')) views.toggleSymbols(); });
  markSymbols();
  $('#btn-reset').addEventListener('click', () => controls.reset());
  $('#btn-spin').addEventListener('click', () => controls.toggleSpin());

  // Lock view: stops orbit, pinch, twist and wheel, taps still move pieces. Remembered per device. Phone: a switch in the View
  // card. Desktop: the lock button on the view bar, which drives the same (hidden) checkbox.
  const chkLock = $('#chk-lock');
  try { chkLock.checked = localStorage.getItem('chess3d.lockView') === '1'; } catch (e) { /* storage blocked */ }
  const applyLock = () => controls.setLocked?.(chkLock.checked);
  const lockBtn = $('#btn-lock');
  const markLock = () => { if (lockBtn) { lockBtn.classList.toggle('on', chkLock.checked); lockBtn.setAttribute('aria-pressed', String(chkLock.checked)); } };
  chkLock.addEventListener('change', () => {
    applyLock(); markLock();
    try { localStorage.setItem('chess3d.lockView', chkLock.checked ? '1' : '0'); } catch (e) { /* storage blocked */ }
  });
  if (lockBtn) lockBtn.addEventListener('click', () => { chkLock.checked = !chkLock.checked; chkLock.dispatchEvent(new Event('change')); });
  markLock();
  if (device.touch || desk) applyLock();

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

  // ------------------------------------------------------------ scene choices
  // Phone: the two selects in the Scene card. Desktop: visible choices (swatches for the light, chips for the quality).
  const presets = stage.lightingPresets || [];
  let selLight, selQuality;
  const lightItems = () => presets.map((n) => ({ value: n, label: t(`light.${n}`, n), color: LIGHT_COLOR[n] || '#d8b468' }));
  const qualityItems = () => ['low', 'medium', 'high'].map((q) => ({ value: q, label: t(`hud.${q}`, q[0].toUpperCase() + q.slice(1)) }));
  if (desk) {
    selLight = chipGroup('sel-light', lightItems(), { cls: 'swatches', label: t('hud.lighting', 'Lighting') });
    selLight.value = stage.lightingPreset;
    $('#light-slot').append(selLight);
    selLight.hidden = !presets.length;
    selQuality = chipGroup('sel-quality', qualityItems(), { label: t('hud.quality', 'Quality') });
    $('#quality-slot').append(selQuality);
  } else {
    selLight = $('#sel-light'); selQuality = $('#sel-quality');
    for (const n of presets) selLight.append(new Option(t(`light.${n}`, n), n));
    selLight.parentElement.hidden = !presets.length;
  }
  selLight.addEventListener('change', () => stage.setLightingPreset?.(selLight.value));
  selQuality.value = stage.quality || quality;   // an invalid ?quality= falls back in the stage: show what runs
  selQuality.addEventListener('change', () => stage.setQuality?.(selQuality.value));
  stage.onQuality?.((q) => { selQuality.value = q; });   // the adaptive governor (src/adapt.js) steps down without the chip: it follows

  // ------------------------------------------------------------ game buttons
  // menu A: Play while a game runs asks first (desktop Play button, phone Start, N key, the daily puzzle's Start)
  let abandonRun = null;
  const abandonBox = () => (phoneUI ? phoneUI.confirmBox : dsk?.abandon);
  function confirmAbandon(run) {
    const st = game.getState(), box = abandonBox();
    if (!box || !st.moves.length || st.over) { run(); return; }
    abandonRun = run; box.hidden = false;
  }
  function wireAbandon(box) {
    box.querySelector('[data-a=yes]').addEventListener('click', () => { const r = abandonRun; abandonRun = null; box.hidden = true; r?.(); });
    box.querySelector('[data-a=no]').addEventListener('click', () => { abandonRun = null; box.hidden = true; });
  }
  const startGame = () => { game.newGame(); hideBanner(); phoneUI?.close(); };
  if (menuA && dsk) wireAbandon(dsk.abandon);
  $('#btn-new').addEventListener('click', () => { if (menuA) confirmAbandon(startGame); else { game.newGame(); hideBanner(); } });
  $('#btn-undo').addEventListener('click', () => { if (onlineBoard) return; game.undo(); hideBanner(); });
  $('#btn-help').addEventListener('click', toggleHelp);
  const storeLevel = (v) => { try { localStorage.setItem('chess3d.level', v); } catch (e) { /* storage may be blocked */ } };
  // "Good move?" helper (src/goodmove.js, bound from main.js): the desktop button and the phone bulb do the same thing
  let goodMove = null, goodKey = '';
  const goodBtns = [$('#btn-good')];
  function syncGood() {
    if (!goodMove) return;
    const think = goodMove.state() === 'thinking', can = goodMove.canAsk() && !onlineBoard;   // no helper in an online game
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
  const chkAi = $('#chk-ai');
  // Desktop: your side and the strength are chips (they keep a value and fire change, like the phone's selects)
  const levelItems = () => ['novice', 'easy', 'normal', 'hard'].map((k) => {
    const full = t(`hud.${k}`, { novice: 'Novice ~700', easy: 'Easy ~900', normal: 'Normal ~1200', hard: 'Hard ~1450' }[k]);
    const m = /^(.*\S)\s+(~?\d+)$/.exec(full);
    return { value: k, label: m ? m[1] : full, small: m ? m[2] : '' };
  });
  const sideItems = () => [{ value: 'w', label: t('hud.playWhite', 'Play white') }, { value: 'b', label: t('hud.playBlack', 'Play black') }];
  let selAiColor, selAiLevel;
  if (desk) {
    selAiColor = chipGroup('sel-ai-color', sideItems(), { label: t('hud.yourSide', 'Your side') });
    selAiLevel = chipGroup('sel-ai-level', levelItems(), { label: t('hud.strength', 'Strength'), cls: 'chips grid2' });
    selAiColor.value = 'w'; selAiLevel.value = 'easy';
    $('#opp').append(selAiColor, selAiLevel);
  } else { selAiColor = $('#sel-ai-color'); selAiLevel = $('#sel-ai-level'); }
  function applyAi() {
    const human = selAiColor.value;
    game.setVsComputer(chkAi.checked, { color: human === 'w' ? 'b' : 'w', level: selAiLevel.value });
    if (chkAi.checked) controls.setPreset(human === 'w' ? 'White view' : 'Black view');
  }
  chkAi.addEventListener('change', applyAi);
  selAiColor.addEventListener('change', () => { if (chkAi.checked) applyAi(); });
  selAiLevel.addEventListener('change', () => { storeLevel(selAiLevel.value); if (chkAi.checked) applyAi(); });

  // ------------------------------------------------------------ hud visibility / help
  // toggleHud(true) hides everything (?hud=0, the legacy close button) and the Show HUD button brings it back. The H key
  // (toggleHud() without an argument) folds the panel to the rail on desktop and tablets, and hides the HUD on phones.
  function toggleHud(force) {
    if (dsk && force === undefined) { dsk.setRail(!dsk.rail); return; }
    const hide = force ?? !hud.classList.contains('hidden');
    hud.classList.toggle('hidden', hide);
    showBtn.hidden = !hide;
    if (hide) { if (help) help.hidden = true; dsk?.helpApi.hide(); phoneUI?.close(); }
    phoneUI?.frame();
    dsk?.layout();
  }
  function toggleHelp() { if (phoneUI) phoneUI.toggleHelp(); else if (dsk) dsk.helpApi.toggle(); else help.hidden = !help.hidden; }
  $('#btn-hide')?.addEventListener('click', () => toggleHud(true));
  showBtn.addEventListener('click', () => toggleHud(false));
  controls.hooks.undo = () => { if (onlineBoard) return; game.undo(); hideBanner(); };
  controls.hooks.newGame = () => { if (menuA) confirmAbandon(startGame); else { game.newGame(); hideBanner(); } };
  controls.hooks.toggleHud = () => toggleHud();
  controls.hooks.toggleHelp = toggleHelp;
  window.addEventListener('keydown', (e) => {
    if (e.key !== 'Escape') return;
    if (dsk?.helpApi.open) { dsk.helpApi.hide(); return; }
    if (help) help.hidden = true;
    phoneUI?.close(); hideBanner(); game.pendingPromotion && promoCancel?.();
  });

  // ------------------------------------------------------------ state rendering
  const movesEl = $('#moves');
  const pickMove = (e) => { const m = revMoves && e.target.closest?.('[data-n]'); if (m) revMoves.pick(Number(m.dataset.n)); };
  movesEl.addEventListener('click', pickMove);
  movesEl.addEventListener('keydown', (e) => { if (e.key === 'Enter' || e.key === ' ') { pickMove(e); e.preventDefault(); } });
  let lastMovesKey = null;
  let lastSt = null;
  let revMoves = null;   // while the game review is open: { sans, kinds, cur, pick(n) }, shown instead of the game's own history
  let lastCheck = false;
  const sideName = (w) => (w === 'w' ? t('side.white', 'White') : t('side.black', 'Black'));
  function render(st) {
    lastSt = st;
    // turn
    const white = st.turn === 'w';
    const dot = $('.turn .dot');
    dot.className = 'dot ' + st.turn;
    let main = white ? t('turn.white', 'White to move') : t('turn.black', 'Black to move'), sub = ' ';
    if (st.over) {
      const w = st.over.winner;
      const timeLoss = st.over.reason === 'time' && w;   // a draw on time reads like any draw, with its own reason below
      const outside = w && (st.over.reason === 'resign' || st.over.reason === 'stale');   // an online game: resigned, or ended after 3 days without a move
      main = st.over.reason === 'checkmate' ? t('turn.checkmate', 'Checkmate. {side} wins', { side: sideName(w) }) : timeLoss ? t('turn.timeout', 'Time out. {side} wins', { side: sideName(w) }) : outside ? t('banner.wins', '{side} wins', { side: sideName(w) }) : t('turn.draw', 'Draw');
      sub = outside ? t(`reason.${st.over.reason}`, st.over.reason === 'resign' ? 'Resigned' : 'No move for 3 days') : st.over.reason === 'checkmate' || timeLoss ? t('turn.gameOver', 'Game over') : st.over.reason === 'time' ? t('reason.timeDraw', 'Time out, draw: the opponent has only a king') : t(`reason.${st.over.reason}`, st.over.reason);
    } else if (st.thinking) { sub = t('turn.thinking', 'Computer is thinking'); }
    else if (st.check) sub = t('turn.check', 'Check');
    else if (st.vsComputer) sub = st.turn === st.computerColor ? t('turn.computerMove', 'Computer to move') : t('turn.yourMove', 'Your move');
    // desktop: while a lesson runs the status line names it (the board position is still the lesson's)
    const kind = dsk ? [['explaining', 'openings', 'Opening'], ['drilling', 'drill', 'Drill'], ['puzzling', 'puzzles', 'Puzzle']].find(([c]) => document.body.classList.contains(c)) : null;
    if (kind) sub = [t(`panel.kind.${kind[1]}`, kind[2]), sub.trim()].filter(Boolean).join(' \u00b7 ');
    $('#turn-main').textContent = main;
    $('#turn-sub').textContent = sub;
    $('.turn').classList.toggle('check', !!st.check && !st.over);
    $('.turn').classList.toggle('think', !!st.thinking);

    // moves (in a game review: the reviewed game, the move on the board highlighted, a click jumps there)
    const list = revMoves ? revMoves.sans : st.moves;
    const key = i18n.language + '|' + (revMoves ? `r${revMoves.cur}|${revMoves.kinds.join()}|` : '') + list.join(' ');
    if (key !== lastMovesKey) {
      lastMovesKey = key;
      movesEl.innerHTML = '';
      const cell = (i) => {
        if (i >= list.length) return '<span class="m"></span>';
        if (!revMoves) return `<span class="m">${sanDisplay(list[i])}</span>`;
        const k = revMoves.kinds[i];
        return `<span class="m pick${k === 'mistake' || k === 'blunder' ? ' ' + k : ''}${revMoves.cur === i + 1 ? ' cur' : ''}" data-n="${i + 1}" role="button" tabindex="0">${sanDisplay(list[i])}</span>`;
      };
      for (let i = 0; i < list.length; i += 2) {
        const li = el('li');
        li.innerHTML = `<span class="n">${i / 2 + 1}.</span>${cell(i)}${cell(i + 1)}`;
        if (!revMoves && i + 1 >= list.length - 1) li.classList.add('latest');
        movesEl.append(li);
      }
      const latest = revMoves ? movesEl.querySelector('.cur') : movesEl.querySelector('.latest');
      if (latest) latest.scrollIntoView({ block: 'nearest' });
      if (!list.length) movesEl.append(el('li', 'empty', t('moves.empty', 'No moves yet. Click a piece to begin.')));
    }
    // captured: st.captured.b = black pieces lost (captured by white)
    const sortFn = (a, b) => VAL[b] - VAL[a];
    $('#cap-b').innerHTML = [...st.captured.b].sort(sortFn).map((t) => `<i>${g(t)}</i>`).join('');
    $('#cap-w').innerHTML = [...st.captured.w].sort(sortFn).map((t) => `<i>${g(t)}</i>`).join('');
    $('#adv-w').textContent = st.advantage > 0 ? `+${st.advantage}` : '';
    $('#adv-b').textContent = st.advantage < 0 ? `+${-st.advantage}` : '';

    $('#btn-undo').disabled = !st.canUndo || onlineBoard;
    if (menuA && dsk) dsk.undoBtn.hidden = !st.canUndo || onlineBoard;   // Back shows from the first move (never in an online game)
    if (st.check && !lastCheck && !st.over) toast(t('turn.check', 'Check'));
    lastCheck = st.check;
    if (chkAi.checked !== st.vsComputer) chkAi.checked = st.vsComputer;
    $('#opp')?.classList.toggle('off', !st.vsComputer);
    if (st.level && selAiLevel.value !== st.level) selAiLevel.value = st.level;
    syncGood();
    phoneUI?.status(st);
  }
  game.on('change', render);
  game.on('newgame', () => { abandonRun = null; const b = abandonBox(); if (b) b.hidden = true; });
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
    const timeLoss = st.reason === 'time' && st.winner;
    const outside = st.winner && (st.reason === 'resign' || st.reason === 'stale');   // an online game (CHE-271)
    const title = mate ? t('banner.checkmate', 'Checkmate') : timeLoss ? t('banner.time', 'Time out') : outside ? t(`banner.${st.reason}`, st.reason === 'resign' ? 'Resigned' : 'Game ended') : t('banner.draw', 'Draw');
    const cap = (x) => x.charAt(0).toUpperCase() + x.slice(1);
    const sub = mate || timeLoss || outside ? t('banner.wins', '{side} wins', { side: sideName(st.winner) }) : st.reason === 'time' ? t('reason.timeDraw', 'Time out, draw: the opponent has only a king') : t(`reason.${st.reason}`, cap(st.reason));
    banner.innerHTML = `<div class="banner-card"><small>${st.result}</small><h2>${title}</h2><p>${sub}</p>
      <div class="row"><button class="btn primary" id="bn-new">${t('hud.newGame', 'Play')}</button><button class="btn" id="bn-view">${t('banner.review', 'Review board')}</button></div></div>`;
    banner.hidden = false;
    banner.querySelector('#bn-new').onclick = () => { game.newGame(); hideBanner(); };
    banner.querySelector('#bn-view').onclick = hideBanner;
  });
  game.on('newgame', hideBanner);
  game.on('promotioncancel', () => { promoEl.hidden = true; promoCancel = null; });   // the clock ran out with the chooser open

  // ------------------------------------------------------------ toast
  const toastEl = document.getElementById('toast');
  let toastT = 0;
  function toast(msg, kind, ms = 1600) {
    toastEl.textContent = msg;
    toastEl.classList.toggle('info', kind === 'info');
    toastEl.classList.add('show');
    clearTimeout(toastT);
    toastT = setTimeout(() => toastEl.classList.remove('show'), ms);
  }

  // ------------------------------------------------------------ a lesson starts: Learn takes the panel
  // Explain, Drill and Puzzles set a class on <body> while they run (the phone layout uses the same classes). The moment one
  // of them starts, the panel shows the Learn tab and unfolds if it was a rail; the other tabs stay reachable.
  if (dsk) {
    const LESSON = ['explaining', 'drilling', 'puzzling'];
    let running = false;
    const watch = () => {
      const now = LESSON.some((c) => document.body.classList.contains(c));
      if (now && !running) { dsk.setTab('learn'); if (dsk.rail) dsk.setRail(false, { persist: false }); }
      if (now !== running) { running = now; render(game.getState()); }
    };
    new MutationObserver(watch).observe(document.body, { attributes: true, attributeFilter: ['class'] });
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
  // Status line on top, thumb bar (Undo, Play, Flip, Views, Menu) at the bottom (a column on the right in landscape) and a
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
    // short word on the button (never wraps), the full name stays as aria-label and title
    // menu A: Back (hidden until the first move), Play (a sheet with the choice), Symbols, View (a sheet), Learn, Options (no Menu)
    const BAR_BUTTONS = menuA
      ? [['new', 'Play', 'Play', 'hud.newGame', 'tb.new'], ['learn', 'Learn', 'Learn', 'learn.button', 'tb.learn'], ...(online ? [['online', 'Online', 'Online', 'online.tab', 'online.tab']] : []), ['undo', 'Back', 'Back', 'tb.undo', 'tb.undo'], ['symbols', 'Symbols', 'Symbols', 'tb.symbols', 'tb.symbols'], ['views', 'View', 'View', 'tb.view', 'tb.view'], ['options', 'Options', 'Options', 'phone.options', 'tb.options']]
      : [['undo', 'Undo', 'Undo', 'hud.undo', 'tb.undo'], ['new', 'Play', 'Play', 'hud.newGame', 'tb.new'], ['symbols', 'Symbols', 'Symbols', 'tb.symbols', 'tb.symbols'], ['views', 'View', 'Views', 'phone.views', 'tb.view'], ['learn', 'Learn', 'Learn', 'learn.button', 'tb.learn'], ['menu', 'Menu', 'Menu', 'phone.menu', 'tb.menu']];
    for (const [id, short, full, key, shortKey] of BAR_BUTTONS) {
      const b = el('button', 'tb', `<svg viewBox="0 0 24 24" aria-hidden="true">${ICON[id]}</svg><span data-i18n="${shortKey}">${short}</span>`);
      b.setAttribute('aria-label', full); b.setAttribute('title', full);
      b.dataset.i18nAria = key; b.dataset.i18nTitle = key;
      b.dataset.act = id;
      bar.append(b);
      btn[id] = b;
    }
    // learning bar: while Explain, Drill, Practise or a Puzzle runs it takes the place of the thumb bar (the panels call setLearnBar)
    const lbar = el('nav', 'pbar plbar');
    lbar.setAttribute('aria-label', 'Learning controls');
    lbar.dataset.i18nAria = 'lb.controls';
    const lbars = new Map();
    function setLearnBar(owner, spec) {
      if (spec) lbars.set(owner, spec); else lbars.delete(owner);
      const cur = [...lbars.values()][0] || null;
      document.body.classList.toggle('learnbar', !!cur);
      lbar.replaceChildren();
      for (const b of cur || []) {
        const x = el('button', `tb${b.primary ? ' primary' : ''}${b.on ? ' on' : ''}`, `<svg viewBox="0 0 24 24" aria-hidden="true">${ICON[b.icon]}</svg><span></span>`);
        x.querySelector('span').textContent = b.label;
        x.type = 'button'; x.dataset.act = b.id; x.disabled = !!b.disabled;
        x.setAttribute('aria-label', b.aria || b.label);
        if (b.pressed != null) x.setAttribute('aria-pressed', String(!!b.pressed));
        x.addEventListener('click', b.run);
        lbar.append(x);
      }
    }
    const confirmBox = el('div', 'pconfirm');
    confirmBox.hidden = true;
    confirmBox.setAttribute('role', 'alertdialog');
    confirmBox.innerHTML = `<p data-i18n="${menuA ? 'menu.abandon' : 'phone.newAsk'}">${menuA ? 'Really abandon the game?' : 'Start a new game?'}</p><div class="row"><button class="btn primary" data-a="yes" data-i18n="phone.yes">Yes</button><button class="btn" data-a="no" data-i18n="phone.cancel">Cancel</button></div>`;
    if (menuA) wireAbandon(confirmBox);
    const probe = el('div', 'pframe');
    probe.setAttribute('aria-hidden', 'true');

    const scrim = el('div', 'pscrim');
    // a bottom sheet: grip, title, close button, a scrolling body. Only one is open at a time.
    const mkSheet = (cls, titleKey, title, label, closeKey, closeLabel) => {
      const sh = el('section', `psheet${cls ? ' ' + cls : ''}`);
      sh.setAttribute('role', 'dialog');
      sh.setAttribute('aria-label', label);
      sh.dataset.i18nAria = titleKey;
      sh.innerHTML = `<div class="psheet-head"><i class="grip"></i><b data-i18n="${titleKey}">${title}</b><button class="psheet-x" aria-label="${closeLabel}" data-i18n-aria="${closeKey}">&#x2715;</button></div><div class="psheet-body"></div>`;
      return { el: sh, body: sh.querySelector('.psheet-body') };
    };
    // Learn sheet: filled by src/learn (tabs Openings, Mine, Practise, Puzzles).
    const learnS = mkSheet('plearn', 'learn.title', 'Learn', 'Learn', 'learn.close', 'Close');
    const learnSheet = learnS.el, learnBody = learnS.body;
    const cards = [];
    let sheet = null, sheetBody = null, sheetsA = null, optSlots = null, helpC = null, openCard = () => {};
    const gameC = cardOf('game'), movesC = cardOf('moves'), viewC = cardOf('view'), sceneC = cardOf('scene');
    const sl = $('#sliders');
    sl.classList.remove('body');
    if (!menuA) {
      // Menu sheet: the existing cards move here. Gimbal sliders join the View card, captured pieces stand beside the 3D board.
      const m = mkSheet('', 'phone.menu', 'Menu', 'Menu', 'phone.closeMenu', 'Close menu');
      sheet = m.el; sheetBody = m.body;
      viewC.querySelector('h2').dataset.i18n = 'phone.viewGimbal';
      viewC.querySelector('h2').textContent = 'View and gimbal';
      viewC.querySelector('.body').append(sl);
      helpC = el('section', 'card');
      helpC.dataset.card = 'help';
      helpC.innerHTML = `<header><h2 data-i18n="phone.help">Help</h2><span class="chev"></span></header><div class="body"><dl class="keys" id="phone-keys">${keyRows(PHONE_KEYS)}</dl></div>`;
      cards.push(gameC, movesC, viewC, sceneC, helpC);
      sheetBody.append(...cards);
      openCard = (c) => {
        cards.forEach((x) => x.classList.toggle('collapsed', x !== c));
        sheetBody.scrollTop = Math.max(0, c.offsetTop - sheetBody.offsetTop - 4);
      };
      openCard(gameC);
      for (const c of cards) {
        c.querySelector('header').addEventListener('click', () => { if (c.classList.contains('collapsed')) openCard(c); else c.classList.add('collapsed'); });
      }
    } else {
      // Menu A: Play (the choice, the clock, Start, the moves), View (the views and what turns them), Options (look, sound, quality,
      // language, advanced, help). The cards of the old Menu are taken apart; ids and handlers stay.
      const play = mkSheet('pplay', 'hud.newGame', 'Play', 'Play', 'phone.closeMenu', 'Close menu');
      const view = mkSheet('pview', 'tb.view', 'View', 'View', 'phone.closeMenu', 'Close menu');
      const opts = mkSheet('poptions', 'tb.options', 'Options', 'Options', 'phone.closeMenu', 'Close menu');
      sheetsA = { play, view, options: opts, learn: learnS };
      if (online) sheetsA.online = mkSheet('ponline', 'online.tab', 'Online', 'Online', 'phone.closeMenu', 'Close menu');   // CHE-271, filled by src/online
      for (const c of [gameC, movesC, viewC]) c.classList.remove('collapsed');
      // Play: [daily card, mounted later] opponent, clock, Start; then the moves. Back and Keys stay in the DOM, hidden (the bar has Back).
      const gb = gameC.querySelector('.body'), ai = gb.querySelector('.row.ai');
      const startRow = el('div', 'row start'), clockSlot = el('div', 'pclockslot'), unused = el('div');
      unused.hidden = true;
      const newBtn = $('#btn-new');
      newBtn.classList.add('big');
      startRow.append(newBtn);
      unused.append($('#btn-undo'), $('#btn-help'), gb.querySelector('.row.good'));
      gb.replaceChildren(ai, clockSlot, startRow, unused);
      play.body.append(gameC, movesC);
      view.body.append(viewC);
      // Options
      const sec = (id, key, title) => {
        const x = el('section', 'osec'); x.dataset.sec = id;
        x.innerHTML = `<h4 data-i18n="${key}">${title}</h4><div class="obody"></div>`;
        return x;
      };
      const look = sec('look', 'menu.look', 'Look'), sound = sec('sound', 'panel.sound', 'Sound'), quality = sec('quality', 'panel.quality', 'Quality'), lang = sec('language', 'panel.language', 'Language');
      const slot = (n) => { const d = el('div', 'stack'); d.dataset.slot = n; return d; };
      const lookBody = look.querySelector('.obody'), soundBody = sound.querySelector('.obody');
      lookBody.append(slot('themes'), slot('light'), slot('battle'), slot('more'));
      soundBody.append(slot('audio'), slot('music'));
      lookBody.querySelector('[data-slot=light]').append(sceneC.querySelector('#sel-light').closest('.field'));
      quality.querySelector('.obody').append(sceneC.querySelector('#sel-quality').closest('.field'));
      const adv = el('details', 'fold');
      adv.id = 'advanced';
      adv.innerHTML = '<summary><span data-i18n="panel.advanced">Advanced</span><small data-i18n="panel.advancedHintA">Tilt the board, back up progress</small></summary><div class="fold-body"></div>';
      adv.querySelector('.fold-body').append(sl, slot('train-data'));
      const help = sec('help', 'phone.help', 'Help');
      help.querySelector('.obody').innerHTML = `<dl class="keys" id="phone-keys">${keyRows(PHONE_KEYS)}</dl>`;
      opts.body.append(look, sound, quality, lang, adv, help);
      optSlots = { themes: lookBody.children[0], battle: lookBody.children[2], more: lookBody.children[3], audio: soundBody.children[0], music: soundBody.children[1], clock: clockSlot, 'train-data': adv.querySelector('[data-slot="train-data"]'), language: lang.querySelector('.obody'), help, adv };
    }

    // the "Good move?" bulb: a 44 px target at the right end of the status line
    const bulb = el('button', 'pgood', `<svg viewBox="0 0 24 24" aria-hidden="true">${ICON.good}</svg>`);
    bulb.dataset.i18nAria = 'good.title';
    bulb.setAttribute('aria-label', 'Show one good move');
    goodBtns.push(bulb);
    if (goodMove) bulb.addEventListener('click', () => goodMove.ask());

    const allSheets = menuA ? Object.values(sheetsA).map((x) => x.el) : [sheet, learnSheet];
    hud.append(status, bulb, bar, lbar, probe, scrim, ...allSheets, confirmBox);

    // sheet open and close; swipe down on the header closes it
    const isOpen = () => sheet.classList.contains('open');
    const isLearnOpen = () => learnSheet.classList.contains('open');
    const sheetBtns = menuA ? [btn.new, btn.views, btn.options, btn.learn, ...(btn.online ? [btn.online] : [])] : [btn.menu, btn.learn];
    function close() {
      confirmBox.hidden = true; abandonRun = null;
      for (const sh of allSheets) sh.classList.remove('open');
      scrim.classList.remove('open');
      for (const b of sheetBtns) b.classList.remove('on');
    }
    // menu A: open one of the sheets (play, view, options) from its bar button, or toggle it shut
    function openSheet(name) {
      const x = sheetsA[name], b = { play: btn.new, view: btn.views, options: btn.options, learn: btn.learn, online: btn.online }[name];
      close();
      x.el.classList.add('open'); scrim.classList.add('open'); b.classList.add('on');
      if (name === 'play') movesEl.scrollTop = movesEl.scrollHeight;
    }
    const isSheetOpen = (name) => sheetsA[name].el.classList.contains('open');
    function open(card) {
      close();
      sheet.classList.add('open'); scrim.classList.add('open'); btn.menu.classList.add('on');
      const lb = hud.querySelector('.lang');   // the language switch stays the first thing in the sheet, whatever mounted since
      if (lb && sheetBody.firstElementChild !== lb) sheetBody.prepend(lb);
      if (card) openCard(card);
      if (!movesC.classList.contains('collapsed')) movesEl.scrollTop = movesEl.scrollHeight;
    }
    function openLearn() {
      if (menuA) { openSheet('learn'); return; }
      close();
      learnSheet.classList.add('open'); scrim.classList.add('open'); btn.learn.classList.add('on');
    }
    scrim.addEventListener('click', close);
    for (const sh of allSheets) {
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
    btn.undo.addEventListener('click', () => { if (onlineBoard) return; game.undo(); hideBanner(); });
    // New game: one tap at the start or after the game ended, a small confirm while a game is in progress
    if (!menuA) {
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
    }
    btn.symbols.id = 'btn-symbols';
    btn.symbols.addEventListener('click', () => views.toggleSymbols());
    markSymbols();
    if (menuA) {
      for (const [name, b] of [['play', btn.new], ['view', btn.views], ['options', btn.options], ...(btn.online ? [['online', btn.online]] : [])]) b.addEventListener('click', () => (isSheetOpen(name) ? close() : openSheet(name)));
    } else {
      btn.views.addEventListener('click', () => {
        views.next();
        toast(t(`preset.${views.label()}`, views.label()), 'info');
      });
      btn.menu.addEventListener('click', () => (isOpen() ? close() : open()));
    }
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
      btn.undo.disabled = !st.canUndo || onlineBoard;
      if (menuA) btn.undo.classList.toggle('gone', !st.canUndo || onlineBoard);   // the place stays, nothing grey stands there
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
      status: statusRender, close, frame, setLearnBar, resetStatus() { lastKey = ''; }, confirmBox,
      learn: { body: learnBody, open: openLearn, close, get isOpen() { return isLearnOpen(); } },
      toggleHelp() {
        if (menuA) { if (isSheetOpen('options')) close(); else { openSheet('options'); optSlots.help.scrollIntoView?.({ block: 'start' }); } return; }
        if (isOpen() && !helpC.classList.contains('collapsed')) close(); else open(helpC);
      },
      openCard(id) { const c = id ? cardOf(id) : null; if (id && !c) return false; open(c || undefined); return true; },
      // menu A
      openSheet, optSlots, learnBody, playBody: sheetsA?.play.body, sheets: sheetsA, btn, isSheetOpen,
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
  if (phoneUI) { if (menuA) phoneUI.optSlots.language.append(langBox); else hud.querySelector('.psheet-body').prepend(langBox); }
  langBox.addEventListener('click', (e) => {
    const b = e.target.closest('[data-lang]');
    if (b) setLanguage(b.dataset.lang);
  });
  function applyLanguage() {
    langBox.querySelectorAll('[data-lang]').forEach((b) => b.classList.toggle('on', b.dataset.lang === i18n.language));
    $('#help-keys').innerHTML = keyRows(desk ? deskKeys() : KEYS);
    const pk = $('#phone-keys');
    if (pk) pk.innerHTML = keyRows(PHONE_KEYS);
    markSymbols();
    if (desk) {
      buildViewButtons();
      selLight.relabel(lightItems()); selQuality.relabel(qualityItems());
      selAiColor.relabel(sideItems()); selAiLevel.relabel(levelItems());
    } else {
      presetBox.querySelectorAll('[data-preset]').forEach((b) => { b.textContent = t(`preset.${b.dataset.preset}`, b.dataset.preset); });
      [...selLight.options].forEach((o) => { o.textContent = t(`light.${o.value}`, o.value); });
    }
    translateTree(hud);
    phoneUI?.resetStatus();
    lastMovesKey = null;
    render(game.getState());
  }
  onLanguage(applyLanguage);
  applyLanguage();

  // CONTRACT (lead): other modules mount their own panels and settings blocks. Desktop: a panel goes into the Learn tab, a
  // settings block into its slot of the Settings tab (by id, unknown ids land at the end). Phone: both become sections of the Menu sheet.
  function mountPanel(id, element, { title = id } = {}) {
    if (dsk) {
      const c = dsk.mountPanel(id, element, { title }); translateTree(c);
      if (menuA && id === 'badges') {   // idle Learn tab: the badges start folded, one tap on the title opens them
        c.classList.add('collapsed', 'bfold'); c.querySelector('header').insertAdjacentHTML('beforeend', '<span class="chev"></span>');
        c.querySelector('header').addEventListener('click', () => c.classList.toggle('collapsed'));
      }
      return c;
    }
    const card = el('section', 'card');
    card.dataset.card = id;
    card.innerHTML = `<header><h2>${title}</h2><span class="chev"></span></header><div class="body"></div>`;
    translateTree(card);
    card.querySelector('.body').append(element);
    card.querySelector('header').addEventListener('click', () => card.classList.toggle('collapsed'));
    if (menuA && phoneUI) {   // menu A: the badges live in Learn; the other cards stay hidden until a lesson shows them
      if (id === 'badges') card.classList.add('collapsed');
      phoneUI.learnBody.append(card);
      return card;
    }
    const sheetBody = hud.querySelector('.psheet-body');
    if (document.body.classList.contains('phone') && sheetBody) sheetBody.append(card);
    else right.insertBefore(card, right.querySelector('.card[data-card="moves"]'));
    return card;
  }
  function mountSettings(id, element) {
    element.dataset.settings = id;
    if (dsk) { dsk.mountSettings(id, element); return element; }
    if (menuA && phoneUI) { (phoneUI.optSlots[id] || phoneUI.optSlots.more).append(element); return element; }
    const scene = hud.querySelector('.card[data-card="scene"] .body') || hud.querySelector('.card[data-card="scene"]');
    scene.append(element);
    return element;
  }

  // The bottom of Options (the version line, src/news.js): desktop the end of the Settings tab, phone Menu A the end of the Options sheet.
  function mountFooter(element) {
    const host = dsk ? hud.querySelector('#tp-settings') : menuA && phoneUI ? phoneUI.optSlots.help.parentNode : null;
    host?.append(element);
    return host ? element : null;
  }

  // The News entry (src/news.js, CHE-333): the first row of Options (desktop Settings tab, phone Options sheet). Null when there is no Options here (the old phone menu).
  function mountNewsEntry(element) {
    const sheet = menuA && phoneUI ? phoneUI.sheets?.options : null;
    const host = dsk ? hud.querySelector('#tp-settings') : sheet?.body;
    host?.prepend(element);
    return host ? element : null;
  }
  // the dot on the Options tab (desktop) or the Options button of the bar (phone) while the News are unread
  function setNewsDot(on) {
    if (dsk) dsk.setDot('settings', on);
    else phoneUI?.btn.options?.classList.toggle('odot', !!on);
  }

  // The daily puzzle card (src/puzzles/daily-card.js): the top of the Play tab on desktop, the top of the Game section on a phone.
  function mountDaily(element) {
    const host = dsk ? hud.querySelector('#tp-play') : hud.querySelector('.card[data-card="game"] .body');
    host?.prepend(element);
    translateTree(element);
    return host;
  }

  // ?open=: show one panel and make it usable. Phone: the Menu sheet with that card open. Desktop: the panel tab shown and scrolled
  // into view. 'settings' is the Scene card (or the Menu sheet itself on a phone), 'music' the music block inside it.
  // Returns false for an id that is not a panel here.
  function openPanel(id) {
    if (menuA) return openPanelA(id);
    const PANELS = { settings: 'scene', menu: 'scene', scene: 'scene', music: 'scene', clock: 'scene', moves: 'moves', daily: 'daily', openings: 'openings', drill: 'drill', puzzles: 'puzzles', badges: 'badges' };
    if (!Object.hasOwn(PANELS, id)) return false;
    const card = PANELS[id];
    if (phoneUI) {
      if (card === 'daily') { phoneUI.openCard('game'); hud.querySelector('.dailycard')?.scrollIntoView?.({ block: 'nearest' }); return true; }
      if (card === 'openings') return false;   // phone: the Learn sheet, opened by src/learn
      if (!phoneUI.openCard(id === 'menu' ? null : card)) return false;
      hud.querySelector(`.card[data-card="${card}"]`)?.classList.remove('collapsed');   // a mounted panel card is folded on a phone
    } else if (dsk) {
      // desktop: the panel tab that holds it (Moves on Play, the learning cards on Learn, the rest on Settings), unfolded from the rail
      dsk.setTab(card === 'moves' || card === 'daily' ? 'play' : card === 'scene' ? 'settings' : 'learn');
      if (dsk.rail) dsk.setRail(false, { persist: false });
    } else {
      const c = hud.querySelector(`.card[data-card="${card}"]`);
      if (!c) return false;
      c.classList.remove('collapsed');
    }
    const target = id === 'daily' ? hud.querySelector('.dailycard') : id === 'music' ? hud.querySelector('.music-settings') : id === 'clock' ? hud.querySelector('.clock-settings') : id === 'moves' && dsk ? hud.querySelector('#moves') : hud.querySelector(`.card[data-card="${card}"]`);
    target?.scrollIntoView?.({ block: id === 'music' || id === 'clock' ? 'start' : 'nearest' });
    if (dsk) setTimeout(() => target?.scrollIntoView?.({ block: id === 'music' || id === 'clock' ? 'start' : 'nearest' }), 450);   // again once the panel has unfolded and settled
    return true;
  }

  // Menu A: the old names stay valid as aliases (settings, scene, menu, music, clock, moves, daily, badges) next to the new game, view and
  // options. Phone: the sheet that holds it; desktop: the panel tab. A learn value (openings, drill, puzzles) is src/learn's.
  const A_PLACE = { ...(online ? { online: 'online' } : {}), game: 'play', daily: 'play', moves: 'play', clock: 'play', view: 'view', options: 'options', settings: 'options', scene: 'options', menu: 'options', music: 'options', badges: 'learn', openings: 'learn' };
  const A_TAB = { play: 'play', view: 'settings', options: 'settings', learn: 'learn', online: 'online' };
  function openPanelA(id) {
    if (!Object.hasOwn(A_PLACE, id)) return false;
    const place = A_PLACE[id];
    const target = () => {
      const q = (x) => hud.querySelector(x);
      return { daily: q('.dailycard'), moves: q('#moves'), clock: q('.clock-settings'), music: q('.music-settings'), badges: q('.card[data-card="badges"]'), view: dsk ? q('#presets') : null }[id] || null;
    };
    if (phoneUI) {
      phoneUI.openSheet(place);
    } else if (dsk) {
      dsk.setTab(A_TAB[place]);
      if (dsk.rail) dsk.setRail(false, { persist: false });
    } else return false;
    if (id === 'badges') hud.querySelector('.card[data-card="badges"]')?.classList.remove('collapsed');
    const go = () => target()?.scrollIntoView?.({ block: id === 'music' || id === 'clock' ? 'start' : 'nearest' });
    go();
    if (dsk) setTimeout(go, 450);
    return true;
  }

  // ------------------------------------------------------------ online play (CHE-271): the tab or the sheet, filled by src/online when it loads
  if (online) {
    const host = dsk ? hud.querySelector('#online-host') : phoneUI.sheets.online.body;
    const shown = [];
    const isVisible = () => (dsk ? dsk.tab === 'online' && !dsk.rail : phoneUI.isSheetOpen('online'));
    if (dsk) hud.querySelector('#tab-online').addEventListener('click', () => shown.forEach((fn) => fn()));
    else phoneUI.btn.online.addEventListener('click', () => shown.forEach((fn) => fn()));
    import('./online/index.js').then((m) => m.mountOnline({
      server: online, host, hud, game, controls, toast, isVisible, onShown: (fn) => shown.push(fn),
      setDot: (on, n = 0) => { if (dsk) dsk.setDot('online', on, n); else { const b = phoneUI.btn.online; b.classList.toggle('odot', !!on && !n); b.classList.toggle('ocnt', n > 0); if (n > 0) b.dataset.n = n > 99 ? '99+' : String(n); else delete b.dataset.n; } },
      phone: !dsk,
      showTab: () => { if (dsk) { dsk.setTab('online'); dsk.setRail(false); } else phoneUI.openSheet('online'); shown.forEach((fn) => fn()); },
      closeSheets: () => phoneUI?.close(),
      setBoard: (on) => { if (onlineBoard === !!on) return; onlineBoard = !!on; document.body.classList.toggle('online-game', onlineBoard); goodKey = ''; render(game.getState()); },
    })).catch((e) => console.warn('online play failed to load', e));
  }

  // Phone only: the Learn sheet { body, open(), close(), isOpen }, null elsewhere. src/learn fills the body.
  /** px at the bottom of the canvas that something floating covers (the review strip): the desktop camera fits the board above it */
  function setBottomInset(px) { px = Math.max(0, Math.round(px)); if (px === deskBottom) return; deskBottom = px; if (dsk) deskFrame(); }

  /** the game review shows its game in the Moves list: { sans, kinds, cur (1 based, 0 at the start), pick(n) }, null when it closes */
  function setReviewMoves(v) { revMoves = v; lastMovesKey = null; if (lastSt) render(lastSt); }
  /** desktop: the slot in the panel where the review puts its Details box, null when there is no panel or it is folded to the rail.
   *  reveal() shows the Play tab (unfolding the panel); on(fn) is told when the panel is folded or unfolded */
  const reviewHost = {
    slot: () => (dsk && !dsk.rail ? hud.querySelector('#rv-host') : null),
    reveal: ({ unfold = false } = {}) => { if (!dsk) return; dsk.setTab('play'); if (unfold && dsk.rail) dsk.setRail(false, { persist: false }); },
    on: (fn) => { hostFns.push(fn); },
  };

  return { menuA, confirmAbandon, sync, toast, setBottomInset, setReviewMoves, reviewHost, toggleHud, toggleHelp, render, mountPanel, mountSettings, mountFooter, mountNewsEntry, setNewsDot, mountDaily, openPanel, closeSheets: () => phoneUI?.close(), learnSheet: phoneUI ? phoneUI.learn : null, setLearnBar: phoneUI ? phoneUI.setLearnBar : () => {}, bindGoodMove };
}
