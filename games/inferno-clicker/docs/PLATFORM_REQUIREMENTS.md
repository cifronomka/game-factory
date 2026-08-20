# Platform Requirements — «Зажги»

## Назначение

Документ задаёт внешние платформенные контракты. Первая реализация ориентирована на Yandex Games; VK Mini Apps, generic Web и Android/RuStore являются future adapters и не меняют game core.

## Статус проверки источников

- Yandex Games official SDK/requirements проверены 2026-08-18.
- VK Mini Apps и Android/RuStore не входят в текущий implementation scope; их API и submission rules должны быть повторно проверены по официальным источникам при начале соответствующего adapter. Ни одно предположение ниже не считается разрешением на публикацию.

## Общий контракт и capability policy

Application layer использует только `PlatformService`: `init`, `markReady`, `saveData`, `loadData`, `submitScore`, `getLeaderboard`, `showRewardedAd`, `showInterstitial`, `pauseGame`, `resumeGame`, `subscribePauseChanges`, `getPauseSnapshot`, `dispose`. Core остаётся headless и не импортирует adapter. Реализованные adapters расположены в `src/platforms/yandex`, `web`, `dev`; `vk` и `android` являются future scope.

Любой метод возвращает typed result, а не бросает platform exception в core. Отсутствующая capability скрывает соответствующую CTA или использует явно описанный local fallback. Инициализация платформы ограничена 5 s; после timeout игра продолжает запуск с web adapter.

## Матрица capabilities

| Capability | Yandex — primary | VK — future | Web fallback | Android/RuStore — future | Core при отсутствии |
|---|---|---|---|---|---|
| Init/ready | `YaGames.init`, затем `LoadingAPI.ready` в точный interactive момент | Bridge init после актуальной проверки | immediate local init | native bridge init | продолжить local mode |
| Save/load | local-first + Player data, если доступно | bridge storage/cloud после проверки | versioned localStorage | local/native storage | records остаются локальными |
| Best Score leaderboard | Yandex leaderboard adapter | VK leaderboard/service после проверки | local best only | provider-specific/disabled | CTA leaderboard скрыта |
| Rewarded | Yandex SDK, explicit voluntary CTA | provider ad API после проверки | до Yandex integration: явно маркированный `test` provider; Yandex release: unavailable | provider SDK после проверки | все stages доступны; исчезает только optional ×2 |
| Interstitial | MVP: не вызывается игрой | N/A в MVP | unavailable | N/A в MVP | ничего не происходит |
| Pause/resume | SDK events + ad callbacks + visibility | bridge lifecycle + visibility | Page Visibility/blur | native lifecycle | idempotent local lifecycle |

## Yandex Games — primary

### Initialization и ready

SDK загружается текущим официальным loader `/sdk.js` только на Yandex host и инициализируется через `YaGames.init()`. Generic Web не делает заведомо ошибочный SDK request. `ysdk.features.LoadingAPI?.ready()` вызывается ровно один раз, только когда critical assets загружены (либо после явного retry включён documented procedural fallback), HUD видим, loading overlay снят и первый tap/click может быть принят. Ошибка SDK не блокирует web fallback.

### Gameplay lifecycle

- При фактическом начале/возобновлении active run adapter вызывает `GameplayAPI.start()`.
- При menu pause, hidden tab, окончании run и перед fullscreen/rewarded ad вызывает `GameplayAPI.stop()`.
- `game_api_pause` добавляет pause reason и немедленно останавливает simulation/audio. SDK уже согласует этот event с Gameplay API, поэтому adapter не дублирует `stop()` для самого platform-event.
- `game_api_resume` снимает только platform reason; resume происходит лишь при отсутствии `ad`, `visibility`, `menu` и других reasons. Если local reason остаётся, adapter повторно фиксирует `stop()`, но не делает ложный `start()`.
- Startup ad учитывается через platform pause/resume events; до первого valid resume audio/game clock не стартуют.

### Player data и leaderboard

- Сначала загружается local save, затем при доступном `ysdk.getPlayer()` — cloud data.
- Отказ пользователя от profile data не блокирует игру; неавторизованный пользователь получает local records.
- Merge: максимум для `bestScore`, all-time `highestStageReached`, `longestInfernoHoldMs`, `maxMultiplier` и `runsPlayed`; daily-ritual status объединяется только для совпадающей календарной даты без повторной награды, настройки — более новый `updatedAt`.
- Публичный leaderboard: одно понятное значение **Best Score**, technical name в Yandex Console и adapter — строго `best-score`, integer `0..2_147_483_647`. Submission только при завершении run и только если новый local best прошёл sanity checks. Несовпадение console name является внешним configuration blocker и даёт nonblocking local fallback.
- Leaderboard unavailable/auth-required отображается нейтрально и не открывает login dialog без явного действия игрока.

### Rewarded ads

CTA до запуска явно сообщает: «Посмотреть рекламу и получить ×2 к силе жара на 20 секунд». Gameplay и весь audio паузятся до вызова SDK и остаются paused до terminal callback/platform resume. Reward выдаётся ровно один раз только по rewarded callback и создаёт только queued boost. Close/error/unavailable не меняют heat, score, progression, cooldown или использованный лимит; отображается короткое ненавязчивое сообщение.

