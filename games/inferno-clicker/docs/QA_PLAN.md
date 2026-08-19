# QA Plan — «Зажги»

Case IDs этого документа квалифицируются как `QA:<ID>`; acceptance IDs — как `AC:<ID>`. Совпадающие короткие номера (например `QA:F-08` и `AC:F-08`) не являются одной проверкой; traceability report всегда хранит оба квалифицированных ID.

## Назначение и статус

Этот документ задаёт риско-ориентированную стратегию нового animation/seal/audio corrective cycle для `inferno-clicker`. Exact-build evidence предыдущего цикла остаётся историческим и может подтверждать только явно сохранённые неизменные строки; оно не подтверждает новые `NC-A`–`NC-E`, motion, balance, audio или regression gates. Единственный итоговый stop contract находится в `ACCEPTANCE_CRITERIA.md`; release запрещён, пока все `NC-A1`–`NC-E4` не имеют evidence от одного нового exact Build ID.

QA проверяет идентифицированную сборку. Для каждого запуска фиксируются версия/commit, дата, окружение, команды, console log, скриншоты или видео и результат. Дефект содержит severity, окружение, шаги, expected/actual, evidence и связанный acceptance criterion.

## Риски и приоритеты

| Приоритет | Риск | Что проверять в первую очередь |
|---|---|---|
| P0 | Потеря прогресса или некорректный `bestScore` | пустые, валидные, устаревшие и повреждённые сохранения; reload и смена adapter |
| P0 | Реклама оставляет игру или аудио в неверном состоянии | success/cancel/error/unavailable, focus loss, повторный callback, resume ровно один раз |
| P0 | Direct taps теряются из-за cadence/rolling/one-per-step cap либо дублируются | multi-touch, pointer cancellation, interval invariance, bursts 100/256/257 commands per 50 ms |
| P0 | Stage-4 seal пропускает unboosted input либо ломается повторно | high-rate no-boost trace, confirmed boost stub, duplicate/late callback, restart, boosted canonical |
| P1 | Passive decay hazards или input intensity вызывают усталость | servant/demoness timing, длительные сессии, доступность паузы, input intensity telemetry |
| P0 | Пламя остаётся статичной карточкой с shimmer вместо authored tongue animation | frame-set manifest, isolated flame-pass hashes/masks, idle motion clips, transition clips |
| P0 | Servant/Demoness являются трансформируемыми cutout, а cause→effect hazard не читается | separate appearance/idle/attack frame sets, browser motion evidence, blind no-text ordering |
| P0 | Звук воспринимается как газовая горелка или arcade, а heat burst не имеет мехового/веерного whoosh | provenance/asset scan, event-to-voice trace, 10-minute actual listening двумя reviewers |
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

- Deterministic test seam: injectable monotonic clock and scripted input timeline. Gameplay schedules use no RNG; fixed `visualSessionSeed` applies only to non-semantic presentation/audio variations.
- Fixtures: new profile; each stage boundary minus/at/plus one heat unit; locked/unlocked Stage-4 seal; servant passive decay; demoness passive decay; Heat Window; active «Печать Инферно»; confirmed/duplicate/late boost stub; valid current save; legacy save; malformed JSON; semantically invalid save; direct-tap bursts 1/100/256/257 commands in one fixed step.
- Observability: build ID, adapter name, state transitions, ad lifecycle and persistence errors may be logged in test/dev mode; secrets and personal data may not be logged.
- Required artifacts: `tests/reports/<build-id>/qa-report.md`, automated reports, console logs, performance traces, fresh 17-file screenshot matrix, motion evidence and two signed listening sheets grouped by case ID. Motion evidence is either a short browser video plus timestamp/hash manifest or timestamped sampled PNG frames (at least 12 samples per required clip) plus SHA-256 manifest; a GIF/contact sheet alone is not evidence.
- Golden deterministic runs compare 60/30/15 FPS timelines; divergence may not exceed `±0.01 heat`, `±1 score` and `±10 ms Inferno hold`; discrete state/stage/event fields must match exactly.

