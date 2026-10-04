// The clock's faces and its chooser. Desktop: two faces in the panel header (opponent above, player below), the chooser in the
// Settings tab. Phone: two compact faces in the status line (.pstatus), the chooser in the Menu sheet. Both come from the same
// markup, the stylesheets (panel.css, style.css) place them. The core is src/clock.js; this file only shows it.
//   initialPreset(flag) -> the preset a page starts with: ?clock=<preset> beats the remembered one (localStorage chess3d.clock)
//   mountClock({ ui, game, clock, flagged }) -> { tick(dt), render(), choose(preset) }
// A preset chosen while a game is on the board (moves made, over or not) applies at the next new game: a hint says so and offers a
// button that starts that game now. With a fresh board it applies at once. A desktop panel folded to its rail (or a window under 900 px)
// hides the header, so the faces are also drawn in a small floating bar beside the rail (.rail-clock).
import { t, addDE, onLanguage, translateTree } from './i18n.js';
import { chipGroup } from './panel.js';
import { PRESET_IDS, formatTime, normalizePreset } from './clock.js';

addDE({
  'clock.title': 'Uhr', 'clock.off': 'Aus', 'clock.hint': 'Gilt ab der nächsten Partie.', 'clock.now': 'Neue Partie jetzt starten', 'clock.label': 'Bedenkzeit',
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
  // ---- the faces: the desktop panel has #pclock, a phone gets one inside its status line. A desktop also gets a floating copy for
  // the folded rail, where the panel header is not shown.
  let bar = document.getElementById('pclock');
  const bars = [];
  if (!bar) {
    const status = document.querySelector('.pstatus');
    if (status) { bar = document.createElement('span'); bar.className = 'pclock'; status.append(bar); }
  } else {
    const hud = document.getElementById('hud');
    if (hud) {
      const float = document.createElement('div');
      float.className = 'pclock rail-clock';
      float.setAttribute('aria-hidden', 'true');   // the panel header copy is the one announced
      hud.append(float);
      bars.push(float);
    }
  }
  if (bar) bars.unshift(bar);
  const facesOf = (b) => { const f = {}; for (const c of ['w', 'b']) f[c] = { el: b.querySelector(`.cface[data-c="${c}"]`), ct: b.querySelector(`.cface[data-c="${c}"] .ct`), cn: b.querySelector(`.cface[data-c="${c}"] .cn`), text: '', cls: '', label: '' }; return f; };
  for (const b of bars) b.innerHTML = face('b') + face('w');
  const sets = bars.map((b) => ({ bar: b, faces: facesOf(b) }));
  const onBoard = () => game.getState().moves.length > 0;   // a game is on the board (running or finished): a new time control waits for the next one
  const sideName = (c) => (c === 'w' ? t('side.white', 'White') : t('side.black', 'Black'));
  let shown = null;

  function render() {
    const s = clock.state();
    const on = s.enabled && !s.suspended;
    if (on !== shown) { shown = on; document.body.classList.toggle('clock-on', on); for (const { bar: b } of sets) b.hidden = !on; }
    if (on) {
      const bottom = s.untimed === 'w' ? 'b' : 'w';   // the player's face is the lower one; the computer's face is hidden
      for (const { bar: b, faces } of sets) {
        if (b.dataset.bottom !== bottom) b.dataset.bottom = bottom;
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
    }
    const pending = s.next !== s.preset && onBoard();
    if (hint.hidden === pending) hint.hidden = !pending;
  }
  // ---- the chooser
  const block = document.createElement('div');
  block.className = 'clock-settings';
  block.innerHTML = '<h4 data-i18n="clock.title">Clock</h4>';
  const labels = () => PRESET_IDS.map((id) => ({ value: id, label: id === 'off' ? t('clock.off', 'Off') : id }));
  const sel = chipGroup('sel-clock', labels(), { label: t('clock.label', 'Time control') });
  const hint = document.createElement('div');
  hint.className = 'clock-hint';
  hint.hidden = true;
  const hintText = document.createElement('p');
  hintText.dataset.i18n = 'clock.hint';
  hintText.textContent = 'Applies from the next game.';
  const now = document.createElement('button');
  now.type = 'button';
  now.className = 'btn small clock-now';
  now.dataset.i18n = 'clock.now';
  now.textContent = 'Start a new game now';
  hint.append(hintText, now);
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
    if (!onBoard()) clock.reset();   // a fresh board: the new time control is in force now
    render();
    return true;
  }
  sel.addEventListener('change', () => choose(sel.value));
  now.addEventListener('click', () => { game.newGame(); ui.closeSheets?.(); });   // the newgame event resets the clock to the chosen preset
  onLanguage(() => { sel.relabel(labels()); translateTree(block); render(); });
  game.on('change', render);
  game.on('newgame', render);
  render();

  return { tick(dt) { clock.tick(dt); render(); }, render, choose, get element() { return bar; } };
}
