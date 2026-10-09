# Online play server

A small own server for online play (CHE-271, ADR 0009): two invited players play one game against each other, with a score per
opponent and one chat per opponent. Node only, no dependency: `node:http`, `node:sqlite` (Node 22.5 or newer; Node 24 in the image),
Server-Sent Events for the live state and plain POST for actions. Every move is checked with the game's own rules engine
(`src/rules.js`); the server is the only truth.

## Run it locally

    npm run server                       # http://0.0.0.0:5502, database .tmp/online/online.db
    ONLINE_PORT=5702 npm run server      # another port

Then open the game with the flag, for example `http://localhost:5173/?online=http://localhost:5502&open=online`.

Invite players (the command prints the link and the code):

    ONLINE_GAME_URL=http://localhost:5173/ ONLINE_PUBLIC_URL=http://localhost:5502 node server/admin.mjs invite Felix

## Environment

| Variable | Default | Meaning |
|---|---|---|
| `ONLINE_PORT` (or `PORT`) | `5502` | Port to listen on (the image sets `PORT=3000`) |
| `ONLINE_HOST` | `0.0.0.0` | Address to listen on |
| `ONLINE_DB` | `.tmp/online/online.db` | The SQLite file (the image: `/data/online.db`) |
| `ONLINE_ORIGINS` | the local preview origins | Comma separated list of game origins allowed by CORS, for example `https://chess3d.borisdiebold.com,https://bop-del.github.io` (both while the old address is still around, ADR 0012). Without it: `http://localhost:*`, `http://127.0.0.1:*`, the Tailscale address range (CGNAT, carrier grade NAT block) and `*.ts.net` |
| `ONLINE_TRUST_PROXY` | off | `1` takes the client IP from `X-Forwarded-For` (behind kamal-proxy), for the wrong code throttle |
| `ONLINE_ADMIN_SECRET` | none | The secret for the `/stats` dashboard. Without it `/stats` answers 404 (the page does not exist). Keep it in the `ONLINE_ENV` file, never in the repo |
| `ONLINE_LEASE_GRACE_MS` | `0` | CHE-406: how long a server waits before it claims a free writer lease (a server from before the lease never wrote the row; the wait covers kamal's drain time). Production sets `35000` in `config/deploy.yml`; local runs and tests keep 0 so the bot answers at once |
| `ONLINE_GAME_URL` | `http://localhost:5173/` | The game page the invite link points to (admin only) |
| `ONLINE_PUBLIC_URL` | `http://localhost:<port>` | This server as the browser reaches it, put into the link as `?online=` (admin only) |
| `ONLINE_VAPID_FILE` | none | CHE-272: the web push key file (JSON, mode 600, made once by `node server/admin.mjs push-keys`). Without it push is off and `/push/*` answers 404. A secret like `ONLINE_ADMIN_SECRET`: back it up, losing it invalidates every subscription |
| `ONLINE_VAPID_SUBJECT` | none | `mailto:` (or `https:`) contact sent to the push services; push stays off without it |
| `ONLINE_BOT` | off | CHE-343: `1` turns the bot on (a player row `Bot`, marked as a bot in the player list, always online, no key and no code). Test and production differ only in this env file. `ONLINE_BOT_NAME` changes the name. |
| `ONLINE_GAME_URL` | `http://localhost:5173/` | (also read by the server) the page a tap on a push opens, for example `https://chess.example.com/` |
| `AUTH_SPIKE_CLIENT_ID` | none | CHE-341 spike: the Google OAuth client id. Without it `/auth-spike` answers 404 (the route does not exist). The only server dependency is `jose` (`server/package.json`, `npm ci --omit=dev` in `server/`) |
| `AUTH_SPIKE_RETURN` | none | CHE-341 spike: the page `POST /auth-spike` sends the browser back to (303, marker in the fragment), for example `https://chess3d.borisdiebold.com/auth-spike.html`. Must be on the game origin, in `ONLINE_ORIGINS` or a local preview origin, else 400 |
| `ONLINE_ENV` | none | A `KEY=VALUE` file outside the repo with the variables above |

Nothing secret lives in the repo: keys and codes are stored only as sha256 hashes; paths and the public origin come from the env.

## Admin commands

    node server/admin.mjs invite <name>         # a new player: the link and a code like FELIX-7K3Q
    node server/admin.mjs invite <name> --new   # a fresh link and code, the old ones stop working
    node server/admin.mjs revoke <name>         # cannot log in any more, games and score stay
    node server/admin.mjs delete <name>         # all of the player's data gone
    node server/admin.mjs chat <name>           # print all of that player's conversations
    node server/admin.mjs mute <name>           # cannot write chat messages (unmute <name> undoes it)
    node server/admin.mjs admin <name>          # CHE-343: may make the bot challenge them (unadmin <name> undoes it)
    node server/admin.mjs list                  # the players (marks admin and bot)
    ONLINE_VAPID_FILE=/path/vapid.json node server/admin.mjs push-keys   # the push key pair, once (refuses to overwrite)

The link is `<game>?online=<server>&open=online#online=<key>`: the key travels in the fragment, which the browser never sends to a
server; the game stores it and strips it from the address bar at once. The code gives the same login on another device (the iPhone
home screen app has its own storage). Wrong codes are slowed: 5 per IP in 10 minutes.

## HTTP API

JSON, `Authorization: Bearer <key>` except `/up` and `/login-code`. An unknown key gets 401 and nothing else.

| Request | Body | Answer |
|---|---|---|
| `GET /up` | | `ok` (health check, no auth) |
| `GET /health`, `HEAD /health` | | `ok` (200) or a one line reason (503), for an external monitor, no auth (see Health check for a monitor) |
| `POST /login-code` | `{ code }` | `{ key, name }` (a new device key for that player) |
| `GET /state` | | `{ me, now, players, challenges: { in, out }, games, game, chats, unread }`. `games` (CHE-335): every active game of the player, newest first, plus the finished ones of the last 7 days (at most 5), each `{ id, color, opponent, white, black, moves, sans, turn, status, result, reason, winner, lastMoveAt, staleAt, canFinish }` (`canFinish` is per game). `challenges.out`: every open challenge plus the last declined one per player. `players[]`: `name, online, score, played, unread`, and for the v1.10 client `playing` (in a game with someone else, blocks nothing now) and `withMe` (the pair has an active game). `game` is **deprecated** (the newest active game, else the last one) and stays for one release for the v1.10 client |
| `GET /events` | | the live stream: event `state` (the same shape) on every change, `: hb` every 20 s |
| `POST /challenge` | `{ to }` | `{ id }`. Several can be open at once; a second one to the same player while one is open returns that id (`again: true`) and sends no second push. 409 `you-are-playing` when the pair has an active game, in both directions (`they-are-playing` is no longer returned: a player in a game can be challenged) |
| `POST /challenge/cancel` | `{ id?, cid }` | `{ cancelled }`: the challenger withdraws their open challenge (id optional); only their own; none open gives `cancelled: 0` |
| `POST /challenge/answer` | `{ id, accept }` | `{ game }` or `{ declined }`. Accepting cancels only the open challenges between the same two players (both directions), never the others; 409 `you-are-playing` when the pair already has a game |
| `POST /move` | `{ game, uci, cid }` | `{ ply, san, over }`; an illegal move is 400 `illegal` |
| `POST /resign` | `{ game }` | `{ over: 'resign' }` |
| `POST /finish-stale` | `{ game }` | after 3 days without a move, the waiting player wins |
| `POST /chat` | `{ to, text, cid }` | at most 200 characters |
| `POST /chat/read` | `{ with }` | marks that conversation read |

| `GET /player/<name>` | | The numbers of that player (CHE-290), derived from the finished games: `{ name, own, games, wins, losses, draws, streak: { current: { type, n }, best: { wins, losses, draws } }, perOpponent: [{ name, games, wins, losses, draws }], details: { avgMoves, avgMinutes, longestGameMoves, shortestWinMoves, openings: [{ eco, name, n }] }, headToHead }`. `headToHead` is from the asking player's side (`wins` are the asker's) and `null` on the own card. Running games do not count; a resign is a loss, a stale finish a win. Unknown, revoked or deleted name: 404 |
| `POST /events` | `{ events: [{ kind, device, ... }] }` | `202 { ok, n }`. Usage events (CHE-291, ADR 0010), only with a player key. Kinds: `error` { message, where }, `feature` { name }, `perf` { tier: high, mid, low; loadMs }, `session` { length }; `device` { ua, touch, w, h, gpu }. One bad event refuses the batch (400) |
| `POST /feedback` | `{ kind: bug or wish, text, name?, picture?, context?, device? }` | `201 { ok, id }`. CHE-404: feedback from the game, **no login needed** (a key only names the player). `text` 1 to 2000 characters, `name` up to 40, `picture` a base64 JPEG up to 150 KB (must start with `/9j/`), `context` an object up to 6000 characters, `device` a random id the browser keeps. 5 per hour per device id and 20 per hour per IP (429 `slow-down`); a refused body does not count. 400 `bad-kind`, `empty-text`, `text-too-long`, `bad-picture`, `bad-context`; 413 for a too large picture, context or body |
| `GET /feedback?since=<id>` | admin secret | `{ items: [{ id, at, kind, name, player, text, picture, context }] }` oldest first, at most 50 after `id`, pictures as base64. Only with `ONLINE_ADMIN_SECRET` as `Authorization: Bearer <secret>`: 401 without it, 404 when no secret is set. Read by `bin/feedback` in the private repo |
| `POST /my-code` | `{}` | `{ ok, code }` (CHE-272): a fresh login code for the calling player (Bearer key). The old code stops working, keys stay valid. 5 per 10 minutes, the code is never logged |
| `GET /push/key` | | `{ key }` the VAPID public key (base64url). CHE-272. 404 for all three push routes when push is off |
| `POST /push/subscribe` | `{ endpoint, keys: { p256dh, auth } }` | `{ ok }` (the browser's `PushSubscription.toJSON()`; one row per endpoint, at most 10 per player; an endpoint must be https) |
| `POST /push/unsubscribe` | `{ endpoint }` | `{ ok }` |
| `POST /bot/challenge` | `{}` | `{ ok, id }`. CHE-343: the bot challenges the calling admin (403 `admin-only` for others, 404 when the bot is off). The bot accepts a challenge to it at once, moves 2 to 5 s after the human with the easy AI of the client (`src/ai.js`, search in slices, capped at 2 s, then a random legal move), answers chat with a canned German line and triggers the same pushes as a human. Code: `server/bot.mjs`. |
| `POST /auth-spike` | none | CHE-341 spike only, with `AUTH_SPIKE_CLIENT_ID`: Google sign-in redirect flow. Form body `credential` and `g_csrf_token` (must equal the `g_csrf_token` cookie); verifies the ID token (jose, Google's keys, issuer, audience, expiry), answers 303 to `AUTH_SPIKE_RETURN#spike=redirect&sub=<sub>`, else 400 with a short text. Stores and logs nothing |
| `GET /stats`, `POST /stats` | secret | The stats dashboard (HTML), only with `ONLINE_ADMIN_SECRET`: `Authorization: Bearer <secret>` or the form on the page (a POST body, never a URL). 401 without it, 404 when no secret is set |

`cid` is a client id: a retried POST with the same id is applied once. Limits per key: 60 moves, 10 messages and 30 other actions a
minute; a body over 4 KB is refused. `POST /events`: 20 events and 16 KB per request, 10 requests a minute and 2000 events a day per key. Wrong `/stats` secrets are throttled like wrong codes (5 per IP in 10 minutes).

## Web push (CHE-272, ADR 0013)

`server/push.mjs`, `node:crypto` only. Messages are encrypted per RFC 8291 (aes128gcm) and signed with VAPID (ES256 JWT, `aud` the endpoint origin, 12 h). Table `push_subs(player, endpoint, p256dh, auth, created)`. Five kinds, each sent once to every subscription of the player it concerns: `challenge` (to the challenged), `accepted` (to the challenger), `turn` (to the player on move), `chat` (to the receiver, the sender name only, never the text), `over` (to both, with the result). Tags: `challenge:<from>`, `accepted:<from>`, `turn:<game>`, `chat:<from>`, `over:<game>`, so a newer push replaces the older one of its kind. No push while the player has a live stream open. A 404 or 410 from the push service deletes the row; revoke, delete and `invite --new` delete all rows of the player. Endpoints are never logged in full (host only). Test: `test/online-push.mjs` (RFC 8291 appendix A vector, fake push service).

## Own stats (CHE-291)

Usage events of logged in players only, no player id and no IP stored. Raw events are kept 90 days (table `events`), a daily sum per day, kind, name and device class forever (table `stats_daily`). The roll up and the clean up run in the server: once on start and then every 24 hours. Open the dashboard with `curl -H "Authorization: Bearer $ONLINE_ADMIN_SECRET" <server>/stats` or in a browser at `/stats` (the page asks for the secret). Last 7 and 30 days: sessions, top features, errors by device and place, performance tiers, the latest errors. No migration step: the tables are created on start (`CREATE TABLE IF NOT EXISTS`).

## Deploy (VPS)

`server/Dockerfile` (build context: the repo root) builds an image with only `server/` and `src/rules.js`, Node 24 slim, a non root
user, the database under `/data`, `LABEL service="chess-online"`, listening on `PORT` 3000 with `GET /up` as the health check. The live
stream sends `Cache-Control: no-cache` and `X-Accel-Buffering: no` and a heartbeat every 20 s, so it passes kamal-proxy. The Kamal
config is written with the owner in the VPS step.

## Server update without loss (CHE-406)

While a server is replaced, the old and the new one run on the same database for a moment. Both answer requests; only the holder of
the **writer lease** runs the background work: the bot (and the moves it owes), the daily roll up, the 5 minute health samples and the
web push. The lease is one row in `writer_lease` (`owner`, `beat`, `since`): the holder renews `beat` every 5 s; a stopped server deletes
its row (the other takes over at its next beat, `SIGTERM` runs `close()`); a crashed one is taken over when `beat` is older than 20 s. A
free lease is claimed only 35 s after the start in production (`ONLINE_LEASE_GRACE_MS`, 0 locally), because a server from before the lease cannot be seen in the
table. A non writer that handles a challenge to the bot leaves it open; the new writer answers it when it takes over (`bot.resume()`).
The schema only grows: `test/online-schema.mjs` refuses DROP, RENAME and any ALTER but ADD COLUMN in `server/*.mjs` and compares
`openDb()` with `server/schema.snapshot.json` (a removed column fails; `node test/online-schema.mjs --update` only adds). Code:
`server/lease.mjs`. Test: `test/online-lease.mjs` (two servers on one temp database file). The deploy script (backup, counts,
rollback) is private.

## Server history (CHE-306)

Every 5 minutes (and once 10 s after start) the server writes one row into `server_health`: the chess server group (maxima over the interval of Present players, Live streams and running games, event loop delay in ms, RSS; requests, 4xx and 5xx; uptime; server start time) and the machine group (load 1/5/15, free and total memory, free and total disk of the volume the database lives on, database size incl. WAL). Maxima are kept between samples (`health.touch()` on every presence, stream and game change), so a visit shorter than 5 minutes still shows. Counts only: no player id, no IP. Rows older than 90 days go in the daily maintain step. `/stats` starts with a "Server" section: live values (red: disk over 85 percent used, free memory under 10 percent, event loop delay over 200 ms), then charts for 24 hours and 7 days as inline SVG (no script). A new server start time is a vertical marker, a missing slot is a gap. Code: `server/health.mjs`. Test: `test/online-health.mjs`.

### Health check for a monitor (CHE-307)

`GET /health` (public, no secret, `Cache-Control: no-store`, text/plain; `HEAD` gives the same status without a body) answers `200 ok` or `503` with one short reason, derived from the `server_health` rows of the last 15 minutes so a single bad sample does not alarm. Reasons: `error rate N% over 15 min` (5xx over 5 percent of the requests, at least 3 samples and 20 requests in the window, so an idle server never alarms), `disk N% used` (over 85 percent in every sample of the window), `db unreachable` (`SELECT 1` throws). Fewer than 3 samples (fresh start) is ok. Memory and event loop delay are display only. The body holds no player, name, count or path. `/health` is not counted in the request counters (a monitor cannot move the error rate) and not throttled. `/up` stays the Kamal health check and does not depend on `/health`. Code: `healthVerdict()` in `server/health.mjs`; limits in `LIMITS`. The monitor setup (UptimeRobot) is in the private deploy notes.

Tests: `test/online-server.mjs`, `test/online-stats.mjs`, `test/online-health.mjs`, `test/online-lease.mjs`, `test/online-schema.mjs` (fast tier) and `test/online-page.mjs` (smoke group `online`).

## API version (CHE-405)

`GET /version` (public, no key, `Cache-Control: no-store`, CORS like the other routes) answers `{ "api": 1, "minClient": 1, "commit": "<12 char sha>" }`. `api` is the API number of this server, `minClient` the lowest client API it still serves, `commit` the image tag (`KAMAL_VERSION`, set by `deploy.sh` as `--version`; empty outside Kamal, `ONLINE_COMMIT` as a fallback). The numbers live in `server/version.mjs`. Bump rule: docs/ARCHITECTURE.md, "API version". A server from before this route answers 404 there: the client reads that as API 0. The client check is `src/online/version.js`, the release check reads the live route (`tools/release-check.mjs`).
