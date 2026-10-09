// Showcase camera (CHE-374): a film camera that runs on its own shot list instead of the orbit controls. Every shot is a
// function of its progress that returns a camera position and a look point in gimbal space (board units, y up, white at +z),
// so the camera follows the board when the gimbal turns and reads the board state live (a piece group's position).
// update(dt) writes the pose onto stage.camera after the controls have run; the controls keep their own state untouched,
// so stop() hands the view back exactly as it was. The battle director's close-up (controls.cinematic and restore) is taken
// over while the showcase runs: the camera glides from the current shot into the fight and back to the next shot.
import * as THREE from 'three';

const DEG = Math.PI / 180;
const clamp = (v, a, b) => Math.min(b, Math.max(a, v));
const lerp = (a, b, u) => a + (b - a) * u;
export const ease = {
  linear: (u) => u,
  inOut: (u) => (u < 0.5 ? 4 * u * u * u : 1 - Math.pow(-2 * u + 2, 3) / 2),
  out: (u) => 1 - Math.pow(1 - u, 3),
  sine: (u) => 0.5 - 0.5 * Math.cos(Math.PI * u),
};
const wrapPi = (a) => { const T = Math.PI * 2; a = (a + Math.PI) % T; if (a < 0) a += T; return a - Math.PI; };

/** Square name ('e4') or index to its centre in gimbal space. */
export function squarePos(sq, y = 0) {
  const i = typeof sq === 'string' ? (sq.charCodeAt(0) - 97) + (sq.charCodeAt(1) - 49) * 8 : sq;
  return new THREE.Vector3((i & 7) - 3.5, y, 3.5 - (i >> 3));
}

// ------------------------------------------------------------------ shots
// A shot is { name, dur, pose(u, t, out) } where u is the eased progress (0 to 1, held at 1 after dur) and t the seconds
// since the shot began; pose writes out.pos and out.look. `fit` widens a shot on narrow (portrait) screens: wide shots by
// the full factor, close ones by its square root.
const V = () => new THREE.Vector3();
const ORIGIN = new THREE.Vector3();
const orbitPos = (out, c, yaw, dist, h) => out.set(c.x + Math.sin(yaw) * dist, c.y + h, c.z + Math.cos(yaw) * dist);

