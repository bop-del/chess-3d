// The 2D layer of the showcase (CHE-374): title card, lower third per move, letterbox bars, slow motion tag, end card, hint.
//   createOverlay({ root, lang }) builds #showcase-overlay (hidden parts only) and returns the methods below.
// Every animation runs on the dt given to update(dt), never on wall clock (no CSS transitions, keyframes, timers): tests and the
// trailer recorder step time by hand and take a frame between two update calls. Each part keeps a progress value 0 to 1 that moves
// toward its target at its own speed; update() eases it and writes opacity and transform. pointer-events none throughout.
import './overlay.css';

const ease = (v) => 1 - (1 - v) ** 3;                // ease out; going back down it reads as an ease in, which suits an exit
const clamp01 = (v) => (v < 0 ? 0 : v > 1 ? 1 : v);

// one animated value: moves toward `to` in `inS` seconds going up and `outS` seconds going down
function tween(inS, outS) {
  return { v: 0, to: 0, inS, outS };
}
function step(tw, dt) {
  if (tw.v === tw.to) return;
  const d = tw.to > tw.v ? dt / tw.inS : -dt / tw.outS;
  tw.v = d > 0 ? Math.min(tw.to, tw.v + d) : Math.max(tw.to, tw.v + d);
}

export function createOverlay({ root = document.body, lang = 'en', look = 'classic' } = {}) {
  const de = lang === 'de';
  const pick = (o) => (o ? (de ? o.de ?? o.en : o.en ?? o.de) ?? '' : '');
  const other = (o) => (o ? (de ? o.en : o.de) ?? '' : '');
  const mk = (cls, parent, text) => {
    const d = document.createElement('div');
    d.className = cls;
    if (text != null) d.textContent = text;
    if (parent) parent.appendChild(d);
    return d;
  };

  const el = mk('');
  el.id = 'showcase-overlay';
  if (look === 'pixel') el.classList.add('look-pixel');   // Pixelwelt: square corners, flat plates, hard shadows, blocky title
  const track = look === 'pixel' ? 0.08 : 0.012;            // the title's letter spacing (em) once tracked in
  el.setAttribute('aria-hidden', 'true');

  // build order is paint order: vignette under everything, bars over the cards, hint on the bottom bar
  const vignette = mk('sc-vignette sc-hide', el);
  const titleEl = mk('sc-title sc-hide', el);
  const tKicker = mk('sc-kicker', titleEl);
  const tName = mk('sc-name', titleEl);
  const tRule = mk('sc-rule', titleEl);
  const tLine = mk('sc-line', titleEl);
  const lowerEl = mk('sc-lower sc-hide', el);
  const endEl = mk('sc-end sc-hide', el);
  const eResult = mk('sc-result', endEl);
  const eRule = mk('sc-rule', endEl);
  const eText = mk('sc-endtext', endEl);
  const eHint = mk('sc-endhint', endEl);
  const barTop = mk('sc-bar top sc-hide', el);
  const barBottom = mk('sc-bar bottom sc-hide', el);
  const slowEl = mk('sc-slow sc-hide', el, de ? 'Zeitlupe' : 'Slow motion');
  const hintEl = mk('sc-hint sc-hide', el);
  root.appendChild(el);

  const T = {
    title: tween(0.8, 0.5),
    lower: tween(0.35, 0.25),
    bars: tween(0.6, 0.6),
    slow: tween(0.4, 0.4),
    end: tween(0.9, 0.5),
    hint: tween(0.4, 0.3),
  };
  let pendingLower = null;   // the next lower third, swapped in once the current one has slid out
  let disposed = false;

  function fillLower({ num, san, name, side, note = null, big = false }) {
    lowerEl.replaceChildren();
    lowerEl.classList.toggle('big', !!big);
    const move = mk('sc-move', lowerEl);
    mk(`sc-chip ${side === 'b' ? 'b' : 'w'}`, move);
    if (num != null && num !== '') mk('sc-num', move, String(num).endsWith('.') ? String(num) : `${num}.`);
    mk('sc-san', move, pick(san));
    const names = mk('sc-names', lowerEl);
    const n1 = pick(name), n2 = other(name);
    mk('sc-n1', names, n1);
    if (n2 && n2 !== n1) mk('sc-n2', names, n2);
    if (note) {
      const box = mk('sc-note', lowerEl);
      const a = pick(note), b = other(note);
      mk('sc-note1', box, a);
      if (b && b !== a) mk('sc-note2', box, b);
    }
  }

  const show = (node, on) => node.classList.toggle('sc-hide', !on);

  // writes the styles of one node when its value changed since that node was last drawn
  const drawn = new Map();
  function draw(tw, node, paint) {
    if (drawn.get(node) === tw.v) return;
    drawn.set(node, tw.v);
    show(node, tw.v > 0);
    if (tw.v > 0) paint(ease(clamp01(tw.v)), tw.v);
  }

  function update(dt) {
    if (disposed || !(dt > 0)) return;
    for (const k in T) step(T[k], dt);
    if (pendingLower && T.lower.v === 0) { fillLower(pendingLower); pendingLower = null; T.lower.to = 1; }
    paint();
  }

  function paint() {
    draw(T.title, titleEl, (e, v) => {
      titleEl.style.opacity = e.toFixed(3);
      titleEl.style.transform = `translate(-50%, -50%) translateY(${((1 - e) * 14).toFixed(2)}px) scale(${(0.97 + 0.03 * e).toFixed(4)})`;
      tName.style.letterSpacing = `${(track + (1 - e) * 0.16).toFixed(4)}em`;   // the letters track in
      const r = ease(clamp01((v - 0.3) / 0.7));                                   // the gold rule draws out after the name
      tRule.style.transform = `scaleX(${r.toFixed(4)})`;
    });
    draw(T.lower, lowerEl, (e) => {
      lowerEl.style.opacity = e.toFixed(3);
      lowerEl.style.transform = `translateX(${((1 - e) * -44).toFixed(2)}px)`;
    });
    draw(T.bars, barTop, (e) => { barTop.style.transform = `translateY(${((e - 1) * 100).toFixed(2)}%)`; });
    draw(T.bars, barBottom, (e) => { barBottom.style.transform = `translateY(${((1 - e) * 100).toFixed(2)}%)`; });
    draw(T.slow, slowEl, (e) => {
      slowEl.style.opacity = e.toFixed(3);
      slowEl.style.transform = `translateX(${((1 - e) * -16).toFixed(2)}px)`;
    });
    draw(T.slow, vignette, (e) => { vignette.style.opacity = e.toFixed(3); });
    draw(T.end, endEl, (e, v) => {
      endEl.style.opacity = e.toFixed(3);
      endEl.style.transform = `translate(-50%, -50%) scale(${(0.94 + 0.06 * e).toFixed(4)})`;
      eRule.style.transform = `scaleX(${ease(clamp01((v - 0.3) / 0.7)).toFixed(4)})`;
      eHint.style.opacity = ease(clamp01((v - 0.5) / 0.5)).toFixed(3);
    });
    draw(T.hint, hintEl, (e) => { hintEl.style.opacity = e.toFixed(3); });
  }

  return {
    el,
    title({ title, line, year } = {}) {
      if (disposed) return;
      const lineText = pick(line);
      tKicker.textContent = year != null && !lineText.includes(String(year)) ? String(year) : '';
      show(tKicker, !!tKicker.textContent);
      tName.textContent = pick(title);
      tLine.textContent = lineText;
      T.title.to = 1;
    },
    hideTitle() { if (!disposed) { T.title.to = 0; } },
    lower(move) {
      if (disposed || !move) return;
      if (T.lower.v === 0 && T.lower.to === 0) { fillLower(move); pendingLower = null; T.lower.to = 1; }
      else { pendingLower = move; T.lower.to = 0; }   // quick out, then in with the new move
    },
    clearLower() { if (!disposed) { pendingLower = null; T.lower.to = 0; } },
    letterbox(on) {
      if (disposed) return;
      T.bars.to = on ? 1 : 0;
    },
    slow(on) { if (!disposed) { T.slow.to = on ? 1 : 0; } },
    end({ result, text, hint } = {}) {
      if (disposed) return;
      eResult.textContent = result ?? '';
      eText.textContent = pick(text);
      eHint.textContent = pick(hint) || (de ? 'Tippen zum Beenden' : 'Tap to finish');
      // the lower third never overlaps the end card: drop any move still showing or fading at once
      pendingLower = null;
      T.lower.v = 0; T.lower.to = 0;
      show(lowerEl, false); drawn.set(lowerEl, 0);
      T.end.to = 1;
    },
    hint(text) {
      if (disposed) return;
      if (text) hintEl.textContent = pick(text);
      T.hint.to = text ? 1 : 0;
    },
    update,
    dispose() {
      if (disposed) return;
      disposed = true;
      pendingLower = null;
      el.remove();
    },
  };
}
