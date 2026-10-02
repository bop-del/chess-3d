# ADR 0002: Positions, not nodes: the repertoire data model

*Carried over from chesslines ADR 0007 (2026).*

**Status:** accepted
**Date:** 2026

## Context

A repertoire is a set of opening lines, and progress has to hang on something.
The obvious choice is the node in the move tree: this line, this ply, this card.

Chess makes that choice wrong, because of **transpositions**: different move
orders reaching the identical position. `1.d4 Nf6 2.c4 e6 3.Nc3 d5` and
`1.d4 d5 2.c4 e6 3.Nc3 Nf6` end in the same place by different routes.

## Decision

**Progress is keyed by position, never by node in a tree.**

The key is the **first four FEN fields**: piece placement, side to move,
castling rights, en-passant square. The halfmove clock and fullmove number are
dropped: they record *how you arrived*, not what the position is.

The same key is used for catalogue lookup (naming a position) and for the
repertoire (what has been practised). It is produced by the rules engine
(`src/rules.js`), so the key and the legality of moves come from one source.

## Rationale

**A per-node design cannot represent a position reached two ways.** The same
position appears as two unrelated cards, drilled twice, with progress split
between them, and the game cannot tell the player they already know this.

**The failure appears late, which is what makes it dangerous.** With three lines
nothing looks wrong. It surfaces once a repertoire has grown, which is both the
worst time to discover it and the point at which migrating stored progress is
painful.

**Four independent projects converge on it:** ChessTempo, Chessbook,
OpeningTree and chessdriller all key by position. Unanimity across tools that
share no code is strong evidence.

**En passant stays in the key.** A position where the capture is legal genuinely
is a different position: the legal moves differ. Dropping it would merge two
positions that play differently. **Castling rights stay** for the same reason.

**The clock fields go**, because they make the *same* position look different
depending on the route taken, which is precisely the bug being avoided. The two
move orders above produce different full FENs and an identical four-field key.

## Consequences

**Positive:** Transpositions merge for free. Practising a position once counts,
however it was reached.

**Positive:** Catalogue naming works on positions the player reaches by a move
order the line did not anticipate, which is the catalogue's actual job.

**Negative:** The key is a string of about 55 characters per card rather than a
small integer id. At a few dozen cards the storage cost does not matter (ADR 0003).

**Negative:** A position carries no memory of the line that reached it. Anything
route-dependent needs the tree alongside the key, not instead of it.

## Alternatives considered

**Node ids in the tree:** simpler and smaller, and wrong for the reason above.

**A hash of the four fields:** shorter, but debugging becomes guesswork and the
space saving is irrelevant at this size.
