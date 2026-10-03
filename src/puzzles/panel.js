// Puzzles panel: the puzzle in progress, in the look of the Drill and Explain panels (same classes, explain.css). Phone: a
// strip under the status line, because the theme line is about the position and a sheet would hide it. Desktop: one card in
// the right column. It shows the theme line, the band, one calm message and the buttons.
// The idle side (Start or Next) is the Learn tab, built by puzzlesTab() below.
import * as I18N from '../i18n.js';
import { device } from '../device.js';
import { THEMES } from './themes.js';
import './strings.js';
import './puzzles.css';

const { t, onLanguage, i18n } = I18N;

const el = (tag, cls, text) => {
  const e = document.createElement(tag);
  if (cls) e.className = cls;
  if (text != null) e.textContent = text;
  return e;
};
export const themeLine = (id) => (THEMES[id] ? THEMES[id][i18n.language] || THEMES[id].en : '');
export const bandName = (b) => t(`puzzles.band.${b}`, b[0].toUpperCase() + b.slice(1));

const SAY = {
  start: ['puzzles.your', 'Your move.'],
  your: ['puzzles.your', 'Your move.'],
  right: ['puzzles.right', 'Right. The opponent replies.'],
  wrong: ['puzzles.wrong', 'Not this one. Try again.'],
  again: ['puzzles.again', 'Not yet. Take your time.'],
  help: ['puzzles.helpShown', 'The gold arrow shows the move.'],
};
function sentence(s) {
  const m = s.message?.type;
  if (m === 'solved') return s.clean ? t('puzzles.solved', 'Solved!') : t('puzzles.solvedLater', 'Solved. Play it again from the path for gold.');
  const k = SAY[m];
  return k ? t(k[0], k[1]) : '';
}

export function mountPuzzlesPanel({ puzzles, ui = null, onClose = null, progress = null, openPath = () => {} }) {
  const root = el('div', 'xp pzp');
  const card = ui?.mountPanel ? ui.mountPanel('puzzles', root, { title: t('puzzles.tab', 'Puzzles') }) : null;
  const strip = device.phone ? el('section', 'xstrip pzstrip') : null;
  if (strip) {
    strip.hidden = true;
    strip.setAttribute('aria-live', 'polite');
    document.getElementById('hud').append(strip);
  }
  if (card) card.hidden = true;

  const button = (label, cls, fn) => {
    const b = el('button', `btn ${cls || ''}`.trim(), label);
    b.type = 'button';
    b.addEventListener('click', fn);
    return b;
  };
  const close = () => (onClose ? onClose() : puzzles.stop());

  function body(s, compact) {
    const box = el('div', 'xwalk');
    const head = el('div', 'xhead');
    const title = el('div', 'xtitle');
    title.append(el('b', 'pztheme', themeLine(s.theme)), el('span', 'xside pzband', bandName(s.band)));
    head.append(title);
    if (!compact) {   // phone: Beenden sits in the learning bar
      const x = button(t('puzzles.stop', 'Stop'), 'xclose', close);
      x.setAttribute('aria-label', t('puzzles.stop', 'Stop'));
      head.append(x);
    }
    const text = el('p', 'xtext pzsay', sentence(s));
    text.dataset.kind = s.message?.type === 'wrong' || s.message?.type === 'again' ? 'wrong' : s.message?.type || '';
    box.append(head, text);
    if (compact) return box;
    const row = el('div', 'xrow');
    if (s.phase === 'solved') row.append(button(t('puzzles.next', 'Next puzzle'), 'primary pznext', () => puzzles.next()));
    else row.append(button(t('puzzles.help', 'Help'), 'pzhelp', () => puzzles.help()));
    row.lastChild.disabled = s.phase === 'solved' ? false : !s.canHelp;
    box.append(row);
    return box;
  }

  // phone: the thumb bar becomes the controls: Help, Next (gold, once solved), Path, End. A finished chapter makes Next open the path.
  function learnBar(s) {
    const solved = s.phase === 'solved';
    const done = !!progress?.stats?.().finished;
    const out = [{ id: 'help', icon: 'good', label: t('lb.help', 'Help'), aria: t('puzzles.help', 'Help'), disabled: !s.canHelp, run: () => puzzles.help() }];
    if (solved) out.push({ id: 'next', icon: 'next', label: t('lb.next', 'Next'), aria: t('puzzles.next', 'Next puzzle'), primary: true, run: () => (done ? openPath() : puzzles.next()) });
    out.push({ id: 'path', icon: 'path', label: t('lb.path', 'Path'), aria: t('lb.path', 'Path'), run: () => openPath() });
    out.push({ id: 'end', icon: 'end', label: t('lb.end', 'End'), aria: t('puzzles.stop', 'Stop'), run: close });
    return out;
  }

  function render() {
    const s = puzzles.state();
    ui?.setLearnBar?.('puzzles', strip && s.phase !== 'idle' ? learnBar(s) : null);
    const live = s.phase !== 'idle';
    if (card) { card.hidden = !live || !!strip; card.querySelector('h2').textContent = t('puzzles.tab', 'Puzzles'); }
    document.body.classList.toggle('puzzling', live);
    if (!live) {
      root.replaceChildren();
      if (strip) { strip.hidden = true; strip.replaceChildren(); document.body.style.setProperty('--ph', '0px'); }
      return;
    }
    if (strip) {
      strip.hidden = false;
      strip.replaceChildren(body(s, true));
      document.body.style.setProperty('--ph', `${strip.offsetHeight}px`);
    } else root.replaceChildren(body(s, false));
  }

  puzzles.on(render);
  onLanguage(render);
  if (strip && window.ResizeObserver) new ResizeObserver(() => { if (!strip.hidden) document.body.style.setProperty('--ph', `${strip.offsetHeight}px`); }).observe(strip);
  render();
  return { card, strip, root };
}

