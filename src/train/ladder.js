// The Drill ladder, exactly as chesslines #51: eight levels, one integer per card, a right answer climbs one, a miss
// drops two and never below 1. No ease factor. The interval lengths are guesses: see guesses.js.
export const LADDER_H = [4, 24, 72, 168, 336, 720, 2160, 4320];   // 4h, 1d, 3d, 1w, 2w, 1mo, 3mo, 6mo

export const next = (lvl, ok) => (ok ? Math.min(lvl + 1, 8) : Math.max(1, lvl - 2));
export const dueAt = (lvl, now = Date.now()) => now + LADDER_H[lvl - 1] * 3600e3;
