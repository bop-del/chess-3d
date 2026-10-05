// The look of a running line, shared by Explain and Drill (CHE-129). One descriptor in, two layouts out:
//
//   desc = { action, title, side, card: { text, kind, title? } | null, buttons: [{ id, label, icon, aria, primary, disabled, on,
//            pressed, run }], close: { label, run } | null, extra: Node | null }
//
// Top: `action` says only what to do now ("Play e4"). Bottom: only buttons. Between the moves: the text card, which holds the
// move text until the player taps Weiter. Phone: a top bar (.xtop), a card (.xcard: under the board in portrait, to the left
// of it in landscape, a fixed slot so the camera frame never jumps) and the thumb bar turned into the buttons
// (ui.setLearnBar); the camera frame is the free area between them, so the board is never cut off. Desktop: the same
// three parts stacked in the panel card. No game logic here.
import { device } from '../device.js';

const el = (tag, cls, text) => {
  const e = document.createElement(tag);
  if (cls) e.className = cls;
  if (text != null) e.textContent = text;
  return e;
};

export function createLineView({ ui, owner }) {
  const phone = !!device.phone;
  let top = null, cardEl = null;
  if (phone) {
    top = el('div', 'xtop');
    top.setAttribute('role', 'status');
    top.setAttribute('aria-live', 'polite');
    cardEl = el('section', 'xcard');
    cardEl.setAttribute('aria-live', 'polite');
    top.hidden = cardEl.hidden = true;
    document.getElementById('hud').append(top, cardEl);
  }

  function cardBox(c, cls) {
    const box = el('div', cls);
    box.dataset.kind = c.kind || '';
    if (c.title) box.append(el('b', 'xcardhead', c.title));
    box.append(el('p', 'xcardtext', c.text));
    return box;
  }

  function button(b) {
    const x = el('button', `btn ${b.primary ? 'primary' : ''} ${b.on ? 'on' : ''}`.replace(/\s+/g, ' ').trim(), b.label);
    x.type = 'button';
    x.dataset.act = b.id;
    x.disabled = !!b.disabled;
    if (b.aria) x.setAttribute('aria-label', b.aria);
    if (b.pressed != null) x.setAttribute('aria-pressed', String(!!b.pressed));
    x.addEventListener('click', b.run);
    return x;
  }

  return {
    phone,
    // desktop: the whole walking UI as one element for the panel card
    desktop(desc) {
      const box = el('div', 'xwalk xlines');
      const head = el('div', 'xhead');
      const title = el('div', 'xtitle');
      title.append(el('b', '', desc.title), el('span', 'xside', desc.side));
      head.append(title);
      if (desc.close) { const c = button({ id: 'close', label: desc.close.label, run: desc.close.run }); c.classList.add('xclose'); head.append(c); }
      const action = el('p', 'xaction', desc.action);
      action.dataset.kind = desc.actionKind || '';
      box.append(head, action);
      box.append(desc.card ? cardBox(desc.card, 'xcardbox') : el('div', 'xcardbox xcardempty'));
      const row = el('div', 'xrow xbuttons');
      for (const b of desc.buttons) row.append(button(b));
      box.append(row);
      if (desc.extra) box.append(desc.extra);
      return box;
    },
    // phone: top bar, card and learning bar; null hides all three
    show(desc) {
      document.body.classList.toggle('lines', !!desc);
      if (!phone) return;
      ui.setLearnBar?.(owner, desc ? desc.buttons.map((b) => ({ ...b, aria: b.aria || b.label })) : null);
      top.hidden = cardEl.hidden = !desc;
      if (!desc) { top.replaceChildren(); cardEl.replaceChildren(); return; }
      top.textContent = desc.action;
      top.dataset.kind = desc.actionKind || '';
      cardEl.dataset.empty = desc.card ? '0' : '1';
      const kids = [];
      if (desc.card) kids.push(cardBox(desc.card, 'xcardbox'));
      else kids.push(el('b', 'xcardhead', desc.title), el('span', 'xside', desc.side));
      if (desc.extra) kids.push(desc.extra);
      cardEl.replaceChildren(...kids);
    },
    top, cardEl,
  };
}
