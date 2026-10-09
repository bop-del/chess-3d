// Piece set factory: builds each (type, color) once, hands out clones that share geometry.
import * as THREE from 'three';
import { buildPawn, buildRook, buildKnight } from './pieces/setA.js';
import { buildBishop, buildQueen, buildKing } from './pieces/setB.js';

const BUILDERS = { p: buildPawn, r: buildRook, n: buildKnight, b: buildBishop, q: buildQueen, k: buildKing };
const NAMES = { p: 'pawns', r: 'rooks', n: 'knights', b: 'bishops', q: 'queens', k: 'kings' };
const TYPES = ['p', 'n', 'b', 'r', 'q', 'k'];
// Preview piece sets for the lit themes (?pieces=<id>, CHE-367): each module exports BUILDERS { p, r, n, b, q, k } like the Staunton set.
const VARIANTS = {
  fantasy: () => import('./pieces/fantasy.js'),
  animals: () => import('./pieces/animals.js'),
};
export const loadPieceVariant = (id) => (VARIANTS[id] ? VARIANTS[id]().then((m) => m.BUILDERS, () => null) : Promise.resolve(null));   // a failed chunk keeps Staunton

// rAF never fires in a background tab, so race it with a timer. A hidden tab has nothing to repaint and clamps timers
// to 1 s, so it does not wait at all.
const tick = () => document.hidden ? Promise.resolve() : new Promise((res) => {
  let done = false;
  const go = () => { if (!done) { done = true; setTimeout(res, 0); } };
  requestAnimationFrame(go);
  setTimeout(go, 50);
});

export function createPieceSet(materials, builders = BUILDERS) {
  const protos = new Map();
  const heights = new Map();
  // A piece style (the Blocks theme) replaces the lathe pieces with its own: { make(type, color) -> inner group, height(type, color),
  // warm(type, color), update(dt, root), dispose() }. null is the classic set, whose pieces only change materials per theme.
  let style = null;
  const innerTurn = (type, color) => (color === 'b' && type !== 'n' ? Math.PI : 0);
  const dias = new Map();       // base diameter (the wider of the two footprint sides), board units

  // Geometry does not depend on color, so only white is built. Black is a clone that shares the geometry and swaps the
  // two piece materials (the knight's dark inlay material belongs to neither color and stays).
  function proto(type, color) {
    const key = type + color;
    let p = protos.get(key);
    if (!p) {
      if (color === 'w') {
        p = (builders || BUILDERS)[type](materials.white);
        p.updateMatrixWorld(true);
        const box = new THREE.Box3().setFromObject(p);
        heights.set(key, Math.max(0.6, box.max.y));
        dias.set(key, Math.max(box.max.x - box.min.x, box.max.z - box.min.z));
        p.traverse((o) => {
          if (!o.isMesh) return;
          o.castShadow = true; o.receiveShadow = true;
          if (o.material !== materials.white.body && o.material !== materials.white.accent && !materials.dark) {
            materials.dark = o.material; // knight inlay: joins the Classic snapshot and the active theme
            materials.apply?.(materials.current);
          }
        });
      } else {
        const white = proto(type, 'w');
        p = white.clone(true);
        p.traverse((o) => {
          if (!o.isMesh) return;
          if (o.material === materials.white.body) o.material = materials.black.body;
          else if (o.material === materials.white.accent) o.material = materials.black.accent;
        });
        heights.set(key, heights.get(type + 'w'));
        dias.set(key, dias.get(type + 'w'));
      }
      protos.set(key, p);
    }
    return p;
  }

  return {
    // Returns a fresh Group: outer wrapper (game owns position/scale), inner clone (black rotated by PI, except knights, which the game turns by file).
    make(type, color) {
      const wrap = new THREE.Group();
      const inner = style ? style.make(type, color) : proto(type, color).clone(true);
      inner.rotation.y = innerTurn(type, color);
      wrap.add(inner);
      wrap.name = `${color}${type}`;
      wrap.userData.piece = { type, color };
      wrap.userData.style = style ? style.id : null;
      wrap.userData.height = style ? style.height(type, color) : heights.get(type + color);
      wrap.userData.dia = dias.get(type + color);
      return wrap;
    },
    height(type, color) { if (style) return style.height(type, color); proto(type, color); return heights.get(type + color); },
    get style() { return style; },
    setStyle(next) { if (next === style) return; const old = style; style = next || null; old?.dispose?.(); },
    // The style changed under a piece that is already on the board: swap its inner group (keeps the turn), returns the new height.
    restyle(wrap) {
      const { type, color } = wrap.userData.piece;
      const old = wrap.children[0];
      const inner = style ? style.make(type, color) : proto(type, color).clone(true);
      inner.rotation.y = old ? old.rotation.y : innerTurn(type, color);
      old?.removeFromParent();
      wrap.userData.style = style ? style.id : null;
      wrap.add(inner);
      wrap.children.unshift(wrap.children.pop());   // the inner group stays children[0]: the game, the scenes and picking rely on it
      wrap.userData.height = style ? style.height(type, color) : heights.get(type + color) ?? this.height(type, color);
      return wrap.userData.height;
    },
    update(dt, root) { style?.update?.(dt, root); },
    // Builds all 12 prototypes, yielding to the event loop between each so the loader can animate.
    async buildAll(onProgress) {
      let i = 0;
      const total = TYPES.length * 2;
      for (const color of ['w', 'b']) {
        for (const type of TYPES) {
          onProgress?.(i / total, `Turning ${color === 'w' ? 'ivory' : 'ebony'} ${NAMES[type]}`);
          await tick();
          if (style) style.warm?.(type, color); else proto(type, color);
          i++;
        }
      }
      onProgress?.(1, 'Pieces ready');
    },
  };
}
