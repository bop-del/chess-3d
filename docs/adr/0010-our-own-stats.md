# ADR 0010: Our own mini stats

**Status:** accepted
**Date:** 2026-10-07

## Context

The owner wants to know how the game is used: which features, which errors on which devices, how it performs, how long a session
lasts. Children play it, and ADR 0009 says player data stays on our own server and not at third parties. PostHog or a similar service
was the first idea (CHE-291); it needs a grill on privacy for children, consent and key handling in the public repo.

## Decision

**Our own mini stats on the online server (`server/stats.mjs`), no third party.**

- **Only logged in online players are counted.** `POST /events` needs a valid player key (the same key as every other call). Without
  `?online` or without a login the page sends nothing. Anyone else gets 401.
- **Four event kinds:** `error` (message, where, device), `feature` (name), `perf` (frame rate tier, load ms), `session` (length).
  The device is a family and a class only: browser family, touch or pointer, screen size, GPU tier. No user agent string.
- **No player id and no IP is stored** with an event. Size and rate limits per key (20 events and 16 KB per request, 10 requests a
  minute, 2000 events a day).
- **Retention:** raw events 90 days, a daily roll up (per day, kind, name, device class) forever. The roll up and the clean up run
  in the server itself, on start and once a day.
- **Dashboard `GET /stats`** on the same server, plain HTML rendered by the server, only with the admin secret (`ONLINE_ADMIN_SECRET`,
  sent in an Authorization header or typed into the login form; never in a URL or a log). Without the variable the page does not
  exist. The data never leaves the VPS.
- **No notice to players** (owner decision).

## Rationale

**Why not PostHog now.** A hosted service puts usage data of children at a third party and brings consent and a key into a public
repo. What the owner needs today (features, errors by device, performance, sessions) is a few hundred lines on a server that
already exists and already knows who may talk to it. PostHog (EU cloud or self hosted) stays a later option (CHE-302) if funnels or
the public page's own traffic are needed.

**Why only logged in players.** They are the family. The public page stays free of any tracking, which keeps the promise of ADR 0003
and 0009 for everyone else, and the existing key is the abuse protection.

**Why no player id.** The questions are about the game, not about people. Without an id there is nothing to delete on request
and nothing that can be linked to a person.

## Consequences

- The stats cover only the online players, so they say little about the public page.
- The raw table is capped by time, not by size; the per key daily cap bounds a runaway client.
- A later switch to PostHog replaces `src/online/stats.js` and `server/stats.mjs`; the event kinds are the contract.
