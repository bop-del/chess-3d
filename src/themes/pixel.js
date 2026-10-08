// Pixelwelt ("Pixel world", ?theme=pixel): a world of 16 x 16 pixel blocks and blocky figures, everything drawn in code. Shares the
// mesher, the rig (animation) and the screen space avoid pass with Blocks; own textures, unlit materials with fixed per face shading,
// own world (pixel/world.js) and own figures (pixel/figures.js).
import * as THREE from 'three';
import { createPixelWorld } from './pixel/world.js';
import { buildPixelVox } from './pixel/figures.js';
import { withBirds } from './pixel/birds.js';
import { createPieceStyle } from './blocks/rig.js';
import { labelAtlas } from './pixel/textures.js';
import { SKIES, look, onLook, skyLight, WARM as WARM_LOOK } from './pixel/look.js';

/** Board spec: classic squares hidden, the labels lie on the grass ring around the board (no frame): cream with a dark outline. */
export function board({ track } = {}) {
  return {
    hide: true,
    labelLift: -0.04,   // board.js puts labels at y 0.0615, so they lie 0.02 above the grass top (y = 0)
    labels: { map: labelAtlas(track), color: '#ffffff', metalness: 0, roughness: 1, envMapIntensity: 0 },
  };
}

export function world({ track, view, quality }) { return withBirds(createPixelWorld({ track, view, light: quality === 'low' || (typeof document !== 'undefined' && document.body?.classList.contains('phone')) })); }

export const WARM = WARM_LOOK;   // multiplier colours of the evening (texture pixels stay as drawn)

// The sky (CHE-239) decides the light: ?sky=, ?set= and the Options rows, see pixel/look.js. Default: the set Inselmorgen (sunrise).
export function light() { return skyLight(look().sky); }

// the blob under each figure: a flat dark square on the board, as a block world draws it (the unlit figures cast no shadow map shadow)
const SHADOW_W = { p: 0.5, r: 0.8, n: 0.7, b: 0.62, q: 0.78, k: 0.62 };
export function pieceStyle(ctx) {
  const figMats = new Set();   // the figure materials: the sky's multiplier colour follows the Sky choice
  const unsub = onLook((l) => { for (const m of figMats) m.color.setHex(SKIES[l.sky].fig); });
  const geo = new THREE.PlaneGeometry(1, 1).rotateX(-Math.PI / 2);
  const mat = new THREE.MeshBasicMaterial({ color: 0x000000, transparent: true, opacity: 0.3, depthWrite: false, polygonOffset: true, polygonOffsetFactor: -2, polygonOffsetUnits: -2 });
  const style = createPieceStyle(ctx, {
    id: 'pixel',
    build: buildPixelVox,
    mesher: { shade: true },
    makeMaterial: (tex) => { const m = new THREE.MeshBasicMaterial({ map: tex, vertexColors: true, color: SKIES[look().sky].fig }); figMats.add(m); return m; },
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
  style.dispose = () => { unsub(); figMats.clear(); dispose(); geo.dispose(); mat.dispose(); };
  return style;
}
