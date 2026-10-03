// The review engine seen from the page: a Web Worker running worker.js, or the same code time sliced on the main thread when
// Workers are not there. analyze(fens, { onPosition, onDone }) returns a cancel function; line(fen, first) a promise of SAN moves.
import { analyzeMany, bestLine } from './analyze.js';

export function createEngine({ useWorker = true } = {}) {
  let worker = null;
  if (useWorker && typeof Worker === 'function') {
    try { worker = new Worker(new URL('./worker.js', import.meta.url), { type: 'module' }); } catch (e) { worker = null; }
  }
  let id = 0;
  const handlers = new Map();   // request id -> fn(message)
  if (worker) {
    worker.onmessage = (e) => handlers.get(e.data.id)?.(e.data);
    worker.onerror = () => { /* the review keeps what it has */ };
  }
  let stop = null;

  function analyze(fens, { depth, onPosition, onDone }) {
    const mine = ++id;
    stop?.();
    if (worker) {
      handlers.set(mine, (m) => {
        if (m.type === 'pos') onPosition(m.index, m.result);
        else if (m.type === 'done') { handlers.delete(mine); onDone?.(); }
      });
      worker.postMessage({ type: 'analyze', id: mine, fens, depth });
      stop = () => { handlers.delete(mine); worker.postMessage({ type: 'cancel' }); };
    } else {
      let cancelled = false;
      analyzeMany(fens, { depth, onPosition, shouldStop: () => cancelled, sliceMs: 8 }).then((ok) => { if (ok) onDone?.(); });
      stop = () => { cancelled = true; };
    }
    return stop;
  }

  function line(fen, first, plies = 4) {
    if (!worker) return Promise.resolve(bestLine(fen, first, plies));
    const mine = ++id;
    return new Promise((resolve) => {
      handlers.set(mine, (m) => { handlers.delete(mine); resolve(m.san); });
      worker.postMessage({ type: 'line', id: mine, fen, first, plies });
    });
  }

  return { analyze, line, cancel: () => { stop?.(); stop = null; }, get worker() { return !!worker; }, dispose() { stop?.(); worker?.terminate(); } };
}
