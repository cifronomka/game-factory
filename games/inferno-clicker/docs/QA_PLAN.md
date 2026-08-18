# QA Plan — «Зажги»

## Назначение и статус

Этот документ задаёт риско-ориентированную стратегию проверки `inferno-clicker`. Сейчас проект находится на planning stage: исполняемой сборки нет, тесты не запускались, результаты не заявлены. Единственный итоговый stop contract находится в `ACCEPTANCE_CRITERIA.md`.

QA проверяет идентифицированную сборку. Для каждого запуска фиксируются версия/commit, дата, окружение, команды, console log, скриншоты или видео и результат. Дефект содержит severity, окружение, шаги, expected/actual, evidence и связанный acceptance criterion.

## Риски и приоритеты

| Приоритет | Риск | Что проверять в первую очередь |
|---|---|---|
| P0 | Потеря прогресса или некорректный `bestScore` | пустые, валидные, устаревшие и повреждённые сохранения; reload и смена adapter |
| P0 | Реклама оставляет игру или аудио в неверном состоянии | success/cancel/error/unavailable, focus loss, повторный callback, resume ровно один раз |
| P0 | Быстрые tap/click дают разные результаты или вызывают double input | нормализация input, multi-touch, pointer cancellation, 10 taps/s |
| P1 | Семь стадий недостижимы либо decay делает прогресс математически невозможным | детерминированная симуляция и ручной skill-path до Инферно |
| P1 | Игра быстро становится однообразной или вызывает усталость | rhythm windows, debuffs, длительные сессии, доступность паузы, input intensity telemetry |
| P1 | Тёмная сцена скрывает UI и игровые сигналы | visual rubric на всех reference viewports и каждой стадии |
| P1 | Частицы/glow/audio ухудшают производительность в поздней игре | stage 6–7 stress, boost + debuff, 10-минутная сессия |
| P2 | Различия Yandex/Web ломают основной цикл | adapter contract suite и web fallback без SDK |

## Test environments

Версии браузеров — актуальная стабильная и предыдущая стабильная на дату release candidate. Реальные устройства обязательны минимум для ENV-M1 и ENV-M2; эмуляция не заменяет финальный mobile smoke.

| ID | Device/OS | Browser | Input | Viewport / DPR | Platform mode |
|---|---|---|---|---|---|
| ENV-D1 | Desktop, Windows 10/11 | Chrome stable | mouse | 1440×900 / 1 | Web adapter |
| ENV-D2 | Desktop, Windows 10/11 | Firefox stable | mouse | 1366×768 / 1 | Web adapter |
| ENV-D3 | Mac desktop | Safari stable | mouse/trackpad | 1440×900 / 2 | Web adapter |
| ENV-M1 | Mid-range Android, Android 11+ | Chrome stable | touch | 360×800 / device DPR | Web adapter |
| ENV-M2 | iPhone, iOS 16+ | Safari stable | touch | 390×844 / device DPR | Web adapter |
| ENV-M3 | Android large phone | Chrome stable | touch | 412×915 / device DPR | Web adapter |
| ENV-L1 | ENV-M1 or device emulation | Chrome stable | touch | 800×360 / device DPR | Web adapter, landscape recovery |
| ENV-Y1 | Desktop from Yandex Games test environment | supported Chromium browser | mouse | 1440×900 / 1 | Yandex adapter |
| ENV-Y2 | Mobile from Yandex Games test environment | Android Chrome | touch | 360×800 / device DPR | Yandex adapter |

## Test data and instrumentation

- Deterministic test seam: fixed random seed, injectable monotonic clock and scripted input timeline.
- Fixtures: new profile; each stage boundary minus/at/plus one heat unit; active surge; servant debuff; demoness debuff; active «Печать Инферно»; valid current save; legacy save; malformed JSON; semantically invalid save.
- Observability: build ID, adapter name, state transitions, ad lifecycle and persistence errors may be logged in test/dev mode; secrets and personal data may not be logged.
- Required artifacts: `tests/reports/<build-id>/qa-report.md`, automated reports, console logs, performance traces and screenshots grouped by case ID.
- Golden deterministic runs compare 60/30/15 FPS timelines; divergence may not exceed `±0.01 heat`, `±1 score` and `±10 ms Inferno hold`; discrete state/stage/event fields must match exactly.

