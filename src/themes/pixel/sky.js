// The Pixelwelt sky layer (CHE-239): everything the Sky and Backdrop choices add to the world group. Sun and moon, stars, weather
// (blocky rain and snow, an occasional bolt for the storm), the multiplier colours of the unlit materials and the backdrops far below
// the island. All flat unlit boxes (the kit's flat material, plus the water and fall textures for the sea and the waterfall);
// nothing translucent, nothing lit, no sound. setLook({ sky, backdrop }) swaps the whole layer; the world calls update(dt).
import * as THREE from 'three';
import { Mesher } from '../blocks/mesher.js';
import { SKIES, look as currentLook, onLook } from './look.js';
import { buildBackdrop, meshesOf } from './backdrops.js';

const rnd = (a) => () => { a |= 0; a = a + 0x6D2B79F5 | 0; let t = Math.imul(a ^ a >>> 15, 1 | a); t = t + Math.imul(t ^ t >>> 7, 61 | t) ^ t; return ((t ^ t >>> 14) >>> 0) / 4294967296; };
const TEXTURED = ['grassTop', 'grassSide', 'dirt', 'stone', 'cobble', 'sand', 'planks', 'logSide', 'logTop', 'crate', 'leaves', 'water', 'fall', 'gravel', 'soil', 'ore', 'basalt', 'lava', 'lavafall'];
const AREA = { x: 15, z: 13, top: 16, bottom: -3 };   // where the weather falls: a box around the island
const SUN_HOME = [-12, 17, -34];

function disposeGroup(g) { g.traverse((o) => { if (o.isMesh || o.isInstancedMesh) o.geometry.dispose(); }); }

