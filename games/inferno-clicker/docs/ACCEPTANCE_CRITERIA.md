# Acceptance Criteria — «Зажги»

Это исполнимый stop contract и единственный источник статуса DONE для `inferno-clicker`. Сейчас проект находится на planning stage: исполняемой сборки, QA report и release artifacts нет, поэтому каждый критерий имеет статус `NOT RUN`; это не означает PASS.

- Release candidate / Build ID: не назначен — planning stage.
- QA report: не создан; плановый путь `tests/reports/<build-id>/qa-report.md`.
- План проверен: 2026-08-18, QA Agent + Release Agent; production-код и тесты не запускались.
- Перед release допустимы статусы `PASS`, `FAIL`, `BLOCKED`, `N/A — причина`. Каждый `PASS` обязан ссылаться на evidence от exact Build ID; `N/A` требует письменного обоснования Reviewer.
- DONE разрешён только когда все применимые строки восьми групп ниже имеют `PASS`, открытых Critical = 0 и High = 0, QA report завершён, regression подтверждён, а production build и ZIP воспроизводимы из одного идентифицированного commit.
- VK Mini Apps и Android/RuStore не входят в scope первой реализации и не являются строками этого stop contract; заявить их поддержку можно только отдельным change request.

## Functional

Идентификаторы этого документа квалифицируются как `AC:<ID>`; case IDs из `QA_PLAN.md` — как `QA:<ID>`. Например, `AC:F-08` и `QA:F-08` — разные сущности и всегда записываются с префиксом документа в traceability report.

| ID | Проверяемое бинарное условие | Метод проверки | Статус | Плановый evidence |
|---|---|---|---|---|
| F-01 | Web build достигает интерактивного `READY` и принимает первый primary input в ENV-D1/D2/D3/M1/M2/M3/L1; loading overlay снят, fatal error отсутствует | Launch smoke с console capture | NOT RUN | `tests/reports/<build-id>/functional/launch-matrix.md` |
| F-02 | Один primary `pointerdown` touch или left mouse создаёт не более одной команды `Tap`; одинаковый timestamp trace через touch и mouse совпадает в tolerance ±0.01 heat, ±1 score, ±10 ms hold и exact discrete state | `QA:I-01`/`QA:I-02`, deterministic E2E | NOT RUN | `tests/reports/<build-id>/functional/input-parity.md` |
| F-03 | Secondary/right/middle click, multitouch-дубликат, hold, cancelled pointer, release outside и UI-control input не меняют heat/score; synthetic click после touch не дублирует tap | `QA:I-03`–`QA:I-05`, pointer event tests | NOT RUN | `tests/reports/<build-id>/functional/input-negative.md` |
| F-04 | Не более 8 gameplay taps принимаются в любом rolling window 1.0 s; rejected taps не меняют heat, score, Resonance или enemy counters; burst >30/s нормализован максимум до одной команды на 50 ms step | `QA:F-07`/`QA:I-02a` с event/state trace | NOT RUN | `tests/reports/<build-id>/functional/input-rate.md` |
| F-05 | `LOADING`, `READY`, `PLAYING`, `PAUSED`, `AD_BREAK`, `RESULTS`, `ERROR` разрешают только действия и transitions из `GAME_DESIGN.md`; reason-set не допускает tick/catch-up или double resume | State-transition unit/property tests + `QA:F-13` | NOT RUN | `tests/reports/<build-id>/functional/state-machine.md` |
| F-06 | Current/legacy/empty/corrupt/future save безопасно загружается или заменяется defaults; maxima не уменьшаются; storage failure не блокирует игру; reload сохраняет records/settings и никогда не восстанавливает active run | `QA:P-01`–`QA:P-06` для Web и fake platform | NOT RUN | `tests/reports/<build-id>/functional/persistence.md` |
| F-07 | Generic Web без SDK поддерживает полный run/restart и local records; leaderboard показывает только local Best Score; rewarded/interstitial возвращают `unavailable` без fake reward и crash | Web adapter contract + offline/no-SDK E2E | NOT RUN | `tests/reports/<build-id>/functional/web-fallback.md` |
| F-08 | Ошибка optional asset включает задокументированный fallback без изменения механики; ошибка critical asset показывает retry и не оставляет бесконечный/чёрный loading screen; uncaught errors = 0 | По одной forced-failure fixture на loading group | NOT RUN | `tests/reports/<build-id>/functional/asset-fallback.md` |

