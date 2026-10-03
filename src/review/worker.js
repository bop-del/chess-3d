// Worker: the game review engine. In { type: 'analyze', id, fens, depth } answers { type: 'pos', id, index, result } per position and
// { type: 'done', id }; { type: 'cancel' } stops the run; { type: 'line', id, fen, first, plies } answers { type: 'line', id, san }.
import { analyzeMany, bestLine } from './analyze.js';

let run = 0;
self.onmessage = async (e) => {
  const d = e.data;
  if (d.type === 'cancel') { run++; return; }
  if (d.type === 'line') { self.postMessage({ type: 'line', id: d.id, san: bestLine(d.fen, d.first, d.plies) }); return; }
  if (d.type !== 'analyze') return;
  const mine = ++run;
  const ok = await analyzeMany(d.fens, {
    depth: d.depth,
    shouldStop: () => mine !== run,
    onPosition: (index, result) => self.postMessage({ type: 'pos', id: d.id, index, result }),
  });
  if (ok) self.postMessage({ type: 'done', id: d.id });
};
