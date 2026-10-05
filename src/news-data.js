// The News text (CHE-235): one entry per version, newest first. Each entry: the version, the date (ISO), and 3 to 5 short child
// friendly points in German (de) and English (en). The lead adds the entry of a release with the release. The News window
// (src/news.js) links the full release notes on GitHub from each entry.
export const NEWS = [
  {
    version: '1.6.0', date: '2026-10-05',
    de: [
      'Neu bei den Eröffnungen: der Knopf Erklären zeigt dir zuerst das Ziel auf dem Brett.',
      'Ruhige Klaviermusik ist jetzt voreingestellt.',
      'Der neue Spiel-Knopf heißt überall Spielen.',
      'Pixelwelt hat eine Abendstimmung, einen großen Baum und einen Wasserfall.',
      'Nach einer Partie zeigt dir die Auswertung zuerst eine kurze Zusammenfassung.',
    ],
    en: [
      'New for openings: the Explain button shows you the goal on the board first.',
      'Calm piano music is now the default.',
      'The new game button is called Play everywhere.',
      'Pixelwelt has an evening mood, a big tree and a waterfall.',
      'After a game the review starts with a short summary.',
    ],
  },
  {
    version: '1.5.0', date: '2026-10-04',
    de: [
      'Pixelwelt hat jetzt zwei Teams: Helden gegen Monster.',
      'Beim Schlagen gibt es in Pixelwelt eine eigene Szene mit roten Würfeln.',
      'Die Wolken gehen dem Brett aus dem Weg.',
      'Die Kamera wechselt weicher zwischen den Ansichten.',
    ],
    en: [
      'Pixelwelt now has two teams: heroes against monsters.',
      'Captures in Pixelwelt play a scene of their own with red cubes.',
      'The clouds stay out of the way of the board.',
      'The camera moves more smoothly between views.',
    ],
  },
  {
    version: '1.4.0', date: '2026-10-04',
    de: [
      'Neu: eine Schachuhr mit vier Zeiten zur Auswahl.',
      'Neu: jeden Tag ein Rätsel für alle, mit einer Serie von gelösten Tagen.',
      'Neu: 13 Abzeichen zum Sammeln.',
      'Neu: die Welt Pixelwelt aus 16 Pixel-Blöcken.',
      'Mehr Eröffnungen zum Lernen: jetzt 27.',
    ],
    en: [
      'New: a chess clock with four times to choose from.',
      'New: one puzzle a day for everyone, with a streak of solved days.',
      'New: 13 badges to collect.',
      'New: the world Pixelwelt, built from 16 pixel blocks.',
      'More openings to learn: now 27.',
    ],
  },
];
