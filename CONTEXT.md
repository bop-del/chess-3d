# chess-3d

The vocabulary of a 3D chess game that also teaches a child chess openings.
Terms here are the ones this project argues about; general chess words that mean
what they always mean are not listed. The target device for the trainer is a
phone, used by a child, which settles many choices below.

## Language

### Teaching

**Line**:
One concrete sequence of moves that the game teaches, belonging to an opening
and carrying a text per move. There are 27, all with texts: twelve openings and 15 side lines, each a line of its own that shares the first moves of its opening and deviates at a common reply.
_Avoid_: opening (means the named idea, not our sequence), variation, repertoire entry

**Opening**:
The named idea a line belongs to: "Italian Game", "Queen's Gambit". Named by
the catalogue, not by us, and one opening covers many possible lines.
_Avoid_: line, defence, system

**Catalogue**:
The 3,810 CC0 entries from Lichess, keyed by position. Its only job is naming a
position, including one reached by a move order the line did not anticipate. It
is exhaustive, not curated, so it can never be the list a child chooses from.
_Avoid_: database, dataset, opening list

**Starter list**:
The 27 lines we hand-picked and wrote ourselves. Curation is the part the
catalogue cannot do.
_Avoid_: catalogue, our openings, the twelve, the 27

**Position key**:
The first four FEN fields: placement, side to move, castling rights, en
passant. Drops the clocks, so two move orders reaching the same position share
one key. Everything hangs on this rather than on a node in a tree. Produced from
the rules engine's own position, never from a second source.
_Avoid_: FEN (that is the six-field string), hash, position id

**Own move**:
A move of the line played by the side the line is for. The player makes these
on the 3D board; the game accepts only this move and refuses any other.
_Avoid_: user move, correct move, player move

**Opponent move**:
A move of the line played by the other side. The game plays these itself, with
their text, the same way Drill will. Four of the Scandinavian's eight moves are
these, because that line is taught from Black.
_Avoid_: computer move (that is the Easy opponent of ordinary play), White's
move (depends on the line), automatic move

**Move text**:
The one sentence attached to a move, saying what it achieves. Always names a
plan, never an evaluation. Display-only: never stored, never exported.
_Avoid_: comment, annotation, explanation, description

**Move hint**:
The next own move, shown on the 3D board itself: its from-square marked quietly,
its to-square marked strongly, and an arrow drawn from one to the other. A
per-viewer preference that can be switched off, defaulting to on.
_Avoid_: hint alone where a wrong-move correction is meant, highlight, cue

**Arrow**:
The line with a head drawn from the hint's from-square to its to-square. Part of
the move hint, not a feature beside it: the same switch turns it off, and it is
absent in every case the square marks are. Straight for every move, knights
included: it says *from here to there*, not *along this path*.
_Avoid_: move arrow (the hint is the move; this is one of its marks), line (that
means a taught sequence here), pointer

### Modes and screens

**Mode**:
One of the things the player can be doing inside the 3D game. Play (ordinary
chess against the Easy opponent or another person) and Explain exist now. Adopt
and Drill come later. Adopt is an act rather than a place, so only some modes are
tabs.
_Avoid_: screen (that is one view), tab (that is the control), section

**Goal screen**:
The first screen of a line: the position its last move reaches, the squares where
the pieces that moved end up marked in gold, one line of goal at the top, and Go
(German Los) to start from the beginning. The same for a starter line and for one
the player added.
_Avoid_: preview (the code's phase name, not the player's), intro, target

**Text card**:
The card between two moves that holds the move text until the player taps Next
(German Weiter). The other side replies only after it. No timer.
_Avoid_: card (that is a Drill position), popup, tooltip, subtitle

**Explain**:
The mode that walks a line with a sentence per move: the player makes the own
moves, the game plays the opponent moves, and each move shows its text.
_Avoid_: Explore (the earlier, list-only mode it replaced), tutorial, lesson

**Adopt**:
The act of taking a line into the repertoire. The only way anything enters it.
_Avoid_: save, add, favourite

**Drill**:
The mode that asks the player for the own moves of adopted lines from memory,
scheduling cards by due day.
_Avoid_: quiz, test, practice (that is the tab)

**Tab**:
One of the destinations on the list screen: Openings, Mine, Practise. They name
where the player is, not what they are doing, so they are absent while a line is
being walked. A tab that cannot be used yet is greyed and carries the condition
that opens it: a path, not a promised reward.
_Avoid_: menu, nav, mode (a tab is the control, not the thing)

### Progress

**Repertoire**:
The lines the player has adopted, and what the Mine tab shows. Their data, in
their browser, keyed by position. Adopting is the only way anything enters it.
Progress starts fresh in chess-3d; nothing is imported from the earlier app.
_Avoid_: my openings, collection, favourites, saved lines

