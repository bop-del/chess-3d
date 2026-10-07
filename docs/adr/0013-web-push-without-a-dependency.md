# ADR 0013: Web push without a dependency

**Status:** accepted
**Date:** 2026-10-07

## Context

Online play needs to reach a player whose game is closed (challenge, your turn, chat, game over, accept). ADR 0009 says the server
has no dependency. The usual answer is the `web-push` npm package.

## Decision

**Our own sender in `server/push.mjs` with `node:crypto`.** Encryption is RFC 8291 (aes128gcm, RFC 8188), the sender identity is
VAPID (RFC 8292, ES256). It is about 100 lines and is checked against the RFC 8291 appendix A test vector in the fast tier.

- Subscriptions in SQLite (`push_subs`, one row per endpoint). A 404 or 410 answer deletes the row; a revoked invite deletes all
  rows of the player.
- The VAPID private key lives in a file named by `ONLINE_VAPID_FILE` (mode 600), made once by `admin.mjs push-keys`, which never
  overwrites it. It is a secret like `ONLINE_ADMIN_SECRET` and is backed up: losing it invalidates every subscription. Without
  the file push is off and its routes answer 404.
- A push carries a title, a short body, a `tag` per kind and game or sender, and a url. A chat text never goes into a push.
  No push while the player has a live stream open. No quiet hours (devices have focus modes).
- A subscription endpoint is a secret: logs name the host only.

## Consequences

No new dependency and no supply chain surface for the secret key. We own the crypto glue, so it has a vector test and the fake
push service test. Browsers and push services are only tested on devices against the VPS.
