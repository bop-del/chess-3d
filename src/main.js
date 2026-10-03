// App entry: loads modules with progress, wires stage, board, pieces, game, controls and HUD.
import * as THREE from 'three';
import { device } from './device.js';
import { createThemes, isTheme, storedTheme } from './themes/registry.js';
import { mountSwatches } from './themes/swatches.js';
import { t, translateTree, i18n } from './i18n.js';
import { LEVELS } from './ai.js';

window.__chessBooted = true;   // tells the start-up guard in index.html that this script ran
window.__chessBoot = { script: performance.now() };   // start timings for ?diag=1, ms since navigation (download ends here)
const params = new URLSearchParams(location.search);
const $ = (id) => document.getElementById(id);
const stepEl = $('loader-step'), errEl = $('loader-err'), loaderEl = $('loader'), darkEl = $('intro-dark');

translateTree(loaderEl);
document.documentElement.lang = i18n.language;
let shownProgress = 0;
let intro = null;              // the start sequence (src/intro.js), null when it is off or failed
window.__chessProgress = [];   // every progress step as a percent, for tests
// the start sequence shows loading as a king under gold light, then a building board: the stages of boot below (the old progress
// numbers) light the king up to 0.16 and carry the king phase to 0.30 (textures 0.30 to 0.38, the board, the pieces, the game
// and the HUD to 0.94). Once the HUD is measured the camera knows where it ends: boardGo() then lets the squares drop, the frame
// settle and the pieces rise (timeline 0.30 to 0.95 in src/intro.js), while the rest of boot goes on; ready finishes it.
const T_IN = [0, 0.16, 0.3, 0.38, 0.4, 0.94], T_OUT = [0, 0.12, 0.12, 0.29, 0.29, 0.299];
function introTarget(p) {
  for (let i = 1; i < T_IN.length; i++) if (p <= T_IN[i]) return T_OUT[i - 1] + (T_OUT[i] - T_OUT[i - 1]) * (p - T_IN[i - 1]) / (T_IN[i] - T_IN[i - 1]);
  return T_OUT[T_OUT.length - 1];
}
function progress(p, msg) {
  shownProgress = Math.max(shownProgress, p);
  window.__chessProgress.push(Math.round(shownProgress * 100));
  window.__loader?.progress(shownProgress);
  intro?.setTarget(introTarget(shownProgress));
  if (msg) stepEl.textContent = msg;
}
// Yield so the loader can repaint. rAF never fires in a background tab, so race it with a timer. A hidden tab has
// nothing to repaint and clamps timers to 1 s, so it does not wait at all.
const tick = () => document.hidden ? Promise.resolve() : new Promise((res) => {
  let done = false;
  const go = () => { if (!done) { done = true; setTimeout(res, 0); } };
  requestAnimationFrame(go);
  setTimeout(go, 50);
});

function fail(err) {
  console.error(err);
  errEl.hidden = false;
  errEl.textContent = String(err && (err.stack || err.message) || err).slice(0, 900);
  stepEl.textContent = t('loader.error', 'Something went wrong while loading');
  window.__chessError = String(err && err.message || err);
}
window.addEventListener('error', (e) => { if (!loaderEl.classList.contains('done')) fail(e.error || e.message); });
window.addEventListener('unhandledrejection', (e) => fail(e.reason));

// The start sequence plays unless it is switched off: ?intro=0, prefers-reduced-motion (the finished board shows at once) and
// ?manual=1 (tests step the clock themselves; ?intro=1 forces it on, then the test drives window.__intro.tick).
const manual = params.get('manual') === '1';
const reduced = typeof matchMedia === 'function' && matchMedia('(prefers-reduced-motion: reduce)').matches;
const wantIntro = params.get('intro') === '1' || (params.get('intro') !== '0' && !manual && !reduced);

