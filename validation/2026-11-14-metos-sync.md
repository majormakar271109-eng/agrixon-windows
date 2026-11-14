# METOS sync and UI reliability — local stage

## Contract
Input: existing local FieldClimate connection and its linked stations.
Output: automatic discovery and current-data refresh while the METOS tab is visible.
Success: initial fetch, five-minute refresh, pause outside tab, preserved station choice,
explicit failures and missing values, responsive layout; no credentials in browser storage.
No model or prompt changes. Local application code; no farm records or keys used in tests.

## Scope
- Current readings and stations refresh five minutes after the previous cycle completes.
- Polling pauses outside the METOS tab or when the document is hidden; resumes on return.
- Last successful fetch is not represented as the sensor measurement time.
- Existing forecast button remains manual; background server ingestion is not implemented.
- Fixed double navigation initialization and stylesheet duplication.
- 3D can close before terrain finishes; outstanding loads abort and queued render is cancelled.
- Imagery failure warnings persist; removed unsupported fixed pixel-resolution claim.

## Evidence
`npm test`: before 25/25; after 25/25.
`node --check public/tools.js`, `public/nav.js`, `public/field3d.js`: passed.
No configured lint or typecheck scripts exist; syntax checks are not typechecking.

Five reproduced failures, same assertions before/after:

| Failure | Classification | Before | After |
|---|---|---|---|
| duplicate redesign stylesheet | asset initialization | fail | pass |
| More menu stays closed after click | duplicate event handlers | fail | pass |
| no automatic station reading | missing sync lifecycle | fail | pass |
| missing reading not displayed as dash | missing data / coercion | fail | pass |
| close ignored during terrain load | async lifecycle | fail | pass |

Saved browser harness: `/Users/vmv/SchoolMode/NATA SPACE/agrixon-browser-regressions.mjs`.
Seven assertions passed, including five-minute polling and pause outside tab.
Additional browser checks: station selection survives refresh; genuine zero remains zero;
HTTP502 gives explicit sync failure; at390px viewport horizontal overflow is0.
All browser tests used isolated contexts and intercepted workspace snapshot writes.
METOS responses were fixtures, not live account data.

## Limits / rollout
This is a partial local stage, not completion of the full precision-agriculture feature list.
Live FieldClimate auth, payload compatibility, forecast format and actual station freshness
still require verification with an authorized account. No live keys were requested or read.
Full 3D successful-render path still needs runtime coverage; loading-close path was tested.
OneSoil URL redirected to login; no authenticated screen was accessed.
Requested clone-website skill was not present at the configured path.
Claude review was invoked but returned no usable review or cost information.
No independent-review approval is claimed. Spend command timed out. Cost and latency
deltas are unmeasured; polling adds status/stations/current requests per visible cycle.

## Rollback
To immediately stop polling, leave the METOS tab or close the page.
Code rollback: restore only affected public assets from the earlier public backup
`/var/folders/kt/ddhpk3p94rbdzhx2hj_gb8kh0000gn/T/opencode/agrixon-pre-redesign-20261114.tar.gz`
after inspecting its paths and retaining a copy of current assets. This also reverts the
previous visual redesign; it is not a selective patch rollback. Do not restore workspace,
sensor stores, environment files or credential files. This stage changed no server routes
or dependencies. Reload the browser after restoring assets. Desktop packaged builds
were not changed.
