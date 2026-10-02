# Architecture

A short tour of how Chess 3D is put together. Plain ES modules on top of three.js 0.186, bundled by Vite. The game loads no asset files while it runs (the PNGs in `public/` are for the Home Screen and link previews): geometry comes from code, textures from canvas, the lighting environment from a generated studio map.

## Coordinates

- One board square = 1.0 unit. Y is up. The board top surface is at y = 0, centred at x = z = 0.
- File f (0 to 7 = a to h) and rank r (0 to 7 = 1 to 8) map to the square centre x = f - 3.5, z = 3.5 - r. White starts at +z (ranks 1 and 2), black at -z.
- A piece origin is the centre of its base, with the bottom at y = 0. Piece builders return a piece facing -z (towards the opponent when white). The game turns black pieces by PI around y.
- Approximate piece heights in squares: pawn 0.90, rook 1.00, knight 1.20, bishop 1.35, queen 1.60, king 1.85. Base diameters run from about 0.55 (pawn) to 0.72 (king).
- Chess squares are also indexed 0 to 63 inside the rules engine: `sq = rank * 8 + file`, so a1 = 0, h1 = 7, a8 = 56.

## Layout

    index.html           canvas, loader, HUD containers, entry script
    src/main.js          boot sequence, wiring, render loop, URL parameters, window.__chess
    src/device.js        device facts (touch, ios, phone, standalone, portrait), body classes and gesture blocking (the iOS Home Screen meta tags are static in index.html)
    src/scene.js         stage: renderer, lights, studio environment, floor, post chain, quality
    src/board.js         board, frame, inlay, labels, plinth, square highlights
    src/textures.js      procedural canvas textures (marble, walnut, maple, brass, felt)
    src/materials.js     ivory, ebony and gold piece materials
    src/pieces/setA.js   pawn, rook, knight geometry
    src/pieces/setB.js   bishop, queen, king geometry
    src/pieceset.js      builds each piece once, hands out clones
    src/rules.js         chess rules engine, no dependencies, runs in node and the browser
    src/ai.js            computer opponent (alpha-beta search), the LEVELS table
    src/goodmove.js      the Good move? helper: one Hard-strength move shown with the hint arrow
    src/game.js          rules plus 3D presentation: selection, animation, undo, captures, trays
    src/controls.js      camera orbit, board gimbal, presets, keyboard, pointer and touch
    src/ui.js            HUD: panels, move list, captured pieces, sliders, banners
    src/install-hint.js  Add to Home Screen reminder for iPhone and iPad Safari (loaded only on iOS outside the installed app)
    src/dev/diag.js      on device diagnostics box, loaded only for ?diag=1
    src/puzzles/         puzzles from the Lichess database: data, theme lines, progress store, controller, panel (see below)
    src/style.css        HUD styles
    public/              manifest.webmanifest and the PNG icons and link preview, copied to the build as they are
    test/                fast, smoke, phone and install checks (see the README)
    tools/               release check, audit plan, contact sheets, asset renderer and browser helpers

Everything the player sees on the board lives in one `gimbal` group inside the scene. The camera orbits outside it, so the gimbal rotation and the camera orbit are independent.

## Boot order (`src/main.js`)

1. Import the modules in parallel, with a progress bar over a loading screen.
2. `createStage(canvas, { quality })`, then a `gimbal` Group added to `stage.scene`.
3. `createPieceMaterials()`, `createBoard()` (added to the gimbal), `createPieceSet(materials).buildAll(progress)`.
4. `createGame({ gimbal, board, pieceSet, materials })`, `createControls(...)`, `createUI(...)`.
5. Apply URL parameters, expose `window.__chess`, start the render loop (or not, with `?manual=1`).

Loading yields to the browser between steps with a helper that races `requestAnimationFrame` against a 50 ms timer, so the loader repaints. A hidden tab never fires `requestAnimationFrame` and clamps timers to 1 s, so there the helper (in `main.js` and `pieceset.js`) returns at once and loading runs straight through.

Per frame: `controls.update(dt)`, `game.update(dt)`, `board.update(dt, t)`, `ui.sync()`, then `stage.render(dt)`. The step is capped at 50 ms.

## Modules and APIs

