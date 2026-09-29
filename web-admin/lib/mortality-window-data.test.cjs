const assert = require("node:assert/strict");
const { readFileSync } = require("node:fs");
const { test } = require("node:test");
const ts = require("typescript");

function load(file, imports = {}) {
  const compiled = ts.transpileModule(readFileSync(`${__dirname}/${file}`, "utf8"), {
    compilerOptions: { module: ts.ModuleKind.CommonJS },
  });
  const exports = {};
  new Function("exports", "require", compiled.outputText)(exports, (name) => {
    if (!(name in imports)) throw new Error(`Unexpected import ${name}`);
    return imports[name];
  });
  return exports;
}
const { getMortalityWindows } = load("mortality-window-data.ts", {
  "@/lib/supabase/fetch-all-rows": load("supabase/fetch-all-rows.ts"),
});

test("batches scopes and survives a lower API cap without losing or repeating summaries", async () => {
  const ids = Array.from({ length: 205 }, (_, i) => String(i).padStart(4, "0"));
  const calls = [];
  const db = { rpc(name, args) {
    assert.equal(name, "get_mortality_window");
    assert.equal(args.p_start_date, "2026-09-23");
    assert.equal(args.p_end_date, "2026-09-29");
    assert.equal(args.p_include_first_week, true);
    assert.ok(args.p_placement_ids.length <= 100);
    return {
      order(column) { assert.equal(column, "placement_id"); return this; },
      range(from, to) {
        calls.push(from);
        return Promise.resolve({
          data: args.p_placement_ids.slice(from, Math.min(to + 1, from + 40)).map((placement_id) => ({ placement_id })),
          error: null,
        });
      },
    };
  } };
  const result = await getMortalityWindows(db, [...ids, ids[0]], "2026-09-23", "2026-09-29", true);
  assert.deepEqual(result.map((r) => r.placement_id), ids);
  assert.deepEqual(calls, [0, 40, 80, 0, 40, 80, 0]);
});

test("empty scope does not query the database", async () => {
  assert.deepEqual(await getMortalityWindows({}, [], "2026-09-23", "2026-09-27"), []);
});

test("a failed summary request cannot become zero mortality", async () => {
  const db = { rpc() { return {
    order() { return this; },
    range() { return Promise.resolve({ data: null, error: { message: "RPC unavailable" } }); },
  }; } };
  await assert.rejects(getMortalityWindows(db, ["one"], "2026-09-23", "2026-09-27"), /RPC unavailable/);
});