// The Learn tab: the puzzle path. A header (level, chapter), ten small chapter badges, the current chapter as a winding road of
// stations, one big Start / Continue button. Gold station: solved clean. Silver: played with a miss or Help. The next one
// glows. Tap a station to play it, any chapter badge to look at that chapter. A chapter that the last solve finished shows
// all its stations lit and a Next chapter button. `onStart` lets the Learn sheet close itself and stop whatever else runs on
// the board before the puzzle opens. `reward` (optional, src/puzzles/reward.js) plays the chapter wave and chime.
const SVG = 'http://www.w3.org/2000/svg';
const sv = (tag, attrs = {}) => {
  const e = document.createElementNS(SVG, tag);
  for (const [k, v] of Object.entries(attrs)) e.setAttribute(k, v);
  return e;
};
// Station centres: you climb. Station 1 is at the bottom left, station 10 at the top; rows of 4, 3, 3 that alternate right and
// left, so the road is a few long straight stretches with a short rise at each end.
const ROWS = [[44, 124, 214, 296], [270, 190, 110], [78, 168, 258]];
const ROW_Y = [186, 112, 38];
export function stationPoints(n) {
  const pts = [];
  ROWS.forEach((r, i) => r.forEach((x) => pts.push([x, ROW_Y[i]])));
  return pts.slice(0, Math.max(1, n));
}
// The road through the stations: straight lines, the corners only softly rounded (radius R).
const R = 16;
export function roadPath(pts) {
  if (pts.length < 2) return `M${pts[0][0]} ${pts[0][1]}`;
  const toward = (a, b, d) => { const l = Math.hypot(b[0] - a[0], b[1] - a[1]) || 1, k = Math.min(d, l / 2) / l; return [a[0] + (b[0] - a[0]) * k, a[1] + (b[1] - a[1]) * k]; };
  let d = `M${pts[0][0]} ${pts[0][1]}`;
  for (let i = 1; i < pts.length - 1; i++) {
    const a = pts[i - 1], b = pts[i], c = pts[i + 1];
    const straight = (b[0] - a[0]) * (c[1] - b[1]) - (b[1] - a[1]) * (c[0] - b[0]) === 0;
    if (straight) { d += ` L${b[0]} ${b[1]}`; continue; }
    const p = toward(b, a, R), q = toward(b, c, R);
    d += ` L${p[0].toFixed(1)} ${p[1].toFixed(1)} Q${b[0]} ${b[1]} ${q[0].toFixed(1)} ${q[1].toFixed(1)}`;
  }
  const e = pts[pts.length - 1];
  return d + ` L${e[0]} ${e[1]}`;
}
const stateWord = (s) => ({ gold: t('puzzles.st.gold', 'solved'), silver: t('puzzles.st.silver', 'solved with help'), next: t('puzzles.st.next', 'next'), todo: t('puzzles.st.todo', 'not played yet') }[s]);

// The chapter whose reward last played: a re-render of the tab (a resize, a store change) must not play it again.
let rewardedChapter = null;

