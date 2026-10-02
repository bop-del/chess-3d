// Tournament pieces: boxwood and ebony with a procedural grain, matte-ish with a light coat.
import { pieceWood, texSize } from './piece-textures.js';

export function pieces({ quality, track }) {
  const size = texSize(quality);
  const box = track(pieceWood('#ebd197', '#c79b52', 1.0, 11, size)), ebo = track(pieceWood('#2a1d15', '#0c0705', 1.0, 13, size));
  return {
    white: { body: { map: box, color: '#ffffff', metalness: 0, roughness: 0.42, clearcoat: 0.3, clearcoatRoughness: 0.35, sheen: 0.2, sheenColor: '#fff0c8', specularIntensity: 0.5, envMapIntensity: 0.8 }, accent: { color: '#d2ac66', metalness: 0, roughness: 0.4, clearcoat: 0.2, envMapIntensity: 0.8 } },
    black: { body: { map: ebo, color: '#ffffff', metalness: 0, roughness: 0.34, clearcoat: 0.55, clearcoatRoughness: 0.2, sheen: 0, specularIntensity: 0.7, specularColor: '#ffffff', envMapIntensity: 0.9 }, accent: { color: '#43301f', metalness: 0, roughness: 0.4, clearcoat: 0.3, envMapIntensity: 0.9 } },
  };
}
