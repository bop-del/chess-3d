import { defineConfig } from 'vite';
import { execSync } from 'node:child_process';
import { createHash } from 'node:crypto';
import { readFileSync, readdirSync, statSync, writeFileSync } from 'node:fs';
import { join, relative } from 'node:path';

// The version line (src/version.js): the version comes from package.json. A build with CHESS_RELEASE=1 (the Pages workflow sets it)
// shows just that, v1.6.0. Every other build (dev, preview, test, a fresh copy) adds the short commit, v1.6.0 · 97277ff, or nothing
// extra when there is no git checkout.
const VERSION = JSON.parse(readFileSync(new URL('./package.json', import.meta.url), 'utf8')).version;
let COMMIT = '';
if (process.env.CHESS_RELEASE !== '1') {
  try { COMMIT = execSync('git rev-parse --short HEAD', { stdio: ['ignore', 'pipe', 'ignore'] }).toString().trim(); } catch (e) { /* not a checkout */ }
}

// Offline cache (CHE-304): after the build, public/sw.js gets the build id (a hash over the file list and sizes of the output, whose
// asset names carry content hashes) and the list of files to precache. A new build gives a new sw.js, which is how the browser sees a release.
function swPrecache() {
  let outDir = 'dist';
  const walk = (d) => readdirSync(d).flatMap((n) => (statSync(join(d, n)).isDirectory() ? walk(join(d, n)) : [join(d, n)]));
  return {
    name: 'sw-precache', apply: 'build',
    configResolved(c) { outDir = c.build.outDir; },
    closeBundle() {
      const files = walk(outDir).map((f) => relative(outDir, f)).filter((f) => !/^(sw\.js|CNAME|og-image\.png|auth-spike\.html)$/.test(f)).sort();
      const id = createHash('sha1').update(files.map((f) => f + ':' + (/^assets\//.test(f) ? '' : readFileSync(join(outDir, f)).toString('base64'))).join('\n') + VERSION).digest('hex').slice(0, 10);
      const list = ['./', ...files.map((f) => './' + f)];
      const p = join(outDir, 'sw.js');
      writeFileSync(p, readFileSync(p, 'utf8').replace("'dev'; /* BUILD */", `'${id}';`).replace('[/* PRECACHE */]', JSON.stringify(list)));
    },
  };
}

// base './' keeps every asset URL relative, so the build works from any sub path
// (for example https://bop-del.github.io/chess-3d/) as well as from a domain root.
export default defineConfig({
  base: './',
  plugins: [swPrecache()],
  define: {
    __APP_VERSION__: JSON.stringify(VERSION), __APP_COMMIT__: JSON.stringify(COMMIT),
    // online play (CHE-326): a release build (CHESS_RELEASE=1) uses the live server without ?online=, dev and test builds none
    __SW_DEFAULT__: JSON.stringify(process.env.CHESS_RELEASE === '1'),   // the offline cache: on in a release build, ?sw=1 turns it on elsewhere
    // CHESS_ONLINE_DEFAULT=<url> (CHE-416) sets the same default without the release build or the service worker: the device preview builds use it
    __ONLINE_DEFAULT__: JSON.stringify(process.env.CHESS_RELEASE === '1' ? 'https://chess.borisdiebold.com' : (process.env.CHESS_ONLINE_DEFAULT || '')),
  },
  build: { target: 'safari15', chunkSizeWarningLimit: 1400 },
});
