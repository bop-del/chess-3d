// Pixelwelt rules (S61, CHE-166), fast tier, no browser: the world is built in node (a stub canvas stands in for the texture canvases)
// and four rules are checked, so the rendering artifacts of the pond, posts, dirt edge and trays cannot come back.
//   1 Translucent surfaces only over closed ground: every mesh with opacity under 1 gets rays from its surface in a fan of directions
//     below the horizon; a ray that leaves into open sky or void (hits nothing) is an open gap under it.
//   2 No coplanar overlapping faces: boxes that draw a face on the same plane, the same way round, over an area and look different.
//   3 One tile textures clamp: every Pixelwelt texture and its wrap mode against an allow list (Repeat only where it tiles on purpose).
//   4 One material set: every mesh of the theme uses the flat unlit material (MeshBasicMaterial) with a pixel texture, the tray floor
//     is the planks texture, fully emissive (no lit part).
// Run: node test/pixel-rules.mjs    Exit 0 pass, 1 on any failed check.
import * as THREE from 'three';

globalThis.document = { createElement: () => ({ width: 0, height: 0, getContext: () => ({ fillRect() {}, clearRect() {}, drawImage() {}, getImageData: () => ({ data: new Uint8ClampedArray(4) }), putImageData() {} }) }) };
const { createPixelWorld } = await import('../src/themes/pixel/world.js');
const { pixelTextures } = await import('../src/themes/pixel/textures.js');
const { board } = await import('../src/themes/pixel.js');
const { coplanarOverlaps } = await import('../src/themes/blocks/mesher.js');

let failed = 0;
const check = (name, ok, detail = '') => { console.log(`${ok ? 'PASS' : 'FAIL'}  ${name}${detail ? '  ' + detail : ''}`); if (!ok) failed++; };

const world = createPixelWorld({});
world.group.updateMatrixWorld(true);
const meshes = [];
world.group.traverse((o) => { if (o.isMesh) meshes.push(o); });

// 1 translucent over closed ground. Clouds are the one exception: they float over the sky by design and only fade near the UI controls.
{
  const subjects = meshes.filter((m) => m.material.opacity < 1 && m.parent?.name !== 'cloud');
  const solid = meshes.filter((m) => !subjects.includes(m));
  const rc = new THREE.Raycaster(); rc.far = 500;
  let rays = 0; const holes = [];
  for (const s of subjects) {
    const p = s.geometry.attributes.position, V = (i) => new THREE.Vector3().fromBufferAttribute(p, i).applyMatrix4(s.matrixWorld);
    for (let q = 0; q + 3 < p.count; q += 4) {
      const [a, b, , d] = [V(q), V(q + 1), V(q + 2), V(q + 3)];
      for (const u of [0.1, 0.5, 0.9]) for (const v of [0.1, 0.5, 0.9]) {
        const o = a.clone().addScaledVector(b.clone().sub(a), u).addScaledVector(d.clone().sub(a), v); o.y -= 0.01;
        for (let yaw = 0; yaw < 360; yaw += 30) for (const pitch of [10, 25, 45, 70]) {
          const t = pitch * Math.PI / 180, y = yaw * Math.PI / 180;
          rc.set(o, new THREE.Vector3(Math.cos(t) * Math.sin(y), -Math.sin(t), Math.cos(t) * Math.cos(y)));
          rays++;
          if (!rc.intersectObjects(solid, false).length) holes.push(`${o.x.toFixed(1)},${o.z.toFixed(1)} yaw ${yaw} pitch ${pitch}`);
        }
      }
    }
  }
  check('translucent surfaces lie over closed ground', holes.length === 0, subjects.length ? `${subjects.length} meshes, ${rays} rays, ${holes.length} open${holes.length ? ' e.g. ' + holes.slice(0, 2).join('; ') : ''}` : 'no translucent mesh in the world');
}

// 2 coplanar overlapping faces
{
  const groups = []; world.group.traverse((o) => { if (o.userData.boxes) groups.push(o); });
  let boxes = 0; const bad = [];
  for (const g of groups) { boxes += g.userData.boxes.length; for (const r of coplanarOverlaps(g.userData.boxes)) bad.push(`${g.name} ${r.face} at ${[r.a.x, r.a.y, r.a.z].map((n) => +n.toFixed(2))} and ${[r.b.x, r.b.y, r.b.z].map((n) => +n.toFixed(2))}`); }
  check('no coplanar overlapping faces between boxes', bad.length === 0 && boxes > 100, `${boxes} boxes, ${bad.length} clashes${bad.length ? ' e.g. ' + bad.slice(0, 2).join('; ') : ''}`);
  // the finder itself: two boxes sharing a top plane clash, stacked ones do not
  const A = { x: 0, y: 0, z: 0, w: 1, h: 1, d: 1, ry: 0, color: 0xffffff, faces: { py: 'a' } }, B = { ...A, x: 0.5, faces: { py: 'b' } }, C = { ...A, y: 1, faces: { py: 'b' } };
  check('finder: shared top plane clashes, stacked boxes do not', coplanarOverlaps([A, B]).length === 1 && coplanarOverlaps([A, C]).length === 0);
}

