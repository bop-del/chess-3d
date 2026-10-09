// Checkmate finale for the lit themes (CHE-369, with the Wild Scene pick): the mated king trembles, the game topples it, and as it
// hits the board it cracks: glowing cracks run over its body and cool to dark lines, the cross on its crown chips off, a gold
// flare and a ring of light roll out, time slows and the camera pushes in. The camera picks a side from which no other piece
// hides the fall. The game over banner waits until the finale is done. A tap or a key skips it. The cracks stay on the fallen
// king (dark) until the next game, an undo or a new position. Off and the easy views play no finale; Short runs it three
// times faster.
import * as THREE from 'three';
import { createFx, noAO } from '../../fx.js';
import { createLit } from '../../fx-lit.js';

const AFTER = 1.8;               // seconds of finale time after the hit
const TOPPLE_HIT = 2.2;          // real seconds: the latest hit if the king's tilt is never seen (0.7 s delay, 1.0 s fall)
const COOL = 1.5;                // seconds the cracks glow before they are dark
const GOLD = '#ffd27a';
const DEG = Math.PI / 180;
const rand = (a, b) => a + Math.random() * (b - a);
const wrap = (a) => Math.atan2(Math.sin(a), Math.cos(a));

// ---------------------------------------------------------------- cracks
// crackSet(group, opts): jagged cracks over the surface of a piece, in the group's own space, walked from vertex to nearby
// vertex. Returns { obj, core, glow, steps }: core is the crack itself, glow a wider additive halo. Both draw in order of
// the walk, so a drawRange reveals them as if they run. `side` (+1 or -1) favours starts on that local z side.
function crackSet(group, { lines = 9, steps = 12, width = 0.06, side = 0, low = false } = {}) {
  group.updateWorldMatrix(true, true);
  const inv = new THREE.Matrix4().copy(group.matrixWorld).invert();
  const pts = [];
  const v = new THREE.Vector3();
  group.traverse((o) => {
    if (!o.isMesh || !o.visible || o.userData?.hit || !o.geometry?.attributes?.position) return;
    const m = new THREE.Matrix4().multiplyMatrices(inv, o.matrixWorld);
    const pos = o.geometry.attributes.position;
    const step = Math.max(1, Math.floor(pos.count / 1400));
    for (let i = 0; i < pos.count; i += step) { v.fromBufferAttribute(pos, i).applyMatrix4(m); pts.push(v.clone()); }
  });
  if (!pts.length) return null;
  const h = pts.reduce((a, p) => Math.max(a, p.y), 0) || 1;
  const nearest = (want, not) => {
    let best = null, bd = Infinity;
    for (const p of pts) { const d = p.distanceToSquared(want); if (d < bd && p !== not) { bd = d; best = p; } }
    return best;
  };
  // one walk: down and around the body
  const walk = (from, n, ang, drop) => {
    const path = [from];
    let cur = from;
    for (let s = 0; s < n; s++) {
      ang += rand(-0.45, 0.45);
      const r = Math.hypot(cur.x, cur.z) || 0.2;
      const want = new THREE.Vector3(cur.x + Math.cos(ang) * 0.07, cur.y - rand(drop * 0.5, drop), cur.z + Math.sin(ang) * 0.07);
      want.x *= r / (Math.hypot(want.x, want.z) || r); want.z *= r / (Math.hypot(want.x, want.z) || r);
      const best = nearest(want, cur);
      if (!best || best.y > cur.y + 0.02) break;
      cur = best; path.push(cur);
    }
    return path;
  };
  const segs = [];               // [a, b, widthA, widthB, order]
  const addPath = (path, w0, o0) => {
    for (let i = 0; i + 1 < path.length; i++) {
      const k0 = 1 - i / path.length, k1 = 1 - (i + 1) / path.length;
      segs.push([path[i], path[i + 1], w0 * (0.35 + 0.65 * k0), w0 * (0.35 + 0.65 * k1), o0 + i]);
    }
  };
  const nLines = low ? Math.min(5, lines) : lines;
  const band = pts.filter((p) => p.y > h * 0.3 && p.y < h * 0.92);
  const facing = side ? band.filter((p) => p.z * side > Math.hypot(p.x, p.z) * 0.25) : band;
  for (let l = 0; l < nLines; l++) {
    const from = l < nLines * 0.75 && facing.length ? facing : band.length ? band : pts;
    const start = from[Math.floor(Math.random() * from.length)];
    const path = walk(start, steps, Math.atan2(start.z, start.x) + Math.PI / 2 * (Math.random() < 0.5 ? 1 : -1), 0.13);
    addPath(path, width, 0);
    // a branch or two off the main line
    for (let b = 0; b < 1 && path.length > 4; b++) {
      const at = 1 + Math.floor(Math.random() * (path.length - 3));
      const br = walk(path[at], Math.ceil(steps * 0.4), Math.atan2(path[at].z, path[at].x) + rand(-1.6, 1.6), 0.08);
      addPath(br, width * 0.6, at);
    }
  }
  segs.sort((a, b) => a[4] - b[4]);
  // a ribbon per segment, lifted off the surface (outward from the axis)
  const ribbon = (scale, lift) => {
    const out = [];
    const order = [];
    const steps = [];
    for (const [a, b, wa, wb, o] of segs) {
      const outA = new THREE.Vector3(a.x, 0, a.z), outB = new THREE.Vector3(b.x, 0, b.z);
      if (outA.lengthSq() < 1e-6) outA.set(0, 0, 1); if (outB.lengthSq() < 1e-6) outB.set(0, 0, 1);
      outA.normalize(); outB.normalize();
      const seg = new THREE.Vector3().subVectors(b, a);
      const sA = new THREE.Vector3().crossVectors(seg, outA).normalize().multiplyScalar(wa * scale * 0.5 + 0.004);
      const sB = new THREE.Vector3().crossVectors(seg, outB).normalize().multiplyScalar(wb * scale * 0.5 + 0.003);
      const A = a.clone().addScaledVector(outA, lift), B = b.clone().addScaledVector(outB, lift);
      const q = [A.clone().add(sA), A.clone().sub(sA), B.clone().sub(sB), B.clone().add(sB)];
      out.push(...q[0].toArray(), ...q[1].toArray(), ...q[2].toArray(), ...q[0].toArray(), ...q[2].toArray(), ...q[3].toArray());
      order.push(o);
      for (let k = 0; k < 6; k++) steps.push(o);
    }
    const geo = new THREE.BufferGeometry();
    geo.setAttribute('position', new THREE.Float32BufferAttribute(out, 3));
    geo.setAttribute('aStep', new THREE.Float32BufferAttribute(steps, 1));
    return { geo, order };
  };
  const c = ribbon(1, 0.014), g = ribbon(2.4, 0.02);
  const core = new THREE.Mesh(c.geo, new THREE.MeshBasicMaterial({ color: '#fff6dc', side: THREE.DoubleSide, toneMapped: false, polygonOffset: true, polygonOffsetFactor: -2, polygonOffsetUnits: -2 }));
  const glow = new THREE.Mesh(g.geo, new THREE.MeshBasicMaterial({ color: GOLD, side: THREE.DoubleSide, toneMapped: false, transparent: true, opacity: 0.7, blending: THREE.AdditiveBlending, depthWrite: false, polygonOffset: true, polygonOffsetFactor: -3, polygonOffsetUnits: -3 }));
  core.frustumCulled = glow.frustumCulled = false;
  core.renderOrder = 2; glow.renderOrder = 3;
  const obj = new THREE.Group();
  obj.add(core, glow);
  noAO(glow);                    // additive: keep it out of the AO pass (noAO uses the glow's draw range)
  const maxOrder = c.order.reduce((a, o) => Math.max(a, o), 0);
  // the reveal is a uniform, not a draw range: fragments past walk step uLim are dropped
  const uLim = { value: maxOrder + 1 };
  for (const m of [core, glow]) {
    m.material.onBeforeCompile = (sh) => {
      sh.uniforms.uLim = uLim;
      sh.vertexShader = 'attribute float aStep;\nvarying float vStep;\n' + sh.vertexShader.replace('#include <begin_vertex>', '#include <begin_vertex>\nvStep = aStep;');
      sh.fragmentShader = 'uniform float uLim;\nvarying float vStep;\n' + sh.fragmentShader.replace('void main() {', 'void main() {\nif (vStep > uLim) discard;');
    };
    m.material.customProgramCacheKey = () => 'finale-crack';
  }
  // reveal(u): shows the cracks up to walk step u * maxOrder
  const reveal = (u) => { uLim.value = u * (maxOrder + 1) - 0.001; };
  const dispose = () => { obj.removeFromParent(); for (const m of [core, glow]) { m.geometry.dispose(); m.material.dispose(); } };
  return { obj, core, glow, reveal, dispose };
}

