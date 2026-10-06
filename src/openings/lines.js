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
    aims: {
      w: {
        en: 'Aim your bishop at f7, build a big centre with c3 and d4, and castle so your king is safe.',
        de: 'Mit dem Läufer auf f7 zielen, mit c3 und d4 ein großes Zentrum bauen und rochieren, damit dein König sicher steht.'
      },
      b: {
        en: 'Copy the good ideas: develop fast, aim a bishop at f2, castle, and break up your centre before it gets too big.',
        de: 'Die guten Ideen nachmachen: schnell entwickeln, mit dem Läufer auf f2 zielen, rochieren und dein Zentrum aufbrechen, bevor es zu groß wird.'
      }
    },
    plans: [
      {
        en: 'First c3, then d4: that gives you two strong pawns side by side in the middle.',
        de: 'Erst c3, dann d4: So bekommst du zwei starke Bauern nebeneinander in der Mitte.'
      },
      {
        en: 'Castle early, then bring a rook to e1, right behind your centre pawns.',
        de: 'Früh rochieren und dann einen Turm nach e1 bringen, direkt hinter deine Zentrumsbauern.'
      },
      {
        en: 'Later the e-pawn can push to e5 and chase the f6 knight away from Black’s king.',
        de: 'Später kann der e-Bauer nach e5 vorgehen und den Springer auf f6 vom schwarzen König wegjagen.'
      }
    ],
    traps: [
      {
        en: 'If Black plays the knight to f6 instead of the bishop to c5, your knight can jump to g5 and attack f7 a second time. Black must answer exactly, or f7 falls.',
        de: 'Spielt Schwarz den Springer nach f6 statt den Läufer nach c5, springt dein Springer nach g5 und greift f7 ein zweites Mal an. Schwarz muss genau antworten, sonst fällt f7.',
        moves: '1. e4 e5 2. Nf3 Nc6 3. Bc4 Nf6 4. Ng5'
      },
      {
        en: 'Careful with the black knight jump to d4: it looks like a free pawn on e5, but after your knight takes it, the queen comes to g5 and attacks your knight and g2. Just take the d4 knight instead.',
        de: 'Vorsicht beim schwarzen Springer auf d4: Der Bauer auf e5 sieht frei aus. Doch nimmt dein Springer ihn, kommt die Dame nach g5 und greift Springer und g2 an. Schlag lieber den Springer auf d4.',
        moves: '1. e4 e5 2. Nf3 Nc6 3. Bc4 Nd4 4. Nxe5 Qg5'
      }
    ],
    pgn: '1. e4 e5 2. Nf3 Nc6 3. Bc4 Bc5 4. c3 Nf6 5. d4',
    moves: [
      {
        san: 'e4',
        en: 'Straight into the middle. The pawn takes a centre square, watches d5, and opens the door for both your bishop and your queen.',
        de: 'Direkt in die Mitte. Der Bauer nimmt ein Zentrumsfeld, bewacht d5 und macht den Weg frei für Läufer und Dame.',
        why: {
          en: 'Pawns in the middle give your pieces room to come out. Whoever owns the centre usually has the easier game.',
          de: 'Bauern in der Mitte geben deinen Figuren Platz. Wer das Zentrum hat, hat meistens das leichtere Spiel.'
        }
      },
      {
        san: 'e5',
        en: 'Black does the same thing, and it is the move that gets most in your way: it stops you playing d4 for free.',
        de: 'Schwarz macht es genauso, und das ist der Zug, der dich am meisten stört: Er verhindert, dass du einfach so d4 spielen kannst.',
        why: {
          en: 'If Black let you have both e4 and d4, your pawns would push Black’s pieces back. So Black takes a share of the middle at once.',
          de: 'Ließe Schwarz dir e4 und d4, würden deine Bauern seine Figuren zurückdrängen. Also nimmt Schwarz sich sofort ein Stück Mitte.'
        }
      },
      {
        san: 'Nf3',
        en: 'Develop and attack at the same time. The knight goes for the e5 pawn, guards d4, and clears a square so you can castle soon.',
        de: 'Entwickeln und angreifen zugleich. Der Springer greift den Bauern auf e5 an, deckt d4 und macht Platz zum Rochieren.',
        why: {
          en: 'Developing means bringing a piece off its back row so it can join in. Knights first is a good rule, and this one attacks too.',
          de: 'Entwickeln heißt: eine Figur von der Grundreihe holen, damit sie mitspielt. Springer zuerst ist eine gute Regel, und dieser greift auch an.'
        },
        threat: {
          en: 'Your knight can take the e5 pawn, because nothing guards it yet.',
          de: 'Dein Springer kann den Bauern auf e5 schlagen, denn noch deckt ihn nichts.',
          arrows: ['f3e5']
        }
      },
      {
        san: 'Nc6',
        en: 'Black defends the pawn with a piece that also covers d4: one move doing two jobs.',
        de: 'Schwarz verteidigt den Bauern mit einer Figur, die zugleich d4 deckt: ein Zug, zwei Aufgaben.',
        why: {
          en: 'Black has to save e5. A pawn move like d6 would work too, but the knight defends and develops in one go.',
          de: 'Schwarz muss e5 retten. Ein Bauernzug wie d6 ginge auch, aber der Springer deckt und entwickelt sich in einem Zug.'
        }
      },
      {
        san: 'Bc4',
        en: 'The Italian bishop. From here it aims at f7, the weakest square Black has, because only the king is guarding it.',
        de: 'Der italienische Läufer. Von hier zielt er auf f7, das schwächste Feld bei Schwarz, weil nur der König es deckt.',
        why: {
          en: 'Early in the game f7 is Black’s softest spot. If a second piece joins your bishop there, Black’s king gets into trouble.',
          de: 'Am Anfang ist f7 die weichste Stelle von Schwarz. Kommt eine zweite Figur zu deinem Läufer dazu, gerät der schwarze König in Not.'
        }
      },
      {
        san: 'Bc5',
        en: 'Black copies you. Bringing the bishop out before the knight keeps the queen watching g5, so Black can castle in peace.',
        de: 'Schwarz macht es dir nach. Erst der Läufer, dann der Springer: So behält die Dame g5 im Blick und Schwarz kann in Ruhe rochieren.',
        why: {
          en: 'Now Black’s bishop aims at f2, the same soft spot on your side. Both sides get ready to castle.',
          de: 'Jetzt zielt der schwarze Läufer auf f2, dieselbe weiche Stelle bei dir. Beide machen sich bereit zur Rochade.'
        }
      },
      {
        san: 'c3',
        en: 'The quiet move that makes the next one work. Right now Black guards d4 three times and you only twice, so play d4 immediately and you just lose the pawn. This evens the count.',
        de: 'Der leise Zug, der den nächsten erst möglich macht. Im Moment deckt Schwarz d4 dreimal, du nur zweimal. Spielst du d4 sofort, verlierst du den Bauern einfach. Das hier gleicht die Rechnung aus.',
        why: {
          en: 'With c3 your d4 pawn will have a pawn behind it. If Black takes on d4, you take back with a pawn and keep the centre.',
          de: 'Mit c3 bekommt dein Bauer auf d4 einen Bauern als Stütze. Schlägt Schwarz auf d4, nimmst du mit dem Bauern zurück und behältst die Mitte.'
        }
      },
      {
        san: 'Nf6',
        en: 'Black develops and hits your e4 pawn, getting ready to castle as well.',
        de: 'Schwarz entwickelt sich, greift deinen Bauern auf e4 an und bereitet ebenfalls die Rochade vor.',
        why: {
          en: 'The knight on f6 guards Black’s king and attacks at the same time. Moves that develop and attack are the best kind.',
          de: 'Der Springer auf f6 schützt den schwarzen König und greift zugleich an. Züge, die entwickeln und angreifen, sind die besten.'
        },
        threat: {
          en: 'The knight can take your e4 pawn, because right now nothing guards it.',
          de: 'Der Springer kann deinen Bauern auf e4 schlagen, denn gerade deckt ihn nichts.',
          arrows: ['f6e4']
        }
      },
      {
        san: 'd4',
        en: 'Now it works. Two pawns side by side in the middle, and Black has to take them or hand you the whole centre.',
        de: 'Jetzt geht es. Zwei Bauern nebeneinander in der Mitte, und Schwarz muss zuschlagen oder dir das ganze Zentrum überlassen.',
        why: {
          en: 'Two pawns side by side in the middle are strong: they take squares away from Black’s pieces and can push forward.',
          de: 'Zwei Bauern nebeneinander in der Mitte sind stark: Sie nehmen den schwarzen Figuren Felder weg und können vorrücken.'
        },
        threat: {
          en: 'Your d4 pawn attacks the bishop on c5. If Black ignores it, you win a whole bishop for a pawn.',
          de: 'Dein Bauer auf d4 greift den Läufer auf c5 an. Ignoriert Schwarz das, gewinnst du einen ganzen Läufer.',
          arrows: ['d4c5']
        }
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
    aims: {
      w: {
        en: 'Press on e5 through the knight that guards it, castle quickly, then build a centre with c3 and d4.',
        de: 'Über den Springer, der e5 deckt, Druck auf e5 machen, schnell rochieren und dann mit c3 und d4 ein Zentrum bauen.'
      },
      b: {
        en: 'Keep e5 safe, ask the bishop a question with a6 and later b5, develop and castle, then fight back in the centre.',
        de: 'e5 sicher halten, dem Läufer mit a6 und später b5 eine Frage stellen, entwickeln, rochieren und dann in der Mitte zurückschlagen.'
      }
    },
    plans: [
      {
        en: 'Castle, put a rook on e1, then play c3 and d4 for a big centre.',
        de: 'Rochieren, einen Turm nach e1 stellen, dann c3 und d4 für ein großes Zentrum.'
      },
      {
        en: 'When Black pushes b5, step back to b3. From there the bishop still looks at f7.',
        de: 'Wenn Schwarz b5 spielt, geh mit dem Läufer nach b3. Von dort schaut er weiter auf f7.'
      }
    ],
    traps: [
      {
        en: 'Do not grab e5 too early. After you take on c6 and then take e5 with the knight, the black queen jumps to d4, hits your knight and e4, and wins the pawn back.',
        de: 'Nimm e5 nicht zu früh. Schlägst du auf c6 und dann mit dem Springer auf e5, springt die schwarze Dame nach d4, greift Springer und e4 an und holt den Bauern zurück.',
        moves: '1. e4 e5 2. Nf3 Nc6 3. Bb5 a6 4. Bxc6 dxc6 5. Nxe5 Qd4'
      },
      {
        en: 'Noah’s Ark trap: if your queen grabs a pawn on d4 too early, Black pushes c5 and c4, and your bishop on b3 is shut in by a wall of black pawns.',
        de: 'Die Arche-Noah-Falle: Schnappt deine Dame zu früh einen Bauern auf d4, zieht Schwarz c5 und c4, und dein Läufer auf b3 sitzt hinter einer Wand aus schwarzen Bauern fest.',
        moves: '1. e4 e5 2. Nf3 Nc6 3. Bb5 a6 4. Ba4 d6 5. d4 b5 6. Bb3 Nxd4 7. Nxd4 exd4 8. Qxd4 c5 9. Qd5 Be6 10. Qc6+ Bd7 11. Qd5 c4'
      }
    ],
    pgn: '1. e4 e5 2. Nf3 Nc6 3. Bb5 a6 4. Ba4 Nf6 5. O-O',
    moves: [
      {
        san: 'e4',
        en: 'Straight into the middle. The pawn takes a centre square, watches d5, and opens the door for both your bishop and your queen.',
        de: 'Direkt in die Mitte. Der Bauer nimmt ein Zentrumsfeld, bewacht d5 und macht den Weg frei für Läufer und Dame.',
        why: {
          en: 'Pawns in the middle give your pieces room to come out. Whoever owns the centre usually has the easier game.',
          de: 'Bauern in der Mitte geben deinen Figuren Platz. Wer das Zentrum hat, hat meistens das leichtere Spiel.'
        }
      },
      {
        san: 'e5',
        en: 'Black claims the same share of the middle, and gets in the way of your d4.',
        de: 'Schwarz beansprucht denselben Anteil an der Mitte und steht deinem d4 im Weg.',
        why: {
          en: 'If Black let you have both e4 and d4, your pawns would push Black’s pieces back. So Black takes a share of the middle at once.',
          de: 'Ließe Schwarz dir e4 und d4, würden deine Bauern seine Figuren zurückdrängen. Also nimmt Schwarz sich sofort ein Stück Mitte.'
        }
      },
      {
        san: 'Nf3',
        en: 'Develop and attack at once: the knight goes for the e5 pawn and clears the way for castling.',
        de: 'Entwickeln und angreifen zugleich: Der Springer greift den Bauern auf e5 an und macht den Weg zur Rochade frei.',
        why: {
          en: 'Developing means bringing a piece off its back row so it can join in. Knights first is a good rule, and this one attacks too.',
          de: 'Entwickeln heißt: eine Figur von der Grundreihe holen, damit sie mitspielt. Springer zuerst ist eine gute Regel, und dieser greift auch an.'
        },
        threat: {
          en: 'Your knight can take the e5 pawn, because nothing guards it yet.',
          de: 'Dein Springer kann den Bauern auf e5 schlagen, denn noch deckt ihn nichts.',
          arrows: ['f3e5']
        }
      },
      {
        san: 'Nc6',
        en: 'Black defends the pawn with a piece that also covers d4: one move doing two jobs.',
        de: 'Schwarz verteidigt den Bauern mit einer Figur, die zugleich d4 deckt: ein Zug, zwei Aufgaben.',
        why: {
          en: 'Black has to save e5. A pawn move like d6 would work too, but the knight defends and develops in one go.',
          de: 'Schwarz muss e5 retten. Ein Bauernzug wie d6 ginge auch, aber der Springer deckt und entwickelt sich in einem Zug.'
        }
      },
      {
        san: 'Bb5',
        en: 'The Spanish bishop, and the whole idea of the opening. It does not attack the e5 pawn. It attacks the knight that is defending it. Careful, though: you cannot just win that pawn yet, because after Bxc6 dxc6 Nxe5 Black has Qd4 and takes the material straight back.',
        de: 'Der spanische Läufer. Das ist die ganze Idee der Eröffnung. Er greift nicht den Bauern auf e5 an, sondern den Springer, der ihn deckt. Aber Vorsicht: Einfach gewinnen kannst du den Bauern noch nicht, denn nach Lxc6 dxc6 Sxe5 kommt Dd4 und Schwarz holt sich das Material sofort zurück.',
        why: {
          en: 'The knight on c6 is the only guard of e5. Attack the guard, and you are really attacking the pawn behind it.',
          de: 'Der Springer auf c6 ist die einzige Wache von e5. Greifst du die Wache an, greifst du eigentlich den Bauern dahinter an.'
        }
      },
      {
        san: 'a6',
        en: 'Black asks the bishop a question: take, or step back, but you cannot stay there.',
        de: 'Schwarz stellt dem Läufer eine Frage: schlagen oder zurückgehen. Stehen bleiben geht nicht.',
        why: {
          en: 'Black wants an answer right now: if you take on c6, Black gets an open line for the c8 bishop, and if you step back, Black can push b5 later.',
          de: 'Schwarz will sofort eine Antwort: Nimmst du auf c6, bekommt der Läufer auf c8 freie Bahn. Gehst du zurück, kann Schwarz später b5 spielen.'
        },
        threat: {
          en: 'The a6 pawn attacks your bishop. If it stays on b5, it gets taken.',
          de: 'Der Bauer auf a6 greift deinen Läufer an. Bleibt er auf b5, wird er geschlagen.',
          arrows: ['a6b5']
        }
      },
      {
        san: 'Ba4',
        en: 'Step back, but stay on the same diagonal. The bishop still eyes the knight on c6, so the pressure has not gone anywhere.',
        de: 'Zurückgehen, aber auf derselben Diagonale bleiben. Der Läufer schaut weiter auf den Springer auf c6. Der Druck bleibt.',
        why: {
          en: 'Taking on c6 would swap your bishop for a knight and end the pressure. From a4 the bishop keeps watching the knight.',
          de: 'Auf c6 zu schlagen würde Läufer gegen Springer tauschen und den Druck beenden. Von a4 behält der Läufer den Springer im Blick.'
        }
      },
      {
        san: 'Nf6',
        en: 'Black develops and hits your e4 pawn, so now it is your pawn that needs an answer.',
        de: 'Schwarz entwickelt sich und greift deinen Bauern auf e4 an. Jetzt braucht dein Bauer eine Antwort.',
        why: {
          en: 'The knight develops and guards Black’s king. Hitting a pawn at the same time makes you answer, and that wins Black time.',
          de: 'Der Springer entwickelt sich und schützt den schwarzen König. Weil er dabei einen Bauern angreift, musst du antworten. Das bringt Schwarz Zeit.'
        },
        threat: {
          en: 'The knight can take your e4 pawn, which no piece guards right now.',
          de: 'Der Springer kann deinen Bauern auf e4 schlagen. Gerade deckt ihn keine Figur.',
          arrows: ['f6e4']
        }
      },
      {
        san: 'O-O',
        en: 'And you let it hang. Getting the king safe is worth more than the pawn here, and the pawn is not really lost. The rook is coming to e1 to look after it.',
        de: 'Und du lässt ihn hängen. Den König in Sicherheit zu bringen ist hier mehr wert als der Bauer, und verloren ist er nicht wirklich: Der Turm kommt nach e1 und kümmert sich darum.',
        why: {
          en: 'Castling hides your king in the corner and brings the rook closer to the middle. If Black takes e4, your rook on e1 wins it back.',
          de: 'Die Rochade versteckt deinen König in der Ecke und bringt den Turm näher zur Mitte. Nimmt Schwarz e4, holt dein Turm auf e1 ihn zurück.'
        }
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
    aims: {
      w: {
        en: 'Open the centre early, put a knight on d4 and use the room to develop fast.',
        de: 'Die Mitte früh öffnen, einen Springer nach d4 stellen und den Platz nutzen, um schnell zu entwickeln.'
      },
      b: {
        en: 'Trade in the centre, then bring the pieces out with attacks like the bishop to c5, and castle quickly.',
        de: 'In der Mitte tauschen, die Figuren mit Angriffen wie dem Läufer nach c5 herausbringen und schnell rochieren.'
      }
    },
    plans: [
      {
        en: 'Answer the bishop on c5 with your bishop to e3: it guards the knight and develops at the same time.',
        de: 'Antworte auf den Läufer auf c5 mit deinem Läufer nach e3: Er deckt den Springer und entwickelt sich zugleich.'
      },
      {
        en: 'Castle, then bring a rook to the open centre, for example to e1.',
        de: 'Rochieren und dann einen Turm in die offene Mitte bringen, zum Beispiel nach e1.'
      }
    ],
    traps: [
      {
        en: 'Careful after the bishop comes to c5: if your knight takes on c6, the black queen jumps to f6 and threatens to take on f2 with checkmate.',
        de: 'Vorsicht, wenn der Läufer nach c5 kommt: Nimmt dein Springer auf c6, springt die schwarze Dame nach f6 und droht auf f2 Schachmatt.',
        moves: '1. e4 e5 2. Nf3 Nc6 3. d4 exd4 4. Nxd4 Bc5 5. Nxc6 Qf6'
      }
    ],
    pgn: '1. e4 e5 2. Nf3 Nc6 3. d4 exd4 4. Nxd4 Bc5',
    moves: [
      {
        san: 'e4',
        en: 'Straight into the middle. The pawn takes a centre square, watches d5, and opens the door for both your bishop and your queen.',
        de: 'Direkt in die Mitte. Der Bauer nimmt ein Zentrumsfeld, bewacht d5 und macht den Weg frei für Läufer und Dame.',
        why: {
          en: 'Pawns in the middle give your pieces room to come out. Whoever owns the centre usually has the easier game.',
          de: 'Bauern in der Mitte geben deinen Figuren Platz. Wer das Zentrum hat, hat meistens das leichtere Spiel.'
        }
      },
      {
        san: 'e5',
        en: 'Black claims the same share of the middle, and gets in the way of your d4.',
        de: 'Schwarz beansprucht denselben Anteil an der Mitte und steht deinem d4 im Weg.',
        why: {
          en: 'If Black let you have both e4 and d4, your pawns would push Black’s pieces back. So Black takes a share of the middle at once.',
          de: 'Ließe Schwarz dir e4 und d4, würden deine Bauern seine Figuren zurückdrängen. Also nimmt Schwarz sich sofort ein Stück Mitte.'
        }
      },
      {
        san: 'Nf3',
        en: 'Develop and attack at once: the knight goes for the e5 pawn and clears the way for castling.',
        de: 'Entwickeln und angreifen zugleich: Der Springer greift den Bauern auf e5 an und macht den Weg zur Rochade frei.',
        why: {
          en: 'Developing means bringing a piece off its back row so it can join in. Knights first is a good rule, and this one attacks too.',
          de: 'Entwickeln heißt: eine Figur von der Grundreihe holen, damit sie mitspielt. Springer zuerst ist eine gute Regel, und dieser greift auch an.'
        },
        threat: {
          en: 'Your knight can take the e5 pawn, because nothing guards it yet.',
          de: 'Dein Springer kann den Bauern auf e5 schlagen, denn noch deckt ihn nichts.',
          arrows: ['f3e5']
        }
      },
      {
        san: 'Nc6',
        en: 'Black defends the pawn with a piece that also covers d4: one move doing two jobs.',
        de: 'Schwarz verteidigt den Bauern mit einer Figur, die zugleich d4 deckt: ein Zug, zwei Aufgaben.',
        why: {
          en: 'Black has to save e5. A pawn move like d6 would work too, but the knight defends and develops in one go.',
          de: 'Schwarz muss e5 retten. Ein Bauernzug wie d6 ginge auch, aber der Springer deckt und entwickelt sich in einem Zug.'
        }
      },
      {
        san: 'd4',
        en: 'Now, before Black is ready. You hit the middle with a second pawn and Black has to decide about e5 this move. No time to get organised first.',
        de: 'Jetzt, bevor Schwarz bereit ist. Du schlägst mit einem zweiten Bauern in der Mitte zu, und Schwarz muss sich sofort um e5 kümmern. Keine Zeit, sich vorher zu sortieren.',
        why: {
          en: 'Two attackers on e5 and only one defender. Black has to act now, and the centre opens while your pieces come out fast.',
          de: 'Zwei Angreifer auf e5 und nur ein Verteidiger. Schwarz muss sofort handeln, und die Mitte öffnet sich, während deine Figuren schnell herauskommen.'
        },
        threat: {
          en: 'Your d4 pawn and your knight both attack e5. One guard is not enough, so Black must react.',
          de: 'Dein Bauer auf d4 und dein Springer greifen beide e5 an. Eine Wache reicht nicht, Schwarz muss reagieren.',
          arrows: ['d4e5', 'f3e5']
        }
      },
      {
        san: 'exd4',
        en: 'Black takes, and almost everyone does. The centre is open now, and both sides get a lot of room.',
        de: 'Schwarz schlägt, und das machen fast alle. Das Zentrum ist jetzt offen, und beide Seiten bekommen viel Platz.',
        why: {
          en: 'Black swaps the e5 pawn before it gets lost. The black pawn now stands on d4, and you take it back right away.',
          de: 'Schwarz tauscht den Bauern auf e5, bevor er verloren geht. Der schwarze Bauer steht jetzt auf d4, und du nimmst ihn sofort zurück.'
        }
      },
      {
        san: 'Nxd4',
        en: 'You take back with the knight, which lands right in the middle of the board with your queen behind it.',
        de: 'Du schlägst mit dem Springer zurück. Er landet mitten auf dem Brett, die Dame im Rücken.',
        why: {
          en: 'A knight in the middle reaches many squares. Your queen behind it on d1 guards it.',
          de: 'Ein Springer in der Mitte erreicht viele Felder. Deine Dame dahinter auf d1 deckt ihn.'
        }
      },
      {
        san: 'Bc5',
        en: 'Black points a bishop at your knight and asks what you are going to do about it. The knight is only defended by the queen, so you will have to answer this next move.',
        de: 'Schwarz richtet einen Läufer auf deinen Springer und fragt, was du dagegen tun willst. Der Springer wird nur von der Dame gedeckt. Im nächsten Zug musst du also antworten.',
        why: {
          en: 'Black develops and attacks at once. A move that forces you to react wins a tempo, which means a move of time.',
          de: 'Schwarz entwickelt sich und greift zugleich an. Ein Zug, auf den du reagieren musst, gewinnt ein Tempo, also einen Zug Zeit.'
        },
        threat: {
          en: 'The bishop and the c6 knight both attack your d4 knight, and only your queen guards it: two against one.',
          de: 'Läufer und Springer auf c6 greifen beide deinen Springer auf d4 an. Nur deine Dame deckt ihn: zwei gegen eins.',
          arrows: ['c5d4', 'c6d4']
        }
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
    aims: {
      w: {
        en: 'Develop fast, aim bishop and queen at f7, and later push the f-pawn to open lines towards Black’s king.',
        de: 'Schnell entwickeln, mit Läufer und Dame auf f7 zielen und später mit dem f-Bauern Linien zum schwarzen König öffnen.'
      },
      b: {
        en: 'Take the e4 pawn, then survive the queen attack with exact moves, starting with the knight to d6.',
        de: 'Den Bauern auf e4 nehmen und dann den Angriff der Dame mit genauen Zügen überstehen, angefangen mit dem Springer nach d6.'
      }
    },
    plans: [
      {
        en: 'If Black does not take on e4, play d3 and then f4: the f-pawn opens a line for your rook.',
        de: 'Nimmt Schwarz nicht auf e4, spiel d3 und dann f4: Der f-Bauer öffnet eine Linie für deinen Turm.'
      },
      {
        en: 'After the knight goes to d6, keep your bishop with a step back to b3 and bring your knight to b5.',
        de: 'Geht der Springer nach d6, rette deinen Läufer nach b3 und bring deinen Springer nach b5.'
      }
    ],
    traps: [
      {
        en: 'If Black’s knight steps back to f6 and attacks your queen, ignore it: the queen takes on f7, and that is checkmate.',
        de: 'Geht der schwarze Springer nach f6 zurück und greift deine Dame an, ignoriere das: Die Dame schlägt auf f7, und das ist Schachmatt.',
        moves: '1. e4 e5 2. Nc3 Nf6 3. Bc4 Nxe4 4. Qh5 Nf6 5. Qxf7#'
      },
      {
        en: 'Do not take back on e4 with your knight. Black then pushes d5 and attacks your bishop and knight at once, and wins the piece back.',
        de: 'Nimm auf e4 nicht mit dem Springer zurück. Dann zieht Schwarz d5, greift Läufer und Springer zugleich an und holt die Figur zurück.',
        moves: '1. e4 e5 2. Nc3 Nf6 3. Bc4 Nxe4 4. Nxe4 d5'
      }
    ],
    pgn: '1. e4 e5 2. Nc3 Nf6 3. Bc4 Nxe4 4. Qh5',
    moves: [
      {
        san: 'e4',
        en: 'Straight into the middle. The pawn takes a centre square, watches d5, and opens the door for both your bishop and your queen.',
        de: 'Direkt in die Mitte. Der Bauer nimmt ein Zentrumsfeld, bewacht d5 und macht den Weg frei für Läufer und Dame.',
        why: {
          en: 'Pawns in the middle give your pieces room to come out. Whoever owns the centre usually has the easier game.',
          de: 'Bauern in der Mitte geben deinen Figuren Platz. Wer das Zentrum hat, hat meistens das leichtere Spiel.'
        }
      },
      {
        san: 'e5',
        en: 'Black claims the same share of the middle.',
        de: 'Schwarz beansprucht denselben Anteil an der Mitte.',
        why: {
          en: 'Black takes an equal share of the middle, so you can not simply build a big pawn centre.',
          de: 'Schwarz nimmt sich genauso viel Mitte, damit du nicht einfach ein großes Bauernzentrum bauen kannst.'
        }
      },
      {
        san: 'Nc3',
        en: 'The knight comes out towards the centre and guards your e4 pawn while it is there.',
        de: 'Der Springer kommt Richtung Zentrum heraus und deckt dabei deinen Bauern auf e4.',
        why: {
          en: 'With the knight on c3 instead of f3, your f-pawn stays free. Later it can push to f4 and open a line for your rook.',
          de: 'Steht der Springer auf c3 statt f3, bleibt dein f-Bauer frei. Später kann er nach f4 und eine Linie für deinen Turm öffnen.'
        }
      },
      {
        san: 'Nf6',
        en: 'Black develops and takes aim at e4, the pawn your knight is currently defending.',
        de: 'Schwarz entwickelt sich und nimmt e4 ins Visier, den Bauern, den dein Springer gerade deckt.',
        why: {
          en: 'Black’s knight guards the king and puts a question to e4. It also keeps an eye on d5.',
          de: 'Der schwarze Springer schützt den König und stellt e4 eine Frage. Außerdem behält er d5 im Blick.'
        }
      },
      {
        san: 'Bc4',
        en: 'The bishop joins in, and now three of your pieces watch d5. It also means you have stopped guarding e4 with a pawn move, which is an invitation.',
        de: 'Der Läufer kommt dazu, und jetzt bewachen drei deiner Figuren d5. Es heißt aber auch: Du deckst e4 nicht mit einem Bauernzug ab, und das ist eine Einladung.',
        why: {
          en: 'Your bishop aims at f7 again. The e4 pawn is loose now, but taking it opens lines towards Black’s own king.',
          de: 'Dein Läufer zielt wieder auf f7. Der Bauer auf e4 ist jetzt locker, aber ihn zu nehmen öffnet Linien zum schwarzen König.'
        }
      },
      {
        san: 'Nxe4',
        en: 'Black accepts and takes the pawn. It is not greedy. It is the main line, and it clears two of your defenders away from d5 at the same time.',
        de: 'Schwarz nimmt an und schlägt den Bauern. Das ist nicht gierig. Das ist die Hauptvariante, und es räumt gleichzeitig zwei deiner Verteidiger von d5 weg.',
        why: {
          en: 'Black uses a trick: if you take back with the knight, d5 attacks bishop and knight at once. One piece hitting two is called a fork.',
          de: 'Schwarz nutzt einen Trick: Nimmst du mit dem Springer zurück, greift d5 Läufer und Springer zugleich an. Das nennt man eine Gabel.'
        }
      },
      {
        san: 'Qh5',
        en: 'Out comes the queen, and yes, you were probably told not to do this. Here it works, because from h5 she attacks f7 and e5 at the same time, and f7 is only guarded by the king. Play a careless move now and it is mate.',
        de: 'Die Dame kommt heraus, und ja, davon hat man dir wahrscheinlich abgeraten. Hier funktioniert es: Von h5 greift sie f7 und e5 gleichzeitig an, und f7 deckt nur der König. Ein unachtsamer Zug jetzt, und es ist matt.',
        why: {
          en: 'The queen attacks f7 with the bishop behind her, and the e5 pawn too. Black’s only good answer is the knight to d6.',
          de: 'Die Dame greift f7 an, mit dem Läufer dahinter, und dazu den Bauern auf e5. Die einzige gute Antwort für Schwarz ist der Springer nach d6.'
        },
        threat: {
          en: 'Taking on f7 would be checkmate: the queen takes, and the bishop guards her.',
          de: 'Auf f7 zu schlagen wäre Schachmatt: Die Dame schlägt, und der Läufer deckt sie.',
          arrows: ['h5f7']
        }
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
    aims: {
      w: {
        en: 'Give a pawn, open the line in front of your f1 rook, build a centre with d4 and attack Black’s king.',
        de: 'Einen Bauern geben, die Linie vor deinem Turm auf f1 öffnen, mit d4 ein Zentrum bauen und den schwarzen König angreifen.'
      },
      b: {
        en: 'Keep the extra pawn if it is safe, develop fast and keep your king safe. Giving the pawn back for an easy game is fine too.',
        de: 'Den Mehrbauern behalten, wenn es sicher geht, schnell entwickeln und den König schützen. Den Bauern für ein leichtes Spiel zurückgeben ist auch gut.'
      }
    },
    plans: [
      {
        en: 'Castle and let your rook look down the f-line: once the f4 pawn is gone, the rook aims straight at f7.',
        de: 'Rochieren und den Turm auf der f-Linie wirken lassen: Ist der Bauer f4 weg, zielt der Turm direkt auf f7.'
      },
      {
        en: 'Build the centre with d4, then win back the f4 pawn with your c1 bishop.',
        de: 'Mit d4 das Zentrum bauen und dann den Bauern auf f4 mit deinem Läufer von c1 zurückholen.'
      },
      {
        en: 'If Black pushes g4 to chase your knight, jump into the centre with the knight to e5.',
        de: 'Jagt Schwarz deinen Springer mit g4, spring mit ihm in die Mitte nach e5.'
      }
    ],
    traps: [
      {
        en: 'Never allow the queen check on h4 early. If your knight is not on f3 yet, the check forces your king to walk and you can not castle any more.',
        de: 'Lass das Damenschach auf h4 nie früh zu. Steht dein Springer noch nicht auf f3, muss dein König laufen und kann nicht mehr rochieren.',
        moves: '1. e4 e5 2. f4 exf4 3. Bc4 Qh4+'
      }
    ],
    pgn: '1. e4 e5 2. f4 exf4 3. Nf3 g5 4. h4',
    moves: [
      {
        san: 'e4',
        en: 'Straight into the middle. The pawn takes a centre square, watches d5, and opens the door for both your bishop and your queen.',
        de: 'Direkt in die Mitte. Der Bauer nimmt ein Zentrumsfeld, bewacht d5 und macht den Weg frei für Läufer und Dame.',
        why: {
          en: 'Pawns in the middle give your pieces room to come out. Whoever owns the centre usually has the easier game.',
          de: 'Bauern in der Mitte geben deinen Figuren Platz. Wer das Zentrum hat, hat meistens das leichtere Spiel.'
        }
      },
      {
        san: 'e5',
        en: 'Black claims the same share of the middle.',
        de: 'Schwarz beansprucht denselben Anteil an der Mitte.',
        why: {
          en: 'Black takes an equal share of the middle. Now you can offer your gambit.',
          de: 'Schwarz nimmt sich genauso viel Mitte. Jetzt kannst du dein Gambit anbieten.'
        }
      },
      {
        san: 'f4',
        en: 'The gambit. You offer the pawn to pull Black’s e-pawn away from the centre and to open the f-file for your rook once you castle. It does loosen the squares around your own king. That is the deal you are making.',
        de: 'Das Gambit. Du bietest den Bauern an, um den schwarzen e-Bauern aus dem Zentrum zu ziehen und die f-Linie für deinen Turm zu öffnen, sobald du rochierst. Dafür werden die Felder um deinen eigenen König lockerer. Das ist der Handel.',
        why: {
          en: 'A gambit is a pawn you give away on purpose to get something better. Here you get open lines and a fast attack.',
          de: 'Ein Gambit ist ein Bauer, den du absichtlich hergibst, um etwas Besseres zu bekommen. Hier: offene Linien und einen schnellen Angriff.'
        },
        threat: {
          en: 'Your f-pawn attacks e5. If Black ignores it, you take and own the middle.',
          de: 'Dein f-Bauer greift e5 an. Ignoriert Schwarz das, schlägst du und gehörst dir die Mitte.',
          arrows: ['f4e5']
        }
      },
      {
        san: 'exf4',
        en: 'Black takes. Watch out now: with the f-file open, Black would love to play Qh4 with check, and you could not block it with the g-pawn.',
        de: 'Schwarz nimmt. Jetzt aufpassen: Bei offener f-Linie würde Schwarz gern Dh4 mit Schach spielen, und mit dem g-Bauern könntest du das nicht blocken.',
        why: {
          en: 'Black takes the gift. Your e4 pawn now stands alone in the middle, and Black hopes to keep the extra pawn.',
          de: 'Schwarz nimmt das Geschenk. Dein Bauer auf e4 steht jetzt allein in der Mitte, und Schwarz hofft, den Mehrbauern zu behalten.'
        },
        threat: {
          en: 'The queen to h4 would be check, and your g-pawn could not block, because the f4 pawn would take it.',
          de: 'Die Dame nach h4 wäre Schach, und dein g-Bauer könnte nicht dazwischen, denn der Bauer auf f4 würde ihn schlagen.',
          arrows: ['d8h4']
        }
      },
      {
        san: 'Nf3',
        en: 'Develop, and stop that check before it happens: from f3 the knight covers h4, so the queen cannot come. It also gets you ready to take the pawn back later.',
        de: 'Entwickeln und das Schach verhindern, bevor es kommt: Von f3 deckt der Springer h4, die Dame kann also nicht dorthin. Nebenbei bereitest du vor, dir den Bauern später zurückzuholen.',
        why: {
          en: 'From f3 the knight guards h4, so the queen check is gone. And one more piece is out.',
          de: 'Von f3 deckt der Springer h4, also ist das Damenschach weg. Und eine Figur mehr ist draußen.'
        }
      },
      {
        san: 'g5',
        en: 'Black props the extra pawn up with another pawn. Left alone, Black adds h6 and Bg7 and that pawn on f4 turns into a little fortress.',
        de: 'Schwarz stützt den Mehrbauern mit einem weiteren Bauern. Lässt du ihn machen, kommen noch h6 und Lg7 dazu, und der Bauer auf f4 wird zu einer kleinen Festung.',
        why: {
          en: 'The g5 pawn guards f4 so Black can keep the extra pawn. The price: the pawns in front of Black’s king get loose.',
          de: 'Der Bauer auf g5 deckt f4, damit Schwarz den Mehrbauern behält. Der Preis: Die Bauern vor dem schwarzen König werden locker.'
        },
        threat: {
          en: 'Black can push g4 next and chase your knight away from f3. Then the queen check on h4 is back.',
          de: 'Schwarz kann als Nächstes g4 ziehen und deinen Springer von f3 vertreiben. Dann ist das Damenschach auf h4 wieder da.',
          arrows: ['g5g4']
        }
      },
      {
        san: 'h4',
        en: 'So you hit it before it sets. The pawn on g5 is attacked twice and defended once, and Black has essentially one way to keep it: push past with g4.',
        de: 'Also schlägst du zu, bevor sie fest wird. Der Bauer auf g5 wird zweimal angegriffen und nur einmal gedeckt, und Schwarz hat im Grunde nur einen Weg, ihn zu halten: mit g4 vorbeiziehen.',
        why: {
          en: 'A row of pawns can be pried loose before it sets. Hit g5 now, before Black adds h6 and the bishop to g7.',
          de: 'Eine Bauernreihe kann man aufbrechen, bevor sie fest steht. Greif g5 jetzt an, bevor Schwarz h6 und den Läufer nach g7 spielt.'
        },
        threat: {
          en: 'Your h-pawn attacks g5. If you can take it, the f4 pawn loses its guard.',
          de: 'Dein h-Bauer greift g5 an. Kannst du ihn schlagen, verliert der Bauer auf f4 seine Wache.',
          arrows: ['h4g5']
        }
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
    aims: {
      w: {
        en: 'Use the same setup against almost anything: pawns on d4, e3 and c3, the bishop out to f4 first, then castle and attack on the king side.',
        de: 'Fast immer denselben Aufbau spielen: Bauern auf d4, e3 und c3, der Läufer zuerst nach f4, dann rochieren und am Königsflügel angreifen.'
      },
      b: {
        en: 'Challenge your f4 bishop, hit d4 with c5, and get the c8 bishop out before it gets shut in.',
        de: 'Deinen Läufer auf f4 herausfordern, d4 mit c5 angreifen und den Läufer auf c8 herausbringen, bevor er eingesperrt wird.'
      }
    },
    plans: [
      {
        en: 'Build the London house: d4, bishop to f4, e3, knight to f3, bishop to d3, the other knight to d2, c3, then castle.',
        de: 'Bau das London-Haus: d4, Läufer nach f4, e3, Springer nach f3, Läufer nach d3, den anderen Springer nach d2, c3, dann rochieren.'
      },
      {
        en: 'Later a knight on e5 and the queen on f3 or h5 can start an attack on Black’s king.',
        de: 'Später können ein Springer auf e5 und die Dame auf f3 oder h5 einen Angriff auf den schwarzen König starten.'
      }
    ],
    traps: [
      {
        en: 'Watch your b2 pawn: once your bishop has left c1, nothing guards it. The black queen on b6 can grab it, so guard it in time, for example with your queen to c1.',
        de: 'Pass auf deinen Bauern b2 auf: Hat dein Läufer c1 verlassen, deckt ihn nichts. Die schwarze Dame auf b6 kann ihn schnappen. Deck ihn rechtzeitig, zum Beispiel mit der Dame nach c1.',
        moves: '1. d4 d5 2. Nf3 Nf6 3. Bf4 c5 4. e3 Qb6'
      }
    ],
    pgn: '1. d4 d5 2. Nf3 Nf6 3. Bf4 e6 4. e3 Bd6',
    moves: [
      {
        san: 'd4',
        en: 'Take the centre with the other pawn. It grabs a middle square, covers c5 and e5, and opens a line for your queen’s bishop.',
        de: 'Das Zentrum mit dem anderen Bauern nehmen. Er belegt ein Mittelfeld, deckt c5 und e5 und öffnet eine Linie für deinen Damenläufer.',
        why: {
          en: 'With the pawn on d4, your queen on d1 guards it, so it is safe. It also opens the way for your c1 bishop.',
          de: 'Der Bauer auf d4 wird von deiner Dame auf d1 gedeckt, er steht also sicher. Außerdem macht er den Weg für deinen Läufer auf c1 frei.'
        }
      },
      {
        san: 'd5',
        en: 'Black stakes the same claim and covers e4, so you cannot get two pawns side by side in the middle.',
        de: 'Schwarz beansprucht dasselbe und deckt e4. Zwei Bauern nebeneinander in der Mitte bekommst du damit nicht.',
        why: {
          en: 'Black blocks your pawn and takes a centre square too. Now neither of the two pawns can move forward.',
          de: 'Schwarz blockiert deinen Bauern und nimmt sich auch ein Zentrumsfeld. Jetzt kann keiner der beiden Bauern weiter.'
        }
      },
      {
        san: 'Nf3',
        en: 'A calm developing move that keeps your options open.',
        de: 'Ein ruhiger Entwicklungszug, der dir alle Möglichkeiten offenhält.',
        why: {
          en: 'The knight guards d4 and e5 and goes to its best square first. You decide the rest of your setup later.',
          de: 'Der Springer deckt d4 und e5 und geht zuerst auf sein bestes Feld. Den Rest deines Aufbaus entscheidest du später.'
        }
      },
      {
        san: 'Nf6',
        en: 'Black develops the knight to its best square and keeps fighting for e4.',
        de: 'Schwarz entwickelt den Springer auf sein bestes Feld und kämpft weiter um e4.',
        why: {
          en: 'Black’s knight stops you from pushing e4 for free and guards Black’s king side.',
          de: 'Der schwarze Springer verhindert, dass du einfach e4 spielst, und schützt die Königsseite von Schwarz.'
        }
      },
      {
        san: 'Bf4',
        en: 'Here it is: the move the whole system is named for. The bishop steps outside the pawns before you close the door on it. This is the one move order you should not swap.',
        de: 'Da ist er: der Zug, nach dem das ganze System benannt ist. Der Läufer geht nach draußen, bevor du ihm die Tür zumachst. Das ist die eine Zugfolge, die du nicht vertauschen solltest.',
        why: {
          en: 'If e3 came first, the c1 bishop would be shut in behind your own pawns. So it goes out first, then you close the door.',
          de: 'Käme e3 zuerst, wäre der Läufer auf c1 hinter deinen eigenen Bauern eingesperrt. Also zuerst raus, dann die Tür zumachen.'
        }
      },
      {
        san: 'e6',
        en: 'Black backs up d5 and frees the dark-squared bishop, but shuts in the other one. That is exactly the problem you just avoided by going first.',
        de: 'Schwarz stützt d5 und macht den schwarzfeldrigen Läufer frei, sperrt dafür aber den anderen ein. Genau das Problem hast du dir eben erspart, weil du zuerst dran warst.',
        why: {
          en: 'Black builds a pawn wall with d5 and e6. Solid, but the c8 bishop is now stuck behind it.',
          de: 'Schwarz baut mit d5 und e6 eine Bauernmauer. Stabil, aber der Läufer auf c8 steckt jetzt dahinter fest.'
        }
      },
      {
        san: 'e3',
        en: 'Now the pawn can come. It props up d4, and your bishop is already outside, safely in front of it.',
        de: 'Jetzt darf der Bauer kommen. Er stützt d4, und dein Läufer steht längst draußen, sicher davor.',
        why: {
          en: 'Your pawn wall, d4 and e3, is hard to break. It also opens the way for your f1 bishop.',
          de: 'Deine Bauernmauer aus d4 und e3 ist schwer zu knacken. Außerdem öffnet sie den Weg für deinen Läufer auf f1.'
        }
      },
      {
        san: 'Bd6',
        en: 'Black brings a bishop out to face yours and offers a trade of the two.',
        de: 'Schwarz stellt einen Läufer gegen deinen und bietet den Abtausch der beiden an.',
        why: {
          en: 'Black wants to swap off your best bishop. You can trade, or keep it by stepping back to g3.',
          de: 'Schwarz will deinen besten Läufer abtauschen. Du kannst tauschen oder ihn mit einem Schritt nach g3 behalten.'
        }
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
    aims: {
      w: {
        en: 'Hold d4 calmly, finish your London setup and use your pieces once Black’s pressure runs out.',
        de: 'd4 in Ruhe halten, den London-Aufbau fertig machen und die Figuren nutzen, wenn der Druck von Schwarz nachlässt.'
      },
      b: {
        en: 'Hit d4 with c5 and the knight on c6, open the c-line and get the c8 bishop out before e6.',
        de: 'd4 mit c5 und dem Springer auf c6 angreifen, die c-Linie öffnen und den Läufer auf c8 vor e6 herausbringen.'
      }
    },
    plans: [
      {
        en: 'Count attackers and defenders on d4 before every move. More guards than attackers means the pawn is safe.',
        de: 'Zähl vor jedem Zug Angreifer und Verteidiger auf d4. Mehr Wachen als Angreifer heißt: Der Bauer ist sicher.'
      },
      {
        en: 'Your queen to b3 attacks b7, a pawn that often has no guard once the c8 bishop has gone out.',
        de: 'Deine Dame nach b3 greift b7 an, einen Bauern, der oft ungedeckt ist, wenn der Läufer von c8 weg ist.'
      }
    ],
    traps: [
      {
        en: 'The black queen on b6 hits your b2 pawn, which lost its guard when your bishop left c1. Guard it in time, for example with your queen to c1.',
        de: 'Die schwarze Dame auf b6 greift deinen Bauern b2 an, der seine Wache verlor, als dein Läufer c1 verließ. Deck ihn rechtzeitig, zum Beispiel mit der Dame nach c1.',
        moves: '1. d4 d5 2. Nf3 Nf6 3. Bf4 c5 4. e3 Qb6'
      }
    ],
    pgn: '1. d4 d5 2. Nf3 Nf6 3. Bf4 c5 4. e3 Nc6 5. Nbd2 cxd4 6. exd4 Bf5 7. c3 e6',
    moves: [
      {
        san: 'd4',
        en: 'Take the centre with the other pawn. It grabs a middle square, covers c5 and e5, and opens a line for your queen’s bishop.',
        de: 'Das Zentrum mit dem anderen Bauern nehmen. Er belegt ein Mittelfeld, deckt c5 und e5 und öffnet eine Linie für deinen Damenläufer.',
        why: {
          en: 'With the pawn on d4, your queen on d1 guards it, so it is safe. It also opens the way for your c1 bishop.',
          de: 'Der Bauer auf d4 wird von deiner Dame auf d1 gedeckt, er steht also sicher. Außerdem macht er den Weg für deinen Läufer auf c1 frei.'
        }
      },
      {
        san: 'd5',
        en: 'Black stakes the same claim and covers e4, so you cannot get two pawns side by side in the middle.',
        de: 'Schwarz beansprucht dasselbe und deckt e4. Zwei Bauern nebeneinander in der Mitte bekommst du damit nicht.',
        why: {
          en: 'Black blocks your pawn and takes a centre square too. Now neither of the two pawns can move forward.',
          de: 'Schwarz blockiert deinen Bauern und nimmt sich auch ein Zentrumsfeld. Jetzt kann keiner der beiden Bauern weiter.'
        }
      },
      {
        san: 'Nf3',
        en: 'A calm developing move that keeps your options open.',
        de: 'Ein ruhiger Entwicklungszug, der dir alle Möglichkeiten offenhält.',
        why: {
          en: 'The knight guards d4 and e5 and goes to its best square first. You decide the rest of your setup later.',
          de: 'Der Springer deckt d4 und e5 und geht zuerst auf sein bestes Feld. Den Rest deines Aufbaus entscheidest du später.'
        }
      },
      {
        san: 'Nf6',
        en: 'Black develops the knight to its best square and keeps fighting for e4.',
        de: 'Schwarz entwickelt den Springer auf sein bestes Feld und kämpft weiter um e4.',
        why: {
          en: 'Black’s knight stops you from pushing e4 for free and guards Black’s king side.',
          de: 'Der schwarze Springer verhindert, dass du einfach e4 spielst, und schützt die Königsseite von Schwarz.'
        }
      },
      {
        san: 'Bf4',
        en: 'Here it is: the move the whole system is named for. The bishop steps outside the pawns before you close the door on it. This is the one move order you should not swap.',
        de: 'Da ist er: der Zug, nach dem das ganze System benannt ist. Der Läufer geht nach draußen, bevor du ihm die Tür zumachst. Das ist die eine Zugfolge, die du nicht vertauschen solltest.',
        why: {
          en: 'If e3 came first, the c1 bishop would be shut in behind your own pawns. So it goes out first, then you close the door.',
          de: 'Käme e3 zuerst, wäre der Läufer auf c1 hinter deinen eigenen Bauern eingesperrt. Also zuerst raus, dann die Tür zumachen.'
        }
      },
      {
        san: 'c5',
        en: 'Black attacks your d4 pawn straight away. This is the usual way to challenge the London.',
        de: 'Schwarz greift sofort deinen Bauern auf d4 an. So wird das London-System meistens herausgefordert.',
        why: {
          en: 'Hitting d4 with a side pawn is Black’s best way to fight for the centre against the London.',
          de: 'd4 mit einem Bauern vom Rand anzugreifen ist der beste Weg für Schwarz, gegen das London um die Mitte zu kämpfen.'
        }
      },
      {
        san: 'e3',
        en: 'You back up d4 with the e-pawn. Your bishop is already outside the chain, so nothing gets locked in.',
        de: 'Du deckst d4 mit dem e-Bauern. Dein Läufer steht schon vor der Kette, es wird also nichts eingesperrt.',
        why: {
          en: 'If Black takes on d4, you take back with the e-pawn and keep a pawn in the middle.',
          de: 'Schlägt Schwarz auf d4, nimmst du mit dem e-Bauern zurück und behältst einen Bauern in der Mitte.'
        }
      },
      {
        san: 'Nc6',
        en: 'A second attacker on d4. Black now hits it with the c5 pawn and the knight.',
        de: 'Ein zweiter Angreifer auf d4. Schwarz greift ihn jetzt mit dem Bauern auf c5 und dem Springer an.',
        why: {
          en: 'The knight develops and joins the fight for d4. Now two black pieces press on your centre.',
          de: 'Der Springer entwickelt sich und kämpft mit um d4. Jetzt drücken zwei schwarze Figuren auf dein Zentrum.'
        }
      },
      {
        san: 'Nbd2',
        en: 'Count it: two attackers, and you have three defenders (the e3 pawn, the f3 knight and the queen). So d4 is safe, and you simply bring out your last knight.',
        de: 'Zähl nach: zwei Angreifer, aber du hast drei Verteidiger (den Bauern auf e3, den Springer auf f3 und die Dame). d4 ist also sicher, und du entwickelst einfach deinen letzten Springer.',
        why: {
          en: 'On d2 the knight does not block your c-pawn, so c3 can come later and guard d4 for good.',
          de: 'Auf d2 versperrt der Springer deinem c-Bauern nicht den Weg. So kann später c3 kommen und d4 für immer decken.'
        }
      },
      {
        san: 'cxd4',
        en: 'Black trades off the pawn to open the c-file for the rook.',
        de: 'Schwarz tauscht den Bauern ab, um die c-Linie für den Turm zu öffnen.',
        why: {
          en: 'An open line is a file with no pawns on it, where rooks can run freely. Black trades to open the c-line.',
          de: 'Eine offene Linie hat keine Bauern, Türme können darauf frei laufen. Schwarz tauscht, um die c-Linie zu öffnen.'
        }
      },
      {
        san: 'exd4',
        en: 'Take back with the e-pawn. You have a pawn on d4 again and the e-file is open for your rook and queen.',
        de: 'Nimm mit dem e-Bauern zurück. Du hast wieder einen Bauern auf d4, und die e-Linie ist für Turm und Dame offen.',
        why: {
          en: 'Taking with the e-pawn keeps a pawn on d4 and frees the e-line for your rook later.',
          de: 'Mit dem e-Bauern zu nehmen behält einen Bauern auf d4 und macht die e-Linie später für deinen Turm frei.'
        }
      },
      {
        san: 'Bf5',
        en: 'Black gets the light-squared bishop out, just as you did with yours. The two bishops now face each other.',
        de: 'Schwarz bringt den weißfeldrigen Läufer heraus, genau wie du deinen. Die beiden Läufer stehen sich jetzt gegenüber.',
        why: {
          en: 'Before e6 shuts the door, Black’s bishop gets out, just like yours did. Copying a good idea is allowed!',
          de: 'Bevor e6 die Tür schließt, kommt der schwarze Läufer heraus, genau wie deiner. Gute Ideen nachmachen ist erlaubt!'
        }
      },
      {
        san: 'c3',
        en: 'This pawn props up d4 for good, gives your queen the squares c2 and b3, and takes b4 away from the black knight.',
        de: 'Dieser Bauer stützt d4 dauerhaft, gibt deiner Dame die Felder c2 und b3 und nimmt dem schwarzen Springer das Feld b4.',
        why: {
          en: 'With c3, d4 has a pawn guard that never runs away. Your queen can now go to b3 and look at b7.',
          de: 'Mit c3 hat d4 eine Bauernwache, die nie wegläuft. Deine Dame kann jetzt nach b3 und auf b7 schauen.'
        }
      },
      {
        san: 'e6',
        en: 'Black closes the centre and frees the dark-squared bishop. Everything is solid on both sides.',
        de: 'Schwarz schließt das Zentrum und befreit den schwarzfeldrigen Läufer. Auf beiden Seiten steht alles solide.',
        why: {
          en: 'Black closes the wall and frees the f8 bishop. Both sides have a solid position now.',
          de: 'Schwarz schließt die Mauer und befreit den Läufer auf f8. Beide Seiten stehen jetzt stabil.'
        }
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
    aims: {
      w: {
        en: 'Trade off Black’s active bishops, keep your pawns healthy, castle and later push e4 to open the centre.',
        de: 'Die aktiven schwarzen Läufer abtauschen, die Bauern gesund halten, rochieren und später mit e4 die Mitte öffnen.'
      },
      b: {
        en: 'Copy the London: bishop out first, then e6, trade some pieces and castle into a calm position.',
        de: 'Das London nachmachen: zuerst der Läufer raus, dann e6, ein paar Figuren tauschen und in eine ruhige Stellung rochieren.'
      }
    },
    plans: [
      {
        en: 'Prepare e4 with the knight on d2 and a rook on e1. That pawn push opens the centre for your pieces.',
        de: 'Bereite e4 mit dem Springer auf d2 und einem Turm auf e1 vor. Dieser Bauernzug öffnet die Mitte für deine Figuren.'
      },
      {
        en: 'If the centre stays closed, push c4 to attack d5 from the side.',
        de: 'Bleibt die Mitte zu, greif d5 mit c4 von der Seite an.'
      }
    ],
    traps: [
      {
        en: 'If Black does not take on d3, you take on f5 and Black has to take back with the e6 pawn. Then Black has two pawns on one file, which block each other.',
        de: 'Nimmt Schwarz nicht auf d3, schlägst du auf f5 und Schwarz muss mit dem Bauern e6 zurücknehmen. Dann stehen zwei schwarze Bauern auf einer Linie und blockieren sich.',
        moves: '1. d4 d5 2. Nf3 Nf6 3. Bf4 Bf5 4. e3 e6 5. Bd3 Bd6 6. Bxf5 exf5'
      }
    ],
    pgn: '1. d4 d5 2. Nf3 Nf6 3. Bf4 Bf5 4. e3 e6 5. Bd3 Bxd3 6. Qxd3 Bd6 7. Bxd6 Qxd6 8. Nbd2 O-O',
    moves: [
      {
        san: 'd4',
        en: 'Take the centre with the other pawn. It grabs a middle square, covers c5 and e5, and opens a line for your queen’s bishop.',
        de: 'Das Zentrum mit dem anderen Bauern nehmen. Er belegt ein Mittelfeld, deckt c5 und e5 und öffnet eine Linie für deinen Damenläufer.',
        why: {
          en: 'With the pawn on d4, your queen on d1 guards it, so it is safe. It also opens the way for your c1 bishop.',
          de: 'Der Bauer auf d4 wird von deiner Dame auf d1 gedeckt, er steht also sicher. Außerdem macht er den Weg für deinen Läufer auf c1 frei.'
        }
      },
      {
        san: 'd5',
        en: 'Black stakes the same claim and covers e4, so you cannot get two pawns side by side in the middle.',
        de: 'Schwarz beansprucht dasselbe und deckt e4. Zwei Bauern nebeneinander in der Mitte bekommst du damit nicht.',
        why: {
          en: 'Black blocks your pawn and takes a centre square too. Now neither of the two pawns can move forward.',
          de: 'Schwarz blockiert deinen Bauern und nimmt sich auch ein Zentrumsfeld. Jetzt kann keiner der beiden Bauern weiter.'
        }
      },
      {
        san: 'Nf3',
        en: 'A calm developing move that keeps your options open.',
        de: 'Ein ruhiger Entwicklungszug, der dir alle Möglichkeiten offenhält.',
        why: {
          en: 'The knight guards d4 and e5 and goes to its best square first. You decide the rest of your setup later.',
          de: 'Der Springer deckt d4 und e5 und geht zuerst auf sein bestes Feld. Den Rest deines Aufbaus entscheidest du später.'
        }
      },
      {
        san: 'Nf6',
        en: 'Black develops the knight to its best square and keeps fighting for e4.',
        de: 'Schwarz entwickelt den Springer auf sein bestes Feld und kämpft weiter um e4.',
        why: {
          en: 'Black’s knight stops you from pushing e4 for free and guards Black’s king side.',
          de: 'Der schwarze Springer verhindert, dass du einfach e4 spielst, und schützt die Königsseite von Schwarz.'
        }
      },
      {
        san: 'Bf4',
        en: 'Here it is: the move the whole system is named for. The bishop steps outside the pawns before you close the door on it. This is the one move order you should not swap.',
        de: 'Da ist er: der Zug, nach dem das ganze System benannt ist. Der Läufer geht nach draußen, bevor du ihm die Tür zumachst. Das ist die eine Zugfolge, die du nicht vertauschen solltest.',
        why: {
          en: 'If e3 came first, the c1 bishop would be shut in behind your own pawns. So it goes out first, then you close the door.',
          de: 'Käme e3 zuerst, wäre der Läufer auf c1 hinter deinen eigenen Bauern eingesperrt. Also zuerst raus, dann die Tür zumachen.'
        }
      },
      {
        san: 'Bf5',
        en: 'Black copies your plan and brings the bishop outside the pawns before playing e6. Expect some bishop trades.',
        de: 'Schwarz kopiert deinen Plan und bringt den Läufer vor die Bauern, bevor er e6 spielt. Rechne mit einigen Läufertauschen.',
        why: {
          en: 'Black copies you: the bishop gets out before e6 shuts it in. Copying good ideas is a fine plan.',
          de: 'Schwarz macht es dir nach: Der Läufer kommt raus, bevor e6 ihn einsperrt. Gute Ideen nachmachen ist ein guter Plan.'
        }
      },
      {
        san: 'e3',
        en: 'Your usual solid move: the pawn guards d4 and opens the way for the light-squared bishop.',
        de: 'Dein üblicher solider Zug: Der Bauer deckt d4 und öffnet den Weg für den weißfeldrigen Läufer.',
        why: {
          en: 'Your pawn wall with d4 and e3 stands, and your f1 bishop can come out.',
          de: 'Deine Bauernmauer aus d4 und e3 steht, und dein Läufer auf f1 kann heraus.'
        }
      },
      {
        san: 'e6',
        en: 'Black backs up d5 and opens the way for the dark-squared bishop, just like you did.',
        de: 'Schwarz stützt d5 und öffnet den Weg für den schwarzfeldrigen Läufer, genau wie du.',
        why: {
          en: 'Black builds the same wall with d5 and e6. The two setups now look like a mirror.',
          de: 'Schwarz baut dieselbe Mauer aus d5 und e6. Die beiden Aufbauten sehen jetzt aus wie ein Spiegelbild.'
        }
      },
      {
        san: 'Bd3',
        en: 'You offer to trade bishops. It removes Black’s active light-squared bishop and costs you nothing in structure.',
        de: 'Du bietest den Läufertausch an. Er nimmt Schwarz den aktiven weißfeldrigen Läufer und kostet dich nichts in der Struktur.',
        why: {
          en: 'Black’s bishop on f5 is a strong piece. Swapping your quiet bishop for it is a good deal.',
          de: 'Der schwarze Läufer auf f5 ist eine starke Figur. Deinen ruhigen Läufer gegen ihn zu tauschen ist ein gutes Geschäft.'
        }
      },
      {
        san: 'Bxd3',
        en: 'Black accepts the trade.',
        de: 'Schwarz nimmt den Tausch an.',
        why: {
          en: 'If Black waited, you would take on f5 and spoil Black’s pawns. So Black takes first.',
          de: 'Würde Schwarz warten, nähmst du auf f5 und verdirbst die schwarzen Bauern. Also schlägt Schwarz zuerst.'
        }
      },
      {
        san: 'Qxd3',
        en: 'Take back with the queen. It is nicely placed on d3 and eyes the kingside.',
        de: 'Nimm mit der Dame zurück. Sie steht gut auf d3 und schaut zum Königsflügel.',
        why: {
          en: 'The queen takes back and stands well on d3, looking along the diagonal towards h7.',
          de: 'Die Dame nimmt zurück und steht gut auf d3. Sie schaut die Diagonale entlang bis nach h7.'
        }
      },
      {
        san: 'Bd6',
        en: 'Black offers to trade the other bishops as well. It is like a mirror.',
        de: 'Schwarz bietet auch den Tausch der anderen Läufer an. Es ist wie in einem Spiegel.',
        why: {
          en: 'Black wants to swap your f4 bishop too. Like a mirror, both sides offer the same trades.',
          de: 'Schwarz will auch deinen Läufer auf f4 tauschen. Wie im Spiegel bieten beide Seiten dieselben Tausche an.'
        }
      },
      {
        san: 'Bxd6',
        en: 'Take first, and you decide how the pieces come off.',
        de: 'Nimm zuerst, dann bestimmst du, wie die Figuren abgetauscht werden.',
        why: {
          en: 'If you take first, Black’s queen has to come out to take back, and your pawns stay neat.',
          de: 'Schlägst du zuerst, muss die schwarze Dame zum Zurücknehmen herauskommen, und deine Bauern bleiben ordentlich.'
        }
      },
      {
        san: 'Qxd6',
        en: 'Black takes back with the queen. The d4 pawn stands between the queens, so no queen trade yet.',
        de: 'Schwarz nimmt mit der Dame zurück. Der Bauer auf d4 steht zwischen den Damen, ein Damentausch ist also noch nicht möglich.',
        why: {
          en: 'With the queen, Black keeps the pawns tidy and gets ready to castle.',
          de: 'Mit der Dame hält Schwarz die Bauern ordentlich und macht sich bereit zur Rochade.'
        }
      },
      {
        san: 'Nbd2',
        en: 'Bring out the last knight. It heads for f3 or e4 and keeps the position healthy.',
        de: 'Bring den letzten Springer heraus. Er zielt auf f3 oder e4 und hält die Stellung gesund.',
        why: {
          en: 'From d2 the knight supports a later e4 push and leaves your c-pawn free to go to c3.',
          de: 'Von d2 unterstützt der Springer später den Zug e4 und lässt deinem c-Bauern den Weg nach c3 frei.'
        }
      },
      {
        san: 'O-O',
        en: 'Black castles, and now both kings are safe. A quiet, balanced middlegame is ahead.',
        de: 'Schwarz rochiert, und beide Könige sind sicher. Vor euch liegt ein ruhiges, ausgeglichenes Mittelspiel.',
        why: {
          en: 'Both kings are safe. Next both sides look for a pawn push that opens the centre, like e4 for you.',
          de: 'Beide Könige sind sicher. Jetzt suchen beide einen Bauernzug, der die Mitte öffnet, wie e4 für dich.'
        }
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
    aims: {
      w: {
        en: 'Pull Black’s d5 pawn away or win the fight for it, develop fast and keep more space.',
        de: 'Den schwarzen Bauern d5 weglocken oder den Kampf um ihn gewinnen, schnell entwickeln und mehr Platz behalten.'
      },
      b: {
        en: 'Hold d5 with pawns, develop calmly, castle, and later free the c8 bishop with c5 or e5.',
        de: 'd5 mit Bauern halten, ruhig entwickeln, rochieren und später den Läufer auf c8 mit c5 oder e5 befreien.'
      }
    },
    plans: [
      {
        en: 'Put more and more pressure on d5: c4, the knight to c3, the bishop to g5, and later a rook to c1.',
        de: 'Immer mehr Druck auf d5: c4, der Springer nach c3, der Läufer nach g5 und später ein Turm nach c1.'
      },
      {
        en: 'Black’s c8 bishop is stuck. Play slowly and use your extra space, Black has less room to move.',
        de: 'Der schwarze Läufer auf c8 steckt fest. Spiel ruhig und nutze deinen Platz, Schwarz hat weniger Raum.'
      }
    ],
    traps: [
      {
        en: 'The Elephant trap: if Black’s knight stands on d7, do not grab d5 with your knight. After Black takes back and you take the queen, a bishop check wins a piece for Black.',
        de: 'Die Elefantenfalle: Steht der schwarze Springer auf d7, schnapp d5 nicht mit dem Springer. Nimmt Schwarz zurück und du die Dame, gewinnt ein Läuferschach eine Figur für Schwarz.',
        moves: '1. d4 d5 2. c4 e6 3. Nc3 Nf6 4. Bg5 Nbd7 5. cxd5 exd5 6. Nxd5 Nxd5 7. Bxd8 Bb4+ 8. Qd2 Bxd2+ 9. Kxd2 Kxd8'
      }
    ],
    pgn: '1. d4 d5 2. c4 e6 3. Nc3 Nf6 4. Bg5',
    moves: [
      {
        san: 'd4',
        en: 'The pawn takes the middle and is already guarded by your queen. It also opens a diagonal for your dark-squared bishop.',
        de: 'Der Bauer nimmt die Mitte und wird schon von deiner Dame gedeckt. Außerdem öffnet er die Diagonale für deinen schwarzfeldrigen Läufer.',
        why: {
          en: 'With the pawn on d4, your queen on d1 guards it, so it is safe. It also opens the way for your c1 bishop.',
          de: 'Der Bauer auf d4 wird von deiner Dame auf d1 gedeckt, er steht also sicher. Außerdem macht er den Weg für deinen Läufer auf c1 frei.'
        }
      },
      {
        san: 'd5',
        en: 'Black mirrors you and takes control of e4, so you cannot get two pawns side by side in the middle.',
        de: 'Schwarz spiegelt dich und kontrolliert e4, damit du nicht zwei Bauern nebeneinander ins Zentrum bekommst.',
        why: {
          en: 'Black blocks your pawn and takes a centre square too. Now neither of the two pawns can move forward.',
          de: 'Schwarz blockiert deinen Bauern und nimmt sich auch ein Zentrumsfeld. Jetzt kann keiner der beiden Bauern weiter.'
        }
      },
      {
        san: 'c4',
        en: 'Here is the offer. Take it, and your d-pawn leaves the centre it was guarding, which is exactly what you want. This is why it is barely a real gambit: the pawn usually comes back.',
        de: 'Hier ist das Angebot. Nimmst du es, verlässt dein d-Bauer das Zentrum, das er bewacht hat, und genau darum geht es. Deshalb ist es kaum ein echtes Gambit: Der Bauer kommt meistens zurück.',
        why: {
          en: 'A gambit is a pawn you offer on purpose to get something better. Here: if Black takes, the d5 pawn leaves the centre.',
          de: 'Ein Gambit ist ein Bauer, den du absichtlich anbietest, um etwas Besseres zu bekommen. Schlägt Schwarz, verlässt der Bauer d5 die Mitte.'
        }
      },
      {
        san: 'e6',
        en: 'Black says no thanks and props up d5 with a pawn instead. It is solid, but it shuts in the bishop on c8, and getting that piece out stays a problem for the rest of the game.',
        de: 'Schwarz lehnt ab und stützt d5 lieber mit einem Bauern. Solide, aber der Läufer auf c8 sitzt jetzt fest, und ihn wieder ins Spiel zu bringen bleibt das ganze Spiel über ein Problem.',
        why: {
          en: 'With e6 Black can take back on d5 with a pawn and keep a pawn in the middle. Solid, like a wall.',
          de: 'Mit e6 kann Schwarz auf d5 mit einem Bauern zurücknehmen und behält einen Bauern in der Mitte. Stabil wie eine Mauer.'
        }
      },
      {
        san: 'Nc3',
        en: 'Develop, and lean on d5 a second time. The knight also covers e4, in case you ever want to push that pawn.',
        de: 'Entwickeln und ein zweites Mal Druck auf d5 machen. Der Springer deckt außerdem e4, falls du diesen Bauern später vorziehen willst.',
        why: {
          en: 'Now the c4 pawn and the knight both attack d5. Two attackers, so Black needs two defenders too.',
          de: 'Jetzt greifen der Bauer c4 und der Springer beide d5 an. Zwei Angreifer, also braucht Schwarz auch zwei Verteidiger.'
        }
      },
      {
        san: 'Nf6',
        en: 'Black develops and defends d5 again, and stops you playing e4 at the same time.',
        de: 'Schwarz entwickelt sich, verteidigt d5 erneut und verhindert gleichzeitig dein e4.',
        why: {
          en: 'The knight is one more guard for d5, and it keeps your e-pawn from going to e4.',
          de: 'Der Springer ist eine weitere Wache für d5 und hält deinen e-Bauern von e4 fern.'
        }
      },
      {
        san: 'Bg5',
        en: 'The bishop pins the knight to the queen behind it, and that knight is one of the pieces guarding d5. It cannot run away without leaving the queen in the open.',
        de: 'Der Läufer fesselt den Springer an die Dame dahinter, und dieser Springer ist einer der Verteidiger von d5. Er kann nicht weglaufen, ohne die Dame ungedeckt zu lassen.',
        why: {
          en: 'A pin: the f6 knight can not move without leaving its queen open to your bishop. So it guards d5 less well.',
          de: 'Eine Fesselung: Der Springer auf f6 kann nicht ziehen, ohne seine Dame deinem Läufer zu zeigen. So deckt er d5 schlechter.'
        }
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
    aims: {
      w: {
        en: 'Win back the c4 pawn with your bishop, take the centre with e3 and later e4, and develop faster.',
        de: 'Den Bauern auf c4 mit dem Läufer zurückholen, das Zentrum mit e3 und später e4 nehmen und schneller entwickeln.'
      },
      b: {
        en: 'Give the pawn back calmly, hit d4 with c5, push b5 to chase your bishop and bring the c8 bishop to b7.',
        de: 'Den Bauern ruhig zurückgeben, d4 mit c5 angreifen, mit b5 deinen Läufer jagen und den Läufer von c8 nach b7 bringen.'
      }
    },
    plans: [
      {
        en: 'Answer a6 with a4, so Black can not push b5 for free.',
        de: 'Antworte auf a6 mit a4, damit Schwarz nicht einfach b5 spielen kann.'
      },
      {
        en: 'Later push e4, or take on c5, to open the centre for your faster pieces.',
        de: 'Später e4 spielen oder auf c5 schlagen, um die Mitte für deine schnelleren Figuren zu öffnen.'
      }
    ],
    traps: [
      {
        en: 'If Black tries to keep the pawn with b5, push a4. After the pawns swap, your queen on f3 can attack the a8 rook along the long diagonal.',
        de: 'Will Schwarz den Bauern mit b5 behalten, zieh a4. Nach dem Bauerntausch greift deine Dame von f3 den Turm auf a8 über die lange Diagonale an.',
        moves: '1. d4 d5 2. c4 dxc4 3. e3 b5 4. a4 c6 5. axb5 cxb5 6. Qf3'
      }
    ],
    pgn: '1. d4 d5 2. c4 dxc4 3. Nf3 Nf6 4. e3 e6 5. Bxc4 c5 6. O-O a6',
    moves: [
      {
        san: 'd4',
        en: 'The pawn takes the middle and is already guarded by your queen. It also opens a diagonal for your dark-squared bishop.',
        de: 'Der Bauer nimmt die Mitte und wird schon von deiner Dame gedeckt. Außerdem öffnet er die Diagonale für deinen schwarzfeldrigen Läufer.',
        why: {
          en: 'With the pawn on d4, your queen on d1 guards it, so it is safe. It also opens the way for your c1 bishop.',
          de: 'Der Bauer auf d4 wird von deiner Dame auf d1 gedeckt, er steht also sicher. Außerdem macht er den Weg für deinen Läufer auf c1 frei.'
        }
      },
      {
        san: 'd5',
        en: 'Black mirrors you and takes control of e4, so you cannot get two pawns side by side in the middle.',
        de: 'Schwarz spiegelt dich und kontrolliert e4, damit du nicht zwei Bauern nebeneinander ins Zentrum bekommst.',
        why: {
          en: 'Black blocks your pawn and takes a centre square too. Now neither of the two pawns can move forward.',
          de: 'Schwarz blockiert deinen Bauern und nimmt sich auch ein Zentrumsfeld. Jetzt kann keiner der beiden Bauern weiter.'
        }
      },
      {
        san: 'c4',
        en: 'Here is the offer. Take it, and your d-pawn leaves the centre it was guarding, which is exactly what you want. This is why it is barely a real gambit: the pawn usually comes back.',
        de: 'Hier ist das Angebot. Nimmst du es, verlässt dein d-Bauer das Zentrum, das er bewacht hat, und genau darum geht es. Deshalb ist es kaum ein echtes Gambit: Der Bauer kommt meistens zurück.',
        why: {
          en: 'A gambit is a pawn you offer on purpose to get something better. Here: if Black takes, the d5 pawn leaves the centre.',
          de: 'Ein Gambit ist ein Bauer, den du absichtlich anbietest, um etwas Besseres zu bekommen. Schlägt Schwarz, verlässt der Bauer d5 die Mitte.'
        }
      },
      {
        san: 'dxc4',
        en: 'Black takes the pawn. For the moment Black is a pawn up, but that pawn has left the centre and cannot be held easily.',
        de: 'Schwarz nimmt den Bauern. Im Moment hat Schwarz einen Bauern mehr, aber der Bauer hat das Zentrum verlassen und lässt sich nur schwer halten.',
        why: {
          en: 'Black takes, but a pawn on c4 is far from home. Your bishop can win it back soon.',
          de: 'Schwarz schlägt, aber ein Bauer auf c4 ist weit weg von zu Hause. Dein Läufer kann ihn bald zurückholen.'
        }
      },
      {
        san: 'Nf3',
        en: 'Develop first and win the pawn back later. The knight eyes the centre and gets you ready to castle, so there is no need to hurry after c4.',
        de: 'Erst entwickeln, den Bauern holst du später. Der Springer schaut aufs Zentrum und bereitet die Rochade vor, du musst also nicht gleich hinter c4 herjagen.',
        why: {
          en: 'Chasing the pawn with your queen would lose time. Develop first: the pawn on c4 will not run away.',
          de: 'Den Bauern mit der Dame zu jagen kostet Zeit. Erst entwickeln: Der Bauer auf c4 läuft nicht weg.'
        }
      },
      {
        san: 'Nf6',
        en: 'Black develops too and keeps an eye on e4, so you cannot build a big pawn centre without a fight.',
        de: 'Schwarz entwickelt sich ebenfalls und behält e4 im Blick, du kannst dir also kein großes Bauernzentrum ohne Kampf aufbauen.',
        why: {
          en: 'Black develops and watches e4, so you can not take the whole centre for free.',
          de: 'Schwarz entwickelt sich und bewacht e4, damit du nicht einfach das ganze Zentrum nehmen kannst.'
        }
      },
      {
        san: 'e3',
        en: 'A quiet pawn move with a clear job: it opens the diagonal for your light-squared bishop so it can take on c4, and it guards d4.',
        de: 'Ein ruhiger Bauernzug mit klarer Aufgabe: Er öffnet die Diagonale für deinen weißfeldrigen Läufer, damit er auf c4 nehmen kann, und deckt d4.',
        why: {
          en: 'e3 opens the way from f1 to c4. Your bishop is ready to take the pawn back.',
          de: 'e3 öffnet den Weg von f1 nach c4. Dein Läufer ist bereit, den Bauern zurückzuholen.'
        },
        threat: {
          en: 'Your bishop can now take the c4 pawn. The pawn you gave comes back.',
          de: 'Dein Läufer kann jetzt den Bauern auf c4 schlagen. Der hergegebene Bauer kommt zurück.',
          arrows: ['f1c4']
        }
      },
      {
        san: 'e6',
        en: 'Black opens a path for the dark-squared bishop and guards d5. The price is that the light-squared bishop on c8 is shut in behind the pawn again.',
        de: 'Schwarz öffnet den Weg für den schwarzfeldrigen Läufer und deckt d5. Der Preis: Der weißfeldrige Läufer auf c8 ist hinter dem Bauern wieder eingesperrt.',
        why: {
          en: 'Black gives up the c4 pawn and gets the f8 bishop ready to come out, so the king can castle.',
          de: 'Schwarz gibt den Bauern auf c4 auf und macht den Läufer auf f8 bereit, damit der König rochieren kann.'
        }
      },
      {
        san: 'Bxc4',
        en: 'There is the pawn back. Your bishop lands on a fine diagonal, looking at e6 and f7, and nothing in your camp has been weakened.',
        de: 'Da ist der Bauer wieder. Dein Läufer landet auf einer schönen Diagonale mit Blick auf e6 und f7, und in deiner Stellung ist nichts schwächer geworden.',
        why: {
          en: 'Pawns are even again, and your bishop stands on a good diagonal looking at f7.',
          de: 'Die Bauern sind wieder gleich, und dein Läufer steht auf einer guten Diagonale mit Blick auf f7.'
        }
      },
      {
        san: 'c5',
        en: 'Black hits your d4 pawn at once. Pushing a wing pawn into the centre is the usual way to fight for space instead of just defending.',
        de: 'Schwarz greift sofort deinen Bauern auf d4 an. Einen Flügelbauern ins Zentrum zu schieben ist der übliche Weg, um Raum zu kämpfen, statt nur zu verteidigen.',
        why: {
          en: 'Black does not want you to own the centre in peace. Hitting d4 with the c-pawn is Black’s main plan.',
          de: 'Schwarz will dir das Zentrum nicht in Ruhe lassen. d4 mit dem c-Bauern anzugreifen ist der Hauptplan von Schwarz.'
        }
      },
      {
        san: 'O-O',
        en: 'Castle. The king is safe and the rook is on its way to the middle. Your d4 pawn is guarded three times: by the e3 pawn, the knight and the queen.',
        de: 'Rochade. Der König ist sicher und der Turm kommt Richtung Mitte. Dein Bauer auf d4 ist dreifach gedeckt: vom Bauern auf e3, vom Springer und von der Dame.',
        why: {
          en: 'Castle first, before the centre opens. A safe king lets you play the rest calmly.',
          de: 'Erst rochieren, bevor die Mitte aufgeht. Mit einem sicheren König spielst du den Rest in Ruhe.'
        }
      },
      {
        san: 'a6',
        en: 'A useful waiting move. It stops a white piece landing on b5 and prepares ...b5, which would chase your bishop from c4.',
        de: 'Ein nützlicher Wartezug. Er verhindert, dass eine weiße Figur auf b5 landet, und bereitet ...b5 vor, womit der Läufer von c4 vertrieben würde.',
        why: {
          en: 'a6 makes b5 safe for a black pawn. Then the c8 bishop can come to b7.',
          de: 'a6 macht b5 sicher für einen schwarzen Bauern. Danach kann der Läufer von c8 nach b7.'
        },
        threat: {
          en: 'Black can push b5 next and chase your bishop away from c4.',
          de: 'Schwarz kann als Nächstes b5 ziehen und deinen Läufer von c4 vertreiben.',
          arrows: ['b7b5']
        }
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
    aims: {
      w: {
        en: 'Win the c4 pawn back, use your extra space, castle and later push e4.',
        de: 'Den Bauern auf c4 zurückholen, deinen Platz nutzen, rochieren und später e4 spielen.'
      },
      b: {
        en: 'Hold d5 with c6, bring the c8 bishop out before e6, and castle into a solid position.',
        de: 'd5 mit c6 halten, den Läufer auf c8 vor e6 herausbringen und in eine stabile Stellung rochieren.'
      }
    },
    plans: [
      {
        en: 'Answer the capture on c4 with a4: without b5, the pawn on c4 falls.',
        de: 'Antworte auf das Schlagen auf c4 mit a4: Ohne b5 fällt der Bauer auf c4.'
      },
      {
        en: 'Castle, then put your queen on e2 and push e4 to take the centre.',
        de: 'Rochieren, dann die Dame nach e2 stellen und mit e4 das Zentrum nehmen.'
      }
    ],
    traps: [
      {
        en: 'If Black still pushes b5 after your a4, take it: after the pawns swap, your knight takes on b5 and Black’s extra pawn is gone.',
        de: 'Spielt Schwarz nach deinem a4 trotzdem b5, schlag: Nach dem Bauerntausch nimmt dein Springer auf b5, und der schwarze Mehrbauer ist weg.',
        moves: '1. d4 d5 2. c4 c6 3. Nf3 Nf6 4. Nc3 dxc4 5. a4 b5 6. axb5 cxb5 7. Nxb5'
      }
    ],
    pgn: '1. d4 d5 2. c4 c6 3. Nf3 Nf6 4. Nc3 dxc4 5. a4 Bf5 6. e3 e6 7. Bxc4 Bb4',
    moves: [
      {
        san: 'd4',
        en: 'The pawn takes the middle and is already guarded by your queen. It also opens a diagonal for your dark-squared bishop.',
        de: 'Der Bauer nimmt die Mitte und wird schon von deiner Dame gedeckt. Außerdem öffnet er die Diagonale für deinen schwarzfeldrigen Läufer.',
        why: {
          en: 'With the pawn on d4, your queen on d1 guards it, so it is safe. It also opens the way for your c1 bishop.',
          de: 'Der Bauer auf d4 wird von deiner Dame auf d1 gedeckt, er steht also sicher. Außerdem macht er den Weg für deinen Läufer auf c1 frei.'
        }
      },
      {
        san: 'd5',
        en: 'Black mirrors you and takes control of e4, so you cannot get two pawns side by side in the middle.',
        de: 'Schwarz spiegelt dich und kontrolliert e4, damit du nicht zwei Bauern nebeneinander ins Zentrum bekommst.',
        why: {
          en: 'Black blocks your pawn and takes a centre square too. Now neither of the two pawns can move forward.',
          de: 'Schwarz blockiert deinen Bauern und nimmt sich auch ein Zentrumsfeld. Jetzt kann keiner der beiden Bauern weiter.'
        }
      },
      {
        san: 'c4',
        en: 'Here is the offer. Take it, and your d-pawn leaves the centre it was guarding, which is exactly what you want. This is why it is barely a real gambit: the pawn usually comes back.',
        de: 'Hier ist das Angebot. Nimmst du es, verlässt dein d-Bauer das Zentrum, das er bewacht hat, und genau darum geht es. Deshalb ist es kaum ein echtes Gambit: Der Bauer kommt meistens zurück.',
        why: {
          en: 'A gambit is a pawn you offer on purpose to get something better. Here: if Black takes, the d5 pawn leaves the centre.',
          de: 'Ein Gambit ist ein Bauer, den du absichtlich anbietest, um etwas Besseres zu bekommen. Schlägt Schwarz, verlässt der Bauer d5 die Mitte.'
        }
      },
      {
        san: 'c6',
        en: 'Black guards d5 with a pawn, but unlike ...e6 this does not lock in the bishop on c8. That is the whole idea of the Slav.',
        de: 'Schwarz deckt d5 mit einem Bauern, aber anders als ...e6 sperrt das den Läufer auf c8 nicht ein. Das ist der ganze Gedanke der Slawischen Verteidigung.',
        why: {
          en: 'The c6 pawn guards d5, and the c8 bishop can still come out to f5 or g4. That is the difference from e6.',
          de: 'Der Bauer auf c6 deckt d5, und der Läufer auf c8 kann trotzdem nach f5 oder g4. Das ist der Unterschied zu e6.'
        }
      },
      {
        san: 'Nf3',
        en: 'Natural development. The knight eyes the centre and keeps e5 under control.',
        de: 'Natürliche Entwicklung. Der Springer schaut aufs Zentrum und kontrolliert e5.',
        why: {
          en: 'The knight guards d4 and e5. Develop before you chase anything.',
          de: 'Der Springer deckt d4 und e5. Erst entwickeln, dann jagen.'
        }
      },
      {
        san: 'Nf6',
        en: 'Black develops and keeps pressing on e4 so that you cannot easily take the centre with your e-pawn.',
        de: 'Schwarz entwickelt sich und übt weiter Druck auf e4 aus, damit du das Zentrum nicht einfach mit dem e-Bauern nehmen kannst.',
        why: {
          en: 'The knight guards d5 and keeps an eye on e4, so you can not push that pawn for free.',
          de: 'Der Springer deckt d5 und behält e4 im Blick, damit du diesen Bauern nicht einfach vorziehen kannst.'
        }
      },
      {
        san: 'Nc3',
        en: 'The second knight comes out and leans on d5 together with the c4 pawn. Now d5 is attacked twice and defended twice.',
        de: 'Der zweite Springer kommt heraus und drückt zusammen mit dem Bauern auf c4 auf d5. Jetzt wird d5 zweimal angegriffen und zweimal verteidigt.',
        why: {
          en: 'Two attackers on d5 now. The knight also guards e4, so e4 becomes a real idea.',
          de: 'Jetzt zwei Angreifer auf d5. Der Springer deckt auch e4, so wird e4 eine echte Idee.'
        }
      },
      {
        san: 'dxc4',
        en: 'Black takes the pawn, hoping to hold it with ...b5. The pawn on c4 is not really safe, though.',
        de: 'Schwarz nimmt den Bauern und hofft, ihn mit ...b5 zu halten. Sicher ist der Bauer auf c4 aber nicht.',
        why: {
          en: 'Black takes and hopes to keep the pawn with b5. That is where c6 helps: it would guard a pawn on b5.',
          de: 'Schwarz schlägt und hofft, den Bauern mit b5 zu halten. Da hilft c6: Es würde einen Bauern auf b5 decken.'
        },
        threat: {
          en: 'Black can hold the c4 pawn by pushing b5 next.',
          de: 'Schwarz kann den Bauern auf c4 halten, indem es als Nächstes b5 zieht.',
          arrows: ['b7b5']
        }
      },
      {
        san: 'a4',
        en: 'The key move. It takes b5 away, so Black cannot defend the pawn on c4 with ...b5, and it is going to fall.',
        de: 'Der Schlüsselzug. Er nimmt b5 weg, damit Schwarz den Bauern auf c4 nicht mit ...b5 halten kann, und der Bauer wird fallen.',
        why: {
          en: 'a4 stops b5. Without that pawn guard, the c4 pawn will fall to your bishop.',
          de: 'a4 verhindert b5. Ohne diese Bauernwache fällt der Bauer auf c4 an deinen Läufer.'
        }
      },
      {
        san: 'Bf5',
        en: 'Black’s bishop jumps outside the pawn chain before the pawn on e6 closes the door. It also watches e4, so you cannot play that pawn move for free.',
        de: 'Der schwarze Läufer springt vor die Bauernkette, bevor der Bauer auf e6 die Tür schließt. Er beobachtet auch e4, du kannst diesen Bauernzug also nicht umsonst machen.',
        why: {
          en: 'The bishop leaves c8 before e6 closes the door, like in the London. It watches e4 and b1.',
          de: 'Der Läufer verlässt c8, bevor e6 die Tür schließt, wie im London. Er bewacht e4 und b1.'
        }
      },
      {
        san: 'e3',
        en: 'Now your own light-squared bishop gets its diagonal, so you can take back on c4. The pawn also guards d4 and f4.',
        de: 'Jetzt bekommt dein weißfeldriger Läufer seine Diagonale, du kannst also auf c4 zurücknehmen. Der Bauer deckt außerdem d4 und f4.',
        why: {
          en: 'e3 guards d4 and opens the way for your f1 bishop to c4.',
          de: 'e3 deckt d4 und öffnet deinem Läufer den Weg von f1 nach c4.'
        },
        threat: {
          en: 'Your bishop can now take back the c4 pawn.',
          de: 'Dein Läufer kann jetzt den Bauern auf c4 zurückholen.',
          arrows: ['f1c4']
        }
      },
      {
        san: 'e6',
        en: 'Black closes the centre and opens the way for the dark-squared bishop. Because the c8 bishop is already outside, this does not hurt.',
        de: 'Schwarz schließt das Zentrum und macht den Weg für den schwarzfeldrigen Läufer frei. Weil der Läufer von c8 schon draußen ist, schadet das nicht.',
        why: {
          en: 'Black closes up and lets the f8 bishop out. Castling comes soon.',
          de: 'Schwarz macht zu und lässt den Läufer auf f8 heraus. Bald kommt die Rochade.'
        }
      },
      {
        san: 'Bxc4',
        en: 'The pawn is back, and your bishop looks straight at e6. You have more space in the middle and everything is developing smoothly.',
        de: 'Der Bauer ist zurück, und dein Läufer schaut direkt auf e6. Du hast mehr Raum in der Mitte, und alles entwickelt sich glatt.',
        why: {
          en: 'The pawn is back, material is even, and your bishop stands on a good diagonal.',
          de: 'Der Bauer ist zurück, das Material ist gleich, und dein Läufer steht auf einer guten Diagonale.'
        }
      },
      {
        san: 'Bb4',
        en: 'Black pins your knight on c3 against your king. That stops you from pushing e4 for now, and castling is the natural reply.',
        de: 'Schwarz nagelt deinen Springer auf c3 an deinen König fest. Damit kannst du vorerst nicht e4 spielen, und die Rochade ist die natürliche Antwort.',
        why: {
          en: 'A pin: your c3 knight can not move, because your king stands behind it. So it can not help push e4 right now.',
          de: 'Eine Fesselung: Dein Springer auf c3 darf nicht ziehen, weil dein König dahinter steht. So hilft er gerade nicht bei e4.'
        }
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
    aims: {
      w: {
        en: 'Chase the queen with developing moves, take the centre with d4 and use the extra time to attack.',
        de: 'Die Dame mit Entwicklungszügen jagen, mit d4 das Zentrum nehmen und die gewonnene Zeit für einen Angriff nutzen.'
      },
      b: {
        en: 'Win the pawn back with the queen, put her on a safe square, develop quickly and castle.',
        de: 'Den Bauern mit der Dame zurückholen, sie auf ein sicheres Feld stellen, schnell entwickeln und rochieren.'
      }
    },
    plans: [
      {
        en: 'Bring out the knight to f6 and the bishop to f5 or g4, then play c6 and e6: a solid house for your king.',
        de: 'Bring den Springer nach f6 und den Läufer nach f5 oder g4, dann c6 und e6: ein stabiles Haus für deinen König.'
      },
      {
        en: 'c6 takes d5 and b5 away from White’s knights, so they can not chase your queen again.',
        de: 'c6 nimmt den weißen Springern d5 und b5 weg, damit sie deine Dame nicht wieder jagen können.'
      }
    ],
    traps: [
      {
        en: 'When White plays the bishop to d2, the c3 knight is free again: jumping to d5 then attacks your queen with the bishop behind it. Play c6 in time.',
        de: 'Spielt Weiß den Läufer nach d2, ist der Springer auf c3 wieder frei: Springt er nach d5, greift der Läufer dahinter deine Dame an. Spiel rechtzeitig c6.',
        moves: '1. e4 d5 2. exd5 Qxd5 3. Nc3 Qa5 4. d4 Nf6 5. Bd2 Bf5 6. Nd5'
      }
    ],
    pgn: '1. e4 d5 2. exd5 Qxd5 3. Nc3 Qa5 4. d4 Nf6',
    moves: [
      {
        san: 'e4',
        en: 'White starts in the middle: the pawn grabs a centre square and frees the queen and the light-squared bishop.',
        de: 'Weiß beginnt in der Mitte: Der Bauer nimmt ein Zentrumsfeld und macht Dame und weißfeldrigen Läufer frei.',
        why: {
          en: 'Pawns in the middle give pieces room. White would love pawns on both e4 and d4, and your first move decides how you stop that.',
          de: 'Bauern in der Mitte geben Figuren Platz. Weiß hätte gern Bauern auf e4 und d4, und dein erster Zug entscheidet, wie du das verhinderst.'
        }
      },
      {
        san: 'd5',
        en: 'You go straight at it, on move one, before developing a single piece. White has to deal with this now.',
        de: 'Du gehst sofort dagegen vor, schon im ersten Zug, bevor du eine einzige Figur entwickelst. Weiß muss sich jetzt darum kümmern.',
        why: {
          en: 'If White takes, a centre pawn leaves the board. Fewer white pawns in the middle means more room for your pieces.',
          de: 'Schlägt Weiß, verschwindet ein Zentrumsbauer. Weniger weiße Bauern in der Mitte heißt mehr Platz für deine Figuren.'
        },
        threat: {
          en: 'Your d5 pawn attacks e4. If White does nothing, you take a centre pawn.',
          de: 'Dein Bauer auf d5 greift e4 an. Tut Weiß nichts, nimmst du einen Zentrumsbauern.',
          arrows: ['d5e4']
        }
      },
      {
        san: 'exd5',
        en: 'White takes, and almost everyone does. It is the only move that really tries for an advantage. White’s e-pawn has now left the board, which is good news for you: your pieces get room.',
        de: 'Weiß schlägt, und das machen fast alle. Es ist der einzige Zug, der wirklich auf Vorteil spielt. Der weiße e-Bauer ist damit vom Brett, und das ist gut für dich: Deine Figuren bekommen Platz.',
        why: {
          en: 'Taking is White’s most testing move. Pushing to e5 or guarding with a knight would let you settle in easily.',
          de: 'Schlagen ist der stärkste Versuch von Weiß. Mit e5 vorbeiziehen oder mit dem Springer decken ließe dich leicht ins Spiel kommen.'
        }
      },
      {
        san: 'Qxd5',
        en: 'You take the pawn back at once. Yes, this is the queen coming out early, which you have probably been told not to do. Here it is the price of the opening: you lose a little time, and you get an easy, free position in return.',
        de: 'Du holst dir den Bauern sofort zurück. Und ja, das ist die Dame früh im Spiel, wovon man dir wahrscheinlich abgeraten hat. Hier ist es der Preis der Eröffnung: Du verlierst etwas Zeit und bekommst dafür eine freie, bequeme Stellung.',
        why: {
          en: 'Taking back at once keeps the pawns even. Your queen is in the middle, but she will have to move again soon.',
          de: 'Sofort zurückzunehmen hält die Bauern gleich. Deine Dame steht in der Mitte, muss aber bald noch einmal ziehen.'
        }
      },
      {
        san: 'Nc3',
        en: 'This is where White collects that time back: the knight develops and attacks your queen in the same move, so you have to react.',
        de: 'Hier holt sich Weiß die Zeit zurück: Der Springer entwickelt sich und greift dabei deine Dame an. Du musst reagieren.',
        why: {
          en: 'Developing with an attack wins time: you move the queen again instead of a new piece. That gained move is called a tempo.',
          de: 'Mit Angriff entwickeln gewinnt Zeit: Du ziehst die Dame noch einmal statt einer neuen Figur. Diesen gewonnenen Zug nennt man Tempo.'
        },
        threat: {
          en: 'The knight attacks your queen. She has to move now.',
          de: 'Der Springer greift deine Dame an. Sie muss jetzt ziehen.',
          arrows: ['c3d5']
        }
      },
      {
        san: 'Qa5',
        en: 'The queen steps aside to a square where she is doing something. From a5 she looks down the diagonal at e1, and the moment White plays d4, the knight on c3 is pinned in front of the king.',
        de: 'Die Dame weicht auf ein Feld aus, wo sie etwas tut. Von a5 schaut sie die Diagonale bis e1 hinunter, und sobald Weiß d4 spielt, ist der Springer auf c3 vor dem König gefesselt.',
        why: {
          en: 'From a5 the queen is out of the knight’s reach and watches the diagonal down to e1, where White’s king lives.',
          de: 'Auf a5 ist die Dame außer Reichweite des Springers und schaut die Diagonale hinunter bis e1, wo der weiße König steht.'
        }
      },
      {
        san: 'd4',
        en: 'White builds the big centre. It is the natural move, and it is also the one that opens your diagonal and switches your pin on.',
        de: 'Weiß baut das große Zentrum. Das ist der natürliche Zug, und zugleich der, der deine Diagonale öffnet und deine Fesselung scharf schaltet.',
        why: {
          en: 'A pin: the c3 knight can not move away now, because your queen would then attack White’s king.',
          de: 'Eine Fesselung: Der Springer auf c3 darf jetzt nicht wegziehen, sonst würde deine Dame den weißen König angreifen.'
        }
      },
      {
        san: 'Nf6',
        en: 'Develop, and cover d5 so the white knight cannot jump there and chase your queen again.',
        de: 'Entwickeln und d5 decken, damit der weiße Springer nicht dorthin springt und deine Dame erneut jagt.',
        why: {
          en: 'The knight guards d5, so no white knight can land there, and it gets your king ready to castle.',
          de: 'Der Springer deckt d5, damit kein weißer Springer dort landen kann, und bereitet die Rochade vor.'
        }
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
    aims: {
      w: {
        en: 'Chase the queen with developing moves, use the b5 square for a knight and get ahead in development.',
        de: 'Die Dame mit Entwicklungszügen jagen, das Feld b5 für einen Springer nutzen und in der Entwicklung vorne liegen.'
      },
      b: {
        en: 'Put the queen on d6, take b5 away with a6, bring the c8 bishop out and castle.',
        de: 'Die Dame nach d6 stellen, mit a6 das Feld b5 wegnehmen, den Läufer auf c8 herausbringen und rochieren.'
      }
    },
    plans: [
      {
        en: 'Play a6 early, so no white knight can jump to b5.',
        de: 'Spiel früh a6, damit kein weißer Springer nach b5 springen kann.'
      },
      {
        en: 'Develop the bishop to f5 or g4 before e6, then castle.',
        de: 'Entwickle den Läufer nach f5 oder g4, bevor du e6 spielst, und rochiere dann.'
      }
    ],
    traps: [
      {
        en: 'Without a6, a knight on b5 hits your queen. After she steps back to d8, the bishop to f4 aims at c7 too, and a knight on c7 would attack your king and rook.',
        de: 'Ohne a6 greift ein Springer auf b5 deine Dame an. Geht sie nach d8 zurück, zielt der Läufer auf f4 auch auf c7, und ein Springer auf c7 griffe König und Turm an.',
        moves: '1. e4 d5 2. exd5 Qxd5 3. Nc3 Qd6 4. d4 Nf6 5. Nf3 Bg4 6. Nb5 Qd8 7. Bf4'
      }
    ],
    pgn: '1. e4 d5 2. exd5 Qxd5 3. Nc3 Qd6 4. d4 Nf6 5. Nf3 a6 6. h3 Bf5 7. Bd3 Bxd3 8. Qxd3 e6',
    moves: [
      {
        san: 'e4',
        en: 'White starts in the middle: the pawn grabs a centre square and frees the queen and the light-squared bishop.',
        de: 'Weiß beginnt in der Mitte: Der Bauer nimmt ein Zentrumsfeld und macht Dame und weißfeldrigen Läufer frei.',
        why: {
          en: 'Pawns in the middle give pieces room. White would love pawns on both e4 and d4, and your first move decides how you stop that.',
          de: 'Bauern in der Mitte geben Figuren Platz. Weiß hätte gern Bauern auf e4 und d4, und dein erster Zug entscheidet, wie du das verhinderst.'
        }
      },
      {
        san: 'd5',
        en: 'You go straight at it, on move one, before developing a single piece. White has to deal with this now.',
        de: 'Du gehst sofort dagegen vor, schon im ersten Zug, bevor du eine einzige Figur entwickelst. Weiß muss sich jetzt darum kümmern.',
        why: {
          en: 'If White takes, a centre pawn leaves the board. Fewer white pawns in the middle means more room for your pieces.',
          de: 'Schlägt Weiß, verschwindet ein Zentrumsbauer. Weniger weiße Bauern in der Mitte heißt mehr Platz für deine Figuren.'
        },
        threat: {
          en: 'Your d5 pawn attacks e4. If White does nothing, you take a centre pawn.',
          de: 'Dein Bauer auf d5 greift e4 an. Tut Weiß nichts, nimmst du einen Zentrumsbauern.',
          arrows: ['d5e4']
        }
      },
      {
        san: 'exd5',
        en: 'White takes, and almost everyone does. It is the only move that really tries for an advantage. White’s e-pawn has now left the board, which is good news for you: your pieces get room.',
        de: 'Weiß schlägt, und das machen fast alle. Es ist der einzige Zug, der wirklich auf Vorteil spielt. Der weiße e-Bauer ist damit vom Brett, und das ist gut für dich: Deine Figuren bekommen Platz.',
        why: {
          en: 'Taking is White’s most testing move. Pushing to e5 or guarding with a knight would let you settle in easily.',
          de: 'Schlagen ist der stärkste Versuch von Weiß. Mit e5 vorbeiziehen oder mit dem Springer decken ließe dich leicht ins Spiel kommen.'
        }
      },
      {
        san: 'Qxd5',
        en: 'You take the pawn back at once. Yes, this is the queen coming out early, which you have probably been told not to do. Here it is the price of the opening: you lose a little time, and you get an easy, free position in return.',
        de: 'Du holst dir den Bauern sofort zurück. Und ja, das ist die Dame früh im Spiel, wovon man dir wahrscheinlich abgeraten hat. Hier ist es der Preis der Eröffnung: Du verlierst etwas Zeit und bekommst dafür eine freie, bequeme Stellung.',
        why: {
          en: 'Taking back at once keeps the pawns even. Your queen is in the middle, but she will have to move again soon.',
          de: 'Sofort zurückzunehmen hält die Bauern gleich. Deine Dame steht in der Mitte, muss aber bald noch einmal ziehen.'
        }
      },
      {
        san: 'Nc3',
        en: 'This is where White collects that time back: the knight develops and attacks your queen in the same move, so you have to react.',
        de: 'Hier holt sich Weiß die Zeit zurück: Der Springer entwickelt sich und greift dabei deine Dame an. Du musst reagieren.',
        why: {
          en: 'Developing with an attack wins time: you move the queen again instead of a new piece. That gained move is called a tempo.',
          de: 'Mit Angriff entwickeln gewinnt Zeit: Du ziehst die Dame noch einmal statt einer neuen Figur. Diesen gewonnenen Zug nennt man Tempo.'
        },
        threat: {
          en: 'The knight attacks your queen. She has to move now.',
          de: 'Der Springer greift deine Dame an. Sie muss jetzt ziehen.',
          arrows: ['c3d5']
        }
      },
      {
        san: 'Qd6',
        en: 'The queen steps back to d6. It stays near the centre and eyes the b4 and g3 squares, but watch out for a knight coming to b5.',
        de: 'Die Dame zieht nach d6 zurück. Sie bleibt nah am Zentrum und schaut auf b4 und g3, aber ein Springer auf b5 wäre gefährlich.',
        why: {
          en: 'On d6 the queen stays close to home and watches d4. But a knight on b5 would attack her, so remember that square.',
          de: 'Auf d6 bleibt die Dame nah bei zu Hause und schaut auf d4. Ein Springer auf b5 würde sie angreifen, merk dir dieses Feld.'
        }
      },
      {
        san: 'd4',
        en: 'White grabs the centre and is ahead in development. You will have to be careful and solid.',
        de: 'Weiß nimmt das Zentrum und liegt in der Entwicklung vorn. Du musst jetzt vorsichtig und solide spielen.',
        why: {
          en: 'Your queen looks at d4, but White’s queen guards it. So the pawn is safe, and White has the centre.',
          de: 'Deine Dame schaut auf d4, aber die weiße Dame deckt den Bauern. Er ist also sicher, und Weiß hat das Zentrum.'
        }
      },
      {
        san: 'Nf6',
        en: 'Develop a piece with a clear purpose: the knight eyes e4 and d5 and gets you ready to castle.',
        de: 'Entwickle eine Figur mit klarem Ziel: Der Springer schaut auf e4 und d5 und bereitet die Rochade vor.',
        why: {
          en: 'The knight watches d5 and e4, two squares White’s knights would love. It also gets you ready to castle.',
          de: 'Der Springer bewacht d5 und e4, zwei Felder, die die weißen Springer lieben würden. Außerdem bereitet er die Rochade vor.'
        }
      },
      {
        san: 'Nf3',
        en: 'White develops too and guards the centre.',
        de: 'Weiß entwickelt sich ebenfalls und deckt das Zentrum.',
        why: {
          en: 'White develops and guards d4 a second time. The knight also eyes e5, a nice square for it.',
          de: 'Weiß entwickelt sich und deckt d4 ein zweites Mal. Der Springer schaut auch auf e5, ein schönes Feld für ihn.'
        }
      },
      {
        san: 'a6',
        en: 'A quiet but important move. It takes b5 away from the white knight, because a knight on b5 would hit your queen and the c7 pawn at the same time.',
        de: 'Ein ruhiger, aber wichtiger Zug. Er nimmt dem weißen Springer das Feld b5, denn ein Springer auf b5 würde gleichzeitig deine Dame und den Bauern auf c7 angreifen.',
        why: {
          en: 'Small pawn moves can stop big jumps. With a6, no knight can land on b5.',
          de: 'Kleine Bauernzüge können große Sprünge verhindern. Mit a6 kann kein Springer auf b5 landen.'
        }
      },
      {
        san: 'h3',
        en: 'White stops your bishop from jumping to g4, where it would pin the f3 knight.',
        de: 'Weiß verhindert, dass dein Läufer nach g4 springt, wo er den Springer auf f3 festnageln würde.',
        why: {
          en: 'A pin holds a piece in place because something more valuable stands behind it. h3 stops your bishop pinning the f3 knight.',
          de: 'Eine Fesselung hält eine Figur fest, weil dahinter etwas Wertvolleres steht. h3 verhindert, dass dein Läufer den Springer auf f3 fesselt.'
        }
      },
      {
        san: 'Bf5',
        en: 'The bishop still gets out. Bring it outside before you ever play ...e6, otherwise it is locked in.',
        de: 'Der Läufer kommt trotzdem heraus. Bring ihn nach draußen, bevor du ...e6 spielst, sonst ist er eingesperrt.',
        why: {
          en: 'On f5 the bishop is outside your pawns and watches e4. Bring it out before e6.',
          de: 'Auf f5 steht der Läufer vor deinen Bauern und bewacht e4. Bring ihn vor e6 heraus.'
        }
      },
      {
        san: 'Bd3',
        en: 'White offers the bishops for a trade.',
        de: 'Weiß bietet den Läufertausch an.',
        why: {
          en: 'White offers a trade, because your f5 bishop is one of your best pieces.',
          de: 'Weiß bietet einen Tausch an, weil dein Läufer auf f5 eine deiner besten Figuren ist.'
        },
        threat: {
          en: 'White’s bishop attacks yours on f5, and nothing guards it. Trade or move it.',
          de: 'Der weiße Läufer greift deinen auf f5 an, und nichts deckt ihn. Tausch oder zieh weg.',
          arrows: ['d3f5']
        }
      },
      {
        san: 'Bxd3',
        en: 'Trade them. White’s bishop was a dangerous attacker, so you are glad to swap it off.',
        de: 'Tausche sie. Der weiße Läufer war ein gefährlicher Angreifer, daher bist du froh, wenn er verschwindet.',
        why: {
          en: 'Your bishop was attacked and had no guard. Taking first solves that and removes White’s attacking bishop.',
          de: 'Dein Läufer war angegriffen und ungedeckt. Zuerst zu schlagen löst das und entfernt den weißen Angriffsläufer.'
        }
      },
      {
        san: 'Qxd3',
        en: 'White takes back with the queen.',
        de: 'Weiß nimmt mit der Dame zurück.',
        why: {
          en: 'White takes back with the queen. Both sides are close to finishing their development.',
          de: 'Weiß nimmt mit der Dame zurück. Beide Seiten sind fast fertig entwickelt.'
        }
      },
      {
        san: 'e6',
        en: 'Now the pawn can close the centre. Your dark-squared bishop gets out, and you are ready to castle.',
        de: 'Jetzt darf der Bauer das Zentrum schließen. Dein schwarzfeldriger Läufer kommt heraus, und du kannst rochieren.',
        why: {
          en: 'Now e6 is safe: your light-squared bishop is already gone, so nothing gets locked in. Castle next.',
          de: 'Jetzt ist e6 sicher: Dein weißfeldriger Läufer ist schon weg, also wird nichts eingesperrt. Als Nächstes rochieren.'
        }
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
    aims: {
      w: {
        en: 'Take a big centre with d4 and c4, develop calmly and chase the black knight to gain space.',
        de: 'Mit d4 und c4 ein großes Zentrum nehmen, ruhig entwickeln und den schwarzen Springer jagen, um Platz zu gewinnen.'
      },
      b: {
        en: 'Win the pawn back with the knight, put the bishop on g7, castle and then attack White’s centre.',
        de: 'Den Bauern mit dem Springer zurückholen, den Läufer nach g7 stellen, rochieren und dann das weiße Zentrum angreifen.'
      }
    },
    plans: [
      {
        en: 'Hit White’s centre later with c5 or e5. The bishop on g7 makes those pushes strong.',
        de: 'Greif das weiße Zentrum später mit c5 oder e5 an. Der Läufer auf g7 macht diese Züge stark.'
      },
      {
        en: 'Bring the other knight to c6. Together with b6 it puts pressure on d4 and c4.',
        de: 'Bring den anderen Springer nach c6. Zusammen mit dem auf b6 drückt er auf d4 und c4.'
      }
    ],
    traps: [
      {
        en: 'If White tries to hold the pawn with c4, do not worry: play c6. If White takes on c6, your knight takes back and your pieces come out fast.',
        de: 'Will Weiß den Bauern mit c4 halten, keine Sorge: Spiel c6. Schlägt Weiß auf c6, nimmt dein Springer zurück und deine Figuren kommen schnell heraus.',
        moves: '1. e4 d5 2. exd5 Nf6 3. c4 c6 4. dxc6 Nxc6'
      }
    ],
    pgn: '1. e4 d5 2. exd5 Nf6 3. d4 Nxd5 4. Nf3 g6 5. Be2 Bg7 6. O-O O-O 7. c4 Nb6',
    moves: [
      {
        san: 'e4',
        en: 'White starts in the middle: the pawn grabs a centre square and frees the queen and the light-squared bishop.',
        de: 'Weiß beginnt in der Mitte: Der Bauer nimmt ein Zentrumsfeld und macht Dame und weißfeldrigen Läufer frei.',
        why: {
          en: 'Pawns in the middle give pieces room. White would love pawns on both e4 and d4, and your first move decides how you stop that.',
          de: 'Bauern in der Mitte geben Figuren Platz. Weiß hätte gern Bauern auf e4 und d4, und dein erster Zug entscheidet, wie du das verhinderst.'
        }
      },
      {
        san: 'd5',
        en: 'You go straight at it, on move one, before developing a single piece. White has to deal with this now.',
        de: 'Du gehst sofort dagegen vor, schon im ersten Zug, bevor du eine einzige Figur entwickelst. Weiß muss sich jetzt darum kümmern.',
        why: {
          en: 'If White takes, a centre pawn leaves the board. Fewer white pawns in the middle means more room for your pieces.',
          de: 'Schlägt Weiß, verschwindet ein Zentrumsbauer. Weniger weiße Bauern in der Mitte heißt mehr Platz für deine Figuren.'
        },
        threat: {
          en: 'Your d5 pawn attacks e4. If White does nothing, you take a centre pawn.',
          de: 'Dein Bauer auf d5 greift e4 an. Tut Weiß nichts, nimmst du einen Zentrumsbauern.',
          arrows: ['d5e4']
        }
      },
      {
        san: 'exd5',
        en: 'White takes, and almost everyone does. It is the only move that really tries for an advantage. White’s e-pawn has now left the board, which is good news for you: your pieces get room.',
        de: 'Weiß schlägt, und das machen fast alle. Es ist der einzige Zug, der wirklich auf Vorteil spielt. Der weiße e-Bauer ist damit vom Brett, und das ist gut für dich: Deine Figuren bekommen Platz.',
        why: {
          en: 'Taking is White’s most testing move. Pushing to e5 or guarding with a knight would let you settle in easily.',
          de: 'Schlagen ist der stärkste Versuch von Weiß. Mit e5 vorbeiziehen oder mit dem Springer decken ließe dich leicht ins Spiel kommen.'
        }
      },
      {
        san: 'Nf6',
        en: 'Black does not take back with the queen this time. The knight attacks the pawn on d5, and the queen can stay at home.',
        de: 'Diesmal nimmt Schwarz nicht mit der Dame zurück. Der Springer greift den Bauern auf d5 an, und die Dame kann zu Hause bleiben.',
        why: {
          en: 'Taking with the queen costs time when a knight chases her. This time the knight takes back, and the queen stays home.',
          de: 'Mit der Dame zu nehmen kostet Zeit, wenn ein Springer sie jagt. Diesmal nimmt der Springer zurück, und die Dame bleibt zu Hause.'
        },
        threat: {
          en: 'Your knight attacks the d5 pawn, and no white piece guards it.',
          de: 'Dein Springer greift den Bauern auf d5 an, und keine weiße Figur deckt ihn.',
          arrows: ['f6d5']
        }
      },
      {
        san: 'd4',
        en: 'White takes the centre and opens a line for the dark-squared bishop. The d5 pawn is still hanging.',
        de: 'Weiß nimmt das Zentrum und öffnet eine Linie für den schwarzfeldrigen Läufer. Der Bauer auf d5 hängt immer noch.',
        why: {
          en: 'White does not try to hold d5. Instead a big centre pawn comes, and the c1 bishop gets a path.',
          de: 'Weiß versucht nicht, d5 zu halten. Stattdessen kommt ein großer Zentrumsbauer, und der Läufer auf c1 bekommt einen Weg.'
        }
      },
      {
        san: 'Nxd5',
        en: 'Now the pawn is back with the knight. You did it without moving the queen, so you lost no time.',
        de: 'Jetzt ist der Bauer mit dem Springer zurückgeholt. Das ging ohne Damenzug, du hast also keine Zeit verloren.',
        why: {
          en: 'The pawns are even again. Your knight is strong in the middle, but White will try to chase it with c4.',
          de: 'Die Bauern sind wieder gleich. Dein Springer ist stark in der Mitte, aber Weiß wird ihn mit c4 jagen.'
        }
      },
      {
        san: 'Nf3',
        en: 'White develops and guards d4 and e5.',
        de: 'Weiß entwickelt sich und deckt d4 und e5.',
        why: {
          en: 'The knight guards d4 and watches e5. White develops instead of chasing at once.',
          de: 'Der Springer deckt d4 und bewacht e5. Weiß entwickelt sich, statt sofort zu jagen.'
        }
      },
      {
        san: 'g6',
        en: 'Get ready to fianchetto: the bishop will go to g7 and shoot down the long diagonal at the white centre.',
        de: 'Mach dich für das Fianchetto bereit: Der Läufer geht nach g7 und schießt über die lange Diagonale auf das weiße Zentrum.',
        why: {
          en: 'A fianchetto: your bishop goes to g7 behind the g6 pawn. From there it looks across the whole board.',
          de: 'Ein Fianchetto: Dein Läufer kommt nach g7, hinter den Bauern g6. Von dort schaut er über das ganze Brett.'
        }
      },
      {
        san: 'Be2',
        en: 'A quiet developing move that prepares castling.',
        de: 'Ein ruhiger Entwicklungszug, der die Rochade vorbereitet.',
        why: {
          en: 'A quiet square that prepares castling. White keeps the c-pawn free to chase your knight later.',
          de: 'Ein ruhiges Feld, das die Rochade vorbereitet. Weiß hält den c-Bauern frei, um deinen Springer später zu jagen.'
        }
      },
      {
        san: 'Bg7',
        en: 'The bishop eyes d4 and the whole long diagonal.',
        de: 'Der Läufer zielt auf d4 und die ganze lange Diagonale.',
        why: {
          en: 'Your bishop looks at d4 and down the long diagonal. It will also guard your king after castling.',
          de: 'Dein Läufer schaut auf d4 und die lange Diagonale hinunter. Nach der Rochade schützt er auch deinen König.'
        }
      },
      {
        san: 'O-O',
        en: 'White castles.',
        de: 'Weiß rochiert.',
        why: {
          en: 'White’s king goes to safety. Next comes c4 to chase your knight.',
          de: 'Der weiße König bringt sich in Sicherheit. Als Nächstes kommt c4, um deinen Springer zu jagen.'
        }
      },
      {
        san: 'O-O',
        en: 'You castle too, and your king is safe behind the fianchetto bishop.',
        de: 'Du rochierst auch, und dein König steht sicher hinter dem Läufer im Fianchetto.',
        why: {
          en: 'Your king hides behind the g7 bishop and the pawns. Your rook can now join the game.',
          de: 'Dein König versteckt sich hinter dem Läufer auf g7 und den Bauern. Dein Turm kann jetzt mitspielen.'
        }
      },
      {
        san: 'c4',
        en: 'White chases your knight and takes more space.',
        de: 'Weiß jagt deinen Springer und nimmt mehr Raum.',
        why: {
          en: 'Kicking the knight gains space and a tempo, a free move, because you have to move the knight again.',
          de: 'Den Springer zu vertreiben gewinnt Platz und ein Tempo, einen freien Zug, weil du den Springer noch einmal ziehen musst.'
        },
        threat: {
          en: 'The c4 pawn attacks your knight on d5. It has to move.',
          de: 'Der Bauer auf c4 greift deinen Springer auf d5 an. Er muss weg.',
          arrows: ['c4d5']
        }
      },
      {
        san: 'Nb6',
        en: 'The knight retreats to a safe square and eyes the c4 pawn. White’s centre is big, but now it has something to defend.',
        de: 'Der Springer zieht sich auf ein sicheres Feld zurück und schaut auf den Bauern c4. Das weiße Zentrum ist groß, aber jetzt muss Weiß etwas verteidigen.',
        why: {
          en: 'On b6 the knight is safe from pawns and looks at c4. White now has to keep that pawn guarded.',
          de: 'Auf b6 ist der Springer sicher vor Bauern und schaut auf c4. Weiß muss diesen Bauern jetzt gedeckt halten.'
        }
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
    aims: {
      w: {
        en: 'Take the centre with e4 and d4, develop fast and use the extra space to attack.',
        de: 'Mit e4 und d4 das Zentrum nehmen, schnell entwickeln und den Platz für einen Angriff nutzen.'
      },
      b: {
        en: 'Keep a pawn on d5, bring the c8 bishop out to f5 before e6, and build a solid position that is hard to break.',
        de: 'Einen Bauern auf d5 behalten, den Läufer von c8 vor e6 nach f5 bringen und eine stabile Stellung bauen, die schwer zu knacken ist.'
      }
    },
    plans: [
      {
        en: 'When the knight goes to g3, take your bishop to g6. Then play the knights to d7 and f6, push e6 and castle.',
        de: 'Geht der Springer nach g3, stell deinen Läufer nach g6. Dann Springer nach d7 und f6, e6 und rochieren.'
      },
      {
        en: 'Later push c5 or e5 to open the centre once your pieces are ready.',
        de: 'Später c5 oder e5 spielen, um die Mitte zu öffnen, sobald deine Figuren bereit sind.'
      }
    ],
    traps: [
      {
        en: 'A famous trap: with your knight on d7 and White’s queen on e2, never bring the other knight to f6. The knight jump to d6 is then checkmate, because the e7 pawn is pinned.',
        de: 'Eine berühmte Falle: Steht dein Springer auf d7 und die weiße Dame auf e2, bring nie den anderen Springer nach f6. Der Sprung nach d6 ist dann Schachmatt, weil der Bauer e7 gefesselt ist.',
        moves: '1. e4 c6 2. d4 d5 3. Nc3 dxe4 4. Nxe4 Nd7 5. Qe2 Ngf6 6. Nd6#'
      }
    ],
    pgn: '1. e4 c6 2. d4 d5 3. Nc3 dxe4 4. Nxe4 Bf5',
    moves: [
      {
        san: 'e4',
        en: 'White starts in the middle: the pawn grabs a centre square and frees the queen and the light-squared bishop.',
        de: 'Weiß beginnt in der Mitte: Der Bauer nimmt ein Zentrumsfeld und macht Dame und weißfeldrigen Läufer frei.',
        why: {
          en: 'Pawns in the middle give pieces room. White would love pawns on both e4 and d4, and your first move decides how you stop that.',
          de: 'Bauern in der Mitte geben Figuren Platz. Weiß hätte gern Bauern auf e4 und d4, und dein erster Zug entscheidet, wie du das verhinderst.'
        }
      },
      {
        san: 'c6',
        en: 'A quiet-looking move that is the entire idea. You are getting ready to play d5 with a pawn behind it. Unlike the French, you are not walling your own bishop in to do it.',
        de: 'Ein unscheinbarer Zug, der die ganze Idee enthält. Du bereitest d5 vor, mit einem Bauern im Rücken. Anders als in der Französischen mauerst du dafür deinen eigenen Läufer nicht ein.',
        why: {
          en: 'c6 prepares d5 with a pawn guard. If White ever takes on d5, you take back with a pawn and keep the centre.',
          de: 'c6 bereitet d5 mit einer Bauernwache vor. Schlägt Weiß später auf d5, nimmst du mit einem Bauern zurück und behältst die Mitte.'
        }
      },
      {
        san: 'd4',
        en: 'White takes the whole centre. If you let someone put two pawns in the middle, they will.',
        de: 'Weiß nimmt das ganze Zentrum. Wenn man jemanden zwei Bauern in die Mitte stellen lässt, tut er es auch.',
        why: {
          en: 'Two pawns side by side in the middle. White grabs space and opens a line for the c1 bishop.',
          de: 'Zwei Bauern nebeneinander in der Mitte. Weiß nimmt sich Platz und öffnet eine Linie für den Läufer auf c1.'
        }
      },
      {
        san: 'd5',
        en: 'Now the move you prepared. You hit the e4 pawn, and if White trades you take back with the c-pawn, which is why c6 came first.',
        de: 'Jetzt der vorbereitete Zug. Du greifst den Bauern auf e4 an. Wenn Weiß tauscht, schlägst du mit dem c-Bauern zurück. Genau dafür kam c6 zuerst.',
        why: {
          en: 'Now you hit e4 with a pawn that has a guard. Whatever White does, you keep a pawn in the centre.',
          de: 'Jetzt greifst du e4 mit einem gedeckten Bauern an. Was Weiß auch tut, du behältst einen Bauern in der Mitte.'
        },
        threat: {
          en: 'Your d5 pawn attacks e4, and nothing guards it. White must act.',
          de: 'Dein Bauer auf d5 greift e4 an, und nichts deckt ihn. Weiß muss handeln.',
          arrows: ['d5e4']
        }
      },
      {
        san: 'Nc3',
        en: 'White develops the knight and gets it ready to recapture on e4.',
        de: 'Weiß entwickelt den Springer und macht ihn bereit, auf e4 zurückzuschlagen.',
        why: {
          en: 'The knight guards e4 and develops. If you take on e4, it takes back.',
          de: 'Der Springer deckt e4 und entwickelt sich. Schlägst du auf e4, nimmt er zurück.'
        }
      },
      {
        san: 'dxe4',
        en: 'You take, and White’s big centre is gone. One pawn instead of two.',
        de: 'Du schlägst, und das große weiße Zentrum ist weg. Ein Bauer statt zwei.',
        why: {
          en: 'Taking removes White’s best centre pawn and gives your c8 bishop the f5 square.',
          de: 'Das Schlagen entfernt den besten weißen Zentrumsbauern und gibt deinem Läufer auf c8 das Feld f5.'
        }
      },
      {
        san: 'Nxe4',
        en: 'White takes back with the knight, which lands on a central square in front of you.',
        de: 'Weiß schlägt mit dem Springer zurück, der auf einem Zentrumsfeld vor dir landet.',
        why: {
          en: 'White takes back with a piece, so the pawns are even. A knight in the middle can be chased by your pieces.',
          de: 'Weiß nimmt mit einer Figur zurück, also sind die Bauern gleich. Einen Springer in der Mitte können deine Figuren jagen.'
        }
      },
      {
        san: 'Bf5',
        en: 'And out it comes. This is the bishop the French Defence never gets to move. Here it steps outside first and attacks the knight on the way. Only now will you play e6, with the door already open.',
        de: 'Und heraus kommt er. Das ist der Läufer, den die Französische Verteidigung nie bewegen darf. Hier geht er zuerst nach draußen und greift dabei den Springer an. Erst jetzt spielst du e6, wenn die Tür schon offen ist.',
        why: {
          en: 'The bishop comes out before e6 closes the door, and it attacks the knight. White must react, so you win a tempo, a move of time.',
          de: 'Der Läufer kommt raus, bevor e6 die Tür schließt, und greift den Springer an. Weiß muss reagieren: Du gewinnst ein Tempo, einen Zug Zeit.'
        },
        threat: {
          en: 'Your bishop attacks the e4 knight, and no white piece guards it.',
          de: 'Dein Läufer greift den Springer auf e4 an, und keine weiße Figur deckt ihn.',
          arrows: ['f5e4']
        }
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
    aims: {
      w: {
        en: 'Gain space with e5, keep the pawn chain strong and use the space for an attack on the king side.',
        de: 'Mit e5 Platz gewinnen, die Bauernkette stark halten und den Platz für einen Angriff am Königsflügel nutzen.'
      },
      b: {
        en: 'Bring the bishop to f5 before e6, then hit the bottom of the chain with c5 and develop with threats.',
        de: 'Den Läufer vor e6 nach f5 bringen, dann den Fuß der Kette mit c5 angreifen und mit Drohungen entwickeln.'
      }
    },
    plans: [
      {
        en: 'Put pressure on d4 with c5, the knight on c6 and the queen on b6.',
        de: 'Mach Druck auf d4 mit c5, dem Springer auf c6 und der Dame auf b6.'
      },
      {
        en: 'Later f6 can attack the top of the chain, the e5 pawn.',
        de: 'Später kann f6 die Spitze der Kette angreifen, den Bauern auf e5.'
      }
    ],
    traps: [
      {
        en: 'After the swap on d4, the e5 pawn has lost its guards. If White forgets it, your knight takes it.',
        de: 'Nach dem Tausch auf d4 hat der Bauer e5 seine Wachen verloren. Vergisst Weiß ihn, nimmt dein Springer ihn.',
        moves: '1. e4 c6 2. d4 d5 3. e5 Bf5 4. Nf3 e6 5. Be2 c5 6. Be3 cxd4 7. Nxd4 Nc6 8. O-O Nxe5'
      }
    ],
    pgn: '1. e4 c6 2. d4 d5 3. e5 Bf5 4. Nf3 e6 5. Be2 c5 6. Be3 cxd4 7. Nxd4 Nc6',
    moves: [
      {
        san: 'e4',
        en: 'White starts in the middle: the pawn grabs a centre square and frees the queen and the light-squared bishop.',
        de: 'Weiß beginnt in der Mitte: Der Bauer nimmt ein Zentrumsfeld und macht Dame und weißfeldrigen Läufer frei.',
        why: {
          en: 'Pawns in the middle give pieces room. White would love pawns on both e4 and d4, and your first move decides how you stop that.',
          de: 'Bauern in der Mitte geben Figuren Platz. Weiß hätte gern Bauern auf e4 und d4, und dein erster Zug entscheidet, wie du das verhinderst.'
        }
      },
      {
        san: 'c6',
        en: 'A quiet-looking move that is the entire idea. You are getting ready to play d5 with a pawn behind it. Unlike the French, you are not walling your own bishop in to do it.',
        de: 'Ein unscheinbarer Zug, der die ganze Idee enthält. Du bereitest d5 vor, mit einem Bauern im Rücken. Anders als in der Französischen mauerst du dafür deinen eigenen Läufer nicht ein.',
        why: {
          en: 'c6 prepares d5 with a pawn guard. If White ever takes on d5, you take back with a pawn and keep the centre.',
          de: 'c6 bereitet d5 mit einer Bauernwache vor. Schlägt Weiß später auf d5, nimmst du mit einem Bauern zurück und behältst die Mitte.'
        }
      },
      {
        san: 'd4',
        en: 'White takes the whole centre. If you let someone put two pawns in the middle, they will.',
        de: 'Weiß nimmt das ganze Zentrum. Wenn man jemanden zwei Bauern in die Mitte stellen lässt, tut er es auch.',
        why: {
          en: 'Two pawns side by side in the middle. White grabs space and opens a line for the c1 bishop.',
          de: 'Zwei Bauern nebeneinander in der Mitte. Weiß nimmt sich Platz und öffnet eine Linie für den Läufer auf c1.'
        }
      },
      {
        san: 'd5',
        en: 'Now the move you prepared. You hit the e4 pawn, and if White trades you take back with the c-pawn, which is why c6 came first.',
        de: 'Jetzt der vorbereitete Zug. Du greifst den Bauern auf e4 an. Wenn Weiß tauscht, schlägst du mit dem c-Bauern zurück. Genau dafür kam c6 zuerst.',
        why: {
          en: 'Now you hit e4 with a pawn that has a guard. Whatever White does, you keep a pawn in the centre.',
          de: 'Jetzt greifst du e4 mit einem gedeckten Bauern an. Was Weiß auch tut, du behältst einen Bauern in der Mitte.'
        },
        threat: {
          en: 'Your d5 pawn attacks e4, and nothing guards it. White must act.',
          de: 'Dein Bauer auf d5 greift e4 an, und nichts deckt ihn. Weiß muss handeln.',
          arrows: ['d5e4']
        }
      },
      {
        san: 'e5',
        en: 'White pushes the pawn and takes space. The centre is closed now, and your light-squared bishop would be stuck behind the pawns if you are not careful.',
        de: 'Weiß schiebt den Bauern vor und nimmt Raum. Das Zentrum ist jetzt geschlossen, und dein weißfeldriger Läufer würde hinter den Bauern festsitzen, wenn du nicht aufpasst.',
        why: {
          en: 'Pushing gives White more space and takes f6 away from your knight. But a pawn that far forward can also become a target.',
          de: 'Der Vorstoß gibt Weiß mehr Platz und nimmt deinem Springer das Feld f6. Aber ein so weit vorne stehender Bauer kann auch Ziel werden.'
        }
      },
      {
        san: 'Bf5',
        en: 'The signature move. Bring the bishop outside the pawn chain before you play ...e6 to close the door behind it.',
        de: 'Der typische Zug. Bring den Läufer vor die Bauernkette, bevor du mit ...e6 die Tür hinter ihm schließt.',
        why: {
          en: 'The bishop is your problem piece in many openings. Here it gets out before e6 and finds a great diagonal.',
          de: 'Der Läufer ist in vielen Eröffnungen deine Sorgenfigur. Hier kommt er vor e6 heraus und findet eine tolle Diagonale.'
        }
      },
      {
        san: 'Nf3',
        en: 'White develops and guards the e5 pawn.',
        de: 'Weiß entwickelt sich und deckt den Bauern auf e5.',
        why: {
          en: 'The knight guards e5 and d4 and gets White ready to castle. Calm development is White’s plan.',
          de: 'Der Springer deckt e5 und d4 und bereitet die weiße Rochade vor. Ruhig entwickeln ist der Plan von Weiß.'
        }
      },
      {
        san: 'e6',
        en: 'Now it is safe to close the chain. Your bishop is outside, the structure is solid, and the dark-squared bishop gets out too.',
        de: 'Jetzt kannst du die Kette gefahrlos schließen. Dein Läufer steht draußen, die Struktur ist solide, und der schwarzfeldrige Läufer kommt auch heraus.',
        why: {
          en: 'With the bishop already out, e6 costs nothing. It guards d5 and lets the f8 bishop out.',
          de: 'Mit dem Läufer schon draußen kostet e6 nichts. Es deckt d5 und lässt den Läufer auf f8 heraus.'
        }
      },
      {
        san: 'Be2',
        en: 'White develops and gets ready to castle.',
        de: 'Weiß entwickelt sich und bereitet die Rochade vor.',
        why: {
          en: 'White prepares to castle and keeps everything protected.',
          de: 'Weiß bereitet die Rochade vor und hält alles gedeckt.'
        }
      },
      {
        san: 'c5',
        en: 'Hit the base. When a pawn chain is pushed forward, the way to fight it is to attack the pawn at its bottom: here the d4 pawn.',
        de: 'Greif die Basis an. Wenn eine Bauernkette vorgeschoben ist, bekämpft man sie am besten am unteren Ende: hier am Bauern d4.',
        why: {
          en: 'A pawn chain is a diagonal row of pawns guarding each other. Attack its bottom pawn, d4, and the top one loses its support.',
          de: 'Eine Bauernkette ist eine schräge Reihe von Bauern, die sich decken. Greif den untersten an, d4, dann verliert der obere seine Stütze.'
        }
      },
      {
        san: 'Be3',
        en: 'White supports d4 with the bishop.',
        de: 'Weiß stützt d4 mit dem Läufer.',
        why: {
          en: 'The bishop backs up d4. Now three white pieces guard it: queen, knight and bishop.',
          de: 'Der Läufer unterstützt d4. Jetzt decken ihn drei weiße Figuren: Dame, Springer und Läufer.'
        }
      },
      {
        san: 'cxd4',
        en: 'You trade pawns and open the c-file for your rook.',
        de: 'Du tauschst die Bauern und öffnest die c-Linie für deinen Turm.',
        why: {
          en: 'Swapping opens the c-line, a line with no pawns where your rook can work later.',
          de: 'Der Tausch öffnet die c-Linie, eine Linie ohne Bauern, auf der dein Turm später arbeiten kann.'
        }
      },
      {
        san: 'Nxd4',
        en: 'White takes back with the knight, which now sits in the middle.',
        de: 'Weiß nimmt mit dem Springer zurück, der jetzt in der Mitte steht.',
        why: {
          en: 'White takes back with a piece. But now no white piece guards the e5 pawn any more.',
          de: 'Weiß nimmt mit einer Figur zurück. Doch jetzt deckt keine weiße Figur mehr den Bauern auf e5.'
        }
      },
      {
        san: 'Nc6',
        en: 'You develop with tempo, because the knight attacks the knight on d4.',
        de: 'Du entwickelst mit Tempo, denn der Springer greift den Springer auf d4 an.',
        why: {
          en: 'Developing with a threat makes White react, so you gain time again.',
          de: 'Entwickeln mit Drohung zwingt Weiß zu reagieren, so gewinnst du wieder Zeit.'
        },
        threat: {
          en: 'Your knight attacks the e5 pawn, which has no guard left.',
          de: 'Dein Springer greift den Bauern auf e5 an, der keine Wache mehr hat.',
          arrows: ['c6e5']
        }
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
    aims: {
      w: {
        en: 'Play with the lonely d4 pawn: use the open lines for a quick attack before the endgame comes.',
        de: 'Mit dem einsamen Bauern auf d4 spielen: die offenen Linien für einen schnellen Angriff nutzen, bevor das Endspiel kommt.'
      },
      b: {
        en: 'Guard d5, develop, castle and put a piece in front of the lonely d4 pawn. Trades help you.',
        de: 'd5 decken, entwickeln, rochieren und eine Figur vor den einsamen Bauern auf d4 stellen. Tausche helfen dir.'
      }
    },
    plans: [
      {
        en: 'Keep a knight on d5, right in front of the d4 pawn, and trade pieces: with fewer pieces, that pawn gets weaker.',
        de: 'Halte einen Springer auf d5, direkt vor dem Bauern d4, und tausche Figuren: Mit weniger Figuren wird dieser Bauer schwächer.'
      },
      {
        en: 'Castle, then bring your rooks to the c-line and the d-line.',
        de: 'Rochieren und dann die Türme auf die c-Linie und die d-Linie bringen.'
      }
    ],
    traps: [
      {
        en: 'If your c8 bishop leaves too early, White’s queen on b3 attacks b7, which then has no guard. That is why e6 comes first here.',
        de: 'Verlässt dein Läufer c8 zu früh, greift die weiße Dame von b3 den Bauern b7 an, der dann ungedeckt ist. Deshalb kommt hier zuerst e6.',
        moves: '1. e4 c6 2. d4 d5 3. exd5 cxd5 4. c4 Nf6 5. Nc3 Bf5 6. Qb3'
      }
    ],
    pgn: '1. e4 c6 2. d4 d5 3. exd5 cxd5 4. c4 Nf6 5. Nc3 e6 6. Nf3 Be7 7. cxd5 Nxd5',
    moves: [
      {
        san: 'e4',
        en: 'White starts in the middle: the pawn grabs a centre square and frees the queen and the light-squared bishop.',
        de: 'Weiß beginnt in der Mitte: Der Bauer nimmt ein Zentrumsfeld und macht Dame und weißfeldrigen Läufer frei.',
        why: {
          en: 'Pawns in the middle give pieces room. White would love pawns on both e4 and d4, and your first move decides how you stop that.',
          de: 'Bauern in der Mitte geben Figuren Platz. Weiß hätte gern Bauern auf e4 und d4, und dein erster Zug entscheidet, wie du das verhinderst.'
        }
      },
      {
        san: 'c6',
        en: 'A quiet-looking move that is the entire idea. You are getting ready to play d5 with a pawn behind it. Unlike the French, you are not walling your own bishop in to do it.',
        de: 'Ein unscheinbarer Zug, der die ganze Idee enthält. Du bereitest d5 vor, mit einem Bauern im Rücken. Anders als in der Französischen mauerst du dafür deinen eigenen Läufer nicht ein.',
        why: {
          en: 'c6 prepares d5 with a pawn guard. If White ever takes on d5, you take back with a pawn and keep the centre.',
          de: 'c6 bereitet d5 mit einer Bauernwache vor. Schlägt Weiß später auf d5, nimmst du mit einem Bauern zurück und behältst die Mitte.'
        }
      },
      {
        san: 'd4',
        en: 'White takes the whole centre. If you let someone put two pawns in the middle, they will.',
        de: 'Weiß nimmt das ganze Zentrum. Wenn man jemanden zwei Bauern in die Mitte stellen lässt, tut er es auch.',
        why: {
          en: 'Two pawns side by side in the middle. White grabs space and opens a line for the c1 bishop.',
          de: 'Zwei Bauern nebeneinander in der Mitte. Weiß nimmt sich Platz und öffnet eine Linie für den Läufer auf c1.'
        }
      },
      {
        san: 'd5',
        en: 'Now the move you prepared. You hit the e4 pawn, and if White trades you take back with the c-pawn, which is why c6 came first.',
        de: 'Jetzt der vorbereitete Zug. Du greifst den Bauern auf e4 an. Wenn Weiß tauscht, schlägst du mit dem c-Bauern zurück. Genau dafür kam c6 zuerst.',
        why: {
          en: 'Now you hit e4 with a pawn that has a guard. Whatever White does, you keep a pawn in the centre.',
          de: 'Jetzt greifst du e4 mit einem gedeckten Bauern an. Was Weiß auch tut, du behältst einen Bauern in der Mitte.'
        },
        threat: {
          en: 'Your d5 pawn attacks e4, and nothing guards it. White must act.',
          de: 'Dein Bauer auf d5 greift e4 an, und nichts deckt ihn. Weiß muss handeln.',
          arrows: ['d5e4']
        }
      },
      {
        san: 'exd5',
        en: 'White trades the e-pawn for your d-pawn, which opens the e-file.',
        de: 'Weiß tauscht den e-Bauern gegen deinen d-Bauern, damit öffnet sich die e-Linie.',
        why: {
          en: 'Trading on d5 changes the pawns. White plans c4 next to attack your d5 pawn again.',
          de: 'Der Tausch auf d5 verändert die Bauern. Weiß plant als Nächstes c4, um deinen Bauern d5 wieder anzugreifen.'
        }
      },
      {
        san: 'cxd5',
        en: 'You take back with the c-pawn. You have a pawn in the centre again.',
        de: 'Du nimmst mit dem c-Bauern zurück. Damit hast du wieder einen Bauern im Zentrum.',
        why: {
          en: 'Taking with the c-pawn keeps a pawn in the centre. That is why c6 came first.',
          de: 'Mit dem c-Bauern zu nehmen behält einen Bauern in der Mitte. Darum kam c6 zuerst.'
        }
      },
      {
        san: 'c4',
        en: 'The Panov Attack. White hits the d5 pawn with a second pawn and opens the game up.',
        de: 'Der Panov-Angriff. Weiß greift den Bauern d5 mit einem zweiten Bauern an und öffnet das Spiel.',
        why: {
          en: 'White attacks d5 with a side pawn. If d5 fell, your centre would be gone, so you must guard it.',
          de: 'Weiß greift d5 mit einem Randbauern an. Fiele d5, wäre dein Zentrum weg, also musst du ihn decken.'
        }
      },
      {
        san: 'Nf6',
        en: 'You develop and defend d5 at once. The knight also keeps an eye on e4.',
        de: 'Du entwickelst dich und deckst d5 gleichzeitig. Der Springer behält auch e4 im Blick.',
        why: {
          en: 'The knight guards d5 and develops. A piece that defends and develops at once is the best defender.',
          de: 'Der Springer deckt d5 und entwickelt sich. Eine Figur, die verteidigt und sich entwickelt, ist der beste Verteidiger.'
        }
      },
      {
        san: 'Nc3',
        en: 'White piles up on d5. Now it is attacked twice.',
        de: 'Weiß verstärkt den Druck auf d5. Jetzt wird es zweimal angegriffen.',
        why: {
          en: 'Two attackers on d5 now: the c4 pawn and the knight. You need a second guard too.',
          de: 'Jetzt zwei Angreifer auf d5: der Bauer c4 und der Springer. Du brauchst auch eine zweite Wache.'
        }
      },
      {
        san: 'e6',
        en: 'A second defender for d5, and it opens the way for the dark-squared bishop.',
        de: 'Ein zweiter Verteidiger für d5, und der schwarzfeldrige Läufer bekommt freie Bahn.',
        why: {
          en: 'e6 adds a pawn guard to d5, so it is safe. It also lets your f8 bishop come out.',
          de: 'e6 gibt d5 eine Bauernwache, jetzt ist er sicher. Außerdem lässt es deinen Läufer auf f8 heraus.'
        }
      },
      {
        san: 'Nf3',
        en: 'White develops another piece.',
        de: 'Weiß entwickelt eine weitere Figur.',
        why: {
          en: 'White develops and guards d4 and e5. Both sides now race to finish their development.',
          de: 'Weiß entwickelt sich und deckt d4 und e5. Beide Seiten wollen jetzt schnell fertig entwickeln.'
        }
      },
      {
        san: 'Be7',
        en: 'You get ready to castle. Develop first and keep it simple.',
        de: 'Du bereitest die Rochade vor. Erst entwickeln, und es einfach halten.',
        why: {
          en: 'On e7 the bishop is safe and clears the way to castle.',
          de: 'Auf e7 steht der Läufer sicher und macht den Weg zur Rochade frei.'
        }
      },
      {
        san: 'cxd5',
        en: 'White takes on d5, hoping for an open game.',
        de: 'Weiß schlägt auf d5 und hofft auf ein offenes Spiel.',
        why: {
          en: 'White’s d4 pawn now has no pawn friends on the lines next to it. Such a lonely pawn is called isolated: strong in attack, hard to defend.',
          de: 'Der Bauer d4 hat jetzt keine Nachbarbauern mehr. So ein einsamer Bauer heißt isoliert: stark im Angriff, schwer zu verteidigen.'
        }
      },
      {
        san: 'Nxd5',
        en: 'You take back with the knight. It sits in the centre where it is strong, and no pieces are hanging.',
        de: 'Du nimmst mit dem Springer zurück. Er steht stark im Zentrum, und keine Figur hängt.',
        why: {
          en: 'The knight takes back and sits right in front of White’s lonely d4 pawn, a perfect blocking square.',
          de: 'Der Springer nimmt zurück und steht direkt vor dem einsamen Bauern d4, ein perfektes Blockadefeld.'
        }
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
    aims: {
      w: {
        en: 'Gain space with e5, keep the pawn chain strong and attack on the king side, where you have more room.',
        de: 'Mit e5 Platz gewinnen, die Bauernkette stark halten und am Königsflügel angreifen, wo du mehr Raum hast.'
      },
      b: {
        en: 'Pin the knight with your bishop, break the chain with c5, and later find a job for the c8 bishop.',
        de: 'Den Springer mit dem Läufer fesseln, die Kette mit c5 aufbrechen und später eine Aufgabe für den Läufer auf c8 finden.'
      }
    },
    plans: [
      {
        en: 'Keep hitting d4 with c5, the knight on c6 and the queen on b6.',
        de: 'Greif d4 immer wieder an: mit c5, dem Springer auf c6 und der Dame auf b6.'
      },
      {
        en: 'Find a job for the c8 bishop: bring it out via d7, or trade it off.',
        de: 'Finde eine Aufgabe für den Läufer auf c8: über d7 herausbringen oder abtauschen.'
      }
    ],
    traps: [
      {
        en: 'Once your dark-squared bishop has left f8, nothing guards g7. White’s queen on g4 attacks it, so castle or guard it in time.',
        de: 'Hat dein schwarzfeldriger Läufer f8 verlassen, deckt nichts mehr g7. Die weiße Dame auf g4 greift ihn an, also rochiere oder deck ihn rechtzeitig.',
        moves: '1. e4 e6 2. d4 d5 3. Nc3 Bb4 4. e5 c5 5. a3 Bxc3+ 6. bxc3 Ne7 7. Qg4'
      }
    ],
    pgn: '1. e4 e6 2. d4 d5 3. Nc3 Bb4 4. e5 c5',
    moves: [
      {
        san: 'e4',
        en: 'White starts in the middle: the pawn grabs a centre square and frees the queen and the light-squared bishop.',
        de: 'Weiß beginnt in der Mitte: Der Bauer nimmt ein Zentrumsfeld und macht Dame und weißfeldrigen Läufer frei.',
        why: {
          en: 'Pawns in the middle give pieces room. White would love pawns on both e4 and d4, and your first move decides how you stop that.',
          de: 'Bauern in der Mitte geben Figuren Platz. Weiß hätte gern Bauern auf e4 und d4, und dein erster Zug entscheidet, wie du das verhinderst.'
        }
      },
      {
        san: 'e6',
        en: 'A small step that makes room for d5 next move, with a pawn ready behind it. Be honest about the cost: it shuts the door on your light-squared bishop, and getting that piece out is the puzzle of this whole opening.',
        de: 'Ein kleiner Schritt, der d5 im nächsten Zug möglich macht, mit einem Bauern im Rücken. Der Preis, ehrlich gesagt: Er sperrt deinen weißfeldrigen Läufer ein, und diese Figur herauszubekommen ist das Rätsel der ganzen Eröffnung.',
        why: {
          en: 'e6 prepares d5 with a pawn guard. Your pawns on d5 and e6 will form a strong wall.',
          de: 'e6 bereitet d5 mit einer Bauernwache vor. Deine Bauern auf d5 und e6 bilden dann eine starke Mauer.'
        }
      },
      {
        san: 'd4',
        en: 'White puts a second pawn in the middle and opens lines for the pieces.',
        de: 'Weiß stellt einen zweiten Bauern in die Mitte und öffnet Linien für die Figuren.',
        why: {
          en: 'White takes the centre with two pawns. That is the classic way to start.',
          de: 'Weiß nimmt das Zentrum mit zwei Bauern. So fängt man klassisch an.'
        }
      },
      {
        san: 'd5',
        en: 'The move you prepared. You go straight at e4, and now White has to decide what to do with that pawn.',
        de: 'Der vorbereitete Zug. Du gehst direkt auf e4 los. Jetzt muss Weiß entscheiden, was mit diesem Bauern passiert.',
        why: {
          en: 'You challenge e4 with a guarded pawn. If White trades, e6 takes back and your wall stays.',
          de: 'Du forderst e4 mit einem gedeckten Bauern heraus. Tauscht Weiß, nimmt e6 zurück und deine Mauer bleibt.'
        },
        threat: {
          en: 'Your d5 pawn attacks e4. White must guard it, push it or trade.',
          de: 'Dein Bauer auf d5 greift e4 an. Weiß muss ihn decken, vorziehen oder tauschen.',
          arrows: ['d5e4']
        }
      },
      {
        san: 'Nc3',
        en: 'White develops and defends the e4 pawn with the knight.',
        de: 'Weiß entwickelt sich und deckt den Bauern auf e4 mit dem Springer.',
        why: {
          en: 'The knight guards e4 and develops. It is the most natural way to keep the pawn.',
          de: 'Der Springer deckt e4 und entwickelt sich. Das ist der natürlichste Weg, den Bauern zu halten.'
        }
      },
      {
        san: 'Bb4',
        en: 'Pin it. The knight on c3 is stuck in front of its king and cannot move, and that knight was the one guarding e4. So the pawn is suddenly not really defended at all.',
        de: 'Fesseln. Der Springer auf c3 steht vor seinem König fest und kann nicht weg, und genau dieser Springer hat e4 gedeckt. Der Bauer ist damit plötzlich gar nicht mehr richtig verteidigt.',
        why: {
          en: 'A pin: the c3 knight can not move, because White’s king stands behind it. So it is not really guarding e4.',
          de: 'Eine Fesselung: Der Springer auf c3 darf nicht ziehen, weil der weiße König dahinter steht. Also deckt er e4 nicht wirklich.'
        },
        threat: {
          en: 'With the knight pinned, your d5 pawn can take on e4.',
          de: 'Weil der Springer gefesselt ist, kann dein Bauer d5 auf e4 schlagen.',
          arrows: ['d5e4']
        }
      },
      {
        san: 'e5',
        en: 'So White pushes the pawn out of trouble instead of defending it. It gains space and locks the centre. It builds a chain, with the pawn on e5 leaning on the one on d4.',
        de: 'Also schiebt Weiß den Bauern aus der Gefahr, statt ihn zu decken. Das bringt Raum und schließt das Zentrum. Es entsteht eine Kette: Der Bauer auf e5 stützt sich auf den auf d4.',
        why: {
          en: 'Pushing saves the pawn, gains space and takes f6 away from your knight.',
          de: 'Der Vorstoß rettet den Bauern, gewinnt Platz und nimmt deinem Springer das Feld f6.'
        }
      },
      {
        san: 'c5',
        en: 'Now hit that chain where it is weakest. The pawn on e5 is protected by the one on d4, but d4 has no pawn helping it. Knock the bottom one out and the top one has nothing to stand on.',
        de: 'Jetzt die Kette dort treffen, wo sie am schwächsten ist. Der Bauer auf e5 wird von dem auf d4 gedeckt, aber d4 selbst hilft kein Bauer. Nimm den unteren weg, und der obere steht auf nichts mehr.',
        why: {
          en: 'A pawn chain is a diagonal row of pawns guarding each other. Hit its bottom pawn, d4, and the chain starts to wobble.',
          de: 'Eine Bauernkette ist eine schräge Reihe von Bauern, die sich decken. Greif den untersten an, d4, dann wackelt die Kette.'
        }
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
    aims: {
      w: {
        en: 'Avoid the pin with the knight on d2, push e5, support d4 with c3 and attack with your bishop on d3.',
        de: 'Mit dem Springer auf d2 der Fesselung ausweichen, e5 spielen, d4 mit c3 stützen und mit dem Läufer auf d3 angreifen.'
      },
      b: {
        en: 'Hit d4 again and again with c5, the knight and the queen, and attack e5 with f6 when the time is right.',
        de: 'd4 immer wieder mit c5, Springer und Dame angreifen und e5 im richtigen Moment mit f6 angreifen.'
      }
    },
    plans: [
      {
        en: 'Put three attackers on d4: the c5 pawn, the knight on c6 and the queen on b6.',
        de: 'Bring drei Angreifer gegen d4: den Bauern c5, den Springer auf c6 und die Dame auf b6.'
      },
      {
        en: 'Push f6 later to attack e5, the head of the chain.',
        de: 'Spiel später f6, um e5 anzugreifen, die Spitze der Kette.'
      }
    ],
    traps: [
      {
        en: 'Do not jump into e4 with your knight. After the knights swap and d5 takes back, White’s queen on g4 attacks your e4 pawn and g7 at the same time.',
        de: 'Spring mit dem Springer nicht nach e4. Nach dem Springertausch und dem Zurücknehmen mit d5 greift die weiße Dame auf g4 deinen Bauern e4 und g7 zugleich an.',
        moves: '1. e4 e6 2. d4 d5 3. Nd2 Nf6 4. e5 Ne4 5. Nxe4 dxe4 6. Qg4'
      }
    ],
    pgn: '1. e4 e6 2. d4 d5 3. Nd2 Nf6 4. e5 Nfd7 5. Bd3 c5 6. c3 Nc6',
    moves: [
      {
        san: 'e4',
        en: 'White starts in the middle: the pawn grabs a centre square and frees the queen and the light-squared bishop.',
        de: 'Weiß beginnt in der Mitte: Der Bauer nimmt ein Zentrumsfeld und macht Dame und weißfeldrigen Läufer frei.',
        why: {
          en: 'Pawns in the middle give pieces room. White would love pawns on both e4 and d4, and your first move decides how you stop that.',
          de: 'Bauern in der Mitte geben Figuren Platz. Weiß hätte gern Bauern auf e4 und d4, und dein erster Zug entscheidet, wie du das verhinderst.'
        }
      },
      {
        san: 'e6',
        en: 'A small step that makes room for d5 next move, with a pawn ready behind it. Be honest about the cost: it shuts the door on your light-squared bishop, and getting that piece out is the puzzle of this whole opening.',
        de: 'Ein kleiner Schritt, der d5 im nächsten Zug möglich macht, mit einem Bauern im Rücken. Der Preis, ehrlich gesagt: Er sperrt deinen weißfeldrigen Läufer ein, und diese Figur herauszubekommen ist das Rätsel der ganzen Eröffnung.',
        why: {
          en: 'e6 prepares d5 with a pawn guard. Your pawns on d5 and e6 will form a strong wall.',
          de: 'e6 bereitet d5 mit einer Bauernwache vor. Deine Bauern auf d5 und e6 bilden dann eine starke Mauer.'
        }
      },
      {
        san: 'd4',
        en: 'White puts a second pawn in the middle and opens lines for the pieces.',
        de: 'Weiß stellt einen zweiten Bauern in die Mitte und öffnet Linien für die Figuren.',
        why: {
          en: 'White takes the centre with two pawns. That is the classic way to start.',
          de: 'Weiß nimmt das Zentrum mit zwei Bauern. So fängt man klassisch an.'
        }
      },
      {
        san: 'd5',
        en: 'The move you prepared. You go straight at e4, and now White has to decide what to do with that pawn.',
        de: 'Der vorbereitete Zug. Du gehst direkt auf e4 los. Jetzt muss Weiß entscheiden, was mit diesem Bauern passiert.',
        why: {
          en: 'You challenge e4 with a guarded pawn. If White trades, e6 takes back and your wall stays.',
          de: 'Du forderst e4 mit einem gedeckten Bauern heraus. Tauscht Weiß, nimmt e6 zurück und deine Mauer bleibt.'
        },
        threat: {
          en: 'Your d5 pawn attacks e4. White must guard it, push it or trade.',
          de: 'Dein Bauer auf d5 greift e4 an. Weiß muss ihn decken, vorziehen oder tauschen.',
          arrows: ['d5e4']
        }
      },
      {
        san: 'Nd2',
        en: 'The Tarrasch. Putting the knight on d2 means there is no pin with ...Bb4, and the c-pawn is free to support d4.',
        de: 'Die Tarrasch-Variante. Mit dem Springer auf d2 gibt es keine Fesselung durch ...Lb4, und der c-Bauer ist frei, um d4 zu stützen.',
        why: {
          en: 'On d2 the knight can not be pinned by your bishop, and the c-pawn stays free to support d4.',
          de: 'Auf d2 kann dein Läufer den Springer nicht fesseln, und der c-Bauer bleibt frei, um d4 zu stützen.'
        }
      },
      {
        san: 'Nf6',
        en: 'You develop the knight and attack the e4 pawn.',
        de: 'Du entwickelst den Springer und greifst den Bauern auf e4 an.',
        why: {
          en: 'The knight develops and attacks e4. White must guard it, push it or trade.',
          de: 'Der Springer entwickelt sich und greift e4 an. Weiß muss decken, vorziehen oder tauschen.'
        }
      },
      {
        san: 'e5',
        en: 'White pushes forward and attacks your knight. It gains space.',
        de: 'Weiß rückt vor und greift deinen Springer an. Das gewinnt Raum.',
        why: {
          en: 'White pushes with a gain of time: the pawn grabs space and your knight has to move again.',
          de: 'Weiß zieht vor und gewinnt Zeit: Der Bauer nimmt Platz, und dein Springer muss noch einmal ziehen.'
        },
        threat: {
          en: 'The e5 pawn attacks your f6 knight. It has to move.',
          de: 'Der Bauer auf e5 greift deinen Springer auf f6 an. Er muss weg.',
          arrows: ['e5f6']
        }
      },
      {
        san: 'Nfd7',
        en: 'The knight steps back to d7. It is safe there and now hits the e5 pawn.',
        de: 'Der Springer weicht nach d7 aus. Dort steht er sicher und greift jetzt den Bauern auf e5 an.',
        why: {
          en: 'From d7 the knight is safe and helps the attack on White’s chain with c5 and later f6.',
          de: 'Auf d7 steht der Springer sicher und hilft beim Angriff auf die weiße Kette mit c5 und später f6.'
        }
      },
      {
        san: 'Bd3',
        en: 'White develops and defends e5.',
        de: 'Weiß entwickelt sich und deckt e5.',
        why: {
          en: 'The bishop aims at h7 near your king. It is often White’s best attacking piece in the French.',
          de: 'Der Läufer zielt auf h7 nahe deinem König. Er ist im Französisch oft die beste Angriffsfigur von Weiß.'
        }
      },
      {
        san: 'c5',
        en: 'Now you hit the base of the pawn chain. The d4 pawn is the one you want to remove, because then e5 will fall too.',
        de: 'Jetzt greifst du die Basis der Bauernkette an. Der Bauer auf d4 ist der, den du loswerden willst, denn dann fällt auch e5.',
        why: {
          en: 'Hit the bottom of the chain again. If d4 falls, the e5 pawn loses its guard.',
          de: 'Greif wieder den Fuß der Kette an. Fällt d4, verliert der Bauer e5 seine Wache.'
        }
      },
      {
        san: 'c3',
        en: 'White props up d4 with a pawn.',
        de: 'Weiß stützt d4 mit einem Bauern.',
        why: {
          en: 'c3 adds a pawn guard to d4, so the chain stays strong.',
          de: 'c3 gibt d4 eine Bauernwache, so bleibt die Kette stark.'
        }
      },
      {
        san: 'Nc6',
        en: 'You bring another attacker to d4. The pressure on the centre grows, and White will have to keep defending it.',
        de: 'Du bringst einen weiteren Angreifer nach d4. Der Druck aufs Zentrum wächst, und Weiß muss ständig weiter verteidigen.',
        why: {
          en: 'Another attacker on d4. Soon the queen on b6 can add a third, and White must find more guards.',
          de: 'Noch ein Angreifer auf d4. Bald kann die Dame auf b6 eine dritte hinzufügen, und Weiß braucht mehr Wachen.'
        }
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
    aims: {
      w: {
        en: 'Keep the chain d4 and e5, use the space for a king side attack and hold d4 with c3 and the knight on f3.',
        de: 'Die Kette d4 und e5 halten, den Platz für einen Angriff am Königsflügel nutzen und d4 mit c3 und dem Springer auf f3 halten.'
      },
      b: {
        en: 'Attack d4 with c5, the knight and the queen, then lock the queen side with c4 and use the b3 square.',
        de: 'd4 mit c5, Springer und Dame angreifen, dann den Damenflügel mit c4 schließen und das Feld b3 nutzen.'
      }
    },
    plans: [
      {
        en: 'Pile up on d4 with c5, the knight on c6 and the queen on b6.',
        de: 'Häuf Angreifer auf d4: c5, den Springer auf c6 und die Dame auf b6.'
      },
      {
        en: 'After c4, bring a knight via a5 to b3, a square no white pawn can ever attack.',
        de: 'Nach c4 bring einen Springer über a5 nach b3, ein Feld, das kein weißer Bauer je angreifen kann.'
      }
    ],
    traps: [
      {
        en: 'Do not grab d4 too fast. If you take twice on d4 after White’s bishop came to d3, the bishop check on b5 uncovers White’s queen, and she takes yours.',
        de: 'Schnapp d4 nicht zu schnell. Nimmst du zweimal auf d4, nachdem der weiße Läufer nach d3 kam, gibt das Läuferschach auf b5 die weiße Dame frei, und sie nimmt deine.',
        moves: '1. e4 e6 2. d4 d5 3. e5 c5 4. c3 Nc6 5. Nf3 Qb6 6. Bd3 cxd4 7. cxd4 Nxd4 8. Nxd4 Qxd4 9. Bb5+'
      }
    ],
    pgn: '1. e4 e6 2. d4 d5 3. e5 c5 4. c3 Nc6 5. Nf3 Qb6 6. a3 c4 7. Nbd2 Na5',
    moves: [
      {
        san: 'e4',
        en: 'White starts in the middle: the pawn grabs a centre square and frees the queen and the light-squared bishop.',
        de: 'Weiß beginnt in der Mitte: Der Bauer nimmt ein Zentrumsfeld und macht Dame und weißfeldrigen Läufer frei.',
        why: {
          en: 'Pawns in the middle give pieces room. White would love pawns on both e4 and d4, and your first move decides how you stop that.',
          de: 'Bauern in der Mitte geben Figuren Platz. Weiß hätte gern Bauern auf e4 und d4, und dein erster Zug entscheidet, wie du das verhinderst.'
        }
      },
      {
        san: 'e6',
        en: 'A small step that makes room for d5 next move, with a pawn ready behind it. Be honest about the cost: it shuts the door on your light-squared bishop, and getting that piece out is the puzzle of this whole opening.',
        de: 'Ein kleiner Schritt, der d5 im nächsten Zug möglich macht, mit einem Bauern im Rücken. Der Preis, ehrlich gesagt: Er sperrt deinen weißfeldrigen Läufer ein, und diese Figur herauszubekommen ist das Rätsel der ganzen Eröffnung.',
        why: {
          en: 'e6 prepares d5 with a pawn guard. Your pawns on d5 and e6 will form a strong wall.',
          de: 'e6 bereitet d5 mit einer Bauernwache vor. Deine Bauern auf d5 und e6 bilden dann eine starke Mauer.'
        }
      },
      {
        san: 'd4',
        en: 'White puts a second pawn in the middle and opens lines for the pieces.',
        de: 'Weiß stellt einen zweiten Bauern in die Mitte und öffnet Linien für die Figuren.',
        why: {
          en: 'White takes the centre with two pawns. That is the classic way to start.',
          de: 'Weiß nimmt das Zentrum mit zwei Bauern. So fängt man klassisch an.'
        }
      },
      {
        san: 'd5',
        en: 'The move you prepared. You go straight at e4, and now White has to decide what to do with that pawn.',
        de: 'Der vorbereitete Zug. Du gehst direkt auf e4 los. Jetzt muss Weiß entscheiden, was mit diesem Bauern passiert.',
        why: {
          en: 'You challenge e4 with a guarded pawn. If White trades, e6 takes back and your wall stays.',
          de: 'Du forderst e4 mit einem gedeckten Bauern heraus. Tauscht Weiß, nimmt e6 zurück und deine Mauer bleibt.'
        },
        threat: {
          en: 'Your d5 pawn attacks e4. White must guard it, push it or trade.',
          de: 'Dein Bauer auf d5 greift e4 an. Weiß muss ihn decken, vorziehen oder tauschen.',
          arrows: ['d5e4']
        }
      },
      {
        san: 'e5',
        en: 'White pushes the pawn up and takes space. The centre is closed, and your light-squared bishop is stuck behind your own pawns.',
        de: 'Weiß schiebt den Bauern vor und nimmt Raum. Das Zentrum ist geschlossen, und dein weißfeldriger Läufer steckt hinter den eigenen Bauern fest.',
        why: {
          en: 'White grabs space. The pawns on d4 and e5 now guard each other in a diagonal row, a pawn chain.',
          de: 'Weiß nimmt sich Platz. Die Bauern auf d4 und e5 decken sich jetzt in einer schrägen Reihe, einer Bauernkette.'
        }
      },
      {
        san: 'c5',
        en: 'The usual answer: hit the base of the chain at d4.',
        de: 'Die übliche Antwort: Greif die Basis der Kette auf d4 an.',
        why: {
          en: 'A chain is only as strong as its bottom pawn, and that is d4. So that is where you hit.',
          de: 'Eine Kette ist nur so stark wie ihr unterster Bauer, und das ist d4. Also greifst du dort an.'
        }
      },
      {
        san: 'c3',
        en: 'White supports d4 with a pawn.',
        de: 'Weiß stützt d4 mit einem Bauern.',
        why: {
          en: 'With c3, White keeps a pawn guard on d4. If you take on d4, the c3 pawn takes back and the chain stays.',
          de: 'Mit c3 behält d4 eine Bauernwache. Schlägst du auf d4, nimmt der Bauer c3 zurück und die Kette bleibt.'
        }
      },
      {
        san: 'Nc6',
        en: 'A second attacker on d4.',
        de: 'Ein zweiter Angreifer auf d4.',
        why: {
          en: 'Two attackers on d4 now: the c5 pawn and the knight.',
          de: 'Jetzt zwei Angreifer auf d4: der Bauer c5 und der Springer.'
        }
      },
      {
        san: 'Nf3',
        en: 'White adds a defender. Now d4 is defended by the c3 pawn, the knight and the queen.',
        de: 'Weiß fügt einen Verteidiger hinzu. Jetzt wird d4 vom Bauern auf c3, vom Springer und von der Dame gedeckt.',
        why: {
          en: 'A third guard for d4. White counts carefully, and so must you.',
          de: 'Eine dritte Wache für d4. Weiß zählt genau, und das musst du auch.'
        }
      },
      {
        san: 'Qb6',
        en: 'The queen joins the attack. She eyes d4 through the pawn on c5, and the b2 pawn is also in sight.',
        de: 'Die Dame schließt sich dem Angriff an. Sie zielt durch den Bauern c5 auf d4 und hat auch den Bauern b2 im Blick.',
        why: {
          en: 'The queen adds pressure on d4 and looks at b2. White’s c1 bishop now has to keep guarding b2.',
          de: 'Die Dame erhöht den Druck auf d4 und schaut auf b2. Der weiße Läufer auf c1 muss jetzt b2 weiter decken.'
        }
      },
      {
        san: 'a3',
        en: 'White stops ...Bb4 and gets ready to answer ...c4 with b4.',
        de: 'Weiß verhindert ...Lb4 und bereitet sich darauf vor, auf ...c4 mit b4 zu antworten.',
        why: {
          en: 'a3 prepares b4 to grab space on the queen side.',
          de: 'a3 bereitet b4 vor, um am Damenflügel Platz zu gewinnen.'
        }
      },
      {
        san: 'c4',
        en: 'You grab space on the queenside and freeze White’s pawns there. The pressure on d4 is gone for now, but your pawn wedge makes b3 awkward.',
        de: 'Du nimmst Raum am Damenflügel und fixierst dort die weißen Bauern. Der Druck auf d4 ist vorerst weg, aber dein Bauernkeil macht b3 unbequem.',
        why: {
          en: 'With c4, White’s b-pawn can not open lines with b4 so easily. You lock the queen side.',
          de: 'Mit c4 kann der weiße b-Bauer nicht mehr so leicht mit b4 Linien öffnen. Du schließt den Damenflügel.'
        }
      },
      {
        san: 'Nbd2',
        en: 'White develops the last knight on the queenside.',
        de: 'Weiß entwickelt den letzten Springer am Damenflügel.',
        why: {
          en: 'The knight develops and watches c4 and b3.',
          de: 'Der Springer entwickelt sich und bewacht c4 und b3.'
        }
      },
      {
        san: 'Na5',
        en: 'The knight heads for b3, where it could trade itself for the knight on d2 and break White’s grip.',
        de: 'Der Springer will nach b3, wo er sich gegen den Springer auf d2 tauschen und den Griff von Weiß lockern könnte.',
        why: {
          en: 'b3 is a hole: a square no white pawn can ever attack. A knight there is very annoying for White.',
          de: 'b3 ist ein Loch: ein Feld, das kein weißer Bauer je angreifen kann. Ein Springer dort ist für Weiß sehr lästig.'
        },
        threat: {
          en: 'Your knight can jump to b3 and attack the a1 rook and the c1 bishop.',
          de: 'Dein Springer kann nach b3 springen und den Turm auf a1 und den Läufer auf c1 angreifen.',
          arrows: ['a5b3']
        }
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
    aims: {
      w: {
        en: 'Use your faster development, put pieces on good squares and attack before Black is ready.',
        de: 'Die schnellere Entwicklung nutzen, die Figuren auf gute Felder stellen und angreifen, bevor Schwarz bereit ist.'
      },
      b: {
        en: 'Use the extra centre pawn and the open c-line, finish developing and hit back on the queen side.',
        de: 'Den zusätzlichen Zentrumsbauern und die offene c-Linie nutzen, fertig entwickeln und am Damenflügel zurückschlagen.'
      }
    },
    plans: [
      {
        en: 'Develop with a6, e6 or g6, then castle and bring a rook to c8.',
        de: 'Entwickle dich mit a6, e6 oder g6, dann rochieren und einen Turm nach c8 bringen.'
      },
      {
        en: 'Use the open c-line: a rook on c8 presses on White’s queen side.',
        de: 'Nutze die offene c-Linie: Ein Turm auf c8 drückt auf den weißen Damenflügel.'
      }
    ],
    traps: [
      {
        en: 'The fork trick: if White brings the bishop to c4 early, take on e4 with your knight. After White takes back, d5 forks bishop and knight and wins the piece back.',
        de: 'Der Gabeltrick: Bringt Weiß den Läufer früh nach c4, nimm mit dem Springer auf e4. Nimmt Weiß zurück, gabelt d5 Läufer und Springer und holt die Figur zurück.',
        moves: '1. e4 c5 2. Nf3 d6 3. d4 cxd4 4. Nxd4 Nf6 5. Nc3 Nc6 6. Bc4 Nxe4 7. Nxe4 d5'
      }
    ],
    pgn: '1. e4 c5 2. Nf3 d6 3. d4 cxd4 4. Nxd4 Nf6 5. Nc3',
    moves: [
      {
        san: 'e4',
        en: 'White starts in the middle: the pawn grabs a centre square and frees the queen and the light-squared bishop.',
        de: 'Weiß beginnt in der Mitte: Der Bauer nimmt ein Zentrumsfeld und macht Dame und weißfeldrigen Läufer frei.',
        why: {
          en: 'Pawns in the middle give pieces room. White would love pawns on both e4 and d4, and your first move decides how you stop that.',
          de: 'Bauern in der Mitte geben Figuren Platz. Weiß hätte gern Bauern auf e4 und d4, und dein erster Zug entscheidet, wie du das verhinderst.'
        }
      },
      {
        san: 'c5',
        en: 'You do not copy White. You go sideways. This pawn covers d4 and offers a trade: your wing pawn for White’s centre pawn. It is worth knowing the catch: unlike e5, this move develops nothing, so White will get pieces out faster.',
        de: 'Du machst es Weiß nicht nach. Du gehst zur Seite. Dieser Bauer deckt d4 und bietet einen Tausch an: dein Flügelbauer gegen den Zentrumsbauern von Weiß. Der Haken gehört dazu: Anders als e5 entwickelt dieser Zug nichts, Weiß bekommt seine Figuren also schneller heraus.',
        why: {
          en: 'c5 fights for d4 from the side. If White plays d4, you swap a side pawn for a centre pawn.',
          de: 'c5 kämpft von der Seite um d4. Spielt Weiß d4, tauschst du einen Randbauern gegen einen Zentrumsbauern.'
        }
      },
      {
        san: 'Nf3',
        en: 'White develops and builds up on d4, getting ready to play the pawn there.',
        de: 'Weiß entwickelt sich und baut Druck auf d4 auf, um den Bauern dorthin zu ziehen.',
        why: {
          en: 'The knight develops and guards d4, so White can push the pawn there next.',
          de: 'Der Springer entwickelt sich und deckt d4, damit Weiß den Bauern als Nächstes dorthin ziehen kann.'
        }
      },
      {
        san: 'd6',
        en: 'A small move with a job to do later: it takes the e5 square away from White. Remember it, because it is the reason your knight will be safe on f6 in two moves.',
        de: 'Ein kleiner Zug mit einer späteren Aufgabe: Er nimmt Weiß das Feld e5 weg. Merk ihn dir, denn deshalb steht dein Springer in zwei Zügen sicher auf f6.',
        why: {
          en: 'd6 keeps White’s pawn away from e5 and opens the way for your c8 bishop.',
          de: 'd6 hält den weißen Bauern von e5 fern und öffnet den Weg für deinen Läufer auf c8.'
        }
      },
      {
        san: 'd4',
        en: 'White plays it, and offers you the trade you have been asking for since move one.',
        de: 'Weiß spielt ihn und bietet dir den Tausch an, um den du seit dem ersten Zug bittest.',
        why: {
          en: 'White opens the centre to get pieces out fast. You trade at once.',
          de: 'Weiß öffnet die Mitte, um schnell Figuren herauszubringen. Du tauschst sofort.'
        }
      },
      {
        san: 'cxd4',
        en: 'Take it. Your wing pawn comes into the middle and takes White’s centre pawn off the board.',
        de: 'Nimm ihn. Dein Flügelbauer kommt in die Mitte und holt den weißen Zentrumsbauern vom Brett.',
        why: {
          en: 'Your c-pawn swaps itself for White’s d-pawn. Now you have two centre pawns, d6 and e7, and White only one.',
          de: 'Dein c-Bauer tauscht sich gegen den weißen d-Bauern. Jetzt hast du zwei Zentrumsbauern, d6 und e7, und Weiß nur einen.'
        }
      },
      {
        san: 'Nxd4',
        en: 'White takes back with the knight. Look at the pawns now: you have two in the middle, White has one, and the c-file in front of your rook is open.',
        de: 'Weiß schlägt mit dem Springer zurück. Sieh dir jetzt die Bauern an: Du hast zwei in der Mitte, Weiß einen, und die c-Linie vor deinem Turm ist offen.',
        why: {
          en: 'The knight takes back and stands in the middle. White is ahead in development, you have the better pawns.',
          de: 'Der Springer nimmt zurück und steht in der Mitte. Weiß ist weiter entwickelt, du hast die besseren Bauern.'
        }
      },
      {
        san: 'Nf6',
        en: 'Develop, and attack the e4 pawn while you are at it. This is where d6 pays off: White cannot push past you with e5 to chase the knight away.',
        de: 'Entwickeln und dabei gleich den Bauern auf e4 angreifen. Hier zahlt sich d6 aus: Weiß kann nicht mit e5 vorbeischieben und den Springer verjagen.',
        why: {
          en: 'Developing with a threat: White has to spend the next move on the e4 pawn.',
          de: 'Entwickeln mit Drohung: Weiß muss den nächsten Zug für den Bauern auf e4 verwenden.'
        },
        threat: {
          en: 'Your knight attacks the e4 pawn, and nothing guards it.',
          de: 'Dein Springer greift den Bauern auf e4 an, und nichts deckt ihn.',
          arrows: ['f6e4']
        }
      },
      {
        san: 'Nc3',
        en: 'White has to look after that pawn, and this defends it while developing. Grabbing space with c4 instead would simply drop it to Nxe4.',
        de: 'Weiß muss sich um den Bauern kümmern: Dieser Zug deckt ihn und entwickelt zugleich. Stattdessen mit c4 Raum zu nehmen, würde ihn einfach an Sxe4 verlieren.',
        why: {
          en: 'The knight guards e4 and develops. White now has two knights out and a lead in development.',
          de: 'Der Springer deckt e4 und entwickelt sich. Weiß hat jetzt zwei Springer draußen und einen Entwicklungsvorsprung.'
        }
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
    aims: {
      w: {
        en: 'Develop with the bishop to e3, f3 and the queen to d2, castle on the queen side and storm the king side with g4 and g5.',
        de: 'Mit dem Läufer nach e3, f3 und der Dame nach d2 entwickeln, lang rochieren und am Königsflügel mit g4 und g5 stürmen.'
      },
      b: {
        en: 'Use a6 and e5 to fight for the centre, keep d5 under control with your pieces, then push d5 or b5.',
        de: 'Mit a6 und e5 um die Mitte kämpfen, d5 mit den Figuren kontrollieren und dann d5 oder b5 spielen.'
      }
    },
    plans: [
      {
        en: 'Keep d5 under control with the bishop on e6 and a knight on d7, and later push d5 yourself.',
        de: 'Kontrolliere d5 mit dem Läufer auf e6 und einem Springer auf d7, und spiel später selbst d5.'
      },
      {
        en: 'Push b5 and b4 to attack White’s king if it castles on the queen side.',
        de: 'Spiel b5 und b4, um den weißen König anzugreifen, wenn er lang rochiert.'
      }
    ],
    traps: [
      {
        en: 'Play e5 only after a6. Without a6, a knight jumps to b5 and eyes d6 and c7.',
        de: 'Spiel e5 erst nach a6. Ohne a6 springt ein Springer nach b5 und schaut auf d6 und c7.',
        moves: '1. e4 c5 2. Nf3 d6 3. d4 cxd4 4. Nxd4 Nf6 5. Nc3 e5 6. Ndb5'
      }
    ],
    pgn: '1. e4 c5 2. Nf3 d6 3. d4 cxd4 4. Nxd4 Nf6 5. Nc3 a6 6. Be3 e5 7. Nb3 Be6',
    moves: [
      {
        san: 'e4',
        en: 'White starts in the middle: the pawn grabs a centre square and frees the queen and the light-squared bishop.',
        de: 'Weiß beginnt in der Mitte: Der Bauer nimmt ein Zentrumsfeld und macht Dame und weißfeldrigen Läufer frei.',
        why: {
          en: 'Pawns in the middle give pieces room. White would love pawns on both e4 and d4, and your first move decides how you stop that.',
          de: 'Bauern in der Mitte geben Figuren Platz. Weiß hätte gern Bauern auf e4 und d4, und dein erster Zug entscheidet, wie du das verhinderst.'
        }
      },
      {
        san: 'c5',
        en: 'You do not copy White. You go sideways. This pawn covers d4 and offers a trade: your wing pawn for White’s centre pawn. It is worth knowing the catch: unlike e5, this move develops nothing, so White will get pieces out faster.',
        de: 'Du machst es Weiß nicht nach. Du gehst zur Seite. Dieser Bauer deckt d4 und bietet einen Tausch an: dein Flügelbauer gegen den Zentrumsbauern von Weiß. Der Haken gehört dazu: Anders als e5 entwickelt dieser Zug nichts, Weiß bekommt seine Figuren also schneller heraus.',
        why: {
          en: 'c5 fights for d4 from the side. If White plays d4, you swap a side pawn for a centre pawn.',
          de: 'c5 kämpft von der Seite um d4. Spielt Weiß d4, tauschst du einen Randbauern gegen einen Zentrumsbauern.'
        }
      },
      {
        san: 'Nf3',
        en: 'White develops and builds up on d4, getting ready to play the pawn there.',
        de: 'Weiß entwickelt sich und baut Druck auf d4 auf, um den Bauern dorthin zu ziehen.',
        why: {
          en: 'The knight develops and guards d4, so White can push the pawn there next.',
          de: 'Der Springer entwickelt sich und deckt d4, damit Weiß den Bauern als Nächstes dorthin ziehen kann.'
        }
      },
      {
        san: 'd6',
        en: 'A small move with a job to do later: it takes the e5 square away from White. Remember it, because it is the reason your knight will be safe on f6 in two moves.',
        de: 'Ein kleiner Zug mit einer späteren Aufgabe: Er nimmt Weiß das Feld e5 weg. Merk ihn dir, denn deshalb steht dein Springer in zwei Zügen sicher auf f6.',
        why: {
          en: 'd6 keeps White’s pawn away from e5 and opens the way for your c8 bishop.',
          de: 'd6 hält den weißen Bauern von e5 fern und öffnet den Weg für deinen Läufer auf c8.'
        }
      },
      {
        san: 'd4',
        en: 'White plays it, and offers you the trade you have been asking for since move one.',
        de: 'Weiß spielt ihn und bietet dir den Tausch an, um den du seit dem ersten Zug bittest.',
        why: {
          en: 'White opens the centre to get pieces out fast. You trade at once.',
          de: 'Weiß öffnet die Mitte, um schnell Figuren herauszubringen. Du tauschst sofort.'
        }
      },
      {
        san: 'cxd4',
        en: 'Take it. Your wing pawn comes into the middle and takes White’s centre pawn off the board.',
        de: 'Nimm ihn. Dein Flügelbauer kommt in die Mitte und holt den weißen Zentrumsbauern vom Brett.',
        why: {
          en: 'Your c-pawn swaps itself for White’s d-pawn. Now you have two centre pawns, d6 and e7, and White only one.',
          de: 'Dein c-Bauer tauscht sich gegen den weißen d-Bauern. Jetzt hast du zwei Zentrumsbauern, d6 und e7, und Weiß nur einen.'
        }
      },
      {
        san: 'Nxd4',
        en: 'White takes back with the knight. Look at the pawns now: you have two in the middle, White has one, and the c-file in front of your rook is open.',
        de: 'Weiß schlägt mit dem Springer zurück. Sieh dir jetzt die Bauern an: Du hast zwei in der Mitte, Weiß einen, und die c-Linie vor deinem Turm ist offen.',
        why: {
          en: 'The knight takes back and stands in the middle. White is ahead in development, you have the better pawns.',
          de: 'Der Springer nimmt zurück und steht in der Mitte. Weiß ist weiter entwickelt, du hast die besseren Bauern.'
        }
      },
      {
        san: 'Nf6',
        en: 'Develop, and attack the e4 pawn while you are at it. This is where d6 pays off: White cannot push past you with e5 to chase the knight away.',
        de: 'Entwickeln und dabei gleich den Bauern auf e4 angreifen. Hier zahlt sich d6 aus: Weiß kann nicht mit e5 vorbeischieben und den Springer verjagen.',
        why: {
          en: 'Developing with a threat: White has to spend the next move on the e4 pawn.',
          de: 'Entwickeln mit Drohung: Weiß muss den nächsten Zug für den Bauern auf e4 verwenden.'
        },
        threat: {
          en: 'Your knight attacks the e4 pawn, and nothing guards it.',
          de: 'Dein Springer greift den Bauern auf e4 an, und nichts deckt ihn.',
          arrows: ['f6e4']
        }
      },
      {
        san: 'Nc3',
        en: 'White has to look after that pawn, and this defends it while developing. Grabbing space with c4 instead would simply drop it to Nxe4.',
        de: 'Weiß muss sich um den Bauern kümmern: Dieser Zug deckt ihn und entwickelt zugleich. Stattdessen mit c4 Raum zu nehmen, würde ihn einfach an Sxe4 verlieren.',
        why: {
          en: 'The knight guards e4 and develops. White now has two knights out and a lead in development.',
          de: 'Der Springer deckt e4 und entwickelt sich. Weiß hat jetzt zwei Springer draußen und einen Entwicklungsvorsprung.'
        }
      },
      {
        san: 'a6',
        en: 'The Najdorf move. It takes b5 away from white pieces, gives the queen a way to escape on b7 and prepares ...b5.',
        de: 'Der Najdorf-Zug. Er nimmt weißen Figuren das Feld b5, gibt der Dame auf b7 einen Ausweg und bereitet ...b5 vor.',
        why: {
          en: 'a6 is small but useful: no white knight or bishop can land on b5, and later b5 can come for you.',
          de: 'a6 ist klein, aber nützlich: Kein weißer Springer oder Läufer kann auf b5 landen, und später kannst du selbst b5 spielen.'
        }
      },
      {
        san: 'Be3',
        en: 'White develops and aims at queenside castling and a quick attack.',
        de: 'Weiß entwickelt sich und strebt lange Rochade und einen schnellen Angriff an.',
        why: {
          en: 'The bishop guards d4 and aims at b6. White often follows with f3, the queen to d2 and castling on the queen side.',
          de: 'Der Läufer deckt d4 und zielt auf b6. Oft folgen f3, die Dame nach d2 und die lange Rochade.'
        }
      },
      {
        san: 'e5',
        en: 'You kick the knight and take a share of the centre. The price is that d5 is now a hole, but your pieces will watch it.',
        de: 'Du vertreibst den Springer und nimmst dir einen Teil des Zentrums. Der Preis: d5 ist jetzt ein Loch, aber deine Figuren behalten es im Auge.',
        why: {
          en: 'e5 kicks the knight and takes space. d5 becomes a weak square that no pawn of yours can guard, so your pieces must watch it.',
          de: 'e5 vertreibt den Springer und nimmt Platz. d5 wird ein schwaches Feld, das kein Bauer von dir decken kann. Deine Figuren müssen es bewachen.'
        },
        threat: {
          en: 'Your e5 pawn attacks the d4 knight. A knight is worth much more than a pawn, so it has to move.',
          de: 'Dein Bauer e5 greift den Springer auf d4 an. Ein Springer ist viel mehr wert als ein Bauer, also muss er weg.',
          arrows: ['e5d4']
        }
      },
      {
        san: 'Nb3',
        en: 'The knight retreats to b3. It covers d4 and a5 and keeps an eye on c5.',
        de: 'Der Springer weicht nach b3 aus. Er deckt d4 und a5 und beobachtet c5.',
        why: {
          en: 'On b3 the knight is safe and keeps an eye on c5 and d4.',
          de: 'Auf b3 steht der Springer sicher und behält c5 und d4 im Blick.'
        }
      },
      {
        san: 'Be6',
        en: 'The bishop takes control of d5 and c4, and it eyes the knight on b3.',
        de: 'Der Läufer kontrolliert d5 und c4 und zielt auf den Springer auf b3.',
        why: {
          en: 'The bishop covers d5, the weak square, and c4. It also helps you push d5 later.',
          de: 'Der Läufer deckt d5, das schwache Feld, und c4. Außerdem hilft er dir später beim Zug d5.'
        }
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
    aims: {
      w: {
        en: 'The Yugoslav Attack: bishop to e3, f3, queen to d2, castle on the queen side, then push h4 and h5 at Black’s king.',
        de: 'Der Jugoslawische Angriff: Läufer nach e3, f3, Dame nach d2, lang rochieren und dann h4 und h5 gegen den schwarzen König.'
      },
      b: {
        en: 'Use the dragon bishop on g7, castle, open the c-line and attack White’s king on the queen side.',
        de: 'Den Drachenläufer auf g7 nutzen, rochieren, die c-Linie öffnen und den weißen König am Damenflügel angreifen.'
      }
    },
    plans: [
      {
        en: 'Put a rook on c8 and push b5 to open lines towards White’s king.',
        de: 'Stell einen Turm nach c8 und spiel b5, um Linien zum weißen König zu öffnen.'
      },
      {
        en: 'Keep your g7 bishop if you can: without it, your king is much weaker.',
        de: 'Behalte deinen Läufer auf g7, wenn es geht: Ohne ihn ist dein König viel schwächer.'
      }
    ],
    traps: [
      {
        en: 'This is why White plays f3 first: without it, your knight can jump to g4 and attack the e3 bishop.',
        de: 'Darum spielt Weiß zuerst f3: Ohne f3 kann dein Springer nach g4 springen und den Läufer auf e3 angreifen.',
        moves: '1. e4 c5 2. Nf3 d6 3. d4 cxd4 4. Nxd4 Nf6 5. Nc3 g6 6. Be3 Bg7 7. Qd2 Ng4'
      }
    ],
    pgn: '1. e4 c5 2. Nf3 d6 3. d4 cxd4 4. Nxd4 Nf6 5. Nc3 g6 6. Be3 Bg7 7. f3 O-O 8. Qd2 Nc6',
    moves: [
      {
        san: 'e4',
        en: 'White starts in the middle: the pawn grabs a centre square and frees the queen and the light-squared bishop.',
        de: 'Weiß beginnt in der Mitte: Der Bauer nimmt ein Zentrumsfeld und macht Dame und weißfeldrigen Läufer frei.',
        why: {
          en: 'Pawns in the middle give pieces room. White would love pawns on both e4 and d4, and your first move decides how you stop that.',
          de: 'Bauern in der Mitte geben Figuren Platz. Weiß hätte gern Bauern auf e4 und d4, und dein erster Zug entscheidet, wie du das verhinderst.'
        }
      },
      {
        san: 'c5',
        en: 'You do not copy White. You go sideways. This pawn covers d4 and offers a trade: your wing pawn for White’s centre pawn. It is worth knowing the catch: unlike e5, this move develops nothing, so White will get pieces out faster.',
        de: 'Du machst es Weiß nicht nach. Du gehst zur Seite. Dieser Bauer deckt d4 und bietet einen Tausch an: dein Flügelbauer gegen den Zentrumsbauern von Weiß. Der Haken gehört dazu: Anders als e5 entwickelt dieser Zug nichts, Weiß bekommt seine Figuren also schneller heraus.',
        why: {
          en: 'c5 fights for d4 from the side. If White plays d4, you swap a side pawn for a centre pawn.',
          de: 'c5 kämpft von der Seite um d4. Spielt Weiß d4, tauschst du einen Randbauern gegen einen Zentrumsbauern.'
        }
      },
      {
        san: 'Nf3',
        en: 'White develops and builds up on d4, getting ready to play the pawn there.',
        de: 'Weiß entwickelt sich und baut Druck auf d4 auf, um den Bauern dorthin zu ziehen.',
        why: {
          en: 'The knight develops and guards d4, so White can push the pawn there next.',
          de: 'Der Springer entwickelt sich und deckt d4, damit Weiß den Bauern als Nächstes dorthin ziehen kann.'
        }
      },
      {
        san: 'd6',
        en: 'A small move with a job to do later: it takes the e5 square away from White. Remember it, because it is the reason your knight will be safe on f6 in two moves.',
        de: 'Ein kleiner Zug mit einer späteren Aufgabe: Er nimmt Weiß das Feld e5 weg. Merk ihn dir, denn deshalb steht dein Springer in zwei Zügen sicher auf f6.',
        why: {
          en: 'd6 keeps White’s pawn away from e5 and opens the way for your c8 bishop.',
          de: 'd6 hält den weißen Bauern von e5 fern und öffnet den Weg für deinen Läufer auf c8.'
        }
      },
      {
        san: 'd4',
        en: 'White plays it, and offers you the trade you have been asking for since move one.',
        de: 'Weiß spielt ihn und bietet dir den Tausch an, um den du seit dem ersten Zug bittest.',
        why: {
          en: 'White opens the centre to get pieces out fast. You trade at once.',
          de: 'Weiß öffnet die Mitte, um schnell Figuren herauszubringen. Du tauschst sofort.'
        }
      },
      {
        san: 'cxd4',
        en: 'Take it. Your wing pawn comes into the middle and takes White’s centre pawn off the board.',
        de: 'Nimm ihn. Dein Flügelbauer kommt in die Mitte und holt den weißen Zentrumsbauern vom Brett.',
        why: {
          en: 'Your c-pawn swaps itself for White’s d-pawn. Now you have two centre pawns, d6 and e7, and White only one.',
          de: 'Dein c-Bauer tauscht sich gegen den weißen d-Bauern. Jetzt hast du zwei Zentrumsbauern, d6 und e7, und Weiß nur einen.'
        }
      },
      {
        san: 'Nxd4',
        en: 'White takes back with the knight. Look at the pawns now: you have two in the middle, White has one, and the c-file in front of your rook is open.',
        de: 'Weiß schlägt mit dem Springer zurück. Sieh dir jetzt die Bauern an: Du hast zwei in der Mitte, Weiß einen, und die c-Linie vor deinem Turm ist offen.',
        why: {
          en: 'The knight takes back and stands in the middle. White is ahead in development, you have the better pawns.',
          de: 'Der Springer nimmt zurück und steht in der Mitte. Weiß ist weiter entwickelt, du hast die besseren Bauern.'
        }
      },
      {
        san: 'Nf6',
        en: 'Develop, and attack the e4 pawn while you are at it. This is where d6 pays off: White cannot push past you with e5 to chase the knight away.',
        de: 'Entwickeln und dabei gleich den Bauern auf e4 angreifen. Hier zahlt sich d6 aus: Weiß kann nicht mit e5 vorbeischieben und den Springer verjagen.',
        why: {
          en: 'Developing with a threat: White has to spend the next move on the e4 pawn.',
          de: 'Entwickeln mit Drohung: Weiß muss den nächsten Zug für den Bauern auf e4 verwenden.'
        },
        threat: {
          en: 'Your knight attacks the e4 pawn, and nothing guards it.',
          de: 'Dein Springer greift den Bauern auf e4 an, und nichts deckt ihn.',
          arrows: ['f6e4']
        }
      },
      {
        san: 'Nc3',
        en: 'White has to look after that pawn, and this defends it while developing. Grabbing space with c4 instead would simply drop it to Nxe4.',
        de: 'Weiß muss sich um den Bauern kümmern: Dieser Zug deckt ihn und entwickelt zugleich. Stattdessen mit c4 Raum zu nehmen, würde ihn einfach an Sxe4 verlieren.',
        why: {
          en: 'The knight guards e4 and develops. White now has two knights out and a lead in development.',
          de: 'Der Springer deckt e4 und entwickelt sich. Weiß hat jetzt zwei Springer draußen und einen Entwicklungsvorsprung.'
        }
      },
      {
        san: 'g6',
        en: 'The dragon begins. The pawn prepares a bishop on g7, which will shoot along the long diagonal at the white centre and the b2 pawn.',
        de: 'Der Drache beginnt. Der Bauer bereitet einen Läufer auf g7 vor, der über die lange Diagonale auf das weiße Zentrum und den Bauern b2 schießt.',
        why: {
          en: 'A fianchetto: your bishop goes to g7 behind the g6 pawn. From there it looks across the whole board.',
          de: 'Ein Fianchetto: Dein Läufer kommt nach g7, hinter den Bauern g6. Von dort schaut er über das ganze Brett.'
        }
      },
      {
        san: 'Be3',
        en: 'White develops and prepares to castle queenside.',
        de: 'Weiß entwickelt sich und bereitet die lange Rochade vor.',
        why: {
          en: 'The bishop guards d4 and gets ready for the queen to d2 and the bishop to h6, to trade off your dragon bishop.',
          de: 'Der Läufer deckt d4 und bereitet Dame nach d2 und Läufer nach h6 vor, um deinen Drachenläufer abzutauschen.'
        }
      },
      {
        san: 'Bg7',
        en: 'The bishop arrives on its diagonal. It eyes the knight on d4 and everything behind it.',
        de: 'Der Läufer erreicht seine Diagonale. Er zielt auf den Springer auf d4 und alles dahinter.',
        why: {
          en: 'The dragon bishop is in place. It guards your king and works along the long diagonal.',
          de: 'Der Drachenläufer steht. Er schützt deinen König und wirkt die lange Diagonale entlang.'
        }
      },
      {
        san: 'f3',
        en: 'White supports the e4 pawn and makes room for a queen on d2. It also prepares g4 and h4 for an attack on your king.',
        de: 'Weiß stützt den Bauern auf e4 und schafft Platz für die Dame auf d2. Außerdem bereitet er g4 und h4 für einen Angriff auf deinen König vor.',
        why: {
          en: 'f3 stops your knight from jumping to g4 to hit the e3 bishop. It also prepares g4 to attack your king.',
          de: 'f3 verhindert, dass dein Springer nach g4 springt und den Läufer auf e3 angreift. Außerdem bereitet es g4 für den Angriff vor.'
        }
      },
      {
        san: 'O-O',
        en: 'You castle. Your king is safe behind the bishop, and your rook is ready for the f-file or the c-file.',
        de: 'Du rochierst. Dein König steht sicher hinter dem Läufer, und dein Turm ist bereit für die f- oder die c-Linie.',
        why: {
          en: 'Your king hides on g8, behind the dragon bishop. Now both sides race to attack.',
          de: 'Dein König versteckt sich auf g8, hinter dem Drachenläufer. Jetzt beginnt das Wettrennen der Angriffe.'
        }
      },
      {
        san: 'Qd2',
        en: 'White prepares Bh6 to trade your key bishop and then castles long. This is the Yugoslav Attack.',
        de: 'Weiß bereitet Lh6 vor, um deinen wichtigen Läufer zu tauschen, und rochiert dann lang. Das ist der Jugoslawische Angriff.',
        why: {
          en: 'Queen and bishop team up on the diagonal towards h6. White plans to castle on the queen side next.',
          de: 'Dame und Läufer arbeiten auf der Diagonale Richtung h6 zusammen. Weiß will als Nächstes lang rochieren.'
        },
        threat: {
          en: 'The bishop to h6 is next: White wants to swap off your dragon bishop, your king’s best guard.',
          de: 'Als Nächstes kommt der Läufer nach h6: Weiß will deinen Drachenläufer tauschen, die beste Wache deines Königs.',
          arrows: ['e3h6']
        }
      },
      {
        san: 'Nc6',
        en: 'You develop with tempo, since the knight attacks the one on d4. The race is on.',
        de: 'Du entwickelst mit Tempo, denn der Springer greift den auf d4 an. Der Wettlauf beginnt.',
        why: {
          en: 'Your knight develops and puts a second attacker on d4. Next your rooks aim at White’s king on the c-line.',
          de: 'Dein Springer entwickelt sich und greift d4 ein zweites Mal an. Danach zielen deine Türme über die c-Linie auf den weißen König.'
        }
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
    aims: {
      w: {
        en: 'Prepare d4 with c3 to get a full pawn centre, and avoid the sharp main Sicilian lines.',
        de: 'd4 mit c3 vorbereiten, um ein volles Bauernzentrum zu bekommen, und den scharfen Hauptlinien des Sizilianers ausweichen.'
      },
      b: {
        en: 'Hit back with d5 at once, use the queen in the centre where no knight can chase her, and develop quickly.',
        de: 'Sofort mit d5 zurückschlagen, die Dame in der Mitte nutzen, wo kein Springer sie jagt, und schnell entwickeln.'
      }
    },
    plans: [
      {
        en: 'Develop with the knights to f6 and c6, then e6 and the bishop to e7, and castle.',
        de: 'Entwickle die Springer nach f6 und c6, dann e6 und den Läufer nach e7, und rochiere.'
      },
      {
        en: 'Swap on d4 at the right moment and put pressure on the lonely pawn left there.',
        de: 'Tausche im richtigen Moment auf d4 und mach Druck auf den einsamen Bauern, der dort bleibt.'
      }
    ],
    traps: [
      {
        en: 'Count before you take: after the pawns swap on d4, your queen can not grab d4, because White’s queen guards it.',
        de: 'Erst zählen, dann schlagen: Nach dem Bauerntausch auf d4 darf deine Dame d4 nicht nehmen, denn die weiße Dame deckt ihn.',
        moves: '1. e4 c5 2. c3 d5 3. exd5 Qxd5 4. d4 cxd4 5. cxd4 Qxd4 6. Qxd4'
      }
    ],
    pgn: '1. e4 c5 2. c3 d5 3. exd5 Qxd5 4. d4 Nf6 5. Nf3 e6 6. Be2 Nc6 7. O-O Be7',
    moves: [
      {
        san: 'e4',
        en: 'White starts in the middle: the pawn grabs a centre square and frees the queen and the light-squared bishop.',
        de: 'Weiß beginnt in der Mitte: Der Bauer nimmt ein Zentrumsfeld und macht Dame und weißfeldrigen Läufer frei.',
        why: {
          en: 'Pawns in the middle give pieces room. White would love pawns on both e4 and d4, and your first move decides how you stop that.',
          de: 'Bauern in der Mitte geben Figuren Platz. Weiß hätte gern Bauern auf e4 und d4, und dein erster Zug entscheidet, wie du das verhinderst.'
        }
      },
      {
        san: 'c5',
        en: 'You do not copy White. You go sideways. This pawn covers d4 and offers a trade: your wing pawn for White’s centre pawn. It is worth knowing the catch: unlike e5, this move develops nothing, so White will get pieces out faster.',
        de: 'Du machst es Weiß nicht nach. Du gehst zur Seite. Dieser Bauer deckt d4 und bietet einen Tausch an: dein Flügelbauer gegen den Zentrumsbauern von Weiß. Der Haken gehört dazu: Anders als e5 entwickelt dieser Zug nichts, Weiß bekommt seine Figuren also schneller heraus.',
        why: {
          en: 'c5 fights for d4 from the side. If White plays d4, you swap a side pawn for a centre pawn.',
          de: 'c5 kämpft von der Seite um d4. Spielt Weiß d4, tauschst du einen Randbauern gegen einen Zentrumsbauern.'
        }
      },
      {
        san: 'c3',
        en: 'The Alapin. White wants to play d4 and have the pawn supported by c3, so it cannot simply be taken.',
        de: 'Die Alapin-Variante. Weiß will d4 spielen und den Bauern mit c3 stützen, damit er nicht einfach geschlagen werden kann.',
        why: {
          en: 'With c3, White prepares d4: if you take there, the c3 pawn takes back and White keeps two centre pawns.',
          de: 'Mit c3 bereitet Weiß d4 vor: Schlägst du dort, nimmt der Bauer c3 zurück und Weiß behält zwei Zentrumsbauern.'
        }
      },
      {
        san: 'd5',
        en: 'Strike at once. The pawn attacks e4, and White has to decide what to do before d4 comes.',
        de: 'Schlag sofort zu. Der Bauer greift e4 an, und Weiß muss sich entscheiden, bevor d4 kommt.',
        why: {
          en: 'Strike before d4 comes. With the c3 pawn in the way, no white knight can use c3 to chase your queen later.',
          de: 'Schlag zu, bevor d4 kommt. Weil der Bauer auf c3 steht, kann kein weißer Springer später über c3 deine Dame jagen.'
        },
        threat: {
          en: 'Your d5 pawn attacks e4, which nothing guards.',
          de: 'Dein Bauer auf d5 greift e4 an, und nichts deckt ihn.',
          arrows: ['d5e4']
        }
      },
      {
        san: 'exd5',
        en: 'White takes the pawn on d5.',
        de: 'Weiß schlägt den Bauern auf d5.',
        why: {
          en: 'White takes, so your pawn can not take on e4. Now your queen takes back.',
          de: 'Weiß schlägt, damit dein Bauer nicht auf e4 schlagen kann. Jetzt nimmt deine Dame zurück.'
        }
      },
      {
        san: 'Qxd5',
        en: 'You take back with the queen. The c3 pawn means White has no Nc3 to chase the queen away.',
        de: 'Du nimmst mit der Dame zurück. Wegen des Bauern auf c3 gibt es kein Sc3, das die Dame vertreiben könnte.',
        why: {
          en: 'The c3 pawn blocks the knight’s best square, so your queen is safe in the middle.',
          de: 'Der Bauer auf c3 blockiert das beste Feld des Springers, darum steht deine Dame sicher in der Mitte.'
        }
      },
      {
        san: 'd4',
        en: 'White takes the centre, now with a pawn supported by c3.',
        de: 'Weiß nimmt das Zentrum, jetzt mit einem Bauern, der von c3 gestützt wird.',
        why: {
          en: 'White builds the centre. The d4 pawn is guarded by the queen.',
          de: 'Weiß baut das Zentrum. Der Bauer auf d4 wird von der Dame gedeckt.'
        }
      },
      {
        san: 'Nf6',
        en: 'You develop with tempo, because the knight attacks the e4 square and supports your queen on d5.',
        de: 'Du entwickelst mit Tempo, denn der Springer kontrolliert e4 und unterstützt deine Dame auf d5.',
        why: {
          en: 'The knight develops and watches e4, so White can not push forward easily.',
          de: 'Der Springer entwickelt sich und bewacht e4, damit Weiß nicht leicht vorrücken kann.'
        }
      },
      {
        san: 'Nf3',
        en: 'White develops and guards d4.',
        de: 'Weiß entwickelt sich und deckt d4.',
        why: {
          en: 'White develops and adds a guard to d4.',
          de: 'Weiß entwickelt sich und gibt d4 eine weitere Wache.'
        }
      },
      {
        san: 'e6',
        en: 'You open the way for the dark-squared bishop and guard d5.',
        de: 'Du öffnest den Weg für den schwarzfeldrigen Läufer und deckst d5.',
        why: {
          en: 'e6 gives your queen on d5 a pawn guard and frees the f8 bishop.',
          de: 'e6 gibt deiner Dame auf d5 eine Bauernwache und befreit den Läufer auf f8.'
        }
      },
      {
        san: 'Be2',
        en: 'White develops the bishop and prepares to castle.',
        de: 'Weiß entwickelt den Läufer und bereitet die Rochade vor.',
        why: {
          en: 'A quiet developing move. White wants to castle quickly.',
          de: 'Ein ruhiger Entwicklungszug. Weiß will schnell rochieren.'
        }
      },
      {
        san: 'Nc6',
        en: 'Another attacker on d4, with the c5 pawn. The knight also develops with a plan.',
        de: 'Ein weiterer Angreifer auf d4, zusammen mit dem Bauern c5. Der Springer entwickelt sich außerdem mit Plan.',
        why: {
          en: 'Three of your pieces now hit d4: the c5 pawn, the knight and the queen. White must keep counting.',
          de: 'Jetzt greifen drei deiner Figuren d4 an: der Bauer c5, der Springer und die Dame. Weiß muss genau zählen.'
        }
      },
      {
        san: 'O-O',
        en: 'White castles.',
        de: 'Weiß rochiert.',
        why: {
          en: 'White’s king is safe. Next White may chase your queen with c4.',
          de: 'Der weiße König ist sicher. Als Nächstes kann Weiß deine Dame mit c4 jagen.'
        }
      },
      {
        san: 'Be7',
        en: 'You get ready to castle yourself. All your pieces are out, so the opening is done.',
        de: 'Du bereitest die eigene Rochade vor. Alle deine Figuren sind draußen, die Eröffnung ist geschafft.',
        why: {
          en: 'Your bishop clears the way for castling. With all pieces out, the opening is done.',
          de: 'Dein Läufer macht den Weg zur Rochade frei. Alle Figuren sind draußen, die Eröffnung ist geschafft.'
        }
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
    aims: {
      w: {
        en: 'Build a big centre with c4, d4 and e4, develop and gain space, then push on the queen side.',
        de: 'Mit c4, d4 und e4 ein großes Zentrum bauen, entwickeln und Platz gewinnen, dann am Damenflügel vorrücken.'
      },
      b: {
        en: 'Let White build the centre, castle, then hit it with e5 or c5 and attack on the king side.',
        de: 'Weiß das Zentrum bauen lassen, rochieren, dann mit e5 oder c5 angreifen und am Königsflügel attackieren.'
      }
    },
    plans: [
      {
        en: 'Castle first, then push e5 to fight for the centre.',
        de: 'Erst rochieren, dann mit e5 um die Mitte kämpfen.'
      },
      {
        en: 'If White closes the centre with d5, attack on the king side with f5.',
        de: 'Schließt Weiß die Mitte mit d5, greif am Königsflügel mit f5 an.'
      }
    ],
    traps: [
      {
        en: 'If White takes on e5 and swaps queens, then grabs e5 with the knight, your knight takes e4 and the g7 bishop wins the pawn back.',
        de: 'Schlägt Weiß auf e5, tauscht die Damen und schnappt e5 mit dem Springer, nimmt dein Springer auf e4 und der Läufer auf g7 holt den Bauern zurück.',
        moves: '1. d4 Nf6 2. c4 g6 3. Nc3 Bg7 4. e4 d6 5. Nf3 O-O 6. Be2 e5 7. dxe5 dxe5 8. Qxd8 Rxd8 9. Nxe5 Nxe4 10. Nxe4 Bxe5'
      }
    ],
    pgn: '1. d4 Nf6 2. c4 g6 3. Nc3 Bg7 4. e4 d6',
    moves: [
      {
        san: 'd4',
        en: 'White takes a centre square, covers c5 and e5, and opens a line for the queen’s bishop.',
        de: 'Weiß nimmt ein Zentrumsfeld, deckt c5 und e5 und öffnet eine Linie für den Damenläufer.',
        why: {
          en: 'A centre pawn guarded by the queen. White wants a big middle, and you will let it happen on purpose.',
          de: 'Ein Zentrumsbauer, gedeckt von der Dame. Weiß will eine große Mitte, und du lässt das absichtlich zu.'
        }
      },
      {
        san: 'Nf6',
        en: 'You control e4 with a piece instead of a pawn. Nothing is committed yet, and the knight watches the middle from a distance.',
        de: 'Du kontrollierst e4 mit einer Figur statt mit einem Bauern. Noch legst du dich auf nichts fest, und der Springer bewacht die Mitte aus der Ferne.',
        why: {
          en: 'The knight stops e4 for now and keeps your plans secret: you do not show your pawn setup yet.',
          de: 'Der Springer verhindert vorerst e4 und hält deine Pläne geheim: Du zeigst deinen Bauernaufbau noch nicht.'
        }
      },
      {
        san: 'c4',
        en: 'White takes more space and grips d5. Two big pawns now, and more coming.',
        de: 'Weiß nimmt mehr Raum und greift nach d5. Jetzt zwei große Bauern, und es kommen noch mehr.',
        why: {
          en: 'c4 adds a second pawn to the middle and fights for d5. White plans the knight to c3 and then e4.',
          de: 'c4 bringt einen zweiten Bauern in die Mitte und kämpft um d5. Weiß plant den Springer nach c3 und dann e4.'
        }
      },
      {
        san: 'g6',
        en: 'You make a little house for the bishop in the corner. From g7 it will look down the longest diagonal on the board, right at White’s centre.',
        de: 'Du baust dem Läufer ein kleines Haus in der Ecke. Von g7 schaut er die längste Diagonale des Brettes entlang, genau auf das weiße Zentrum.',
        why: {
          en: 'A fianchetto: your bishop will sit on g7 behind the g6 pawn. From there it looks across the whole board.',
          de: 'Ein Fianchetto: Dein Läufer kommt nach g7, hinter den Bauern g6. Von dort schaut er über das ganze Brett.'
        }
      },
      {
        san: 'Nc3',
        en: 'White develops and gets ready to push the last centre pawn to e4.',
        de: 'Weiß entwickelt sich und bereitet vor, den letzten Zentrumsbauern nach e4 zu ziehen.',
        why: {
          en: 'The knight backs up e4. Next move the e-pawn can come forward safely.',
          de: 'Der Springer unterstützt e4. Im nächsten Zug kann der e-Bauer sicher vorrücken.'
        }
      },
      {
        san: 'Bg7',
        en: 'Into the house. The bishop takes the long diagonal, and it does a second job too: after castling it is the piece standing guard in front of your king.',
        de: 'Ab ins Haus. Der Läufer übernimmt die lange Diagonale und hat noch eine zweite Aufgabe: Nach der Rochade ist er die Figur, die vor deinem König Wache steht.',
        why: {
          en: 'Your f6 knight blocks the bishop’s view for now. Once the knight moves, the bishop looks straight at d4 and b2.',
          de: 'Noch versperrt dein Springer auf f6 dem Läufer die Sicht. Zieht der Springer weg, schaut der Läufer direkt auf d4 und b2.'
        }
      },
      {
        san: 'e4',
        en: 'And there it is: three pawns in a row across the middle. It looks wonderful for White, and you allowed every bit of it.',
        de: 'Und da steht es: drei Bauern nebeneinander quer durch die Mitte. Für Weiß sieht das großartig aus, und du hast jedes bisschen davon zugelassen.',
        why: {
          en: 'Three pawns in the middle: c4, d4 and e4. White takes lots of space, exactly as you allowed.',
          de: 'Drei Bauern in der Mitte: c4, d4 und e4. Weiß nimmt sich viel Platz, genau wie du es zugelassen hast.'
        },
        threat: {
          en: 'White threatens to push e5 and kick your f6 knight away.',
          de: 'Weiß droht e5 und will deinen Springer auf f6 vertreiben.',
          arrows: ['e4e5']
        }
      },
      {
        san: 'd6',
        en: 'This little pawn does three things at once: it stops White playing e5 to kick your knight, it opens a line for your other bishop, and it gets e5 ready for you to push there yourself. That push is how you start taking the centre apart.',
        de: 'Dieser kleine Bauer erledigt drei Dinge auf einmal: Er verhindert e5, mit dem Weiß deinen Springer verjagen würde, er öffnet eine Linie für deinen anderen Läufer, und er macht e5 für deinen eigenen Vorstoß bereit. Mit diesem Vorstoß beginnst du, das Zentrum auseinanderzunehmen.',
        why: {
          en: 'd6 stops e5 and makes room for your c8 bishop. It also prepares your own push to e5.',
          de: 'd6 verhindert e5 und macht Platz für deinen Läufer auf c8. Außerdem bereitet es deinen eigenen Zug e5 vor.'
        }
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
    aims: {
      w: {
        en: 'Keep a big centre, castle, and after d5 attack on the queen side with b4 and c5.',
        de: 'Ein großes Zentrum halten, rochieren und nach d5 am Damenflügel mit b4 und c5 angreifen.'
      },
      b: {
        en: 'Castle, strike with e5, and after White pushes d5, attack the king with f5, f4 and g5.',
        de: 'Rochieren, mit e5 zuschlagen und nach dem weißen d5 den König mit f5, f4 und g5 angreifen.'
      }
    },
    plans: [
      {
        en: 'After d5, move the f6 knight away, for example to d7, and then push f5.',
        de: 'Nach d5 zieh den Springer von f6 weg, zum Beispiel nach d7, und spiel dann f5.'
      },
      {
        en: 'Push f5, f4 and g5: a pawn storm, which means pawns marching together towards the enemy king.',
        de: 'Spiel f5, f4 und g5: ein Bauernsturm, also Bauern, die gemeinsam auf den gegnerischen König zumarschieren.'
      }
    ],
    traps: [
      {
        en: 'If White takes on e5 and swaps queens, then grabs e5 with the knight, your knight takes e4 and the g7 bishop wins the pawn back.',
        de: 'Schlägt Weiß auf e5, tauscht die Damen und schnappt e5 mit dem Springer, nimmt dein Springer auf e4 und der Läufer auf g7 holt den Bauern zurück.',
        moves: '1. d4 Nf6 2. c4 g6 3. Nc3 Bg7 4. e4 d6 5. Nf3 O-O 6. Be2 e5 7. dxe5 dxe5 8. Qxd8 Rxd8 9. Nxe5 Nxe4 10. Nxe4 Bxe5'
      }
    ],
    pgn: '1. d4 Nf6 2. c4 g6 3. Nc3 Bg7 4. e4 d6 5. Nf3 O-O 6. Be2 e5 7. O-O Nc6 8. d5 Ne7',
    moves: [
      {
        san: 'd4',
        en: 'White takes a centre square, covers c5 and e5, and opens a line for the queen’s bishop.',
        de: 'Weiß nimmt ein Zentrumsfeld, deckt c5 und e5 und öffnet eine Linie für den Damenläufer.',
        why: {
          en: 'A centre pawn guarded by the queen. White wants a big middle, and you will let it happen on purpose.',
          de: 'Ein Zentrumsbauer, gedeckt von der Dame. Weiß will eine große Mitte, und du lässt das absichtlich zu.'
        }
      },
      {
        san: 'Nf6',
        en: 'You control e4 with a piece instead of a pawn. Nothing is committed yet, and the knight watches the middle from a distance.',
        de: 'Du kontrollierst e4 mit einer Figur statt mit einem Bauern. Noch legst du dich auf nichts fest, und der Springer bewacht die Mitte aus der Ferne.',
        why: {
          en: 'The knight stops e4 for now and keeps your plans secret: you do not show your pawn setup yet.',
          de: 'Der Springer verhindert vorerst e4 und hält deine Pläne geheim: Du zeigst deinen Bauernaufbau noch nicht.'
        }
      },
      {
        san: 'c4',
        en: 'White takes more space and grips d5. Two big pawns now, and more coming.',
        de: 'Weiß nimmt mehr Raum und greift nach d5. Jetzt zwei große Bauern, und es kommen noch mehr.',
        why: {
          en: 'c4 adds a second pawn to the middle and fights for d5. White plans the knight to c3 and then e4.',
          de: 'c4 bringt einen zweiten Bauern in die Mitte und kämpft um d5. Weiß plant den Springer nach c3 und dann e4.'
        }
      },
      {
        san: 'g6',
        en: 'You make a little house for the bishop in the corner. From g7 it will look down the longest diagonal on the board, right at White’s centre.',
        de: 'Du baust dem Läufer ein kleines Haus in der Ecke. Von g7 schaut er die längste Diagonale des Brettes entlang, genau auf das weiße Zentrum.',
        why: {
          en: 'A fianchetto: your bishop will sit on g7 behind the g6 pawn. From there it looks across the whole board.',
          de: 'Ein Fianchetto: Dein Läufer kommt nach g7, hinter den Bauern g6. Von dort schaut er über das ganze Brett.'
        }
      },
      {
        san: 'Nc3',
        en: 'White develops and gets ready to push the last centre pawn to e4.',
        de: 'Weiß entwickelt sich und bereitet vor, den letzten Zentrumsbauern nach e4 zu ziehen.',
        why: {
          en: 'The knight backs up e4. Next move the e-pawn can come forward safely.',
          de: 'Der Springer unterstützt e4. Im nächsten Zug kann der e-Bauer sicher vorrücken.'
        }
      },
      {
        san: 'Bg7',
        en: 'Into the house. The bishop takes the long diagonal, and it does a second job too: after castling it is the piece standing guard in front of your king.',
        de: 'Ab ins Haus. Der Läufer übernimmt die lange Diagonale und hat noch eine zweite Aufgabe: Nach der Rochade ist er die Figur, die vor deinem König Wache steht.',
        why: {
          en: 'Your f6 knight blocks the bishop’s view for now. Once the knight moves, the bishop looks straight at d4 and b2.',
          de: 'Noch versperrt dein Springer auf f6 dem Läufer die Sicht. Zieht der Springer weg, schaut der Läufer direkt auf d4 und b2.'
        }
      },
      {
        san: 'e4',
        en: 'And there it is: three pawns in a row across the middle. It looks wonderful for White, and you allowed every bit of it.',
        de: 'Und da steht es: drei Bauern nebeneinander quer durch die Mitte. Für Weiß sieht das großartig aus, und du hast jedes bisschen davon zugelassen.',
        why: {
          en: 'Three pawns in the middle: c4, d4 and e4. White takes lots of space, exactly as you allowed.',
          de: 'Drei Bauern in der Mitte: c4, d4 und e4. Weiß nimmt sich viel Platz, genau wie du es zugelassen hast.'
        },
        threat: {
          en: 'White threatens to push e5 and kick your f6 knight away.',
          de: 'Weiß droht e5 und will deinen Springer auf f6 vertreiben.',
          arrows: ['e4e5']
        }
      },
      {
        san: 'd6',
        en: 'This little pawn does three things at once: it stops White playing e5 to kick your knight, it opens a line for your other bishop, and it gets e5 ready for you to push there yourself. That push is how you start taking the centre apart.',
        de: 'Dieser kleine Bauer erledigt drei Dinge auf einmal: Er verhindert e5, mit dem Weiß deinen Springer verjagen würde, er öffnet eine Linie für deinen anderen Läufer, und er macht e5 für deinen eigenen Vorstoß bereit. Mit diesem Vorstoß beginnst du, das Zentrum auseinanderzunehmen.',
        why: {
          en: 'd6 stops e5 and makes room for your c8 bishop. It also prepares your own push to e5.',
          de: 'd6 verhindert e5 und macht Platz für deinen Läufer auf c8. Außerdem bereitet es deinen eigenen Zug e5 vor.'
        }
      },
      {
        san: 'Nf3',
        en: 'White develops a knight and guards d4 and e5.',
        de: 'Weiß entwickelt einen Springer und deckt d4 und e5.',
        why: {
          en: 'White develops calmly and guards d4 and e5. It also prepares castling.',
          de: 'Weiß entwickelt sich ruhig und deckt d4 und e5. Außerdem bereitet es die Rochade vor.'
        }
      },
      {
        san: 'O-O',
        en: 'You castle. Your king is safe behind the fianchetto bishop, and White’s big centre does not scare you yet.',
        de: 'Du rochierst. Dein König steht sicher hinter dem Fianchetto-Läufer, und das große weiße Zentrum schreckt dich noch nicht.',
        why: {
          en: 'Castling first is safe: your king hides behind the g7 bishop, and then you can hit the centre.',
          de: 'Zuerst rochieren ist sicher: Dein König versteckt sich hinter dem Läufer auf g7, dann kannst du die Mitte angreifen.'
        }
      },
      {
        san: 'Be2',
        en: 'A calm move that prepares castling.',
        de: 'Ein ruhiger Zug, der die Rochade vorbereitet.',
        why: {
          en: 'A quiet developing square. White’s king will castle next, and the centre stays strong.',
          de: 'Ein ruhiges Entwicklungsfeld. Der weiße König rochiert als Nächstes, und das Zentrum bleibt stark.'
        }
      },
      {
        san: 'e5',
        en: 'Here is the main idea: you let White build the centre and now you attack it. The pawn hits d4.',
        de: 'Hier ist die Hauptidee: Du lässt Weiß das Zentrum bauen und greifst es jetzt an. Der Bauer greift d4 an.',
        why: {
          en: 'Now you strike. The e5 pawn hits d4, and White must trade, push or defend.',
          de: 'Jetzt schlägst du zu. Der Bauer e5 greift d4 an, und Weiß muss tauschen, vorziehen oder decken.'
        }
      },
      {
        san: 'O-O',
        en: 'White castles and keeps the tension.',
        de: 'Weiß rochiert und hält die Spannung.',
        why: {
          en: 'White castles and keeps the tension. Taking on e5 now would only lead to an early queen trade.',
          de: 'Weiß rochiert und hält die Spannung. Auf e5 zu schlagen würde jetzt nur zu einem frühen Damentausch führen.'
        }
      },
      {
        san: 'Nc6',
        en: 'You add more pressure on d4. White has to decide what to do with the pawn.',
        de: 'Du erhöhst den Druck auf d4. Weiß muss sich entscheiden, was er mit dem Bauern tut.',
        why: {
          en: 'A second attacker on d4. White must decide now: guard it again, trade or push d5.',
          de: 'Ein zweiter Angreifer auf d4. Weiß muss sich jetzt entscheiden: noch einmal decken, tauschen oder d5 ziehen.'
        }
      },
      {
        san: 'd5',
        en: 'White pushes the pawn, closes the centre and gains space. Your knight must move.',
        de: 'Weiß schiebt den Bauern vor, schließt das Zentrum und gewinnt Raum. Dein Springer muss ziehen.',
        why: {
          en: 'Pushing closes the centre and gains space. Now the game moves to the sides: White on the queen side, you on the king side.',
          de: 'Der Vorstoß schließt die Mitte und gewinnt Platz. Jetzt geht es an den Flügeln weiter: Weiß am Damenflügel, du am Königsflügel.'
        },
        threat: {
          en: 'The d5 pawn attacks your c6 knight. It has to move.',
          de: 'Der Bauer auf d5 greift deinen Springer auf c6 an. Er muss weg.',
          arrows: ['d5c6']
        }
      },
      {
        san: 'Ne7',
        en: 'The knight steps back, but it is not passive. From here it supports ...f5, which is your plan for a kingside attack.',
        de: 'Der Springer weicht aus, aber er ist nicht passiv. Von hier unterstützt er ...f5, deinen Plan für den Angriff am Königsflügel.',
        why: {
          en: 'From e7 the knight helps f5 and can go to g6 later. Your plan: f5 and an attack on White’s king.',
          de: 'Von e7 hilft der Springer bei f5 und kann später nach g6. Dein Plan: f5 und ein Angriff auf den weißen König.'
        }
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
    aims: {
      w: {
        en: 'Hold e4 with f3, play the bishop to e3 and the queen to d2, castle on the queen side, then storm your king with g4 and h4.',
        de: 'e4 mit f3 halten, Läufer nach e3 und Dame nach d2, lang rochieren und dann deinen König mit g4 und h4 bestürmen.'
      },
      b: {
        en: 'Castle early and break the centre with e5, c6 and d5 before White’s attack starts.',
        de: 'Früh rochieren und die Mitte mit e5, c6 und d5 aufbrechen, bevor der weiße Angriff beginnt.'
      }
    },
    plans: [
      {
        en: 'Prepare d5 with c6: a pawn push that opens the centre while White’s king still stands there.',
        de: 'Bereite d5 mit c6 vor: ein Bauernzug, der die Mitte öffnet, während der weiße König noch dort steht.'
      },
      {
        en: 'If White castles on the queen side, attack it with b5.',
        de: 'Rochiert Weiß lang, greif mit b5 an.'
      }
    ],
    traps: [
      {
        en: 'If White swaps on e5 and trades queens, watch the knight jump to d5: it attacks c7 and your f6 knight. Take it with your knight.',
        de: 'Tauscht Weiß auf e5 und dann die Damen, pass auf den Springersprung nach d5 auf: Er greift c7 und deinen Springer auf f6 an. Nimm ihn mit deinem Springer.',
        moves: '1. d4 Nf6 2. c4 g6 3. Nc3 Bg7 4. e4 d6 5. f3 O-O 6. Be3 e5 7. dxe5 dxe5 8. Qxd8 Rxd8 9. Nd5'
      }
    ],
    pgn: '1. d4 Nf6 2. c4 g6 3. Nc3 Bg7 4. e4 d6 5. f3 O-O 6. Be3 e5 7. Nge2 c6',
    moves: [
      {
        san: 'd4',
        en: 'White takes a centre square, covers c5 and e5, and opens a line for the queen’s bishop.',
        de: 'Weiß nimmt ein Zentrumsfeld, deckt c5 und e5 und öffnet eine Linie für den Damenläufer.',
        why: {
          en: 'A centre pawn guarded by the queen. White wants a big middle, and you will let it happen on purpose.',
          de: 'Ein Zentrumsbauer, gedeckt von der Dame. Weiß will eine große Mitte, und du lässt das absichtlich zu.'
        }
      },
      {
        san: 'Nf6',
        en: 'You control e4 with a piece instead of a pawn. Nothing is committed yet, and the knight watches the middle from a distance.',
        de: 'Du kontrollierst e4 mit einer Figur statt mit einem Bauern. Noch legst du dich auf nichts fest, und der Springer bewacht die Mitte aus der Ferne.',
        why: {
          en: 'The knight stops e4 for now and keeps your plans secret: you do not show your pawn setup yet.',
          de: 'Der Springer verhindert vorerst e4 und hält deine Pläne geheim: Du zeigst deinen Bauernaufbau noch nicht.'
        }
      },
      {
        san: 'c4',
        en: 'White takes more space and grips d5. Two big pawns now, and more coming.',
        de: 'Weiß nimmt mehr Raum und greift nach d5. Jetzt zwei große Bauern, und es kommen noch mehr.',
        why: {
          en: 'c4 adds a second pawn to the middle and fights for d5. White plans the knight to c3 and then e4.',
          de: 'c4 bringt einen zweiten Bauern in die Mitte und kämpft um d5. Weiß plant den Springer nach c3 und dann e4.'
        }
      },
      {
        san: 'g6',
        en: 'You make a little house for the bishop in the corner. From g7 it will look down the longest diagonal on the board, right at White’s centre.',
        de: 'Du baust dem Läufer ein kleines Haus in der Ecke. Von g7 schaut er die längste Diagonale des Brettes entlang, genau auf das weiße Zentrum.',
        why: {
          en: 'A fianchetto: your bishop will sit on g7 behind the g6 pawn. From there it looks across the whole board.',
          de: 'Ein Fianchetto: Dein Läufer kommt nach g7, hinter den Bauern g6. Von dort schaut er über das ganze Brett.'
        }
      },
      {
        san: 'Nc3',
        en: 'White develops and gets ready to push the last centre pawn to e4.',
        de: 'Weiß entwickelt sich und bereitet vor, den letzten Zentrumsbauern nach e4 zu ziehen.',
        why: {
          en: 'The knight backs up e4. Next move the e-pawn can come forward safely.',
          de: 'Der Springer unterstützt e4. Im nächsten Zug kann der e-Bauer sicher vorrücken.'
        }
      },
      {
        san: 'Bg7',
        en: 'Into the house. The bishop takes the long diagonal, and it does a second job too: after castling it is the piece standing guard in front of your king.',
        de: 'Ab ins Haus. Der Läufer übernimmt die lange Diagonale und hat noch eine zweite Aufgabe: Nach der Rochade ist er die Figur, die vor deinem König Wache steht.',
        why: {
          en: 'Your f6 knight blocks the bishop’s view for now. Once the knight moves, the bishop looks straight at d4 and b2.',
          de: 'Noch versperrt dein Springer auf f6 dem Läufer die Sicht. Zieht der Springer weg, schaut der Läufer direkt auf d4 und b2.'
        }
      },
      {
        san: 'e4',
        en: 'And there it is: three pawns in a row across the middle. It looks wonderful for White, and you allowed every bit of it.',
        de: 'Und da steht es: drei Bauern nebeneinander quer durch die Mitte. Für Weiß sieht das großartig aus, und du hast jedes bisschen davon zugelassen.',
        why: {
          en: 'Three pawns in the middle: c4, d4 and e4. White takes lots of space, exactly as you allowed.',
          de: 'Drei Bauern in der Mitte: c4, d4 und e4. Weiß nimmt sich viel Platz, genau wie du es zugelassen hast.'
        },
        threat: {
          en: 'White threatens to push e5 and kick your f6 knight away.',
          de: 'Weiß droht e5 und will deinen Springer auf f6 vertreiben.',
          arrows: ['e4e5']
        }
      },
      {
        san: 'd6',
        en: 'This little pawn does three things at once: it stops White playing e5 to kick your knight, it opens a line for your other bishop, and it gets e5 ready for you to push there yourself. That push is how you start taking the centre apart.',
        de: 'Dieser kleine Bauer erledigt drei Dinge auf einmal: Er verhindert e5, mit dem Weiß deinen Springer verjagen würde, er öffnet eine Linie für deinen anderen Läufer, und er macht e5 für deinen eigenen Vorstoß bereit. Mit diesem Vorstoß beginnst du, das Zentrum auseinanderzunehmen.',
        why: {
          en: 'd6 stops e5 and makes room for your c8 bishop. It also prepares your own push to e5.',
          de: 'd6 verhindert e5 und macht Platz für deinen Läufer auf c8. Außerdem bereitet es deinen eigenen Zug e5 vor.'
        }
      },
      {
        san: 'f3',
        en: 'The Sämisch. The pawn supports e4 for good and makes room for the dark-squared bishop on e3.',
        de: 'Die Sämisch-Variante. Der Bauer stützt e4 dauerhaft und schafft Platz für den schwarzfeldrigen Läufer auf e3.',
        why: {
          en: 'f3 guards e4 with a pawn, so it is very hard to attack. But now the g1 knight can not use f3.',
          de: 'f3 deckt e4 mit einem Bauern, so ist er kaum anzugreifen. Aber jetzt kann der Springer von g1 nicht nach f3.'
        }
      },
      {
        san: 'O-O',
        en: 'You castle first. Your king is safe, and you can see what White plans.',
        de: 'Du rochierst zuerst. Dein König ist sicher, und du siehst, was Weiß vorhat.',
        why: {
          en: 'Castle early: your king is safe, and you can see what White plans.',
          de: 'Früh rochieren: Dein König ist sicher, und du siehst, was Weiß vorhat.'
        }
      },
      {
        san: 'Be3',
        en: 'White develops the bishop and eyes queenside castling with Qd2.',
        de: 'Weiß entwickelt den Läufer und plant mit Dd2 die lange Rochade.',
        why: {
          en: 'The bishop develops and prepares the queen to d2. Later the bishop to h6 could trade your g7 bishop.',
          de: 'Der Läufer entwickelt sich und bereitet die Dame nach d2 vor. Später könnte der Läufer nach h6 deinen Läufer auf g7 tauschen.'
        }
      },
      {
        san: 'e5',
        en: 'You strike at the centre at once. White’s setup is strong but it also has no pressure on e5.',
        de: 'Du greifst sofort das Zentrum an. Der weiße Aufbau ist stark, aber er übt keinen Druck auf e5 aus.',
        why: {
          en: 'Hit the centre right away. If you wait, White castles on the queen side and storms your king.',
          de: 'Greif die Mitte sofort an. Wartest du, rochiert Weiß lang und bestürmt deinen König.'
        }
      },
      {
        san: 'Nge2',
        en: 'The knight goes to e2 because f3 is taken by the pawn. It keeps the f-pawn free for later.',
        de: 'Der Springer geht nach e2, weil f3 vom Bauern besetzt ist. So bleibt der f-Bauer für später frei.',
        why: {
          en: 'The knight can not go to f3, where White’s own pawn stands. On e2 it guards d4 and c3.',
          de: 'Der Springer kann nicht nach f3, wo der eigene Bauer steht. Auf e2 deckt er d4 und c3.'
        }
      },
      {
        san: 'c6',
        en: 'A flexible move. It prepares ...d5 to break the centre and takes b5 and d5 under watch.',
        de: 'Ein flexibler Zug. Er bereitet ...d5 vor, um das Zentrum aufzubrechen, und behält b5 und d5 im Blick.',
        why: {
          en: 'c6 prepares d5 to break the centre, and it takes d5 and b5 away from White’s knights.',
          de: 'c6 bereitet d5 vor, um die Mitte aufzubrechen, und nimmt den weißen Springern d5 und b5 weg.'
        }
      }
    ],
    ending: {
      en: 'The position is solid, and you have played ...e5 and ...c6, so your pieces are ready for ...d5. White plans queenside castling and a pawn storm with g4 and h4. You need to act fast in the centre, because a slow game helps White. Keep the idea in mind: strike before the attack arrives.',
      de: 'Die Stellung ist solide, du hast ...e5 und ...c6 gespielt, und deine Figuren sind bereit für ...d5. Weiß plant lange Rochade und einen Bauernsturm mit g4 und h4. Du musst im Zentrum schnell handeln, denn ein langsames Spiel hilft Weiß. Merk dir den Gedanken: zuschlagen, bevor der Angriff kommt.'
    }
  }
];

export const lineById = (id) => LINES.find((l) => l.id === id) || null;