## Functional tests

| ID | Scenario | Expected result |
|---|---|---|
| F-01 | Launch a new profile and perform the first primary input | Interactive scene appears; one tap/click produces one heat gain and immediate visual/audio feedback; no tutorial blocks input |
| F-02 | Send the same scripted input/clock sequence twice with a fixed seed | `heat`, `score`, `multiplier`, `stage`, `stageProgress`, `decayRate` and `tapPower` match the formulas and expected snapshots in `GAME_DESIGN.md` |
| F-03 | Reach every threshold from below | Exactly seven stages occur in order: Тьма → Искра → Пепельный слуга → Алый порог → Демонесса угасания → Круг Инферно → Инферно; a boundary fires once |
| F-04 | Stop input for ten seconds in fixtures for stages 1–7 | Heat decreases at the stage/effect-specific rate from `GAME_DESIGN.md`, never becomes negative, and measured base decay is strictly higher at each later stage |
| F-05 | Let heat fall through one or more lower thresholds | Stage immediately follows the documented range without hysteresis; stage bonus does not repeat; transition event is emitted once per actual crossing |
| F-06 | Compare score delta at controlled heat/multiplier states | Score is integer, never decreases during a session, uses the documented formula/rounding, and maximum multiplier is capped at the documented value |
| F-07 | Replay cadence taps №1–8 and overflow in a rolling 1.0 s window | Factors equal `1/1/1/1/1/0.70/0.45/0.25`; tap №9+ is rejected and cannot affect heat, score, Resonance or counters |
| F-08 | Exercise Resonance intervals below 0.20 s, from 0.20–0.65 s and above 0.65 s | Four accepted taps with all three adjacent intervals in `0.20–0.65 s` start 1.50 s SURGE (`tap×2`, `multiplier×2`, `decay×0.5`), then 1.00 s BREATH (`cadence≤0.5`, `decay×0.75`); shorter/longer interval rules and final modifier reset match `GAME_DESIGN.md` |
| F-08a | Stay at stage 6+ through the full deterministic Heat Window schedule | First telegraph starts at 6.0 s, then after 9/11/8/10 s cycle; telegraph is 0.75 s, active is 1.50 s, `tap×2` but multiplier unchanged; it does not stack with own SURGE |
| F-09 | Trigger Порыв слуги, cancel once and fail once | First trigger at 8.0 s then every 14.0 s; 1.0 s telegraph; 4 accepted taps cancel and award `250×stageMultiplier`; fail applies `decay×1.8` for 2.5 s |
| F-10 | Trigger Холодное клеймо, cancel once and fail once | First trigger at 10.0 s then every 16.0 s; 2.0 s telegraph; 6 accepted taps cancel and award `500×stageMultiplier`; fail applies `tap×0.55` and `decay×1.5` for 4.0 s |
| F-11 | Reach Инферно and hold/leave it | Hold timer counts only unpaused time in Инферно, stops outside it, and session/best values use documented rounding |
| F-12 | End a run and restart | Run summary is correct; restart resets session-only fields and preserves only documented meta fields |
| F-13 | Pause via UI, visibility loss and platform lifecycle | Clock, decay, score, timers and input stop while paused; one resume continues without elapsed-background catch-up |
| F-14 | Run 10 minutes through stages, debuffs, pause, boost and restart | No invalid state (`NaN`, negative heat, out-of-range stage/progress, uncapped multiplier), freeze or duplicate listener occurs |
| F-15 | Let heat remain 0 around the fail boundary before and after ever reaching stage 2 | Before stage 2, state returns to READY without results; after stage 2, 2.0 s continuous zero enters RESULTS; a valid positive-power tap before 2.0 s cancels failure |
| F-16 | Execute the canonical no-ad 3–5 taps/s learning trace | Without reward: stage 2 at 5–15 s, stage 3 at 25–50 s, stage 5 at 75–150 s and first Inferno at 150–300 s |