## Gameplay

| ID | Проверяемое бинарное условие | Метод проверки | Статус | Плановый evidence |
|---|---|---|---|---|
| G-01 | Новый run начинается в `READY` с heat=30, stage=1, `runHighestStage=1`, score=0 и без timers/effects; до первого accepted tap decay и gameplay timers равны 0 | State fixture + fake-clock test | NOT RUN | `tests/reports/<build-id>/gameplay/initial-state.md` |
| G-02 | Первый accepted tap скрывает подсказку, даёт base tapPower=3, heat 30→33, scoreAcc +30 и visual feedback в первом изменённом frame | GAME_DESIGN example 1 + E2E capture | NOT RUN | `tests/reports/<build-id>/gameplay/first-tap.md` |
| G-03 | Heat всегда в `[0,1000]`; stages соответствуют ranges `[0,80)`, `[80,220)`, `[220,380)`, `[380,560)`, `[560,730)`, `[730,900)`, `[900,1000]`; stageProgress соответствует формуле; crossing создаёт одно event | Threshold−1/at/+1 parameterized tests | NOT RUN | `tests/reports/<build-id>/gameplay/stages.md` |
| G-04 | Без modifiers stage decay равен 0.5/2/4/6.5/9/13/18 heat/s; heat не падает ниже 0; deterministic tolerance составляет ±0.01 heat | Fake clock, 10 s fixture каждой stage | NOT RUN | `tests/reports/<build-id>/gameplay/decay.md` |
| G-05 | Tap points=`10×scoreTapPower×multiplier`, Inferno hold=`50×multiplier×activeSeconds`, score=`floor(scoreAcc)`; семь примеров `GAME_DESIGN.md` совпадают в tolerance ±1 score; score не уменьшается, capped at `2_147_483_647`, затем показывает `MAX` и submit использует то же значение | Golden-vector and numeric-boundary unit tests | NOT RUN | `tests/reports/<build-id>/gameplay/scoring.md` |
| G-06 | Stage multipliers 1/1.25/1.5/2/2.5/3.25/5 и bonuses 0/500/1500/3000/6000/10000/20000 точны; каждый bonus выдаётся один раз/run, включая multi-crossing; downward/re-entry bonus не повторяет | Boundary and multi-crossing tests | NOT RUN | `tests/reports/<build-id>/gameplay/stage-rewards.md` |
| G-07 | Cadence factors taps 1–8 равны 1/1/1/0.70/0.45/0.25/0.15/0.10, tap 9+ rejected; tap exactly 1.0 s after an older tap is outside its window; four accepted taps with three adjacent intervals 0.20–0.65 s start SURGE 1.50 s, then BREATH 1.00 s with exact modifiers | Final-design cadence vectors + `QA:F-08`, fake-clock tests | NOT RUN | `tests/reports/<build-id>/gameplay/rhythm.md` |
| G-08 | Порыв слуги проходит cancel/fail/stage-exit: schedule 8/14 s, telegraph 1.0 s, counter 4 accepted taps, reward=`250×stageMultiplier`, fail=`decay×1.8` на 2.5 s | `QA:F-09` + capture | NOT RUN | `tests/reports/<build-id>/gameplay/ash-servant.md` |
| G-09 | Холодное клеймо проходит cancel/fail/stage-exit: schedule 10/16 s, telegraph 2.0 s, counter 6 accepted taps, reward=`500×stageMultiplier`, fail=`tap×0.55` и `decay×1.5` на 4.0 s | `QA:F-10` + capture | NOT RUN | `tests/reports/<build-id>/gameplay/demoness.md` |
| G-10 | Окно жара в stage 6+ имеет schedule first 6 s, затем 9/11/8/10 s, telegraph 0.75 s и active 1.50 s; даёт heat tap factor 2, не меняет multiplier и не stacks с own SURGE | `QA:F-08a`, fake-clock event test | NOT RUN | `tests/reports/<build-id>/gameplay/heat-window.md` |
| G-11 | Одновременно активен максимум один enemy event; priority `Клеймо > Порыв > Окно жара`, lower-priority event переносится на active-event end +1.0 s; stage-exit cancellation соответствует design | Collision/priority fixtures | NOT RUN | `tests/reports/<build-id>/gameplay/event-priority.md` |
| G-12 | Inferno hold и score идут только для фактического active time при heat≥900; pause/выход останавливает, re-entry начинает новый current hold; all-time max сохраняется с tolerance ±10 ms | Threshold-crossing + pause test | NOT RUN | `tests/reports/<build-id>/gameplay/inferno-hold.md` |
| G-13 | После достижения stage 2 heat=0 непрерывно 2.0 s переводит в RESULTS; positive tap до boundary отменяет fail; до stage 2 zero возвращает READY; restart бесплатен и создаёт clean state heat=30/score=0 без effects | `QA:F-12`/`QA:F-15` boundary tests | NOT RUN | `tests/reports/<build-id>/gameplay/fail-restart.md` |
| G-14 | Committed `canonicalNoAdTraceV1` fixture records `firstTapMs=0`, `preStage3IntervalMs=500`, `postStage3IntervalMs=280`, switch on first `runHighestStage=3`, `stopMs=300000`; it uses no gameplay RNG/reward/pause/restart, expands deterministically and on 60/30/15 FPS reaches stage 2 at 5–15 s, stage 3 at 25–50 s, stage 5 at 75–150 s and Inferno at 150–300 s within tolerance | Fixture generator/hash audit + `QA:F-16` replay on three frame rates | NOT RUN | `tests/fixtures/no-ad-canonical.json` + `tests/reports/<build-id>/gameplay/no-ad-pacing.md` |
| G-15 | Confirmed «Печать Инферно» даёт rewardedFactor=2 ровно на 20.0 s active gameplay, не меняет decay/stage/multiplier/event schedule, исключает assisted heat из direct tap score, стоит на pause и полностью снимается один раз | Fake-clock boost tests + scoring vectors | NOT RUN | `tests/reports/<build-id>/gameplay/inferno-seal.md` |
| G-16 | Один timestamped trace на 60/30/15 FPS совпадает в tolerance ±0.01 heat, ±1 score, ±10 ms hold и exact discrete state; 10-minute stress не создаёт NaN/Infinity, invalid stage/progress или stuck modifier | Deterministic simulation + property run | NOT RUN | `tests/reports/<build-id>/gameplay/determinism.md` |

