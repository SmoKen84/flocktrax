"use client";

import { useState } from "react";

export function ReminderReportOptions({ initialType = "task_list", newWindow = false }: {
  initialType?: string; newWindow?: boolean;
}) {
  const [type, setType] = useState(initialType);
  return <form action="/admin/reports/setup" method="get" target={newWindow ? "_blank" : undefined}>
    <input type="hidden" name="report" value="daily_log_reminders" />
    <input type="hidden" name="type" value={type} />
    <fieldset style={{ border: 0, padding: 0, marginBottom: "1rem" }}>
      <legend>Type of Report</legend>
      <label style={{ display: "inline-flex", gap: ".5rem", marginRight: "1.5rem" }}>
        <input type="checkbox" checked={type === "task_list"} onChange={() => setType("task_list")} /> Task List
      </label>
      <label style={{ display: "inline-flex", gap: ".5rem" }}>
        <input type="checkbox" checked={type === "as_displayed"} onChange={() => setType("as_displayed")} /> As Displayed
      </label>
    </fieldset>
    <button className="button" type="submit">Run Report</button>
  </form>;
}
