# Game Design — «Зажги»

## Cycle 07 presentation-only clarification

Числовые правила, расписания и причинность событий ниже не меняются. Cycle 07 имеет precedence над конфликтующими presentation-формулировками Cycle 06 и заменяет только визуальное выражение событий:

- `Порыв слуги`: те же `1,0 с` telegraph и `2,5 с` effect; стабильный Ash Servant выдыхает поток пара из покадрового mouth socket в текущую видимую область пламени. Снежинки отсутствуют. Поза может меняться, но непреднамеренный scale drift головы/торса/конечностей остаётся `≤2%`.
- `Холодное клеймо`: те же `2,0 с` telegraph и `4,0 с` effect; Demoness кастует два потока пара из покадровых `leftHand`/`rightHand` palm sockets в текущую видимую область пламени. Льдины, сосульки, shards, projectile contact и legacy cold ribbon отсутствуют. Gameplay effect по-прежнему начинается по core schedule и не зависит от Canvas collision или времени достижения пара.
- На pause все presentation clocks и steam emitters замораживаются без catch-up; cancel/teardown очищает их. Reduced Motion и low quality сохраняют читаемые `mouth→steam` и `both palms→steam` связи, уменьшая только необязательную плотность.
- Автоматическое снижение presentation quality не показывает toast и не меняет heat, score, accepted taps, event order или active-time timers.

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
- `enemyDecayFactor` — произведение активных вражеских факторов, ограниченное диапазоном `[1,00;2,50]`; это не tap penalty и не permission state.
- `multiplier` — multiplier текущей stage в диапазоне `[1,5]`; временные эффекты и rewarded boost его не умножают.
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
→ все семь stages открываются теми же прямыми taps без provider permission
→ добровольный rewarded success может временно дать ×2 heat на 20 active seconds
→ после входа в Инферно игрок удерживает heat ради score и рекорда времени
```

Первый tap должен изменить visual state в том же кадре обработки ввода. Отдельный tap SFX не обязателен: feedback может состоять из реакции огня, flare и sparks без раздражающего повторного звука. Длинный tutorial отсутствует: до первого ввода пульсирует уголёк и показана строка «Жми, чтобы разжечь»; она исчезает после первого принятого tap. Product intent для presentation: огонь использует заметную sprite/frame animation, персонажи имеют appearance/idle/attack-состояния, а звуковая среда состоит прежде всего из огня и воздушного раздувания; эти presentation-состояния не добавляют tap timing rule.

## Ввод и допустимые действия

- Gameplay input — один логический `tap`: left mouse `pointerdown` либо новый touch/pen contact внутри центральной интерактивной области. Одно физическое касание не может породить одновременно pointer и synthetic click.
- Каждый уникальный корректный `pointerdown`, включая разные touch `pointerId`, принимается ровно один раз. Повтор одного активного pointerId до `pointerup/pointercancel`, повторный `inputId`, secondary mouse button, удержание, drag за пределами области и synthetic repeat игнорируются.
- Все уникальные taps с timestamp внутри simulation step `50 ms` обрабатываются по `(timestamp, enqueue order)`. Нет rolling rate cap, diminishing return, cooldown или combo requirement.
- Только невозможный synthetic flood ограничен `256` уникальными командами в одном step (`>5120 taps/s`); дальнейшие команды получают технический `input-overflow`, не являющийся частью баланса. Visual feedback может агрегироваться, но heat и score применяются для каждого принятого tap до общего ceiling `1000`.
- UI-кнопки pause, mute, reduced motion, rewarded offer, restart и leaderboard не считаются gameplay taps.
- Во время `PAUSED`, `AD_BREAK`, `RESULTS` и `LOADING` gameplay taps не принимаются.
- Базовая прогрессия требует постепенно повысить частоту примерно с 2 taps/с на ранних stages до 7,14 taps/с возле Inferno. Все stages достижимы без reward теми же прямыми taps.

## Числовой порядок обновления

Каждый фиксированный simulation step длительностью 50 ms в активном состоянии:

1. Разбить step по границам таймеров и timestamps всех принятых taps; для одинакового timestamp сохранить enqueue order.
2. До каждой границы применить decay за точный elapsed slice и завершить истёкшие эффекты.
3. Для каждого tap на границе рассчитать `tapPower` и прибавить heat с единственным clamp `1000`.
4. Пересчитать stage по новому heat; каждую впервые пересечённую вверх границу начислить один stage bonus. Если один tap пересёк несколько границ, начисляются все ещё не полученные бонусы по порядку.
5. Начислить tap score с multiplier уже пересчитанной новой stage; Inferno hold score и время начислять только за фактические slices при `heat ≥900`.
6. После последнего tap применить оставшийся slice до конца step и обновить `score`, `bestScore`, `stageProgress` и persistence dirty state.

При crossing внутри simulation step время/score стадии делятся в точке линейного пересечения порога, чтобы результат не зависел от frame rate.

## Heat, tapPower и decay

Базовый `baseTapPower = 3 heat`.

`tapPower = baseTapPower × heatWindowFactor × rewardedFactor`

- `heatWindowFactor = 2,00` только во время мирового Окна жара; иначе `1,00`.
- `rewardedFactor = 2,00` только во время добровольного rewarded boost; иначе `1,00`.
- Факторы перемножаются. Каждый normal tap даёт ровно `3 heat`, Heat Window или rewarded — `6`, оба эффекта вместе — `12`; `heat = min(1000, heat + tapPower)`.

Для scoring используется `scoreTapPower = tapPower / rewardedFactor`: добавочный heat от рекламы не даёт прямых tap-score points, но может косвенно помочь быстрее войти в высокую stage или дольше её удерживать.

`effectiveDecayRate = stageDecay × enemyDecayFactor`

- `enemyDecayFactor` равен произведению применимых вражеских эффектов, но итоговый множитель ограничен максимумом `2,50`.
- Rewarded boost decay не уменьшает.

Если `heat` равен 0, decay прекращается. До первого gameplay tap run находится в `READY`, и decay/таймеры не идут.

## Direct-tap pressure

Каждый корректный tap имеет одинаковую базовую отдачу независимо от предыдущих интервалов. Никакое состояние не требует cadence/combo/provider-права на эффективный tap. Возрастающая сложность полностью наблюдаема в `stageDecay`: для удержания stage 7 без событий требуется больше `18/3 = 6 taps/s`; при коротком Порыве слуги требуется до `32,4/3 = 10,8 taps/s`, при Клейме — `27/3 = 9 taps/s`, при их пересечении cap даёт `45/3 = 15 taps/s`. Последнее — короткое окно, а не sustained target: taps не ослабляются, а временный отрицательный net heat компенсируется до/после эффекта.

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
| 4 | Алый порог | `[380,560)` | 6,5 | врата, цепи, яркие руны, огненные трещины и силуэт большой сущности |
| 5 | Демонесса угасания | `[560,730)` | 9,0 | появляется стилизованная демонесса; активно Холодное клеймо |
| 6 | Круг Инферно | `[730,900)` | 13,0 | наблюдатели, глаза, цепи, множество рун и жар; активны Окна жара |
| 7 | Инферно | `[900,1000]` | 18,0 | огненный столб, максимальное раскрытие и множитель; цель — удержание |

Целевые ориентиры при постепенном росте частоты от 2 до 7,14 taps/с: стадия 2 — `5–15 с`, стадия 3 — `25–50 с`, stage 4 — `55–80 с`, stage 5 — `90–120 с`, первый вход в Инферно — `90–180 с`. Это playtest targets, а не скрытое scaling: формулы не меняются по пользователю. Обязательный no-reward V5 trace достигает stage 7; boosted trace измеряет только ускорение.

## Прямая прогрессия stage 4 → 5

- Порог stage 5 равен `560` и пересекается обычным accepted tap, как любой другой threshold; единственный heat ceiling равен `1000`.
- Rewarded availability, provider outcome, сеть, авторизация и persisted records не участвуют в stage calculation.
- При heat `558,34` normal tap даёт heat `561,34`, stage 5 и однократный stage-5 bonus; отдельного permission state или unlock event нет.

## Вражеские события и Heat Window

Каждый источник использует собственный countdown активного времени и не замораживает другие eligible источники. Поэтому Пепельный слуга, Демонесса и friendly Heat Window могут иметь одновременные telegraph/effect phases. При совпадении timestamp transitions обрабатываются в стабильном порядке `Демонесса → Пепельный слуга → Окно жара` только ради детерминированного event stream; это не приоритет и не отменяет остальные события. Повторный interval каждого источника начинается после завершения его собственного effect.

Одновременные вражеские эффекты рассчитываются предсказуемо: `enemyDecayFactor = min(2,50; servantFactor × demonessFactor)`. Один Пепельный выдох даёт `×1,80`, одно Холодное угасание — `×1,50`, вместе получается cap `×2,50`, а не `×2,70`. Этот фактор умножает только stage decay; normal tapPower остаётся `3`, любой tap сохраняет score и не сокращает таймер. Heat Window и rewarded boost являются отдельными положительными статусами и в enemy factor не входят.

### Порыв слуги — stage 3+

- Первый trigger через `8,0 с` после первого входа в stage 3; затем каждые `14,0 с` активного времени, пока `heat ≥220`.
- Телеграф `1,0 с`: слуга вдыхает, вокруг пламени собирается пепел.
- Визуально слуга остаётся цельным и стабильным без заметного уменьшения, затем выдыхает из фактического положения рта пар в живую точку пламени; непреднамеренный scale drift≤2%, а телеграф и gameplay timing от количества кадров не зависят.
- После телеграфа всегда следуют `2,5 с` с `enemyDecayFactor ×1,80`. Taps не отменяют событие, сохраняют полную базовую силу и остаются доступными.
- Выход ниже 220 отменяет телеграф/эффект без награды; при возврате отсчёт начинается заново с 8,0 с.

### Холодное клеймо — stage 5+

- Первый trigger через `10,0 с` после первого входа в stage 5; затем каждые `16,0 с` активного времени, пока `heat ≥560`.
- Телеграф длится `2,0 с`; после него всегда применяются `4,0 с` с `enemyDecayFactor ×1,50`. Taps не ломают клеймо и не теряют базовую силу.
- Визуально каст читается как `обе ладони → два потока пара → текущее пламя`; сосульки, ледяные shards и detached/single-origin effect запрещены. Визуальная реакция огня следует существующей effect phase и не изменяет core timing.
- Понижение ниже 560 не снимает уже наложенный 4-секундный debuff, но отменяет незавершённый телеграф и приостанавливает следующий trigger.

### Окно жара — stage 6+

- Первое friendly window через `6,0 с` после входа в stage 6; затем интервал детерминированно чередуется `9, 11, 8, 10 с` активного времени, пока `heat ≥730`.
- За `0,75 с` появляется расширяющееся огненное кольцо, затем окно активно `1,50 с`.
- Внутри окна `heatWindowFactor=2`; окно не меняет stage multiplier.
- Понижение ниже 730 отменяет telegraph/window; при возврате первый trigger снова через 6,0 с.

Все события обязаны иметь отдельный визуальный сигнал; критический смысл не может передаваться только цветом или звуком. Активные enemy effects выводятся отдельными строками: `Пепельный слуга / Пепельный выдох / Decay ×1,80` и `Демонесса угасания / Холодное угасание / Decay ×1,50`, каждая со своим remaining time. При overlap обе строки видимы одновременно; optional total `Общий decay ×2,50` не заменяет источники.

## Необязательный rewarded boost — «Усиление жара ×2»

- Placement разблокируется, когда в текущем run одновременно выполнены `runHighestStage ≥4` и `activeRunTime ≥45,0 с`. Persisted all-time record `highestStageReached` не делает новый run eligible сам по себе. Компактная неблокирующая CTA видна только в safe PLAYING, не перекрывает flame и при click лишь открывает pause/boost confirm sheet с pause reason `menu`. Provider запускается отдельным confirm control внутри этого явно открытого sheet, после чего добавляется pause reason `ad`. Во время encounter, stage transition, любого другого pause, active boost или pending request opener CTA скрыта. Модальное предложение само не появляется.
- После подтверждённого terminal `rewarded` callback ровно один раз запускается `20,0 с` активного gameplay времени с `rewardedFactor=2`; boost начинается только после valid resume и ничего не разблокирует.
- Визуальный power mode: более светлое ядро/оттенок огня, усиленный glow и particles в пределах performance/reduced-motion budget; отдельный sound cue, не обязательный для понимания.
- Boost не меняет stage thresholds, stage multiplier, decay или event schedule. Он усиливает heat tapPower; добавочная provider-половина tapPower исключается из прямого tap-score через `scoreTapPower`.
- Лимит `1` подтверждённый boost за run; offer исчезает после успеха. Следующий показ в новом run разрешён не раньше чем через `90 с` активного времени текущей app session после успешного reward; session cooldown не сохраняется после полного перезапуска приложения.
- Cancel/error/unavailable даёт 0 награды, не расходует единственную попытку и не запускает cooldown. Terminal callback снимает только pause reason `ad`: при отсутствии других reasons игра ровно один раз возвращается в `PLAYING`, иначе остаётся `PAUSED`. Повторный добровольный запрос разрешён. Игра, таймеры и звук не идут во время provider flow.
- Без offer доступны direct-tap run, stages 1–7, локальные рекорды и restart. Для аналитики/результата сохраняется только `boostUsed`; публичный `Best Score` принимает boosted и non-boosted runs.

## Прогрессия, leaderboard и persistence

### Внутри run

- Цель до stage 7: прямыми taps открывать следующую область и получать stage bonus; optional boost лишь сокращает время набора heat.
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
- «Ритуал дня» выбирается детерминированно по локальной календарной дате: достичь заданной stage, набрать score или удерживать Inferno заданное время. Ни одна задача не требует provider/boost.
- За первое выполнение дня выдаётся только визуальная отметка дня и result celebration, без heat/score преимущества. Пропуск дня ничего не сбрасывает; streak и наказание отсутствуют.
- Clock rollback не может выдать вторую отметку за уже записанную календарную дату; невозможность определить дату отключает ежедневную задачу, но не core game.

## Сложность

- Сложность растёт только через табличный stage decay, новые телеграфируемые события и более высокую цену ошибки на большом heat.
- Dynamic difficulty adjustment, скрытое изменение tapPower, rubber-banding и зависимость progression от provider запрещены.
- Игрок компенсирует рост decay только большей частотой полноценных базовых taps; Heat Window даёт короткий понятный запас, а rewarded/test boost — необязательный фиксированный power spike.
- Measurable tuning: canonical cadence равна `2 taps/s` на stages 1–2, `4 taps/s` на stages 3–4, `5 taps/s` на stage 5 и `7,14 taps/s` на stages 6–7. Номинальный normal net без events: stage 4 `12−6,5=+5,5 heat/s`, stage 5 `15−9=+6`, stage 6 `21,43−13=+8,43`, stage 7 `21,43−18=+3,43`. В stage-7 servant effect требуется `>10,8 taps/s`, но это краткое event-window, а не постоянная cadence gate.
- V5 fixture targets с независимыми concurrent schedules: no-reward stage 7 достигается в `164,80 с`; optional boost в `65,00 с` сокращает это до `102,71 с`. Gameplay tap-комбинации и cadence cooldown отсутствуют.
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
| Усиление жара ×2 | confirmed terminal `rewarded` после stage 4 eligibility | heat tapPower ×2 на 20 активных секунд; прямой tap score без provider-добавки; progression permission не меняется | 1/run; 90 с session cooldown после успеха; cancel/error без расхода |
| Personal best | превышение сохранённого значения | result celebration + сохранение/submit | без gameplay power |
| Ритуал дня | первое выполнение дневной задачи | визуальная отметка и celebration | 1/локальную дату, без streak |

## Игровые состояния

| Состояние | Вход | Допустимые действия | Выход | Pause policy |
|---|---|---|---|---|
| `LOADING` | запуск приложения | mute/reduced motion, если UI готов | успешный init → READY; recoverable platform failure → READY web fallback; fatal asset/core failure → ERROR | таймеров gameplay нет |
| `READY` | загрузка или onboarding reset до stage 2 | gameplay tap, settings | первый tap → PLAYING | decay, score и события не идут |
| `PLAYING` | первый tap/restart/resume | gameplay tap, pause, settings, открыть eligible boost sheet | user/system/sheet pause → PAUSED; fail → RESULTS; fatal → ERROR | активное время идёт; heat clamp всегда 1000 |
| `PAUSED` | user pause, visibility hidden, platform pause или открытый confirm sheet | resume, settings, confirmed restart; dedicated rewarded confirm только если sheet открыт из eligible safe PLAYING и других pause reasons нет | resume → PLAYING; rewarded confirm → AD_BREAK; confirmed restart → RESULTS с `abandoned=true` | все gameplay/audio/timers заморожены; opener CTA скрыта |
| `AD_BREAK` | запуск rewarded рекламы | только platform-controlled UI | terminal callback снимает только `ad`: при оставшихся reasons → PAUSED, иначе → PLAYING; confirmed reward дополнительно ставит queued boost, который стартует после valid resume | полная заморозка, audio muted/paused |
| `RESULTS` | условие угасания или confirmed restart | restart, leaderboard, settings | restart → READY | gameplay заморожен; persistence завершается |
| `ERROR` | невосстановимая ошибка core/assets | retry/reload | успешный retry → LOADING | gameplay/audio остановлены; понятное сообщение без stack trace |

## Проверяемые примеры

1. Новый run: heat 30, stage 1. Один обычный tap без эффектов даёт tapPower 3, heat 33, multiplier 1 и `scoreAcc +30`.
2. При heat 78 обычный tap сначала даёт heat 81 и stage 2; tap points рассчитываются с новым stage multiplier: `3×1,25×10=37,5`, плюс stage bonus 500, итоговое приращение `537,5` в scoreAcc и `537` на экране.
3. В stage 7 normal tap всегда даёт tapPower `3`, multiplier `5` и tap score `150`; удержание без событий требует частоты выше `6 taps/с`, потому что decay равен `18 heat/с`.
4. В Heat Window stage 7 tapPower `3×2=6`, multiplier остаётся `5`, tap score `300`. При одновременном rewarded boost heat tapPower `3×2×2=12`, но `scoreTapPower=6`, поэтому tap score остаётся `300`; рекламная добавка помогает удержанию, а не даёт прямых очков.
5. Двадцать корректных taps с любыми интервалами дают одинаковые номинальные `60 heat` до clamp/decay и двадцать отдельных tap-score начислений. Ни tap №9, ни два taps в одном 50-ms step не ослабляются.
6. Холодное клеймо в stage 5: decay `9×1,5=13,5 heat/с`, но каждый normal tap сохраняет tapPower `3`; эффект заканчивается ровно через 4 активные секунды.
7. При одновременных Пепельном выдохе и Холодном угасании в stage 5: raw product `1,80×1,50=2,70`, effective factor ограничен `2,50`, поэтому decay равен `9×2,50=22,5 heat/с`. Обе source-строки и оба таймера остаются отдельными; tap сохраняет heat power `3`.
8. При heat 905 и 1 активной секунде без taps Inferno hold заканчивается при пересечении 900 примерно через `0,278 с`; оставшиеся `0,722 с` действуют с decay stage 6, поэтому итоговый heat около `890,61`, stage 6. Hold score начисляется только за первые 0,278 с.
9. При heat `558,34` normal tap даёт heat `561,34`, пересекает stage 5, начисляет bonus `6 000` и tap score `3×2,5×10=75` без reward или permission state.
10. При том же heat и active rewarded boost tap имеет heat power `6`, но direct tap score всё равно использует `scoreTapPower=3`: `3×2,5×10=75`.

### Paired canonical direct traces v5

Обе обязательные fixtures начинаются с нового профиля/start defaults; первый tap в `t=0 ms`; следующий tap планируется от предыдущего scheduled timestamp по `runHighestStage`: stages 1–2 — `500 ms`, 3–4 — `250 ms`, 5 — `200 ms`, 6–7 — `140 ms`. Общий deterministic checkpoint — конец fixed step в `t=180 000 ms`. Автоматические events используют versioned schedules этого документа; pause, restart, secondary input и wall-clock jumps отсутствуют. Один generator/config исполняется на 60/30/15 FPS.

- `canonicalDirectNoRewardV5`: provider action отсутствует. Stages 2/3/4/5/6/7 впервые достигаются в `9 000 / 43 500 / 64 500 / 102 000 / 145 200 / 164 800 ms`. В checkpoint: `runHighestStage=7`, heat `946,465417±0,01`, `786` accepted taps, score `110 498`, current Inferno hold `15 060 ms`.
- `canonicalDirectBoostedV5`: в active time `65 000 ms` fixture выполняет explicit sheet confirm и один terminal `rewarded` success; wall/ad time не добавляется. Stages 2/3/4/5/6/7 впервые достигаются в `9 000 / 43 500 / 64 500 / 75 750 / 83 950 / 102 710 ms`. В checkpoint: `runHighestStage=7`, heat `936,94±0,01`, `944` accepted taps, score `180 220`, current Inferno hold `65 950 ms`; boost уже завершён.

Rebaseline обязан совпадать на 60/30/15 FPS: `±0,01 heat`, `±1 score`, exact accepted taps/stage timestamps. Threshold/decay/tap numbers не изменены; boosted fixture отличается только одним optional success. Любое изменение intervals, schedules или provider outcome создаёт новую fixture version.

### Tap-rate simulation matrix v2

Все сценарии начинаются с tap в `0 ms`, используют постоянный interval и checkpoint `180 000 ms`; результаты проверяются на 60/30/15 FPS.

| Профиль | Interval / rate | Reward | Первый максимум stage | Final stage / heat | Score |
|---|---:|---|---|---:|
| slow | `500 ms / 2 taps/s` | нет | stage 4 в `147 000 ms` | 3 / `378,694709` | `21 282` |
| normal | `250 ms / 4 taps/s` | нет | stage 5 в `76 500 ms` | 5 / `686,392122` | `57 380` |
| fast | `200 ms / 5 taps/s` | нет | stage 6 в `92 200 ms` | 6 / `842,172935` | `96 562` |
| very-fast | `140 ms / 7,14 taps/s` | нет | stage 7 в `66 920 ms` | 7 / `932,08` | `238 888` |
| boosted-normal | `250 ms / 4 taps/s` | success в `68 000 ms` | stage 6 в `83 250 ms` | 5 / `729,047761` | `73 972` |

### Human-input profile contract v1

`tests/fixtures/human-input-profiles.json` задаёт неравномерные pointer/touch timestamp patterns для production-browser replay: casual mobile `2,50 taps/s`, fast mobile `4,55 taps/s`, casual mouse `3,57 taps/s`, skilled mouse bursts `7,14 taps/s` по 8 секунд с отдыхом `1,3 с`, extreme burst `10 taps/s` ровно 3 секунды на фоне fast-mobile pattern. Headless результаты и точные интервалы находятся в `reports/BALANCE_REPORT.md`. Они подтверждены на 60/30/15 FPS, но не считаются browser PASS до реального production-browser replay на touch-emulation и mouse.

## Edge cases

- Background/visibility/platform pause/ad: активное время и все gameplay таймеры замораживаются; после resume запрещён catch-up decay или пачка пропущенных событий.
- Rapid/multitouch input: каждый новый уникальный contact начисляет heat/score; duplicate inputId и synthetic click дедуплицируются. Emergency overflow начинается только с команды №257 внутри одного 50-ms step и не является tuning cap.
- Low FPS: accumulator обрабатывает fixed steps 50 ms по monotonic active clock; threshold crossing интерполируется. Результат одного timestamped input trace одинаков в пределах tolerance `±0,01 heat`, `±1 score`, `±10 ms hold`.
- Clock change: wall clock не влияет на run/boost; используется только для «Ритуала дня» с защитой от повторной выдачи.
- Heat at max: taps продолжают начислять tap score, но heat остаётся 1000; particle/audio feedback не создаётся сверх performance caps.
- Multiple threshold crossing: stage events/bonuses вызываются последовательно один раз; downward crossing не отнимает score.
- Simultaneous event and stage exit: уже наложенное Холодное угасание доигрывает срок; Пепельный выдох/Окно жара отменяются согласно их правилам; независимые timers не сливаются, оба enemy-source rows остаются отдельными, а factor всегда ограничен `×2,50`.
- Reward callback duplicate/late: один provider request имеет idempotency key; второй callback не выдаёт boost повторно. Callback после restart/result не переносит награду в новый run и логируется как ignored.
- Save unavailable/quota/corruption: run продолжается; показывается ненавязчивый статус локального сохранения, defaults не содержат NaN/отрицательных рекордов.
- Reload во время active run: run намеренно не восстанавливается; records/settings сохраняются, новое состояние — READY с heat 30.
- Leaderboard unavailable/auth denied: локальный bestScore остаётся источником UI; submit retry не блокирует results/restart.
- Audio disabled/reduced motion: все telegraph/effect/Heat Window сигналы сохраняют статичную форму/иконку/текст и timing.
- Numeric safety: NaN/Infinity в расчёте считается recoverable logic error, значение восстанавливается к последнему валидному snapshot и событие попадает в telemetry; score никогда не уменьшается и не превышает `2 147 483 647`.

## Требования для downstream-документов

- `ACCEPTANCE_CRITERIA.md` должен покрыть все семь threshold/decay rows, every-valid-tap и rapid/multitouch parity, обе canonical V5 fixtures, tap-rate matrix, human-input browser replays, concurrent source rows/`×2,50` cap, три события без counter mini-games, scoring examples, fail/restart, optional provider timing, persistence и leaderboard fallback.
- `TECHNICAL_ARCHITECTURE.md` должен зафиксировать fixed-step 50 ms active-time simulation, input deduplication, state machine, versioned records/settings persistence без active-run restore и platform abstraction.
- `ART_DIRECTION.md`/`AUDIO_DIRECTION.md` должны дать различимые сигналы telegraph/effect/Heat Window и семи стадий без зависимости только от цвета/звука.
- Неопределённых значений и незаполненных шаблонных полей в этом документе нет; будущий баланс меняется только версионированным обновлением документа и связанных тестов.
