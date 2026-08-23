# Platform Requirements — «Зажги» / Ignite 1.0.0

## Scope и источник истины

Active platform scope — Yandex Release Cycle 09: Desktop, Android и iOS, ориентация `Any`, RU+EN, возраст 12+. TV, VK, RuStore и native wrappers: `N/A — не входят в Cycle 09`. Правила и SDK перепроверены по официальной документации 2026-08-23; snapshot URL зафиксированы ниже и должны быть повторно проверены непосредственно перед отправкой на модерацию.

Game core не импортирует SDK, DOM или provider-specific data. Application использует `PlatformService`; отсутствующая capability возвращает typed result и никогда не блокирует direct-tap gameplay.

## Production target и capabilities

- Production-команда `build:yandex` фиксирует target `yandex`. `/sdk.js` загружается до application entry независимо от hostname; adapter выбирается target-ом, а не `globalThis.YaGames`.
- `YaGames.init()` инициализируется один раз. Timeout/reject переводит remote features в unavailable, но сохраняет local-only игру.
- Test rewarded-provider, `(тест)`, fake-ad UI и бесплатный success callback запрещены во всех Yandex production artifacts.
- `PlatformCapabilities` после init содержит минимум `locale`, `authorized`, `rewarded`, `leaderboardRead`, `leaderboardWrite`, `cloudRead`, `cloudWrite`; provider identity не передаётся в presentation.
- `locale`: `ru/be/kk/uk/uz → ru`, остальные/unknown → `en`, источник — `ysdk.environment.i18n.lang` при startup.

| Capability | Yandex success | SDK/guest/unavailable fallback |
|---|---|---|
| Ready | `LoadingAPI.ready()` once после интерактивной готовности | local app становится интерактивным; remote status unavailable |
| Save/load | local-first + Player data | versioned localStorage, active run не восстанавливается |
| Leaderboard | `best-score`, integer DESC | local Best Score; remote UI нейтрально unavailable |
| Rewarded | официальный `showRewardedVideo` | offer скрыт; бесплатной награды нет |
| Lifecycle | SDK events + browser reason-set | visibility/blur/focus reason-set |
| Interstitial/IAP/sticky | `N/A — не реализуются` | `N/A — не реализуются` |

## Initialization и Game Ready

1. Создать pause coordinator и подписать browser lifecycle до запуска симуляции.
2. Загрузить `/sdk.js`, вызвать `YaGames.init()`, сразу подписать `game_api_pause`/`game_api_resume` и получить environment locale.
3. Параллельно загрузить local save и critical assets; cloud merge не задерживает первый playable screen сверх согласованного timeout.
4. Показать локализованный HUD, убрать loader и убедиться, что touch/mouse input принимается.
5. Вызвать `ysdk.features.LoadingAPI.ready()` ровно один раз. Retry boot не имеет права посылать второй ready.

Yandex debug panel должен показывать корректный SDK init и зелёный Game Ready не позднее 90 секунд; фактическая продуктовая цель ready-to-interactive — p75 ≤3 секунды на согласованном mid-tier Android/4G профиле.

## Gameplay, focus и fullscreen lifecycle

- `GameplayAPI.start()` вызывается при фактическом первом/повторном входе в активный `PLAYING`; `stop()` — при menu, results, hidden, ad и окончании run.
- `game_api_pause`, `game_api_resume`, `visibilitychange`, `pagehide`, `blur/focus`, `menu`, `ad` и `game-ended` входят в единый idempotent reason-set. Снятие одной причины не снимает остальные.
- Startup ad может поставить platform pause до первого run. До valid resume simulation clock и audible sources не стартуют.
- Перед rewarded gameplay и audio остановлены. На pause audio достигает silence ≤100 ms; stale one-shots не проигрываются после resume.
- Hidden/ad/menu время не уменьшает heat и не расходует encounter, animation, boost или cooldown timers; catch-up запрещён.

## Player data

