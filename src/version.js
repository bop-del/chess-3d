// The version of this build (see vite.config.js): VERSION is the package.json version, COMMIT the short commit of a non release build
// (empty on the live page), LABEL the text of the version line: v1.6.0 or v1.6.0 · 97277ff.
export const VERSION = typeof __APP_VERSION__ === 'string' ? __APP_VERSION__ : '0.0.0';
export const COMMIT = typeof __APP_COMMIT__ === 'string' ? __APP_COMMIT__ : '';
export const LABEL = `v${VERSION}${COMMIT ? ` · ${COMMIT}` : ''}`;
