# Acceptance Criteria — «Зажги», corrective cycle 05 visual polish

Это единственный stop contract. DONE разрешён только для одного clean exact build, когда все применимые строки ровно восьми групп ниже имеют `PASS`, evidence находится в `reports/visual-polish/<exact-build-id>/`, `validate-visual-polish-evidence.mjs` завершён с exit 0 и open Critical=0/High=0.

Статусы: `NOT RUN`, `PASS`, `FAIL`, `BLOCKED`, `N/A — причина`. Новые Cycle 05 условия начинаются с `NOT RUN`. Cycle 02–04 evidence — `SUPERSEDED` для flame smoothness, новой Demoness, spatial contact и Human-Eye Semantic QA. Gameplay/audio не меняются; их перенос разрешён только по exact source/asset fingerprint плюс regression, а не по предположению.

## 1. Functional

| ID | Бинарное условие | Evidence | Статус |
|---|---|---|---|
| F-01 | Touch и mouse: каждый уникальный valid direct input меняет heat/score ровно один раз; cadence, rolling/rhythm cap и one-per-step cap отсутствуют | Input fixtures + full browser cycle | NOT RUN |
| F-02 | За fixed step 50 ms команды 1–256 применяются по одному разу; 257-я и далее возвращают `input-overflow` без частичной мутации; duplicate IDs применяются 0 раз | Runtime contract | NOT RUN |
| F-03 | Pause/menu/visibility/ad замораживают simulation, hazards, boost, animation и audio; после снятия всех причин происходит один resume без catch-up | Lifecycle trace + browser regression | NOT RUN |
| F-04 | Restart/reload не восстанавливает active run; records/settings сохраняются, corrupt save даёт safe fallback, Best Score не уменьшается | Persistence/platform regression | NOT RUN |
| F-05 | Resonance/SURGE/BREATH/cadence/counter/cancel-hazard и Stage-4 permission seal отсутствуют в state, UI и bundle | Static scan + full cycle | NOT RUN |
| F-06 | Servant/Demoness остаются passive decay hazards; taps не отменяют attack. Heat Window даёт heat×2 без direct-score bonus | Core/browser trace | NOT RUN |
| F-07 | Servant и Demoness debuffs имеют независимые timers/sources; `min(2.50,1.80×1.50)=2.50`, tap power не меняется, duplicate application=0 | Mechanical parity fixture | NOT RUN |
| F-08 | HUD показывает servant-only, demoness-only и both-active как раздельные responsive rows с отдельными name/modifier/duration; overlap/truncation/shared timer=0 | Browser geometry/state trace | NOT RUN |
| F-09 | Cycle 05 diff не меняет core gameplay, platform contract или audio mix/assets; frozen fingerprints равны baseline, кроме перечисленного presentation/visual scope | Exact diff + fingerprint regression | NOT RUN |

## 2. Gameplay

| ID | Бинарное условие | Evidence | Статус |
|---|---|---|---|
| G-01 | V5 no-reward run на 60/30/15 FPS достигает stages 2–7 точно в `9000/43500/64500/102000/145200/164800 ms`; checkpoint 180000 ms: 786 taps, score 110498±1, heat 946.465417±0.01, hold 15060±10 ms | Canonical V5 fixture | NOT RUN |
| G-02 | V5 optional boost начинается в 65000 ms; stages 5/6/7 в `75750/83950/102710 ms`; checkpoint: 944 taps, score 180220±1, heat 936.94±0.01, hold 65950±10 ms | Boosted V5 fixture | NOT RUN |
| G-03 | No-reward matrix к 180000 ms: 2 taps/s→maximum stage 4, 4→5, 5→6, 7.14→stage 7 | Tap-rate matrix | NOT RUN |
| G-04 | Boosted 7.14 taps/s достигает Stage 7 раньше no-reward и имеет больший score/hold; reward нигде не является условием content access | Paired matrix | NOT RUN |
| G-05 | Reward success даёт только tapPower×2 на 20 active seconds, максимум один success/run; duplicate/late callback не повторяет reward | Reward trace | NOT RUN |
| G-06 | Close/error/unavailable даёт boost/reward/heat/score/cooldown consumption 0; тот же run может достичь Stage 7 без reward | Provider-unavailable cycle | NOT RUN |
| G-07 | Seven ranges, decay, score, bonuses, Heat Window, failures and Inferno hold совпадают с GAME_DESIGN; heat 0..1000, score 0..2147483647 | Deterministic/cross-doc suite | NOT RUN |
| G-08 | Frozen Cycle 05 before/after browser replay даёт те же accepted input IDs, stage/event sequence и final core snapshot; presentation timestamps не мутируют core | Paired exact-build replay | NOT RUN |

