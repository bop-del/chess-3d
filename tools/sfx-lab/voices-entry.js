// Runs in headless Chrome (test/sfx-voices.mjs): renders every voice of the game through the real bus chain and measures it.
import { sfx } from '../../src/battle/sfx.js';
import { renderVoice } from './core.js';
import { measure } from './measure.js';

window.runVoices = async () => {
  const rows = [];
  for (const name of sfx.names) rows.push({ name, ...measure(await renderVoice(sfx.voices[name])) });
  return rows;
};
window.__voicesReady = true;
