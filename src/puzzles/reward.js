// The reward moment of the puzzle path. A solved puzzle gets about 1.5 s: a gold burst on the decisive piece's square, a
// short bright chime (Mute is respected by audio.play) and a card "Gelöst!" / "Solved!" with the theme line and a big
// Next button. A finished chapter gets a wave: its stations light up one after the other, each with a rising chime note.
//
//   createReward({ gimbal, sfx, host? }) -> { solved(opts), board(opts), chapter(opts), tick(dt), dismiss(), skip(), playing, dispose() }
//
//   solved({ square, silver, theme, onNext, delay })  delay: seconds until it starts (the slide of the last move). onStart: called when it starts (the controller starts the gold board sweep there). theme: a theme id of data.js (the line is looked up in the current language). square: name ('e8') or index (rank * 8 + file) of the piece that solved it.
//       silver: the puzzle needed misses or Help: a smaller, silver burst, a softer chime. The card still says Solved.
//       chapter: { onDone }  the puzzle finished a chapter: BURST_SECONDS after the solve moment the board finale runs (the
//       board wave below), then onDone (the controller's onChapter opens the Learn path). Tapping the card's Next or the board
//       during the finale skips to onDone.
//   board({ onDone })  the finale on the 3D board: all 64 squares glint in a gold wave from a1 to h8, the pieces bow (a short
//       forward tilt and back, staggered along the same wave), a chime run plays. About 2 s.
//   chapter({ stations, onDone })  stations: elements; `--lit` (0..1) is set on each every tick for the CSS to use.
//   tick(dt)  the controller calls it every frame (and the sweep does the same), so ?manual=1 and __chess.step move it.
// Under prefers-reduced-motion there are no sparks and no wave: the card appears at once and the chime plays.
import * as THREE from 'three';
import { t, i18n } from '../i18n.js';
import { THEMES } from './themes.js';
import './strings.js';
import './reward.css';

export const BURST_SECONDS = 1.5;
export const CARD_AT = 0.3;          // the card starts to come in this long after the burst
export const CARD_IN = 0.45;
export const WAVE_STEP = 0.1;        // seconds between two stations lighting up
export const WAVE_GLOW = 0.7;        // how long one station stays lit up

const GOLD = new THREE.Color('#ffd27a');
const SILVER = new THREE.Color('#dfe7f2');
const SPARKS = 72;
export const BOARD_SPREAD = 1.15;    // seconds the glint takes from a1 to h8
export const GLINT_SECONDS = 0.5;    // one square's glint
export const BOW_SECONDS = 0.6;      // one piece's bow
export const BOW_ANGLE = 0.4;        // radians, about 23 degrees
export const BOARD_HOLD = 0.3;       // a short rest at the end before onDone
const GRAVITY = 5.2;

const smooth = (x) => { x = Math.min(1, Math.max(0, x)); return x * x * (3 - 2 * x); };
const squareIndex = (s) => (typeof s === 'number' ? s : (s.charCodeAt(1) - 49) * 8 + (s.charCodeAt(0) - 97));
// Square -> board plane position (one square = 1.0, white at +z), the same mapping as everywhere in the gimbal.
const squareXZ = (sq) => ({ x: (sq & 7) - 3.5, z: 3.5 - (sq >> 3) });

