# Game Design — «Зажги»

## Назначение

Документ задаёт проверяемые действия, состояния, числовую модель и исходный баланс «Зажги». Все временные величины используют только активное игровое время: пауза, скрытая вкладка и реклама не двигают таймеры.

## Термины и инварианты

- `heat` — текущий жар, вещественное число в диапазоне `[0, 1000]`; старт нового run: `30`.
- `scoreAcc` — внутреннее неотрицательное число очков; отображаемый `score = floor(scoreAcc)`.
- `bestScore` — максимальный завершённый или текущий `score` за все run; целое число `≥0`.
- `stage` — стадия 1–7, однозначно определяемая текущим `heat` по таблице прогрессии.
- `runHighestStage` — максимальная stage, достигнутая в текущем run; старт `1`, не уменьшается при decay и сбрасывается на restart.
- `stageProgress` — нормализованный прогресс внутри текущего диапазона: `clamp((heat-L)/(U-L), 0, 1)`, где `[L,U)` — границы стадии; для стадии 7 используются `L=900`, `U=1000`.
- `tapPower` — номинальный прирост heat от принятого tap до ограничения `[0,1000]`.
- `decayRate` — потеря heat в секунду активного времени до временных модификаторов.
- `multiplier` — произведение stage multiplier и rhythm multiplier, ограниченное `[1,10]`; rewarded boost не умножает `multiplier`.
- Run детерминирован относительно последовательности ввода и активного времени; frame rate и wall clock не меняют результат. Базовый simulation step — фиксированные `50 ms`; crossing порогов интерполируется внутри шага.

## Core loop

```text
tap/click
→ мгновенно растут heat и score
→ усиление света/огня/звука раскрывает сцену
→ более высокая stage повышает multiplier и decay
→ четыре ритмичных tap заряжают Резонанс
→ игрок активирует короткую Вспышку и делает burst
→ короткая Передышка возвращает полную эффективность
→ телеграфируемая помеха меняет ближайший ритм
→ вход в новую stage даёт разовый score bonus
→ после входа в Инферно игрок удерживает heat ради score и рекорда времени
```

Первый tap должен дать видимый и слышимый отклик в том же кадре обработки ввода. Длинный tutorial отсутствует: до первого ввода пульсирует уголёк и показана строка «Жми, чтобы разжечь»; она исчезает после первого принятого tap.

## Ввод и допустимые действия

- Gameplay input — один логический `tap`: primary pointer/touch либо primary mouse button внутри центральной интерактивной области. Одно физическое касание не может породить одновременно touch и synthetic click.
- Принимается не более одного gameplay tap с одного `pointerId` до нового `pointerdown`; secondary mouse button, multitouch-дубликаты, удержание, drag за пределами области и synthetic repeat игнорируются.
- Game logic принимает максимум 8 taps за любое скользящее окно 1,0 с. Ввод сверх лимита не меняет heat, score, combo или исход события; UI может показать мягкий feedback «слишком быстро».
- UI-кнопки pause, mute, reduced motion, rewarded offer, restart и leaderboard не считаются gameplay taps.
- Во время `PAUSED`, `AD_BREAK`, `RESULTS` и `LOADING` gameplay taps не принимаются.
- Вся базовая прогрессия рассчитана на устойчивые 3–5 taps/с; достижение стадии 7 и продолжение run возможно без rewarded boost.

## Числовой порядок обновления

Каждый фиксированный simulation step длительностью 50 ms в активном состоянии:

1. Обновить активные таймеры и завершить истёкшие эффекты.
2. Применить decay: `heat = max(0, heat - effectiveDecayRate × 0,05)`.
3. Для каждого принятого в этом step tap по timestamp обновить cadence/fatigue, resonance и enemy event.
4. Рассчитать `tapPower` и прибавить heat с clamp.
5. Пересчитать stage по новому heat; каждую впервые пересечённую вверх границу начислить один stage bonus. Если один tap пересёк несколько границ, начисляются все ещё не полученные бонусы по порядку.
6. Начислить tap score с multiplier уже пересчитанной новой stage, затем Inferno hold score и время только за фактическую часть step, проведённую при `heat ≥900`.
7. Обновить отображаемые `score`, `bestScore`, `stageProgress` и persistence dirty state.

При crossing внутри simulation step время/score стадии делятся в точке линейного пересечения порога, чтобы результат не зависел от frame rate.

## Heat, tapPower и decay

