// Explain panel: the line in progress. Top says what to do now, the bottom holds only buttons (Weiter, Hinweis, Nochmal,
// Beenden), the move text waits on a card between the moves until the player taps Weiter, and a line opens on its goal screen
// with Los (CHE-129). The layout lives in lineview.js; this file turns the controller state into one descriptor.
// The line list lives in src/learn (the Openings tab). Desktop: one card in the right column, the tabs while idle and the
// walking UI while a line runs. Phone: no card, the top bar, the text card and the learning bar of lineview.js.
// Every string goes through t(); line texts come in { en, de } pairs and are picked by language.
import * as I18N from '../i18n.js';
import { device } from '../device.js';
import { createExplain } from './explain.js';
import { createLineView } from './lineview.js';
import '../learn/strings.js';
import { createHint, createMarks, createThreats } from './arrow.js';
import { nameSq } from '../rules.js';
import { chooseIntroStyle, introModel, introNode } from './intro.js';
import './explain.css';

const { t, onLanguage, i18n } = I18N;

// CHE-269: the intro sections of a goal screen and the why and threat of a move card.
I18N.addDE({
  'lines.about': 'Worum es geht', 'lines.aimsW': 'Was Weiß will', 'lines.aimsB': 'Was Schwarz will',
  'lines.plans': 'Typische Pläne', 'lines.traps': 'Fallen', 'lines.why': 'Warum?', 'lines.whyHead': 'Warum', 'lines.threat': 'Droht',
  // CHE-288: the three intro layouts (src/openings/intro.js)
  'lines.more': 'Mehr', 'lines.less': 'Weniger', 'lines.tabAim': 'Ziel', 'lines.tabPlan': 'Plan', 'lines.tabTrap': 'Falle',
  'lines.whiteS': 'Weiß', 'lines.blackS': 'Schwarz',
});

const el = (tag, cls, text) => {
  const e = document.createElement(tag);
  if (cls) e.className = cls;
  if (text != null) e.textContent = text;
  return e;
};
const pick = (pair) => (pair ? pair[i18n.language] || pair.en || '' : '');
// German piece letters are the i18n layer's job; until it exports a converter the English letters show.
const show = (san) => (typeof I18N.san === 'function' ? I18N.san(san, i18n.language) : san);

// The one line goal of a line, "Goal: ...", from GOALS in src/i18n.js. A line without a written goal (a player's own line)
// gets the plain one.
export function goalText(line) {
  const g = I18N.GOALS[line.id];
  const label = t('lines.goalLabel', 'Goal');
  return `${label}: ${g ? g[i18n.language] || g.en : t('lines.goalGeneric', 'the position after {n} moves', { n: line.moves.length })}`;
}

