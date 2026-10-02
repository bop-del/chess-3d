// Wood pieces: light maple against dark rosewood.
import { pieceWood, texSize } from './piece-textures.js';

export function pieces({ quality, track }) {
  const size = texSize(quality);
  const mp = track(pieceWood('#efc687', '#b8803c', 1.0, 9, size)), rw = track(pieceWood('#6a2b1c', '#2a0e08', 1.15, 10, size));
  return {
    white: { body: { map: mp, color: '#ffffff', metalness: 0, roughness: 0.4, clearcoat: 0.45, clearcoatRoughness: 0.28, sheen: 0.2, sheenColor: '#ffd9a0', specularIntensity: 0.5, envMapIntensity: 0.9 }, accent: { color: '#d7a45a', metalness: 0, roughness: 0.4, clearcoat: 0.3 } },
    black: { body: { map: rw, color: '#ffffff', metalness: 0, roughness: 0.36, clearcoat: 0.5, clearcoatRoughness: 0.22, sheen: 0.25, sheenColor: '#a0502e', specularIntensity: 0.6, specularColor: '#ffffff', envMapIntensity: 0.9 }, accent: { color: '#7c3a22', metalness: 0, roughness: 0.4, clearcoat: 0.3 } },
  };
}
