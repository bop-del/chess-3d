# ADR 0005: Our own PGN parser, on our own rules engine

*Carried over from chesslines ADR 0010 (2026).*

**Status:** accepted
**Date:** 2026

## Context

Opening lines are written as PGN, and an opening is a tree: the other side has
choices, and a repertoire has to hold "if they play this, I play that." So the
parser must keep variations.

The old app used a third-party rules library and had to write its own parser on top
because that library silently discards variations when it loads PGN. Verified
there: loading `1. e4 e5 (1... c5 2. Nf3 d6) 2. Nf3 Nc6` returned a history of
`e4 e5 Nf3 Nc6`, with the variation gone and no error raised.

chess-3d has its own rules engine, `src/rules.js`, so there is no third-party
loader to weigh against. The question is only where the parser lives and what it
trusts.

## Decision

**The PGN parser is ours**, a small module of roughly 30 lines of tokenising plus
a tree walk, built **on `src/rules.js`**. Every move the parser reads is handed to
the rules engine for legality and SAN, so an illegal move in a PGN is rejected
rather than trusted.

## Rationale

**Variations are the data model, not a nicety.** A parser that flattens the tree
cannot represent the thing the trainer is about.

**Silent failure earns its own check.** A loud failure would be caught by any
test. The failure to guard against returns a plausible line and loses the
branches, so a test asserts on variations directly.

**The grammar is genuinely small.** SAN moves, `(`, `)`, `{comments}`, `$n` NAGs,
move numbers to skip, result markers. The rule that matters is one line: a
variation attaches as a **sibling of the preceding move**. On `(` rewind one ply,
on `)` restore.

**Ownership stops where the danger starts.** Legality is the hard and dangerous
part, and it stays in the one tested engine. Parsing is neither, and owning it
costs one small file.

**One engine, not two.** Parsing through `src/rules.js` means the parser, the
position key (ADR 0002) and ordinary play can never disagree about what is legal.

## Consequences

**Positive:** The tree the trainer needs, with variations intact.

**Positive:** Illegal moves are rejected loudly at parse time, which is how the
starter list is proved legal in the fast test tier.

**Negative:** Full PGN is a larger grammar than this: edge cases of nested
variations, unusual tag pairs, SAN oddities. This parser handles what the starter
list and hand-written repertoires contain, not arbitrary tournament PGN.
Importing files from elsewhere would be a new decision.