## 3. Visual

| ID | Бинарное условие | Evidence | Статус |
|---|---|---|---|
| V-01 | Ash Servant baseline/current visual+timing fingerprints равны, appearance/placement/size/phases/causality unchanged, root drift≤2 logical px, clipping/edge-alpha/wrap/teleport=0. Любой technical-only diff явно перечислен и независимо regression-tested | Assets manifest + Servant sequence + Pass 2/3 | NOT RUN |
| V-02 | Existing bitmap flame form/palette/glow/sparks/embers/lighting/progression сохранены; geometric/SVG/CSS/programmer-art replacement, excessive blur masking, static-card shimmer и unrelated redesign=0 | Asset lineage/diff + blind review | NOT RUN |
| V-03 | Low flame при 1× и 0.25×: production-browser capture удовлетворяет duration/sample/distinct-pHash contract; visible pop, impossible tongue jump, loop seam, glow flash, ghost/double frame и particle teleport=0 | Low normal/slow frames + metrics + Human-Eye QA | NOT RUN |
| V-04 | Mid flame при 1× и 0.25× удовлетворяет тем же temporal hard gates V-03 | Mid normal/slow evidence | NOT RUN |
| V-05 | High flame при 1× и 0.25× удовлетворяет тем же temporal hard gates V-03 | High normal/slow evidence | NOT RUN |
| V-06 | Inferno flame при 1× и 0.25× удовлетворяет тем же temporal hard gates V-03; host/scene не маскируют flame pop | Inferno normal/slow evidence | NOT RUN |
| V-07 | Loop seam delta≤1.25× internal-adjacent p95; uncaused adjacent one-frame outlier≤1.50×p95; Human-Eye reviewer замечает pop/seam 0 раз | Flame metrics + blind first observations | NOT RUN |
| V-08 | Heat 0→1000 без reset имеет ≥12 ordered samples и ≥6 distinct rolling response levels; scale/brightness/glow/particle density/secondary intensity реагируют внутри stages, discrete-only plateau/tap loop reset/one-frame jump=0 | Continuous-heat browser trace | NOT RUN |
| V-09 | Все 6 upward и 6 downward crossings длятся 0.8–1.5 s, имеют ≥4 intermediate states, max opacity step≤0.20; hard asset swap/pop/ghost/impossible geometry=0 | Transition motion/metrics + Pass 2/3 | NOT RUN |
| V-10 | Demoness reference manifest указывает newest user reference SHA/provenance; face, crown/hair, silhouette, costume, palette, proportions и scale dominance проходят reference checklist во всех idle/cast/recovery key states; identity morph=0 | Assets manifest + reference comparison | NOT RUN |
| V-11 | Demoness bbox height≥1.25× Servant, critical flame/UI overlap=0; feet/root drift≤2 logical px, unintended scale drift≤2%, fragments/clipping/teleport/sliding=0 на desktop/mobile/landscape | Geometry + frame sequences | NOT RUN |
| V-12 | Idle capture≥20 s содержит ≥3 slow breathing periods и subtle chest/shoulder/torso plus hair/cloth/detail motion; rapid periodic whole-body sway, bustle, twitch, dance/club-like loop=0 | Idle sequence + blind semantic review | NOT RUN |
| V-13 | ≥3 disapproval cycles читаются как `look fire→slow gaze shift→frown→pause→one restrained head shake→return`; whole body stable, caricature=0, active cast restart/interruption=0 | Disapproval sequence + Pass 2 | NOT RUN |
| V-14 | Control sequence содержит все 19 named semantic states из QA_PLAN; idle→cast и cast→recovery имеют по ≥8 distinct intermediate poses; adjacent face/costume/body/hand discontinuity и morph artifacts=0 | Demoness full-cast manifest/continuity metrics | NOT RUN |
| V-15 | Full cast читается как slow confident `notice→disapproval→arms-rise→palms-to-flame→cold→contact→reaction→release→recovery`; arms/hands не перескакивают, recovery возвращает exact stable idle | Full-cast normal/slow + Human-Eye QA | NOT RUN |
| V-16 | Cold origin-to-rendered-hand-socket≤12 logical px и endpoint-to-current-visible-flame≤12 px для desktop/mobile; gaze/palms/body/trajectory сходятся на actual flame, fixed independent target/spell miss=0 | Spell-contact geometry + unlabeled browser clips | NOT RUN |
| V-17 | Fire response до first effect/flame-mask contact=0; первая bend/scale/brightness/glow/spark reaction начинается через 0–100 ms после contact, peak позже contact, settle завершён в recovery | Contact trace + sampled frames | NOT RUN |
| V-18 | Blind Pass 2 без HUD/debug/state/file labels правильно отвечает HE-01..HE-05; disclosed fixes before first observations=false; any unclear target/cause, dance, morph, flame pop or hard swap=0 | `blind-review.json` + immutable frames | NOT RUN |
| V-19 | No legacy rhythm UI, body fragments, explicit sexualized/gory/extremist/religious/branded imitation, placeholder/flat concept screen; content safety rows PASS | Pass 2/3 safety review | NOT RUN |

