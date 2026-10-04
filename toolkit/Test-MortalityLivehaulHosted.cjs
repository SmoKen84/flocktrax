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
  const all = async (table, columns, key) => {
    const r = await fetchAllRows((from, to) => db.from(table).select(columns).order(key).range(from,to));
    if (r.error) throw new Error(r.error.message);
    return r.data;
  };
  const [hauls, loads] = await Promise.all([
    all("livehaul_schedule", "livehaul_id,placement_id,lh_date,actual_date,target_sex,head_actual,status", "livehaul_id"),
    all("livehaul_loads", "load_id,livehaul_id,head_count", "load_id"),
  ]);
  const get = load("mortality-report-data.ts").getMortalityReportData;
  const full = await get({startDate:"2026-01-01",endDate:"2026-10-04"});
  let checked = 0;
  let heads = 0;
  for (const section of full.sections) {
    for (const day of section.days) {
      const expected = sum(hauls.filter(h => h.placement_id === section.placementId && !["canceled","cancelled"].includes(h.status) && (h.actual_date ?? h.lh_date) === day.date), h => {
        const counts = loads.filter(l => l.livehaul_id === h.livehaul_id && l.head_count !== null);
        return Math.max(0, counts.length ? sum(counts,l => l.head_count) : h.head_actual ?? 0);
      });
      assert.equal(day.livehaulRemoved, expected);
      heads += expected;
      if (!expected || day.date === section.reportEndDate) continue;
      const next = addDays(day.date,1);
      const partial = await get({flockCode:section.flockCode,startDate:next,endDate:section.reportEndDate});
      const p = partial.sections.find(p => p.placementId === section.placementId);
      assert.ok(p);
      const nextDay = section.days.find(d => d.date === next);
      assert.equal(p.openingFemalePopulation,day.femalePopulation + nextDay.femalePlaced);
      assert.equal(p.openingMalePopulation,day.malePopulation + nextDay.malePlaced);
      assert.equal(p.endingTotalPopulation,section.endingTotalPopulation);
      checked++;
    }
  }
  assert.ok(heads > 0);
  assert.ok(checked > 0);
  console.log(JSON.stringify({result:"PASS",sections:full.sections.length,recordedRemoved:heads,partialRangesChecked:checked,writes:"none"}));
})().catch(error => { console.error(error.message); process.exitCode=1; });
