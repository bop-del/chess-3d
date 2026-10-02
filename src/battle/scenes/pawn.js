// Pawn captures, about 3 s. A lance, jabbed once, twice or three times by the victim's weight, blood on every hit,
// then the victim topples. Staging, time, skip and cleanup come from the director and ctx.fx.
import * as THREE from 'three';
import { createStage, weight, lerp, bump } from './kit-a.js';

const inQuad = (k) => k * k;
const outQuad = (k) => 1 - (1 - k) * (1 - k);
const inOut = (k) => (k < 0.5 ? 2 * k * k : 1 - Math.pow(-2 * k + 2, 2) / 2);

async function gore(ctx) {
  const s = createStage(ctx), sfx = ctx.sfx, { fx, a, v, aim, C, hV } = s;
  const w = weight(s.V.type), jabs = [1, 2, 3][w];
  const hand = s.mount(0.5), piv = new THREE.Group();
  const lance = fx.prop('lance', { length: 1.5 });
  lance.position.y = -0.5;
  piv.rotation.x = -Math.PI / 2 + 0.1; piv.scale.setScalar(0.001);
  piv.add(lance); hand.add(piv);
  const hit = new THREE.Vector3(C.x - aim.x * 0.28, hV * 0.45, C.z - aim.z * 0.28);

  // step back, the lance comes out, a crouch
  await Promise.all([
    s.tw(0.35, (k) => { a.d = lerp(-s.run0, -1.05, k); a.y = 0.3 * bump(k); a.yaw = s.yawG * k; }, inOut),
    s.tw(0.35, (k) => piv.scale.setScalar(Math.max(0.001, k)), outQuad),
  ]);
  await s.tw(0.3, (k) => { a.sy = 1 - 0.14 * k; a.sx = a.sz = 1 + 0.07 * k; piv.position.z = 0.1 * k; }, inOut);
  let lean = 0;
  for (let i = 0; i < jabs && s.live(); i++) {
    sfx.whoosh?.();
    await s.tw(0.12, (k) => { a.d = -1.05 + 0.22 * k; piv.position.z = 0.1 - 0.4 * k; a.sy = 0.86 + 0.28 * k; }, outQuad);
    sfx.splat?.();
    fx.splatter(hit, { dir: aim, spread: 0.9, count: 12 + 5 * w });
    // the victim staggers and shudders while the lance comes back
    const l0 = lean, off0 = v.off;
    lean += 0.05 + 0.02 * i;
    const hurt = s.tw(0.3, (k, t) => { v.off = off0 + 0.07 * outQuad(Math.min(1, t * 3)); v.tip = lerp(l0, lean, outQuad(Math.min(1, t * 3))); v.lat = Math.sin(t * 30) * 0.03 * (1 - k) * (1.2 - 0.25 * w); });
    await s.tw(0.22, (k) => { a.d = -0.83 - 0.22 * k; piv.position.z = -0.3 + 0.4 * k; a.sy = 1.14 - 0.14 * k; }, inOut);
    if (i < jabs - 1) await hurt;
  }
  if (!s.live()) return;
  // down it goes while the pawn lowers its lance and steps back to where it stood
  const dur = 0.5 + 0.3 * hV, off1 = v.off, lean1 = lean;
  await Promise.all([
    s.tw(dur, (k) => { v.tip = lerp(lean1, Math.PI / 2, inQuad(k)); v.off = off1 + 0.25 * k; v.lat = 0; }),
    s.tw(0.4, (k) => { a.d = lerp(-1.05, -s.run0, k); a.y = 0.1 * bump(k); a.sy = 1; a.sx = a.sz = 1; a.yaw = s.yawG * (1 - k); piv.scale.setScalar(Math.max(0.001, 1 - k)); }, inOut),
  ]);
  sfx.thud?.();
  fx.dust(new THREE.Vector3(C.x + aim.x * (off1 + 0.45), 0.05, C.z + aim.z * (off1 + 0.45)), { count: 8 });
  await s.tw(0.4, (k, t) => { v.tip = Math.PI / 2 - 0.09 * Math.exp(-7 * t) * Math.abs(Math.sin(15 * t)); });
}

export default {
  attacker: 'p',
  cam: { dist: 5.6, pitch: 13 },
  run(ctx) { return gore(ctx); },
};
