// Living pieces, fast tier, no browser (CHE-238): the signature moves and the Pixelwelt birds.
//   moves   every piece type has its one picked move with a duration of 1.5 to 3.3 s and a German description; each move of each
//           figure of Pixelwelt (both colours) plays through a stepped clock with finite transforms, and when
//           it is over every part, the rig lean, the spin and the position are back at the base pose; a walk cancels a move at once
//   birds   each variant stays high (at least 4) and far (at least 9 from the board centre), ends, leaves nothing behind and uses only
//           the flat unlit material with a pixel texture (the Pixelwelt rules)
// Run: node test/living.mjs    Exit 0 pass, 1 on any failed check.
import * as THREE from 'three';

globalThis.document = { createElement: () => ({ width: 0, height: 0, getContext: () => ({ fillRect() {}, clearRect() {}, drawImage() {}, getImageData: () => ({ data: new Uint8ClampedArray(4) }), putImageData() {} }) }) };
const { MOVES, TYPE_NAMES } = await import('../src/themes/blocks/moves.js');
const { createPieceStyle, playSignature, signatureBusy } = await import('../src/themes/blocks/rig.js');
const { buildPixelVox } = await import('../src/themes/pixel/figures.js');
const { createPixelWorld } = await import('../src/themes/pixel/world.js');
const { withBirds, BIRD_VARIANTS } = await import('../src/themes/pixel/birds.js');
const { living } = await import('../src/living-state.js');

let failed = 0;
const check = (name, ok, detail = '') => { console.log(`${ok ? 'PASS' : 'FAIL'}  ${name}${detail ? '  ' + detail : ''}`); if (!ok) failed++; };

// ---- the table
{
  const bad = [];
  for (const t of Object.keys(TYPE_NAMES)) {
    const m = MOVES[t];
    if (!m || Array.isArray(m) || !(m.dur >= 1.5 && m.dur <= 3.3) || !m.de || m.de.length < 20 || typeof m.run !== 'function') bad.push(t);
  }
  check('six piece types, one move each, 1.5 to 3.3 s, a German description', bad.length === 0 && Object.keys(MOVES).length === 6, bad.join('; '));
}

// ---- the moves on real rigs
const themes = [['pixel', { id: 'pixel', build: buildPixelVox, mesher: { shade: true } }]];
for (const [theme, opts] of themes) {
  const style = createPieceStyle({}, { ...opts, makeMaterial: () => new THREE.MeshBasicMaterial({ vertexColors: true }) });
  const root = new THREE.Group();
  const bad = [], stuck = [];
  let played = 0;
  for (const color of ['w', 'b']) for (const type of Object.keys(TYPE_NAMES)) {
    const wrap = new THREE.Group(), inner = style.make(type, color);
    wrap.add(inner); root.add(wrap);
    const dur = playSignature(inner);
    if (!dur) { bad.push(`${theme} ${color}${type} did not start`); continue; }
    if (playSignature(inner)) bad.push(`${theme} ${color}${type} started twice`);
    played++;
    const rig = inner.children[0], parts = rig.children.filter((c) => c.name !== 'fx');
    const base = parts.map((o) => o.position.clone());
    let t = 0, peak = 0;
    const moved = () => parts.reduce((a, o, i) => a + o.position.distanceTo(base[i]) * 6 + Math.abs(o.scale.y - 1) * 4, 0);
    while (t < dur + 0.3) {
      style.update(1 / 30, root); t += 1 / 30;
      for (const o of [rig, ...parts]) {
        const v = [o.position.x, o.position.y, o.position.z, o.rotation.x, o.rotation.y, o.rotation.z, o.scale.x, o.scale.y, o.scale.z];
        if (v.some((n) => !Number.isFinite(n))) { bad.push(`${theme} ${color}${type} not finite at ${t.toFixed(2)}`); t = 99; break; }
      }
      peak = Math.max(peak, moved(), ...parts.map((o) => Math.abs(o.rotation.x) + Math.abs(o.rotation.z)), Math.abs(rig.rotation.x) + Math.abs(rig.rotation.z) + Math.abs(rig.position.y) * 4 + Math.abs(rig.rotation.y - Math.PI));
    }
    if (peak < 0.05) bad.push(`${theme} ${color}${type} does nothing (peak ${peak.toFixed(3)})`);
    style.update(1 / 30, root); style.update(1 / 30, root);
    if (signatureBusy(inner)) bad.push(`${theme} ${color}${type} never ends`);
    // only what the idle animation never touches: sideways offsets, turns around y and z (the head looks around when idle), part scales
    const off = parts.some((o, i) => Math.abs(o.position.x - base[i].x) > 0.001 || Math.abs(o.position.z - base[i].z) > 0.001 || (o.name !== 'head' && o.name !== 'rider' && Math.abs(o.rotation.y) > 0.001) || (o.name !== 'head' && o.name !== 'tail' && Math.abs(o.rotation.z) > 0.001) || Math.abs(o.scale.x - 1) > 0.001 || Math.abs(o.scale.y - 1) > 0.001);
    if (off || Math.abs(rig.rotation.y - Math.PI) > 0.01 || Math.abs(rig.position.x) > 0.001 || Math.abs(rig.position.z) > 0.001 || rig.children.some((c) => c.name === 'fx')) stuck.push(`${color}${type}`);
    root.remove(wrap);
  }
  check(`${theme}: ${played} moves play through, stay finite and visibly move`, bad.length === 0 && played === 12, bad.slice(0, 4).join('; '));
  check(`${theme}: after every move all parts, the spin and the sparkles are back at rest`, stuck.length === 0, stuck.slice(0, 6).join(', '));
  // a piece that gets a move walks away at once, the show is cancelled
  const wrap = new THREE.Group(), inner = style.make('q', 'w');
  wrap.add(inner); root.add(wrap);
  playSignature(inner);
  for (let i = 0; i < 20; i++) style.update(1 / 30, root);
  for (let i = 0; i < 20; i++) { wrap.position.x += 0.08; style.update(1 / 30, root); }
  check(`${theme}: a walk cancels a running move`, !signatureBusy(inner));
  style.dispose();
}

