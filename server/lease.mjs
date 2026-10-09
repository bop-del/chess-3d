// The writer lease (CHE-406): during a server update two servers run on one database for a moment (the new one answers requests
// while the old one drains). Only the holder of the lease runs the background work (bot, daily roll up, health sampling, web push),
// so nothing happens twice. The lease is one row in the database: an owner id and a heartbeat. The holder renews the heartbeat every
// beatMs; a stopped server deletes its row (the other takes over at its next beat), a crashed one is taken over once the heartbeat
// is older than ttlMs. Both servers answer requests all the time; the lease only gates the writer duties.
import { randomBytes } from 'node:crypto';

export const LEASE_BEAT_MS = 5000;
export const LEASE_TTL_MS = 20000;
// A server from before the lease never writes the row, so a fresh row cannot tell "nobody" from "the old server is still running".
// The first claim therefore waits the length of kamal's drain time: production sets ONLINE_LEASE_GRACE_MS=35000 (config/deploy.yml),
// local runs and tests leave it at 0 so the bot answers at once.
export const LEASE_GRACE_MS = 35000;

export function createLease(db, { id = randomBytes(6).toString('hex'), now = () => Date.now(), beatMs = LEASE_BEAT_MS, ttlMs = LEASE_TTL_MS, graceMs = 0, onAcquire = () => {}, onLose = () => {}, log = () => {} } = {}) {
  const t0 = now();
  let held = false, timer = null, closed = false;
  const q = (sql) => db.prepare(sql);

  /** One try: take the lease when it is free, expired or ours, renew it when ours. Returns whether we hold it. */
  function tick() {
    if (closed) return false;
    let mine = false;
    try {
      db.exec('BEGIN IMMEDIATE');
      try {
        const t = now(), row = q('SELECT owner, beat FROM writer_lease WHERE id = 1').get();
        if (row?.owner === id) { q('UPDATE writer_lease SET beat = ? WHERE id = 1').run(t); mine = true; }
        else if (!row) {
          if (t - t0 >= graceMs) { q('INSERT INTO writer_lease (id, owner, beat, since) VALUES (1, ?, ?, ?)').run(id, t, t); mine = true; }
        } else if (t - row.beat > ttlMs) { q('UPDATE writer_lease SET owner = ?, beat = ?, since = ? WHERE id = 1').run(id, t, t); mine = true; log(`lease: took over from ${row.owner} (silent for ${Math.round((t - row.beat) / 1000)} s)`); }
        db.exec('COMMIT');
      } catch (e) { try { db.exec('ROLLBACK'); } catch (_) { /* none open */ } throw e; }
    } catch (e) { log(`lease: ${e.message}`); mine = held && now() - lastOk <= ttlMs; }   // a busy database: keep the lease only while it cannot have expired
    if (mine) lastOk = now();
    if (mine && !held) { held = true; log(`lease: ${id} is the writer`); onAcquire(); }
    else if (!mine && held) { held = false; log(`lease: ${id} lost the writer role`); onLose(); }
    return held;
  }
  let lastOk = t0;

  return {
    id,
    held: () => held,
    tick,
    /** claim at once (after the grace) and keep renewing */
    start() { tick(); timer = setInterval(tick, beatMs); timer.unref?.(); },
    /** a graceful stop gives the lease back, so the other server takes over at its next beat */
    close() {
      closed = true; clearInterval(timer);
      try { q('DELETE FROM writer_lease WHERE id = 1 AND owner = ?').run(id); } catch (e) { /* the database is gone */ }
      if (held) { held = false; onLose(); }
    },
    owner: () => q('SELECT owner, beat, since FROM writer_lease WHERE id = 1').get() || null,
  };
}
