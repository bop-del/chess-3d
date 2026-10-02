# Tools and tests

Four tiers (fast, smoke, phone, release), from instant to thorough. `npm test` runs the fast tier.

| Tier | Command | Time | Needs | Checks |
| --- | --- | --- | --- | --- |
| fast | `node test/run.mjs fast` (or `npm test`) | about 1 s | Node only | rules (perft, SAN, endings, `test/perft.mjs`), piece geometry contract (`test/geometry.mjs`), text lint (`test/lint.mjs`), audit planner rules (`test/audit-plan.mjs`) |
| smoke | `node test/run.mjs smoke` | 1 to 2 min | Chrome | `vite build`, `vite preview` on port 5303, a scripted game by real clicks, gimbal, render budgets, pixel checks, regression checks from `test/fixes.mjs` (labels, picking, trays, device) |
| all | `node test/run.mjs all` | fast plus smoke | Chrome | both tiers, then a reminder to run the release check |
| release | `node tools/release-check.mjs` | 5 to 10 min | Chrome, network for `npm ci` | git hygiene, fresh copy build, dist scan, page loads, URL fuzzing, docs, version |

## Fast tier

- `test/perft.mjs`: perft counts for five reference positions, SAN, check, mate, stalemate, repetition, en passant, promotion, castling. Exits 1 on any mismatch.
- `test/geometry.mjs`: builds all six pieces in both colors with the real materials, headless. Height within 8 percent of the contract (pawn 0.90, rook 1.00, knight 1.20, bishop 1.35, queen 1.60, king 1.85), footprint 0.5 to 0.85, centered within 0.06, sitting on y = 0, 20k to 90k triangles, finite positions and normals, shadow flags on every mesh.
- `test/audit-plan.mjs`: the audit planner's rules (docs only needs no browser tier, the stylesheet needs smoke, visual and device checks, and so on).
- `test/lint.mjs`: no em dashes, no spaced double hyphen punctuation and no local absolute paths in text files (tracked, plus untracked files that are not ignored).

## Smoke tier

`node test/smoke.mjs [--skip-build] [--dev] [--skip-fixes] [--write-budgets] [--shots]`

- Builds into `.tmp/smoke-dist` (never touches `dist/`), serves it on port 5303, drives headless Chrome with software GL (swiftshader), `quality=low`, `manual=1`.
- The first page load uses no `ai` flag and checks that vs computer is on by default and that black replies to e2e4. Every other run adds `ai=0` so both sides are played by the test.
- Game: capture, undo, both castles, en passant, promotion chooser (cancel, queen, knight), fool's mate with banner and toppled king, undo of each, new game. Moves are two real mouse clicks on projected square positions that the app's own picking resolves to the right square. After every step the view is compared with the rules through `game.audit()`.
- Gimbal: each axis slider, floor fade when tilted, Reset, Level board, keyboard W and R.
- Budgets: draw calls, triangles, geometries, textures and shader programs of one frame at the start position (`renderer.info`) and the time to `window.__chessReady`, against `tools/budgets.json` (1.5x the measured value). After an intended change to the scene, run `node test/smoke.mjs --write-budgets` and commit the new file.
- Pixels: not blank, no black frame, no white out, and light plus dark pixels inside the projected board corners, in five view presets and one tilted view.
- Device checks in `test/fixes.mjs` (a few seconds each, 800x500): default load starts on High with no `touch` class, `?touch=1` sets the class and starts on Medium, `?touch=0` behaves like the default, `?touch=1&quality=low` starts on Low, and a WebGL context lost and restored through `WEBGL_lose_context` leaves the board rendering again (pixel check) with no console error.
- `test/fixes.mjs` (`runFixChecks({ page, baseUrl, log })`) is called when the file exists: 12 independent units (labels, picking, five tray sizes, device and context loss), run in several tabs of the one browser (`--tabs=N`, default 3).
- `--dev` uses the vite dev server on port 5302 instead of a build. `--shots` empties `.tmp/smoke-shots/`, saves the screenshots there and adds a contact sheet per screen size (`contact-<w>x<h>.png`).

## Phone tier

`node test/run.mjs phone` runs `tools/phoneshots.mjs`, then `test/touch.mjs`, then `test/install.mjs`. The smoke tier stays desktop only.

