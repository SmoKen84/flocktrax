const assert = require("node:assert/strict");
const { readFileSync } = require("node:fs");
const { test } = require("node:test");
const ts = require("typescript");
const compiled = ts.transpileModule(readFileSync(`${__dirname}/packet-completion.ts`, "utf8"), {
  compilerOptions: { module: ts.ModuleKind.CommonJS },
});
const moduleExports = {};
new Function("exports", compiled.outputText)(moduleExports);
const { hasMortalityEnteredToday, capPacketCompletion } = moduleExports;
const today = "2026-09-30";
const blank = { log_date: today, dead_female: null, dead_male: null, cull_female: null, cull_male: null };

test("missing or blank mortality caps saved packets at 50 percent", () => {
  for (const days of [[], [blank]]) {
    assert.equal(hasMortalityEnteredToday(days, today), false);
    assert.equal(capPacketCompletion(100, hasMortalityEnteredToday(days, today)), 50);
  }
  assert.equal(capPacketCompletion(0, false), 0);
});

test("an explicit zero or positive count allows completion in each mortality field", () => {
  for (const field of ["dead_female", "dead_male", "cull_female", "cull_male"]) {
    for (const value of [0, 12]) {
      const entered = hasMortalityEnteredToday([{ ...blank, [field]: value }], today);
      assert.equal(entered, true);
      assert.equal(capPacketCompletion(100, entered), 100);
    }
  }
});

test("yesterday's mortality does not complete today's packet", () => {
  assert.equal(hasMortalityEnteredToday([{ ...blank, log_date: "2026-09-29", dead_male: 0 }, blank], today), false);
});
