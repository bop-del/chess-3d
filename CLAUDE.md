# chess-3d

A 3D chess game for the browser (three.js 0.186, Vite, fully procedural, no asset files). Public repo bop-del/chess-3d, live at https://bop-del.github.io/chess-3d/.

## Commands

    npm install
    npm run dev          # http://localhost:5173
    npm run build        # dist/
    npm test             # fast tier

## Test tiers

| Tier | Command | What it covers |
|---|---|---|
| fast | `node test/run.mjs` | rules perft, piece geometry contract, text lint. No browser, seconds |
| smoke | `node test/run.mjs smoke` | build, serve, drive the real page in headless Chrome (the GPU via ANGLE Metal on Apple Silicon, software GL elsewhere or with `CHESS_GL=swiftshader`; builds come from a content hashed cache in ~/.cache/chess-3d), parallel groups (test/smoke-groups.mjs), one Chrome each, about 2 minutes on a quiet machine |
| phone | `node test/run.mjs phone` | phone sizes (portrait, landscape, short), tap target audit, real multi touch (pinch, twist, thumb bar). A few minutes |
| release | `node tools/release-check.mjs` | fresh build, page load, hostile URLs, docs and repo hygiene. Run before a release |

`node tools/audit-plan.mjs` says which tiers and audits a change needs. `node test/run.mjs smoke --shots` writes a contact sheet per screen size: open that instead of each screenshot.

No golden image diffs: software GL renders differ across machines. Take screenshots and look at them.

## Conventions

- No em dashes and no double hyphens as punctuation anywhere: code, comments, UI text, docs, commits. The lint in the fast tier checks it.
- Units: one square = 1.0. Y is up. The board top is at y = 0, centred at x = z = 0.
- Square file f (0 to 7 = a to h) and rank r (0 to 7 = 1 to 8): x = f - 3.5, z = 3.5 - r. White starts at +z. Rules engine square index is `rank * 8 + file`.
- Everything on the board lives in the `gimbal` group. The camera orbits outside it.
- `window.__chess = { stage, gimbal, board, game, controls, ui, THREE, pick, ... }` is the test hook (also battle, audio, sfx, openings, puzzles, puzzleProgress, reward, goodMove, views, play, tokens, themes, train, diag; see docs/ARCHITECTURE.md, Test hooks). `?manual=1` stops the render loop and adds `__chess.step(seconds)` and `__chess.draw()` so tests control time.
- URL flags (see the README table): `quality`, `touch`, `light`, `preset`, `yaw`, `pitch`, `dist`, `gx`, `gy`, `gz`, `fen`, `moves`, `select`, `promo`, `ai`, `spin`, `hud`, `help`, `manual`, `diag`, `view`, `theme`, `intro`, `trays`.
- The computer opponent is ON by default (you play white, Easy). `?ai=0` turns it off. Any test or script that plays both sides must pass `ai=0`.
- Architecture and module APIs: docs/ARCHITECTURE.md. Keep it in step with the code.
- Domain language: CONTEXT.md (a glossary, no implementation detail). Architecture decisions: docs/adr/. Both are created when the first term or decision is settled, not before.

## Rules

- README before every push to bop-del repos: check whether the commits change anything the README describes (controls, URL flags, features, known issues, test commands) and update it in the same push. Nothing to change: say so in one line.
- Publishing and pushing only on the owner's explicit go.
- Work happens on a branch per backlog item or agent round, in its own lane: a worktree plus a Herdr workspace, opened with `bin/lane open <branch>` (under ~/.herdr/worktrees/chess-3d/). The owner's checkout stays on main. Land with `bin/lane close <branch>` from main: one squash commit per item, then the lane is removed. `bin/lane agent <branch> <name> <brief>` starts a visible builder session in its own tab of the lane, which reports back to the lead session; the lane also gets a "diff" tab with `hunk diff main --watch`. `bin/lane list` shows open lanes. Pages deploys every push to main, so unfinished work never sits there.
- Versions are semver: patch for fixes, minor for a visible feature step, major for a reshaped app. Releases get an annotated tag and a GitHub release after the owner's go.
- GitHub account is bop-del: `gh auth switch --user bop-del`. Never the HeyJobs account.
- Commit trailer line: `Co-Authored-By:` the model that did the work, for example `Co-Authored-By: Claude Opus 5.5 (1M context) <noreply@anthropic.com>`. Never a fixed model name that may not match the session.
- Commits use the git identity set in this repo's `.git/config`. Do not override it with `-c user.email`.

## Browser and test hygiene

The owner's regular Chrome holds their live session. Agents and scripts must never disturb it.

- Never use the claude-in-chrome tools or open tabs in the owner's Chrome for testing. Test with puppeteer-core and a headless Chrome on its own temp profile.
- Headless Chromes are always launched through `launchBrowser()` in tools/_lib.mjs and closed in a `finally` block. It holds machine wide slots, adaptive by load: two always, a third while the 1 minute load is under 12, a fourth under 6 (four with the GPU renderer), the wait of each launch is logged to .tmp/chrome-waits.jsonl; further launches wait. No retry loops that relaunch it.
- Never run `pkill` or `killall` on chrome or "Google Chrome". Kill only a PID you started yourself, and kill your own leftover scripts and dev servers by PID when you finish.
- Software rendering is slow: use `quality=low&manual=1` for smoke checks, `window.__chess.step()` and `.draw()` for deterministic frames.
- Each agent gets its own dev port. Stop servers you started.

## Private notes

Private working notes (decisions, roadmap, release checklist, restart prompt) live in ~/code/chess-3d-private. Never copy them into this repo.
