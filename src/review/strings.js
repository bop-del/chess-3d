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
  // CHE-155: guidance for the two variants (review=a Guided strip, review=b Summary first)
  'review.g.best': 'Bester Zug', 'review.g.good': 'Gut', 'review.g.mistake': 'Ungenau (orange)', 'review.g.blunder': 'Patzer (rot)',
  'review.x.best': 'Bester Zug: Das ist der Zug, den der Computer auch gewählt hätte. Auf dem Streifen ist er nicht gefärbt.',
  'review.x.good': 'Gut: nicht der allerbeste Zug, aber deine Gewinnchance bleibt fast gleich. Auch nicht gefärbt.',
  'review.x.mistake': 'Ungenau: Es gab einen besseren Zug. Du hast einen Teil deiner Gewinnchance abgegeben. Die Gewinnchance sagt, wie gut eine Seite in der Stellung steht.',
  'review.x.blunder': 'Patzer: Hier ging viel Gewinnchance verloren, oft eine Figur oder sogar Matt. Der goldene Pfeil zeigt den besseren Zug.',
  'review.legendTitle': 'Antippen zum Erklären',
  'review.coach.start': 'Start der Partie. Mit den Pfeilen Zug für Zug weitergehen.',
  'review.coach.wait': 'Zug {n} von {total}. Ich schaue mir den Zug noch an. Mit den Pfeilen weitergehen.',
  'review.coach.best': 'Zug {n} von {total}. {side} hat den besten Zug gespielt.',
  'review.coach.good': 'Zug {n} von {total}. {side} hat gut gespielt.',
  'review.coach.suggest': 'Zug {n} von {total}. Hier gab es etwas Besseres. Der goldene Pfeil zeigt es.',
  'review.coach.mistake': 'Zug {n} von {total}. {side} war hier ungenau. Mit ◀ siehst du den besseren Zug.',
  'review.coach.blunder': 'Zug {n} von {total}. {side} hat hier gepatzt. Mit ◀ siehst du den besseren Zug.',
  'review.coach.go': 'Mit den Pfeilen weitergehen.', 'review.coach.last': 'Das war der letzte Zug.',
  'review.hint': 'Tipp: ◀ und ▶ gehen Zug für Zug. Orange und rote Züge zeigen dir den besseren Zug.',
  'review.sum.title': 'So lief die Partie', 'review.sum.wait': 'Ich schaue mir die Partie an: {n} von {total}',
  'review.sum.acc': '{side}: {word} ({pct})',
  'review.sum.w1': 'sehr sauber', 'review.sum.w2': 'solide', 'review.sum.w3': 'mit ein paar Ungenauigkeiten', 'review.sum.w4': 'ein wildes Spiel',
  'review.sum.counts': '{o} orange und {r} rote Züge.', 'review.sum.none': 'Keine orangen oder roten Züge.',
  'review.sum.biggest': 'Der größte Ausrutscher: Zug {n} ({san}, {side}).', 'review.sum.show': 'Zeig mir', 'review.sum.go': 'Mit den Pfeilen Zug für Zug ansehen.',
  'review.how': 'So lesen', 'review.howTitle': 'So lesen: orange und rote Züge',
});
const EN2 = {
  'review.g.best': 'Best move', 'review.g.good': 'Good', 'review.g.mistake': 'Inaccurate (orange)', 'review.g.blunder': 'Blunder (red)',
  'review.x.best': 'Best move: the move the computer would have chosen too. It is not coloured on the strip.',
  'review.x.good': 'Good: not the very best move, but your winning chance stays almost the same. Not coloured either.',
  'review.x.mistake': 'Inaccurate: there was a better move. You gave away part of your winning chance. The winning chance tells how well a side stands in the position.',
  'review.x.blunder': 'Blunder: a lot of winning chance was lost here, often a piece or even checkmate. The gold arrow shows the better move.',
  'review.legendTitle': 'Tap to explain',
  'review.coach.start': 'Start of the game. Use the arrows to go move by move.',
  'review.coach.wait': 'Move {n} of {total}. I am still looking at this move. Use the arrows to go on.',
  'review.coach.best': 'Move {n} of {total}. {side} played the best move.',
  'review.coach.good': 'Move {n} of {total}. {side} played well.',
  'review.coach.suggest': 'Move {n} of {total}. There was something better here. The gold arrow shows it.',
  'review.coach.mistake': 'Move {n} of {total}. {side} was inaccurate here. Press ◀ to see the better move.',
  'review.coach.blunder': 'Move {n} of {total}. {side} made a blunder here. Press ◀ to see the better move.',
  'review.coach.go': 'Use the arrows to go on.', 'review.coach.last': 'That was the last move.',
  'review.hint': 'Tip: ◀ and ▶ go move by move. Orange and red moves show you the better move.',
  'review.sum.title': 'How the game went', 'review.sum.wait': 'Looking at the game: {n} of {total}',
  'review.sum.acc': '{side}: {word} ({pct})',
  'review.sum.w1': 'very clean', 'review.sum.w2': 'solid', 'review.sum.w3': 'with a few slips', 'review.sum.w4': 'a wild game',
  'review.sum.counts': '{o} orange and {r} red moves.', 'review.sum.none': 'No orange or red moves.',
  'review.sum.biggest': 'The biggest slip: move {n} ({san}, {side}).', 'review.sum.show': 'Show me', 'review.sum.go': 'Go through it move by move with the arrows.',
  'review.how': 'How to read', 'review.howTitle': 'How to read: orange and red moves',
};
// the new CHE-155 texts: rt('review.coach.best', { n, total, side })
export const rt = (key, vars) => t(key, EN2[key], vars);

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
