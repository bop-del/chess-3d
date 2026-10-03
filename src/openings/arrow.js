// The move hint on the 3D board: the from-square marked quietly, the to-square marked strongly, and a straight arrow
// from one to the other (knights included). One switch turns all three off. Everything lives in the gimbal group, flat
// on the board, so it tilts and turns with it. Squares are rules-engine indices (rank * 8 + file).
import * as THREE from 'three';

const GOLD = 0xd8b468;
// The look of every hint arrow, set by the theme (themes/registry.js, board spec `hint`): { from, to, arrow, outline }. The default
// is the quiet gold on the classic squares; Blocks has green grass, so it brings a cream arrow with a dark outline.
const DEFAULT_STYLE = { from: GOLD, to: GOLD, arrow: GOLD, outline: 0, fromOp: 0.22, toOp: 0.5, arrowOp: 0.78 };
let style = DEFAULT_STYLE;
const live = new Set();
export function setHintStyle(s) { style = s ? { ...DEFAULT_STYLE, ...s } : DEFAULT_STYLE; for (const fn of live) fn(); }
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
  const fromMat = fill(0.22), toMat = fill(0.5), arrowMat = fill(0.78), outMat = fill(0.6);
  outMat.color.set(0x10131a);
  const square = new THREE.PlaneGeometry(0.94, 0.94).rotateX(-Math.PI / 2);
  const fromMesh = new THREE.Mesh(square, fromMat);
  const toMesh = new THREE.Mesh(square, toMat);
  const arrowMesh = new THREE.Mesh(new THREE.BufferGeometry(), arrowMat);
  // renderOrder above the Tokens view discs (11), so the hint stays on top of them
  for (const m of [fromMesh, toMesh, arrowMesh]) { m.renderOrder = 12; m.position.y = LIFT; group.add(m); }
  arrowMesh.position.y = LIFT * 2;
  // a dark outline under the arrow (a slightly fatter copy), only for themes that ask for it
  const outMesh = new THREE.Mesh(new THREE.BufferGeometry(), outMat);
  outMesh.renderOrder = 12; outMesh.visible = false; group.add(outMesh);
  const applyStyle = () => {
    fromMat.color.set(style.from); toMat.color.set(style.to); arrowMat.color.set(style.arrow);
    fromMat.opacity = style.fromOp; toMat.opacity = style.toOp; arrowMat.opacity = style.arrowOp; outMat.opacity = style.outline;
    outMesh.visible = style.outline > 0;
    drawn = '';   // the outline's shape is cut with the arrow
    redraw();
  };
  live.add(applyStyle);

  let enabled = persist ? readPref() : true;
  let forced = false;  // Help or a wrong move shows the arrow with the switch off, without touching the stored preference
  let wanted = null;   // { from, to } or null
  let drawn = '';

  function redraw() {
    const show = (enabled || forced) && wanted;
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
    outMesh.geometry.dispose();
    outMesh.geometry = new THREE.ShapeGeometry(arrowShape(len + 0.1, 0.16, 0.38, 0.44)).rotateX(Math.PI / 2).translate(-0.05, 0, 0);
    // ShapeGeometry lies in xy; rotateX(+90deg) maps y to z, so the shape's +x stays +x and its y becomes z.
    const ux = dx / dist, uz = dz / dist;
    arrowMesh.position.set(sqX(from) + ux * startGap, LIFT * 2, sqZ(from) + uz * startGap);
    arrowMesh.rotation.set(0, -Math.atan2(uz, ux), 0);
    outMesh.position.set(arrowMesh.position.x, LIFT * 1.5, arrowMesh.position.z); outMesh.rotation.copy(arrowMesh.rotation);
  }
  applyStyle();

  return {
    group,
    // squares as engine indices, or null to clear
    show(from, to) { wanted = from == null || to == null ? null : { from, to }; redraw(); },
    hide() { wanted = null; redraw(); },
    /** show the arrow even while the switch is off; never stored. force(false) puts the switch back in charge. */
    force(on) { forced = !!on; redraw(); },
    get enabled() { return enabled; },
    set enabled(on) { enabled = !!on; if (persist) writePref(enabled); redraw(); },
    get visible() { return group.visible; },
    dispose() {
      gimbal.remove(group); live.delete(applyStyle);
      outMesh.geometry.dispose(); outMat.dispose();
      arrowMesh.geometry.dispose(); square.dispose();
      fromMat.dispose(); toMat.dispose(); arrowMat.dispose();
    },
  };
}