## Visual

Stage rubric исполняется на deterministic captures stages 1–7 при `360×640`, `390×844`, `768×1024`, `1366×768`; stage 7 дополнительно при `800×360`. Responsive layout/geometry также проверяется при `320×568`, `360×800`, `412×915`, `1440×900`. Каждая строка получает 0/1 и `PASS` только при результате 1 во всех применимых captures. Проценты сцены измеряются по approved reveal-mask/overlay; pixel diff является supporting evidence, а не заменой rubric.

| ID | Проверяемое бинарное условие | Метод проверки | Статус | Плановый evidence |
|---|---|---|---|---|
| V-01 | Во всей capture matrix нет clipped/overlapping HUD/controls, unintended page scrollbar, missing glyph/texture или недоступного primary action; portrait/landscape resize сохраняет run state | Screenshot + DOM geometry matrix | NOT RUN | `tests/reports/<build-id>/visual/layout.md` |
| V-02 | Каждый UI control ≥48×48 CSS px, flame target ≥96×96 CSS px, gap между controls ≥8 CSS px; safe-area inset после system inset ≥16 CSS px | Computed DOM geometry audit | NOT RUN | `tests/reports/<build-id>/visual/geometry.json` |
| V-03 | Essential text contrast ≥4.5:1, large text ≥3:1; основной текст ≥16 CSS px, key numbers ≥20 CSS px; ни один critical state не передаётся только цветом или звуком | Automated contrast/type audit + manual cue inventory | NOT RUN | `tests/reports/<build-id>/visual/legibility.md` |
| V-04 | Stage 1 capture содержит только ember/hearth, 5–10% ritual circle, light radius 6–10% short side и не содержит characters/active runes | Approved overlay and reveal-mask measurement | NOT RUN | `tests/reports/<build-id>/visual/stage-1.png` |
| V-05 | Stage 2 capture показывает stones/ash, 22–28% circle, cracks, 2–3 runes и light radius 15–21%; required reveal отличается от stage 1 | Approved overlay and reveal-mask measurement | NOT RUN | `tests/reports/<build-id>/visual/stage-2.png` |
| V-06 | Stage 3 capture показывает 35–45% circle, Ash Servant/emerge-blow states, directed ash и 4-segment counter; telegraph/success/fail имеют три разные capture states | State capture set + reveal-mask measurement | NOT RUN | `tests/reports/<build-id>/visual/stage-3/` |
| V-07 | Stage 4 capture показывает 55–65% scene, gates, chains, large runes, fire cracks, Demoness silhouette и flame height 29–39% action-zone | Approved overlay and state capture | NOT RUN | `tests/reports/<build-id>/visual/stage-4.png` |
| V-08 | Stage 5 capture показывает 70–80% scene, Demoness height 45–55% action-zone, 6-segment seal, cast/success/debuff ring и 4.0 s countdown без перекрытия flame/HUD | State capture set + geometry audit | NOT RUN | `tests/reports/<build-id>/visual/stage-5/` |
| V-09 | Stage 6 capture показывает 85–95% scene, 3–5 watchers, full circle/chains/runes, ≤60 embers и отдельные Heat Window telegraph/active frames | State capture set + reveal/runtime counters | NOT RUN | `tests/reports/<build-id>/visual/stage-6/` |
| V-10 | Stage 7 capture показывает full semantic scene, dark peripheral frame, flame column ≤72% action-zone, ≤80 embers, active full circle and Inferno hold/multiplier priority without HUD overlap | State capture set + runtime counters | NOT RUN | `tests/reports/<build-id>/visual/stage-7/` |
| V-11 | Resonance has 4 segments; SURGE, BREATH, too-fast input, both enemy events, Heat Window, stage-up/down, pause and rewarded seal each have separate shape/text/motion cue; two QA reviewers independently identify 100% of randomized contact-sheet states without audio, and rewarded violet-gold seal is never labeled SURGE/debuff | Blind contact-sheet identification, 2 reviewers | NOT RUN | `tests/reports/<build-id>/visual/signals.md` |
| V-12 | Reduced motion disables parallax/distortion/camera impulse, reduces particles ≥60%, preserves static cues and limits full-screen flashes to ≤3/s; gameplay timing is unchanged | Runtime counters + frame analysis + state comparison | NOT RUN | `tests/reports/<build-id>/visual/reduced-motion.md` |
| V-13 | Captures/assets contain no blood, gore, dismemberment, realistic injury, explicit/sexualized content, real extremist/religious symbols, branded IP imitation, placeholder art or concept art used as flat screen | Full manifest/capture content audit | NOT RUN | `tests/reports/<build-id>/visual/content-audit.md` |
| V-14 | Every production asset is `READY` or has an approved documented fallback; manifest contains source/export hashes, rights/provenance and review owner; deterministic screenshots are within recorded per-scene diff tolerance or have Art+QA re-baseline approval | Manifest/provenance audit + visual regression | NOT RUN | `tests/reports/<build-id>/visual/provenance-regression.md` |