Базовый `baseTapPower = 3 heat`.

`tapPower = baseTapPower × cadenceFactor × surgeFactor × enemyTapFactor × rewardedFactor`

- `cadenceFactor` задаёт убывающую отдачу для taps в скользящем окне 1,0 с: taps №1–5 имеют `1,00`; №6 — `0,70`; №7 — `0,45`; №8 — `0,25`. Номер пересчитывается для каждого принятого tap по числу предыдущих принятых taps за последние 1,0 с.
- `surgeFactor = 2,00` только во время собственной Вспышки или мирового Окна жара; если оба совпали, остаётся `2,00`, они не перемножаются.
- `enemyTapFactor = 0,55` только во время активного debuff от незломанного Холодного клейма Демонессы; иначе `1,00`.
- `rewardedFactor = 2,00` только во время «Печати Инферно ×2»; иначе `1,00`.
- Все факторы, кроме двух surge-источников, перемножаются. Финальный `tapPower` не округляется; `heat = min(1000, heat + tapPower)`.

Для scoring используется `scoreTapPower = tapPower / rewardedFactor`: добавочный heat от рекламы не даёт прямых tap-score points, но может косвенно помочь быстрее войти в высокую stage или дольше её удерживать.

`effectiveDecayRate = stageDecay × rhythmDecayFactor × enemyDecayFactor`

- `rhythmDecayFactor = 0,50` во время собственной Вспышки, `0,75` во время Передышки и `1,00` иначе.
- `enemyDecayFactor` равен произведению применимых вражеских эффектов, но итоговый множитель ограничен максимумом `2,50`.
- Rewarded boost decay не уменьшает.

Если `heat` равен 0, decay прекращается. До первого gameplay tap run находится в `READY`, и decay/таймеры не идут.

## Ритм: Резонанс, Вспышка и Передышка

Механика создаёт простой рисунок «размеренно → быстро → пауза», не делая обычный tap бесполезным.

1. В `NORMAL` четыре последовательных accepted taps с интервалом между соседними taps `0,20–0,65 с` дают по одному заряду Resonance. Интервал <0,20 с сбрасывает заряды в 0; интервал >0,65 с начинает новую последовательность с 1 заряда. Вражеское событие и пауза замораживают, но не сбрасывают таймер до resume.
2. При 4 зарядах сразу начинается `SURGE` продолжительностью `1,50 с`: `surgeFactor=2`, `rhythmMultiplier=2`, `rhythmDecayFactor=0,5`. Новые cadence taps в это время не заряжают следующий Resonance.
3. После SURGE начинается `BREATH` на `1,00 с`: `rhythmMultiplier=1`, `rhythmDecayFactor=0,75`. Gameplay taps разрешены, но дают cadenceFactor не более `0,50` и не заряжают Resonance. Ясный contracting-ring сигнал предлагает паузу.
4. После BREATH возвращается `NORMAL` с 0 зарядов.
5. Если игрок не использует ритм, обычные taps всё равно дают heat и score. Однако постоянный spam теряет эффективность через cadence curve, а ритм даёт burst и защиту от decay.

`rhythmMultiplier = 2,00` в SURGE и `1,00` во всех остальных фазах.

## Scoring и multiplier

Для принятого gameplay tap:

`tapPoints = 10 × scoreTapPower × multiplier`

`scoreAcc += tapPoints`, даже если heat уже ограничен 1000: активное удержание полного Инферно продолжает приносить очки. В этом случае score использует рассчитанный `scoreTapPower`, а не фактическую дельту heat.

Пока `heat ≥900`, дополнительно:

`scoreAcc += 50 × multiplier × infernoActiveSeconds`

Stage bonus начисляется один раз за run при первом входе снизу в соответствующую stage. Возврат вниз и повторный вход бонус не повторяют.

| Stage | Stage multiplier | Stage bonus |
|---:|---:|---:|
| 1 | 1,00 | 0 |
| 2 | 1,25 | 500 |
| 3 | 1,50 | 1 500 |
| 4 | 2,00 | 3 000 |
| 5 | 2,50 | 6 000 |
| 6 | 3,25 | 10 000 |
| 7 | 5,00 | 20 000 |

`multiplier = min(10, stageMultiplier × rhythmMultiplier)`. Отображается с максимум двумя значащими знаками после запятой (`×1`, `×1,25`, `×3,25`, `×6,5`, `×10`). `score` и `bestScore` отображаются как целые с разделителями разрядов. Внутренняя числовая модель должна безопасно хранить как минимум до `9 007 199 254 740 991`; при достижении лимита дальнейшее начисление прекращается и UI показывает `MAX`.

