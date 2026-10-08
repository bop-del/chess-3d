// Glass: a frosted blue grey board under clear and smoked glass pieces. Pieces: pieces-glass.js (real transmission on High only).
export { pieces } from './pieces-glass.js';

export function board() {
  const frost = { map: null, normalMap: null, roughnessMap: null, metalnessMap: null, metalness: 0, roughness: 0.55, clearcoat: 0.9, clearcoatRoughness: 0.35, specularIntensity: 1, vertexColors: true, envMapIntensity: 1.0 };
  const none = { map: null, normalMap: null, roughnessMap: null };
  return {
    squaresLight: { ...frost, color: '#aabfd0' },
    squaresDark: { ...frost, color: '#33465a', roughness: 0.45 },
    frame: { ...none, color: '#7f93a6', metalness: 0, roughness: 0.5, clearcoat: 0.7, clearcoatRoughness: 0.3 },
    inlay: { ...none, color: '#f4fbff', roughness: 0.4 },
    gold: { ...none, color: '#cfe4ff', metalness: 0, roughness: 0.3, emissive: '#6faeea', emissiveIntensity: 0.5 },
    plinth: { color: '#7e93a8', metalness: 0 },
  };
}

export function light() {
  return {
    preset: 'Gallery',
    key: { color: '#ffffff', intensity: 2.6, dir: [-5, 13, 8] },
    fill: { color: '#dbeaff', intensity: 1.4, dir: [10, 8, 7] },
    rim: { color: '#ffffff', intensity: 2.2, dir: [3, 7, -12] },
    exposure: 1.0, env: 1.1, floor: '#1d2733',
    bg: { top: '#37475c', bottom: '#10161e', glow: '#6e88a8', glowAmount: 0.6 },
    post: { bloom: 0.1, vignette: 0.3, tint: '#f4f8ff' },
  };
}
