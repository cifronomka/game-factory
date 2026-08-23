# Yandex Release Cycle 09 — «Зажги» / Ignite 1.0.0

## Статус, приоритет и границы

Cycle 09 — активный релизный контракт для адаптации проверенного C08 baseline к Яндекс Играм. Он имеет приоритет над конфликтующими формулировками предыдущих циклов только в вопросах rewarded, локализации, Yandex SDK/lifecycle, облачных сохранений, leaderboard, browser compatibility, responsive layout, видимого контента, новых целей, QA и упаковки 1.0.0. Принятые числовые правила heat/score/decay, прямое управление, семь стадий, существующая анимация и audio mix наследуются, пока отдельный Cycle 09 regression не докажет их сохранность.

Исторические artifact/report/checksum 0.1.0 и 0.1.1 не изменяются и не пересобираются. Рабочий candidate имеет версию `1.0.0`; его exact Build ID, commit, ZIP, checksum и Yandex draft ID имеют статус `NOT RUN — candidate ещё не прошёл release gate`.

В scope: Desktop, Android и iOS в ориентации `Any`, мышь и touch, RU+EN, 12+, rewarded, local/cloud records, leaderboard `best-score`, визуальная/content-проверка, submission pack и проверка нового черновика. TV, IAP, sticky banner, interstitial, third-party ads, VK и RuStore — `N/A — не входят в Cycle 09`. Отправка на модерацию и публичная публикация — `N/A — требуют отдельного разрешения пользователя`.

## Продуктовая сессия и реиграбельность

- Один score-run остаётся коротким: ориентир первой попытки `3–6 минут`, первый Инферно — `90–180 секунд` активного времени. Контентная сессия должна мотивировать `10–15+ минут` через несколько попыток, рекорды, восемь постоянных значков и явно показанную ближайшую цель.
- Все стадии, restart, local records и улучшение Best Score доступны без рекламы, сети, облака, leaderboard и авторизации.
- Панель `Цели / Goals` и строка ближайшей цели на result screen вычисляются из `InfernoSaveV1`; отдельная валюта, награда или новая версия save schema не нужны.
- Порядок значков и следующей цели фиксирован согласно release-плану: достичь стадий 3, 5 и 7; завершить 3 и 10 попыток; удерживать Инферно 30 и 60 секунд; получить Best Score 250 000. Следующая цель — первый невыполненный пункт этого порядка. Выполненные цели не откатываются при merge или reload.
- Обязательная QA-доказательность — четыре осмысленные сессии по `≥12 минут`: desktop/mobile × rewarded/no-reward. Каждая включает несколько попыток, экран результатов, goals/nextGoal, persistence и отсутствие progression gate.

## Rewarded-контракт

- Единственный placement: internal ID `heat-power-2x-60s`; UI RU: `Посмотреть рекламу — ×2 к силе жара на 60 секунд`, EN: `Watch an ad — ×2 heat power for 60 seconds`.
- Eligibility начинается в текущей попытке при первом `runHighestStage ≥3`. Persisted `highestStageReached` сам по себе не делает новую попытку eligible.
- Opener — компактная неблокирующая DOM/CSS-плашка вне flame target. Она видима только в safe `PLAYING`, когда нет encounter, pause/modal, active boost, cooldown или pending request. Визуальный flame crossfade не является gameplay state и сам по себе не блокирует предложение. Автопоказ и автозапуск запрещены.
- Нажатие opener только открывает confirm sheet и ставит `menu` pause reason. Отдельное подтверждение заменяет его на `ad`, останавливает gameplay/audio и вызывает `ysdk.adv.showRewardedVideo`.
- Только первый `onRewarded` конкретного request ID ставит queued boost. После valid resume `tapPower ×2` действует `60 000 ms` активного gameplay; pause, hidden, menu, ad и background не расходуют boost.
- Cooldown начинается в момент `onRewarded` и длится `90 000 ms` активного gameplay. Он переносится между попытками текущей app session, но не сохраняется после полного relaunch. Поскольку boost длится 60 секунд, при непрерывной игре следующий offer может вернуться не ранее чем через 30 секунд после окончания boost.
- Повторные успешные rewarded разрешены в одной попытке и сессии после boost/cooldown. Одновременно существует максимум один request. Duplicate/late callbacks ничего не выдают.
- `onClose` без `onRewarded`, `onError`, timeout без предшествующего `onRewarded` и unavailable дают ноль награды, не запускают cooldown и после terminal cleanup разрешают новый добровольный запрос. Если `onRewarded` уже пришёл, отсутствие `onClose` не отменяет честно заработанную награду; terminal timeout только освобождает lifecycle. Duplicate/late callbacks не меняют heat, score, stage, records или progression повторно.
- Boost меняет только heat-часть tapPower. Assisted heat не добавляет прямые tap-score points; stage thresholds, multiplier, decay, events и leaderboard остаются общими для rewarded/no-reward runs.
- Platform frequency limit со стороны Яндекса отсутствует на дату snapshot; `90 секунд` — внутренний guardrail продукта, а не требование платформы.

