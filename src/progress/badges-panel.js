// The badge panel: a card "Abzeichen" (Learn tab on desktop, a section of the Menu sheet on a phone) with a grid of all badges
// grouped by family, and the toast for a newly earned badge. Earned badges are in colour with their date, locked ones grey with the
// goal ("noch 7 Rätsel"), every family has a progress line. The look is a variant (?variant=a|b|c, read here and nowhere else).
import * as I18N from '../i18n.js';
import { BADGES, FAMILIES, LEVELS } from './badges.js';
import { badgeSvg, VARIANTS } from './badge-art.js';
import './strings.js';
import './badges.css';

const { t, onLanguage, i18n } = I18N;

const el = (tag, cls, text) => {
  const e = document.createElement(tag);
  if (cls) e.className = cls;
  if (text != null) e.textContent = text;
  return e;
};
const pick = (pair) => pair[i18n.language] || pair.en;
const famName = (f) => t(`badges.fam.${f}`, { puzzles: 'Puzzles', openings: 'Openings', wins: 'Wins against the computer', daily: 'Daily puzzle' }[f]);
const lvlName = (l) => t(`badges.lvl.${l}`, { novice: 'Novice', easy: 'Easy', normal: 'Normal', hard: 'Hard' }[l]);
const dateText = (iso) => {
  const [y, m, d] = iso.split('-').map(Number);
  try { return new Date(y, m - 1, d).toLocaleDateString(i18n.language === 'de' ? 'de-DE' : 'en-GB', { day: 'numeric', month: 'short', year: 'numeric' }); } catch (e) { return iso; }
};

/** The variant from the URL: a, b or c; anything else is the default a. */
export function variantFlag(search = location.search) {
  const v = new URLSearchParams(search).get('variant');
  return VARIANTS.includes(v) ? v : 'a';
}

const GLINT_MS = 3000;

export function mountBadgesPanel({ badges, ui = null, variant = variantFlag() }) {
  const root = el('div', 'badges');
  root.dataset.variant = variant;
  const card = ui?.mountPanel ? ui.mountPanel('badges', root, { title: t('badges.title', 'Badges') }) : null;
  const fresh = new Set();   // the ids that glint now

  function leftText(b, item) {
    if (b.family === 'wins') return t('badges.left.win', 'Win against {level}', { level: lvlName(b.level) });
    const n = item.left, key = `badges.left.${b.family}`;
    const en = { puzzles: ['{n} more puzzles', '1 more puzzle'], openings: ['{n} more openings', '1 more opening'], daily: ['{n} more days in a row', '1 more day in a row'] }[b.family];
    return n === 1 ? t(`${key}1`, en[1]) : t(key, en[0], { n });
  }
  const progText = (f, p) => {
    const max = f === 'puzzles' ? 100 : f === 'daily' ? 30 : p.max;
    const key = `badges.prog.${f}`;
    const en = { puzzles: '{n} of {max} puzzles solved', openings: '{n} of {max} openings learned', wins: '{n} of {max} levels beaten', daily: 'Best streak: {n}' }[f];
    return t(key, en, { n: p.value, max });
  };

  function cell(b, item, p) {
    const li = el('li', 'bdg');
    li.dataset.id = b.id;
    li.dataset.earned = String(item.earned);
    if (fresh.has(b.id)) li.classList.add('fresh');
    const label = b.family === 'wins' ? '' : b.id === 'openings-all' ? '★' : String(b.goal === 'all' ? p.max : b.goal);
    const holder = el('span', 'bdart');
    holder.innerHTML = badgeSvg({ id: b.id, family: b.family, label, pips: LEVELS.indexOf(b.level) + 1, variant });   // own markup, no player text
    li.append(holder, el('b', 'bdname', pick(b.name)));
    li.append(el('span', 'bdsub', item.earned ? dateText(item.date) : leftText(b, item)));
    li.setAttribute('aria-label', `${pick(b.name)}: ${item.earned ? t('badges.earned', 'Earned on {date}', { date: dateText(item.date) }) : leftText(b, item)}`);
    li.setAttribute('role', 'listitem');
    return li;
  }

  function render() {
    const parts = [];
    for (const f of FAMILIES) {
      const p = badges.progress(f);
      const sec = el('section', 'bdfam');
      sec.dataset.family = f;
      const head = el('header', 'bdhead');
      head.append(el('h3', '', famName(f)), el('span', 'bdcount', `${p.earned}/${p.total}`));
      const prog = el('p', 'bdprog', progText(f, p));
      const max = f === 'puzzles' ? 100 : f === 'daily' ? 30 : p.max || 1;
      const bar = el('div', 'bdbar');
      bar.setAttribute('role', 'progressbar');
      bar.setAttribute('aria-label', famName(f));
      bar.setAttribute('aria-valuemin', '0'); bar.setAttribute('aria-valuemax', String(max)); bar.setAttribute('aria-valuenow', String(Math.min(p.value, max)));
      const fill = el('i');
      fill.style.width = `${Math.round(Math.min(1, p.value / max) * 100)}%`;
      bar.append(fill);
      const list = el('ul', 'bdgrid');
      list.setAttribute('role', 'list');
      for (const item of p.items) list.append(cell(BADGES.find((b) => b.id === item.id), item, p));
      sec.append(head, prog, bar, list);
      if (f === 'openings') sec.append(el('p', 'bdhint', t('badges.hint.openings', 'An opening counts once you have played it to the end and added it to your openings.')));
      parts.push(sec);
    }
    root.replaceChildren(...parts);
  }

  // a newly earned badge: one toast for all that came together, and a short glint on it in the panel
  let pending = [];
  badges.onEarn((id) => {
    fresh.add(id);
    setTimeout(() => { fresh.delete(id); }, GLINT_MS);
    if (!pending.length) queueMicrotask(() => {
      const names = pending.map((x) => pick(BADGES.find((b) => b.id === x).name));
      pending = [];
      ui?.toast?.(t('badges.new', 'New badge: {name}', { name: names.join(', ') }), 'info');
    });
    pending.push(id);
  });
  badges.onChange(render);
  onLanguage(render);
  render();

  // phone: the card sits in the Menu sheet, folded; the panel is opened by ?open=badges
  if (card && document.body.classList.contains('phone')) card.classList.add('collapsed');
  return { root, card, render, variant, fresh };
}
