// Pixelwelt ("Pixel world", ?theme=pixel): a world of 16 x 16 pixel blocks and blocky figures, everything drawn in code. Shares the
// mesher, the rig (animation) and the screen space avoid pass with Blocks; own textures, unlit materials with fixed per face shading,
// own world (pixel/world.js) and own figures (pixel/figures.js).
import * as THREE from 'three';
import { createPixelWorld } from './pixel/world.js';
import { buildPixelVox } from './pixel/figures.js';
import { createPieceStyle } from './blocks/rig.js';
import { trayPlanks } from './pixel/textures.js';
import { SLAB } from '../trays.js';

/** Board spec: classic squares hidden, labels lifted onto the plank frame. */
export function board({ track } = {}) {
  return {
    hide: true,
    labelLift: 0.2,
    labels: { color: '#fff2c8', metalness: 0, roughness: 1, envMapIntensity: 0 },
    // the tray floor: the planks texture, unlit like the world. The slab is a lit physical material shared by every theme, so it is
    // switched to "all emissive": black diffuse, no specular, no clearcoat, the texture as the emission.
    tray: { color: '#000000', emissive: '#ffffff', emissiveMap: trayPlanks(SLAB.w, SLAB.len, track), emissiveIntensity: 1, roughness: 1, metalness: 0, clearcoat: 0, clearcoatRoughness: 1, specularIntensity: 0, envMapIntensity: 0 },
  };
}

export function world({ track, view }) { return createPixelWorld({ track, view }); }

export function light() {
  return {
    preset: 'Gallery',
    key: { color: '#fff4d6', intensity: 2.4, dir: [-10, 16, -8] },
    fill: { color: '#cfe0ff', intensity: 0.8, dir: [10, 8, 9] },
    rim: { color: '#ffffff', intensity: 0.3, dir: [8, 5, -12] },
    exposure: 1.0, env: 0.5, floor: '#6aa3f0',
    bg: { top: '#5f9be8', bottom: '#cfe6ff', glow: '#fff3c0', glowAmount: 0.18 },
    post: { bloom: 0, vignette: 0.08, tint: '#ffffff' },
    noFloor: true,
  };
}

// the blob under each figure: a flat dark square on the board, as a block world draws it (the unlit figures cast no shadow map shadow)
const SHADOW_W = { p: 0.5, r: 0.8, n: 0.7, b: 0.62, q: 0.78, k: 0.62 };
export function pieceStyle(ctx) {
  const geo = new THREE.PlaneGeometry(1, 1).rotateX(-Math.PI / 2);
  const mat = new THREE.MeshBasicMaterial({ color: 0x000000, transparent: true, opacity: 0.3, depthWrite: false, polygonOffset: true, polygonOffsetFactor: -2, polygonOffsetUnits: -2 });
  const style = createPieceStyle(ctx, {
    id: 'pixel',
    build: buildPixelVox,
    mesher: { shade: true },
    makeMaterial: (tex) => new THREE.MeshBasicMaterial({ map: tex, vertexColors: true }),
    decorate(inner, type) {
      const s = new THREE.Mesh(geo, mat);
      s.name = 'blob';
      s.position.y = 0.003;
      s.scale.set(SHADOW_W[type] * (type === 'n' ? 0.8 : 1), 1, SHADOW_W[type] * (type === 'n' ? 1.5 : 1));
      s.renderOrder = 1;
      inner.add(s);
    },
  });
  const dispose = style.dispose;
  style.dispose = () => { dispose(); geo.dispose(); mat.dispose(); };
  return style;
}
