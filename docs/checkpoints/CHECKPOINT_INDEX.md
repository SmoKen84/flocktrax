# FlockTrax production checkpoint index

Recovery and handoff checkpoints for the production FlockTrax application. Start with the latest entry, then inspect current repository state before editing. This index is separate from the historical Adalo checkpoint index under `C:\dev\gpc_engine\adalo\Project_Checkpoints`.

## Latest checkpoint

| Date | Checkpoint | State | Resume point |
| --- | --- | --- | --- |
| 2026-10-25 | [Landing page and production handoff](2026-10-25-landing-page-handoff.md) | Approved landing page and green ownership footer are live on flocktrax.com; deployed application commit `350dfdb` | Read the checkpoint, verify Git status, and continue with Ken’s next request. No deployment is pending. |

Source checkout: `C:\dev\FlockTrax-Production-Release` on branch `release/admin-2.6.0`.

Deployment checkout: `C:\dev\FlockTrax-Vacancy-Release`; deploy from its `web-admin` directory only after validating the intended change.

For new checkpoints, add a dated file and update this table with its status and concrete resume point. Keep previous checkpoint files for history. Record deployed application commits separately from documentation-only checkpoint commits.
