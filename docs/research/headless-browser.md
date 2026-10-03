# Research: a faster headless browser for the tests (CHE-120)

Question (owner, 2026-10-03): is there an alternative to full Chrome that is faster for our tests?

Short answer: yes, and it is almost free. `chrome-headless-shell` (the old headless Chrome, shipped by the Chrome team as its own binary) draws on the same GPU path (ANGLE Metal), launches 3 times faster and passes every check we have. The gain is real but small in wall time: a smoke run is dominated by the app and the test scripts, not by the browser. Every other candidate either does not exist for our needs (no WebGL) or cannot be measured without installs.

All numbers: Apple M5, macOS, Chrome 154.0.8037.95, node `launchBrowser()` from `tools/_lib.mjs`, the GPU path (`CHESS_GL=metal`, the default here). The machine was shared with other lanes: the 1 minute load was 4 to 12 during the runs, so every wall time below carries noise. Single launch numbers were taken at load 4 to 5, interleaved.

## 1. chrome-headless-shell

Installed with `npx @puppeteer/browsers install chrome-headless-shell@154.0.8037.95` (same version as the installed Chrome), moved to `~/.cache/puppeteer/chrome-headless-shell/` (the only thing downloaded, about 200 MB). A second copy, version 151, was already on the machine in the Playwright cache (`~/Library/Caches/ms-playwright/chromium_headless_shell-1234`) and was measured too.

GPU proof (the renderer line from `proveGpu`): both shells report
`ANGLE (Apple, ANGLE Metal Renderer: Apple M5, Unspecified Version)`, the same string as Chrome. So it has a Metal path.

Launch, page load of `/?quality=low&manual=1` to `window.__chessReady`, 30 steps plus draws, 3 runs each (the first run of a shell binary is cold, see the note below):

| Browser | launch (incl. renderer probe) | page ready | 30 frames | close |
|---|---|---|---|---|
| Chrome 154 | 395, 385, 369 ms | 682, 660, 562 ms | 19 to 23 ms | 74 to 89 ms |
| chrome-headless-shell 154 | 260 (cold), 111, 108 ms | 2450 (cold), 639, 642 ms | 18 to 21 ms | 34 to 40 ms |
| chrome-headless-shell 151 | 247 (cold), 134, 122 ms | 2456 (cold), 536, 547 ms | 19 to 20 ms | 33 to 49 ms |

Reading: launch is about 270 ms faster and close about 40 ms faster. Page load and frame time are the same, as expected (the same Blink and the same GPU process). Cold note: the very first start of a downloaded binary takes about 2.4 s extra (macOS checks the new executable once). It is a one time cost per machine.

Rendering check: the screenshots of Chrome and the shell show the same scene (`.tmp/builder/shot-*.png`, opened and compared by eye; the PNG bytes differ by compression only).

Test results with the shell (`CHESS_BROWSER` set to its path, nothing else changed):
- `node test/run.mjs smoke --all --no-cache`: 915 checks, 915 pass, 0 warn, 0 fail. Wall: 277 s with Chrome (load 10.5), 253 s with the shell (load 9.6). That is 9 percent, inside the noise of a loaded machine.
- `node test/run.mjs phone` (real touch emulation, pinch, twist): 147 PASS and the same 5 WARN lines with both browsers, 0 fail. Wall: 125 s with Chrome, 94 s with the shell. The shell run was at the higher load (12.5 against 8.9), so the direction is trustworthy, the size is not.
- Two groups run alone and alternated (`core` and `views`, `--jobs=1`, two rounds each): 35 s per pass with both browsers. No difference: `views` is the app's own time.

What the shell is: the old headless implementation, not a "new headless" Chrome. It has no extensions and no UI. Everything we use (CDP, request interception, touch emulation, screenshots, WebGL) worked. Risk: it is a separate download that must follow the Chrome version, and it is not the product the users run, so a bug only in full Chrome would not show. Playwright itself uses this binary as its default for headless Chromium, which is the strongest sign that it is the mainstream choice (Playwright docs, "Chromium: headless shell").

## 2. One browser with many contexts

A one process measurement, 6 page loads of the same page (`.tmp/builder/ctx.mjs`):

