// The Context line (CHE-407, CONTEXT.md): one line that says what runs on the board and who moves, with names. Pure: no DOM,
// no i18n import. `t(key, fallback, vars)` is passed in, so a test can run it with a plain table. The desktop header and the
// phone pill both show the text this module builds, so they cannot disagree.
//
// contextParts(c, t) gives the parts in reading order, each { id, text }. contextText(parts, fits) joins them with a middle
// dot and drops parts while `fits(text)` says the line is too long, in DROP order: the waiting time first, then the detail
// (Check, the end reason), then the level in brackets, then a lesson's name. What still does not fit is cut by CSS with an ellipsis.

export const SEP = ' · ';
export const DROP = ['since', 'detail', 'level', 'name'];

const lowerNo = (s) => String(s || '').replace(/\s*~?\d+$/, '').trim();   // "Easy ~900" -> "Easy"

/**
 * c: {
 *   mode: 'play' | 'online' | 'puzzle' | 'drill' | 'opening' | 'review',
 *   turn: 'w' | 'b', check, thinking, over: { reason, winner } | null,
 *   vsComputer, computerColor, level (label, rating allowed),
 *   online: { opponent, color, since } (mode online; since is the ready text of the waiting time or ''),
 *   puzzle: { no, daily, own } (mode puzzle), name (mode drill, opening: the line's name)
 * }
 */
export function contextParts(c, t) {
  const side = (s) => (s === 'w' ? t('side.white', 'White') : t('side.black', 'Black'));
  const parts = [];
  const add = (id, text) => { if (text) parts.push({ id, text }); };
  const over = c.over;
  const w = over && over.winner;
  const timeLoss = over && over.reason === 'time' && w;
  const outside = over && w && (over.reason === 'resign' || over.reason === 'stale');   // an online game: resigned, or ended after 3 days without a move

  // 1. what runs
  if (c.mode === 'online') add('kind', t('ctx.online', 'Online vs {name}', { name: c.online.opponent }));
  else if (c.mode === 'puzzle') add('kind', c.puzzle?.daily ? t('ctx.daily', 'Daily puzzle') : c.puzzle?.no ? t('ctx.puzzle', 'Puzzle {n}', { n: c.puzzle.no }) : t('panel.kind.puzzles', 'Puzzle'));
  else if (c.mode === 'drill') add('kind', t('panel.kind.drill', 'Drill'));
  else if (c.mode === 'opening') add('kind', t('panel.kind.openings', 'Opening'));
  else if (c.mode === 'review') add('kind', t('review.title', 'Game review'));
  else if (c.vsComputer) {
    add('kind', c.level ? t('ctx.computerLevel', 'Vs computer ({level})', { level: lowerNo(c.level) }) : t('ctx.computer', 'Vs computer'));
    if (c.level) parts[0].short = t('ctx.computer', 'Vs computer');   // the level goes before the mover does
  }
  else add('kind', t('ctx.twoPlayers', 'Two players'));
  if (c.mode === 'drill' || c.mode === 'opening') add('name', c.name);

  // 2. who moves (or how it ended)
  if (c.mode === 'review') { /* the review owns the board: no side to move */ }
  else if (over) {
    add('turn', over.reason === 'checkmate' ? t('turn.checkmate', 'Checkmate. {side} wins', { side: side(w) })
      : timeLoss ? t('turn.timeout', 'Time out. {side} wins', { side: side(w) })
      : outside ? t('banner.wins', '{side} wins', { side: side(w) })
      : t('turn.draw', 'Draw'));
    add('detail', outside ? t(`reason.${over.reason}`, over.reason === 'resign' ? 'Resigned' : 'No move for 3 days')
      : over.reason === 'checkmate' || timeLoss ? ''
      : over.reason === 'time' ? t('reason.timeDraw', 'Time out, draw: the opponent has only a king')
      : t(`reason.${over.reason}`, over.reason));
  } else {
    if (c.mode === 'online') {
      const o = c.online;
      add('turn', c.turn === o.color ? t('ctx.youSide', 'Your move ({side})', { side: side(o.color) }) : t('ctx.theirMove', '{name} to move', { name: o.opponent }));
      add('since', o.since);
    } else if (c.mode === 'puzzle' && c.puzzle?.own === c.turn) {
      add('turn', t('ctx.youSide', 'Your move ({side})', { side: side(c.turn) }));
    } else if (c.vsComputer && !c.mode.match(/^(puzzle|drill|opening)$/)) {
      add('turn', c.thinking ? t('turn.thinking', 'Computer is thinking') : c.turn === c.computerColor ? t('ctx.computerMove', 'Computer to move') : t('ctx.you', 'Your move'));
    } else {
      add('turn', c.turn === 'w' ? t('turn.white', 'White to move') : t('turn.black', 'Black to move'));
    }
    if (c.check) add('detail', t('turn.check', 'Check'));
  }
  return parts;
}

/** the parts as one string; drops parts in DROP order until fits(text) is true (no fits: nothing dropped) */
export function contextText(parts, fits) {
  let list = parts;
  const join = () => list.map((p) => p.text).join(SEP);
  let text = join();
  if (!fits) return text;
  for (const id of DROP) {
    if (fits(text)) break;
    list = id === 'level' ? list.map((p) => (p.short ? { ...p, text: p.short } : p)) : list.filter((p) => p.id !== id);
    text = join();
  }
  return text;
}
