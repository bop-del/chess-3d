// Interface language: English (the source text, passed as the fallback to t()) and German (the DE table below).
// Keys are dotted, for example 'hud.newGame' or 'explain.next'. Placeholders are {name} and are filled by t(key, fallback, vars).
// Stored data is always English SAN (ADR 0004): sanDisplay() maps piece letters at display time and nowhere else.
// The language is a per user preference in localStorage, defaulting to navigator.language. It is not in the URL.
const STORE = 'chess3d.lang';
const listeners = [];

function initial() {
  try { const s = localStorage.getItem(STORE); if (s === 'de' || s === 'en') return s; } catch (e) { /* storage blocked */ }
  try { return /^de\b/i.test(navigator.language || '') ? 'de' : 'en'; } catch (e) { return 'en'; }
}
let language = initial();

// German texts by key. A key without an entry shows its English fallback.
export const DE = {
  // language switch
  'lang.label': 'Sprache',
  'lang.en': 'English',
  'lang.de': 'Deutsch',

  // phone
  'phone.tapPiece': 'Figur antippen', 'phone.tapPieceD': 'Auswählen, dann ein Feld antippen',
  'phone.drag': 'Ziehen', 'phone.dragD': 'Kamera drehen',
  'phone.two': 'Zwei Finger', 'phone.twoD': 'Zum Zoomen spreizen',
  'phone.undo': 'Zurück', 'phone.undoD': 'Einen Zug zurücknehmen',
  'phone.flip': 'Wenden', 'phone.flipD': 'Von der anderen Seite ansehen',
  'phone.views': 'Ansichten', 'phone.viewsD': 'Kameraansichten durchschalten',
  'phone.newAsk': 'Neue Partie beginnen?', 'phone.yes': 'Ja', 'phone.cancel': 'Abbrechen',
  'phone.menu': 'Menü', 'phone.closeMenu': 'Menü schließen', 'phone.controls': 'Spielsteuerung',
  'phone.viewGimbal': 'Ansicht und Kardan', 'phone.help': 'Hilfe', 'phone.last': 'Zuletzt: {move}',

  // HUD
  'hud.title': 'Chess 3D', 'hud.sub': 'Studio-Edition',
  'hud.hide': 'HUD ausblenden (H)', 'hud.hideLabel': 'HUD ausblenden', 'hud.show': 'HUD einblenden',
  'hud.controls': 'Steuerung',
  'hud.view': 'Ansicht', 'hud.gimbal': 'Brett-Kardan', 'hud.scene': 'Szene', 'hud.game': 'Partie',
  'hud.moves': 'Züge', 'hud.captured': 'Geschlagen',
  'hud.lockView': 'Ansicht sperren', 'hud.lockTitle': 'Alle Kamerabewegungen sperren, Tippen bewegt weiter Figuren',
  'hud.flip': 'Wenden', 'hud.flipTitle': 'Auf die andere Seite drehen (F)',
  'hud.spin': 'Kreisen', 'hud.spinTitle': 'Automatisch drehen (Leertaste)',
  'hud.reset': 'Reset', 'hud.resetTitle': 'Ansicht zurücksetzen (R)',
  'hud.pitch': 'Neigung', 'hud.yaw': 'Gieren', 'hud.roll': 'Rollen',
  'hud.levelBoard': 'Brett ausrichten',
  'hud.lighting': 'Licht', 'hud.quality': 'Qualität',
  'hud.low': 'Niedrig', 'hud.medium': 'Mittel', 'hud.high': 'Hoch',
  'hud.newGame': 'Neue Partie', 'hud.newGameTitle': 'Neue Partie (N)',
  'hud.undo': 'Zurück', 'hud.undoTitle': 'Zug zurücknehmen (U)',
  'hud.keys': 'Tasten', 'hud.keysTitle': 'Tastenkürzel (?)',
  'hud.vsComputer': 'gegen Computer', 'hud.yourSide': 'Deine Seite',
  'hud.playWhite': 'Als Weiß', 'hud.playBlack': 'Als Schwarz', 'hud.strength': 'Stärke',
  'hud.novice': 'Anfänger 700', 'hud.easy': 'Leicht 900', 'hud.normal': 'Mittel 1200', 'hud.hard': 'Schwer 1450',
  'hud.byWhite': 'Von Weiß', 'hud.byBlack': 'Von Schwarz',
  'hud.keyboardMouse': 'Tastatur und Maus',

  // Good move helper
  'good.label': 'Guter Zug?', 'good.title': 'Einen guten Zug zeigen',

  // turn and status
  'turn.white': 'Weiß am Zug', 'turn.black': 'Schwarz am Zug',
  'turn.checkmate': 'Schachmatt. {side} gewinnt', 'turn.draw': 'Remis', 'turn.gameOver': 'Partie zu Ende',
  'turn.thinking': 'Computer denkt nach', 'turn.check': 'Schach',
  'turn.computerMove': 'Computer am Zug', 'turn.yourMove': 'Du bist am Zug',
  'side.white': 'Weiß', 'side.black': 'Schwarz',
  'moves.empty': 'Noch keine Züge. Klicke eine Figur an, um zu beginnen.',
  'reason.stalemate': 'Patt', 'reason.insufficient material': 'Zu wenig Material',
  'reason.threefold repetition': 'Dreifache Stellungswiederholung', 'reason.fifty-move rule': '50-Züge-Regel',

  // promotion and banner
  'promo.title': 'Bauernumwandlung',
  'piece.q': 'Dame', 'piece.r': 'Turm', 'piece.b': 'Läufer', 'piece.n': 'Springer',
  'banner.checkmate': 'Schachmatt', 'banner.draw': 'Remis', 'banner.wins': '{side} gewinnt',
  'banner.review': 'Brett ansehen',

  // keyboard help
  'key.drag': 'Ziehen', 'key.dragD': 'Kamera drehen',
  'key.shiftDrag': 'Shift + Ziehen / Rechts ziehen', 'key.shiftDragD': 'Brett drehen',
  'key.wheel': 'Rad / Spreizen', 'key.wheelD': 'Zoomen',
  'key.qe': 'Q / E', 'key.qeD': 'Brett rollen (Z)',
  'key.ws': 'W / S', 'key.wsD': 'Brett neigen (X)',
  'key.ad': 'A / D', 'key.adD': 'Brett gieren (Y)',
  'key.arrows': 'Pfeiltasten', 'key.arrowsD': 'Kamera drehen',
  'key.plusMinus': '+ / -', 'key.plusMinusD': 'Zoomen',
  'key.r': 'R', 'key.rD': 'Ansicht zurücksetzen',
  'key.f': 'F', 'key.fD': 'Auf die andere Seite drehen',
  'key.v': 'V', 'key.vD': 'Von oben',
  'key.1to5': '1 bis 5', 'key.1to5D': 'Ansichtsvorlagen',
  'key.space': 'Leertaste', 'key.spaceD': 'Automatisch drehen',
  'key.u': 'U', 'key.uD': 'Zug zurücknehmen',
  'key.n': 'N', 'key.nD': 'Neue Partie',
  'key.h': 'H', 'key.hD': 'HUD aus- und einblenden',

  // view presets and lighting names (names come from controls.js and scene.js)
  'preset.White view': 'Weiße Seite', 'preset.Black view': 'Schwarze Seite', 'preset.Top down': 'Von oben',
  'preset.Side': 'Seitenansicht', 'preset.Isometric': 'Isometrisch',
  'light.Studio': 'Studio', 'light.Gallery': 'Galerie', 'light.Sunset': 'Sonnenuntergang', 'light.Night': 'Nacht',

  // Explain mode (src/openings/explain-panel.js). The line texts themselves live in src/openings/lines.js as { en, de } pairs.
  'explain.title': 'Eröffnungen',
  'explain.lead': 'Wähle eine Eröffnung. Du spielst deine Züge, das Spiel spielt die andere Seite, und jeder Zug sagt, wofür er gut ist.',
  'explain.soon': 'Kommt bald',
  'explain.forWhite': 'Du spielst Weiß', 'explain.forBlack': 'Du spielst Schwarz',
  'explain.yourMove': 'Du bist am Zug.', 'explain.opponentMoves': 'Der Gegner antwortet.', 'explain.done': 'Linie abgeschlossen.',
  'explain.notThisMove': 'Nicht dieser Zug. Die Linie spielt',
  'explain.back': 'Ein Zug zurück', 'explain.again': 'Nochmal', 'explain.showMe': 'Zeig es mir',
  'explain.all': 'Alle Eröffnungen', 'explain.another': 'Andere Linie wählen',
  'explain.hintOn': 'Hinweis zeigen', 'explain.hintOff': 'Hinweis ausblenden',

  // loader and notices
  'loader.sub': 'Brett und Figuren werden gebildet', 'loader.start': 'Start',
  'loader.error': 'Beim Laden ist etwas schiefgegangen',
  'notice.failed': 'Die Grafik konnte nicht wiederhergestellt werden. Tippe, um die Seite neu zu laden.',
  'notice.stalled': 'Der Browser hat die Grafik noch nicht zurückgegeben. Tippe, um die Seite neu zu laden.',
};