**Phone shots** (`node tools/phoneshots.mjs [--skip-build] [--port=5306] [--only=portrait,se] [--dpr=3]`, about 4 minutes in software GL): builds into `.tmp/phone-dist`, serves it on port 5306 and loads the page as an iPhone (dpr 3, isMobile, hasTouch, iPhone user agent, `?quality=low&manual=1&ai=0&touch=1`) at `portrait` 390x844, `landscape` 844x390, `short290` 844x290, `short260` 740x260 (Safari tab with the bars up) and `se` 667x375. Simulated safe area insets (portrait 47 top 34 bottom, landscape 47 left and right 21 bottom, the short sizes keep the sides) go through CDP `Emulation.setSafeAreaInsetsOverride`. Per size it saves `start`, `selected` (a real tap on a white piece, `?select=e2` if the HUD covers every piece), `menu` (the Menu sheet opened by a tap on the thumb bar), `help` and `promo` into `.tmp/phone-shots/<size>/` plus a contact sheet: open the contact sheet, not each shot. Audits on every shot: tap targets under 44 x 44 CSS px (FAIL since the phone layout; `TAP_TARGET_FAILS`), text under 11 px (WARN), HUD elements reaching outside the viewport (WARN; sections scrolled inside the Menu sheet show up here), page errors and foreign requests (FAIL), blank canvas (FAIL). Exit 0 pass, 1 a check failed, 2 setup error.

**Real touch** (`node test/touch.mjs [--port=5305] [--skip-build]`, about 20 s): builds into `.tmp/touch-dist`, serves it on port 5305 and drives the page as an iPhone (dpr 3, isMobile, hasTouch, `?touch=1&quality=low&manual=1&ai=0`) at 390x844 and 844x390 with real CDP `Input.dispatchTouchEvent` events, no synthetic DOM events. Checks, per size: tap to select, an illegal tap moves nothing, four plies by tapping projected squares (verified through `window.__chess.game`), pinch out and in on the board changes `controls.camera.dist`, a pinch does not select or move, `visualViewport.scale` stays 1 after a page pinch and a double tap, `device.js` calls `preventDefault` on the second tap of a double tap on the board and on a two finger move off the canvas, the thumb bar's Views and New game (with its confirm: Cancel keeps the game, Yes resets it), the Menu sheet opens and its close button closes it, a two finger twist turns the board while a pinch alone does not, and Lock view stops orbit, pinch and twist while taps still move pieces. Exit 0 pass, 1 a check failed, 2 setup error.

**Install reminder** (`node test/install.mjs [--port=5362] [--skip-build]`, several minutes in software GL, 15 real page loads): builds into `.tmp/install-dist`, serves it and checks the Add to Home Screen support. The manifest (`public/manifest.webmanifest`: name Chess 3D, standalone, portrait) and every icon it names load at the size they claim (192, 512, maskable 512, `apple-touch-icon.png` 180, `og-image.png` 1200 x 630), `index.html` links the manifest and the touch icon, and the og and twitter tags use absolute URLs under `https://bop-del.github.io/chess-3d/`. Then as an iPhone Safari tab (iPhone user agent, 390x844, touch): the sheet from `src/install-hint.js` shows on the first visit, closes with Later, with a tap outside and with Escape, the visit counter keeps it quiet on the next visit, shows it again a few visits later and a third and last time, and never a fourth. Never on a desktop user agent, under `navigator.webdriver`, with `?manual`, `?diag`, `?fen`, `?moves`, `?select`, `?promo` or `?quality`, or when `navigator.standalone` is true. Each visit starts from a seeded `localStorage` entry (`chess3d.install-hint`). The shot of the open sheet goes to `.tmp/install/hint-portrait.png`: open it. Exit 0 pass, 1 a check failed, 2 setup error.

## Diagnostics overlay and device check

`?diag=1` shows `src/dev/diag.js` on top of the page: fps, frame time p50, p95 and max over 5 seconds, quality tier and whether the post chain is on, pixel ratio against the device pixel ratio, canvas and CSS size, draw calls and thousands of triangles, an estimated graphics memory figure (labelled est.: drawing buffer, post targets, shadow map, reflection target and a flat guess per texture and geometry) and the touch, phone, ios and standalone facts. It is a box at the bottom left; one tap toggles a collapsed line (fps, p95, tier) and the full box, and taps on it never reach the board. Without the exact value `1` nothing of it is loaded: the module is a separate chunk that is never requested and no element or frame loop exists. `bin/device-check [--no-signal] [--port=4173] [--diag]` prints the URL, QR code and Signal note for a real phone, with `--diag` adding `?diag=1`. The phone tier does not run with `diag=1`.

## Icons and link preview

