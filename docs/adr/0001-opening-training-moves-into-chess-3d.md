# ADR 0001: Opening training moves into chess-3d

**Status:** accepted
**Date:** 2026

## Context

Two apps served one family. chesslines teaches a child chess openings on a flat
board: no build step, a vendored third-party rules library, a hand-written DOM
board, tap to move. chess-3d is a 3D chess game on a Vite stack with its own rules
engine (`src/rules.js`), a tested board and a tiered test suite. The trainer's
target is a phone used by a child, and chess-3d has since grown a device
foundation and a phone test tier.

Keeping both means two boards, two rules engines that can disagree about what is
legal, and two places to fix everything. For a trainer that teaches positions to a
child, a second engine is the worst kind of duplication: a legality difference is
silent and sounds authoritative.

## Options considered

**Share the data first and merge later.** Keep both apps, move the lines and
texts into a shared format and let each read it. Cheap now, but the two engines
and two boards stay, and the merge is only postponed.

**chess-3d becomes the home now.** Port the trainer into chess-3d as modes of the
3D game, on its engine and its test tiers.

**chesslines becomes the home.** Add a 3D board to the flat app. Rejected: it
would need a bundler, a 3D stack and a test tier it does not have, which is
rebuilding chess-3d inside the smaller project.

## Decision

chess-3d becomes the home of opening training now. chesslines is frozen: it keeps
working as it is and gets no new features. There is one rules engine: ours
(`src/rules.js`), not the vendored library. The player's progress starts fresh in
chess-3d; nothing is migrated from the old app's storage.

Carried over, adapted: positions not nodes, local storage and export, German and
English, our own PGN parser, a sentence per move, the opponent pause. Not carried
over: no framework or build step, vendoring, the hand-written flat board, branch
deploy, and dev dependency rules, because chess-3d has its own answers.

## Consequences

**Positive:** One engine, one board, one test suite, one place for fixes.

**Positive:** Modes live inside the 3D game: Play and Explain first, then Adopt
and Drill.

**Negative:** Progress made in chesslines does not follow the player. Accepted:
the stored data is small and the repertoire is quick to rebuild.

**Negative:** The trainer inherits chess-3d's build, so it is no longer true that
cloning the repository is enough to run it. chess-3d's commands and test tiers
decide how it is verified.

**Negative:** The two apps drift apart while chesslines stays frozen. Accepted: it
is a stopping point, not a second product.
