// The intro of a goal screen in three layouts (CHE-288), picked by the preview flag `?introstyle=a|b|c`.
// The line texts are never rewritten here: a variant only picks which of them show first and which wait behind a tap.
//   a  short: the about sentence and the two aims in one paragraph, everything in full behind a "More" toggle
//   b  three tabs Plan / Aim / Trap (Plan / Ziel / Falle), one open at a time; a section the line lacks has no tab
//   c  a numbered story, no toggles: what it is about, what each side wants, the plans, the trap as the last step
// The model is pure data (testable in node: test/openings.mjs); `introNode` turns it into DOM.
// `tx` carries the language helpers: { t(key, fallback), pick(pair), legend? } (variant a folds the legend line into its More box).

export const INTRO_STYLES = ['a', 'b', 'c'];
export const DEFAULT_INTRO_STYLE = 'a';

// An unknown or missing value gives the default.
export function chooseIntroStyle(search) {
  const v = new URLSearchParams(search || '').get('introstyle');
  return INTRO_STYLES.includes(v) ? v : DEFAULT_INTRO_STYLE;
}

// The first sentence of a text (a text with one sentence comes back whole).
export function firstSentence(s) {
  const m = /^.*?[.!?](?=\s+[A-ZÄÖÜ"“]|$)/s.exec(s || '');
  return m ? m[0] : s || '';
}

// The five sections of the old layout, each with an id; a section without text is left out.
export function introSections(L, tx) {
  const { t, pick } = tx;
  const out = [];
  if (L.intro) out.push({ id: 'about', head: t('lines.about', 'What it is about'), text: pick(L.intro) });
  if (L.aims?.w) out.push({ id: 'aimsW', head: t('lines.aimsW', 'What White wants'), text: pick(L.aims.w) });
  if (L.aims?.b) out.push({ id: 'aimsB', head: t('lines.aimsB', 'What Black wants'), text: pick(L.aims.b) });
  if (L.plans?.length) out.push({ id: 'plans', head: t('lines.plans', 'Typical plans'), items: L.plans.map(pick) });
  if (L.traps?.length) out.push({ id: 'traps', head: t('lines.traps', 'Traps'), items: L.traps.map(pick) });
  return out;
}

export function introModel(L, style, tx) {
  const { t } = tx;
  const sec = introSections(L, tx);
  const by = (id) => sec.find((s) => s.id === id);
  const white = t('lines.whiteS', 'White'), black = t('lines.blackS', 'Black');
  if (!sec.length) return null;
  if (style === 'b') {
    const tabs = [];
    const aim = [];
    if (by('about')) aim.push({ text: by('about').text });
    if (by('aimsW')) aim.push({ label: white, text: by('aimsW').text });
    if (by('aimsB')) aim.push({ label: black, text: by('aimsB').text });
    if (aim.length) tabs.push({ id: 'aim', label: t('lines.tabAim', 'Aim'), rows: aim });
    if (by('plans')) tabs.push({ id: 'plan', label: t('lines.tabPlan', 'Plan'), rows: by('plans').items.map((text) => ({ text })) });
    if (by('traps')) tabs.push({ id: 'trap', label: t('lines.tabTrap', 'Trap'), rows: by('traps').items.map((text) => ({ text })) });
    return { style: 'b', tabs };
  }
  if (style === 'c') {
    const steps = [];
    if (by('about')) steps.push({ kind: 'about', text: by('about').text });
    if (by('aimsW')) steps.push({ kind: 'w', label: white, text: by('aimsW').text });
    if (by('aimsB')) steps.push({ kind: 'b', label: black, text: by('aimsB').text });
    for (const text of by('plans')?.items || []) steps.push({ kind: 'plan', label: t('lines.tabPlan', 'Plan'), text });
    for (const text of by('traps')?.items || []) steps.push({ kind: 'trap', label: t('lines.tabTrap', 'Trap'), text });
    return { style: 'c', steps };
  }
  // a: the lead is the about sentence and the two aims; the rest, in full, sits behind the toggle
  const lead = [];
  if (by('about')) lead.push({ text: firstSentence(by('about').text) });
  const aims = [];
  if (by('aimsW')) aims.push({ label: white, text: by('aimsW').text });
  if (by('aimsB')) aims.push({ label: black, text: by('aimsB').text });
  if (aims.length) lead.push({ aims });
  // the legend of the gold squares waits behind the toggle too, so the short lead fits the fixed phone card
  const more = tx.legend ? [...sec, { id: 'legend', text: tx.legend }] : sec;
  return { style: 'a', lead, more, labels: { more: t('lines.more', 'More'), less: t('lines.less', 'Less') } };
}

// Every text the model lets a player reach (shown, or behind a toggle or a tab); test/openings.mjs checks each section text is in it.
export function reachableTexts(m) {
  if (!m) return [];
  if (m.style === 'a') return m.more.flatMap((s) => (s.items ? s.items : [s.text]));
  if (m.style === 'b') return m.tabs.flatMap((tab) => tab.rows.map((r) => r.text));
  return m.steps.map((s) => s.text);
}

const el = (tag, cls, text) => {
  const e = document.createElement(tag);
  if (cls) e.className = cls;
  if (text != null) e.textContent = text;
  return e;
};
const labelled = (label, text, cls) => {
  const p = el('p', `xcardtext ${cls || ''}`.trim());
  if (label) p.append(el('b', 'xilabel', `${label}: `));
  p.append(text);
  return p;
};

// `state` outlives a re-render: { more, tab }. It is reset by the caller when another line opens.
export function introNode(model, state) {
  const root = el('div', `xintro xintro-${model.style}`);
  if (model.style === 'a') {
    for (const part of model.lead) {
      if (part.aims) { const p = el('p', 'xcardtext xaims'); part.aims.forEach((a, i) => { if (i) p.append(' '); p.append(el('b', 'xilabel', `${a.label}: `), a.text); }); root.append(p); }
      else root.append(el('p', 'xcardtext', part.text));
    }
    const more = el('div', 'xmorebox');
    for (const s of model.more) {
      const sec = el('div', 'xsec');
      if (s.head) sec.append(el('b', 'xsechead', s.head));
      if (s.items) { const ul = el('ul', 'xseclist'); for (const it of s.items) ul.append(el('li', '', it)); sec.append(ul); }
      else sec.append(el('p', 'xcardtext', s.text));
      more.append(sec);
    }
    const btn = el('button', 'btn xmorebtn');
    btn.type = 'button';
    const sync = () => {
      more.hidden = !state.more;
      btn.textContent = state.more ? model.labels.less : model.labels.more;
      btn.setAttribute('aria-expanded', String(!!state.more));
      btn.classList.toggle('on', !!state.more);
    };
    btn.addEventListener('click', () => { state.more = !state.more; sync(); });
    sync();
    root.prepend(btn);   // first, floated right (explain.css): the toggle stays in view in the fixed phone card
    root.append(more);
  } else if (model.style === 'b') {
    if (!model.tabs.some((x) => x.id === state.tab)) state.tab = model.tabs[0].id;
    const bar = el('div', 'xitabs');
    bar.setAttribute('role', 'tablist');
    const panel = el('div', 'xitabpanel');
    panel.setAttribute('role', 'tabpanel');
    const buttons = model.tabs.map((tab) => {
      const b = el('button', 'btn xitab', tab.label);
      b.type = 'button';
      b.dataset.tab = tab.id;
      b.setAttribute('role', 'tab');
      b.addEventListener('click', () => { state.tab = tab.id; sync(); });
      return b;
    });
    const sync = () => {
      const tab = model.tabs.find((x) => x.id === state.tab);
      buttons.forEach((b) => { const on = b.dataset.tab === state.tab; b.classList.toggle('on', on); b.setAttribute('aria-selected', String(on)); });
      if (tab.rows.length > 1 && tab.id !== 'aim') { const ul = el('ul', 'xseclist'); for (const r of tab.rows) ul.append(el('li', '', r.text)); panel.replaceChildren(ul); }
      else panel.replaceChildren(...tab.rows.map((r) => labelled(r.label, r.text)));
    };
    if (model.tabs.length > 1) bar.append(...buttons);
    sync();
    root.append(bar, panel);
  } else {
    const ol = el('ol', 'xsteps');
    for (const s of model.steps) {
      const li = el('li', `xstep xstep-${s.kind}`);
      li.append(labelled(s.label, s.text));
      ol.append(li);
    }
    root.append(ol);
  }
  return root;
}