### Resolved specification deltas and evidence still required

- Product/Game Design/Monetization/Platform now agree on an intentional Stage-4 seal, a clearly labelled Generic Web/dev test provider and mutually exclusive Yandex provider. Specification conflict is closed; implementation evidence is still `NOT RUN`.
- Art/Asset/Architecture now define authored atlas clips, frame ordering, timing, loading and no-static-card fallback. Production frames and motion evidence are still `NOT RUN`.
- Audio/Architecture now define `acceptedHeatBurst`, a 120-ms aggregation window, 180-ms start cooldown, ≤2 fading fan voices and new authored sources/budgets. Production assets and listening evidence are still `NOT RUN`.
- `canonicalNoAdTraceV2` and its 9.0/43.5/64.5/102.0/139.2/158.8 s result are superseded for progression acceptance. V3 exact outputs are frozen in `GAME_DESIGN.md`; the committed generator/paired JSON fixtures and hashes are the replay authority, while clean exact-build evidence remains required before PASS.

## New corrective matrix NC-A–NC-E

| ID | Planned test | Binary stop condition | Status |
|---|---|---|---|
| NC-A1 | Flame manifest/atlas audit | `flame-core` and `flame-outer` each contain ≥8 authored, ordered, unique animation frames; every frame has dimensions, duration, SHA-256 and provenance; duplicate hashes or runtime static substitutes = 0 | NOT RUN |
| NC-A2 | Isolated flame-pass browser idle capture, standard motion/high quality, no input for 2.0 s at P05/P35/P65/P100 | Each clip has ≥8 distinct sampled perceptual hashes; alpha-mask XOR is ≥1% of union for at least one pair and ≥2 tongue landmarks move ≥2% of flame bbox; pure invariant-mask whole-card luminance shimmer is absent; both reviewers see tongue motion | NOT RUN |
| NC-A3 | Up/down threshold motion captures and layer-opacity trace | All 12 stage crossings use one reversible 0.8–1.5 s transition, contain ≥3 intermediate opacity states, have per-frame layer-opacity step ≤0.20 at ≥30 FPS and one-frame hidden→fully-visible pops = 0 | NOT RUN |
| NC-B1 | Character manifest/clip audit | Servant and Demoness each have separate authored `appearance`, `idle`, `attack` clips with ≥4 unique frames/clip, ordered timing, SHA-256 and provenance; transform-only/static-cutout substitutes = 0 | NOT RUN |
| NC-B2 | Exact-browser idle and hazard motion clips | For each character, 2.0 s idle contains ≥4 distinct character-pass hashes and authored silhouette/limb motion rather than whole-cutout drift only; appearance and attack clips play once per correct state and never leak across pause/stage exit | NOT RUN |
| NC-B3 | Randomized no-text hazard clip ordering + core event trace | Both reviewers correctly order cause→effect for Servant and Demoness in 4/4 trials and match attack onset to the documented decay-factor start within one 50 ms step; tap counters/prompts = 0 | NOT RUN |
| NC-C1 | `canonicalSealTraceV3` without boost, including 256 valid commands per 50 ms for 5.0 s after first Stage-4 entry | `sealBroken=false`, stage never exceeds 4, heat never reaches 560, Stage-5 event/bonus count=0 and all commands through the emergency cap remain accepted | NOT RUN |
| NC-C2 | Same fixture with one confirmed boost stub plus duplicate/late callbacks and restart | Exactly one `sealBroken` transition and one Stage-5 crossing occur in the run; duplicate/late callbacks add 0 breaks/rewards; a new run starts locked; no unconfirmed outcome breaks the seal | NOT RUN |
| NC-C3 | Committed boosted canonical replay at 60/30/15 FPS | One confirmed boost breaks the seal and the run reaches Stage 7/heat≥900; committed timestamps/taps/score match within ±0.01 heat, ±1 score, ±10 ms hold and exact discrete state | NOT RUN |
| NC-D1 | Asset/provenance audit + randomized isolated ambience listen | Production ambience is an authored real wood/fire recording with codec fallback; both reviewers classify every ambience sample `wood/fire` and 0 as `gas burner`, `synth` or `arcade` | NOT RUN |
| NC-D2 | `acceptedHeatBurst` event/audio trace under accepted, rejected and rapid input | Every emitted accepted burst starts exactly one distinct authored bellows/fanning whoosh, rejected-only input starts 0, active whoosh voices ≤2 and total voices≤10; implementation obeys 120-ms aggregation/180-ms cooldown without changing gameplay acceptance | NOT RUN |
| NC-D3 | Two independent 10-minute exact-browser listening sessions | Both signed sheets report audible wood/fire bed and distinguish the whoosh as bellows/fanning; gas-burner/arcade classifications=0, clipping/click/pop=0 and fatigue rating ≤2 on a 1–5 scale | NOT RUN |
| NC-E1 | Fresh exact-build screenshot capture and validator | Exactly 17 PNG captures use the new candidate Build ID and retain required viewport/DPR/browser/heat/timestamp metadata; prior-cycle screenshots are not reused | NOT RUN |
| NC-E2 | Motion-evidence manifest validator | Every required flame, character and 12 transition scenario has browser video or ≥12 timestamped sampled frames; file/frame hashes, build ID, viewport, DPR, state/heat and capture clock are complete and files decode | NOT RUN |
| NC-E3 | Asset/performance audit | All new atlas frame metadata/audio appear in manifest/provenance and runtime trace; startup critical art ≤1.5 MiB, total art ≤9.8 MiB, decoded textures ≤64 MiB, both-codec audio≤2.2 MiB and remaining residency/transfer caps from `ASSET_PLAN.md` pass | NOT RUN |
| NC-E4 | Full exact-build regression and independent review | Automated required tests skipped=0; browser/device matrix complete; two visual and two listening reviewers sign independently; open Critical=0 and High=0; all `NC-A1`–`NC-E3` PASS | NOT RUN |

