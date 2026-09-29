// Read-only comparison against the hosted database; run from web-admin.
// Usage: node ../toolkit/Test-MortalityWindowHosted.cjs <env-file> <project-ref>
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const Module = require("node:module");
const { parseEnv } = require("node:util");
const appRequire = Module.createRequire(path.join(process.cwd(), "package.json"));
const ts = appRequire("typescript");
const { createClient } = appRequire("@supabase/supabase-js");
const [envFile, expectedProject] = process.argv.slice(2);
assert.ok(envFile && expectedProject, "Provide an environment file and expected project ref");
Object.assign(process.env, parseEnv(fs.readFileSync(envFile, "utf8")));
assert.equal(new URL(process.env.NEXT_PUBLIC_SUPABASE_URL).hostname, `${expectedProject}.supabase.co`);
const resolve = Module._resolveFilename;
Module._resolveFilename = function (name, ...args) {
  return resolve.call(this, name.startsWith("@/") ? path.join(process.cwd(), name.slice(2)) : name, ...args);
};
require.extensions[".ts"] = (module, filename) => module._compile(ts.transpileModule(fs.readFileSync(filename, "utf8"), {
  compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2020, esModuleInterop: true },
}).outputText, filename);
const db = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL, process.env.SUPABASE_SECRET_KEY || process.env.SUPABASE_SERVICE_ROLE_KEY);
const rpc = db.rpc.bind(db);
// Dashboard reads normally also refresh derived issues. Omit that write in this probe.
db.rpc = (name, args, options) => name === "sync_derived_placement_issues"
  ? Promise.resolve({ data: null, error: null }) : rpc(name, args, options);
const load = (file) => require(path.join(process.cwd(), "lib", file));
load("supabase/server.ts").createSupabaseAdminClient = () => db;
const { fetchAllRows } = load("supabase/fetch-all-rows.ts");
const { getMortalityWindows } = load("mortality-window-data.ts");
const female = (r) => (r.dead_female ?? 0) + (r.cull_female ?? 0);
const male = (r) => (r.dead_male ?? 0) + (r.cull_male ?? 0);
const sum = (rows, fn) => rows.reduce((n, r) => n + fn(r), 0);
const addDays = (value, n) => new Date(Date.parse(`${value}T00:00:00Z`) + n * 86400000).toISOString().slice(0, 10);

(async () => {
  const all = async (table, columns) => {
    const result = await fetchAllRows((from, to) => db.from(table).select(columns).order("id").range(from, to));
    if (result.error) throw new Error(result.error.message);
    return result.data;
  };
  const [placements, flocks, mortality] = await Promise.all([
    all("placements", "id,flock_id"), all("flocks", "id,date_placed"),
    all("log_mortality", "id,placement_id,log_date,dead_female,dead_male,cull_female,cull_male,is_active"),
  ]);
  for (const dashboard of [false, true]) {
    const start = "2026-09-23", end = "2026-09-27";
    const summaries = await getMortalityWindows(db, placements.map((p) => p.id), start, end, dashboard);
    assert.equal(summaries.length, placements.length);
    for (const summary of summaries) {
      const placement = placements.find((p) => p.id === summary.placement_id);
      const placed = flocks.find((f) => f.id === placement.flock_id)?.date_placed;
      const rows = mortality.filter((m) => m.placement_id === placement.id && m.is_active === true && (dashboard || m.log_date <= end));
      const firstWeek = (r) => placed && r.log_date >= placed && r.log_date <= addDays(placed, 6);
      const period = (r) => r.log_date >= start && r.log_date <= end;
      for (const [prefix, filter] of [["opening", (r) => r.log_date < start], ["total", () => true], ["first_week", firstWeek], ["period", period]]) {
        assert.equal(summary[`${prefix}_female`], sum(rows.filter(filter), female), `${prefix} female`);
        assert.equal(summary[`${prefix}_male`], sum(rows.filter(filter), male), `${prefix} male`);
      }
      const expected = rows.filter((r) => period(r) || (dashboard && firstWeek(r)))
        .sort((a, b) => a.log_date.localeCompare(b.log_date))
        .map(({ log_date, dead_female, dead_male, cull_female, cull_male }) => ({ log_date, dead_female, dead_male, cull_female, cull_male }));
      assert.deepEqual(summary.days, expected);
    }
  }
  const report = await load("mortality-report-data.ts").getMortalityReportData({ startDate: "2026-09-23", endDate: "2026-09-27" });
  const admin = await load("admin-data.ts").getAdminData();
  for (const p of admin.activePlacements) {
    assert.equal(p.mortalityFemaleLast7Days, sum(p.mortalityLast7DayBreakdown, (d) => d.female));
    assert.equal(p.mortalityMaleLast7Days, sum(p.mortalityLast7DayBreakdown, (d) => d.male));
  }
  const publicKey = process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
  assert.ok(publicKey, "Missing public key for access check");
  const anonymous = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL, publicKey);
  const denied = await anonymous.rpc("get_mortality_window", { p_placement_ids: [], p_start_date: "2026-09-23", p_end_date: "2026-09-27" });
  assert.ok(denied.error, "Anonymous RPC execution must be denied");
  const dailyLoss = {};
  for (const section of report.sections) for (const day of section.days) dailyLoss[day.date] = (dailyLoss[day.date] ?? 0) + (day.totalLoss ?? 0);
  console.log(JSON.stringify({ project: expectedProject, result: "PASS", comparedMortalityRows: mortality.length,
    comparedPlacements: placements.length, reportSections: report.sections.length, dashboardPlacements: admin.activePlacements.length,
    dailyLoss, anonymousAccess: "denied", writes: "none" }));
})().catch((error) => { console.error(error.message); process.exitCode = 1; });
