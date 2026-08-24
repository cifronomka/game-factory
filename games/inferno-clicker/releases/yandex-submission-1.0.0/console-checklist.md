# Yandex Console configuration — 1.0.0

Every row starts `NOT RUN`; mark PASS only with Console evidence tied to the draft ID.

Historical environment check on 2026-08-23: the available browser redirected to
Yandex ID authorization, so no Console work was completed in that session. The
active Console workflow targets draft `574315`. On 2026-08-25 the four localized
card-media files were uploaded, saved and verified after a page reload; their
Console file IDs are recorded below. Other rows remain `NOT RUN` until matching
evidence is collected. Nothing here authorizes moderation or publication.

| Field | Exact value | Status |
|---|---|---|
| Draft | Existing draft `574315`; do not reuse a different published game | PASS — media persisted after reload |
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
| RU icon | `icon-512-ru.png` — 512×512, 568,165 B, deep-red (not gold) title `ЗАЖГИ`, SHA-256 `224e287d57cb72fbd51cdff861ded5986604b5f9a25a1b3495dc0613222f065a` | PASS — file ID `12625231` |
| EN icon | `icon-512-en.png` — 512×512, 542,576 B, deep-red (not gold) title `IGNITE`, SHA-256 `d5106f33d472b56f3618738b27607dc220338a17a85aed4c1ba44aa84d7b0996` | PASS — file ID `12625244` |
| RU cover | `cover-800x470-ru.png` — 800×470, 828,367 B, deep-red (not gold) title `ЗАЖГИ`, SHA-256 `e4425c885c7f4d1ce4692078b6eb85b2f24aff5b917165bd7227c1fd9c5454d5` | PASS — file ID `12625237` |
| EN cover | `cover-800x470-en.png` — 800×470, 825,592 B, deep-red (not gold) title `IGNITE`, SHA-256 `e17433ffaf07ff55d7ddab86c1eac6b43d6856105199741a79fe03388fd104cb` | PASS — file ID `12625250` |
| Shared card-media fallback | If the Console exposes only one shared icon/cover field, use `icon-512.png` and `cover-800x470.png`; both are exact RU aliases. | N/A — localized RU/EN fields were available |
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
- Exact localized card-media files from the four hash-bound rows above were
  uploaded, saved and persisted after reload in draft `574315`: `PASS` (RU icon
  `12625231`, RU cover `12625237`, EN icon `12625244`, EN cover `12625250`).

После сбора скриншотов/видео/логов оформить `yandex-console-draft` JSON по контракту `scripts/verify-yandex-draft.mjs`: exact RC bytes/build/package SHA, оба названия и `availabilityChecked/available=true`, структурированные rewarded success/close/error + 60/90 active-time/pause/audio, нулевые console/network counters и десять hash-bound artifacts. Затем выполнить `npm run verify:draft:yandex -- --evidence=<console-evidence.json>`. Команда append-only проверяет черновик без rebuild, rename, модерации или публикации.
