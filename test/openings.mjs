// Opening lines: SAN parsing, the PGN parser, and every shipped line legal on src/rules.js.
// Run: node test/openings.mjs    Exit 0 when every check holds, 1 otherwise.
import { existsSync } from 'node:fs';
import { Chess, START_FEN } from '../src/rules.js';
import { parse, mainLine } from '../src/openings/pgn.js';

let bad = 0;
const fail = (m) => { bad++; console.log('FAIL ' + m); };
const check = (cond, m) => { if (!cond) fail(m); };
const throws = (fn) => { try { fn(); return false; } catch { return true; } };

// --- SAN parsing on the rules engine
{
  const c = new Chess();
  check(c.playSan('e4')?.san === 'e4', 'plays e4');
  check(c.playSan('e4') === null, 'rejects e4 twice');
  check(c.playSan('Ke2') === null, 'rejects Ke2 for black');
  check(c.playSan('Nf6+')?.san === 'Nf6', 'tolerates a wrong check mark');
  const d = new Chess();
  for (const s of ['e4', 'e5', 'Nf3', 'Nc6', 'Bc4', 'Bc5']) d.playSan(s);
  check(d.moveFromSan('O-O')?.flag === 'k', 'castles short');
  check(d.moveFromSan('0-0')?.flag === 'k', 'zero castling');
  check(d.moveFromSan('O-O-O') === null, 'no long castle');
  const e = new Chess('4k3/P7/8/8/8/8/8/4K3 w - - 0 1');
  check(e.moveFromSan('a8=Q')?.promo === 'q' && e.moveFromSan('a8Q')?.promo === 'q', 'promotion with and without =');
  check(e.moveFromSan('a8') === null, 'promotion needs a piece');
  const f = new Chess('r3k2r/8/8/8/8/8/8/R3K2R w KQkq - 0 1');
  check(f.moveFromSan('Rd1')?.from === 0, 'Rd1 unique: only the a1 rook reaches d1');
  check(f.moveFromSan('Rae1') === null && f.moveFromSan('Rhf1')?.from === 7, 'disambiguation by file, wrong origin rejected');
  const g = new Chess();
  for (const s of ['e4', 'a6', 'e5', 'd5']) g.playSan(s);
  check(g.playSan('exd6')?.san === 'exd6' && g.board[35] === null, 'en passant by SAN');
}

// --- position key: en passant square only when a capture is possible
{
  const c = new Chess();
  c.playSan('e4');
  check(c.positionKey4() === 'rnbqkbnr/pppppppp/8/8/4P3/8/PPPP1PPP/RNBQKBNR b KQkq -', 'no ep square after 1.e4 with no capturer');
  for (const s of ['a6', 'e5', 'd5']) c.playSan(s);
  check(c.positionKey4().endsWith(' w KQkq d6'), 'ep square kept when a pawn can capture');
  check(c.positionKey4().split(' ').length === 4, 'key has four fields');
  check(new Chess(START_FEN).positionKey4() === 'rnbqkbnr/pppppppp/8/8/8/8/PPPPPPPP/RNBQKBNR w KQkq -', 'start key');
}

// --- PGN parser: variations, comments, NAGs, results, errors
{
  const root = parse('1. e4 e5 (1... c5 2. Nf3 d6 (2... Nc6)) {comment} 2. Nf3 $1 Nc6 1-0');
  check(root.children.length === 1 && root.children[0].san === 'e4', 'one first move');
  const e4 = root.children[0];
  check(e4.children.map((n) => n.san).join() === 'e5,c5', 'variation is a sibling of the move before it');
  check(e4.children[1].children[0].children.map((n) => n.san).join() === 'd6,Nc6', 'nested variation');
  check(mainLine(root).join(' ') === 'e4 e5 Nf3 Nc6', 'main line skips variations');
  check(root.key === new Chess().positionKey4(), 'root key is the start key');
  // transposition: both orders reach the same key
  const a = parse('1. Nf3 d5 2. d4'), b = parse('1. d4 d5 2. Nf3');
  check(mainLine(a).length === 3 && a.children[0].children[0].children[0].key === b.children[0].children[0].children[0].key, 'transpositions share a key');
  check(throws(() => parse('1. e4 e4')), 'illegal move throws');
  check(throws(() => parse('1. e4 (1... e5')), 'unbalanced ( throws');
  check(throws(() => parse('1. e4 )')), 'unbalanced ) throws');
}

// --- the shipped lines
const LINES = 'src/openings/lines.js';
if (!existsSync(new URL('../' + LINES, import.meta.url))) console.log('note no ' + LINES + ' yet, line checks skipped');
else {
  const mod = await import('../src/openings/lines.js');
  const lines = mod.OPENINGS || mod.LINES || mod.default;
  check(Array.isArray(lines) && lines.length > 0, 'lines.js exports a non-empty list');
  const ids = new Set();
  for (const l of lines || []) {
    const tag = l.id || '?';
    check(l.id && !ids.has(l.id), `${tag}: unique id`); ids.add(l.id);
    check(l.side === 'w' || l.side === 'b', `${tag}: side is w or b`);
    let root;
    try { root = parse(l.pgn); } catch (err) { fail(`${tag}: pgn does not parse: ${err.message}`); continue; }
    const main = mainLine(root);
    check(main.length > 0, `${tag}: pgn has moves`);
    const sans = (l.moves || []).map((m) => m.san);
    check(sans.join(' ') === main.join(' '), `${tag}: moves[].san equals the pgn main line`);
    // replay move by move on a fresh engine: every move legal, keys match the parsed tree
    const c = new Chess();
    let node = root;
    sans.forEach((san, i) => {
      const m = c.playSan(san);
      if (!m) return fail(`${tag}: move ${i + 1} ${san} is illegal`);
      node = node.children[0];
      check(node && node.key === c.positionKey4(), `${tag}: key after move ${i + 1} matches the tree`);
      check(m.san === san, `${tag}: move ${i + 1} ${san} is written as ${m.san}`);
    });
    for (const m of l.moves || []) for (const lang of ['en', 'de']) if (m[lang] !== undefined) check(typeof m[lang] === 'string' && m[lang].length > 0, `${tag}: ${m.san} has ${lang} text`);
  }
  console.log(`ok   ${(lines || []).length} lines checked`);
}

if (bad) { console.log(`\n${bad} check(s) failed`); process.exit(1); }
console.log('ok   openings');
