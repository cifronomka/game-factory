# Game Design — «Зажги»

## Назначение

Документ задаёт проверяемые действия, состояния, числовую модель и исходный баланс «Зажги». Все временные величины используют только активное игровое время: пауза, скрытая вкладка и реклама не двигают таймеры.

## Термины и инварианты

- `heat` — текущий жар, вещественное число в диапазоне `[0, 1000]`; старт нового run: `30`.
- `scoreAcc` — внутреннее число очков в диапазоне `[0, 2 147 483 647]`; отображаемый `score = floor(scoreAcc)`.
- `bestScore` — максимальный завершённый или текущий `score` за все run; целое число в диапазоне `[0, 2 147 483 647]`.
- `stage` — стадия 1–7, однозначно определяемая текущим `heat` по таблице прогрессии.
- `runHighestStage` — максимальная stage, достигнутая в текущем run; старт `1`, не уменьшается при decay и сбрасывается на restart.
- `stageProgress` — нормализованный прогресс внутри текущего диапазона: `clamp((heat-L)/(U-L), 0, 1)`, где `[L,U)` — границы стадии; для стадии 7 используются `L=900`, `U=1000`.
- `tapPower` — номинальный прирост heat от принятого tap до ограничения `[0,1000]`.
- `decayRate` — потеря heat в секунду активного времени до временных модификаторов.
- `multiplier` — multiplier текущей stage в диапазоне `[1,5]`; временные эффекты и rewarded boost его не умножают.
- `sealBroken` — run-local boolean; новый run начинается с `false`, подтверждённый reward success один раз ставит `true`, после чего значение не меняется до restart и не сохраняется между run.
- Run детерминирован относительно последовательности ввода и активного времени; frame rate и wall clock не меняют результат. Базовый simulation step — фиксированные `50 ms`; crossing порогов интерполируется внутри шага.

## Core loop

```text
tap/click
→ мгновенно растут heat и score
→ усиление света/огня/звука раскрывает сцену
→ более высокая stage повышает multiplier и decay
→ игрок увеличивает частоту taps, чтобы обгонять растущий decay
→ телеграфируемая помеха временно усиливает decay, не меняя управление
→ вход в новую stage даёт разовый score bonus
→ на вершине stage 4 явная инфернальная печать удерживает heat на 559, пока игрок не подтвердит seal-success
→ success навсегда открывает stage 5+ для run и одновременно даёт ×2 heat на 20 active seconds
→ после входа в Инферно игрок удерживает heat ради score и рекорда времени
```

Первый tap должен изменить visual state в том же кадре обработки ввода. Отдельный tap SFX не обязателен: feedback может состоять из реакции огня, flare и sparks без раздражающего повторного звука. Длинный tutorial отсутствует: до первого ввода пульсирует уголёк и показана строка «Жми, чтобы разжечь»; она исчезает после первого принятого tap. Product intent для presentation: огонь использует заметную sprite/frame animation, персонажи имеют appearance/idle/attack-состояния, а звуковая среда состоит прежде всего из огня и воздушного раздувания; эти presentation-состояния не добавляют tap timing rule.

## Ввод и допустимые действия

- Gameplay input — один логический `tap`: left mouse `pointerdown` либо новый touch/pen contact внутри центральной интерактивной области. Одно физическое касание не может породить одновременно pointer и synthetic click.
- Каждый уникальный корректный `pointerdown`, включая разные touch `pointerId`, принимается ровно один раз. Повтор одного активного pointerId до `pointerup/pointercancel`, повторный `inputId`, secondary mouse button, удержание, drag за пределами области и synthetic repeat игнорируются.
- Все уникальные taps с timestamp внутри simulation step `50 ms` обрабатываются по `(timestamp, enqueue order)`. Нет rolling rate cap, diminishing return, cooldown или combo requirement.
- Только невозможный synthetic flood ограничен `256` уникальными командами в одном step (`>5120 taps/s`); дальнейшие команды получают технический `input-overflow`, не являющийся частью баланса. Visual feedback может агрегироваться, но score и nominal heat calculation выполняются для каждого принятого tap; фактический heat затем ограничивается только явным ceiling 559/1000.
- UI-кнопки pause, mute, reduced motion, rewarded offer, restart и leaderboard не считаются gameplay taps.
- Во время `PAUSED`, `AD_BREAK`, `RESULTS` и `LOADING` gameplay taps не принимаются.
- Базовая прогрессия требует постепенно повысить частоту примерно с 2 taps/с на ранних stages до 7,14 taps/с возле Inferno. Без подтверждённого seal-success текущий run честно заканчивает progression на stage 4 cap; после success все stages достигаются теми же прямыми taps.

