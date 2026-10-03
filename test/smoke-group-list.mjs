// The smoke groups, one list for the runner (test/smoke-groups.mjs), the affected mapping (tools/affected-groups.mjs) and the result cache.
// [name, script, extra args]. Longest first: the two fix halves (about 60 s each), then the rest. battle, views, tokens and play are
// their own scripts, on the same server. No side effects: importing this file starts nothing.
export const SMOKE = 'test/smoke.mjs';
export const GROUPS = [['fixes 1/2', SMOKE, ['--group=fixes', '--part=0/2']], ['fixes 2/2', SMOKE, ['--group=fixes', '--part=1/2']], ['battle', 'test/battle.mjs', []], ['music', 'test/music-page.mjs', []], ['themes', 'test/themes.mjs', []], ['textures', 'test/textures.mjs', []], ['intro', 'test/intro.mjs', []], ['learn', SMOKE, ['--group=learn']], ['drill', SMOKE, ['--group=drill']], ['core', SMOKE, ['--group=core']], ['explain', SMOKE, ['--group=explain']], ['views', 'test/views.mjs', []], ['tokens', 'test/tokens.mjs', []], ['play', 'test/play.mjs', []], ['goodmove', SMOKE, ['--group=goodmove']], ['review', SMOKE, ['--group=review']], ['trays', 'test/trays-page.mjs', []], ['blocks chars', 'test/blocks-chars-page.mjs', []], ['blocks fixes', 'test/blocks-fixes-page.mjs', []], ['open', 'test/open-flag.mjs', []], ['puzzles', SMOKE, ['--group=puzzles']]];
/** Group family: 'fixes 1/2' and 'fixes 2/2' are both 'fixes'. */
export const family = (name) => name.replace(/ \d\/\d$/, '');
export const FAMILIES = [...new Set(GROUPS.map(([n]) => family(n)))];
