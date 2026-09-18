export const DEMO_PROJECT_REF = "srkgobayrzidytmvoago";
export const DEMO_OWNER_ID = "ac1ee85e-7ed3-4ee0-adc2-59d5fea0b12a";
export const DEMO_ALIAS_PATTERN = /^evaluator-[a-f0-9]{12}$/;
export function demoLoginEmail(value: string) {
  const login = value.trim().toLowerCase();
  return DEMO_ALIAS_PATTERN.test(login) ? login + "@evaluators.flocktrax.invalid" : login;
}
export function evaluatorPathAllowed(path: string, role?: string) {
  if (role === "integrator_manager" && ["/admin/farm-groups", "/admin/farm-structure"].some(prefix => path === prefix || path.startsWith(prefix + "/"))) return true;
  const blocked = ["/admin/demo-access", "/admin/user-access", "/admin/settings",
    "/admin/environment", "/admin/environment-control", "/admin/sync", "/admin/integrator", "/admin/farm-groups",
    "/admin/farm-structure", "/admin/about/environment"];
  return !blocked.some(prefix => path === prefix || path.startsWith(prefix + "/"));
}
