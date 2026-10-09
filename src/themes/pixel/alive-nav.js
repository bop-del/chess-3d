// Where life may go on the living island (CHE-372): the ground read back from the island's own blocks, and walk plans that are a pure
// function of time. The island variants (islands.js) keep every block in userData.boxes of their 'island' and 'islets' groups, so the
// top of each column, its kind (grass, sand, gravel, basalt, water, lava), the props on it (rocks, fences, crops, the hut) and the
// trees can be found without knowing the variant. Walkers keep to the main level (top at y = 0), off the board, the label ring
// (|x| and |z| < 5), the captured pieces areas, ponds, lava, trees and props; swimmers keep to one stretch of water.

const WALK = new Set(['grassTop', 'sand', 'gravel', 'basalt']);
const ck = (ix, iz) => (ix + 512) * 1024 + (iz + 512);
const ckx = (k) => Math.floor(k / 1024) - 512, ckz = (k) => (k % 1024) - 512;

/** The ground of the island in the world group: { cols, falls, top(x, z), walk, water }. */
export function readGround(group, ctx) {
  const cols = new Map(), props = [], falls = [], blocked = new Set(), offGrid = new Map(), flowers = new Set();
  const offsetOf = (o) => { const p = [0, 0, 0]; for (let q = o; q && q !== group; q = q.parent) { p[0] += q.position.x; p[1] += q.position.y; p[2] += q.position.z; } return p; };
  group.traverse((o) => {
    const boxes = o.userData?.boxes;
    if (!boxes) return;
    const [ox, oy, oz] = offsetOf(o);
    if (o.name === 'tree') {   // every block of a tree (trunk and canopy) closes its column
      for (const b of boxes) for (let ix = Math.floor(b.x + ox + 1e-6); ix < b.x + ox + b.w - 1e-6; ix++) for (let iz = Math.floor(b.z + oz + 1e-6); iz < b.z + oz + b.d - 1e-6; iz++) blocked.add(ck(ix, iz));
      return;
    }
    if (o.name !== 'island' && o.name !== 'islets') return;
    for (const b of boxes) {
      const x = b.x + ox, y = b.y + oy, z = b.z + oz, keys = Object.values(b.faces);
      const liquid = b.faces.py === 'water' || b.faces.py === 'lava' ? b.faces.py : null;
      const unit = b.w === 1 && b.h === 1 && b.d === 1 && Number.isInteger(x) && Number.isInteger(y) && Number.isInteger(z);
      if (keys.includes('fall') || keys.includes('lavafall')) { falls.push(fallOf(b, x, y, z)); continue; }
      const fx = Math.round((x - Math.floor(x + 1e-6)) * 1000) / 1000, fz = Math.round((z - Math.floor(z + 1e-6)) * 1000) / 1000;
      if (liquid && (fx || fz)) {   // a pond of a floating islet that is not on the main grid (islands.js islet with a fractional radius)
        const gk = `${fx},${fz}`, grid = offGrid.get(gk) || offGrid.set(gk, { fx, fz, tops: new Map() }).get(gk);
        for (let i = 0; i < b.w - 1e-6; i++) for (let j = 0; j < b.d - 1e-6; j++) grid.tops.set(ck(Math.round(x - fx) + i, Math.round(z - fz) + j), { top: y + b.h, liquid });
        continue;
      }
      if (!unit && !liquid) { props.push({ x, y, z, w: b.w, h: b.h, d: b.d }); continue; }
      for (let ix = x; ix < x + b.w - 1e-6; ix++) for (let iz = z; iz < z + b.d - 1e-6; iz++) {
        const k = ck(ix, iz), c = cols.get(k), top = y + b.h;
        if (!c || top >= c.top - 1e-6) cols.set(k, { top, key: b.faces.py ?? null, liquid });
      }
    }
  });
  // a prop standing on a column (rock, fence post, crop row, hut, lantern, sand castle) closes it when it is taller than a flower or a tuft
  for (const p of props) for (let ix = Math.floor(p.x - 0.15); ix < p.x + p.w + 0.15; ix++) for (let iz = Math.floor(p.z - 0.15); iz < p.z + p.d + 0.15; iz++) {
    const c = cols.get(ck(ix, iz));
    if (c && p.y >= c.top - 0.01 && p.y + p.h > c.top + 0.45) blocked.add(ck(ix, iz));
    else if (c && p.y >= c.top - 0.01) flowers.add(ck(ix, iz));   // flowers and tufts: walked through, never stood in
  }
  const zone = (ix, iz) => (ix + 1 > -5 && ix < 5 && iz + 1 > -5 && iz < 5) || ctx.inTray(ix + 0.5, iz + 0.5, 0.5) || ctx.inBoard(ix + 0.5, iz + 0.5);
  const walkCells = new Set(), waterCells = new Set();
  for (const [k, c] of cols) {
    const ix = ckx(k), iz = ckz(k);
    if (blocked.has(k) || zone(ix, iz)) continue;
    if (!c.liquid && Math.abs(c.top) < 1e-6 && WALK.has(c.key)) walkCells.add(k);
    if (c.liquid === 'water') waterCells.add(k);
  }
  const top = (x, z) => cols.get(ck(Math.floor(x), Math.floor(z)))?.top ?? null;
  // walkers: every patch of at least six cells (a creature stays on its own patch); swimmers: the largest stretch of one level
  const patches = components(walkCells).filter((c) => c.size >= 6);
  const walk = nav(new Set(patches.flatMap((c) => [...c])), 0);
  walk.patches = patches.map((c) => [...c].map((k) => [ckx(k) + 0.5, ckz(k) + 0.5]));
  // swimmers: the largest stretch of water of one level, on the main grid or on an islet's own grid
  const pools = [];
  const sameTop = (T) => (a, b) => Math.abs(T.get(a).top - T.get(b).top) < 1e-6;
  for (const c of components(waterCells, sameTop(cols))) pools.push({ cells: c, y: cols.get(c.values().next().value).top, fx: 0, fz: 0 });
  for (const g of offGrid.values()) {
    const wc = new Set([...g.tops].filter(([, v]) => v.liquid === 'water').map(([k]) => k));
    for (const c of components(wc, sameTop(g.tops))) pools.push({ cells: c, y: g.tops.get(c.values().next().value).top, fx: g.fx, fz: g.fz });
  }
  pools.sort((a, b) => b.cells.size - a.cells.size);
  const pool = pools[0];
  walk.flowers = flowers;
  return { cols, falls, top, walk, flowers, water: pool && pool.cells.size >= 4 ? nav(pool.cells, pool.y, pool.fx, pool.fz) : null, blocked };
}

