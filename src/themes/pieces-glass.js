// Glass pieces. High quality gets real transmission (one extra scene pass). Low and Medium get the fake: opaque tinted
// clearcoat, no transmission, so a phone pays nothing extra. The two sides must differ at a glance: clear icy blue against
// smoked near black.
export function pieces({ quality, track }) {
  const real = quality === 'high';
  const base = { metalness: 0, sheen: 0, clearcoat: 1, clearcoatRoughness: 0.03, specularIntensity: 1, ior: 1.5, thickness: 0.7, envMapIntensity: 2.0, map: null };
  const white = real
    ? { ...base, color: '#ffffff', transmission: 1, roughness: 0.03, attenuationColor: '#6fc0ff', attenuationDistance: 0.7 }
    : { ...base, color: '#b9dcf5', transmission: 0, roughness: 0.08, envMapIntensity: 2.2, sheen: 0.5, sheenColor: '#e8f6ff', sheenRoughness: 0.3 };
  const black = real
    ? { ...base, color: '#8e939c', transmission: 0.88, roughness: 0.1, attenuationColor: '#1a1f2c', attenuationDistance: 0.32, specularColor: '#ffffff' }
    : { ...base, color: '#1b212d', transmission: 0, roughness: 0.1, specularColor: '#ffffff' };
  const gw = real
    ? { ...base, color: '#f2f8ff', transmission: 0.6, roughness: 0.35, attenuationColor: '#cfe8ff', attenuationDistance: 0.6 }
    : { ...base, color: '#e4f0fa', transmission: 0, roughness: 0.3 };
  const gb = real
    ? { ...base, color: '#303642', transmission: 0.6, roughness: 0.25, attenuationColor: '#10131c', attenuationDistance: 0.3 }
    : { ...base, color: '#0f131b', transmission: 0, roughness: 0.22 };
  return {
    white: { body: white, accent: gw },
    black: { body: black, accent: gb },
    dark: { color: '#06070b' },
  };
}
