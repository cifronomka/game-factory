# Product Spec — «Зажги»

## Active corrective scope — Cycle 06

Cycle 06 improves perceived quality without changing the game. Automatic presentation-quality adaptation is silent and must not claim that the user's device is weak. The Ash Servant remains the same character but no longer flickers: it has genuinely smooth authored idle/exhale/recovery and visibly exhales scarlet snowflakes from its mouth. The Demoness retains the approved sovereign identity at higher clarity, uses more genuine transition frames and attacks with blue conical ice shards that evaporate into steam at the flame. All character edges are clean, and the accepted Inferno-host entrance leads into clearly living authored motion rather than a static plate.

These are presentation requirements, not new mechanics. Gameplay balance/progression/input/reward/platform behavior, flame/environment design and audio assets/mix are frozen. Accessibility/performance tiers may reduce optional density or filters, but never remove the readable mouth→snowflake→flame or hand→ice→contact→steam causal chain.

## Назначение

Документ определяет продуктовую цель, аудиторию, ограничения и измеримые признаки успеха browser-first HTML5-игры «Зажги». Детальные игровые правила зафиксированы в `GAME_DESIGN.md`, техническая реализация — в `TECHNICAL_ARCHITECTURE.md`.

## Elevator pitch

«Зажги» — короткая портретная tap/click-игра, в которой игрок раздувает едва живой уголёк, открывает скрытый во тьме харизматичный инфернальный мир и затем пытается как можно дольше удержать рискованное состояние Инферно ради личного рекорда.

## Целевая аудитория

- Основной сегмент: пользователи Яндекс Игр 12+, которым нравятся понятные за 5 секунд аркады, incremental/clicker-feedback и выразительная dark-fantasy эстетика без хоррора.
- Контекст игры и устройства: короткие сессии 3–6 минут на телефоне в портретной ориентации; также поддерживается мышь на desktop. Игра рассчитана на запуск из каталога без предварительного знания правил и допускает игру без звука.
- Возраст/ограничения: целевой рейтинг 12+ подлежит подтверждению при публикации. Запрещены кровь, gore, натуралистичные ужасы, шок-контент, сексуализация и откровенный контент. Инфернальные существа стилизованные, читаемые и скорее дерзкие, чем пугающие.

## Платформы

- Primary: Яндекс Игры, browser-first HTML5, touch и mouse, портретный mobile layout с адаптацией для desktop.
- Secondary/future: generic web как обязательный fallback; VK Mini Apps и Android/RuStore wrapper как будущие адаптеры. Ни одна продуктовая механика не должна требовать конкретного SDK для базовой игры.

## Основной пользовательский сценарий

1. Пользователь открывает игру и за время не более 5 секунд после появления интерактивного экрана видит почти тёмную сцену, едва заметный уголёк и короткую подсказку «Жми, чтобы разжечь».
2. Первый tap/click немедленно усиливает свет, огонь и звук; подсказка исчезает после первого ввода и более не прерывает игру.
3. Игрок повышает `heat` и получает всё более высокий stage multiplier; каждый корректный tap имеет полную базовую силу, а рост decay требует постепенно нажимать быстрее.
4. Начиная с третьей стадии мир отвечает телеграфируемыми помехами, временно усиливающими decay. Пепельный слуга и Демонесса могут действовать одновременно, но показываются отдельными статусами, а их общий множитель ограничен `×2,50`. Они не добавляют управление или tap-комбинации: игрок продолжает разжигать огонь прямыми нажатиями.
5. Все семь стадий доступны только через прямые taps и возрастающий decay: порог стадии 5 равен `560`, а общий предел heat — `1000`; permission, реклама или отдельная progression gate для crossing отсутствуют.
6. После достижения stage 4 и `45 с` активного gameplay игрок может добровольно открыть sheet усиления и получить `tapPower ×2` на `20 с` активного gameplay. Усиление ускоряет набор heat, но ничего не разблокирует.
7. Пока настоящая rewarded-реклама не подключена, Web/dev показывает честно подписанную CTA «Получить ×2 (тест)» и через тот же `PlatformService`/terminal-success contract запускает временный boost без имитации рекламного ролика. Production Yandex позднее заменяет test stub официальным rewarded callback.
8. После первого входа в Инферно цель меняется с раскрытия сцены на удержание жара и улучшение `Best Score` и времени удержания Инферно.
9. Когда пламя полностью угасает, игрок получает экран результата с очками, достигнутой стадией, временем Инферно, личными рекордами и одной основной кнопкой «Разжечь снова».

