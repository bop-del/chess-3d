// The desktop and tablet layout: one panel on the right with the tabs Play, Learn and Settings, a header above the tabs, a rail
// (the panel folded to an icon strip), a floating view bar on the board area and a keyboard help overlay. Phones do not use
// this file: they keep the thumb bar and the Menu sheet built in src/ui.js (docs/adr/0008-one-panel-layout.md).
// This module owns the markup and the layout behaviour (tabs, rail, bar fade, overlay). The game wiring stays in ui.js, which
// finds the controls here by the same ids the phone layout uses (#btn-new, #btn-undo, #moves, #chk-ai, ...).
import { t, addDE, onLanguage } from './i18n.js';
import './panel.css';

addDE({
  'panel.tab.play': 'Spielen', 'panel.tab.learn': 'Lernen', 'panel.tab.settings': 'Optionen', 'panel.tabs': 'Bereiche',
  'panel.opponent': 'Gegner', 'panel.you': 'Du spielst', 'panel.level': 'Stärke',
  'panel.moves': 'Züge', 'panel.captured': 'Geschlagen',
  'panel.view': 'Ansicht', 'panel.light': 'Licht', 'panel.sound': 'Ton', 'panel.language': 'Sprache', 'panel.quality': 'Qualität',
  'panel.advanced': 'Erweitert', 'panel.advancedHint': 'Kardan, Fortschritt sichern',
  'panel.collapse': 'Panel einklappen (H)', 'panel.expand': 'Panel ausklappen (H)',
  'panel.rail': 'Panel als Leiste',
  'panel.views': 'Ansicht wählen (V)', 'panel.viewsList': 'Ansichten', 'panel.viewBar': 'Ansicht der Kamera',
  'panel.keys': 'Tastenkürzel (?)', 'panel.closeHelp': 'Schließen',
  'panel.kind.openings': 'Eröffnung', 'panel.kind.drill': 'Übung', 'panel.kind.puzzles': 'Rätsel',
  'audio.mute': 'Ton aus',
  'key.hDesk': 'Panel ein- und ausklappen',
});

