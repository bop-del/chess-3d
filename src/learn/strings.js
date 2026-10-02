// German texts for the Learn UI (the Learn button, the sheet and tabs, Mine, Practise, Export and Import, Add to my openings).
// Registered on import; ui.js and explain-panel.js import this file so the strings are there before the first translation pass.
import { addDE } from '../i18n.js';

addDE({
  'learn.button': 'Lernen', 'learn.title': 'Lernen', 'learn.close': 'Schließen', 'learn.tabs': 'Lernen',
  'learn.tab.openings': 'Eröffnungen', 'learn.tab.mine': 'Meine', 'learn.tab.practise': 'Üben',
  'learn.mark': 'In meinen Eröffnungen',
  'learn.mineEmpty': 'Hier erscheinen die Eröffnungen, die du übernimmst. Geh eine Linie bis zum Ende durch und wähle unter Eröffnungen „Zu meinen Eröffnungen“.',
  'learn.edit': 'Bearbeiten', 'learn.done': 'Fertig', 'learn.remove': 'Entfernen',
  'learn.removeOne': '{name} entfernen', 'learn.progress': 'Fortschritt',
  'learn.practiseLead': 'Eine Eröffnung zum Üben wählen. Das ändert nichts an deinem Fortschritt.',
  'learn.practiseStart': 'Üben beginnen', 'learn.practiseNone': 'Du hast noch keine Eröffnung übernommen. Unter Eröffnungen findest du sie.',
  'learn.practiseLocked': 'Üben schaltet sich frei, sobald du die erste Eröffnung übernommen hast.',
  'learn.data': 'Deine Eröffnungen', 'learn.export': 'Exportieren', 'learn.import': 'Importieren',
  'learn.exported': 'Datei gespeichert.', 'learn.imported': 'Importiert.', 'learn.importFailed': 'Import nicht möglich: {why}',
  'learn.importUnreadable': 'Die Datei konnte nicht gelesen werden.',
  'explain.addMine': 'Zu meinen Eröffnungen', 'explain.inMine': 'In meinen Eröffnungen',
});