### Input equivalence

| ID | Scenario | Expected result |
|---|---|---|
| I-01 | Replay identical timestamps through touch and mouse adapters | Core snapshots and score are identical |
| I-02 | 100 sequential inputs at 5 taps/clicks per second | Exactly 100 accepted primary actions; no dropped or duplicated synthetic click after touch |
| I-02a | 100 sequential inputs at 10 taps/clicks per second and a burst above 30/s | No rolling 1.0 s window accepts more than 8 gameplay taps; rejected inputs change no core field; burst is also normalized to at most one command per 50 ms step and state remains valid |
| I-03 | Two-finger touch, pinch, scroll and long press over play area | Only documented primary pointers count; browser zoom/scroll/context menu does not interrupt the intended play area |
| I-04 | Pointer down inside and release outside; pointer cancellation | No stuck pressed state and no extra action |
| I-05 | Click outside gameplay target and use right/middle click | No heat/score change |
| I-06 | Inspect interactive controls at mobile CSS pixel scale | Every UI control target is at least 48×48 CSS px, the flame primary target is at least 96×96 CSS px, and each control has visible enabled/disabled/focus state |

### Persistence and leaderboard

| ID | Scenario | Expected result |
|---|---|---|
| P-01 | Save a completed run, reload, then load | `bestScore`, `highestStageReached`, `longestInfernoHoldMs` and `maxMultiplier` equal the saved maxima; session heat, score, `runHighestStage`, rhythm state, encounter and boost are not restored |
| P-02 | Current value is lower than stored personal best | Stored maximum is never overwritten by a lower value |
| P-03 | Load empty or missing data | Valid default profile is created; game remains interactive |
| P-04 | Load malformed, wrong-type, out-of-range or future-schema data | Data is rejected or sanitized per architecture; game remains interactive; no uncaught error; valid prior data is not silently destroyed |
| P-05 | Load each supported legacy fixture | Migration produces the current schema and preserves all representable personal-best fields |
| P-06 | Force save/load rejection or storage quota failure | Session continues; failure is surfaced non-blockingly and a later retry is possible |
| P-07 | Submit Best Score twice, including a lower score and transient failure | Only an improved integer best is submitted; duplicate/lower submit cannot reduce score; failure does not block gameplay |
| P-08 | Leaderboard is unavailable or player is unauthenticated | Local best remains visible; unsupported leaderboard UI is hidden/disabled with understandable status; no crash |

### Rewarded «Печать Инферно»

| ID | Scenario | Expected result |
|---|---|---|
| R-01 | At `runHighestStage≥3` and active run age ≥45 s, user voluntarily opens placement and receives confirmed reward callback | Exactly one `tapPower ×2.0` boost starts for 20 s active gameplay after valid resume; boost visuals/audio active; extra heat grants no direct tap-score points |
| R-02 | Ad is cancelled, errors, is unavailable or returns no reward | No boost/reward is granted; current run and score are unchanged; user can continue immediately |
| R-03 | Platform produces duplicate/late callbacks | Reward is granted at most once and stale callback cannot start a second boost |
| R-04 | Boost expires during normal gameplay | Modifier ends once after exactly 20 s monotonic active gameplay; tap power, visuals and mix return to the correct non-boost state |
| R-05 | App loses focus or is paused while boost is active | Boost timer does not consume paused/ad time and resumes once after valid lifecycle resume |
| R-06 | Request reward in Web fallback without an ad provider | No fake ad and no reward; placement reports unavailable or is disabled; game remains fully playable |
| R-07 | Attempt placement while `runHighestStage<3`, before 45 s active run age, during an encounter/transition/pause/active boost, after one rewarded success in this run, within 90 s session cooldown, or while another request is pending | CTA is hidden/disabled or request is rejected; no ad, reward or gameplay state transition occurs |

