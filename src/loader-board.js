// The fallback loading screen: a CSS 3D board that builds itself while the game loads. No WebGL and no imports. main.js loads it
// only when the real start sequence (src/intro.js, a 3D king and the board on the real renderer) cannot run.
//   squares drop in as a diagonal wave from a1 to h8, then the 32 pieces rise as gold silhouettes, then the frame slides in
//   (window.__loader.progress(p, msg): p 0..1 from the boot code; main.js ends it with finish()).
// Everything drawn is a pure function of one number, the shown progress, so a test or a clip can set it directly:
//   window.__loader.show(p) draws that state now. The camera matches the real start view (scene.js fov 35, White view pitch
//   46 degrees, distance 22.7 at 1280x720), seen through CSS perspective.
const FOV = 35, S = 64;                                  // vertical field of view, css px per board unit
const FRAME = 9.3;                                       // frame width in squares (board 8 + two 0.65 rims)
const MIN_BUILD = 1.2;                                   // the build never plays faster than this, seconds
const THEMES = {                                         // square light, square dark, frame, frame rim, glint
  classic: ['#e6e1d6', '#14161d', '#5a3a26', '#d8b468'],
  tournament: ['#f0eed6', '#58863b', '#3a362c', '#d8b468'],
  wood: ['#efc687', '#6a2b1c', '#4b2a18', '#d8b468'],
  metal: ['#d9a640', '#9aa1ac', '#3b3f46', '#e8c97a'],
  glass: ['#9fd0ff', '#3a4250', '#2a3342', '#bfe0ff'],
};
// piece silhouettes in a 60 x 100 box, base on the bottom edge
const BASE = 'M6 100V93H54V100Z';
const PIECES = {
  p: { h: 1.0, d: `${BASE}M30 14a12 12 0 1 0 .01 0ZM22 38H38L36 46C42 58 42 76 46 93H14C18 76 18 58 24 46Z` },
  r: { h: 1.2, d: `${BASE}M10 6H19V14H24V6H36V14H41V6H50V26L45 32V74L52 88V93H8V88L15 74V32L10 26Z` },
  n: { h: 1.4, d: `${BASE}M14 93C14 72 24 62 28 50C20 52 14 56 8 60C3 55 6 48 10 42L24 18L26 6L33 16C50 22 57 44 53 64C50 78 50 86 50 93Z` },
  b: { h: 1.55, d: `${BASE}M30 0a5 5 0 1 0 .01 0ZM30 14C44 24 47 38 39 50C43 56 44 62 40 68H36C38 78 42 86 46 93H14C18 86 22 78 24 68H20C16 62 17 56 21 50C13 38 16 24 30 14Z` },
  q: { h: 1.75, d: `${BASE}M8 22L16 56L20 24L26 54L30 14L34 54L40 24L44 56L52 22L50 62C46 72 44 80 48 93H12C16 80 14 72 10 62ZM8 14a4 4 0 1 0 .01 0ZM20 16a4 4 0 1 0 .01 0ZM30 4a4 4 0 1 0 .01 0ZM40 16a4 4 0 1 0 .01 0ZM52 14a4 4 0 1 0 .01 0Z` },
  k: { h: 1.9, d: `${BASE}M27 0H33V6H39V12H33V20C44 24 50 34 46 46C44 54 40 62 40 70C40 80 44 86 48 93H12C16 86 20 80 20 70C20 62 16 54 14 46C10 34 16 24 27 20V12H21V6H27Z` },
};
const BACK = 'rnbqkbnr';

const clamp = (x, a = 0, b = 1) => Math.min(b, Math.max(a, x));
const seg = (p, a, b) => clamp((p - a) / (b - a));
const easeOut = (u) => 1 - (1 - u) * (1 - u) * (1 - u);
const easeOutBack = (u) => { const c = 1.5; return 1 + (c + 1) * Math.pow(u - 1, 3) + c * Math.pow(u - 1, 2); };

function storedTheme() {
  try { const id = localStorage.getItem('chess3d.theme'); return THEMES[id] ? id : 'classic'; } catch (e) { return 'classic'; }
}

