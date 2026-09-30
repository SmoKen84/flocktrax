const assert = require("node:assert/strict");
const { readFileSync } = require("node:fs");
const { test } = require("node:test");
const ts = require("typescript");
function harness({ signedIn = true, dashboard = true, inScope = true } = {}) {
  const calls = [];
  const report = { rows: [{ placementId: "placement-1", totalLbs: 12345 }], windowDays: 10 };
  const imports = {
    "@/lib/feed-projection-report-data": { getFeedProjectionReportData: async options => { calls.push(options); return report; } },
    "@/lib/placement-editor-access": {
      getPlacementEditorActorAccess: async () => ({ actorId: signedIn ? "actor" : null, hasDashboardView: dashboard }),
      hasActorFarmScope: (_, scope) => { assert.deepEqual(scope, { farmId: "farm-1", farmGroupId: "group-1" }); return inScope; },
    },
    "@/lib/supabase/server": { createSupabaseAdminClient: () => ({
      from(table) { return { select() { return this; }, eq(_, id) {
        assert.equal(id, table === "barns" ? "barn-1" : "farm-1"); return this;
      }, async maybeSingle() { return { data: table === "barns" ? { farm_id: "farm-1" } : { farm_group_id: "group-1" }, error: null }; } }; },
    }) },
  };
  const compiled = ts.transpileModule(readFileSync(`${__dirname}/feed-projection-action.ts`, "utf8"), {
    compilerOptions: { module: ts.ModuleKind.CommonJS },
  });
  const exports = {};
  new Function("exports", "require", compiled.outputText)(exports, name => {
    assert.ok(name in imports, `Unexpected import ${name}`); return imports[name];
  });
  return { action: exports.getDashboardFeedProjection, calls, report };
}
test("popup requests the same operational report with only the selected barn and BinSentry orders", async () => {
  const h = harness();
  const data = await h.action("barn-1");
  assert.deepEqual(h.calls, [{ barnId: "barn-1", windowDays: 10, reportMode: "operational", includeBinSentryOnOrder: true }]);
  assert.deepEqual(data.rows, h.report.rows);
  assert.ok(data.loadedAt <= Date.now());
});
test("unauthenticated, non-dashboard, and out-of-scope requests cannot load feed data", async () => {
  for (const permissions of [{ signedIn: false }, { dashboard: false }, { inScope: false }]) {
    const h = harness(permissions);
    await assert.rejects(h.action("barn-1"), /access|Access/);
    assert.equal(h.calls.length, 0);
  }
});
