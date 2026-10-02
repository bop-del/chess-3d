// The calm gold sweep: a soft light runs once across the board's gold inlay and over the player's own pieces.
// Used when a line is adopted and at the end of a scheduled Drill session. No particles, about one second.
//
//   createSweep({ gimbal, stage }) -> { play({ side, squares }) -> Promise, tick(dt), skip(), playing, dispose() }
//
// side: 'w' | 'b', the player's side; the light travels from his edge of the board toward the opponent.
// squares: names of the squares ('e4') or indices (rank * 8 + file) holding his pieces.
// Time: with ?manual=1 only tick(dt) advances the sweep (main.js calls it from the stepped frame, so __chess.step moves
// it); otherwise it drives itself on requestAnimationFrame. Under prefers-reduced-motion play() resolves at once and
// draws nothing.
import * as THREE from 'three';

export const SWEEP_SECONDS = 1.1;
const GOLD = new THREE.Color('#ffcf6e');
const REACH = 5.6;          // the band starts and ends this far from the centre, off the board

const VERT = /* glsl */`
uniform mat4 uToGimbal;
varying vec3 vP;
varying vec3 vN;
varying vec3 vV;
void main() {
  vP = (uToGimbal * modelMatrix * vec4(position, 1.0)).xyz;
  vN = normalize(normalMatrix * normal);
  vec4 mv = modelViewMatrix * vec4(position, 1.0);
  vV = normalize(-mv.xyz);
  gl_Position = projectionMatrix * mv;
}`;

// uPos: band centre along the travel axis (+z means toward black when uDir = 1). uGain: overall envelope 0..1.
const FRAG = /* glsl */`
uniform vec3 uColor;
uniform float uPos;
uniform float uDir;
uniform float uGain;
uniform float uWidth;
uniform float uBase;     // light that is always added inside the band, before the rim term
uniform float uRim;      // extra on silhouettes, so the light reads on dark pieces too
varying vec3 vP;
varying vec3 vN;
varying vec3 vV;
void main() {
  float s = vP.z * uDir;
  float d = (s - uPos) / uWidth;
  float band = exp(-d * d);
  float fres = pow(1.0 - clamp(abs(dot(normalize(vN), normalize(vV))), 0.0, 1.0), 2.0);
  float a = band * uGain * (uBase + uRim * fres);
  gl_FragColor = vec4(uColor * a, a);
}`;

const smooth = (x) => x * x * (3 - 2 * x);

function squareIndex(s) {
  if (typeof s === 'number') return s;
  return (s.charCodeAt(1) - 49) * 8 + (s.charCodeAt(0) - 97);
}