## Числовой порядок обновления

Каждый фиксированный simulation step длительностью 50 ms в активном состоянии:

1. Разбить step по границам таймеров и timestamps всех принятых taps; для одинакового timestamp сохранить enqueue order.
2. До каждой границы применить decay за точный elapsed slice и завершить истёкшие эффекты.
3. Для каждого tap на границе рассчитать `tapPower` и прибавить heat с clamp: верхняя граница равна `559`, пока `sealBroken=false`, и `1000`, когда `sealBroken=true`. Clamp печати не отклоняет tap и не меняет его nominal score power.
4. Пересчитать stage по новому heat; каждую впервые пересечённую вверх границу начислить один stage bonus. Если один tap пересёк несколько границ, начисляются все ещё не полученные бонусы по порядку.
5. Начислить tap score с multiplier уже пересчитанной новой stage; Inferno hold score и время начислять только за фактические slices при `heat ≥900`.
6. После последнего tap применить оставшийся slice до конца step и обновить `score`, `bestScore`, `stageProgress` и persistence dirty state.

При crossing внутри simulation step время/score стадии делятся в точке линейного пересечения порога, чтобы результат не зависел от frame rate.

## Heat, tapPower и decay

Базовый `baseTapPower = 3 heat`.

`tapPower = baseTapPower × heatWindowFactor × rewardedFactor`

- `heatWindowFactor = 2,00` только во время мирового Окна жара; иначе `1,00`.
- `rewardedFactor = 2,00` только во время «Печати Инферно ×2»; иначе `1,00`.
- Факторы перемножаются. Каждый normal tap номинально даёт ровно `3 heat`, Heat Window или rewarded — `6`, оба эффекта вместе — `12`; `heat = min(sealBroken ? 1000 : 559, heat + tapPower)`.

Для scoring используется `scoreTapPower = tapPower / rewardedFactor`: добавочный heat от рекламы не даёт прямых tap-score points, но может косвенно помочь быстрее войти в высокую stage или дольше её удерживать.

`effectiveDecayRate = stageDecay × enemyDecayFactor`

- `enemyDecayFactor` равен произведению применимых вражеских эффектов, но итоговый множитель ограничен максимумом `2,50`.
- Rewarded boost decay не уменьшает.

Если `heat` равен 0, decay прекращается. До первого gameplay tap run находится в `READY`, и decay/таймеры не идут.

## Direct-tap pressure

Каждый корректный tap имеет одинаковую базовую отдачу независимо от предыдущих интервалов. Никакое состояние не требует cadence/combo-права на эффективный tap. Единственный progression clamp — видимая печать: при `sealBroken=false` tap у cap по-прежнему начисляет stage-4 score и даёт seal/flame feedback, но фактический heat не превышает `559`. После seal-success возрастающая сложность полностью наблюдаема в `stageDecay`: для удержания stage 7 без событий требуется больше `18/3 = 6 taps/s`; при коротком Порыве слуги требуется до `32,4/3 = 10,8 taps/s`, при Клейме — `27/3 = 9 taps/s`. Временный отрицательный net heat допустим и компенсируется быстрым tapping до/после эффекта.

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