## Семь стадий

Stage пересчитывается без гистерезиса по текущему heat, поэтому при decay возможно понижение и повторное сокрытие части мира. `runHighestStage` хранит максимум текущего run и не уменьшается.

| # | Название | Heat range | Decay, heat/с | Раскрытие и gameplay |
|---:|---|---:|---:|---|
| 1 | Тьма | `[0,80)` | 0,5 | едва видимый уголёк, минимальное свечение, почти тишина; врагов нет |
| 2 | Искра | `[80,220)` | 2,0 | проявляются камни, пепел, круг, трещины и первые руны; появляется crackle/ambient |
| 3 | Пепельный слуга | `[220,380)` | 4,0 | появляется стилизованный бес; активируется Порыв слуги |
| 4 | Алый порог | `[380,560)` | 6,5 | врата, цепи, яркие руны, огненные трещины и силуэт большой сущности |
| 5 | Демонесса угасания | `[560,730)` | 9,0 | появляется стилизованная демонесса; активно Холодное клеймо |
| 6 | Круг Инферно | `[730,900)` | 13,0 | наблюдатели, глаза, цепи, множество рун и жар; активны Окна жара |
| 7 | Инферно | `[900,1000]` | 18,0 | огненный столб, максимальное раскрытие и множитель; цель — удержание |

Целевые ориентиры для first-time player без рекламы при 3–5 taps/с: стадия 2 — `5–15 с`, стадия 3 — `25–50 с`, стадия 5 — `75–150 с`, первый вход в Инферно — `150–300 с`. Это playtest targets, а не скрытое scaling: формулы не меняются по пользователю. Обязательный scripted no-ad test должен достигать всех семи стадий.

## Вражеские события и изменение ритма

События используют только активное время нахождения в текущей или более высокой stage. Одновременно может быть активно не более одного enemy event; если сроки совпали, приоритет `Холодное клеймо > Порыв слуги > Окно жара`, а событие меньшего приоритета переносится до завершения текущего +1,0 с.

### Порыв слуги — stage 3+

- Первый trigger через `8,0 с` после первого входа в stage 3; затем каждые `14,0 с` активного времени, пока `heat ≥220`.
- Телеграф `1,0 с`: слуга вдыхает, вокруг пламени собирается пепел.
- В течение телеграфа 4 accepted taps отменяют порыв и дают `250 × текущий stageMultiplier` очков; cadence curve продолжает действовать.
- Если не отменён, следующие `2,5 с` `enemyDecayFactor ×1,80`. Ввод остаётся доступен.
- Выход ниже 220 отменяет телеграф/эффект без награды; при возврате отсчёт начинается заново с 8,0 с.

### Холодное клеймо — stage 5+

- Первый trigger через `10,0 с` после первого входа в stage 5; затем каждые `16,0 с` активного времени, пока `heat ≥560`.
- Телеграф/окно разрушения длится `2,0 с`; 6 accepted taps за окно ломают клеймо, дают `500 × текущий stageMultiplier` очков и не накладывают debuff.
- Если выполнено меньше 6 taps, на `4,0 с` применяются `enemyTapFactor=0,55` и `enemyDecayFactor ×1,50`.
- Понижение ниже 560 не снимает уже наложенный 4-секундный debuff, но отменяет незавершённый телеграф и приостанавливает следующий trigger.

### Окно жара — stage 6+

- Первое friendly surge через `6,0 с` после входа в stage 6; затем интервал детерминированно чередуется `9, 11, 8, 10 с` активного времени, пока `heat ≥730`.
- За `0,75 с` появляется расширяющееся огненное кольцо, затем окно активно `1,50 с`.
- Внутри окна `surgeFactor=2`; окно не меняет multiplier и не складывается с собственной SURGE.
- Понижение ниже 730 отменяет telegraph/window; при возврате первый trigger снова через 6,0 с.

Все события обязаны иметь отдельный визуальный сигнал; критический смысл не может передаваться только цветом или звуком.

## Rewarded bonus — «Печать Инферно ×2»

