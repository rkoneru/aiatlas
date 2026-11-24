/**
 * The phone layout script is shipped as a string (src/lib/collapse-inline.ts) inside a template
 * literal, where a single backslash is silently dropped. These checks catch that.
 * Run: npm run test:unit
 */
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { COLLAPSE_INLINE } from '../../src/lib/collapse-inline';

test('the inline script parses', () => {
  assert.doesNotThrow(() => new Function(COLLAPSE_INLINE));
});

test('regular expressions keep their backslashes', () => {
  for (const re of ['/var\\(--(\\w+)\\)/', 'replace(/\\s+/g', '/^[\\d.,%$€£+\\-–~×x\\s]+$/']) {
    assert.ok(COLLAPSE_INLINE.includes(re), `missing ${re}`);
  }
});

test('numeric stat titles are rejected, real titles are kept', () => {
  const m = /\/\^\[[^\]]+\]\+\$\//.exec(COLLAPSE_INLINE);
  assert.ok(m, 'stat-title pattern not found');
  const stat = new Function(`return ${m![0]}`)() as RegExp;
  for (const t of ['308', '42%', '~1.5 KB'.replace(' KB', ''), '3 – 5']) assert.ok(stat.test(t), t);
  for (const t of ['Prompt injection', 'v23 release', 'Agent fleets']) assert.ok(!stat.test(t), t);
});
