// fantasy rook (CHE-367): a storybook castle tower. Round stone tower on the round foot, a gold band, a corbelled parapet with
// eight merlons, an arched gold door and window slits at the front (-z), and a little banner on a pole rising from the top.
import { THREE, parts, foot, lathe, slab, blob, tube, TAU, HEIGHT } from '../kit.js';
import { rod } from './_fr.js';

const WINDOWS = [[Math.PI, 0.46], [Math.PI * 0.5, 0.40], [Math.PI * 1.5, 0.40], [0, 0.46], [Math.PI * 0.75, 0.52], [Math.PI * 1.25, 0.52]];

export function buildRook(mat) {
  const P = parts();
  const y0 = foot(P, 0.33, { style: 'round' });

  // tower: a slight batter at the bottom, straight shaft, corbel flare under the parapet
  const yTop = 0.80;
  P.add(lathe([
    [0, y0 - 0.01], [0.235, y0 - 0.01], [0.235, y0 + 0.03], [0.215, y0 + 0.08], [0.200, 0.36], [0.196, 0.55], [0.200, 0.60],
    [0.230, 0.635], [0.262, 0.655], [0.268, 0.67], [0.268, 0.72], [0.262, 0.73], [0.20, 0.72], [0, 0.715],
  ], { count: 64, segments: 64 }), 'body');

  // stone courses: shallow raised rings
  for (const [y, r] of [[0.30, 0.201], [0.44, 0.1985], [0.58, 0.198]]) {
    P.add(new THREE.TorusGeometry(r, 0.006, 6, 64), 'body', { p: [0, y, 0], r: [Math.PI / 2, 0, 0] });
  }
  // a few raised stones scattered over the shaft, avoiding the door and the windows
  let seed = 7;
  const rnd = () => ((seed = (seed * 16807) % 2147483647) / 2147483647);
  for (let i = 0; i < 26; i++) {
    const a = rnd() * Math.PI * 2, y = 0.27 + rnd() * 0.33;
    const near = WINDOWS.some(([wa, wy]) => Math.abs(Math.atan2(Math.sin(a - wa), Math.cos(a - wa))) < 0.36 && Math.abs(y - wy - 0.045) < 0.085);
    if (near || Math.abs(Math.atan2(Math.sin(a - Math.PI), Math.cos(a - Math.PI))) < 0.5) continue;
    const r = 0.199 - (y - 0.36) * 0.02;
    P.add(new THREE.BoxGeometry(0.05 + rnd() * 0.03, 0.03, 0.02), 'body', { p: [Math.sin(a) * r, y, Math.cos(a) * r], r: [0, a, 0] });
  }
  // gold band at the base of the shaft and under the parapet
  P.add(new THREE.TorusGeometry(0.236, 0.014, 8, 64), 'accent', { p: [0, y0 + 0.032, 0], r: [Math.PI / 2, 0, 0] });
  P.add(new THREE.TorusGeometry(0.262, 0.012, 8, 64), 'accent', { p: [0, 0.663, 0], r: [Math.PI / 2, 0, 0] });

  // corbels: little brackets under the parapet ring
  for (let i = 0; i < 16; i++) {
    const a = (i / 16) * TAU;
    P.add(new THREE.BoxGeometry(0.03, 0.05, 0.04), 'body', { p: [Math.sin(a) * 0.223, 0.62, Math.cos(a) * 0.223], r: [0, a, 0] });
  }

  // merlons: eight blocks around the rim, a soft cap each
  const N = 8;
  for (let i = 0; i < N; i++) {
    const a = (i / N) * TAU + TAU / 16;
    const w = 0.13, rr = 0.235;
    const g = slab([[-w / 2, 0], [w / 2, 0], [w / 2, 0.095], [-w / 2, 0.095]], 0.06, { bevel: 0.01 });
    P.add(g, 'body', { p: [Math.sin(a) * rr, 0.715, Math.cos(a) * rr], r: [0, a, 0] });
    P.add(blob(1, 20, 10), 'accent', { p: [Math.sin(a) * rr, 0.82, Math.cos(a) * rr], r: [0, a, 0], s: [w * 0.42, 0.011, 0.032] });
  }
  // inner floor of the walk, a little lower than the rim
  P.add(lathe([[0.215, 0.722], [0.2, 0.735], [0.12, 0.752], [0, 0.758]], { count: 16, segments: 48 }), 'body');

  // arched door at the front (-z): gold leaf with a frame, sunk into the shaft
  const door = [];
  const dw = 0.06, dh = 0.10;
  door.push([-dw, 0], [dw, 0], [dw, dh]);
  for (let k = 0; k <= 10; k++) { const t = (k / 10) * Math.PI; door.push([Math.cos(t) * dw, dh + Math.sin(t) * dw]); }
  P.add(slab(door, 0.03, { bevel: 0.006 }), 'accent', { p: [0, y0 + 0.06, -0.215], r: [0, 0, 0] });
  // door frame: stone arch around it
  const arch = [];
  for (let k = 0; k <= 16; k++) { const t = (k / 16) * Math.PI; arch.push([Math.cos(t) * (dw + 0.012), y0 + 0.06 + dh + Math.sin(t) * (dw + 0.012), -0.224]); }
  P.add(tube([[dw + 0.012, y0 + 0.055, -0.222], ...arch, [-dw - 0.012, y0 + 0.055, -0.222]], 0.013, { segments: 40, radial: 8 }), 'body');
  // door planks and a ring handle
  for (const x of [-0.02, 0.02]) P.add(new THREE.BoxGeometry(0.004, 0.13, 0.008), 'body', { p: [x, y0 + 0.12, -0.233] });
  P.add(new THREE.TorusGeometry(0.012, 0.003, 6, 16), 'body', { p: [0.032, y0 + 0.11, -0.235] });

  // window slits: arched gold panes with a stone sill, front and both sides
  const slit = [];
  const sw = 0.018, sh = 0.07;
  slit.push([-sw, 0], [sw, 0], [sw, sh]);
  for (let k = 0; k <= 6; k++) { const t = (k / 6) * Math.PI; slit.push([Math.cos(t) * sw, sh + Math.sin(t) * sw]); }
  for (const [a, y] of WINDOWS) {
    const r = 0.196;
    P.add(slab(slit, 0.02, { bevel: 0.004 }), 'accent', { p: [Math.sin(a) * r, y, Math.cos(a) * r], r: [0, a, 0] });
    P.add(new THREE.BoxGeometry(0.06, 0.012, 0.03), 'body', { p: [Math.sin(a) * (r + 0.006), y - 0.006, Math.cos(a) * (r + 0.006)], r: [0, a, 0] });
  }

  // banner: a gold pole from the floor, a knob, and a waving pennant toward +x
  const top = HEIGHT.r;
  rod(P, [0, 0.73, 0], [0, top - 0.025, 0], 0.014, 0.012, 'accent', { caps: false });
  P.add(blob(0.022, 16, 12), 'accent', { p: [0, top - 0.022, 0] });
  P.add(blob(1, 20, 12), 'accent', { p: [0, 0.758, 0], s: [0.04, 0.022, 0.04] });
  // pennant: a swallow tailed flag, waved by bending its extruded outline in z
  const fl = 0.21, fh = 0.11;
  const outline = [];
  for (let k = 0; k <= 10; k++) outline.push([fl * k / 10, 0.012 * k / 10]);
  outline.push([fl * 0.78, fh * 0.5]);
  for (let k = 10; k >= 0; k--) outline.push([fl * k / 10, fh - 0.012 * k / 10]);
  const flag = slab(outline, 0.012, { bevel: 0.004 });
  // wave: z bends with x (the outline has vertices every tenth, so the cloth bends smoothly)
  const wave = (x) => Math.sin(x * 22) * 0.02 * (x / fl);
  const pos = flag.attributes.position;
  for (let i = 0; i < pos.count; i++) {
    const x = pos.getX(i);
    pos.setZ(i, pos.getZ(i) + wave(x));
  }
  flag.computeVertexNormals();
  const fp = [0.008, top - 0.16, 0];
  P.add(flag, 'body', { p: fp });
  // a gold border round the cloth and a gold disc emblem on both faces
  const edge = outline.map(([x, y]) => [fp[0] + x, fp[1] + y, wave(x)]);
  P.add(tube(edge, 0.010, { segments: 80, radial: 8, closed: true }), 'accent');
  // emblem: a gold ring round a raised boss of the cloth colour, on both faces (no dark spot that reads as a hole)
  for (const s of [1, -1]) {
    const e = [fp[0] + 0.075, fp[1] + fh / 2, wave(0.075) + s * 0.009];
    P.add(new THREE.TorusGeometry(0.022, 0.006, 8, 24), 'accent', { p: e });
    P.add(blob(1, 16, 10), 'body', { p: e, s: [0.017, 0.017, 0.006] });
  }

  return P.build(mat, 'fantasy-rook');
}
