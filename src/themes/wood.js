// Wood: maple and walnut squares from the classic wood textures, warm amber light. Pieces: pieces-wood.js.
export { pieces } from './pieces-wood.js';

export function board({ base }) {
  return {
    squaresLight: { ...base.maple, color: '#ffe3b4', metalness: 0, roughness: 1, normalScale: 0.4, clearcoat: 0.35, clearcoatRoughness: 0.25, vertexColors: true },
    squaresDark: { ...base.walnut, color: '#c9a98f', metalness: 0, roughness: 1, metalnessMap: null, normalScale: 0.5, clearcoat: 0.35, clearcoatRoughness: 0.25, vertexColors: true },
    gold: { map: null, normalMap: null, roughnessMap: null, metalness: 0, roughness: 0.5, color: '#4a2e18' },
    tray: { color: '#3a2212', metalness: 0, roughness: 0.45, clearcoat: 0.3 },
  };
}

export function light() {
  return {
    preset: 'Gallery',
    key: { color: '#ffd7a0', intensity: 3.0, dir: [-6, 13, 8] },
    fill: { color: '#ffe8cc', intensity: 1.1, dir: [10, 7, 7] },
    rim: { color: '#ffc890', intensity: 1.2, dir: [3, 7, -12] },
    exposure: 1.1, env: 0.9, floor: '#1c120a',
    bg: { top: '#3a2414', bottom: '#150c06', glow: '#8a5a30', glowAmount: 0.7 },
    post: { bloom: 0.1, vignette: 0.4, tint: '#fff0dc' },
  };
}
