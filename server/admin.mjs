// Admin commands of online play (CHE-271, owner decision 5). Works on the database file directly; the running server sees the change
// on the next request (a revoked or deleted player's live stream closes at the next heartbeat).
//   node server/admin.mjs invite <name>         a new player: prints the link and the code
//   node server/admin.mjs invite <name> --new   a fresh link and code, the old ones stop working
//   node server/admin.mjs revoke <name>         cannot log in any more, games and score stay
//   node server/admin.mjs delete <name>         all data of the player gone (games, chat)
//   node server/admin.mjs chat <name>           prints all of that player's conversations
//   node server/admin.mjs mute <name> | unmute <name>   cannot write chat messages, or can again
//   node server/admin.mjs list                  the players
// Env: ONLINE_DB (default .tmp/online/online.db), ONLINE_GAME_URL (the game page, default http://localhost:5173/), ONLINE_PUBLIC_URL
// (this server as the browser reaches it, default http://localhost:<ONLINE_PORT>), ONLINE_ENV (a KEY=VALUE file outside the repo).
import { openDb, adminOps } from './db.mjs';
import { loadEnv } from './index.mjs';

/** The invite link: the game page with ?online=<server>&open=online and the key in the fragment (never sent to any server). */
export function inviteLink({ game, server, key }) {
  const u = new URL(game);
  u.searchParams.set('online', server);
  u.searchParams.set('open', 'online');
  u.hash = `online=${key}`;
  return u.toString();
}

export function runAdmin(argv, { env = loadEnv(), out = console.log } = {}) {
  const [cmd, name, ...rest] = argv;
  const db = openDb(env.db);
  try {
    const ops = adminOps(db);
    const game = process.env.ONLINE_GAME_URL || 'http://localhost:5173/';
    const server = process.env.ONLINE_PUBLIC_URL || `http://localhost:${env.port}`;
    switch (cmd) {
      case 'invite': {
        const r = ops.invite(name, { fresh: rest.includes('--new') });
        out(`${r.name}\n  link: ${inviteLink({ game, server, key: r.key })}\n  code: ${r.code}`);
        return r;
      }
      case 'revoke': out(`${ops.revoke(name)} revoked`); return true;
      case 'delete': out(`${ops.delete(name)} deleted`); return true;
      case 'mute': out(`${ops.mute(name, true)} muted`); return true;
      case 'unmute': out(`${ops.mute(name, false)} unmuted`); return true;
      case 'chat': {
        const all = ops.chat(name);
        if (!all.length) out('no messages');
        for (const c of all) {
          out(`with ${c.with}:`);
          for (const m of c.messages) out(`  ${new Date(m.at).toISOString().slice(0, 16).replace('T', ' ')} ${m.from}: ${m.text}`);
        }
        return all;
      }
      case 'list': for (const p of ops.list()) out(`${p.name}${p.revoked ? ' (revoked)' : ''}${p.muted ? ' (muted)' : ''}`); return true;
      default:
        out('usage: node server/admin.mjs invite <name> [--new] | revoke <name> | delete <name> | chat <name> | mute <name> | unmute <name> | list');
        return false;
    }
  } finally { db.close(); }
}

if (import.meta.url === `file://${process.argv[1]}`) {
  try { process.exitCode = runAdmin(process.argv.slice(2)) === false ? 2 : 0; } catch (e) { console.error(e.message); process.exitCode = 1; }
}
