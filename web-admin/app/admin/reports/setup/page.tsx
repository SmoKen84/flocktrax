import Link from "next/link";
import { redirect } from "next/navigation";
import { PageHeader } from "@/components/page-header";
import { FeedProjectionReportActions } from "@/app/admin/reports/feed-projection/feed-projection-report-actions";
import { canAccessFarmManagerReport, getPlacementEditorActorAccess } from "@/lib/placement-editor-access";
import { createSupabaseAdminClient } from "@/lib/supabase/server";
import styles from "./setup-report.module.css";

export const dynamic = "force-dynamic";
export const metadata = { title: "Setup Reports | FlockTrax Admin" };

export default async function SetupReportPage({ searchParams }: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const actor = await getPlacementEditorActorAccess();
  if (!canAccessFarmManagerReport(actor)) redirect("/admin/reports");
  const params = await searchParams;
  const reminders = params.report === "daily_log_reminders";
  const reportKey = reminders ? "daily_log_reminders" : "app_settings";
  const title = reminders ? "Daily Log Reminder Tasks" : "Application Settings";
  const db = createSupabaseAdminClient();
  const settingsResult = !reminders && db
    ? await db.from("app_settings").select("id,group,name,value,desc").order("group").order("name")
    : null;
  const tasksResult = reminders && db
    ? await db.from("daily_age_tasks").select("id,task_label,min_age_days,max_age_days,display_order,is_active")
      .order("display_order").order("min_age_days", { nullsFirst: true }).order("task_label")
    : null;
  const error = !db || settingsResult?.error || tasksResult?.error;
  const settings = settingsResult?.data ?? [];
  const tasks = tasksResult?.data ?? [];
  const count = reminders ? tasks.length : settings.length;
  const generated = new Intl.DateTimeFormat("en-US", {
    dateStyle: "medium", timeStyle: "short", timeZone: "America/Chicago",
  }).format(new Date());
  return (
    <div className={styles.report}>
      <PageHeader eyebrow="Setup Reports" title={title}
        body={reminders
          ? "Configured reminders for the mobile Daily Log collection screen. Age limits are in days; only active tasks appear when the flock meets the configured age range."
          : "Configurable application options with their current values and descriptions, grouped by setup category."}
        actions={<><FeedProjectionReportActions /><Link className="button-secondary"
          href={`/admin/reports?category=setup&report=${reportKey}`}>Return To Reports</Link></>}
      />
      <section className="panel card">
        <p>Generated {generated} (Central) · {error ? "Listing unavailable" : `${count} ${reminders ? "tasks" : "settings"}`}</p>
        {error ? <p role="alert">The setup listing could not be loaded. Please try again.</p> : (
          <div className={styles.tableWrap}>
            {reminders ? <table className={styles.table}>
              <thead><tr><th>Display Order</th><th>Reminder Task</th><th>Minimum Age (Days)</th><th>Maximum Age (Days)</th><th>Status</th></tr></thead>
              <tbody>{tasks.map(task => <tr key={task.id}>
                <td>{task.display_order ?? 0}</td><td>{task.task_label}</td>
                <td>{task.min_age_days ?? "No minimum"}</td><td>{task.max_age_days ?? "No maximum"}</td>
                <td>{task.is_active === false ? "Inactive" : "Active"}</td>
              </tr>)}
              {!tasks.length ? <tr><td colSpan={5}>No reminder tasks configured.</td></tr> : null}</tbody>
            </table> : <table className={styles.table}>
              <thead><tr><th>Group</th><th>Option</th><th>Current Value</th><th>Description</th></tr></thead>
              <tbody>{settings.map(setting => <tr key={setting.id}>
                <td>{setting.group || "Ungrouped"}</td><td>{setting.name}</td>
                <td>{setting.value === null || setting.value === "" ? "(Not set)" : setting.value}</td>
                <td>{setting.desc || "—"}</td>
              </tr>)}
              {!settings.length ? <tr><td colSpan={4}>No application settings configured.</td></tr> : null}</tbody>
            </table>}
          </div>
        )}
      </section>
    </div>
  );
}
