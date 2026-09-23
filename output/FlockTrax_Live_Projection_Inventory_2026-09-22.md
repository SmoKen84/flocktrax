# Live inventory for feed projections

Both 10-day and custom projections now request BinSentry inventory for the selected barns on each report generation, using the existing live inventory reader. Production does not silently fall back to snapshots. Demo preserves its simulated inventory and outbound restrictions.

All on-hand totals, starter/grower detail and order recommendations consume the same response. Missing bins/readings, unknown nonzero feed types, invalid timestamps, or measurements older than 24 hours withhold the affected barn's inventory/recommendations and aggregate inventory/recommendation totals. Measurement timestamps are visible, including the oldest reading at the top and per-bin details. Daily demand remains available.

On-hand-only coverage warnings exclude all pending deliveries. Report text explicitly says listed orders are planned supply, not confirmation, and net order recommendations assume they arrive. Coverage uses full projected daily consumption and is an estimate, not a precise intraday runout time. Existing column widths are unchanged.

## W5 investigation

Live API readings retrieved during this task: bin 51 9,157.07 lb, bin 52 2,246.78 lb, both grower, measured September 22 around 8:55 PM Central. The report uses 11,404 rounded lb, about 2.2 projected days at approximately 5,280 lb/day. The API listed an 18,000 lb order for September 25. Ken clarified that this will be called in as an emergency request tomorrow, has about a 25% chance of delivery, and depends on extra feed and driver availability. No order was modified and no supplier was contacted. The pending order must not be interpreted as confirmed supply.

Historical stale snapshot use is established, but the exact report shown when the earlier purchase decision was made has not been reconstructed; causation of the current shortage is not established.

## Validation

- Live W5 report execution: totals/detail both 11,404 lb, coverage warning 2.2 days, and latest measurement timestamps.
- Report-level failure injection while retaining actual stored W5 snapshots: inventory, all recommendation fields and aggregate totals withheld; no stored fallback.
- Regression suite: stale, invalid, future, missing and partial readings; unknown feed type; zero readings; simulated demo; on-hand coverage.
- Production and demo TypeScript checks passed.
