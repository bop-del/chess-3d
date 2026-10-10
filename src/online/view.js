// The Online tab view (CHE-421, the "Postkarten" look): a slim people strip, then what needs you (challenges, results), every running game as
// a postcard with the board and the last move in words, the address book of everyone without a game, the own numbers as one line.
// Pure html from the `ctx` of index.js viewCtx(); every button is a data-a action of index.js onClick, the "more" menu is local state.
import { Chess, nameSq } from '../rules.js';

let moreId = 0;   // the game whose "more" menu (Resign) is open
export const toggleMore = (id) => { moreId = moreId === id ? 0 : id; };

// ---- the position of a game as a mini board and the last move in words
const PIECE_EN = { p: 'a pawn', n: 'a knight', b: 'a bishop', r: 'a rook', q: 'the queen', k: 'the king' };
const GLYPH = { k: '♚', q: '♛', r: '♜', b: '♝', n: '♞', p: '♟' };
/** replays the uci moves: { board: 64 pieces, last: { piece, from, to } | null } */
export function replay(g) {
  const ch = new Chess();
  let last = null;
  try {
    for (const m of g.moves || []) {
      const from = nameSq(m.slice(0, 2)), to = nameSq(m.slice(2, 4));
      const piece = (ch.board[from] || 'p').toLowerCase();
      if (!ch.play({ from, to, promo: m[4] || null })) break;
      last = { piece, to: m.slice(2, 4), from: m.slice(0, 2) };
    }
  } catch (e) { /* a position that does not replay shows what it reached */ }
  return { board: ch.board, last };
}
export const lastMoveText = (c, g) => {
  const { last } = replay(g);
  if (!last) return c.t('online.noMove', 'No move yet');
  if (g.turn !== g.color) return c.t(`online.movedYou.${last.piece}`, `You moved ${PIECE_EN[last.piece]} to {sq}`, { sq: last.to });
  return c.t(`online.moved.${last.piece}`, `{name} moved ${PIECE_EN[last.piece]} to {sq}`, { name: g.opponent, sq: last.to });
};
/** a flat 8 by 8 board with the piece glyphs of the avatars (white light, black dark), seen from your side; `size` in px */
export function miniBoard(g, size = 112) {
  const { board, last } = replay(g);
  const flip = g.color === 'b', cell = 10;
  let out = '';
  for (let r = 0; r < 8; r++) for (let f = 0; f < 8; f++) {
    const file = flip ? 7 - f : f, rank = flip ? r : 7 - r, sq = rank * 8 + file;
    const light = (file + rank) % 2 === 1, name = 'abcdefgh'[file] + (rank + 1);
    const hl = last && (last.to === name || last.from === name);
    out += `<rect x="${f * cell}" y="${r * cell}" width="${cell}" height="${cell}" fill="${hl ? '#f0c24b' : light ? '#e8d9b5' : '#a67c52'}"/>`;
    const pc = board[sq];
    if (pc) {
      const white = pc === pc.toUpperCase();
      out += `<text x="${f * cell + cell / 2}" y="${r * cell + 8.4}" font-size="9.4" text-anchor="middle" fill="${white ? '#fffdf6' : '#241f2e'}" stroke="${white ? '#3b2d1c' : '#fffdf6'}" stroke-width="0.5" paint-order="stroke">${GLYPH[pc.toLowerCase()]}&#xFE0E;</text>`;
    }
  }
  return `<svg class="omini" viewBox="0 0 80 80" width="${size}" height="${size}" role="img" aria-label="${g.opponent}">${out}</svg>`;
}

