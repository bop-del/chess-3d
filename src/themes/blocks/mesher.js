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

export class Mesher {
  constructor({ shade = false } = {}) { this.buckets = new Map(); this.quads = 0; this.shade = shade; }
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
    for (const f of NAMES) {
      if (o.skip && o.skip.has(f)) continue;
      let k = key;
      if (o.keys) {
        const ks = o.keys;
        k = ks[f] || (f === 'py' ? ks.top : f === 'ny' ? ks.bottom : ks.side) || key;
      }
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