`multiplier = stageMultiplier`, максимум `×5`. Отображается с максимум двумя значащими знаками после запятой (`×1`, `×1,25`, `×3,25`, `×5`). `score` и `bestScore` отображаются как целые с разделителями разрядов. При достижении единого локального/leaderboard лимита `2 147 483 647` дальнейшее начисление прекращается, UI показывает `MAX`, а adapter отправляет это же значение без дополнительного clamp.

## Семь стадий

Stage пересчитывается без гистерезиса по текущему heat, поэтому при decay возможно понижение и повторное сокрытие части мира. `runHighestStage` хранит максимум текущего run и не уменьшается.

| # | Название | Heat range | Decay, heat/с | Раскрытие и gameplay |
|---:|---|---:|---:|---|
| 1 | Тьма | `[0,80)` | 0,5 | едва видимый уголёк, минимальное свечение, почти тишина; врагов нет |
| 2 | Искра | `[80,220)` | 2,0 | проявляются камни, пепел, круг, трещины и первые руны; появляется crackle/ambient |
| 3 | Пепельный слуга | `[220,380)` | 4,0 | появляется стилизованный бес; активируется Порыв слуги |
| 4 | Алый порог | `[380,560)` | 6,5 | врата, цепи, яркие руны, огненные трещины, силуэт большой сущности и понятная progression seal; locked cap 559 |
| 5 | Демонесса угасания | `[560,730)` | 9,0 | доступна только при `sealBroken=true`; появляется стилизованная демонесса; активно Холодное клеймо |
| 6 | Круг Инферно | `[730,900)` | 13,0 | наблюдатели, глаза, цепи, множество рун и жар; активны Окна жара |
| 7 | Инферно | `[900,1000]` | 18,0 | огненный столб, максимальное раскрытие и множитель; цель — удержание |

Целевые ориентиры при постепенном росте частоты от 2 до 7,14 taps/с: стадия 2 — `5–15 с`, стадия 3 — `25–50 с`, stage 4 — `55–80 с`, первое касание locked cap — `90–120 с`; после подтверждённого seal-success первый вход в Инферно должен укладываться в `90–180 с` от старта run. Это playtest targets, а не скрытое scaling: формулы не меняются по пользователю. Обязательны две paired traces: no-boost остаётся на stage 4, boosted достигает stage 7.

## Инфернальная печать — progression gate stage 4 → 5

- Порог stage 5 остаётся `560`; пока `sealBroken=false`, effective heat ceiling равен ровно `559`. Stage-4 progress у cap равен `(559-380)/(560-380)=0,9944`, поэтому UI показывает почти заполненную шкалу, lock-mark и текст `559 / 560 — Печать преграждает путь`.
- Каждый tap у печати остаётся accepted: получает обычный stage-4 tap score `10×3×2=60`, запускает немедленный flame/seal impulse и не зависит от cadence. Presentation coalesces повторное объяснение, чтобы modal/toast не появлялся на каждый tap.
- Только terminal outcome `rewarded` для текущего `runId` атомарно ставит `sealBroken=true` до запуска queued boost. `closed`, `error`, `unavailable`, duplicate/late callback и cancel sheet не ломают печать.
- Первая успешная активация одновременно запускает существующий `rewardedFactor=2` на `20 000 ms` активного gameplay. После истечения boost `rewardedFactor` возвращается к 1, но `sealBroken` остаётся true даже после падения ниже stage 5.
- Restart/reload создаёт новый run с `sealBroken=false`; persisted `highestStageReached` не переносит unlock.
- До подключения рекламы Web/dev provider показывает явную CTA `Получить ×2 (тест)` и confirm `Активировать тестовый ×2 и сломать печать`. Он не рисует fake-ad, а асинхронно возвращает тот же idempotent terminal `rewarded` callback через `PlatformService`. Production Yandex заменяет provider на официальный rewarded callback, не меняя core transition.

## Вражеские события и Heat Window

