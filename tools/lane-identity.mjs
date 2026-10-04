// Agent identity (CHE-104): bin/lane agent prepends the private agents/builder.md to every agent prompt (builder, merge and
// land agents all start there). No file, no change, so the public repo works alone. The brief picks the mode with a line
// `Mode: builder` or `Mode: engineer`; a brief without one is builder. Pure apart from reading the two files.
import { existsSync, readFileSync } from 'node:fs';
import { join } from 'node:path';

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