// ---------------------------------------------------------------- camera
// Picks the cinematic yaw for a look at the mated king: 16 yaws around the target, every other piece near the line from the
// camera to the king (standing and fallen) costs, a side on view of the fall (it runs along x) is preferred, then the yaw
// nearest the current one. Yaws are in world space; the board (game.root) may be turned by the gimbal.
function pickYaw({ controls, game, K, target, fallX, pitch, dist }) {
  const g = controls.gimbalDeg;
  const gq = new THREE.Quaternion().setFromEuler(new THREE.Euler(g.x * DEG, g.y * DEG, g.z * DEG, 'YXZ'));
  const gi = gq.clone().invert();
  const h = K.userData.height || 1.8;
  const looks = [
    new THREE.Vector3(K.position.x, h * 0.85, K.position.z),
    new THREE.Vector3(K.position.x + fallX * h * 0.5, 0.35, K.position.z),
    new THREE.Vector3(K.position.x + fallX * h * 0.95, 0.3, K.position.z),
  ];
  const others = [];
  for (const c of game.root.children) {
    if (c === K || !c.visible || !c.children.some((x) => x.userData?.hit)) continue;
    const ph = c.userData.height || 1;
    for (const k of [0.2, 0.55, 0.9]) others.push(new THREE.Vector3(c.position.x, ph * k, c.position.z));
  }
  const cur = controls.camera.yaw;
  const seg = new THREE.Line3(), q = new THREE.Vector3();
  let best = cur, bestCost = Infinity;
  for (let i = 0; i < 16; i++) {
    const yaw = cur + (i / 16) * Math.PI * 2;
    const dir = new THREE.Vector3(Math.sin(yaw) * Math.cos(pitch), Math.sin(pitch), Math.cos(yaw) * Math.cos(pitch)).applyQuaternion(gi);
    const cam = target.clone().addScaledVector(dir, dist);
    let cost = 0;
    for (const L of looks) {
      seg.set(cam, L);
      for (const p of others) {
        seg.closestPointToPoint(p, true, q);
        const d = q.distanceTo(p);
        if (d < 0.5) cost += (0.5 - d) * 12;
      }
    }
    // side on: the camera along z in board space; a camera below the board top (a tilted board) is useless
    const flat = Math.hypot(dir.x, dir.z) || 1;
    cost += 2.5 * Math.abs(dir.x) / flat;
    if (cam.y < 0.3) cost += 20;
    cost += 0.4 * Math.abs(wrap(yaw - cur)) / Math.PI;
    if (cost < bestCost) { bestCost = cost; best = yaw; }
  }
  const dir = new THREE.Vector3(Math.sin(best) * Math.cos(pitch), Math.sin(pitch), Math.cos(best) * Math.cos(pitch)).applyQuaternion(gi);
  return { yaw: cur + wrap(best - cur), side: Math.sign(dir.z) || 1 };
}

