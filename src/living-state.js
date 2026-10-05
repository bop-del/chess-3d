// The shared switches of "Living pieces" (CHE-238): src/living.js writes them, the Pixelwelt birds (themes/pixel/birds.js) read them.
// on: the setting; auto: self starting shows are armed (off with ?manual=1 and under automation, ?living=1 forces them on);
// paused: a move, a capture scene or the Symbols view is on; rand: the random source (tests replace it).
export const living = { on: true, auto: false, paused: false, rand: Math.random };
