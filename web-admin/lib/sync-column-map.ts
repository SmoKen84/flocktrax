export type GoogleSheetsColumnTemplate = {
  sourceTable: "public.log_daily" | "public.log_mortality" | "public.log_weight";
  sourceField: string;
  sourceVariant: string | null;
  sheetLabel: string;
  valueMode: "direct" | "boolean_flag" | "note" | "derived";
  sortOrder: number;
  notes: string | null;
};

export const GOOGLE_SHEETS_COLUMN_TEMPLATES: GoogleSheetsColumnTemplate[] = [
  { sourceTable: "public.log_daily", sourceField: "age_days", sourceVariant: null, sheetLabel: "Day", valueMode: "derived", sortOrder: 10, notes: "Verify actual worksheet label." },
  { sourceTable: "public.log_daily", sourceField: "am_temp", sourceVariant: null, sheetLabel: "AM Temp", valueMode: "direct", sortOrder: 20, notes: null },
  { sourceTable: "public.log_daily", sourceField: "set_temp", sourceVariant: null, sheetLabel: "Set Temp", valueMode: "direct", sortOrder: 30, notes: null },
  { sourceTable: "public.log_daily", sourceField: "rel_humidity", sourceVariant: null, sheetLabel: "Humidity", valueMode: "direct", sortOrder: 40, notes: null },
  { sourceTable: "public.log_daily", sourceField: "outside_temp_current", sourceVariant: null, sheetLabel: "Outside Temp", valueMode: "direct", sortOrder: 50, notes: "Verify actual worksheet label." },
  { sourceTable: "public.log_daily", sourceField: "outside_temp_low", sourceVariant: null, sheetLabel: "Outside Low", valueMode: "direct", sortOrder: 60, notes: "Verify actual worksheet label." },
  { sourceTable: "public.log_daily", sourceField: "outside_temp_high", sourceVariant: null, sheetLabel: "Outside High", valueMode: "direct", sortOrder: 70, notes: "Verify actual worksheet label." },
  { sourceTable: "public.log_daily", sourceField: "water_meter_reading", sourceVariant: null, sheetLabel: "Water Meter", valueMode: "direct", sortOrder: 80, notes: "Verify actual worksheet label." },
  { sourceTable: "public.log_daily", sourceField: "maintenance_flag", sourceVariant: null, sheetLabel: "Maintenance", valueMode: "boolean_flag", sortOrder: 90, notes: "Decide whether worksheet wants X, Y/N, or TRUE/FALSE." },
  { sourceTable: "public.log_daily", sourceField: "feedlines_flag", sourceVariant: null, sheetLabel: "Feedlines", valueMode: "boolean_flag", sortOrder: 100, notes: "Decide whether worksheet wants X, Y/N, or TRUE/FALSE." },
  { sourceTable: "public.log_daily", sourceField: "nipple_lines_flag", sourceVariant: null, sheetLabel: "Nipple Lines", valueMode: "boolean_flag", sortOrder: 110, notes: "Decide whether worksheet wants X, Y/N, or TRUE/FALSE." },
  { sourceTable: "public.log_daily", sourceField: "bird_health_alert", sourceVariant: null, sheetLabel: "Health Alert", valueMode: "boolean_flag", sortOrder: 120, notes: "Verify actual worksheet label." },
  { sourceTable: "public.log_daily", sourceField: "min_vent", sourceVariant: null, sheetLabel: "Min Vent", valueMode: "direct", sortOrder: 130, notes: "Verify actual worksheet label." },
  { sourceTable: "public.log_daily", sourceField: "is_oda_open", sourceVariant: null, sheetLabel: "ODA Open", valueMode: "boolean_flag", sortOrder: 140, notes: "Verify actual worksheet label." },
  { sourceTable: "public.log_daily", sourceField: "oda_exception", sourceVariant: null, sheetLabel: "ODA Exception", valueMode: "note", sortOrder: 150, notes: "May remain diary-only if workbook has no column." },
  { sourceTable: "public.log_daily", sourceField: "naoh", sourceVariant: null, sheetLabel: "NaOH", valueMode: "direct", sortOrder: 160, notes: "Verify actual worksheet capitalization." },
  { sourceTable: "public.log_daily", sourceField: "comment", sourceVariant: null, sheetLabel: "Comments", valueMode: "note", sortOrder: 170, notes: null },

  { sourceTable: "public.log_mortality", sourceField: "dead_female", sourceVariant: null, sheetLabel: "Hen Mortality", valueMode: "direct", sortOrder: 210, notes: "Verify actual worksheet label." },
  { sourceTable: "public.log_mortality", sourceField: "dead_male", sourceVariant: null, sheetLabel: "Rooster Mortality", valueMode: "direct", sortOrder: 220, notes: "Verify actual worksheet label." },
  { sourceTable: "public.log_mortality", sourceField: "cull_female", sourceVariant: null, sheetLabel: "Hen Culls", valueMode: "direct", sortOrder: 230, notes: "Verify actual worksheet label." },
  { sourceTable: "public.log_mortality", sourceField: "cull_male", sourceVariant: null, sheetLabel: "Rooster Culls", valueMode: "direct", sortOrder: 240, notes: "Verify actual worksheet label." },
  { sourceTable: "public.log_mortality", sourceField: "cull_female_note", sourceVariant: null, sheetLabel: "Hen Cull Note", valueMode: "note", sortOrder: 250, notes: "May remain diary-only if no worksheet column exists." },
  { sourceTable: "public.log_mortality", sourceField: "cull_male_note", sourceVariant: null, sheetLabel: "Rooster Cull Note", valueMode: "note", sortOrder: 260, notes: "May remain diary-only if no worksheet column exists." },
  { sourceTable: "public.log_mortality", sourceField: "dead_reason", sourceVariant: null, sheetLabel: "Mortality Reason", valueMode: "note", sortOrder: 270, notes: "May remain diary-only if no worksheet column exists." },
  { sourceTable: "public.log_mortality", sourceField: "grade_litter", sourceVariant: null, sheetLabel: "Litter", valueMode: "direct", sortOrder: 280, notes: "Verify actual worksheet label." },
  { sourceTable: "public.log_mortality", sourceField: "grade_footpad", sourceVariant: null, sheetLabel: "Footpad", valueMode: "direct", sortOrder: 290, notes: "Verify actual worksheet label." },
  { sourceTable: "public.log_mortality", sourceField: "grade_feathers", sourceVariant: null, sheetLabel: "Feathers", valueMode: "direct", sortOrder: 300, notes: "Verify actual worksheet label." },
  { sourceTable: "public.log_mortality", sourceField: "grade_lame", sourceVariant: null, sheetLabel: "Lame", valueMode: "direct", sortOrder: 310, notes: "Verify actual worksheet label." },
  { sourceTable: "public.log_mortality", sourceField: "grade_pecking", sourceVariant: null, sheetLabel: "Pecking", valueMode: "direct", sortOrder: 320, notes: "Verify actual worksheet label." },

  { sourceTable: "public.log_weight", sourceField: "avg_weight", sourceVariant: "male", sheetLabel: "Male Avg", valueMode: "direct", sortOrder: 410, notes: null },
  { sourceTable: "public.log_weight", sourceField: "avg_weight", sourceVariant: "female", sheetLabel: "Female Avg", valueMode: "direct", sortOrder: 420, notes: null },
  { sourceTable: "public.log_weight", sourceField: "cnt_weighed", sourceVariant: "male", sheetLabel: "Sample M", valueMode: "direct", sortOrder: 430, notes: null },
  { sourceTable: "public.log_weight", sourceField: "cnt_weighed", sourceVariant: "female", sheetLabel: "Sample F", valueMode: "direct", sortOrder: 440, notes: null },
  { sourceTable: "public.log_weight", sourceField: "stddev_weight", sourceVariant: "male", sheetLabel: "Male StdDev", valueMode: "direct", sortOrder: 450, notes: "Only keep if workbook carries deviation columns." },
  { sourceTable: "public.log_weight", sourceField: "stddev_weight", sourceVariant: "female", sheetLabel: "Female StdDev", valueMode: "direct", sortOrder: 460, notes: "Only keep if workbook carries deviation columns." },
  { sourceTable: "public.log_weight", sourceField: "procure", sourceVariant: "male", sheetLabel: "Male Procure", valueMode: "derived", sortOrder: 470, notes: "Business meaning still needs confirmation." },
  { sourceTable: "public.log_weight", sourceField: "procure", sourceVariant: "female", sheetLabel: "Female Procure", valueMode: "derived", sortOrder: 480, notes: "Business meaning still needs confirmation." },
  { sourceTable: "public.log_weight", sourceField: "other_note", sourceVariant: null, sheetLabel: "Weight Notes", valueMode: "note", sortOrder: 490, notes: "May remain diary-only if no worksheet column exists." },
  { sourceTable: "public.log_weight", sourceField: "age_days", sourceVariant: null, sheetLabel: "Day", valueMode: "derived", sortOrder: 500, notes: "Usually not needed if row date already determines age." },
];
