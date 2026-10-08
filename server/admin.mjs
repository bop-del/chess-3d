// Admin commands of online play (CHE-271, owner decision 5). Works on the database file directly; the running server sees the change
// on the next request (a revoked or deleted player's live stream closes at the next heartbeat).
//   node server/admin.mjs invite <name>         a new player: prints the link and the code
//   node server/admin.mjs invite <name> --new   a fresh link and code, the old ones stop working
//   node server/admin.mjs revoke <name>         cannot log in any more, games and score stay
//   node server/admin.mjs delete <name>         all data of the player gone (games, chat)
//   node server/admin.mjs chat <name>           prints all of that player's conversations
//   node server/admin.mjs mute <name> | unmute <name>   cannot write chat messages, or can again
//   node server/admin.mjs admin <name> | unadmin <name>   may make the bot challenge them (the bot itself runs with ONLINE_BOT=1)
//   node server/admin.mjs push-keys             creates the VAPID key pair once into ONLINE_VAPID_FILE (mode 600, never overwritten)
//   node server/admin.mjs list                  the players
// Env: ONLINE_DB (default .tmp/online/online.db), ONLINE_GAME_URL (the game page, default http://localhost:5173/), ONLINE_PUBLIC_URL
// (this server as the browser reaches it, default http://localhost:<ONLINE_PORT>), ONLINE_ENV (a KEY=VALUE file outside the repo).
// Push (CHE-272): ONLINE_VAPID_FILE (the key file), ONLINE_VAPID_SUBJECT (mailto:), ONLINE_GAME_URL (also read by the server).
import { openDb, adminOps } from './db.mjs';
import { vapidCreateFile } from './push.mjs';
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
  if (cmd === 'push-keys') {   // CHE-272: before the database is opened, it needs none
    const file = process.env.ONLINE_VAPID_FILE;
    if (!file) throw new Error('set ONLINE_VAPID_FILE to the path of the key file (outside the repo)');
    const k = vapidCreateFile(file);
    out(`VAPID key pair written to ${file} (mode 600). Back it up: losing it invalidates every subscription.\npublic key: ${k.public}`);
    return true;
  }
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
      case 'admin': out(`${ops.setAdmin(name, true)} is an admin`); return true;
      case 'unadmin': out(`${ops.setAdmin(name, false)} is no admin`); return true;
      case 'list': for (const p of ops.list()) out(`${p.name}${p.revoked ? ' (revoked)' : ''}${p.muted ? ' (muted)' : ''}${p.admin ? ' (admin)' : ''}${p.bot ? ' (bot)' : ''}`); return true;
      default:
        out('usage: node server/admin.mjs invite <name> [--new] | push-keys | revoke <name> | delete <name> | chat <name> | mute <name> | unmute <name> | admin <name> | unadmin <name> | list');
        return false;
    }
  } finally { db.close(); }
}

if (import.meta.url === `file://${process.argv[1]}`) {
  try { process.exitCode = runAdmin(process.argv.slice(2)) === false ? 2 : 0; } catch (e) { console.error(e.message); process.exitCode = 1; }
}