### `src/scene.js`

    createStage(canvas, { quality = 'high', onContext }) -> {
      renderer, scene, camera,     // PerspectiveCamera(35, aspect, 0.1, 200)
      floor,                       // shadow receiving studio floor, at y = -1.2
      lights: { key, fill, rim },  // key is a shadow casting DirectionalLight, frustum radius about 9
      lightingPresets,             // ['Studio', 'Gallery', 'Sunset', 'Night']
      setLightingPreset(name),     // animated transition of lights, environment, backdrop, exposure
      setFloorVisibility(t),       // 0..1, fades the floor and its shadow
      setQuality('low'|'medium'|'high'),
      resize(w, h),                // full reallocation of targets and the post chain
      setAspect(w, h),             // camera aspect only (touch devices use it during a burst of resize events)
      render(dt),                  // draws the frame, post chain included
      dispose(),
      quality, lightingPreset, composer, contextLost   // read only
    }

- Tone mapping: ACES filmic, sRGB output. A procedural studio environment (softbox panels on a dome) is built with PMREM and assigned to `scene.environment`.
- Shadows use `PCFShadowMap` (the soft variant is deprecated in r186). `shadowMap.autoUpdate` is off: the stage updates the shadow map once per frame so the shadow, reflection and ambient occlusion passes share it.
- A lighting preset is plain data: key, fill and rim light colour, intensity and direction, the environment panels, the backdrop gradient, exposure, bloom, vignette, tint, shadow opacity and floor colour. Add an entry to `PRESET_DEFS` to add a preset.
- Quality tiers (`QUALITY` in the same file):

| Tier | Shadow map | Pixel ratio cap | Post chain |
|---|---|---|---|
| high | 4096 | 2 | 4x MSAA, ambient occlusion (GTAO), bloom, SMAA, floor reflection |
| medium | 2048 | 1.5 | bloom, SMAA, weaker floor reflection |
| low | 1024 | 1 | none, plain render |

- Context loss (every device): the stage listens for `webglcontextlost` on the canvas and calls `preventDefault`, which allows a restore. While the context is lost `render()` draws nothing. On `webglcontextrestored` it rebuilds what the dead context owned (shadow map, reflection target, post chain, environment map) and goes on. `onContext(state)` is called with `'lost'`, `'stalled'` (nothing came back within 4 s), `'ok'` or `'failed'` (the rebuild threw); `src/main.js` shows the `#notice` element, a tap to reload message, for `stalled` and `failed`. Tests force it with the `WEBGL_lose_context` extension.
- The final pass is a small grade shader: vignette, tint, a gentle contrast curve and a dither against banding.

### `src/device.js`

    device = { touch, ios, forced, phone, standalone, portrait }

Read once at start (only `portrait` follows rotation). `touch` is `(pointer: coarse)`, or forced with `?touch=1` (on) and `?touch=0` (off, desktop behaviour even on a touch device). `phone` is touch with a short screen side of 500 CSS px or less. It sets the body classes `touch`, `ios`, `phone`, `portrait` (and `touch` on `<html>`). Only when `touch` is on it blocks the page gestures: `gesturestart`, `gesturechange` and `gestureend`, a multi finger `touchmove` that is not on the canvas, and a double tap on the canvas within 320 ms. The canvas pinch in `src/controls.js` uses Pointer Events and is unaffected. `main.js` also uses `device.touch` to start on Medium instead of High (an explicit `?quality=` wins) and to debounce resize events by about 160 ms (the camera aspect updates at once, the render targets once the burst ends).

### `src/textures.js`, `src/materials.js`

    marbleWhite(), marbleBlack(), walnut(), maple(), brass(), felt()
        -> { map, normalMap, roughnessMap, ... }    // cached on first use, tileable canvas textures
    disposeTextures()
    createPieceMaterials() -> { white: { body, accent }, black: { body, accent } }

Marble and walnut are 1024 px, maple and brass 512, felt 256. `body` is a `MeshPhysicalMaterial` (ivory for white, ebony for black, with clearcoat and sheen), `accent` is gold.

### `src/board.js`

    createBoard() -> {
      group,                          // board, frame and base, top surface at y = 0
      squareMeshes,                   // 64 pickable meshes, each with userData.square = { file, rank }
      squareCenter(file, rank),       // Vector3 in gimbal space, at y = 0
      setHighlights(list),            // [{ file, rank, kind }], kind: select | move | capture | check | last
      clearHighlights(),
      update(dt, time)                // animates the highlight glow
    }

