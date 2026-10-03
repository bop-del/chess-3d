// The pieces, each loaded on first use (a separate chunk per piece): see tools/build-pieces.mjs for where the note data comes from.
export const LOADERS = {
  gymnopedie1: () => import('./gymnopedie1.js'),
  gymnopedie2: () => import('./gymnopedie2.js'),
  gymnopedie3: () => import('./gymnopedie3.js'),
  'prelude-c': () => import('./prelude-c.js'),
  air: () => import('./air.js'),
};
export const PIECE_IDS = Object.keys(LOADERS);
