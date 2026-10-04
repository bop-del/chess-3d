// Device facts, read once at startup. Imported by any module that needs to know about phones. Nothing here changes at runtime
// except `portrait`, which follows orientation changes.
//   device.touch      primary input is a finger ((pointer: coarse)), ?touch=1 forces it on, ?touch=0 forces it off
//   device.ios        iPhone, iPad or iPadOS that reports itself as a Mac (every iOS browser uses WebKit)
//   device.phone      touch and the short side of the screen is 500 CSS px or less (with ?touch=1 the short side of the viewport)
//   device.standalone launched from the Home Screen (no browser bars)
//   device.portrait   the viewport is taller than wide right now
// It also puts classes on <body> (and `touch` on <html>) so CSS can react: `touch`, `ios`, `phone`, `portrait`.
// On touch it stops the page gestures (pinch, double tap zoom) that iOS Safari still
// performs although the viewport says user-scalable=no. The canvas keeps its own pinch (Pointer Events in src/controls.js).
const params = new URLSearchParams(location.search);

const mq = (q) => { try { return matchMedia(q).matches; } catch (e) { return false; } };

const ua = navigator.userAgent || '';
const ios = /iPhone|iPad|iPod/.test(ua) || (navigator.platform === 'MacIntel' && navigator.maxTouchPoints > 1);
const flag = params.get('touch');
const forced = flag === '1' || flag === '0';
const touch = flag === '1' ? true : flag === '0' ? false : mq('(pointer: coarse)');
// a forced ?touch=1 measures the viewport (the private phone frame is an iframe of 390x844 on a Mac whose screen is large), else the screen
const short = flag === '1' ? Math.min(innerWidth, innerHeight) : Math.min(screen.width || innerWidth, screen.height || innerHeight);

export const device = {
  touch,
  ios,
  forced,
  phone: touch && short <= 500,
  standalone: mq('(display-mode: standalone)') || navigator.standalone === true,
  portrait: innerHeight > innerWidth,
};

function apply() {
  device.portrait = innerHeight > innerWidth;
  const c = document.body.classList;
  document.documentElement.classList.toggle('touch', device.touch);
  c.toggle('touch', device.touch);
  c.toggle('ios', device.ios);
  c.toggle('phone', device.phone);
  c.toggle('portrait', device.portrait);
}

function blockGestures() {
  const stop = (e) => { if (e.cancelable) e.preventDefault(); };
  for (const g of ['gesturestart', 'gesturechange', 'gestureend']) document.addEventListener(g, stop, { passive: false });
  // two fingers anywhere except on the canvas (which handles its own pinch) must not zoom the page
  document.addEventListener('touchmove', (e) => {
    if (e.touches && e.touches.length > 1 && !(e.target && e.target.id === 'stage')) stop(e);
  }, { passive: false });
  // a second tap on the canvas within 320 ms is a double tap: block it so it does not zoom. HUD buttons are left alone (a quick
  // second tap on another button must still click; touch-action: manipulation in the stylesheet stops their double tap zoom).
  let lastEnd = 0;
  document.addEventListener('touchend', (e) => {
    const now = performance.now();
    if (now - lastEnd < 320 && e.target && e.target.id === 'stage') stop(e);
    lastEnd = now;
  }, { passive: false });
}

if (document.body) apply(); else addEventListener('DOMContentLoaded', apply);
addEventListener('resize', apply);
addEventListener('orientationchange', apply);
if (device.touch) blockGestures();