export const SHOTS = {
  // the opening shot under the title card: a high orbit round the whole board, coming down
  establish({ dur = 5, yaw0 = 270 * DEG, yaw1 = 385 * DEG, fit }) {
    const c = new THREE.Vector3(0, 0.3, 0);
    return { name: 'establish', dur, pose(u, t, o) { orbitPos(o.pos, c, lerp(yaw0, yaw1, u), 15.5 * fit.wide, lerp(11.5, 5.4, u) * Math.sqrt(fit.wide)); o.look.set(0, lerp(-0.4, 0.5, u), 0); } };
  },
  // a high calm view from one side that drifts sideways (the quick opening moves)
  wide({ dur = 4, yaw = 0, drift = 14 * DEG, pitch = 48 * DEG, dist = 17, focus = null, fit }) {
    const c = focus ? focus.clone().multiplyScalar(0.35).setY(0.3) : new THREE.Vector3(0, 0.3, 0);
    return { name: 'wide', dur, pose(u, t, o) {
      const y = yaw + lerp(-drift, drift, u), d = dist * fit.wide;
      orbitPos(o.pos, c, y, d * Math.cos(pitch), d * Math.sin(pitch)); o.look.copy(c);
    } };
  },
  // the camera travels beside the moving piece, parallel to its path, at piece height, and keeps it in frame
  dolly({ dur = 2.4, from, to, subject, side = 1, fit }) {
    const a = squarePos(from), b = squarePos(to);
    const dir = b.clone().sub(a); if (dir.lengthSq() < 1e-6) dir.set(0, 0, -1);
    dir.normalize();
    const n = new THREE.Vector3(-dir.z, 0, dir.x).multiplyScalar(side);
    const d = 5.4 * fit.close, len = a.distanceTo(b);
    const start = a.clone().addScaledVector(dir, -0.8 - 0.15 * len), end = b.clone().addScaledVector(dir, 0.6);
    return { name: 'dolly', dur, track: subject, pose(u, t, o) {
      o.pos.lerpVectors(start, end, u).addScaledVector(n, d).setY(lerp(1.5, 2.3, u) * Math.sqrt(fit.close));
      o.look.lerpVectors(a, b, clamp(u * 1.15, 0, 1)).setY(0.55);
    } };
  },
  // from low beside the destination the camera rises up and back, the piece arriving below it
  crane({ dur = 2.6, at, from = null, fit }) {
    const c = squarePos(at, 0.45);
    const away = (from ? c.clone().sub(squarePos(from)).setY(0) : new THREE.Vector3(0, 0, 1));
    if (away.lengthSq() < 1e-6) away.set(0, 0, 1);
    away.normalize().applyAxisAngle(new THREE.Vector3(0, 1, 0), 35 * DEG);
    return { name: 'crane', dur, pose(u, t, o) {
      o.pos.copy(c).addScaledVector(away, lerp(3.2, 6.8, u) * fit.close).setY(lerp(1.45, 6.2, u) * Math.sqrt(fit.close));
      o.look.copy(c).setY(lerp(0.65, 0.2, u)).lerp(ORIGIN, 0.35 * u);   // the crane ends with the board, not the grass, in the middle
    } };
  },
  // behind the moving piece, looking where it goes (the attacker's view)
  over({ dur = 2.4, from, to, color = 'w', fit }) {
    const a = squarePos(from), b = squarePos(to);
    const fwd = b.clone().sub(a).setY(0);
    if (fwd.lengthSq() < 0.5) fwd.set(0, 0, color === 'w' ? -1 : 1);
    fwd.normalize();
    const side = new THREE.Vector3(-fwd.z, 0, fwd.x);
    return { name: 'over', dur, pose(u, t, o) {
      o.pos.copy(a).addScaledVector(fwd, lerp(-3.6, -3.0, u) * fit.close).addScaledVector(side, 0.9).setY(2.5 * Math.sqrt(fit.close));
      o.look.copy(b).addScaledVector(fwd, 1.2).setY(0.3);
    } };
  },
  // bird's eye, turning slowly over the action
  top({ dur = 3, at = null, yaw = 0, pitch = 78 * DEG, fit }) {
    const c = at ? squarePos(at).multiplyScalar(0.5) : new THREE.Vector3();
    return { name: 'top', dur, pose(u, t, o) {
      const y = yaw + 28 * DEG * u, d = lerp(13.5, 12, u) * fit.wide;
      orbitPos(o.pos, c, y, d * Math.cos(pitch), d * Math.sin(pitch)); o.look.copy(c);
    } };
  },
  // the hero shot of a big moment: a low arc round the destination square
  hero({ dur = 3.2, at, yaw = 0, sweep = 70 * DEG, fit }) {
    const c = squarePos(at, 0.55);
    return { name: 'hero', dur, pose(u, t, o) {
      orbitPos(o.pos, c, yaw + sweep * (u - 0.5), lerp(4.9, 4.4, u) * fit.close, lerp(3.2, 2.7, u) * Math.sqrt(fit.close));
      o.look.copy(c).setY(0.35);
    } };
  },
  // a big check or the mate: from outside the board, looking in, the attacker and the king both in the upper middle of the
  // frame with the board behind them (never out into the landscape), pushing in slowly
  matepush({ at, from, dur = 3.4, fit }) {
    const k = squarePos(at), a = squarePos(from || at);
    const c = k.clone().add(a).multiplyScalar(0.5);
    const out = c.clone().setY(0);
    if (out.lengthSq() < 0.6) out.copy(a).sub(k).setY(0);
    if (out.lengthSq() < 1e-6) out.set(0, 0, 1);
    out.normalize();
    const side = new THREE.Vector3(-out.z, 0, out.x), pitch = 38 * DEG;
    return { name: 'matepush', dur, pose(u, t, o) {
      const d = lerp(6.6, 5, u) * fit.close;
      o.pos.copy(c).addScaledVector(out, d * Math.cos(pitch)).addScaledVector(side, lerp(0.9, 0.5, u)).setY(0.3 + d * Math.sin(pitch));
      o.look.copy(c).addScaledVector(out, 0.35).setY(0.4);
    } };
  },
  // the mate: low round the beaten king, then up and away over the whole board
  mate({ dur = 6, at, yaw = 0, fit }) {
    const c = squarePos(at, 0.6), mid = new THREE.Vector3(0, 0.3, 0);
    return { name: 'mate', dur, linear: true, pose(u, t, o) {
      // raw time, two phases: a slow turn low round the king, then one eased rise (no ease inside an ease, so no jump)
      const r = clamp(u, 0, 1), k = ease.sine(clamp((r - 0.12) / 0.88, 0, 1));
      const y = yaw + 50 * DEG * ease.sine(r);
      orbitPos(o.pos, c, y, lerp(3.6 * fit.close, 10 * fit.wide, k), lerp(2.4, 6, k) * Math.sqrt(lerp(fit.close, fit.wide, k)));
      o.look.lerpVectors(c, mid, k);
    } };
  },
  // under the end card: a slow endless circle at mid height
  end({ yaw = 0, fit }) {
    const c = new THREE.Vector3(0, 0.2, 0);
    return { name: 'end', dur: 1e9, linear: true, pose(u, t, o) { orbitPos(o.pos, c, yaw + t * 0.09, 12 * fit.wide, 5.6 * Math.sqrt(fit.wide)); o.look.copy(c); } };
  },
  // the battle close-up the director asks for (target, yaw, pitch, dist as in controls.cinematic), with a slow push in
  battle({ target, yaw, pitch, dist, fit }) {
    const c = target.clone();
    return { name: 'battle', dur: 6, linear: true, pose(u, t, o) {
      const d = 1.25 * dist * fit.close * lerp(1, 0.9, ease.sine(clamp(t / 5, 0, 1))), pt = Math.max(pitch, 17 * DEG);
      orbitPos(o.pos, c, yaw + t * 0.035, d * Math.cos(pt), d * Math.sin(pt)); o.look.copy(c);
    } };
  },
};