- Placement разблокируется, когда в текущем run одновременно выполнены `runHighestStage ≥3` и `activeRunTime ≥45,0 с`. Persisted all-time record `highestStageReached` не делает новый run eligible сам по себе. Компактная неблокирующая CTA видна только в safe PLAYING, не перекрывает flame и при click лишь открывает pause/boost confirm sheet с pause reason `menu`. Реклама запускается отдельным confirm control внутри этого явно открытого sheet, после чего добавляется pause reason `ad`. Во время encounter, stage transition, любого другого pause, active boost или pending request opener CTA скрыта. Модальное предложение само не появляется.
- После подтверждённого rewarded callback ровно один раз запускается `20,0 с` активного gameplay времени с `rewardedFactor=2`; boost начинается только после resume из рекламы.
- Визуальный power mode: отличимый знак печати, более светлое ядро/оттенок огня, усиленный glow и particles в пределах performance/reduced-motion budget; отдельный sound cue, не обязательный для понимания.
- Boost не меняет stage thresholds, stage multiplier, decay или event schedule. Он усиливает heat tapPower; добавочная рекламная половина tapPower исключается из прямого tap-score через `scoreTapPower`.
- Лимит `1` подтверждённый boost за run; offer исчезает после успеха. Следующий показ в новом run разрешён не раньше чем через `90 с` активного времени текущей app session после успешного reward; session cooldown не сохраняется после полного перезапуска приложения.
- Cancel/error/unavailable даёт 0 награды, не расходует единственную попытку и не запускает cooldown; возвращает в прежнее paused state. Повторный добровольный запрос разрешён. Игра, таймеры и звук не идут во время рекламы.
- Offer необязателен; run, все стадии, локальные рекорды и restart доступны без него. Для аналитики/результата сохраняется `boostUsed`, но публичный `Best Score` по требованиям 1.0 принимает оба типа run.

## Прогрессия, leaderboard и persistence

### Внутри run

- Цель до первого stage 7: открыть следующую область и получить stage bonus.
- После первого stage 7: улучшать score и `currentInfernoHold`, удерживая `heat ≥900`.
- При падении ниже порога stage мир плавно скрывает соответствующий слой; milestone bonus и `runHighestStage` не теряются.

### Между run

Сохраняются только рекорды и предпочтения, но не mid-run состояние:

- `bestScore` — максимум score; единственная метрика публичного leaderboard.
- `highestStageReached` — all-time максимум `runHighestStage`, 1–7; это record между run, а не eligibility текущего run.
- `longestInfernoHoldMs` — максимум непрерывного активного времени при `heat ≥900`; выход ниже 900 завершает текущий отрезок, повторный вход начинает новый с 0.
- `maxMultiplier` — максимальное фактически активное значение multiplier.
- `runsPlayed`, флаги первого tutorial, mute/reduced-motion, дата и статус ежедневного ритуала.

Сохранение требуется при новом рекорде, завершении run и lifecycle pause; submit публичного `Best Score` выполняется только при завершении run и только если итог выше ранее отправленного. Активный run (`heat`, `score`, timers, effects, boost) никогда не восстанавливается после reload/relaunch: начинается `READY` с `heat=30`, а сохранённые records/settings загружаются. Отсутствие авторизации/SDK оставляет локальный рекорд и не блокирует игру. Повреждённые/неизвестной версии данные заменяются безопасными defaults после попытки миграции поддерживаемой версии.

Публичный leaderboard: одно поле `Best Score`, сортировка по убыванию; при равенстве используется platform-defined tie-breaker. Highest stage, longest Inferno hold и max multiplier показываются как персональная статистика и не создают отдельные публичные таблицы в 1.0.

### Retention без dark patterns

- Экран результата явно сравнивает run с `bestScore`, `longestInfernoHold` и `maxMultiplier` и показывает один ближайший личный target (например, `+5 000 до рекорда` или `+3,2 с удержания`).
- «Ритуал дня» выбирается детерминированно по локальной календарной дате из трёх задач: достичь заданной уже достижимой стадии, удержать Inferno 10/20/30 с либо выполнить 3/5/7 успешных counter событий за один run. Задача никогда не требует рекламы.
- За первое выполнение дня выдаётся только визуальная отметка дня и result celebration, без heat/score преимущества. Пропуск дня ничего не сбрасывает; streak и наказание отсутствуют.
- Clock rollback не может выдать вторую отметку за уже записанную календарную дату; невозможность определить дату отключает ежедневную задачу, но не core game.

## Сложность

