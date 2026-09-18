const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const ts = require("typescript");
const source = fs.readFileSync(path.join(__dirname, "../lib/barn-sort.ts"), "utf8");
const compiled = ts.transpileModule(source, { compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2020 } }).outputText;
const mod = { exports: {} };
new Function("exports", "module", compiled)(mod.exports, mod);
const { sortBySortCodeEnabled, compareBarnOrder } = mod.exports;
for (const value of [undefined, null, "", "False", "false", "garbage"]) assert.equal(sortBySortCodeEnabled(value), false);
for (const value of ["True", "TRUE", " true "]) assert.equal(sortBySortCodeEnabled(value), true);
const barns = [
  { barn_code: "Barn 10", sort_code: "2" },
  { barn_code: "Barn 2", sort_code: "3" },
  { barn_code: "Barn 1", sort_code: "1" },
];
assert.deepEqual(barns.slice().sort((a,b)=>compareBarnOrder(a,b)).map(b=>b.barn_code), ["Barn 1","Barn 2","Barn 10"]);
assert.deepEqual(barns.slice().sort((a,b)=>compareBarnOrder(a,b,true)).map(b=>b.barn_code), ["Barn 1","Barn 10","Barn 2"]);
assert(compareBarnOrder({barn_code:"B2",sort_code:"1"}, {barn_code:"B10",sort_code:"1"},true)<0);
assert(compareBarnOrder({barn_code:"B2"}, {barn_code:"B10"},true)<0);
assert(compareBarnOrder({barn_code:"B10",sort_code:"1"}, {barn_code:"B2"},true)<0);
assert.equal(barns[0].sort_code,"2");
console.log("Barn sort tests passed: default, True/False parsing, natural order, custom order, missing codes, ties and unchanged input.");