## Ключевая ценность

- Любопытство материализовано в механике: каждый новый диапазон жара действительно открывает ранее скрытую часть сцены, а не только меняет число.
- Управление остаётся одношаговым и прямым: каждый корректный tap обрабатывается полностью, даёт score, heat и немедленный feedback вплоть до общего cap `1000`.
- Прогресс ощущается сразу через синхронный свет, огонь, окружение, звук, multiplier и stage feedback.
- Седьмая стадия не является концом контента: после её открытия появляется skill-based задача удержания Инферно и охота за личным/публичным рекордом.
- Rewarded placement оформлен как необязательное ускорение: его отсутствие, ошибка или закрытие не ограничивают ни одну стадию и не открывают модальное окно автоматически.
- Визуальный product intent: огонь должен ощущаться живым через sprite/frame animation, а персонажи — через различимые appearance, idle и attack-состояния. Audio intent — спокойный огонь и воздушный шум раздувания/атаки; частота taps не создаёт ритм или обязательный per-tap звук.
- Качество анимации достигается настоящими authored in-between кадрами, а не мерцанием или наложением далёких поз. Белая кайма, грубый matte, размытие из-за чрезмерного upscale и статичная жизнь персонажей неприемлемы.

## Продуктовый scope и ограничения

- Версия 1.0: один основной режим, одна сцена с семью состояниями раскрытия, одна базовая схема управления, один публичный leaderboard `Best Score`, четыре локальных рекорда и один rewarded-placement.
- Вне scope 1.0: сюжетная кампания, магазин, покупки, валюта, инвентарь, аккаунтная прокачка, PvP, социальные кланы, обязательные interstitial ads и процедурная генерация уровней.
- Candidate 0.1.0 реализует утверждённый scope; новые режимы, economy и дополнительные платформы не входят в текущий release и требуют change request.
- Direct-tap score-run, все семь стадий, restart, локальные рекорды и настройки доступны без рекламы, авторизации, leaderboard и сети. Rewarded/test provider даёт только необязательный временный boost.
- Ввод: touch/pointer на мобильном и основной mouse click на desktop. Клавиатурная активация не входит в обязательную acceptance-matrix 1.0, но может быть добавлена как тот же логический `tap` без изменения core rules.
- Интерфейс: приоритет портретным viewport 360×640–430×932 CSS px; обязательная адаптация desktop без растягивания ключевых контролов за удобную область.
- Tap-target центрального огня и основные кнопки должны иметь интерактивную область не менее 48×48 CSS px; primary flame zone — не менее 96×96 CSS px.
- Быстрый запуск: продуктовая цель — интерактивный core screen не позднее 3 секунд после начала загрузки на согласованном QA-профиле; точный профиль сети и устройства фиксируется в `QA_PLAN.md`.
- Сессия должна корректно ставиться на паузу при скрытии вкладки, системной паузе и показе рекламы; скрытое время не начисляет score, не уменьшает heat и не расходует boost.
- В сцене не должно быть вспышек чаще 3 Гц; должен существовать режим reduced motion, убирающий интенсивную тряску, distortion и лишние частицы без потери игрового сигнала.
- Текст 1.0 — русский; архитектура строк должна допускать локализацию. Game core не импортирует Yandex SDK и общается только через `PlatformService`.

## Продуктовые риски

