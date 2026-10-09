// Showcase games (CHE-374): famous short games the app plays by itself. Pure data, English SAN with + and # (ADR 0004).
// notes: key = 0 based ply index into sans, a caption for the famous moments. slow: plies played in slow motion.
// key: plies the camera treats as hero shots. test/showcase-data.mjs proves every move legal and the last one mate.
export const GAMES = {
  immortal: {
    id: 'immortal', white: 'Adolf Anderssen', black: 'Lionel Kieseritzky', year: 1851,
    place: { en: 'London', de: 'London' },
    title: { en: 'The Immortal Game', de: 'Die Unsterbliche Partie' },
    result: '1-0',
    sans: ['e4', 'e5', 'f4', 'exf4', 'Bc4', 'Qh4+', 'Kf1', 'b5', 'Bxb5', 'Nf6', 'Nf3', 'Qh6', 'd3', 'Nh5', 'Nh4', 'Qg5',
      'Nf5', 'c6', 'g4', 'Nf6', 'Rg1', 'cxb5', 'h4', 'Qg6', 'h5', 'Qg5', 'Qf3', 'Ng8', 'Bxf4', 'Qf6', 'Nc3', 'Bc5',
      'Nd5', 'Qxb2', 'Bd6', 'Bxg1', 'e5', 'Qxa1+', 'Ke2', 'Na6', 'Nxg7+', 'Kd8', 'Qf6+', 'Nxf6', 'Be7#'],
    notes: {
      2: { en: 'White offers a pawn to get a fast attack', de: 'Weiß opfert einen Bauern für schnellen Angriff' },
      6: { en: 'The king walks, so White cannot castle', de: 'Der König zieht, Rochade ist weg' },
      8: { en: 'A bishop grabs a pawn, and who cares', de: 'Ein Läufer schnappt sich einen Bauern' },
      34: { en: 'Bishop to d6!! gives up both rooks', de: 'Läufer nach d6!! gibt beide Türme her' },
      37: { en: 'Black happily eats the second rook', de: 'Schwarz verputzt den zweiten Turm' },
      40: { en: 'The knight hits with check', de: 'Der Springer schlägt mit Schach zu' },
      42: { en: 'And now the queen too! Black must take', de: 'Und jetzt noch die Dame! Schwarz muss nehmen' },
      44: { en: 'Mate with just three small pieces!', de: 'Matt mit nur drei kleinen Figuren!' },
    },
    slow: [34, 42, 44],
    key: [34, 37, 42, 44],
  },
  kinghunt: {
    id: 'kinghunt', white: 'Edward Lasker', black: 'George Alan Thomas', year: 1912,
    place: { en: 'London', de: 'London' },
    title: { en: 'The King Hunt', de: 'Die Königsjagd' },
    result: '1-0',
    sans: ['d4', 'e6', 'Nf3', 'f5', 'Nc3', 'Nf6', 'Bg5', 'Be7', 'Bxf6', 'Bxf6', 'e4', 'fxe4', 'Nxe4', 'b6', 'Ne5', 'O-O',
      'Bd3', 'Bb7', 'Qh5', 'Qe7', 'Qxh7+', 'Kxh7', 'Nxf6+', 'Kh6', 'Neg4+', 'Kg5', 'h4+', 'Kf4', 'g3+', 'Kf3', 'Be2+', 'Kg2',
      'Rh2+', 'Kg1', 'Kd2#'],
    notes: {
      14: { en: 'The knight jumps in and eyes the king', de: 'Der Springer hüpft vor und zielt auf den König' },
      20: { en: 'Queen sacrifice! The king must take', de: 'Damenopfer! Der König muss nehmen' },
      22: { en: 'Double check! Only the king can move', de: 'Doppelschach! Nur der König kann ziehen' },
      24: { en: 'Another check, the king runs out', de: 'Wieder Schach, der König läuft hinaus' },
      26: { en: 'A pawn pushes the king further', de: 'Ein Bauer treibt den König weiter' },
      28: { en: 'The net gets tighter, step by step', de: 'Das Netz wird enger, Schritt für Schritt' },
      32: { en: 'The rook joins the hunt', de: 'Der Turm hilft bei der Jagd' },
      34: { en: 'The king walks over and it is mate!', de: 'Der König geht hin und es ist Matt!' },
    },
    slow: [20, 22, 34],
    key: [20, 22, 28, 34],
  },
  reti: {
    id: 'reti', white: 'Richard Réti', black: 'Savielly Tartakower', year: 1910,
    place: { en: 'Vienna', de: 'Wien' },
    title: { en: 'Réti\'s Queen Sacrifice', de: 'Rétis Damenopfer' },
    result: '1-0',
    sans: ['e4', 'c6', 'd4', 'd5', 'Nc3', 'dxe4', 'Nxe4', 'Nf6', 'Qd3', 'e5', 'dxe5', 'Qa5+', 'Bd2', 'Qxe5', 'O-O-O', 'Nxe4',
      'Qd8+', 'Kxd8', 'Bg5+', 'Kc7', 'Bd8#'],
    notes: {
      8: { en: 'The queen steps out, a sneaky plan', de: 'Die Dame tritt vor, ein listiger Plan' },
      14: { en: 'Long castling puts a rook on the d-file', de: 'Lange Rochade: der Turm kommt auf die d-Linie' },
      16: { en: 'Queen sacrifice! White gives away the queen', de: 'Damenopfer! Weiß gibt die Dame her' },
      17: { en: 'The king has to take it', de: 'Der König muss sie nehmen' },
      18: { en: 'Double check, the king has to run', de: 'Doppelschach, der König muss fliehen' },
      20: { en: 'Checkmate with two bishops and a rook!', de: 'Matt mit zwei Läufern und einem Turm!' },
    },
    slow: [16, 20],
    key: [16, 18, 20],
  },
};
export const DEFAULT_GAME = 'immortal';
export const gameById = (id) => GAMES[id] || GAMES[DEFAULT_GAME];
