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