const SVG = (body, extra = '') => `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"${extra}>${body}</svg>`;
export const ICONS = {
  plus: SVG('<path d="M12 5v14M5 12h14"/>'),
  undo: SVG('<path d="M9 14 4 9l5-5"/><path d="M4 9h10a6 6 0 0 1 0 12h-3"/>'),
  collapse: SVG('<path d="m13 17 5-5-5-5M6 17l5-5-5-5"/>'),
  expand: SVG('<path d="m11 17-5-5 5-5M18 17l-5-5 5-5"/>'),
  play: SVG('<path d="M12 3c-2 0-3 1.5-3 3 0 1 .5 2 1.2 2.5L8 14h8l-2.2-5.5C14.5 8 15 7 15 6c0-1.5-1-3-3-3ZM7 17h10l1 4H6l1-4Z"/>'),
  learn: SVG('<path d="M3 6c3-1.5 6-1.5 9 0v14c-3-1.5-6-1.5-9 0V6ZM21 6c-3-1.5-6-1.5-9 0v14c3-1.5 6-1.5 9 0V6Z"/>'),
  gear: SVG('<circle cx="12" cy="12" r="3"/><path d="M12 2v3M12 19v3M2 12h3M19 12h3M4.9 4.9l2.1 2.1M17 17l2.1 2.1M4.9 19.1 7 17M17 7l2.1-2.1"/>'),
  eye: SVG('<path d="M2 12s3.5-7 10-7 10 7 10 7-3.5 7-10 7S2 12 2 12Z"/><circle cx="12" cy="12" r="3"/>'),
  flip: SVG('<path d="M7 4v16M7 4 3 8M7 4l4 4M17 20V4M17 20l-4-4M17 20l4-4"/>'),
  orbit: SVG('<path d="M20 12a8 8 0 1 1-3-6.2"/><path d="M20 4v4h-4"/>'),
  reset: SVG('<circle cx="12" cy="12" r="8"/><circle cx="12" cy="12" r="2"/>'),
  lock: SVG('<rect x="5" y="11" width="14" height="10" rx="2"/><path d="M8 11V8a4 4 0 0 1 8 0v3"/>'),
  bulb: SVG('<path d="M9 18h6M10 21h4M12 3a6 6 0 0 0-4 10.5c.7.7 1 1.5 1 2.5h6c0-1 .3-1.8 1-2.5A6 6 0 0 0 12 3Z"/>'),
  chev: SVG('<path d="m9 6 6 6-6 6"/>'),
  up: SVG('<path d="m6 15 6-6 6 6"/>'),
  close: SVG('<path d="M6 6l12 12M18 6 6 18"/>'),
};
// one small icon per view id (the views list in src/views/registry.js is the source of the ids)
export const VIEW_ICONS = {
  white: SVG('<path d="M7 5h10l3 12H4L7 5Z"/><circle cx="12" cy="20" r="1" fill="currentColor"/>'),
  black: SVG('<path d="M4 7h16l-3 12H7L4 7Z"/><circle cx="12" cy="4" r="1" fill="currentColor"/>'),
  top: SVG('<rect x="4" y="4" width="16" height="16" rx="1"/><path d="M4 12h16M12 4v16"/>'),
  side: SVG('<path d="M3 15 12 19l9-4-9-4-9 4Z"/>'),
  iso: SVG('<path d="m12 3 9 5-9 5-9-5 9-5ZM3 8v8l9 5 9-5V8"/>'),
  tokens: SVG('<circle cx="12" cy="12" r="8"/><circle cx="12" cy="12" r="4"/>'),
  symbols: SVG('<rect x="4" y="4" width="16" height="16" rx="1"/><path d="M12 8v1.5M10.5 9.5h3M10 16h4M10.7 11.5h2.6l.7 4.5h-4l.7-4.5Z"/>'),
  above: SVG('<rect x="4" y="5" width="16" height="14" rx="1"/><path d="M4 12h16M12 5v14"/><circle cx="8" cy="8.5" r="1.2" fill="currentColor"/>'),
  'easy-3d': SVG('<path d="m4 9 8-4 8 4-8 4-8-4Z"/><path d="m4 9 0 4 8 4 8-4V9"/>'),
  play: SVG('<rect x="7" y="3" width="10" height="18" rx="2"/><path d="M11 18h2"/>'),
};

const el = (tag, cls, html) => {
  const e = document.createElement(tag);
  if (cls) e.className = cls;
  if (html != null) e.innerHTML = html;
  return e;
};

/**
 * A row of visible choices that stands in for a <select>: it has a `value` and fires 'change', so the code that used a select
 * works unchanged. items: [{ value, label, small?, color? }]. `color` makes it a swatch (a dot of that colour above the label).
 */
export function chipGroup(id, items, { label = '', cls = 'chips' } = {}) {
  const box = el('div', cls);
  if (id) box.id = id;
  box.setAttribute('role', 'radiogroup');
  if (label) box.setAttribute('aria-label', label);
  let value = null;
  const buttons = new Map();
  const mark = () => { for (const [v, b] of buttons) { b.classList.toggle('on', v === value); b.setAttribute('aria-checked', String(v === value)); b.tabIndex = v === value || (value == null && buttons.keys().next().value === v) ? 0 : -1; } };
  const build = (list) => {
    buttons.clear();
    box.replaceChildren();
    for (const it of list) {
      const b = el('button', cls.startsWith('chips') ? 'chip' : 'swatch');
      b.type = 'button';
      b.dataset.value = it.value;
      b.setAttribute('role', 'radio');
      if (it.color) { b.style.setProperty('--sw-a', it.color); b.style.setProperty('--sw-b', it.color2 || it.color); }
      b.innerHTML = it.color ? '<i></i><b></b>' : '<span></span><small></small>';
      b.addEventListener('click', () => { if (value === it.value) return; value = it.value; mark(); box.dispatchEvent(new Event('change', { bubbles: true })); });
      buttons.set(it.value, b);
      box.append(b);
    }
    relabel(list);
    mark();
  };
  const relabel = (list) => {
    for (const it of list) {
      const b = buttons.get(it.value);
      if (!b) continue;
      if (it.color) { b.querySelector('b').textContent = it.label; b.title = it.label; } else { b.querySelector('span').textContent = it.label; b.querySelector('small').textContent = it.small || ''; }
      b.setAttribute('aria-label', it.small ? `${it.label} ${it.small}` : it.label);
    }
  };
  // arrow keys move inside the group like a radio group
  box.addEventListener('keydown', (e) => {
    const k = e.key === 'ArrowRight' || e.key === 'ArrowDown' ? 1 : e.key === 'ArrowLeft' || e.key === 'ArrowUp' ? -1 : 0;
    if (!k) return;
    const keys = [...buttons.keys()], i = keys.indexOf(value);
    const next = buttons.get(keys[(i + k + keys.length) % keys.length]);
    if (next) { e.preventDefault(); next.click(); next.focus(); }
    e.stopPropagation();
  });
  Object.defineProperty(box, 'value', { get: () => value, set: (v) => { value = buttons.has(v) ? v : value; mark(); } });
  box.setItems = build;
  box.relabel = relabel;
  build(items);
  return box;
}