const SPARK_VERT = /* glsl */`
uniform float uSize;
uniform float uPx;
attribute float aLife;
varying float vLife;
void main() {
  vLife = aLife;
  vec4 mv = modelViewMatrix * vec4(position, 1.0);
  gl_Position = projectionMatrix * mv;
  gl_PointSize = max(0.0, uSize * aLife) * projectionMatrix[1][1] * uPx * 0.5 / max(0.1, -mv.z);
}`;
const SPARK_FRAG = /* glsl */`
uniform vec3 uColor;
varying float vLife;
void main() {
  vec2 c = gl_PointCoord - 0.5;
  float d = length(c) * 2.0;
  float a = smoothstep(1.0, 0.0, d);
  a = a * a * vLife;
  gl_FragColor = vec4(uColor * a * 1.6, a);
}`;
const RING_FRAG = /* glsl */`
uniform vec3 uColor;
uniform float uGain;
varying vec2 vUv;
void main() {
  float r = length(vUv - 0.5) * 2.0;
  float edge = smoothstep(0.62, 0.9, r) * smoothstep(1.0, 0.9, r);
  float a = edge * uGain;
  gl_FragColor = vec4(uColor * a * 1.5, a);
}`;
const RING_VERT = /* glsl */`
varying vec2 vUv;
void main() { vUv = uv; gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0); }`;
const PILLAR_FRAG = /* glsl */`
uniform vec3 uColor;
uniform float uGain;
varying vec2 vUv;
void main() {
  float a = pow(1.0 - vUv.y, 1.6) * uGain * 0.55;
  gl_FragColor = vec4(uColor * a, a);
}`;

// All 64 squares in one plane over the board. Per square: a gold glow with a bright diagonal streak crossing it, in the order of
// the diagonal (a1 first, h8 last). uT is the time since the wave started.
const GLINT_VERT = /* glsl */`
varying vec2 vP;
void main() { vP = position.xz; gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0); }`;
const GLINT_FRAG = /* glsl */`
uniform float uT;
uniform float uSpread;
uniform float uDur;
uniform float uGain;
varying vec2 vP;
void main() {
  vec2 p = vP + 4.0;
  float f = floor(p.x), r = 7.0 - floor(p.y);
  vec2 uv = vec2(fract(p.x), fract(p.y));
  float lt = uT - (f + r) / 14.0 * uSpread;
  float k = lt / uDur;
  if (k < 0.0 || k > 1.0) discard;
  float env = sin(3.14159265 * k);
  float s = (uv.x + (1.0 - uv.y)) * 0.5;
  float band = exp(-pow((s - (k * 1.5 - 0.25)) / 0.13, 2.0));
  vec2 e = abs(uv - 0.5) * 2.0;
  float border = smoothstep(0.78, 1.0, max(e.x, e.y));
  vec3 gold = vec3(1.0, 0.8, 0.4);
  vec3 col = gold * (0.30 + 0.35 * border) * env + vec3(1.0, 0.93, 0.7) * band * env * 0.9;
  float a = max(max(col.r, col.g), col.b) * uGain;
  gl_FragColor = vec4(col * uGain, a);
}`;