## Functional tests

| ID | Scenario | Expected result |
|---|---|---|
| F-01 | Launch a new profile and perform the first primary input | Interactive scene appears; one tap/click produces one heat gain and immediate visual feedback; audio starts only through the documented `acceptedHeatBurst` aggregation and never changes acceptance; no tutorial blocks input |
| F-02 | Send the same scripted input/clock sequence twice; presentation may use the same fixed `visualSessionSeed` but gameplay RNG is disabled | `heat`, `score`, `multiplier`, `stage`, `stageProgress`, `decayRate` and `tapPower` match the formulas and expected snapshots in `GAME_DESIGN.md` |
| F-03 | Reach every threshold from below | Exactly seven stages occur in order: Тьма → Искра → Пепельный слуга → Алый порог → Демонесса угасания → Круг Инферно → Инферно; a boundary fires once |
| F-04 | Stop input for ten seconds in fixtures for stages 1–7 | Heat decreases at the stage/effect-specific rate from `GAME_DESIGN.md`, never becomes negative, and measured base decay is strictly higher at each later stage |
| F-05 | Let heat fall through one or more lower thresholds | Stage immediately follows the documented range without hysteresis; stage bonus does not repeat; transition event is emitted once per actual crossing |
| F-06 | Compare score delta at controlled heat/multiplier states | Score is integer, never decreases during a session, uses the documented formula/rounding, and maximum multiplier is capped at the documented value |
| F-07 | Permute intervals for equal sets of unique taps, including 100 and 256 commands in one 50 ms step | Every unique valid command is accepted once with unchanged base tap power/score; no cadence/rolling/cooldown/one-per-step reduction or rhythm state exists |
| F-08 | Submit 257 unique commands in one 50 ms step and repeat with duplicate IDs/pointers | Commands 1–256 apply exactly once; command 257+ reports technical `input-overflow` without partial mutation; duplicates remain ignored by identity rules |
| F-08a | Stay at stage 6+ through the full deterministic Heat Window schedule and combine once with rewarded boost | First telegraph starts at 6.0 s, then 9/11/8/10 s cycle; telegraph 0.75 s, active 1.50 s; heat factor is ×2, with reward both factors produce 12 heat/tap, multiplier unchanged and assisted reward heat excluded from direct tap score |
| F-09 | Trigger Порыв слуги, tap throughout, then test stage-exit paths | First trigger at 8.0 s then every 14.0 s; 1.0 s telegraph always leads to `decay×1.8` for 2.5 s; taps retain full power and never cancel, decrement a counter or award success score |
| F-10 | Trigger Холодное клеймо, tap throughout, then test stage-exit paths | First trigger at 10.0 s then every 16.0 s; 2.0 s telegraph always leads to `decay×1.5` for 4.0 s; taps retain full power and never cancel, decrement a counter or award success score |
| F-11 | Reach Инферно and hold/leave it | Hold timer counts only unpaused time in Инферно, stops outside it, and session/best values use documented rounding |
| F-12 | End a run and restart | Run summary is correct; restart resets session-only fields and preserves only documented meta fields |
| F-13 | Pause via UI, visibility loss and platform lifecycle | Clock, decay, score, timers and input stop while paused; one resume continues without elapsed-background catch-up |
| F-14 | Run 10 minutes through stages, debuffs, pause, boost and restart | No invalid state (`NaN`, negative heat, out-of-range stage/progress, uncapped multiplier), freeze or duplicate listener occurs |
| F-15 | Let heat remain 0 around the fail boundary before and after ever reaching stage 2 | Before stage 2, state returns to READY without results; after stage 2, 2.0 s continuous zero enters RESULTS; a valid positive-power tap before 2.0 s cancels failure |
| F-16 | Execute committed `canonicalSealTraceV3` without boost, including 256 valid commands per 50 ms for 5.0 s after first Stage-4 entry | Stage remains 4, heat remains `<560`, Stage-5 event/bonus count=0 and all commands through 256 are accepted; no cadence/rate rule is used to enforce the seal |
| F-17 | Replay the same fixture with one confirmed boost stub, then duplicate/late callbacks and restart | One `sealBroken` transition occurs in the run, Stage 5 is crossed once, duplicate/late callbacks add no break/reward and restart creates a locked seal |
| F-18 | Replay committed boosted canonical at 60/30/15 FPS | One boost breaks the seal and the run reaches Stage 7/heat≥900; committed stage timestamps, accepted taps and score match within ±0.01 heat, ±1 score, ±10 ms hold and exact discrete state |

