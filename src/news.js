// The version line and the News window (CHE-235). See docs/ARCHITECTURE.md, News.
//   mountNews({ ui, manual, flag }) puts the version line at the bottom of Options (tap: opens the News), builds the window and returns
//   { open, close, isOpen, autoOpen, line }. autoOpen() is called once when the game is ready: it opens the News after an update that
//   changes the first or second number, never on a first visit (only the version is remembered), never for a patch, never in ?manual=1.
//   The last seen version is kept in localStorage chess3d.newsSeen (every access in try/catch).
import './news.css';
import { addDE, t, onLanguage, i18n, translateTree } from './i18n.js';
import { LABEL, VERSION } from './version.js';
import { NEWS } from './news-data.js';
import { shouldAutoOpen, releaseUrl } from './news-rules.js';

const STORE = 'chess3d.newsSeen';
addDE({ 'news.title': 'Neuigkeiten', 'news.close': 'Schließen', 'news.versionTitle': 'Neuigkeiten dieser Version zeigen', 'news.details': 'Alle Details' });

const read = () => { try { return localStorage.getItem(STORE); } catch (e) { return null; } };
const write = (v) => { try { localStorage.setItem(STORE, v); } catch (e) { /* storage blocked: the News may show again next time */ } };

export function mountNews({ ui, manual = false, flag = null } = {}) {
  const el = (tag, cls, html) => { const d = document.createElement(tag); if (cls) d.className = cls; if (html != null) d.innerHTML = html; return d; };

  // the version line: a button of at least 44 px, small and grey
  const line = el('button', 'verline');
  line.type = 'button';
  line.id = 'version-line';
  line.textContent = LABEL;
  line.dataset.i18nTitle = 'news.versionTitle';
  line.setAttribute('title', 'Show what is new');
  ui.mountFooter?.(line);

  // the window
  const ov = el('div', 'newsov');
  ov.id = 'news';
  ov.hidden = true;
  ov.setAttribute('role', 'dialog');
  ov.setAttribute('aria-modal', 'true');
  ov.setAttribute('aria-labelledby', 'news-title');
  ov.innerHTML = '<div class="newscard"><header><h2 id="news-title" data-i18n="news.title">News</h2><button class="newsx" id="news-close" type="button" aria-label="Close" data-i18n-aria="news.close">&times;</button></header><div class="newsbody" id="news-body"></div></div>';
  document.getElementById('hud').append(ov);
  const body = ov.querySelector('#news-body'), closeBtn = ov.querySelector('#news-close');

  function fill() {
    const de = i18n.language === 'de';
    body.replaceChildren(...NEWS.map((n) => {
      const sec = el('section', 'newsver');
      sec.dataset.version = n.version;
      const head = el('h3', null, `<span>v${n.version}</span><small>${n.date}</small>`);
      const ul = el('ul');
      for (const p of (de ? n.de : n.en)) { const li = el('li'); li.textContent = p; ul.append(li); }
      const a = el('a', 'newslink');
      a.href = releaseUrl(n.version);
      a.target = '_blank';
      a.rel = 'noopener noreferrer';
      a.textContent = de ? 'Alle Details' : 'Full details';
      sec.append(head, ul, a);
      return sec;
    }));
  }
  fill();
  translateTree(ov);
  translateTree(line);
  onLanguage(() => { fill(); translateTree(ov); translateTree(line); });

  let from = null;
  function open() {
    if (!ov.hidden) return;
    from = document.activeElement;
    ov.hidden = false;
    body.scrollTop = 0;
    closeBtn.focus();
  }
  function close() {
    if (ov.hidden) return;
    ov.hidden = true;
    try { from?.focus?.(); } catch (e) { /* element gone */ }
  }
  line.addEventListener('click', () => { ui.closeSheets?.(); open(); });
  closeBtn.addEventListener('click', close);
  ov.addEventListener('click', (e) => { if (e.target === ov) close(); });
  ov.addEventListener('keydown', (e) => {
    if (e.key === 'Escape') { e.stopPropagation(); close(); }
    if (e.key === 'Tab') { const f = [...ov.querySelectorAll('button, a')]; const i = f.indexOf(document.activeElement); e.preventDefault(); f[(i + (e.shiftKey ? -1 : 1) + f.length) % f.length].focus(); }
  });

  // once, when the game is ready
  function autoOpen() {
    if (flag === '1') { open(); return 'flag'; }                 // ?news=1: on purpose
    if (manual) return 'manual';                                  // tests never auto open, nor touch the stored version
    const last = read();
    if (last == null) { write(VERSION); return 'first visit'; }   // a first visit: only remember
    if (last === VERSION) return 'same';
    const go = shouldAutoOpen(last, VERSION);
    write(VERSION);
    if (go) { open(); return 'opened'; }
    return 'patch';
  }

  return { open, close, isOpen: () => !ov.hidden, autoOpen, line, root: ov, version: VERSION, label: LABEL };
}