- Сначала синхронно читается local `InfernoSaveV1`; затем при доступности Player API — cloud snapshot.
- Merge использует maxima для `bestScore`, `highestStageReached`, `longestInfernoHoldMs`, `maxMultiplier`, `runsPlayed`; preferences выбираются по более новому `updatedAt`. Активный run, boost и cooldown не persisted.
- Local save записывается сразу. Cloud latest-wins queue объединяет последнюю запись и вызывает `Player.setData` не чаще одного раза за 5 секунд, то есть не более 60 вызовов за 5 минут при непрерывных изменениях.
- Final cloud flush выполняется на results и best-effort на pause/pagehide. Ошибка не откатывает local record и не создаёт unhandled rejection.
- Отказ пользователя от profile data или гостевой режим не вызывает обязательный login dialog и не ограничивает игру.
- В Console включается cloud-save capability. Payload должен оставаться ниже 200 KB; release audit фиксирует фактический размер.

## Leaderboard `best-score`

- В Console создать одно поле `best-score`, numeric integer, descending; имя в adapter совпадает побайтно.
- Использовать актуальные прямые методы `ysdk.leaderboards` и проверять `ysdk.isAvailableMethod` перед read/write.
- Submit только после завершения run, только если integer `0..2_147_483_647` выше последнего подтверждённого local/submitted best. Lower/duplicate/retry не уменьшают и не дублируют запись.
- Read/write unavailable и auth-required отображаются нейтрально; login prompt возможен только после отдельного явного действия игрока, которого в Cycle 09 нет.

## Rewarded

- Единственный placement — `heat-power-2x-60s`, eligible после достижения stage 3 текущей попытки.
- CTA до запуска точно сообщает просмотр рекламы, множитель и 60 активных секунд. Отдельное подтверждение вызывает `ysdk.adv.showRewardedVideo`.
- Reward выдаётся только один раз по `onRewarded`; `onClose` без него, `onError`, timeout без предшествующего `onRewarded` и unavailable дают 0. Уже полученный `onRewarded` не отменяется, если `onClose` отсутствует; terminal timeout лишь освобождает lifecycle. Cooldown 90 active seconds начинается только при reward.
- Повтор разрешён после boost и cooldown; platform frequency limit на дату snapshot отсутствует. Одновременно разрешён один request.
- Все pause/audio/gameplay требования выполняются на протяжении fullscreen lifecycle; progression без provider идентична.

## Desktop и mobile display/input

- Console platforms: Desktop, Android, iOS; orientation: `Any`. TV не выбирать.
- Active game field касается минимум одного края viewport, не искажается и имеет long-side/short-side ratio `≤2`. На ultrawide используются оформленные CSS-боковины.
- Обязательная desktop-матрица: 1280×1024, 1366×768, 1600×900, 1680×1050, 1920×1080, 1920×1200, 2560×1080, 2560×1440, 3840×2160; zoom 80%, 100%, 125%.
- Mobile: portrait/landscape Android и iOS, safe areas, rotation, virtual browser chrome и `visualViewport`. Минимальные interactive targets 48×48 CSS px, flame target 96×96 CSS px.
- Touch gestures, long press, context menu, drag/select, callout, swipe refresh и page scroll не перехватывают gameplay. Mouse primary click работает на desktop; right click ничего не активирует.
- Browser QA: Yandex Browser, Chrome, Firefox, Opera и Safari; Android 5+ и iOS 9+ compatibility подтверждается build/runtime test, а не только современным Chromium.

## Submission/content configuration