## Audio

| ID | Проверяемое бинарное условие | Метод проверки | Статус | Плановый evidence |
|---|---|---|---|---|
| A-01 | До trusted gesture audio не воспроизводится и autoplay rejection/unhandled promise =0; после gesture каждый loop имеет не более одного instance | ENV-D1/M1/M2 console + audio graph inspection | NOT RUN | `tests/reports/<build-id>/audio/autoplay.md` |
| A-02 | Accepted tap audio onset p95 ≤50 ms; 6 normal variants use shuffle-bag without immediate repeat; 25 ms cooldown/pool aggregation avoids clipping while gameplay taps are not lost | Timestamped tap run + voice trace | NOT RUN | `tests/reports/<build-id>/audio/tap-feedback.md` |
| A-03 | Stages 1–7 enable exactly the music/ambient layers and event cues in `AUDIO_DIRECTION.md`; stage-up crossfade=1.25 s, fast stage-down fade=0.6 s, and no click/pop/duplicate loop occurs | Event/audio trace + waveform capture | NOT RUN | `tests/reports/<build-id>/audio/progression.md` |
| A-04 | Music stems are exactly 20.000 s at 48 kHz with loop markers 0/960000 and remain phase-aligned across stage change and suspend/resume; ambient/debuff/boost loops have no audible or waveform discontinuity | Metadata audit + sample/phase test | NOT RUN | `tests/reports/<build-id>/audio/loops.md` |
| A-05 | Stage-7 stress full mix measures `-14 LUFS-I ±1 LU`, true peak ≤−1 dBTP; two QA reviewers independently identify 100% of randomized tap/enemy/stage cues; concurrent voices ≤16 | Loudness/peak meter + blind cue check, 2 reviewers | NOT RUN | `tests/reports/<build-id>/audio/mix.md` |
| A-06 | Mute affects all buses immediately, persists after reload, survives restart, creates no duplicate source on unmute and leaves visual state cues usable | `QA:A-04` in ENV-D1/M1/M2 | NOT RUN | `tests/reports/<build-id>/audio/mute.md` |
| A-07 | Menu/visibility/platform/ad pause blocks one-shots, fades master to silence ≤100 ms and suspends context; valid resume occurs once after all reasons clear, restores master in 250 ms, preserves phase, and never replays stale one-shots | Lifecycle matrix + audio graph/event trace | NOT RUN | `tests/reports/<build-id>/audio/lifecycle.md` |
| A-08 | Rewarded success starts boost cue/layer only after confirmed callback and valid resume; cancel/error/unavailable starts no reward cue; active boost/background preserves remaining time; failed codec/asset activates fallback or silent play with uncaught errors=0 | `QA:A-06`/`QA:A-07` + forced failures | NOT RUN | `tests/reports/<build-id>/audio/reward-fallback.md` |

