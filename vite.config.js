import { defineConfig } from 'vite';
import { readFileSync } from 'node:fs';
import { execSync } from 'node:child_process';

// The version line (src/version.js): the version comes from package.json. A build with CHESS_RELEASE=1 (the Pages workflow sets it)
// shows just that, v1.6.0. Every other build (dev, preview, test, a fresh copy) adds the short commit, v1.6.0 · 97277ff, or nothing
// extra when there is no git checkout.
const VERSION = JSON.parse(readFileSync(new URL('./package.json', import.meta.url), 'utf8')).version;
let COMMIT = '';
if (process.env.CHESS_RELEASE !== '1') {
  try { COMMIT = execSync('git rev-parse --short HEAD', { stdio: ['ignore', 'pipe', 'ignore'] }).toString().trim(); } catch (e) { /* not a checkout */ }
}

// base './' keeps every asset URL relative, so the build works from any sub path
// (for example https://bop-del.github.io/chess-3d/) as well as from a domain root.
export default defineConfig({
  base: './',
  define: {
    __APP_VERSION__: JSON.stringify(VERSION), __APP_COMMIT__: JSON.stringify(COMMIT),
    // online play (CHE-326): a release build (CHESS_RELEASE=1) uses the live server without ?online=, dev and test builds none
    __ONLINE_DEFAULT__: JSON.stringify(process.env.CHESS_RELEASE === '1' ? 'https://chess.borisdiebold.com' : ''),
  },
  build: { target: 'safari15', chunkSizeWarningLimit: 1400 },
});
