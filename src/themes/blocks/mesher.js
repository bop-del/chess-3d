// Quad mesher: boxes with per face texture keys, vertex colours, optional Y rotation. One BufferGeometry per key.
import * as THREE from 'three';

const F = {
  px: { n: [1, 0, 0], v: [[1, 0, 1], [1, 0, 0], [1, 1, 0], [1, 1, 1]] },
  nx: { n: [-1, 0, 0], v: [[0, 0, 0], [0, 0, 1], [0, 1, 1], [0, 1, 0]] },
  py: { n: [0, 1, 0], v: [[0, 1, 1], [1, 1, 1], [1, 1, 0], [0, 1, 0]] },
  ny: { n: [0, -1, 0], v: [[0, 0, 0], [1, 0, 0], [1, 0, 1], [0, 0, 1]] },
  pz: { n: [0, 0, 1], v: [[0, 0, 1], [1, 0, 1], [1, 1, 1], [0, 1, 1]] },
  nz: { n: [0, 0, -1], v: [[1, 0, 0], [0, 0, 0], [0, 1, 0], [1, 1, 0]] },
};
const UVS = [[0, 0], [1, 0], [1, 1], [0, 1]];
const NAMES = Object.keys(F);
const col = new THREE.Color();
// Fixed per face brightness (Pixelwelt): top brightest, two side pairs darker, bottom darkest. No smooth gradients.
export const SHADE = { py: 1, pz: 0.8, nz: 0.8, px: 0.6, nx: 0.6, ny: 0.5 };

/** Z fighting finder: two boxes that both draw a face on the same plane, the same way round, over an area, and look different
 *  (another texture key or colour). Returns [{ a, b, face }]. Rotated boxes are not checked. */
export function coplanarOverlaps(boxes, eps = 1e-6) {
  const AX = { px: [0, 1], nx: [0, 0], py: [1, 1], ny: [1, 0], pz: [2, 1], nz: [2, 0] };   // [axis of the normal, plane at the far side]
  const lo = (b, ax) => [b.x, b.y, b.z][ax], size = (b, ax) => [b.w, b.h, b.d][ax];
  const out = [];
  for (const f of Object.keys(AX)) {
    const [ax, hi] = AX[f], axes = [0, 1, 2].filter((i) => i !== ax);
    const list = boxes.filter((b) => !b.ry && b.faces[f]).map((b) => ({ b, plane: lo(b, ax) + (hi ? size(b, ax) : 0) })).sort((p, q) => p.plane - q.plane);
    for (let i = 0; i < list.length; i++) for (let j = i + 1; j < list.length && list[j].plane - list[i].plane < eps; j++) {
      const A = list[i].b, B = list[j].b;
      if (A.faces[f] === B.faces[f] && A.color === B.color) continue;
      if (axes.every((k) => Math.min(lo(A, k) + size(A, k), lo(B, k) + size(B, k)) - Math.max(lo(A, k), lo(B, k)) > eps)) out.push({ a: A, b: B, face: f });
    }
  }
  return out;
}

export class Mesher {
  constructor({ shade = false } = {}) { this.buckets = new Map(); this.quads = 0; this.shade = shade; this.boxes = []; }
  bucket(k) {
    if (!this.buckets.has(k)) this.buckets.set(k, { pos: [], nor: [], uv: [], col: [], idx: [] });
    return this.buckets.get(k);
  }
  /** Box with min corner x,y,z and size w,h,d. o: color, keys ({top,bottom,side} or per face), key, uvUnit, ry, skip(Set), off([u,v]) */
  box(key, x, y, z, w, h, d, o = {}) {
    const unit = o.uvUnit || 1, ry = o.ry || 0, cs = Math.cos(ry), sn = Math.sin(ry);
    col.set(o.color ?? 0xffffff);
    const cx = x + w / 2, cy = y + h / 2, cz = z + d / 2;
    const off = o.off || [0, 0];
    const rec = { x, y, z, w, h, d, ry, color: col.getHex(), faces: {} };
    this.boxes.push(rec);
    for (const f of NAMES) {
      if (o.skip && o.skip.has(f)) continue;
      let k = key;
      if (o.keys) {
        const ks = o.keys;
        k = ks[f] || (f === 'py' ? ks.top : f === 'ny' ? ks.bottom : ks.side) || key;
      }
      rec.faces[f] = k;
      const B = this.bucket(k), face = F[f], base = B.pos.length / 3, sh = this.shade ? SHADE[f] : 1;
      const a = (f === 'px' || f === 'nx') ? d : w, bb = (f === 'py' || f === 'ny') ? d : h;
      let nx = face.n[0], nz = face.n[2];
      const rnx = nx * cs + nz * sn, rnz = -nx * sn + nz * cs;
      for (let i = 0; i < 4; i++) {
        const c = face.v[i];
        const lx = c[0] * w - w / 2, lz = c[2] * d - d / 2;
        B.pos.push(cx + lx * cs + lz * sn, y + c[1] * h, cz - lx * sn + lz * cs);
        B.nor.push(rnx, face.n[1], rnz);
        B.uv.push(UVS[i][0] * a / unit + off[0], UVS[i][1] * bb / unit + off[1]);
        B.col.push(col.r * sh, col.g * sh, col.b * sh);
      }
      B.idx.push(base, base + 1, base + 2, base, base + 2, base + 3);
      this.quads++;
    }
  }
  geometries() {
    const out = new Map();
    for (const [k, B] of this.buckets) {
      const g = new THREE.BufferGeometry();
      g.setAttribute('position', new THREE.Float32BufferAttribute(B.pos, 3));
      g.setAttribute('normal', new THREE.Float32BufferAttribute(B.nor, 3));
      g.setAttribute('uv', new THREE.Float32BufferAttribute(B.uv, 2));
      g.setAttribute('color', new THREE.Float32BufferAttribute(B.col, 3));
      g.setIndex(B.idx);
      g.computeBoundingSphere();
      out.set(k, g);
    }
    return out;
  }
  tris() { return this.quads * 2; }
}
