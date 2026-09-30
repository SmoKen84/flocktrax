const assert = require("node:assert/strict");
const { readFileSync } = require("node:fs");
const { test } = require("node:test");
const ts = require("typescript");
const compiled = ts.transpileModule(readFileSync(`${__dirname}/permissions-report-user.ts`, "utf8"), {
  compilerOptions: { module: ts.ModuleKind.CommonJS },
});
const exportsObject = {};
new Function("exports", compiled.outputText)(exportsObject);
const { resolvePermissionsReportUser: resolve } = exportsObject;
const account = (id, roles) => ({ id, role: roles[0], assignedRoles: roles, isDisabled: false });
const admin = account("admin", ["super_admin"]);
const manager = account("manager", ["farm_manager"]);
const worker = account("worker", ["flock_supervisor"]);
const bundle = { users: [admin, manager, worker], roles: ["super_admin", "farm_manager", "flock_supervisor"].map(key => ({ key })) };

test("Super Admin defaults to self and can select any configured user", () => {
  assert.equal(resolve(bundle, "admin").user.id, "admin");
  for (const user of bundle.users) {
    const result = resolve(bundle, "admin", user.id);
    assert.equal(result.canSelectUser, true);
    assert.equal(result.user.id, user.id);
    assert.equal(result.verified, true);
  }
});
test("other roles cannot select users even with a forged query parameter", () => {
  for (const actor of [manager, worker]) {
    const result = resolve(bundle, actor.id, "admin");
    assert.equal(result.canSelectUser, false);
    assert.equal(result.user.id, actor.id);
  }
});
test("unverified and disabled actors cannot gain the selector", () => {
  assert.equal(resolve(bundle, "unknown", "admin").user, undefined);
  for (const actor of [{ ...admin, isDisabled: true }, account("admin", ["super_admin", "unknown"]), account("admin", ["super_helper"])]) {
    const result = resolve({ ...bundle, users: [actor, worker] }, "admin", "worker");
    assert.equal(result.canSelectUser, false);
    assert.notEqual(result.user?.id, "worker");
  }
});
test("missing targets are explicit and do not silently display someone else", () => {
  const result = resolve(bundle, "admin", "deleted-user");
  assert.equal(result.canSelectUser, true);
  assert.equal(result.user, undefined);
  assert.equal(result.verified, false);
});
test("Super Admin in secondary roles works; demo restriction still forces self", () => {
  const multiRole = { ...bundle, users: [account("admin", ["farm_manager", "super_admin"]), worker] };
  assert.equal(resolve(multiRole, "admin", "worker").user.id, "worker");
  assert.equal(resolve(multiRole, "admin", "worker", true).canSelectUser, false);
  assert.equal(resolve(multiRole, "admin", "worker", true).user.id, "admin");
});

test("page renders the selector only for Super Admin and labels the selected report", async () => {
  const React = require("react");
  const { renderToStaticMarkup } = require("react-dom/server");
  const pageCode = ts.transpileModule(readFileSync(`${__dirname}/../app/admin/reports/my-permissions/page.tsx`, "utf8"), {
    compilerOptions: { module: ts.ModuleKind.CommonJS, jsx: ts.JsxEmit.ReactJSX },
  }).outputText;
  for (const actorId of ["admin", "manager"]) {
    const pageExports = {};
    const displayBundle = { ...bundle, users: bundle.users.map(user => ({ ...user, displayName: user.id, email: `${user.id}@example.test`, roleLabel: user.role, status: "active", memberships: [] })) };
    const mocks = {
      "react/jsx-runtime": require("react/jsx-runtime"),
      "./membership-hierarchy": { MembershipHierarchy: () => React.createElement("div", null, "Memberships") },
      "next/navigation": { redirect: () => { throw new Error("Unexpected redirect"); } },
      "@/lib/access-control": { getUserAccessBundle: async () => displayBundle, buildAccessValidationSummary: user => ({ roleLabels: [user.role], can: [`Allowed for ${user.id}`], cannot: [] }) },
      "@/lib/permissions-report-user": exportsObject,
      "@/lib/supabase/server": { createSupabaseServerClient: async () => ({ auth: { getUser: async () => ({ data: { user: { id: actorId } }, error: null }) } }) },
    };
    new Function("exports", "require", pageCode)(pageExports, name => { assert.ok(name in mocks, name); return mocks[name]; });
    const html = renderToStaticMarkup(await pageExports.default({ searchParams: Promise.resolve({ userId: "worker" }) }));
    assert.equal(html.includes('<select'), actorId === "admin");
    assert.ok(html.includes(`Allowed for ${actorId === "admin" ? "worker" : "manager"}`));
    if (actorId !== "admin") assert.equal(html.includes("worker@example.test"), false);
  }
});
