// The "Pieces" row of Options (CHE-367): Classic, Fantasy, Animals (room for more sets, CHE-368). Shown for the lit themes, hidden with
// Pixelwelt (it keeps its own figures). The pick is stored per browser (chess3d.pieces, default classic); ?pieces= beats it for that visit.
// The set is read once at boot (main.js), so a pick stores and reloads the page.
import { t, onLanguage, addDE, translateTree } from './i18n.js';

export const PIECE_SETS = {
  classic: { en: 'Classic', de: 'Klassisch' },
  fantasy: { en: 'Fantasy', de: 'Fantasy' },
  animals: { en: 'Animals', de: 'Tiere' },
};
const KEY = 'chess3d.pieces';
const readStored = () => { try { return localStorage.getItem(KEY); } catch (e) { return null; } };
const known = (v) => v && Object.hasOwn(PIECE_SETS, v);

/** The set in use: ?pieces= (this visit only) > stored > classic. */
export function pieceChoice() {
  const flag = typeof location === 'undefined' ? null : new URLSearchParams(location.search).get('pieces');
  return [flag, readStored()].find(known) || 'classic';
}

addDE({ 'pieceset.label': 'Figuren', 'pieceset.group': 'Figurensatz wählen' });
for (const [id, n] of Object.entries(PIECE_SETS)) addDE({ [`pieceset.${id}`]: n.de });

export function mountPieceSetting({ themes, ui }) {
  const row = document.createElement('div');
  row.className = 'field themes pieceset';
  row.dataset.pieceset = 'row';
  row.innerHTML = '<span data-i18n="pieceset.label">Pieces</span><div class="chips" role="radiogroup" data-i18n-aria="pieceset.group" aria-label="Piece set"></div>';
  const box = row.querySelector('.chips'), buttons = new Map();
  for (const id of Object.keys(PIECE_SETS)) {
    const b = document.createElement('button');
    b.type = 'button'; b.className = 'chip'; b.dataset.value = id; b.setAttribute('role', 'radio');
    b.addEventListener('click', () => {
      if (id === pieceChoice()) return;
      try { localStorage.setItem(KEY, id); } catch (e) { /* storage blocked */ }
      const u = new URL(location.href);
      u.searchParams.delete('pieces');   // a linked flag would win over the pick
      location.replace(u);
    });
    box.append(b); buttons.set(id, b);
  }
  const names = () => { translateTree(row); for (const [id, b] of buttons) b.textContent = t(`pieceset.${id}`, PIECE_SETS[id].en); };
  const mark = () => { const v = pieceChoice(); for (const [id, b] of buttons) { b.classList.toggle('on', id === v); b.setAttribute('aria-checked', id === v ? 'true' : 'false'); } };
  const show = () => { row.hidden = themes.current() === 'pixel'; mark(); };
  themes.on(show);
  ui.mountSettings('themes', row);
  names();
  onLanguage(names);
  show();
  return row;
}
