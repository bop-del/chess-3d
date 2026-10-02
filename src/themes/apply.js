// Applies a plain property spec onto shared materials, and puts the original values back. Used for the board, the tray slabs and
// (through the same spec format) the pieces. A spec is { name: { prop: value } }: scalars as they are, colours as '#hex',
// normalScale as a number, maps as THREE.Texture, null clears a map.
const SCALARS = ['roughness', 'metalness', 'clearcoat', 'clearcoatRoughness', 'sheen', 'sheenRoughness', 'specularIntensity', 'ior',
  'envMapIntensity', 'emissiveIntensity', 'transmission', 'thickness', 'attenuationDistance', 'opacity', 'iridescence', 'transparent',
  'vertexColors', 'depthWrite'];
const COLORS = ['color', 'emissive', 'sheenColor', 'specularColor', 'attenuationColor'];
const MAPS = ['map', 'normalMap', 'roughnessMap', 'metalnessMap', 'emissiveMap'];

function snapshot(m) {
  const s = { v: {}, c: {}, m: {} };
  for (const k of SCALARS) if (k in m) s.v[k] = m[k];
  for (const k of COLORS) if (m[k] && m[k].isColor) s.c[k] = m[k].clone();
  for (const k of MAPS) if (k in m) s.m[k] = m[k];
  if (m.normalScale) s.ns = m.normalScale.clone();
  return s;
}

function restore(m, s) {
  Object.assign(m, s.v);
  for (const k in s.c) m[k].copy(s.c[k]);
  Object.assign(m, s.m);
  if (s.ns) m.normalScale.copy(s.ns);
}

/** materials: { name: Material }. Takes the snapshot of today's values at once. apply(specs | null): null is the original. */
export function createSkin(materials) {
  const snaps = new Map();
  for (const m of new Set(Object.values(materials))) if (m) snaps.set(m, snapshot(m));
  return {
    apply(specs) {
      for (const [m, s] of snaps) restore(m, s);
      for (const name in specs || {}) {
        const m = materials[name], spec = specs[name];
        if (!m || !spec) continue;
        for (const k in spec) {
          const v = spec[k];
          if (COLORS.includes(k)) m[k].set(v);
          else if (k === 'normalScale') m.normalScale.set(v, v);
          else m[k] = v;
        }
      }
      for (const m of snaps.keys()) m.needsUpdate = true;
    },
  };
}
