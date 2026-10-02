// The numbers in Drill that nobody has measured. They live here, apart from the constants that were argued for or
// measured, so they are not mistaken for either. Each carries the observation that would show it is wrong: a sentence
// about what the player would have to do, never a count. Whether they survive a real child is judged by playing with one.
import { LADDER_H } from './ladder.js';

export const SESSION_CARDS = 12;     // quizzed positions in one scheduled session, counted at line boundaries

export const GUESSES = [
  {
    name: 'ladder first interval',
    value: `${LADDER_H[0]} hours`,
    wrongIf: 'He is asked the same position twice in one sitting and it feels like a loop rather than practice.',
  },
  {
    name: 'ladder intervals',
    value: LADDER_H.map((h) => `${h} h`).join(', '),
    wrongIf: 'He plays a position he has answered right many times and finds it asked again so soon that he stops caring about it, or he returns after a long gap and finds he has lost a line the ladder said he knew.',
  },
  {
    name: 'demotion by two levels on a miss',
    value: 'two levels, never below 1',
    wrongIf: 'A single slip drops him far enough that a line he mostly knows feels new again.',
  },
  {
    name: 'session length',
    value: `${SESSION_CARDS} positions`,
    wrongIf: 'He stops partway through, more than once, without being interrupted.',
  },
];
