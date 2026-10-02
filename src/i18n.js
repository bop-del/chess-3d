// Interface language. CONTRACT stub (lead): t() returns the fallback until the Openings lane's i18n agent fills in
// English and German strings. Keys are dotted, for example 'hud.newGame' or 'explain.next'.
let language = 'en';
const listeners = [];

export function t(key, fallback = key) { return fallback; }
export function setLanguage(lang) {
  language = lang === 'de' ? 'de' : 'en';
  listeners.forEach((fn) => fn(language));
}
export function onLanguage(fn) { listeners.push(fn); }
export const i18n = { get language() { return language; } };
