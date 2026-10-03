// Turns a piece (note rows in quarter notes) into key presses, with the sustain pedal worked out.
//
//   piece = { id, title, composer, bpm, pedal, ring, quarters, notes: [[midi, startQuarter, lengthQuarter, velocity], ...] }
//   prepare(piece) -> events sorted by start: { m, q, hq, add, roll, vel }
//       the key is struck at quarter q (plus `roll` seconds), the damper falls hq quarters plus `add` seconds later
//   expand(piece, scale = 1) -> { events: [{ m, t, hold, vel }], seconds }   the same in seconds, tempo scale applied (previews, tests)
//
// pedal: the pedal changes every `pedal` quarters (0 = none): a key that ends inside a pedalled stretch keeps sounding until the
// next change, lifted a hair early so the new harmony starts clean. ring: seconds a key is held past its written end when no
// pedal is set (a fingered legato). Chords (two or more keys on one beat) are rolled by a few milliseconds, low to high, and the
// velocity gets a fixed pseudo random wobble, so it never sounds like a machine.
export function prepare(piece, { spread = 0.009 } = {}) {
  const P = piece.pedal || 0, ring = piece.ring ?? 0.15;
  const rows = [...piece.notes].sort((a, b) => a[1] - b[1] || a[0] - b[0]);
  const events = [];
  let seed = 31, last = -1, k = 0;
  const rnd = () => { seed = (seed * 1103515245 + 12345) & 0x7fffffff; return seed / 0x7fffffff; };
  for (const [m, s, l, v] of rows) {
    if (Math.abs(s - last) > 1e-3) { last = s; k = 0; } else k++;
    const endQ = s + l;
    const vel = Math.max(8, Math.min(120, v * (0.94 + rnd() * 0.12)));
    if (P) events.push({ m, q: s, hq: Math.max(endQ, Math.ceil(endQ / P - 1e-6) * P) - s, add: -0.06, roll: Math.min(k, 5) * spread, vel });
    else events.push({ m, q: s, hq: l, add: ring, roll: Math.min(k, 5) * spread, vel });
  }
  return events;
}

export function expand(piece, scale = 1) {
  const spq = 60 / (piece.bpm * scale);
  const events = prepare(piece).map((e) => ({ m: e.m, t: e.q * spq + e.roll, hold: Math.max(0.12, e.hq * spq + e.add), vel: e.vel }));
  return { events, seconds: Math.max(...events.map((e) => e.t + e.hold)) + 0.5 };
}
