// Tournament: green and cream matte squares, a plain maple frame, soft warm light. Pieces: pieces-tournament.js.
export { pieces } from './pieces-tournament.js';

export function board({ base }) {
  const matte = { metalness: 0, roughness: 0.55, clearcoat: 0.12, clearcoatRoughness: 0.4, specularIntensity: 0.5, map: null, normalMap: null, roughnessMap: null, metalnessMap: null };
  return {
    squaresLight: { ...matte, color: '#f0eed6' },
    squaresDark: { ...matte, color: '#58863b' },
    // the frame is the maple map tinted down to a plain muted honey brown (the maple map is orange on its own)
    frame: { ...base.maple, color: '#8a7358', clearcoat: 0.12, clearcoatRoughness: 0.4, normalScale: 0.5 },
    inlay: { color: '#b88a55' },
    gold: { map: null, normalMap: null, roughnessMap: null, metalness: 0, roughness: 0.45, color: '#3a2a1a' },
    plinth: { color: '#6a4a2e' },
    tray: { color: '#3b2a1a', metalness: 0, roughness: 0.5, clearcoat: 0.1 },
  };
}

export function light() {
  return {
    preset: 'Gallery',
    key: { color: '#fff4e2', intensity: 2.8, dir: [-5, 14, 8] },
    fill: { color: '#f0f4ff', intensity: 1.2, dir: [10, 8, 7] },
    exposure: 1.05, floor: '#1d1a16',
    bg: { top: '#34322d', bottom: '#14130f', glow: '#615c50', glowAmount: 0.6 },
    post: { bloom: 0.05, vignette: 0.3 },
  };
}