async function boot() {
  if (!wantIntro) document.body.classList.remove('intro');   // index.html starts with it: the HUD stays hidden from the first paint while the sequence plays
  progress(0.02, 'Loading modules');
  await tick();
  // the rest of the game starts loading at once; what the king needs (stage, materials, pieces, camera, the sequence) is awaited first
  const restP = Promise.all([import('./board.js'), import('./textures.js'), import('./game.js'), import('./ui.js'), import('./battle/director.js'), import('./battle/sfx.js'), import('./audio.js')]);
  restP.catch(() => {});   // a failure is reported where restP is awaited
  const [{ createStage }, { createPieceMaterials }, { createPieceSet }, { createControls }, { createViews }, introMod] = await Promise.all([
    import('./scene.js'), import('./materials.js'), import('./pieceset.js'), import('./controls.js'), import('./views/registry.js'),
    wantIntro ? import('./intro.js') : null,
  ]);
  progress(0.1, 'Preparing the studio');
  await tick();

  const canvas = $('stage');
  // touch devices start on Medium, desktop on High; ?quality= and the quality menu override
  const quality = params.get('quality') || (device.touch ? 'medium' : 'high');
  const stage = createStage(canvas, { quality, onContext: showContextNotice });
  const gimbal = new THREE.Group();
  gimbal.name = 'gimbal';
  stage.scene.add(gimbal);
  const materials = createPieceMaterials();
  const pieceSet = createPieceSet(materials);

  // camera and views come first: the sequence ends in whatever view the controls hold (the stored or ?view= view, the White
  // view on desktop, the Play view on a phone in portrait), so it reads that pose every frame
  let game = null, tokens = null, battle = null, openings = null, drill = null, puzzles = null, sweep = null;
  const raycaster = new THREE.Raycaster();
  const ndc = new THREE.Vector2();
  const pick = (cx, cy) => {
    const r = canvas.getBoundingClientRect();
    ndc.set(((cx - r.left) / r.width) * 2 - 1, -((cy - r.top) / r.height) * 2 + 1);
    raycaster.setFromCamera(ndc, stage.camera);
    return game ? game.pickSquare(raycaster) : null;
  };
  let hoverQueued = false, hx = 0, hy = 0;
  const controls = createControls({
    stage, gimbal, canvas,
    onPick: (x, y) => game?.clickSquare(pick(x, y)),
    onHover: (x, y) => {
      hx = x; hy = y;
      if (hoverQueued) return;
      hoverQueued = true;
      requestAnimationFrame(() => {
        hoverQueued = false;
        if (!game) return;
        const r = canvas.getBoundingClientRect();
        ndc.set(((hx - r.left) / r.width) * 2 - 1, -((hy - r.top) / r.height) * 2 + 1);
        raycaster.setFromCamera(ndc, stage.camera);
        canvas.style.cursor = game.hoverAction(raycaster) ? 'pointer' : '';
      });
    },
  });
  const views = createViews({ controls, stage, game: {}, board: null, device });   // game.root is only read to scale the pieces, which are found by name until the game exists
  const resize = () => {
    const w = window.innerWidth, h = window.innerHeight;
    stage.resize(w, h);
    controls.onResize(w, h);
  };
  resize();
  const deferredView = applyViewParams({ controls, views, stage });

  // the start sequence: the king first (a failure here falls back to the CSS board, the game boots the same way)
  let introEnd = null, simT = 0;   // simT: the test driven clock of ?manual=1&intro=1
  const introFailed = (e) => {
    console.warn('start sequence failed, using the CSS loader', e);
    try { intro?.dispose(); } catch (e2) { /* nothing left to restore */ }
    intro = null;
    document.body.classList.remove('intro');
    loaderEl.classList.remove('live');
    loaderEl.classList.add('fallback');
    import('./loader-board.js').then((m) => { m.mountLoader(); window.__loader?.progress(shownProgress); }).catch(() => {});
    introEnd?.();
  };
  if (introMod) {
    try {
      document.body.classList.add('intro');
      intro = introMod.createIntro({ stage, gimbal, pieceSet, phone: device.phone, darkEl, onLive: () => loaderEl.classList.add('live'), now: manual ? () => simT : undefined });
      intro.setTarget(introTarget(shownProgress));
    } catch (e) { intro = null; introFailed(e); }
  }
  const compile = () => { try { stage.renderer.compileAsync(stage.scene, stage.camera).catch(() => {}); } catch (e) { /* compiled on first draw instead */ } };

  // render loop: starts now, so the king turns while the rest loads. The full per frame update replaces `advance` once it exists.
  const boot = window.__chessBoot;
  let advance = (dt) => { controls.update(dt); };
  let last = performance.now();
  const frameOnce = (dt, raw) => {
    advance(dt);
    if (intro) { try { intro.update(raw); } catch (e) { introFailed(e); } }
    if (!boot.first) {
      // the first render compiles every shader program: time it on its own
      const a = performance.now();
      stage.render(dt);
      boot.render = performance.now() - a; boot.first = performance.now(); boot.programs = stage.renderer.info.programs?.length || 0;
    } else stage.render(dt);
  };
  function frame(now) {
    const raw = Math.max(0, Math.min(0.25, (now - last) / 1000));   // the sequence runs on the wall clock, the game clock is capped
    last = now;
    const t0 = performance.now();
    frameOnce(Math.min(0.05, raw), raw);
    if (boot.loaded && !boot.ready) boot.frameMs = Math.max(boot.frameMs || 0, performance.now() - t0);   // the slowest frame while the sequence plays out
    requestAnimationFrame(frame);
  }
  // test hook: the sequence's state; in ?manual=1&intro=1 a test also drives it frame by frame (tick) and loading goes on in real time
  if (intro) {
    window.__intro = {
      get state() { return { shown: intro?.shown ?? 1, target: intro?.target ?? 1, ended: intro ? intro.ended : true }; },
      setCap: (c) => intro?.setCap(c),
      ...(manual ? { tick: (dt = 1 / 30) => { simT += dt; frameOnce(Math.min(0.05, dt), dt); } } : {}),
    };
  }
  if (!manual) requestAnimationFrame(frame);

  progress(0.16, 'Weaving marble and wood');
  await tick();
  progress(0.3, 'Inlaying the board');
  await tick();
  // restP has been loading all along
  const [{ createBoard }, { prepareTextures }, { createGame }, { createUI }, { createDirector }, { sfx }, { audio }] = await restP;
  // phones and Low quality get 512 px textures; the pixels come from a cache or Workers, and the bar moves per texture
  await prepareTextures({ cap: device.phone || quality === 'low' ? 512 : 1024, onStep: (n, m) => progress(0.3 + 0.08 * n / m) });
  const board = createBoard();
  gimbal.add(board.group);
  intro?.attachBoard(board);
  compile();
  // themes: Classic is the start look and builds nothing. A stored or ?theme= choice loads its module now, before the squares
  // drop in, so the board never changes colour while it builds
  const themes = createThemes({ stage, board, pieceSet, materials });
  const flagTheme = params.get('theme');
  if (flagTheme && isTheme(flagTheme)) await themes.set(flagTheme, { persist: false });   // this load only
  else await themes.set(storedTheme(), { persist: false });

  await pieceSet.buildAll((f, msg) => progress(0.4 + f * 0.52, msg));
  boot.pieces = performance.now();
  progress(0.94, 'Setting up the game');
  await tick();

  game = createGame({ gimbal, board, pieceSet, materials });
  applyGameParams({ game });   // ?fen, ?moves, ?select, ?ai: before the sequence takes the pieces
  intro?.attachGame(game);
  themes.attachGame(game);
  compile();
  await tick();
  // the HUD is built now, not last: on a phone it tells the camera which part of the canvas is free, and the sequence ends in
  // exactly that pose
  const ui = createUI({ game, controls, stage, quality, views });
  controls.onResize(window.innerWidth, window.innerHeight);   // reads the HUD column width
  const [{ createPlayView }, { createTokens }] = await Promise.all([import('./views/play.js'), import('./views/tokens.js')]);
  const play = createPlayView({ controls, game, views, device, stage });
  tokens = createTokens({ gimbal, game, materials, stage });
  views.on(() => tokens.setVisible(views.current() === 'tokens'));
  tokens.setVisible(views.current() === 'tokens');
  const upLocal = new THREE.Vector3(), gimbalInv = new THREE.Quaternion();
  const orientLabels = () => {
    // screen-up expressed in board space decides which side the labels read upright from
    upLocal.set(0, 1, 0).applyQuaternion(stage.camera.quaternion).applyQuaternion(gimbalInv.copy(gimbal.quaternion).invert());
    board.orientLabels(upLocal);
  };
  let t = 0;
  // the frame loop runs the whole game from here on (the modules that follow are optional in it until they exist)
  advance = (dt) => { t += dt; controls.update(dt); views.update(dt); play.update(dt); game.update(dt); tokens.sync(); battle?.update(dt); openings?.tick(dt); drill?.tick(dt); puzzles?.tick(dt); sweep?.tick?.(dt); board.update(dt, t); orientLabels(); ui.sync(); };
  advance(0.001);   // the Play view's first focus and the HUD measure land in the camera now
  intro?.boardGo();
  intro?.setTarget(0.95);
  battle = createDirector({ game, controls, stage, ui });
  sfx.hook(game);          // move, capture and check sounds; arms the audio unlock (no context before a gesture)
  audio.mountMute(ui);     // the mute switch, right below the Battle scenes setting
  const [{ createMusic }, { mountMusicSettings }] = await Promise.all([import('./music/player.js'), import('./music/settings.js')]);
  const music = createMusic({ audio });    // background piano, starts after the first tap or key
  mountMusicSettings(ui, music);           // Music switch, Volume, Tone, Tempo, Room
  progress(0.96);
  await tick();
  // Openings (Explain mode): its own panel in the HUD, its own hint marks on the board, ticked with the frame
  const [{ mountExplain }, { createStore }, { createSweep }, { createDrill }, { mountDrillPanel }, { mountLearn }] = await Promise.all([
    import('./openings/explain-panel.js'), import('./train/store.js'), import('./train/sweep.js'),
    import('./train/drill.js'), import('./train/drill-panel.js'), import('./learn/learn.js'),
  ]);
  const [{ createPuzzles }, { createPuzzleProgress }, { PUZZLES }, { mountPuzzlesPanel }, { createReward }] = await Promise.all([
    import('./puzzles/controller.js'), import('./puzzles/progress.js'), import('./puzzles/data.js'), import('./puzzles/panel.js'), import('./puzzles/reward.js'),
  ]);
  // Train and Learn: the store (localStorage), the gold sweep, the drill, and the Learn UI over them
  const store = createStore({});
  sweep = createSweep({ gimbal, stage });
  openings = mountExplain({ game, controls, ui, gimbal, store, sweep });
  drill = createDrill({ game, hint: openings.hint, store, sweep, onSide: openings.onSide });
  mountDrillPanel({ drill, ui });
  // Puzzles: the controller shares the Openings hint arrow (one arrow on the board at a time) and the gold sweep
  let puzzleStore = null;
  try { puzzleStore = window.localStorage; } catch (e) { /* storage blocked: progress lives for the session */ }
  const puzzleProgress = createPuzzleProgress({ storage: puzzleStore, puzzles: PUZZLES });
  const reward = createReward({ gimbal, sfx });   // the burst, chime and card of a solve, and the chapter wave (ticked by the controller)
  puzzles = createPuzzles({ game, hint: openings.hint, sweep, progress: puzzleProgress, reward, onSide: openings.onSide,
    // a finished chapter: after the board finale the puzzle closes and the Learn path opens on the next chapter
    onChapter: () => { puzzles.stop(); puzzleProgress.ack(); learn.openPath(); } });
  mountPuzzlesPanel({ puzzles, ui, progress: puzzleProgress, openPath: () => { if (learn.openPath) learn.openPath(); else { learn.show('puzzles'); ui.learnSheet?.open(); } } });
  const learn = mountLearn({ ui, openings, store, drill, puzzles, puzzleProgress, reward });
  progress(0.98);
  await tick();
  // Good move?: one good move shown with its own arrow (it does not follow the Explain hint switch)
  const [{ createGoodMove }, { createHint }] = await Promise.all([import('./goodmove.js'), import('./openings/arrow.js')]);
  const goodMove = createGoodMove({ game, hint: createHint({ gimbal, persist: false }) });
  ui.bindGoodMove(goodMove);
  mountSwatches({ themes, ui });

  // touch: rotation and the browser toolbar fire bursts of resize events. The camera follows at once, the render targets
  // are reallocated once the burst has ended. Desktop reallocates on every event as before.
  let resizeT = 0;
  const onResize = () => {
    if (!device.touch) { resize(); return; }
    const w = window.innerWidth, h = window.innerHeight;
    stage.setAspect(w, h);
    controls.onResize(w, h);
    clearTimeout(resizeT);
    resizeT = setTimeout(resize, 160);
  };
  window.addEventListener('resize', onResize);
  if (device.touch) window.addEventListener('orientationchange', onResize);

  window.__chess = { stage, gimbal, board, game, controls, ui, battle, audio, music, sfx, THREE, pick, openings, views, play, tokens, puzzles, puzzleProgress, reward, goodMove, themes, train: { store, drill, sweep, learn } };
  // on device diagnostics overlay: loaded only for exactly ?diag=1, so nothing of it exists otherwise
  if (params.get('diag') === '1') import('./dev/diag.js').then((m) => { window.__chess.diag = m.initDiag({ stage }); }).catch((e) => console.warn('diag overlay failed', e));

  if (manual) {
    // deterministic mode for automated tests: no loop, caller steps time and draws
    window.__chess.step = (seconds, hz = 30) => { const n = Math.max(1, Math.round(seconds * hz)); for (let i = 0; i < n; i++) advance(1 / hz); };
    // like step, but gives the event loop a turn after every slice: battle scenes are promise driven and load modules on
    // demand, so a synchronous step loop would never let them start. Use this (awaited) wherever a scene may play.
    window.__chess.stepAsync = async (seconds, hz = 30) => {
      const n = Math.max(1, Math.round(seconds * hz));
      for (let i = 0; i < n; i++) { advance(1 / hz); await new Promise((r) => setTimeout(r, 0)); }
    };
    window.__chess.draw = (dt = 0.016) => { orientLabels(); stage.render(dt); stage.render(dt); };
    window.__chess.draw();
  }

  progress(1, 'Ready');
  await tick();
  boot.loaded = performance.now();
  if (intro) {
    // loading is done: the sequence plays out the rest within half a second, then the game is on
    await new Promise((res) => { introEnd = res; intro.finish(res); });
    document.body.classList.remove('intro');
    if (deferredView) views.set(deferredView, { instant: true, remember: false });   // an Easy view cannot be flown to: it takes over now
    intro = null;
  } else {
    // the CSS board plays out its last squares (only when the sequence could not run)
    await new Promise((res) => { if (window.__loader) window.__loader.finish(res); else res(); });
  }
  boot.ready = performance.now();
  applyLateParams({ game, ui, stage, controls });   // ?hud, ?help, ?light, ?spin, ?promo: on the finished board
  loaderEl.classList.add('done');
  document.body.classList.add('ready');
  window.__chessReady = true;
  if (device.ios && !device.standalone) import('./install-hint.js').then((m) => m.mountInstallHint()).catch(() => {});   // iPhone Safari only
}