export function createSkyLayer({ group, kit, clouds, light = false } = {}) {
  const sunGroup = group.getObjectByName('sun');
  const layer = new THREE.Group();
  layer.name = 'sky-layer';
  group.add(layer);
  const state = { sky: null, backdrop: null, flash: 0, particles: 0, flashes: 0, light };
  let time = 0, sky = null, nextFlash = 0, flashT = -1, bolt = null;
  let celestial = null, stars = null, backdropGroup = null, parts = null;
  const R = rnd(77);

  const setMul = (hex, k = 0) => {   // k: lightning, 0 to 1 toward white
    const c = new THREE.Color(hex).lerp(new THREE.Color(0xffffff), k);
    for (const key of TEXTURED) if (kit.mats[key]) kit.mats[key].color.copy(c);
    kit.mats.cloud.color.copy(c);
  };
  const setClouds = (hex, k = 0) => {
    const c = new THREE.Color(hex).lerp(new THREE.Color(0xffffff), k);
    for (const cl of clouds || []) for (const mt of cl.userData.mats) mt.color.copy(c);
  };

  function clear() {
    for (const o of [celestial, stars, backdropGroup, parts?.mesh, bolt]) if (o) { layer.remove(o); disposeGroup(o); if (o.isInstancedMesh) o.dispose(); }
    celestial = stars = backdropGroup = bolt = null; parts = null; state.particles = 0;
  }

  function buildMoon() {
    const m = new Mesher({ shade: false });
    m.box('flat', -3, -3, -0.5, 6, 6, 1, { color: 0xeef0ff });
    m.box('flat', -1.8, 0.2, 0.5, 1.4, 1.4, 0.1, { color: 0xc3c9e6 });
    m.box('flat', 0.6, -1.6, 0.5, 1, 1, 0.1, { color: 0xc3c9e6 });
    m.box('flat', 0.9, 1.2, 0.5, 0.8, 0.8, 0.1, { color: 0xc3c9e6 });
    const g = meshesOf(m, kit, 'moon');
    g.position.set(-14, 4, -40);
    g.lookAt(0, 8, 0);
    return g;
  }

  function buildStars(n, backdrop) {
    const m = new Mesher({ shade: false });
    for (let i = 0; i < n; i++) {
      // a sphere of stars: the island floats in the sky, so they stand below the horizon too (hidden where a backdrop's ground is)
      const u = R() * 2 - 1, a = R() * Math.PI * 2, r = 80 + R() * 10, s = Math.sqrt(1 - u * u), sz = 0.45 + R() * 0.4;
      // CHE-299 starclip: over the castle land the stars below the horizon of that land would shine in front of the meadow; leave them out
      if (backdrop === 'castle' && r * u < -6) continue;
      m.box('flat', r * s * Math.cos(a), r * u, r * s * Math.sin(a), sz, sz, sz, { color: R() < 0.2 ? 0xffe9a8 : 0xffffff });
    }
    return meshesOf(m, kit, 'stars');
  }

  function buildParticles(kind) {
    const n = (kind === 'rain' ? 170 : 130) >> (light ? 1 : 0);
    const size = kind === 'rain' ? [0.05, 0.55, 0.05] : [0.14, 0.14, 0.14];
    const geo = new THREE.BoxGeometry(...size);
    const col = new Float32Array(geo.attributes.position.count * 3);
    for (let i = 0; i < col.length; i += 3) { col[i] = kind === 'rain' ? 0.74 : 1; col[i + 1] = kind === 'rain' ? 0.82 : 1; col[i + 2] = 1; }
    geo.setAttribute('color', new THREE.BufferAttribute(col, 3));
    const mesh = new THREE.InstancedMesh(geo, kit.mats.flat, n);   // the flat unlit material of the world, colours in the vertices
    mesh.name = 'weather';
    mesh.frustumCulled = false;
    const P = rnd(kind === 'rain' ? 5 : 6), pos = [];
    for (let i = 0; i < n; i++) pos.push({ x: (P() * 2 - 1) * AREA.x, y: AREA.bottom + P() * (AREA.top - AREA.bottom), z: (P() * 2 - 1) * AREA.z, v: kind === 'rain' ? 15 + P() * 5 : 1.1 + P() * 0.9, ph: P() * 6.28 });
    const dummy = new THREE.Object3D();
    const put = () => { for (let i = 0; i < n; i++) { const p = pos[i]; dummy.position.set(p.x + (kind === 'snow' ? Math.round(Math.sin(time * 0.7 + p.ph) * 4) * 0.25 : 0), p.y, p.z); dummy.updateMatrix(); mesh.setMatrixAt(i, dummy.matrix); } mesh.instanceMatrix.needsUpdate = true; };
    put();
    mesh.userData.step = (dt) => { for (const p of pos) { p.y -= p.v * dt; if (p.y < AREA.bottom) p.y += AREA.top - AREA.bottom; } put(); };
    state.particles = n;
    return { mesh, step: mesh.userData.step };
  }

  function buildBolt() {
    const m = new Mesher({ shade: false });
    let x = 0;
    for (let y = 30, i = 0; y > 2; y -= 3.4, i++) { x += (R() - 0.5) * 3.2; m.box('flat', x - 0.35, y - 3.4, -0.2, 0.7, 3.5, 0.4, { color: 0xffffff }); }
    const g = meshesOf(m, kit, 'bolt');
    g.visible = false;
    return g;
  }

  function setLook(l = currentLook()) {
    if (sky && l.sky === state.sky && l.backdrop === state.backdrop) return;
    clear();
    state.sky = l.sky; state.backdrop = l.backdrop;
    sky = SKIES[l.sky] || SKIES.evening;
    setMul(sky.mul); setClouds(sky.cloud);
    // the sun keeps its own colour (the one multiplier exception); it sets low at sunrise and is gone under a grey or night sky
    if (sunGroup) {
      sunGroup.visible = !!sky.sun;
      sunGroup.position.set(SUN_HOME[0], sky.sun ? sky.sun.y : SUN_HOME[1], SUN_HOME[2]);
      kit.mats.sun.color.setHex(sky.sun ? sky.sun.color : 0xffffff);
    }
    if (sky.moon) { celestial = buildMoon(); layer.add(celestial); }
    if (sky.stars) { stars = buildStars(light ? sky.stars >> 1 : sky.stars, l.backdrop); layer.add(stars); }
    if (sky.weather) { parts = buildParticles(sky.weather); layer.add(parts.mesh); }
    if (sky.flash) { bolt = buildBolt(); layer.add(bolt); nextFlash = time + 1.4; flashT = -1; }
    if (l.backdrop && l.backdrop !== 'none') { backdropGroup = buildBackdrop(l.backdrop, sky, kit, { light }); if (backdropGroup) layer.add(backdropGroup); }
    state.flash = 0;
  }

  const unsub = onLook((l) => setLook(l));
  setLook(currentLook());

  function updateFlash(dt) {
    if (!sky?.flash) return;
    if (flashT < 0 && time >= nextFlash) {
      flashT = 0; state.flashes++;
      const a = (-0.5 + R()) * 2.2 + Math.PI * 1.5;   // somewhere behind the island
      const r = 34 + R() * 14;
      bolt.position.set(Math.cos(a) * r, 0, Math.sin(a) * r);
      bolt.lookAt(0, 0, 0);
      bolt.userData.dy = -R() * 4;
      bolt.position.y = bolt.userData.dy;
    }
    if (flashT >= 0) {
      flashT += dt;
      // two quick strokes: 0 to 0.12 s and 0.2 to 0.3 s
      const on = flashT < 0.12 || (flashT >= 0.2 && flashT < 0.3);
      state.flash = on ? (flashT < 0.12 ? 1 : 0.6) : 0;
      bolt.visible = on;
      if (flashT >= 0.4) { flashT = -1; state.flash = 0; bolt.visible = false; nextFlash = time + 5 + R() * 6; }
      setMul(sky.mul, state.flash * 0.7); setClouds(sky.cloud, state.flash * 0.8);
    }
  }

  return {
    state, layer,
    setLook,
    /** the storm: the next bolt now (the tests and the clips) */
    flashNow() { if (sky?.flash && flashT < 0) nextFlash = time; },
    update(dt) {
      time += dt;
      parts?.step(dt);
      updateFlash(dt);
    },
    dispose() {
      unsub();
      clear();
      group.remove(layer);
    },
  };
}
