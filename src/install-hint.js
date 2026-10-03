// Add to Home Screen reminder for iPhone and iPad Safari. A bottom sheet with three drawn steps (Share, Add to Home Screen, the icon).
//   mountInstallHint()   called once after the game is ready. Does nothing unless every condition below holds.
// Shown only in a Safari tab on iOS (not installed, device.standalone is false), and never in debug or test mode: no URL flag of the
// app at all (manual, diag, fen, moves, select, promo, quality and so on), and not under automation (navigator.webdriver).
// Never blocking: the Later button, a tap outside the sheet or Escape closes it at once and the board stays usable underneath.
// Remembered per device in localStorage: shown on the first visit, then at most twice more, at least SPACING visits apart.
// Without working storage it is not shown (it could not be remembered). No service worker, no network.
import { device } from './device.js';

const KEY = 'chess3d.install-hint';
const MAX_SHOWS = 3;       // the first time plus at most two reminders
const SPACING = 3;         // visits between two showings
const DELAY_MS = 2200;     // after the board is ready, so the first look is the board
const FLAGS = ['quality', 'touch', 'light', 'preset', 'yaw', 'pitch', 'dist', 'gx', 'gy', 'gz', 'fen', 'moves', 'select', 'promo', 'ai', 'spin', 'hud', 'help', 'manual', 'diag', 'theme', 'view', 'intro', 'open', 'daily'];
const GOLD = '#d8b468';
const FONT = "-apple-system,BlinkMacSystemFont,'SF Pro Text','Inter','Segoe UI',system-ui,sans-serif";

function scripted() {
  if (navigator.webdriver) return true;
  const p = new URLSearchParams(location.search);
  return FLAGS.some((f) => p.has(f));
}

/** True when this visit should show the reminder. Counts the visit as a side effect. Pure storage logic apart from that. */
export function wantInstallHint(storage = window.localStorage) {
  if (!device.ios || device.standalone || scripted()) return false;
  try {
    const s = JSON.parse(storage.getItem(KEY) || '{}');
    const visits = (Number.isFinite(s.visits) ? s.visits : 0) + 1;
    const shows = Number.isFinite(s.shows) ? s.shows : 0;
    const last = Number.isFinite(s.last) ? s.last : 0;
    const show = shows < MAX_SHOWS && (shows === 0 || visits - last >= SPACING);
    storage.setItem(KEY, JSON.stringify({ visits, shows: shows + (show ? 1 : 0), last: show ? visits : last }));
    return show;
  } catch (e) { return false; }
}

const SHARE = '<path d="M12 15V3.6M8.2 7.2 12 3.4l3.8 3.8M7.4 10.2H6.6a1.8 1.8 0 0 0-1.8 1.8v7a1.8 1.8 0 0 0 1.8 1.8h10.8a1.8 1.8 0 0 0 1.8-1.8v-7a1.8 1.8 0 0 0-1.8-1.8h-.8"/>';
const ADD = '<rect x="4.2" y="4.2" width="15.6" height="15.6" rx="3.6"/><path d="M12 8.4v7.2M8.4 12h7.2"/>';
const SVG = 'viewBox="0 0 200 64" width="100%" aria-hidden="true" fill="none" stroke="rgba(236,235,230,0.55)" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round"';

// the bottom bar of Safari on iPhone with the Share icon ringed
const STEP1 = `<svg ${SVG}>
  <rect x="2" y="8" width="196" height="48" rx="24" fill="rgba(255,255,255,0.05)" stroke="rgba(236,235,230,0.2)"/>
  <circle cx="26" cy="32" r="12" stroke="rgba(236,235,230,0.25)"/><path d="M29 26l-6 6 6 6" stroke="rgba(236,235,230,0.5)"/>
  <rect x="48" y="19" width="84" height="26" rx="13" stroke="rgba(236,235,230,0.25)"/><path d="M62 32h56" stroke="rgba(236,235,230,0.25)" stroke-width="3"/>
  <circle cx="160" cy="32" r="17" stroke="${GOLD}" stroke-width="2"/>
  <g transform="translate(148 20)" stroke="${GOLD}" stroke-width="1.8">${SHARE}</g>
  <circle cx="186" cy="32" r="2" fill="rgba(236,235,230,0.3)" stroke="none"/>
</svg>`;
// the share sheet with the Add to Home Screen row picked out
const STEP2 = `<svg ${SVG}>
  <rect x="2" y="2" width="196" height="60" rx="14" fill="rgba(255,255,255,0.05)" stroke="rgba(236,235,230,0.2)"/>
  <path d="M16 14h70" stroke="rgba(236,235,230,0.22)" stroke-width="3"/><path d="M16 52h92" stroke="rgba(236,235,230,0.22)" stroke-width="3"/>
  <rect x="8" y="22" width="184" height="22" rx="8" fill="rgba(216,180,104,0.14)" stroke="${GOLD}" stroke-width="1.8"/>
  <g transform="translate(14 22) scale(0.9)" stroke="${GOLD}" stroke-width="1.9">${ADD}</g>
  <text x="42" y="37.5" fill="${GOLD}" stroke="none" font-family="${FONT}" font-size="10" letter-spacing="0.4">Add to Home Screen</text>
</svg>`;
// the installed icon, the real one the game ships
const STEP3 = `<svg viewBox="0 0 200 64" width="100%" aria-hidden="true">
  <rect x="2" y="2" width="196" height="60" rx="14" fill="rgba(255,255,255,0.05)" stroke="rgba(236,235,230,0.2)" stroke-width="1.6"/>
  <image href="./apple-touch-icon.png" x="82" y="7" width="36" height="36" preserveAspectRatio="xMidYMid slice" style="clip-path:inset(0 round 8px)"/>
  <text x="100" y="56" text-anchor="middle" fill="rgba(236,235,230,0.75)" font-family="${FONT}" font-size="8" letter-spacing="0.5">Chess 3D</text>
</svg>`;
const STEPS = [
  { art: STEP1, text: 'Tap Share, the square with an up arrow' },
  { art: STEP2, text: 'Scroll and tap Add to Home Screen' },
  { art: STEP3, text: 'Tap Add, then open Chess 3D from your Home Screen' },
];