// a fall sheet: the open side (a face drawn whose opposite is not) is where it faces out
function fallOf(b, x, y, z) {
  const opp = { px: 'nx', nx: 'px', pz: 'nz', nz: 'pz' };
  const out = Object.keys(opp).find((f) => b.faces[f] && !b.faces[opp[f]]) || 'nz';
  const nx = out === 'px' ? 1 : out === 'nx' ? -1 : 0, nz = out === 'pz' ? 1 : out === 'nz' ? -1 : 0;
  const alongX = nz !== 0;
  return {
    lava: Object.values(b.faces).includes('lavafall'), nx, nz,
    // the outer plane, the span along the sheet, its top and bottom
    px: nx > 0 ? x + b.w : nx < 0 ? x : 0, pz: nz > 0 ? z + b.d : nz < 0 ? z : 0,
    u0: alongX ? x : z, u1: alongX ? x + b.w : z + b.d, alongX, top: y + b.h, bottom: y,
  };
}

/** Connected patches of a cell set (4 neighbours), largest first. */
function components(cells, same = () => true) {
  const seen = new Set(), out = [];
  for (const s of cells) {
    if (seen.has(s)) continue;
    const comp = new Set([s]), q = [s];
    seen.add(s);
    while (q.length) {
      const k = q.pop(), ix = ckx(k), iz = ckz(k);
      for (const n of [ck(ix + 1, iz), ck(ix - 1, iz), ck(ix, iz + 1), ck(ix, iz - 1)]) if (cells.has(n) && !seen.has(n) && same(k, n)) { seen.add(n); comp.add(n); q.push(n); }
    }
    out.push(comp);
  }
  return out.sort((a, b) => b.size - a.size);
}