### Input equivalence

| ID | Scenario | Expected result |
|---|---|---|
| I-01 | Replay identical timestamps through touch and mouse adapters | Core snapshots and score are identical |
| I-02 | 100 sequential inputs at 5 taps/clicks per second | Exactly 100 accepted primary actions; no dropped or duplicated synthetic click after touch |
| I-02a | 100 sequential taps at 10/s, 100 simultaneous commands, then 256 and 257 commands in one fixed step | All valid commands through 256 are accepted exactly once without rolling or per-step normalization; only 257+ gets `input-overflow`; browser primary pointerdown count equals accepted command count at achievable rates |
| I-03 | Two-finger touch, pinch, scroll and long press over play area | Only documented primary pointers count; browser zoom/scroll/context menu does not interrupt the intended play area |
| I-04 | Pointer down inside and release outside; pointer cancellation | No stuck pressed state and no extra action |
| I-05 | Click outside gameplay target and use right/middle click | No heat/score change |
| I-06 | Inspect interactive controls at mobile CSS pixel scale | Every UI control target is at least 48×48 CSS px, the flame primary target is at least 96×96 CSS px, and each control has visible enabled/disabled/focus state |

### Persistence and leaderboard

| ID | Scenario | Expected result |
|---|---|---|
| P-01 | Save a completed run, reload, then load | `bestScore`, `highestStageReached`, `longestInfernoHoldMs` and `maxMultiplier` equal the saved maxima; session heat, score, `runHighestStage`, encounters and boost are not restored; persistence schema has no rhythm/Resonance fields |
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
| R-01 | At `runHighestStage≥4` and active run age ≥45 s, user voluntarily opens placement and receives confirmed reward callback | Exactly one seal break is committed; one `tapPower ×2.0` boost starts for 20 s active gameplay after valid resume; boost visuals/audio active; extra heat grants no direct tap-score points |
| R-02 | Provider is cancelled, errors, is unavailable or returns no reward | No seal break/boost/reward is granted; current run and score are unchanged; user can continue immediately |
| R-03 | Platform produces duplicate/late callbacks | Reward is granted at most once and stale callback cannot start a second boost |
| R-04 | Boost expires during normal gameplay | Modifier ends once after exactly 20 s monotonic active gameplay; tap power, visuals and mix return to the correct non-boost state |
| R-05 | App loses focus or is paused while boost is active | Boost timer does not consume paused/ad time and resumes once after valid lifecycle resume |
| R-06 | Request reward in Generic Web/dev review build | CTA/confirm explicitly say `тест`, no ad-view copy appears; one asynchronous test terminal success uses the same idempotent seal/boost contract; when provider is disabled it returns unavailable without unlock |
| R-07 | Attempt placement while `runHighestStage<4`, before 45 s active run age, during an encounter/transition/pause/active boost, after one rewarded success in this run, within 90 s session cooldown, or while another request is pending | CTA is hidden/disabled or request is rejected; no provider call, reward or gameplay state transition occurs |
| R-08 | Exercise the Stage-4 seal with rewarded success, close/error/unavailable, duplicate callback and a second request in the same run | Only the first confirmed success produces one seal break; every non-success and every duplicate/second success produces zero additional breaks; unavailable Web behavior follows the resolved product/platform contract |

