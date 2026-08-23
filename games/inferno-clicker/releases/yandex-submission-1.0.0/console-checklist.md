# Yandex Console configuration — 1.0.0

Every row starts `NOT RUN`; mark PASS only with a console screenshot/export tied to the draft ID.

Environment check on 2026-08-23: `BLOCKED — https://games.yandex.ru/console/ redirected the available in-app browser to Yandex ID authorization; connected Chrome control was unavailable. No credentials were requested or entered, no draft was created, and no archive was uploaded.` This is the explicit external blocker defined by the Cycle 09 contract; it does not authorize renaming, moderation, or publication.

| Field | Exact value | Status |
|---|---|---|
| Draft | Create a new game draft; do not reuse a different published game | NOT RUN |
| RU title | `Зажги` | NOT RUN |
| EN title | `Ignite` | NOT RUN |
| Title uniqueness | Confirm both localized titles are available in the catalog; conflict is an external blocker and does not authorize renaming | NOT RUN |
| Languages | Russian, English | NOT RUN |
| Platforms | Desktop, Mobile Android, Mobile iOS | NOT RUN |
| TV | Off — not supported in Cycle 09 | NOT RUN |
| Orientation | Any | NOT RUN |
| Age rating | 12+ | NOT RUN |
| Categories | Arcade and Casual equivalents in the Console | NOT RUN |
| Monetization | Rewarded only | NOT RUN |
| Interstitial/sticky/IAP | Off — not implemented | NOT RUN |
| Cloud saves | On | NOT RUN |
| Leaderboard | `best-score`, numeric integer, descending | NOT RUN |
| Archive | Upload exact `inferno-clicker-1.0.0-rc.zip` SHA from the generated local RC report; final name is forbidden before draft verification | NOT RUN |
| Allowed hosts | Only hosts actually required by Yandex SDK/game package; no third-party ad or analytics host | NOT RUN |
| RU copy | Paste exactly from `metadata-ru.md` | NOT RUN |
| EN copy | Paste exactly from `metadata-en.md` | NOT RUN |
| Icon | `icon-512.png` | NOT RUN |
| Cover | `cover-800x470.png` | NOT RUN |
| Screenshots | `desktop-01..04-1920x1080.png`, `mobile-01..04-1080x1920.png` | NOT RUN |
| Countries | Platform default distribution appropriate for RU+EN; no extra exclusion requested | NOT RUN |
| Moderation submit | N/A — separate user authorization required | N/A — outside Cycle 09 |
| Public release | N/A — separate user authorization required | N/A — outside Cycle 09 |

## Draft verification

- SDK initialized and production target contains no test provider: `NOT RUN`.
- LoadingAPI/Game Ready green once after interactive state: `NOT RUN`.
- Gameplay start/stop and SDK pause/resume match active state on desktop/mobile: `NOT RUN`.
- RU-group locale→RU and another locale→EN: `NOT RUN`.
- Real rewarded success gives one 60-second boost; close/error gives none; repeat obeys 90 active seconds: `NOT RUN`.
- Authorized cloud merge/rate limit/reload and guest local-only flow: `NOT RUN`.
- `best-score` improved/lower/duplicate/unavailable paths: `NOT RUN`.
- Exact uploaded ZIP SHA equals tested and promoted artifact: `NOT RUN`.

После сбора скриншотов/видео/логов оформить `yandex-console-draft` JSON по контракту `scripts/verify-yandex-draft.mjs`: exact RC bytes/build/package SHA, оба названия и `availabilityChecked/available=true`, структурированные rewarded success/close/error + 60/90 active-time/pause/audio, нулевые console/network counters и десять hash-bound artifacts. Затем выполнить `npm run verify:draft:yandex -- --evidence=<console-evidence.json>`. Команда append-only проверяет черновик без rebuild, rename, модерации или публикации.
