// Knight captures, about 3 s. The knight rears and hews the victim in two with a sword, blood on the cut, the top
// half slides off. Staging, time, skip and cleanup come from the director and ctx.fx.
import * as THREE from 'three';
import { createStage, weight, lerp, bump } from './kit-a.js';

const outQuad = (k) => 1 - (1 - k) * (1 - k);
const inQuad = (k) => k * k;
const inOut = (k) => (k < 0.5 ? 2 * k * k : 1 - Math.pow(-2 * k + 2, 2) / 2);

async function gore(ctx) {
  const s = createStage(ctx), sfx = ctx.sfx, { fx, a, v, aim, C, hV } = s;
  const w = weight(s.V.type);
  const hand = s.mount(0.62), piv = new THREE.Group();
  const sword = fx.prop('sword', { length: 0.85 });
  piv.rotation.x = 0.3; piv.scale.setScalar(0.001);
  piv.add(sword); hand.add(piv);
  const yCut = w === 0 ? 0.68 : 0.56;

  await Promise.all([
    s.tw(0.35, (k) => { a.d = lerp(-s.run0, -1.05, k); a.y = 0.3 * bump(k); a.yaw = s.yawG * k; }, inOut),
    s.tw(0.35, (k) => piv.scale.setScalar(Math.max(0.001, k)), outQuad),
  ]);
  // rear back, sword high
  sfx.whoosh?.();
  await s.tw(0.45, (k) => { piv.rotation.x = lerp(0.3, 0.7, k); a.tip = -0.5 * k; a.sy = 1 + 0.05 * k; }, inOut);
  // the cut
  await s.tw(0.2, (k) => { piv.rotation.x = lerp(0.7, -1.9, k); a.tip = lerp(-0.5, 0.3, k); a.d = -1.05 + 0.28 * k; }, inQuad);
  if (!s.live()) return;
  sfx.slice?.();
  v.on = false;
  const cut = fx.slice(s.V.group, { at: yCut, tilt: 22, azimuth: Math.atan2(-aim.z, -aim.x), cap: '#8f1017', push: 1.0 + 0.2 * hV, pop: 1.2, spin: 2.2, life: 1.6 });
  const point = cut.point;
  fx.splatter(point, { count: 22 + 8 * w, spread: 1.6, speed: [1, 4] });
  fx.splatter(point, { dir: aim, count: 10, spread: 0.5, speed: [2, 4] });
  fx.flash(point, { color: '#fff1d0', size: 0.4, dur: 0.25, ring: false });
  sfx.clang?.();
  // follow through and watch the halves fall
  await Promise.all([
    s.tw(0.35, (k) => { a.tip = lerp(0.3, 0.1, k); a.d = lerp(-0.77, -0.8, k); }, outQuad),
    s.tw(0.5, () => {}),
  ]);
  for (let i = 0; i < 2 && s.live(); i++) { fx.splatter(point, { count: 6, spread: 0.6, speed: [0.5, 1.5], dir: new THREE.Vector3(0, 1, 0), size: [0.015, 0.04] }); await s.tw(0.2, () => {}); }
  sfx.thud?.();
  await s.tw(0.3, () => {});
  await Promise.all([
    s.tw(0.4, (k) => { a.d = lerp(-0.8, -s.run0, k); a.tip = lerp(0.1, 0, k); a.sy = 1; a.yaw = s.yawG * (1 - k); piv.scale.setScalar(Math.max(0.001, 1 - k)); }, inOut),
    s.tw(0.4, () => {}),
  ]);
}

export default {
  attacker: 'n',
  cam: { dist: 6.6, pitch: 13 },
  run(ctx) { return gore(ctx); },
};
