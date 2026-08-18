# Acceptance Criteria — «Зажги»

## Stop contract

Это единственный источник статуса DONE для `inferno-clicker`. Сейчас planning stage: исполняемой сборки и evidence нет, поэтому все критерии имеют статус `NOT RUN`; это не означает PASS. Перед release допустимы `PASS`, `FAIL`, `BLOCKED` и `N/A — причина`. `N/A` требует письменного обоснования Reviewer.

- Release candidate / Build ID: не назначен — planning stage
- QA report: не создан; плановый путь `tests/reports/<build-id>/qa-report.md`
- План проверен: 2026-08-18, QA Agent + Release Agent, без исполнения тестов
- DONE: только если каждый применимый пункт ниже имеет `PASS` и ссылку на evidence, нет открытых Critical/High, QA report завершён, а production build и ZIP воспроизводимы из идентифицированного commit.

## Build, quality and packaging

| ID | Проверяемое бинарное условие | Метод проверки | Статус | Плановый evidence |
|---|---|---|---|---|
| AC-01 | `npm ci`, `npm run lint`, `npm run typecheck`, `npm test`, `npm run build` и `npm run test:e2e` завершаются с exit code 0 из clean checkout на зафиксированной версии Node.js | Запустить команды по `RELEASE_PLAN.md`, сохранить версии tools и полный log | NOT RUN | `tests/reports/<build-id>/build.log` |
| AC-02 | В QA issue log нет открытых Critical и High; число открытых Critical = 0 и High = 0 | Фильтр issue log и audit Reviewer | NOT RUN | `tests/reports/<build-id>/qa-report.md` |
| AC-03 | Во всех обязательных smoke-сценариях число uncaught exceptions, unhandled rejections и unexpected console errors равно 0 | E2E console capture + ручной smoke | NOT RUN | `tests/reports/<build-id>/console/` |
| AC-04 | Игра достигает интерактивного состояния и принимает один primary input в ENV-D1, ENV-M1, ENV-M2, ENV-Y1 и ENV-Y2 | Launch smoke matrix | NOT RUN | `tests/reports/<build-id>/launch-matrix.md` |
| AC-05 | Автоматические unit/integration/contract tests проходят на 100%; ни один обязательный тест не skipped | Test report audit | NOT RUN | `tests/reports/<build-id>/automated-tests/` |
| AC-06 | Production payload проходит все PERF-01–PERF-09 бюджеты из `QA_PLAN.md` | Performance runs, traces и manifest audit | NOT RUN | `tests/reports/<build-id>/performance.md` |
| AC-07 | `dist/` не содержит credentials, `.env*`, tests, internal docs, mock SDK, editor/cache files и source maps; asset manifest не содержит отсутствующих файлов | Manifest + secret scan по `RELEASE_PLAN.md` | NOT RUN | `releases/inferno-clicker-<version>-manifest.txt` |
| AC-08 | Build ID, SemVer, commit SHA, filename ZIP, manifest и release report указывают одну release candidate | Сравнить metadata и SHA | NOT RUN | `releases/inferno-clicker-<version>-report.md` |
| AC-09 | `npm run package` завершается с exit code 0; ZIP распаковывается без ошибок; `index.html` находится в корне; все пути относительные; local static-server smoke достигает interactive state | Package, unzip в новый temp-каталог, manifest diff, launch smoke | NOT RUN | `releases/inferno-clicker-<version>.zip` + SHA-256 |
| AC-10 | QA report содержит результаты всех применимых критериев и regression evidence для каждого исправленного Critical/High/Medium | Completeness audit по case/issue IDs | NOT RUN | `tests/reports/<build-id>/qa-report.md` |
| AC-11 | Asset audit с exit code 0 подтверждает hard limits: critical art ≤2.0 MB, total art ≤5.0 MB, decoded textures ≤64 MB, critical selected audio ≤500 KB, selected audio ≤2.8 MB, both codec packs ≤5.6 MB, session transfer ≤8.0 MB, texture side ≤2048 px, particles ≤120, voices ≤16 | `npm run assets:audit` или согласованный эквивалент + runtime counters | NOT RUN | `tests/reports/<build-id>/assets-audit.md` |