The group extends to about +-4.65 including the frame and down to y = -0.6. Squares are separate meshes with small per-square tone variation, thin gaps and a gold inlay line. Coordinate labels are on the frame and read from both sides.

### `src/pieces/setA.js`, `src/pieces/setB.js`, `src/pieceset.js`

    buildPawn(mat), buildRook(mat), buildKnight(mat)       // setA
    buildBishop(mat), buildQueen(mat), buildKing(mat)      // setB    -> THREE.Group, unit scale

    createPieceSet(materials) -> {
      make(type, color),            // type 'p' | 'n' | 'b' | 'r' | 'q' | 'k', color 'w' | 'b'
      buildAll(onProgress)          // builds every prototype with progress callbacks
    }

Each (type, color) is built once and cloned, so clones share geometry. Piece triangle counts: pawn 58k, rook 65.5k, knight 74.4k, bishop 79.0k, queen 69.7k, king 82.8k. Bases, rings and bands use the accent material, the rest uses the body material. Every mesh casts and receives shadows. Knights face sideways along their rank toward the board centre (files a to d look toward h, e to h toward a). The game sets the facing on every landing: moves, undo, new game and loaded positions.

### `src/rules.js`

A self contained engine. `class Chess`: `load(fen)`, `fen()`, `moves(fromSq?)`, `play({ from, to, promo })`, `undo()`, `san(move)`, `inCheck()`, `kingSquare(color)`, `isAttacked(sq, by)`, `status()`, `repetitionCount()`, `perft(depth)`. Helpers: `START_FEN`, `sqName(sq)`, `nameSq(name)`, `sqFile`, `sqRank`.

`status()` returns `{ over, result, reason, check, winner }` with reasons `checkmate`, `stalemate`, `fifty-move rule`, `threefold repetition` and `insufficient material`. Set `trackKeys = false` to skip repetition bookkeeping when only searching.

### `src/ai.js`

    LEVELS = [ { id, depth, elo } ]       // novice, easy, normal, hard
    searchMove(fen, depth = 2, margin, { level, random = Math.random }) -> generator

A negamax search with alpha-beta pruning, move ordering, material and piece-square evaluation. It is a generator, so the game steps it in slices across frames and the page stays responsive. Every root move is scored with a full window and the move is picked at random among those within `margin` centipawns of the best, so play varies. The levels are Novice (depth 2, about 700 estimated Elo), Easy (depth 2, about 900), Normal (depth 3, about 1200) and Hard (depth 4, about 1450); see the README for how these were measured. `level` wins over `depth`. Novice differs from Easy by two rules: a capture that wins material outright (the captured piece is undefended or worth more than the capturer) is always taken, and otherwise with chance `NOVICE_WEAK` (0.1) it plays a random move from the weaker half of all moves. `random` is injectable so tests are deterministic (test/novice.mjs).

### `src/goodmove.js`

    createGoodMove({ game, hint }) -> { ask(): Promise<move | null>, clear(), state(), move(), canAsk(), on(fn) }

`ask()` runs `searchMove(fen, 4, 0)` in 8 ms slices (timers, not frames) and shows the answer with `hint` (`createHint({ gimbal, persist: false })` from main.js, so it ignores the Explain hint switch). State is `idle`, `thinking` or `showing`. The arrow clears on any move, undo or new game; a move made while it thinks drops the answer. `canAsk()` is false while the computer thinks or moves, in any mode but `play` (Explain, Drill), after the game ended and during a promotion. The page hook is `window.__chess.goodMove`; the UI binds it with `ui.bindGoodMove()` (desktop button `#btn-good`, phone bulb `.pgood`).

### `src/game.js`

    createGame({ gimbal, board, pieceSet, materials }) -> {
      chess, root,                         // the rules engine and the Group that holds the pieces
      on(event, fn),                       // 'change', 'promotion', 'gameover', 'newgame', 'undo'
      clickSquare(sq), pickSquare(raycaster), hoverAction(raycaster),
      update(dt), newGame(opts), undo(), loadFen(fen),
      setVsComputer(on, { color, depth, level }), // color is the computer's side; level (an id of LEVELS) wins over depth
      getState(),                          // turn, moves (SAN), captured, advantage, check, over, thinking, fen, ...
      move(from, to, promo), playMoves(list), selectSquare(name), finishAnimations(),
      audit(), busy, pendingPromotion, pieceCount, sqName, nameSq
    }