События используют только активное время нахождения в текущей или более высокой stage. Одновременно может быть активно не более одного события; если сроки совпали, приоритет `Холодное клеймо > Порыв слуги > Окно жара`. Countdown события идёт только пока его stage eligible, нет другого события и нет stage transition; иначе он заморожен без накопления очереди. Повторный интервал конкретного события отсчитывается от завершения предыдущего telegraph/effect; после любого события выдерживается общий gap `1,0 с` до продолжения остальных countdown.

### Порыв слуги — stage 3+

- Первый trigger через `8,0 с` после первого входа в stage 3; затем каждые `14,0 с` активного времени, пока `heat ≥220`.
- Телеграф `1,0 с`: слуга вдыхает, вокруг пламени собирается пепел.
- После телеграфа всегда следуют `2,5 с` с `enemyDecayFactor ×1,80`. Taps не отменяют событие, сохраняют полную базовую силу и остаются доступными.
- Выход ниже 220 отменяет телеграф/эффект без награды; при возврате отсчёт начинается заново с 8,0 с.

### Холодное клеймо — stage 5+

- Первый trigger через `10,0 с` после первого входа в stage 5; затем каждые `16,0 с` активного времени, пока `heat ≥560`.
- Телеграф длится `2,0 с`; после него всегда применяются `4,0 с` с `enemyDecayFactor ×1,50`. Taps не ломают клеймо и не теряют базовую силу.
- Понижение ниже 560 не снимает уже наложенный 4-секундный debuff, но отменяет незавершённый телеграф и приостанавливает следующий trigger.

### Окно жара — stage 6+

- Первое friendly window через `6,0 с` после входа в stage 6; затем интервал детерминированно чередуется `9, 11, 8, 10 с` активного времени, пока `heat ≥730`.
- За `0,75 с` появляется расширяющееся огненное кольцо, затем окно активно `1,50 с`.
- Внутри окна `heatWindowFactor=2`; окно не меняет stage multiplier.
- Понижение ниже 730 отменяет telegraph/window; при возврате первый trigger снова через 6,0 с.

Все события обязаны иметь отдельный визуальный сигнал; критический смысл не может передаваться только цветом или звуком.

## Seal success и rewarded bonus — «Печать Инферно ×2»

- Placement разблокируется, когда в текущем run одновременно выполнены `runHighestStage ≥4`, `activeRunTime ≥45,0 с` и `sealBroken=false`. Persisted all-time record `highestStageReached` не делает новый run eligible сам по себе. Компактная неблокирующая CTA видна только в safe PLAYING, не перекрывает flame и при click лишь открывает pause/boost confirm sheet с pause reason `menu`. Provider запускается отдельным confirm control внутри этого явно открытого sheet, после чего добавляется pause reason `ad`. Во время encounter, stage transition, любого другого pause, active boost или pending request opener CTA скрыта. Модальное предложение само не появляется.
- После подтверждённого terminal `rewarded` callback печать ломается для текущего run и ровно один раз запускается `20,0 с` активного gameplay времени с `rewardedFactor=2`; boost начинается только после valid resume.
- Визуальный power mode: отличимый знак печати, более светлое ядро/оттенок огня, усиленный glow и particles в пределах performance/reduced-motion budget; отдельный sound cue, не обязательный для понимания.
- Seal success не меняет stage thresholds, stage multiplier, decay или event schedule: он снимает только run-local ceiling `559`. Boost усиливает heat tapPower; добавочная provider-половина tapPower исключается из прямого tap-score через `scoreTapPower`.
- Лимит `1` подтверждённый boost за run; offer исчезает после успеха. Следующий показ в новом run разрешён не раньше чем через `90 с` активного времени текущей app session после успешного reward; session cooldown не сохраняется после полного перезапуска приложения.
- Cancel/error/unavailable даёт 0 награды, не ломает seal, не расходует единственную попытку и не запускает cooldown. Terminal callback снимает только pause reason `ad`: при отсутствии других reasons игра ровно один раз возвращается в `PLAYING`, иначе остаётся `PAUSED`. Повторный добровольный запрос разрешён. Игра, таймеры и звук не идут во время provider flow.
- Без offer доступны direct-tap run, stage 1–4 score, локальные рекорды и restart; stage 5–7 требуют seal success. Для аналитики/результата сохраняются `sealBroken` и `boostUsed`, публичный `Best Score` принимает оба типа run.

