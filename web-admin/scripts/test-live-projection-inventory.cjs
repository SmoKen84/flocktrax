const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const ts = require('typescript');
const mod = { exports: {} };
new Function('exports', ts.transpileModule(fs.readFileSync(path.join(__dirname, '../lib/live-projection-inventory.ts'), 'utf8'), {
  compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 },
}).outputText)(mod.exports);
const { summarizeLiveProjectionInventory: summarize, firstOnHandShortfall: coverage } = mod.exports;
const now = Date.parse('2026-09-23T03:00:00Z');
const bin = { status: 'current', binNumber: '51', onHandLbs: 9157.07, feedType: 'Grower', capturedAt: '2026-09-23T01:55:00Z' };
const w5 = summarize([bin, { ...bin, binNumber: '52', onHandLbs: 2246.78 }], now);
assert.equal(w5.total, 11404);
assert.equal(w5.starter, 0);
assert.equal(w5.grower, 11404);
for (const bad of [
  { status: 'unavailable' }, { status: 'unmapped' }, { onHandLbs: null },
  { capturedAt: null }, { capturedAt: 'invalid' }, { capturedAt: '2026-09-14T00:00:00Z' },
  { capturedAt: '2026-09-24T00:00:00Z' }, { feedType: 'Unspecified' },
]) {
  const result = summarize([bin, { ...bin, ...bad }], now);
  assert.equal(result.available, false);
  assert.equal(result.total, null, 'Partial/old readings must not produce a usable barn total');
  assert.equal(result.starter, null);
  assert.ok(result.problems.length);
}
assert.equal(summarize([], now).available, false);
assert.equal(summarize([{ ...bin, onHandLbs: 0, feedType: 'Unspecified' }], now).total, 0);
assert.equal(summarize([{ ...bin, capturedAt: '2026-09-14T00:00:00Z' }], now, true).available, true);
const days = Array.from({ length: 6 }, (_, index) => ({ date: `2026-09-${23 + index}`, pounds: 5280 }));
assert.ok(Math.abs(coverage(days, 11404).days - 2.159848) < 0.001);
assert.equal(coverage(days, null), null);
assert.equal(coverage([{ date: '2026-09-23', pounds: null }], 11404), null);
assert.equal(coverage(days, 40000), null);
console.log('Live inventory tests passed: W5, stale/missing/partial failures, unknown types, demo and on-hand coverage.');
