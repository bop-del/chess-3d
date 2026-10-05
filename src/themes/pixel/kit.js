// Pixelwelt materials: unlit (MeshBasicMaterial) because the face shading is baked into the vertex colours by the Mesher
// (top brightest, sides darker by fixed factors), so no smooth gradients anywhere. One material per texture key.
import * as THREE from 'three';
import { pixelTextures } from './textures.js';
import { pixLight, WARM } from '../pixel.js';

export function makePixelKit(track = (t) => t) {
  const T = pixelTextures(track);
  const warm = pixLight() === 'b';   // variant b: a warm multiplier colour on the unlit materials (the sun keeps its own colour)
  const bas = (map, extra = {}) => new THREE.MeshBasicMaterial({ map, vertexColors: true, ...(warm && map !== T.sun ? { color: WARM.world } : {}), ...extra });
  const mats = {};
  for (const k of ['grassTop', 'grassSide', 'dirt', 'stone', 'cobble', 'sand', 'planks', 'logSide', 'logTop', 'sun']) mats[k] = bas(T[k]);
  mats.crate = bas(T.planks);
  mats.leaves = bas(T.leaves, { alphaTest: 0.5 });
  mats.water = bas(T.water);   // opaque: a see through pond shows the open sky through the unclosed side (S61, rule: translucent only over closed ground)
  mats.fall = bas(T.fall);   // the waterfall sheet: opaque too
  mats.cloud = bas(T.cloud, { transparent: true });
  mats.flat = new THREE.MeshBasicMaterial({ vertexColors: true });
  return { T, mats, dispose() { for (const m of Object.values(mats)) m.dispose(); } };
}
