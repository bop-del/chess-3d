// The audit planner's rules (tools/audit-plan.mjs): which file changes make which audits due.
// Run: node test/audit-plan.mjs    Exit 0 when every case holds, 1 otherwise.
import { plan, bumpKind, commands, versionOnly } from '../tools/audit-plan.mjs';

const cases = [];
const check = (name, ok) => cases.push({ name, ok: !!ok });
const due = (p) => ['smoke', 'visual', 'device', 'review', 'ci'].filter((k) => p[k].due).join(' ') || 'none';

check('docs only: fast and release check, nothing else', due(plan(['README.md', 'docs/ARCHITECTURE.md'])) === 'none');
check('rules engine: smoke, no visual or device', due(plan(['src/rules.js'])) === 'smoke');
check('stylesheet: smoke, visual and device', due(plan(['src/style.css'])) === 'smoke visual device');
check('controls: smoke and device, not visual', due(plan(['src/controls.js'])) === 'smoke device');
check('a piece builder: smoke and visual', due(plan(['src/pieces/setA.js'])) === 'smoke visual');
check('workflow: ci only', due(plan(['.github/workflows/pages.yml'])) === 'ci');
check('lock file: full release check with npm ci', plan(['package-lock.json']).release.fullInstall);
check('no lock change: release check may skip the install', !plan(['src/ui.js']).release.fullInstall);
check('package.json with only a version change: no forced fresh install, and the plan says so', !plan(['package.json'], 'patch', { pkgVersionOnly: true }).release.fullInstall && /version/.test(plan(['package.json'], 'patch', { pkgVersionOnly: true }).release.why));
check('package.json with other changes: full install', plan(['package.json'], 'patch', { pkgVersionOnly: false }).release.fullInstall);
check('version only and a lock change: full install', plan(['package.json', 'package-lock.json'], 'patch', { pkgVersionOnly: true }).release.fullInstall);
check('versionOnly compares everything but the version field', versionOnly('{"version":"1.0.0","a":1}', '{"version":"1.0.1","a":1}') && !versionOnly('{"version":"1.0.0","a":1}', '{"version":"1.0.0","a":2}') && !versionOnly('{"version":"1.0.0","dependencies":{}}', '{"version":"1.0.0","dependencies":{"x":"1"}}') && !versionOnly('nope', '{}'));
check('minor bump: code review due', plan(['package.json'], 'minor').review.due);
check('patch bump: no code review', !plan(['package.json'], 'patch').review.due);
check('bumpKind', bumpKind('1.0.0', '1.0.1') === 'patch' && bumpKind('1.0.1', '1.1.0') === 'minor' && bumpKind('1.9.0', '2.0.0') === 'major' && bumpKind('1.0.0', '1.0.0') === 'none');
check('visual change asks for shots and the contact sheet', commands(plan(['src/ui.js'])).some((c) => c.includes('--shots')));
check('mobile change asks for the phone tier', commands(plan(['src/style.css'])).some((c) => c.includes('run.mjs phone')));
check('rules change asks for no phone tier', !commands(plan(['src/rules.js'])).some((c) => c.includes('phone')));
check('docs only asks for no smoke run', !commands(plan(['README.md'])).some((c) => c.includes('smoke')));

for (const c of cases) console.log(`${c.ok ? 'ok  ' : 'FAIL'} ${c.name}`);
process.exit(cases.every((c) => c.ok) ? 0 : 1);
