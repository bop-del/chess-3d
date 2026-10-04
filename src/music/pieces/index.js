// The pieces in two sets, each piece loaded on first use (a separate chunk per piece): see tools/build-pieces.mjs for where the
// note data comes from. Set a: Satie and Bach (the first five). Set b: calm, lesser known pieces (CHE-180), the default.
// `?musicset=a|b` picks the set for one page load (player.js); an unknown value falls back to DEFAULT_SET.
export const SETS = {
  a: {
    gymnopedie1: () => import('./gymnopedie1.js'),
    gymnopedie2: () => import('./gymnopedie2.js'),
    gymnopedie3: () => import('./gymnopedie3.js'),
    'prelude-c': () => import('./prelude-c.js'),
    air: () => import('./air.js'),
  },
  b: {
    'chopin-prelude-4': () => import('./chopin-prelude-4.js'),
    'faure-apres-un-reve': () => import('./faure-apres-un-reve.js'),
    'mendelssohn-gondola': () => import('./mendelssohn-gondola.js'),
    'mendelssohn-op85-1': () => import('./mendelssohn-op85-1.js'),
    'bach-aria-516': () => import('./bach-aria-516.js'),
  },
};
export const DEFAULT_SET = 'b';
export const SET_IDS = Object.keys(SETS);
export const chooseSet = (value) => { const v = String(value ?? '').toLowerCase(); return Object.hasOwn(SETS, v) ? v : DEFAULT_SET; };
export const setIds = (set) => Object.keys(SETS[chooseSet(set)]);
export const loader = (id) => { for (const s of Object.values(SETS)) if (Object.hasOwn(s, id)) return s[id]; return undefined; };
export const PIECE_IDS = SET_IDS.flatMap((s) => Object.keys(SETS[s]));   // every piece of every set