// ---- small pieces
const chatIcon = (c, p, n) => `<button class="ochatic ochatbtn" type="button" data-a="chat" data-n="${c.esc(p.name)}" aria-label="${c.esc(c.t('online.chatWith', 'Chat with {name}', { name: p.name }) + (n ? ` (${n})` : ''))}"><svg viewBox="0 0 24 24" width="22" height="22" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linejoin="round" aria-hidden="true"><path d="M4 5h16v11H10l-5 4v-4H4Z"/></svg>${n ? `<b class="ocnt">${n}</b>` : ''}</button>`;
const presence = (c, p) => (p.online ? c.t('online.online', 'online') : c.t('online.offline', 'away'));
const dot = (p) => `<i class="pres${p.online ? ' on' : ''}"></i>`;
const moreMenu = (c, g) => `<span class="omorew"><button class="omore" type="button" data-a="look-more" data-id="${g.id}" aria-expanded="${moreId === g.id}" aria-label="${c.esc(c.t('online.more', 'More'))}">···</button>${moreId === g.id ? `<button class="obtn small faint" type="button" data-a="resign" data-id="${g.id}">${c.esc(c.t('online.resign', 'Resign'))}</button>` : ''}</span>`;
const extras = (c, e) => `${e.confirm ? `<div class="oconfirm"><p>${c.esc(c.t('online.resignAsk', 'Really resign the game?'))}</p><div class="orow"><button class="obtn gold" type="button" data-a="resign-yes" data-id="${e.g.id}">${c.esc(c.t('online.yes', 'Yes'))}</button><button class="obtn" type="button" data-a="resign-no">${c.esc(c.t('online.cancel', 'Cancel'))}</button></div></div>` : ''}
  ${e.canFinish ? `<p class="ohint">${c.esc(c.t('online.finishHint', '{name} has not moved for 3 days. Ending counts as a win for you.', { name: e.p.name }))}</p><div class="orow"><button class="obtn gold" type="button" data-a="finish" data-id="${e.g.id}">${c.esc(c.t('online.finish', 'End the game'))}</button></div>` : ''}`;

// ---- the blocks
const strip = (c) => (c.people.length ? `<nav class="estrip" aria-label="${c.esc(c.t('online.players', 'Players'))}">${c.people.map((e) => `<button class="ehead${e.p.online ? '' : ' away'}" type="button" data-a="stats" data-n="${c.esc(e.p.name)}" aria-label="${c.esc(`${e.p.name}, ${presence(c, e.p)}`)}"><span class="oav">${c.avatarOf(e.p.name)}${dot(e.p)}${e.n ? `<b class="ocnt">${e.n}</b>` : ''}</span><small>${c.esc(e.p.name)}</small></button>`).join('')}</nav>` : '');

const incoming = (c) => c.incoming.map((ch) => `<section class="ein ocard"><p class="eh"><span class="oav" data-a="stats" data-n="${c.esc(ch.from)}">${c.avatarOf(ch.from)}</span><b>${c.esc(c.t('online.challengesYou', '{name} challenges you', { name: ch.from }))}</b></p><div class="orow"><button class="obtn gold" type="button" data-a="accept" data-id="${ch.id}">${c.esc(c.t('online.accept', 'Accept'))}</button><button class="obtn" type="button" data-a="decline" data-id="${ch.id}">${c.esc(c.t('online.decline', 'No thanks'))}</button></div></section>`).join('');
const declined = (c) => c.declined.map((d) => `<div class="ocard"><p>${c.esc(c.t('online.declined', '{name} declined', { name: d.to }))}</p><div class="orow"><button class="obtn" type="button" data-a="seen-out" data-id="${d.id}">${c.esc(c.t('online.ok', 'OK'))}</button></div></div>`).join('');
const results = (c) => c.results.map((r) => `<div class="ocard oresult ${r.kind}"><p class="orh"><b>${c.esc(r.text)}</b> · ${c.esc(r.g.opponent)}</p><p class="oscoreline">${c.esc(r.line)}</p><div class="orow"><button class="obtn gold" type="button" data-a="challenge" data-n="${c.esc(r.g.opponent)}" data-gid="${r.g.id}">${c.esc(c.t('online.rematch', 'Play again'))}</button><button class="obtn" type="button" data-a="seen-game" data-id="${r.g.id}">${c.esc(c.t('online.ok', 'OK'))}</button></div></div>`).join('');

