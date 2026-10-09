// Feedback (CHE-404): bugs and wishes a visitor sends from the game. POST /feedback needs no login (anyone can send); a name is
// optional, a logged in player is named from the key. Limits: 5 per hour per device (a random id the client keeps) and 20 per hour
// per IP behind it, 2000 characters of text, a board picture (a small JPEG as base64) up to PICTURE_MAX, a context object up to
// CONTEXT_MAX. Reading is admin only: GET /feedback?since=<id> with the admin secret as Bearer (see server/index.mjs).
export const KINDS = ['bug', 'wish'];
export const TEXT_MAX = 2000;
export const NAME_MAX = 40;
export const PICTURE_MAX = 150 * 1024;   // base64 characters of the JPEG
export const CONTEXT_MAX = 6000;         // JSON characters
export const PER_DEVICE = 5, PER_IP = 20, WINDOW_MS = 3600e3;
export const BODY_MAX = PICTURE_MAX + CONTEXT_MAX + TEXT_MAX + 2048;

const JPEG_B64 = /^[A-Za-z0-9+/]+={0,2}$/;
const cut = (s, n) => String(s ?? '').replace(/[\u0000-\u0008\u000b\u000c\u000e-\u001f]/g, '').slice(0, n);

/** Validate a body. Returns { row } or { status, error }. */
export function cleanFeedback(body) {
  if (!body || typeof body !== 'object' || Array.isArray(body)) return { status: 400, error: 'bad-body' };
  if (!KINDS.includes(body.kind)) return { status: 400, error: 'bad-kind' };
  const text = cut(body.text, TEXT_MAX + 1).trim();
  if (!text) return { status: 400, error: 'empty-text' };
  if (text.length > TEXT_MAX) return { status: 400, error: 'text-too-long' };
  let picture = null;
  if (body.picture != null && body.picture !== '') {
    if (typeof body.picture !== 'string' || !JPEG_B64.test(body.picture) || !body.picture.startsWith('/9j/')) return { status: 400, error: 'bad-picture' };   // /9j/ = the JPEG start bytes
    if (body.picture.length > PICTURE_MAX) return { status: 413, error: 'picture-too-large' };
    picture = body.picture;
  }
  let context = null;
  if (body.context != null) {
    if (typeof body.context !== 'object' || Array.isArray(body.context)) return { status: 400, error: 'bad-context' };
    context = JSON.stringify(body.context);
    if (context.length > CONTEXT_MAX) return { status: 413, error: 'context-too-large' };
  }
  const name = cut(body.name, NAME_MAX).trim();
  return { row: { kind: body.kind, text, name, picture, context } };
}

export function createFeedback(db, { now = () => Date.now() } = {}) {
  const q = (sql) => db.prepare(sql);
  const hits = new Map();
  /** count one send for a device id and an IP; true when either is over its limit (then nothing is counted) */
  function limited(device, ip) {
    const t = now(), keep = (k) => (hits.get(k) || []).filter((x) => t - x < WINDOW_MS);
    const d = keep(`d:${device}`), i = keep(`i:${ip}`);
    hits.set(`d:${device}`, d); hits.set(`i:${ip}`, i);
    if (d.length >= PER_DEVICE || i.length >= PER_IP) return true;
    d.push(t); i.push(t);
    return false;
  }
  function add(row, by) {
    const r = q('INSERT INTO feedback (at, kind, name, player, text, picture, context) VALUES (?, ?, ?, ?, ?, ?, ?)')
      .run(now(), row.kind, by || row.name || '', by || '', row.text, row.picture, row.context);
    return Number(r.lastInsertRowid);
  }
  /** everything after id `since`, oldest first, at most 50 (the pictures are included as base64) */
  function since(id, limit = 50) {
    return q('SELECT id, at, kind, name, player, text, picture, context FROM feedback WHERE id > ? ORDER BY id LIMIT ?').all(Math.max(0, Number(id) || 0), limit)
      .map((r) => ({ id: r.id, at: r.at, kind: r.kind, name: r.name, player: !!r.player, text: r.text, picture: r.picture, context: r.context ? JSON.parse(r.context) : null }));
  }
  return { limited, add, since };
}