// ---- the birds
{
  const world = withBirds(createPixelWorld({}));
  living.on = true; living.auto = false;
  const lowest = [], near = [], badMat = [];
  for (const v of BIRD_VARIANTS) {
    const dur = world.birds.play(v);
    check(`bird ${v}: starts, lasts ${dur} s`, dur > 4 && world.birds.active);
    let t = 0, guard = 0;
    while (world.birds.active && guard++ < 3000) {
      world.update(1 / 30); t += 1 / 30;
      world.group.updateMatrixWorld(true);
      world.birds.group.traverse((o) => {
        if (o.isMesh) {
          if (!(o.material.isMeshBasicMaterial && o.material.map && o.material.vertexColors)) badMat.push(`${v}/${o.parent?.name}`);
        }
        if (o.name === 'bird' && o.visible) {
          const p = new THREE.Vector3(); o.getWorldPosition(p);
          if (p.y < 4) lowest.push(`${v} y ${p.y.toFixed(1)} at ${t.toFixed(1)}`);
          if (Math.hypot(p.x, p.z) < 9) near.push(`${v} r ${Math.hypot(p.x, p.z).toFixed(1)} at ${t.toFixed(1)}`);
        }
      });
    }
    check(`bird ${v}: the flight ends and removes its birds`, !world.birds.active && world.birds.group.children.length === 0 && !world.birds.group.visible, `${t.toFixed(1)} s`);
  }
  check('birds stay above y 4', lowest.length === 0, lowest.slice(0, 2).join('; '));
  check('birds stay at least 9 from the board centre', near.length === 0, near.slice(0, 2).join('; '));
  check('birds use the flat unlit material with a pixel texture', badMat.length === 0, badMat.slice(0, 2).join('; '));
  // automatic flights: only with the setting on, armed, not paused
  const count = (secs) => { let n = 0; for (let i = 0; i < secs * 30; i++) { world.update(1 / 30); } return n; };
  const fires = (setup, secs) => { Object.assign(living, { on: true, auto: false, paused: false }, setup); world.birds.stop(); let seen = false; for (let i = 0; i < secs * 30; i++) { world.update(1 / 30); if (world.birds.active) { seen = true; break; } } return seen; };
  const firstFlight = (setup, secs) => { Object.assign(living, { on: true, auto: false, paused: false }, setup); world.birds.stop(); for (let i = 0; i < secs * 30; i++) { world.update(1 / 30); if (world.birds.active) return i / 30; } return -1; };
  const t1 = firstFlight({ auto: true }, 260);
  check('birds fly on their own, the first one 2 to 4 minutes in', t1 >= 119 && t1 <= 241, `${t1.toFixed(0)} s`);
  // order and gap over a long stepped stretch: every round of three shows each variant once, the gaps are 2 to 4 minutes, one at a time
  { Object.assign(living, { on: true, auto: true, paused: false }); world.birds.stop();
    let seed = 7; living.rand = () => { seed = (seed * 1664525 + 1013904223) % 4294967296; return seed / 4294967296; };   // a fixed random source: the check is the same every run
    const seen = [], starts = []; let prev = false;
    for (let i = 0; i < 30 * 60 * 40; i++) { world.update(1 / 30); const a = world.birds.active; if (a && !prev) { starts.push(i / 30); seen.push(world.birds.variant); } prev = a; }
    const gaps = starts.slice(1).map((t, i) => t - starts[i]);
    check('birds: a flight every 2 to 4 minutes (flight time included), never two at once', starts.length >= 10 && gaps.every((g) => g >= 119 && g <= 256), `${starts.length} flights, gaps ${Math.min(...gaps).toFixed(0)} to ${Math.max(...gaps).toFixed(0)} s`);
    // the bag left over from the first flight above makes the first round shorter: find the offset where the rounds of three start
    const rounds = (o) => { const r = []; for (let i = o; i + 3 <= seen.length; i += 3) r.push(seen.slice(i, i + 3).join('')); return r; };
    const ok = [0, 1, 2].some((o) => rounds(o).length >= 3 && rounds(o).every((r) => new Set(r).size === 3) && new Set(rounds(o)).size > 1);
    check('birds: the flights come in rounds of all three variants in random order', ok && seen.every((v, i) => !i || v !== seen[i - 1]), seen.join(''));
  }
  check('no automatic birds when not armed, switched off or paused', firstFlight({ auto: false }, 300) < 0 && firstFlight({ auto: true, on: false }, 300) < 0 && firstFlight({ auto: true, paused: true }, 300) < 0);
  world.dispose();
  Object.assign(living, { on: true, auto: false, paused: false, rand: Math.random });
}

console.log(failed ? `\n${failed} CHECK(S) FAILED` : '\nLIVING PASSED');
process.exit(failed ? 1 : 0);
