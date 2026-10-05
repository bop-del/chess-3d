// Signature moves (CHE-238): the small show a piece puts on when nobody moves. A move is a pure function of its own time u (0 to 1)
// and the rig parts, played on top of the idle animation by rig.js (animate). Six piece types, one move each (the owner's picks of
// review round r27, CHE-238); the idea of every move is in `de`. Parts a figure does not have are skipped, so the same move works on the
// armless critters of Blocks and on the heroes: the move then falls back to the head or the whole body.
//
// Directions (the rig is turned to face -z): head rotation.x negative bows, positive looks up; an arm rotation.x positive swings it
// forward and up, rotation.z swings it sideways (outward is the sign of the arm's x); a leg rotation.x positive steps forward; the
// whole rig rotation.x positive rears back (front up), negative bows.
const clamp01 = (x) => Math.min(1, Math.max(0, x));
const sm = (x) => x * x * (3 - 2 * x);
/** Smooth 0 to 1 between a and b. */
const rp = (u, a, b) => sm(clamp01((u - a) / (b - a)));
/** Up between a and b, down between c and d. */
const hold = (u, a, b, c, d) => rp(u, a, b) - rp(u, c, d);
/** One smooth bump from a to b. */
const bump = (u, a, b) => Math.sin(Math.PI * clamp01((u - a) / (b - a)));
const osc = (u, f, ph = 0) => Math.sin(u * Math.PI * 2 * f + ph);
const step = (v, n) => Math.round(v * n) / n;   // stepped values read as pixel animation frames

// k: { P (parts), rig, U (unit), H (figure height), has(name), rot(name, x, y, z), lift(name, dy in units), sides(), spin(v),
//      stretch(y, xz), spark(count, cx, cy, cz, radius, u, mode) }
const side = (k, name) => Math.sign(k.P[name]?.p.x) || (name.endsWith('P') ? -1 : 1);
const arms = (k, fn) => { for (const n of ['armN', 'armP']) if (k.has(n)) fn(n, side(k, n)); };

export const MOVES = {
  p: { de: 'Der Bauer schaut sich nach links und rechts um und zittert kurz.', dur: 2.4, run(k, u) {
    const e = hold(u, 0.05, 0.2, 0.7, 0.85);
    k.rot('head', 0, 1.0 * osc(u, 1.5) * e, 0);
    k.rig.rotation.z = 0.05 * osc(u, 9) * bump(u, 0.7, 0.98);
    k.rig.rotation.x = -0.06 * e;
  } },
  r: { de: 'Der Turm stampft dreimal auf, der Boden bebt.', dur: 2.0, run(k, u) {
    const env = hold(u, 0.02, 0.06, 0.9, 1), s = Math.max(0, Math.sin(u * Math.PI * 3));
    k.rig.position.y += 0.22 * s * env;
    k.stretch(-0.11 * (1 - s) * env, 0.05 * (1 - s) * env);
    k.rig.rotation.z = 0.05 * osc(u, 14) * env * (1 - s);
    k.rig.position.x = 0.012 * osc(u, 20) * env;
  } },
  n: { de: 'Das Pferd baeumt sich auf, wiehert und setzt wieder ab.', dur: 2.4, run(k, u) {
    const e = hold(u, 0.1, 0.38, 0.62, 0.9), neigh = bump(u, 0.4, 0.62);
    k.rig.rotation.x = 0.7 * e;
    k.rig.position.y += 0.1 * e;
    k.rot('lgNF', 1.1 * e + 0.25 * osc(u, 3) * e, 0, 0); k.rot('lgPF', 0.8 * e - 0.25 * osc(u, 3) * e, 0, 0);
    k.rot('lgNB', -0.15 * e, 0, 0); k.rot('lgPB', -0.15 * e, 0, 0);
    k.rot('head', 0.35 * neigh - 0.15 * e, 0.12 * osc(u, 6) * neigh, 0);
    k.rot('tail', 0.5 * e, 0, 0.25 * osc(u, 3) * e);
  } },
  b: { de: 'Der Laeufer breitet die Arme aus, verneigt sich und segnet das Feld.', dur: 3.0, run(k, u) {
    const e = hold(u, 0.1, 0.3, 0.7, 0.9);
    arms(k, (n, s) => k.rot(n, 0.4 * e, 0, s * 1.35 * e));
    k.rot('head', -0.3 * e, 0, 0);
    k.rig.position.y += 0.1 * e * (0.6 + 0.4 * osc(u, 2));
    k.spark(8, 0, k.H * 0.8, 0, 0.55, hold(u, 0.3, 0.38, 0.72, 0.8) > 0.01 ? (u - 0.3) / 0.45 : -1, 'fall');
  } },
  q: { de: 'Die Dame winkt huldvoll mit einer Hand und neigt den Kopf.', dur: 2.6, run(k, u) {
    const e = hold(u, 0.08, 0.25, 0.8, 0.95), w = k.has('armP') ? 'armP' : 'armN';
    if (k.has(w)) k.rot(w, 0.3 * e, 0, side(k, w) * (1.95 + 0.3 * osc(u, 3.5)) * e);
    else k.rig.rotation.z = 0.12 * osc(u, 3) * e;
    k.rot('head', -0.1 * e, 0, 0.14 * e);
    k.rig.rotation.z += 0.03 * osc(u, 1.5) * e;
  } },
  k: { de: 'Der Koenig streckt den Arm aus und verkuendet streng ein Dekret, dazu nickt er.', dur: 2.8, run(k, u) {
    const e = hold(u, 0.08, 0.25, 0.75, 0.92), nod = Math.max(0, Math.sin(u * Math.PI * 4)) * e;
    const w = k.has('armP') ? 'armP' : 'armN';
    if (k.has(w)) k.rot(w, 1.6 * e + 0.1 * osc(u, 5) * e, 0, 0);
    k.rot('head', -0.25 * nod, 0, 0);
    k.rig.rotation.x = 0.06 * e;
    k.stretch(0.03 * e, 0);
    const stamp = bump(u, 0.8, 0.9);
    k.lift('legN', 0.08 * stamp); k.rot('legN', 0.3 * stamp, 0, 0);
  } },
};

export const TYPE_NAMES = { p: 'pawn', r: 'rook', n: 'knight', b: 'bishop', q: 'queen', k: 'king' };
export const moveOf = (type) => MOVES[type] || null;
