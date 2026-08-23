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
| Draft testing/debug | https://yandex.ru/dev/games/doc/ru/console/test-game | exact uploaded candidate must pass test environment |
| Debug panel | https://yandex.ru/dev/games/doc/ru/console/debug-panel | SDK, connection and focus tests captured |
| Moderation | https://yandex.ru/dev/games/doc/ru/concepts/moderation | submission/publication remains separate authorization |

Snapshot verification: `PASS — URLs and image dimensions rechecked against official pages on 2026-08-23`. Pre-moderation revalidation: `NOT RUN`.

