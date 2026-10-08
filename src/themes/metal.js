// Metal: brass and brushed silver pieces on a dark stone board with a gunmetal frame. Pieces: pieces-metal.js.
// The mirror like metals need the environment map. Keep bloom at or below 0.05 or the highlights blow out white.
export { pieces } from './pieces-metal.js';

export function board({ base }) {
  const stone = { ...base.marbleBlack, metalnessMap: null, metalness: 0, roughness: 1, normalScale: 0.3, clearcoat: 0.55, clearcoatRoughness: 0.08, vertexColors: true, envMapIntensity: 1.0 };
  return {
    squaresLight: { ...stone, color: '#9a9ea8' },
    squaresDark: { ...stone, color: '#55575f' },
    frame: { map: null, normalMap: null, roughnessMap: null, color: '#34373e', metalness: 0.85, roughness: 0.32, clearcoat: 0.3 },
    inlay: { map: null, normalMap: null, roughnessMap: null, color: '#1b1d22', metalness: 0.7, roughness: 0.3 },
    plinth: { color: '#2a2c32', metalness: 0.6 },
  };
}

export function light() {
  return {
    preset: 'Studio',
    key: { color: '#fff4e4', intensity: 3.4, dir: [-6, 13, 8] },
    fill: { color: '#c7d6ff', intensity: 1.3, dir: [10, 6, 6] },
    rim: { color: '#e8f0ff', intensity: 2.4, dir: [3, 7, -12] },
    exposure: 1.0, env: 1.05, floor: '#101216',
    post: { bloom: 0.04, vignette: 0.45 },
  };
}
