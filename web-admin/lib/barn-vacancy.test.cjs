const assert = require("node:assert/strict");
const { readFileSync } = require("node:fs");
const { test } = require("node:test");
const ts = require("typescript");
function load(file, mocks = {}) {
  const code = ts.transpileModule(readFileSync(`${__dirname}/${file}`, "utf8"), {
    compilerOptions: { module: ts.ModuleKind.CommonJS, jsx: ts.JsxEmit.ReactJSX },
  }).outputText;
  const result = {};
  new Function("exports", "require", code)(result, name => mocks[name] ?? require(name));
  return result;
}
const core = load("barn-vacancy.ts");
const placement = (startDate, extra = {}) => ({ barnId: "a", startDate, lifecycleStage: "in_barn_growing", removedDate: null, ...extra });
test("vacancy starts exactly 43 days after placement, including DST and year rollover", () => {
  assert.equal(core.addCalendarDays("2026-10-01", 43), "2026-11-13");
  assert.equal(core.addCalendarDays("2026-12-15", 43), "2027-01-27");
  assert.deepEqual(core.buildBarnVacancies([placement("2026-10-01")], "2026-11-01", "2026-11-30").intervals,
    [{ startDate: "2026-11-13", endDate: "2026-11-30" }]);
});
test("a future placement ends vacancy on the preceding day", () => {
  assert.deepEqual(core.buildBarnVacancies([placement("2026-10-01"), placement("2026-11-20")], "2026-11-01", "2027-01-10").intervals,
    [{ startDate: "2026-11-13", endDate: "2026-11-19" }, { startDate: "2027-01-02", endDate: "2027-01-10" }]);
});
test("overlapping, contained and back-to-back placements never create false vacancy", () => {
  const rows = [placement("2026-10-01"), placement("2026-10-15"), placement("2026-11-27"), placement("2026-10-02")];
  assert.deepEqual(core.buildBarnVacancies(rows, "2026-10-01", "2027-01-12").intervals,
    [{ startDate: "2027-01-09", endDate: "2027-01-12" }]);
});
test("empty barns and vacancies before the first future placement are included", () => {
  assert.deepEqual(core.buildBarnVacancies([], "2026-10-12", "2026-11-12").intervals,
    [{ startDate: "2026-10-12", endDate: "2026-11-12" }]);
  assert.deepEqual(core.buildBarnVacancies([placement("2026-10-20")], "2026-10-12", "2026-11-12").intervals,
    [{ startDate: "2026-10-12", endDate: "2026-10-19" }]);
});
test("canceled, unassigned and already removed placements do not occupy barns", () => {
  const rows = [placement(null, { lifecycleStage: "canceled" }), placement(null, { lifecycleStage: "unassigned" }), placement("2026-10-01", { removedDate: "2026-10-10" })];
  assert.deepEqual(core.buildBarnVacancies(rows, "2026-10-12", "2026-10-20"),
    { intervals: [{ startDate: "2026-10-12", endDate: "2026-10-20" }], unknown: false });
});
test("missing or invalid dates show unknown, never a falsely vacant barn", () => {
  for (const date of [null, "", "2026-02-30", "invalid"]) {
    assert.deepEqual(core.buildBarnVacancies([placement(date)], "2026-10-12", "2026-11-12"), { intervals: [], unknown: true });
  }
});
test("ranges clamp to today, normalize reversed dates, bound long requests and clip months", () => {
  assert.deepEqual(core.vacancyDateRange("bad", "2026-02-30", "2026-10-12"), { startDate: "2026-10-12", endDate: "2026-12-11" });
  assert.deepEqual(core.vacancyDateRange("2026-12-01", "2026-11-01", "2026-10-12"), { startDate: "2026-11-01", endDate: "2026-12-01" });
  assert.equal(core.vacancyDateRange("2026-10-12", "2030-01-01", "2026-10-12").endDate, "2027-10-12");
  assert.deepEqual(core.clipVacancy({ startDate: "2026-10-25", endDate: "2026-11-09" }, "2026-11-01", "2026-11-30"), { startDate: "2026-11-01", endDate: "2026-11-09" });
});

