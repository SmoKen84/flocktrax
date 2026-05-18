# FlockTrax Testing Issue List

Date: 2026-05-12
Purpose: running punch list for issues discovered during testing and live use before the next coding pass / release stabilization work.

## How To Use

- Add issues here as they are discovered during testing.
- Keep each item short and operational.
- When coding resumes, use this as the active fix queue.

## Current Issues

1. Add `Source / Feed Mill` filter to admin `Feed Tickets`
   - Area: `web-admin` -> `Feed Tickets`
   - Need: add a new filter criterion so tickets can be filtered by `source` / feed mill during billing and review
   - Expected: user can narrow ticket list/report by feed source/feed mill
   - Actual: current filter set does not include that field
   - Priority: high

2. Add full flock closeout report
   - Area: reporting / flock closeout workflow
   - Need: produce a full flock report when closing out a flock
   - Expected: a complete closeout report exists for final flock review
   - Actual: report does not yet exist
   - Priority: medium
   - Notes: report details/content still to be defined later

3. Add sortable columns to admin `Feed Tickets`
   - Area: `web-admin` -> `Feed Tickets`
   - Need: support sort order on several columns
   - Expected: user can sort the ticket list by key operational columns
   - Actual: ticket list does not provide needed sorting controls
   - Priority: medium
   - Columns requested so far:
     - date
     - bins
     - ticket number

4. Fix placement wizard field layout in `Farm Placement Editor`
   - Area: placement wizard -> `Farm Placement Editor`
   - Need: keep `Start Females` and `Start Males` on the same horizontal line
   - Expected: both start-count fields appear together as a matched pair
   - Actual: `Start Females` appears beside `Date Removed`, leaving `Start Males` orphaned below
   - Priority: high

5. Harden admin font/rendering consistency across browsers and machines
   - Area: `web-admin` / admin console rendering
   - Need: install and force a distributed web font so layout measurements are more stable across browser and machine configurations
   - Expected: admin screens render consistently without text metric drift causing blocks to crowd or overlap
   - Actual: different machines/browser/font configurations can scatter objects or crowd blocks due to fallback font/rendering differences
   - Priority: high
   - Notes: investigate shipping a controlled font and reducing dependence on local font availability

6. Fix Action Items update date inheritance bug
   - Area: `web-admin` -> `Action Items`
   - Need: when adding an update to an existing action item, the update should use its own actual entry date
   - Expected: update entries build a true chronological history/thread
   - Actual: updates are forced to inherit the original action item date
   - Priority: high
   - Impact: breaks chronological history and makes progress tracking inaccurate

7. Sort bin selector combobox by `barn.sort_code`
   - Area: feed / bin selector combobox
   - Need: bin selection options should be ordered by the linked `barn.sort_code` field
   - Expected: combobox presents bins in barn operational sort order
   - Actual: current option order is not aligned to `barn.sort_code`
   - Priority: high

## Reload Prompt

When resuming later, say:

`load the testing issue list`