export function mountExplain({ game, controls, ui, gimbal, pause = 900, store = null, sweep = null }) {
  const hint = createHint({ gimbal });
  const marks = createMarks({ gimbal });
  // face the board from the line's side; leave the view alone when it already does (the drill uses it too)
  const onSide = (side) => {
    const facesBlack = Math.cos(controls.camera.yaw) < 0;
    if ((side === 'b') !== facesBlack) controls.flip();
  };
  const threats = createThreats({ gimbal });
  const explain = createExplain({ game, hint, marks, pause, onSide });

  // `idle` is the element src/learn fills with the tabs (Openings, Mine, Practise). Desktop: it sits in this card while no line
  // runs. Phone: it lives in the Learn sheet and the card is not mounted at all, the walking UI is the top bar, card and bar.
  const root = el('div', 'xp');
  const idle = el('div', 'xidle');
  const card = device.phone ? null : ui.mountPanel('openings', root, { title: t('learn.title', 'Learn') });
  const view = createLineView({ ui, owner: 'explain' });

  const ownSquares = (side) => {
    const out = [];
    game.chess.board.forEach((p, sq) => { if (p && (p === p.toUpperCase()) === (side === 'w')) out.push(sq); });
    return out;
  };
  function adoptControl(s) {
    const adopted = store.isAdopted(s.line.id);
    const b = el('button', `btn ${adopted ? 'xadopt done' : 'xadopt primary'}`, adopted ? t('explain.inMine', 'In my openings') : t('explain.addMine', 'Add to my openings'));
    b.type = 'button';
    b.addEventListener('click', () => {
      if (store.isAdopted(s.line.id)) return;   // inert once adopted
      store.adopt(s.line.id);
      try { sweep?.play({ side: s.line.side, squares: ownSquares(s.line.side) }); } catch (e) { console.warn('sweep failed', e); }
      render();
    });
    if (adopted) { b.disabled = true; b.setAttribute('aria-disabled', 'true'); }
    return b;
  }

  const sideLabel = (l) => t(l.side === 'w' ? 'explain.forWhite' : 'explain.forBlack', l.side === 'w' ? 'You play White' : 'You play Black');

  // ------------------------------------------------------------ the descriptor
  // The goal screen's intro (CHE-288): one of three layouts, `?introstyle=a|b|c` (src/openings/intro.js). The open toggle or tab
  // stays while the card re-renders and starts fresh for the next line. A line without any intro text has no intro.
  const introStyle = chooseIntroStyle(location.search);
  let introState = { id: null };
  function introCard(L) {
    if (introState.id !== L.id) introState = { id: L.id };
    const model = introModel(L, introStyle, { t, pick, legend: legend() });
    return model ? introNode(model, introState) : null;
  }
  const legend = () => t('lines.legend', 'Gold squares: where the pieces that move end up. Tap Go to start from the beginning.');
  function moveCard(L, ply) {
    const m = L.moves[ply];
    return {
      title: show(m.san), text: pick(m), kind: 'move', key: `${L.id}:${ply}`,
      why: m.why ? pick(m.why) : '', threat: m.threat ? pick(m.threat) : '',
      whyLabel: t('lines.why', 'Why?'), whyHead: t('lines.whyHead', 'Why'), threatHead: t('lines.threat', 'Threat'),
    };
  }
  // The threat arrows stand while a move card shows and go with it.
  function syncThreats(s) {
    const m = s.line && s.card && !s.card.ending ? s.line.moves[s.card.ply] : null;
    const arrows = m?.threat?.arrows || [];
    if (arrows.length) threats.show(arrows.map((a) => ({ from: nameSq(a.slice(0, 2)), to: nameSq(a.slice(2, 4)) })));
    else threats.hide();
  }

  function describe(s) {
    const L = s.line;
    const base = { title: pick(L.name), side: sideLabel(L), close: { label: t('explain.all', 'All openings'), run: () => explain.stop() } };
    const end = { id: 'end', icon: 'end', label: t('lines.end', 'End'), aria: t('explain.all', 'All openings'), run: () => explain.stop() };
    const again = (primary) => ({ id: 'again', icon: 'undo', label: t('lines.again', 'Again'), aria: t('lines.again', 'Again'), primary, run: () => explain.restart() });
    if (s.phase === 'preview') {
      const introEl = introCard(L);   // variant a folds the legend into its More box, but only when there is an intro to fold it into
      return {
        ...base, action: goalText(L),
        card: { title: `${base.title}, ${base.side}`, text: introEl ? (introStyle === 'a' ? '' : legend()) : legend(), kind: 'goal', node: introEl },
        buttons: [{ id: 'go', icon: 'show', label: t('lines.go', 'Go'), aria: t('lines.go', 'Go'), primary: true, run: () => explain.go() }, end],
      };
    }
    if (s.phase === 'finished') {
      const ending = s.card && s.card.ending ? pick(L.ending) : '';
      return {
        ...base, action: t('lines.done', 'Line complete.'),
        card: s.card ? (s.card.ending ? { title: t('lines.done', 'Line complete.'), text: ending, kind: 'ending' } : moveCard(L, s.card.ply)) : null,
        buttons: [again(true), end],
        extra: store ? adoptControl(s) : null,
      };
    }
    const waiting = s.canContinue;
    const nextLabel = s.card && s.card.last ? t('lines.cont', 'Continue') : t('lines.next', 'Show next move');   // after the last move there is none to show
    let action, kind = '';
    if (waiting) action = t('lines.tapNext', 'Read it, then show the next move.');
    else if (s.message && s.message.type === 'refused') { action = t('lines.wrong', 'Not this move. Play {san}.', { san: show(s.message.san) }); kind = 'refused'; }
    else if (s.due && s.due.own) action = t('lines.play', 'Play {san}', { san: show(s.due.san) });
    else action = t('lines.opponent', 'The opponent replies.');
    return {
      ...base, action, actionKind: kind,
      card: s.card ? moveCard(L, s.card.ply) : null,
      buttons: [
        { id: 'next', icon: 'next', label: nextLabel, aria: nextLabel, primary: waiting, disabled: !waiting, run: () => explain.weiter() },
        { id: 'hint', icon: 'good', label: t('lines.hint', 'Hint'), aria: t(s.hint ? 'explain.hintOff' : 'explain.hintOn', s.hint ? 'Hide the hint' : 'Show the hint'), on: s.hint, pressed: s.hint, run: () => explain.setHint(!s.hint) },
        again(false), end,
      ],
    };
  }

  // ------------------------------------------------------------ render
  function render() {
    const s = explain.state();
    const live = s.phase !== 'list';
    const desc = live ? describe(s) : null;
    if (card) {
      card.querySelector('h2').textContent = t('learn.title', 'Learn');
      root.replaceChildren(live ? view.desktop(desc) : idle);
    }
    document.body.classList.toggle('explaining', live);
    syncThreats(s);
    view.show(desc);
  }
  explain.on(render);
  store?.onChange(() => { if (explain.state().phase === 'finished') render(); });
  onLanguage(render);
  render();

  return { explain, hint, marks, threats, card, view, idle, onSide, tick: (dt) => explain.tick(dt) };
}