- Moves animate: pieces slide, knights jump in an arc, captured pieces fly to the tray beside the board, a checkmated king topples. Castling moves both pieces, en passant removes the right pawn, promotion swaps the pawn for the chosen piece.
- `getState().captured.w` lists the white pieces that were lost, `captured.b` the black pieces. `advantage` is positive when white is ahead.
- The computer opponent is switched on at start (`main.js` calls `setVsComputer(true, { color: 'b', level })` unless `?ai=0`; level is `?ai=1` to `4`, else localStorage `chess3d.level`, else `easy`). With it on, undo takes back the computer move and the player move together.
- `audit()` compares the visual pieces with the engine board and returns a list of problems (empty when consistent). The tests use it.
- `pickSquare` uses cheap proxies first, then the real meshes, then the square tops, and prefers what the player can actually use when a tall piece hides a smaller one.

### Projection and focus (`src/scene.js`, `src/controls.js`)

`stage.setProjection('perspective' | 'ortho')` swaps the active camera and rebuilds the post chain (the passes hold a camera); `stage.camera` is a getter for the active one, so callers read it fresh on every use (picking sets its raycaster from `stage.camera`). The orthographic frame is sized by the controls through `stage.setOrthoSize(halfHeight)`. In ortho the planar floor reflection is off, and the floor fades out when looking straight down. `controls.setProjection(kind, { pitch, yaw, dist, dur })` switches and glides to a pose; in ortho `cam.dist` is the zoom (19 is neutral) and the frame fit (`orthoFit`) puts the board, and in landscape the trays, in the middle of the free area (the HUD columns count as insets on desktop). `controls.setFocus({ x, z } | null, { dur, zoom })` eases the look point in the board plane and an extra pull back factor (zoom >= 1), reset by `setFocus(null)`.

### `src/controls.js`

    createControls({ stage, gimbal, canvas, onPick, onHover }) -> {
      update(dt), apply(), onResize(w, h),
      setPreset(name), reset(), levelBoard(), flip(), topDown(), toggleSpin(),
      setGimbal(axis, degrees), setCamera({ yaw, pitch, dist }), nudgeZoom(factor),
      setFrame({ top, right, bottom, left }), setLocked(bool),
      presets, hooks, onChange(fn),
      spin, camera, gimbalDeg, animating, frame, locked      // read only
    }
    PRESETS   // White view, Black view, Top down, Side, Isometric

- Camera: yaw, pitch and distance around a target just above the board. Pitch is limited to 1.5 to 89.6 degrees, distance to 6 to 40. Drag gives damped inertia. On narrow screens the camera pulls back so the board fits the width.
- Gimbal: rotation of the `gimbal` group in YXZ order, set by sliders, keys (W S A D Q E) or Shift, Ctrl or right drag.
- Framing: `setFrame` takes the free canvas area as insets in CSS px (the phone HUD reports it). With insets the camera picks the smallest distance at which the board, its pieces up to king height and both capture trays fit the free area with a small margin, and centres them there; with zero insets the old width fit applies (desktop and tablets).
- Touch: two fingers pinch to zoom and twist to turn the gimbal yaw at the same time (6 degree dead zone). `setLocked(true)` stops orbit, pinch, twist, wheel and inertia; taps, keys, presets and Reset still work.
- Presets animate yaw, pitch, distance and the gimbal together on an ease curve, taking the shortest way round for every angle.
- The floor fades with `stage.setFloorVisibility` once the board tilts more than 8 degrees on X or Z, and is gone at 38.
- `hooks` is filled by the UI (`undo`, `newGame`, `toggleHud`, `toggleHelp`) so the keyboard handler can reach it.

### `src/views/registry.js`