const CSS = `
.ih-scrim{position:fixed;inset:0;z-index:40;background:rgba(0,0,0,.35);display:flex;align-items:flex-end;justify-content:center;opacity:0;transition:opacity .3s ease}
.ih-scrim.in{opacity:1}
.ih-sheet{width:min(520px,100%);box-sizing:border-box;margin:0 max(8px,env(safe-area-inset-left)) max(8px,env(safe-area-inset-bottom)) max(8px,env(safe-area-inset-right));padding:16px 16px 12px;border-radius:20px;background:rgba(14,15,21,.94);border:1px solid rgba(255,255,255,.16);box-shadow:0 18px 60px rgba(0,0,0,.6);color:#ecebe6;font-family:${FONT};text-align:center;transform:translateY(24px);transition:transform .3s ease}
.ih-scrim.in .ih-sheet{transform:none}
.ih-title{margin:0 0 2px;font-size:16px;font-weight:600;letter-spacing:.02em}
.ih-sub{margin:0 0 12px;font-size:13px;line-height:1.4;color:#9a9ba6}
.ih-row{display:flex;flex-direction:column;gap:10px;margin-bottom:12px}
.ih-tile{display:flex;align-items:center;gap:12px;text-align:left}
.ih-art{width:42%;flex:none}
.ih-cap{font-size:13px;line-height:1.4;color:rgba(236,235,230,.88)}
.ih-n{color:${GOLD};font-weight:700;margin-right:.45em}
.ih-later{min-height:44px;min-width:120px;padding:0 22px;border-radius:12px;border:1px solid rgba(255,255,255,.16);background:rgba(255,255,255,.07);color:#ecebe6;font:inherit;font-size:15px;cursor:pointer;touch-action:manipulation}
@media (max-height:420px) and (orientation:landscape){
  .ih-sheet{width:min(560px,70vw);padding:10px 14px 8px}
  .ih-sub{display:none}
  .ih-row{margin-bottom:8px;gap:6px}
  .ih-art{width:30%}
  .ih-cap{font-size:12px}
}`;

export function mountInstallHint() {
  if (!wantInstallHint()) return null;
  setTimeout(show, DELAY_MS);
  return true;
}

function show() {
  const style = document.createElement('style');
  style.textContent = CSS;
  const scrim = document.createElement('div');
  scrim.className = 'ih-scrim';
  scrim.setAttribute('role', 'dialog');
  scrim.setAttribute('aria-label', 'Add Chess 3D to your Home Screen');
  const sheet = document.createElement('div');
  sheet.className = 'ih-sheet';
  const rows = STEPS.map((st, i) => `<div class="ih-tile"><div class="ih-art">${st.art}</div><div class="ih-cap"><span class="ih-n">${i + 1}</span>${st.text}</div></div>`).join('');
  sheet.innerHTML = `<h2 class="ih-title">Play full screen</h2><p class="ih-sub">Add Chess 3D to your Home Screen to lose the browser bars.</p><div class="ih-row">${rows}</div>`;
  const later = document.createElement('button');
  later.type = 'button';
  later.className = 'ih-later';
  later.textContent = 'Later';
  sheet.append(later);
  scrim.append(sheet);
  const close = () => {
    document.removeEventListener('keydown', onKey);
    scrim.classList.remove('in');
    setTimeout(() => { scrim.remove(); style.remove(); }, 320);
  };
  const onKey = (e) => { if (e.key === 'Escape') close(); };
  scrim.addEventListener('pointerdown', (e) => { if (!sheet.contains(e.target)) close(); });   // a tap outside the sheet
  later.addEventListener('click', close);
  document.addEventListener('keydown', onKey);
  document.head.append(style);
  document.body.append(scrim);
  requestAnimationFrame(() => requestAnimationFrame(() => scrim.classList.add('in')));
}