| Риск | Вероятность | Влияние | Ранний сигнал | Митигация | Владелец |
|---|---|---|---|---|---|
| Однообразное бесконечное нажатие | Высокая | Высокое | более 50% тестеров называют второй минутный отрезок повторением первого; одинаковая частота ввода на протяжении >30 с | семь крупных visual milestones, телеграфируемые decay-события на стадиях 3/5, friendly Heat Window на 6+, смена цели после входа в Инферно | Product/Game Designer |
| Физическая усталость от быстрого tapping | Высокая | Высокое | жалоба на усталость у >20% тестеров либо обязательная частота >10 taps/с дольше 30 с | V5 canonical использует 2→7,14 taps/с, помехи короткие, fail имеет grace; реальные taps не ослабляются и не отбрасываются | Product/Game Designer + QA |
| Все семь стадий раскрываются слишком быстро | Средняя | Высокое | >35% новых игроков достигают Инферно быстрее 90 с без boost | целевое первое достижение `90–180 с` при постепенном ускорении; корректировать только документированные intervals/decay после расчёта и rebaseline | Product/Game Designer |
| Инферно кажется недостижимым | Средняя | Высокое | <8% первых завершённых сессий достигают стадии 7 | onboarding до стадии 2, direct no-reward V5 fixture, human-input profiles и tap-rate matrix; разрешён только рассчитанный тюнинг decay/дебаффов без скрытого ослабления taps | Product/Game Designer + QA |
| После первого Инферно нет причины возвращаться | Средняя | Высокое | медиана дополнительных сессий после первого достижения <1 | `Best Score`, longest Inferno hold, max multiplier, экран следующего достижимого рекорда и необязательный ежедневный ритуал без streak-loss | Product/Game Designer |
| Rewarded boost воспринимается как обязательный paywall | Средняя | Высокое | >10% игроков считают stage 5+ недоступными без provider | все семь стадий проходят no-reward V5 и skilled-mouse traces; CTA обещает только временный ×2, close/error/unavailable не меняют progression | Monetization + Product |
| Реклама ломает аудио/таймер/состояние | Средняя | Высокое | heat, score или boost меняются во время ad lifecycle; повторная награда | pause/resume contract, reward только после confirmed callback и ровно один раз, regression tests | Platform Integration + QA |
| Тёмная сцена нечитаема на мобильном экране | Средняя | Высокое | >10% тестеров не находят огонь за 5 с; элементы сливаются на low-brightness profile | минимальный контраст интерактивного уголька, onboarding pulse, visual QA на целевых viewport/brightness | Art + QA |
| Эффекты перегружают слабые устройства или вызывают дискомфорт | Средняя | Высокое | FPS ниже бюджета, input latency выше 100 мс, жалобы на мерцание/тошноту | performance tiers, reduced motion, particle caps и запрет частых вспышек | Architect + Art + QA |
| Dark-fantasy тема конфликтует с рейтингом/правилами площадки | Низкая | Высокое | модерация отмечает сексуализацию, жестокость или шок-контент | stylized casual подача, отсутствие gore/крови/откровенности, pre-release content audit | Product + Art + Platform |
| Leaderboard недоступен без авторизации/SDK | Средняя | Среднее | submit/get возвращают unavailable | локальный `bestScore`, мягкое скрытие публичного leaderboard, повтор отправки только через adapter | Platform Integration |

## KPI / метрики успеха

Цели являются launch-гипотезами и пересматриваются после накопления не менее 1 000 валидных первых сессий. «Валидная сессия» начинается с первого принятого ввода, длится не менее 10 секунд и не является внутренним/QA-трафиком.

| Метрика | Определение | Baseline | Цель | Окно измерения | Источник |
|---|---|---:|---:|---|---|
| First-input conversion | валидные загрузки с первым tap/click ≤5 с / интерактивные загрузки | N/A — новый продукт | ≥85% | первые 1 000 загрузок | product analytics |
| Stage 2 comprehension | первые сессии, достигшие «Искры» ≤20 с / валидные первые сессии | N/A | ≥80% | первые 1 000 первых сессий | game events |
| First-session stage funnel | доля первых сессий, достигших стадий 3 / 5 / 7 | N/A | ≥65% / ≥30% / 8–25% | первые 1 000 первых сессий | `stage_enter` events |
| Time to first Inferno | медиана активного времени до первого входа в стадию 7 | N/A | 90–180 с | первые 300 достижений | game events |
| Session length | медиана активной длительности валидной сессии | N/A | 3–6 мин | первые 1 000 сессий | session events |
| Repeat-session rate | пользователи с ≥2 валидными сессиями за 24 ч / новые пользователи | N/A | ≥30% | rolling 14 days | anonymized analytics |
| D1 retention | новые пользователи, вернувшиеся на следующий календарный день / новые пользователи | N/A | ≥18% | rolling 28 days | platform/product analytics |
| Inferno continuation | пользователи с ещё одной валидной сессией в течение 7 дней после первого Инферно / впервые достигшие Инферно | N/A | ≥35% | cohort 28 days | game events |
| Input integrity | уникальные корректные taps, обработанные и начислившие score / все корректные taps; heat clamp только `1000` | N/A | 100% до аварийного synthetic-flood guard | каждый release + первые 1 000 сессий | input telemetry, агрегировано |
| Optional boost adoption | достигшие stage 4 и добровольно открывшие boost sheet / достигшие stage 4 | N/A | 15–60% | первые 500 stage-4 runs | game events |
| Reward success | подтверждённые success callbacks / открытия boost sheet | N/A | Web/dev test ≥95%; Yandex rewarded ≥70% | rolling 14 days, min 500 eligible | platform + game events |
| Reward reliability | награды, выданные ровно один раз / confirmed rewarded callbacks | N/A | 100% | каждый release + production | platform telemetry |
| Runtime stability | валидные сессии без uncaught error / валидные сессии | N/A | ≥99,5% | rolling 7 days | error telemetry |

