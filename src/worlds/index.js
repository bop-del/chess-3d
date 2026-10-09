// World backdrops around the board for the lit themes (CHE-370 preview): ?world=hall|space|zen|lava. No flag: nothing here is loaded.
// A world module (src/worlds/<id>.js, loaded with import() on use) exports build(ctx) -> {
//   group,            // THREE.Group, added to the gimbal (the board's coordinates: board top y = 0, squares 1.0, the stage floor y = FLOOR_Y)
//   look: { fog: '#hex', near, far },   // fog colour, and the fog start and end beyond the camera distance (stage.setWorldLook)
//   update(dt, t),    // per frame: flicker, petals, sparks (t: seconds since the world was built)
//   dispose(),        // optional: anything the manager cannot see (the manager disposes every geometry, material and texture in group)
// }
// ctx = { THREE, quality: 'low'|'medium'|'high', lite (phone or quality low: fewer parts, no extra lights), phone }.
// The board, the pieces and the captured pieces (they stand on y = FLOOR_Y beside the board) stay as they are; the world keeps
// clear of the board and of the capture areas. Themes with a world of their own (Pixelwelt, Blocks) show no backdrop world.
import * as THREE from 'three';

export const WORLDS = ['hall', 'space', 'zen', 'lava'];
const LOADERS = {
  hall: () => import('./hall.js'),
  space: () => import('./space.js'),
  zen: () => import('./zen.js'),
  lava: () => import('./lava.js'),
};
const OWN_WORLD = new Set(['pixel', 'blocks']);

/** Everything a world group holds on the GPU: geometries, materials and their textures (maps and texture uniforms). */
export function disposeTree(root) {
  const mats = new Set(), geos = new Set(), texs = new Set();
  root.traverse((o) => {
    if (o.geometry) geos.add(o.geometry);
    for (const m of [].concat(o.material || [])) mats.add(m);
  });
  for (const m of mats) {
    for (const k in m) { const v = m[k]; if (v && v.isTexture) texs.add(v); }
    if (m.uniforms) for (const k in m.uniforms) { const v = m.uniforms[k].value; if (v && v.isTexture) texs.add(v); }
    m.dispose();
  }
  for (const g of geos) g.dispose();
  for (const t of texs) t.dispose();
}

// The ambient occlusion pass (GTAOPass) draws every mesh with its own override material and hides only points and lines: a glow,
// flame or light shaft would leave a dark quad there, an InstancedMesh one copy at the board centre. Transparent meshes, sprites and
// instanced meshes of a world draw nothing in any pass but their own.
const plainBeforeRender = THREE.Object3D.prototype.onBeforeRender;
function ownPassOnly(root) {
  root.traverse((o) => {
    if (!(o.isMesh || o.isSprite) || Array.isArray(o.material) || !(o.material?.transparent || o.isInstancedMesh) || o.onBeforeRender !== plainBeforeRender) return;
    const keep = o.geometry.drawRange.count;
    o.onBeforeRender = (r, s, c, geo, mat) => { geo.drawRange.count = mat === o.material ? keep : 0; };
  });
}

export function mountWorld({ id: first = null, stage, gimbal, themes, phone = false }) {
  let id = Object.hasOwn(LOADERS, first) ? first : null;   // null: no world (the Options pick None); setId changes it without a reload
  let mod = null, built = null, builtId = null, t = 0, gen = 0, builtLite = null;
  const lite = () => phone || stage.quality === 'low';

  function drop(keepFloor) {
    if (!built) return;
    built.group.parent?.remove(built.group);
    try { built.dispose?.(); } catch (e) { console.warn('world dispose', e); }
    disposeTree(built.group);
    built = null; builtId = null;
    stage.setWorldLook(null);
    if (!keepFloor) stage.setFloorHidden(false);
  }
  async function show() {
    const g = ++gen;
    if (!id) { drop(false); return; }
    if (OWN_WORLD.has(themes.current())) { drop(true); return; }
    if (built && builtId === id && builtLite === lite()) { stage.setFloorHidden(true); return; }   // a theme switch reset the floor: the world keeps its own ground
    mod ??= await LOADERS[id]();
    if (g !== gen) return;
    drop(true);
    builtLite = lite(); builtId = id;
    built = mod.build({ THREE, quality: stage.quality, lite: builtLite, phone });
    built.group.name = `world-${id}`;
    ownPassOnly(built.group);
    gimbal.add(built.group);
    t = 0;
    stage.setFloorHidden(true);
    stage.setWorldLook({ fog: built.look.fog, near: built.look.near, far: built.look.far, moving: true });
  }

  let ready = show().catch((e) => console.warn('world not built', e));
  themes.on(() => { show().catch((e) => console.warn('world not built', e)); });
  stage.onQuality?.(() => { if (built && builtLite !== lite()) show().catch((e) => console.warn('world not built', e)); });

  return {
    get id() { return id; }, ready,
    setId(next) {
      const n = Object.hasOwn(LOADERS, next) ? next : null;
      if (n === id) return this.ready;
      id = n; mod = null;
      this.ready = show().catch((e) => console.warn('world not built', e));
      return this.ready;
    },
    get group() { return built?.group || null; },
    get lite() { return builtLite; },
    update(dt) { if (!built) return; t += dt; built.update?.(dt, t); },
    dispose() { gen++; drop(OWN_WORLD.has(themes.current())); },
  };
}