## Core loop, scoring and progression

| ID | Связанное требование | Проверяемое бинарное условие | Метод | Статус | Плановый evidence |
|---|---|---|---|---|---|
| AC-G01 | Primary input | Один разрешённый tap или левый click создаёт ровно одно действие; touch и mouse дают одинаковый core snapshot при одинаковых timestamps | I-01, I-02 + deterministic integration test | NOT RUN | `tests/reports/<build-id>/input.md` |
| AC-G02 | Core loop | Первый input на новом профиле увеличивает heat и score и выдаёт visual feedback; блокирующего tutorial нет | F-01 manual + state assertion | NOT RUN | Видео F-01 + test report |
| AC-G03 | Seven stages | Достижимы ровно семь стадий и только в порядке Тьма, Искра, Пепельный слуга, Алый порог, Демонесса угасания, Круг Инферно, Инферно | F-03 на boundary fixtures | NOT RUN | `tests/reports/<build-id>/progression.md` |
| AC-G04 | Stage boundaries | Boundary fixtures подтверждают ranges `[0,80)`, `[80,220)`, `[220,380)`, `[380,560)`, `[560,730)`, `[730,900)`, `[900,1000]`; stageProgress соответствует формуле; одно crossing создаёт одно событие | Parameterized threshold−1/at/+1 tests | NOT RUN | Boundary test report |
| AC-G05 | Decay | При отсутствии modifiers каждая стадия теряет соответственно 0.5/2/4/6.5/9/13/18 heat/s активного времени с tolerance ±0.01 heat; heat clamp ≥0 | Fake-clock F-04 tests | NOT RUN | Decay test report |
| AC-G06 | Scoring | Tap score равен `10×(tapPower/rewardedFactor)×multiplier`, Inferno hold — `50×multiplier×activeSeconds`; все 7 examples/golden vectors совпадают; score=`floor(scoreAcc)`, не уменьшается, безопасен до `Number.MAX_SAFE_INTEGER`, затем показывает `MAX` | Deterministic formula unit tests | NOT RUN | Scoring test report |
| AC-G07 | Cadence and Resonance | F-07 и F-08 проходят: cadence factors для taps 1–8 точны, overflow не влияет на core; 4 ритмичных tap запускают ровно SURGE 1.50 s, затем BREATH 1.00 s с документированными modifiers | Fake-clock comparative simulation | NOT RUN | Rhythm simulation report |
| AC-G08 | Ash Servant | F-09 проходит для cancel/fail/stage-exit: timing 8/14/1/2.5 s, counter 4 taps, reward `250×stageMultiplier`, fail `decay×1.8`; stacking/event priority соответствует design | Fake-clock F-09 | NOT RUN | Enemy test report + video |
| AC-G09 | Demoness | F-10 проходит для cancel/fail/stage-exit: timing 10/16/2/4 s, counter 6 taps, reward `500×stageMultiplier`, fail `tap×0.55` + `decay×1.5`; modifier полностью снимается | Fake-clock F-10 | NOT RUN | Enemy test report + video |
| AC-G10 | Inferno endgame | Timer растёт только при stage = Инферно и active gameplay; выход/пауза останавливает timer; новый record сохраняет max | F-11 + P-01 | NOT RUN | Inferno timer report |
| AC-G11 | Restart | Restart обнуляет все session-only поля и активные эффекты, сохраняет только перечисленные meta maxima и позволяет начать новый run без reload | F-12 | NOT RUN | Restart state snapshots |
| AC-G12 | State invariants | После 10-минутного scripted run нет `NaN`, отрицательного heat, out-of-range stage/stageProgress, multiplier выше cap или зависшего modifier | F-14 property/integration test | NOT RUN | Long-run report |
| AC-G13 | Fail/restart | После достижения stage 2 heat=0 непрерывно 2.0 s приводит в RESULTS, tap раньше boundary отменяет fail; до stage 2 zero возвращает READY; restart бесплатен и начинает `heat=30`, score=0 без effects | F-15 + F-12 boundary tests | NOT RUN | Fail/restart report |
| AC-G14 | No-ad pacing | Canonical no-ad trace при устойчивых 3–5 taps/s достигает stage 2 за 5–15 s, stage 3 за 25–50 s, stage 5 за 75–150 s и Inferno за 150–300 s | F-16 deterministic balance simulation | NOT RUN | No-ad balance report |
| AC-G15 | One-time progression rewards | Stage bonuses 500/1500/3000/6000/10000/20000 выдаются ровно один раз за run; multi-threshold tap выдаёт ещё не полученные bonuses по порядку; downward/re-entry не повторяет их | Boundary and multi-crossing unit tests | NOT RUN | Stage bonus report |
| AC-G16 | Heat Window | F-08a проходит: stage 6+ schedule 6 then 9/11/8/10 s, telegraph 0.75 s, active 1.50 s, heat tap factor 2, multiplier unchanged, no stacking with own SURGE | Fake-clock event test | NOT RUN | Heat-window report + video |