## SDK, локализация и данные

- Production target `yandex` загружает `/sdk.js` до application entry независимо от hostname. Выбор адаптера определяется build target, а не наличием `globalThis.YaGames`.
- Yandex production никогда не включает test rewarded-provider, fake-ad UI или бесплатную terminal-success ветку. При init/SDK/ad failure игра продолжает local-only, а rewarded/remote leaderboard становятся unavailable.
- `YaGames.init()` выполняется один раз. `LoadingAPI.ready()` вызывается один раз после загрузки critical assets, снятия loader, видимого HUD и готовности принять первый input.
- `GameplayAPI.start/stop`, `game_api_pause/resume`, `visibilitychange`, `blur/focus`, menu, result и ad управляются единым idempotent pause-reason set. Hidden/ad время не тикает; audio достигает тишины ≤100 ms; resume происходит только после снятия всех причин.
- Locale берётся при startup из `ysdk.environment.i18n.lang`: `ru`, `be`, `kk`, `uk`, `uz` → `ru`; остальные/unknown → `en`. Локализуются title, HUD, стадии, goals, dialogs, errors, status, ARIA и instructions. Core хранит IDs/числа и не импортирует SDK/locale bundles.
- Local save выполняется сразу. Cloud latest-wins queue объединяет record maxima и пишет не чаще одного `Player.setData` за 5 секунд; final flush выполняется на result и best-effort при lifecycle pause/pagehide. Active run не сохраняется.
- Public leaderboard technical name — `best-score`, integer DESC `0..2_147_483_647`. Перед вызовом используется актуальный `isAvailableMethod`; submit — только новый завершённый local best. Guest/denied player играет и сохраняется локально без навязанного login dialog.

## Compatibility, content и package

- Один production bundle не зависит от native ESM в runtime и имеет согласованные fallbacks для input, fetch/XHR, layout и WebP→PNG. Для одного asset загружается только выбранный формат.
- Root использует `100vh` fallback плюс `100svh/100dvh`, safe-area insets и `visualViewport`; resize, zoom, rotation и обе ориентации не обрезают HUD/modal. Active field касается края viewport, сохраняет aspect ratio не шире `2:1`, а ultrawide боковины оформлены как часть сцены.
- `touch-action`, overscroll, context menu, drag/select и iOS callout не должны перехватывать gameplay. Основные targets — не менее 48×48 CSS px, flame target — не менее 96×96 CSS px.
- Из видимого RU/EN текста и production art удаляются руны, ритуальные/религиозные знаки и узнаваемая эзотерическая символика. Видимые названия: `Хранительница угасания / Ember Warden` и `Огненное кольцо / Fire Ring`. Internal legacy asset IDs допустимы только как невидимые implementation details.
- Все 64 runtime character frames и seven-stage runtime повторно проверяются на black, neutral gray и dark red при DPR 1/2/3. White matte, neutral islands, detached alpha, internal-gap residue, sticker edge, crop и фильтр-усиленный fringe count должны быть `0`.
- ZIP: один `index.html` в корне, только relative runtime paths, без Cyrillic/spaces в именах, source maps, tests, mocks, docs, secrets и dev provider; распакованный размер `<90 MB`, decoded textures `≤64 MiB`.

## Stop condition

Cycle 09 DONE только когда все новые Cycle 09 строки в `ACCEPTANCE_CRITERIA.md` имеют `PASS` на одном clean exact candidate; Critical=0, High=0, skipped required checks=0; QA→fix→independent retest→neighboring regression завершён; RU/EN submission pack не содержит незаполненных обязательных полей; тот же ZIP и SHA-256 прошёл unpacked smoke и Yandex draft/debug-panel verification. До этого release status: `NOT READY — CYCLE 09 NOT RUN`.
