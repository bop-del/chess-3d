// Rook battle scene. The rook is a tower with no limbs, so its signature is weight.
//   It rocks back, topples forward onto the victim like a felled tower and crushes it. Blood, a puddle, and
//          anything bigger than a pawn bursts into marble or ebony shards.
// The victim is left hidden at the end: the director shows it again for the flight to its tray.
import { rig, play, decal, ease, clamp01, lerp } from './_kit.js';

const R = 0.33;   // base radius of the rook

function gore(ctx) {
  const S = rig(ctx);
  const { A, V, c, f, w, fx, a0 } = S;
  const axis = S.tipAxis(f);
  const shatter = w >= 0.4;
  const place = (base, ang) => S.rotAbout(A, base, base.clone().addScaledVector(f, ang < 0 ? -R : R), axis, ang);
  const hit = S.p(0, 0, 0.25);
  const puddle = decal(S, c, 0x6e0505);
  let pop = 0;

  // rock back and stretch
  S.sfx('whoosh', 0.45, { volume: 0.7 });
  S.at(0, 0.7, (u) => { const e = ease.out(u); S.squash(A, 1 + 0.22 * e); place(a0, -0.5 * e); });
  // fall: the victim is flattened as the tower comes down on it
  S.at(0.7, 1.05, (u) => {
    const ang = lerp(-0.5, 1.45, ease.in(u)), k = clamp01((ang - 0.55) / 0.8);
    S.squash(A, lerp(1.22, 1, u)); place(a0.clone().setY(0.06 * u), ang);
    if (!pop) S.squash(V, 1 - 0.9 * k, 1 + 0.5 * k);
  });
  S.sfx('thud', 1.05);
  S.sfx(shatter ? 'shatter' : 'splat', 1.07);
  S.once(1.05, () => {
    fx.splatter(hit, { count: 40 + Math.round(60 * w), spread: 3, speed: [2, 5.5] });
    fx.dust(hit, { count: 18 });
    fx.flash(S.p(0, 0, 0.15), { size: 0.5, dur: 0.3, color: '#ffe2b0' });
    if (shatter) { pop = 1; fx.shatter(V, { count: 12 + Math.round(26 * w), size: 0.07 + 0.05 * w, power: 3, up: 3, origin: hit, life: 1.7 }); }
  });
  S.at(1.05, 2.5, (u) => puddle(0.28 + 0.3 * (0.4 + w) * ease.out(u), 0.9));
  S.at(2.5, 3, (u) => puddle(0.28 + 0.3 * (0.4 + w), 0.9 * (1 - u)));
  // the tower lies there for a beat, then heaves itself upright
  S.at(1.05, 1.7, (u) => place(a0.clone().setY(0.06), 1.45 + 0.04 * Math.sin(u * 20) * (1 - u)));
  S.sfx('thud', 1.8, { volume: 0.5, pitch: 1.2 });
  S.at(1.7, 2.5, (u) => { const e = ease.out(u); place(a0.clone().setY(0.06 * (1 - e)), lerp(1.45, 0, e)); S.squash(A, 1); });
  // a flattened pawn goes out in a puff
  S.once(2.5, () => { if (!pop) { fx.dust(c.clone().setY(0.1), { count: 14 }); V.visible = false; } });
  return play(S, 3);
}

export default {
  attacker: 'r',
  cam: { dist: 5.0, pitch: 12 },
  run(ctx) { return gore(ctx); },
};
