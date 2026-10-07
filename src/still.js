// Stillness detector for temporal anti aliasing (CHE-300). The accumulated TAA image is only valid while nothing on screen changes:
// camera, object transforms, visibility, material look, instanced data. check() returns true when this frame is identical to the last
// one, false as soon as anything differs (a hash of those values, no allocation per frame).
const f32 = new Float32Array(1), u32 = new Uint32Array(f32.buffer);

export function createStillness(scene, camera) {
  let last = -1;
  let h = 0;
  const mix = (v) => { f32[0] = v; h = Math.imul(h ^ u32[0], 16777619) >>> 0; };
  const mixTex = (t) => { if (t) { mix(t.id); mix(t.version); } };

  function walk(o) {
    mix(o.visible ? 1 : 0);
    const e = o.matrixWorld.elements;
    for (let i = 0; i < 16; i++) mix(e[i]);
    if (o.isMesh || o.isPoints || o.isLine) {
      const m = o.material;
      if (Array.isArray(m)) for (const x of m) mat(x); else if (m) mat(m);
      if (o.isInstancedMesh) { mix(o.count); mix(o.instanceMatrix.version); if (o.instanceColor) mix(o.instanceColor.version); }
      if (o.geometry) { mix(o.geometry.id); const p = o.geometry.attributes.position; if (p) mix(p.version); }
    }
    for (let i = 0, c = o.children; i < c.length; i++) if (c[i].visible) walk(c[i]); else mix(c[i].id);
  }
  function mat(m) {
    mix(m.id); mix(m.opacity);
    if (m.color) { mix(m.color.r); mix(m.color.g); mix(m.color.b); }
    if (m.emissive) { mix(m.emissive.r); mix(m.emissive.g); mix(m.emissive.b); }
    mixTex(m.map);
    if (m.uniforms) for (const k in m.uniforms) { const v = m.uniforms[k].value; if (typeof v === 'number') mix(v); else if (v && v.isTexture) mixTex(v); else if (v && v.isColor) { mix(v.r); mix(v.g); mix(v.b); } }
  }

  return {
    /** true when nothing changed since the last call. Call once per frame, before rendering. */
    check(extra = 0) {
      scene.updateMatrixWorld();
      camera.updateMatrixWorld();
      h = 2166136261;
      mix(extra);
      const p = camera.projectionMatrix.elements, w = camera.matrixWorld.elements;
      for (let i = 0; i < 16; i++) { mix(p[i]); mix(w[i]); }
      mix(scene.fog ? scene.fog.near : 0); mix(scene.environmentIntensity);
      walk(scene);
      const still = h === last;
      last = h;
      return still;
    },
    reset() { last = -1; }
  };
}