## Browser, mobile and desktop tests

- Capture the new exact production build at heat 50/350/650/1000 for 360×640, 390×844, 768×1024 and 1366×768, plus heat 1000 at 800×360: exactly 17 fresh files with build ID, viewport, DPR, browser/version, heat and timestamp. Prior-cycle captures cannot pass `NC-E1`.
- Record short exact-browser motion evidence for core/outer flame idle at P05/P35/P65/P100, Servant and Demoness appearance/idle/attack, and all six upward plus six downward stage crossings. Each scenario supplies a video or ≥12 timestamped PNG samples and a hash/state manifest.
- In browser, compare pointerdown and accepted-command traces, inspect that no rhythm/cadence HUD exists, and exercise passive servant/demoness decay, Heat Window, pause/background/ad/audio/persistence/leaderboard.
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
| PERF-05 | Frame delivery during 10-minute stage-7 run | median ≥55 FPS on ENV-D1 and ≥30 FPS on ENV-M1; frames slower than 50 ms ≤1% on both profiles |
| PERF-06 | Frame time during stage-7 stress | p95 ≤ 20 ms high-tier; p95 ≤ 33 ms low-tier |
| PERF-07 | Pointer-to-first-changed-frame latency | p95 ≤ 100 ms on touch and mouse |
| PERF-08 | JavaScript heap after 10 minutes stage-7 stress | ≤ 150 MB and no monotonically growing listeners/audio nodes/particles |
| PERF-09 | Pause/resume timing | 0 simulation steps while paused; first resumed step ≤ 100 ms after the final pause reason clears |

