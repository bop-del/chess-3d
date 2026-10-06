// The text behind "Details kopieren" of the connection box (CHE-271, decision 13): the cause, the request, HTTP status, error
// message, server host, app version and time. It never contains the invite key, a code or chat text: the caller passes only these
// fields, and redact() blanks anything that looks like a key or a code anyway (an error message could quote one).
const CODE_RE = /\b[A-Z]{1,12}-?[A-HJ-NP-Z2-9]{4}\b/g;
const KEY_RE = /[A-Za-z0-9_-]{32,}/g;

export function redact(s, secrets = []) {
  let out = String(s ?? '');
  for (const x of secrets) if (x && String(x).length >= 4) out = out.split(String(x)).join('[hidden]');
  return out.replace(KEY_RE, '[hidden]').replace(CODE_RE, '[hidden]');
}

/** info: { cause, lastOk (ms or null), request, status, error, host, version, time (ms) }; secrets: the key and any code to blank */
export function detailsText(info = {}, secrets = []) {
  const ts = (ms) => (ms ? new Date(ms).toISOString() : '-');
  const lines = [
    `cause: ${info.cause || '-'}`,
    `last connected: ${ts(info.lastOk)}`,
    `request: ${info.request || '-'}`,
    `http status: ${info.status ?? '-'}`,
    `error: ${info.error || '-'}`,
    `server host: ${info.host || '-'}`,
    `app version: ${info.version || '-'}`,
    `time: ${ts(info.time)}`,
  ];
  return lines.map((l) => redact(l, secrets)).join('\n');
}
