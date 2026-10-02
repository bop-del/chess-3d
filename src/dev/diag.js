// On device diagnostics overlay for ?diag=1: a small monospace box, readable on the phone itself (no Web Inspector).
// main.js imports this file only when the parameter is exactly "1", so with the flag off nothing is loaded, drawn or sampled.
//   collapsed   one line: fps, frame p95, quality tier
//   expanded    fps, frame ms p50 / p95 / max over the last 5 s, quality tier, pixel ratio, canvas size, draw calls,
//               an estimated GPU memory figure, touch mode. One tap on the box switches between the two.
// Frame times come from the diag's own requestAnimationFrame loop (the wall clock interval between frames), so the app's
// render loop is not touched. The loop is stopped by dispose().
import { device } from '../device.js';

// Share of the canvas size used by the planar floor reflection target per tier (src/scene.js QUALITY.*.reflection).
const REFLECTION = { high: 0.5, medium: 0.3, low: 0 };
const MB = 1024 * 1024;

export function initDiag({ stage }) {
  const renderer = stage.renderer;
  const gl = renderer.getContext();
  const frames = [];            // [timestamp, interval ms] of the last 5 s
  let last = 0, lastDraw = 0, raf = 0, expanded = false;

  const pct = (sorted, f) => (sorted.length ? sorted[Math.min(sorted.length - 1, Math.floor(sorted.length * f))] : 0);
  const sortedMs = () => frames.map((f) => f[1]).sort((a, b) => a - b);

  // Rough sum of the large GPU allocations: drawing buffer (colour plus depth), the two post chain targets (half float, plus
  // the multisample copy on High), the shadow map and the reflection target. Textures and geometry are added from
  // renderer.info counts as a flat guess. An estimate to compare tiers and devices, not a measurement.
  const estimateMB = () => {
    const w = gl.drawingBufferWidth, h = gl.drawingBufferHeight;
    let bytes = w * h * 8;
    const c = stage.composer;
    if (c) bytes += 2 * w * h * 8 * (c.renderTarget1?.samples ? 1 + c.renderTarget1.samples : 1);
    const sm = stage.lights.key.shadow.mapSize;
    bytes += sm.x * sm.y * 4;
    const rf = REFLECTION[stage.quality] || 0;
    bytes += w * h * rf * rf * 8;
    const mem = renderer.info.memory;
    bytes += mem.textures * 0.5 * MB + mem.geometries * 0.1 * MB;
    return bytes / MB;
  };

  const box = document.createElement('div');
  box.id = 'diag';
  box.style.cssText = 'position:fixed;left:calc(env(safe-area-inset-left, 0px) + 6px);bottom:calc(env(safe-area-inset-bottom, 0px) + 72px);' +
    'z-index:9998;max-width:calc(100vw - 12px);min-width:150px;padding:5px 8px;font:11px/1.4 ui-monospace,Menlo,monospace;color:#dff;' +
    'background:rgba(0,0,0,.86);border:1px solid rgba(70,230,210,.6);border-radius:6px;white-space:pre-wrap;pointer-events:auto;' +
    'touch-action:manipulation;user-select:none;-webkit-user-select:none;';
  box.addEventListener('pointerdown', (e) => e.stopPropagation());
  box.addEventListener('pointerup', (e) => { e.stopPropagation(); expanded = !expanded; draw(); });
  document.body.appendChild(box);

  function lines() {
    const s = sortedMs();
    const avg = s.length ? s.reduce((a, b) => a + b, 0) / s.length : 0;
    const info = renderer.info.render;
    const touch = device.touch ? `touch${device.phone ? ' phone' : ''}${device.ios ? ' ios' : ''}${device.standalone ? ' standalone' : ''}` : 'pointer';
    return {
      short: `${avg ? (1000 / avg).toFixed(0) : '0'} fps  p95 ${pct(s, 0.95).toFixed(0)}ms  ${stage.quality}${window.__chessBoot?.first ? `  start ${(window.__chessBoot.first / 1000).toFixed(1)}s` : ''}`,
      full: [
        `fps: ${avg ? (1000 / avg).toFixed(1) : '0'}`,
        `frame ms: p50 ${pct(s, 0.5).toFixed(1)}  p95 ${pct(s, 0.95).toFixed(1)}  max ${pct(s, 1).toFixed(0)}`,
        `quality: ${stage.quality}${stage.composer ? '' : ' (no post)'}`,
        `pixel ratio: ${renderer.getPixelRatio()} of dpr ${(window.devicePixelRatio || 1).toFixed(2)}`,
        `canvas: ${gl.drawingBufferWidth}x${gl.drawingBufferHeight}  css ${innerWidth}x${innerHeight}`,
        `draw: ${info.calls} calls  ${(info.triangles / 1000).toFixed(0)}k tris`,
        `gpu mem: ~${estimateMB().toFixed(0)} MB (est.)`,
        `input: ${touch}`,
        bootLine(),
      ].join('\n'),
    };
  }

  // start timings recorded by main.js (ms since navigation): pieces built, first frame shown, first render (shader compile)
  function bootLine() {
    const b = window.__chessBoot;
    if (!b || !b.first) return 'start: measuring';
    return `start: script ${(b.script / 1000).toFixed(1)}s  pieces ${(b.pieces / 1000).toFixed(1)}s  first frame ${(b.first / 1000).toFixed(1)}s  (render ${(b.render / 1000).toFixed(1)}s, ${b.programs} programs)`;
  }

  function draw() {
    lastDraw = performance.now();
    try {
      const l = lines();
      box.textContent = expanded ? l.full : l.short;
    } catch (e) { box.textContent = 'diag error'; }
  }

  function tick(now) {
    if (last) {
      const ms = now - last;
      if (ms < 5000) frames.push([now, ms]);
    }
    last = now;
    while (frames.length && now - frames[0][0] > 5000) frames.shift();
    if (now - lastDraw > 500) draw();
    raf = requestAnimationFrame(tick);
  }
  draw();
  raf = requestAnimationFrame(tick);

  return { box, draw, dispose() { cancelAnimationFrame(raf); box.remove(); } };
}
