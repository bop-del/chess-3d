// Learn UI: the tabs Openings, Mine and Practise, the Export and Import block, and the wiring between the store, the drill and
// the Explain panel. Phone: the tabs live in the Learn sheet (opened by the sixth thumb bar button). Desktop: the same tabs
// sit in the openings card while no line runs (the explain panel swaps the card to the walking UI during a line).
// Every string goes through t(); German strings are in strings.js. The line texts come in { en, de } pairs.
import './strings.js';
import { puzzlesTab } from '../puzzles/panel.js';
import * as I18N from '../i18n.js';
import './learn.css';

const { t, onLanguage, i18n } = I18N;

const el = (tag, cls, text) => {
  const e = document.createElement(tag);
  if (cls) e.className = cls;
  if (text != null) e.textContent = text;
  return e;
};
const pick = (pair) => (pair ? pair[i18n.language] || pair.en || '' : '');
const sideLabel = (l) => t(l.side === 'w' ? 'explain.forWhite' : 'explain.forBlack', l.side === 'w' ? 'You play White' : 'You play Black');
// The 15 side lines and the opening each one hangs under (the line data has no parent field). test/learn.mjs checks this
// map against the data: every key and value is a line id, the parent comes first and is played from the same side.
export const SIDE_OF = {
  'london-system-c5': 'london-system', 'london-system-bf5': 'london-system',
  'queens-gambit-accepted': 'queens-gambit', 'slav-defense': 'queens-gambit',
  'scandinavian-queen-d6': 'scandinavian-defense', 'scandinavian-modern': 'scandinavian-defense',
  'caro-kann-advance': 'caro-kann', 'caro-kann-panov': 'caro-kann',
  'french-tarrasch': 'french-defense', 'french-advance': 'french-defense',
  'sicilian-najdorf': 'sicilian-defense', 'sicilian-dragon': 'sicilian-defense', 'sicilian-alapin': 'sicilian-defense',
  'kings-indian-classical': 'kings-indian-defense', 'kings-indian-samisch': 'kings-indian-defense',
};
const TABS = ['openings', 'mine', 'practise', 'puzzles'];