## Performance

| ID | Проверяемое бинарное условие | Метод проверки | Статус | Плановый evidence |
|---|---|---|---|---|
| PERF-01 | Ready-to-interactive p75 ≤3.0 s on mid-tier Android / 4G warm-CDN profile | Sufficient production runs to calculate p75 | NOT RUN | `tests/reports/<build-id>/performance/interactive.json` |
| PERF-02 | Initial compressed JS/CSS/critical-assets transfer ≤3.0 MB, total production package ≤15 MB and main JS gzip ≤350 KB | Network log + bundle/dist manifest | NOT RUN | `tests/reports/<build-id>/performance/payload.md` |
| PERF-03 | Ten-minute stage-7 run has median ≥55 FPS on ENV-D1 and ≥30 FPS on ENV-M1, with frames slower than 50 ms ≤1% on both profiles | Production stress profile | NOT RUN | `tests/reports/<build-id>/performance/fps.json` |
| PERF-04 | Stage-7 frame-time p95 ≤20 ms high tier and ≤33 ms low tier | PerformanceObserver/profiler | NOT RUN | `tests/reports/<build-id>/performance/frame-time.json` |
| PERF-05 | Pointer-to-first-changed-frame latency p95 ≤100 ms for touch and mouse | Timestamped input/frame instrumentation | NOT RUN | `tests/reports/<build-id>/performance/input-latency.json` |
| PERF-06 | JS heap after 10-minute stage-7 stress ≤150 MB; listeners/audio nodes/particles do not grow monotonically after effects expire | Heap/runtime counter samples | NOT RUN | `tests/reports/<build-id>/performance/memory.md` |
| PERF-07 | While paused simulation steps=0; first simulation step occurs ≤100 ms after final pause reason clears; no catch-up decay/event burst | Deterministic lifecycle timing test | NOT RUN | `tests/reports/<build-id>/performance/resume.md` |
| PERF-08 | Asset hard caps pass: critical art ≤2.0 MB, total art ≤5.0 MB, decoded textures ≤64 MB, critical selected audio ≤500 KB, selected audio ≤2.8 MB, both codecs ≤5.6 MB, stage-7 session transfer ≤8.0 MB, texture side ≤2048 px, particles ≤120 | `npm run assets:audit` + runtime/network counters | NOT RUN | `tests/reports/<build-id>/performance/assets-audit.md` |
| PERF-09 | When p95 frame time exceeds 24 ms for 5 s, quality tier downgrades exactly once without mechanic/state change; reduced/off tiers obey particle/buffer caps | Forced-load tier test + core snapshot compare | NOT RUN | `tests/reports/<build-id>/performance/quality-tier.md` |

## Yandex Platform