export function puzzlesTab({ puzzles, progress, onStart = () => {}, reward = null }) {
  const box = el('div', 'xlist pztab pzpath');
  const st = progress.stats();
  if (!Object.values(st.size).some((n) => n > 0)) {
    box.append(el('p', 'xlead xempty', t('puzzles.empty', 'No puzzles available.')));
    return box;
  }
  const used = Object.values(st.solved).some((n) => n > 0) || st.queued > 0 || st.chapter > 0;
  const go = (fn) => { onStart(); fn(); puzzles.start(); };

  const head = el('p', 'pzbandline');
  const lvl = el('span', '', t('puzzles.band', 'Level') + ' ');
  lvl.append(el('b', '', bandName(st.view.band)));
  const ch = el('span', '', t('puzzles.chapter', 'Chapter') + ' ');
  ch.append(el('b', '', String(st.view.chapter + 1)), document.createTextNode(` / ${st.view.chapters}`));
  head.append(lvl, ch);
  box.append(head);

  const badges = el('div', 'pzbadges');
  st.chapterList.forEach((c, i) => {
    const b = el('button', `pzbadge${c.done ? ' done' : ''}${i === st.view.chapter ? ' here' : ''}`, String(i + 1));
    b.type = 'button';
    b.dataset.chapter = String(i);
    b.setAttribute('aria-label', t('puzzles.chapterN', 'Chapter {n}', { n: i + 1 }));
    if (i === st.view.chapter) b.setAttribute('aria-current', 'true');
    b.addEventListener('click', () => progress.setView(st.view.band, i));
    badges.append(b);
  });
  box.append(badges);

  const pts = stationPoints(st.stations.length), road = roadPath(pts);
  const map = el('div', 'pzmap');
  const svg = sv('svg', { viewBox: '0 0 340 224', role: 'group', 'aria-label': t('puzzles.path', 'Puzzle path') });
  const defs = sv('defs');
  const grad = (id, a, b, radial) => {
    const g = sv(radial ? 'radialGradient' : 'linearGradient', radial ? { id, cx: '.35', cy: '.3' } : { id, x1: '0', x2: '1' });
    g.append(sv('stop', { offset: '0', 'stop-color': a }), sv('stop', { offset: '1', 'stop-color': b }));
    defs.append(g);
  };
  grad('pzg', '#b08d45', '#f3dfa8'); grad('pzgold', '#fbe9b4', '#b08d45', true); grad('pzsilver', '#f4f6fa', '#8e94a3', true);
  svg.append(defs, sv('path', { class: 'pzroad', d: road }));
  const played = st.stations.filter((x) => x.state === 'gold' || x.state === 'silver').length;
  const lit = sv('path', { class: 'pzroad lit', d: road, pathLength: '100', 'stroke-dasharray': `${st.finished ? 100 : (st.stations.length > 1 ? (played / (st.stations.length - 1)) * 100 : 0).toFixed(1)} 100` });
  svg.append(lit);
  const waveEls = [];
  st.stations.forEach((s, i) => {
    const [x, y] = pts[i];
    const g = sv('g', { class: `st ${s.state}`, tabindex: '0', role: 'button', 'data-id': s.id, 'data-state': s.state, 'aria-label': `${t('puzzles.station', 'Station {n}', { n: i + 1 })}, ${stateWord(s.state)}` });
    g.append(sv('circle', { class: 'halo', cx: x, cy: y, r: 21 }), sv('circle', { class: 'base', cx: x, cy: y, r: 21 }), sv('circle', { class: 'hit', cx: x, cy: y, r: 26 }));
    const tx = sv('text', { x, y: y + 1 });
    tx.textContent = String(i + 1);
    g.append(tx);
    const play = () => go(() => progress.select(s.id));
    g.addEventListener('click', play);
    g.addEventListener('keydown', (e) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); play(); } });
    svg.append(g);
    waveEls.push(g);
  });
  map.append(svg);
  box.append(map);

  if (st.finished) {
    box.classList.add('pzwave');
    box.append(el('p', 'pzdone', st.finished.level ? t('puzzles.levelDone', 'Chapter {n} done! A new level opens.', { n: st.finished.chapter + 1 }) : t('puzzles.chapterDone', 'Chapter {n} done!', { n: st.finished.chapter + 1 })));
    const key = `${st.finished.band}:${st.finished.chapter}`;
    if (key !== rewardedChapter) {
      rewardedChapter = key;
      reward?.chapter?.({ stations: waveEls, onDone: () => { rewardedChapter = null; progress.ack(); } });
    }
  }

  const foot = el('div', 'pzfoot');
  for (const [cls, word] of [['gold', t('puzzles.legend.gold', 'Solved')], ['silver', t('puzzles.legend.silver', 'With help')], ['next', t('puzzles.legend.next', 'Up next')]]) {
    const item = el('span');
    item.append(el('i', `pzdot ${cls}`), document.createTextNode(word));
    foot.append(item);
  }

  const label = st.finished ? t('puzzles.nextChapter', 'Next chapter') : used ? t('puzzles.continue', 'Continue') : t('puzzles.start', 'Start');
  const button = el('button', 'btn primary pzstart', label);
  button.type = 'button';
  button.addEventListener('click', () => go(() => progress.ack()));
  box.append(button, foot);
  return box;
}
