# ADR 0014: Live server dashboard through an MCP connector

**Status:** accepted
**Date:** 2026-10-11

## Context

`/stats` (ADR 0010) shows the server as a page that the owner opens and reloads. The owner wants a live view in a private claude.ai
Artifact that refreshes every 30 seconds, on the Mac and on the iPhone. A claude.ai Artifact can read data from a connected MCP
server, so the chess server has to speak MCP. The server has no dependency (ADR 0009) and the official MCP SDK is large.

## Decision

**A read only MCP endpoint in `server/mcp.mjs`, written by hand.** Streamable HTTP, JSON-RPC 2.0 over `POST`: `initialize`,
`notifications/initialized`, `ping`, `tools/list`, `tools/call` (a batch is answered too). `GET` answers 405, there is no server
initiated stream. About 200 lines, covered by `test/online-mcp.mjs`, like the push sender in ADR 0013.

- **Secret path.** The route is `/mcp/<secret>`, the secret is `ONLINE_MCP_SECRET` (32 characters or more, from the env file, kept
  in the owner's Keychain). Without a secret, or a shorter one, the route does not exist (404). A wrong or partial secret also
  answers an empty 404, the same as any unknown path, and is compared in constant time (hashed, like the `/stats` secret).
- **Rate limit.** 120 requests per IP and minute across everything under `/mcp/`, wrong secrets included, then 429.
- **Counts only.** Three tools, all `readOnlyHint`: `live_stats` (now), `history` (`server_health` rows of 24 h, 7 d or 30 d,
  downsampled to at most 300 points) and `player_events` (feature use per day, error counts per place, load time median and p90).
  No player name or id, no IP, no chat text, no error text, no invite key or code. A tool error carries a fixed message, never an
  exception text. The tests assert this on the output of every tool.
- **Red marks** use the limits the server already has: `LIMITS` in `server/health.mjs` (event loop 200 ms, disk 85 percent,
  free memory 10 percent, 5xx rate 5 percent) and the percent limits of the external server alert (CHE-362, CHE-433: CPU 80, RAM 85,
  disk 90), kept as `ALERT` next to `LIMITS`.
- **New measurements.** `server_health` gets two additive columns, `proc_cpu` (the process, `process.cpuUsage()` over wall time,
  100 is one core) and `host_cpu` (busy share of all cores from `/proc/stat` deltas). Both are null where unknown (macOS, a
  database from before). One value per 5 minute sample is the average over the interval.
- **Not logged, not counted.** The log line shows `/mcp/*`, never the path. MCP calls do not move the request counters, so a
  dashboard that polls cannot raise the error rate.
- **Added once** in claude.ai: Settings, Connectors, Add custom connector, URL `https://chess.borisdiebold.com/mcp/<secret>`.

## Why not OAuth

claude.ai custom connectors can use OAuth, but that needs an authorization server (registration, authorize, token, refresh,
metadata documents): far more public surface than the one number we protect, for a single owner and read only counts. A long random
path is a bearer secret of the same strength as an `Authorization` header, is easy to rotate (change the env var, restart, edit the
connector) and keeps the server free of an auth stack. If the data ever becomes more than counts, this decision is revisited.

## Consequences

- A new public surface: one path prefix. It leaks nothing without the secret and gives only counts with it.
- The secret is in a URL. The reverse proxy (kamal-proxy) may log the full path, and claude.ai stores the connector URL. Treat it
  like a password: Keychain, never in the repo, rotate if it shows up anywhere (a proxy log, a screenshot, a chat).
- `player_events` returns feature names and error places as the clients sent them (letters, digits and a few symbols, 48 and 80
  characters at most). They are counts keyed by those labels, not player data, but a hostile logged in client could send a label
  that looks like a name. Accepted: it is the owner's own view, and the same labels are on `/stats`.
- The endpoint ships with the next server update; the Artifact is built after the owner has added the connector.
