// fantasy pawn (CHE-367): a little storybook soldier. Kettle helmet with a wide gold edged brim and a gold lobed crest, kind eyes,
// a belted tunic, and a round shield with a gold rim and boss held at the front (-z).
import { THREE, parts, foot, lathe, blob, tube, TAU } from '../kit.js';
import { eye, rod } from './_fr.js';

export function buildPawn(mat) {
  const P = parts();
  const y0 = foot(P, 0.31, { style: 'round' });

  // boots peeking out under the tunic
  P.mirror((sx) => P.add(blob(0.055, 16, 12), 'body', { p: [sx * 0.06, y0 + 0.02, -0.07], s: [0.85, 0.6, 1.2] }));

  // tunic: a flared skirt, a narrow waist, a round chest
  P.add(lathe([
    [0, y0 - 0.01], [0.165, y0 - 0.01], [0.17, y0 + 0.02], [0.155, 0.26], [0.125, 0.34], [0.115, 0.39], [0.13, 0.45],
    [0.135, 0.50], [0.12, 0.545], [0.08, 0.575], [0.05, 0.60], [0, 0.61],
  ], { count: 56, segments: 48 }), 'body');
  // hem trim and belt with buckle
  P.add(new THREE.TorusGeometry(0.168, 0.011, 8, 48), 'accent', { p: [0, y0 + 0.022, 0], r: [Math.PI / 2, 0, 0] });
  P.add(new THREE.TorusGeometry(0.118, 0.014, 8, 48), 'accent', { p: [0, 0.385, 0], r: [Math.PI / 2, 0, 0] });

  // arms: the right one hangs at the side with a fist, the left one reaches to the shield
  P.mirror((sx) => P.add(blob(0.05, 16, 12), 'body', { p: [sx * 0.12, 0.53, 0.0], s: [1, 0.9, 1] })); // shoulders
  rod(P, [0.13, 0.52, 0.0], [0.15, 0.40, -0.02], 0.035, 0.03);
  P.add(blob(0.034, 16, 12), 'body', { p: [0.152, 0.37, -0.03] });
  rod(P, [-0.13, 0.52, 0.0], [-0.12, 0.43, -0.14], 0.035, 0.03);

  // head
  const hy = 0.675;
  P.add(blob(0.115, 32, 24), 'body', { p: [0, hy, -0.005] });
  // eyes under the brim, a small nose
  P.mirror((sx) => eye(P, [sx * 0.042, hy - 0.005, -0.103], [sx * 0.35, 0.05, -1], 0.017));
  P.add(blob(0.018, 12, 10), 'body', { p: [0, hy - 0.04, -0.115] });
  // smile
  P.add(tube([[-0.025, hy - 0.068, -0.1], [0, hy - 0.078, -0.106], [0.025, hy - 0.068, -0.1]], 0.0045, { segments: 12, radial: 6 }), 'dark');

  // helmet: a dome over the head, a gold brim, a nasal guard, cheek plates
  const helm = new THREE.SphereGeometry(0.128, 40, 20, 0, TAU, 0, Math.PI * 0.5);
  P.add(helm, 'body', { p: [0, hy + 0.025, 0], s: [1, 1.0, 1] });
  // kettle hat brim: a wide sloped disc with a gold rolled edge (about 1.3 times the head radius)
  P.add(lathe([[0.11, hy + 0.045], [0.135, hy + 0.034], [0.152, hy + 0.022], [0.152, hy + 0.012], [0.135, hy + 0.02], [0.11, hy + 0.03]], { count: 16, segments: 56 }), 'body');
  P.add(new THREE.TorusGeometry(0.152, 0.015, 10, 56), 'accent', { p: [0, hy + 0.017, 0], r: [Math.PI / 2, 0, 0] });
  P.add(new THREE.TorusGeometry(0.127, 0.009, 8, 48), 'accent', { p: [0, hy + 0.05, 0], r: [Math.PI / 2, 0, 0] });
    // crest: four stacked gold lobes front to back along the helmet top, tallest over the crown
  for (const [z, k] of [[-0.075, 0.8], [-0.025, 1], [0.03, 0.95], [0.082, 0.78]]) {
    const ys = hy + 0.025 + Math.sqrt(0.128 * 0.128 - z * z);
    P.add(blob(1, 18, 12), 'accent', { p: [0, ys + 0.028 * k, z], r: [0.25 + z * 3, 0, 0], s: [0.024, 0.048 * k, 0.034] });
  }
  // shield on the left arm: a shallow dome facing -z, gold rim, boss and four studs
  const sc = [-0.075, 0.40, -0.195], sr = 0.20;
  const tilt = [-Math.PI / 2 + 0.12, 0, 0];
  const shield = lathe([[0, 0.045], [sr * 0.5, 0.034], [sr, 0], [sr * 0.98, -0.012], [0, -0.012]], { count: 24, segments: 48 });
  P.add(shield, 'body', { p: sc, r: tilt });
  const tq = new THREE.Quaternion().setFromEuler(new THREE.Euler(...tilt));
  const loc = (x, y, z) => new THREE.Vector3(x, y, z).applyQuaternion(tq).add(new THREE.Vector3(...sc)).toArray();
  P.add(new THREE.TorusGeometry(sr - 0.005, 0.016, 10, 48), 'accent', { p: loc(0, 0.0, 0), r: [tilt[0] + Math.PI / 2, 0, 0] });
  P.add(blob(0.048, 20, 14), 'accent', { p: loc(0, 0.048, 0), r: tilt, s: [1, 0.7, 1] });
  P.add(new THREE.TorusGeometry(0.085, 0.008, 8, 40), 'accent', { p: loc(0, 0.039, 0), r: [tilt[0] + Math.PI / 2, 0, 0] });
  for (let i = 0; i < 4; i++) {
    const a = (i / 4) * TAU + TAU / 8;
    P.add(blob(0.011, 10, 8), 'accent', { p: loc(Math.cos(a) * 0.145, 0.024, Math.sin(a) * 0.145) });
  }
  return P.build(mat, 'fantasy-pawn');
}
