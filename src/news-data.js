// The News text (CHE-235): one entry per version, newest first. Each entry: the version, the date (ISO), and 3 to 5 short child
// friendly points in German (de) and English (en). The lead adds the entry of a release with the release. The News window
// (src/news.js) links the full release notes on GitHub from each entry.
export const NEWS = [
  {
    version: '1.13.0', date: '2026-10-10',
    de: [
      'Online: Ganz oben stehen deine laufenden Partien, mit der Wartezeit und einem Knopf direkt zur Partie.',
      'Nimmt jemand deine Herausforderung an, springt das Brett von selbst in die Partie.',
      'Eine Zeile in der Kopfleiste sagt dir immer, was läuft und wer am Zug ist.',
      'Neu: Über die Sprechblase oben schickst du uns einen Fehler oder einen Wunsch.',
      'Gibt es eine neue Version des Spiels oder des Servers, sagt es dir das Spiel, und im Online-Tab siehst du oben immer, ob der Server erreichbar ist.',
    ],
    en: [
      'Online: your running games now sit at the top, with the waiting time and a button straight to the game.',
      'When someone accepts your challenge, the board switches to the game by itself.',
      'One line in the header always says what is running and whose move it is.',
      'New: the speech bubble at the top sends us a bug or a wish.',
      'If there is a new version of the game or the server, the game tells you, and the Online tab always shows at the top whether the server can be reached.',
    ],
  },
  {
    version: '1.12.0', date: '2026-10-09',
    de: [
      'Pixelwelt: Beim Schlagen kämpft jede Figur jetzt auf mehrere Arten, immer abwechselnd.',
      'Schachmatt in der Pixelwelt: Der Turm des Verlierers fällt um, Feuerwerk, und die Sieger jubeln. Ein Tipp überspringt es.',
      'Neue Teams in den Optionen: Ritter, Drachen, Zauberer und Piraten.',
      'Die Inseln leben: Tiere weiden, Dorfbewohner gehen übers Feld, Vögel kreisen.',
      'Berühmte Partie: Das Spiel spielt die Unsterbliche Partie, die Königsjagd oder Réti als Trailer oder ganz. Ein Tipp beendet es, deine Partie geht weiter.',
    ],
    en: [
      'Pixelwelt: every piece now captures in several ways, taking turns.',
      'Checkmate in Pixelwelt: the loser\'s tower falls, fireworks, and the winners cheer. A tap skips it.',
      'New teams in Options: Knights, Dragons, Wizards and Pirates.',
      'The islands are alive: animals graze, villagers walk around, birds circle.',
      'Famous game: the game plays the Immortal Game, the King Hunt or Réti as a trailer or in full. A tap ends it and your game continues.',
    ],
  },
  {
    version: '1.11.0', date: '2026-10-09',
    de: [
      'Pixelwelt: Such dir in den Optionen eine von fünf Inseln aus.',
      'Neue Figuren in den Optionen: Fantasy, Tiere, Kristall und Mech.',
      'Geschlagene Figuren stehen jetzt neben dem Brett im Gras oder auf dem Boden.',
      'Das Spiel geht auch ohne Internet, und es sagt dir, wenn es eine neue Version gibt.',
      'Online kannst du mehrere Spiele gleichzeitig spielen, eins pro Gegner.',
    ],
    en: [
      'Pixelwelt: pick one of five islands in Options.',
      'New pieces in Options: Fantasy, Animals, Crystal and Mech.',
      'Captured pieces now stand beside the board on the grass or the floor.',
      'The game works without internet and tells you when a new version is out.',
      'Online you can play several games at once, one per opponent.',
    ],
  },
  {
    version: '1.10.1', date: '2026-10-08',
    de: [
      'Online spielen ist jetzt für alle Eingeladenen gleich auf der Seite da.',
      'Die Kacheln in den Optionen sehen ausgewählt viel ruhiger aus: ein goldener Rahmen ums Bild.',
      'Symbole: Schwarz und Weiß schauen wieder gleich herum.',
    ],
    en: [
      'Online play is now right there on the site for everyone invited.',
      'Selected option tiles look much calmer: one gold ring around the picture.',
      'Symbols: Black and White face the same way again.',
    ],
  },
  {
    version: '1.10.0', date: '2026-10-08',
    de: [
      'Lernen: Jede Eröffnung beginnt mit einem kurzen, übersichtlichen Einstieg.',
      'Der Online-Reiter zeigt deine Zahlen und die Karte eines Spielers mit Bilanz und Serien.',
      'Auf dem Handy kommen Mitteilungen, wenn jemand dich herausfordert oder dir schreibt.',
      'Symbole: Die schwarzen Symbole schauen jetzt zur schwarzen Seite.',
      'Das Spiel hat eine eigene Adresse: chess3d.borisdiebold.com.',
    ],
    en: [
      'Learn: every opening starts with a short, tidy intro.',
      'The Online tab shows your numbers and a player card with record and streaks.',
      'On a phone you get a notification when someone challenges you or writes to you.',
      'Symbols: Black\'s symbols now face the black side.',
      'The game has its own address: chess3d.borisdiebold.com.',
    ],
  },
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