## Прогрессия, leaderboard и persistence

### Внутри run

- Цель до stage 4: открыть следующую область и получить stage bonus; на stage 4 — увидеть печать, решить открыть provider sheet либо продолжать stage-4 score-run.
- После `sealBroken=true` цель снова состоит в открытии stages 5–7 и получении их однократных bonuses.
- После первого stage 7: улучшать score и `currentInfernoHold`, удерживая `heat ≥900`.
- При падении ниже порога stage мир плавно скрывает соответствующий слой; milestone bonus и `runHighestStage` не теряются.

### Между run

Сохраняются только рекорды и предпочтения, но не mid-run состояние:

- `bestScore` — максимум score; единственная метрика публичного leaderboard.
- `highestStageReached` — all-time максимум `runHighestStage`, 1–7; это record между run, а не eligibility текущего run.
- `longestInfernoHoldMs` — максимум непрерывного активного времени при `heat ≥900`; выход ниже 900 завершает текущий отрезок, повторный вход начинает новый с 0.
- `maxMultiplier` — максимальное фактически активное stage multiplier, диапазон 1–5; legacy значения выше 5 clamp'ятся до 5.
- `runsPlayed`, флаги первого tutorial, mute/reduced-motion, дата и статус ежедневного ритуала.

Сохранение требуется при новом рекорде, завершении run и lifecycle pause; submit публичного `Best Score` выполняется только при завершении run и только если итог выше ранее отправленного. Активный run (`heat`, `score`, timers, effects, boost) никогда не восстанавливается после reload/relaunch: начинается `READY` с `heat=30`, а сохранённые records/settings загружаются. Отсутствие авторизации/SDK оставляет локальный рекорд и не блокирует игру. Повреждённые/неизвестной версии данные заменяются безопасными defaults после попытки миграции поддерживаемой версии.

Публичный leaderboard: одно поле `Best Score`, сортировка по убыванию; при равенстве используется platform-defined tie-breaker. Highest stage, longest Inferno hold и max multiplier показываются как персональная статистика и не создают отдельные публичные таблицы в 1.0.

### Retention без dark patterns

- Экран результата явно сравнивает run с `bestScore`, `longestInfernoHold` и `maxMultiplier` и показывает один ближайший личный target (например, `+5 000 до рекорда` или `+3,2 с удержания`).
- «Ритуал дня» выбирается детерминированно по локальной календарной дате из двух задач, не требующих seal success: достичь stage 2/3/4 либо набрать заданное число score за один run. Inferno-hold не используется как daily requirement, потому что stage 5+ provider-gated.
- За первое выполнение дня выдаётся только визуальная отметка дня и result celebration, без heat/score преимущества. Пропуск дня ничего не сбрасывает; streak и наказание отсутствуют.
- Clock rollback не может выдать вторую отметку за уже записанную календарную дату; невозможность определить дату отключает ежедневную задачу, но не core game.

## Сложность

- Сложность растёт через табличный stage decay, новые телеграфируемые события, более высокую цену ошибки на большом heat и один явно показанный progression gate `559→560`.
- Dynamic difficulty adjustment, скрытое изменение tapPower, rubber-banding и незадокументированная зависимость от provider запрещены. Seal state и причина cap всегда видны.
- Игрок компенсирует рост decay только большей частотой полноценных базовых taps; Heat Window даёт короткий понятный запас, а rewarded/test boost даёт фиксированный power spike после сознательного seal confirmation.
- Measurable tuning: canonical cadence равна `2 taps/s` на stages 1–2, `4 taps/s` на stages 3–4, `5 taps/s` на stage 5 и `7,14 taps/s` на stages 6–7. Номинальный normal net без events: stage 4 `12−6,5=+5,5 heat/s`, stage 5 `15−9=+6`, stage 6 `21,43−13=+8,43`, stage 7 `21,43−18=+3,43`. В stage-7 servant effect требуется `>10,8 taps/s`, но это краткое event-window, а не постоянная cadence gate.
- Paired fixture targets: без success `runHighestStage=4`, с success stage 7 достигается в `116,54 с`; first-time playtest band для boosted Inferno `90–180 с`. Tap-комбинации и cooldown отсутствуют.
- Если playtest funnel выходит за диапазоны из `PRODUCT_SPEC.md`, разрешён тюнинг только явных таблиц/чисел этого документа с обновлением тестов и acceptance, а не скрытая персонализация.