export function createReward({ gimbal, sfx = null, host = null }) {
  const reduced = () => typeof matchMedia === 'function' && matchMedia('(prefers-reduced-motion: reduce)').matches;
  const hostEl = () => host || document.getElementById('hud') || document.body;

  let burst = null;     // { t, silver, group, pos, vel, life, mats }
  let card = null;      // { el, t, in }
  let wave = null;      // { t, items: [el], onDone }
  let pending = null;   // { left, opts }: a solved() waiting for the last move to land
  let finale = null;    // { left, onDone }: a chapter finish waiting for the solve moment to play out
  let bwave = null;     // { t, mesh, mat, bows: [{ g, base, d }], onDone, end }

  function clearBurst() {
    if (!burst) return;
    burst.group.removeFromParent();
    burst.group.traverse((o) => { o.geometry?.dispose(); o.material?.dispose(); });
    burst = null;
  }

  function buildBurst(sq, silver) {
    const color = (silver ? SILVER : GOLD).clone();
    const group = new THREE.Group();
    const { x, z } = squareXZ(sq);
    group.position.set(x, 0, z);
    group.renderOrder = 8;
    const mat = (frag, vert, uniforms, extra = {}) => new THREE.ShaderMaterial({
      vertexShader: vert, fragmentShader: frag, uniforms, transparent: true, depthWrite: false, blending: THREE.AdditiveBlending, ...extra,
    });
    // a ring that opens on the square and a soft pillar of light over the piece
    const ringMat = mat(RING_FRAG, RING_VERT, { uColor: { value: color }, uGain: { value: 0 } });
    const ring = new THREE.Mesh(new THREE.PlaneGeometry(1, 1).rotateX(-Math.PI / 2), ringMat);
    ring.position.y = 0.02; ring.renderOrder = 8; ring.frustumCulled = false;
    const pillarMat = mat(PILLAR_FRAG, RING_VERT, { uColor: { value: color }, uGain: { value: 0 } }, { side: THREE.DoubleSide });
    const pillar = new THREE.Mesh(new THREE.CylinderGeometry(0.34, 0.5, 2.4, 28, 1, true).translate(0, 1.2, 0), pillarMat);
    pillar.renderOrder = 7; pillar.frustumCulled = false;
    // sparks: fixed per burst, positions integrated each tick (a small deterministic scatter, so a recording is repeatable)
    const n = silver ? Math.round(SPARKS * 0.5) : SPARKS;
    const pos = new Float32Array(n * 3), vel = new Float32Array(n * 3), life = new Float32Array(n), ttl = new Float32Array(n);
    let seed = sq * 7919 + 17;
    const rnd = () => { seed = (seed * 1664525 + 1013904223) >>> 0; return seed / 4294967296; };
    for (let i = 0; i < n; i++) {
      const a = rnd() * Math.PI * 2, up = 1.9 + rnd() * 2.6, out = 0.35 + rnd() * 1.5;
      pos[i * 3] = Math.cos(a) * 0.12; pos[i * 3 + 1] = 0.55 + rnd() * 0.4; pos[i * 3 + 2] = Math.sin(a) * 0.12;
      vel[i * 3] = Math.cos(a) * out; vel[i * 3 + 1] = up; vel[i * 3 + 2] = Math.sin(a) * out;
      ttl[i] = 0.7 + rnd() * 0.75;
      life[i] = 1;
    }
    const geo = new THREE.BufferGeometry();
    geo.setAttribute('position', new THREE.BufferAttribute(pos, 3));
    geo.setAttribute('aLife', new THREE.BufferAttribute(life, 1));
    const pxH = () => (typeof window !== 'undefined' ? window.innerHeight * (window.devicePixelRatio || 1) : 800);
    const sparkMat = mat(SPARK_FRAG, SPARK_VERT, { uColor: { value: color }, uSize: { value: 0.2 }, uPx: { value: pxH() } });
    const points = new THREE.Points(geo, sparkMat);
    points.frustumCulled = false; points.renderOrder = 9;
    group.add(pillar, ring, points);
    gimbal.add(group);
    burst = { t: 0, silver, group, ring, pillar, pos, vel, life, ttl, geo, uniforms: { ring: ringMat.uniforms, pillar: pillarMat.uniforms, spark: sparkMat.uniforms }, n };
  }

  function stepBurst(dt) {
    const b = burst;
    b.t += dt;
    if (b.t >= BURST_SECONDS) { clearBurst(); return; }
    const k = b.t / BURST_SECONDS;
    const amp = b.silver ? 0.55 : 1;
    b.uniforms.ring.uGain.value = amp * smooth(b.t / 0.08) * (1 - smooth((k - 0.2) / 0.8));
    const open = 0.9 + 3.6 * (1 - Math.pow(1 - Math.min(1, b.t / 0.85), 3));
    b.ring.scale.set(open, 1, open);
    b.uniforms.pillar.uGain.value = amp * smooth(b.t / 0.1) * (1 - smooth((b.t - 0.1) / 0.6));
    b.uniforms.spark.uPx.value = window.innerHeight * (window.devicePixelRatio || 1);
    for (let i = 0; i < b.n; i++) {
      b.vel[i * 3 + 1] -= GRAVITY * dt;
      for (let a = 0; a < 3; a++) b.pos[i * 3 + a] += b.vel[i * 3 + a] * dt;
      if (b.pos[i * 3 + 1] < 0.03) { b.pos[i * 3 + 1] = 0.03; b.vel[i * 3 + 1] *= -0.25; b.vel[i * 3] *= 0.6; b.vel[i * 3 + 2] *= 0.6; }
      b.life[i] = Math.max(0, 1 - b.t / b.ttl[i]);
    }
    b.geo.attributes.position.needsUpdate = true;
    b.geo.attributes.aLife.needsUpdate = true;
  }

  function buildCard({ theme, silver, onNext }) {
    dismiss();
    const el = document.createElement('div');
    el.className = `pzreward${silver ? ' silver' : ''}`;
    el.setAttribute('role', 'status');
    const title = document.createElement('div');
    title.className = 'pzr-title';
    title.textContent = t('puzzles.solved', 'Solved!');
    const sub = document.createElement('div');
    sub.className = 'pzr-theme';
    const line = () => (THEMES[theme] ? THEMES[theme][i18n.language] || THEMES[theme].en : '');
    sub.textContent = line();
    const next = document.createElement('button');
    next.type = 'button';
    next.className = 'btn primary pzr-next';
    next.textContent = t('puzzles.next', 'Next puzzle');
    next.addEventListener('click', () => { dismiss(); onNext?.(); });
    el.append(title, sub, next);
    hostEl().append(el);
    card = { el, t: 0 };
    paintCard();
  }
  function paintCard() {
    if (!card) return;
    const k = reduced() ? 1 : smooth((card.t - CARD_AT) / CARD_IN);
    card.el.style.opacity = String(k);
    card.el.style.setProperty('--k', k.toFixed(3));
    card.el.style.pointerEvents = k > 0.6 ? 'auto' : 'none';
  }
  function dismiss() {
    if (card) { card.el.remove(); card = null; }
  }

  // ---- the board finale
  const D = (sq) => ((sq & 7) + (sq >> 3)) / 14;       // 0 at a1, 1 at h8
  function clearBoard() {
    if (!bwave) return;
    bwave.mesh.removeFromParent(); bwave.mesh.geometry.dispose(); bwave.mat.dispose();
    for (const b of bwave.bows) b.g.rotation.x = b.base;
    removeEventListener('pointerdown', bwave.skip, true);
    bwave = null;
  }
  function startBoard(onDone) {
    clearBoard();
    dismiss();
    const steps = [0, 2, 4, 7, 9, 12, 14, 16];       // a rising run over a major pentatonic, the last note rings out
    const run = (i) => chime({ at: i * (BOARD_SPREAD / (steps.length - 1)), volume: i === steps.length - 1 ? 1 : 0.55, pitch: Math.pow(2, (steps[i] - 12) / 12) });
    steps.forEach((_, i) => run(i));
    if (reduced()) { onDone?.(); return; }
    const mat = new THREE.ShaderMaterial({
      vertexShader: GLINT_VERT, fragmentShader: GLINT_FRAG,
      uniforms: { uT: { value: 0 }, uSpread: { value: BOARD_SPREAD }, uDur: { value: GLINT_SECONDS }, uGain: { value: 1 } },
      transparent: true, depthWrite: false, blending: THREE.AdditiveBlending,
      polygonOffset: true, polygonOffsetFactor: -1, polygonOffsetUnits: -2,
    });
    const mesh = new THREE.Mesh(new THREE.PlaneGeometry(8, 8).rotateX(-Math.PI / 2), mat);
    mesh.position.y = 0.012; mesh.renderOrder = 7; mesh.frustumCulled = false;
    gimbal.add(mesh);
    // the pieces on the board bow toward the other side: white toward -z, black toward +z (a tilt about the world x axis)
    const bows = [];
    const root = gimbal.getObjectByName('pieces');
    for (const g of root ? root.children : []) {
      if (!g.visible || Math.abs(g.rotation.z) > 0.01 || g.position.y > 0.01) continue;
      const sq = Math.round(3.5 - g.position.z) * 8 + Math.round(g.position.x + 3.5);
      if (sq < 0 || sq > 63) continue;
      const color = g.children[0]?.userData?.piece?.color;     // the piece wrapper carries { type, color }
      bows.push({ g, base: g.rotation.x, d: D(sq), dir: (color ? color === 'w' : g.position.z > 0) ? -1 : 1 });
    }
    const skip = () => { const d = bwave?.onDone; clearBoard(); sfx?.stop?.(); d?.(); };
    bwave = { t: 0, mesh, mat, bows, onDone, skip, end: BOARD_SPREAD + Math.max(GLINT_SECONDS, BOW_SECONDS) + BOARD_HOLD };
    addEventListener('pointerdown', skip, true);
  }
  function stepBoard(dt) {
    const w = bwave;
    w.t += dt;
    w.mat.uniforms.uT.value = w.t;
    for (const b of w.bows) {
      const k = (w.t - b.d * BOARD_SPREAD) / BOW_SECONDS;
      b.g.rotation.x = b.base + (k > 0 && k < 1 ? b.dir * BOW_ANGLE * Math.sin(Math.PI * k) ** 1.4 : 0);
    }
    if (w.t >= w.end) { const d = w.onDone; clearBoard(); d?.(); }
  }

  function chime(opts) { sfx?.play?.('chime', opts); }

  function paintWave() {
    for (let i = 0; i < wave.items.length; i++) {
      const x = (wave.t - i * WAVE_STEP) / WAVE_GLOW;
      const lit = x < 0 || x > 1 ? 0 : Math.sin(Math.PI * Math.min(1, x)) ;
      wave.items[i].style.setProperty('--lit', lit.toFixed(3));
    }
  }

  const api = {
    solved(opts = {}) {
      dismiss();
      if (opts.delay > 0) { pending = { left: opts.delay, opts: { ...opts, delay: 0 } }; return; }
      pending = null;
      const { square, silver = false, theme = '', onNext = null, chapter = null, onStart = null } = opts;
      onStart?.();
      clearBurst();
      finale = chapter ? { left: BURST_SECONDS, onDone: chapter.onDone } : null;
      const sq = squareIndex(square ?? 0);
      if (!reduced()) buildBurst(sq, silver);
      // during a chapter finale the card's Next skips the finale and goes straight to what comes after it
      buildCard({ theme, silver, onNext: () => { if (finale) { const d = finale.onDone; finale = null; d?.(); } else onNext?.(); } });
      chime({ volume: silver ? 0.6 : 1, pitch: silver ? 0.84 : 1 });
    },
    board({ onDone = null } = {}) { startBoard(onDone); },
    chapter({ stations = [], onDone = null } = {}) {
      if (wave) api.skip();
      const items = stations.filter(Boolean);
      // a rising run over a major pentatonic: one note per station, the last one rings out
      const steps = [0, 2, 4, 7, 9, 12, 14, 16, 19, 21];
      items.forEach((el, i) => chime({ at: i * WAVE_STEP, volume: 0.5 + 0.05 * i, pitch: Math.pow(2, (steps[i % steps.length] - 12) / 12) }));
      if (reduced()) { onDone?.(); return; }
      wave = { t: 0, items, onDone };
      paintWave();
    },
    tick(dt) {
      if (pending) { pending.left -= dt; if (pending.left <= 0) { const o = pending.opts; pending = null; api.solved(o); } }
      if (burst) stepBurst(dt);
      if (finale) { finale.left -= dt; if (finale.left <= 0) { const d = finale.onDone; finale = null; startBoard(d); } }
      if (bwave) stepBoard(dt);
      if (card && card.t < CARD_AT + CARD_IN + 0.01) { card.t += dt; paintCard(); }
      if (wave) {
        wave.t += dt;
        paintWave();
        if (wave.t >= (wave.items.length - 1) * WAVE_STEP + WAVE_GLOW) {
          wave.items.forEach((el) => el.style.removeProperty('--lit'));
          const done = wave.onDone; wave = null; done?.();
        }
      }
    },
    dismiss() { pending = null; finale = null; clearBoard(); dismiss(); },
    skip() {
      pending = null; finale = null; clearBoard();
      clearBurst();
      if (wave) { wave.items.forEach((el) => el.style.removeProperty('--lit')); wave = null; }
      sfx?.stop?.();
    },
    get playing() { return !!burst || !!wave || !!pending || !!finale || !!bwave; },
    get cardShown() { return !!card; },
    dispose() { api.skip(); dismiss(); },
  };
  return api;
}
