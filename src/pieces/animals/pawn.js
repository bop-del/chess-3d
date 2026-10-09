// animals pawn (CHE-367): a sitting rabbit. Round body and haunches, a big head with toy eyes, two tall upright ears with gold
// inner ears (the ears make the height and the top shape), a gold collar with a little bell, a cotton tail at the back.
import { THREE, parts, foot, tube } from '../kit.js';
import { ell, onEll, eye } from './_ar.js';

export function buildPawn(mat) {
  const P = parts();
  const y0 = foot(P, 0.32, { style: 'grass' });

  // body: a pear shape, wider at the bottom
  ell(P, 'body', [0, y0 + 0.15, 0.03], [0.165, 0.16, 0.16]);
  ell(P, 'body', [0, y0 + 0.09, 0.03], [0.175, 0.1, 0.17]);
  // haunches and long hind feet poking forward
  for (const sx of [1, -1]) {
    ell(P, 'body', [sx * 0.115, y0 + 0.09, 0.05], [0.08, 0.09, 0.12]);
    ell(P, 'body', [sx * 0.115, y0 + 0.03, -0.09], [0.055, 0.035, 0.1]);
    // front paws
    ell(P, 'body', [sx * 0.06, y0 + 0.06, -0.14], [0.045, 0.055, 0.045]);
  }
  // cotton tail
  ell(P, 'body', [0, y0 + 0.1, 0.2], [0.06, 0.06, 0.055], [0, 0, 0], 16, 12);

  // head
  const hc = [0, y0 + 0.43, -0.03], hs = [0.14, 0.125, 0.13];
  ell(P, 'body', hc, hs);
  // muzzle cheeks and nose
  for (const sx of [1, -1]) ell(P, 'body', [sx * 0.036, hc[1] - 0.045, -0.13], [0.048, 0.04, 0.04], [0, 0, 0], 16, 12);
  ell(P, 'accent', [0, hc[1] - 0.012, -0.165], [0.022, 0.016, 0.015], [0, 0, 0], 12, 10);
  // a small smile under the nose: two arcs like a rabbit's mouth
  for (const sx of [1, -1]) {
    const pts = [];
    for (let i = 0; i <= 5; i++) {
      const a = i / 5;
      pts.push([sx * (0.003 + a * 0.03), hc[1] - 0.03 - Math.sin(a * Math.PI) * 0.012 + a * 0.006, -0.168 + a * 0.012]);
    }
    P.add(tube(pts, 0.005, { segments: 10, radial: 6 }), 'dark');
  }
  // eyes
  for (const sx of [1, -1]) {
    const { p, n } = onEll(hc, hs, [sx * 0.52, 0.2, -0.85]);
    eye(P, p, n, 0.032);
  }

  // ears: tall, slightly leaning out and back, gold inside
  for (const sx of [1, -1]) {
    const r = [-0.12, 0, -sx * 0.13];
    const ec = [sx * 0.06, hc[1] + 0.215, 0.0];
    ell(P, 'body', ec, [0.046, 0.13, 0.03], r);
    // the inner ear sits on the front face of the ear
    const m = new THREE.Matrix4().compose(new THREE.Vector3(...ec), new THREE.Quaternion().setFromEuler(new THREE.Euler(...r)), new THREE.Vector3(1, 1, 1));
    const inner = new THREE.Vector3(0, -0.005, -0.019).applyMatrix4(m);
    ell(P, 'accent', inner.toArray(), [0.026, 0.095, 0.012], r, 16, 12);
    // ear root
    ell(P, 'body', [sx * 0.05, hc[1] + 0.105, 0.0], [0.04, 0.04, 0.03], [0, 0, 0], 12, 10);
  }

  // gold collar with a bell
  const cy = y0 + 0.315;
  P.add(new THREE.TorusGeometry(0.098, 0.016, 10, 40), 'accent', { p: [0, cy, 0.0], r: [Math.PI / 2 - 0.12, 0, 0] });
  ell(P, 'accent', [0, cy - 0.025, -0.112], [0.024, 0.024, 0.024], [0, 0, 0], 14, 10);

  return P.build(mat, 'animals-pawn');
}
