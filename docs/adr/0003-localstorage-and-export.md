# ADR 0003: localStorage plus export, and the 7-day rule

*Carried over from chesslines ADR 0008 (2026).*

**Status:** accepted
**Date:** 2026

## Context

The repertoire and its progress are **the player's data**. There is no server, so
it lives in the browser, and the target browser on a phone is iOS Safari, which
deletes browser storage on a schedule.

## Decision

**localStorage, one compact key**, with the due date as a day number rather than
an ISO string.

**Export and import from day one**, as a JSON file: a Blob plus `<a download>` to
save, `<input type="file">` to restore.

**A PWA is deferred**, with export as the mitigation, and the reason recorded
here so the argument is already written when it comes back.

The store is separate from the game's own URL flags and view settings. Progress
starts empty in chess-3d (ADR 0001).

## Rationale

**The iOS problem, stated plainly.** WebKit's tracking prevention deletes **all
script-writeable storage after 7 days of Safari use without interaction with the
site**: localStorage and IndexedDB alike. Practising twice a week never trips it.
A three-week holiday could, and it would erase a child's practice history.

**"IndexedDB is safer on iOS" is folklore with no primary source.** The 7-day
policy covers both. IndexedDB's async complexity buys nothing here, and a few
kilobytes do not need a database.

**Size is small.** A card carries a position key, two levels, a due day and its
line ids, measured at about 136 bytes. That is under 5 KB for the 34 cards twelve
lines produce and about 20 KB at 150 cards, against localStorage's roughly 5 MB.
A test holds the size to a ceiling so it cannot drift unnoticed.

**The only documented defence is Add to Home Screen**, which is explicitly exempt
from the cap. That makes a PWA a *durability* feature rather than a convenience, a
different and stronger argument than the one that deferred it. It is deferred, not
rejected.

**Export is a feature, not a chore.** It is the backup that makes the 7-day risk
survivable, *and* it is how a repertoire the player built can be kept, moved to
another device, or shown to somebody. The second reason is why it ships on day one
rather than when it is first needed.

**Not URL state:** a repertoire plus progress exceeds the safe URL length of about
2,000 characters and gzip barely helps at this size. The URL stays right for
*sharing a repertoire* later and for the game's existing flags; it is wrong for
carrying daily progress.

## Consequences

**Positive:** No server, no accounts, no privacy surface for a child's data.

**Positive:** A day number keeps the stored form small and comparison trivial.

**Negative:** Storage can vanish, and no automated check can prove otherwise: the
headless test browser does not model Apple's storage eviction. The defence is
export plus, eventually, Add to Home Screen.

**Negative:** Export is a manual act. A child will not do it unprompted, so the
game should ask at a sensible moment: a UI question, not a storage one.

**Negative:** The day-number encoding needs a fixed epoch, and a bug there shifts
every due date at once. It gets a unit test in the fast tier.
