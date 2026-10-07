// The News text (CHE-235): one entry per version, newest first. Each entry: the version, the date (ISO), and 3 to 5 short child
// friendly points in German (de) and English (en). The lead adds the entry of a release with the release. The News window
// (src/news.js) links the full release notes on GitHub from each entry.
export const NEWS = [
  {
    version: '1.9.1', date: '2026-10-07',
    de: [
      'Der Online-Reiter sieht schöner aus: Spielerkarten, ein schwebender Chat und eine klare Wartezeile.',
      'Symbole bleiben am Brett ausgerichtet und drehen sich nicht mehr zu dir.',
      'Das rechte Fenster am Computer lässt sich wieder nach oben scrollen.',
      'Glattere Kanten und ein weicher Nebel in der Ferne, Pixelwelt ohne kleine Fehler.',
    ],
    en: [
      'The Online tab looks better: player cards, a floating chat and a clear waiting line.',
      'Symbols stay aligned to the board and no longer turn toward you.',
      'The right panel on a computer scrolls back to the top again.',
      'Smoother edges and a soft haze in the distance, Pixelwelt without small glitches.',
    ],
  },
  {
    version: '1.9.0', date: '2026-10-06',
    de: [
      'Lernen erklärt jetzt mehr: worum es geht, was jede Seite will, Pläne und Fallen, und bei jedem Zug ein Warum.',
      'Pixelwelt-Bauern stehen wieder wie früher da, den Speer nehmen sie nur im Kampf.',
      'Die Kacheln in den Optionen zeigen echte Bilder.',
      'Neue Kampfklänge, alle gleich laut.',
      'Das Thema Blocks ist weg, Pixelwelt ist geblieben.',
    ],
    en: [
      'Learn explains more: what it is about, what each side wants, plans and traps, and a Why for every move.',
      'Pixelwelt pawns stand as before again, they take up the spear only in a fight.',
      'The tiles in Options show real pictures.',
      'New battle sounds, all at the same level.',
      'The Blocks theme is gone, Pixelwelt stays.',
    ],
  },
  {
    version: '1.8.0', date: '2026-10-06',
    de: [
      'Pixelwelt hat neue Himmel: Abend, Nacht, Sonnenaufgang, Sturm und Schnee.',
      'Dazu Hintergründe: schwebende Inseln oder eine Burg mit Dorf.',
      'Drei Welten zum Auswählen: Sturmburg, Inselmorgen, Winterdorf.',
      'Lebendige Figuren starten nach 15 Sekunden Ruhe.',
      'Von oben lässt sich jetzt auch drehen und kippen.',
    ],
    en: [
      'Pixelwelt has new skies: Evening, Night, Sunrise, Storm and Snow.',
      'New backdrops: floating islands or a castle with a village.',
      'Three sets to pick: Sturmburg, Inselmorgen, Winterdorf.',
      'Living pieces start after 15 seconds of quiet.',
      'From above can now be turned and tilted too.',
    ],
  },
  {
    version: '1.7.0', date: '2026-10-05',
    de: [
      'Neues Menü: Spielen, Lernen und Optionen sind jetzt drei gleichwertige Orte.',
      'Symbole sind ein Schalter: flache Schachsymbole in jeder Ansicht und jedem Thema.',
      'Pixelwelt: Gras bis ans Brett, Buchstaben und Zahlen auf dem Gras, Bauern mit Speer in beiden Händen.',
      'Lebendige Figuren: ab und zu zeigt eine Figur ihren eigenen Auftritt, in Pixelwelt fliegen Vögel vorbei.',
      'Neu: Versionszeile und diese Neuigkeiten.',
    ],
    en: [
      'New menu: Play, Learn and Options are now three equal places.',
      'Symbols is a switch: flat chess symbols in every view and every theme.',
      'Pixelwelt: grass up to the board, letters and numbers on the grass, pawns with a spear in both hands.',
      'Living pieces: now and then a piece plays its own show, and in Pixelwelt birds fly by.',
      'New: a version line and this News window.',
    ],
  },
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
