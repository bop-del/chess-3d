// Block materials shared by the island and the characters: one material per texture key of the Mesher. Lambert, vertex colours
// carry the per block tint. kit.dispose() frees the materials; the textures go through ctx.track() in the theme registry.
import * as THREE from 'three';
import { blockTextures } from './textures.js';

export function makeKit(track = (t) => t) {
  const T = blockTextures(track);
  const lam = (map, extra = {}) => new THREE.MeshLambertMaterial({ map, vertexColors: true, ...extra });
  const mats = {};
  for (const k of ['grassTop', 'boardL', 'boardD', 'dirt', 'grassSide', 'stone', 'plank', 'crate', 'tileL', 'tileD', 'bark', 'barkTop']) mats[k] = lam(T[k]);
  mats.leaves = lam(T.leaves, { alphaTest: 0.5 });
  mats.water = lam(T.water, { transparent: true, opacity: 0.85 });
  mats.fall1 = lam(T.waterfall, { transparent: true, opacity: 0.88, depthWrite: false });
  mats.fall2 = lam(T.waterfall, { transparent: true, opacity: 0.6, depthWrite: false });
  mats.fall3 = lam(T.waterfall, { transparent: true, opacity: 0.32, depthWrite: false });
  mats.vox = lam(T.vox);
  mats.shell = lam(T.vox, { transparent: true, opacity: 0.58, depthWrite: false });
  mats.cloud = new THREE.MeshLambertMaterial({ map: T.cloud, vertexColors: true, color: 0xffffff, emissive: 0x6a7480 });
  mats.flat = new THREE.MeshLambertMaterial({ vertexColors: true });
  return { T, mats, dispose() { for (const m of Object.values(mats)) m.dispose(); } };
}

/** A Mesher turned into a Group, one mesh per texture key. */
export function toGroup(mesher, kit, { cast = true, receive = true, name } = {}) {
  const g = new THREE.Group();
  if (name) g.name = name;
  for (const [k, geo] of mesher.geometries()) {
    const mesh = new THREE.Mesh(geo, kit.mats[k] || kit.mats.vox);
    mesh.castShadow = cast && !/^(fall|mist|shell)/.test(k);
    mesh.receiveShadow = receive;
    if (/^(fall|shell|mist|water)/.test(k)) mesh.renderOrder = 2;
    g.add(mesh);
  }
  return g;
}
