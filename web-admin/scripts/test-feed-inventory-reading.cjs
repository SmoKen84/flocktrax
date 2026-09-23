const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const ts = require('typescript');
const mod = { exports: {} };
new Function('exports', ts.transpileModule(
  fs.readFileSync(path.join(__dirname, '../lib/feed-inventory-reading.ts'), 'utf8'),
  { compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 } },
).outputText)(mod.exports);
const resolve = mod.exports.resolveFeedInventoryReading;

// W5: snapshots replaced both stale quantities and stale feed classifications.
const bins = [
  resolve({ inventory_lbs: 18308.4, accessible_feed_type: 'grower' },
    { binsentry_last_inventory_lbs: 9851.09, accessible_feed_type: 'starter' }),
  resolve({ inventory_lbs: 0, accessible_feed_type: 'starter' },
    { binsentry_last_inventory_lbs: 2935.08, accessible_feed_type: 'grower' }),
];
const starter = bins.filter(b => b.feedType === 'starter').reduce((sum, b) => sum + b.pounds, 0);
const grower = bins.filter(b => b.feedType === 'grower').reduce((sum, b) => sum + b.pounds, 0);
assert.equal(starter, 0);
assert.equal(grower, 18308.4);
assert.equal(Math.round(starter + grower), 18308);
assert.equal(Math.round(31083 - starter - grower), 12775);
assert.deepEqual(resolve(undefined, { binsentry_last_inventory_lbs: 25, accessible_feed_type: 'starter' }),
  { pounds: 25, feedType: 'starter' });
assert.deepEqual(resolve({ inventory_lbs: 0 }, { binsentry_last_inventory_lbs: 25, accessible_feed_type: 'starter' }),
  { pounds: 0, feedType: 'starter' });
assert.equal(resolve(undefined, { binsentry_last_inventory_lbs: null, accessible_feed_lbs: 12 }).pounds, 12);
assert.equal(resolve({ inventory_lbs: null }, { binsentry_last_inventory_lbs: 25 }).pounds, 0);
assert.equal(resolve({ inventory_lbs: -5 }, { binsentry_last_inventory_lbs: 25 }).pounds, 0);
console.log('Inventory reading regression passed: W5 reconciliation, feed type, zero readings and legacy fallback.');
