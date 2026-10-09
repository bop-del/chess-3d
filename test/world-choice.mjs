// Backdrop world choice (CHE-370), fast tier, no browser: precedence (click > ?world= > stored > none), bad values fall back to none,
// a click is stored and heard by the listeners, every entry has names and swatch colours.
// Run: node test/world-choice.mjs    Exit 0 pass, 1 on any failed check.
const store = new Map();
globalThis.localStorage = { getItem: (k) => (store.has(k) ? store.get(k) : null), setItem: (k, v) => { store.set(k, String(v)); }, removeItem: (k) => { store.delete(k); } };
const at = (search) => { globalThis.location = { search }; };
at('');
const W = await import('../src/worlds/choice.js');
let failed = 0;
const check = (name, ok, detail = '') => { console.log(`${ok ? 'PASS' : 'FAIL'}  ${name}${detail ? '  ' + detail : ''}`); if (!ok) failed++; };
const reset = () => { W.resetWorld(); store.clear(); };

reset();
check('default is none (today)', W.DEFAULT_WORLD === 'none' && W.worldChoice() === 'none');
check('entries: none, hall, space, zen, lava', W.WORLD_IDS.join() === 'none,hall,space,zen,lava');
at('?world=space'); check('?world=space beats the default', W.worldChoice() === 'space');
store.set('chess3d.world', 'lava'); check('?world= beats a stored pick, the store stays', W.worldChoice() === 'space' && store.get('chess3d.world') === 'lava');
at(''); check('a stored pick is used without the flag', W.worldChoice() === 'lava');
at('?world=zzz'); check('a bad flag falls through to the stored pick', W.worldChoice() === 'lava');
at('?world=none'); check('?world=none turns a stored world off for this visit', W.worldChoice() === 'none');
store.set('chess3d.world', 'old'); at(''); check('a bad stored value falls back to none', W.worldChoice() === 'none');
reset(); at('?world=hall');
const heard = []; W.onWorld((id) => heard.push(id));
W.setWorld('zen');
check('a click beats the flag, is stored and heard', W.worldChoice() === 'zen' && store.get('chess3d.world') === 'zen' && heard.join() === 'zen');
W.setWorld('zen'); W.setWorld('x');
check('the same pick or a bad id does nothing', heard.length === 1 && store.get('chess3d.world') === 'zen');
check('every entry has a name, a German name and two swatch colours', W.WORLD_IDS.every((id) => W.WORLD_NAMES[id]?.en && W.WORLD_NAMES[id]?.de && W.WORLD_NAMES[id].swatch.length === 2));
if (failed) { console.log(`${failed} CHECK(S) FAILED`); process.exit(1); }
