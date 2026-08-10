# FlockTrax Mobile 1.0.6 Release Changes

Date prepared: `2026-08-10`

## Dashboard Livehaul Schedule Display

The mobile dashboard now treats the calculated first-catch date as a planning
placeholder only.

- Before a real `livehaul_schedule` row with `sequence_num = 1` exists, the tile
  displays the calculated **Estimated First Livehaul** date.
- Once sequence `1` is issued, its scheduled `lh_date` replaces the estimate and
  is displayed as **First Livehaul**.
- Sequence `2` and later schedule rows are displayed in sequence order as
  additional livehaul dates.
- Legacy fixed `placements.lh1_date`, `lh2_date`, and `lh3_date` fields are not
  used by the mobile dashboard.

This makes the catch-crew schedule visible from the authoritative flexible
livehaul schedule while keeping the estimate available during pre-scheduling
planning.

## Release Package

- marketing version: `1.0.6`
- next iOS build: `18`
- next Android version code: `12`
- hosted published-version markers remain at `1.0.5` until store delivery is
  confirmed
