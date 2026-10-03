# Architecture

A short tour of how Chess 3D is put together. Plain ES modules on top of three.js 0.186, bundled by Vite. The game loads no asset files while it runs (the PNGs in `public/` are for the Home Screen and link previews): geometry comes from code, textures from canvas, the lighting environment from a generated studio map.

## Coordinates

- One board square = 1.0 unit. Y is up. The board top surface is at y = 0, centred at x = z = 0.
- File f (0 to 7 = a to h) and rank r (0 to 7 = 1 to 8) map to the square centre x = f - 3.5, z = 3.5 - r. White starts at +z (ranks 1 and 2), black at -z.
- A piece origin is the centre of its base, with the bottom at y = 0. Piece builders return a piece facing -z (towards the opponent when white). The game turns black pieces by PI around y.
- Approximate piece heights in squares: pawn 0.90, rook 1.00, knight 1.20, bishop 1.35, queen 1.60, king 1.85. Base diameters run from about 0.55 (pawn) to 0.72 (king).
- Chess squares are also indexed 0 to 63 inside the rules engine: `sq = rank * 8 + file`, so a1 = 0, h1 = 7, a8 = 56.

## Layout

    index.html           canvas, loader (gold title and step line), HUD containers, entry script
    src/main.js          boot sequence, wiring, render loop, URL parameters, window.__chess
    src/i18n.js          interface language: t(key, fallback, vars), the DE table, addDE, sanDisplay (stored data stays English SAN)
    src/device.js        device facts (touch, ios, phone, standalone, portrait), body classes and gesture blocking (the iOS Home Screen meta tags are static in index.html)
    src/scene.js         stage: renderer, lights, studio environment, floor, post chain, quality
    src/board.js         board, frame, inlay, labels, plinth, square highlights; `setDrop(v)` for the start sequence
    src/intro.js         the start sequence: a turning king, then the board builds itself on the real renderer
    src/loader-board.js  the fallback loading screen (a CSS 3D board), loaded only when the sequence cannot run
    src/textures.js      board textures: cache, Worker pool, canvas textures (marble, walnut, maple, brass, felt)
    src/texture-gen.js   the pure pixel generators (no three, no DOM), also run by src/texture-worker.js
    src/materials.js     ivory, ebony and gold piece materials, and applyPieceTheme
    src/themes/          theme registry, spec applier, swatch row, one module per theme (see Themes)
    src/pieces/setA.js   pawn, rook, knight geometry
    src/pieces/setB.js   bishop, queen, king geometry
    src/pieceset.js      builds each piece once, hands out clones
    src/rules.js         chess rules engine, no dependencies, runs in node and the browser
    src/ai.js            computer opponent (alpha-beta search), the LEVELS table
    src/goodmove.js      the Good move? helper: one Hard-strength move shown with the hint arrow
    src/review/          the game review: classify.js, analyze.js, worker.js, engine.js, review.js (controller and strip), strings.js, review.css
    src/game.js          rules plus 3D presentation: selection, animation, undo, captures, trays
    src/trays.js         capture tray layout (pure numbers): slots, scale and value order for the captured pieces of one side
    src/trays-setting.js the Captured pieces at the side switch (Scene card), stored per device, `?trays=0|1`
    src/controls.js      camera orbit, board gimbal, presets, keyboard, pointer and touch
    src/ui.js            HUD: panels, move list, captured pieces, sliders, banners
    src/install-hint.js  Add to Home Screen reminder for iPhone and iPad Safari (loaded only on iOS outside the installed app)
    src/dev/diag.js      on device diagnostics box, loaded only for ?diag=1
    src/audio.js         WebAudio context and plumbing (unlock on the first gesture, buses, Mute switch, stopScene), no audio files
    src/battle/          capture scenes: director.js, settings.js, fx.js (effects kit), sfx.js (the voices, also the move sounds), scenes/ (see Battle scenes)
    src/battle/scenes/   one module per attacker (pawn, knight, bishop, rook, queen, king), kit-a.js (helpers of the first three), _kit.js (helpers of the other three)
    src/openings/        Explain mode: lines.js (the starter lines), pgn.js (PGN with variations into a tree of positions), explain.js, explain-panel.js, arrow.js (the hint arrow); catalogue.js names a position (ECO and name) from catalogue-data.js, a generated lazy chunk (tools/build-catalogue.mjs)
    src/learn/           the Learn sheet and tabs (learn.js), German strings
    src/train/           repertoire store, cards, ladder, guesses, planner, drill and its panel, sweep (the gold light)
    src/views/           view registry, the Play view follow camera, the Tokens view
    src/puzzles/         puzzles from the Lichess database: data, theme lines, path, progress store, controller, panel, reward (see below)
    src/style.css        HUD styles
    public/              manifest.webmanifest and the PNG icons and link preview, copied to the build as they are
    test/                fast, smoke, phone and install checks (see the README)
    tools/               release check, audit plan, contact sheets, asset renderer and browser helpers

