// German texts for the game review, registered on import, and the friendly sentence for a marked move. The English texts are
// the fallbacks passed to t(). The voice is the Explain voice: short, calm, no blame.
import { addDE, t, sanDisplay } from '../i18n.js';

addDE({
  'review.button': 'Partie ansehen', 'review.title': 'Partie ansehen', 'review.close': 'Schließen',
  'review.back': 'Ein Zug zurück', 'review.forward': 'Ein Zug vor', 'review.start': 'Zum Anfang',
  'review.details': 'Details', 'review.detailsHide': 'Weniger',
  'review.analysing': 'Ich schaue mir die Partie an: {n} von {total}', 'review.ready': 'Analyse fertig',
  'review.mistake': 'Ungenau', 'review.blunder': 'Patzer', 'review.best': 'Bester Zug', 'review.good': 'Gut',
  'review.startPos': 'Grundstellung', 'review.moveOf': 'Zug {n} von {total}',
  'review.legend': 'Orange: ungenau. Rot: Patzer.',
  'review.graph': 'Bewertung', 'review.graphHint': 'Antippen, um zu der Stelle zu springen',
  'review.line': 'Beste Folge', 'review.accuracy': 'Genauigkeit', 'review.white': 'Weiß', 'review.black': 'Schwarz',
  'review.noMoves': 'Noch nichts zum Ansehen: häng ?moves=... an den Link', 'review.noLine': 'Hier ist die Partie zu Ende.', 'review.waiting': 'Noch nicht berechnet',
  'review.mate': 'Besser war {san}: Schachmatt!',
  'review.allowsMate': 'Damit kann die andere Seite Matt setzen. Besser war {san}.',
  'review.win': 'Besser war {san}: Das gewinnt {piece}.',
  'review.hang': 'Damit kann die andere Seite {piece} schlagen. Besser war {san}.',
  'review.check': 'Besser war {san}: Das gibt Schach und hält den Druck hoch.',
  'review.generic': 'Besser war {san}: Die Stellung bleibt gesünder.',
  'review.acc.p': 'einen Bauern', 'review.acc.n': 'einen Springer', 'review.acc.b': 'einen Läufer',
  'review.acc.r': 'einen Turm', 'review.acc.q': 'die Dame', 'review.acc.k': 'den König',
});

const PIECE = { p: 'a pawn', n: 'a knight', b: 'a bishop', r: 'a rook', q: 'the queen', k: 'the king' };
const EN = {
  mate: 'Better was {san}: checkmate!',
  allowsMate: 'This lets the other side give checkmate. Better was {san}.',
  win: 'Better was {san}: it wins {piece}.',
  hang: 'This lets the other side take {piece}. Better was {san}.',
  check: 'Better was {san}: it gives check and keeps the pressure on.',
  generic: 'Better was {san}: the position stays healthier.',
};

// facts: { type, san, piece? } from sentenceFacts()
export function sentence(facts) {
  const vars = { san: sanDisplay(facts.san) };
  if (facts.piece) vars.piece = t(`review.acc.${facts.piece}`, PIECE[facts.piece]);
  return t(`review.${facts.type}`, EN[facts.type], vars);
}