| ID | Проверяемое бинарное условие | Метод проверки | Статус | Плановый evidence |
|---|---|---|---|---|
| Y-01 | Before integration and release, official loader/API signatures, moderation checklist, ad/leaderboard rules, package limits and console settings are revalidated; source URLs and check date are recorded | Platform requirements audit | NOT RUN | `tests/reports/<build-id>/yandex/requirements.md` |
| Y-02 | `src/core/` and core bundle contain no Yandex SDK import/global/shape; all Yandex calls exist only in adapter and all methods return typed results rather than throwing into core | Static dependency/bundle scan + review | NOT RUN | `tests/reports/<build-id>/yandex/dependency-audit.md` |
| Y-03 | `YaGames.init()` success reaches Yandex mode; reject/timeout ≤5 s reaches playable Web fallback; `LoadingAPI.ready()` is emitted exactly once only after HUD/critical assets are ready and tap/click is accepted | Adapter tests + ENV-Y1/Y2 launch trace | NOT RUN | `tests/reports/<build-id>/yandex/init-ready.md` |
| Y-04 | `GameplayAPI.start/stop`, `game_api_pause/resume`, visibility, menu and ad use idempotent reason-set; heat/score/timers/audio do not move in pause; one reason cannot clear another | `QA:PL-02`/`QA:PL-09` lifecycle matrix | NOT RUN | `tests/reports/<build-id>/yandex/lifecycle.md` |
| Y-05 | Authorized local-first save/cloud merge chooses maxima for `bestScore`, `highestStageReached`, `longestInfernoHoldMs`, `maxMultiplier`, `runsPlayed`, applies documented settings/daily merge and never restores active run | `QA:PL-03` with divergent local/cloud fixtures | NOT RUN | `tests/reports/<build-id>/yandex/save-merge.md` |
| Y-06 | Guest/denied profile completes a run with uncaught errors=0 and local records retained; no login dialog opens without explicit user action | `QA:PL-04` manual/adapter test | NOT RUN | `tests/reports/<build-id>/yandex/guest.md` |
| Y-07 | Public leaderboard submits exactly one improved integer Best Score in `[0,2147483647]` after RESULTS; lower/duplicate/retry cannot reduce or duplicate it; unavailable/auth-required leaves local best and nonblocking UI | `QA:PL-07` + `QA:P-07`/`QA:P-08` contract tests | NOT RUN | `tests/reports/<build-id>/yandex/leaderboard.md` |
| Y-08 | Reward CTA is explicit and eligible only when `runHighestStage≥3`, active run ≥45 s, no encounter/transition/pause/boost, no success this run and 90 s post-success session cooldown elapsed; persisted all-time stage cannot unlock it | Eligibility table + `QA:R-07` E2E | NOT RUN | `tests/reports/<build-id>/yandex/reward-eligibility.md` |
| Y-09 | Confirmed rewarded callback grants one 20 s boost after valid resume; duplicate/late callback cannot grant again or cross restart; gameplay/audio remain paused for fullscreen lifecycle | `QA:PL-05` + `QA:R-01`/`QA:R-03`/`QA:R-05` trace | NOT RUN | `tests/reports/<build-id>/yandex/reward-success.md` |
| Y-10 | Close/error/unavailable/timeout gives reward=0, boost=0, heat/score change=0, cooldown/attempt consumption=0 and safe resume at most once; game remains completable without ad; interstitial calls in MVP=0 | `QA:PL-06` + `QA:R-02`/`QA:R-06` + no-ad run | NOT RUN | `tests/reports/<build-id>/yandex/reward-failure.md` |

## QA