export function t(key, fallback = key, vars) {
  let s = fallback;
  if (language === 'de' && Object.prototype.hasOwnProperty.call(DE, key)) s = DE[key];
  if (vars) s = s.replace(/\{(\w+)\}/g, (m, k) => (k in vars ? vars[k] : m));
  return s;
}

export function setLanguage(lang) {
  const next = lang === 'de' ? 'de' : 'en';
  const changed = next !== language;
  language = next;
  try { localStorage.setItem(STORE, language); } catch (e) { /* storage blocked */ }
  try { document.documentElement.lang = language; } catch (e) { /* no document */ }
  if (changed) listeners.forEach((fn) => fn(language));
}
export function onLanguage(fn) { listeners.push(fn); }
// modules register their own German strings, so the DE table above is not a shared file for every feature
export function addDE(map) { Object.assign(DE, map); }
export const i18n = { get language() { return language; } };

// ---------------------------------------------------------------- DOM helper
// Marks: data-i18n="key" (text), data-i18n-title="key" (title attribute), data-i18n-aria="key" (aria-label). The English
// text found on first sight is kept in data-en* and used as the fallback, so templates stay readable in English.
export function translateTree(root) {
  if (!root || !root.querySelectorAll) return;
  const nodes = root.matches && root.matches('[data-i18n],[data-i18n-title],[data-i18n-aria]') ? [root] : [];
  nodes.push(...root.querySelectorAll('[data-i18n],[data-i18n-title],[data-i18n-aria]'));
  for (const n of nodes) {
    if (n.dataset.i18n) {
      if (n.dataset.en == null) n.dataset.en = n.textContent;
      n.textContent = t(n.dataset.i18n, n.dataset.en);
    }
    if (n.dataset.i18nTitle) {
      if (n.dataset.enTitle == null) n.dataset.enTitle = n.getAttribute('title') || '';
      n.setAttribute('title', t(n.dataset.i18nTitle, n.dataset.enTitle));
    }
    if (n.dataset.i18nAria) {
      if (n.dataset.enAria == null) n.dataset.enAria = n.getAttribute('aria-label') || '';
      n.setAttribute('aria-label', t(n.dataset.i18nAria, n.dataset.enAria));
    }
  }
}

// ---------------------------------------------------------------- notation
// English SAN piece letters to German at display time: K D T L S (Koenig, Dame, Turm, Laeufer, Springer). Pawns have no
// letter. A promotion keeps the same mapping (e8=D). Castling O-O is the same in both languages. Never applied to stored data.
const DE_LETTER = { K: 'K', Q: 'D', R: 'T', B: 'L', N: 'S' };
export const san = (s, lang) => sanDisplay(s, lang);   // the name the Explain panel looks for
export function sanDisplay(san, lang = language) {
  if (lang !== 'de' || !san) return san;
  return san.replace(/^[KQRBN]/, (c) => DE_LETTER[c]).replace(/=([QRBN])/, (m, c) => `=${DE_LETTER[c]}`);
}