## Browser, mobile and desktop tests

- Direct load, refresh, cache-disabled load and asset 404 fallback do not leave an infinite loading screen.
- Resize through 320×568, 360×640, 360×800, 390×844, 412×915, 768×1024, 1366×768 and 1440×900; HUD and primary action remain available without page scroll.
- Portrait is primary. Landscape shows the documented adaptive layout or clear rotate affordance without losing current run state.
- Safe-area insets on iOS do not cover controls; browser bars opening/closing do not cause permanent layout displacement.
- Page background/foreground, window blur/focus and device orientation change each produce at most one pause/resume transition.
- High-DPR rendering is sharp enough per visual rubric without allocating a canvas larger than the architecture cap.
- Offline/no-SDK Web mode remains playable locally. Network failures affect only online capabilities.

## Performance checks

Measure a production build with DevTools closed except while recording. Ready-to-interactive uses enough cold/warm runs to report p75; performance stress lasts 10 minutes at stage 7 and includes maximum allowed particles, active boost, adaptive music and an enemy effect.

| ID | Metric | Budget |
|---|---|---|
| PERF-01 | Platform-ready to accepted primary input, warm CDN, mid-tier Android / 4G | p75 ≤ 3.0 s |
| PERF-02 | Initial compressed transfer | ≤ 3.0 MB for JS/CSS and critical assets |
| PERF-03 | Total production package | ≤ 15 MB; source maps/tests excluded |
| PERF-04 | Main JavaScript bundle | gzip size ≤ 350 KB |
| PERF-05 | Frame rate during 10-minute stage-7 run | target 60 FPS; p95 floor ≥ 30 FPS on target mobile and desktop |
| PERF-06 | Frame time during stage-7 stress | p95 ≤ 20 ms high-tier; p95 ≤ 33 ms low-tier |
| PERF-07 | Pointer-to-first-changed-frame latency | p95 ≤ 100 ms on touch and mouse |
| PERF-08 | JavaScript heap after 10 minutes stage-7 stress | ≤ 150 MB and no monotonically growing listeners/audio nodes/particles |
| PERF-09 | Pause/resume timing | 0 simulation steps while paused; first resumed step ≤ 100 ms after the final pause reason clears |

Asset audit separately enforces hard limits from `ASSET_PLAN.md`: critical art ≤2.0 MB, total art ≤5.0 MB, decoded textures ≤64 MB, critical selected-codec audio ≤500 KB, total selected-codec audio ≤2.8 MB, both stored codec packs ≤5.6 MB, one-session stage-7 asset transfer ≤8.0 MB, texture side ≤2048 px, particles ≤120 and audio voices ≤16.

## Visual QA rubric

Capture stages 1–7 at architecture reference viewports 360×640, 390×844, 768×1024 and 1366×768, plus stage 7 at 800×360 for landscape recovery. Each row scores 0 or 1; a viewport/stage passes only with every mandatory row equal to 1. Automated pixel diff is supporting evidence, not a substitute for the rubric.

