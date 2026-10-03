// Capture scene of the Blocks theme, about 3 s, for every attacker. No blood: the attacker's own move (hop, rear and lunge,
// pirouette, charge, stomp), then the victim bursts into cubes that tumble over the board and shrink away. The director picks
// this module instead of the per type scene when the pieces are block characters (info.style === 'blocks'). Staging, time,
// skip and cleanup come from the director and ctx.fx; the cubes are fx bodies, so a skip puts everything back.
import * as THREE from 'three';
import { createStage, lerp, bump } from './kit-a.js';
import { buildVox, V } from '../../themes/blocks/vox.js';

const outQuad = (k) => 1 - (1 - k) * (1 - k);
const inQuad = (k) => k * k;
const inOut = (k) => (k < 0.5 ? 2 * k * k : 1 - Math.pow(-2 * k + 2, 2) / 2);
const TAU = Math.PI * 2;
const MAX_CUBES = 260;

// how each attacker winds up: back is the distance it steps back to
const STYLE = { p: { back: 1.1 }, n: { back: 1.05 }, b: { back: 1.0 }, r: { back: 1.7 }, q: { back: 1.1 }, k: { back: 1.0 } };

// The victim's boxes as cubes of about two voxels, in the space of ctx.root, with the colour of the box.
function cubesOf(victim, root, seedRand) {
  const inner = victim.group.children[0], rig = inner.children[0];
  const vox = buildVox(victim.color, victim.type);
  root.updateWorldMatrix(true, false);
  victim.group.updateWorldMatrix(true, true);
  const inv = new THREE.Matrix4().copy(root.matrixWorld).invert();
  const out = [];
  let step = 2;
  const count = (s) => vox.parts.reduce((n, p) => n + Math.max(1, Math.round(p.w / s)) * Math.max(1, Math.round(p.h / s)) * Math.max(1, Math.round(p.d / s)), 0);
  while (count(step) > MAX_CUBES && step < 6) step += 0.5;
  const _p = new THREE.Vector3();
  for (const p of vox.parts) {
    const g = rig.getObjectByName(p.g);
    if (!g) continue;
    const rel = new THREE.Matrix4().multiplyMatrices(inv, g.matrixWorld);
    const quat = new THREE.Quaternion(), pos = new THREE.Vector3(), sc = new THREE.Vector3();
    rel.decompose(pos, quat, sc);
    const nx = Math.max(1, Math.round(p.w / step)), ny = Math.max(1, Math.round(p.h / step)), nz = Math.max(1, Math.round(p.d / step));
    const cw = p.w / nx, ch = p.h / ny, cd = p.d / nz;
    for (let i = 0; i < nx; i++) for (let j = 0; j < ny; j++) for (let k = 0; k < nz; k++) {
      // voxel point of the cube centre, then into the tag group's local frame (its origin is the pivot), then into the root
      const vx = p.x - p.w / 2 + (i + 0.5) * cw, vy = p.y + (j + 0.5) * ch, vz = p.z - p.d / 2 + (k + 0.5) * cd;
      _p.set(vx * V - g.position.x, vy * V - g.position.y, vz * V - g.position.z).applyMatrix4(rel);
      out.push({ pos: _p.clone(), quat: quat.clone(), size: [cw * V * 0.96, ch * V * 0.96, cd * V * 0.96], color: p.color, r: seedRand() });
    }
  }
  return out;
}

