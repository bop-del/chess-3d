// Converts a public domain Mutopia LilyPond score (a subset: relative and absolute notes, chords, ties, repeats with
// alternatives, simultaneous voices) to the compact note rows the music player plays: [midi, start, length, velocity],
// start and length in quarter notes. Used once per piece to produce src/music/pieces/*.js, kept to show where the data came from.
//
//   node tools/ly-to-notes.mjs file.ly --vel 70,48,56 [--bars 3]     (one velocity per top-level music block, in file order)
import { readFileSync } from 'node:fs';

const STEP = { c: 0, d: 2, e: 4, f: 5, g: 7, a: 9, b: 11 };
const LETTER = ['c', 'd', 'e', 'f', 'g', 'a', 'b'];

function strip(src, keepDefs = false) {
  src = src.replace(/%\{[\s\S]*?%\}/g, ' ').replace(/%[^\n]*/g, ' ');
  let out = '', i = 0;
  while (i < src.length) {
    const hit = ['\\markup', '\\header', '\\layout', '\\paper', '\\midi'].find((w) => src.startsWith(w, i));
    if (hit) {
      let j = i + hit.length;
      while (/\s/.test(src[j])) j++;
      if (src[j] === '{') { let d = 0; do { if (src[j] === '{') d++; else if (src[j] === '}') d--; j++; } while (d > 0 && j < src.length); } else if (src[j] === '"') j = src.indexOf('"', j + 1) + 1;
      i = j; continue;
    }
    out += src[i++];
  }
  return out.replace(/"[^"]*"/g, ' STR ')  .replace(keepDefs ? /$^/ : /^[ \t]*[a-zA-Z]\w*[ \t]*=[ \t]*/gm, ' ');
}

const DUR = String.raw`\d+\.*(?:\*\d+(?:\/\d+)?)?`;
const TOKEN = new RegExp(String.raw`<<|>>|\\\\|\\[a-zA-Z]+|\\[<>!]|#[^\s]*|[{}<>~|()[\]]|[a-g][a-z]*[',]*[!?]*(?:${DUR})?|[rRs](?:${DUR})?|\d+\/\d+|${DUR}|[-_^][^\s]*|[=\w/.,':]+`, 'g');

// name = { ... } definitions (also name = \relative c' { ... }), expanded textually where \name is used
function defs(text) {
  const map = {}, re = /^[ \t]*([A-Za-z]\w*)[ \t]*=[ \t]*/gm;
  let m;
  while ((m = re.exec(text))) {
    if (text.slice(re.lastIndex).trimStart().startsWith('<<')) { const a = text.indexOf('<<', re.lastIndex); let d = 0, j = a; do { if (text.startsWith('<<', j)) { d++; j += 2; } else if (text.startsWith('>>', j)) { d--; j += 2; } else j++; } while (d > 0 && j < text.length); map[m[1]] = text.slice(a, j); continue; }
    const open = text.indexOf('{', re.lastIndex), nl = text.indexOf('\n', re.lastIndex);
    if (open < 0 || (nl >= 0 && nl < open && !/\\relative/.test(text.slice(re.lastIndex, open)))) continue;
    let d = 0, j = open;
    do { if (text[j] === '{') d++; else if (text[j] === '}') d--; j++; } while (d > 0 && j < text.length);
    map[m[1]] = text.slice(re.lastIndex, j);
  }
  return map;
}
function expandUse(text, use) {
  const map = defs(text);
  const body = (src) => { for (let i = 0; i < 12; i++) { const n = src.replace(/\\([A-Za-z]\w*)/g, (all, id) => (map[id] && !(id in BUILTIN) ? map[id] : all)); if (n === src) break; src = n; } return src; };
  return use.map((u) => body(map[u] || (() => { throw new Error('no definition ' + u); })()));
}
const BUILTIN = {};