The single list of views the player chooses from. `VIEWS = [{ id, label, kind: 'preset' | 'easy' | 'play', style?, when? }]`: `white`, `black`, `top`, `side`, `iso` (perspective presets), `easy-flat` (style A: orthographic top view, orbit locked with `controls.setOrbitLock`: no tilt or turn by drag, twist or keys, zoom and Flip work, 3D pieces hidden, symbols drawn by `src/views/symbols.js`), `easy-3d` (style B: orthographic, pitch 62 degrees, the 3D pieces scaled 1.15x around their base on their inner nodes, the game keeps the group scale), `play` (phone portrait only, perspective, closer, followed by `src/views/play.js`).

    createViews({ controls, stage, game, board, device }) -> { list(), current(), set(id, { instant, remember }), next(), isEasy(), style(), label(), on(fn), update() }

`list()` is filtered by `when` for the device and orientation. The choice lives in localStorage `chess3d.view`; a stored id that is not offered (play after turning to landscape) falls back to `play` on a phone in portrait, else `white`. `?view=` applies for one load and is not stored. `update()` runs every frame (main.js advance): it keeps the style B scale on pieces made later and falls back when the device turns. `viewsAllowBattle()` is false while an easy view is on: the director asks it before a battle scene. `controls.hooks.preset` is set so keys 1 to 5 and V go through the views. German names are added to `DE` in this module.

### `src/views/play.js`

The follow camera of the Play view (phone portrait). `createPlayView({ controls, game, views, device, stage, hint?, size? }) -> { update(dt), focus, home, dispose() }`, created in main.js after the views and ticked in `advance`. It does nothing unless `views.current() === 'play'`. The Play view's home is registry `dist` 10.3, pitch 40 degrees, plus `HOME_FOCUS` (look point 0.8 towards the player's side) and a `lift` of 2.2 along the view's up axis, so the board sits low with the player's pieces large above the thumb bar; the a and h files may crop. The follow policy picks the squares that must stay visible: the selected piece (its top counts too) and every legal target; else the squares of the move just made, until it has landed plus 0.55 s (the computer's reply is followed the same way); else the squares of any visible hint arrow (groups named `move-hint` in the gimbal: Explain, Drill, Practise, Good move, puzzles). `solveFocus({ camera, w, h, free, squares, at })` (exported, pure) projects those squares through the live camera against the free canvas area (`controls.frame`) and returns `{ x, z, zoom }`: a slide of the look point and, only when sliding cannot fit them (a queen with targets on both wings), a pull back factor. It is sent to `controls.setFocus(p, { dur: 0.55, zoom, lift })`; after the move the focus returns to home. The first entry into the view is instant. `controls.setFocus` eases `{ x, z }` (board plane shift of the look point; this moves the camera with it, so near rows look bigger), `zoom` (a factor on the fitted distance) and `lift` (a shift along the screen's up axis: the board slides down without coming closer). `setFocus(null)` resets all three.

### `src/ui.js`

    createUI({ game, controls, stage, quality }) -> { sync(), toast(msg), toggleHud(force), toggleHelp(), render(state), bindGoodMove(gm) }

Builds the HUD into `#hud`: a left column (turn indicator, view presets, gimbal sliders, lighting and quality selects) and a right column (game buttons, computer opponent settings, SAN move list, captured pieces with the material balance). It also renders the promotion chooser (`#promo`), the game over banner (`#banner`), a toast for check (`#toast`) and the shortcut sheet. Below 900 px width the cards collapse and the left column becomes a sheet opened by the Controls button. On phones (`body.phone`, see device.js) `buildPhone()` adds a different HUD instead: a status line (`.pstatus`: turn, check, computer thinking, last move), a thumb bar (`.pbar`, buttons `.tb[data-act]`: Undo, New game with a confirm during a game, Flip, Views cycling to the next preset, Learn (opens the Learn sheet), Menu) at the bottom in portrait and on the right in landscape, and a bottom sheet (`.psheet` over `.pscrim`) with accordion sections Game, Moves, View and gimbal (with Lock view), Scene and Help. An invisible `.pframe` element marks the free area; its rectangle goes to `controls.setFrame`. Phones get lite glass (no backdrop blur). Tablets keep the desktop HUD with 44 px targets.

