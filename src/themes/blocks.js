// Blocks: a floating block island with a grass and stone board, a plank frame, a tree, a waterfall and drifting clouds. The classic
// board meshes are hidden (board.applyTheme `hide`), the island is built here as its own world and lives in the gimbal next to the
// board. Pieces and their animation: blocks/chars.js (exported below). Textures: 16 px per block face, drawn in code.
import { createWorld } from './blocks/island.js';

export * from './blocks/chars.js';

/** Board spec: the classic squares, frame and plinth are hidden; the labels lift onto the plank frame and lose their gold. */
export function board() {
  return {
    hide: true,
    labelLift: 0.3,
    labels: { color: '#fff2c8', metalness: 0, roughness: 1, envMapIntensity: 0 },
    tray: { color: '#8a6035', roughness: 1, metalness: 0, clearcoat: 0, clearcoatRoughness: 1 },
  };
}

/** The island, clouds and waterfall: { group, update(dt), dispose() }; the registry adds the group to the gimbal. */
export function world({ track, quality }) {
  return createWorld({ track, quality });
}

export function light() {
  return {
    preset: 'Gallery',
    key: { color: '#fff1d6', intensity: 2.2, dir: [-9, 20, 12] },
    fill: { color: '#dcecff', intensity: 0.7, dir: [10, 8, 7] },
    rim: { color: '#ffffff', intensity: 0.5, dir: [3, 7, -12] },
    exposure: 0.9, env: 0.45, floor: '#6db8f5',
    bg: { top: '#6db8f5', bottom: '#e3f4ff', glow: '#ffffff', glowAmount: 0 },
    post: { bloom: 0.02, vignette: 0.12, tint: '#ffffff' },
    noFloor: true,
  };
}