- Сложность растёт только через табличный stage decay, новые телеграфируемые события и более высокую цену ошибки на большом heat.
- Dynamic difficulty adjustment, скрытое изменение tapPower, rubber-banding и зависимость баланса от просмотра рекламы запрещены.
- Игрок может компенсировать рост decay базовыми taps; mastery ритма и counter событий даёт запас, а rewarded boost — краткий необязательный power spike.
- Initial tuning targets: новый игрок может достичь stage 3 без использования Resonance; для устойчивого достижения stage 7 ожидается понимание хотя бы одной SURGE и одного counter event.
- Если playtest funnel выходит за диапазоны из `PRODUCT_SPEC.md`, разрешён тюнинг только явных таблиц/чисел этого документа с обновлением тестов и acceptance, а не скрытая персонализация.

## Проигрыш и рестарт

- До первого tap поражение невозможно.
- После достижения stage 2 хотя бы раз run завершается, если `heat=0` непрерывно `2,0 с` активного времени. Этот grace period отображается угасающим кольцом; любой принятый tap с положительным tapPower отменяет поражение и продолжает run.
- Если игрок ни разу не достиг stage 2, падение к 0 возвращает `READY` без result screen, чтобы onboarding не наказывал за первый медленный ввод.
- На `RESULTS` фиксируются score/рекорды и доступны restart и leaderboard; revive в версии 1.0 отсутствует.
- «Разжечь снова» начинает новый run с `heat=30`, `scoreAcc=0`, stage 1, normal rhythm, без enemy effects/boost, с нулевыми session milestones и timers. Persistent records/settings сохраняются; стоимость restart — 0.
- Явный restart из pause требует подтверждения, завершает текущий run как abandoned (score может обновить personal best, если он выше), но не показывает обязательную рекламу.

## Награды

| Награда | Trigger | Значение | Ограничение |
|---|---|---|---|
| Stage bonus | первый upward entry в stage 2–7 за run | 500 / 1 500 / 3 000 / 6 000 / 10 000 / 20 000 score | один раз на stage за run |
| Counter: Порыв | 4 taps в telegraph | `250 × stageMultiplier` score, порыв отменён | каждый trigger |
| Counter: Клеймо | 6 taps за 2 с | `500 × stageMultiplier` score, debuff отменён | каждый trigger |
| Inferno hold | каждую активную секунду heat ≥900 | `50 × multiplier` score и hold time | пока условие истинно |
| Resonance SURGE | 4 ритмичных taps | 1,5 с: heat tapPower ×2, rhythm multiplier ×2, decay ×0,5 | затем обязательная 1 с BREATH |
| Печать Инферно ×2 | confirmed rewarded callback после eligibility | heat tapPower ×2 на 20 активных секунд; прямой tap score без ad-добавки | 1/run; 90 с session cooldown после успеха; cancel/error без расхода |
| Personal best | превышение сохранённого значения | result celebration + сохранение/submit | без gameplay power |
| Ритуал дня | первое выполнение дневной задачи | визуальная отметка и celebration | 1/локальную дату, без streak |

## Игровые состояния

| Состояние | Вход | Допустимые действия | Выход | Pause policy |
|---|---|---|---|---|
| `LOADING` | запуск приложения | mute/reduced motion, если UI готов | успешный init → READY; recoverable platform failure → READY web fallback; fatal asset/core failure → ERROR | таймеров gameplay нет |
| `READY` | загрузка или onboarding reset до stage 2 | gameplay tap, settings | первый tap → PLAYING | decay, score и события не идут |
| `PLAYING` | первый tap/restart/resume | gameplay tap, pause, settings, открыть eligible pause/boost sheet | user/system/sheet pause → PAUSED; fail → RESULTS; fatal → ERROR | активное время идёт |
| `PAUSED` | user pause, visibility hidden, platform pause или открытый confirm sheet | resume, settings, confirmed restart; dedicated rewarded confirm только если sheet открыт из eligible safe PLAYING и других pause reasons нет | resume → PLAYING; rewarded confirm → AD_BREAK; restart → READY | все gameplay/audio/timers заморожены; opener CTA скрыта |
| `AD_BREAK` | запуск rewarded рекламы | только platform-controlled UI | close/error → PAUSED; confirmed reward → PAUSED с queued boost | полная заморозка, audio muted/paused |
| `RESULTS` | условие угасания или confirmed restart | restart, leaderboard, settings | restart → READY | gameplay заморожен; persistence завершается |
| `ERROR` | невосстановимая ошибка core/assets | retry/reload | успешный retry → LOADING | gameplay/audio остановлены; понятное сообщение без stack trace |

