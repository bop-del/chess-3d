// The "Captured pieces at the side" switch of the Scene card (desktop) and Menu sheet (phone), mounted through ui.mountSettings
// right below the Battle scenes setting. Stored per device (localStorage chess3d.trays); the URL flag trays=0|1 beats the stored
// value for that page load without overwriting it. The switch drives the game (slabs, fading) and the camera fit.
import { translateTree, addDE } from './i18n.js';

addDE({ 'trays.label': 'Geschlagene Figuren an der Seite' });

const KEY = 'chess3d.trays';
const readStored = () => { try { return localStorage.getItem(KEY) !== '0'; } catch (e) { return true; } };
const writeStored = (on) => { try { localStorage.setItem(KEY, on ? '1' : '0'); } catch (e) { /* storage blocked */ } };

export function mountTraysSetting({ ui, game, controls, flag = null }) {
  const row = document.createElement('label');
  row.className = 'switch';
  row.innerHTML = '<input type="checkbox" data-trays><span class="track"><i></i></span><em data-i18n="trays.label">Captured pieces at the side</em>';
  const box = row.querySelector('input');
  const apply = (on) => { game.setTrays(on); controls.setTrays?.(on); box.checked = on; };
  apply(flag === '0' ? false : flag === '1' ? true : readStored());
  box.addEventListener('change', () => { apply(box.checked); writeStored(box.checked); });
  ui.mountSettings('trays', row);
  translateTree(row);
  return row;
}