// 3 wrap modes
{
  const ALLOW_REPEAT = ['water', 'fall', 'planks', 'cloud', 'sun'];
  const T = pixelTextures();
  const wrong = Object.entries(T).filter(([k, t]) => {
    const want = ALLOW_REPEAT.includes(k) ? THREE.RepeatWrapping : THREE.ClampToEdgeWrapping;
    return t.wrapS !== want || t.wrapT !== want;
  }).map(([k]) => k);
  check('Pixelwelt textures: Repeat only on the allow list, everything else clamps', wrong.length === 0, `${Object.keys(T).length} textures${wrong.length ? ', wrong: ' + wrong.join(', ') : ''}`);
}

// 4 one material set
{
  const bad = meshes.filter((m) => !(m.material.isMeshBasicMaterial && (m.material.map || m.material.vertexColors))).map((m) => `${m.parent?.name}/${m.name}`);
  const untextured = [...new Set(meshes.filter((m) => !m.material.map && m.material !== world.kit.mats.flat).map((m) => m.parent?.name))];
  check('every mesh of the world is unlit (MeshBasicMaterial)', bad.length === 0, `${meshes.length} meshes${bad.length ? ', lit: ' + bad.slice(0, 3).join(', ') : ''}`);
  check('every mesh of the world has a pixel texture (only the flat colour blocks are plain)', untextured.length === 0, untextured.join(', '));
  const t = board({ track: (x) => x }).tray;
  const ok = t && t.emissiveMap?.isTexture && t.color === '#000000' && t.emissive === '#ffffff' && t.specularIntensity === 0 && t.clearcoat === 0 && t.envMapIntensity === 0 && !t.map
    && t.emissiveMap.wrapS === THREE.RepeatWrapping;
  check('tray floor: planks texture, fully emissive (no lit part)', !!ok);
}

// 5 no cloud through the tree (CHE-184): every cloud swept over the full drift span (x from -35 to 35) and the full lift range
// (0 to LIFT 14 in steps of 0.5, buildAvoid lifts clouds for a low camera) never intersects the tree box (trunk and leaves)
{
  const trees = [['Pixelwelt', world]];
  try { const { createWorld } = await import('../src/themes/blocks/island.js'); trees.push(['Blocks', createWorld({})]); } catch (e) { console.log('NOTE  Blocks world not built in node: ' + e.message); }
  for (const [name, w] of trees) {
    w.group.updateMatrixWorld(true);
    const treeBox = new THREE.Box3();
    w.group.traverse((o) => { if (o.name === 'tree') treeBox.union(new THREE.Box3().setFromObject(o)); });
    const clouds = w.group.children.filter((o) => o.name === 'cloud');
    const hits = [];
    clouds.forEach((c, i) => {
      const { local, y0 } = c.userData, pz = c.position.z;
      for (let lift = 0; lift <= 14; lift += 0.5) for (let x = -35; x <= 35; x += 0.5) {
        const b = new THREE.Box3(new THREE.Vector3(local.min.x + x, local.min.y + y0 + lift, local.min.z + pz), new THREE.Vector3(local.max.x + x, local.max.y + y0 + lift, local.max.z + pz));
        if (b.intersectsBox(treeBox)) { hits.push(`cloud ${i} (z ${pz}) at x ${x} lift ${lift}`); return; }
      }
    });
    check(`${name}: no cloud passes through the tree (${clouds.length} clouds, drift span and lift range swept)`, !treeBox.isEmpty() && clouds.length === 7 && hits.length === 0, hits.join('; '));
  }
}

// 5 Light variants (CHE-181): ?pixlight=a is daylight, b the warm evening mood; both keep every mesh flat and unlit, b only tints
// through the sky, the grade and the material multiplier colour (no lights, no new textures).
{
  const { light, WARM, PIXLIGHT_DEFAULT } = await import('../src/themes/pixel.js');
  const hex = (c) => '#' + c.getHexString();
  for (const v of ['a', 'b']) {
    globalThis.location = { search: `?pixlight=${v}` };
    const L = light(), w = createPixelWorld({}), ms = [];
    w.group.traverse((o) => { if (o.isMesh) ms.push(o); });
    const unlit = ms.every((m) => m.material.isMeshBasicMaterial && (m.material.map || m.material.vertexColors));
    const sunOk = ms.filter((m) => m.parent?.name === 'sun').every((m) => m.material.color.getHex() === 0xffffff);
    const tinted = ms.filter((m) => m.parent?.name !== 'sun' && m.material.map).every((m) => m.material.color.getHex() === (v === 'b' ? WARM.world : 0xffffff));
    check(`variant ${v}: sky, grade and multiplier as specified, every mesh unlit`, unlit && sunOk && tinted && (v === 'b' ? L.bg.bottom === '#ffd6a8' && L.post.tint === '#fff0e0' && L.exposure === 0.88 : L.bg.bottom === '#cfe6ff' && L.post.tint === '#ffffff' && L.exposure === 1.0), `${ms.length} meshes`);
    w.dispose();
  }
  globalThis.location = { search: '' };
  check(`variant default is ${PIXLIGHT_DEFAULT} without the flag`, light().bg.bottom === (PIXLIGHT_DEFAULT === 'b' ? '#ffd6a8' : '#cfe6ff'));
  globalThis.location = { search: '?pixlight=x' };
  check('a bad pixlight value falls back to the default', light().bg.bottom === (PIXLIGHT_DEFAULT === 'b' ? '#ffd6a8' : '#cfe6ff'));
  delete globalThis.location;
}

console.log(failed ? `\n${failed} CHECK(S) FAILED` : '\nPIXEL RULES PASSED');
process.exit(failed ? 1 : 0);
