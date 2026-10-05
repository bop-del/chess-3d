// Drill panel: the session in progress, in the look of the Explain panel (CHE-129): the top says what to do now, the bottom
// holds only buttons (Weiter, Hinweis, Nochmal, Beenden), the sentence of the player's own move waits on a card until Weiter.
// The layout is src/openings/lineview.js. It shows the move sentence, never a score, a count or a streak. Every string goes
// through t(); the German strings are in src/i18n.js (lines.*) and registered here with addDE (drill.*).
import * as I18N from '../i18n.js';
import { createLineView } from '../openings/lineview.js';
import '../openings/explain.css';
import './drill.css';

const { t, onLanguage, i18n, addDE } = I18N;

addDE({
  'drill.title': 'Üben',
  'drill.yourMove': 'Dein Zug.',
  'drill.watch': 'Schau zu.',
  'drill.missLead': 'Nicht ganz.',
  'drill.done': 'Fertig.',
  'drill.donePractise': 'Die Eröffnung ist durch.',
  'drill.stop': 'Beenden',
  'drill.close': 'Schließen',
  'drill.again': 'Nochmal',
});

const el = (tag, cls, text) => {
  const e = document.createElement(tag);
  if (cls) e.className = cls;
  if (text != null) e.textContent = text;
  return e;
};
const pick = (pair) => (pair ? pair[i18n.language] || pair.en || '' : '');
const show = (san) => (typeof I18N.san === 'function' ? I18N.san(san, i18n.language) : san);
const sideLabel = (l) => t(l.side === 'w' ? 'explain.forWhite' : 'explain.forBlack', l.side === 'w' ? 'You play White' : 'You play Black');

export function mountDrillPanel({ drill, ui = null, onClose = null, onAgain = null }) {
  const root = el('div', 'xp drillp');
  const card = ui?.mountPanel ? ui.mountPanel('drill', root, { title: t('drill.title', 'Drill') }) : null;
  const view = createLineView({ ui, owner: 'drill' });
  if (card) card.hidden = true;
  const stop = () => (onClose ? onClose() : drill.stop());

  function describe(s) {
    const L = s.line;
    const base = { title: pick(L.name), side: sideLabel(L), close: { label: t('drill.stop', 'Stop'), run: stop } };
    const end = { id: 'end', icon: 'end', label: t('lines.end', 'End'), aria: t('drill.stop', 'Stop'), run: stop };
    const again = (primary) => ({ id: 'again', icon: 'undo', label: t('lines.again', 'Again'), aria: t('drill.again', 'Again'), primary, run: () => (onAgain ? onAgain(L.id) : drill.restart()) });
    if (s.phase === 'finished') {
      return { ...base, action: t(s.mode === 'due' ? 'drill.done' : 'drill.donePractise', s.mode === 'due' ? 'Done.' : 'The line is through.'), card: null, buttons: s.mode === 'practise' ? [again(true), end] : [{ ...end, primary: true }] };
    }
    const m = s.message;
    let action, kind = '', text = null;
    if (s.canContinue) action = t('lines.tapCont', 'Read it, then tap Continue.');
    else if (m && m.type === 'miss') { action = t('lines.drillMiss', 'Not quite. Try again.'); kind = 'refused'; text = { title: t('drill.missLead', 'Not quite.'), text: pick(L.moves[m.ply]), kind: 'refused' }; }
    else if (s.awaiting) action = t('lines.yourMove', 'Your move.');
    else action = t('lines.opponent', 'The opponent replies.');
    const shown = s.card ? { title: show(L.moves[s.card.ply].san), text: pick(L.moves[s.card.ply]), kind: 'move' } : text;
    const buttons = [
      { id: 'next', icon: 'next', label: t('lines.cont', 'Continue'), aria: t('lines.cont', 'Continue'), primary: s.canContinue, disabled: !s.canContinue, run: () => drill.weiter() },
      { id: 'hint', icon: 'good', label: t('lines.hint', 'Hint'), aria: t(s.hint ? 'explain.hintOff' : 'explain.hintOn', s.hint ? 'Hide the hint' : 'Show the hint'), on: s.hint, pressed: s.hint, disabled: !s.awaiting, run: () => drill.setHint(!s.hint) },
    ];
    if (s.mode === 'practise') buttons.push(again(false));
    buttons.push(end);
    return { ...base, action, actionKind: kind, card: shown, buttons };
  }

  function render() {
    const s = drill.state();
    const live = s.phase !== 'idle';
    if (card) { card.hidden = !live || view.phone; card.querySelector('h2').textContent = t('drill.title', 'Drill'); }
    document.body.classList.toggle('drilling', live);
    if (!live) { root.replaceChildren(); view.show(null); return; }
    const desc = describe(s);
    if (!view.phone) root.replaceChildren(view.desktop(desc));
    view.show(desc);
  }

  drill.on(render);
  onLanguage(render);
  render();

  return { card, view, root };
}