| Rubric | Binary pass rule |
|---|---|
| V-01 Layout integrity | No clipped/overlapping HUD text or controls; no unintended page scrollbar; primary input region and pause/mute/reward controls remain reachable |
| V-02 Legibility | All essential text meets WCAG contrast 4.5:1 (3:1 for large text); icons conveying state have a non-color cue |
| V-03 Stage identity | Screenshot contains the flame state and all required reveal cues assigned to that stage in `ART_DIRECTION.md`; at least one newly revealed cue distinguishes it from the prior stage |
| V-04 Darkness progression | Required HUD remains readable at stage 1; measured revealed-area/luminance proxy defined in the visual baseline increases at every upward stage transition |
| V-05 Feedback states | Tap, critical/surge, stage-up, servant debuff, demoness debuff, rewarded boost and paused state each have a distinct captured frame/state |
| V-06 Focal hierarchy | Flame center remains within the central 40% of viewport width and central 50% of gameplay height unless an approved stage composition specifies otherwise |
| V-07 Content safety | Captures contain no blood, gore, realistic injury, explicit sexual content or horror jump-scare frame |
| V-08 Motion safety | Reduced-motion mode removes camera shake/rapid flashes and limits full-screen luminance flashes to no more than 3 per second |
| V-09 Asset integrity | No missing-texture markers, stretched sprites, visible atlas bleeding, placeholder art or broken glyphs |
| V-10 Baseline variance | Deterministic screenshots stay within approved per-scene pixel-diff tolerance; intentional delta is re-baselined with Art + QA sign-off |

## Audio checks

| ID | Scenario | Expected result |
|---|---|---|
| A-01 | Launch before user gesture | Browser emits no autoplay rejection or uncaught promise; audio starts only after explicit gesture |
| A-02 | First gesture unlocks audio, followed by rapid tapping | Tap onset is ≤50 ms after accepted input; six variants use shuffle-bag without immediate repeat; 25 ms cooldown and pool/aggregation prevent clipping |
| A-03 | Cross stages 1–7 upward and downward | Music/ambient layers enter and leave at documented thresholds with crossfades and without discontinuity/click |
| A-04 | Toggle mute, reload and restart | All buses mute immediately; preference persists; no source continues audibly; unmute restores one instance per loop |
| A-05 | Blur/background/pause | Music, ambience and SFX pause/duck per policy; decay and audio resume together exactly once after focus is valid |
| A-06 | Rewarded success/cancel/error | Before ad all game audio pauses; success plays boost cue after resume; cancel/error never plays reward cue; no overlapping duplicate music |
| A-07 | Missing/failed audio asset or unsupported primary codec | Declared fallback codec or silent degradation keeps game playable with no uncaught error |
| A-08 | Stage 7 stress mix | Full mix is `-14 LUFS-I` target and true peak ≤ `-1 dBTP`; tap, enemy telegraph and stage event remain audible over music |

## Platform checks

For Yandex and Web adapters, contract tests cover init resolve/reject/timeout, save/load, submit/get leaderboard, rewarded success/cancel/error/unavailable, interstitial policy if enabled, and idempotent pause/resume. Core tests use a fake `PlatformService` and must contain no Yandex global/import. Yandex manual tests execute only after official requirements are revalidated at integration time.

## Regression and defect workflow

```text
QA FAIL → issue → owning role → fix → targeted retest → neighboring suite → release smoke
```

- Critical: cannot launch/continue, data loss, security/privacy breach, unrecoverable ad/lifecycle lock.
- High: core input/scoring/stage/persistence/reward is wrong, required viewport unusable, repeated severe frame stalls.
- Medium: recoverable feature, visual/audio or performance defect with meaningful impact.
- Low: cosmetic issue with no impact on understanding, input or compliance.
- A fix author does not mark their own issue verified. QA records new-build evidence.
- Neighbor suites: input fix → scoring/decay; stage fix → visuals/audio/debuffs; platform fix → pause/audio/persistence; render fix → all reference viewports/performance.
- Release candidate receives full F-01–F-14 smoke, all P/R/A cases, ENV-D1/ENV-M1/ENV-M2/ENV-Y1/ENV-Y2 launch/input smoke and all acceptance checks.

## Planned QA report / issue log

No execution results exist at planning stage. The future report lives at `tests/reports/<build-id>/qa-report.md`.

| ID | Build | Severity | Environment | Summary | Status | Evidence | Regression |
|---|---|---|---|---|---|---|---|
| RUN-PLANNING | Not assigned | N/A | N/A | Test plan prepared; no executable build tested | NOT RUN | This document | NOT RUN |