function dataModule(tables, failingTable) {
  const requests = [];
  const client = { from(table) {
    let rows = tables[table] || [];
    const query = { select() { return query; }, order() { return query; }, in(key, ids) { rows = rows.filter(row => ids.includes(row[key])); return query; }, range(from, to) {
      requests.push({ table, from, to });
      return Promise.resolve({ data: rows.slice(from, to + 1), error: table === failingTable ? { message: "database failure" } : null });
    } };
    return query;
  } };
  const module = load("barn-vacancy-report-data.ts", {
    "next/cache": { unstable_noStore() {} },
    "@/lib/barn-vacancy": core,
    "@/lib/barn-sort-settings": { getBarnOrder: async () => new Map() },
    "@/lib/placement-editor-access": { hasActorFarmScope: (actor, row) => actor.farmIds.has(row.farmId) },
    "@/lib/supabase/server": { createSupabaseAdminClient: () => client },
  });
  return { ...module, requests };
}
const actor = { actorId: "user", hasDashboardView: true, farmIds: new Set(["f1"]) };
const tables = () => ({
  farms_ui: [{ id: "f1", farm_name: "Farm One", farm_group_id: "g1" }, { id: "f2", farm_name: "Private Farm" }],
  barns: [{ id: "a", farm_id: "f1", barn_code: "A", is_active: true }, { id: "empty", farm_id: "f1", barn_code: "B", is_active: true }, { id: "private", farm_id: "f2", is_active: true }, { id: "inactive", farm_id: "f1", is_active: false }],
  placements: [{ id: "p1", barn_id: "a", flock_id: "fl1", active_start: null, lifecycle_stage: "scheduled", date_removed: null }],
  flocks: [{ id: "fl1", date_placed: "2026-10-01" }],
});
test("loader scopes all barns, includes empty barns, excludes inactive ones and rejects forged scope", async () => {
  const module = dataModule(tables());
  const filters = { startDate: "2026-11-01", endDate: "2026-11-30" };
  const rows = await module.getBarnVacancyReport(actor, filters);
  assert.deepEqual(rows.map(row => row.id), ["a", "empty"]);
  assert.equal(rows[0].intervals[0].startDate, "2026-11-13");
  assert.equal(rows[1].intervals[0].startDate, "2026-11-01");
  assert.deepEqual(await module.getBarnVacancyReport(actor, { ...filters, barnId: "private" }), []);
  assert.deepEqual(await module.getBarnVacancyReport({ ...actor, actorId: null }, filters), []);
  assert.deepEqual(await module.getBarnVacancyReport({ ...actor, hasDashboardView: false }, filters), []);
});
test("loader reads beyond 1000 placements and fails explicitly on query errors", async () => {
  const data = tables();
  data.placements = Array.from({ length: 1001 }, (_, index) => ({ id: `p${index}`, barn_id: "a", flock_id: "fl1", active_start: index === 1000 ? "2026-11-20" : "2026-01-01", lifecycle_stage: "scheduled", date_removed: null }));
  const module = dataModule(data);
  const rows = await module.getBarnVacancyReport(actor, { startDate: "2026-11-01", endDate: "2026-11-30" });
  assert.equal(rows[0].intervals[0].endDate, "2026-11-19");
  assert.ok(module.requests.some(request => request.table === "placements" && request.from === 1000));
  await assert.rejects(() => dataModule(data, "placements").getBarnVacancyReport(actor, { startDate: "2026-11-01", endDate: "2026-11-30" }), /Could not load/);
});

test("calendar renders continuous spans, labels, empty/error states and scoped navigation", async () => {
  const { renderToStaticMarkup } = require("react-dom/server");
  const React = require("react");
  const styles = new Proxy({}, { get: (_, key) => key === "__esModule" ? false : String(key) });
  const baseMocks = {
    "next/link": { default: ({ children, ...props }) => React.createElement("a", props, children) },
    "next/navigation": { redirect() { throw new Error("redirect"); } },
    "@/app/admin/reports/feed-projection/feed-projection-report-actions": { FeedProjectionReportActions: () => null },
    "@/lib/barn-vacancy": core,
    "@/lib/placement-editor-access": { getPlacementEditorActorAccess: async () => actor },
    "@/lib/report-calendar": load("report-calendar.ts"),
    "./vacancy.module.css": { default: styles },
  };
  for (const mode of ["rows", "empty", "error"]) {
    const page = load("../app/admin/reports/barn-vacancy/page.tsx", { ...baseMocks,
      "@/lib/barn-vacancy-report-data": { getBarnVacancyReport: async () => {
        if (mode === "error") throw new Error("failure");
        const barn = { id: "a", barnCode: "A", farmId: "f1", farmGroupId: "g1", farmGroupName: "Group One", farmName: "Farm One", unknown: false, intervals: [{ startDate: "2027-01-05", endDate: "2027-01-12" }] };
        return mode === "empty" ? [] : [
          ...Array.from({ length: 11 }, (_, index) => ({ ...barn, id: `a${index}`, barnCode: `A${index}` })),
          { ...barn, id: "b", barnCode: "B", farmId: "f2", farmName: "Farm Two" },
          { ...barn, id: "c", barnCode: "C", farmId: "f3", farmGroupId: "g2", farmGroupName: "Group Two" },
        ];
      } },
    });
    const html = renderToStaticMarkup(await page.default({ searchParams: Promise.resolve({ barnId: "a", startDate: "2027-01-01", endDate: "2027-01-31" }) }));
    assert.ok(html.includes("report=barn_vacancy"));
    if (mode === "rows") {
      assert.ok(html.includes("grid-column:5 / 13"));
      assert.ok(html.includes("Jan 5, 2027 through Jan 12, 2027"));
      const pages = [...html.matchAll(/<section[^>]*>(.*?)<\/section>/gs)].map(match => match[1]);
      assert.equal(pages.length, 4, "11 barns continue on a labeled page, other farms get separate pages");
      assert.ok(pages[0].includes("<strong>Farm Group: Group One</strong>"));
      assert.ok(pages[1].includes("<strong>Farm: Farm One</strong>"));
      assert.ok(pages[1].includes("Barns 11–11 of 11"));
      assert.ok(pages[2].includes("<strong>Farm: Farm Two</strong>"));
      assert.ok(!pages[2].includes("Farm One"));
      assert.ok(pages[3].includes("<strong>Farm Group: Group Two</strong>"), "same farm name in another group stays separate");
    }
    if (mode === "empty") assert.ok(html.includes("No active barns match"));
    if (mode === "error") { assert.ok(html.includes("could not be loaded")); assert.ok(!html.includes('role="table"')); }
  }
});
