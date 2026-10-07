// Agent identity (CHE-104): bin/lane agent prepends the private agents/builder.md to every agent prompt (builder, merge and
// land agents all start there). No file, no change, so the public repo works alone. The brief picks the mode with a line
// `Mode: builder` or `Mode: engineer`; a brief without one is builder. Pure apart from reading the two files.
import { existsSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import { createHash } from 'node:crypto';

export const IDENTITY_FILE = join(process.env.HOME || '', 'code', 'chess-3d-private', 'agents', 'builder.md');

export function briefMode(briefText) {
  const m = /^mode:\s*(builder|engineer)\b/im.exec(String(briefText || ''));
  return m ? m[1].toLowerCase() : 'builder';
}

// identity: the file's text or null; returns the prompt to send
export function withIdentity(prompt, identity, briefText) {
  if (!identity || !identity.trim()) return prompt;
  return `${identity.trim()}\n\nMode for this brief: ${briefMode(briefText)}.\n\n${prompt}`;
}

export function agentPrompt(prompt, briefFile, identityFile = IDENTITY_FILE) {
  const identity = existsSync(identityFile) ? readFileSync(identityFile, 'utf8') : null;
  const brief = existsSync(briefFile) ? readFileSync(briefFile, 'utf8') : '';
  return withIdentity(prompt, identity, brief);
}

// CHE-318: Herdr caps agent ids at 32 characters. The id is `<lane part>-<role>`: the role stays whole, a long branch is cut on a
// hyphen boundary and gets a 4 character hash of the whole branch, so two long branches with the same start never collide.
// An id that fits is exactly `${branch}-${role}`.
export const MAX_AGENT_ID = 32, MAX_ROLE = 20;
export function agentId(branch, role) {
  const full = `${branch}-${role}`;
  if (full.length <= MAX_AGENT_ID) return full;
  const hash = createHash('sha1').update(branch).digest('hex').slice(0, 4);
  const room = MAX_AGENT_ID - role.length - 1 - 5;   // `-<hash>` and the hyphen before the role
  const words = branch.split('-');
  let part = '';
  for (const w of words) { const next = part ? `${part}-${w}` : w; if (next.length > room) break; part = next; }
  if (!part) part = branch.slice(0, Math.max(1, room));   // first word alone is too long
  return `${part}-${hash}-${role}`;
}
