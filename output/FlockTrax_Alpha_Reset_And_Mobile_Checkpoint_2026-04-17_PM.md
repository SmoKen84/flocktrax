# FlockTrax Checkpoint
Date: 2026-04-17 PM

## Current State
- Live alpha reset has been completed against the Supabase database.
- Structural/configuration data was preserved.
- Operational/test data was cleared successfully.
- The system is now back to a cleaner alpha baseline for fresh real-world data entry.

## Backup + Reset
- A database backup was created locally before reset.
- Reusable reset script exists at:
  - `C:\dev\FlockTrax\supabase\snippets\alpha_reset_operational_data.sql`
- Reset intent:
  - preserve farms, barns, feed bins, settings, roles, profiles, memberships, and platform metadata
  - clear flocks, placements, feed tickets/drops, daily logs, mortality logs, weight logs, and activity diary rows
  - normalize barns back to empty/no active flock

## Dashboard + State Model
- Dashboard now behaves as an all-barns operations board instead of active-only placement tiles.
- Placement/barn/physical state model has been formalized around:
  - `placements.is_active` = current operational placement
  - `flocks.is_in_barn` = birds physically in barn
  - `barns.is_empty` = physical occupancy truth
- Dedicated state functions were added and applied in the DB:
  - `mark_chicks_arrived(...)`
  - `mark_barn_empty(...)`
- Intermediate “current but not yet in barn” state was validated manually using SQL helper logic.

## Placement Wizard
- Placement scheduler is live and working after the recent schema/function repairs.
- Historical backfill override now reads from:
  - `platform.settings`
- This allows super-admin controlled back-entry of historical placements for alpha/beta data loading.

## Activity Diary
- `public.activity_log` is now implemented.
- Thin narrative entries are being written from:
  - mobile save/state functions
  - placement wizard create/update paths
  - dashboard LH date saves
  - operational state changes
- Admin readout exists under:
  - `Archives -> Activity Log`

## Dashboard UI
- Tile layout has been heavily refined.
- Live haul block now supports inline LH date entry/edit/save flow.
- State colors have been differentiated.
- Empty/no-future-placement pill text was changed locally to `OFFLINE`, but that local-only text tweak was intentionally not emphasized as a required deploy item.

## Google Sheets Sync
- Not built yet.
- This is still the next major system objective after fresh alpha data starts going in.
- The database reset was done specifically so sync work won’t be polluted by old junk/test records.

## Mobile App Status
- Mobile app lives at:
  - `C:\dev\FlockTrax\mobile`
- It is currently an Expo-managed app.
- There is **not** a generated native iOS project yet.
- There is no app-owned `.xcodeproj` or `ios/` folder yet.
- If/when resumed, next options are:
  1. Use Expo/EAS Build for TestFlight
  2. Run `npx expo prebuild -p ios` to generate a local native iOS project

## Browser/App Icon Note
- Browser/app icon work was attempted and improved, but favicon transparency/appearance was still not considered important enough to continue right now.
- User explicitly chose to stop worrying about it for now.

## Best Resume Point
1. Re-enter a small amount of clean alpha data
2. Verify mobile-to-DB and admin-to-DB flows on the clean baseline
3. Define Google Sheets sync workbook/tab mapping
4. Build and test sync engine
5. Return later to iPhone/TestFlight path if needed

## User Pause
- User paused because of real-world obligations and wants to resume later from this point.