Asset audit validates every atlas container plus its frame metadata and enforces hard limits from `ASSET_PLAN.md`: startup critical art ≤1.5 MiB, total art ≤9.8 MiB, decoded textures ≤64 MiB, both stored audio codecs ≤2.2 MiB, total package ≤15 MiB, texture side ≤2048 px, particles ≤120 and audio voices ≤10. Decode accounting includes full registered residency; staged loading не может скрыть worst case.

## Visual QA rubric

Capture the exact-build 17-file `NC-E1` matrix at P05/P35/P65/P100 (heat 50/350/650/1000) for 360×640, 390×844, 768×1024 and 1366×768, plus P100 at 800×360, and the motion matrix from `NC-E2`. Two independent reviewers score every applicable row 0/1. A set passes only if both reviewers give 1 to every mandatory row; disagreement is FAIL until re-review after a documented change. Previous-cycle stills and reports are historical and cannot be reused for new animation/motion rows.

| Rubric | Binary pass rule |
|---|---|
| V-01 Layout integrity | No clipped/overlapping HUD text or controls; no unintended page scrollbar; primary input region and pause/mute/reward controls remain reachable |
| V-02 Legibility | All essential text meets WCAG contrast 4.5:1 (3:1 for large text); icons conveying state have a non-color cue |
| V-03 Production flame animation | Core and outer each use ≥8 unique authored frames; idle samples show alpha-silhouette/tongue motion and no invariant-mask static-card brightness shimmer or geometric fallback |
| V-04 Production character animation | Servant and Demoness each use separate ≥4-frame appearance/idle/attack clips; 2 s idle is visibly alive through authored silhouette/limb motion, not whole-cutout drift only |
| V-05 Environment reveal/transition | P05→P35→P65→P100 retains prior regions; every upward/downward stage crossing crossfades reversibly over 0.8–1.5 s with ≥3 intermediate states and no one-frame pop |
| V-06 Focal hierarchy | Flame center remains within the central 40% of viewport width and central 50% of gameplay height unless an approved stage composition specifies otherwise |
| V-07 Content safety | Captures contain no blood, gore, realistic injury, explicit sexual content or horror jump-scare frame |
| V-08 Motion safety | Reduced-motion mode removes camera shake/rapid flashes and limits full-screen luminance flashes to no more than 3 per second |
| V-09 Asset integrity | No missing-texture markers, stretched sprites, visible atlas bleeding, placeholder art or broken glyphs |
| V-10 Huge P05→P100 delta | Each aligned viewport has mean luminance ratio ≥3, bright coverage ratio ≥10, materially changed pixels ≥45%, flame bounding-area ratio ≥4 and at least four new semantic regions |
| V-11 Signal integrity | No Resonance/rhythm/SURGE/BREATH/cadence/counter/cancel-success UI exists; without text/audio, both reviewers correctly order appearance→attack→decay effect for both hazards and distinguish Heat Window, pause, locked/broken seal and rewarded state |
| V-12 Motion evidence integrity | Every required clip/video or sampled-frame set decodes, matches exact Build ID/state/viewport/timestamps and has verified hashes; static contact sheets/GIFs alone are insufficient |

## Audio checks

