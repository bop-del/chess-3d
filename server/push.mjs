// Web push of online play (CHE-272, ADR 0013): node:crypto only, no dependency. Message encryption is RFC 8291 (aes128gcm, the
// content coding of RFC 8188), the sender identity is VAPID (RFC 8292, an ES256 JWT). Subscriptions live in the table push_subs;
// a 404 or 410 from the push service deletes the row. A player with an open live stream gets no push (the page shows it already).
// A subscription endpoint is a secret: it is never logged in full, only its host.
import { createECDH, createCipheriv, createPrivateKey, createSign, generateKeyPairSync, hkdfSync, randomBytes } from 'node:crypto';
import { existsSync, readFileSync, writeFileSync } from 'node:fs';

const b64u = (buf) => Buffer.from(buf).toString('base64url');
const unb64u = (s) => Buffer.from(String(s), 'base64url');
const RS = 4096;                 // record size of the aes128gcm coding; one record holds the whole (small) payload
export const PAYLOAD_MAX = RS - 103;   // 86 bytes header (salt 16, rs 4, idlen 1, key 65) plus the 1 byte delimiter and the 16 byte tag
export const SUBS_PER_PLAYER = 10;

// ------------------------------------------------------------ RFC 8291 message encryption
/** Encrypt a push payload for one subscription. Returns the request body (header, key id and ciphertext). `ephemeral` and `salt`
 *  are for the RFC test vector only: { privateKey: Buffer(32) } and Buffer(16). */
export function encryptPayload(payload, { p256dh, auth }, { ephemeral, salt = randomBytes(16) } = {}) {
  const uaPublic = unb64u(p256dh), authSecret = unb64u(auth);
  if (uaPublic.length !== 65 || uaPublic[0] !== 4) throw new Error('bad p256dh');
  if (authSecret.length !== 16) throw new Error('bad auth');
  const ecdh = createECDH('prime256v1');
  if (ephemeral) ecdh.setPrivateKey(ephemeral.privateKey); else ecdh.generateKeys();
  const asPublic = ecdh.getPublicKey();
  const secret = ecdh.computeSecret(uaPublic);
  const keyInfo = Buffer.concat([Buffer.from('WebPush: info\0'), uaPublic, asPublic]);
  const ikm = Buffer.from(hkdfSync('sha256', secret, authSecret, keyInfo, 32));
  const cek = Buffer.from(hkdfSync('sha256', ikm, salt, Buffer.from('Content-Encoding: aes128gcm\0'), 16));
  const nonce = Buffer.from(hkdfSync('sha256', ikm, salt, Buffer.from('Content-Encoding: nonce\0'), 12));
  const data = Buffer.isBuffer(payload) ? payload : Buffer.from(payload);
  if (data.length > PAYLOAD_MAX) throw new Error('payload too large');
  const cipher = createCipheriv('aes-128-gcm', cek, nonce);
  const body = Buffer.concat([cipher.update(Buffer.concat([data, Buffer.from([2])])), cipher.final(), cipher.getAuthTag()]);   // 0x02: the last record
  const rs = Buffer.alloc(4); rs.writeUInt32BE(RS);
  return Buffer.concat([salt, rs, Buffer.from([asPublic.length]), asPublic, body]);
}

// ------------------------------------------------------------ VAPID (RFC 8292)
/** A new P-256 key pair as { private, public }, both base64url (the public key is the uncompressed point, 65 bytes). */
export function vapidGenerate() {
  const { privateKey } = generateKeyPairSync('ec', { namedCurve: 'prime256v1' });
  const j = privateKey.export({ format: 'jwk' });
  return { private: j.d, public: b64u(Buffer.concat([Buffer.from([4]), unb64u(j.x), unb64u(j.y)])) };
}

/** Write a new key file (mode 600). Refuses to overwrite: losing the private key invalidates every subscription. */
export function vapidCreateFile(file) {
  if (existsSync(file)) throw new Error(`${file} exists already; not overwritten (a new key would invalidate every subscription)`);
  const k = vapidGenerate();
  writeFileSync(file, JSON.stringify(k) + '\n', { flag: 'wx', mode: 0o600 });
  return k;
}

/** Read a key file, or null when there is none (push is then off). */
export function vapidLoad(file) {
  if (!file || !existsSync(file)) return null;
  const k = JSON.parse(readFileSync(file, 'utf8'));
  if (!k.private || unb64u(k.public).length !== 65) throw new Error(`${file} is not a VAPID key file`);
  return k;
}

const privateKeyOf = (k) => { const pub = unb64u(k.public); return createPrivateKey({ key: { kty: 'EC', crv: 'P-256', d: k.private, x: b64u(pub.subarray(1, 33)), y: b64u(pub.subarray(33, 65)) }, format: 'jwk' }); };

/** The VAPID JWT for one push service: aud is the origin of the endpoint, exp under 24 hours (12 here). */
export function vapidJwt(k, subject, endpoint, nowMs = Date.now()) {
  const head = b64u(JSON.stringify({ typ: 'JWT', alg: 'ES256' }));
  const claims = b64u(JSON.stringify({ aud: new URL(endpoint).origin, exp: Math.floor(nowMs / 1000) + 12 * 3600, sub: subject }));
  const sig = createSign('SHA256').update(`${head}.${claims}`).sign({ key: privateKeyOf(k), dsaEncoding: 'ieee-p1363' });
  return `${head}.${claims}.${b64u(sig)}`;
}

