import { unstable_noStore as noStore } from "next/cache";

import { createSupabaseAdminClient } from "@/lib/supabase/server";

export type AppSettingRecord = {
  id: string;
  group: string;
  name: string;
  value: string;
  description: string;
  updatedAt: string | null;
};

export type DailyAgeTaskRecord = {
  id: string;
  taskLabel: string;
  minAgeDays: number | null;
  maxAgeDays: number | null;
  displayOrder: number;
  isActive: boolean;
  updatedAt: string | null;
};

export type SettingsBundle = {
  settingGroups: string[];
  settings: AppSettingRecord[];
  reminderTasks: DailyAgeTaskRecord[];
  screenTexts: ScreenTextRecord[];
};

export type ScreenTextRecord = {
  id: number;
  name: string;
  display: string;
  note: string;
  location: string;
};

type AppSettingRow = {
  id: string;
  group: string | null;
  name: string | null;
  value: string | null;
  desc: string | null;
  updated_at?: string | null;
};

type DailyAgeTaskRow = {
  id: string;
  task_label: string | null;
  min_age_days: number | null;
  max_age_days: number | null;
  display_order: number | null;
  is_active: boolean | null;
  updated_at: string | null;
};

type ScreenTextRow = {
  id: number;
  name: string | null;
  display: string | null;
  note: string | null;
  scrn_location: string | null;
};

function normalize(value: string | null | undefined) {
  return (value ?? "").trim();
}

function compareNullableNumber(left: number | null, right: number | null) {
  if (left === null && right === null) return 0;
  if (left === null) return -1;
  if (right === null) return 1;
  return left - right;
}

export async function getSettingsBundle(): Promise<SettingsBundle> {
  noStore();

  const supabase = createSupabaseAdminClient();
  if (!supabase) {
    return {
      settingGroups: [],
      settings: [],
      reminderTasks: [],
      screenTexts: [],
    };
  }

  const [settingsResult, reminderTasksResult, screenTextsResult] = await Promise.all([
    supabase.from("app_settings").select("id,group,name,value,desc,updated_at").order("group").order("name"),
    supabase
      .from("daily_age_tasks")
      .select("id,task_label,min_age_days,max_age_days,display_order,is_active,updated_at")
      .order("display_order")
      .order("min_age_days", { ascending: true, nullsFirst: true })
      .order("max_age_days", { ascending: true, nullsFirst: true }),
    supabase
      .schema("platform")
      .from("screen_txt")
      .select("id,name,display,note,scrn_location")
      .order("scrn_location")
      .order("name"),
  ]);

  const settings = ((settingsResult.data ?? []) as AppSettingRow[])
    .filter((row) => normalize(row.group).length > 0 && normalize(row.name).length > 0)
    .map((row) => ({
      id: row.id,
      group: normalize(row.group),
      name: normalize(row.name),
      value: row.value ?? "",
      description: normalize(row.desc),
      updatedAt: row.updated_at ?? null,
    }))
    .sort((left, right) => {
      const groupCompare = left.group.localeCompare(right.group);
      if (groupCompare !== 0) return groupCompare;
      return left.name.localeCompare(right.name);
    });

  const reminderTasks = ((reminderTasksResult.data ?? []) as DailyAgeTaskRow[])
    .filter((row) => normalize(row.task_label).length > 0)
    .map((row) => ({
      id: row.id,
      taskLabel: normalize(row.task_label),
      minAgeDays: row.min_age_days ?? null,
      maxAgeDays: row.max_age_days ?? null,
      displayOrder: row.display_order ?? 0,
      isActive: row.is_active !== false,
      updatedAt: row.updated_at ?? null,
    }))
    .sort((left, right) => {
      const activeCompare = Number(right.isActive) - Number(left.isActive);
      if (activeCompare !== 0) return activeCompare;
      const orderCompare = left.displayOrder - right.displayOrder;
      if (orderCompare !== 0) return orderCompare;
      const minCompare = compareNullableNumber(left.minAgeDays, right.minAgeDays);
      if (minCompare !== 0) return minCompare;
      const maxCompare = compareNullableNumber(left.maxAgeDays, right.maxAgeDays);
      if (maxCompare !== 0) return maxCompare;
      return left.taskLabel.localeCompare(right.taskLabel);
    });

  const settingGroups = Array.from(new Set(settings.map((setting) => setting.group)));
  const screenTexts = ((screenTextsResult.data ?? []) as ScreenTextRow[])
    .filter((row) => normalize(row.name).length > 0)
    .map((row) => ({
      id: row.id,
      name: normalize(row.name),
      display: row.display ?? "",
      note: row.note ?? "",
      location: normalize(row.scrn_location) || "unassigned",
    }))
    .sort((left, right) => {
      const locationCompare = left.location.localeCompare(right.location);
      if (locationCompare !== 0) return locationCompare;
      return left.name.localeCompare(right.name);
    });

  return {
    settingGroups,
    settings,
    reminderTasks,
    screenTexts,
  };
}