Everything the player sees on the board lives in one `gimbal` group inside the scene. The camera orbits outside it, so the gimbal rotation and the camera orbit are independent.

## Boot order (`src/main.js`)

1. Start loading everything in parallel. Await what the king needs first: stage, materials, piece set, controls, views and `intro.js`.
2. `createStage(canvas, { quality })`, a `gimbal` Group in `stage.scene`, `createPieceMaterials()`, `createPieceSet(materials)`.
3. `createControls(...)` and `createViews(...)` now, then the camera part of the URL flags (`applyViewParams`: `view`, `preset`, gimbal, `yaw`, `pitch`, `dist`). The camera is then where the game starts.
4. `createIntro(...)` (the king on e1) and the render loop start here: the king turns while the rest loads. Progress feeds `intro.setTarget` through `introTarget()`.
5. `prepareTextures`, `createBoard()` (`intro.attachBoard` hides it), the stored theme (`createThemes` without a game, `attachGame` later), `pieceSet.buildAll`, `createGame` (`applyGameParams`: `fen`, `moves`, `select`, `ai`; then `intro.attachGame` hides the pieces) and `createUI`. The HUD is built this early on purpose: on a phone it measures the free area and tells the camera, so the sequence ends in the right pose.
6. `intro.boardGo()`: the squares drop, the frame settles, the pieces rise and the camera pulls back to the pose the controls hold, while the rest of boot (battle, Openings, Train, Puzzles, Learn, Good move) loads. `intro.finish` plays out the remainder within half a second, `body.intro` is removed (the HUD fades in), `applyLateParams` (`hud`, `help`, `light`, `spin`, `promo`) runs and `__chessReady` is set.

