export type AuthSession = {
  accessToken: string;
  refreshToken: string | null;
  email: string;
  userId: string;
};

export type LoginResponse = {
  access_token?: string;
  refresh_token?: string | null;
  user?: {
    id?: string;
    email?: string;
  } | null;
};

export type UserProfile = {
  user_id: string;
  email: string | null;
  role: string | null;
  can_write_daily_logs?: boolean;
  can_write_log_mortality?: boolean;
  can_write_weight_samples?: boolean;
  can_write_feed_tickets?: boolean;
  can_write_grade_birds?: boolean;
  expires_at: string | null;
};

export type RecentMortalityHistoryDay = {
  log_date: string;
  dead_male: number;
  dead_female: number;
  cull_male: number;
  cull_female: number;
};

export type FarmGroupOption = {
  farm_group_id: string;
  farm_group_name: string;
};

export type FarmOption = {
  farm_id: string;
  farm_name: string;
  farm_group_id: string | null;
  latitude: number | null;
  longitude: number | null;
};

export type PlacementFilterMeta = {
  can_select_farm_group: boolean;
  selected_farm_group_id: string | null;
  available_farm_groups: FarmGroupOption[];
  available_farms: FarmOption[];
};

export type DashboardSettings = {
  dow_date: string | null;
  short_date: string | null;
  first_lh: number | null;
  allow_historical_entry: boolean;
};

export type DailyAgeTask = {
  id: string;
  task_label: string;
  display_order: number | null;
};

export type PlacementSummary = {
  placement_id: string;
  farm_id: string;
  farm_group_id: string | null;
  farm_group_name: string | null;
  farm_name: string;
  farm_latitude: number | null;
  farm_longitude: number | null;
  barn_code: string;
  placement_code: string;
  placed_date: string;
  est_first_catch: string | null;
  first_livehaul_days: number | null;
  age_days: number | null;
  placed_female_count: number;
  placed_male_count: number;
  mortality_female_count: number;
  mortality_male_count: number;
  current_female_count: number;
  current_male_count: number;
  current_total_count: number;
  needs_maintenance: boolean;
  needs_feedlines: boolean;
  needs_nipple_lines: boolean;
  has_bird_health_alert: boolean;
  dashboard_status_label: string | null;
  dashboard_status_tone: "warn" | "good" | "danger" | "neutral" | null;
  head_count: number | null;
  is_active: boolean;
  is_removed: boolean;
  is_complete: boolean;
  is_in_barn: boolean;
  is_settled: boolean;
};

export type DashboardWeatherForecast = {
  farmName: string;
  latitude: number;
  longitude: number;
  currentTemperature: number | null;
  currentWeatherCode: number | null;
  dailyHigh: number | null;
  dailyLow: number | null;
  dailyWeatherCode: number | null;
  precipitationProbabilityMax: number | null;
  timezone: string | null;
};

export type PlacementSummaryResponse = {
  ok: boolean;
  items?: PlacementSummary[];
  filters?: PlacementFilterMeta;
  settings?: DashboardSettings;
  count?: number;
  error?: string;
};

export type PlacementDayItem = {
  placement_id: string;
  placement_code: string;
  farm_name: string;
  barn_code: string;
  flock_number: number | null;
  placed_date: string;
  log_date: string;
  placement_age_days: number | null;
  age_days: number | null;
  am_temp: number | null;
  set_temp: number | null;
  rel_humidity: number | null;
  outside_temp_current: number | null;
  outside_temp_low: number | null;
  outside_temp_high: number | null;
  water_meter_reading: number | null;
  maintenance_flag: boolean;
  feedlines_flag: boolean;
  nipple_lines_flag: boolean;
  bird_health_alert: boolean;
  min_vent: string | null;
  is_oda_open: boolean;
  oda_exception: string | null;
  naoh: string | null;
  comment: string | null;
  dead_female: number;
  dead_male: number;
  cull_female: number;
  cull_male: number;
  cull_female_note: string | null;
  cull_male_note: string | null;
  dead_reason: string | null;
  grade_litter: number | null;
  grade_footpad: number | null;
  grade_feathers: number | null;
  grade_lame: number | null;
  grade_pecking: number | null;
  daily_tasks: DailyAgeTask[];
  daily_is_active: boolean;
  mortality_is_active: boolean;
  placement_is_active: boolean;
  placement_is_removed: boolean;
  is_existing_log?: boolean;
};

export type WeightSampleEntry = {
  id?: string | null;
  sex: "male" | "female";
  cnt_weighed: number | null;
  avg_weight: number | null;
  stddev_weight: number | null;
  procure: number | null;
  other_note: string | null;
  is_active: boolean;
  has_entry?: boolean;
};

export type WeightBenchmark = {
  breed_id: string | null;
  genetic_name: string | null;
  age_days: number | null;
  target_weight: number | null;
  day_feed_per_bird: number | null;
  note: string | null;
};

export type WeightEntryItem = {
  placement_id: string;
  placement_code: string;
  farm_name: string;
  barn_code: string;
  flock_number: number | null;
  placed_date: string | null;
  log_date: string;
  placement_age_days: number | null;
  male_benchmark: WeightBenchmark | null;
  female_benchmark: WeightBenchmark | null;
  male_sample: WeightSampleEntry;
  female_sample: WeightSampleEntry;
};

export type FeedBinOption = {
  feed_bin_id: string;
  farm_id: string;
  barn_id: string;
  barn_code: string;
  farm_name: string | null;
  bin_code: string;
  capacity_lbs: number | null;
  active_placement_id: string | null;
  active_placement_code: string | null;
};

export type FeedDropEntry = {
  id?: string | null;
  feed_bin_id: string | null;
  bin_code: string | null;
  barn_code: string | null;
  placement_id: string | null;
  placement_code: string | null;
  feed_type: string | null;
  drop_weight_lbs: number | null;
  note: string | null;
  drop_order: number;
};

export type FeedTicketItem = {
  id?: string | null;
  ticket_number: string | null;
  delivered_at: string;
  ticket_weight_lbs: number | null;
  feed_name: string | null;
  vendor_name: string | null;
  source_type: string | null;
  note: string | null;
  bins: FeedBinOption[];
  drops: FeedDropEntry[];
};

export type FeedTicketListItem = {
  id: string;
  ticket_number: string | null;
  delivery_date: string | null;
  vendor_name: string | null;
  source_type: string | null;
  ticket_weight_lbs: number | null;
  allocated_weight_lbs: number;
  remaining_weight_lbs: number;
  drop_count: number;
  placement_codes: string[];
  farm_names: string[];
  barn_codes: string[];
};

export type PlacementDayResponse = {
  ok: boolean;
  item?: PlacementDayItem;
  error?: string;
};

export type SavePlacementResponse = {
  ok: boolean;
  daily_saved?: boolean;
  mortality_saved?: boolean;
  item?: PlacementDayItem;
  error?: string;
};

export type WeightEntryResponse = {
  ok: boolean;
  item?: WeightEntryItem;
  error?: string;
};

export type SaveWeightEntryResponse = {
  ok: boolean;
  male_saved?: boolean;
  female_saved?: boolean;
  item?: WeightEntryItem;
  error?: string;
};

export type FeedTicketResponse = {
  ok: boolean;
  item?: FeedTicketItem;
  error?: string;
};

export type FeedTicketListResponse = {
  ok: boolean;
  items?: FeedTicketListItem[];
  error?: string;
};

export type SaveFeedTicketResponse = {
  ok: boolean;
  ticket_saved?: boolean;
  drop_count?: number;
  item?: FeedTicketItem;
  error?: string;
};
