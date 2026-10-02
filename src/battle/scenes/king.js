// King battle scene. The king has a hidden weapon in his sceptre and a royal temper.
//   A spiked mace swings out and smashes the victim to shards of its own marble or ebony in a burst of blood.
//          The king raises the mace in triumph.
// The victim is left hidden at the end: the director shows it again for the flight to its tray.
import { rig, play, decal, ease, clamp01, lerp } from './_kit.js';

// Swing a prop held at grip about the king: 0 is straight up, positive leans toward the victim.
function holder(S, prop, gripSide, gripUp) {
  const axis = S.tipAxis(S.f);
  return (ang) => {
    prop.position.copy(S.A.position).addScaledVector(S.side, gripSide).addScaledVector(S.f, 0.1).setY(S.A.position.y + gripUp * S.A.scale.y);
    prop.quaternion.setFromAxisAngle(axis, ang);
  };
}

function gore(ctx) {
  const S = rig(ctx);
  const { A, V, c, f, w, vh, fx, a0 } = S;
  const mace = fx.prop('mace', { length: 0.9 }); mace.scale.setScalar(0.001);
  const swing = holder(S, mace, 0.3, 1.15);
  const hit = c.clone().setY(0.85);
  const puddle = decal(S, c, 0x6e0505);
  const ring = decal(S, c, 0xffe2b0, { ring: true });
  const lunge = (d) => A.position.copy(a0).addScaledVector(f, d);

  // the mace unfolds from the sceptre and goes up behind the king, who rears back
  S.sfx('clang', 0.1, { volume: 0.5, pitch: 1.3 });
  S.at(0, 0.6, (u) => {
    const e = ease.out(u);
    mace.scale.setScalar(Math.max(0.001, ease.back(clamp01(u * 1.5)) * 1.3)); swing(lerp(1.1, -0.6, e));
    lunge(-0.08 * e); S.squash(A, 1 + 0.08 * e);
  });
  S.sfx('whoosh', 0.55);
  // the blow
  S.at(0.6, 0.85, (u) => { const e = ease.in(u); swing(lerp(-0.6, 1.9, e)); lunge(lerp(-0.08, 0.2, e)); });
  S.once(0.85, () => {
    V.visible = false;
    fx.shatter(V, { count: 14 + Math.round(26 * w), size: 0.07 + 0.06 * w, power: 3.5, up: 3.5, origin: hit, life: 1.8 });
    fx.splatter(hit, { count: 60 + Math.round(60 * w), spread: 3, speed: [2, 6] });
    fx.sparks(hit, { count: 16, spread: 3 });
    fx.flash(hit, { size: 0.7, dur: 0.35, color: '#ffe2b0' });
    fx.dust(S.p(0, 0, 0.1), { count: 20 });
  });
  S.sfx('crack', 0.85);
  S.sfx('shatter', 0.87);
  S.sfx('splat', 0.93);
  S.at(0.85, 1.35, (u) => ring(0.3 + 1.6 * ease.out(u), 0.7 * (1 - u)));
  S.at(0.85, 2.4, (u) => puddle(0.3 + 0.3 * (0.4 + w) * ease.out(u), 0.9));
  S.at(2.4, 3, (u) => puddle(0.3 + 0.3 * (0.4 + w), 0.9 * (1 - u)));
  // the king stays bowed on the impact for a moment, then straightens and holds the mace up in triumph
  S.at(0.85, 1.2, (u) => { swing(1.9 + 0.05 * Math.sin(u * 30) * (1 - u)); lunge(0.2 - 0.05 * u); });
  S.sfx('whoosh', 1.3, { pitch: 0.8 });
  S.at(1.2, 1.9, (u) => {
    const e = ease.io(u);
    lunge(lerp(0.15, 0, e)); S.squash(A, 1 + 0.06 * Math.sin(e * Math.PI));
    swing(lerp(1.9, -0.35, e));
  });
  S.at(1.9, 2.5, (u) => { mace.scale.setScalar(Math.max(0.001, 1.3 * (1 - ease.in(u)))); swing(-0.35); lunge(0); S.squash(A, 1); });
  return play(S, 3);
}

export default {
  attacker: 'k',
  cam: { dist: 5.8, pitch: 12 },
  run(ctx) { return gore(ctx); },
};