| ID | Scenario | Expected result |
|---|---|---|
| A-01 | Launch before user gesture | Browser emits no autoplay rejection or uncaught promise; audio starts only after explicit gesture |
| A-02 | First gesture unlocks audio; exercise accepted/rejected/rapid input | An emitted `acceptedHeatBurst` starts exactly one distinct authored bellows/fanning whoosh; rejected-only input starts none; active whoosh voices ≤2 and total voices≤10; 120-ms aggregation/180-ms cooldown never affects accepted gameplay taps |
| A-03 | Cross stages 1–7 upward and downward | Attributed authored real wood/fire ambience changes gain calmly without discontinuity/click; runtime graph contains no oscillator/noise-generated arcade cue or gas-burner substitute |
| A-04 | Toggle mute, reload and restart | All buses mute immediately; preference persists; no source continues audibly; unmute restores one instance per loop |
| A-05 | Blur/background/pause | Music, ambience and SFX pause/duck per policy; decay and audio resume together exactly once after focus is valid |
| A-06 | Rewarded success/cancel/error | Before ad all game audio pauses; success plays boost cue after resume; cancel/error never plays reward cue; no overlapping duplicate music |
| A-07 | Web Audio unavailable, locked or resume rejected | Silent degradation keeps game playable with visual cues and no uncaught error; next trusted gesture may retry unlock |
| A-08 | Two independent 10-minute exact-browser sessions plus randomized isolated clips | Both reviewers classify ambience as wood/fire, whoosh as bellows/fanning, 0 samples as gas-burner/arcade, report 0 clipping/click/pop and rate fatigue ≤2/5; signed sheets record device/output/build |

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
- Neighbor suites: direct-input fix → scoring/decay/`canonicalSealTraceV3`; seal fix → platform/reward/restart; stage/hazard fix → character motion/audio; asset/render fix → 17 stills + motion matrix + performance; audio asset fix → burst mapping/lifecycle/mute/ad/listening.
- Release candidate receives `NC-A1`–`NC-E4`, retained CG-01/CG-02 regression, `QA:F-01–F-18` including `QA:F-08a`, `QA:I-01–I-06` including `QA:I-02a`, all `QA:P/R/A` cases including `QA:R-08`, ENV-D1/D2/D3/M1/M2/M3/L1/Y1/Y2 assigned smoke and all applicable `AC:*` checks. Browser/visual and audio PASS require independent signed reviewers.

## QA report / issue log

Текущий execution report: `reports/QA_REPORT.md`; визуальный отчёт: `reports/VISUAL_QA_REPORT.md`; performance: `reports/PERFORMANCE_REPORT.md`. Exact-build browser evidence после снятия внешнего блокера размещается в `tests/reports/<build-id>/`.

| ID | Build | Severity | Environment | Summary | Status | Evidence | Regression |
|---|---|---|---|---|---|---|---|
| REG-001 | pre-corrective source candidate | High | code review | Inferno persistence write storm | FIXED | `src/core/engine.js`, `src/app/saveCoordinator.js`, historical regression | SUPERSEDED — rerun in corrective exact build |
| REG-002 | source candidate | High | code review | BFCache, ad handoff, critical asset readiness, audio lifecycle and missing UI actions | FIXED | `reports/QA_REPORT.md` | PASS — independent re-review |
| COR-001 | previous corrective candidate | High | historical visual/audio contract review | Previous bitmap/capture corrective was completed for its exact build | SUPERSEDED | `reports/QA_REPORT.md`, `reports/VISUAL_QA_REPORT.md` | Historical only; does not cover authored motion/seal/new audio |
| NC-001 | `0.1.0+working.15d99f3eb30f` | High | visual contract review | Authored flame/character clips and transitions are implemented; formal exact-build motion matrix is still absent | IMPLEMENTATION FIXED / EVIDENCE OPEN | `reports/VISUAL_QA_REPORT.md`, atlas/animator tests | NOT RUN — exact-build motion review required |
| NC-002 | `0.1.0+working.15d99f3eb30f` | High | product/gameplay contract review | Stage-4 seal and explicit Web/dev test provider | IMPLEMENTATION FIXED | paired V3 fixtures, core/platform/reward tests | PASS candidate regression; exact-build evidence required |
| NC-003 | `0.1.0+working.15d99f3eb30f` | High | audio contract review | Wood/fire beds and bounded accepted-burst fanning replace gas-like single loop | IMPLEMENTATION FIXED / LISTENING OPEN | asset audit, audio graph/lifecycle tests, `reports/QA_REPORT.md` | PASS candidate regression; two-listener gate NOT RUN |
| EXT-001 | new corrective candidate | Blocker | external | Required real Android/iOS devices and Yandex test console are unavailable in the current workspace; local browser evidence does not replace them | OPEN | New environment matrix required | BLOCKED |