| ID | Проверяемое бинарное условие | Метод проверки | Статус | Плановый evidence |
|---|---|---|---|---|
| Q-01 | `npm run lint`, `npm run typecheck`, `npm test` and `npm run test:e2e` each exit 0; required tests skipped=0 | Clean-checkout command logs + test report | NOT RUN | `tests/reports/<build-id>/qa/automated.md` |
| Q-02 | Required test matrix covers ENV-D1/D2/D3/M1/M2/M3/L1/Y1/Y2 as assigned in `QA_PLAN.md`; real devices are used for M1 and M2; browser versions/date are recorded | Environment coverage audit | NOT RUN | `tests/reports/<build-id>/qa/environment-matrix.md` |
| Q-03 | Uncaught exceptions=0, unhandled rejections=0 and unexpected console errors=0 in required launch, core-loop, persistence, rewarded and release smoke scenarios | Browser/E2E console capture | NOT RUN | `tests/reports/<build-id>/qa/console/` |
| Q-04 | `QA_PLAN.md`, `TECHNICAL_ARCHITECTURE.md` and executable tests contain no numeric/contract conflict with final `GAME_DESIGN.md`; every applicable acceptance ID has an exact-Build result and nonempty evidence; required tests skipped=0; visual/audio manual checks have QA sign-off | Cross-document requirements-to-tests/evidence audit | NOT RUN | `tests/reports/<build-id>/qa/traceability.md` |
| Q-05 | QA issue log records build, severity, environment, steps, expected/actual, evidence and linked acceptance ID; open Critical=0 and High=0 | Issue log schema/filter audit | NOT RUN | `tests/reports/<build-id>/qa-report.md` |
| Q-06 | Every fixed Critical/High/Medium has independent targeted retest and neighboring regression evidence on a newer identified build; fix author is not sole verifier | Issue-to-regression audit | NOT RUN | `tests/reports/<build-id>/qa/regression.md` |
| Q-07 | Release candidate completed `QA:F-01–F-16` including `QA:F-08a`, `QA:I-01–I-06` including `QA:I-02a`, `QA:P-01–P-08`, `QA:R-01–R-07`, `QA:A-01–A-08`, the full assigned environment/platform matrix and all visual/performance cases with zero omitted applicable case | QA report completeness audit | NOT RUN | `tests/reports/<build-id>/qa-report.md` |

## Release

| ID | Проверяемое бинарное условие | Метод проверки | Статус | Плановый evidence |
|---|---|---|---|---|
| RLS-01 | From clean checkout on pinned Node/npm and committed lockfile, `npm ci`, lint, typecheck, unit tests, build and E2E exit 0; after `npm ci` the build requires no network; `npm run build` creates only `dist/`; runtime assets resolve inside archive root, while optional SDK/ads/cloud/leaderboard network is isolated behind adapters and Web fallback remains playable | Reproduce commands from `RELEASE_PLAN.md` | NOT RUN | `tests/reports/<build-id>/release/build.log` |
| RLS-02 | Rebuilding the same clean commit/toolchain produces an equivalent sorted dist manifest; every allowed nondeterministic field is listed in report | Two-build manifest/hash comparison | NOT RUN | `tests/reports/<build-id>/release/reproducibility.md` |
| RLS-03 | `dist/` contains no credentials, `.env*`, source maps, tests, internal docs, mocks, caches, source masters, debug/HMR code or broken/missing manifest reference; secret scan findings=0 | Dist manifest + secret/dev-file audit | NOT RUN | `releases/inferno-clicker-<version>-manifest.txt` |
| RLS-04 | `npm run package` exits 0 only after QA gate and creates `releases/inferno-clicker-<version>.zip`; archive has exactly one root `index.html`, no wrapper folder/path traversal/absolute URL and only runtime files | Package log + ZIP listing audit | NOT RUN | `releases/inferno-clicker-<version>.zip` |
| RLS-05 | ZIP extracts without error to a new temp directory, extracted manifest equals `dist/`, static-HTTP launch reaches interactive state, and post-package Web/Yandex smoke has no new error | Unzip, manifest diff, HTTP and ENV-Y smoke | NOT RUN | `tests/reports/<build-id>/release/unpacked-smoke.md` |
| RLS-06 | SemVer, Build ID, full commit SHA, tag, in-build metadata, ZIP filename, manifest, SHA-256 sidecar and release report identify the same candidate | Metadata/hash comparison | NOT RUN | `releases/inferno-clicker-<version>-report.md` |
| RLS-07 | Release report contains tool versions, lockfile hash, commands/exit codes, QA/acceptance decision, regression environments, manifest/hash, ZIP bytes/SHA-256, Yandex validation/upload status, approved noncritical limitations and rollback reference | Release report completeness audit | NOT RUN | `releases/inferno-clicker-<version>-report.md` |
| RLS-08 | All applicable F/G/V/A/PERF/Y/Q rows and RLS-01–RLS-07 are PASS with exact-build evidence; open Critical=0 and High=0; QA, Reviewer and Release Agent sign; rollback artifact/reference exists or first-release unpublish procedure is recorded | Final gate audit | NOT RUN | `releases/inferno-clicker-<version>-report.md` |

**Planning decision:** DONE = NO. Все 80 критериев имеют `NOT RUN`; release gate закрыт до implementation, platform integration, QA, fix cycle, regression QA and packaging. Production build, ZIP, tag, report и upload не создавались.
