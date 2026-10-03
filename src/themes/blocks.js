// Blocks: a floating block island with a grass and stone board, a plank frame, a tree, a waterfall and drifting clouds. The classic
// board meshes are hidden (board.applyTheme `hide`), the island is built here as its own world and lives in the gimbal next to the
// board. Pieces and their animation: blocks/chars.js (exported below). Textures: 32 px per block face, drawn in code.
import { createWorld } from './blocks/island.js';

export * from './blocks/chars.js';

/** Board spec: the classic squares, frame and plinth are hidden; the labels lift onto the plank frame and lose their gold. */
export function board() {
  return {
    hide: true,
    labelLift: 0.3,
    labels: { color: '#fff2c8', metalness: 0, roughness: 1, envMapIntensity: 0 },
    // green grass squares: the move ring is cream with a dark outline, the hint is a cream arrow with a dark outline over orange squares
    marks: { move: { ring: [1.0, 0.96, 0.78], dot: [1.0, 1.0, 0.92], edge: 0.7 } },
    hint: { from: 0xffb02e, to: 0xffa01a, arrow: 0xfff3c4, outline: 0.7, fromOp: 0.4, toOp: 0.7, arrowOp: 0.97 },
    tray: { color: '#b9854f', roughness: 1, metalness: 0, clearcoat: 0, clearcoatRoughness: 1 },
  };
}

/** The island, clouds and waterfall: { group, update(dt), dispose() }; the registry adds the group to the gimbal. */
export function world({ track, quality, view }) {
  return createWorld({ track, quality, view });
}

export function light() {
  return {
    preset: 'Gallery',
    key: { color: '#ffc78a', intensity: 2.6, dir: [-16, 9, 9] },        // a warm low evening sun with long shadows
    fill: { color: '#9fb8ff', intensity: 0.55, dir: [10, 8, 7] },
    rim: { color: '#ffd9b0', intensity: 0.7, dir: [8, 5, -12] },
    exposure: 0.88, env: 0.4, floor: '#5b86d6',
    bg: { top: '#5b86d6', bottom: '#ffd6a8', glow: '#ffe2bd', glowAmount: 0.25 },
    post: { bloom: 0.05, vignette: 0.2, tint: '#fff0e0' },
    noFloor: true,
  };
}
