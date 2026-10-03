// The move hint on the 3D board: the from-square marked quietly, the to-square marked strongly, and a straight arrow
// from one to the other (knights included). One switch turns all three off. Everything lives in the gimbal group, flat
// on the board, so it tilts and turns with it. Squares are rules-engine indices (rank * 8 + file).
import * as THREE from 'three';

const GOLD = 0xd8b468;
const LIFT = 0.012;
const KEY = 'chess3d.hint';

const sqX = (sq) => (sq & 7) - 3.5;
const sqZ = (sq) => 3.5 - (sq >> 3);

function readPref() {
  try { return localStorage.getItem(KEY) !== '0'; } catch (e) { return true; }
}
function writePref(on) {
  try { localStorage.setItem(KEY, on ? '1' : '0'); } catch (e) { /* storage may be blocked */ }
}

// Arrow outline in a local frame: tail at x = 0, tip at x = len, pointing along +x, drawn in the xz plane.
function arrowShape(len, shaft = 0.1, head = 0.3, headLen = 0.38) {
  const neck = Math.max(0.05, len - headLen);
  const s = new THREE.Shape();
  s.moveTo(0, -shaft);
  s.lineTo(neck, -shaft);
  s.lineTo(neck, -head);
  s.lineTo(len, 0);
  s.lineTo(neck, head);
  s.lineTo(neck, shaft);
  s.lineTo(0, shaft);
  s.closePath();
  return s;
}

// persist: false keeps this hint out of the stored preference (the Good move helper always shows its arrow).
export function createHint({ gimbal, persist = true }) {
  const group = new THREE.Group();
  group.name = 'move-hint';
  group.visible = false;
  gimbal.add(group);

  const fill = (opacity) => new THREE.MeshBasicMaterial({
    color: GOLD, transparent: true, opacity, depthWrite: false, side: THREE.DoubleSide,
    polygonOffset: true, polygonOffsetFactor: -2, polygonOffsetUnits: -2,
  });
  const fromMat = fill(0.22), toMat = fill(0.5), arrowMat = fill(0.78);
  const square = new THREE.PlaneGeometry(0.94, 0.94).rotateX(-Math.PI / 2);
  const fromMesh = new THREE.Mesh(square, fromMat);
  const toMesh = new THREE.Mesh(square, toMat);
  const arrowMesh = new THREE.Mesh(new THREE.BufferGeometry(), arrowMat);
  // renderOrder above the Tokens view discs (11), so the hint stays on top of them
  for (const m of [fromMesh, toMesh, arrowMesh]) { m.renderOrder = 12; m.position.y = LIFT; group.add(m); }
  arrowMesh.position.y = LIFT * 2;

  let enabled = persist ? readPref() : true;
  let wanted = null;   // { from, to } or null
  let drawn = '';

  function redraw() {
    const show = enabled && wanted;
    group.visible = !!show;
    if (!show) { drawn = ''; return; }
    const key = `${wanted.from}-${wanted.to}`;
    if (key === drawn) return;
    drawn = key;
    const { from, to } = wanted;
    fromMesh.position.set(sqX(from), LIFT, sqZ(from));
    toMesh.position.set(sqX(to), LIFT, sqZ(to));
    const dx = sqX(to) - sqX(from), dz = sqZ(to) - sqZ(from);
    const dist = Math.hypot(dx, dz);
    // start clear of the piece's own base, stop a little short of the target centre so the head sits on the square
    const startGap = 0.3, endGap = 0.08;
    const len = Math.max(0.3, dist - startGap - endGap);
    arrowMesh.geometry.dispose();
    arrowMesh.geometry = new THREE.ShapeGeometry(arrowShape(len)).rotateX(Math.PI / 2);
    // ShapeGeometry lies in xy; rotateX(+90deg) maps y to z, so the shape's +x stays +x and its y becomes z.
    const ux = dx / dist, uz = dz / dist;
    arrowMesh.position.set(sqX(from) + ux * startGap, LIFT * 2, sqZ(from) + uz * startGap);
    arrowMesh.rotation.set(0, -Math.atan2(uz, ux), 0);
  }

  return {
    group,
    // squares as engine indices, or null to clear
    show(from, to) { wanted = from == null || to == null ? null : { from, to }; redraw(); },
    hide() { wanted = null; redraw(); },
    get enabled() { return enabled; },
    set enabled(on) { enabled = !!on; if (persist) writePref(enabled); redraw(); },
    get visible() { return group.visible; },
    dispose() {
      gimbal.remove(group);
      arrowMesh.geometry.dispose(); square.dispose();
      fromMat.dispose(); toMat.dispose(); arrowMat.dispose();
    },
  };
}
