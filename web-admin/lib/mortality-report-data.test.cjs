const assert = require("node:assert/strict");
const { readFileSync } = require("node:fs");
const { test } = require("node:test");
const ts = require("typescript");
function load(file, imports = {}) {
  const exports = {};
  new Function("exports", "require", ts.transpileModule(readFileSync(`${__dirname}/${file}`, "utf8"), {
    compilerOptions: { module: ts.ModuleKind.CommonJS },
  }).outputText)(exports, (name) => {
    if (!(name in imports)) throw new Error(`Unexpected import ${name}`);
    return imports[name];
  });
  return exports;
}
async function report({ start = "2026-10-01", hauls = [], loads = [], failure = null } = {}) {
  const tables = {
    placements: [{ id: "p", farm_id: "f", barn_id: "b", flock_id: "fl", placement_key: "1-B", lifecycle_stage: "in_barn", active_start: "2026-10-01", date_removed: null }],
    flocks: [{ id: "fl", flock_number: 1, date_placed: "2026-10-01", female_date_placed: "2026-10-01", male_date_placed: "2026-10-02", start_cnt_females: 100, start_cnt_males: 100 }],
    farms_ui: [{ id: "f", farm_name: "Farm" }], barns: [{ id: "b", barn_code: "B" }],
    livehaul_schedule: hauls.map((row, i) => ({ livehaul_id: String(i), placement_id: "p", lh_date: "2026-10-02", actual_date: null, target_sex: "female", head_actual: null, status: "completed", ...row })),
    livehaul_loads: loads.map((row, i) => ({ load_id: String(i), ...row })),
  };
  const db = { from(table) {
    let rows = tables[table];
    const query = {
      select() { return this; }, order() { return this; },
      in(key, values) { rows = rows.filter((row) => values.includes(row[key])); return this; },
      eq(key, value) { rows = rows.filter((row) => row[key] === value); return this; },
      range(from, to) { return Promise.resolve({ data: rows.slice(from, Math.min(to + 1, from + 2)), error: table === failure ? { message: "unavailable" } : null }); },
      then(resolve) { return Promise.resolve({ data: rows, error: null }).then(resolve); },
    };
    return query;
  } };
  const { getMortalityReportData } = load("mortality-report-data.ts", {
    "next/cache": { unstable_noStore() {} },
    "@/lib/report-calendar": { clampDateRange: (startDate, endDate) => ({ startDate, endDate }) },
    "@/lib/supabase/server": { createSupabaseAdminClient: () => db },
    "@/lib/supabase/fetch-all-rows": load("supabase/fetch-all-rows.ts"),
    "@/lib/mortality-population": load("mortality-population.ts"),
    "@/lib/mortality-window-data": { async getMortalityWindows(db, ids, historyStart) {
      assert.equal(historyStart, "2026-10-01");
      return [{ placement_id: "p", opening_female: 0, opening_male: 0, days: [
        { log_date: "2026-10-01", dead_female: 5, cull_female: 5, dead_male: null, cull_male: null },
        { log_date: "2026-10-02", dead_female: 5, cull_female: 0, dead_male: 10, cull_male: 0 },
      ] }];
    } },
  });
  return getMortalityReportData({ startDate: start, endDate: "2026-10-03" });
}
test("recorded loads replace header counts, remove on actual date, and carry forward into partial ranges", async () => {
  const options = { hauls: [{ head_actual: 80, actual_date: "2026-10-01" }], loads: [
    { livehaul_id: "0", head_count: 10 }, { livehaul_id: "0", head_count: 15 }, { livehaul_id: "0", head_count: 5 },
  ] };
  const full = (await report(options)).sections[0];
  assert.equal(full.days[0].livehaulRemoved, 30);
  assert.equal(full.days[0].femalePopulation, 60);
  assert.equal(full.days[1].malePlaced, 100);
  assert.equal(full.endingTotalPopulation, 145);
  assert.equal(full.totalLossInRange, 25);
  const partial = (await report({ ...options, start: "2026-10-02" })).sections[0];
  assert.equal(partial.openingFemalePopulation, 60);
  assert.equal(partial.openingMalePopulation, 100);
  assert.equal(partial.days[0].malePlaced, 0);
  assert.equal(partial.livehaulRemovedInRange, 0);
  assert.equal(partial.endingTotalPopulation, full.endingTotalPopulation);
});
test("mixed-sex historical removal uses haul-day populations", async () => {
  const options = { hauls: [{ target_sex: null, head_actual: 35 }] };
  const full = (await report(options)).sections[0];
  assert.equal(full.days[1].femalePopulation, 68);
  assert.equal(full.days[1].malePopulation, 72);
  const partial = (await report({ ...options, start: "2026-10-03" })).sections[0];
  assert.equal(partial.openingTotalPopulation, 140);
  assert.equal(partial.endingFemalePopulation, 68);
});
test("planned targets and cancelled events do not remove birds; actual header is a fallback", async () => {
  const result = (await report({ hauls: [
    { head_target: 100, status: "scheduled" }, { head_actual: 50, status: "cancelled" },
    { head_actual: 20, target_sex: "male" },
  ] })).sections[0];
  assert.equal(result.livehaulRemovedInRange, 20);
  assert.equal(result.endingTotalPopulation, 155);
});
test("recorded zero loads take priority and excess removals never produce negative population", async () => {
  const zero = (await report({ hauls: [{ head_actual: 80 }], loads: [{ livehaul_id: "0", head_count: 0 }] })).sections[0];
  assert.equal(zero.livehaulRemovedInRange, 0);
  const excess = (await report({ hauls: [{ head_actual: 200, target_sex: "male" }] })).sections[0];
  assert.equal(excess.endingMalePopulation, 0);
  assert.equal(excess.livehaulRemovedInRange, 200);
});
test("load query failure cannot silently inflate population", async () => {
  await assert.rejects(report({ hauls: [{ head_actual: 20 }], failure: "livehaul_loads" }), /loads failed to load/);
});