## Проигрыш и рестарт

- До первого tap поражение невозможно.
- После достижения stage 2 хотя бы раз run завершается, если `heat=0` непрерывно `2,0 с` активного времени. Этот grace period отображается угасающим кольцом; любой принятый tap с положительным tapPower отменяет поражение и продолжает run.
- Если игрок ни разу не достиг stage 2, падение к 0 возвращает `READY` без result screen, чтобы onboarding не наказывал за первый медленный ввод.
- На `RESULTS` фиксируются score/рекорды и доступны restart и leaderboard; revive в версии 1.0 отсутствует.
- «Разжечь снова» начинает новый run с `heat=30`, `scoreAcc=0`, stage 1, без enemy effects/boost, с нулевыми session milestones и timers. Persistent records/settings сохраняются; стоимость restart — 0.
- Явный restart из pause требует подтверждения, завершает текущий run как abandoned (score может обновить personal best, если он выше), но не показывает обязательную рекламу.

## Награды

| Награда | Trigger | Значение | Ограничение |
|---|---|---|---|
| Stage bonus | первый upward entry в stage 2–7 за run | 500 / 1 500 / 3 000 / 6 000 / 10 000 / 20 000 score | один раз на stage за run |
| Inferno hold | каждую активную секунду heat ≥900 | `50 × multiplier` score и hold time | пока условие истинно |
| Heat Window | active world window stage 6+ | heat tapPower ×2 на 1,5 активных секунды | deterministic schedule, без combo |
| Печать Инферно ×2 | confirmed terminal `rewarded` после stage 4 eligibility | навсегда снять cap 559 для текущего run + heat tapPower ×2 на 20 активных секунд; прямой tap score без provider-добавки | 1/run; 90 с session cooldown после успеха; cancel/error без unlock/расхода |
| Personal best | превышение сохранённого значения | result celebration + сохранение/submit | без gameplay power |
| Ритуал дня | первое выполнение дневной задачи | визуальная отметка и celebration | 1/локальную дату, без streak |

## Игровые состояния

| Состояние | Вход | Допустимые действия | Выход | Pause policy |
|---|---|---|---|---|
| `LOADING` | запуск приложения | mute/reduced motion, если UI готов | успешный init → READY; recoverable platform failure → READY web fallback; fatal asset/core failure → ERROR | таймеров gameplay нет |
| `READY` | загрузка или onboarding reset до stage 2 | gameplay tap, settings | первый tap → PLAYING | decay, score и события не идут |
| `PLAYING` | первый tap/restart/resume | gameplay tap, pause, settings, открыть eligible seal/boost sheet | user/system/sheet pause → PAUSED; fail → RESULTS; fatal → ERROR | активное время идёт; locked heat clamp 559 либо unlocked clamp 1000 |
| `PAUSED` | user pause, visibility hidden, platform pause или открытый confirm sheet | resume, settings, confirmed restart; dedicated rewarded confirm только если sheet открыт из eligible safe PLAYING и других pause reasons нет | resume → PLAYING; rewarded confirm → AD_BREAK; confirmed restart → RESULTS с `abandoned=true` | все gameplay/audio/timers заморожены; opener CTA скрыта |
| `AD_BREAK` | запуск rewarded рекламы | только platform-controlled UI | terminal callback снимает только `ad`: при оставшихся reasons → PAUSED, иначе → PLAYING; confirmed reward дополнительно ставит queued boost, который стартует после valid resume | полная заморозка, audio muted/paused |
| `RESULTS` | условие угасания или confirmed restart | restart, leaderboard, settings | restart → READY | gameplay заморожен; persistence завершается |
| `ERROR` | невосстановимая ошибка core/assets | retry/reload | успешный retry → LOADING | gameplay/audio остановлены; понятное сообщение без stack trace |

