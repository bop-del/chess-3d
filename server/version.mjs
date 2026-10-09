// The API number of this server (CHE-405, docs/ARCHITECTURE.md "API version"). A number, not a commit: bumped only by a change that
// breaks old clients, so a frontend only release never alarms. GET /version answers { api, minClient, commit }.
//   API        what this server speaks (1: games list in /state, CHE-335)
//   MIN_CLIENT the lowest client API this server still serves (a client below it must reload to a newer page)
export const API = 1;
export const MIN_CLIENT = 1;

/** the commit comes from the container env: Kamal sets KAMAL_VERSION (deploy.sh passes the short sha as --version) */
export const versionInfo = (env = process.env) => ({ api: API, minClient: MIN_CLIENT, commit: String(env.KAMAL_VERSION || env.ONLINE_COMMIT || '').slice(0, 40) });