## Аналитические события минимального набора

Без персональных данных должны различаться: `interactive_ready`, `session_start`, `stage_enter`, `stage_leave`, `enemy_event_start`, `enemy_event_end`, `heat_window_start`, `heat_window_end`, `boost_sheet_open`, `rewarded_offer`, `rewarded_start`, `rewarded_complete`, `rewarded_cancel`, `rewarded_error`, `test_reward_success`, `boost_started`, `boost_completed`, `inferno_enter`, `inferno_exit`, `session_end`, `personal_best`, `input_overflow`. Для run хранится только булев признак `boost_used`; provider различает `web-test`, `dev-test`, `yandex`, частота tap передаётся агрегатами, а не сырым таймлайном.

## Решения и открытые вопросы

| Статус | Вопрос/решение | Владелец | Срок |
|---|---|---|---|
| Решено | Название 1.0 — «Зажги», slug — `inferno-clicker`; семь исходных названий и порядок стадий сохранены. | Product/Game Designer | принято до реализации |
| Решено | Главный публичный leaderboard содержит только `Best Score`; highest stage, longest Inferno hold и max multiplier — локальные показатели профиля/экрана результата. | Product/Game Designer + Platform | принято до реализации |
| Решено | Все семь стадий доступны без provider; heat clamp всегда `1000`. После stage 4 и 45 секунд active run добровольный reward даёт только ×2 heat tapPower на 20 active seconds; assisted heat не даёт прямых tap-score points. | Product/Game Designer | corrective cycle 03 |
| Решено | Пока provider-реклама отсутствует, Web/dev CTA называется «Получить ×2 (тест)» и возвращает стандартный terminal `rewarded` success без fake-ad UI; production Yandex позднее заменяет только adapter callback. | Product + Platform | corrective cycle |
| Решено | Первый release — один бесконечный score-run до полного угасания; после Инферно игрок продолжает удержание ради рекорда. | Product/Game Designer | принято до реализации |
| Решено | Retention строится на личных рекордах и ежедневном ритуале без серии посещений, валюты и штрафа за пропуск. | Product/Game Designer | принято до реализации |
| Реализовано, проверка заблокирована | Adapter следует актуальному Yandex SDK-контракту; technical leaderboard name зафиксирован как `best-score`. Фактическая реклама, cloud save и leaderboard требуют тестового приложения в Yandex Console. | Platform Integration Agent + QA | до release gate |
| Заблокировано внешней средой | Уточнить KPI и баланс по результатам минимум 10 внутренних playtest и 30 внешних first-session playtest. | Product/Game Designer + QA | до release gate |

## Handoff

- Измеримые правила и исходный баланс находятся в `GAME_DESIGN.md`; QA должен трассировать direct taps, stage thresholds, scoring, increasing decay, enemy events, pause и persistence.
- Architecture должна обеспечить независимый от FPS расчёт активного времени и единый pointer/touch/mouse input path без двойного события.
- Art/Audio должны сделать каждую стадию, boost и каждый вражеский/Heat Window сигнал различимыми даже при muted audio либо reduced motion; product intent требует frame/sprite animation огня, appearance/idle/attack персонажей и fire/air-fanning ambience без tap-rate rhythm.
- Открытые вопросы не блокируют planning; они имеют владельцев и контрольные сроки.
