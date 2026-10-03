// German texts for the Puzzles tab and panel. Registered on import. The English texts are the fallbacks passed to t() where
// they are used; the theme lines (Mate in one ...) come in { en, de } pairs from themes.js.
import { addDE } from '../i18n.js';

addDE({
  'puzzles.tab': 'Rätsel', 'learn.tab.puzzles': 'Rätsel',
    'puzzles.start': 'Start', 'puzzles.next': 'Nächstes Rätsel',
  'puzzles.band': 'Stufe',
  'puzzles.band.starter': 'Einsteiger', 'puzzles.band.growing': 'Auf dem Weg', 'puzzles.band.tricky': 'Knifflig',
  'puzzles.help': 'Hilfe', 'puzzles.stop': 'Beenden', 'puzzles.close': 'Schließen',
  'puzzles.wrong': 'Das ist es nicht. Versuch es noch einmal.',
  'puzzles.again': 'Noch nicht. Lass dir Zeit.',
  'puzzles.right': 'Richtig. Der Gegner antwortet.',
  'puzzles.your': 'Du bist am Zug.',
  'puzzles.helpShown': 'Der goldene Pfeil zeigt den Zug.',
  'puzzles.solved': 'Gelöst!',
  'puzzles.solvedLater': 'Gelöst. Spiel es im Pfad noch einmal für Gold.',
  'puzzles.chapter': 'Kapitel', 'puzzles.chapterN': 'Kapitel {n}', 'puzzles.path': 'Rätselpfad', 'puzzles.station': 'Station {n}',
  'puzzles.st.gold': 'gelöst', 'puzzles.st.silver': 'mit Hilfe gelöst', 'puzzles.st.next': 'als Nächstes', 'puzzles.st.todo': 'noch nicht gespielt',
  'puzzles.legend.gold': 'Gelöst', 'puzzles.legend.silver': 'Mit Hilfe', 'puzzles.legend.next': 'Als Nächstes',
  'puzzles.continue': 'Weiter', 'puzzles.nextChapter': 'Nächstes Kapitel',
  'puzzles.chapterDone': 'Kapitel {n} geschafft!', 'puzzles.levelDone': 'Kapitel {n} geschafft! Eine neue Stufe öffnet sich.',
  'puzzles.empty': 'Keine Rätsel verfügbar.',
});