The start sequence (`src/intro.js`) shows on the real canvas and renderer, so there is no handover. Its progress `shown` follows the real progress at a fixed speed (never faster than 1.2 s from 0 to 1) and, once loading is done, must reach 1 within 0.45 s. Timeline: 0 to 0.12 the king lights up, 0.12 to 0.30 the king alone, 0.30 to 0.70 squares drop (`board.setDrop`, a vertex shader hook, a1 to h8), 0.62 to 0.80 frame, inlays and labels settle, 0.72 to 0.96 the other pieces rise (the king hands over from a hero copy to the game's king), the camera pulls back over 0.30 to 1. It scales hidden meshes to 0.001 instead of hiding them so their shaders compile up front (`renderer.compileAsync`). `stage.setDim(k)` scales the stage lights, two gold rim lights do the work. Everything is put back as the game made it (`restore`). It is off with `?intro=0`, `prefers-reduced-motion` and `?manual=1` (then `?intro=1` turns it on and a test drives `__intro.tick(dt)`). If it throws, `main.js` mounts the CSS board of `loader-board.js` and boots as before. Test: `test/intro.mjs`.

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
      setThemeLight(spec | null),  // a theme's lighting on top of a base preset (final values, no gain trim); null returns to the picked preset
      onQuality(fn),               // fn(quality) after every setQuality
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

### Themes: `src/themes/`

    createThemes({ stage, board, pieceSet, materials, game = null }) -> { list(), current(), set(id, { persist }), on(fn), attachGame(game), textureCount }
    THEMES                       // [{ id, label: { en, de }, swatch: [hex, hex] }] classic, tournament, wood, metal, glass
    mountSwatches({ themes, ui })  // the swatch row, first in the Scene card (the Menu sheet on a phone)
    createSkin(materials) -> { apply(specs | null) }   // themes/apply.js

A theme is one bundle: board squares, frame, inlay, pieces, tray and lighting. The Staunton shapes never change, only material parameters, so a switch rebuilds no geometry. Classic is today's look: it has no module and builds nothing, which keeps the start as fast as before. Every other theme is a module loaded with `import()` on its first pick:

    board(ctx)  -> { squaresLight, squaresDark, frame, inlay, gold, plinth, labels, tray }   // property specs
    pieces(ctx) -> { white: { body, accent }, black: { body, accent }, dark }                // from pieces-<id>.js
    light(ctx)  -> { preset, key, fill, rim, exposure, env, floor, bg: { top, bottom, glow, glowAmount }, post: { bloom, vignette, tint } }

`ctx = { THREE, quality, base, track(texture) }`. A spec is plain data: scalars as they are, colours as `'#hex'`, `normalScale` as a number, maps as textures, `null` clears a map. `base` holds the classic maps (maple, walnut, black marble) a theme may reuse, so no second copy is made. The materials are shared by all squares and pieces, so applying a spec changes the board, every piece and the captured pieces in the trays at once. `createSkin` snapshots a material's classic values when it is created and every `apply` starts from that snapshot, so a theme never inherits the one before it. The tray slabs are found by mesh name (`tray-slab`) and skinned the same way; the tray trim is the white accent piece material.

`set(id)` builds the next theme's specs, applies them, then disposes the textures the previous theme registered through `track()`, so ten switches leave the renderer at its baseline (`test/themes.mjs` checks `renderer.info.memory`). Picks are queued and the last one wins. `set(id, { persist: false })` is for the `?theme=` flag: this load only. Otherwise the id is stored in `localStorage` `chess3d.theme` and read at the next start (an unknown value means Classic). The lighting goes through `stage.setThemeLight`, which starts the usual animated transition towards the theme's state. Picking a lighting preset in the Scene card afterwards replaces the theme's lighting but keeps its materials; Classic returns to the preset the player picked.

Glass uses real transmission only on the High quality tier (one extra scene pass); Low and Medium get an opaque tinted clearcoat. A quality change while a theme is on rebuilds that theme. Metal keeps bloom at 0.05 or below, because the mirror like metals blow out white above that. `game` may be null at first (the start sequence turns the theme on before the game exists): `attachGame(game)` hands it over later, and the tray material is skinned then. The Tokens view and the battle scenes keep their own materials.

### `src/device.js`

    device = { touch, ios, forced, phone, standalone, portrait }

Read once at start (only `portrait` follows rotation). `touch` is `(pointer: coarse)`, or forced with `?touch=1` (on) and `?touch=0` (off, desktop behaviour even on a touch device). `phone` is touch with a short screen side of 500 CSS px or less. It sets the body classes `touch`, `ios`, `phone`, `portrait` (and `touch` on `<html>`). Only when `touch` is on it blocks the page gestures: `gesturestart`, `gesturechange` and `gestureend`, a multi finger `touchmove` that is not on the canvas, and a double tap on the canvas within 320 ms. The canvas pinch in `src/controls.js` uses Pointer Events and is unaffected. `main.js` also uses `device.touch` to start on Medium instead of High (an explicit `?quality=` wins) and to debounce resize events by about 160 ms (the camera aspect updates at once, the render targets once the burst ends).

### `src/textures.js`, `src/materials.js`

    await prepareTextures({ cap, onStep })       // before createBoard: pixels from the IndexedDB cache (cap 512 only) or parallel Workers, else the main thread with yields
    marbleWhite(), marbleBlack(), walnut(), maple(), brass(), felt()
        -> { map, normalMap, roughnessMap, ... }    // the prepared textures (generated on the spot if prepareTextures did not run)
    disposeTextures()
    createPieceMaterials() -> {
      white: { body, accent }, black: { body, accent },
      dark,                        // the knight inlay material, null until the first knight is built (pieceset.js fills it)
      classic,                     // Map: snapshot of each material's Classic values
      current,                     // the piece spec of the active theme, or null
      apply(spec | null)           // applyPieceTheme: a theme's piece spec (null = Classic)
    }

Marble and walnut are 1024 px, maple and brass 512, felt 256. `body` is a `MeshPhysicalMaterial` (ivory for white, ebony for black, with clearcoat and sheen), `accent` is gold.

### `src/board.js`

    createBoard() -> {
      group,                          // board, frame and base, top surface at y = 0
      squareMeshes,                   // 64 pickable meshes, each with userData.square = { file, rank }
      base,                           // the plinth under the board
      setDrop(v),                     // the start sequence: 0 nothing built, 1 the finished board; squares cast no shadow below 1
      applyTheme(spec | null),        // board, frame, inlay, gold, plinth and label specs of a theme (null = Classic)
      squareCenter(file, rank),       // Vector3 in gimbal space, at y = 0
      setHighlights(list),            // [{ file, rank, kind }], kind: select | move | capture | check | last
      clearHighlights(),
      update(dt, time)                // animates the highlight glow
    }

    DROP_SPAN = 0.58, DROP_LEN = 0.42      // exported: square k (0 at a1, 1 at h8) starts at k * DROP_SPAN of the drop and takes DROP_LEN of it
    dropT(drop, k) -> (drop - k * DROP_SPAN) / DROP_LEN     // the progress of square k, unclamped
    easeOutBackT(t)                                         // clamps t to 0..1, a gentle overshoot

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

### `src/review/` (game review)

A finished game, replayed on the 3D board with its mistakes marked. Loaded by main.js (one call, `mountReview({ game, gimbal, createHint })`, after the Good move helper), exposed as `window.__chess.review`. Nothing else in the UI knows about it: the Review the game button is added to the game over card by the review itself, from its own `gameover` listener (it runs after the HUD's and appends to `#banner .banner-card .row`).

    classify.js   pure: winPercent(cp), winDrop(best, reply), classify(drop, isBest), moveAccuracy, accuracy, reviewGame(positions, moves), sentenceFacts(...)
    analyze.js    pure: analyzePosition(fen, depth), analyzeSteps (generator), bestLine(fen, first, plies), analyzeMany(fens, opts), MATE, DEPTH
    worker.js     the Web Worker around analyzeMany and bestLine (in { type: 'analyze' | 'line' | 'cancel' }, out { type: 'pos' | 'done' | 'line' })
    engine.js     createEngine() -> { analyze(fens, { depth, onPosition, onDone }), line(fen, first, plies), cancel(), dispose() }: the Worker, or the same code time sliced on the main thread when Workers are missing
    review.js     createReview({ game, hint, engine }) -> { open({ at }), close({ restore }), next(), prev(), go(i), goMove(n), setDetails(on), canOpen(), state(), on(fn) } and mountReview (the DOM)

**Engine.** Hard's search (`searchMove(fen, 4, 0)`, no randomness) on every position of the game, one after the other, about 0.1 to 0.3 s each. A position's analysis is `{ fen, turn, score, best }`, the score in centipawns for the side to move (mate is plus or minus 100000 minus the ply; a mated or stalemated position has no best move). `analyzeMany` yields to the event loop every 20 ms, so a `cancel` message reaches the Worker mid search. The best line is asked for lazily, only for the position on screen with Details open: the stored best move, then three more plies at depth 3.

**Classification.** The unit is win chance, not centipawns, so a lost game stays quiet: `winPercent(cp) = 50 + 50 * (2 / (1 + exp(-0.004 cp)) - 1)` (cp capped at 1000). A move gives away `drop = max(0, winPercent(best before) - winPercent(-score after))` points. The engine's own move is `best`; a drop of 10 or more (about a pawn from an equal game) is a `mistake` (orange), 25 or more (a bit under a knight) a `blunder` (red), anything less `good`. Accuracy per move is `103.1668 exp(-0.04354 drop) - 3.1669` clamped to 0 to 100, per side the mean. A move is classified once both its positions are analysed. The sentence is made from facts (`sentenceFacts`: the better move is mate, the played move allows mate, the better move wins a piece, the played move leaves a piece to be taken, the better move gives check, else generic) and spoken in German or English from `strings.js` (keys `review.*`).

**Steps.** The cursor is `{ ply, suggest }`. `ply` is the position on the board (0 the start, n after n moves). A marked move has an extra step in front of it, `{ ply: n - 1, suggest: true }`: the board before the move, the gold arrow (its own `createHint`, not the Explain one) on the better move, the sentence. A strip chip or graph point for a marked move lands on that step; forward plays the real move. Opening starts at ply 0.

**Borrowing the game.** While the review is open the computer is switched off (`setVsComputer(false)`), `setMoveGuard(() => false)` refuses every move, positions are set with `loadFen` (any jump), `playMoves` (one step forward, instant, so no battle scene) or `undo` (one step back), and the HUD banner is kept hidden. `close()` plays the game back from its start FEN (`loadFen` then `playMoves`), puts the computer back and re-emits the game over card; `close({ restore: false })` is used when the player starts a new game in the middle of a review (the `newgame` event). `review.active` also sets `body.reviewing`.

**Layout.** One `section.rv` fixed at the bottom: sentence, optional Details box (graph, best line, accuracy), the move strip, then the controls (start, back, position, forward, Details, close). Desktop: bottom centre between the two columns. Phone: above the thumb bar (`--bar`), 44 px targets. Under 900 px wide on a tablet it takes the whole bottom and hides the right column while it is open.

Tests: `test/review-core.mjs` (fast tier: thresholds, accuracy, the engine on small positions and a scripted game) and `test/review.mjs` (smoke group `review`: the whole flow in the real page on desktop and phone; `node test/review.mjs --shots` writes shots and a contact sheet to `.tmp/review/`).

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
- Capture trays: `src/trays.js` `layoutTray(items)` places the captured pieces of one side on its slab (1.45 by 4.9, `SLAB`): inside a 0.14 margin on every side, two columns, row depth from each piece's real base diameter (`group.userData.dia`, measured by `pieceset.js` like `height`, times 1.15 because the Easy 3D view draws pieces that much larger) plus a 0.05 gap, ordered by value (queen, rooks, bishops, knights, pawns) from the far end of the slab, so the tall pieces stand at the back. The scale starts at 0.62 and shrinks (down to 0.4) only if a tray would not fit; 15 pieces, the most one side can lose, fit at 0.62, so a third column is never needed (`test/trays.mjs` checks every fill level with the real piece sizes). While the tray is not full the spare depth spreads the rows (at most 0.2 each). `game.js` keeps `tray.w` and `tray.b` in capture order, derives every piece's slot (`trayTo`, `trayScale`) with `layoutColor`, flies the new victim to its slot and glides the others to theirs (0.35 s). A piece has one motion at a time (`moveGen`): a newer command makes the older tween a no-op. `audit()` also runs `checkLayout` on both trays.
- Captured pieces at the side switch: `game.setTrays(on)` (`game.trays`, `getState().trays`) and `controls.setTrays(on)`, driven by `src/trays-setting.js` (a switch row mounted with `ui.mountSettings('trays', row)` right below Battle scenes; `localStorage` `chess3d.trays`, `'0'` is off, default on; `?trays=0|1` beats the stored value for that load and does not overwrite it). Off: the slabs are hidden, a new victim slides a little past the board edge while it fades out (it is still in `tray.*`, so the HUD row and the material count keep reading it; the fade works on cloned materials, the shared ones stay opaque), and the camera fit leaves out the tray corners (`traysOn` in `controls.js`, so the board gets a little bigger where the width limits, mostly phone landscape). Switching takes effect at once; switching on flies every captured piece back from where it faded into its slot. Undo restores the piece from either state.
- `getState().captured.w` lists the white pieces that were lost, `captured.b` the black pieces. `advantage` is positive when white is ahead.
- Modes: `game.setMode(m)` (read with `game.mode`) is one of four: `play` (the default), `explain` (Openings), `drill` (Train) and `puzzle`. Anything but `play` stops the computer opponent, drops a pending search and selection, and takes the move guard (`setMoveGuard`) of the running controller; setting `play` clears the guard. Features that belong to ordinary games check `mode === 'play'`: the computer's reply and the two move undo, battle scene staging and the plain capture hooks (sounds), and Good move (`canAsk()`). A mate in `puzzle` mode does not emit `gameover` (it is the answer, not the end of a game).
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
      retarget({ pitch, dist }, dur = 0.6),   // change pitch and distance only: a running turn (Flip) keeps its target, the gimbal stays
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

The single list of views the player chooses from. `VIEWS = [{ id, label, kind: 'preset' | 'easy' | 'play', style?, when? }]`: `white`, `black`, `top`, `side`, `iso` (perspective presets), `tokens` (style T: orthographic top view, orbit locked with `controls.setOrbitLock`: no tilt or turn by drag, twist or keys, zoom and Flip work, 3D pieces hidden, turned discs with a gold Staunton silhouette made by `src/views/tokens.js`), `above` (style V: perspective, pitch 65 degrees, orbit locked, the real 3D pieces; the look point is shifted 0.3 towards Black with `controls.setFocus` so the back rank stays clear of the frame), `easy-3d` (style B: orthographic, pitch 62 degrees, the 3D pieces scaled 1.15x around their base on their inner nodes, the game keeps the group scale), `play` (phone portrait only, perspective, closer, followed by `src/views/play.js`).

    createViews({ controls, stage, game, board, device }) -> { list(), current(), set(id, { instant, remember }), next(), isEasy(), style(), label(), on(fn), update() }

`list()` is filtered by `when` for the device and orientation. The choice lives in localStorage `chess3d.view`; a stored id that is not offered (play after turning to landscape) falls back to `play` on a phone in portrait, else `white`. `?view=` applies for one load and is not stored. `update()` runs every frame (main.js advance): it keeps the style B scale on pieces made later and falls back when the device turns. `viewsAllowBattle()` is false while an easy view is on: the director asks it before a battle scene. Every easy view calls `controls.setEdgeToEdge(true)`: in portrait the fit margin drops from 4 to 1 percent so the board fills the free width between status line and thumb bar. The list is reordered on a phone in portrait to Play, Tokens, From above, Easy 3D, then the presets (the Views button walks `list()`). A stored `easy-flat` migrates to `tokens`. German: Tokens is Spielsteine, From above is Von oben (so the Top down preset is Draufsicht). `controls.hooks.preset` is set so keys 1 to 5 and V go through the views. German names are added to `DE` in this module.

### `src/views/play.js`

The follow camera of the Play view (phone portrait). `createPlayView({ controls, game, views, device, stage, hint?, size? }) -> { update(dt), focus, home, dispose() }`, created in main.js after the views and ticked in `advance`. It does nothing unless `views.current() === 'play'`. The Play view's home is registry `dist` 10.3, pitch 40 degrees, plus `HOME_FOCUS` (look point 0.8 towards the player's side) and a `lift` of 2.2 along the view's up axis, so the board sits low with the player's pieces large above the thumb bar; the a and h files may crop. The follow policy picks the squares that must stay visible: the selected piece (its top counts too) and every legal target; else the squares of the move just made, until it has landed plus 0.55 s (the computer's reply is followed the same way); else the squares of any visible hint arrow (groups named `move-hint` in the gimbal: Explain, Drill, Practise, Good move, puzzles). `solveFocus({ camera, w, h, free, squares, at })` (exported, pure) projects those squares through the live camera against the free canvas area (`controls.frame`) and returns `{ x, z, zoom }`: a slide of the look point and, only when sliding cannot fit them (a queen with targets on both wings), a pull back factor. It is sent to `controls.setFocus(p, { dur: 0.55, zoom, lift })`; after the move the focus returns to home. The first entry into the view is instant. `controls.setFocus` eases `{ x, z }` (board plane shift of the look point; this moves the camera with it, so near rows look bigger), `zoom` (a factor on the fitted distance) and `lift` (a shift along the screen's up axis: the board slides down without coming closer). `setFocus(null)` resets all three.

### `src/ui.js`

    createUI({ game, controls, stage, quality = 'high', views }) -> {
      sync(), toast(msg), toggleHud(force), toggleHelp(), render(state), bindGoodMove(gm),
      mountPanel(id, element, { title }),   // a card in the HUD (Explain, Drill, Puzzles); on a phone the panels sit in the sheets and strips
      mountSettings(id, element),           // a block in the Scene card (the Menu sheet on a phone): swatches, Battle scenes, Mute, Export and Import
      learnSheet,                           // { body, open(), close(), isOpen } on a phone, null elsewhere
      setLearnBar(owner, spec | null)       // the in-game learning controls that replace the thumb bar while Explain, Drill or a puzzle runs (layout C); a no-op off phones
    }

Builds the HUD into `#hud`: a left column (turn indicator, view presets, gimbal sliders, lighting and quality selects) and a right column (game buttons, computer opponent settings, SAN move list, captured pieces with the material balance). It also renders the promotion chooser (`#promo`), the game over banner (`#banner`), a toast for check (`#toast`) and the shortcut sheet. Below 900 px width the cards collapse and the left column becomes a sheet opened by the Controls button. On phones (`body.phone`, see device.js) `buildPhone()` adds a different HUD instead: a status line (`.pstatus`: turn, check, computer thinking, last move), a thumb bar (`.pbar`, buttons `.tb[data-act]`: Undo, New game with a confirm during a game, Flip, Views cycling to the next preset, Learn (opens the Learn sheet), Menu; each shows a 24 px gold icon and one short word from the `tb.*` strings, the full name is the aria-label and title) at the bottom in portrait and on the right in landscape, and a bottom sheet (`.psheet` over `.pscrim`) with accordion sections Game, Moves, View and gimbal (with Lock view), Scene and Help. An invisible `.pframe` element marks the free area; its rectangle goes to `controls.setFrame`. Phones get lite glass (no backdrop blur). Tablets keep the desktop HUD with 44 px targets.

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
- Helpers: `scenes/kit-a.js` serves pawn, knight and bishop (`SIZE`, `RADIUS`, `weight(type)`, `pose(...)` to tip and spin a piece around its base rim, `createStage(ctx)` posing the two pieces from plain state numbers, `beam(...)` a lit bolt). `scenes/_kit.js` serves rook, queen and king (`ease`, `WEIGHT`, `rig(ctx)` common facts of a scene, `play(r, total)` a score of timed tracks driven by one `ctx.tween`, `decal`, `glowMesh`). Both stay on the scene clock, so a skip just stops them. `fx.js` is the shared effects kit (`ctx.fx`), `sfx.js` the voices (`ctx.sfx`, also the move and capture sounds through `sfx.hook(game)`), `src/audio.js` the context under them.
- Scenes are promise driven. Tests use `__chess.stepAsync(seconds)` (awaited, gives the event loop a turn per slice) instead of `__chess.step` wherever a scene may play, and `__chess.battle.ready()` to have every module loaded.

### Music: `src/music/`

    createMusic({ audio }) -> music     // player.js, one per page; started by audio.onUnlock
    music.settings  { on, vol, klang, tempo, raum }, stored in localStorage `chess3d.music`
    music.set(partial), music.onChange(fn), music.skip(), music.state ('idle' | 'playing' | 'gap' | 'paused'), music.piece, music.notes
    mountMusicSettings(ui, music)       // settings.js: Music switch + Volume, Tone, Tempo, Room sliders through ui.mountSettings
    createPiano(ac, destination, { lite, klang, raum }) -> { note(midi, at, hold, vel), setKlang, setRaum, out, dispose }
    prepare(piece) / expand(piece, tempoScale)   // score.js: pedal, chord roll, velocity wobble

- Pieces are plain data in `src/music/pieces/*.js` (`{ id, title, composer, bpm, pedal, ring, quarters, notes: [[midi, start, length, velocity], ...] }`, times in quarter notes), one lazy chunk each (`pieces/index.js` lists them). They are generated once by `tools/build-pieces.mjs` from the public domain typesettings of the Mutopia Project (LilyPond sources, each named and credited in the piece's header) with `tools/ly-to-notes.mjs`; the game never fetches anything. Five pieces: Gymnopédie 1 to 3, Prelude in C, Air (the flute and guitar parts merged into one piano).
- piano.js: two detuned strings per note (a band limited PeriodicWave per register), a low pass that closes after the strike, a two stage decay, a damper release and a felt thump of filtered noise, into a generated stereo room (ConvolverNode). `lite` (phones) has one string, no thump, no pan, a shorter room, 14 voices. Klang is the master low pass (and the per key one for new notes), Raum the wet level.
- player.js: a 0.8 s timer schedules notes 2.5 s ahead on the audio clock (nothing runs per frame). The playlist shuffles every piece once per round and never repeats one back to back, with 4 to 8 s of silence between pieces. Tempo changes re-anchor the position (the notes already scheduled keep the old tempo). Pausing (tab hidden, Mute, switch off) disposes the piano so no scheduled note sounds later; resuming continues at the same quarter note. The first start fades in over 5 s.
- Ducking: `audio.bus.music` is a bus like fx and scene. `audio.play()` calls `audio.duckMusic(level, hold)` for every sound (0.5 for 0.55 s, scene voices 0.25 for 1.2 s); `sfx.sceneActive = true` holds it at 0.2 for the whole battle scene and releases when the scene ends. A new puzzle chime or any other voice played through `audio.play` ducks the music with no extra code. Mute: `audio.onMute(fn)`.
- Test: `test/music.mjs` (fast tier: every piece well formed and in range, expansion, tempo scale), `test/music-page.mjs` (smoke group `music`: starts after a gesture, Mute, the switch and a hidden tab stop and resume it, sliders persist, ducking, German labels, no console errors).

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
    path.js        levelOrder(puzzles, band) (rating order, themes mixed per chapter), chaptersOf(order), CHAPTER_SIZE = 10
    progress.js    createPuzzleProgress({ storage, puzzles, bands }) -> { band(), stats(), next(), select(id), setView(band, chapter), ack(), finish(id, { clean }), exportData(), importData(raw), reset(), onChange(fn) }
    controller.js  createPuzzles({ game, hint, sweep, progress, reward = null, onChapter = null, pause = 600, onSide }) -> { state(), start(), next(), help(), stop(), tick(dt), on(fn) }   // onChapter(finished) once a finished chapter's finale is over
    panel.js       mountPuzzlesPanel({ puzzles, ui }) (the puzzle in progress), puzzlesTab({ puzzles, progress, onStart, reward }) (the Learn tab: the path)
    strings.js     German texts, puzzles.css the styles

- Data format (Lichess form, CC0): `fen` is the position before the opponent's last move, `moves[0]` is that move, then the player's solution alternates with the replies (UCI). The player is the side to move after `moves[0]`. The data is checked with the rules engine in `test/puzzles-data.mjs`.
- `createPuzzles` uses `game.setMode('puzzle')` (the computer opponent stops, the game over banner is not shown) and `game.setMoveGuard`. `start()` takes the next puzzle from the progress store, loads the position, plays `moves[0]` with its slide and turns the board to the player through `onSide`. The guard lets only the stored move through, and in mate puzzles (`mate1`, `mate2`) any checkmate, and in a mate in two a different first move after which every reply allows a mate in one (the controller then plays any reply itself). A refused move leaves the piece where it is, counts a miss and shows a calm message. `help()` shows the Openings hint arrow even when the hint switch is off, and restores the switch. The opponent reply is played in `tick(dt)` after `pause`, like Explain. Solved: `progress.finish`, then `sweep.play({ side, squares })`. `state().message` is a descriptor (`start`, `right`, `wrong`, `again`, `help`, `your`, `solved`), never text.
- Undo or New game from the HUD while a puzzle runs restart the same puzzle, so the board and the ply agree. `stop()` returns to an ordinary fresh game.
- The path: a level is its band's puzzles sorted by rating (ties by id), cut into chapters of 10, the themes dealt round robin inside each chapter (`path.js`, the same on every device). A station is gold (solved clean), silver (a miss, Help or a skip) or untouched; replaying can turn silver into gold, gold never goes back. `next()` serves the first untouched station of the first level that has one (else the first silver one, else the first), or the station `select(id)` named. No automatic level change, nothing locked.
- Progress (`chess3d.puzzles`, version 2): `{ v: 2, marks: { id: 'g' | 's' } }`. A version 1 store is read once: its solved ids become gold, the queue and the run counters are dropped. Ids missing from a rebuilt data set drop out on load. Storage that is missing or blocked keeps working in memory. `stats()` carries `band`, `chapter` (where the path is, 0 based), `view` ({ band, chapter, chapters }: what the tab shows), `chapterList` (badges: { index, size, done, gold, here }), `stations` of the viewed chapter ({ id, index, theme, rating, state: gold | silver | next | todo }), `finished` ({ band, chapter, level } of a chapter the last solve finished, kept until `ack()`, `select()`, `setView()` or the next `finish()`), `solved` (gold per band), `queued` (silver in all) and `size`. The Learn Export and Import add the record under `puzzles` (`exportData()`, `importData()`).
- The tab (`puzzlesTab`): header (level, Chapter n / 10), ten chapter badges, the road as an SVG of up to ten stations (you climb: station 1 bottom left, 10 at the top, rows of 4, 3, 3 alternating right and left, a straight road with softly rounded corners; each station a 44 px tap target, a button for keyboards), legend and one big Start / Continue / Next chapter button. A finished chapter adds the `pzwave` class (CSS wave; the reward's `chapter({ stations, onDone })` drives `--lit` when `reward` is passed to `mountLearn`) and the line `Chapter n done!`. Tapping a station calls `onStart()`, `progress.select(id)` and `puzzles.start()`. `learn.openPath()` opens the tab (and the Learn sheet on a phone) at where the path is; the in-game bar of the U2 layout uses it together with `puzzles.next()`.
- Reward (`src/puzzles/reward.js`, `createReward({ gimbal, sfx })`, created in main.js and passed to the controller and `mountLearn`): `solved({ square, silver, theme, onNext, delay })` waits `delay` (the slide of the last move), then bursts on the decisive square (ring, pillar of light, 72 sparks; silver and half as many after misses or Help), plays the `chime` voice of src/battle/sfx.js (Mute respected) and shows the card `Solved!` with the theme line and a Next button (`.pzreward`, reward.css). A solve that finishes a chapter passes `chapter: { onDone }`: 1.5 s after the solve moment the board finale runs (`board({ onDone })`: all 64 squares glint in a gold wave from a1 to h8 in one shader plane, the pieces bow toward the other side with a staggered tilt of about 23 degrees along the same wave, a rising chime run, about 2 s; a tap or the card's Next skips it), then `onDone` = the controller's `onChapter`, which main.js uses to stop the puzzle, `ack()` the chapter and open the Learn path (`learn.openPath()`). `chapter({ stations, onDone })` (the station wave for the path tab) sets `--lit` 0..1 on each station in a wave (0.1 s apart) with a rising chime note each. Everything is counted in `tick(dt)`, which the controller calls every frame, so `?manual=1` and `__chess.step` drive it. Reduced motion: no sparks, no wave, card at once. `window.__chess.reward` is the test hook.
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

A bottom sheet with three drawn steps (the Share icon in the Safari bar, the Add to Home Screen row, the installed icon from `apple-touch-icon.png`) and a Later button. `main.js` imports it only when `device.ios` and not `device.standalone`. The gate then needs all of: iOS, not standalone, no URL flag of the app at all (`quality touch light preset yaw pitch dist gx gy gz fen moves select promo ai spin hud help manual diag theme view intro`), not `navigator.webdriver`, and working `localStorage`. The state is one key, `chess3d.install-hint`, `{ visits, shows, last }`: it shows on the first visit, and then at most twice more, at least 3 visits after the last showing. It appears 2.2 s after the board is ready. Later, a tap on the scrim or Escape closes it at once and nothing waits on it. There is no service worker and no network use.

### `src/dev/diag.js`

    initDiag({ stage }) -> { dispose() }     // also at window.__chess.diag

Imported by `main.js` only for exactly `?diag=1` (right after `window.__chess` is set). With any other value the chunk is never requested, no `#diag` element exists and no frame loop runs. The box sits at the bottom left above the thumb bar and has its own `requestAnimationFrame` loop for frame times, so the app render loop is untouched. Collapsed it shows fps, p95 and the tier, expanded it adds frame ms p50, p95 and max over 5 s, the tier and whether the post chain is on, pixel ratio against dpr, canvas and CSS size, draw calls and thousands of triangles from `renderer.info`, an estimated graphics memory figure (drawing buffer, post targets, shadow map, reflection target, a flat guess per texture and geometry) and the input facts from `device.js`. Pointer events stop at the box, so a tap never selects on the board.

### Assets in `public/`

`manifest.webmanifest` (name Chess 3D, standalone, portrait, theme and background `#07080c`, icons 192, 512 and a maskable 512), `icon-192.png`, `icon-512.png`, `icon-maskable-512.png`, `apple-touch-icon.png` (180) and `og-image.png` (1200 x 630). These are the only asset files in the repo. They are generated by `tools/render-assets.mjs` from the running game (headless Chrome, the real board and pieces, only camera, lights and backdrop set by the tool), committed, and regenerated on demand. `index.html` links the manifest and the touch icon and carries the og and twitter tags with absolute URLs under `https://bop-del.github.io/chess-3d/`.

## Test hooks

`window.__chess = { stage, gimbal, board, game, controls, ui, battle, audio, music, sfx, themes, views, play, tokens, review, THREE, pick, openings, puzzles, puzzleProgress, reward, goodMove, train }`, plus `diag` when the page was opened with `?diag=1`. `openings` is `{ explain, hint, card, strip, tick }`, `puzzles` the controller, `puzzleProgress` its store, `reward` the solve and chapter reward, `goodMove` the Good move helper, `train` is `{ store, drill, sweep, learn }`, `diag` the diagnostics box handle. With `?manual=1` it also has `step(seconds, hz = 30)`, which advances controls, game, battle and board by simulated time, `stepAsync(seconds, hz)` (the same, awaited, with an event loop turn per slice, for battle scenes), and `draw(dt)`, which renders the current state. This makes browser tests deterministic: no real time passes, so slow software rendering does not matter.

`window.__chessReady` becomes `true` once loading is done and `window.__chessError` holds a message if loading failed.

## Conventions

- No em dashes or double hyphens as punctuation in code comments, UI text or docs.
- Every piece mesh casts and receives shadows and uses a physical material, so the environment lights it.
- Lathe profiles use at least 160 radial segments with a densely sampled profile, so there is no faceted look.
- Cross-module calls go through the APIs above. Modules do not reach into each other's internals.
