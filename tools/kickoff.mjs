// Kickoff of a lane agent, verified (CHE-241). A prompt sent to a fresh Claude session can be swallowed (the session still booting), and
// the agent then sits idle for ever. sendKickoff sends the prompt, waits up to waitMs for the agent to turn working, resends when it
// did not (at most `resends` times), then gives up with a red line for the lead. Effects are injected (bin/lane passes herdr, the test
// a fake herdr and a fake clock): io.prompt(text), io.status() -> agent_status string, io.sleep(ms), io.now() -> ms.
// Returns { ok, sent, line } where line is the red line when ok is false.
export function sendKickoff({ id, text, io, waitMs = 60000, pollMs = 2000, resends = 3 }) {
  let sent = 0;
  for (let i = 0; i <= resends; i++) {
    io.prompt(text); sent++;
    const until = io.now() + waitMs;
    while (io.now() < until) {
      io.sleep(pollMs);
      if (io.status() === 'working') return { ok: true, sent, line: null };
    }
  }
  return { ok: false, sent, line: `RED: agent ${id} never started working after ${sent} kickoff prompts (${Math.round(waitMs / 1000)} s each): open its tab and check it, or send the brief by hand.` };
}