// ------------------------------------------------------------ texts (German, short; a chat text never goes in)
export const PUSH_TEXT = {
  challenge: (from) => ({ title: `${from} fordert dich heraus`, body: 'Tippe, um zu antworten.' }),
  turn: (from) => ({ title: `${from} hat gezogen, du bist dran`, body: 'Tippe, um weiterzuspielen.' }),
  chat: (from) => ({ title: `Neue Nachricht von ${from}`, body: 'Tippe, um sie zu lesen.' }),
  over: (from, line) => ({ title: `Partie gegen ${from} zu Ende`, body: line }),
  accepted: (from) => ({ title: `${from} hat deine Herausforderung angenommen`, body: 'Die Partie wartet.' }),
};
/** the result line for the recipient of a game over push */
export const overLine = (from, won, draw) => (draw ? 'Remis.' : won ? 'Du hast gewonnen.' : `${from} hat gewonnen.`);

const goodEndpoint = (s) => {
  if (typeof s !== 'string' || s.length > 1024) return false;
  try { const u = new URL(s); return u.protocol === 'https:' || (u.protocol === 'http:' && (u.hostname === '127.0.0.1' || u.hostname === 'localhost')); } catch (e) { return false; }
};

/** The push side of the server. With no vapid key it is off (enabled false) and does nothing. */
export function createPush(db, { vapid = null, subject = '', gameUrl = '', now = () => Date.now(), log = () => {}, fetchFn = fetch, timeoutMs = 10000 } = {}) {
  const enabled = !!(vapid && subject);
  const q = (sql) => db.prepare(sql);
  const pending = new Set();
  const hostOf = (e) => { try { return new URL(e).host; } catch (x) { return '?'; } };
  const urlFor = (query) => (gameUrl ? new URL(query, gameUrl).toString() : query);

  async function sendOne(sub, message) {
    const body = encryptPayload(JSON.stringify(message), sub);
    let r;
    try {
      r = await fetchFn(sub.endpoint, {
        method: 'POST', body, signal: AbortSignal.timeout(timeoutMs),
        headers: { 'Content-Encoding': 'aes128gcm', 'Content-Type': 'application/octet-stream', TTL: '86400', Urgency: 'normal',
          Authorization: `vapid t=${vapidJwt(vapid, subject, sub.endpoint, now())}, k=${vapid.public}` },
      });
    } catch (e) { log(`push ${hostOf(sub.endpoint)} failed (${e.name})`); return; }
    if (r.status === 404 || r.status === 410) { q('DELETE FROM push_subs WHERE endpoint = ?').run(sub.endpoint); log(`push ${hostOf(sub.endpoint)} ${r.status}: subscription removed`); }
    else if (!r.ok) log(`push ${hostOf(sub.endpoint)} ${r.status}`);
    try { await r.arrayBuffer(); } catch (e) { /* body is not needed */ }
  }

  return {
    enabled,
    publicKey: () => vapid?.public,
    /** store a subscription for a player (one row per endpoint; the newest owner wins); returns an error code or null */
    subscribe(pid, sub) {
      const ep = sub?.endpoint, p = sub?.keys?.p256dh, a = sub?.keys?.auth;
      if (!goodEndpoint(ep)) return 'bad-endpoint';
      try { if (unb64u(p).length !== 65 || unb64u(p)[0] !== 4 || unb64u(a).length !== 16) return 'bad-keys'; } catch (e) { return 'bad-keys'; }
      q('INSERT OR REPLACE INTO push_subs (player, endpoint, p256dh, auth, created) VALUES (?, ?, ?, ?, ?)').run(pid, ep, p, a, now());
      q('DELETE FROM push_subs WHERE player = ? AND endpoint NOT IN (SELECT endpoint FROM push_subs WHERE player = ? ORDER BY created DESC, rowid DESC LIMIT ?)').run(pid, pid, SUBS_PER_PLAYER);
      return null;
    },
    unsubscribe(pid, endpoint) { q('DELETE FROM push_subs WHERE player = ? AND endpoint = ?').run(pid, String(endpoint)); },
    count: (pid) => q('SELECT COUNT(*) AS n FROM push_subs WHERE player = ?').get(pid).n,
    /** Send one push of a kind to a player: skipped when push is off, the player has no subscription or has a live stream open. */
    notify(pid, kind, { from, line = '', tag, query, data = {}, streamOpen = false }) {
      if (!enabled || streamOpen) return;
      const subs = q('SELECT endpoint, p256dh, auth FROM push_subs WHERE player = ?').all(pid);
      if (!subs.length) return;
      const text = kind === 'over' ? PUSH_TEXT.over(from, line) : PUSH_TEXT[kind](from);
      const message = { kind, ...text, tag, url: urlFor(query), data };
      for (const s of subs) {
        const p = sendOne({ endpoint: s.endpoint, p256dh: s.p256dh, auth: s.auth }, message).catch((e) => log(`push error ${e.message}`)).finally(() => pending.delete(p));
        pending.add(p);
      }
    },
    /** resolves when every started send is done (tests, shutdown) */
    async flush() { while (pending.size) await Promise.all([...pending]); },
  };
}
