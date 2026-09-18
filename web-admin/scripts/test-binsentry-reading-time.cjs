const assert=require('node:assert/strict');const fs=require('node:fs');const path=require('node:path');const ts=require('typescript');
const mod={exports:{}};new Function('exports',ts.transpileModule(fs.readFileSync(path.join(__dirname,'../lib/binsentry-reading-time.ts'),'utf8'),{compilerOptions:{module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2022}}).outputText)(mod.exports);
const pick=mod.exports.binSentryReadingTime;
assert.equal(pick({updatedAt:'2026-03-09T23:33:19.476Z',createdAt:'2025-06-04T12:30:22.234Z'},false),null);
assert.equal(pick({createdAt:'2026-09-18T09:55:17.615Z',publishedAt:'2026-09-18T09:55:15.513Z'},true),'2026-09-18T09:55:17.615Z');
assert.equal(pick({createdAt:'bad',publishedAt:'2026-09-18T09:55:15.513Z'},true),'2026-09-18T09:55:15.513Z');
assert.equal(pick({lastReadingAt:'2026-09-18T04:55:00-05:00',updatedAt:'2026-03-09T00:00:00Z'},false),'2026-09-18T09:55:00.000Z');
assert.equal(pick({},true),null);
console.log('Reading timestamp tests passed: configuration excluded, reading date precedence, invalid/missing dates and time-zone normalization.');
