// The 12 starter openings plus 15 side lines (27 lines), ported from chesslines (js/data/openings.js), texts in English and German.
// A side line is a line of its own that shares the first moves of its parent opening and deviates where a learner meets
// a common reply; the trainer shares cards across them.
//
// Each line is one side's opening: `side` is the colour the player plays ('w' or 'b'), `moves` is the whole line
// in SAN with one sentence per move (the sentence is shown after the move is made, whoever played it), `intro` is
// shown before the line starts and `ending` when it is finished. `eco` is the code of the deepest named position
// the line passes through. test/openings.mjs proves every line legal against src/rules.js.
//
// Texts have no em dashes or double hyphens (public repo rule). Text is addressed to "you", the player.

export const LINES = [
  {
    id: 'italian-game',
    eco: 'C54',
    side: 'w',
    name: {
      en: 'Italian Game',
      de: 'Italienische Partie'
    },
    idea: {
      en: 'Point the bishop at f7, the weakest square in Black’s camp, and castle early.',
      de: 'Der Läufer zielt auf f7, das schwächste Feld bei Schwarz. Dann schnell rochieren.'
    },
    intro: {
      en: 'One of the oldest openings there is, and still one of the first anyone learns. You put your bishop on c4, where it stares at f7, the one square next to Black’s king that only the king defends. Then you build a big pawn centre behind it.',
      de: 'Eine der ältesten Eröffnungen überhaupt und immer noch eine der ersten, die man lernt. Dein Läufer geht nach c4 und zielt auf f7: das einzige Feld neben dem schwarzen König, das nur der König selbst deckt. Dahinter baust du dann ein starkes Bauernzentrum auf.'
    },
    pgn: '1. e4 e5 2. Nf3 Nc6 3. Bc4 Bc5 4. c3 Nf6 5. d4',
    moves: [
      {
        san: 'e4',
        en: 'Straight into the middle. The pawn takes a centre square, watches d5, and opens the door for both your bishop and your queen.',
        de: 'Direkt in die Mitte. Der Bauer nimmt ein Zentrumsfeld, bewacht d5 und macht den Weg frei für Läufer und Dame.'
      },
      {
        san: 'e5',
        en: 'Black does the same thing, and it is the move that gets most in your way: it stops you playing d4 for free.',
        de: 'Schwarz macht es genauso, und das ist der Zug, der dich am meisten stört: Er verhindert, dass du einfach so d4 spielen kannst.'
      },
      {
        san: 'Nf3',
        en: 'Develop and attack at the same time. The knight goes for the e5 pawn, guards d4, and clears a square so you can castle soon.',
        de: 'Entwickeln und angreifen zugleich. Der Springer greift den Bauern auf e5 an, deckt d4 und macht Platz zum Rochieren.'
      },
      {
        san: 'Nc6',
        en: 'Black defends the pawn with a piece that also covers d4: one move doing two jobs.',
        de: 'Schwarz verteidigt den Bauern mit einer Figur, die zugleich d4 deckt: ein Zug, zwei Aufgaben.'
      },
      {
        san: 'Bc4',
        en: 'The Italian bishop. From here it aims at f7, the weakest square Black has, because only the king is guarding it.',
        de: 'Der italienische Läufer. Von hier zielt er auf f7, das schwächste Feld bei Schwarz, weil nur der König es deckt.'
      },
      {
        san: 'Bc5',
        en: 'Black copies you. Bringing the bishop out before the knight keeps the queen watching g5, so Black can castle in peace.',
        de: 'Schwarz macht es dir nach. Erst der Läufer, dann der Springer: So behält die Dame g5 im Blick und Schwarz kann in Ruhe rochieren.'
      },
      {
        san: 'c3',
        en: 'The quiet move that makes the next one work. Right now Black guards d4 three times and you only twice, so play d4 immediately and you just lose the pawn. This evens the count.',
        de: 'Der leise Zug, der den nächsten erst möglich macht. Im Moment deckt Schwarz d4 dreimal, du nur zweimal. Spielst du d4 sofort, verlierst du den Bauern einfach. Das hier gleicht die Rechnung aus.'
      },
      {
        san: 'Nf6',
        en: 'Black develops and hits your e4 pawn, getting ready to castle as well.',
        de: 'Schwarz entwickelt sich, greift deinen Bauern auf e4 an und bereitet ebenfalls die Rochade vor.'
      },
      {
        san: 'd4',
        en: 'Now it works. Two pawns side by side in the middle, and Black has to take them or hand you the whole centre.',
        de: 'Jetzt geht es. Zwei Bauern nebeneinander in der Mitte, und Schwarz muss zuschlagen oder dir das ganze Zentrum überlassen.'
      }
    ],
    ending: {
      en: 'That is the Italian plan complete: bishop on c4 aimed at f7, a big centre, and a king that can castle soon. Notice that d4 only worked because the quiet c3 came first. Moves that look slow often make the next one possible.',
      de: 'Damit steht der italienische Plan: Läufer auf c4 mit Blick auf f7, ein starkes Zentrum und bald die Rochade. Merk dir: d4 ging nur, weil das unscheinbare c3 vorher kam. Ein Zug, der langsam aussieht, macht oft den nächsten erst möglich.'
    }
  },
  {
    id: 'ruy-lopez',
    eco: 'C78',
    side: 'w',
    name: {
      en: 'Ruy Lopez',
      de: 'Spanische Partie'
    },
    idea: {
      en: 'Pin the knight that defends e5, then build a big centre behind it.',
      de: 'Den Springer fesseln, der e5 deckt, und dahinter ein starkes Zentrum aufbauen.'
    },
    intro: {
      en: 'The oldest famous opening of them all, named after a Spanish priest. Your bishop does not go after a pawn. It goes after the knight that is guarding one. Take the guard away and the pawn behind it starts to look shaky.',
      de: 'Die älteste berühmte Eröffnung überhaupt, benannt nach einem spanischen Priester. Dein Läufer greift keinen Bauern an, sondern den Springer, der einen Bauern bewacht. Nimm die Wache weg, dann wackelt der Bauer dahinter.'
    },
    pgn: '1. e4 e5 2. Nf3 Nc6 3. Bb5 a6 4. Ba4 Nf6 5. O-O',
    moves: [
      {
        san: 'e4',
        en: 'Straight into the middle. The pawn takes a centre square, watches d5, and opens the door for both your bishop and your queen.',
        de: 'Direkt in die Mitte. Der Bauer nimmt ein Zentrumsfeld, bewacht d5 und macht den Weg frei für Läufer und Dame.'
      },
      {
        san: 'e5',
        en: 'Black claims the same share of the middle, and gets in the way of your d4.',
        de: 'Schwarz beansprucht denselben Anteil an der Mitte und steht deinem d4 im Weg.'
      },
      {
        san: 'Nf3',
        en: 'Develop and attack at once: the knight goes for the e5 pawn and clears the way for castling.',
        de: 'Entwickeln und angreifen zugleich: Der Springer greift den Bauern auf e5 an und macht den Weg zur Rochade frei.'
      },
      {
        san: 'Nc6',
        en: 'Black defends the pawn with a piece that also covers d4: one move doing two jobs.',
        de: 'Schwarz verteidigt den Bauern mit einer Figur, die zugleich d4 deckt: ein Zug, zwei Aufgaben.'
      },
      {
        san: 'Bb5',
        en: 'The Spanish bishop, and the whole idea of the opening. It does not attack the e5 pawn. It attacks the knight that is defending it. Careful, though: you cannot just win that pawn yet, because after Bxc6 dxc6 Nxe5 Black has Qd4 and takes the material straight back.',
        de: 'Der spanische Läufer. Das ist die ganze Idee der Eröffnung. Er greift nicht den Bauern auf e5 an, sondern den Springer, der ihn deckt. Aber Vorsicht: Einfach gewinnen kannst du den Bauern noch nicht, denn nach Lxc6 dxc6 Sxe5 kommt Dd4 und Schwarz holt sich das Material sofort zurück.'
      },
      {
        san: 'a6',
        en: 'Black asks the bishop a question: take, or step back, but you cannot stay there.',
        de: 'Schwarz stellt dem Läufer eine Frage: schlagen oder zurückgehen. Stehen bleiben geht nicht.'
      },
      {
        san: 'Ba4',
        en: 'Step back, but stay on the same diagonal. The bishop still eyes the knight on c6, so the pressure has not gone anywhere.',
        de: 'Zurückgehen, aber auf derselben Diagonale bleiben. Der Läufer schaut weiter auf den Springer auf c6. Der Druck bleibt.'
      },
      {
        san: 'Nf6',
        en: 'Black develops and hits your e4 pawn, so now it is your pawn that needs an answer.',
        de: 'Schwarz entwickelt sich und greift deinen Bauern auf e4 an. Jetzt braucht dein Bauer eine Antwort.'
      },
      {
        san: 'O-O',
        en: 'And you let it hang. Getting the king safe is worth more than the pawn here, and the pawn is not really lost. The rook is coming to e1 to look after it.',
        de: 'Und du lässt ihn hängen. Den König in Sicherheit zu bringen ist hier mehr wert als der Bauer, und verloren ist er nicht wirklich: Der Turm kommt nach e1 und kümmert sich darum.'
      }
    ],
    ending: {
      en: 'Your king is tucked away, your bishop still leans on the knight that guards e5, and you left a pawn hanging on purpose to get here. From this position the Ruy Lopez branches into everything it is famous for.',
      de: 'Dein König ist in Sicherheit, dein Läufer drückt weiter auf den Springer, der e5 deckt, und einen Bauern hast du absichtlich hängen lassen, um hierher zu kommen. Von dieser Stellung aus verzweigt sich die Spanische Partie in alles, wofür sie berühmt ist.'
    }
  },
  {
    id: 'scotch-game',
    eco: 'C45',
    side: 'w',
    name: {
      en: 'Scotch Game',
      de: 'Schottische Partie'
    },
    idea: {
      en: 'Break the centre open at once, before Black has finished developing.',
      de: 'Das Zentrum sofort öffnen, bevor Schwarz fertig entwickelt ist.'
    },
    intro: {
      en: 'You break the centre open straight away. Black has to take your pawn, and suddenly the middle of the board is wide open with your knight standing proudly in it. It has far less to memorise than the Spanish, which is why it is a good one to learn early.',
      de: 'Du reißt das Zentrum sofort auf. Schwarz muss deinen Bauern schlagen, und plötzlich ist die Brettmitte weit offen, mit deinem Springer mittendrin. Es gibt viel weniger auswendig zu lernen als in der Spanischen, deshalb eignet sie sich gut zum früh Lernen.'
    },
    pgn: '1. e4 e5 2. Nf3 Nc6 3. d4 exd4 4. Nxd4 Bc5',
    moves: [
      {
        san: 'e4',
        en: 'Straight into the middle. The pawn takes a centre square, watches d5, and opens the door for both your bishop and your queen.',
        de: 'Direkt in die Mitte. Der Bauer nimmt ein Zentrumsfeld, bewacht d5 und macht den Weg frei für Läufer und Dame.'
      },
      {
        san: 'e5',
        en: 'Black claims the same share of the middle, and gets in the way of your d4.',
        de: 'Schwarz beansprucht denselben Anteil an der Mitte und steht deinem d4 im Weg.'
      },
      {
        san: 'Nf3',
        en: 'Develop and attack at once: the knight goes for the e5 pawn and clears the way for castling.',
        de: 'Entwickeln und angreifen zugleich: Der Springer greift den Bauern auf e5 an und macht den Weg zur Rochade frei.'
      },
      {
        san: 'Nc6',
        en: 'Black defends the pawn with a piece that also covers d4: one move doing two jobs.',
        de: 'Schwarz verteidigt den Bauern mit einer Figur, die zugleich d4 deckt: ein Zug, zwei Aufgaben.'
      },
      {
        san: 'd4',
        en: 'Now, before Black is ready. You hit the middle with a second pawn and Black has to decide about e5 this move. No time to get organised first.',
        de: 'Jetzt, bevor Schwarz bereit ist. Du schlägst mit einem zweiten Bauern in der Mitte zu, und Schwarz muss sich sofort um e5 kümmern. Keine Zeit, sich vorher zu sortieren.'
      },
      {
        san: 'exd4',
        en: 'Black takes, and almost everyone does. The centre is open now, and both sides get a lot of room.',
        de: 'Schwarz schlägt, und das machen fast alle. Das Zentrum ist jetzt offen, und beide Seiten bekommen viel Platz.'
      },
      {
        san: 'Nxd4',
        en: 'You take back with the knight, which lands right in the middle of the board with your queen behind it.',
        de: 'Du schlägst mit dem Springer zurück. Er landet mitten auf dem Brett, die Dame im Rücken.'
      },
      {
        san: 'Bc5',
        en: 'Black points a bishop at your knight and asks what you are going to do about it. The knight is only defended by the queen, so you will have to answer this next move.',
        de: 'Schwarz richtet einen Läufer auf deinen Springer und fragt, was du dagegen tun willst. Der Springer wird nur von der Dame gedeckt. Im nächsten Zug musst du also antworten.'
      }
    ],
    ending: {
      en: 'This is the Classical Scotch. The centre is open, you have more space and a knight in the middle, but Black has just attacked it, so your next move has a job to do.',
      de: 'Das ist die Klassische Schottische. Das Zentrum ist offen, du hast mehr Platz und einen Springer in der Mitte, aber Schwarz greift ihn gerade an, dein nächster Zug hat also eine Aufgabe.'
    }
  },
  {
    id: 'vienna-game',
    eco: 'C27',
    side: 'w',
    name: {
      en: 'Vienna Game',
      de: 'Wiener Partie'
    },
    idea: {
      en: 'Let Black grab the e-pawn, then come after the king with the queen.',
      de: 'Schwarz den e-Bauern nehmen lassen und dann mit der Dame hinter den König her.'
    },
    intro: {
      en: 'This one has the best name in chess: the Frankenstein-Dracula Variation. You let Black snatch a pawn in the middle, and in return your queen jumps out and goes straight for f7. It gets wild fast, and Black has exactly one good way through it.',
      de: 'Diese hier hat den besten Namen im ganzen Schach: die Frankenstein-Dracula-Variante. Du lässt Schwarz einen Bauern in der Mitte schnappen, und dafür springt deine Dame heraus und geht direkt auf f7 los. Es wird schnell wild, und Schwarz hat genau einen guten Weg hindurch.'
    },
    pgn: '1. e4 e5 2. Nc3 Nf6 3. Bc4 Nxe4 4. Qh5',
    moves: [
      {
        san: 'e4',
        en: 'Straight into the middle. The pawn takes a centre square, watches d5, and opens the door for both your bishop and your queen.',
        de: 'Direkt in die Mitte. Der Bauer nimmt ein Zentrumsfeld, bewacht d5 und macht den Weg frei für Läufer und Dame.'
      },
      {
        san: 'e5',
        en: 'Black claims the same share of the middle.',
        de: 'Schwarz beansprucht denselben Anteil an der Mitte.'
      },
      {
        san: 'Nc3',
        en: 'The knight comes out towards the centre and guards your e4 pawn while it is there.',
        de: 'Der Springer kommt Richtung Zentrum heraus und deckt dabei deinen Bauern auf e4.'
      },
      {
        san: 'Nf6',
        en: 'Black develops and takes aim at e4, the pawn your knight is currently defending.',
        de: 'Schwarz entwickelt sich und nimmt e4 ins Visier, den Bauern, den dein Springer gerade deckt.'
      },
      {
        san: 'Bc4',
        en: 'The bishop joins in, and now three of your pieces watch d5. It also means you have stopped guarding e4 with a pawn move, which is an invitation.',
        de: 'Der Läufer kommt dazu, und jetzt bewachen drei deiner Figuren d5. Es heißt aber auch: Du deckst e4 nicht mit einem Bauernzug ab, und das ist eine Einladung.'
      },
      {
        san: 'Nxe4',
        en: 'Black accepts and takes the pawn. It is not greedy. It is the main line, and it clears two of your defenders away from d5 at the same time.',
        de: 'Schwarz nimmt an und schlägt den Bauern. Das ist nicht gierig. Das ist die Hauptvariante, und es räumt gleichzeitig zwei deiner Verteidiger von d5 weg.'
      },
      {
        san: 'Qh5',
        en: 'Out comes the queen, and yes, you were probably told not to do this. Here it works, because from h5 she attacks f7 and e5 at the same time, and f7 is only guarded by the king. Play a careless move now and it is mate.',
        de: 'Die Dame kommt heraus, und ja, davon hat man dir wahrscheinlich abgeraten. Hier funktioniert es: Von h5 greift sie f7 und e5 gleichzeitig an, und f7 deckt nur der König. Ein unachtsamer Zug jetzt, und es ist matt.'
      }
    ],
    ending: {
      en: 'You are a pawn down and your queen is out early. Both things you are usually warned about. What you got for them: mate threatened on f7, the e5 pawn attacked as well, and Black down to a single good reply. That is the trade this opening makes.',
      de: 'Du bist einen Bauern hinten und deine Dame steht früh draußen. Beides sind Dinge, vor denen man normalerweise warnt. Was du dafür bekommen hast: Matt-Drohung auf f7, dazu der Bauer auf e5 angegriffen, und Schwarz bleibt nur eine einzige gute Antwort. Das ist der Handel, den diese Eröffnung eingeht.'
    }
  },
  {
    id: 'kings-gambit',
    eco: 'C39',
    side: 'w',
    name: {
      en: 'King’s Gambit',
      de: 'Königsgambit'
    },
    idea: {
      en: 'Give up a pawn to rip the centre open and attack fast.',
      de: 'Einen Bauern opfern, um das Zentrum aufzureißen und schnell anzugreifen.'
    },
    intro: {
      en: 'The wildest of the old openings. You hand Black a pawn on move two to drag his e-pawn off the centre and open a line for your rook, and you accept that your own king is a bit draughty as the price. The very best players hardly touch it any more, but at club level it is still enormous fun.',
      de: 'Die wildeste der alten Eröffnungen. Im zweiten Zug schenkst du Schwarz einen Bauern, um seinen e-Bauern aus dem Zentrum zu ziehen und eine Linie für deinen Turm zu öffnen, und nimmst dafür in Kauf, dass es um deinen eigenen König etwas zieht. Ganz oben spielt sie kaum noch jemand, aber im Verein macht sie riesigen Spaß.'
    },
    pgn: '1. e4 e5 2. f4 exf4 3. Nf3 g5 4. h4',
    moves: [
      {
        san: 'e4',
        en: 'Straight into the middle. The pawn takes a centre square, watches d5, and opens the door for both your bishop and your queen.',
        de: 'Direkt in die Mitte. Der Bauer nimmt ein Zentrumsfeld, bewacht d5 und macht den Weg frei für Läufer und Dame.'
      },
      {
        san: 'e5',
        en: 'Black claims the same share of the middle.',
        de: 'Schwarz beansprucht denselben Anteil an der Mitte.'
      },
      {
        san: 'f4',
        en: 'The gambit. You offer the pawn to pull Black’s e-pawn away from the centre and to open the f-file for your rook once you castle. It does loosen the squares around your own king. That is the deal you are making.',
        de: 'Das Gambit. Du bietest den Bauern an, um den schwarzen e-Bauern aus dem Zentrum zu ziehen und die f-Linie für deinen Turm zu öffnen, sobald du rochierst. Dafür werden die Felder um deinen eigenen König lockerer. Das ist der Handel.'
      },
      {
        san: 'exf4',
        en: 'Black takes. Watch out now: with the f-file open, Black would love to play Qh4 with check, and you could not block it with the g-pawn.',
        de: 'Schwarz nimmt. Jetzt aufpassen: Bei offener f-Linie würde Schwarz gern Dh4 mit Schach spielen, und mit dem g-Bauern könntest du das nicht blocken.'
      },
      {
        san: 'Nf3',
        en: 'Develop, and stop that check before it happens: from f3 the knight covers h4, so the queen cannot come. It also gets you ready to take the pawn back later.',
        de: 'Entwickeln und das Schach verhindern, bevor es kommt: Von f3 deckt der Springer h4, die Dame kann also nicht dorthin. Nebenbei bereitest du vor, dir den Bauern später zurückzuholen.'
      },
      {
        san: 'g5',
        en: 'Black props the extra pawn up with another pawn. Left alone, Black adds h6 and Bg7 and that pawn on f4 turns into a little fortress.',
        de: 'Schwarz stützt den Mehrbauern mit einem weiteren Bauern. Lässt du ihn machen, kommen noch h6 und Lg7 dazu, und der Bauer auf f4 wird zu einer kleinen Festung.'
      },
      {
        san: 'h4',
        en: 'So you hit it before it sets. The pawn on g5 is attacked twice and defended once, and Black has essentially one way to keep it: push past with g4.',
        de: 'Also schlägst du zu, bevor sie fest wird. Der Bauer auf g5 wird zweimal angegriffen und nur einmal gedeckt, und Schwarz hat im Grunde nur einen Weg, ihn zu halten: mit g4 vorbeiziehen.'
      }
    ],
    ending: {
      en: 'You are a pawn down and Black has to make a decision right now: push the pawn to g4 and let the game explode, or give the extra pawn back. That was the point of h4: not to win anything yet, but to stop Black getting comfortable.',
      de: 'Du bist einen Bauern hinten, und Schwarz muss sich sofort entscheiden: den Bauern nach g4 vorschieben und die Partie explodieren lassen, oder den Mehrbauern zurückgeben. Genau darum ging es bei h4: noch nichts gewinnen, sondern verhindern, dass Schwarz es sich bequem macht.'
    }
  },
  {
    id: 'london-system',
    eco: 'D02',
    side: 'w',
    name: {
      en: 'London System',
      de: 'Londoner System'
    },
    idea: {
      en: 'Set the same solid shape up every game: the bishop comes out before the e-pawn moves.',
      de: 'Jede Partie derselbe solide Aufbau: Der Läufer kommt raus, bevor der e-Bauer zieht.'
    },
    intro: {
      en: 'The opening you can play against almost anything. There is one trick to the move order and everything else follows from it: the dark-squared bishop goes out to f4 first, and only then does the e-pawn move. Get that the wrong way round and the bishop spends the game stuck behind its own pawns.',
      de: 'Die Eröffnung, die du gegen fast alles spielen kannst. Die Zugfolge hat einen Kniff, und alles andere ergibt sich daraus: Der schwarzfeldrige Läufer geht zuerst nach f4 hinaus, und erst danach zieht der e-Bauer. Machst du es andersherum, steht der Läufer die ganze Partie hinter den eigenen Bauern fest.'
    },
    pgn: '1. d4 d5 2. Nf3 Nf6 3. Bf4 e6 4. e3 Bd6',
    moves: [
      {
        san: 'd4',
        en: 'Take the centre with the other pawn. It grabs a middle square, covers c5 and e5, and opens a line for your queen’s bishop.',
        de: 'Das Zentrum mit dem anderen Bauern nehmen. Er belegt ein Mittelfeld, deckt c5 und e5 und öffnet eine Linie für deinen Damenläufer.'
      },
      {
        san: 'd5',
        en: 'Black stakes the same claim and covers e4, so you cannot get two pawns side by side in the middle.',
        de: 'Schwarz beansprucht dasselbe und deckt e4. Zwei Bauern nebeneinander in der Mitte bekommst du damit nicht.'
      },
      {
        san: 'Nf3',
        en: 'A calm developing move that keeps your options open.',
        de: 'Ein ruhiger Entwicklungszug, der dir alle Möglichkeiten offenhält.'
      },
      {
        san: 'Nf6',
        en: 'Black develops the knight to its best square and keeps fighting for e4.',
        de: 'Schwarz entwickelt den Springer auf sein bestes Feld und kämpft weiter um e4.'
      },
      {
        san: 'Bf4',
        en: 'Here it is: the move the whole system is named for. The bishop steps outside the pawns before you close the door on it. This is the one move order you should not swap.',
        de: 'Da ist er: der Zug, nach dem das ganze System benannt ist. Der Läufer geht nach draußen, bevor du ihm die Tür zumachst. Das ist die eine Zugfolge, die du nicht vertauschen solltest.'
      },
      {
        san: 'e6',
        en: 'Black backs up d5 and frees the dark-squared bishop, but shuts in the other one. That is exactly the problem you just avoided by going first.',
        de: 'Schwarz stützt d5 und macht den schwarzfeldrigen Läufer frei, sperrt dafür aber den anderen ein. Genau das Problem hast du dir eben erspart, weil du zuerst dran warst.'
      },
      {
        san: 'e3',
        en: 'Now the pawn can come. It props up d4, and your bishop is already outside, safely in front of it.',
        de: 'Jetzt darf der Bauer kommen. Er stützt d4, und dein Läufer steht längst draußen, sicher davor.'
      },
      {
        san: 'Bd6',
        en: 'Black brings a bishop out to face yours and offers a trade of the two.',
        de: 'Schwarz stellt einen Läufer gegen deinen und bietet den Abtausch der beiden an.'
      }
    ],
    ending: {
      en: 'Your shape is finished, and it is the same one every single game: pawns on d4 and e3, knight on f3, bishop outside on f4. From here it is always the same tidying up: Bd3, c3, the other knight, castle. Nobody is winning yet; you just always know what to do.',
      de: 'Dein Aufbau steht, und er ist in jeder Partie derselbe: Bauern auf d4 und e3, Springer auf f3, Läufer draußen auf f4. Ab hier kommt immer dasselbe Aufräumen: Ld3, c3, der andere Springer, rochieren. Gewonnen hat noch niemand; du weißt nur immer, was zu tun ist.'
    }
  },
  {
    id: 'london-system-c5',
    eco: 'D02',
    side: 'w',
    name: {
      en: 'London System: Black plays c5',
      de: 'London-System: Schwarz spielt c5'
    },
    idea: {
      en: 'When Black hits d4 with ...c5, keep the pawn guarded and keep developing.',
      de: 'Greift Schwarz mit ...c5 den Bauern auf d4 an, deckst du ihn und entwickelst dich weiter.'
    },
    intro: {
      en: 'Many players do not just sit and let you build the London. They hit your d4 pawn at once with ...c5. This line shows how to hold d4 calmly: count attackers and defenders, and never panic.',
      de: 'Viele Spieler lassen dich das London-System nicht in Ruhe aufbauen. Sie greifen sofort deinen Bauern auf d4 mit ...c5 an. Diese Variante zeigt, wie du d4 ruhig hältst: Angreifer und Verteidiger zählen und nie in Panik geraten.'
    },
    pgn: '1. d4 d5 2. Nf3 Nf6 3. Bf4 c5 4. e3 Nc6 5. Nbd2 cxd4 6. exd4 Bf5 7. c3 e6',
    moves: [
      {
        san: 'd4',
        en: 'Take the centre with the other pawn. It grabs a middle square, covers c5 and e5, and opens a line for your queen’s bishop.',
        de: 'Das Zentrum mit dem anderen Bauern nehmen. Er belegt ein Mittelfeld, deckt c5 und e5 und öffnet eine Linie für deinen Damenläufer.'
      },
      {
        san: 'd5',
        en: 'Black stakes the same claim and covers e4, so you cannot get two pawns side by side in the middle.',
        de: 'Schwarz beansprucht dasselbe und deckt e4. Zwei Bauern nebeneinander in der Mitte bekommst du damit nicht.'
      },
      {
        san: 'Nf3',
        en: 'A calm developing move that keeps your options open.',
        de: 'Ein ruhiger Entwicklungszug, der dir alle Möglichkeiten offenhält.'
      },
      {
        san: 'Nf6',
        en: 'Black develops the knight to its best square and keeps fighting for e4.',
        de: 'Schwarz entwickelt den Springer auf sein bestes Feld und kämpft weiter um e4.'
      },
      {
        san: 'Bf4',
        en: 'Here it is: the move the whole system is named for. The bishop steps outside the pawns before you close the door on it. This is the one move order you should not swap.',
        de: 'Da ist er: der Zug, nach dem das ganze System benannt ist. Der Läufer geht nach draußen, bevor du ihm die Tür zumachst. Das ist die eine Zugfolge, die du nicht vertauschen solltest.'
      },
      {
        san: 'c5',
        en: 'Black attacks your d4 pawn straight away. This is the usual way to challenge the London.',
        de: 'Schwarz greift sofort deinen Bauern auf d4 an. So wird das London-System meistens herausgefordert.'
      },
      {
        san: 'e3',
        en: 'You back up d4 with the e-pawn. Your bishop is already outside the chain, so nothing gets locked in.',
        de: 'Du deckst d4 mit dem e-Bauern. Dein Läufer steht schon vor der Kette, es wird also nichts eingesperrt.'
      },
      {
        san: 'Nc6',
        en: 'A second attacker on d4. Black now hits it with the c5 pawn and the knight.',
        de: 'Ein zweiter Angreifer auf d4. Schwarz greift ihn jetzt mit dem Bauern auf c5 und dem Springer an.'
      },
      {
        san: 'Nbd2',
        en: 'Count it: two attackers, and you have three defenders (the e3 pawn, the f3 knight and the queen). So d4 is safe, and you simply bring out your last knight.',
        de: 'Zähl nach: zwei Angreifer, aber du hast drei Verteidiger (den Bauern auf e3, den Springer auf f3 und die Dame). d4 ist also sicher, und du entwickelst einfach deinen letzten Springer.'
      },
      {
        san: 'cxd4',
        en: 'Black trades off the pawn to open the c-file for the rook.',
        de: 'Schwarz tauscht den Bauern ab, um die c-Linie für den Turm zu öffnen.'
      },
      {
        san: 'exd4',
        en: 'Take back with the e-pawn. You have a pawn on d4 again and the e-file is open for your rook and queen.',
        de: 'Nimm mit dem e-Bauern zurück. Du hast wieder einen Bauern auf d4, und die e-Linie ist für Turm und Dame offen.'
      },
      {
        san: 'Bf5',
        en: 'Black gets the light-squared bishop out, just as you did with yours. The two bishops now face each other.',
        de: 'Schwarz bringt den weißfeldrigen Läufer heraus, genau wie du deinen. Die beiden Läufer stehen sich jetzt gegenüber.'
      },
      {
        san: 'c3',
        en: 'This pawn props up d4 for good, gives your queen the squares c2 and b3, and takes b4 away from the black knight.',
        de: 'Dieser Bauer stützt d4 dauerhaft, gibt deiner Dame die Felder c2 und b3 und nimmt dem schwarzen Springer das Feld b4.'
      },
      {
        san: 'e6',
        en: 'Black closes the centre and frees the dark-squared bishop. Everything is solid on both sides.',
        de: 'Schwarz schließt das Zentrum und befreit den schwarzfeldrigen Läufer. Auf beiden Seiten steht alles solide.'
      }
    ],
    ending: {
      en: 'You have your usual London pieces out, a solid d4 and c3 pawn pair, and the bishop still on f4. Next you play Bd3, castle, and bring the queen to c2 or b3. Nothing fancy needed.',
      de: 'Du hast deine üblichen London-Figuren draußen, ein solides Bauernpaar auf d4 und c3, und der Läufer steht noch auf f4. Als Nächstes folgen Ld3, die Rochade und die Dame nach c2 oder b3. Mehr braucht es nicht.'
    }
  },
  {
    id: 'london-system-bf5',
    eco: 'D02',
    side: 'w',
    name: {
      en: 'London System: Black copies with Bf5',
      de: 'London-System: Schwarz kopiert mit Lf5'
    },
    idea: {
      en: 'Black plays the London too. Trade the bishops calmly and keep a sound pawn structure.',
      de: 'Schwarz spielt ebenfalls das London-System. Tausche die Läufer in Ruhe und behalte eine gesunde Bauernstruktur.'
    },
    intro: {
      en: 'Sometimes Black simply copies you and plays the same system. You will see many bishop trades. Nothing is wrong with that: the game becomes calm, and you just need to play sensible developing moves.',
      de: 'Manchmal kopiert dich Schwarz einfach und spielt dasselbe System. Dabei werden viele Läufer getauscht. Das ist in Ordnung: Die Partie wird ruhig, und du brauchst nur vernünftige Entwicklungszüge.'
    },
    pgn: '1. d4 d5 2. Nf3 Nf6 3. Bf4 Bf5 4. e3 e6 5. Bd3 Bxd3 6. Qxd3 Bd6 7. Bxd6 Qxd6 8. Nbd2 O-O',
    moves: [
      {
        san: 'd4',
        en: 'Take the centre with the other pawn. It grabs a middle square, covers c5 and e5, and opens a line for your queen’s bishop.',
        de: 'Das Zentrum mit dem anderen Bauern nehmen. Er belegt ein Mittelfeld, deckt c5 und e5 und öffnet eine Linie für deinen Damenläufer.'
      },
      {
        san: 'd5',
        en: 'Black stakes the same claim and covers e4, so you cannot get two pawns side by side in the middle.',
        de: 'Schwarz beansprucht dasselbe und deckt e4. Zwei Bauern nebeneinander in der Mitte bekommst du damit nicht.'
      },
      {
        san: 'Nf3',
        en: 'A calm developing move that keeps your options open.',
        de: 'Ein ruhiger Entwicklungszug, der dir alle Möglichkeiten offenhält.'
      },
      {
        san: 'Nf6',
        en: 'Black develops the knight to its best square and keeps fighting for e4.',
        de: 'Schwarz entwickelt den Springer auf sein bestes Feld und kämpft weiter um e4.'
      },
      {
        san: 'Bf4',
        en: 'Here it is: the move the whole system is named for. The bishop steps outside the pawns before you close the door on it. This is the one move order you should not swap.',
        de: 'Da ist er: der Zug, nach dem das ganze System benannt ist. Der Läufer geht nach draußen, bevor du ihm die Tür zumachst. Das ist die eine Zugfolge, die du nicht vertauschen solltest.'
      },
      {
        san: 'Bf5',
        en: 'Black copies your plan and brings the bishop outside the pawns before playing e6. Expect some bishop trades.',
        de: 'Schwarz kopiert deinen Plan und bringt den Läufer vor die Bauern, bevor er e6 spielt. Rechne mit einigen Läufertauschen.'
      },
      {
        san: 'e3',
        en: 'Your usual solid move: the pawn guards d4 and opens the way for the light-squared bishop.',
        de: 'Dein üblicher solider Zug: Der Bauer deckt d4 und öffnet den Weg für den weißfeldrigen Läufer.'
      },
      {
        san: 'e6',
        en: 'Black backs up d5 and opens the way for the dark-squared bishop, just like you did.',
        de: 'Schwarz stützt d5 und öffnet den Weg für den schwarzfeldrigen Läufer, genau wie du.'
      },
      {
        san: 'Bd3',
        en: 'You offer to trade bishops. It removes Black’s active light-squared bishop and costs you nothing in structure.',
        de: 'Du bietest den Läufertausch an. Er nimmt Schwarz den aktiven weißfeldrigen Läufer und kostet dich nichts in der Struktur.'
      },
      {
        san: 'Bxd3',
        en: 'Black accepts the trade.',
        de: 'Schwarz nimmt den Tausch an.'
      },
      {
        san: 'Qxd3',
        en: 'Take back with the queen. It is nicely placed on d3 and eyes the kingside.',
        de: 'Nimm mit der Dame zurück. Sie steht gut auf d3 und schaut zum Königsflügel.'
      },
      {
        san: 'Bd6',
        en: 'Black offers to trade the other bishops as well. It is like a mirror.',
        de: 'Schwarz bietet auch den Tausch der anderen Läufer an. Es ist wie in einem Spiegel.'
      },
      {
        san: 'Bxd6',
        en: 'Take first, and you decide how the pieces come off.',
        de: 'Nimm zuerst, dann bestimmst du, wie die Figuren abgetauscht werden.'
      },
      {
        san: 'Qxd6',
        en: 'Black takes back with the queen. The d4 pawn stands between the queens, so no queen trade yet.',
        de: 'Schwarz nimmt mit der Dame zurück. Der Bauer auf d4 steht zwischen den Damen, ein Damentausch ist also noch nicht möglich.'
      },
      {
        san: 'Nbd2',
        en: 'Bring out the last knight. It heads for f3 or e4 and keeps the position healthy.',
        de: 'Bring den letzten Springer heraus. Er zielt auf f3 oder e4 und hält die Stellung gesund.'
      },
      {
        san: 'O-O',
        en: 'Black castles, and now both kings are safe. A quiet, balanced middlegame is ahead.',
        de: 'Schwarz rochiert, und beide Könige sind sicher. Vor euch liegt ein ruhiges, ausgeglichenes Mittelspiel.'
      }
    ],
    ending: {
      en: 'Both bishop pairs are gone and the position is quiet and equal. Develop your last knight, castle and decide on a plan: c4 to open the centre, or e4 to take space. You know your pieces, and the game is yours to steer.',
      de: 'Die Läuferpaare sind abgetauscht, und die Stellung ist ruhig und ausgeglichen. Entwickle deinen letzten Springer, rochiere und wähle einen Plan: c4, um das Zentrum zu öffnen, oder e4, um Raum zu nehmen. Du kennst deine Figuren und lenkst die Partie.'
    }
  },
  {
    id: 'queens-gambit',
    eco: 'D50',
    side: 'w',
    name: {
      en: 'Queen’s Gambit',
      de: 'Damengambit'
    },
    idea: {
      en: 'Offer the c-pawn to pull Black’s d-pawn away and own the centre.',
      de: 'Den c-Bauern anbieten, um den d-Bauern wegzulocken und das Zentrum zu beherrschen.'
    },
    intro: {
      en: 'You offer a pawn, but not really. If Black takes it, you can win it straight back, and meanwhile Black’s centre pawn has been dragged off to the side. Games like this are slower and quieter than 1. e4 games: less chasing, more building.',
      de: 'Du bietest einen Bauern an, aber nicht wirklich. Wenn Schwarz zugreift, holst du ihn dir zurück, und der schwarze Zentrumsbauer ist unterwegs an den Rand gewandert. Solche Partien sind ruhiger als die nach 1. e4: weniger jagen, mehr aufbauen.'
    },
    pgn: '1. d4 d5 2. c4 e6 3. Nc3 Nf6 4. Bg5',
    moves: [
      {
        san: 'd4',
        en: 'The pawn takes the middle and is already guarded by your queen. It also opens a diagonal for your dark-squared bishop.',
        de: 'Der Bauer nimmt die Mitte und wird schon von deiner Dame gedeckt. Außerdem öffnet er die Diagonale für deinen schwarzfeldrigen Läufer.'
      },
      {
        san: 'd5',
        en: 'Black mirrors you and takes control of e4, so you cannot get two pawns side by side in the middle.',
        de: 'Schwarz spiegelt dich und kontrolliert e4, damit du nicht zwei Bauern nebeneinander ins Zentrum bekommst.'
      },
      {
        san: 'c4',
        en: 'Here is the offer. Take it, and your d-pawn leaves the centre it was guarding, which is exactly what you want. This is why it is barely a real gambit: the pawn usually comes back.',
        de: 'Hier ist das Angebot. Nimmst du es, verlässt dein d-Bauer das Zentrum, das er bewacht hat, und genau darum geht es. Deshalb ist es kaum ein echtes Gambit: Der Bauer kommt meistens zurück.'
      },
      {
        san: 'e6',
        en: 'Black says no thanks and props up d5 with a pawn instead. It is solid, but it shuts in the bishop on c8, and getting that piece out stays a problem for the rest of the game.',
        de: 'Schwarz lehnt ab und stützt d5 lieber mit einem Bauern. Solide, aber der Läufer auf c8 sitzt jetzt fest, und ihn wieder ins Spiel zu bringen bleibt das ganze Spiel über ein Problem.'
      },
      {
        san: 'Nc3',
        en: 'Develop, and lean on d5 a second time. The knight also covers e4, in case you ever want to push that pawn.',
        de: 'Entwickeln und ein zweites Mal Druck auf d5 machen. Der Springer deckt außerdem e4, falls du diesen Bauern später vorziehen willst.'
      },
      {
        san: 'Nf6',
        en: 'Black develops and defends d5 again, and stops you playing e4 at the same time.',
        de: 'Schwarz entwickelt sich, verteidigt d5 erneut und verhindert gleichzeitig dein e4.'
      },
      {
        san: 'Bg5',
        en: 'The bishop pins the knight to the queen behind it, and that knight is one of the pieces guarding d5. It cannot run away without leaving the queen in the open.',
        de: 'Der Läufer fesselt den Springer an die Dame dahinter, und dieser Springer ist einer der Verteidiger von d5. Er kann nicht weglaufen, ohne die Dame ungedeckt zu lassen.'
      }
    ],
    ending: {
      en: 'You own more of the centre than Black does, and the pinned knight is stuck guarding d5. Black is solid but cramped: that light-squared bishop still has nowhere good to go.',
      de: 'Dir gehört mehr vom Zentrum als Schwarz, und der gefesselte Springer klebt an der Verteidigung von d5. Schwarz steht solide, aber eng: Der weißfeldrige Läufer hat immer noch kein gutes Feld.'
    }
  },
  {
    id: 'queens-gambit-accepted',
    eco: 'D27',
    side: 'w',
    name: {
      en: 'Queen’s Gambit Accepted',
      de: 'Angenommenes Damengambit'
    },
    idea: {
      en: 'Black takes the pawn. You do not rush after it: develop, and it falls back into your hands.',
      de: 'Schwarz nimmt den Bauern. Du rennst ihm nicht hinterher: Erst entwickeln, dann fällt er dir von selbst wieder zu.'
    },
    intro: {
      en: 'The most common reply a beginner meets: Black simply takes the free pawn on c4. It is not a mistake, but it is not a gift either. Black cannot keep the pawn for long, and your pieces come out with tempo while Black tries.',
      de: 'Die häufigste Antwort, der du als Anfänger begegnest: Schwarz nimmt einfach den freien Bauern auf c4. Das ist kein Fehler, aber auch kein Geschenk. Schwarz kann den Bauern nicht lange halten, und deine Figuren kommen dabei mit Tempo ins Spiel.'
    },
    pgn: '1. d4 d5 2. c4 dxc4 3. Nf3 Nf6 4. e3 e6 5. Bxc4 c5 6. O-O a6',
    moves: [
      {
        san: 'd4',
        en: 'The pawn takes the middle and is already guarded by your queen. It also opens a diagonal for your dark-squared bishop.',
        de: 'Der Bauer nimmt die Mitte und wird schon von deiner Dame gedeckt. Außerdem öffnet er die Diagonale für deinen schwarzfeldrigen Läufer.'
      },
      {
        san: 'd5',
        en: 'Black mirrors you and takes control of e4, so you cannot get two pawns side by side in the middle.',
        de: 'Schwarz spiegelt dich und kontrolliert e4, damit du nicht zwei Bauern nebeneinander ins Zentrum bekommst.'
      },
      {
        san: 'c4',
        en: 'Here is the offer. Take it, and your d-pawn leaves the centre it was guarding, which is exactly what you want. This is why it is barely a real gambit: the pawn usually comes back.',
        de: 'Hier ist das Angebot. Nimmst du es, verlässt dein d-Bauer das Zentrum, das er bewacht hat, und genau darum geht es. Deshalb ist es kaum ein echtes Gambit: Der Bauer kommt meistens zurück.'
      },
      {
        san: 'dxc4',
        en: 'Black takes the pawn. For the moment Black is a pawn up, but that pawn has left the centre and cannot be held easily.',
        de: 'Schwarz nimmt den Bauern. Im Moment hat Schwarz einen Bauern mehr, aber der Bauer hat das Zentrum verlassen und lässt sich nur schwer halten.'
      },
      {
        san: 'Nf3',
        en: 'Develop first and win the pawn back later. The knight eyes the centre and gets you ready to castle, so there is no need to hurry after c4.',
        de: 'Erst entwickeln, den Bauern holst du später. Der Springer schaut aufs Zentrum und bereitet die Rochade vor, du musst also nicht gleich hinter c4 herjagen.'
      },
      {
        san: 'Nf6',
        en: 'Black develops too and keeps an eye on e4, so you cannot build a big pawn centre without a fight.',
        de: 'Schwarz entwickelt sich ebenfalls und behält e4 im Blick, du kannst dir also kein großes Bauernzentrum ohne Kampf aufbauen.'
      },
      {
        san: 'e3',
        en: 'A quiet pawn move with a clear job: it opens the diagonal for your light-squared bishop so it can take on c4, and it guards d4.',
        de: 'Ein ruhiger Bauernzug mit klarer Aufgabe: Er öffnet die Diagonale für deinen weißfeldrigen Läufer, damit er auf c4 nehmen kann, und deckt d4.'
      },
      {
        san: 'e6',
        en: 'Black opens a path for the dark-squared bishop and guards d5. The price is that the light-squared bishop on c8 is shut in behind the pawn again.',
        de: 'Schwarz öffnet den Weg für den schwarzfeldrigen Läufer und deckt d5. Der Preis: Der weißfeldrige Läufer auf c8 ist hinter dem Bauern wieder eingesperrt.'
      },
      {
        san: 'Bxc4',
        en: 'There is the pawn back. Your bishop lands on a fine diagonal, looking at e6 and f7, and nothing in your camp has been weakened.',
        de: 'Da ist der Bauer wieder. Dein Läufer landet auf einer schönen Diagonale mit Blick auf e6 und f7, und in deiner Stellung ist nichts schwächer geworden.'
      },
      {
        san: 'c5',
        en: 'Black hits your d4 pawn at once. Pushing a wing pawn into the centre is the usual way to fight for space instead of just defending.',
        de: 'Schwarz greift sofort deinen Bauern auf d4 an. Einen Flügelbauern ins Zentrum zu schieben ist der übliche Weg, um Raum zu kämpfen, statt nur zu verteidigen.'
      },
      {
        san: 'O-O',
        en: 'Castle. The king is safe and the rook is on its way to the middle. Your d4 pawn is guarded three times: by the e3 pawn, the knight and the queen.',
        de: 'Rochade. Der König ist sicher und der Turm kommt Richtung Mitte. Dein Bauer auf d4 ist dreifach gedeckt: vom Bauern auf e3, vom Springer und von der Dame.'
      },
      {
        san: 'a6',
        en: 'A useful waiting move. It stops a white piece landing on b5 and prepares ...b5, which would chase your bishop from c4.',
        de: 'Ein nützlicher Wartezug. Er verhindert, dass eine weiße Figur auf b5 landet, und bereitet ...b5 vor, womit der Läufer von c4 vertrieben würde.'
      }
    ],
    ending: {
      en: 'You got the pawn back with your pieces better placed, and you own more of the centre. The lesson: do not panic when a gambit pawn is taken. Develop, and take it back when it suits you.',
      de: 'Du hast den Bauern zurück und deine Figuren stehen besser, außerdem gehört dir mehr vom Zentrum. Die Lehre: Keine Panik, wenn der Gambitbauer genommen wird. Entwickle dich und hole ihn dir, wenn es passt.'
    }
  },
  {
    id: 'slav-defense',
    eco: 'D18',
    side: 'w',
    name: {
      en: 'Slav Defense',
      de: 'Slawische Verteidigung'
    },
    idea: {
      en: 'Black guards d5 with the c-pawn and keeps the light-squared bishop free.',
      de: 'Schwarz deckt d5 mit dem c-Bauern und hält den weißfeldrigen Läufer frei.'
    },
    intro: {
      en: 'A very solid answer to the Queen’s Gambit. Black protects d5 with a pawn from c6 instead of e6, so the bishop on c8 is not locked in. You will see this one a lot, because it is easy to learn and hard to crack.',
      de: 'Eine sehr solide Antwort auf das Damengambit. Schwarz deckt d5 mit dem Bauern von c6 statt von e6, damit der Läufer auf c8 nicht eingesperrt wird. Der kommt oft vor, weil er leicht zu lernen und schwer zu knacken ist.'
    },
    pgn: '1. d4 d5 2. c4 c6 3. Nf3 Nf6 4. Nc3 dxc4 5. a4 Bf5 6. e3 e6 7. Bxc4 Bb4',
    moves: [
      {
        san: 'd4',
        en: 'The pawn takes the middle and is already guarded by your queen. It also opens a diagonal for your dark-squared bishop.',
        de: 'Der Bauer nimmt die Mitte und wird schon von deiner Dame gedeckt. Außerdem öffnet er die Diagonale für deinen schwarzfeldrigen Läufer.'
      },
      {
        san: 'd5',
        en: 'Black mirrors you and takes control of e4, so you cannot get two pawns side by side in the middle.',
        de: 'Schwarz spiegelt dich und kontrolliert e4, damit du nicht zwei Bauern nebeneinander ins Zentrum bekommst.'
      },
      {
        san: 'c4',
        en: 'Here is the offer. Take it, and your d-pawn leaves the centre it was guarding, which is exactly what you want. This is why it is barely a real gambit: the pawn usually comes back.',
        de: 'Hier ist das Angebot. Nimmst du es, verlässt dein d-Bauer das Zentrum, das er bewacht hat, und genau darum geht es. Deshalb ist es kaum ein echtes Gambit: Der Bauer kommt meistens zurück.'
      },
      {
        san: 'c6',
        en: 'Black guards d5 with a pawn, but unlike ...e6 this does not lock in the bishop on c8. That is the whole idea of the Slav.',
        de: 'Schwarz deckt d5 mit einem Bauern, aber anders als ...e6 sperrt das den Läufer auf c8 nicht ein. Das ist der ganze Gedanke der Slawischen Verteidigung.'
      },
      {
        san: 'Nf3',
        en: 'Natural development. The knight eyes the centre and keeps e5 under control.',
        de: 'Natürliche Entwicklung. Der Springer schaut aufs Zentrum und kontrolliert e5.'
      },
      {
        san: 'Nf6',
        en: 'Black develops and keeps pressing on e4 so that you cannot easily take the centre with your e-pawn.',
        de: 'Schwarz entwickelt sich und übt weiter Druck auf e4 aus, damit du das Zentrum nicht einfach mit dem e-Bauern nehmen kannst.'
      },
      {
        san: 'Nc3',
        en: 'The second knight comes out and leans on d5 together with the c4 pawn. Now d5 is attacked twice and defended twice.',
        de: 'Der zweite Springer kommt heraus und drückt zusammen mit dem Bauern auf c4 auf d5. Jetzt wird d5 zweimal angegriffen und zweimal verteidigt.'
      },
      {
        san: 'dxc4',
        en: 'Black takes the pawn, hoping to hold it with ...b5. The pawn on c4 is not really safe, though.',
        de: 'Schwarz nimmt den Bauern und hofft, ihn mit ...b5 zu halten. Sicher ist der Bauer auf c4 aber nicht.'
      },
      {
        san: 'a4',
        en: 'The key move. It takes b5 away, so Black cannot defend the pawn on c4 with ...b5, and it is going to fall.',
        de: 'Der Schlüsselzug. Er nimmt b5 weg, damit Schwarz den Bauern auf c4 nicht mit ...b5 halten kann, und der Bauer wird fallen.'
      },
      {
        san: 'Bf5',
        en: 'Black’s bishop jumps outside the pawn chain before the pawn on e6 closes the door. It also watches e4, so you cannot play that pawn move for free.',
        de: 'Der schwarze Läufer springt vor die Bauernkette, bevor der Bauer auf e6 die Tür schließt. Er beobachtet auch e4, du kannst diesen Bauernzug also nicht umsonst machen.'
      },
      {
        san: 'e3',
        en: 'Now your own light-squared bishop gets its diagonal, so you can take back on c4. The pawn also guards d4 and f4.',
        de: 'Jetzt bekommt dein weißfeldriger Läufer seine Diagonale, du kannst also auf c4 zurücknehmen. Der Bauer deckt außerdem d4 und f4.'
      },
      {
        san: 'e6',
        en: 'Black closes the centre and opens the way for the dark-squared bishop. Because the c8 bishop is already outside, this does not hurt.',
        de: 'Schwarz schließt das Zentrum und macht den Weg für den schwarzfeldrigen Läufer frei. Weil der Läufer von c8 schon draußen ist, schadet das nicht.'
      },
      {
        san: 'Bxc4',
        en: 'The pawn is back, and your bishop looks straight at e6. You have more space in the middle and everything is developing smoothly.',
        de: 'Der Bauer ist zurück, und dein Läufer schaut direkt auf e6. Du hast mehr Raum in der Mitte, und alles entwickelt sich glatt.'
      },
      {
        san: 'Bb4',
        en: 'Black pins your knight on c3 against your king. That stops you from pushing e4 for now, and castling is the natural reply.',
        de: 'Schwarz nagelt deinen Springer auf c3 an deinen König fest. Damit kannst du vorerst nicht e4 spielen, und die Rochade ist die natürliche Antwort.'
      }
    ],
    ending: {
      en: 'You have the pawn back and a nice centre, while Black’s bishop is pinning your knight. Notice how Black’s bishop got out early: that is the whole point of the Slav, and it is why Black picked c6 instead of e6.',
      de: 'Du hast den Bauern zurück und ein schönes Zentrum, während der schwarze Läufer deinen Springer festnagelt. Beachte, wie früh der schwarze Läufer herauskam: Das ist der ganze Sinn der Slawischen Verteidigung und der Grund, warum Schwarz c6 statt e6 wählt.'
    }
  },
  {
    id: 'scandinavian-defense',
    eco: 'B01',
    side: 'b',
    name: {
      en: 'Scandinavian Defense',
      de: 'Skandinavische Verteidigung'
    },
    idea: {
      en: 'Challenge the e-pawn immediately. Little to memorise, and you almost always reach the same setup.',
      de: 'Den e-Bauern sofort angreifen. Wenig auswendig zu lernen, und du kommst fast immer zum selben Aufbau.'
    },
    intro: {
      en: 'You hit White’s centre pawn on move one, before developing anything. White almost always takes, and you win the pawn straight back with the queen. There is not much to memorise here, and you nearly always get the setup you wanted, which is why it suits players who are still learning.',
      de: 'Du greifst den weißen Zentrumsbauern schon im ersten Zug an, bevor du irgendetwas entwickelst. Weiß schlägt fast immer, und du holst dir den Bauern mit der Dame sofort zurück. Es gibt hier wenig auswendig zu lernen, und du bekommst fast immer den Aufbau, den du wolltest. Deshalb passt sie gut, wenn man noch lernt.'
    },
    pgn: '1. e4 d5 2. exd5 Qxd5 3. Nc3 Qa5 4. d4 Nf6',
    moves: [
      {
        san: 'e4',
        en: 'White starts in the middle: the pawn grabs a centre square and frees the queen and the light-squared bishop.',
        de: 'Weiß beginnt in der Mitte: Der Bauer nimmt ein Zentrumsfeld und macht Dame und weißfeldrigen Läufer frei.'
      },
      {
        san: 'd5',
        en: 'You go straight at it, on move one, before developing a single piece. White has to deal with this now.',
        de: 'Du gehst sofort dagegen vor, schon im ersten Zug, bevor du eine einzige Figur entwickelst. Weiß muss sich jetzt darum kümmern.'
      },
      {
        san: 'exd5',
        en: 'White takes, and almost everyone does. It is the only move that really tries for an advantage. White’s e-pawn has now left the board, which is good news for you: your pieces get room.',
        de: 'Weiß schlägt, und das machen fast alle. Es ist der einzige Zug, der wirklich auf Vorteil spielt. Der weiße e-Bauer ist damit vom Brett, und das ist gut für dich: Deine Figuren bekommen Platz.'
      },
      {
        san: 'Qxd5',
        en: 'You take the pawn back at once. Yes, this is the queen coming out early, which you have probably been told not to do. Here it is the price of the opening: you lose a little time, and you get an easy, free position in return.',
        de: 'Du holst dir den Bauern sofort zurück. Und ja, das ist die Dame früh im Spiel, wovon man dir wahrscheinlich abgeraten hat. Hier ist es der Preis der Eröffnung: Du verlierst etwas Zeit und bekommst dafür eine freie, bequeme Stellung.'
      },
      {
        san: 'Nc3',
        en: 'This is where White collects that time back: the knight develops and attacks your queen in the same move, so you have to react.',
        de: 'Hier holt sich Weiß die Zeit zurück: Der Springer entwickelt sich und greift dabei deine Dame an. Du musst reagieren.'
      },
      {
        san: 'Qa5',
        en: 'The queen steps aside to a square where she is doing something. From a5 she looks down the diagonal at e1, and the moment White plays d4, the knight on c3 is pinned in front of the king.',
        de: 'Die Dame weicht auf ein Feld aus, wo sie etwas tut. Von a5 schaut sie die Diagonale bis e1 hinunter, und sobald Weiß d4 spielt, ist der Springer auf c3 vor dem König gefesselt.'
      },
      {
        san: 'd4',
        en: 'White builds the big centre. It is the natural move, and it is also the one that opens your diagonal and switches your pin on.',
        de: 'Weiß baut das große Zentrum. Das ist der natürliche Zug, und zugleich der, der deine Diagonale öffnet und deine Fesselung scharf schaltet.'
      },
      {
        san: 'Nf6',
        en: 'Develop, and cover d5 so the white knight cannot jump there and chase your queen again.',
        de: 'Entwickeln und d5 decken, damit der weiße Springer nicht dorthin springt und deine Dame erneut jagt.'
      }
    ],
    ending: {
      en: 'You gave up a little time on move one, and here is what it bought: the pawn is back, the queen is active on a5, and your pieces have room. Next, get the bishop out, castle and bring the rooks to the centre.',
      de: 'Am Anfang hast du etwas Zeit gegeben, und das hat es dir gebracht: Der Bauer ist zurück, die Dame steht aktiv auf a5 und deine Figuren haben Platz. Als Nächstes den Läufer entwickeln, rochieren und die Türme ins Zentrum bringen.'
    }
  },
  {
    id: 'scandinavian-queen-d6',
    eco: 'B01',
    side: 'b',
    name: {
      en: 'Scandinavian: Queen to d6',
      de: 'Skandinavisch: Dame nach d6'
    },
    idea: {
      en: 'After Nc3, the queen retreats to d6 instead of a5, and a6 takes b5 away from the white knight.',
      de: 'Nach Sc3 zieht die Dame nach d6 statt nach a5, und a6 nimmt dem weißen Springer das Feld b5.'
    },
    intro: {
      en: 'The queen has to move when the knight hits it, and a5 is not the only choice. On d6 the queen stays closer to the centre and is not as easy to chase. The price is that you must watch for knight jumps to b5.',
      de: 'Die Dame muss ziehen, wenn der Springer sie angreift, und a5 ist nicht die einzige Wahl. Auf d6 bleibt die Dame näher am Zentrum und ist schwerer zu jagen. Dafür musst du auf Springersprünge nach b5 achten.'
    },
    pgn: '1. e4 d5 2. exd5 Qxd5 3. Nc3 Qd6 4. d4 Nf6 5. Nf3 a6 6. h3 Bf5 7. Bd3 Bxd3 8. Qxd3 e6',
    moves: [
      {
        san: 'e4',
        en: 'White starts in the middle: the pawn grabs a centre square and frees the queen and the light-squared bishop.',
        de: 'Weiß beginnt in der Mitte: Der Bauer nimmt ein Zentrumsfeld und macht Dame und weißfeldrigen Läufer frei.'
      },
      {
        san: 'd5',
        en: 'You go straight at it, on move one, before developing a single piece. White has to deal with this now.',
        de: 'Du gehst sofort dagegen vor, schon im ersten Zug, bevor du eine einzige Figur entwickelst. Weiß muss sich jetzt darum kümmern.'
      },
      {
        san: 'exd5',
        en: 'White takes, and almost everyone does. It is the only move that really tries for an advantage. White’s e-pawn has now left the board, which is good news for you: your pieces get room.',
        de: 'Weiß schlägt, und das machen fast alle. Es ist der einzige Zug, der wirklich auf Vorteil spielt. Der weiße e-Bauer ist damit vom Brett, und das ist gut für dich: Deine Figuren bekommen Platz.'
      },
      {
        san: 'Qxd5',
        en: 'You take the pawn back at once. Yes, this is the queen coming out early, which you have probably been told not to do. Here it is the price of the opening: you lose a little time, and you get an easy, free position in return.',
        de: 'Du holst dir den Bauern sofort zurück. Und ja, das ist die Dame früh im Spiel, wovon man dir wahrscheinlich abgeraten hat. Hier ist es der Preis der Eröffnung: Du verlierst etwas Zeit und bekommst dafür eine freie, bequeme Stellung.'
      },
      {
        san: 'Nc3',
        en: 'This is where White collects that time back: the knight develops and attacks your queen in the same move, so you have to react.',
        de: 'Hier holt sich Weiß die Zeit zurück: Der Springer entwickelt sich und greift dabei deine Dame an. Du musst reagieren.'
      },
      {
        san: 'Qd6',
        en: 'The queen steps back to d6. It stays near the centre and eyes the b4 and g3 squares, but watch out for a knight coming to b5.',
        de: 'Die Dame zieht nach d6 zurück. Sie bleibt nah am Zentrum und schaut auf b4 und g3, aber ein Springer auf b5 wäre gefährlich.'
      },
      {
        san: 'd4',
        en: 'White grabs the centre and is ahead in development. You will have to be careful and solid.',
        de: 'Weiß nimmt das Zentrum und liegt in der Entwicklung vorn. Du musst jetzt vorsichtig und solide spielen.'
      },
      {
        san: 'Nf6',
        en: 'Develop a piece with a clear purpose: it hits the e4 pawn and gets ready to castle.',
        de: 'Entwickle eine Figur mit klarem Ziel: Sie greift den Bauern auf e4 an und bereitet die Rochade vor.'
      },
      {
        san: 'Nf3',
        en: 'White develops too and guards the centre.',
        de: 'Weiß entwickelt sich ebenfalls und deckt das Zentrum.'
      },
      {
        san: 'a6',
        en: 'A quiet but important move. It takes b5 away from the white knight, because a knight on b5 would hit your queen and the c7 pawn at the same time.',
        de: 'Ein ruhiger, aber wichtiger Zug. Er nimmt dem weißen Springer das Feld b5, denn ein Springer auf b5 würde gleichzeitig deine Dame und den Bauern auf c7 angreifen.'
      },
      {
        san: 'h3',
        en: 'White stops your bishop from jumping to g4, where it would pin the f3 knight.',
        de: 'Weiß verhindert, dass dein Läufer nach g4 springt, wo er den Springer auf f3 festnageln würde.'
      },
      {
        san: 'Bf5',
        en: 'The bishop still gets out. Bring it outside before you ever play ...e6, otherwise it is locked in.',
        de: 'Der Läufer kommt trotzdem heraus. Bring ihn nach draußen, bevor du ...e6 spielst, sonst ist er eingesperrt.'
      },
      {
        san: 'Bd3',
        en: 'White offers the bishops for a trade.',
        de: 'Weiß bietet den Läufertausch an.'
      },
      {
        san: 'Bxd3',
        en: 'Trade them. White’s bishop was a dangerous attacker, so you are glad to swap it off.',
        de: 'Tausche sie. Der weiße Läufer war ein gefährlicher Angreifer, daher bist du froh, wenn er verschwindet.'
      },
      {
        san: 'Qxd3',
        en: 'White takes back with the queen.',
        de: 'Weiß nimmt mit der Dame zurück.'
      },
      {
        san: 'e6',
        en: 'Now the pawn can close the centre. Your dark-squared bishop gets out, and you are ready to castle.',
        de: 'Jetzt darf der Bauer das Zentrum schließen. Dein schwarzfeldriger Läufer kommt heraus, und du kannst rochieren.'
      }
    ],
    ending: {
      en: 'Your pieces are out, the bishop trade took away White’s most dangerous attacker, and you are ready to castle. Black is a little behind in space, but there is nothing to worry about.',
      de: 'Deine Figuren sind draußen, der Läufertausch hat Weiß den gefährlichsten Angreifer genommen, und du kannst bald rochieren. Schwarz hat etwas weniger Raum, aber das ist kein Grund zur Sorge.'
    }
  },
  {
    id: 'scandinavian-modern',
    eco: 'B01',
    side: 'b',
    name: {
      en: 'Scandinavian: Modern Variation',
      de: 'Skandinavisch: Moderne Variante'
    },
    idea: {
      en: 'Recapture with the knight, not the queen, and the queen stays at home.',
      de: 'Nimm mit dem Springer zurück statt mit der Dame, dann bleibt die Dame zu Hause.'
    },
    intro: {
      en: 'There is another way to recapture on d5. If you let the knight come to f6 first, you win back the pawn with the knight and the queen never has to run from white pieces. You lose no time, but White gets a pawn centre.',
      de: 'Es gibt noch einen anderen Weg, auf d5 zurückzunehmen. Lässt du den Springer zuerst nach f6 gehen, holst du den Bauern mit dem Springer zurück, und die Dame muss nie vor weißen Figuren weglaufen. Du verlierst keine Zeit, aber Weiß bekommt ein Bauernzentrum.'
    },
    pgn: '1. e4 d5 2. exd5 Nf6 3. d4 Nxd5 4. Nf3 g6 5. Be2 Bg7 6. O-O O-O 7. c4 Nb6',
    moves: [
      {
        san: 'e4',
        en: 'White starts in the middle: the pawn grabs a centre square and frees the queen and the light-squared bishop.',
        de: 'Weiß beginnt in der Mitte: Der Bauer nimmt ein Zentrumsfeld und macht Dame und weißfeldrigen Läufer frei.'
      },
      {
        san: 'd5',
        en: 'You go straight at it, on move one, before developing a single piece. White has to deal with this now.',
        de: 'Du gehst sofort dagegen vor, schon im ersten Zug, bevor du eine einzige Figur entwickelst. Weiß muss sich jetzt darum kümmern.'
      },
      {
        san: 'exd5',
        en: 'White takes, and almost everyone does. It is the only move that really tries for an advantage. White’s e-pawn has now left the board, which is good news for you: your pieces get room.',
        de: 'Weiß schlägt, und das machen fast alle. Es ist der einzige Zug, der wirklich auf Vorteil spielt. Der weiße e-Bauer ist damit vom Brett, und das ist gut für dich: Deine Figuren bekommen Platz.'
      },
      {
        san: 'Nf6',
        en: 'Black does not take back with the queen this time. The knight attacks the pawn on d5, and the queen can stay at home.',
        de: 'Diesmal nimmt Schwarz nicht mit der Dame zurück. Der Springer greift den Bauern auf d5 an, und die Dame kann zu Hause bleiben.'
      },
      {
        san: 'd4',
        en: 'White takes the centre and opens a line for the dark-squared bishop. The d5 pawn is still hanging.',
        de: 'Weiß nimmt das Zentrum und öffnet eine Linie für den schwarzfeldrigen Läufer. Der Bauer auf d5 hängt immer noch.'
      },
      {
        san: 'Nxd5',
        en: 'Now the pawn is back with the knight. You did it without moving the queen, so you lost no time.',
        de: 'Jetzt ist der Bauer mit dem Springer zurückgeholt. Das ging ohne Damenzug, du hast also keine Zeit verloren.'
      },
      {
        san: 'Nf3',
        en: 'White develops and guards d4 and e5.',
        de: 'Weiß entwickelt sich und deckt d4 und e5.'
      },
      {
        san: 'g6',
        en: 'Get ready to fianchetto: the bishop will go to g7 and shoot down the long diagonal at the white centre.',
        de: 'Mach dich für das Fianchetto bereit: Der Läufer geht nach g7 und schießt über die lange Diagonale auf das weiße Zentrum.'
      },
      {
        san: 'Be2',
        en: 'A quiet developing move that prepares castling.',
        de: 'Ein ruhiger Entwicklungszug, der die Rochade vorbereitet.'
      },
      {
        san: 'Bg7',
        en: 'The bishop eyes d4 and the whole long diagonal.',
        de: 'Der Läufer zielt auf d4 und die ganze lange Diagonale.'
      },
      {
        san: 'O-O',
        en: 'White castles.',
        de: 'Weiß rochiert.'
      },
      {
        san: 'O-O',
        en: 'You castle too, and your king is safe behind the fianchetto bishop.',
        de: 'Du rochierst auch, und dein König steht sicher hinter dem Läufer im Fianchetto.'
      },
      {
        san: 'c4',
        en: 'White chases your knight and takes more space.',
        de: 'Weiß jagt deinen Springer und nimmt mehr Raum.'
      },
      {
        san: 'Nb6',
        en: 'The knight retreats to a safe square and eyes the c4 pawn. White’s centre is big, but now it has something to defend.',
        de: 'Der Springer zieht sich auf ein sicheres Feld zurück und schaut auf den Bauern c4. Das weiße Zentrum ist groß, aber jetzt muss Weiß etwas verteidigen.'
      }
    ],
    ending: {
      en: 'You have a solid, flexible position. The bishop on g7 looks down the long diagonal and the king is castled. White has more space, but that centre can become a target, and you can hit it with the c-pawn or the knights.',
      de: 'Du hast eine solide, flexible Stellung. Der Läufer auf g7 schaut über die lange Diagonale, und der König ist rochiert. Weiß hat mehr Raum, aber dieses Zentrum kann zum Ziel werden, und du kannst es mit dem c-Bauern oder den Springern angreifen.'
    }
  },
  {
    id: 'caro-kann',
    eco: 'B18',
    side: 'b',
    name: {
      en: 'Caro-Kann Defense',
      de: 'Caro-Kann-Verteidigung'
    },
    idea: {
      en: 'Back up the d-pawn with the c-pawn first, so the bishop can still escape to f5.',
      de: 'Den d-Bauern zuerst mit dem c-Bauern stützen: So kommt der Läufer noch nach f5 heraus.'
    },
    intro: {
      en: 'A solid, sensible defence, and Karpov’s favourite for years. The whole point is in the very first move: you prepare d5 with the c-pawn instead of the e-pawn, so your light-squared bishop still has a way out. It costs you a little time, and this is what you buy with it.',
      de: 'Eine solide, vernünftige Verteidigung. Jahrelang war sie Karpows Lieblingswaffe. Der ganze Witz steckt schon im ersten Zug: Du bereitest d5 mit dem c-Bauern vor statt mit dem e-Bauern, damit dein weißfeldriger Läufer noch herauskommt. Das kostet ein bisschen Zeit, und das hier bekommst du dafür.'
    },
    pgn: '1. e4 c6 2. d4 d5 3. Nc3 dxe4 4. Nxe4 Bf5',
    moves: [
      {
        san: 'e4',
        en: 'White starts in the middle: the pawn grabs a centre square and frees the queen and the light-squared bishop.',
        de: 'Weiß beginnt in der Mitte: Der Bauer nimmt ein Zentrumsfeld und macht Dame und weißfeldrigen Läufer frei.'
      },
      {
        san: 'c6',
        en: 'A quiet-looking move that is the entire idea. You are getting ready to play d5 with a pawn behind it. Unlike the French, you are not walling your own bishop in to do it.',
        de: 'Ein unscheinbarer Zug, der die ganze Idee enthält. Du bereitest d5 vor, mit einem Bauern im Rücken. Anders als in der Französischen mauerst du dafür deinen eigenen Läufer nicht ein.'
      },
      {
        san: 'd4',
        en: 'White takes the whole centre. If you let someone put two pawns in the middle, they will.',
        de: 'Weiß nimmt das ganze Zentrum. Wenn man jemanden zwei Bauern in die Mitte stellen lässt, tut er es auch.'
      },
      {
        san: 'd5',
        en: 'Now the move you prepared. You hit the e4 pawn, and if White trades you take back with the c-pawn, which is why c6 came first.',
        de: 'Jetzt der vorbereitete Zug. Du greifst den Bauern auf e4 an. Wenn Weiß tauscht, schlägst du mit dem c-Bauern zurück. Genau dafür kam c6 zuerst.'
      },
      {
        san: 'Nc3',
        en: 'White develops the knight and gets it ready to recapture on e4.',
        de: 'Weiß entwickelt den Springer und macht ihn bereit, auf e4 zurückzuschlagen.'
      },
      {
        san: 'dxe4',
        en: 'You take, and White’s big centre is gone. One pawn instead of two.',
        de: 'Du schlägst, und das große weiße Zentrum ist weg. Ein Bauer statt zwei.'
      },
      {
        san: 'Nxe4',
        en: 'White takes back with the knight, which lands on a central square in front of you.',
        de: 'Weiß schlägt mit dem Springer zurück, der auf einem Zentrumsfeld vor dir landet.'
      },
      {
        san: 'Bf5',
        en: 'And out it comes. This is the bishop the French Defence never gets to move. Here it steps outside first and attacks the knight on the way. Only now will you play e6, with the door already open.',
        de: 'Und heraus kommt er. Das ist der Läufer, den die Französische Verteidigung nie bewegen darf. Hier geht er zuerst nach draußen und greift dabei den Springer an. Erst jetzt spielst du e6, wenn die Tür schon offen ist.'
      }
    ],
    ending: {
      en: 'This is called the Classical, and you can see why people trust it: White has no big centre left, your pawns are all in one piece, and the bishop that usually gets stuck is standing outside on f5 doing a job. That is what the little move c6 was for.',
      de: 'Das nennt man die Klassische Variante, und man sieht, warum ihr so viele vertrauen: Weiß hat kein großes Zentrum mehr, deine Bauern stehen alle heil da, und der Läufer, der sonst feststeckt, steht draußen auf f5 und arbeitet. Dafür war der kleine Zug c6 gut.'
    }
  },
  {
    id: 'caro-kann-advance',
    eco: 'B12',
    side: 'b',
    name: {
      en: 'Caro-Kann: Advance Variation',
      de: 'Caro-Kann: Vorstoß-Variante'
    },
    idea: {
      en: 'Get the bishop out before the pawns close, then attack the base of White’s pawn chain.',
      de: 'Bring den Läufer heraus, bevor die Bauern schließen, und greife dann die Basis der weißen Bauernkette an.'
    },
    intro: {
      en: 'Instead of taking on d5, White pushes the e-pawn forward and shuts the centre. It gains space, but that pawn can later become a target. Black’s plan is easy to remember: bishop out first, then hit the base of the pawn chain.',
      de: 'Statt auf d5 zu schlagen, schiebt Weiß den e-Bauern vor und schließt das Zentrum. Das gewinnt Raum, aber der Bauer kann später zum Ziel werden. Der Plan für Schwarz ist leicht zu merken: erst den Läufer heraus, dann die Basis der Bauernkette angreifen.'
    },
    pgn: '1. e4 c6 2. d4 d5 3. e5 Bf5 4. Nf3 e6 5. Be2 c5 6. Be3 cxd4 7. Nxd4 Nc6',
    moves: [
      {
        san: 'e4',
        en: 'White starts in the middle: the pawn grabs a centre square and frees the queen and the light-squared bishop.',
        de: 'Weiß beginnt in der Mitte: Der Bauer nimmt ein Zentrumsfeld und macht Dame und weißfeldrigen Läufer frei.'
      },
      {
        san: 'c6',
        en: 'A quiet-looking move that is the entire idea. You are getting ready to play d5 with a pawn behind it. Unlike the French, you are not walling your own bishop in to do it.',
        de: 'Ein unscheinbarer Zug, der die ganze Idee enthält. Du bereitest d5 vor, mit einem Bauern im Rücken. Anders als in der Französischen mauerst du dafür deinen eigenen Läufer nicht ein.'
      },
      {
        san: 'd4',
        en: 'White takes the whole centre. If you let someone put two pawns in the middle, they will.',
        de: 'Weiß nimmt das ganze Zentrum. Wenn man jemanden zwei Bauern in die Mitte stellen lässt, tut er es auch.'
      },
      {
        san: 'd5',
        en: 'Now the move you prepared. You hit the e4 pawn, and if White trades you take back with the c-pawn, which is why c6 came first.',
        de: 'Jetzt der vorbereitete Zug. Du greifst den Bauern auf e4 an. Wenn Weiß tauscht, schlägst du mit dem c-Bauern zurück. Genau dafür kam c6 zuerst.'
      },
      {
        san: 'e5',
        en: 'White pushes the pawn and takes space. The centre is closed now, and your light-squared bishop would be stuck behind the pawns if you are not careful.',
        de: 'Weiß schiebt den Bauern vor und nimmt Raum. Das Zentrum ist jetzt geschlossen, und dein weißfeldriger Läufer würde hinter den Bauern festsitzen, wenn du nicht aufpasst.'
      },
      {
        san: 'Bf5',
        en: 'The signature move. Bring the bishop outside the pawn chain before you play ...e6 to close the door behind it.',
        de: 'Der typische Zug. Bring den Läufer vor die Bauernkette, bevor du mit ...e6 die Tür hinter ihm schließt.'
      },
      {
        san: 'Nf3',
        en: 'White develops and guards the e5 pawn.',
        de: 'Weiß entwickelt sich und deckt den Bauern auf e5.'
      },
      {
        san: 'e6',
        en: 'Now it is safe to close the chain. Your bishop is outside, the structure is solid, and the dark-squared bishop gets out too.',
        de: 'Jetzt kannst du die Kette gefahrlos schließen. Dein Läufer steht draußen, die Struktur ist solide, und der schwarzfeldrige Läufer kommt auch heraus.'
      },
      {
        san: 'Be2',
        en: 'White develops and gets ready to castle.',
        de: 'Weiß entwickelt sich und bereitet die Rochade vor.'
      },
      {
        san: 'c5',
        en: 'Hit the base. When a pawn chain is pushed forward, the way to fight it is to attack the pawn at its bottom: here the d4 pawn.',
        de: 'Greif die Basis an. Wenn eine Bauernkette vorgeschoben ist, bekämpft man sie am besten am unteren Ende: hier am Bauern d4.'
      },
      {
        san: 'Be3',
        en: 'White supports d4 with the bishop.',
        de: 'Weiß stützt d4 mit dem Läufer.'
      },
      {
        san: 'cxd4',
        en: 'You trade pawns and open the c-file for your rook.',
        de: 'Du tauschst die Bauern und öffnest die c-Linie für deinen Turm.'
      },
      {
        san: 'Nxd4',
        en: 'White takes back with the knight, which now sits in the middle.',
        de: 'Weiß nimmt mit dem Springer zurück, der jetzt in der Mitte steht.'
      },
      {
        san: 'Nc6',
        en: 'You develop with tempo, because the knight attacks the knight on d4.',
        de: 'Du entwickelst mit Tempo, denn der Springer greift den Springer auf d4 an.'
      }
    ],
    ending: {
      en: 'Your bishop is outside the pawn chain, you have opened the c-file and your knight is hitting the centre. White’s space advantage is real, but the e5 pawn needs constant care. That is the typical way to play against an advanced pawn.',
      de: 'Dein Läufer steht draußen vor der Bauernkette, die c-Linie ist offen, und dein Springer greift das Zentrum an. Der Raumvorteil von Weiß ist echt, aber der Bauer auf e5 braucht ständige Pflege. So spielt man typischerweise gegen einen vorgerückten Bauern.'
    }
  },
  {
    id: 'caro-kann-panov',
    eco: 'B14',
    side: 'b',
    name: {
      en: 'Caro-Kann: Panov Attack',
      de: 'Caro-Kann: Panov-Angriff'
    },
    idea: {
      en: 'White trades pawns and then attacks d5 with c4. Black defends it with pieces and pawns.',
      de: 'Weiß tauscht die Bauern und greift dann mit c4 auf d5 an. Schwarz verteidigt mit Figuren und Bauern.'
    },
    intro: {
      en: 'White takes on d5 and then strikes at the centre again with c4. The game becomes open and sharp. Count the attackers and defenders on d5, and develop quickly.',
      de: 'Weiß schlägt auf d5 und greift das Zentrum danach mit c4 erneut an. Die Partie wird offen und scharf. Zähle die Angreifer und Verteidiger auf d5 und entwickle dich schnell.'
    },
    pgn: '1. e4 c6 2. d4 d5 3. exd5 cxd5 4. c4 Nf6 5. Nc3 e6 6. Nf3 Be7 7. cxd5 Nxd5',
    moves: [
      {
        san: 'e4',
        en: 'White starts in the middle: the pawn grabs a centre square and frees the queen and the light-squared bishop.',
        de: 'Weiß beginnt in der Mitte: Der Bauer nimmt ein Zentrumsfeld und macht Dame und weißfeldrigen Läufer frei.'
      },
      {
        san: 'c6',
        en: 'A quiet-looking move that is the entire idea. You are getting ready to play d5 with a pawn behind it. Unlike the French, you are not walling your own bishop in to do it.',
        de: 'Ein unscheinbarer Zug, der die ganze Idee enthält. Du bereitest d5 vor, mit einem Bauern im Rücken. Anders als in der Französischen mauerst du dafür deinen eigenen Läufer nicht ein.'
      },
      {
        san: 'd4',
        en: 'White takes the whole centre. If you let someone put two pawns in the middle, they will.',
        de: 'Weiß nimmt das ganze Zentrum. Wenn man jemanden zwei Bauern in die Mitte stellen lässt, tut er es auch.'
      },
      {
        san: 'd5',
        en: 'Now the move you prepared. You hit the e4 pawn, and if White trades you take back with the c-pawn, which is why c6 came first.',
        de: 'Jetzt der vorbereitete Zug. Du greifst den Bauern auf e4 an. Wenn Weiß tauscht, schlägst du mit dem c-Bauern zurück. Genau dafür kam c6 zuerst.'
      },
      {
        san: 'exd5',
        en: 'White trades the e-pawn for your d-pawn, which opens the e-file.',
        de: 'Weiß tauscht den e-Bauern gegen deinen d-Bauern, damit öffnet sich die e-Linie.'
      },
      {
        san: 'cxd5',
        en: 'You take back with the c-pawn. You have a pawn in the centre again.',
        de: 'Du nimmst mit dem c-Bauern zurück. Damit hast du wieder einen Bauern im Zentrum.'
      },
      {
        san: 'c4',
        en: 'The Panov Attack. White hits the d5 pawn with a second pawn and opens the game up.',
        de: 'Der Panov-Angriff. Weiß greift den Bauern d5 mit einem zweiten Bauern an und öffnet das Spiel.'
      },
      {
        san: 'Nf6',
        en: 'You develop and defend d5 at once. The knight also keeps an eye on e4.',
        de: 'Du entwickelst dich und deckst d5 gleichzeitig. Der Springer behält auch e4 im Blick.'
      },
      {
        san: 'Nc3',
        en: 'White piles up on d5. Now it is attacked twice.',
        de: 'Weiß verstärkt den Druck auf d5. Jetzt wird es zweimal angegriffen.'
      },
      {
        san: 'e6',
        en: 'A second defender for d5, and it opens the way for the dark-squared bishop.',
        de: 'Ein zweiter Verteidiger für d5, und der schwarzfeldrige Läufer bekommt freie Bahn.'
      },
      {
        san: 'Nf3',
        en: 'White develops another piece.',
        de: 'Weiß entwickelt eine weitere Figur.'
      },
      {
        san: 'Be7',
        en: 'You get ready to castle. Develop first and keep it simple.',
        de: 'Du bereitest die Rochade vor. Erst entwickeln, und es einfach halten.'
      },
      {
        san: 'cxd5',
        en: 'White takes on d5, hoping for an open game.',
        de: 'Weiß schlägt auf d5 und hofft auf ein offenes Spiel.'
      },
      {
        san: 'Nxd5',
        en: 'You take back with the knight. It sits in the centre where it is strong, and no pieces are hanging.',
        de: 'Du nimmst mit dem Springer zurück. Er steht stark im Zentrum, und keine Figur hängt.'
      }
    ],
    ending: {
      en: 'You have won the fight for d5: the pawn is gone, your knight sits there, and all your pieces are developing. White’s pieces are active too, so the game is level and open. Castle soon, and keep an eye on the d4 pawn, a typical target.',
      de: 'Du hast den Kampf um d5 gewonnen: Der Bauer ist weg, dein Springer steht dort, und alle deine Figuren entwickeln sich. Auch die weißen Figuren sind aktiv, die Partie ist also gleich und offen. Rochiere bald und behalte den Bauern auf d4 im Auge, ein typisches Ziel.'
    }
  },
  {
    id: 'french-defense',
    eco: 'C17',
    side: 'b',
    name: {
      en: 'French Defense',
      de: 'Französische Verteidigung'
    },
    idea: {
      en: 'Build a solid pawn chain, then attack White’s at its base with c5.',
      de: 'Eine feste Bauernkette bauen und dann die weiße an ihrer Basis mit c5 angreifen.'
    },
    intro: {
      en: 'A tough, stubborn defence. You build a wall of pawns, let White have more room for a while, and then start chipping away at the bottom of White’s pawns with c5. One warning up front: your light-squared bishop gets shut in early, and finding a job for it is the puzzle of the French.',
      de: 'Eine zähe, hartnäckige Verteidigung. Du baust eine Mauer aus Bauern, lässt Weiß eine Weile mehr Platz und knabberst dann mit c5 unten an den weißen Bauern. Eine Warnung vorweg: Dein weißfeldriger Läufer wird früh eingesperrt, und eine Aufgabe für ihn zu finden ist das Rätsel der Französischen.'
    },
    pgn: '1. e4 e6 2. d4 d5 3. Nc3 Bb4 4. e5 c5',
    moves: [
      {
        san: 'e4',
        en: 'White starts in the middle: the pawn grabs a centre square and frees the queen and the light-squared bishop.',
        de: 'Weiß beginnt in der Mitte: Der Bauer nimmt ein Zentrumsfeld und macht Dame und weißfeldrigen Läufer frei.'
      },
      {
        san: 'e6',
        en: 'A small step that makes room for d5 next move, with a pawn ready behind it. Be honest about the cost: it shuts the door on your light-squared bishop, and getting that piece out is the puzzle of this whole opening.',
        de: 'Ein kleiner Schritt, der d5 im nächsten Zug möglich macht, mit einem Bauern im Rücken. Der Preis, ehrlich gesagt: Er sperrt deinen weißfeldrigen Läufer ein, und diese Figur herauszubekommen ist das Rätsel der ganzen Eröffnung.'
      },
      {
        san: 'd4',
        en: 'White puts a second pawn in the middle and opens lines for the pieces.',
        de: 'Weiß stellt einen zweiten Bauern in die Mitte und öffnet Linien für die Figuren.'
      },
      {
        san: 'd5',
        en: 'The move you prepared. You go straight at e4, and now White has to decide what to do with that pawn.',
        de: 'Der vorbereitete Zug. Du gehst direkt auf e4 los. Jetzt muss Weiß entscheiden, was mit diesem Bauern passiert.'
      },
      {
        san: 'Nc3',
        en: 'White develops and defends the e4 pawn with the knight.',
        de: 'Weiß entwickelt sich und deckt den Bauern auf e4 mit dem Springer.'
      },
      {
        san: 'Bb4',
        en: 'Pin it. The knight on c3 is stuck in front of its king and cannot move, and that knight was the one guarding e4. So the pawn is suddenly not really defended at all.',
        de: 'Fesseln. Der Springer auf c3 steht vor seinem König fest und kann nicht weg, und genau dieser Springer hat e4 gedeckt. Der Bauer ist damit plötzlich gar nicht mehr richtig verteidigt.'
      },
      {
        san: 'e5',
        en: 'So White pushes the pawn out of trouble instead of defending it. It gains space and locks the centre. It builds a chain, with the pawn on e5 leaning on the one on d4.',
        de: 'Also schiebt Weiß den Bauern aus der Gefahr, statt ihn zu decken. Das bringt Raum und schließt das Zentrum. Es entsteht eine Kette: Der Bauer auf e5 stützt sich auf den auf d4.'
      },
      {
        san: 'c5',
        en: 'Now hit that chain where it is weakest. The pawn on e5 is protected by the one on d4, but d4 has no pawn helping it. Knock the bottom one out and the top one has nothing to stand on.',
        de: 'Jetzt die Kette dort treffen, wo sie am schwächsten ist. Der Bauer auf e5 wird von dem auf d4 gedeckt, aber d4 selbst hilft kein Bauer. Nimm den unteren weg, und der obere steht auf nichts mehr.'
      }
    ],
    ending: {
      en: 'This is the Winawer. White has more space in the middle, your bishop still pins the knight, and your pawn is chewing at the bottom of White’s chain. Your side of the board is the queenside. That is where your play comes from.',
      de: 'Das ist die Winawer-Variante. Weiß hat mehr Raum in der Mitte, dein Läufer fesselt weiter den Springer, und dein Bauer nagt unten an der weißen Kette. Deine Seite des Bretts ist der Damenflügel. Von dort kommt dein Spiel.'
    }
  },
  {
    id: 'french-tarrasch',
    eco: 'C05',
    side: 'b',
    name: {
      en: 'French: Tarrasch Variation',
      de: 'Französisch: Tarrasch-Variante'
    },
    idea: {
      en: 'White avoids the pin with Nd2. Black attacks the base of the pawn chain with ...c5.',
      de: 'Weiß vermeidet die Fesselung mit Sd2. Schwarz greift die Basis der Kette mit ...c5 an.'
    },
    intro: {
      en: 'A very popular way for White to avoid the pin on c3. The knight goes to d2 instead, which keeps the c-pawn free to support the centre. Black’s plan is the usual one in the French: hit d4 with ...c5.',
      de: 'Ein sehr beliebter Weg für Weiß, die Fesselung auf c3 zu vermeiden. Der Springer geht stattdessen nach d2, so bleibt der c-Bauer frei, um das Zentrum zu stützen. Der Plan von Schwarz ist der übliche im Französischen: d4 mit ...c5 angreifen.'
    },
    pgn: '1. e4 e6 2. d4 d5 3. Nd2 Nf6 4. e5 Nfd7 5. Bd3 c5 6. c3 Nc6',
    moves: [
      {
        san: 'e4',
        en: 'White starts in the middle: the pawn grabs a centre square and frees the queen and the light-squared bishop.',
        de: 'Weiß beginnt in der Mitte: Der Bauer nimmt ein Zentrumsfeld und macht Dame und weißfeldrigen Läufer frei.'
      },
      {
        san: 'e6',
        en: 'A small step that makes room for d5 next move, with a pawn ready behind it. Be honest about the cost: it shuts the door on your light-squared bishop, and getting that piece out is the puzzle of this whole opening.',
        de: 'Ein kleiner Schritt, der d5 im nächsten Zug möglich macht, mit einem Bauern im Rücken. Der Preis, ehrlich gesagt: Er sperrt deinen weißfeldrigen Läufer ein, und diese Figur herauszubekommen ist das Rätsel der ganzen Eröffnung.'
      },
      {
        san: 'd4',
        en: 'White puts a second pawn in the middle and opens lines for the pieces.',
        de: 'Weiß stellt einen zweiten Bauern in die Mitte und öffnet Linien für die Figuren.'
      },
      {
        san: 'd5',
        en: 'The move you prepared. You go straight at e4, and now White has to decide what to do with that pawn.',
        de: 'Der vorbereitete Zug. Du gehst direkt auf e4 los. Jetzt muss Weiß entscheiden, was mit diesem Bauern passiert.'
      },
      {
        san: 'Nd2',
        en: 'The Tarrasch. Putting the knight on d2 means there is no pin with ...Bb4, and the c-pawn is free to support d4.',
        de: 'Die Tarrasch-Variante. Mit dem Springer auf d2 gibt es keine Fesselung durch ...Lb4, und der c-Bauer ist frei, um d4 zu stützen.'
      },
      {
        san: 'Nf6',
        en: 'You develop the knight and attack the e4 pawn.',
        de: 'Du entwickelst den Springer und greifst den Bauern auf e4 an.'
      },
      {
        san: 'e5',
        en: 'White pushes forward and attacks your knight. It gains space.',
        de: 'Weiß rückt vor und greift deinen Springer an. Das gewinnt Raum.'
      },
      {
        san: 'Nfd7',
        en: 'The knight steps back to d7. It is safe there and now hits the e5 pawn.',
        de: 'Der Springer weicht nach d7 aus. Dort steht er sicher und greift jetzt den Bauern auf e5 an.'
      },
      {
        san: 'Bd3',
        en: 'White develops and defends e5.',
        de: 'Weiß entwickelt sich und deckt e5.'
      },
      {
        san: 'c5',
        en: 'Now you hit the base of the pawn chain. The d4 pawn is the one you want to remove, because then e5 will fall too.',
        de: 'Jetzt greifst du die Basis der Bauernkette an. Der Bauer auf d4 ist der, den du loswerden willst, denn dann fällt auch e5.'
      },
      {
        san: 'c3',
        en: 'White props up d4 with a pawn.',
        de: 'Weiß stützt d4 mit einem Bauern.'
      },
      {
        san: 'Nc6',
        en: 'You bring another attacker to d4. The pressure on the centre grows, and White will have to keep defending it.',
        de: 'Du bringst einen weiteren Angreifer nach d4. Der Druck aufs Zentrum wächst, und Weiß muss ständig weiter verteidigen.'
      }
    ],
    ending: {
      en: 'You have attacked the base of White’s centre, and your pieces are lined up against d4. That is the heart of the French: closed centre, then break with ...c5 and ...f6. Be patient, the bishop on c8 gets its chance later.',
      de: 'Du hast die Basis des weißen Zentrums angegriffen, und deine Figuren richten sich auf d4 aus. Das ist der Kern des Französischen: geschlossenes Zentrum, dann der Durchbruch mit ...c5 und ...f6. Hab Geduld, der Läufer auf c8 kommt später zum Zug.'
    }
  },
  {
    id: 'french-advance',
    eco: 'C02',
    side: 'b',
    name: {
      en: 'French: Advance Variation',
      de: 'Französisch: Vorstoß-Variante'
    },
    idea: {
      en: 'White pushes the pawn to e5 and shuts the centre. Black hits the base with ...c5 and ...Qb6.',
      de: 'Weiß schiebt den Bauern nach e5 und schließt das Zentrum. Schwarz greift die Basis mit ...c5 und ...Db6 an.'
    },
    intro: {
      en: 'White gains space at once by pushing the e-pawn to e5. The centre is shut, and everything now depends on the d4 pawn, because it holds the whole chain together. So that is where Black strikes.',
      de: 'Weiß gewinnt sofort Raum, indem er den e-Bauern nach e5 schiebt. Das Zentrum ist geschlossen, und alles hängt vom Bauern auf d4 ab, denn er hält die ganze Kette zusammen. Genau dort schlägt Schwarz zu.'
    },
    pgn: '1. e4 e6 2. d4 d5 3. e5 c5 4. c3 Nc6 5. Nf3 Qb6 6. a3 c4 7. Nbd2 Na5',
    moves: [
      {
        san: 'e4',
        en: 'White starts in the middle: the pawn grabs a centre square and frees the queen and the light-squared bishop.',
        de: 'Weiß beginnt in der Mitte: Der Bauer nimmt ein Zentrumsfeld und macht Dame und weißfeldrigen Läufer frei.'
      },
      {
        san: 'e6',
        en: 'A small step that makes room for d5 next move, with a pawn ready behind it. Be honest about the cost: it shuts the door on your light-squared bishop, and getting that piece out is the puzzle of this whole opening.',
        de: 'Ein kleiner Schritt, der d5 im nächsten Zug möglich macht, mit einem Bauern im Rücken. Der Preis, ehrlich gesagt: Er sperrt deinen weißfeldrigen Läufer ein, und diese Figur herauszubekommen ist das Rätsel der ganzen Eröffnung.'
      },
      {
        san: 'd4',
        en: 'White puts a second pawn in the middle and opens lines for the pieces.',
        de: 'Weiß stellt einen zweiten Bauern in die Mitte und öffnet Linien für die Figuren.'
      },
      {
        san: 'd5',
        en: 'The move you prepared. You go straight at e4, and now White has to decide what to do with that pawn.',
        de: 'Der vorbereitete Zug. Du gehst direkt auf e4 los. Jetzt muss Weiß entscheiden, was mit diesem Bauern passiert.'
      },
      {
        san: 'e5',
        en: 'White pushes the pawn up and takes space. The centre is closed, and your light-squared bishop is stuck behind your own pawns.',
        de: 'Weiß schiebt den Bauern vor und nimmt Raum. Das Zentrum ist geschlossen, und dein weißfeldriger Läufer steckt hinter den eigenen Bauern fest.'
      },
      {
        san: 'c5',
        en: 'The usual answer: hit the base of the chain at d4.',
        de: 'Die übliche Antwort: Greif die Basis der Kette auf d4 an.'
      },
      {
        san: 'c3',
        en: 'White supports d4 with a pawn.',
        de: 'Weiß stützt d4 mit einem Bauern.'
      },
      {
        san: 'Nc6',
        en: 'A second attacker on d4.',
        de: 'Ein zweiter Angreifer auf d4.'
      },
      {
        san: 'Nf3',
        en: 'White adds a defender. Now d4 is defended by the c3 pawn, the knight and the queen.',
        de: 'Weiß fügt einen Verteidiger hinzu. Jetzt wird d4 vom Bauern auf c3, vom Springer und von der Dame gedeckt.'
      },
      {
        san: 'Qb6',
        en: 'The queen joins the attack. She eyes d4 through the pawn on c5, and the b2 pawn is also in sight.',
        de: 'Die Dame schließt sich dem Angriff an. Sie zielt durch den Bauern c5 auf d4 und hat auch den Bauern b2 im Blick.'
      },
      {
        san: 'a3',
        en: 'White stops ...Bb4 and gets ready to answer ...c4 with b4.',
        de: 'Weiß verhindert ...Lb4 und bereitet sich darauf vor, auf ...c4 mit b4 zu antworten.'
      },
      {
        san: 'c4',
        en: 'You grab space on the queenside and freeze White’s pawns there. The pressure on d4 is gone for now, but your pawn wedge makes b3 awkward.',
        de: 'Du nimmst Raum am Damenflügel und fixierst dort die weißen Bauern. Der Druck auf d4 ist vorerst weg, aber dein Bauernkeil macht b3 unbequem.'
      },
      {
        san: 'Nbd2',
        en: 'White develops the last knight on the queenside.',
        de: 'Weiß entwickelt den letzten Springer am Damenflügel.'
      },
      {
        san: 'Na5',
        en: 'The knight heads for b3, where it could trade itself for the knight on d2 and break White’s grip.',
        de: 'Der Springer will nach b3, wo er sich gegen den Springer auf d2 tauschen und den Griff von Weiß lockern könnte.'
      }
    ],
    ending: {
      en: 'You have put the knight on a5 and gained space on the queenside with ...c4, while White holds the centre. Both sides have a plan: White goes for a kingside attack with f4 and so on, you go for the queenside and the break ...f6. It is a fight of plans, not tricks.',
      de: 'Du hast den Springer nach a5 gebracht und mit ...c4 Raum am Damenflügel gewonnen, während Weiß das Zentrum hält. Beide Seiten haben einen Plan: Weiß will am Königsflügel angreifen, du am Damenflügel und mit dem Durchbruch ...f6. Es ist ein Kampf der Pläne, nicht der Tricks.'
    }
  },
  {
    id: 'sicilian-defense',
    eco: 'B54',
    side: 'b',
    name: {
      en: 'Sicilian Defense',
      de: 'Sizilianische Verteidigung'
    },
    idea: {
      en: 'Trade a wing pawn for a centre pawn and play for the counter-attack.',
      de: 'Einen Flügelbauern gegen einen Zentrumsbauern tauschen und auf Gegenangriff spielen.'
    },
    intro: {
      en: 'The most popular answer to 1. e4 there is. You offer a swap that sounds odd at first: your c-pawn, sitting off to the side, for White’s d-pawn in the middle. Take it and you end up with two centre pawns to White’s one, plus an open line for your rook.',
      de: 'Die beliebteste Antwort auf 1. e4 überhaupt. Du bietest einen Tausch an, der zuerst seltsam klingt: deinen c-Bauern vom Rand gegen den d-Bauern von Weiß aus der Mitte. Nimmst du ihn an, hast du am Ende zwei Zentrumsbauern gegen einen und dazu eine offene Linie für deinen Turm.'
    },
    pgn: '1. e4 c5 2. Nf3 d6 3. d4 cxd4 4. Nxd4 Nf6 5. Nc3',
    moves: [
      {
        san: 'e4',
        en: 'White starts in the middle: the pawn grabs a centre square and frees the queen and the light-squared bishop.',
        de: 'Weiß beginnt in der Mitte: Der Bauer nimmt ein Zentrumsfeld und macht Dame und weißfeldrigen Läufer frei.'
      },
      {
        san: 'c5',
        en: 'You do not copy White. You go sideways. This pawn covers d4 and offers a trade: your wing pawn for White’s centre pawn. It is worth knowing the catch: unlike e5, this move develops nothing, so White will get pieces out faster.',
        de: 'Du machst es Weiß nicht nach. Du gehst zur Seite. Dieser Bauer deckt d4 und bietet einen Tausch an: dein Flügelbauer gegen den Zentrumsbauern von Weiß. Der Haken gehört dazu: Anders als e5 entwickelt dieser Zug nichts, Weiß bekommt seine Figuren also schneller heraus.'
      },
      {
        san: 'Nf3',
        en: 'White develops and builds up on d4, getting ready to play the pawn there.',
        de: 'Weiß entwickelt sich und baut Druck auf d4 auf, um den Bauern dorthin zu ziehen.'
      },
      {
        san: 'd6',
        en: 'A small move with a job to do later: it takes the e5 square away from White. Remember it, because it is the reason your knight will be safe on f6 in two moves.',
        de: 'Ein kleiner Zug mit einer späteren Aufgabe: Er nimmt Weiß das Feld e5 weg. Merk ihn dir, denn deshalb steht dein Springer in zwei Zügen sicher auf f6.'
      },
      {
        san: 'd4',
        en: 'White plays it, and offers you the trade you have been asking for since move one.',
        de: 'Weiß spielt ihn und bietet dir den Tausch an, um den du seit dem ersten Zug bittest.'
      },
      {
        san: 'cxd4',
        en: 'Take it. Your wing pawn comes into the middle and takes White’s centre pawn off the board.',
        de: 'Nimm ihn. Dein Flügelbauer kommt in die Mitte und holt den weißen Zentrumsbauern vom Brett.'
      },
      {
        san: 'Nxd4',
        en: 'White takes back with the knight. Look at the pawns now: you have two in the middle, White has one, and the c-file in front of your rook is open.',
        de: 'Weiß schlägt mit dem Springer zurück. Sieh dir jetzt die Bauern an: Du hast zwei in der Mitte, Weiß einen, und die c-Linie vor deinem Turm ist offen.'
      },
      {
        san: 'Nf6',
        en: 'Develop, and attack the e4 pawn while you are at it. This is where d6 pays off: White cannot push past you with e5 to chase the knight away.',
        de: 'Entwickeln und dabei gleich den Bauern auf e4 angreifen. Hier zahlt sich d6 aus: Weiß kann nicht mit e5 vorbeischieben und den Springer verjagen.'
      },
      {
        san: 'Nc3',
        en: 'White has to look after that pawn, and this defends it while developing. Grabbing space with c4 instead would simply drop it to Nxe4.',
        de: 'Weiß muss sich um den Bauern kümmern: Dieser Zug deckt ihn und entwickelt zugleich. Stattdessen mit c4 Raum zu nehmen, würde ihn einfach an Sxe4 verlieren.'
      }
    ],
    ending: {
      en: 'The trade is done and you got what you came for: two pawns in the middle against one, and an open c-file for your rook. You have also not committed to anything yet. From right here the Sicilian splits into all its famous versions, and you can still pick.',
      de: 'Der Tausch ist erledigt, und du hast bekommen, wofür du gekommen bist: zwei Bauern in der Mitte gegen einen und eine offene c-Linie für deinen Turm. Festgelegt hast du dich dabei noch auf nichts. Genau von hier teilt sich die Sizilianische in all ihre berühmten Varianten, und du kannst noch wählen.'
    }
  },
  {
    id: 'sicilian-najdorf',
    eco: 'B90',
    side: 'b',
    name: {
      en: 'Sicilian: Najdorf Variation',
      de: 'Sizilianisch: Najdorf-Variante'
    },
    idea: {
      en: 'The little move ...a6 takes b5 away and prepares to fight on the queenside.',
      de: 'Der kleine Zug ...a6 nimmt b5 weg und bereitet den Kampf am Damenflügel vor.'
    },
    intro: {
      en: 'This is the famous Najdorf, the favourite of many world champions. The first idea is tiny: the pawn move ...a6 stops any white piece from landing on b5. Then Black builds a flexible position and strikes in the centre with ...e5.',
      de: 'Das ist die berühmte Najdorf-Variante, ein Liebling vieler Weltmeister. Die erste Idee ist winzig: Der Bauernzug ...a6 verhindert, dass eine weiße Figur auf b5 landet. Danach baut Schwarz eine flexible Stellung auf und schlägt mit ...e5 im Zentrum zu.'
    },
    pgn: '1. e4 c5 2. Nf3 d6 3. d4 cxd4 4. Nxd4 Nf6 5. Nc3 a6 6. Be3 e5 7. Nb3 Be6',
    moves: [
      {
        san: 'e4',
        en: 'White starts in the middle: the pawn grabs a centre square and frees the queen and the light-squared bishop.',
        de: 'Weiß beginnt in der Mitte: Der Bauer nimmt ein Zentrumsfeld und macht Dame und weißfeldrigen Läufer frei.'
      },
      {
        san: 'c5',
        en: 'You do not copy White. You go sideways. This pawn covers d4 and offers a trade: your wing pawn for White’s centre pawn. It is worth knowing the catch: unlike e5, this move develops nothing, so White will get pieces out faster.',
        de: 'Du machst es Weiß nicht nach. Du gehst zur Seite. Dieser Bauer deckt d4 und bietet einen Tausch an: dein Flügelbauer gegen den Zentrumsbauern von Weiß. Der Haken gehört dazu: Anders als e5 entwickelt dieser Zug nichts, Weiß bekommt seine Figuren also schneller heraus.'
      },
      {
        san: 'Nf3',
        en: 'White develops and builds up on d4, getting ready to play the pawn there.',
        de: 'Weiß entwickelt sich und baut Druck auf d4 auf, um den Bauern dorthin zu ziehen.'
      },
      {
        san: 'd6',
        en: 'A small move with a job to do later: it takes the e5 square away from White. Remember it, because it is the reason your knight will be safe on f6 in two moves.',
        de: 'Ein kleiner Zug mit einer späteren Aufgabe: Er nimmt Weiß das Feld e5 weg. Merk ihn dir, denn deshalb steht dein Springer in zwei Zügen sicher auf f6.'
      },
      {
        san: 'd4',
        en: 'White plays it, and offers you the trade you have been asking for since move one.',
        de: 'Weiß spielt ihn und bietet dir den Tausch an, um den du seit dem ersten Zug bittest.'
      },
      {
        san: 'cxd4',
        en: 'Take it. Your wing pawn comes into the middle and takes White’s centre pawn off the board.',
        de: 'Nimm ihn. Dein Flügelbauer kommt in die Mitte und holt den weißen Zentrumsbauern vom Brett.'
      },
      {
        san: 'Nxd4',
        en: 'White takes back with the knight. Look at the pawns now: you have two in the middle, White has one, and the c-file in front of your rook is open.',
        de: 'Weiß schlägt mit dem Springer zurück. Sieh dir jetzt die Bauern an: Du hast zwei in der Mitte, Weiß einen, und die c-Linie vor deinem Turm ist offen.'
      },
      {
        san: 'Nf6',
        en: 'Develop, and attack the e4 pawn while you are at it. This is where d6 pays off: White cannot push past you with e5 to chase the knight away.',
        de: 'Entwickeln und dabei gleich den Bauern auf e4 angreifen. Hier zahlt sich d6 aus: Weiß kann nicht mit e5 vorbeischieben und den Springer verjagen.'
      },
      {
        san: 'Nc3',
        en: 'White has to look after that pawn, and this defends it while developing. Grabbing space with c4 instead would simply drop it to Nxe4.',
        de: 'Weiß muss sich um den Bauern kümmern: Dieser Zug deckt ihn und entwickelt zugleich. Stattdessen mit c4 Raum zu nehmen, würde ihn einfach an Sxe4 verlieren.'
      },
      {
        san: 'a6',
        en: 'The Najdorf move. It takes b5 away from white pieces, gives the queen a way to escape on b7 and prepares ...b5.',
        de: 'Der Najdorf-Zug. Er nimmt weißen Figuren das Feld b5, gibt der Dame auf b7 einen Ausweg und bereitet ...b5 vor.'
      },
      {
        san: 'Be3',
        en: 'White develops and aims at queenside castling and a quick attack.',
        de: 'Weiß entwickelt sich und strebt lange Rochade und einen schnellen Angriff an.'
      },
      {
        san: 'e5',
        en: 'You kick the knight and take a share of the centre. The price is that d5 is now a hole, but your pieces will watch it.',
        de: 'Du vertreibst den Springer und nimmst dir einen Teil des Zentrums. Der Preis: d5 ist jetzt ein Loch, aber deine Figuren behalten es im Auge.'
      },
      {
        san: 'Nb3',
        en: 'The knight retreats to b3. It covers d4 and a5 and keeps an eye on c5.',
        de: 'Der Springer weicht nach b3 aus. Er deckt d4 und a5 und beobachtet c5.'
      },
      {
        san: 'Be6',
        en: 'The bishop takes control of d5 and c4, and it eyes the knight on b3.',
        de: 'Der Läufer kontrolliert d5 und c4 und zielt auf den Springer auf b3.'
      }
    ],
    ending: {
      en: 'You played ...e5 and have a bishop on e6 which controls d5 and hits the knight on b3. The d5 square is a hole in your structure, but your bishop covers it. Black has equality and many chances, and that is why so many strong players love it.',
      de: 'Du hast ...e5 gespielt, und dein Läufer auf e6 kontrolliert d5 und greift den Springer auf b3 an. Das Feld d5 ist ein Loch in deiner Struktur, aber dein Läufer deckt es. Schwarz hat Ausgleich und viele Chancen, und deshalb lieben so viele starke Spieler diese Variante.'
    }
  },
  {
    id: 'sicilian-dragon',
    eco: 'B76',
    side: 'b',
    name: {
      en: 'Sicilian: Dragon Variation',
      de: 'Sizilianisch: Drachen-Variante'
    },
    idea: {
      en: 'Fianchetto the bishop to g7: the long diagonal is the dragon’s fire.',
      de: 'Der Läufer geht ins Fianchetto nach g7: Die lange Diagonale ist der Feueratem des Drachen.'
    },
    intro: {
      en: 'The Dragon gets its name because the pawns look like a dragon’s tail and the bishop on g7 breathes fire down the long diagonal. It is sharp: both sides usually castle on opposite wings and attack each other fast.',
      de: 'Der Drache heißt so, weil die Bauern wie ein Drachenschwanz aussehen und der Läufer auf g7 über die lange Diagonale Feuer spuckt. Er ist scharf: Beide Seiten rochieren meist auf entgegengesetzte Seiten und greifen schnell an.'
    },
    pgn: '1. e4 c5 2. Nf3 d6 3. d4 cxd4 4. Nxd4 Nf6 5. Nc3 g6 6. Be3 Bg7 7. f3 O-O 8. Qd2 Nc6',
    moves: [
      {
        san: 'e4',
        en: 'White starts in the middle: the pawn grabs a centre square and frees the queen and the light-squared bishop.',
        de: 'Weiß beginnt in der Mitte: Der Bauer nimmt ein Zentrumsfeld und macht Dame und weißfeldrigen Läufer frei.'
      },
      {
        san: 'c5',
        en: 'You do not copy White. You go sideways. This pawn covers d4 and offers a trade: your wing pawn for White’s centre pawn. It is worth knowing the catch: unlike e5, this move develops nothing, so White will get pieces out faster.',
        de: 'Du machst es Weiß nicht nach. Du gehst zur Seite. Dieser Bauer deckt d4 und bietet einen Tausch an: dein Flügelbauer gegen den Zentrumsbauern von Weiß. Der Haken gehört dazu: Anders als e5 entwickelt dieser Zug nichts, Weiß bekommt seine Figuren also schneller heraus.'
      },
      {
        san: 'Nf3',
        en: 'White develops and builds up on d4, getting ready to play the pawn there.',
        de: 'Weiß entwickelt sich und baut Druck auf d4 auf, um den Bauern dorthin zu ziehen.'
      },
      {
        san: 'd6',
        en: 'A small move with a job to do later: it takes the e5 square away from White. Remember it, because it is the reason your knight will be safe on f6 in two moves.',
        de: 'Ein kleiner Zug mit einer späteren Aufgabe: Er nimmt Weiß das Feld e5 weg. Merk ihn dir, denn deshalb steht dein Springer in zwei Zügen sicher auf f6.'
      },
      {
        san: 'd4',
        en: 'White plays it, and offers you the trade you have been asking for since move one.',
        de: 'Weiß spielt ihn und bietet dir den Tausch an, um den du seit dem ersten Zug bittest.'
      },
      {
        san: 'cxd4',
        en: 'Take it. Your wing pawn comes into the middle and takes White’s centre pawn off the board.',
        de: 'Nimm ihn. Dein Flügelbauer kommt in die Mitte und holt den weißen Zentrumsbauern vom Brett.'
      },
      {
        san: 'Nxd4',
        en: 'White takes back with the knight. Look at the pawns now: you have two in the middle, White has one, and the c-file in front of your rook is open.',
        de: 'Weiß schlägt mit dem Springer zurück. Sieh dir jetzt die Bauern an: Du hast zwei in der Mitte, Weiß einen, und die c-Linie vor deinem Turm ist offen.'
      },
      {
        san: 'Nf6',
        en: 'Develop, and attack the e4 pawn while you are at it. This is where d6 pays off: White cannot push past you with e5 to chase the knight away.',
        de: 'Entwickeln und dabei gleich den Bauern auf e4 angreifen. Hier zahlt sich d6 aus: Weiß kann nicht mit e5 vorbeischieben und den Springer verjagen.'
      },
      {
        san: 'Nc3',
        en: 'White has to look after that pawn, and this defends it while developing. Grabbing space with c4 instead would simply drop it to Nxe4.',
        de: 'Weiß muss sich um den Bauern kümmern: Dieser Zug deckt ihn und entwickelt zugleich. Stattdessen mit c4 Raum zu nehmen, würde ihn einfach an Sxe4 verlieren.'
      },
      {
        san: 'g6',
        en: 'The dragon begins. The pawn prepares a bishop on g7, which will shoot along the long diagonal at the white centre and the b2 pawn.',
        de: 'Der Drache beginnt. Der Bauer bereitet einen Läufer auf g7 vor, der über die lange Diagonale auf das weiße Zentrum und den Bauern b2 schießt.'
      },
      {
        san: 'Be3',
        en: 'White develops and prepares to castle queenside.',
        de: 'Weiß entwickelt sich und bereitet die lange Rochade vor.'
      },
      {
        san: 'Bg7',
        en: 'The bishop arrives on its diagonal. It eyes the knight on d4 and everything behind it.',
        de: 'Der Läufer erreicht seine Diagonale. Er zielt auf den Springer auf d4 und alles dahinter.'
      },
      {
        san: 'f3',
        en: 'White supports the e4 pawn and makes room for a queen on d2. It also prepares g4 and h4 for an attack on your king.',
        de: 'Weiß stützt den Bauern auf e4 und schafft Platz für die Dame auf d2. Außerdem bereitet er g4 und h4 für einen Angriff auf deinen König vor.'
      },
      {
        san: 'O-O',
        en: 'You castle. Your king is safe behind the bishop, and your rook is ready for the f-file or the c-file.',
        de: 'Du rochierst. Dein König steht sicher hinter dem Läufer, und dein Turm ist bereit für die f- oder die c-Linie.'
      },
      {
        san: 'Qd2',
        en: 'White prepares Bh6 to trade your key bishop and then castles long. This is the Yugoslav Attack.',
        de: 'Weiß bereitet Lh6 vor, um deinen wichtigen Läufer zu tauschen, und rochiert dann lang. Das ist der Jugoslawische Angriff.'
      },
      {
        san: 'Nc6',
        en: 'You develop with tempo, since the knight attacks the one on d4. The race is on.',
        de: 'Du entwickelst mit Tempo, denn der Springer greift den auf d4 an. Der Wettlauf beginnt.'
      }
    ],
    ending: {
      en: 'Your king is castled behind the fianchetto, the bishop on g7 is a monster, and your knight is hitting the centre. White has set up the Yugoslav Attack with Be3, f3 and Qd2, and plans to castle long. It is a race: you have the c-file and the long diagonal, White has the kingside attack.',
      de: 'Dein König ist hinter dem Fianchetto rochiert, der Läufer auf g7 ist ein Monster, und dein Springer greift das Zentrum an. Weiß hat den Jugoslawischen Angriff mit Le3, f3 und Dd2 aufgebaut und will lang rochieren. Es ist ein Wettlauf: Du hast die c-Linie und die lange Diagonale, Weiß den Angriff am Königsflügel.'
    }
  },
  {
    id: 'sicilian-alapin',
    eco: 'B22',
    side: 'b',
    name: {
      en: 'Sicilian: Alapin Variation',
      de: 'Sizilianisch: Alapin-Variante'
    },
    idea: {
      en: 'White plays c3 to build a big centre with d4. Strike back at once with ...d5.',
      de: 'Weiß spielt c3, um mit d4 ein großes Zentrum zu bauen. Schlag sofort mit ...d5 zurück.'
    },
    intro: {
      en: 'A quiet way for White to avoid the main Sicilian: the c-pawn goes to c3 so the d-pawn can take the centre without being captured. Black’s answer is to strike straight away with ...d5, before White gets organised.',
      de: 'Ein ruhiger Weg für Weiß, dem Hauptsizilianer auszuweichen: Der c-Bauer geht nach c3, damit der d-Bauer das Zentrum nehmen kann, ohne geschlagen zu werden. Schwarz antwortet, indem er sofort mit ...d5 zuschlägt, bevor Weiß sich sortiert hat.'
    },
    pgn: '1. e4 c5 2. c3 d5 3. exd5 Qxd5 4. d4 Nf6 5. Nf3 e6 6. Be2 Nc6 7. O-O Be7',
    moves: [
      {
        san: 'e4',
        en: 'White starts in the middle: the pawn grabs a centre square and frees the queen and the light-squared bishop.',
        de: 'Weiß beginnt in der Mitte: Der Bauer nimmt ein Zentrumsfeld und macht Dame und weißfeldrigen Läufer frei.'
      },
      {
        san: 'c5',
        en: 'You do not copy White. You go sideways. This pawn covers d4 and offers a trade: your wing pawn for White’s centre pawn. It is worth knowing the catch: unlike e5, this move develops nothing, so White will get pieces out faster.',
        de: 'Du machst es Weiß nicht nach. Du gehst zur Seite. Dieser Bauer deckt d4 und bietet einen Tausch an: dein Flügelbauer gegen den Zentrumsbauern von Weiß. Der Haken gehört dazu: Anders als e5 entwickelt dieser Zug nichts, Weiß bekommt seine Figuren also schneller heraus.'
      },
      {
        san: 'c3',
        en: 'The Alapin. White wants to play d4 and have the pawn supported by c3, so it cannot simply be taken.',
        de: 'Die Alapin-Variante. Weiß will d4 spielen und den Bauern mit c3 stützen, damit er nicht einfach geschlagen werden kann.'
      },
      {
        san: 'd5',
        en: 'Strike at once. The pawn attacks e4, and White has to decide what to do before d4 comes.',
        de: 'Schlag sofort zu. Der Bauer greift e4 an, und Weiß muss sich entscheiden, bevor d4 kommt.'
      },
      {
        san: 'exd5',
        en: 'White takes the pawn on d5.',
        de: 'Weiß schlägt den Bauern auf d5.'
      },
      {
        san: 'Qxd5',
        en: 'You take back with the queen. The c3 pawn means White has no Nc3 to chase the queen away.',
        de: 'Du nimmst mit der Dame zurück. Wegen des Bauern auf c3 gibt es kein Sc3, das die Dame vertreiben könnte.'
      },
      {
        san: 'd4',
        en: 'White takes the centre, now with a pawn supported by c3.',
        de: 'Weiß nimmt das Zentrum, jetzt mit einem Bauern, der von c3 gestützt wird.'
      },
      {
        san: 'Nf6',
        en: 'You develop with tempo, because the knight attacks the e4 square and supports your queen on d5.',
        de: 'Du entwickelst mit Tempo, denn der Springer kontrolliert e4 und unterstützt deine Dame auf d5.'
      },
      {
        san: 'Nf3',
        en: 'White develops and guards d4.',
        de: 'Weiß entwickelt sich und deckt d4.'
      },
      {
        san: 'e6',
        en: 'You open the way for the dark-squared bishop and guard d5.',
        de: 'Du öffnest den Weg für den schwarzfeldrigen Läufer und deckst d5.'
      },
      {
        san: 'Be2',
        en: 'White develops the bishop and prepares to castle.',
        de: 'Weiß entwickelt den Läufer und bereitet die Rochade vor.'
      },
      {
        san: 'Nc6',
        en: 'Another attacker on d4, with the c5 pawn. The knight also develops with a plan.',
        de: 'Ein weiterer Angreifer auf d4, zusammen mit dem Bauern c5. Der Springer entwickelt sich außerdem mit Plan.'
      },
      {
        san: 'O-O',
        en: 'White castles.',
        de: 'Weiß rochiert.'
      },
      {
        san: 'Be7',
        en: 'You get ready to castle yourself. All your pieces are out, so the opening is done.',
        de: 'Du bereitest die eigene Rochade vor. Alle deine Figuren sind draußen, die Eröffnung ist geschafft.'
      }
    ],
    ending: {
      en: 'All your pieces are developing, the king is about to be safe and the centre is open. White has the bigger pawn centre, but your pieces are active and nothing is weak. The lesson is simple: if White plays slowly, take your share of the centre.',
      de: 'Alle deine Figuren entwickeln sich, der König wird bald sicher stehen, und das Zentrum ist offen. Weiß hat das größere Bauernzentrum, aber deine Figuren sind aktiv und nichts ist schwach. Die Lehre ist einfach: Spielt Weiß langsam, nimm dir deinen Anteil am Zentrum.'
    }
  },
  {
    id: 'kings-indian-defense',
    eco: 'E70',
    side: 'b',
    name: {
      en: 'King’s Indian Defense',
      de: 'Königsindische Verteidigung'
    },
    idea: {
      en: 'Let White build a big centre, then attack it with the bishop on g7 and the e-pawn.',
      de: 'Weiß ein großes Zentrum bauen lassen und es dann mit dem Läufer auf g7 und dem e-Bauern angreifen.'
    },
    intro: {
      en: 'This one turns the usual advice upside down. You let White build the biggest pawn centre he likes, and that is the plan, not a mistake. A big centre is also a big target, and your bishop on g7 will stare straight through it from the corner.',
      de: 'Diese hier stellt den üblichen Rat auf den Kopf. Du lässt Weiß das größte Bauernzentrum bauen, das er möchte, und das ist der Plan, kein Fehler. Ein großes Zentrum ist auch ein großes Ziel, und dein Läufer auf g7 schaut aus der Ecke mitten hindurch.'
    },
    pgn: '1. d4 Nf6 2. c4 g6 3. Nc3 Bg7 4. e4 d6',
    moves: [
      {
        san: 'd4',
        en: 'White takes a centre square, covers c5 and e5, and opens a line for the queen’s bishop.',
        de: 'Weiß nimmt ein Zentrumsfeld, deckt c5 und e5 und öffnet eine Linie für den Damenläufer.'
      },
      {
        san: 'Nf6',
        en: 'You control e4 with a piece instead of a pawn. Nothing is committed yet, and the knight watches the middle from a distance.',
        de: 'Du kontrollierst e4 mit einer Figur statt mit einem Bauern. Noch legst du dich auf nichts fest, und der Springer bewacht die Mitte aus der Ferne.'
      },
      {
        san: 'c4',
        en: 'White takes more space and grips d5. Two big pawns now, and more coming.',
        de: 'Weiß nimmt mehr Raum und greift nach d5. Jetzt zwei große Bauern, und es kommen noch mehr.'
      },
      {
        san: 'g6',
        en: 'You make a little house for the bishop in the corner. From g7 it will look down the longest diagonal on the board, right at White’s centre.',
        de: 'Du baust dem Läufer ein kleines Haus in der Ecke. Von g7 schaut er die längste Diagonale des Brettes entlang, genau auf das weiße Zentrum.'
      },
      {
        san: 'Nc3',
        en: 'White develops and gets ready to push the last centre pawn to e4.',
        de: 'Weiß entwickelt sich und bereitet vor, den letzten Zentrumsbauern nach e4 zu ziehen.'
      },
      {
        san: 'Bg7',
        en: 'Into the house. The bishop takes the long diagonal, and it does a second job too: after castling it is the piece standing guard in front of your king.',
        de: 'Ab ins Haus. Der Läufer übernimmt die lange Diagonale und hat noch eine zweite Aufgabe: Nach der Rochade ist er die Figur, die vor deinem König Wache steht.'
      },
      {
        san: 'e4',
        en: 'And there it is: three pawns in a row across the middle. It looks wonderful for White, and you allowed every bit of it.',
        de: 'Und da steht es: drei Bauern nebeneinander quer durch die Mitte. Für Weiß sieht das großartig aus, und du hast jedes bisschen davon zugelassen.'
      },
      {
        san: 'd6',
        en: 'This little pawn does three things at once: it stops White playing e5 to kick your knight, it opens a line for your other bishop, and it gets e5 ready for you to push there yourself. That push is how you start taking the centre apart.',
        de: 'Dieser kleine Bauer erledigt drei Dinge auf einmal: Er verhindert e5, mit dem Weiß deinen Springer verjagen würde, er öffnet eine Linie für deinen anderen Läufer, und er macht e5 für deinen eigenen Vorstoß bereit. Mit diesem Vorstoß beginnst du, das Zentrum auseinanderzunehmen.'
      }
    ],
    ending: {
      en: 'White has the whole middle of the board, exactly as you wanted. Now it becomes a target: your bishop on g7 is already aimed at it, and your pawn is about to arrive on e5. Letting White build it was only ever half the plan. This is the other half.',
      de: 'Weiß hat die ganze Brettmitte, genau wie du es wolltest. Jetzt wird sie zum Ziel: Dein Läufer auf g7 zielt schon darauf, und dein Bauer kommt gleich auf e5 an. Weiß bauen zu lassen war immer nur die halbe Idee. Das hier ist die andere Hälfte.'
    }
  },
  {
    id: 'kings-indian-classical',
    eco: 'E97',
    side: 'b',
    name: {
      en: 'King’s Indian: Classical Variation',
      de: 'Königsindisch: Klassische Variante'
    },
    idea: {
      en: 'Let White have the centre, castle, then hit it with ...e5.',
      de: 'Lass Weiß das Zentrum, rochiere und greife es dann mit ...e5 an.'
    },
    intro: {
      en: 'The classic way to play against the King’s Indian: White develops naturally and castles. Black’s plan is to let White build a big centre and then attack it with ...e5. After that, the game depends on who plays the next move well.',
      de: 'Der klassische Weg gegen die Königsindische Verteidigung: Weiß entwickelt sich natürlich und rochiert. Der Plan von Schwarz: Weiß ein großes Zentrum bauen lassen und es dann mit ...e5 angreifen. Danach kommt es darauf an, wer den nächsten Zug besser spielt.'
    },
    pgn: '1. d4 Nf6 2. c4 g6 3. Nc3 Bg7 4. e4 d6 5. Nf3 O-O 6. Be2 e5 7. O-O Nc6 8. d5 Ne7',
    moves: [
      {
        san: 'd4',
        en: 'White takes a centre square, covers c5 and e5, and opens a line for the queen’s bishop.',
        de: 'Weiß nimmt ein Zentrumsfeld, deckt c5 und e5 und öffnet eine Linie für den Damenläufer.'
      },
      {
        san: 'Nf6',
        en: 'You control e4 with a piece instead of a pawn. Nothing is committed yet, and the knight watches the middle from a distance.',
        de: 'Du kontrollierst e4 mit einer Figur statt mit einem Bauern. Noch legst du dich auf nichts fest, und der Springer bewacht die Mitte aus der Ferne.'
      },
      {
        san: 'c4',
        en: 'White takes more space and grips d5. Two big pawns now, and more coming.',
        de: 'Weiß nimmt mehr Raum und greift nach d5. Jetzt zwei große Bauern, und es kommen noch mehr.'
      },
      {
        san: 'g6',
        en: 'You make a little house for the bishop in the corner. From g7 it will look down the longest diagonal on the board, right at White’s centre.',
        de: 'Du baust dem Läufer ein kleines Haus in der Ecke. Von g7 schaut er die längste Diagonale des Brettes entlang, genau auf das weiße Zentrum.'
      },
      {
        san: 'Nc3',
        en: 'White develops and gets ready to push the last centre pawn to e4.',
        de: 'Weiß entwickelt sich und bereitet vor, den letzten Zentrumsbauern nach e4 zu ziehen.'
      },
      {
        san: 'Bg7',
        en: 'Into the house. The bishop takes the long diagonal, and it does a second job too: after castling it is the piece standing guard in front of your king.',
        de: 'Ab ins Haus. Der Läufer übernimmt die lange Diagonale und hat noch eine zweite Aufgabe: Nach der Rochade ist er die Figur, die vor deinem König Wache steht.'
      },
      {
        san: 'e4',
        en: 'And there it is: three pawns in a row across the middle. It looks wonderful for White, and you allowed every bit of it.',
        de: 'Und da steht es: drei Bauern nebeneinander quer durch die Mitte. Für Weiß sieht das großartig aus, und du hast jedes bisschen davon zugelassen.'
      },
      {
        san: 'd6',
        en: 'This little pawn does three things at once: it stops White playing e5 to kick your knight, it opens a line for your other bishop, and it gets e5 ready for you to push there yourself. That push is how you start taking the centre apart.',
        de: 'Dieser kleine Bauer erledigt drei Dinge auf einmal: Er verhindert e5, mit dem Weiß deinen Springer verjagen würde, er öffnet eine Linie für deinen anderen Läufer, und er macht e5 für deinen eigenen Vorstoß bereit. Mit diesem Vorstoß beginnst du, das Zentrum auseinanderzunehmen.'
      },
      {
        san: 'Nf3',
        en: 'White develops a knight and guards d4 and e5.',
        de: 'Weiß entwickelt einen Springer und deckt d4 und e5.'
      },
      {
        san: 'O-O',
        en: 'You castle. Your king is safe behind the fianchetto bishop, and White’s big centre does not scare you yet.',
        de: 'Du rochierst. Dein König steht sicher hinter dem Fianchetto-Läufer, und das große weiße Zentrum schreckt dich noch nicht.'
      },
      {
        san: 'Be2',
        en: 'A calm move that prepares castling.',
        de: 'Ein ruhiger Zug, der die Rochade vorbereitet.'
      },
      {
        san: 'e5',
        en: 'Here is the main idea: you let White build the centre and now you attack it. The pawn hits d4.',
        de: 'Hier ist die Hauptidee: Du lässt Weiß das Zentrum bauen und greifst es jetzt an. Der Bauer greift d4 an.'
      },
      {
        san: 'O-O',
        en: 'White castles and keeps the tension.',
        de: 'Weiß rochiert und hält die Spannung.'
      },
      {
        san: 'Nc6',
        en: 'You add more pressure on d4. White has to decide what to do with the pawn.',
        de: 'Du erhöhst den Druck auf d4. Weiß muss sich entscheiden, was er mit dem Bauern tut.'
      },
      {
        san: 'd5',
        en: 'White pushes the pawn, closes the centre and gains space. Your knight must move.',
        de: 'Weiß schiebt den Bauern vor, schließt das Zentrum und gewinnt Raum. Dein Springer muss ziehen.'
      },
      {
        san: 'Ne7',
        en: 'The knight steps back, but it is not passive. From here it supports ...f5, which is your plan for a kingside attack.',
        de: 'Der Springer weicht aus, aber er ist nicht passiv. Von hier unterstützt er ...f5, deinen Plan für den Angriff am Königsflügel.'
      }
    ],
    ending: {
      en: 'White closed the centre with d5 and drove your knight to e7. That looks passive, but the plan is clear: ...Nd7 and ...f5 start an attack on the white king. White will counter on the queenside with c5. Both sides are racing on opposite wings, and this is what the King’s Indian is all about.',
      de: 'Weiß schloss das Zentrum mit d5 und trieb deinen Springer nach e7. Das sieht passiv aus, aber der Plan ist klar: ...Sd7 und ...f5 leiten einen Angriff auf den weißen König ein. Weiß kontert am Damenflügel mit c5. Beide Seiten rennen auf entgegengesetzten Flügeln, und genau darum geht es in der Königsindischen Verteidigung.'
    }
  },
  {
    id: 'kings-indian-samisch',
    eco: 'E86',
    side: 'b',
    name: {
      en: 'King’s Indian: Sämisch Variation',
      de: 'Königsindisch: Sämisch-Variante'
    },
    idea: {
      en: 'White plays f3 for a solid centre and an attack. Black strikes in the centre at once.',
      de: 'Weiß spielt f3 für ein solides Zentrum und einen Angriff. Schwarz schlägt sofort im Zentrum zu.'
    },
    intro: {
      en: 'The Sämisch is a very direct setup. White supports the e4 pawn with f3, brings the bishop to e3 and plans a queen move to d2, castling long and a pawn storm against your king. Black should not wait: strike at the centre with ...e5 and ...c6.',
      de: 'Die Sämisch-Variante ist ein sehr direkter Aufbau. Weiß stützt den Bauern e4 mit f3, bringt den Läufer nach e3 und plant Dd2, lange Rochade und einen Bauernsturm gegen deinen König. Schwarz sollte nicht abwarten: Greife das Zentrum mit ...e5 und ...c6 an.'
    },
    pgn: '1. d4 Nf6 2. c4 g6 3. Nc3 Bg7 4. e4 d6 5. f3 O-O 6. Be3 e5 7. Nge2 c6',
    moves: [
      {
        san: 'd4',
        en: 'White takes a centre square, covers c5 and e5, and opens a line for the queen’s bishop.',
        de: 'Weiß nimmt ein Zentrumsfeld, deckt c5 und e5 und öffnet eine Linie für den Damenläufer.'
      },
      {
        san: 'Nf6',
        en: 'You control e4 with a piece instead of a pawn. Nothing is committed yet, and the knight watches the middle from a distance.',
        de: 'Du kontrollierst e4 mit einer Figur statt mit einem Bauern. Noch legst du dich auf nichts fest, und der Springer bewacht die Mitte aus der Ferne.'
      },
      {
        san: 'c4',
        en: 'White takes more space and grips d5. Two big pawns now, and more coming.',
        de: 'Weiß nimmt mehr Raum und greift nach d5. Jetzt zwei große Bauern, und es kommen noch mehr.'
      },
      {
        san: 'g6',
        en: 'You make a little house for the bishop in the corner. From g7 it will look down the longest diagonal on the board, right at White’s centre.',
        de: 'Du baust dem Läufer ein kleines Haus in der Ecke. Von g7 schaut er die längste Diagonale des Brettes entlang, genau auf das weiße Zentrum.'
      },
      {
        san: 'Nc3',
        en: 'White develops and gets ready to push the last centre pawn to e4.',
        de: 'Weiß entwickelt sich und bereitet vor, den letzten Zentrumsbauern nach e4 zu ziehen.'
      },
      {
        san: 'Bg7',
        en: 'Into the house. The bishop takes the long diagonal, and it does a second job too: after castling it is the piece standing guard in front of your king.',
        de: 'Ab ins Haus. Der Läufer übernimmt die lange Diagonale und hat noch eine zweite Aufgabe: Nach der Rochade ist er die Figur, die vor deinem König Wache steht.'
      },
      {
        san: 'e4',
        en: 'And there it is: three pawns in a row across the middle. It looks wonderful for White, and you allowed every bit of it.',
        de: 'Und da steht es: drei Bauern nebeneinander quer durch die Mitte. Für Weiß sieht das großartig aus, und du hast jedes bisschen davon zugelassen.'
      },
      {
        san: 'd6',
        en: 'This little pawn does three things at once: it stops White playing e5 to kick your knight, it opens a line for your other bishop, and it gets e5 ready for you to push there yourself. That push is how you start taking the centre apart.',
        de: 'Dieser kleine Bauer erledigt drei Dinge auf einmal: Er verhindert e5, mit dem Weiß deinen Springer verjagen würde, er öffnet eine Linie für deinen anderen Läufer, und er macht e5 für deinen eigenen Vorstoß bereit. Mit diesem Vorstoß beginnst du, das Zentrum auseinanderzunehmen.'
      },
      {
        san: 'f3',
        en: 'The Sämisch. The pawn supports e4 for good and makes room for the dark-squared bishop on e3.',
        de: 'Die Sämisch-Variante. Der Bauer stützt e4 dauerhaft und schafft Platz für den schwarzfeldrigen Läufer auf e3.'
      },
      {
        san: 'O-O',
        en: 'You castle first. Your king is safe, and you can see what White plans.',
        de: 'Du rochierst zuerst. Dein König ist sicher, und du siehst, was Weiß vorhat.'
      },
      {
        san: 'Be3',
        en: 'White develops the bishop and eyes queenside castling with Qd2.',
        de: 'Weiß entwickelt den Läufer und plant mit Dd2 die lange Rochade.'
      },
      {
        san: 'e5',
        en: 'You strike at the centre at once. White’s setup is strong but it also has no pressure on e5.',
        de: 'Du greifst sofort das Zentrum an. Der weiße Aufbau ist stark, aber er übt keinen Druck auf e5 aus.'
      },
      {
        san: 'Nge2',
        en: 'The knight goes to e2 because f3 is taken by the pawn. It keeps the f-pawn free for later.',
        de: 'Der Springer geht nach e2, weil f3 vom Bauern besetzt ist. So bleibt der f-Bauer für später frei.'
      },
      {
        san: 'c6',
        en: 'A flexible move. It prepares ...d5 to break the centre and takes b5 and d5 under watch.',
        de: 'Ein flexibler Zug. Er bereitet ...d5 vor, um das Zentrum aufzubrechen, und behält b5 und d5 im Blick.'
      }
    ],
    ending: {
      en: 'The position is solid, and you have played ...e5 and ...c6, so your pieces are ready for ...d5. White plans queenside castling and a pawn storm with g4 and h4. You need to act fast in the centre, because a slow game helps White. Keep the idea in mind: strike before the attack arrives.',
      de: 'Die Stellung ist solide, du hast ...e5 und ...c6 gespielt, und deine Figuren sind bereit für ...d5. Weiß plant lange Rochade und einen Bauernsturm mit g4 und h4. Du musst im Zentrum schnell handeln, denn ein langsames Spiel hilft Weiß. Merk dir den Gedanken: zuschlagen, bevor der Angriff kommt.'
    }
  }
];

export const lineById = (id) => LINES.find((l) => l.id === id) || null;
