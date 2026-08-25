# Release report — «Зажги» / Ignite 1.0.0

## Candidate identity

| Field | Value/status |
|---|---|
| Version | 1.0.0 |
| Build ID | NOT RUN — final clean commit not selected |
| Full commit SHA | NOT RUN |
| Branch/worktree | `codex/inferno-clicker-yandex-1.0.0`; isolated release worktree |
| Build date/timezone | NOT RUN; Europe/Moscow |
| Node/npm/lock hash | NOT RUN |
| Dist manifest SHA-256 | NOT RUN |
| ZIP | `inferno-clicker-1.0.0.zip` — NOT RUN |
| ZIP bytes/SHA-256 | NOT RUN |
| Yandex draft ID | `574315` — PASS, authorized Console access available and persisted draft fields observed |
| Uploaded ZIP SHA match | FAIL / NO-GO — uploaded archive file ID `12624047` is the old `best-score` build, not the current `bestscore` candidate; exact replacement, SHA binding and debug verification are NOT RUN |
| Rollback | PASS — immutable accepted `0.1.1` archive re-hashed in the untouched original worktree: `C:\\Users\\User\\Documents\\Codex\\game-factory\\games\\inferno-clicker\\releases\\inferno-clicker-0.1.1.zip`; SHA-256 `a0d6d9851707e1f9990ba76f333f991c64c25605dd23ae4728c3953517eac984`; Build ID `0.1.1+c7a9ea4f3b85`; commit `c7a9ea4f3b85f4d17cf65549d6fead1d67e2dd8b` |

## Verification

- Executed commands and exit codes: `NOT RUN`.
- Full QA report and Cycle 09 acceptance decision: `NOT RUN`.
- Open issues: Critical=`NOT RUN`, High=`NOT RUN`, Medium=`NOT RUN`, Low=`NOT RUN`.
- Four ≥12-minute session traces: `NOT RUN`.
- Browser/device/zoom/orientation matrix: `NOT RUN`.
- Reward 60/90/repeat and no-reward regression: `NOT RUN`.
- RU/EN and SDK ready/lifecycle runtime verification: `NOT RUN`.
- Console cloud-save checkbox: `PASS`; authorized/guest cloud behavior: `NOT RUN`.
- Console leaderboard configuration: `PASS` — `bestscore`, primary, numeric DESC,
  0 decimals, RU `Лучший счёт`, EN `Best score`; leaderboard runtime paths:
  `NOT RUN`.
- Sticky banners: `PASS` — portrait, landscape and desktop disabled and
  persisted; sticky API control disabled and persisted. Interstitial/IAP
  verification: `NOT RUN`.
- Distribution regions: `PASS` — all available regions checked and persisted.
- Developer comment: `PASS` — updated to state `bestscore` and rewarded-only.
- Monetization connection: `PENDING` — Ads page exposed no `Подключить
  монетизацию` button, but the application panel still said monetization was not
  connected. This is treated as expected pre-publication state, not activation
  or real-ad evidence.
- 64-frame/scene white-spot and content scrub: `NOT RUN`.
- Reproducibility, ZIP structure, size, unpacked HTTP smoke: `NOT RUN`.
- Submission media hashes/provenance: `NOT RUN`.
- Yandex draft/debug-panel verification: `FAIL / INCOMPLETE` — draft `574315`
  is accessible, but archive file ID `12624047` is the old `best-score` build;
  current exact-ZIP replacement and SDK/Game Ready/rewarded/save/leaderboard
  debug checks are not done. Both gameplay videos are still processing and no
  playable players are available.

## Sign-off and release decision

QA owner/signature: `NOT RUN`.

Independent Reviewer/signature: `NOT RUN`.

Release Agent/signature: `NOT RUN`.

Current decision: `NOT READY / NO-GO — YANDEX RELEASE CYCLE 09 NOT RUN`; do not
submit to moderation until the old archive is replaced and the exact candidate
passes the required draft/debug checks.

Moderation submission: `N/A — not authorized in Cycle 09`.

Public publication: `N/A — not authorized in Cycle 09`.