const BAR_FADE_MS = 3200;

/** Builds the panel, the rail, the view bar and the help overlay inside `hud`. Returns what ui.js needs to wire. */
export function createDesktop({ hud, onLayout = () => {}, keyRows = () => '', fade = true }) {
  const tabsDef = [['play', 'Play', ICONS.play], ['learn', 'Learn', ICONS.learn], ['settings', 'Settings', ICONS.gear]];
  const root = el('aside', 'panel');
  root.id = 'panel';
  root.innerHTML = `
    <header class="phead">
      <div class="logo" aria-hidden="true">&#x265E;&#xFE0E;</div>
      <div class="turn" id="turn"><i class="dot w"></i><div class="status"><b id="turn-main">White to move</b><small id="turn-sub">&nbsp;</small></div></div>
      <div class="hbtns">
        <button class="ib gold" id="btn-new" type="button" title="New game (N)" aria-label="New game" data-i18n-title="hud.newGameTitle" data-i18n-aria="hud.newGame">${ICONS.plus}</button>
        <button class="ib" id="btn-undo" type="button" title="Undo (U)" aria-label="Undo" data-i18n-title="hud.undoTitle" data-i18n-aria="hud.undo">${ICONS.undo}</button>
        <button class="ib" id="btn-rail" type="button" title="Fold the panel (H)" aria-label="Fold the panel" data-i18n-title="panel.collapse" data-i18n-aria="panel.collapse">${ICONS.collapse}</button>
      </div>
      <div class="pclock" id="pclock" hidden></div>
    </header>
    <nav class="tabs" role="tablist" aria-label="Sections" data-i18n-aria="panel.tabs">
      ${tabsDef.map(([id, label, icon]) => `<button class="tab" type="button" role="tab" id="tab-${id}" data-tab="${id}" aria-controls="tp-${id}">${icon}<span data-i18n="panel.tab.${id}">${label}</span></button>`).join('')}
    </nav>
    <div class="pbody">
      <section class="tp" id="tp-play" data-tp="play" role="tabpanel" aria-labelledby="tab-play">
        <div class="sec">
          <h4 data-i18n="panel.opponent">Opponent</h4>
          <label class="switch row-switch"><input type="checkbox" id="chk-ai"><span class="track"><i></i></span><em data-i18n="hud.vsComputer">vs computer</em></label>
          <div class="opp" id="opp"></div>
        </div>
        <button class="ghost" id="btn-good" type="button" title="Show one good move" data-i18n-title="good.title">${ICONS.bulb}<span data-i18n="good.label">Good move?</span></button>
        <div class="sec grow">
          <h4 data-i18n="panel.moves">Moves</h4>
          <ol class="moves" id="moves"></ol>
        </div>
        <div class="sec cap-sec">
          <h4 data-i18n="panel.captured">Captured</h4>
          <div class="cap"><span class="who" data-i18n="hud.byWhite">By white</span><span class="glyphs b" id="cap-b"></span><span class="adv" id="adv-w"></span></div>
          <div class="cap"><span class="who" data-i18n="hud.byBlack">By black</span><span class="glyphs w" id="cap-w"></span><span class="adv" id="adv-b"></span></div>
        </div>
        <div class="foot"><button class="linkbtn" id="btn-help" type="button" title="Keyboard shortcuts (?)" data-i18n="panel.keys" data-i18n-title="hud.keysTitle">Keyboard shortcuts (?)</button></div>
      </section>
      <section class="tp" id="tp-learn" data-tp="learn" role="tabpanel" aria-labelledby="tab-learn" hidden><div class="lhost" id="learn-host"></div></section>
      <section class="tp" id="tp-settings" data-tp="settings" role="tabpanel" aria-labelledby="tab-settings" hidden>
        <div class="sec"><h4 data-i18n="panel.view">View</h4><div class="views" id="presets"></div></div>
        <div class="sec" data-slot="themes"></div>
        <div class="sec"><h4 data-i18n="panel.light">Light</h4><div id="light-slot"></div></div>
        <div class="sec" data-slot="battle"></div>
        <div class="sec" data-slot="clock"></div>
        <div class="sec"><h4 data-i18n="panel.sound">Sound</h4><div class="stack" data-slot="audio"></div><div class="stack" data-slot="music"></div></div>
        <div class="sec"><h4 data-i18n="panel.quality">Quality</h4><div id="quality-slot"></div></div>
        <div class="sec"><h4 data-i18n="panel.language">Language</h4>
          <div class="lang" role="group" aria-label="Language" data-i18n-aria="lang.label"><button class="lang-btn" type="button" data-lang="en" aria-label="English">EN</button><button class="lang-btn" type="button" data-lang="de" aria-label="Deutsch">DE</button></div></div>
        <div class="sec" data-slot="more"></div>
        <details class="fold" id="advanced">
          <summary><span data-i18n="panel.advanced">Advanced</span><small data-i18n="panel.advancedHint">Gimbal, back up progress</small>${ICONS.chev}</summary>
          <div class="fold-body">
            <div class="sliders" id="sliders"></div>
            <div class="stack" data-slot="train-data"></div>
          </div>
        </details>
      </section>
    </div>
    <div class="rail-icons" role="toolbar" aria-label="Panel" data-i18n-aria="panel.rail">
      <button class="ib" id="btn-rail-open" type="button" title="Unfold the panel (H)" aria-label="Unfold the panel" data-i18n-title="panel.expand" data-i18n-aria="panel.expand">${ICONS.expand}</button>
      ${tabsDef.map(([id, label, icon]) => `<button class="ib" type="button" data-rtab="${id}" title="${label}" aria-label="${label}" data-i18n-title="panel.tab.${id}" data-i18n-aria="panel.tab.${id}">${icon}</button>`).join('')}
    </div>`;

  // view bar: view picker, Flip, Spin, Reset, Lock
  const bar = el('div', 'viewbar');
  bar.setAttribute('role', 'toolbar');
  bar.setAttribute('aria-label', 'Camera');
  bar.dataset.i18nAria = 'panel.viewBar';
  bar.innerHTML = `
    <div class="vpick">
      <button class="vb primary" id="btn-views" type="button" aria-haspopup="true" aria-expanded="false" title="Choose a view (V)" data-i18n-title="panel.views">${ICONS.eye}<span id="views-name">White view</span><i class="vcaret">${ICONS.up}</i></button>
      <div class="vmenu" id="vmenu" role="menu" hidden></div>
    </div>
    <span class="vsep"></span>
    <button class="vb ico" id="btn-flip" type="button" title="Flip to the other side (F)" aria-label="Flip" data-i18n-title="hud.flipTitle" data-i18n-aria="hud.flip">${ICONS.flip}</button>
    <button class="vb ico toggle" id="btn-spin" type="button" title="Auto spin (Space)" aria-label="Spin" data-i18n-title="hud.spinTitle" data-i18n-aria="hud.spin">${ICONS.orbit}</button>
    <button class="vb ico" id="btn-reset" type="button" title="Reset view (R)" aria-label="Reset" data-i18n-title="hud.resetTitle" data-i18n-aria="hud.reset">${ICONS.reset}</button>
    <button class="vb ico toggle" id="btn-lock" type="button" aria-pressed="false" title="Lock the view" aria-label="Lock the view" data-i18n-title="hud.lockTitle" data-i18n-aria="hud.lockView">${ICONS.lock}</button>
    <input type="checkbox" id="chk-lock" hidden>`;

  // keyboard help overlay
  const help = el('div', 'kbov');
  help.id = 'help';
  help.hidden = true;
  help.setAttribute('role', 'dialog');
  help.setAttribute('aria-modal', 'true');
  help.setAttribute('aria-labelledby', 'kb-title');
  help.innerHTML = `<div class="kbcard"><header><h2 id="kb-title" data-i18n="hud.keyboardMouse">Keyboard and mouse</h2><button class="ib" id="kb-close" type="button" aria-label="Close" data-i18n-aria="panel.closeHelp">${ICONS.close}</button></header><dl id="help-keys">${keyRows()}</dl></div>`;

  hud.append(root, bar, help);
  const $ = (s, r = root) => r.querySelector(s);

  // ------------------------------------------------------------ tabs
  let tab = 'play';
  function setTab(id, { focus = false } = {}) {
    if (!tabsDef.some(([k]) => k === id)) return;
    tab = id;
    for (const b of root.querySelectorAll('.tab')) {
      const on = b.dataset.tab === id;
      b.classList.toggle('on', on); b.setAttribute('aria-selected', String(on)); b.tabIndex = on ? 0 : -1;
    }
    for (const b of root.querySelectorAll('[data-rtab]')) b.classList.toggle('on', b.dataset.rtab === id);
    for (const p of root.querySelectorAll('.tp')) p.hidden = p.dataset.tp !== id;
    root.dataset.tab = id;
    if (focus) $(`.tab[data-tab="${id}"]`)?.focus();
  }
  for (const b of root.querySelectorAll('.tab')) b.addEventListener('click', () => setTab(b.dataset.tab));
  $('.tabs').addEventListener('keydown', (e) => {
    const i = tabsDef.findIndex(([k]) => k === tab);
    const d = e.key === 'ArrowRight' ? 1 : e.key === 'ArrowLeft' ? -1 : 0;
    if (!d) return;
    e.preventDefault(); e.stopPropagation();
    setTab(tabsDef[(i + d + tabsDef.length) % tabsDef.length][0], { focus: true });
  });
  for (const b of root.querySelectorAll('[data-rtab]')) b.addEventListener('click', () => { setTab(b.dataset.rtab); setRail(false); });

  // ------------------------------------------------------------ rail
  const RAIL_KEY = 'chess3d.rail';
  const stored = () => { try { return localStorage.getItem(RAIL_KEY); } catch (e) { return null; } };
  let rail = false;
  function setRail(on, { persist = true } = {}) {
    rail = !!on;
    hud.classList.toggle('rail', rail);
    root.classList.toggle('rail', rail);
    root.querySelectorAll('.phead, .tabs, .pbody').forEach((x) => { x.inert = rail; });
    root.querySelector('.rail-icons').inert = !rail;
    if (persist) { try { localStorage.setItem(RAIL_KEY, rail ? '1' : '0'); } catch (e) { /* storage blocked */ } }
    layout();
  }
  $('#btn-rail').addEventListener('click', () => setRail(true));
  $('#btn-rail-open').addEventListener('click', () => setRail(false));
  // a window narrower than 900 px opens as the rail unless the player chose
  const first = stored();
  rail = first === '1' || (first == null && window.innerWidth < 900);

  // The camera is told how much of the canvas the panel covers (controls.setFrame). A ResizeObserver follows the width while it
  // animates, so the board glides to the middle of what is left.
  let lastW = -1;
  function layout() {
    const w = hud.classList.contains('hidden') ? 0 : Math.round(root.getBoundingClientRect().width);
    if (w === lastW) return;
    lastW = w;
    document.documentElement.style.setProperty('--panel-w', `${w}px`);
    onLayout(w);
  }
  if (window.ResizeObserver) new ResizeObserver(layout).observe(root);
  addEventListener('resize', layout);

  // ------------------------------------------------------------ view bar: fade and picker
  const vmenu = $('#vmenu', bar), vbtn = $('#btn-views', bar);
  let fadeT = 0;
  const menuOpen = () => !vmenu.hidden;
  function wake() {
    bar.classList.remove('idle');
    clearTimeout(fadeT);
    if (!fade) return;
    fadeT = setTimeout(() => { if (!menuOpen() && !bar.matches(':hover') && !bar.contains(document.activeElement)) bar.classList.add('idle'); else wake(); }, BAR_FADE_MS);
  }
  for (const ev of ['pointermove', 'pointerdown', 'keydown', 'wheel']) window.addEventListener(ev, wake, { passive: true });
  bar.addEventListener('focusin', wake);
  wake();
  function setMenu(open) {
    vmenu.hidden = !open;
    vbtn.setAttribute('aria-expanded', String(open));
    bar.classList.toggle('menu', open);
    if (open) { vmenu.querySelector('.on, button')?.focus(); wake(); }
  }
  vbtn.addEventListener('click', () => setMenu(!menuOpen()));
  document.addEventListener('pointerdown', (e) => { if (menuOpen() && !e.target.closest('.vpick')) setMenu(false); });
  vmenu.addEventListener('click', () => setMenu(false));
  vmenu.addEventListener('keydown', (e) => {
    const items = [...vmenu.querySelectorAll('button')], i = items.indexOf(document.activeElement);
    if (e.key === 'ArrowDown' || e.key === 'ArrowUp') { e.preventDefault(); e.stopPropagation(); items[(i + (e.key === 'ArrowDown' ? 1 : -1) + items.length) % items.length]?.focus(); }
    else if (e.key === 'Escape') { e.stopPropagation(); setMenu(false); vbtn.focus(); }
  });

  // ------------------------------------------------------------ help overlay
  let helpFrom = null;
  const helpApi = {
    get open() { return !help.hidden; },
    show() { if (!help.hidden) return; helpFrom = document.activeElement; help.hidden = false; $('#kb-close', help).focus(); },
    hide() { if (help.hidden) return; help.hidden = true; try { helpFrom?.focus?.(); } catch (e) { /* gone */ } helpFrom = null; },
    toggle() { if (help.hidden) helpApi.show(); else helpApi.hide(); },
  };
  $('#kb-close', help).addEventListener('click', helpApi.hide);
  help.addEventListener('pointerdown', (e) => { if (e.target === help) helpApi.hide(); });
  help.addEventListener('keydown', (e) => {   // Tab stays inside the card
    if (e.key === 'Tab') { e.preventDefault(); $('#kb-close', help).focus(); }
  });

  // ------------------------------------------------------------ mounting by other modules
  const slot = (id) => root.querySelector(`[data-slot="${id}"]`);
  function mountSettings(id, element) {
    const target = slot(id) || slot('more');
    target.append(element);
    if (id === 'themes' || id === 'battle') target.hidden = false;
    return element;
  }
  function mountPanel(id, element, { title = id } = {}) {
    const card = el('section', 'card lcard');
    card.dataset.card = id;
    card.innerHTML = `<header><h2>${title}</h2></header><div class="body"></div>`;
    card.querySelector('.body').append(element);
    $('#learn-host').append(card);
    return card;
  }

  setTab('play');
  setRail(rail, { persist: false });
  onLanguage(() => { /* strings are translated by translateTree(hud) in ui.js */ });

  return {
    root, bar, help, helpApi, setTab, setRail, layout, mountSettings, mountPanel,
    get tab() { return tab; }, get rail() { return rail; },
    viewsName: $('#views-name', bar), vmenu, wake,
    chips: { chipGroup },
  };
}