export function createSweep({ gimbal }) {
  const manual = typeof location !== 'undefined' && new URLSearchParams(location.search).get('manual') === '1';
  const reduced = () => typeof matchMedia === 'function' && matchMedia('(prefers-reduced-motion: reduce)').matches;

  const mkMat = (over) => {
    const m = new THREE.ShaderMaterial({
      vertexShader: VERT, fragmentShader: FRAG,
      uniforms: {
        uColor: { value: GOLD.clone() }, uPos: { value: -REACH }, uDir: { value: 1 }, uGain: { value: 0 },
        uWidth: { value: 1.25 }, uBase: { value: 1 }, uRim: { value: 0 }, uToGimbal: { value: new THREE.Matrix4() }, ...over,
      },
      transparent: true, depthWrite: false, blending: THREE.AdditiveBlending,
      polygonOffset: true, polygonOffsetFactor: -1, polygonOffsetUnits: -2,   // the inlay's underlay sits 0.008 under the squares: keep the offset tiny
    });
    return m;
  };

  let overlays = [];          // { mesh, mat }
  let run = null;             // { t, side, resolve }
  let raf = 0, last = 0;

  function clear() {
    for (const o of overlays) { o.mesh.removeFromParent(); o.mat.dispose(); if (o.own) o.mesh.geometry.dispose(); }
    overlays = [];
  }

  function build(side, squares) {
    const dir = side === 'b' ? 1 : -1;      // white's edge is +z, so the light travels toward -z; black's toward +z
    // Inlay: the board's gold geometry again, lit by the band.
    const inlay = gimbal.getObjectByName('gold-inlay');
    if (inlay) {
      const mat = mkMat({ uDir: { value: dir }, uBase: { value: 1.0 }, uRim: { value: 0.5 }, uWidth: { value: 1.1 } });
      const mesh = new THREE.Mesh(inlay.geometry, mat);
      mesh.position.copy(inlay.position); mesh.quaternion.copy(inlay.quaternion); mesh.scale.copy(inlay.scale);
      mesh.renderOrder = 5; mesh.frustumCulled = false;
      (inlay.parent || gimbal).add(mesh);
      overlays.push({ mesh, mat });
    }
    // A faint pool of light on the squares themselves, so the eye can follow the band across the board.
    {
      const mat = mkMat({ uDir: { value: dir }, uBase: { value: 0.045 }, uRim: { value: 0 }, uWidth: { value: 1.3 } });
      const mesh = new THREE.Mesh(new THREE.PlaneGeometry(8, 8).rotateX(-Math.PI / 2), mat);
      mesh.position.y = 0.006; mesh.renderOrder = 4; mesh.frustumCulled = false;
      gimbal.add(mesh);
      overlays.push({ mesh, mat, own: true });
    }
    // Own pieces: the same meshes again, lit as a soft glow with the strongest light on their edges.
    const root = gimbal.getObjectByName('pieces');
    if (root && squares && squares.length) {
      const want = new Set(squares.map(squareIndex));
      for (const g of root.children) {
        const sq = Math.round(3.5 - g.position.z) * 8 + Math.round(g.position.x + 3.5);
        if (!want.has(sq) || !g.visible) continue;
        const meshes = [];
        g.traverse((o) => meshes.push(o));       // collect first: adding the overlays while walking would walk them too
        for (const o of meshes) {
          if (!o.isMesh || o.userData.hit || !o.material || o.material.visible === false) continue;
          const mat = mkMat({ uDir: { value: dir }, uBase: { value: 0.06 }, uRim: { value: 0.75 }, uWidth: { value: 1.45 } });
          const m = new THREE.Mesh(o.geometry, mat);
          m.renderOrder = 6; m.frustumCulled = false;
          o.add(m);                                  // child: follows the piece, same local space
          overlays.push({ mesh: m, mat });
        }
      }
    }
  }

  const inv = new THREE.Matrix4();
  function apply(t) {
    gimbal.updateWorldMatrix(true, false);
    inv.copy(gimbal.matrixWorld).invert();
    const k = Math.min(1, t / SWEEP_SECONDS);
    const pos = -REACH + 2 * REACH * smooth(k);
    // fade in over the first sixth, out over the last third: the light is never switched on or off
    const gain = smooth(Math.min(1, k / 0.16)) * smooth(Math.min(1, (1 - k) / 0.34));
    for (const o of overlays) { o.mat.uniforms.uToGimbal.value.copy(inv); o.mat.uniforms.uPos.value = pos; o.mat.uniforms.uGain.value = gain; }
  }

  function finish() {
    const r = run; run = null;
    if (raf) { cancelAnimationFrame(raf); raf = 0; }
    clear();
    r?.resolve();
  }

  function tick(dt) {
    if (!run) return;
    run.t += dt;
    if (run.t >= SWEEP_SECONDS) { finish(); return; }
    apply(run.t);
  }

  function loop(now) {
    raf = 0;
    if (!run) return;
    const dt = Math.min(0.05, (now - last) / 1000); last = now;
    tick(dt);
    if (run) raf = requestAnimationFrame(loop);
  }

  return {
    play({ side = 'w', squares = [] } = {}) {
      if (run) finish();                              // a second call ends the first at once
      if (reduced()) return Promise.resolve();
      return new Promise((resolve) => {
        build(side, squares);
        run = { t: 0, side, resolve };
        apply(0);
        if (!manual) { last = performance.now(); raf = requestAnimationFrame(loop); }
      });
    },
    tick,
    skip: finish,
    get playing() { return !!run; },
    dispose() { finish(); },
  };
}
