// Flag parsing of bin/lane open and bin/lane close (CHE-194). Pure: returns { pos, key, ... } or throws an Error('usage').
//   open: --key CHE-n (repeatable), --private, --agent <name> <brief> (start the builder session once the lane is open), --model <m> (only with --agent)
//   close: -m <message>, --no-linear
export function parseLaneFlags(args, spec) {
  const out = { pos: [], key: [] };
  for (let i = 0; i < args.length; i++) {
    const a = args[i];
    if (a === '--key' && spec.key && args[i + 1]) out.key.push(args[++i]);
    else if (a === '-m' && spec.m && args[i + 1]) out.m = args[++i];
    else if (a === '--no-linear' && spec.noLinear) out.noLinear = true;
    else if (a === '--private' && spec.priv) out.priv = true;
    else if (a === '--agent' && spec.agent && args[i + 1] && args[i + 2]) { out.agent = { name: args[i + 1], brief: args[i + 2] }; i += 2; }
    else if (a === '--model' && spec.agent && args[i + 1]) out.model = args[++i];
    else if (a.startsWith('-')) throw new Error('usage');
    else out.pos.push(a);
  }
  if (out.model && !out.agent) throw new Error('usage');
  return out;
}

// CHE-401 (L22): keys passed by hand replace the key derived from the lane name, so a lane che-70-x opened with only --key CHE-71 would link
// CHE-71 and lose CHE-70. A lane named che-<n>-words that gets --key must list CHE-<n> too. Returns the refusal text or ''.
export function nameKeyProblem(branch, keys = []) {
  const m = /^che-(\d+)-/.exec(String(branch || ''));
  if (!m || !keys.length || keys.includes(`CHE-${m[1]}`)) return '';
  return `lane ${branch} is named after CHE-${m[1]} but --key lists only ${keys.join(', ')}: keys passed by hand replace the one in the name. Add --key CHE-${m[1]} (one --key per issue the lane carries).`;
}