## 4. Audio

| ID | Бинарное условие | Evidence | Статус |
|---|---|---|---|
| A-01 | Before trusted gesture audible sources=0; after gesture each ambience loop has≤1 source; oscillator/runtime-noise/per-tap arcade tone paths=0 | Static graph + browser smoke | NOT RUN |
| A-02 | Accepted heat bursts use current authored fire/fanning mapping; rejected-only input starts 0; whoosh voices≤2, total voices≤10; mute не меняет gameplay | Audio trace | NOT RUN |
| A-03 | Pause/menu/background/ad достигает silence≤100 ms, блокирует stale one-shots и resumes once after all reasons clear | Lifecycle smoke | NOT RUN |
| A-04 | Cycle 05 source/audio asset fingerprints byte-equal signed baseline; lifecycle smoke PASS. Любое отличие запрещает carry-forward и требует отдельного listening review | Fingerprints + prior signoff hash | NOT RUN |
| A-05 | Codec failure делает один bounded fallback или silent degradation; uncaught error/repeated per-tap refetch=0 | Forced failure trace | NOT RUN |

## 5. Performance

| ID | Бинарное условие | Evidence | Статус |
|---|---|---|---|
| PERF-01 | Ready-to-interactive p75≤3.0 s mid-tier Android/4G; initial≤3 MB; total package≤15 MB; main JS gzip≤350 KB | Network/build trace | NOT RUN |
| PERF-02 | Critical art≤1.5 MiB, total art≤9.8 MiB, decoded textures≤64 MiB, both-codec audio≤2.2 MiB, texture side≤2048, particles≤120, voices≤10 | Asset/residency audit | NOT RUN |
| PERF-03 | 10-minute Stage 7 median≥55 FPS desktop и≥30 FPS documented mid-tier mobile emulation; >50 ms frames≤1%; p95≤20/33 ms | Exact browser trace | NOT RUN |
| PERF-04 | Input feedback p95≤100 ms; heap≤150 MB after 10-minute Stage 7; listeners/nodes/textures/particles не растут монотонно | Counters/heap trace | NOT RUN |
| PERF-05 | Cycle 05 added frames/interpolation укладываются в PERF-02/03; decoder/upload spikes>50 ms=0 во время first Demoness cast и каждого flame transition после preload | Performance timeline | NOT RUN |
| PERF-06 | Quality downgrade меняет presentation only; low-quality/reduced-motion сохраняют живой bitmap flame, readable Demoness targeting/contact/causality и identical core snapshot | Forced-load/reduced-motion browser test | NOT RUN |

## 6. Yandex Platform

