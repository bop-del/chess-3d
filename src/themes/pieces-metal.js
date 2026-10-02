// Metal pieces: brass against brushed silver. Needs the environment map; the lead keeps bloom at or below 0.05.
export function pieces() {
  return {
    white: { body: { color: '#d9a640', metalness: 1, roughness: 0.2, clearcoat: 0, sheen: 0, specularIntensity: 1, envMapIntensity: 1.1 }, accent: { color: '#9b6a30', metalness: 1, roughness: 0.25, envMapIntensity: 1.4 } },
    black: { body: { color: '#9aa1ac', metalness: 1, roughness: 0.42, clearcoat: 0, sheen: 0, specularIntensity: 1, specularColor: '#ffffff', envMapIntensity: 1.1 }, accent: { color: '#8d97a6', metalness: 1, roughness: 0.3, envMapIntensity: 1.4 } },
    dark: { color: '#08080a' },
  };
}
