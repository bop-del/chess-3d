// piece materials (ivory, ebony, gold). Lit by scene.environment.
import * as THREE from 'three';

export function createPieceMaterials() {
  // Warm polished ivory with a soft sheen, lacquered by a clearcoat.
  const ivory = new THREE.MeshPhysicalMaterial({
    name: 'ivory',
    color: new THREE.Color('#ece2cc'),
    roughness: 0.34,
    metalness: 0.0,
    clearcoat: 0.85,
    clearcoatRoughness: 0.10,
    sheen: 0.6,
    sheenRoughness: 0.45,
    sheenColor: new THREE.Color('#ffd9a0'),
    specularIntensity: 0.8,
    ior: 1.55,
    envMapIntensity: 1.0,
  });

  // Deep obsidian ebony: near black base, strong glossy coat, faint cold blue sheen on grazing angles.
  const ebony = new THREE.MeshPhysicalMaterial({
    name: 'ebony',
    color: new THREE.Color('#0d0f15'),
    roughness: 0.22,
    metalness: 0.0,
    clearcoat: 1.0,
    clearcoatRoughness: 0.04,
    sheen: 0.5,
    sheenRoughness: 0.35,
    sheenColor: new THREE.Color('#2b4a82'),
    specularIntensity: 1.0,
    specularColor: new THREE.Color('#b8c8ff'),
    ior: 1.65,
    envMapIntensity: 1.15,
  });

  const goldWhite = new THREE.MeshPhysicalMaterial({
    name: 'gold-bright',
    color: new THREE.Color('#e8b850'),
    roughness: 0.20,
    metalness: 1.0,
    clearcoat: 0.25,
    clearcoatRoughness: 0.08,
    envMapIntensity: 1.15,
  });

  // A touch deeper and warmer so it still reads against ivory-white neighbours and black alike.
  const goldBlack = new THREE.MeshPhysicalMaterial({
    name: 'gold-antique',
    color: new THREE.Color('#d9a441'),
    roughness: 0.17,
    metalness: 1.0,
    clearcoat: 0.25,
    clearcoatRoughness: 0.08,
    envMapIntensity: 1.2,
  });

  const set = {
    white: { body: ivory, accent: goldWhite },
    black: { body: ebony, accent: goldBlack },
    dark: null, // the knight's inlay material, filled in by pieceset.js when the first knight is built
    classic: new Map(),
  };
  set.current = null;
  set.apply = (spec) => { set.current = spec || null; applyPieceTheme(set, spec); };
  applyPieceTheme(set, null); // snapshot of Classic
  return set;
}

// ---- piece themes: a theme changes material parameters only, geometry is shared. The Classic values are snapshotted on
// the first call and every theme starts from them, so a switch never inherits the previous theme.
const SCALARS = ['roughness', 'metalness', 'clearcoat', 'clearcoatRoughness', 'sheen', 'sheenRoughness', 'specularIntensity', 'ior',
  'envMapIntensity', 'emissiveIntensity', 'transmission', 'thickness', 'attenuationDistance', 'opacity', 'transparent', 'depthWrite'];
const COLORS = ['color', 'emissive', 'sheenColor', 'specularColor', 'attenuationColor'];
const MAPS = ['map', 'normalMap', 'roughnessMap', 'metalnessMap', 'emissiveMap'];

function themed(materials) {
  return [materials.white.body, materials.black.body, materials.white.accent, materials.black.accent, materials.dark].filter(Boolean);
}
function snapshot(m) {
  const s = { scalars: {}, colors: {}, maps: {} };
  for (const k of SCALARS) if (k in m) s.scalars[k] = m[k];
  for (const k of COLORS) if (m[k]?.isColor) s.colors[k] = m[k].clone();
  for (const k of MAPS) if (k in m) s.maps[k] = m[k];
  return s;
}
function restore(m, s) {
  Object.assign(m, s.scalars);
  for (const k in s.colors) m[k].copy(s.colors[k]);
  Object.assign(m, s.maps);
  m.needsUpdate = true;
}
function assign(m, props) {
  if (!m || !props) return;
  for (const k in props) {
    const v = props[k];
    if (COLORS.includes(k)) m[k].set(v);
    else m[k] = v;
  }
  m.needsUpdate = true;
}

// spec = what a themes/pieces-<id>.js pieces(ctx) returns: { white: { body, accent }, black: { body, accent }, dark? }.
// Props are plain material parameters (colours as hex strings, maps as textures the theme owns, null clears a map).
// null restores Classic. Texture disposal is the caller's job (the theme registry tracks them).
// The knight inlay (materials.dark) appears with the first knight, so it joins the snapshot whenever it first shows up.
export function applyPieceTheme(materials, spec) {
  const mats = themed(materials);
  for (const m of mats) if (!materials.classic.has(m)) materials.classic.set(m, snapshot(m));
  for (const m of mats) restore(m, materials.classic.get(m));
  if (!spec) return;
  assign(materials.white.body, spec.white?.body);
  assign(materials.black.body, spec.black?.body);
  assign(materials.white.accent, spec.white?.accent);
  assign(materials.black.accent, spec.black?.accent);
  assign(materials.dark, spec.dark);
}