| ID | Бинарное условие | Evidence | Статус |
|---|---|---|---|
| Y-01 | Core не импортирует Yandex; init timeout/reject≤5 s даёт playable Web fallback; LoadingAPI.ready once after interactive scene | Static/adapter tests | NOT RUN |
| Y-02 | Gameplay start/stop, visibility, menu и ad используют idempotent pause-reason set; one reason не снимает another | Lifecycle matrix | NOT RUN |
| Y-03 | Local/cloud merge сохраняет record maxima и не восстанавливает active run; guest/denied/unavailable playable | Save merge/browser trace | NOT RUN |
| Y-04 | Best Score submits one improved integer [0,2147483647]; lower/duplicate/retry не уменьшает/дублирует | Adapter trace | NOT RUN |
| Y-05 | Reward provider optional, never progression permission; Yandex и explicit Web test provider mutually exclusive; unavailable mode достигает Stage 7 | Provider contract/cycles | NOT RUN |
| Y-06 | Reward success/cancel/error/unavailable/duplicate/late callbacks удовлетворяют G-05/G-06 и атомарно pause gameplay/audio/animation | Platform lifecycle trace | NOT RUN |

## 7. QA

| ID | Бинарное условие | Evidence | Статус |
|---|---|---|---|
| Q-01 | Ровно три ordered passes `implementation`, `independent-blind`, `regression` завершены для одного exact clean Build ID; три owner IDs различны, Pass 2 не production contributor и не видел fix summary до first observations | Root manifest + signoff | NOT RUN |
| Q-02 | Current typecheck/lint/full tests/assets/animation assets/build/static smoke/release audit и visual-polish evidence validator exit 0; skipped=0 | Pass 1 automation log | NOT RUN |
| Q-03 | `visual-polish` evidence validator tests good/missing/stale/corrupt all PASS | Node test result | NOT RUN |
| Q-04 | Browser manifest содержит complete flame 4×2 matrix, continuous heat, both transition directions, Servant regression, Demoness idle/disapproval/full-cast/contact/reaction; sample hashes/times/state/browser identity complete | Validator report | NOT RUN |
| Q-05 | Pass 2 просматривает production browser motion, не still-only/headless; HE-01..HE-05 имеют binary answers, unlabelled first observations и timestamp/frame links | Blind review | NOT RUN |
| Q-06 | Pass 3 повторяет full seven-stage mouse/touch-emulated cycle, required viewports, reduced motion, cross-browser и neighboring gameplay/audio/platform regression | Regression manifest | NOT RUN |
| Q-07 | Каждый fixed Critical/High/Medium имеет independent retest; issue schema содержит severity/environment/steps/expected/actual/evidence/AC; open Critical=0/High=0 | Defects/signoff | NOT RUN |
| Q-08 | QA_PLAN/AC/source assets manifest/reports не противоречат друг другу; every PASS ссылается на nonempty inventoried exact-build evidence | Traceability audit | NOT RUN |

## 8. Release

| ID | Бинарное условие | Evidence | Статус |
|---|---|---|---|
| RLS-01 | Clean checkout на pinned Node воспроизводит Pass 1 offline; dist не содержит tests/docs/mocks/secrets/source maps/debug/unlisted files | Build/release audit | NOT RUN |
| RLS-02 | `reports/visual-polish/<exact-build-id>/`, dist build manifest, commit, source/reference/asset fingerprints и reports указывают один candidate; stale/working files=0 | Evidence validator | NOT RUN |
| RLS-03 | Rebuild same commit/toolchain даёт equivalent sorted dist manifest; allowed nondeterminism explicitly listed | Two-build comparison | NOT RUN |
| RLS-04 | ZIP имеет один root `index.html`, нет wrapper/path traversal/local absolute URLs; matches dist and reaches READY over static HTTP | Package/unpacked smoke | NOT RUN |
| RLS-05 | Final report перечисляет flame temporal changes, interpolation/intermediate states, Demoness/reference workflow, continuity method, dynamic targeting/contact, Pass 1/2 findings/fixes, exact evidence path, commands, reviewers, ZIP SHA/bytes и rollback | Release report audit | NOT RUN |
| RLS-06 | Все применимые F/G/V/A/PERF/Y/Q/RLS PASS, validator exit 0, Critical=0/High=0; QA, independent reviewer и Release Agent sign one exact build | Final stop audit | NOT RUN |

**Current decision:** DONE = NO. Все Cycle 05 visual/semantic строки `NOT RUN`; предыдущие screenshots/reports не дают им PASS. Gameplay и audio остаются frozen и не должны быть изменены этой задачей.