`node tools/render-assets.mjs variants [--out=<dir>] [--port=5361]` renders the icon candidates at 512 px into a folder with a contact sheet (nothing written to `public/`). `node tools/render-assets.mjs final --icon=<variant> [--port=5361]` writes `public/icon-512.png`, `icon-192.png`, `apple-touch-icon.png` (180), `icon-maskable-512.png` (the artwork pulled back into the 80 percent safe circle) and `og-image.png` (1200 x 630, the start position in Studio light). The current icon is `float`. The variants are named scenes in the tool (a FEN, an orbit camera, a light preset and a backdrop each); the tool builds into `.tmp/assets-dist`, serves it with vite preview, opens the page in headless Chrome through `launchBrowser` and sets the camera, lights and visible pieces through `window.__chess` in manual mode. These PNGs are the only asset files in the repo: generated by this tool, committed, regenerated on demand. After a change to the board or the pieces, regenerate them and open every file.

## Audit plan

`node tools/audit-plan.mjs [--since=<ref>] [--json]`

Lists the files changed since the last tag (committed, staged, unstaged and untracked) and says which audits are due: fast tier (always), smoke tier, visual audit, device check on a phone, release check (with a fresh `npm ci` when dependencies changed), code review (minor and major version bumps), and watching the Pages run (workflow changed). Ends with the commands to run. It never fails: it is a plan, not a check.

## Contact sheets

`node tools/contact-sheet.mjs <dir> [--cols=3] [--width=640] [--no-compare]`

Puts every PNG in a folder on one labelled grid per screen size (`<dir>/contact-<w>x<h>.png`), so a visual audit means opening one image instead of each screenshot. `test/smoke.mjs --shots` and `tools/phoneshots.mjs` do this themselves with their open browser.

**Change flags.** The previous run's PNGs are kept in the sibling folder `<dir>.prev` (for example `.tmp/smoke-shots.prev/`). Each tile gets a coloured border and a tag: `changed` (orange), `same` (green) or `new` (blue, no previous file of that name), the sheet title counts them and the run prints one line naming the changed shots. It is a pointer for the eye, not a gate: it never fails a run, and it only compares against the last run on this machine (no golden images in git, since software GL differs across machines). After the sheets are written, `<dir>.prev` is replaced by the current PNGs, so each run compares with the one before it; running the CLI a second time on the same folder therefore shows all `same`. `--no-compare` (option `compare: false` in `contactSheets()`) turns it off and leaves `.prev` alone.

A shot counts as `changed` when its size differs or more than 0.05% of its pixels differ, where a pixel differs when any colour channel moves by more than 3 of 255 (`CHANGED_FRACTION` and `PIXEL_TOL` in `contact-sheet.mjs`). Byte identical files are `same` without decoding. Measured noise: two identical software GL runs (smoke --shots, and the same page rendered 3 times in manual mode) came out byte identical, difference 0, so the thresholds only guard against tiny GL variation. Reference signal: a light preset change (?light=Sunset after a 1 s step) moved 0.2% of pixels at tolerance 2, so the thresholds are kept low enough to catch it.

## Release check

`node tools/release-check.mjs [--port=5303] [--skip-install] [--since=<tag>] [--extra-audit="<cmd>"] [--no-browser] [--tabs=3]`

Git hygiene (clean tree, no scratch or key files, no file over 1.5 MB outside `docs/`, optional `tools/internal-terms.txt` with one word or regular expression per line, no em dashes or double hyphens in text or commit messages since the last tag), fresh copy of HEAD built with `npm ci`, dist scanned for local paths, user names and keys, normal pages loaded without console errors or foreign requests, URL fuzzing of every flag in `src/main.js`, README and `docs/*.md` checked against the code and the repo, version compared with the last tag. The page loads (normal pages, hostile URLs, sub path) run in `--tabs=N` tabs of one browser (default 3). Gains need a quiet machine: one page load spends about 3.4 s building the piece geometry on one thread. Before the first commit it copies the working tree instead of HEAD and says so.

## URL flags used by the tests

`quality=low|medium|high`, `touch=1|0`, `manual=1` (no render loop, tests call `window.__chess.step(sec)` and `.draw()`), `ai=0` (computer off; default is on, you play white; `ai=3` or `ai=4` raises the level), `fen`, `moves`, `select`, `preset`, `gx` `gy` `gz`, `yaw` `pitch` `dist`, `hud=0`, `help=1`, `light`, `spin=1`, `promo`, `diag=1` (diagnostics overlay).

## Files

- `_lib.mjs`: shared reporter, Chrome launcher, page watcher, server starter.
- `budgets.json`: render budgets for the smoke tier.
- `release-check.mjs`: the release tier.
- `render-assets.mjs`: renders the icons and the link preview (see Icons and link preview).
