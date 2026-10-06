// Runs in headless Chrome (tools/sfx-lab/check.mjs): renders every voice offline and measures it.
import { VOICE_NAMES, IDS, voiceFn, renderVoice } from './core.js';
import { measure } from './measure.js';

window.runCheck = async () => {
  const rows = [];
  for (const name of VOICE_NAMES) {
    let base = null;
    for (const id of IDS) {
      const m = measure(await renderVoice(voiceFn(name, id)));
      if (id === 'heute') base = m;
      rows.push({ name, id, ...m, base: id === 'heute' ? null : { claimed: base.lenClaimed, audible: base.lenAudible } });
    }
  }
  return rows;
};
window.__checkReady = true;