## Проверяемые примеры

1. Новый run: heat 30, stage 1. Один обычный tap без эффектов даёт tapPower 3, heat 33, multiplier 1 и `scoreAcc +30`.
2. При heat 78 обычный tap сначала даёт heat 81 и stage 2; tap points рассчитываются с новым stage multiplier: `3×1,25×10=37,5`, плюс stage bonus 500, итоговое приращение `537,5` в scoreAcc и `537` на экране.
3. В stage 7 normal tap всегда даёт tapPower `3`, multiplier `5` и tap score `150`; удержание без событий требует частоты выше `6 taps/с`, потому что decay равен `18 heat/с`.
4. В Heat Window stage 7 tapPower `3×2=6`, multiplier остаётся `5`, tap score `300`. При одновременной активной Печати heat tapPower `3×2×2=12`, но `scoreTapPower=6`, поэтому tap score остаётся `300`; рекламная добавка помогает удержанию, а не даёт прямых очков.
5. Двадцать корректных taps с любыми интервалами дают одинаковые номинальные `60 heat` до clamp/decay и двадцать отдельных tap-score начислений. Ни tap №9, ни два taps в одном 50-ms step не ослабляются.
6. Холодное клеймо в stage 5: decay `9×1,5=13,5 heat/с`, но каждый normal tap сохраняет tapPower `3`; эффект заканчивается ровно через 4 активные секунды.
7. При heat 905 и 1 активной секунде без taps Inferno hold заканчивается при пересечении 900 примерно через `0,278 с`; оставшиеся `0,722 с` действуют с decay stage 6, поэтому итоговый heat около `890,61`, stage 6. Hold score начисляется только за первые 0,278 с.
8. При `sealBroken=false`, heat `558,34` и normal tap nominal heat равен `561,34`, но применяется cap `559`: stage остаётся 4, tap принят, `scoreAcc +60`, seal получает visual impulse.
9. Terminal `rewarded` перед тем же tap сначала ставит `sealBroken=true`; tap с boost имеет heat power `6`, пересекает 560, даёт stage-5 bonus `6 000`, но direct tap score использует `scoreTapPower=3`: `3×2,5×10=75`.

### Paired canonical seal traces v3

Обе обязательные fixtures начинаются с нового профиля/start defaults; первый tap в `t=0 ms`; следующий tap планируется от предыдущего scheduled timestamp по `runHighestStage`: stages 1–2 — `500 ms`, 3–4 — `250 ms`, 5 — `200 ms`, 6–7 — `140 ms`. Общий deterministic checkpoint — конец fixed step в `t=117 000 ms`. Автоматические events используют versioned schedules этого документа; pause, restart, secondary input и wall-clock jumps отсутствуют. Один generator/config исполняется на 60/30/15 FPS.

- `canonicalSealNoBoostV3`: provider action отсутствует. Stages 2/3/4 впервые достигаются в `9 000 / 43 500 / 64 500 ms`; первый `sealBlocked` происходит на accepted tap в `101 750 ms`. В checkpoint: `runHighestStage=4`, stage 5 никогда не достигнута, `sealBroken=false`, max heat `559`, текущий heat `557,375`, `381` accepted taps, `61` blocked-at-cap impulses и score `24 507`.
- `canonicalSealBoostedV3`: непосредственно перед scheduled tap в active time `102 000 ms` fixture выполняет explicit sheet confirm и один terminal `rewarded` success с request id; wall/ad time не добавляется. К этому моменту один accepted tap в `101 750 ms` уже дал `sealBlocked`; terminal success атомарно ломает seal до обработки tap в `102 000 ms`, boost стартует после valid resume. Stages 2/3/4/5/6/7 впервые достигаются в `9 000 / 43 500 / 64 500 / 102 000 / 110 800 / 116 540 ms`. В checkpoint: `sealBroken=true`, `sealCapImpulses=1`, `410` accepted taps, heat `911,908611±0,01`, score `64 913`, current Inferno hold `320 ms`, boost remaining `5 000 ms`.

