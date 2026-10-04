// Colour helper of the Pixelwelt figures: f < 1 darkens, f > 1 lightens towards white.
const hex = (n) => [(n >> 16) & 255, (n >> 8) & 255, n & 255];
const pack = (r, g, b) => (Math.round(Math.max(0, Math.min(255, r))) << 16) | (Math.round(Math.max(0, Math.min(255, g))) << 8) | Math.round(Math.max(0, Math.min(255, b)));
export const shade = (c, f) => { const [r, g, b] = hex(c); return f < 1 ? pack(r * f, g * f, b * f) : pack(r + (255 - r) * (f - 1), g + (255 - g) * (f - 1), b + (255 - b) * (f - 1)); };
