// Board textures (marble, wood, brass, felt). Pixels come from texture-gen.js: from the IndexedDB cache when this device
// has made them before, else from a pool of Workers in parallel, else (no Worker) on the main thread with yields.
// prepareTextures() fills the cache; the accessors below then return instantly (they still work without it, slowly).
import * as THREE from 'three';
import { JOB_ORDER, runJob, jobSize } from './texture-gen.js';

const CACHE_VERSION = 1;   // bump when texture-gen.js changes how a texture looks
// Only the small set (cap 512, phones and Low) is cached: about 15 MB. At 1024 it is 60 MB and takes 0.4 s to make, so it is not.
const CACHE_CAP = 512;
const DB = 'chess3d-textures', STORE = 'maps';

function canvasFromData(N, data) {
  const c = document.createElement('canvas');
  c.width = c.height = N;
  c.getContext('2d').putImageData(new ImageData(data, N, N), 0, 0);
  return c;
}

function finishTex(canvas, srgb) {
  const t = new THREE.CanvasTexture(canvas);
  t.colorSpace = srgb ? THREE.SRGBColorSpace : THREE.NoColorSpace;
  t.wrapS = t.wrapT = THREE.RepeatWrapping;
  t.anisotropy = 16;
  t.minFilter = THREE.LinearMipmapLinearFilter;
  t.magFilter = THREE.LinearFilter;
  t.generateMipmaps = true;
  t.needsUpdate = true;
  return t;
}

function toTextures(r) {
  const res = {
    map: finishTex(canvasFromData(r.N, r.color), true),
    normalMap: finishTex(canvasFromData(r.N, r.normal), false),
    roughnessMap: finishTex(canvasFromData(r.N, r.rough), false),
  };
  if (r.metal) res.metalnessMap = finishTex(canvasFromData(r.N, r.metal), false);
  return res;
}

// ---------------------------------------------------------------- IndexedDB cache (every call guarded: it may be absent or blocked)
let dbp = null;
function openDb() {
  return dbp || (dbp = new Promise((resolve) => {
    try {
      const rq = indexedDB.open(DB, 1);
      rq.onupgradeneeded = () => rq.result.createObjectStore(STORE);
      rq.onsuccess = () => resolve(rq.result);
      rq.onerror = rq.onblocked = () => resolve(null);
    } catch (e) { resolve(null); }
  }));
}
async function cacheGet(k) {
  const db = await openDb(); if (!db) return null;
  return new Promise((resolve) => {
    try { const rq = db.transaction(STORE).objectStore(STORE).get(k); rq.onsuccess = () => resolve(rq.result || null); rq.onerror = () => resolve(null); } catch (e) { resolve(null); }
  });
}
async function cachePut(k, v) {
  const db = await openDb(); if (!db) return;
  try { db.transaction(STORE, 'readwrite').objectStore(STORE).put(v, k); } catch (e) { /* ignore */ }
}
const cacheKey = (key, N) => `v${CACHE_VERSION}:${key}:${N}`;

// ---------------------------------------------------------------- generation
const cache = {};
// A cached record must hold N*N RGBA bytes per map, or new ImageData throws and the boot stalls.
const validPixels = (a, N) => a instanceof Uint8ClampedArray && a.length === N * N * 4;
const validRecord = (r, N) => !!r && r.N === N && validPixels(r.color, N) && validPixels(r.normal, N) && validPixels(r.rough, N) && (!r.metal || validPixels(r.metal, N));
const copyOf = (r) => ({ N: r.N, color: r.color.slice(), normal: r.normal.slice(), rough: r.rough.slice(), metal: r.metal ? r.metal.slice() : undefined });

function startWorkers(n) {
  const ws = [];
  try {
    for (let i = 0; i < n; i++) ws.push(new Worker(new URL('./texture-worker.js', import.meta.url), { type: 'module' }));
  } catch (e) { ws.forEach((w) => w.terminate()); return null; }
  return ws;
}

/**
 * Make every board texture before the board is built. cap is the largest side in px (1024 desktop, 512 phones and Low).
 * onStep(done, total) fires after each texture is ready, so the loader can move. Never rejects.
 */
export async function prepareTextures({ cap = 1024, onStep = () => {} } = {}) {
  const total = JOB_ORDER.length;
  let done = 0;
  const finish = (key, r) => { cache[key] = toTextures(r); onStep(++done, total); };
  const todo = [];
  for (const key of JOB_ORDER) {
    if (cache[key]) { onStep(++done, total); continue; }
    const N = jobSize(key, cap);
    const hit = cap <= CACHE_CAP ? await cacheGet(cacheKey(key, N)) : null;
    if (validRecord(hit, N)) finish(key, hit); else todo.push(key);   // a damaged cache record is regenerated, never fed to ImageData
  }
  if (!todo.length) return;
  const workers = typeof Worker === 'function' ? startWorkers(Math.max(1, Math.min(todo.length, (navigator.hardwareConcurrency || 2) - 1, 4))) : null;
  const store = (key, r) => { if (cap <= CACHE_CAP) cachePut(cacheKey(key, r.N), copyOf(r)); finish(key, r); };
  if (workers) {
    const queue = todo.slice();
    try {
      await Promise.all(workers.map((w) => new Promise((resolve, reject) => {
        const next = () => {
          const key = queue.shift();
          if (!key) { resolve(); return; }
          w.onmessage = (e) => { if (e.data.error) reject(new Error(e.data.error)); else { store(key, e.data.res); next(); } };
          w.postMessage({ id: key, key, cap });
        };
        w.onerror = (e) => reject(new Error(e.message || 'texture worker failed'));
        next();
      })));
      return;
    } catch (e) {
      console.warn('texture workers failed, generating on the main thread', e);
      for (const k of todo) if (!cache[k]) queue.push(k);
      todo.length = 0; todo.push(...queue);
    } finally { workers.forEach((w) => w.terminate()); }
  }
  for (const key of todo) {
    if (cache[key]) continue;
    await new Promise((r) => setTimeout(r, 0));   // let the loader repaint between textures
    store(key, runJob(key, cap));
  }
}

// ---------------------------------------------------------------- public, lazy and cached
// Without prepareTextures() each accessor still generates on the spot at the largest size.
const lazy = (key) => cache[key] || (cache[key] = toTextures(runJob(key, 1024)));
export const marbleWhite = () => lazy('mw');
export const marbleBlack = () => lazy('mb');
export const walnut = () => lazy('wa');
export const maple = () => lazy('ma');
export const brass = () => lazy('br');
export const felt = () => lazy('fe');

export function disposeTextures() {
  for (const k of Object.keys(cache)) {
    for (const t of Object.values(cache[k])) t.dispose();
    delete cache[k];
  }
}