## Input, viewport and visual quality

| ID | Проверяемое бинарное условие | Метод проверки | Статус | Плановый evidence |
|---|---|---|---|---|
| AC-U01 | I-01–I-06 и I-02a проходят на touch и mouse; accepted input ≤8 per rolling second, rapid input не создаёт synthetic double-click, stuck pointer или page scroll в play area | Automated pointer tests + ENV-D1/ENV-M1/ENV-M2 manual | NOT RUN | `tests/reports/<build-id>/input.md` |
| AC-U02 | Каждый UI control имеет target не меньше 48×48 CSS px, flame primary target — не меньше 96×96 CSS px; они достижимы на 320×568, 360×640, 360×800, 390×844, 412×915, 768×1024, 1366×768 и 1440×900 | DOM geometry audit + screenshots | NOT RUN | `tests/reports/<build-id>/ui-geometry.json` |
| AC-U03 | На обязательных viewports нет перекрытия/обрезки HUD и controls, unintended scrollbar или потери primary action; orientation/resize сохраняет run state | Viewport matrix and resize tests | NOT RUN | `tests/reports/<build-id>/visual/viewport-matrix.md` |
| AC-U04 | Для stages 1–7 во всех reference viewports V-01–V-10 из visual rubric имеют 1; обязательных rubric failures = 0 | Art + QA review signed per screenshot | NOT RUN | `tests/reports/<build-id>/visual/rubric.md` |
| AC-U05 | Essential text contrast ≥ 4.5:1 (large text ≥ 3:1); state meaning не передаётся только цветом | Automated/manual contrast audit | NOT RUN | Contrast report |
| AC-U06 | Reduced-motion mode удаляет shake/heat distortion и быстрые full-screen flashes; частота full-screen flashes ≤ 3/s | Motion capture/frame analysis | NOT RUN | Reduced-motion video/report |
| AC-U07 | Все release captures не содержат gore, крови, realistic injury, explicit sexual content, placeholder art, missing texture или broken glyph | Full capture-set review | NOT RUN | Signed visual rubric |

## Persistence, platform and monetization