// WebGL context loss (every device): the stage pauses drawing and rebuilds on restore. If the browser does not give the
// context back, or the rebuild fails, the notice offers a reload.
function showContextNotice(state) {
  const el = $('notice');
  if (!el) return;
  if (state === 'ok' || state === 'lost') { el.hidden = true; return; }   // a short loss recovers on its own: no notice yet
  el.textContent = state === 'failed' ? t('notice.failed', 'Graphics could not be restored. Tap to reload the page.') : t('notice.stalled', 'The browser has not returned the graphics yet. Tap to reload the page.');
  el.hidden = false;
}

// The camera part of the URL flags, applied before the sequence starts (the sequence ends in this view): ?view=, ?preset=, the
// board gimbal and ?yaw, ?pitch, ?dist. Returns the view to switch to when the sequence is over, if it is an Easy view (an
// orthographic camera cannot be flown to: the sequence then ends in the White view and the Easy view takes over with a cut).
function applyViewParams({ controls, views, stage }) {
  const view = params.get('view');
  // ?view= is for this load only; without it the remembered choice (or the device default) is applied
  if (!(view && views.set(view, { instant: true, remember: false }))) views.set(views.current(), { instant: true });
  let deferred = null;
  if (wantIntro && stage.camera.isOrthographicCamera) { deferred = views.current(); views.set('white', { instant: true, remember: false }); }
  const preset = params.get('preset');
  if (preset) {
    controls.setPreset(preset);
    for (let i = 0; i < 120; i++) controls.update(0.02); // jump to the end of the transition
  }
  for (const a of ['x', 'y', 'z']) {
    if (params.has('g' + a)) controls.setGimbal(a, +params.get('g' + a));
  }
  if (params.has('yaw') || params.has('pitch') || params.has('dist')) {
    const c = controls.camera;
    const DEG = Math.PI / 180;
    controls.setCamera({
      yaw: params.has('yaw') ? +params.get('yaw') * DEG : c.yaw,
      pitch: params.has('pitch') ? +params.get('pitch') * DEG : c.pitch,
      dist: params.has('dist') ? +params.get('dist') : c.dist,
    });
  }
  return deferred;
}