// ------------------------------------------------------------------ the camera
export function createShowCamera({ stage, gimbal, controls, pieces = null, world = null }) {
  const cam = stage.camera;
  // a nearer clip plane than the game's would show battle sparks passing the lens as big blobs
  const near0 = cam.near; cam.near = Math.max(near0, 0.6); cam.updateProjectionMatrix();
  const pose = { pos: V(), look: V() }, from = { pos: V(), look: V() }, tmp = { pos: V(), look: V() };
  const worldPos = V(), worldLook = V(), subjectP = V();
  let shot = null, t = 0, blend = null, settle = null;   // blend: { t, dur, ease } from `from` into the shot; settle: resolve of a cinematic()
  let lookSmooth = null;                                 // smoothed look point while a shot tracks a subject
  const fit = { wide: 1, close: 1 };
  function refit() {
    const a = cam.aspect || 1.5;
    fit.wide = clamp(1.32 / a, 1, 2.6);
    fit.close = Math.sqrt(fit.wide) * (a < 1 ? 1.2 : 1);   // portrait: close shots a fifth wider, so the moving piece is not lost in a crowd
  }

  function evalShot(out) {
    if (!shot) return false;
    const u = shot.linear ? t / shot.dur : (shot.ease || ease.inOut)(clamp(t / shot.dur, 0, 1));
    shot.pose(u, t, out);
    if (shot.track) {
      // keep a moving piece in the frame: the look point leans towards it, smoothed so a jump never jerks the camera
      shot.track.getWorldPosition(subjectP);
      gimbal.worldToLocal(subjectP);
      subjectP.y += 0.5;
      out.look.lerp(subjectP, 0.65);
    }
    return true;
  }
  /** Start a shot: a hard cut, or a glide of `glide` seconds from the current view. */
  function play(kind, opts = {}, { glide = 0, easeFn = null } = {}) {
    refit();
    const next = SHOTS[kind]({ ...opts, fit });
    if (easeFn) next.ease = easeFn;
    if (glide > 0 && shot) { from.pos.copy(pose.pos); from.look.copy(pose.look); blend = { t: 0, dur: glide }; }
    else { blend = null; lookSmooth = null; snap = true; }
    shot = next; t = 0;
    return next;
  }
  // dt: the shot clock (scaled with slow motion and the montage); realDt: the glide between shots runs on real time, so a
  // fast montage never turns a glide into a whip
  function update(dt, realDt = dt) {
    if (!shot) return;
    t += dt;
    evalShot(tmp);
    if (lookSmooth) lookSmooth.lerp(tmp.look, 1 - Math.exp(-dt * 7)); else lookSmooth = tmp.look.clone();
    tmp.look.copy(lookSmooth);
    if (blend) {
      blend.t += realDt;
      const k = ease.inOut(clamp(blend.t / blend.dur, 0, 1));
      pose.pos.lerpVectors(from.pos, tmp.pos, k);
      pose.pos.y += Math.sin(Math.PI * k) * clamp(from.pos.distanceTo(tmp.pos) / 4, 0, 2.5);   // a glide arcs up over the pieces between the two shots
      pose.look.lerpVectors(from.look, tmp.look, k);
      if (k >= 1) { blend = null; if (settle) { const r = settle; settle = null; r(); } }
    } else { pose.pos.copy(tmp.pos); pose.look.copy(tmp.look); if (settle) { const r = settle; settle = null; r(); } }
    avoid(dt);
    write();
  }
  // never inside a piece: over a piece (or close beside it) the camera rises above its top, eased so it never jumps
  let lift = 0, snap = false, groundY = -Infinity, groundAt = null, groundN = 0;
  const ray = new THREE.Raycaster(), down = new THREE.Vector3(0, -1, 0), rayFrom = new THREE.Vector3();
  const sightFrom = new THREE.Vector3(), sightTo = new THREE.Vector3(), sightDir = new THREE.Vector3();
  let sightN = 0, sightNeed = 0, cornerNeed = 0;
  const fwd = new THREE.Vector3(), cdir = new THREE.Vector3(), UP = new THREE.Vector3(0, 1, 0);
  const CORNERS = [[0.42, 0.22], [-0.42, 0.22], [0, 0.3], [0.42, -0.05], [-0.42, -0.05]];   // yaw and drop of the rays: the frame's lower corners, bottom middle, sides
  function avoid(dt) {
    let need = 0.45 - pose.pos.y;                               // and never through the board or the ground
    // beyond the board edge the world has trees, terrain and props: the further out, the higher the camera stays
    const out = Math.max(Math.abs(pose.pos.x), Math.abs(pose.pos.z)) - 4.8;
    if (out > -0.5) {
      need = Math.max(need, Math.min(6, 2.2 + 1.1 * (out + 0.5)) - pose.pos.y);
      // the world's own top under the camera (trees, terrain), found with a ray down, refreshed every few frames or after a jump
      const w = world?.();
      if (w) {
        if (!groundAt || groundAt.distanceToSquared(pose.pos) > 0.25 || ++groundN % 4 === 0) {
          gimbal.updateMatrixWorld();
          rayFrom.set(pose.pos.x, 40, pose.pos.z); gimbal.localToWorld(rayFrom);
          ray.set(rayFrom, down); ray.far = 80;
          groundY = -Infinity;
          for (const hit of ray.intersectObject(w, true)) {   // the first top below 8: clouds and birds above never count
            const y = gimbal.worldToLocal(hit.point.clone()).y;
            if (y < 8) { groundY = y; break; }
          }
          groundAt = (groundAt || new THREE.Vector3()).copy(pose.pos);
        }
        need = Math.max(need, groundY + 1.1 - pose.pos.y);
      }
    }
    // scenery between the lens and the look point (a tree crown beside the board): rise until the sight line clears it
    const w2 = out > -2 ? world?.() : null;
    if (w2 && (++sightN % 2 === 0 || snap)) {
      gimbal.updateMatrixWorld();
      sightFrom.copy(pose.look); gimbal.localToWorld(sightFrom);
      sightTo.copy(pose.pos); sightTo.y += lift; gimbal.localToWorld(sightTo);
      const dist = sightFrom.distanceTo(sightTo);
      ray.set(sightFrom, sightDir.subVectors(sightTo, sightFrom).normalize()); ray.far = dist;
      sightNeed = 0;
      for (const hit of ray.intersectObject(w2, true)) {
        const y = gimbal.worldToLocal(hit.point.clone()).y, f = hit.distance / dist;
        if (y > 8 || f < 0.35) continue;   // clouds, and the ground right at the subject, never count
        sightNeed = Math.max(sightNeed, Math.min(4, (y + 0.6 - pose.look.y) / f + pose.look.y - (pose.pos.y + lift)) + lift);
      }
    }
    if (w2) need = Math.max(need, sightNeed);
    // scenery close in front of the lens, anywhere in the frame (a crown in a lower corner): short rays into the frame's
    // corners; the nearer the hit, the higher the camera goes
    if (w2 && (sightN % 2 === 0 || snap)) {
      cornerNeed = 0;
      gimbal.updateMatrixWorld();
      sightTo.copy(pose.pos); sightTo.y += lift; gimbal.localToWorld(sightTo);
      fwd.copy(pose.look).sub(pose.pos); fwd.y -= lift; fwd.normalize();
      for (const [yawOff, pitchOff] of CORNERS) {
        cdir.copy(fwd).applyAxisAngle(UP, yawOff);
        cdir.y -= pitchOff; cdir.normalize().transformDirection(gimbal.matrixWorld);
        ray.set(sightTo, cdir); ray.far = 4.2;
        for (const hit of ray.intersectObject(w2, true)) {
          if (gimbal.worldToLocal(hit.point.clone()).y > 8) continue;
          cornerNeed = Math.max(cornerNeed, lift + (4.2 - hit.distance) * 0.9);
          break;
        }
      }
    }
    if (w2) need = Math.max(need, cornerNeed);
    const lx = pose.look.x, lz = pose.look.z, vx = pose.pos.x - lx, vz = pose.pos.z - lz, vl = Math.hypot(vx, vz) || 1;
    for (const g of pieces?.() || []) {
      if (!g.visible || !g.userData.height) continue;
      const dx = g.position.x - pose.pos.x, dz = g.position.z - pose.pos.z, r = Math.hypot(dx, dz);
      const top = g.position.y + g.userData.height * g.scale.y + 0.4;
      if (r < 1.3) need = Math.max(need, (top - pose.pos.y) * clamp((1.3 - r) / 0.5, 0, 1));
      // a piece between the lens and the look point: rise until the sight line clears its top
      const px = g.position.x - lx, pz = g.position.z - lz, s = (px * vx + pz * vz) / (vl * vl);
      if (s < 0.12 || s > 0.92) continue;
      const off = Math.abs(px * vz - pz * vx) / vl;
      if (off > 0.42 || Math.hypot(px, pz) < 1.25) continue;   // the pieces at the look point itself are the subject
      const lineY = pose.look.y + (pose.pos.y - pose.look.y) * s;
      if (top > lineY) need = Math.max(need, Math.min(3, (top - pose.look.y) / s + pose.look.y - pose.pos.y));
    }
    // after a hard cut the new shot starts already clear; inside a shot the lift eases (up fast, down slowly)
    if (snap) { lift = Math.max(0, need); snap = false; }
    else lift += (Math.max(0, need) - lift) * (1 - Math.exp(-dt * (need > lift ? 14 : 3)));
    pose.pos.y += lift;
  }
  function write() {
    gimbal.updateMatrixWorld();
    worldPos.copy(pose.pos); gimbal.localToWorld(worldPos);
    worldLook.copy(pose.look); gimbal.localToWorld(worldLook);
    cam.position.copy(worldPos);
    cam.lookAt(worldLook);
  }

  // ---------------------------------------------------------------- the battle close-up, taken over from the controls
  const orig = { cinematic: controls.cinematic, restore: controls.restore };
  const cameraDesc = Object.getOwnPropertyDescriptor(controls, 'camera');
  let onRestore = null;
  controls.cinematic = ({ target, yaw = 0, pitch = 12 * DEG, dist = 7, dur = 0.6 } = {}) => {
    const c = target ? new THREE.Vector3(target.x, target.y, target.z) : new THREE.Vector3();
    // the director gives a world yaw (it turns the gimbal yaw in): back into gimbal space for the shot
    const gy = gimbal.rotation.y;
    play('battle', { target: c, yaw: yaw - gy, pitch: clamp(pitch, 4 * DEG, 80 * DEG), dist: Math.max(2.5, dist) }, { glide: Math.max(0.35, dur * 1.4) });
    return new Promise((res) => { settle = res; });
  };
  controls.restore = () => { onRestore?.(); return Promise.resolve(); };
  // the director picks the side of the fight nearest to where the camera is: report the showcase camera's yaw
  Object.defineProperty(controls, 'camera', { configurable: true, get: () => {
    const base = cameraDesc.get.call(controls);
    return { ...base, yaw: wrapPi(Math.atan2(pose.pos.x - pose.look.x, pose.pos.z - pose.look.z) + gimbal.rotation.y) };
  } });

  return {
    play, update, refit,
    /** let the current shot follow a piece group (its look point leans towards it) */
    track(obj) { if (shot) shot.track = obj; },
    get shot() { return shot?.name || null; },
    get time() { return t; },
    get pose() { return { pos: pose.pos.clone(), look: pose.look.clone() }; },
    /** called when the battle director sends the camera back (the showcase cuts to its next shot) */
    onRestore(fn) { onRestore = fn; },
    dispose() {
      controls.cinematic = orig.cinematic; controls.restore = orig.restore;
      Object.defineProperty(controls, 'camera', cameraDesc);
      if (settle) { const r = settle; settle = null; r(); }
      shot = null;
      cam.near = near0; cam.updateProjectionMatrix();
      controls.apply();   // the normal view, exactly as the controls hold it
    },
  };
}
