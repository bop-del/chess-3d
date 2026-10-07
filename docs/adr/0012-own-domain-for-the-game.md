# ADR 0012: Own domain for the game

**Status:** accepted
**Date:** 2026-10-07

## Context

The game lives at `https://bop-del.github.io/chess-3d/`. Push notifications (CHE-272) need the installed app to have its final origin:
localStorage, the Home Screen app and a push subscription are bound to the origin, so a later move would lose them. The online server
already has its own name, `chess.borisdiebold.com`.

## Decision

**This repo's GitHub Pages gets the custom domain `chess3d.borisdiebold.com`** (`public/CNAME`, DNS CNAME `chess3d` to
`bop-del.github.io.`). No second repo, no move page. The online server stays at `chess.borisdiebold.com` and lists both game origins in
`ONLINE_ORIGINS` while the old address is around.

**Fresh start, no progress handoff.** localStorage is per origin, so settings and progress of the old address do not follow. We
considered a handoff through the URL fragment and dropped it: the game has two users (the owner and his son), so the cost of starting
fresh is small, and the owner chose it over the extra code, a second Pages repo and a deploy key.

`vite.config.js` keeps `base: './'`, which works at the domain root and at the old `/chess-3d/` path alike.

## Why not the Pages default address

A `*.github.io` project path is owned by the account, and renaming the repo or account would move the origin again. Our own domain can
point at any host later without a second move.

## Why not the VPS serving the game

The game must stay up when the VPS is down. GitHub Pages is free, has a CDN and a certificate, and holds no secrets. The VPS only does
online play (ADR 0009).