const postcard = (c, e, small) => {
  const g = e.g, turn = e.sending ? c.t('online.sending', 'Sending the move...') : e.mine ? c.t('online.yourTurnCard', 'Your move') : c.t('online.theirTurnCard', '{name} to move', { name: e.p.name });
  return `<li class="orc ecard${small ? ' small' : ''}${e.mine ? ' mine' : ''}${e.onBoard ? ' onboard' : ''}" data-id="${g.id}"><span class="estamp oav">${c.avatarOf(e.p.name)}</span>
    <p class="orturn ek"><span class="orwho">${c.esc(turn)}</span> · <span class="orsince">${c.esc(e.since)}</span></p>
    <h5 class="en oname">${c.esc(e.p.name)}</h5><p class="orinfo">${c.esc(c.t('online.youPlay', 'You play {side}', { side: c.sideName(g.color) }))} · ${c.esc(c.t('online.moveNo', 'Move {n}', { n: c.moveNo(g) }))}</p>
    <div class="eb">${miniBoard(g, small ? 72 : 112)}<div><p class="el">${c.esc(lastMoveText(c, g))}</p>${e.limit ? `<p class="orlimit">${c.esc(e.limit)}</p>` : `<p class="erule">${c.esc(c.t('online.rule', 'Up to 3 days per move'))}</p>`}</div></div>
    <button class="obtn gold${small ? '' : ' big'}" type="button" data-a="board" data-id="${g.id}">${c.esc(c.t('online.toGame', 'To the game'))}</button>
    <div class="chx">${chatIcon(c, e.p, e.n)}${moreMenu(c, g)}</div>${extras(c, e)}</li>`;
};
const running = (c) => `<section class="orun"${c.games.length ? '' : ' hidden'}><h4>${c.esc(c.t('online.running', 'Running games'))}</h4><ul class="orunl">${c.games.map((e, i) => postcard(c, e, i > 0)).join('')}</ul></section>`;

const book = (c) => {
  const rows = c.people.filter((e) => !e.g && e.kind !== 'incoming');
  return `<h4>${c.esc(c.t('online.book', 'Address book'))}</h4><ul class="oplayers eab">${rows.length ? rows.map((e) => {
    const p = e.p;
    const act = e.kind === 'asked' ? `<button class="obtn small" type="button" data-a="cancel-out" data-id="${e.mineOut.id}">${c.esc(c.t('online.withdraw', 'Withdraw'))}</button>` : `<button class="obtn small" type="button" data-a="challenge" data-n="${c.esc(p.name)}">${c.esc(c.t('online.challenge', 'Challenge'))}</button>`;
    const bot = p.bot && c.state.me.admin && e.kind === 'challenge' ? `<div class="ostate"><button class="obtn small" type="button" data-a="bot-challenge">${c.esc(c.t('online.botChallenge', 'Bot challenges me'))}</button></div>` : '';
    return `<li class="op opc${e.chatOpen ? ' on' : ''}${e.n ? ' unread' : ''}"><span class="oav" data-a="stats" data-n="${c.esc(p.name)}" role="button" aria-label="${c.esc(c.t('online.st.open', 'Numbers of {name}', { name: p.name }))}">${c.avatarOf(p.name)}${dot(p)}</span>
      <div class="obody" data-a="stats" data-n="${c.esc(p.name)}" role="button"><span class="oname">${c.esc(p.name)}${p.bot ? ` <small class="obot">${c.esc(c.t('online.botTag', 'Bot'))}</small>` : ''}</span><span class="osub"><span class="opres">${c.esc(presence(c, p))}</span> · <span class="oscore">${c.esc(c.scoreLine(p.score))}</span></span>${e.kind === 'asked' ? `<span class="ostate asked" role="status">${c.esc(c.t('online.askedLine', 'Challenged, waiting...'))}</span>` : ''}</div>
      ${chatIcon(c, p, e.n)}${act}${bot}</li>`;
  }).join('') : `<li class="oempty">${c.esc(c.people.length ? c.t('online.bookAllBusy', 'Everyone is in a game or has challenged you.') : c.t('online.noPlayers', 'Nobody else is invited yet.'))}</li>`}</ul>`;
};
const ownLine = (c) => (c.own && !c.own.empty
  ? `<button class="ostat own oline" type="button" data-a="stats" data-n="${c.esc(c.me)}" aria-label="${c.esc(c.t('online.st.own', 'Your numbers'))}"><span class="ostc games"><b>${c.own.games}</b> ${c.esc(c.t('online.st.games', 'Games'))}</span><span class="ostc wins"><b>${c.own.wins}</b> ${c.esc(c.t('online.st.wins', 'Wins'))}</span><span class="ostc streak ${c.own.streak.type || ''}">${c.esc(c.streakText(c.own))}</span><i aria-hidden="true">›</i></button>` : '');

export const renderView = (c) => `${strip(c)}<div class="ochal">${incoming(c)}${declined(c)}</div><div class="ogame">${results(c)}</div>${running(c)}${book(c)}${ownLine(c)}`;
