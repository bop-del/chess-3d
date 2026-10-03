// The start sequence: a sculpted king turns alone under gold rim light in the dark, then the board builds itself around it on
// the real renderer and canvas (squares drop in as a diagonal wave, the frame settles, the other 31 pieces rise) while the camera
// pulls back to the real start view. There is no handover: the last frame of the sequence is the game.
//
// main.js feeds it the real loading progress (setTarget, 0 to 1) and the objects as they exist (attachBoard, attachGame). The
// shown progress follows the target at a fixed speed (a build never plays faster than MIN_BUILD seconds) and, once loading is done
// (finish), catches up within BUDGET seconds. Every visual is a pure function of the shown progress p, except the king's spin and
// the camera low pass, which run on the clock.
//   p 0 to 0.12   the king lights up (gold rims, dim lifts)        needs: the stage and a king
//   p 0.12 to 0.30  the king alone, turning (textures are made)
//   p 0.30 to 0.70  squares drop in a1 to h8                       needs: the board (and the theme)
//   p 0.62 to 0.80  frame, inlays, labels settle
//   p 0.72 to 0.96  the other pieces rise, the king hands over     needs: the game
//   p 0.30 to 1     the camera pulls back from the king to the real start view (read from controls every frame)
import * as THREE from 'three';
import { dropT, easeOutBackT, DROP_SPAN } from './board.js';

const MIN_BUILD = 1.2;     // seconds from 0 to 1 at the fastest
const BUDGET = 0.45;       // seconds the sequence may take after loading is done
const clamp = (x, a = 0, b = 1) => Math.min(b, Math.max(a, x));
const seg = (p, a, b) => clamp((p - a) / (b - a));
const sstep = (a, b, x) => { const t = seg(x, a, b); return t * t * (3 - 2 * t); };
const easeOutCubic = (t) => 1 - Math.pow(1 - clamp(t), 3);
const easeOutBack = (t, s = 1.2) => { t = clamp(t); return 1 + (s + 1) * Math.pow(t - 1, 3) + s * Math.pow(t - 1, 2); };
const inOut = (t) => { t = clamp(t); return t < 0.5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2; };
const TAU = Math.PI * 2;

const G_BOARD = 0.299, G_GAME = 0.715;   // without the board or the game the shown progress waits here
const HIDDEN = 0.001;                    // a hidden mesh is scaled to this, not switched off, so its shader compiles up front

