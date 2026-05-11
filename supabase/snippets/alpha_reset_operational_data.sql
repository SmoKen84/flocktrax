-- Alpha reset utility for FlockTrax
-- Purpose:
--   Clear operational/test history while preserving structural setup.
--
-- Preserved:
--   platform.* metadata/text/settings
--   public.farm_groups, public.farms, public.barns
--   public.feedbins
--   public.app_settings, public.daily_age_tasks
--   public.profiles, memberships, access-control records
--
-- Cleared:
--   public.activity_log
--   public.log_weight
--   public.log_mortality
--   public.log_daily
--   public.feed_drops
--   public.feed_tickets
--   public.placements
--   public.flocks
--
-- Barn state reset:
--   active_flock_id = null
--   has_flock = false
--   is_empty = true
--
-- Recommended:
--   1. Run in Supabase SQL editor.
--   2. Review the BEFORE counts.
--   3. Execute the reset block.
--   4. Confirm the AFTER counts.

-- BEFORE COUNTS ---------------------------------------------------------------
select 'activity_log' as table_name, count(*) as row_count from public.activity_log
union all
select 'log_weight', count(*) from public.log_weight
union all
select 'log_mortality', count(*) from public.log_mortality
union all
select 'log_daily', count(*) from public.log_daily
union all
select 'feed_drops', count(*) from public.feed_drops
union all
select 'feed_tickets', count(*) from public.feed_tickets
union all
select 'placements', count(*) from public.placements
union all
select 'flocks', count(*) from public.flocks
order by table_name;

-- RESET BLOCK -----------------------------------------------------------------
begin;

-- Clear barn pointers first so flock deletes never leave stale barn state behind.
update public.barns
set
  active_flock_id = null,
  has_flock = false,
  is_empty = true,
  updated_at = now();

delete from public.activity_log;
delete from public.log_weight;
delete from public.log_mortality;
delete from public.log_daily;
delete from public.feed_drops;
delete from public.feed_tickets;
delete from public.placements;
delete from public.flocks;

commit;

-- AFTER COUNTS ----------------------------------------------------------------
select 'activity_log' as table_name, count(*) as row_count from public.activity_log
union all
select 'log_weight', count(*) from public.log_weight
union all
select 'log_mortality', count(*) from public.log_mortality
union all
select 'log_daily', count(*) from public.log_daily
union all
select 'feed_drops', count(*) from public.feed_drops
union all
select 'feed_tickets', count(*) from public.feed_tickets
union all
select 'placements', count(*) from public.placements
union all
select 'flocks', count(*) from public.flocks
order by table_name;

-- POST-RESET BARN STATE CHECK -------------------------------------------------
select
  b.barn_code,
  b.active_flock_id,
  b.has_flock,
  b.is_empty
from public.barns b
order by b.sort_code nulls last, b.barn_code;