Rebaseline обязан совпадать на 60/30/15 FPS: `±0,01 heat`, `±1 score`, exact accepted taps/stage timestamps. Старые V2 threshold/decay/tap numbers не изменены; разница вызвана только cap 559 и единственным success в boosted fixture. Любое изменение intervals, seal timing, schedules или provider outcome создаёт новую fixture version.

## Edge cases

- Background/visibility/platform pause/ad: активное время и все gameplay таймеры замораживаются; после resume запрещён catch-up decay или пачка пропущенных событий.
- Rapid/multitouch input: каждый новый уникальный contact начисляет heat/score; duplicate inputId и synthetic click дедуплицируются. Emergency overflow начинается только с команды №257 внутри одного 50-ms step и не является tuning cap.
- Low FPS: accumulator обрабатывает fixed steps 50 ms по monotonic active clock; threshold crossing интерполируется. Результат одного timestamped input trace одинаков в пределах tolerance `±0,01 heat`, `±1 score`, `±10 ms hold`.
- Clock change: wall clock не влияет на run/boost; используется только для «Ритуала дня» с защитой от повторной выдачи.
- Heat at max: taps продолжают начислять tap score, но heat остаётся 1000; particle/audio feedback не создаётся сверх performance caps.
- Heat at locked seal: taps продолжают начислять stage-4 score; heat clamp 559, explanation UI и seal impulse bounded/coalesced. Никакой tap не получает `tapRejected` только из-за seal.
- Multiple threshold crossing: stage events/bonuses вызываются последовательно один раз; downward crossing не отнимает score.
- Simultaneous event and stage exit: уже наложенный Холодный debuff доигрывает срок; Порыв/Окно жара отменяются согласно их правилам; приоритет обработки задан числовым порядком update.
- Reward callback duplicate/late: один provider request имеет idempotency key; второй callback не ломает seal повторно и не выдаёт boost. Callback после restart/result не переносит unlock/награду в новый run и логируется как ignored.
- Save unavailable/quota/corruption: run продолжается; показывается ненавязчивый статус локального сохранения, defaults не содержат NaN/отрицательных рекордов.
- Reload во время active run: run намеренно не восстанавливается; records/settings сохраняются, новое состояние — READY с heat 30.
- Leaderboard unavailable/auth denied: локальный bestScore остаётся источником UI; submit retry не блокирует results/restart.
- Audio disabled/reduced motion: все telegraph/effect/Heat Window сигналы сохраняют статичную форму/иконку/текст и timing.
- Numeric safety: NaN/Infinity в расчёте считается recoverable logic error, значение восстанавливается к последнему валидному snapshot и событие попадает в telemetry; score никогда не уменьшается и не превышает `2 147 483 647`.

## Требования для downstream-документов

- `ACCEPTANCE_CRITERIA.md` должен покрыть все семь threshold/decay rows, every-valid-tap и rapid/multitouch parity, seal cap/unlock/reset, обе canonical V3 fixtures, три события без counter mini-games, scoring examples, fail/restart, provider timing, persistence и leaderboard fallback.
- `TECHNICAL_ARCHITECTURE.md` должен зафиксировать fixed-step 50 ms active-time simulation, input deduplication, state machine, versioned records/settings persistence без active-run restore и platform abstraction.
- `ART_DIRECTION.md`/`AUDIO_DIRECTION.md` должны дать различимые сигналы telegraph/effect/Heat Window и семи стадий без зависимости только от цвета/звука.
- Неопределённых значений и незаполненных шаблонных полей в этом документе нет; будущий баланс меняется только версионированным обновлением документа и связанных тестов.
