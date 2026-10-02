// Worker: generates one board texture set off the main thread. In { id, key, cap }, out { id, res } with transferred buffers.
import { runJob } from './texture-gen.js';

self.onmessage = (e) => {
  const { id, key, cap } = e.data;
  try {
    const res = runJob(key, cap);
    const bufs = [res.color.buffer, res.normal.buffer, res.rough.buffer];
    if (res.metal) bufs.push(res.metal.buffer);
    self.postMessage({ id, res }, bufs);
  } catch (err) { self.postMessage({ id, error: String(err && err.message || err) }); }
};
