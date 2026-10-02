// Bishop captures, about 3 s. The crozier lights up and a bolt cracks the victim, which bursts into shards of its
// own marble or ebony. Staging, time, skip and cleanup come from the director and ctx.fx.
import * as THREE from 'three';
import { createStage, beam, weight, lerp, bump } from './kit-a.js';

const outQuad = (k) => 1 - (1 - k) * (1 - k);
const inOut = (k) => (k < 0.5 ? 2 * k * k : 1 - Math.pow(-2 * k + 2, 2) / 2);

function staff(s, glow) {
  const hand = s.mount(0), piv = new THREE.Group();
  const stick = s.fx.prop('staff', { length: 1.45, glow });
  piv.position.set(0.34, 0, -0.08); piv.scale.setScalar(0.001);
  piv.add(stick); hand.add(piv);
  return { piv, orb: () => s.where(stick.userData.orb) };
}

async function gore(ctx) {
  const s = createStage(ctx), sfx = ctx.sfx, { fx, a, v, C, hV } = s;
  const w = weight(s.V.type);
  const { piv, orb } = staff(s, '#fff0b0');
  const heart = s.centre(0.5);

  await Promise.all([
    s.tw(0.35, (k) => { a.d = lerp(-s.run0, -1.05, k); a.y = 0.3 * bump(k); a.yaw = s.yawG * k; }, inOut),
    s.tw(0.35, (k) => piv.scale.setScalar(Math.max(0.001, k)), outQuad),
  ]);
  // the staff rises, the bishop lifts a little, the orb sparks
  sfx.magic?.();
  const raise = s.tw(0.6, (k) => { piv.rotation.x = -0.12 * k; piv.position.y = 0.08 * k; a.y = 0.14 * k; }, inOut);
  fx.sparks(orb(), { count: 12, spread: 2.6, speed: [0.3, 1.2], gravity: 0.5, life: [0.5, 0.9] });
  await raise;
  // the victim starts to shake as the staff swings round onto it
  sfx.crack?.();
  await Promise.all([
    s.tw(0.45, (k) => { piv.rotation.x = lerp(-0.12, -1.12, inOut(k)); a.d = -1.05 + 0.1 * k; }),
    s.tw(0.45, (k) => { v.lat = Math.sin(k * 55) * 0.03 * k * k; v.tip = Math.sin(k * 41) * 0.03 * k; }),
  ]);
  if (!s.live()) return;
  // the bolt
  const from = orb();
  await beam(fx, from, heart, { dur: 0.22 });
  if (!s.live()) return;
  sfx.shatter?.();
  v.on = false; v.lat = 0; v.tip = 0;
  fx.shatter(s.V.group, { count: [12, 18, 26][w], power: 2.4 + 0.5 * hV, up: 3, size: 0.07 + 0.03 * hV, origin: heart, life: 1.5 });
  fx.flash(heart, { color: '#fff6e0', size: 0.5 + 0.12 * hV, dur: 0.3 });
  fx.dust(heart, { count: 10, size: [0.05, 0.1] });
  fx.splatter(heart, { count: 10 + 4 * w, size: [0.012, 0.03], spread: 2 });
  await Promise.all([
    s.tw(0.5, (k) => { piv.rotation.x = lerp(-1.12, -0.12, inOut(k)); a.d = lerp(-0.95, -1.05, k); }),
    s.tw(0.9, () => {}),
  ]);
  await Promise.all([
    s.tw(0.4, (k) => { a.d = lerp(-1.05, -s.run0, k); a.y = lerp(0.14, 0, k); a.yaw = s.yawG * (1 - k); piv.scale.setScalar(Math.max(0.001, 1 - k)); }, inOut),
    s.tw(0.4, () => {}),
  ]);
}

export default {
  attacker: 'b',
  cam: { dist: 7.4, pitch: 12 },
  run(ctx) { return gore(ctx); },
};