async function crumble(ctx) {
  const s = createStage(ctx), sfx = ctx.sfx, { fx, a, v, aim, C, hV, run0 } = s;
  const type = ctx.attacker, st = STYLE[type] || STYLE.p;
  const heavy = type === 'q' || type === 'k' || type === 'r';

  // the plank frame stays out of the picture while the low camera is on the fight: no plank wall on the horizon
  const frame = ctx.gimbal?.getObjectByName?.('blocks-world')?.userData.frame;
  if (frame) {
    ctx.signal.addEventListener('abort', () => frame(1), { once: true });
    ctx.tween({ dur: 0.3, step: (e) => frame(1 - e) });
  }

  // step back (the knights rear, the rook backs off further)
  await s.tw(0.35, (k) => { a.d = lerp(-run0, -st.back, k); a.y = 0.2 * bump(k); a.yaw = s.yawG * k; }, inOut);
  if (!s.live()) return;
  // the wind up
  if (type === 'n') await s.tw(0.4, (k) => { a.tip = -0.55 * k; a.sy = 1 + 0.05 * k; a.y = 0.12 * k; }, inOut);
  else if (type === 'p') await s.tw(0.4, (k) => { a.y = 0.14 * Math.abs(Math.sin(k * TAU)); a.d = -st.back + 0.12 * k; }, (k) => k);
  else if (type === 'b' || type === 'q') await s.tw(0.5, (k) => { a.spin = TAU * k; a.y = 0.18 * bump(k); }, inOut);
  else if (type === 'k') await s.tw(0.45, (k) => { a.y = 0.5 * outQuad(k); a.sy = 1 + 0.12 * k; a.sx = a.sz = 1 - 0.05 * k; }, inOut);
  else await s.tw(0.3, (k) => { a.d = lerp(-st.back, -st.back - 0.18, k); a.sy = 1 - 0.1 * k; }, inOut);   // rook crouches
  if (!s.live()) return;
  // the strike
  sfx.whoosh?.();
  await s.tw(type === 'r' ? 0.14 : 0.18, (k) => {
    a.d = lerp(type === 'r' ? -st.back - 0.18 : -st.back + (type === 'p' ? 0.12 : 0), -0.74, k);
    if (type === 'n') { a.tip = lerp(-0.55, 0.3, k); a.y = 0.12 * (1 - k); }
    if (type === 'k') { a.y = 0.5 * (1 - inQuad(k)); a.sy = 1.12 - 0.2 * k; }
    if (type === 'r') a.sy = 0.9 + 0.1 * k;
    if (type === 'p') a.y = 0.1 * bump(k);
  }, inQuad);
  if (!s.live()) return;

  // the burst
  const rnd = (() => { let x = 12345; return () => { x = (x * 16807) % 2147483647; return x / 2147483647; }; })();
  const cubes = cubesOf(s.V, ctx.root, rnd);
  const geo = fx.own(new THREE.BoxGeometry(1, 1, 1));
  const mats = new Map();
  const material = (c) => { if (!mats.has(c)) mats.set(c, fx.own(new THREE.MeshStandardMaterial({ color: c, roughness: 0.92, metalness: 0 }))); return mats.get(c); };
  const origin = new THREE.Vector3(C.x, hV * 0.4, C.z);
  const force = 1 + (heavy ? 0.25 : 0);
  const half = [];
  for (const c of [-1, 1]) for (const d of [-1, 1]) for (const e of [-1, 1]) half.push(c * 0.5, d * 0.5, e * 0.5);
  const pts = new Float32Array(half);
  for (const c of cubes) {
    const m = new THREE.Mesh(geo, material(c.color));
    m.position.copy(c.pos); m.quaternion.copy(c.quat); m.scale.set(...c.size);
    m.castShadow = true; m.receiveShadow = true;
    fx.add(m);
    const out = new THREE.Vector3(c.pos.x - origin.x, 0, c.pos.z - origin.z);
    const vel = out.multiplyScalar(2.2 * force).addScaledVector(aim, (1.1 + c.r * 1.6) * force);
    vel.x += (rnd() - 0.5) * 1.4; vel.z += (rnd() - 0.5) * 1.4;
    vel.y = (1.8 + (c.pos.y / Math.max(0.3, hV)) * 1.2 + c.r * 2.6) * force;
    fx.body(m, { pts, vel, ang: new THREE.Vector3(rnd() - 0.5, rnd() - 0.5, rnd() - 0.5).multiplyScalar(14), bounce: 0.34, gravity: -15, life: 1.5 + c.r * 0.6, fade: 0.45 });
  }
  v.on = false;
  s.V.group.visible = false;       // the director keeps it hidden; the game flies it to the tray afterwards
  sfx.shatter?.();
  fx.flash(origin, { color: '#fff1d0', size: 0.5, dur: 0.25, ring: false });
  fx.dust(new THREE.Vector3(C.x, 0.05, C.z), { count: 10 });
  if (type === 'k' || type === 'r') fx.dust(new THREE.Vector3(C.x - aim.x * 0.5, 0.05, C.z - aim.z * 0.5), { count: 8 });

  // the attacker recoils and watches the cubes fall
  const tip0 = a.tip, sy0 = a.sy, sx0 = a.sx, y0 = a.y;
  await Promise.all([
    s.tw(0.3, (k) => { a.d = lerp(-0.74, -0.92, k); a.tip = tip0 * (1 - k); a.y = y0 * (1 - k); a.sy = lerp(sy0, 1, k); a.sx = a.sz = lerp(sx0, 1, k); }, outQuad),
    s.tw(0.9, () => {}),
  ]);
  sfx.thud?.();
  await s.tw(0.8, () => {});
  await s.tw(0.4, (k) => { a.d = lerp(-0.92, -run0, k); a.yaw = s.yawG * (1 - k); a.spin = 0; }, inOut);
  frame?.(1);
}

export default {
  attacker: '*',
  cam: { pitch: 14 },
  run(ctx) { return crumble(ctx); },
};
