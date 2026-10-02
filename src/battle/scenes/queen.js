// Queen battle scene. The queen is ranged magic.
//   She gathers a white orb over her crown and fires a beam through the victim at belt height. The top half
//          slides off along the cut and falls, blood fountains from the stump, the lower half stays behind.
// The victim is left hidden at the end: the director shows it again for the flight to its tray.
import * as THREE from 'three';
import { rig, play, decal, glowMesh, ease, clamp01, lerp } from './_kit.js';

function gore(ctx) {
  const S = rig(ctx);
  const { A, V, c, f, w, vh, fx, a0 } = S;
  const cutY = vh * 0.6, cutPoint = c.clone().setY(cutY);
  const orbPos = () => A.position.clone().addScaledVector(f, 0.06).setY(A.position.y + 1.78 * A.scale.y);
  const orb = glowMesh(fx, new THREE.SphereGeometry(1, 16, 12), 0xfff3d8); orb.scale.setScalar(0.001);
  const halo = glowMesh(fx, new THREE.SphereGeometry(1, 16, 12), 0xff3a2a, 0.35); halo.scale.setScalar(0.001);
  const beam = glowMesh(fx, new THREE.CylinderGeometry(1, 1, 1, 12, 1, true), 0xffe6c0, 0.9); beam.visible = false;
  const core = glowMesh(fx, new THREE.CylinderGeometry(1, 1, 1, 8, 1, true), 0xffffff, 1); core.visible = false;
  const setBeam = (width) => {
    const from = orbPos(), len = from.distanceTo(cutPoint);
    for (const [m, k] of [[beam, 1], [core, 0.35]]) {
      m.visible = width > 0.001;
      m.position.copy(from).lerp(cutPoint, 0.5); m.scale.set(width * k, len, width * k);
      m.quaternion.setFromUnitVectors(S.up, cutPoint.clone().sub(from).normalize());
    }
  };
  const puddle = decal(S, c, 0x6e0505);

  // charge: the queen rises, the orb swells
  S.sfx('magic', 0.1, { volume: 0.8 });
  S.at(0, 0.7, (u) => {
    const e = ease.out(u);
    A.position.copy(a0).y = 0.12 * e; S.squash(A, 1 + 0.1 * e);
    orb.position.copy(orbPos()); halo.position.copy(orb.position);
    orb.scale.setScalar(0.17 * e * (1 + 0.1 * Math.sin(u * 40))); halo.scale.setScalar(0.34 * e);
  });
  S.once(0.3, () => fx.sparks(orbPos().addScaledVector(f, 0.3), { count: 14, speed: [0.3, 1.2], dir: S.up, spread: 3, gravity: 0 }));
  S.sfx('whoosh', 0.65, { pitch: 1.5, volume: 0.6 });
  // fire: the beam thins out as the cut happens
  S.at(0.7, 1.25, (u) => { if (u < 1) setBeam(0.1 * (1 - ease.in(u)) + 0.01); orb.scale.setScalar(0.17 * (1 - 0.4 * u)); });
  S.once(0.75, () => {
    fx.slice(V, { at: 0.6, tilt: 12, azimuth: Math.atan2(f.z, f.x), push: 1.3, pop: 1.0, spin: 2.2, cap: '#a31616', life: 1.8 });
    fx.splatter(cutPoint, { count: 50 + Math.round(40 * w), dir: S.up, spread: 0.8, speed: [2, 4.5] });
    fx.sparks(cutPoint, { count: 18, spread: 3 });
    fx.flash(cutPoint, { size: 0.55, dur: 0.3, color: '#ffe1b0' });
  });
  S.sfx('slice', 0.75);
  S.sfx('splat', 0.85);
  // blood fountain from the stump while it lasts
  for (let i = 1; i <= 6; i++) S.once(0.75 + 0.1 * i, () => fx.splatter(cutPoint.clone().setY(cutY + 0.02), { count: 8, dir: S.up, spread: 0.5, speed: [1.2, 2.8] }));
  S.sfx('thud', 1.4, { volume: 0.6 });
  S.at(0.75, 2.4, (u) => puddle(0.25 + 0.25 * (0.5 + w) * ease.out(u), 0.9));
  S.at(2.4, 3, (u) => puddle(0.25 + 0.25 * (0.5 + w), 0.9 * (1 - u)));
  // the orb fades and the queen settles back
  S.at(1.25, 2.3, (u) => {
    const e = ease.io(u);
    orb.scale.setScalar(Math.max(0.001, 0.1 * (1 - u))); halo.scale.setScalar(0.001);
    A.position.copy(a0).y = 0.12 * (1 - ease.out(clamp01(u * 2))); S.squash(A, lerp(1.1, 1, e));
    orb.position.copy(orbPos());
  });
  S.once(1.25, () => { beam.visible = false; core.visible = false; });
  S.once(2.3, () => { orb.visible = false; halo.visible = false; });
  return play(S, 3);
}

export default {
  attacker: 'q',
  cam: { dist: 5.4, pitch: 12 },
  run(ctx) { return gore(ctx); },
};
