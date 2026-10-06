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
| `ONLINE_ORIGINS` | the local preview origins | Comma separated list of game origins allowed by CORS, for example `https://bop-del.github.io`. Without it: `http://localhost:*`, `http://127.0.0.1:*`, the Tailscale range `http://100.64.0.0/10` and `*.ts.net` |
| `ONLINE_TRUST_PROXY` | off | `1` takes the client IP from `X-Forwarded-For` (behind kamal-proxy), for the wrong code throttle |
| `ONLINE_GAME_URL` | `http://localhost:5173/` | The game page the invite link points to (admin only) |
| `ONLINE_PUBLIC_URL` | `http://localhost:<port>` | This server as the browser reaches it, put into the link as `?online=` (admin only) |
| `ONLINE_ENV` | none | A `KEY=VALUE` file outside the repo with the variables above |

Nothing secret lives in the repo: keys and codes are stored only as sha256 hashes; paths and the public origin come from the env.

## Admin commands

    node server/admin.mjs invite <name>         # a new player: the link and a code like FELIX-7K3Q
    node server/admin.mjs invite <name> --new   # a fresh link and code, the old ones stop working
    node server/admin.mjs revoke <name>         # cannot log in any more, games and score stay
    node server/admin.mjs delete <name>         # all of the player's data gone
    node server/admin.mjs chat <name>           # print all of that player's conversations
    node server/admin.mjs mute <name>           # cannot write chat messages (unmute <name> undoes it)
    node server/admin.mjs list                  # the players

The link is `<game>?online=<server>&open=online#online=<key>`: the key travels in the fragment, which the browser never sends to a
server; the game stores it and strips it from the address bar at once. The code gives the same login on another device (the iPhone
home screen app has its own storage). Wrong codes are slowed: 5 per IP in 10 minutes.

## HTTP API

JSON, `Authorization: Bearer <key>` except `/up` and `/login-code`. An unknown key gets 401 and nothing else.

| Request | Body | Answer |
|---|---|---|
| `GET /up` | | `ok` (health check, no auth) |
| `POST /login-code` | `{ code }` | `{ key, name }` (a new device key for that player) |
| `GET /state` | | `{ me, now, players, challenges: { in, out }, game, chats, unread }` |
| `GET /events` | | the live stream: event `state` (the same shape) on every change, `: hb` every 20 s |
| `POST /challenge` | `{ to }` | `{ id }` |
| `POST /challenge/answer` | `{ id, accept }` | `{ game }` or `{ declined }` |
| `POST /move` | `{ game, uci, cid }` | `{ ply, san, over }`; an illegal move is 400 `illegal` |
| `POST /resign` | `{ game }` | `{ over: 'resign' }` |
| `POST /finish-stale` | `{ game }` | after 3 days without a move, the waiting player wins |
| `POST /chat` | `{ to, text, cid }` | at most 200 characters |
| `POST /chat/read` | `{ with }` | marks that conversation read |

`cid` is a client id: a retried POST with the same id is applied once. Limits per key: 60 moves, 10 messages and 30 other actions a
minute; a body over 4 KB is refused.

## Deploy (VPS)

`server/Dockerfile` (build context: the repo root) builds an image with only `server/` and `src/rules.js`, Node 24 slim, a non root
user, the database under `/data`, `LABEL service="chess-online"`, listening on `PORT` 3000 with `GET /up` as the health check. The live
stream sends `Cache-Control: no-cache` and `X-Accel-Buffering: no` and a heartbeat every 20 s, so it passes kamal-proxy. The Kamal
config is written with the owner in the VPS step.

Tests: `test/online-server.mjs` (fast tier) and `test/online-page.mjs` (smoke group `online`).
