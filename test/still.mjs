// Stillness detector (src/still.js, CHE-300): TAA may only accumulate while the frame does not change.
import * as THREE from 'three';
import { createStillness } from '../src/still.js';

let fails = 0;
const ok = (c, n) => { console.log(`${c ? 'PASS' : 'FAIL'}  ${n}`); if (!c) fails++; };

const scene = new THREE.Scene();
const camera = new THREE.PerspectiveCamera(35, 1.5, 0.1, 100);
camera.position.set(0, 9, 11); camera.lookAt(0, 0, 0);
const mat = new THREE.MeshStandardMaterial({ color: 0x888888 });
const mesh = new THREE.Mesh(new THREE.BoxGeometry(1, 1, 1), mat);
const inst = new THREE.InstancedMesh(new THREE.PlaneGeometry(1, 1), new THREE.MeshBasicMaterial(), 4);
scene.add(mesh, inst);
const s = createStillness(scene, camera);

ok(s.check() === false, 'first frame is not still');
ok(s.check() === true, 'same frame is still');
mesh.position.x = 1; ok(s.check() === false, 'a moved object breaks it'); ok(s.check() === true, 'and it settles again');
camera.position.x = 2; camera.lookAt(0, 0, 0); ok(s.check() === false, 'a moved camera breaks it'); s.check();
mat.opacity = 0.5; ok(s.check() === false, 'a material fade breaks it'); s.check();
mesh.visible = false; ok(s.check() === false, 'a hidden object breaks it'); s.check();
inst.count = 2; ok(s.check() === false, 'an instance count change breaks it'); s.check();
inst.setMatrixAt(0, new THREE.Matrix4().makeTranslation(1, 0, 0)); inst.instanceMatrix.needsUpdate = true; ok(s.check() === false, 'instanced data breaks it'); s.check();
ok(s.check(1) === false && s.check(1) === true, 'the extra key (lights, theme) breaks it once');
process.exit(fails ? 1 : 0);