export function parse(file, { use } = {}) {
  const stripped = strip(readFileSync(file, 'utf8'), !!use);
  const source = use ? use.map((u) => expandUse(stripped, [u])[0]) : null;
  const toks = (source ? source.flatMap((b) => ['{', ...(b.match(TOKEN) || []), '}']) : stripped.match(TOKEN)) || [];
  let p = 0, last = null, lastChord = [], dur = { n: 4, dots: 0 };
  const peek = () => toks[p], next = () => toks[p++];
  const durOf = (d) => (4 / d.n) * (2 - 2 ** -d.dots) * (d.mul || 1);   // mul: the *2/3 of a scaled duration, which LilyPond carries on to the next notes
  const octOf = (marks) => { let o = 0; for (const c of marks) o += c === "'" ? 1 : -1; return o; };

  function pitch(name, relative) {
    const m = /^([a-g])((?:is|es|s|f)*)([',]*)/.exec(name);
    let alt = 0; for (const a of m[2].match(/is|es|s|f/g) || []) alt += a === 'is' ? 1 : -1;
    const li = LETTER.indexOf(m[1]), oct = octOf(m[3]);
    let o = oct;
    if (relative && last) {
      let d = li - last.li; if (d > 3) d -= 7; else if (d < -3) d += 7;
      o = Math.floor((last.o * 7 + last.li + d) / 7) + oct;
    }
    return { li, o, midi: (o + 4) * 12 + STEP[m[1]] + alt };   // absolute c = C3 = midi 48
  }
  const parseDur = (tok) => {
    const m = /^(\d+)(\.*)(?:\*(\d+)(?:\/(\d+))?)?$/.exec(tok);
    dur = { n: Number(m[1]), dots: m[2].length, mul: m[3] ? Number(m[3]) / Number(m[4] || 1) : 1 };
    return durOf(dur);
  };
  const trailing = () => { let tie = false; while (['~', '(', ')', '[', ']'].includes(peek()) || (peek() && /^[-_^]/.test(peek())) || (peek() && /^\\[<>!]/.test(peek()))) { if (next().includes('~')) tie = true; } return tie; };

  function block(rel, tr) {
    const items = [];
    while (p < toks.length && peek() !== '}' && peek() !== '>>') { const n = element(rel, tr); if (n) items.push(n); }
    return { k: 'seq', items };
  }

  function element(rel, tr) {
    const t = next();
    if (t === undefined) return null;
    if (t === '{') { const b = block(rel, tr); next(); return b; }
    if (t === '<<') {
      const branches = []; const ref = last; let cur = [];
      last = ref;
      while (peek() !== '>>') {
        if (peek() === undefined) throw new Error('unterminated <<');
        if (peek() === '\\\\') { next(); branches.push({ k: 'seq', items: cur }); cur = []; last = ref; continue; }
        const n = element(rel, tr); if (n) cur.push(n);
      }
      next(); branches.push({ k: 'seq', items: cur });
      return { k: 'par', items: branches };
    }
    if (t === '<') {
      const ps = []; let first = null, prev = null;
      while (peek() !== '>') {
        const nt = next(); const m = /^([a-g][a-z]*[',]*)[!?]*$/.exec(nt);
        if (!m) continue;
        const saved = last; if (prev) last = prev;
        const pp = pitch(m[1], rel); prev = pp; first ||= pp; ps.push(pp.midi + tr);
        last = saved;
      }
      next();
      const len = peek() && /^\d/.test(peek()) ? parseDur(next()) : durOf(dur);
      if (first) last = first;
      lastChord = ps;
      if (peek() === '\\rest') { next(); return { k: 'rest', len }; }
      return { k: 'note', pitches: ps, len, tie: trailing() };
    }
    if (t.startsWith('\\')) return command(t, rel, tr);
    if (/^q(\d.*)?$/.test(t)) { const len = t.length > 1 ? parseDur(t.slice(1)) : durOf(dur); return { k: 'note', pitches: lastChord, len, tie: trailing() }; }
    let m = /^([rRs])(.*)$/.exec(t);
    if (m) return { k: 'rest', len: m[2] ? parseDur(m[2]) : durOf(dur) };
    m = /^([a-g][a-z]*[',]*)[!?]*(\d.*)?$/.exec(t);
    if (m) {
      const pp = pitch(m[1], rel); last = pp;
      const len = m[2] ? parseDur(m[2]) : durOf(dur);
      if (peek() === '\\rest') { next(); return { k: 'rest', len }; }
      return { k: 'note', pitches: [pp.midi + tr], len, tie: trailing() };
    }
    return null;
  }

  function command(t, rel, tr) {
    switch (t) {
      case '\\relative': { const m = /^([a-g])(?:is|es|s|f)*([',]*)/.exec(/^[a-g]/.test(peek()) ? next() : 'c'); last = { li: LETTER.indexOf(m[1]), o: octOf(m[2]), midi: 0 }; return element(true, tr); }
      case '\\transpose': { const sh = (x) => { const m = /^([a-g])([',]*)/.exec(x); return STEP[m[1]] + octOf(m[2]) * 12; }; const a = next(), b = next(); return element(rel, tr + sh(b) - sh(a)); }
      case '\\repeat': {
        next(); const n = Number(next()); const body = element(rel, tr); let alts = null;
        if (peek() === '\\alternative') { next(); next(); alts = []; while (peek() !== '}') alts.push(element(rel, tr)); next(); }
        return { k: 'repeat', n, body, alts };
      }
      case '\\key': next(); next(); return null;
      case '\\time': case '\\clef': case '\\change': case '\\barNumberCheck': case '\\bar': case '\\partial': next(); return null;
      case '\\tempo': while (peek() && /^[\d=]/.test(peek())) next(); return null;
      case '\\set': case '\\override': while (peek() && peek() !== '=') next(); next(); if (peek() && peek().startsWith('#')) next(); return null;
      case '\\tuplet': { const [a, b] = next().split('/').map(Number); return { k: 'scale', f: b / a, body: element(rel, tr) }; }
      case '\\times': { const [a, b] = next().split('/').map(Number); return { k: 'scale', f: a / b, body: element(rel, tr) }; }
      case '\\grace': case '\\acciaccatura': case '\\appoggiatura': case '\\slashedGrace': { const d = dur; element(rel, tr); dur = d; return { k: 'rest', len: 0 }; }
      default: return null;
    }
  }

  const items = [];
  while (p < toks.length) { if (peek() === '\\score') break; const n = element(false, 0); if (n) items.push(n); }
  return items;
}

export function flatten(node, t0 = 0, events = [], voice = 0) {
  switch (node.k) {
    case 'note': for (const m of node.pitches) events.push({ m, s: t0, l: node.len, tie: node.tie, v: voice }); return t0 + node.len;
    case 'rest': return t0 + node.len;
    case 'scale': { const e = []; const end = flatten(node.body, 0, e, voice); for (const x of e) events.push({ ...x, s: t0 + x.s * node.f, l: x.l * node.f }); return t0 + end * node.f; }
    case 'seq': { let t = t0; for (const it of node.items) t = flatten(it, t, events, voice); return t; }
    case 'par': { let end = t0; node.items.forEach((it, i) => { end = Math.max(end, flatten(it, t0, events, voice * 10 + i)); }); return end; }
    case 'repeat': {
      let t = t0;
      for (let i = 0; i < node.n; i++) { t = flatten(node.body, t, events, voice); if (node.alts) t = flatten(node.alts[Math.min(i, node.alts.length - 1)], t, events, voice); }
      return t;
    }
    default: return t0;
  }
}

export function mergeTies(ev) {
  ev.sort((a, b) => a.s - b.s || a.m - b.m);
  const out = [], open = new Map();
  for (const e of ev) {
    const key = e.m + ':' + e.v, o = open.get(key);
    if (o && Math.abs(o.s + o.l - e.s) < 1e-6) { o.l += e.l; if (!e.tie) open.delete(key); continue; }
    const n = { ...e }; out.push(n);
    if (e.tie) open.set(key, n); else open.delete(key);
  }
  return out;
}

if (process.argv[1] && process.argv[1].endsWith('ly-to-notes.mjs')) {
  const [file] = process.argv.slice(2);
  const velArg = process.argv.indexOf('--vel');
  const vels = velArg > 0 ? process.argv[velArg + 1].split(',').map(Number) : [];
  const useArg = process.argv.indexOf('--use');
  const blocks = parse(file, useArg > 0 ? { use: process.argv[useArg + 1].split(',') } : {});
  const all = []; let end = 0;
  blocks.forEach((b, i) => {
    const ev = []; const e = flatten(b, 0, ev, i); end = Math.max(end, e);
    for (const x of mergeTies(ev)) all.push({ ...x, vel: vels[i] ?? 56 });
  });
  all.sort((a, b) => a.s - b.s || a.m - b.m);
  const r = (x) => Math.round(x * 1000) / 1000;
  console.error(`blocks ${blocks.length}, notes ${all.length}, length ${end} quarters`);
  console.log(JSON.stringify({ end, notes: all.map((x) => [x.m, r(x.s), r(x.l), x.vel]) }));
}
