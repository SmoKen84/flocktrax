// Read-only production comparison. Run from web-admin with an existing environment file.
// node ../toolkit/Test-BarnVacancyHosted.cjs .env.local <expected-project-ref>
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
const db = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL, process.env.SUPABASE_SECRET_KEY || process.env.SUPABASE_SERVICE_ROLE_KEY, { auth: { persistSession: false, autoRefreshToken: false } });
const load = (file) => require(path.join(process.cwd(), "lib", file));
load("supabase/server.ts").createSupabaseAdminClient = () => db;
const actor = { actorId: "read-only-verification", hasDashboardView: true, isSuperUser: true, bypassScope: true, farmIds: new Set(), farmGroupIds: new Set() };
const { getBarnVacancyReport } = load("barn-vacancy-report-data.ts");
const { isDateKey } = load("barn-vacancy.ts");
const day = (date, n) => new Date(Date.parse(`${date}T00:00:00Z`) + n * 86400000).toISOString().slice(0, 10);
const all = async (table, columns) => {
  const rows = [];
  for (let offset = 0; ; offset += 1000) {
    const result = await db.from(table).select(columns).order("id").range(offset, offset + 999);
    if (result.error) throw new Error(`Unable to read ${table}`);
    rows.push(...result.data);
    if (result.data.length < 1000) return rows;
  }
};
(async () => {
  const startDate = new Intl.DateTimeFormat("en-CA", { timeZone: "America/Chicago", year: "numeric", month: "2-digit", day: "2-digit" }).format(new Date());
  const endDate = day(startDate, 90);
  const [report, placements, flocks] = await Promise.all([
    getBarnVacancyReport(actor, { startDate, endDate }),
    all("placements", "id,barn_id,flock_id,active_start,lifecycle_stage,date_removed"),
    all("flocks", "id,date_placed"),
  ]);
  const flockById = new Map(flocks.map(row => [row.id, row]));
  let checked = 0;
  for (const barn of report) {
    const relevant = placements.filter(row => row.barn_id === barn.id && !["canceled", "unassigned"].includes(row.lifecycle_stage) && !(isDateKey(row.date_removed) && row.date_removed <= startDate))
      .map(row => row.active_start || flockById.get(row.flock_id)?.date_placed || null);
    const unknown = relevant.some(date => !isDateKey(date));
    assert.equal(barn.unknown, unknown);
    if (unknown) { assert.equal(barn.intervals.length, 0); continue; }
    for (let date = startDate; date <= endDate; date = day(date, 1)) {
      const expectedVacant = !relevant.some(start => date >= start && date < day(start, 43));
      const actualVacant = barn.intervals.some(range => date >= range.startDate && date <= range.endDate);
      assert.equal(actualVacant, expectedVacant, `${barn.barnCode}: ${date}`);
      checked++;
    }
  }
  assert.ok(report.length > 0 && checked > 0);
  console.log(JSON.stringify({ result: "PASS", barns: report.length, placements: placements.length, barnDaysChecked: checked, unknownBarns: report.filter(row => row.unknown).length, writes: "none", range: { startDate, endDate } }));
})().catch(error => { console.error(error.message); process.exitCode = 1; });
