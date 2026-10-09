// Battle director: runs one capture scene at a time. It is the capture hook of the game (game.onCapture), swoops the camera
// to a low close-up of the square, plays the attacker's scene module, restores everything the scene touched and sends the
// camera back. A tap or any key skips the scene. Settings: On, Short (the scene clock runs 3 times faster), Off.
//
// Scene module shape (src/battle/scenes/<pawn|knight|bishop|rook|queen|king>.js):
//   export default { attacker: 'n', cam: { dist, pitch }, run(ctx) -> Promise }
// ctx: stage, attackerObj, victimObj (game piece objects: use .group), square, fx, sfx, short,
//   signal (AbortSignal, aborts on skip), dir (unit vector attacker to victim, gimbal space), center (victim square centre),
//   root (the group that holds the pieces), time(), wait(seconds), tween({ dur, delay, ease, step(e, u) }), onFrame(fn(dt, t)),
//   ease { out, inOut, back }.
// All of wait, tween and onFrame run on the scene clock (3 times faster in Short) and never resolve after an abort, so a
// scene that was skipped simply stops. At the end the director puts every transform it can find on the attacker and the
// victim back, drops anything the scene attached to them, disposes the fx and stops the scene sounds.
import * as THREE from 'three';
import { createSettings } from './settings.js';
import { viewsAllowBattle } from '../views/registry.js';

const SCENES = import.meta.glob('./scenes/*.js');
Object.assign(SCENES, import.meta.glob('./scenes/pixel/fights.js'));   // CHE-371: the Pixelwelt fights (scenes/pixel/), ?pixfight=old keeps pixel-gore
const FX = import.meta.glob('./fx.js');
const SFX = import.meta.glob('./sfx.js');
const LIT = import.meta.glob('./scenes/lit/index.js');   // CHE-369: the Wild capture scenes of the lit themes, plus a checkmate finale (Options Scene row, ?capture=wild)
const captureFlag = () => { try { return new URLSearchParams(location.search).get('capture'); } catch (e) { return null; } };
const NAMES = { p: 'pawn', n: 'knight', b: 'bishop', r: 'rook', q: 'queen', k: 'king' };
const SHORT_SPEED = 3;
const MAX_SCENE = 6;              // seconds of scene time; a scene that runs longer is skipped
const SWOOP = 0.4, BACK = 0.4;
const DEG = Math.PI / 180;
const EASE = {
  out: (u) => 1 - Math.pow(1 - u, 3),
  inOut: (u) => (u < 0.5 ? 4 * u * u * u : 1 - Math.pow(-2 * u + 2, 3) / 2),
  back: (u) => { const c = 1.70158; return 1 + (c + 1) * Math.pow(u - 1, 3) + c * Math.pow(u - 1, 2); },
};
const wrapPi = (a) => { const T = Math.PI * 2; a = (a + Math.PI) % T; if (a < 0) a += T; return a - Math.PI; };
const noop = () => {};
const never = new Promise(noop);

// An object that answers every missing method with a no-op, so a scene can call fx and sfx before they exist.
function lenient(raw) {
  return new Proxy(raw || {}, {
    get(target, prop) {
      if (prop in target) return target[prop];
      if (typeof prop === 'symbol' || prop === 'then') return undefined;
      return () => Promise.resolve();
    },
  });
}

// ---------------------------------------------------------------- snapshots of what a scene may touch
function snapshot(piece) {
  const g = piece.group;
  const items = [];
  g.traverse((o) => items.push({ o, p: o.position.clone(), q: o.quaternion.clone(), s: o.scale.clone(), v: o.visible, kids: [...o.children], parent: o.parent }));
  return { piece, parent: g.parent, items };
}
function restore(snap, { keepHidden = false } = {}) {
  const g = snap.piece.group;
  let hidden = false;
  for (const it of snap.items) {
    it.o.position.copy(it.p); it.o.quaternion.copy(it.q); it.o.scale.copy(it.s);
    if (it.o === g) hidden = !g.visible;
    it.o.visible = it.v;
    for (const c of [...it.o.children]) if (!it.kids.includes(c)) it.o.remove(c);      // props the scene attached
    for (const c of it.kids) if (c.parent !== it.o) it.o.add(c);                          // parts the scene took off
  }
  if (g.parent !== snap.parent && snap.parent) snap.parent.add(g);
  if (keepHidden && hidden) g.visible = false;
}