- Card titles: RU `Зажги`, EN `Ignite`; age `12+`; categories `Аркады / Arcade` и `Казуальные / Casual`.
- RU+EN About и How to play берутся без изменений из `releases/yandex-submission-1.0.0/`.
- Из видимых art/text удалены руны, ритуальные/религиозные знаки и узнаваемая эзотерика. Видимые имена: `Хранительница угасания / Ember Warden`, `Огненное кольцо / Fire Ring`.
- Только rewarded monetization. Interstitial, sticky, IAP и third-party ads не включать.
- ZIP распакованным `<90 MB` при platform limit 100 MB; `index.html` в корне; относительные URLs; имена путей без Cyrillic/spaces; dev/test files отсутствуют.
- Минимум 4 desktop screenshots 16:9 и 4 mobile screenshots 9:16; actual gameplay ≥70%; icon/cover не являются скриншотами.
- Draft upload и debug-panel verification обязательны до release PASS. Submission to moderation/public publish не выполняются без отдельного разрешения.

## Platform verification matrix

| ID | Сценарий | Expected | Текущий статус |
|---|---|---|---|
| PL09-01 | SDK success/failure + Game Ready | target всегда Yandex; ready once; failure playable local-only | NOT RUN |
| PL09-02 | RU-group/other/unknown locale | RU/EN mapping и все visible/ARIA strings локализованы | NOT RUN |
| PL09-03 | gameplay/menu/hidden/platform/ad/results lifecycle | indicator, simulation и audio точно соответствуют state | NOT RUN |
| PL09-04 | authorized cloud save/merge/rate limit/flush | maxima не теряются; ≤1 write/5 s; active run не restored | NOT RUN |
| PL09-05 | guest/denied/cloud error | full game local-only; login не навязывается; errors=0 | NOT RUN |
| PL09-06 | rewarded success ×2 | один 60 s boost; следующий success ≥90 active s; repeated allowed | NOT RUN |
| PL09-07 | close/error/timeout без prior `onRewarded`/duplicate/late | reward/cooldown/progression mutation=0; earned reward после prior `onRewarded` сохраняется один раз; safe retry/resume | NOT RUN |
| PL09-08 | leaderboard new/lower/duplicate/unavailable | one improved integer submit; graceful fallback | NOT RUN |
| PL09-09 | desktop/mobile/rotation/zoom/input | no crop/distortion/page gesture; targets accessible | NOT RUN |
| PL09-10 | uploaded Yandex draft | SDK/Game Ready/reward/cloud/leaderboard verified on exact ZIP SHA | NOT RUN |

## Official Yandex snapshot — checked 2026-08-23

- Общие требования: https://yandex.ru/dev/games/doc/ru/concepts/requirements
- Подключение SDK: https://yandex.ru/dev/games/doc/ru/sdk/sdk-about
- Game Ready и Gameplay API: https://yandex.ru/dev/games/doc/ru/sdk/sdk-game-events
- SDK pause/resume: https://yandex.ru/dev/games/doc/ru/sdk/sdk-events
- Rewarded/interstitial API: https://yandex.ru/dev/games/doc/ru/sdk/sdk-adv
- Player data: https://yandex.ru/dev/games/doc/ru/sdk/sdk-player
- Leaderboards: https://yandex.ru/dev/games/doc/ru/sdk/sdk-leaderboard
- Автоопределение языка: https://yandex.ru/dev/games/doc/ru/requirements/2/14
- Длительность/реиграбельность: https://yandex.ru/dev/games/doc/ru/requirements/2/9
- Механики: https://yandex.ru/dev/games/doc/ru/requirements/2/4
- Адаптивное отображение: https://yandex.ru/dev/games/doc/ru/requirements/1/10
- Проверки SDK: https://yandex.ru/dev/games/doc/ru/requirements/1/19
- Возрастной рейтинг: https://yandex.ru/dev/games/doc/ru/requirements/2/7
- Новый черновик и платформы: https://yandex.ru/dev/games/doc/ru/console/add-new-game/draft
- Проверка игры: https://yandex.ru/dev/games/doc/ru/console/test-game
- Модерация: https://yandex.ru/dev/games/doc/ru/concepts/moderation

Любое изменение официальной страницы после snapshot открывает platform review; документация не является разрешением на фактическую публикацию.