## Проверяемые примеры

1. Новый run: heat 30, stage 1. Один обычный tap без эффектов даёт tapPower 3, heat 33, multiplier 1 и `scoreAcc +30`.
2. При heat 78 обычный tap сначала даёт heat 81 и stage 2; tap points рассчитываются с новым stage multiplier: `3×1,25×10=37,5`, плюс stage bonus 500, итоговое приращение `537,5` в scoreAcc и `537` на экране.
3. В stage 7 во время SURGE обычный по cadence tap: tapPower `3×2=6`, multiplier `5×2=10`, tap score `600`; Вспышка также вдвое снижает decay `18→9 heat/с`.
4. Тот же tap при активной Печати: heat tapPower `3×2×2=12`, но `scoreTapPower=6`, поэтому tap score остаётся `600`; рекламная добавка помогает удержанию, а не даёт прямых очков.
5. Шестой tap за скользящую секунду в обычном stage 4: tapPower `3×0,70=2,1`, multiplier 2, tap score `42` до floor общего score.
6. Неотменённое Холодное клеймо в stage 5: decay `9×1,5=13,5 heat/с`, обычный tapPower `3×0,55=1,65`; эффект заканчивается ровно через 4 активные секунды.
7. При heat 905 и 1 активной секунде без taps Inferno hold заканчивается при пересечении 900 примерно через `0,278 с`; оставшиеся `0,722 с` действуют с decay stage 6, поэтому итоговый heat около `890,61`, stage 6. Hold score начисляется только за первые 0,278 с.

## Edge cases

- Background/visibility/platform pause/ad: активное время и все gameplay таймеры замораживаются; после resume запрещён catch-up decay или пачка пропущенных событий.
- Rapid/multitouch input: дедупликация pointer/click и лимит 8 taps/с применяются до scoring/combo; rejected taps не помогают counter events.
- Low FPS: accumulator обрабатывает fixed steps 50 ms по monotonic active clock; threshold crossing интерполируется. Результат одного timestamped input trace одинаков в пределах tolerance `±0,01 heat`, `±1 score`, `±10 ms hold`.
- Clock change: wall clock не влияет на run/boost; используется только для «Ритуала дня» с защитой от повторной выдачи.
- Heat at max: taps продолжают начислять tap score, но heat остаётся 1000; particle/audio feedback не создаётся сверх performance caps.
- Multiple threshold crossing: stage events/bonuses вызываются последовательно один раз; downward crossing не отнимает score.
- Simultaneous event and stage exit: уже наложенный Холодный debuff доигрывает срок; Порыв/Окно жара отменяются согласно их правилам; приоритет обработки задан числовым порядком update.
- Reward callback duplicate/late: один ad request имеет idempotency key; второй callback не выдаёт boost. Callback после restart/result не переносит награду в новый run и логируется как ignored.
- Save unavailable/quota/corruption: run продолжается; показывается ненавязчивый статус локального сохранения, defaults не содержат NaN/отрицательных рекордов.
- Reload во время active run: run намеренно не восстанавливается; records/settings сохраняются, новое состояние — READY с heat 30.
- Leaderboard unavailable/auth denied: локальный bestScore остаётся источником UI; submit retry не блокирует results/restart.
- Audio disabled/reduced motion: все telegraph/counter/surge сигналы сохраняют статичную форму/иконку/текст и timing.
- Numeric safety: NaN/Infinity в расчёте считается recoverable logic error, значение восстанавливается к последнему валидному snapshot и событие попадает в telemetry; score никогда не уменьшается.

## Требования для downstream-документов

- `ACCEPTANCE_CRITERIA.md` должен покрыть все семь threshold/decay rows, tap/click parity, rhythm phases, три события, scoring examples, fail/restart, no-ad reachability, pause/ad timing, persistence и leaderboard fallback.
- `TECHNICAL_ARCHITECTURE.md` должен зафиксировать fixed-step 50 ms active-time simulation, input deduplication, state machine, versioned records/settings persistence без active-run restore и platform abstraction.
- `ART_DIRECTION.md`/`AUDIO_DIRECTION.md` должны дать различимые сигналы NORMAL/SURGE/BREATH, всех telegraph/success/fail состояний и семи стадий без зависимости только от цвета/звука.
- Неопределённых значений и незаполненных шаблонных полей в этом документе нет; будущий баланс меняется только версионированным обновлением документа и связанных тестов.