export function createDirector({ game, controls, stage, ui, themes, symbols, gore }) {
  const settings = createSettings({ ui, themes, gore, capture: captureFlag() });
  let active = null;                       // the run in progress
  let fxModule, sfxModule;                 // loaded on first use
  const sceneCache = new Map();

  // ------------------------------------------------------------ loading
  async function loadScene(type, style) {
    if (settings.capture === 'wild' && !style) { try { return (await LIT['./scenes/lit/index.js']()).scene('wild', type); } catch (e) { console.warn('lit scenes failed to load', e); } }
    const name = style === 'pixel' ? 'pixel/fights' : style === 'blocks' ? 'blocks' : NAMES[type];     // Blocks: the victim falls into cubes; Pixelwelt: the fights of the attacker take turns (CHE-371)
    if (sceneCache.has(name)) return sceneCache.get(name);
    const load = SCENES[`./scenes/${name}.js`];
    let mod = null;
    if (load) { try { mod = (await load()).default || null; } catch (e) { console.warn('battle scene failed to load', name, e); } }
    mod = mod || FALLBACK;
    sceneCache.set(name, mod);
    return mod;
  }
  async function loadFx(ctx) {
    if (fxModule === undefined) { try { fxModule = FX['./fx.js'] ? await FX['./fx.js']() : null; } catch (e) { console.warn('battle fx failed to load', e); fxModule = null; } }
    const m = fxModule;
    let raw = null;
    if (m?.createFx) raw = m.createFx({ stage, parent: game.root, signal: ctx.signal });
    else if (m) raw = m.default || m;
    return { raw, fx: lenient(raw) };
  }
  async function loadSfx() {
    if (sfxModule === undefined) { try { sfxModule = SFX['./sfx.js'] ? await SFX['./sfx.js']() : null; } catch (e) { console.warn('battle sfx failed to load', e); sfxModule = null; } }
    return lenient(sfxModule ? (sfxModule.default || sfxModule.sfx || sfxModule) : null);
  }
  const preload = () => { Object.values(SCENES).forEach((l) => l().catch(noop)); FX['./fx.js']?.().catch(noop); SFX['./sfx.js']?.().catch(noop); };
  const ready = () => Promise.all([...Object.values(SCENES).map((l) => l().catch(noop)), FX['./fx.js']?.().catch(noop), SFX['./sfx.js']?.().catch(noop), settings.capture === 'wild' && LIT['./scenes/lit/index.js']().catch(noop)]);
  setTimeout(preload, 2000);

  // ------------------------------------------------------------ the scene clock
  let pixFinale = null;   // CHE-371
  function update(dt) {
    if (pixFinale && pixFinale.update(dt) === false) pixFinale = null;
    const r = active;
    if (!r || !r.playing || r.dead) return;
    const d = dt * r.speed * r.slow;
    r.time += d;
    for (const w of r.timers.filter((x) => r.time >= x.at)) { r.timers.splice(r.timers.indexOf(w), 1); w.resolve(); }
    for (const a of [...r.tweens]) {
      a.t += d;
      if (a.t < 0) continue;
      const u = Math.min(1, a.t / a.dur);
      try { a.step(a.ease(u), u); } catch (e) { console.warn('battle tween failed', e); }
      if (u >= 1) { r.tweens.splice(r.tweens.indexOf(a), 1); a.resolve(); }
    }
    for (const fn of [...r.frames]) { try { fn(d, r.time); } catch (e) { console.warn('battle frame failed', e); r.frames.delete(fn); } }
    try { r.fx?.update?.(d); } catch (e) { console.warn('battle fx update failed', e); }
    if (r.time > MAX_SCENE) r.ac.abort();
  }

  // ------------------------------------------------------------ one capture
  async function handler(info) {
    const mode = settings.mode;
    if (mode === 'off' || info.signal?.aborted || active || !viewsAllowBattle()) return;   // the easy views skip every scene
    const short = mode === 'short', speed = short ? SHORT_SPEED : 1;
    const r = active = {
      info, short, speed, slow: 1, time: 0, playing: false, dead: false, ac: new AbortController(),
      timers: [], tweens: [], frames: new Set(), fx: null, sfx: null,
      snaps: [snapshot(info.attackerObj), snapshot(info.victimObj)], cleanup: [],
    };
    // the game aborts on undo, new game, load; the user aborts by a tap or a key; both end up in finish()
    info.signal?.addEventListener('abort', () => { r.byGame = true; r.ac.abort(); }, { once: true });
    r.ac.signal.addEventListener('abort', () => finish(r, { keepVictimHidden: !r.byGame }), { once: true });
    const onSkip = (e) => {
      if (e.type === 'keydown' && ['Shift', 'Control', 'Alt', 'Meta'].includes(e.key)) return;
      e.preventDefault(); e.stopImmediatePropagation();
      r.ac.abort();
    };
    window.addEventListener('pointerdown', onSkip, true);
    window.addEventListener('keydown', onSkip, true);
    r.cleanup.push(() => { window.removeEventListener('pointerdown', onSkip, true); window.removeEventListener('keydown', onSkip, true); });

    try {
      const sub = { short };
      const [mod, fx, sfx] = await Promise.all([loadScene(info.attacker, info.victimObj.group.userData.style), loadFx({ ...sub, signal: r.ac.signal }), loadSfx()]);
      r.fx = fx.fx; r.fxRaw = fx.raw; r.sfx = sfx;
      if (r.ac.signal.aborted) return;
      if (sfx) sfx.sceneActive = true;
      const swoop = camera(info, mod.camFor?.(info.attacker, info) || mod.cam, short);
      await Promise.race([swoop, abortion(r)]);
      if (!r.ac.signal.aborted) {
        r.playing = true;
        const ctx = makeContext(r, info, sub);
        try { await Promise.race([Promise.resolve(mod.run(ctx)), abortion(r)]); }
        catch (e) { console.warn('battle scene failed', mod.attacker, e); }
        r.playing = false;
      }
    } catch (e) {
      console.warn('battle failed', e);
    }
    const aborted = r.byGame;
    finish(r, { keepVictimHidden: !aborted });   // no-op when a skip or the game ended it already
    if (aborted) return;                                      // the game has moved on already
    controls.restore({ dur: BACK / speed });                   // not awaited: the camera glides back while the victim leaves
    if (r.info.victimObj.group && r.victimHiddenByScene) r.info.victimObj.group.visible = true;
  }
  handler.stage = true;
  handler.enabled = () => settings.mode !== 'off' && viewsAllowBattle();
  game.onCapture(handler);
  // Symbols on: no scene (the handler above is disabled); in Pixelwelt the captured symbol fades out instead (CHE-227). A plain hook, always called.
  game.onCapture((info) => { if (symbols?.visible && themes?.current?.() === 'pixel' && !info.signal?.aborted) symbols.fadeOut(info.victimObj); });

  // CHE-371: the Pixelwelt checkmate finale (fireworks, the loser's tower falls, the winners cheer), ticked by update() below
  game.on('gameover', (st) => {
    if (st.reason !== 'checkmate' || themes?.current?.() !== 'pixel') return;
    // the banner waits for the finale (it shows it when done): hide it at once, after the other gameover listeners have shown it, so the
    // card never flashes and its buttons (Review the game) cannot be hit while the finale module still loads and the camera is not ours yet
    const banner = document.getElementById('banner');
    queueMicrotask(() => { if (banner) banner.hidden = true; });
    import('../themes/pixel/finale.js').then(async (m) => { pixFinale = m.playFinale({ game, controls, stage, ui, st, sfx: await loadSfx() }); }).catch((e) => { console.warn('finale failed', e); if (banner) banner.hidden = false; });
  });

  const abortion = (r) => new Promise((res) => { if (r.ac.signal.aborted) res(); else r.ac.signal.addEventListener('abort', res, { once: true }); });

  // ------------------------------------------------------------ end of a run (idempotent, synchronous)
  function finish(r, { keepVictimHidden = false } = {}) {
    if (r.finished) return;
    r.finished = true;
    r.dead = true;
    r.cleanup.forEach((fn) => fn());
    r.timers.length = 0; r.tweens.length = 0; r.frames.clear();
    const raw = r.fxRaw;
    try { raw?.skip?.(); } catch (e) { /* ignore */ }
    if (raw) for (const k of ['dispose', 'disposeAll', 'clear']) if (typeof raw[k] === 'function') { try { raw[k](); } catch (e) { console.warn('battle fx dispose failed', e); } break; }
    restore(r.snaps[0]);
    restore(r.snaps[1], { keepHidden: keepVictimHidden });
    r.victimHiddenByScene = keepVictimHidden && !r.info.victimObj.group.visible;
    if (r.sfx) { r.sfx.sceneActive = false; if (r.ac.signal.aborted) try { r.sfx.stop?.(); } catch (e) { /* ignore */ } }
    if (r.byGame) controls.restore({ dur: 0.3 });             // the game cancelled the scene: the camera still has to come back
    if (active === r) active = null;
  }

  // ------------------------------------------------------------ camera
  function camera(info, cam = {}, short) {
    const a = info.attackerObj.group.position, v = info.victimObj.group.position;
    const mid = new THREE.Vector3((a.x + v.x) / 2, 0.55, (a.z + v.z) / 2);
    // look across the fight: the view direction is perpendicular to the line from attacker to victim, on the side nearest to
    // where the camera is now
    const gy = controls.gimbalDeg.y * DEG;
    const dx = info.dir.x * Math.cos(gy) + info.dir.z * Math.sin(gy), dz = -info.dir.x * Math.sin(gy) + info.dir.z * Math.cos(gy);
    const now = controls.camera.yaw;
    let yaw = Math.atan2(-dz, dx);
    const alt = Math.atan2(dz, -dx);
    if (Math.abs(wrapPi(alt - now)) < Math.abs(wrapPi(yaw - now))) yaw = alt;
    yaw += (cam.yaw || 0) * DEG;
    const h = Math.max(info.attackerObj.group.userData.height || 1.2, info.victimObj.group.userData.height || 1.2);
    return controls.cinematic({ target: mid, yaw, pitch: (cam.pitch ?? 12) * DEG, dist: cam.dist ?? 5.2 + 1.3 * h, dur: SWOOP / (short ? SHORT_SPEED : 1) });
  }

  // ------------------------------------------------------------ what a scene gets
  function makeContext(r, info, { short }) {
    const signal = r.ac.signal;
    const guard = (fn) => (...args) => (signal.aborted ? never : fn(...args));
    const center = info.victimObj.group.position.clone();
    return api.lastCtx = {
      stage, attackerObj: info.attackerObj, victimObj: info.victimObj, square: info.square,
      attacker: info.attacker, victim: info.victim, attackerColor: info.attackerColor, victimColor: info.victimColor,
      short, gore: settings.gore, fx: r.fx, sfx: r.sfx, signal, dir: info.dir.clone(), center, root: game.root, gimbal: game.root.parent,
      ease: EASE, theme: themes?.current?.(), quality: stage.quality, controls,
      slow: (k) => { r.slow = Math.max(0.05, Math.min(1, k)); },      // slow motion: the scene clock runs at k
      time: () => r.time,
      wait: guard((sec) => new Promise((resolve) => { r.timers.push({ at: r.time + sec, resolve }); })),
      tween: guard(({ dur, delay = 0, ease = (u) => u, step }) => new Promise((resolve) => { r.tweens.push({ t: -delay, dur: Math.max(1e-4, dur), ease, step, resolve }); })),
      onFrame: (fn) => { r.frames.add(fn); return () => r.frames.delete(fn); },
    };
  }

  // ------------------------------------------------------------ built in stand in, used until a scene module exists
  const FALLBACK = {
    attacker: '*',
    async run(ctx) {
      const { attackerObj, victimObj, dir, sfx } = ctx;
      const a = attackerObj.group, v = victimObj.group;
      const a0 = a.position.clone();
      sfx.whoosh?.();
      await ctx.tween({ dur: 0.35, ease: EASE.out, step: (e) => a.position.copy(a0).addScaledVector(dir, 0.55 * e) });
      sfx.clang?.();
      const rollAxis = new THREE.Vector3(-dir.z, 0, dir.x);
      await ctx.tween({
        dur: 0.9, ease: EASE.out,
        step: (e) => {
          v.quaternion.setFromAxisAngle(rollAxis, e * 1.45);
          v.position.y = Math.sin(Math.PI * Math.min(1, e * 1.5)) * 0.15;
          a.position.copy(a0).addScaledVector(dir, 0.55 * (1 - e * 0.6));
        },
      });
      await ctx.wait(0.25);
    },
  };

  let finale = null, finaleLoading = false;
  // the finale comes with Wild: loaded when Wild is first on (at start or by a pick), it checks Wild itself before it plays
  const ensureFinale = () => {
    if (finale || finaleLoading || settings.capture !== 'wild') return;
    finaleLoading = true;
    LIT['./scenes/lit/index.js']().then((m) => { finale = m.createFinale({ game, controls, stage, themes, allowed: () => settings.capture === 'wild' && settings.mode !== 'off' && viewsAllowBattle(), short: () => settings.mode === 'short', busy: () => !!active }); }).catch((e) => { finaleLoading = false; console.warn('lit finale failed to load', e); });
  };
  settings.onChange(ensureFinale);
  ensureFinale();

  const api = {
    settings, update: (dt) => { update(dt); finale?.update(dt); }, handler, ready, lastCtx: null,
    get capture() { return settings.capture === 'wild' ? 'wild' : null; },
    get finale() { return finale; },
    get active() { return !!active; },
    skip() { active?.ac.abort(); },
  };
  return api;
}
