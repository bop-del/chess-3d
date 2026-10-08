# ADR 0008: One panel on the right is the desktop layout

**Status:** accepted
**Date:** 2026-10

## Context

The first desktop HUD was two glass columns of cards (view, gimbal, scene on the left; game, moves, captured, then the learning cards on the right), with browser dropdowns for the strength, the side, the light, the quality and the battle scenes. Every new feature added a card to one of the columns. The columns took 540 px of the width, the learning cards had to share the right column with the game, and a lesson running meant scrolling past the game cards to reach it. Phones had already moved to a different model (status line, thumb bar, Menu sheet) and shared none of the layout.

## Decision

**Desktops and tablets (anything that is not `device.phone`) get one panel on the right**, built by `src/panel.js` and styled by `src/panel.css`:

- A header that is always there: logo, status (whose move, or which kind of lesson), New game, Undo, and the rail button.
- Three tabs under it: **Play** (opponent, Good move?, moves, captured), **Learn** (the Openings card with its tabs, plus the cards of a running Explain, Drill or Puzzle) and **Settings** (views, theme, light, battle scenes, sound, quality, language, and a folded Advanced section with the gimbal sliders and the progress export and import).
- When a lesson or puzzle starts (a class on `<body>`: `explaining`, `drilling`, `puzzling`) the panel switches to Learn and unfolds. The other tabs stay reachable.
- A **rail** (key `H`, a button in the header): the panel folds to a 60 px icon strip. The choice is remembered per browser (`chess3d.rail`); a window narrower than 900 px opens as the rail when nothing is stored.
- A **view bar** floating over the board area: the view picker, Flip, Spin, Reset and the lock. It fades after a few seconds without pointer or key and wakes on any input.
- **No browser dropdowns.** Choices are visible chips and swatches (`chipGroup()` in `src/panel.js`). A chip group has a `value` and fires `change`, so code written against a `<select>` works unchanged.
- The keyboard help is a styled overlay with a scrim, closed by Escape, a click outside or its button.

**The panel tells the camera how much of the canvas it covers** (`controls.setFrame({ right: width })`), through a `ResizeObserver` on the panel, so the board glides to the middle of what is left while the panel animates between its two widths. The same width goes to the CSS variable `--panel-w`, which centres the view bar, the game over banner, the promotion chooser and the toast over the board area.

**Phones keep their model.** `buildPhone()` and the columns' cards it moves into the Menu sheet are untouched. Both layouts use the same element ids (`#btn-new`, `#moves`, `#chk-ai`, `#presets`, ...), so the game wiring in `src/ui.js` is shared; only the markup and the choice controls differ.

Modules mount into the panel through the existing contract: `ui.mountPanel(id, el)` puts a card in the Learn tab, `ui.mountSettings(id, el)` puts a block into the slot of that id in the Settings tab (`themes`, `battle`, `audio`, `music`, `train-data`; an unknown id lands in the `more` slot).

## Rationale

**One place per job.** Playing, learning and tuning each get a tab, and nothing needs scrolling past something unrelated. The rail gives the board the whole screen when the player wants it.

**Free area instead of symmetric columns.** The camera already had a framing mode for phones (insets in CSS px). Reusing it means the board and both captured piece areas fit the area beside the panel, whatever the panel's width, with no second fitting code.

**Same ids, two markups.** The phone layout is the one that has been through real devices. Leaving it alone is cheaper and safer than sharing markup, and the shared ids keep one copy of the game wiring.

## Consequences

**Positive:** features add a block to one tab, not a card to a column. The camera framing follows the panel by itself.

**Positive:** the same panel serves a 1024 px tablet and a 1440 px desktop; only the width changes (`clamp(340px, 29vw, 380px)`).

**Negative:** two markups for the same controls (the phone cards and the panel), so a new game control needs adding to both. The ids and `ui.js` are the checklist.

**Negative:** `chipGroup` is a small hand written radio group, not a native control: it needs its own keyboard handling (arrow keys inside a group, done) and its own look in forced colours modes.

## Alternatives considered

**A drawer opened by a button.** Hides the controls behind a click and brings back the sheet model the phone already has. Rejected: the desktop has the width to keep the panel open.

**Keep the columns and restyle.** Cheapest, and it keeps the root problem: every feature still fights for a card in one of two columns.

**One responsive markup for phones and desktops.** The cleanest on paper, but it would have reopened the phone layout the phone tier protects. Rejected for this round.
