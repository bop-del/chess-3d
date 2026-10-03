// The music block of the settings: a Music switch and four sliders (Volume, Klang, Tempo, Raum), mounted in the Scene card on
// desktop and in the Menu sheet on phones through ui.mountSettings, right below the Mute switch. Values live in music.settings
// (stored per device by src/music/player.js).
import { translateTree, addDE } from '../i18n.js';
import { TEMPO_MIN, TEMPO_MAX } from './player.js';

addDE({
  'music.on': 'Hintergrundmusik',
  'music.volume': 'Lautstärke',
  'music.klang': 'Klang',
  'music.klangHint': 'hell bis warm',
  'music.tempo': 'Tempo',
  'music.room': 'Raum',
});

// id, English label, key in music.settings, slider min and max, step, output text
const SLIDERS = [
  ['volume', 'Volume', 'vol', 0, 100, 1, (v) => `${v}%`],
  ['klang', 'Tone', 'klang', 0, 100, 1, (v) => `${v}%`],
  ['tempo', 'Tempo', 'tempo', Math.round(TEMPO_MIN * 100), Math.round(TEMPO_MAX * 100), 1, (v) => `${(v / 100).toFixed(2)}x`],
  ['room', 'Room', 'raum', 0, 100, 1, (v) => `${v}%`],
];

export function mountMusicSettings(ui, music) {
  const el = document.createElement('div');
  el.className = 'music-settings';
  const sw = document.createElement('label');
  sw.className = 'switch';
  sw.innerHTML = '<input type="checkbox" data-music-on><span class="track"><i></i></span><em data-i18n="music.on">Background music</em>';
  el.append(sw);
  const rows = {};
  for (const [id, label, key, min, max, step, show] of SLIDERS) {
    const row = document.createElement('div');
    row.className = 'mrow';
    row.innerHTML = `<label for="music-${id}" data-i18n="music.${id}">${label}</label><input type="range" id="music-${id}" data-music="${key}" min="${min}" max="${max}" step="${step}"><output></output>`;
    if (id === 'klang') { row.dataset.i18nTitle = 'music.klangHint'; row.title = 'bright to warm'; }
    el.append(row);
    rows[key] = { input: row.querySelector('input'), out: row.querySelector('output'), show, row };
    row.querySelector('input').addEventListener('input', (e) => {
      const v = Number(e.target.value);
      music.set({ [key]: key === 'klang' ? 1 - v / 100 : v / 100 });   // the Klang slider runs bright (left) to warm (right)
    });
    row.querySelector('input').addEventListener('keydown', (e) => e.stopPropagation());
  }
  const box = sw.querySelector('input');
  box.addEventListener('change', () => music.set({ on: box.checked }));
  const sync = () => {
    const s = music.settings;
    box.checked = s.on;
    el.classList.toggle('off', !s.on);
    for (const [key, r] of Object.entries(rows)) {
      const v = Math.round((key === 'klang' ? 1 - s[key] : s[key]) * 100);
      if (document.activeElement !== r.input || r.input.value !== String(v)) r.input.value = v;
      r.out.textContent = r.show(v);
      r.input.disabled = !s.on;
    }
  };
  music.onChange(sync);
  sync();
  ui.mountSettings('music', el);
  translateTree(el);
  return el;
}
