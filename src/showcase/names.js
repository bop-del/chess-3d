// Spoken move names for the showcase captions (CHE-374). Input is English SAN; output is a plain sentence.
import { sanDisplay } from '../i18n.js';

const PIECE = {
  en: { K: 'King', Q: 'Queen', R: 'Rook', B: 'Bishop', N: 'Knight', P: 'Pawn' },
  de: { K: 'König', Q: 'Dame', R: 'Turm', B: 'Läufer', N: 'Springer', P: 'Bauer' },
};
const BECOMES = {
  en: { Q: 'a queen', R: 'a rook', B: 'a bishop', N: 'a knight' },
  de: { Q: 'zur Dame', R: 'zum Turm', B: 'zum Läufer', N: 'zum Springer' },
};
const T = {
  en: { to: 'to', takes: 'takes on', check: 'check', mate: 'checkmate', short: 'Castles kingside', long: 'Castles queenside', becomes: 'becomes' },
  de: { to: 'nach', takes: 'schlägt auf', check: 'Schach', mate: 'Schachmatt', short: 'Kurze Rochade', long: 'Lange Rochade', becomes: 'wird' },
};

export function moveName(san, lang = 'en') {
  const l = lang === 'de' ? 'de' : 'en', t = T[l];
  const tail = san.endsWith('#') ? `, ${t.mate}` : san.endsWith('+') ? `, ${t.check}` : '';
  const s = san.replace(/[+#]+$/, '');
  if (/^O-O-O$/.test(s)) return t.long + tail;
  if (/^O-O$/.test(s)) return t.short + tail;
  const m = /^([KQRBN])?([a-h])?([1-8])?(x)?([a-h][1-8])(?:=([QRBN]))?$/.exec(s);
  if (!m) return s + tail;
  const [, pc, , , x, dest, pr] = m;
  let out = `${PIECE[l][pc || 'P']} ${x ? t.takes : t.to} ${dest}`;
  if (pr) out += `, ${t.becomes} ${BECOMES[l][pr]}`;
  return out + tail;
}

// 0 -> '1.', 1 -> '1...', 2 -> '2.'
export const moveNumber = (ply) => `${(ply >> 1) + 1}.${ply & 1 ? '..' : ''}`;

export const sanFor = (san, lang) => sanDisplay(san, lang === 'de' ? 'de' : 'en');

export function titleLine(game, lang = 'en') {
  const vs = lang === 'de' ? 'gegen' : 'vs';
  return `${game.white} ${vs} ${game.black}, ${game.place[lang === 'de' ? 'de' : 'en']} ${game.year}`;
}