/** A walkable cell set: cells as [x, z] centres, ok(x, z, r) (the body square of half size r stands on free cells), path(a, b). */
function nav(cells, y, fx = 0, fz = 0) {
  const list = [...cells].map((k) => [ckx(k) + 0.5 + fx, ckz(k) + 0.5 + fz]);
  const has = (x, z) => cells.has(ck(Math.floor(x - fx), Math.floor(z - fz)));
  const ok = (x, z, r) => has(x, z) && has(x - r, z - r) && has(x + r, z - r) && has(x - r, z + r) && has(x + r, z + r);
  const clear = (a, b, r) => { const n = Math.ceil(Math.hypot(b[0] - a[0], b[1] - a[1]) / 0.2); for (let i = 1; i <= n; i++) { const t = i / n; if (!ok(a[0] + (b[0] - a[0]) * t, a[1] + (b[1] - a[1]) * t, r)) return false; } return true; };
  /** Grid path from cell centre a to cell centre b, pulled straight where the body fits. */
  const path = (a, b, r) => {
    const s = ck(Math.floor(a[0] - fx), Math.floor(a[1] - fz)), g = ck(Math.floor(b[0] - fx), Math.floor(b[1] - fz));
    const prev = new Map([[s, s]]), q = [s];
    for (let i = 0; i < q.length && !prev.has(g); i++) {
      const k = q[i], ix = ckx(k), iz = ckz(k);
      for (const n of [ck(ix + 1, iz), ck(ix - 1, iz), ck(ix, iz + 1), ck(ix, iz - 1)]) if (cells.has(n) && !prev.has(n)) { prev.set(n, k); q.push(n); }
    }
    if (!prev.has(g)) return null;
    const pts = [];
    for (let k = g; ; k = prev.get(k)) { pts.push([ckx(k) + 0.5 + fx, ckz(k) + 0.5 + fz]); if (k === s) break; }
    pts.reverse();
    pts[0] = a; pts[pts.length - 1] = b;
    const out = [a];
    for (let i = 0; i < pts.length - 1;) {
      let j = pts.length - 1;
      while (j > i + 1 && !clear(pts[i], pts[j], r)) j--;
      out.push(pts[j]); i = j;
    }
    return out;
  };
  return { cells, list, ok, has, path, y, fx, fz, key: (x, z) => ck(Math.floor(x - fx), Math.floor(z - fz)) };
}

/** A part of a nav: the cells whose centre passes keep(x, z), split into patches like the walk. */
export function subNav(n, keep) {
  const cells = new Set([...n.cells].filter((k) => keep(ckx(k) + 0.5 + n.fx, ckz(k) + 0.5 + n.fz)));
  const s = nav(cells, n.y, n.fx, n.fz);
  s.patches = components(cells).map((c) => [...c].map((k) => [ckx(k) + 0.5 + n.fx, ckz(k) + 0.5 + n.fz]));
  s.flowers = n.flowers;
  return s;
}

const wrapA = (a) => { while (a > Math.PI) a -= 2 * Math.PI; while (a < -Math.PI) a += 2 * Math.PI; return a; };

/**
 * A walk plan: alternating idle and walk segments that start and end at home, so the plan loops. pick(R, at) answers the next stop
 * { to: [x, z], act, idle: seconds, face: yaw | null }. Segments: { t0, t1, x0, z0, x1, z1, yaw0, yaw1, act, s0, s1 } (act 'walk' or
 * an idle act; s the walked distance so far, for followers).
 */
export function plan(R, n, home, { speed, r, loop = 150, pick }) {
  const segs = [];
  let t = 0, at = home, yaw = R() * Math.PI * 2 - Math.PI, s = 0;
  const idle = (dur, act, face) => {
    const y1 = face == null ? yaw : face;
    segs.push({ t0: t, t1: t + dur, x0: at[0], z0: at[1], x1: at[0], z1: at[1], yaw0: yaw, yaw1: y1, act, s0: s, s1: s });
    t += dur; yaw = y1;
  };
  const walk = (to) => {
    const p = n.path(at, to, r);
    if (!p) return false;
    for (let i = 1; i < p.length; i++) {
      const [x0, z0] = p[i - 1], [x1, z1] = p[i], d = Math.hypot(x1 - x0, z1 - z0);
      if (d < 1e-6) continue;
      const y1 = Math.atan2(x1 - x0, z1 - z0), dur = d / speed;
      segs.push({ t0: t, t1: t + dur, x0, z0, x1, z1, yaw0: yaw, yaw1: y1, act: 'walk', s0: s, s1: s + d });
      t += dur; s += d; yaw = y1;
    }
    at = to;
    return true;
  };
  const yawStart = yaw;
  for (let guard = 0; t < loop && guard < 400; guard++) {
    const stop = pick(R, at);
    if (stop.idle) idle(stop.idle, stop.act, stop.face);
    if (stop.to) walk(stop.to);
  }
  walk(home);
  idle(1.5 + R() * 2, 'look', yawStart);
  return { segs, L: t, S: s, walks: segs.filter((g) => g.act === 'walk') };
}

/** The index of the segment at loop time tt (0 <= tt < L), by binary search (no allocation, it runs every frame). */
export function segAt(P, tt) {
  const S = P.segs;
  let lo = 0, hi = S.length - 1;
  while (lo < hi) { const m = (lo + hi + 1) >> 1; if (S[m].t0 <= tt) lo = m; else hi = m - 1; }
  return lo;
}

/** The index in P.walks of the walk segment holding walked distance ss (0 <= ss < S). */
export function segAtS(P, ss) {
  const S = P.walks;
  let lo = 0, hi = S.length - 1;
  while (lo < hi) { const m = (lo + hi + 1) >> 1; if (S[m].s0 <= ss) lo = m; else hi = m - 1; }
  return lo;
}

export { wrapA };
