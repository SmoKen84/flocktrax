const assert = require("node:assert/strict");
const { readFileSync } = require("node:fs");
const { test } = require("node:test");
const ts = require("typescript");

const compiled = ts.transpileModule(
  readFileSync(`${__dirname}/fetch-all-rows.ts`, "utf8"),
  { compilerOptions: { module: ts.ModuleKind.CommonJS } },
);
const exportsUnderTest = {};
new Function("exports", compiled.outputText)(exportsUnderTest);
const { fetchAllRows } = exportsUnderTest;

for (const cap of [1000, 250]) {
  test(`retrieves later mortality with a server cap of ${cap}`, async () => {
    const rows = Array.from({ length: 1040 }, (_, id) => ({
      id,
      log_date: id < 1000 ? "2026-09-23" : "2026-09-27",
      dead_female: 1,
    }));
    const result = await fetchAllRows(async (from, to) => ({
      data: rows.slice(from, Math.min(to + 1, from + cap)),
      error: null,
    }));
    assert.deepEqual(result.data, rows);
    assert.equal(result.data.filter((row) => row.log_date === "2026-09-27").length, 40);
  });
}

test("discards incomplete totals when a later page fails", async () => {
  const error = { message: "Database unavailable" };
  const result = await fetchAllRows(async (from) => from === 0
    ? { data: [{ id: 1 }], error: null }
    : { data: null, error });
  assert.deepEqual(result, { data: null, error });
});

test("handles an empty table", async () => {
  assert.deepEqual(await fetchAllRows(async () => ({ data: [], error: null })), {
    data: [], error: null,
  });
});
