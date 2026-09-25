export type ReminderTask = {
  id: string;
  task_label: string | null;
  min_age_days: number | null;
  max_age_days: number | null;
  display_order: number | null;
  is_active: boolean | null;
};

export function buildReminderAgeGroups(tasks: ReminderTask[]) {
  if (!tasks.length) return [];
  const byAge = [...tasks].sort((a, b) => (a.min_age_days ?? 0) - (b.min_age_days ?? 0));
  const lastAge = Math.max(0, ...tasks.map(t => t.max_age_days ?? t.min_age_days ?? 0));
  const groups = Array.from({ length: lastAge + 1 }, (_, age) => ({
    age,
    onward: false,
    tasks: byAge.filter(t => age >= (t.min_age_days ?? 0) && (t.max_age_days === null || age <= t.max_age_days))
      .sort((a, b) => (a.display_order ?? 0) - (b.display_order ?? 0) || (a.task_label ?? "").localeCompare(b.task_label ?? "") || a.id.localeCompare(b.id)),
  }));
  const unbounded = byAge.filter(t => t.max_age_days === null)
    .sort((a, b) => (a.display_order ?? 0) - (b.display_order ?? 0) || (a.task_label ?? "").localeCompare(b.task_label ?? "") || a.id.localeCompare(b.id));
  if (unbounded.length) groups.push({ age: lastAge + 1, onward: true, tasks: unbounded });
  return groups;
}
