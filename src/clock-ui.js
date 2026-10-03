// The clock's faces and its chooser. Desktop: two faces in the panel header (opponent above, player below), the chooser in the
// Settings tab. Phone: two compact faces in the status line (.pstatus), the chooser in the Menu sheet. Both come from the same
// markup, the stylesheets (panel.css, style.css) place them. The core is src/clock.js; this file only shows it.
//   initialPreset(flag) -> the preset a page starts with: ?clock=<preset> beats the remembered one (localStorage chess3d.clock)
//   mountClock({ ui, game, clock, flagged }) -> { tick(dt), render(), choose(preset) }
// A preset chosen while a game is running applies at the next new game (a one line hint says so); with no game running it applies at once.
import { t, addDE, onLanguage, translateTree } from './i18n.js';
import { chipGroup } from './panel.js';
import { PRESET_IDS, formatTime, normalizePreset } from './clock.js';

addDE({
  'clock.title': 'Uhr', 'clock.off': 'Aus', 'clock.hint': 'Gilt ab der nächsten Partie.', 'clock.label': 'Bedenkzeit',
  'clock.face': '{side}: {time}',
  'turn.timeout': 'Zeit abgelaufen. {side} gewinnt', 'banner.time': 'Zeit abgelaufen',
  'reason.time': 'Zeit abgelaufen', 'reason.timeDraw': 'Zeit abgelaufen, Remis, der Gegner hat nur den König',
});

const KEY = 'chess3d.clock';
const LOW = 30;   // seconds: under this a face warns (colour and bold)
let memory = null;   // blocked storage: the choice lives for this page
const readStored = () => { try { return normalizePreset(localStorage.getItem(KEY)) || memory; } catch (e) { return memory; } };
const writeStored = (p) => { memory = p; try { localStorage.setItem(KEY, p); } catch (e) { /* storage blocked: kept in memory */ } };

export function initialPreset(flag) {
  return normalizePreset(flag) || readStored() || 'off';
}

const face = (c) => `<div class="cface" data-c="${c}"><i class="dot ${c}"></i><span class="cn"></span><b class="ct">0:00</b></div>`;

export function mountClock({ ui, game, clock }) {
  // ---- the faces: the desktop panel has #pclock, a phone gets one inside its status line
  let bar = document.getElementById('pclock');
  if (!bar) {
    const status = document.querySelector('.pstatus');
    if (status) { bar = document.createElement('span'); bar.className = 'pclock'; status.append(bar); }
  }
  if (bar) bar.innerHTML = face('b') + face('w');
  const faces = {};
  if (bar) for (const c of ['w', 'b']) faces[c] = { el: bar.querySelector(`.cface[data-c="${c}"]`), ct: bar.querySelector(`.cface[data-c="${c}"] .ct`), cn: bar.querySelector(`.cface[data-c="${c}"] .cn`), text: '', cls: '', label: '' };
  const sideName = (c) => (c === 'w' ? t('side.white', 'White') : t('side.black', 'Black'));
  let shown = null;

  function render() {
    const s = clock.state();
    const on = s.enabled && !s.suspended;
    if (on !== shown) { shown = on; document.body.classList.toggle('clock-on', on); if (bar) bar.hidden = !on; }
    if (on && bar) {
      const bottom = s.untimed === 'w' ? 'b' : 'w';   // the player's face is the lower one; the computer's face is hidden
      if (bar.dataset.bottom !== bottom) bar.dataset.bottom = bottom;
      for (const c of ['w', 'b']) {
        const f = faces[c];
        const secs = s[c];
        const text = formatTime(secs);
        const run = s.running && s.active === c && s.untimed !== c;
        const cls = `cface${run ? ' run' : ''}${secs < LOW && s.untimed !== c ? ' low' : ''}${s.flagged === c ? ' out' : ''}`;
        if (cls !== f.cls) { f.cls = cls; f.el.className = cls; }
        if (f.el.hidden !== (s.untimed === c)) f.el.hidden = s.untimed === c;
        if (text !== f.text) { f.text = text; f.ct.textContent = text; }
        const name = sideName(c);
        if (f.cn.textContent !== name) f.cn.textContent = name;
        const label = t('clock.face', '{side}: {time}', { side: name, time: text });
        if (label !== f.label) { f.label = label; f.el.setAttribute('aria-label', label); f.el.setAttribute('role', 'img'); }
        if (run) f.el.setAttribute('aria-current', 'true'); else f.el.removeAttribute('aria-current');
      }
    }
    const st = game.getState();
    const running = st.moves.length > 0 && !st.over;
    const pending = s.next !== s.preset && running;
    if (hint.hidden === pending) hint.hidden = !pending;
  }

  // ---- the chooser
  const block = document.createElement('div');
  block.className = 'clock-settings';
  block.innerHTML = '<h4 data-i18n="clock.title">Clock</h4>';
  const labels = () => PRESET_IDS.map((id) => ({ value: id, label: id === 'off' ? t('clock.off', 'Off') : id }));
  const sel = chipGroup('sel-clock', labels(), { label: t('clock.label', 'Time control') });
  const hint = document.createElement('p');
  hint.className = 'clock-hint';
  hint.dataset.i18n = 'clock.hint';
  hint.textContent = 'Applies from the next game.';
  hint.hidden = true;
  block.append(sel, hint);
  sel.value = clock.state().next;
  ui.mountSettings('clock', block);
  translateTree(block);

  function choose(preset, { persist = true } = {}) {
    const p = normalizePreset(preset);
    if (!p) return false;
    clock.choose(p);
    sel.value = p;
    if (persist) writeStored(p);
    const st = game.getState();
    if (!(st.moves.length > 0 && !st.over)) clock.reset();   // nothing to lose: the new time control is in force now
    render();
    return true;
  }
  sel.addEventListener('change', () => choose(sel.value));
  onLanguage(() => { sel.relabel(labels()); translateTree(block); render(); });
  game.on('change', render);
  game.on('newgame', render);
  render();

  return { tick(dt) { clock.tick(dt); render(); }, render, choose, get element() { return bar; } };
}
