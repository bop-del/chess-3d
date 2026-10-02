// App entry: loads modules with progress, wires stage, board, pieces, game, controls and HUD.
import * as THREE from 'three';
import { device } from './device.js';
import { t, translateTree, i18n } from './i18n.js';

window.__chessBooted = true;   // tells the start-up guard in index.html that this script ran
const params = new URLSearchParams(location.search);
const $ = (id) => document.getElementById(id);
const fillEl = $('loader-fill'), stepEl = $('loader-step'), errEl = $('loader-err'), loaderEl = $('loader');

translateTree(loaderEl);
document.documentElement.lang = i18n.language;
let shownProgress = 0;
function progress(p, msg) {
  shownProgress = Math.max(shownProgress, p);
  fillEl.style.width = `${Math.round(shownProgress * 100)}%`;
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

async function boot() {
  progress(0.02, 'Loading modules');
  await tick();
  const [{ createStage }, { createBoard }, { createPieceMaterials }, { createPieceSet }, { createGame }, { createControls }, { createUI }, { createDirector }, { sfx }, { audio }] =
    await Promise.all([
      import('./scene.js'), import('./board.js'), import('./materials.js'),
      import('./pieceset.js'), import('./game.js'), import('./controls.js'), import('./ui.js'), import('./battle/director.js'), import('./battle/sfx.js'), import('./audio.js'),
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

  progress(0.16, 'Weaving marble and wood');
  await tick();
  const materials = createPieceMaterials();
  progress(0.3, 'Inlaying the board');
  await tick();
  const board = createBoard();
  gimbal.add(board.group);

  const pieceSet = createPieceSet(materials);
  await pieceSet.buildAll((f, msg) => progress(0.4 + f * 0.52, msg));
  const boot = window.__chessBoot = { pieces: performance.now() };   // start timings for ?diag=1, ms since navigation
  progress(0.94, 'Setting up the game');
  await tick();

  const game = createGame({ gimbal, board, pieceSet, materials });
  const raycaster = new THREE.Raycaster();
  const ndc = new THREE.Vector2();
  const pick = (cx, cy) => {
    const r = canvas.getBoundingClientRect();
    ndc.set(((cx - r.left) / r.width) * 2 - 1, -((cy - r.top) / r.height) * 2 + 1);
    raycaster.setFromCamera(ndc, stage.camera);
    return game.pickSquare(raycaster);
  };
  let hoverQueued = false, hx = 0, hy = 0;
  const controls = createControls({
    stage, gimbal, canvas,
    onPick: (x, y) => game.clickSquare(pick(x, y)),
    onHover: (x, y) => {
      hx = x; hy = y;
      if (hoverQueued) return;
      hoverQueued = true;
      requestAnimationFrame(() => {
        hoverQueued = false;
        const r = canvas.getBoundingClientRect();
        ndc.set(((hx - r.left) / r.width) * 2 - 1, -((hy - r.top) / r.height) * 2 + 1);
        raycaster.setFromCamera(ndc, stage.camera);
        canvas.style.cursor = game.hoverAction(raycaster) ? 'pointer' : '';
      });
    },
  });
  const ui = createUI({ game, controls, stage, quality });
  const battle = createDirector({ game, controls, stage, ui });
  sfx.hook(game);          // move, capture and check sounds; arms the audio unlock (no context before a gesture)
  audio.mountMute(ui);     // the mute switch, right below the Battle scenes setting
  // Openings (Explain mode): its own panel in the HUD, its own hint marks on the board, ticked with the frame
  const [{ mountExplain }, { createStore }, { createSweep }, { createDrill }, { mountDrillPanel }, { mountLearn }] = await Promise.all([
    import('./openings/explain-panel.js'), import('./train/store.js'), import('./train/sweep.js'),
    import('./train/drill.js'), import('./train/drill-panel.js'), import('./learn/learn.js'),
  ]);
  // Train and Learn: the store (localStorage), the gold sweep, the drill, and the Learn UI over them
  const store = createStore({});
  const sweep = createSweep({ gimbal, stage });
  const openings = mountExplain({ game, controls, ui, gimbal, store, sweep });
  const drill = createDrill({ game, hint: openings.hint, store, sweep, onSide: openings.onSide });
  mountDrillPanel({ drill, ui });
  const learn = mountLearn({ ui, openings, store, drill });

  // resize
  const resize = () => {
    const w = window.innerWidth, h = window.innerHeight;
    stage.resize(w, h);
    controls.onResize(w, h);
  };
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
  resize();

  // scripted states for testing and screenshots
  applyParams({ game, controls, stage, ui });

  window.__chess = { stage, gimbal, board, game, controls, ui, battle, audio, sfx, THREE, pick, openings, train: { store, drill, sweep, learn } };
  // on device diagnostics overlay: loaded only for exactly ?diag=1, so nothing of it exists otherwise
  if (params.get('diag') === '1') import('./dev/diag.js').then((m) => { window.__chess.diag = m.initDiag({ stage }); }).catch((e) => console.warn('diag overlay failed', e));

  // render loop
  let last = performance.now(), t = 0;
  const upLocal = new THREE.Vector3(), gimbalInv = new THREE.Quaternion();
  const orientLabels = () => {
    // screen-up expressed in board space decides which side the labels read upright from
    upLocal.set(0, 1, 0).applyQuaternion(stage.camera.quaternion).applyQuaternion(gimbalInv.copy(gimbal.quaternion).invert());
    board.orientLabels(upLocal);
  };
  const advance = (dt) => { t += dt; controls.update(dt); game.update(dt); battle.update(dt); openings.tick(dt); drill.tick(dt); sweep.tick?.(dt); board.update(dt, t); orientLabels(); ui.sync(); };
  function frame(now) {
    const dt = Math.min(0.05, (now - last) / 1000);
    last = now;
    advance(dt);
    if (!boot.first) {
      // the first render compiles every shader program: time it on its own
      const a = performance.now();
      stage.render(dt);
      boot.render = performance.now() - a; boot.first = performance.now(); boot.programs = stage.renderer.info.programs?.length || 0;
    } else stage.render(dt);
    requestAnimationFrame(frame);
  }
  if (params.get('manual') === '1') {
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
  } else requestAnimationFrame(frame);

  progress(1, 'Ready');
  await tick();
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

function applyParams({ game, controls, stage, ui }) {
  const fen = params.get('fen');
  if (fen) { try { game.loadFen(fen); } catch (e) { console.warn('Ignoring invalid fen parameter'); } }
  const moves = params.get('moves');
  if (moves) game.playMoves(moves.split(',').filter(Boolean), { instant: true });
  const sel = params.get('select');
  if (sel) game.selectSquare(sel);
  const ai = params.get('ai');
  // vs computer is on by default (you play white, Easy); ?ai=0 turns it off, ?ai=3 or 4 picks a level.
  if (ai !== '0') game.setVsComputer(true, { color: 'b', depth: +ai || 2 });
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
  if (params.get('hud') === '0') ui.toggleHud(true);
  if (params.get('help') === '1') ui.toggleHelp();
  const light = params.get('light');
  if (light) stage.setLightingPreset?.(light);
  if (params.get('spin') === '1') controls.toggleSpin();
  const promo = params.get('promo');
  if (promo) game.clickSquare(game.nameSq(promo.slice(0, 2))), game.clickSquare(game.nameSq(promo.slice(2, 4)));
}

boot().catch(fail);