| ID | Проверяемое бинарное условие | Метод проверки | Статус | Плановый evidence |
|---|---|---|---|---|
| AC-P01 | P-01–P-06 проходят: current/legacy/empty/corrupt/future data безопасно обрабатываются, maxima не уменьшаются, storage failure не блокирует игру; reload сохраняет records/settings, но никогда не восстанавливает active run | Persistence suite for Web and fake platform | NOT RUN | Persistence report |
| AC-P02 | Публично отправляется только целочисленный Best Score; lower/duplicate submit его не уменьшает; unavailable leaderboard оставляет local best и не вызывает crash | P-07/P-08 contract and manual tests | NOT RUN | Leaderboard report |
| AC-P03 | Core source и core bundle не импортируют и не обращаются к Yandex SDK/global; Yandex logic находится только в adapter | Static import/bundle scan + architecture review | NOT RUN | Dependency audit |
| AC-P04 | Web adapter без SDK позволяет полный core loop, persistence и restart; leaderboard/rewarded объявлены unavailable без fake reward и crash | Web fallback E2E R-06/P-08 | NOT RUN | Web fallback report |
| AC-P05 | Для rewarded success игра/decay/input/audio паузятся до ad callback; подтверждённый reward выдаётся ровно один раз; resume выполняется ровно один раз | R-01/R-03 + lifecycle trace | NOT RUN | Rewarded success trace/video |
| AC-P06 | Для rewarded cancel/error/unavailable/timeout reward не выдаётся, boost не запускается, session state сохраняется и gameplay возобновляется не более одного раза | R-02/R-03/R-06 contract matrix | NOT RUN | Rewarded failure matrix |
| AC-P07 | «Печать Инферно» даёт `tapPower ×2.0` ровно на 20 s active gameplay, не даёт direct tap-score за дополнительный heat, не расходует timer в pause/ad/background и снимает modifier ровно один раз | R-01/R-04/R-05 fake-clock tests | NOT RUN | Boost test report |
| AC-P08 | CTA доступна только при `runHighestStage≥3` и active run age ≥45 s, скрыта в encounter/transition/pause/active boost, успешный bonus ограничен одним на run, а после success действует session cooldown 90 s; persisted `highestStageReached` сам по себе не даёт eligibility; F-16 достигает Инферно без рекламы | UI path audit + R-07 + F-16 | NOT RUN | Monetization flow video + no-ad balance report |
| AC-P09 | Yandex adapter проходит init reject/timeout, save/load, leaderboard, ad success/cancel/error и lifecycle cases в test environment после проверки актуальной документации | Adapter contract + ENV-Y1/ENV-Y2 manual | NOT RUN | Yandex integration report |

## Audio and lifecycle

| ID | Проверяемое бинарное условие | Метод проверки | Статус | Плановый evidence |
|---|---|---|---|---|
| AC-A01 | До первого gesture нет autoplay error; после gesture запускается не более одного экземпляра каждого loop; tap onset p95 ≤50 ms | A-01/A-02 browser console + audio graph inspection | NOT RUN | Audio lifecycle report |
| AC-A02 | Mute действует на all buses, сохраняется после reload и не сбрасывается restart | A-04 on ENV-D1/ENV-M1/ENV-M2 | NOT RUN | Audio preference report |
| AC-A03 | Stages 1–7, enemy events и boost имеют события/слои из `AUDIO_DIRECTION.md`; переходы без click/pop и duplicate loop | A-03/A-06 capture and event trace | NOT RUN | Audio progression report |
| AC-A04 | Background, focus loss, pause и все ad outcomes дают не более одного pause и одного valid resume; gameplay clock и audio resume синхронны | A-05/A-06 lifecycle matrix | NOT RUN | Lifecycle trace |
| AC-A05 | Stage 7 stress full mix соответствует target `-14 LUFS-I`, true peak ≤ `-1 dBTP`; tap, enemy telegraph и stage-up слышимы в каждом reference capture | Metered mix check + QA listening rubric | NOT RUN | Mix measurement/report |
| AC-A06 | Ошибка загрузки каждого audio group не создаёт uncaught error и не блокирует игру; fallback codec или silent mode активируется | Forced asset/codec failure tests | NOT RUN | Audio failure report |

## Решение на planning stage

- DONE: NO
- Невыполненные пункты: все AC-01–AC-11, AC-G01–AC-G16, AC-U01–AC-U07, AC-P01–AC-P09, AC-A01–AC-A06 имеют `NOT RUN`.
- Release gate: закрыт до implementation, QA, fix cycle и regression QA.
- Подпись ролей QA/Reviewer/Release: QA Agent + Release Agent, planning draft 2026-08-18; Reviewer и финальные подписи ожидаются на release candidate.