export function mountLearn({ ui, openings, store, drill, puzzles, puzzleProgress, reward = null }) {
  const { explain, idle } = openings;
  const sheet = ui.learnSheet;                 // null on desktop
  if (sheet) sheet.body.append(idle);

  // the daily store and the badge store are created after this module is mounted (main.js): read them when Export or Import runs
  const extras = () => { const c = typeof window !== 'undefined' ? window.__chess : null; return { daily: c?.daily || null, badges: c?.badges?.store || null }; };

  let tab = 'openings';
  let editing = false;
  let practiseLines = false;                   // the Practise tab shows the lines instead of the start button

  const closeSheet = () => sheet?.close();
  const button = (label, cls, fn) => {
    const b = el('button', `btn ${cls || ''}`.trim(), label);
    b.type = 'button';
    b.addEventListener('click', fn);
    return b;
  };
  // A line starts: whatever else runs on the board gives way first.
  function leaveOthers() {
    if (drill.state().phase !== 'idle') drill.stop();
    if (puzzles.state().phase !== 'idle') puzzles.stop();
  }
  function walk(id) {
    leaveOthers();
    if (explain.start(id)) closeSheet();
  }

  // ------------------------------------------------------------ rows
  function nameLine(line, mark) {
    const head = el('span', 'xname');
    head.append(el('b', '', pick(line.name)));
    if (mark) {
      const m = el('i', 'xmark');
      m.setAttribute('role', 'img');
      m.setAttribute('aria-label', t('learn.mark', 'In my openings'));
      m.title = t('learn.mark', 'In my openings');
      head.append(m);
    }
    return head;
  }
  function row(line, kind) {
    const b = el('button', `xline ${kind}`);
    b.type = 'button';
    b.dataset.id = line.id;
    const ok = explain.playable(line);
    if (kind === 'openings') {
      b.disabled = !ok;
      b.append(nameLine(line, store.isAdopted(line.id)), el('span', 'xside', sideLabel(line)), el('span', 'xidea', ok ? pick(line.idea) : t('explain.soon', 'Coming soon')));
      b.addEventListener('click', () => walk(line.id));
    } else if (kind === 'mine') {
      b.disabled = !ok;
      b.append(nameLine(line, false), el('span', 'xside', sideLabel(line)));
      const bar = el('span', 'xbar');
      bar.setAttribute('role', 'progressbar');
      bar.setAttribute('aria-label', t('learn.progress', 'Progress'));
      bar.setAttribute('aria-valuemin', '0'); bar.setAttribute('aria-valuemax', '1');
      const p = store.progress(line.id);
      bar.setAttribute('aria-valuenow', String(Math.round(p * 100) / 100));
      const fill = el('i');
      fill.style.width = `${Math.round(p * 100)}%`;
      bar.append(fill);
      b.append(bar);
      b.addEventListener('click', () => walk(line.id));
    } else {                                   // practise
      b.append(nameLine(line, false), el('span', 'xside', sideLabel(line)), el('span', 'xidea', pick(line.idea)));
      b.addEventListener('click', () => {
        if (explain.state().phase !== 'list') explain.stop();
        if (puzzles.state().phase !== 'idle') puzzles.stop();
        if (drill.startPractise(line.id)) closeSheet();
      });
    }
    return b;
  }

  // ------------------------------------------------------------ tabs
  function openingsView() {
    const box = el('div', 'xlist');
    box.append(el('p', 'xlead', t('explain.lead', 'Pick an opening. You play your moves, the game plays the other side, and every move says what it is for.')));
    // parents first, each followed by its side lines in a group; a side line whose parent is missing stays at the top level
    const all = explain.lines;
    const ids = new Set(all.map((l) => l.id));
    for (const line of all) {
      if (SIDE_OF[line.id] && ids.has(SIDE_OF[line.id])) continue;
      const kids = all.filter((l) => SIDE_OF[l.id] === line.id);
      if (!kids.length) { box.append(row(line, 'openings')); continue; }
      const group = el('div', 'xgroup');
      group.dataset.parent = line.id;
      group.append(row(line, 'openings'));
      for (const k of kids) { const r = row(k, 'openings'); r.classList.add('xsub'); r.dataset.parent = line.id; group.append(r); }
      box.append(group);
    }
    return box;
  }

  const adoptedLines = () => store.adopted().map((id) => explain.lines.find((l) => l.id === id)).filter(Boolean);

  function mineView() {
    const box = el('div', 'xlist');
    const lines = adoptedLines();
    if (!lines.length) {
      editing = false;
      box.append(el('p', 'xlead xempty', t('learn.mineEmpty', 'Openings you add appear here. Walk a line to its end, then tap "Add to my openings".')));
      return box;
    }
    const top = el('div', 'xedit');
    top.append(button(editing ? t('learn.done', 'Done') : t('learn.edit', 'Edit'), 'xeditbtn', () => { editing = !editing; render(); }));
    box.append(top);
    for (const line of lines) {
      const item = el('div', 'xitem');
      item.append(row(line, 'mine'));
      if (editing) {
        const del = button(t('learn.remove', 'Remove'), 'xdel', () => { store.remove(line.id); });
        del.setAttribute('aria-label', t('learn.removeOne', 'Remove {name}', { name: pick(line.name) }));
        item.append(del);
      }
      box.append(item);
    }
    return box;
  }

  function practiseView() {
    const box = el('div', 'xlist');
    const due = store.dueKeys(Date.now()).length > 0;
    if (due && !practiseLines) {
      box.append(button(t('learn.practiseStart', 'Start practising'), 'primary xstart', () => {
        if (explain.state().phase !== 'list') explain.stop();
        if (puzzles.state().phase !== 'idle') puzzles.stop();
        if (drill.startDue()) closeSheet();
        else { practiseLines = true; render(); }
      }));
      return box;
    }
    const lines = adoptedLines();
    if (!lines.length) { box.append(el('p', 'xlead xempty', t('learn.practiseNone', 'You have not added an opening yet. Find one under Openings.'))); return box; }
    box.append(el('p', 'xlead', t('learn.practiseLead', 'Pick an opening to practise. Your progress stays as it is.')));
    for (const line of lines) box.append(row(line, 'practise'));
    return box;
  }

  function puzzlesView() {
    return puzzlesTab({
      puzzles, progress: puzzleProgress, reward,
      onStart() {
        if (explain.state().phase !== 'list') explain.stop();
        if (drill.state().phase !== 'idle') drill.stop();
        closeSheet();
      },
    });
  }

  function render() {
    if (!store.everAdopted() && tab === 'practise') tab = 'openings';
    if (tab !== 'mine') editing = false;
    if (tab !== 'practise') practiseLines = false;
    const tabs = el('div', 'xtabs');
    tabs.setAttribute('role', 'tablist');
    tabs.setAttribute('aria-label', t('learn.tabs', 'Learn'));
    for (const id of TABS) {
      const locked = id === 'practise' && !store.everAdopted();
      const b = el('button', 'xtab', t(`learn.tab.${id}`, { openings: 'Openings', mine: 'Mine', practise: 'Practise', puzzles: 'Puzzles' }[id]));
      b.type = 'button';
      b.setAttribute('role', 'tab');
      b.dataset.tab = id;
      b.setAttribute('aria-selected', String(tab === id));
      b.disabled = locked;
      b.addEventListener('click', () => { tab = id; render(); });
      tabs.append(b);
    }
    const view = tab === 'mine' ? mineView() : tab === 'practise' ? practiseView() : tab === 'puzzles' ? puzzlesView() : openingsView();
    view.setAttribute('role', 'tabpanel');
    idle.replaceChildren(tabs, view);
  }

  store.onChange(render);
  explain.on((s) => { if (s.phase === 'list') render(); });
  drill.on((s) => { if (s.phase === 'idle') render(); });
  puzzles.on((s) => { if (s.phase === 'idle') render(); });
  puzzleProgress.onChange(() => { if (puzzles.state().phase === 'idle') render(); });
  onLanguage(render);
  render();

  // ------------------------------------------------------------ Export and Import (the Menu)
  const data = el('div', 'xdata');
  const title = el('b', 'xdatahead', '');
  const msg = el('p', 'xdatamsg');
  msg.setAttribute('aria-live', 'polite');
  const file = el('input');
  file.type = 'file'; file.accept = '.json,application/json'; file.hidden = true;
  const exportBtn = button('', 'small', () => {
    const { daily, badges } = extras();
    const out = { ...JSON.parse(store.exportJSON()), puzzles: puzzleProgress.exportData() };
    if (daily) out.daily = daily.exportData();
    if (badges) out.badges = badges.exportData();
    const blob = new Blob([JSON.stringify(out, null, 2)], { type: 'application/json' });
    const a = el('a');
    a.href = URL.createObjectURL(blob);
    a.download = 'chess3d-learning.json';
    document.body.append(a);
    a.click();
    a.remove();
    setTimeout(() => URL.revokeObjectURL(a.href), 2000);
    msg.textContent = t('learn.exported', 'File saved.');
  });
  const importBtn = button('', 'small', () => file.click());
  file.addEventListener('change', async () => {
    const f = file.files && file.files[0];
    file.value = '';
    if (!f) return;
    let text;
    try { text = await f.text(); } catch (e) { msg.textContent = t('learn.importFailed', 'Import failed: {why}', { why: t('learn.importUnreadable', 'The file could not be read.') }); return; }
    // the openings part goes to the store as before; the puzzle path rides along under "puzzles"
    // the daily streak and the badges ride along too ("daily", "badges"); an older file without them imports as before
    let puzzlePart = null, dailyPart = null, badgesPart = null, rest = text;
    try {
      const o = JSON.parse(text);
      if (o && typeof o === 'object') {
        puzzlePart = o.puzzles ?? null; dailyPart = o.daily ?? null; badgesPart = o.badges ?? null;
        delete o.puzzles; delete o.daily; delete o.badges; rest = JSON.stringify(o);
      }
    } catch (e) { /* the store reports it */ }
    const r = store.importJSON(rest);
    if (r.ok) {
      if (puzzlePart) puzzleProgress.importData(puzzlePart);
      const { daily, badges } = extras();
      if (dailyPart && daily) daily.importData(dailyPart);
      if (badgesPart && badges) badges.importData(badgesPart);
    }
    msg.textContent = r.ok ? t('learn.imported', 'Imported.') : t('learn.importFailed', 'Import failed: {why}', { why: r.error });
  });
  const dataRow = el('div', 'xrow');
  dataRow.append(exportBtn, importBtn);
  data.append(title, dataRow, msg, file);
  ui.mountSettings('train-data', data);
  const labels = () => {
    title.textContent = t('learn.data', 'Your openings and puzzles');
    exportBtn.textContent = t('learn.export', 'Export');
    importBtn.textContent = t('learn.import', 'Import');
  };
  labels();
  onLanguage(labels);

  return {
    idle, render,
    get tab() { return tab; },
    show(id) { if (TABS.includes(id)) { tab = id; render(); } },
    // Open the puzzle path: the Puzzles tab, and on the phone the Learn sheet. A running puzzle stays as it is until a station is tapped.
    openPath() { tab = 'puzzles'; puzzleProgress.setView(null); render(); sheet?.open(); },
    // ?open=: the Learn UI on one tab (a locked Practise tab falls back to Openings). Phone: the Learn sheet. Desktop: the card.
    open(id = 'openings') { this.show(TABS.includes(id) ? id : 'openings'); if (sheet) sheet.open(); else ui.openPanel?.('openings'); },
    get editing() { return editing; },
    export: exportBtn, import: importBtn, file, message: msg,
  };
}