export function createLoaderBoard(root, { theme = storedTheme(), phone = false } = {}) {
  const el = (cls, parent) => { const d = document.createElement('div'); d.className = cls; if (parent) parent.appendChild(d); return d; };
  const scene = el('lb-scene', root), board = el('lb-board', scene);
  const frame = el('lb-frame', board);
  const [light, dark, rim, glint] = THEMES[theme] || THEMES.classic;
  root.style.setProperty('--lb-light', light);
  root.style.setProperty('--lb-dark', dark);
  root.style.setProperty('--lb-frame', rim);
  root.style.setProperty('--lb-glint', glint);
  root.dataset.theme = theme;

  const squares = [];
  for (let r = 0; r < 8; r++) for (let f = 0; f < 8; f++) {
    const sq = el('lb-sq ' + ((f + r) % 2 ? 'l' : 'd'), board), g = el('lb-glint', sq);
    squares.push({ sq, g, f, r, k: (f + r) / 14 });   // k 0 at a1, 1 at h8
  }
  const NS = 'http://www.w3.org/2000/svg';
  const pieces = [];
  const place = (type, color, f, r, order) => {
    const spec = PIECES[type], w = el('lb-piece ' + color, board);
    const svg = document.createElementNS(NS, 'svg');
    svg.setAttribute('viewBox', '0 0 60 100'); svg.setAttribute('preserveAspectRatio', 'xMidYMax meet');
    const path = document.createElementNS(NS, 'path'); path.setAttribute('d', spec.d); path.setAttribute('fill-rule', 'nonzero');
    svg.appendChild(path); w.appendChild(svg);
    w.style.width = `${0.85 * S}px`; w.style.height = `${spec.h * 1.22 * S}px`;
    pieces.push({ w, f, r, order, h: spec.h });
  };
  for (let f = 0; f < 8; f++) {
    place(BACK[f], 'w', f, 0, f); place('p', 'w', f, 1, f + 8);
    place(BACK[f], 'b', f, 7, 16 + f); place('p', 'b', f, 6, 24 + f);
  }
  pieces.sort((a, b) => a.order - b.order);

  const cx = (f) => (f - 3.5) * S, cz = (r) => (3.5 - r) * S;   // board plane position of a square centre, y grows toward White
  const half = S / 2;
  for (const q of squares) {
    q.sq.style.width = q.sq.style.height = `${S - 1}px`;
    q.x = cx(q.f); q.y = cz(q.r);
  }
  board.style.width = board.style.height = '0px';

  /** Draw the state at shown progress p (0..1). */
  function show(p) {
    for (const q of squares) {
      const u = seg(p, q.k * 0.26, q.k * 0.26 + 0.14);              // squares build over 0..0.40 of the progress
      const fall = Math.min(1, u / 0.7);
      const z = u >= 1 ? 0 : u < 0.7 ? S * 1.6 * (1 - fall * fall) : S * 0.09 * Math.sin(Math.PI * (u - 0.7) / 0.3);
      q.sq.style.transform = `translate3d(${q.x - half}px, ${q.y - half}px, ${z}px)`;
      q.sq.style.opacity = u <= 0 ? 0 : String(clamp(u / 0.35));
      q.g.style.opacity = String(clamp(1 - Math.abs(u - 0.74) / 0.22) * (u > 0 && u < 1 ? 1 : 0));
    }
    pieces.forEach((c, i) => {
      const u = seg(p, 0.42 + i / 31 * 0.36, 0.42 + i / 31 * 0.36 + 0.14), e = u >= 1 ? 1 : easeOutBack(u);
      c.w.style.transform = `translate3d(${cx(c.f) - 0.425 * S}px, ${cz(c.r) - c.h * 1.22 * S}px, 0) rotateX(-90deg) scaleY(${Math.max(0.001, e)})`;
      c.w.style.opacity = String(clamp(u / 0.3));
      c.w.style.setProperty('--glow', String(1 - u * 0.55));     // a bright flash while rising, settles to a steady glow
    });
    const fu = seg(p, 0.86, 1), fe = easeOut(fu);
    frame.style.opacity = String(fe);
    frame.style.transform = `translate3d(${-FRAME / 2 * S}px, ${-FRAME / 2 * S}px, ${-S * 0.06 - (1 - fe) * S * 0.5}px) scale(${1 + (1 - fe) * 0.12})`;
  }

  function layout(w, h, phoneView = w < 600 && h > w) {
    const f = (h / 2) / Math.tan(FOV / 2 * Math.PI / 180);          // focal length in px
    const pitch = phoneView ? 40 : 46;
    // px per unit: desktop = the real camera (distance 22.73); phone portrait fills 94% of the width
    const pxUnit = phoneView ? 0.94 * w / FRAME / 1.07 : f / 22.73;
    const D = f / pxUnit;
    scene.style.perspective = `${f}px`;
    board.style.transform = `translateZ(${f - D * S}px) rotateX(${90 - pitch}deg)`;
    root.style.setProperty('--lb-f', `${f}px`);
  }
  return { show, layout, root };
}

/** Mount into #loader-board, drive with the real progress, and keep the build at least MIN_BUILD seconds long. */
export function mountLoader() {
  const host = document.getElementById('loader-board');
  const loader = document.getElementById('loader');
  if (!host || !loader) return null;
  const reduced = typeof matchMedia === 'function' && matchMedia('(prefers-reduced-motion: reduce)').matches;
  const lb = createLoaderBoard(host);
  const fit = () => lb.layout(innerWidth, innerHeight);
  fit(); addEventListener('resize', fit);
  let target = 0.03, shown = 0, last = performance.now(), ended = false, onEnd = null, raf = 0;
  const api = {
    progress(p) { target = Math.max(target, Math.min(p, 0.999)); },
    /** Real loading is done: play out the rest of the build, then call cb (the handover). */
    finish(cb) { target = 1; ended = true; onEnd = cb; if (reduced) { shown = 1; lb.show(1); cb(); } },
    show(p) { shown = target = p; lb.show(p); },
    boardOnly: lb,
  };
  const loop = (now) => {
    const dt = Math.min(0.1, (now - last) / 1000); last = now;
    // creep a little while nothing reports (the script is still downloading), never past a third
    if (!ended && target < 0.3) target += dt * 0.02;
    if (shown < target) shown = Math.min(target, shown + dt / MIN_BUILD * (ended ? 1.15 : 0.9));
    lb.show(shown);
    if (ended && shown >= 1) { if (onEnd) { const cb = onEnd; onEnd = null; cb(); } return; }
    raf = requestAnimationFrame(loop);
  };
  if (reduced) { shown = target = 1; lb.show(1); } else raf = requestAnimationFrame(loop);
  window.__loader = api;
  return api;
}