### Battle scenes: `src/battle/director.js`, `settings.js`, the capture hook in `game.js`, `controls.cinematic`

    createDirector({ game, controls, stage, ui }) -> { settings, update(dt), skip(), ready(), active }
    createSettings({ ui }) -> { mode: 'on' | 'short' | 'off', set(partial), onChange(fn) }
    game.onCapture(hook)          // hook(info) may be async; hook.stage = true asks for a scene, hook.enabled() = false opts out
    controls.cinematic({ target, yaw, pitch, dist, dur }) -> Promise   // swoop to a close-up; target is in gimbal space
    controls.restore({ dur }) -> Promise                              // glide back; the normal camera state is never changed

- Every capture of a normal move (animated, play mode) calls the capture hooks. Not called on undo, loaded positions, scripted URL moves (`playMoves`, instant) or in explain mode. With a staging hook enabled the attacker stops 0.85 short of the victim along the z axis (towards the victim, so -z when white attacks), the game is busy until every hook has finished, then the attacker steps onto the square and the victim flies to its tray. Undo, new game and load cancel a running scene (the hook's `signal` aborts) and the state settles at once.
- The director runs one scene at a time: it loads the scene module for the attacker (`scenes/<pawn|knight|bishop|rook|queen|king>.js`, default export `{ attacker, cam?, run(ctx) }`) and `fx.js` and `sfx.js` lazily, swoops the camera to a low close-up across the fight, runs the scene, restores every transform and attachment on both pieces, disposes the fx and sends the camera back. A tap or any key skips (aborts `ctx.signal`). A scene longer than 6 s of scene time is skipped. Short runs the scene clock 3 times faster. Until a scene module exists a built in lunge and tumble plays.
- `ctx` has `stage, attackerObj, victimObj` (the game's piece objects: use `.group`), `square, short, fx, sfx, signal, dir, center, root, gimbal`, and a scene clock: `time()`, `wait(s)`, `tween({ dur, delay, ease, step(e, u) })`, `onFrame(fn(dt, t))`. `wait` and `tween` never resolve after an abort, so a skipped scene just stops.
- The camera close-up blends the normal pose towards the close-up in `controls.apply` (`cine.k` from 0 to 1) instead of changing yaw, pitch and distance, so the way back is exact. On phones the target is centred in the free area, narrow views pull back. Orbit, wheel, keys and spin are ignored while it is held.
- Scenes are promise driven. Tests use `__chess.stepAsync(seconds)` (awaited, gives the event loop a turn per slice) instead of `__chess.step` wherever a scene may play, and `__chess.battle.ready()` to have every module loaded.

### `src/openings/explain.js`, `explain-panel.js`, `arrow.js`

Explain mode: walk one of the starter lines on the 3D board.

    createExplain({ game, hint, lines, pause = 900, onSide }) -> {
      state(),                  // { phase: 'list' | 'walking' | 'finished', line, ply, total, message, due, hint, canBack }
      start(id), stop(), restart(), next(), back(), setHint(on),
      tick(dt),                 // every frame: plays the opponent move once the pause has run, keeps the hint in step
      on(fn), lines, playable(line)
    }
    createHint({ gimbal }) -> { show(fromSq, toSq), hide(), enabled, visible }
    mountExplain({ game, controls, ui, gimbal, pause }) -> { explain, hint, card, strip, tick }

- The player makes the own moves on the board; `game.setMoveGuard(fn)` lets the controller refuse every other move (the piece does not move, the message says what the line plays). The opponent moves are played with `game.playSan` after `pause` milliseconds, counted in `tick(dt)` while the board is at rest, so `?manual=1` tests step time and `pause = 0` plays on the next tick.
- `game.setMode('explain')` stops the computer opponent and the two move undo; `stop()` returns to play on a fresh board.
- `message` is a descriptor (`intro`, `move` with its ply, `refused`), never text: the panel picks the line text by language, so a language switch redraws it. Positions come from the rules engine (`moveFromSan` gives the from and to squares of the due move).
- The hint is a flat gold overlay in the gimbal group: the from-square faint, the to-square strong, a straight arrow between them. It is shown only while the board listens for an own move. The switch is stored under `chess3d.hint` in localStorage.
- Phone: the card in the Menu sheet holds the list; while a line runs a strip under the status line carries the sentence and the buttons, and `body.explaining` moves the camera frame below it (`--xh` is the strip height).
- `window.__chess.openings` is the test hook: `{ explain, hint, card, strip, tick }`.

### `src/puzzles/`

    data.js        PUZZLES = [{ id, fen, moves, theme, rating, band }], BANDS = ['starter', 'growing', 'tricky']   (generated by tools/build-puzzles.mjs)
    themes.js      THEMES = { mate1, mate2, hanging, fork }, each { en, de }: the line shown above the board
    progress.js    createPuzzleProgress({ storage, puzzles, bands, rand }) -> { band(), stats(), next(), finish(id, { clean }), reset(), onChange(fn) }
    controller.js  createPuzzles({ game, hint, sweep, progress, pause = 600, onSide }) -> { state(), start(), next(), help(), stop(), tick(dt), on(fn) }
    panel.js       mountPuzzlesPanel({ puzzles, ui }) (the puzzle in progress), puzzlesTab({ puzzles, progress, onStart }) (the Learn tab)
    strings.js     German texts, puzzles.css the styles

- Data format (Lichess form, CC0): `fen` is the position before the opponent's last move, `moves[0]` is that move, then the player's solution alternates with the replies (UCI). The player is the side to move after `moves[0]`. The data is checked with the rules engine in `test/puzzles-data.mjs`.
- `createPuzzles` uses `game.setMode('puzzle')` (the computer opponent stops, the game over banner is not shown) and `game.setMoveGuard`. `start()` takes the next puzzle from the progress store, loads the position, plays `moves[0]` with its slide and turns the board to the player through `onSide`. The guard lets only the stored move through, and in mate puzzles (`mate1`, `mate2`) any checkmate, and in a mate in two a different first move after which every reply allows a mate in one (the controller then plays any reply itself). A refused move leaves the piece where it is, counts a miss and shows a calm message. `help()` shows the Openings hint arrow even when the hint switch is off, and restores the switch. The opponent reply is played in `tick(dt)` after `pause`, like Explain. Solved: `progress.finish`, then `sweep.play({ side, squares })`. `state().message` is a descriptor (`start`, `right`, `wrong`, `again`, `help`, `your`, `solved`), never text.
- Undo or New game from the HUD while a puzzle runs restart the same puzzle, so the board and the ply agree. `stop()` returns to an ordinary fresh game.
- Progress (`chess3d.puzzles`, version 1): `{ v, band, solved: { band: [ids] }, queue: [{ id, wait }], run: { clean, slip } }`. Up a band after 3 clean solves in a row, down after 3 not clean in a row. A not clean puzzle goes to the queue and is served again after 2 other puzzles. Solved ids do not repeat until the band is used up (queued ones first, then it starts over). Ids missing from a rebuilt data set drop out on load. Storage that is missing or blocked keeps working in memory.
- Phone: while a puzzle runs a strip under the status line (`.pzstrip`, one row in landscape) carries the theme line, the message and Help, or Next when solved; `--ph` is its height and `body.puzzling` moves the camera frame below it.
- `window.__chess.puzzles` and `window.__chess.puzzleProgress` are the test hooks.

### `src/learn/`, `src/train/` (Learn, Adopt, Mine, Drill)

    mountLearn({ ui, openings, store, drill }) -> { idle, render, tab, show(tab), editing, export, import, file, message }

- `src/train/store.js` keeps the repertoire and the cards (one per own move position, key `positionKey4()`), `ladder.js` and `guesses.js` the schedule, `planner.js` the session plan, `drill.js` and `drill-panel.js` the drill, `sweep.js` the gold light. Their APIs are in the file headers.
- Boot (`main.js`): store, sweep, `mountExplain({ ..., store, sweep })`, drill, drill panel, `mountLearn`. The frame loop ticks `drill.tick(dt)` and `sweep.tick(dt)`, so `?manual=1` stepping drives both.
- `explain-panel.js` no longer builds the line list. It owns an empty `idle` element that `learn.js` fills with the tabs. Desktop: the card shows `idle` while no line runs and the walking UI during a line (and is hidden by `body.drilling`). Phone: the card is not mounted, `idle` sits in the Learn sheet (`ui.learnSheet.body`) and the walking UI is the strip.
- `ui.js` adds the sixth thumb bar button (`.tb[data-act="learn"]`) and a second bottom sheet `.psheet.plearn`; only one sheet is open at a time (`close()` closes both). `ui.learnSheet` is `{ body, open(), close(), isOpen }` on a phone and `null` elsewhere.
- Adopt: at the end of a line `explain-panel.js` shows `.xadopt` (Add to my openings, then In my openings, inert). It calls `store.adopt(id)` and `sweep.play({ side, squares })` with the player's own piece squares. Practise: due cards exist, one start button (`drill.startDue()`), else the adopted lines (`drill.startPractise(id)`). Mine: bar from `store.progress(id)`, Edit shows Remove per row (`store.remove`). A line or run starting stops whatever else runs on the board.
- Export and Import are a block mounted with `ui.mountSettings('train-data', ...)`: a file download of `store.exportJSON()` and a file input into `store.importJSON(text)`, whose error sentence is shown.
- Learn strings (English fallbacks in the code, German in `src/learn/strings.js`) are registered with `addDE`.
- `window.__chess.train = { store, drill, sweep, learn }` is the test hook. `test/learn.mjs` (smoke tier) drives it on desktop and on phone sizes.

### `src/install-hint.js`

    mountInstallHint()         // called once after the board is ready, by a dynamic import in main.js
    wantInstallHint(storage)   // the gate, also counts the visit

A bottom sheet with three drawn steps (the Share icon in the Safari bar, the Add to Home Screen row, the installed icon from `apple-touch-icon.png`) and a Later button. `main.js` imports it only when `device.ios` and not `device.standalone`. The gate then needs all of: iOS, not standalone, no URL flag of the app at all (`quality touch light preset yaw pitch dist gx gy gz fen moves select promo ai spin hud help manual diag`), not `navigator.webdriver`, and working `localStorage`. The state is one key, `chess3d.install-hint`, `{ visits, shows, last }`: it shows on the first visit, and then at most twice more, at least 3 visits after the last showing. It appears 2.2 s after the board is ready. Later, a tap on the scrim or Escape closes it at once and nothing waits on it. There is no service worker and no network use.

### `src/dev/diag.js`

    initDiag({ stage }) -> { dispose() }     // also at window.__chess.diag

Imported by `main.js` only for exactly `?diag=1` (right after `window.__chess` is set). With any other value the chunk is never requested, no `#diag` element exists and no frame loop runs. The box sits at the bottom left above the thumb bar and has its own `requestAnimationFrame` loop for frame times, so the app render loop is untouched. Collapsed it shows fps, p95 and the tier, expanded it adds frame ms p50, p95 and max over 5 s, the tier and whether the post chain is on, pixel ratio against dpr, canvas and CSS size, draw calls and thousands of triangles from `renderer.info`, an estimated graphics memory figure (drawing buffer, post targets, shadow map, reflection target, a flat guess per texture and geometry) and the input facts from `device.js`. Pointer events stop at the box, so a tap never selects on the board.

### Assets in `public/`

`manifest.webmanifest` (name Chess 3D, standalone, portrait, theme and background `#07080c`, icons 192, 512 and a maskable 512), `icon-192.png`, `icon-512.png`, `icon-maskable-512.png`, `apple-touch-icon.png` (180) and `og-image.png` (1200 x 630). These are the only asset files in the repo. They are generated by `tools/render-assets.mjs` from the running game (headless Chrome, the real board and pieces, only camera, lights and backdrop set by the tool), committed, and regenerated on demand. `index.html` links the manifest and the touch icon and carries the og and twitter tags with absolute URLs under `https://bop-del.github.io/chess-3d/`.

## Test hooks

`window.__chess = { stage, gimbal, board, game, controls, ui, battle, audio, sfx, views, play, symbols, THREE, pick }`. With `?manual=1` it also has `step(seconds, hz = 30)`, which advances controls, game, battle and board by simulated time, `stepAsync(seconds, hz)` (the same, awaited, with an event loop turn per slice, for battle scenes), and `draw(dt)`, which renders the current state. This makes browser tests deterministic: no real time passes, so slow software rendering does not matter.

`window.__chessReady` becomes `true` once loading is done and `window.__chessError` holds a message if loading failed.

## Conventions

- No em dashes or double hyphens as punctuation in code comments, UI text or docs.
- Every piece mesh casts and receives shadows and uses a physical material, so the environment lights it.
- Lathe profiles use at least 160 radial segments with a densely sampled profile, so there is no faceted look.
- Cross-module calls go through the APIs above. Modules do not reach into each other's internals.