**Card**:
One position the player answers, with the ladder level and due day for it.
Shared between every line that passes through that position, so practising it
once counts everywhere.
_Avoid_: item, entry, position (that is the chess term), node

**Dormant card**:
A card no adopted line points at any more. Drill never schedules it, and it
keeps its level and due day: removing a line must not cost progress. It wakes
if the line is adopted again.
_Avoid_: orphaned, deleted, archived, stale

**Best level**:
The highest ladder level a card has ever reached, kept beside its current one. A
miss lowers what Drill schedules; it never lowers this. What the meter reads, so
the meter can only rise.
_Avoid_: high score, record, peak (all sound like a game), max level

### The game itself

**Rules engine**:
`src/rules.js`, the project's own legality, notation and position code. The one
engine for ordinary play, the trainer and the opening parser. There is no second
engine.
_Avoid_: chess.js (not used here), validator

**Gimbal**:
The group that holds everything on the board, rotated on three axes so the
whole board can be tilted and turned as one. The camera orbits outside it.
_Avoid_: pivot, rig, board group

**View preset**:
A named camera and gimbal arrangement that can be picked in one step, such as a
side-on or top-down view.
_Avoid_: camera mode, angle, layout

**Symbols**:
A switch (German "Symbole") over every view and theme, not a view of its own: every
piece is drawn as a flat chess diagram symbol, as in chess books, lying on its
square, on a plain board with flat square colours from the current theme. The
view and the camera stay where they are. No battle scenes (in Pixelwelt the
captured symbol fades out). The symbols are drawn as paths in code, not text
characters. They turn with the camera, so they always read upright for the viewer.
_Avoid_: symbol view, glyph view, icon view, 2D mode

**Quality tier**:
A named level of rendering detail (for example low) trading looks for speed on
weaker devices.
_Avoid_: graphics setting, resolution, LOD

### Pixelwelt look

**Sky**:
The mood of the heaven over the Pixelwelt island: Evening, Night, Sunrise (the default), Storm or Snow. A sky sets the gradient behind the island, the sun or moon and stars, the weather and the colour multiplier of the unlit world. It never changes by itself.
_Avoid_: weather (that is only the rain and snow part), light variant (the old name of two skies), time of day, Automatic

**Backdrop**:
What stands far below the island: Islands (the default), Castle (a village with a castle), or None. Independent of the Sky; the island and the board are not changed by it.
_Avoid_: background (the screen gradient is the sky's), scenery, landscape

**Set**:
A named pair of one Sky and one Backdrop, Sturmburg (Storm and Castle), Inselmorgen (Sunrise and Islands, the default for new players) or Winterdorf (Snow and Castle). Shown as the Sets row in Options (German label "Welt"); the Sky and Backdrop rows adjust one half.
_Avoid_: theme (a theme is the whole look: board, pieces, light), preset, scene

### The interface

**Signature move**:
The short show a piece puts on by itself when nobody moves (a pawn looks around, a knight rears, a queen waves). Only in the themes with figures that have parts (Blocks and Pixelwelt), one piece at a time, a few seconds long, switched by "Living pieces". Not a chess move and not a capture scene.
_Avoid_: animation (too wide), idle animation (that one runs all the time), emote, taunt

**Panel**:
The one column on the right of a desktop or tablet screen that holds everything the
player operates: the header, the tabs Play, Learn and Settings, and their content.
Phones have no panel; they have the thumb bar and the Menu sheet.
_Avoid_: sidebar, HUD (the HUD is everything drawn over the board, panel included), column, card

**Place** (menu A preview, `?menu=a`):
One of the three equal destinations of the menu: Play, Learn, Options. On desktop a tab of the panel, on a phone a sheet opened from the thumb bar. The View button opens a small fourth sheet with all views.
_Avoid_: section, screen, menu page

**Version line**:
The small line at the bottom of Options that names the version the player runs, for
example v1.6.0. A preview build adds its commit. It is also shown briefly while the game
loads. Tapping it opens the News.
_Avoid_: build number, about, footer

**News** (German Neuigkeiten):
The window that lists what each version brought, newest first, in a few short points per
version in German and English, with a link to the full release notes. It opens by itself
once after an update that adds features (a new first or second number), never on a first
visit and never for a fix only release.
_Avoid_: changelog, release notes (the developer text it links to), what's new popup

**Rail**:
The panel folded to a 60 px strip of icons, so the board gets the screen. Opened by
the fold button or the H key, remembered per browser.
_Avoid_: collapsed panel, minimised, drawer

**View bar**:
The small floating bar over the board with the view picker, Flip, Spin, Reset and the
lock. It fades when nothing moves and wakes on any input.
_Avoid_: toolbar, camera bar, view buttons
