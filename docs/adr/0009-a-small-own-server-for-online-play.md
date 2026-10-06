# ADR 0009: A small own server for online play

**Status:** accepted
**Date:** 2026-10-06

## Context

The owner's children want to play each other from two devices. ADR 0003 says there is no server and the player's data lives in the
browser. Online play cannot work that way: two devices need a place that holds the game between them, decides whose move is legal,
and carries a chat while the other player is offline.

## Decision

**A small server of our own, in this repo under `server/`, for online play only.** Local progress (openings, puzzles, badges, settings)
stays in the browser as ADR 0003 says; this ADR supersedes the "no server" part of ADR 0003 for online play and nothing else.

- **Node with no dependency:** `node:http`, `node:sqlite`, `node:crypto`. The server imports the game's own rules engine
  (`src/rules.js`) and validates every move with it, so there is no second copy of the rules. The server is the only truth.
- **Server-Sent Events plus POST** as the transport: the live state flows one way (server to client) on a stream read with `fetch`
  (the key in the Authorization header, never in a URL or a log), actions are plain POSTs with a client id so a retry is applied once.
  A heartbeat every 20 s keeps proxies open. The transport lives in two files (`server/live.mjs`, `src/online/api.js`).
- **An invite is the login**: the owner creates a player with `server/admin.mjs`, which prints a link (the key in the URL fragment) and
  a code. Keys and codes are stored only as hashes. Nothing secret is in the repo.
- **Behind a flag** until the VPS step: without `?online=<server url>` the public page is unchanged.

## Rationale

**Why not Supabase or another hosted backend.** Children's chat messages would sit at a third party, and free projects pause after a
week without use, which is exactly how a family game is used. Our server is a few hundred lines on the owner's own VPS.

**Why SSE plus POST over WebSocket.** No dependency (Node has no WebSocket server built in), the traffic is one way apart from a few
actions, plain HTTP passes every proxy (kamal-proxy held a stream for 180 s in the probe), and the client refetches the full state on
every reconnect, which makes lost events harmless. The transport is in two files, so a later switch touches only those.

**Why SQLite.** One file, no service to run, enough for a family; the image keeps it on a volume.

## Consequences

- Online play needs the server running; the rest of the game does not.
- Everything is kept forever for now (games, moves, chat); retention is a later decision.
- Push notifications (CHE-272), several games at once and a game list come later.
