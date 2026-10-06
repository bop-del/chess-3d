// One-off: puppeteer Chromes left over from before the registry (CHE-270). Lists the headless Chromes with a puppeteer_dev_chrome_profile
// profile whose parent is launchd (pid 1): their node process is gone. Dry run by default; --kill ends them (SIGTERM, SIGKILL after 10 s).
// Usage: node tools/reap-chromes.mjs --orphans [--kill]      node tools/reap-chromes.mjs --registry   (reap registry entries now)
import { orphanChromes, psTable, reapChromes, sleep } from './_lib.mjs';

const args = process.argv.slice(2);
if (args.includes('--registry')) {
  const r = await reapChromes();
  console.log(r.length ? r.map((e) => `reaped ${e.pid} (owner ${e.owner} gone)`).join('\n') : 'registry: nothing to reap');
} else if (args.includes('--orphans')) {
  const list = orphanChromes(psTable());
  if (!list.length) console.log('no orphaned puppeteer Chromes');
  for (const o of list) console.log(`${args.includes('--kill') ? 'kill' : 'orphan'} ${o.pid}  ${o.command.slice(0, 120)}`);
  if (args.includes('--kill') && list.length) {
    for (const o of list) { try { process.kill(o.pid, 'SIGTERM'); } catch (e) { /* gone */ } }
    await sleep(10000);
    for (const o of list) { try { process.kill(o.pid, 0); process.kill(o.pid, 'SIGKILL'); } catch (e) { /* gone */ } }
  } else if (list.length) console.log('dry run: add --kill to end them');
} else { console.log('usage: node tools/reap-chromes.mjs --orphans [--kill] | --registry'); process.exit(2); }
