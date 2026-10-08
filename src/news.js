// The version line and the News window (CHE-235). See docs/ARCHITECTURE.md, News.
//   mountNews({ ui, manual, flag }) puts the version line at the bottom of Options (tap: opens the News), builds the window and returns
//   { open, close, isOpen, autoOpen, line }. autoOpen() is called once when the game is ready: it opens the News after an update that
//   changes the first or second number, never on a first visit (only the version is remembered), never for a patch, never in ?manual=1.
//   The last seen version is kept in localStorage chess3d.newsSeen (every access in try/catch).
//   CHE-333: a visible News entry in Options with a dot while the newest News are unread (a row at the top of Options), and
//   the first visit to the new address opens the News once (marker chess3d.newsFirst, host check here, injectable as `host`).
import './news.css';
import { addDE, t, onLanguage, i18n, translateTree } from './i18n.js';
import { LABEL, VERSION } from './version.js';
import { NEWS } from './news-data.js';
import { decide, isUnread, releaseUrl } from './news-rules.js';

const STORE = 'chess3d.newsSeen', FIRST = 'chess3d.newsFirst';
export const NEW_HOST = 'chess3d.borisdiebold.com';
addDE({ 'news.title': 'Neuigkeiten', 'news.close': 'Schließen', 'news.versionTitle': 'Neuigkeiten dieser Version zeigen', 'news.details': 'Alle Details', 'news.entry': 'Neuigkeiten', 'news.entryNew': 'Neu' });

const read = () => { try { return localStorage.getItem(STORE); } catch (e) { return null; } };
const write = (v) => { try { localStorage.setItem(STORE, v); } catch (e) { /* storage blocked: the News may show again next time */ } };

const readFirst = () => { try { return localStorage.getItem(FIRST) === '1'; } catch (e) { return false; } };
const writeFirst = () => { try { localStorage.setItem(FIRST, '1'); } catch (e) { /* storage blocked */ } };

export function mountNews({ ui, manual = false, flag = null, host = window.__newsHost ?? location.hostname } = {}) {
  const el = (tag, cls, html) => { const d = document.createElement(tag); if (cls) d.className = cls; if (html != null) d.innerHTML = html; return d; };

  // the version line: a button of at least 44 px, small and grey
  const line = el('button', 'verline');
  line.type = 'button';
  line.id = 'version-line';
  line.textContent = LABEL;
  line.dataset.i18nTitle = 'news.versionTitle';
  line.setAttribute('title', 'Show what is new');
  ui.mountFooter?.(line);

  // the entry (CHE-333): a row at the top of Options; a dot while the newest News are unread
  const entry = el('button', 'newsentry');
  entry.type = 'button';
  entry.id = 'news-entry';
  const refreshEntry = () => {
    const de = i18n.language === 'de';
    const label = de ? 'Neuigkeiten' : 'News';
    entry.innerHTML = `<span class="ne-label">${label}</span><i class="ne-dot" aria-hidden="true"></i><b class="ne-go" aria-hidden="true">&rsaquo;</b>`;
    entry.setAttribute('aria-label', unread() ? `${label} (${de ? 'neu' : 'new'})` : label);
  };
  let seenNow = read();
  const unread = () => isUnread(seenNow, NEWS[0].version);
  const syncDot = () => { entry.classList.toggle('unread', unread()); ui.setNewsDot?.(unread()); refreshEntry(); };
  const mounted = ui.mountNewsEntry?.(entry);
  if (!mounted) entry.hidden = true;

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
  syncDot();
  onLanguage(() => { fill(); translateTree(ov); translateTree(line); refreshEntry(); });

  let from = null;
  function open() {
    if (!ov.hidden) return;
    from = document.activeElement;
    ov.hidden = false;
    write(NEWS[0].version); seenNow = NEWS[0].version; syncDot();   // opening the News clears the dot
    body.scrollTop = 0;
    closeBtn.focus();
  }
  function close() {
    if (ov.hidden) return;
    ov.hidden = true;
    try { from?.focus?.(); } catch (e) { /* element gone */ }
  }
  line.addEventListener('click', () => { ui.closeSheets?.(); open(); });
  entry.addEventListener('click', () => { ui.closeSheets?.(); open(); });
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
    const d = decide({ last, current: VERSION, newHost: host === NEW_HOST, first: readFirst() });
    if (d.mark) writeFirst();
    if (d.write) { write(VERSION); if (!d.open) { seenNow = VERSION; syncDot(); } }
    if (d.open) { open(); return 'opened'; }
    return d.why;
  }

  return { open, close, isOpen: () => !ov.hidden, autoOpen, line, entry, root: ov, unread, version: VERSION, label: LABEL };
}
