# Official Yandex requirements snapshot — 2026-08-23

This snapshot records sources used for Cycle 09. Official pages must be rechecked immediately before moderation; a changed rule reopens platform review.

| Topic | Official URL | Cycle 09 decision |
|---|---|---|
| General/game/content/media requirements | https://yandex.ru/dev/games/doc/ru/concepts/requirements | SDK required; content/media/layout/error rules are release gates |
| SDK connection | https://yandex.ru/dev/games/doc/ru/sdk/sdk-about | `/sdk.js` before app, explicit Yandex target |
| Game Ready/Gameplay API | https://yandex.ru/dev/games/doc/ru/sdk/sdk-game-events | ready once at interactive state; accurate start/stop |
| SDK pause/resume | https://yandex.ru/dev/games/doc/ru/sdk/sdk-events | early subscription and reason-set lifecycle |
| Advertising | https://yandex.ru/dev/games/doc/ru/sdk/sdk-adv | voluntary rewarded, grant only onRewarded; no platform frequency cap found |
| Player data | https://yandex.ru/dev/games/doc/ru/sdk/sdk-player | local-first/cloud merge; payload/rate limits observed |
| Leaderboards | https://yandex.ru/dev/games/doc/ru/sdk/sdk-leaderboard | guarded direct API; `best-score` numeric DESC |
| Language auto-detection | https://yandex.ru/dev/games/doc/ru/requirements/2/14 | environment language used at startup; RU/EN fallback mapping |
| Content duration/replayability | https://yandex.ru/dev/games/doc/ru/requirements/2/9 | short runs supported by records/goals and 10–15+ minute session |
| Game mechanics | https://yandex.ru/dev/games/doc/ru/requirements/2/4 | gameplay and controls fully described; ad not progression gate |
| Responsive display | https://yandex.ru/dev/games/doc/ru/requirements/1/10 | desktop/mobile resize/orientation/ratio matrix |
| SDK moderation checks | https://yandex.ru/dev/games/doc/ru/requirements/1/19 | debug-panel SDK/ready checks required |
| Age rating | https://yandex.ru/dev/games/doc/ru/requirements/2/7 | target 12+ with stylized non-gory content |
| Draft fields/media | https://yandex.ru/dev/games/doc/ru/console/add-new-game/draft | icon 512×512 PNG; cover 800×470 PNG; required screenshots |
| Gameplay preview video fields | https://yandex.ru/dev/games/doc/ru/console/add-new-game/draft | optional MP4; horizontal 16:9 or vertical 9:16; height at least 400 px; duration no more than 28 s; file no more than 100 MB. Rechecked 2026-08-25 |
| Non-ad gameplay-video content | https://yandex.ru/dev/games/doc/ru/concepts/requirements | section 5.1.1.3: real gameplay occupies at least 70% of video duration; remaining time may be visual treatment. Rechecked 2026-08-25 |
| Draft testing/debug | https://yandex.ru/dev/games/doc/ru/console/test-game | exact uploaded candidate must pass test environment |
| Debug panel | https://yandex.ru/dev/games/doc/ru/console/debug-panel | SDK, connection and focus tests captured |
| Moderation | https://yandex.ru/dev/games/doc/ru/concepts/moderation | submission/publication remains separate authorization |

Snapshot verification: `PASS — base URLs and image dimensions rechecked against official pages on 2026-08-23; gameplay-video limits and 70% duration rule rechecked on 2026-08-25`. Pre-moderation revalidation: `NOT RUN`.

Final local gameplay-video revalidation after the audio pass: `PASS` —
horizontal 22.486667 s / 24,958,383 B / SHA-256
`08ff5285a9a46c28f74cf3b1562505f21c61fe1968f7f19450dc406ec1c9e144`;
vertical 22.5155 s / 25,093,830 B / SHA-256
`20d38ecae8aefebc9fee6b8858ebc843606764c1e73b57a4ee08ea4d3292c190`.
Both contain stereo AAC at 48 kHz with non-zero RMS and sub-unity peak.
Yandex Console state at 2026-08-25 22:57:24 MSK: RU exact-file
upload/save/reload and EN `Использовать значение русского черновика`
save/reload are `PASS`; processing/playback are `PENDING`, and file IDs are
`NOT RUN`. Draft completion was RU 92% and EN 92%. This does not constitute a
full Console or pre-moderation PASS.