export function createIntro({ stage, gimbal, pieceSet, phone = false, darkEl = null, onLive = () => {}, now = () => performance.now() / 1000 }) {
  const scene = stage.scene;

  // ---- gold glints: one instanced soft quad per square (64) and per rising piece (31). Built first: nothing is added to the scene
  // until everything that can fail has been made, so a throw leaves the game untouched
  const blob = (() => {
    const c = document.createElement('canvas'); c.width = c.height = 64;
    const g = c.getContext('2d'), r = g.createRadialGradient(32, 32, 0, 32, 32, 32);
    r.addColorStop(0, 'rgba(255,255,255,1)'); r.addColorStop(0.35, 'rgba(255,255,255,0.45)'); r.addColorStop(1, 'rgba(255,255,255,0)');
    g.fillStyle = r; g.fillRect(0, 0, 64, 64);
    const t = new THREE.CanvasTexture(c); t.colorSpace = THREE.SRGBColorSpace; return t;
  })();
  const glintGeo = new THREE.PlaneGeometry(1, 1); glintGeo.rotateX(-Math.PI / 2);
  const glintMat = new THREE.MeshBasicMaterial({ map: blob, color: '#ffd27a', transparent: true, blending: THREE.AdditiveBlending, depthWrite: false, toneMapped: false });
  const N_SQ = 64, N_PC = 31;
  const glints = new THREE.InstancedMesh(glintGeo, glintMat, N_SQ + N_PC);
  glints.frustumCulled = false; glints.renderOrder = 5; glints.position.y = 0.012;
  glints.setColorAt(0, new THREE.Color(0, 0, 0));

  // ---- the hero: the white king on e1 (its own copy: the game's king takes over at p 0.72)
  const KX = 0.5, KZ = 3.5;
  const hero = pieceSet.make('k', 'w');
  hero.position.set(KX, 0, KZ);
  const heroInner = hero.children[0];

  // ---- two gold rim lights from behind each flank (the stage's own lights are dimmed while the sequence runs)
  const rimL = new THREE.DirectionalLight('#ffc25e', 0); rimL.position.set(-10, 1.3, -4);
  const rimR = new THREE.DirectionalLight('#ffb040', 0); rimR.position.set(10, 1.1, -4);

  const root = new THREE.Group();   // everything the sequence adds lives here (glints) so dispose is one remove
  root.name = 'intro';
  root.add(glints);
  gimbal.add(root, hero);
  scene.add(rimL, rimR);
  const m4 = new THREE.Matrix4(), col = new THREE.Color(), zero = new THREE.Matrix4().makeScale(0, 0, 0);
  const sqk = [];   // per square: x, z, k (0 at a1 to 1 at h8)
  for (let r = 0; r < 8; r++) for (let f = 0; f < 8; f++) sqk.push({ x: f - 3.5, z: 3.5 - r, k: (f + r) / 14 });

  // ---- state
  let board = null, game = null, boardReady = false;
  let pieces = [], trays = [], frameParts = [], goldInlay = null;
  let target = 0, shown = 0, doneAt = 0, finishing = false, ended = false, disposed = false, onEnd = null;
  let clock = 0;
  let first = true, cap = 1;
  const camEnd = new THREE.Vector3(), lookEnd = new THREE.Vector3(), fwd = new THREE.Vector3();
  let haveEnd = false;
  const CLOSE = { dist: phone ? 5.6 : 4.4, pitch: 0.2, yaw: -0.42, ty: 0.98 };

  function attachBoard(b) {
    board = b;
    const byName = (n) => b.group.getObjectByName(n);
    frameParts = ['frame', 'maple-inlay', 'plinth', 'felt', 'labels-w', 'labels-b'].map(byName).filter(Boolean);
    goldInlay = byName('gold-inlay');
    for (const m of frameParts) m.userData.introBase = { y: m.position.y };
    b.setDrop(0);
    if (goldInlay) goldInlay.scale.setScalar(HIDDEN);
  }

  /** the board is dressed (theme on): the squares may start to drop */
  function boardGo() { boardReady = true; }

  function attachGame(g) {
    game = g;
    const kingSq = 4;   // e1
    pieces = []; trays = [];
    for (const o of g.root.children) {
      if (!o.userData.piece) { trays.push({ o, y: o.position.y, sy: o.scale.y }); continue; }
      const sq = Math.round(3.5 - o.position.z) * 8 + Math.round(o.position.x + 3.5);
      pieces.push({ o, sq, y: o.position.y, king: sq === kingSq && o.userData.piece.type === 'k' && o.userData.piece.color === 'w' });
    }
    // order of the rise: White's rows first (the player's side), then Black's
    const key = (p) => (p.sq >> 3 < 2 ? (p.sq >> 3) * 8 + (p.sq & 7) : 16 + ((p.sq >> 3) - 6) * 8 + (p.sq & 7));
    pieces.sort((a, b) => key(a) - key(b));
    let i = 0;
    const n = Math.max(2, pieces.filter((p) => !p.king).length);
    for (const p of pieces) { p.order = p.king ? -1 : i++ / (n - 1); p.o.scale.setScalar(HIDDEN); }
    for (const t of trays) t.o.scale.setScalar(HIDDEN);
    const k = pieces.find((p) => p.king);   // a custom position may have no white king on e1: then the hero just leaves
    if (k) { k.o.scale.setScalar(1); k.o.visible = false; }
  }

  // ---- the driver
  function setTarget(p) { target = Math.max(target, Math.min(1, p)); }
  function finish(cb) {
    finishing = true; doneAt = now(); target = 1; onEnd = cb;
  }

  const limit = () => Math.min(cap, boardReady ? 1 : G_BOARD, game ? 1 : G_GAME);

  function readEnd(dt) {
    // the pose the controls hold right now is the pose the sequence ends in (it moves a little when the HUD is measured), low passed
    const cam = stage.camera;
    if (!cam.isPerspectiveCamera) { haveEnd = false; return; }
    cam.getWorldDirection(fwd);
    const t = (0.15 - cam.position.y) / (fwd.y || -1e-6);
    const px = cam.position.x + fwd.x * t, py = 0.15, pz = cam.position.z + fwd.z * t;
    const k = haveEnd ? Math.max(1 - Math.exp(-dt * 7), sstep(0.9, 1, shown)) : 1;   // exact by the end
    camEnd.lerp(cam.position, k);
    lookEnd.x += (px - lookEnd.x) * k; lookEnd.y += (py - lookEnd.y) * k; lookEnd.z += (pz - lookEnd.z) * k;
    haveEnd = true;
  }

  /** Advance by dt seconds of the clock and draw the state. Call once per frame, after controls.update and before render. */
  function update(dt) {
    if (disposed || ended) return;
    clock += dt;
    readEnd(dt);
    // shown follows target at the base speed; after loading is done it must be at 1 within BUDGET of the wall clock
    const lim = limit(), goal = Math.min(target, lim);
    if (shown < goal) {
      let rate = 1 / MIN_BUILD;
      if (finishing) {
        const left = Math.max(0.02, BUDGET - (now() - doneAt) - dt);   // dt: this frame's length, so a slow frame does not overshoot
        rate = Math.max(rate, (1 - shown) / left);
      }
      shown = Math.min(goal, shown + rate * dt);
    }
    draw(shown);
    if (first) { first = false; onLive(); }
    if (finishing && shown >= 1 && lim >= 1) { ended = true; restore(); onEnd?.(); }
  }

  function draw(p) {
    // king: light up and spin. The spin runs on the clock and eases to rest at a whole turn between p 0.55 and 0.72.
    const kd = sstep(0, 0.14, p);
    const free = -clock * 1.15;                              // radians, turning one way
    const w = sstep(0.55, 0.72, p);
    const frac = ((free % TAU) + TAU) % TAU;                 // 0 to TAU: free - w * frac is a whole turn at w = 1, and the spin slows to rest
    heroInner.rotation.y = w >= 1 ? 0 : free - w * frac;
    hero.visible = p < 0.72;
    // lights: the stage dims to a low glow, two gold rims do the work, both settle to the real look
    stage.setDim(0.14 + 0.86 * sstep(0.12, 0.8, p));
    const gold = kd * (1 - sstep(0.62, 0.98, p));
    rimL.intensity = 22 * gold; rimR.intensity = 17 * gold;
    if (darkEl) darkEl.style.opacity = String(0.9 * (1 - sstep(0.1, 0.95, p)));

    // squares
    const drop = seg(p, 0.30, 0.70);
    if (board) {
      board.setDrop(drop >= 1 ? 1 : drop);
      if (goldInlay) goldInlay.scale.setScalar(drop > 0.82 ? 1 : HIDDEN);
      const fe = easeOutCubic(seg(p, 0.62, 0.80));
      for (const m of frameParts) {
        if (fe <= 0) { m.scale.setScalar(HIDDEN); m.position.y = m.userData.introBase.y; continue; }
        m.scale.set(1 + (1 - fe) * 0.22, 1, 1 + (1 - fe) * 0.22);
        m.position.y = m.userData.introBase.y + (1 - fe) * 0.9;
      }
    }
    // glints
    let gi = 0, pj = N_SQ;
    for (const s of sqk) {
      const t = dropT(drop, s.k);
      const land = clamp((t - 0.7) / 0.3), a = t > 0.7 && t < 1 ? 0.6 * Math.sin(Math.PI * land) : 0;
      if (a <= 0.01) glints.setMatrixAt(gi, zero);
      else { m4.makeScale(1.5, 1, 1.5).setPosition(s.x, 0, s.z); glints.setMatrixAt(gi, m4); glints.setColorAt(gi, col.setRGB(a, a * 0.85, a * 0.5)); }
      gi++;
    }
    // pieces
    if (game) {
      for (const pc of pieces) {
        if (pc.king) { pc.o.visible = p >= 0.72; continue; }
        const t = (p - (0.72 + pc.order * 0.14)) / 0.10;
        const e = t <= 0 ? 0 : easeOutBack(t);
        pc.o.scale.setScalar(Math.max(HIDDEN, e));
        pc.o.position.y = pc.y + (1 - clamp(e)) * -0.3;
        const land = clamp((t - 0.3) / 0.7), a = t > 0.3 && t < 1 ? 0.5 * Math.sin(Math.PI * land) : 0;
        if (a <= 0.01) glints.setMatrixAt(pj, zero);
        else { const q = 0.9 + land * 0.9; m4.makeScale(q, 1, q).setPosition(pc.o.position.x, 0, pc.o.position.z); glints.setMatrixAt(pj, m4); glints.setColorAt(pj, col.setRGB(a, a * 0.85, a * 0.5)); }
        pj++;
      }
      const te = easeOutCubic(seg(p, 0.80, 0.94));
      for (const t of trays) {
        t.o.scale.setScalar(te <= 0 ? HIDDEN : Math.max(HIDDEN, easeOutBack(seg(p, 0.80, 0.94), 1.0)));
        t.o.position.y = t.y + (1 - te) * 0.9;
      }
    }
    for (; pj < N_SQ + N_PC; pj++) glints.setMatrixAt(pj, zero);
    glints.instanceMatrix.needsUpdate = true;
    if (glints.instanceColor) glints.instanceColor.needsUpdate = true;

    // camera: close on the king, then pull back and up to where the controls hold it
    if (haveEnd) {
      const c = inOut(seg(p, 0.30, 1.0));
      const v = new THREE.Vector3().subVectors(camEnd, lookEnd);
      const d1 = v.length(), pitch1 = Math.asin(v.y / d1), yaw1 = Math.atan2(v.x, v.z);
      const dist = CLOSE.dist + (d1 - CLOSE.dist) * c;
      const pitch = CLOSE.pitch + (pitch1 - CLOSE.pitch) * c;
      const yaw = CLOSE.yaw * (1 - c) + yaw1 * c;
      const tx = KX * (1 - c) + lookEnd.x * c, ty = CLOSE.ty * (1 - c) + lookEnd.y * c, tz = KZ * (1 - c) + lookEnd.z * c;
      const cam = stage.camera;
      cam.position.set(tx + dist * Math.cos(pitch) * Math.sin(yaw), ty + dist * Math.sin(pitch), tz + dist * Math.cos(pitch) * Math.cos(yaw));
      cam.lookAt(tx, ty, tz);
    }
  }

  /** Put every object back as the game made it. Idempotent. */
  function restore() {
    if (disposed) return;
    disposed = true;
    stage.setDim(1);
    scene.remove(rimL, rimR);
    gimbal.remove(hero, root);
    if (board) {
      board.setDrop(1);
      for (const m of frameParts) { m.scale.setScalar(1); m.position.y = m.userData.introBase.y; }
      if (goldInlay) goldInlay.scale.setScalar(1);
    }
    for (const pc of pieces) { pc.o.visible = true; pc.o.scale.setScalar(1); pc.o.position.y = pc.y; }
    for (const t of trays) { t.o.scale.setScalar(1); t.o.position.y = t.y; }
    if (darkEl) darkEl.style.opacity = '0';
    glintGeo.dispose(); glintMat.dispose(); blob.dispose(); glints.dispose();
  }

  return {
    attachBoard, boardGo, attachGame, setTarget, finish, update, dispose: restore,
    get shown() { return shown; },
    get target() { return target; },
    get ended() { return ended; },
    get hero() { return hero; },
    /** test hook: cap the shown progress (emulates a slow load in a deterministic clip) */
    setCap(c) { cap = c; },
  };
}