// the game part of the URL flags: the position and the computer opponent, applied as soon as the game exists
function applyGameParams({ game }) {
  const fen = params.get('fen');
  if (fen) { try { game.loadFen(fen); } catch (e) { console.warn('Ignoring invalid fen parameter'); } }
  const moves = params.get('moves');
  if (moves) game.playMoves(moves.split(',').filter(Boolean), { instant: true });
  const sel = params.get('select');
  if (sel) game.selectSquare(sel);
  const ai = params.get('ai');
  // vs computer is on by default (you play white, Easy); ?ai=0 turns it off, ?ai=1 to 4 picks a level (Novice, Easy, Normal,
  // Hard) and beats the remembered one, which lives in localStorage chess3d.level.
  if (ai !== '0') {
    let stored = null;
    try { stored = localStorage.getItem('chess3d.level'); } catch (e) { /* storage may be blocked */ }
    const level = LEVELS[(+ai || 0) - 1]?.id || (LEVELS.some((l) => l.id === stored) ? stored : 'easy');
    game.setVsComputer(true, { color: 'b', level });
  }
}

// the rest, applied when the start sequence is over
function applyLateParams({ game, ui, stage, controls }) {
  if (params.get('hud') === '0') ui.toggleHud(true);
  if (params.get('help') === '1') ui.toggleHelp();
  const light = params.get('light');
  if (light) stage.setLightingPreset?.(light);
  if (params.get('spin') === '1') controls.toggleSpin();
  const promo = params.get('promo');
  if (promo) game.clickSquare(game.nameSq(promo.slice(0, 2))), game.clickSquare(game.nameSq(promo.slice(2, 4)));
}

boot().catch(fail);
