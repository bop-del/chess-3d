// The 12 starter lines, ported from chesslines (js/data/openings.js), texts in English and German.
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
  }
];

export const lineById = (id) => LINES.find((l) => l.id === id) || null;