### Submission и content

- Только SDK Yandex используется для рекламы; third-party ad code отсутствует.
- Rewarded полностью добровольна и не участвует в stage calculation: stages 1–7, score-run, restart и local records доступны без provider. Она даёт только временный `tapPower ×2` на 20 активных секунд; modal никогда не открывается автоматически.
- Реклама не вызывается неожиданно на tap target или во время активного gameplay.
- Sound/gameplay полностью paused на fullscreen ads.
- Русский интерфейс обязателен; архитектура допускает locale bundles и platform locale.
- Материалы: stylized fantasy без gore, крови, натуралистичного ужаса и откровенного контента; возрастной рейтинг уточняется в console до submission.
- Production ZIP содержит entry `index.html` в корне, относительные URLs и только runtime files; финальные ограничения сверяются в console перед release.

### Официальные источники Yandex, проверены 2026-08-18

- SDK connection: https://yandex.ru/dev/games/doc/ru/sdk/sdk-about
- Game Ready и Gameplay API: https://yandex.ru/dev/games/doc/ru/sdk/sdk-game-events
- Pause/resume events: https://yandex.com/dev/games/doc/en/sdk/sdk-events
- Player data: https://yandex.ru/dev/games/doc/ru/sdk/sdk-player
- Game and ad requirements: https://yandex.com/dev/games/doc/en/concepts/requirements
- SDK moderation checks: https://yandex.com/dev/games/doc/en/requirements/1/19

## VK Mini Apps — future adapter contract

До реализации необходимо проверить актуальные official VK Mini Apps и VK Bridge docs, создать приложение, подтвердить allowed origins/launch params, lifecycle, storage, ads и leaderboard availability. Планируемое поведение: bridge init за adapter boundary, Page Visibility как дополнительный сигнал, local-first save, отсутствие capability — graceful disable. Yandex-specific calls и data shapes не переиспользуются.

Acceptance для будущего adapter добавляется отдельным change request; текущий release может пометить VK criteria `N/A — adapter вне scope`, но не заявлять VK support.

## Generic Web adapter

- Никаких внешних SDK; init немедленный.
- `localStorage` с versioned schema; corrupt data → defaults с сохранением диагностического события.
- Leaderboard скрыт, отображается local Best Score.
- До подключения Yandex current Generic Web/dev review build сообщает `rewardedProvider='test'`: CTA называется строго `Получить ×2 (тест)`, confirm — `Активировать тестовый ×2 на 20 секунд`, а provider асинхронно возвращает тот же idempotent terminal `rewarded` contract без слов «реклама/просмотр».
- Test provider взаимоисключается с Yandex adapter, передаёт `provider=test` в telemetry и не входит в Yandex release configuration. Если test provider выключен, rewarded/interstitial возвращают `unavailable`, а все семь stages и score-run остаются доступны.
- `visibilitychange`, `pagehide`, `blur/focus` управляют reason-set pause; hidden time не уменьшает heat и rewarded duration.
- Web adapter является обязательным dev/E2E fallback и должен проходить contract suite.

## Android / RuStore — future adapter contract

Рекомендуется lightweight WebView/Capacitor-style wrapper только после успешного browser release. Перед работой повторно проверить официальные RuStore требования к package/signing, privacy/data safety, supported Android versions, ads и review artifacts.

Native bridge обязан передавать lifecycle/back button/storage/ad results в тот же `PlatformService`. Android back: сначала закрывает modal/menu, затем запрашивает выход; background/lock немедленно pauses simulation/audio. Web core и баланс не форкаются.

## Platform test matrix

| ID | Platform/environment | Scenario | Измеримый expected result |
|---|---|---|---|
| PL-01 | Yandex debug panel | SDK init + ready | current loader detected; ready отправлен один раз после interactive state |
| PL-02 | Yandex debug panel | start/menu/ad/hidden/resume | gameplay indicator соответствует active/paused; heat/audio не идут в pause |
| PL-03 | Yandex authorized player | save → reload → cloud merge | все record/settings fields восстановлены по schema и merge rules; active run не восстановлен |
| PL-04 | Yandex guest/denied data | полный run | game playable; local record сохраняется; uncaught errors = 0 |
| PL-05 | Yandex rewarded success | accepted reward | один 20 s boost начинается после resume; progression state не меняется; повторной выдачи нет |
| PL-06 | Yandex rewarded close/error | terminal callback | boost/heat/score/progression не меняются; gameplay безопасно resumes |
| PL-07 | Yandex leaderboard | new best | ровно integer Best Score отправлен один раз после end state |
| PL-08 | Generic Web/dev | no SDK/offline | игра запускается; local save и stages 1–7 работают; явно тестовая CTA выдаёт только optional ×2 через общий idempotent contract; ad/leaderboard UI не имитируется |
| PL-09 | Any current target | rapid duplicate pause/resume | reason-set не допускает double resume или tick в pause |

## Перед integration и release

Platform Integration Agent повторно проверяет даты и URLs, актуальные loader/API signatures, moderation checklist, ZIP/package limits и console settings. Изменения требований обновляют этот документ, architecture adapter contract, QA cases и acceptance criteria до release.
