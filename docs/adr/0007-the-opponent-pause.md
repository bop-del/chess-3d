# ADR 0007: The opponent's move pauses, and the pause is a parameter

*Carried over from chesslines ADR 0012 (2026).*

**Status:** accepted
**Date:** 2026

## Context

In Explain, the player makes the moves of the side the line is for; the game plays
the opponent's. In the Scandinavian, taught from Black, four of the eight moves are
the opponent's: the game plays more of that line than the player does.

Each move carries a text. If the opponent's move lands the instant the player
finishes their own, its text appears and is replaced while they are still reading
the previous one. The sentence explaining *why the opponent does that* is the one
most likely to be missed, and it is the one that makes the line make sense.

So the opponent's move waits about a second. In the 3D game this also lets the
piece's travel across the board be seen rather than skipped. It is the first time
the trainer makes behaviour depend on a clock.

## Decision

**The opponent's move is delayed** by a short pause before it plays.

**The pause is a parameter of the Explain module, not a constant inside it.** The
game passes roughly a second; tests pass zero.

**The checks assert order, never duration:** that the opponent's move follows the
player's, that the text is the one belonging to that move, and never that a
particular number of milliseconds elapsed.

## Rationale

**The tests wait for nothing today.** The fast tier is deterministic, and the
browser tiers drive time themselves (`?manual=1` with `__chess.step(seconds)`).
Introducing a real delay would make timing the first source of flakiness in a
suite that has none, and a suite that fails at random is one people stop
believing, which is worse than a slower one.

**Zero in tests is not a weaker check, it is a different one.** What the
assertions can meaningfully verify is *sequence and attribution*: the right move,
with the right text, in the right order. Whether one second is the right length is
a judgement about a child's reading speed, and no assertion has an opinion about
that.

**Pace belongs with what the tests cannot judge**, such as whether the game
teaches or how it feels on a phone. The honest place to settle it is a child using
it, not a timer in a headless browser.

**A parameter costs nothing.** The alternative, a constant read from module scope,
would force the tests to either wait or monkey-patch, and both are worse than
passing a number in.

## Consequences

**Positive:** The suite stays deterministic. No real waits enter the codebase.

**Positive:** The pause can be tuned, or removed, without touching a test.

**Negative:** The one thing the pause exists for, that the text is readable before
the board moves, is exactly what the checks cannot confirm. It has to be watched on
a real phone, by someone watching a real child.

**Negative:** A number passed from the outside can be passed wrongly. A caller
omitting it should get the game's pace, not zero, so the default belongs with the
game and zero is the deliberate override.

## Alternatives considered

**Let the tests wait the real pause.** Closer to the real thing, and it buys a
slower suite plus the first flaky check. Rejected on the strength of what it would
actually verify: that a timer works.

**No pause; the opponent moves on the player's next touch.** Fully deterministic
without any parameter. Rejected because it asks the player to tap the board with
nothing to tap for, which is precisely the confusion the pause removes.