export function createFinale({ game, controls, stage, themes, allowed = () => true, short = () => false, busy = () => false }) {
  let run = null;
  let pending = false;           // mate came with a capture: start once the capture scene is over
  let cracks = null;             // { set, king } that outlive the finale
  const style = document.createElement('style');
  style.textContent = 'body.lit-finale #banner { visibility: hidden; }';
  document.head.append(style);

  const dropCracks = () => {
    if (!cracks) return;
    cracks.set.dispose();
    cracks = null;
  };
  const kingGroup = (color) => {
    const sq = game.chess.kingSquare(color);
    for (const g of game.root.children) {
      const o = g.children.find((c) => c.userData?.hit)?.userData.pieceObj;
      if (o && o.type === 'k' && o.color === color && o.sq === sq) return o.group;
    }
    return null;
  };
  const darkOf = (kind) => (kind === 'glass' ? '#ffffff' : '#140c06');

  function start() {
    const st = game.getState();
    const theme = themes?.current?.();
    if (!st.over || st.over.reason !== 'checkmate' || !allowed() || game.mode !== 'play' || theme === 'pixel' || theme === 'blocks') return;
    const loser = st.turn;
    const K = kingGroup(loser);
    if (!K) return;
    stop();
    dropCracks();
    const ac = new AbortController();
    const fx = createFx({ stage, parent: game.root, signal: ac.signal });
    const r = run = { t: 0, real: 0, tHit: 0, speed: short() ? 3 : 1, slow: 1, ac, fx, K, loser, tweens: [], frames: new Set(), done: false, hit: false };
    const ctx = {
      fx, stage, theme, quality: stage.quality, signal: ac.signal, ease: { out: (u) => 1 - Math.pow(1 - u, 3), inOut: (u) => (u < 0.5 ? 4 * u * u * u : 1 - Math.pow(-2 * u + 2, 3) / 2) },
      tween: ({ dur, step }) => new Promise((resolve) => { r.tweens.push({ t: 0, dur: Math.max(1e-4, dur), step, resolve }); }),
      slow: (k) => { r.slow = Math.max(0.05, Math.min(1, k)); },
      onFrame: (fn) => { r.frames.add(fn); return () => r.frames.delete(fn); },
    };
    r.L = createLit(ctx);
    document.body.classList.add('lit-finale');
    const onSkip = (e) => {
      if (e.type === 'keydown' && ['Shift', 'Control', 'Alt', 'Meta'].includes(e.key)) return;
      e.preventDefault(); e.stopImmediatePropagation();
      stop();
    };
    window.addEventListener('pointerdown', onSkip, true);
    window.addEventListener('keydown', onSkip, true);
    r.unhook = () => { window.removeEventListener('pointerdown', onSkip, true); window.removeEventListener('keydown', onSkip, true); };
    // the camera: low and close, looking across the fall (the game tips a white king to -x, a black one to +x), from the
    // side where no other piece is in the way
    r.fallX = loser === 'w' ? -1 : 1;
    const target = new THREE.Vector3(K.position.x + r.fallX * 0.85, 0.45, K.position.z);
    const pitch = 16 * DEG, dist = 5.2;
    const pick = pickYaw({ controls, game, K, target, fallX: r.fallX, pitch, dist });
    r.cam = { target, yaw: pick.yaw, pitch, dist };
    r.side = pick.side;
    controls.cinematic({ target, yaw: pick.yaw, pitch, dist, dur: 0.6 / r.speed });
    // the king trembles before it falls (its inner group, so the game's topple on the outer group is left alone)
    const inner = K.children[0] || null;
    if (inner) { fx.track(inner); r.shake = inner; r.shake0 = inner.position.clone(); }
  }

  // the moment the king hits the board
  function crack(r) {
    const { K, L, fx } = r;
    if (r.shake) r.shake.position.copy(r.shake0);
    r.shake = null;
    const h = K.userData.height || 1.8;
    K.updateMatrix();
    // where the king's middle and crown lie now, in the pieces' space
    const mid = new THREE.Vector3(0, h * 0.55, 0).applyMatrix4(K.matrix);
    const crown = new THREE.Vector3(0, h * 0.95, 0).applyMatrix4(K.matrix);
    const ground = new THREE.Vector3(mid.x, 0.05, mid.z);
    const glass = L.kind === 'glass';
    const set = crackSet(K, { lines: 6, steps: 16, width: 0.05, side: r.side || 0, low: L.low });
    if (set) {
      K.add(set.obj);
      cracks = { set, king: K };
      if (glass) set.glow.material.color.set('#e8f6ff');
      set.reveal(0);
      const hot = new THREE.Color(glass ? '#ffffff' : '#fff6dc'), warm = new THREE.Color(glass ? '#ffffff' : '#ff9a3c'), cold = new THREE.Color(darkOf(L.kind));
      r.set = set;
      // the cracks run over the body, glow, then cool: white, orange, dark (glass stays white, its glow fades)
      ctxTween(r, 0.35, (u) => set.reveal(u));
      ctxTween(r, COOL, (u) => {
        const c = set.core.material.color;
        if (u < 0.3) c.copy(hot).lerp(warm, u / 0.3); else c.copy(warm).lerp(cold, Math.min(1, (u - 0.3) / 0.45));
        set.glow.material.opacity = 0.75 * (1 - u) * (1 - u);
      });
    }
    L.flare(crown, { size: 2.4, dur: 0.55, color: GOLD });
    L.sparks(mid);
    L.glints(crown, { colors: ['#ffffff', GOLD, '#fff0b8'] });
    // the ring stays inside the board frame (about 4.4 from the centre): smaller near an edge, none right at it
    const ringR = Math.min(1.7, 4.4 - Math.max(Math.abs(ground.x), Math.abs(ground.z)));
    if (ringR >= 0.6) L.ring(ground, { radius: ringR, dur: 0.75, color: GOLD });
    // chips of the king's own material: most from the cross and crown, a few from the body
    const pts = fx.samplePoints(K, 300);
    const inv = K.matrix.clone().invert();
    const top = [], body = [];
    const lp = new THREE.Vector3();
    for (let j = 0; j < pts.refs.length; j++) {
      if (pts.refs[j].userData?.hit || pts.refs[j].parent === set?.obj) continue;
      lp.set(pts.pts[j * 3], pts.pts[j * 3 + 1], pts.pts[j * 3 + 2]).applyMatrix4(inv);
      (lp.y > h * 0.8 ? top : body).push(j);
    }
    const geo = fx.own(new THREE.IcosahedronGeometry(0.5, 0));
    const chip = (j, big, up) => {
      const src = pts.refs[j].material;
      const m = new THREE.Mesh(geo, Array.isArray(src) ? src[0] : src);
      const s = big ? rand(0.06, 0.11) : rand(0.03, 0.07);
      m.scale.set(s, s * 0.7, s * 1.2);
      m.position.set(pts.pts[j * 3], Math.max(0.06, pts.pts[j * 3 + 1]), pts.pts[j * 3 + 2]);
      m.castShadow = !L.low;
      fx.add(m);
      const d = m.position.clone().sub(mid).setY(0);
      if (d.lengthSq() < 1e-4) d.set(rand(-1, 1), 0, rand(-1, 1));
      d.normalize().multiplyScalar(rand(0.8, 2.2));
      fx.body(m, { radius: s * 0.6, vel: d.add(new THREE.Vector3(0, rand(up * 0.6, up), 0)), ang: new THREE.Vector3(rand(-8, 8), rand(-8, 8), rand(-8, 8)), life: 1.7, bounce: 0.35 });
    };
    for (let i = 0; i < (top.length ? (L.low ? 5 : 10) : 0); i++) chip(top[Math.floor(Math.random() * top.length)], true, 3.4);
    for (let i = 0; i < (body.length ? (L.low ? 4 : 8) : 0); i++) chip(body[Math.floor(Math.random() * body.length)], false, 2.2);
    L.slowmo({ k: 0.3, hold: 0.55, release: 0.5 });
    L.punch({ k: 1.06, attack: 0.1, hold: 0.5, release: 0.8 });
    // a slow push in on the cracked king
    const c = r.cam;
    const aim = new THREE.Vector3(0, h * 0.72, 0).applyMatrix4(K.matrix);
    controls.cinematic({ target: new THREE.Vector3(aim.x, 0.35, aim.z), yaw: c.yaw, pitch: c.pitch + 3 * DEG, dist: c.dist * 0.86, dur: 1.6 / r.speed });
    // a soft rain of gold glitter over the fallen king, a beat later
    ctxTween(r, 0.45, (u) => {
      if (u < 1 || r.done) return;
      fx.burst(new THREE.Vector3(mid.x, h * 1.1, mid.z), { count: L.low ? 14 : 30, speed: [0.3, 1.2], spread: 3, size: [0.018, 0.035], life: [0.9, 1.3], gravity: -1.2, drag: 1.2, stain: false, glow: true, colors: ['#ffffff', GOLD, '#fff0b8', '#ffb347'] });
    });
  }
  const ctxTween = (r, dur, step) => r.tweens.push({ t: 0, dur, step: (e, u) => step(u), resolve: () => {} });

  function update(dt) {
    if (pending && !busy()) { pending = false; start(); }
    const r = run;
    if (!r || r.done) return;
    const d = dt * r.speed * r.slow;
    r.t += d; r.real += dt;
    if (r.shake && !r.hit) {
      // a tremble that builds up, and a small tilt towards the fall
      const k = Math.min(1, r.real / 0.7);
      r.shake.position.set(r.shake0.x + Math.sin(r.real * 70) * 0.024 * k, r.shake0.y + Math.abs(Math.sin(r.real * 41)) * 0.01 * k, r.shake0.z + Math.cos(r.real * 63) * 0.024 * k);
    }
    // the hit: when the game's topple (real time, 1.4 rad about z) lays the king on the board; a time limit as a fallback
    if (!r.hit && (Math.abs(r.K.rotation.z) >= 1.34 || r.real >= TOPPLE_HIT)) { r.hit = true; r.tHit = r.t; try { crack(r); } catch (e) { console.warn('finale crack failed', e); } }
    for (const a of [...r.tweens]) {
      a.t += d;
      const u = Math.min(1, a.t / a.dur);
      try { a.step(u, u); } catch (e) { console.warn('finale tween failed', e); }
      if (u >= 1) { r.tweens.splice(r.tweens.indexOf(a), 1); a.resolve(); }
    }
    for (const fn of [...r.frames]) { try { fn(d); } catch (e) { r.frames.delete(fn); } }
    r.fx.update(d);
    if (r.hit && r.t - r.tHit >= AFTER) stop();
  }

  function stop() {
    const r = run;
    if (!r || r.done) return;
    r.done = true;
    run = null;
    r.unhook?.();
    r.ac.abort();
    // a skip before the hit still leaves the king cracked
    if (!r.hit) { r.hit = true; try { crack(r); } catch (e) { /* the king may be gone */ } }
    if (cracks?.set) {
      const s = cracks.set;
      s.reveal(1);
      s.core.material.color.set(darkOf(r.L.kind));
      s.glow.visible = false;
    }
    r.fx.dispose();
    document.body.classList.remove('lit-finale');
    controls.restore({ dur: 0.5 });
  }

  game.on('move', () => { if (game.getState().over) { if (busy()) pending = true; else start(); } });
  for (const evt of ['newgame', 'undo']) game.on(evt, () => { pending = false; stop(); dropCracks(); });
  game.on('change', () => { if (cracks && (cracks.king.parent !== game.root || !game.getState().over)) dropCracks(); });

  return { update, stop, get active() { return !!run; }, get cracked() { return !!cracks; } };
}