| Setup | Total |
|---|---|
| 6 times: launch Chrome, load, close | 7723 ms (1.29 s each) |
| 1 Chrome, 6 times: new context, load, close context | 5080 ms (0.85 s each) |

So a shared browser saves about 0.45 s per script (launch, renderer probe, close). The smoke tier has 23 groups plus a few extra launches, about 25 scripts: about 11 s of work in total, and only about 3 s of wall time since 3 to 4 run in parallel. The catch is that the scripts are separate node processes. Sharing one Chrome means a small broker process that owns the browser and hands out the WebSocket endpoint, plus context level cleanup in every script, plus the slot rule changing from "browsers" to "contexts". Contexts also share one GPU process, so a heavy test can slow its neighbours and the timing of the intro and battle tests could move. Not worth it for 3 s.

## 3. Playwright WebKit or Firefox (docs and what is on the machine only)

Nothing was installed. On the machine: Playwright's WebKit build (`webkit-2336`, with `libANGLE-shared.dylib` in the bundle) and the Playwright Chromium builds. No Firefox. There is no `playwright` npm package in this repo (we use puppeteer-core), so WebKit could not be launched without an install, and a switch would also mean rewriting `launchBrowser`, `watchPage` and every `page.` call that Puppeteer and Playwright spell differently.
- WebKit: Playwright documents WebKit on macOS as a real engine build; it ships ANGLE, which is WebKit's WebGL layer, so WebGL is supported and Metal is the expected backend on macOS (sources: playwright.dev/docs/browsers "WebKit", and the bundle contents above). Not measured here. Reason to skip even so: it is Safari's engine, so it would test something users on iPhone run, which is useful as a separate cross engine check, but it is not faster than Chromium by any claim we could find and it does not replace the Chrome based tiers.
- Firefox: Playwright ships its own patched Firefox. WebGL works there, but we found no statement that headless Firefox uses the Metal GPU path on macOS; software GL would be slower than what we have. Not measured.

## 4. Browsers without WebGL (for example Lightpanda)

Lightpanda is built from scratch with no graphical rendering (lightpanda.io/docs): no canvas, no WebGL, no screenshots. Our tests read pixels, call `renderer.getContext()` and check the GPU renderer string, so such a browser cannot run any page test of a three.js game.

## 5. Recommendation and what a switch would take

Recommendation: adopt `chrome-headless-shell` as an opt in first, then as the default in lanes if the owner agrees. Keep full Chrome for the release check and for any run where a failure must be compared against the real product.

Expected savings (honest range):
- `smoke --all`: 5 to 10 percent of wall time (the measured 277 s to 253 s is the upper end of the noise). Per launch it is about 0.3 s, over about 25 launches and 3 to 4 in parallel: about 3 s wall for the launch part alone, the rest of the difference is lower memory and CPU per Chrome, which matters when the machine is loaded.
- phone tier: measured 125 s to 94 s, direction safe, size uncertain (load differed). Expect 10 to 25 percent, since it launches many browsers in sequence.
- No change for the app's own time (views, battle, clock): those groups are bound by the page.

What a switch takes:
1. Done in this lane: `launchBrowser()` accepts `{ executablePath }` and reads `CHESS_BROWSER=<path>`; the default is unchanged (still Chrome). One line change in `tools/_lib.mjs`.
2. To make it the default for lanes: a `chromePath()` entry that prefers `~/.cache/puppeteer/chrome-headless-shell/*/chrome-headless-shell-mac-arm64/chrome-headless-shell` when it exists and `CHESS_BROWSER` is unset, a note in `tools/README.md`, and one sentence in `docs/ARCHITECTURE.md` or the test docs. The release check should pin full Chrome (`CHESS_BROWSER=` empty plus `CHROME_PATH`).
3. A version policy: reinstall the shell when Chrome moves a major version (`npx @puppeteer/browsers install chrome-headless-shell@<chrome version>`), and let `launchBrowser` log the browser version once so a mismatch is visible.
4. The owner's call: the download is outside the repo (`~/.cache/puppeteer`), about 200 MB, and a second binary to keep current.

Not recommended: a shared browser (about 3 s for a broker), Playwright WebKit or Firefox as a replacement (a rewrite for no measured gain), browsers without WebGL (cannot run the tests).

Raw data: `.tmp/builder/` in the lane (bench.mjs, ctx.mjs, the group logs); not committed.
