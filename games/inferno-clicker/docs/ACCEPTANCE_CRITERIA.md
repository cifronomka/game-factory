# Acceptance Criteria — «Зажги», corrective cycle 07 steam and clarity correction

Это единственный stop contract. DONE разрешён только для одного финального clean exact build, когда все применимые строки ровно восьми групп ниже имеют `PASS`, evidence находится в `reports/corrective-cycle-07/<exact-build-id>/`, `validate-corrective-cycle-07-evidence.mjs` завершён с exit 0 и open Critical=0/High=0.

Статусы: `NOT RUN`, `PASS`, `FAIL`, `BLOCKED`, `N/A — причина`. Новые Cycle 07 условия начинаются с `NOT RUN`. Cycle 02–06 visual evidence — `SUPERSEDED` для изменённых персонажей/effects/evidence workflow. Gameplay/audio/platform не меняются; их перенос разрешён только по exact source/asset fingerprint плюс neighboring/full regression.

## 1. Functional

| ID | Бинарное условие | Evidence | Статус |
|---|---|---|---|
| F-01 | Touch и mouse: каждый уникальный valid direct input меняет heat/score ровно один раз; cadence, rolling/rhythm cap и one-per-step cap отсутствуют | Input fixtures + full browser cycle | PASS |
| F-02 | За fixed step 50 ms команды 1–256 применяются по одному разу; 257-я и далее возвращают `input-overflow` без частичной мутации; duplicate IDs применяются 0 раз | Runtime contract | PASS |
| F-03 | Pause/menu/visibility/ad замораживают simulation, hazards, boost, animation и audio; после снятия всех причин происходит один resume без catch-up | Lifecycle trace + browser regression | PASS |
| F-04 | Restart/reload не восстанавливает active run; records/settings сохраняются, corrupt save даёт safe fallback, Best Score не уменьшается | Persistence/platform regression | PASS |
| F-05 | Resonance/SURGE/BREATH/cadence/counter/cancel-hazard и Stage-4 permission seal отсутствуют в state, UI и bundle | Static scan + full cycle | PASS |
| F-06 | Servant/Demoness остаются passive decay hazards; taps не отменяют attack. Heat Window даёт heat×2 без direct-score bonus | Core/browser trace | PASS |
| F-07 | Servant и Demoness debuffs имеют независимые timers/sources; `min(2.50,1.80×1.50)=2.50`, tap power не меняется, duplicate application=0 | Mechanical parity fixture | PASS |
| F-08 | HUD показывает servant-only, demoness-only и both-active как раздельные responsive rows с отдельными name/modifier/duration; overlap/truncation/shared timer=0 | Browser geometry/state trace | PASS |
| F-09 | Cycle 07 diff не меняет core gameplay, platform contract, flame/environment design или audio mix/assets; frozen fingerprints равны baseline, кроме перечисленного presentation/visual/loading/evidence scope | Exact diff + fingerprint regression | PASS |

## 2. Gameplay

| ID | Бинарное условие | Evidence | Статус |
|---|---|---|---|
| G-01 | V5 no-reward run на 60/30/15 FPS достигает stages 2–7 точно в `9000/43500/64500/102000/145200/164800 ms`; checkpoint 180000 ms: 786 taps, score 110498±1, heat 946.465417±0.01, hold 15060±10 ms | Canonical V5 fixture | PASS |
| G-02 | V5 optional boost начинается в 65000 ms; stages 5/6/7 в `75750/83950/102710 ms`; checkpoint: 944 taps, score 180220±1, heat 936.94±0.01, hold 65950±10 ms | Boosted V5 fixture | PASS |
| G-03 | No-reward matrix к 180000 ms: 2 taps/s→maximum stage 4, 4→5, 5→6, 7.14→stage 7 | Tap-rate matrix | PASS |
| G-04 | Boosted 7.14 taps/s достигает Stage 7 раньше no-reward и имеет больший score/hold; reward нигде не является условием content access | Paired matrix | PASS |
| G-05 | Reward success даёт только tapPower×2 на 20 active seconds, максимум один success/run; duplicate/late callback не повторяет reward | Reward trace | PASS |
| G-06 | Close/error/unavailable даёт boost/reward/heat/score/cooldown consumption 0; тот же run может достичь Stage 7 без reward | Provider-unavailable cycle | PASS |
| G-07 | Seven ranges, decay, score, bonuses, Heat Window, failures and Inferno hold совпадают с GAME_DESIGN; heat 0..1000, score 0..2147483647 | Deterministic/cross-doc suite | PASS |
| G-08 | Frozen Cycle 07 before/after browser replay даёт те же accepted input IDs, stage/event sequence и final core snapshot; steam reach/collision/timestamps не мутируют core | Paired exact-build replay | PASS |

## 3. Visual

| ID | Бинарное условие | Evidence | Статус |
|---|---|---|---|
| V-01 | Ash Servant identity/palette/retained key poses/placement/gameplay phases сохранены; bytes may change. Appearance/idle/inhale/blow/recovery forward-authored; between each retained semantic key pair≥1 unique in-between; duplicate/permutation/reverse не засчитываются | Asset hashes + continuity sequence + Gates 4/5/6 | PASS |
| V-02 | Existing bitmap flame form/palette/glow/sparks/embers/lighting/progression сохранены; geometric/SVG/CSS/programmer-art replacement, excessive blur masking, static-card shimmer и unrelated redesign=0 | Asset lineage/diff + blind review | PASS |
| V-03 | Low flame при 1× и 0.25×: production-browser capture удовлетворяет duration/sample/distinct-pHash contract; visible pop, impossible tongue jump, loop seam, glow flash, ghost/double frame и particle teleport=0 | Low normal/slow frames + metrics + Human-Eye QA | PASS |
| V-04 | Mid flame при 1× и 0.25× удовлетворяет тем же temporal hard gates V-03 | Mid normal/slow evidence | PASS |
| V-05 | High flame при 1× и 0.25× удовлетворяет тем же temporal hard gates V-03 | High normal/slow evidence | PASS |
| V-06 | Inferno flame при 1× и 0.25× удовлетворяет тем же temporal hard gates V-03; host/scene не маскируют flame pop | Inferno normal/slow evidence | PASS |
| V-07 | Loop seam delta≤1.25× internal-adjacent p95; uncaused adjacent one-frame outlier≤1.50×p95; Human-Eye reviewer замечает pop/seam 0 раз | Flame metrics + blind first observations | PASS |
| V-08 | Heat 0→1000 без reset имеет ≥12 ordered samples и ≥6 distinct rolling response levels; scale/brightness/glow/particle density/secondary intensity реагируют внутри stages, discrete-only plateau/tap loop reset/one-frame jump=0 | Continuous-heat browser trace | PASS |
| V-09 | Все 6 upward и 6 downward crossings длятся 0.8–1.5 s, имеют ≥4 intermediate states, max opacity step≤0.20; hard asset swap/pop/ghost/impossible geometry=0 | Transition motion/metrics + Gates 5/6 | PASS |
| V-10 | Demoness reference manifest указывает newest user reference SHA/provenance; face, crown/hair, silhouette, costume, palette, proportions и scale dominance стабильны; effective upscale, рассчитанный тем же runtime `sceneTransform` и DPR,≤1.25× на каждом required viewport/state; blur/identity morph=0 | Assets manifest + transform matrix + reference/detail comparison | PASS |
| V-11 | Demoness bbox height≥1.25× Servant, critical flame/UI overlap=0; feet/root drift≤2 logical px, unintended scale drift≤2%, fragments/clipping/teleport/sliding=0 на desktop/mobile/landscape | Geometry + frame sequences | PASS |
| V-12 | Idle capture≥20 s содержит ≥3 slow breathing periods и subtle chest/shoulder/torso plus hair/cloth/detail motion; rapid periodic whole-body sway, bustle, twitch, dance/club-like loop=0 | Idle sequence + blind semantic review | PASS |
| V-13 | ≥3 disapproval cycles читаются как `look fire→slow gaze shift→frown→pause→one restrained head shake→return`; whole body stable, caricature=0, active cast restart/interruption=0 | Disapproval sequence + Gate 5 | PASS |
| V-14 | Appearance/idle/disapproval/cast/hold/recovery содержат genuine unique authored cells; между semantic key poses есть authored in-betweens; duplicate/permutation/reverse не засчитываются; adjacent landmark/morph artifacts=0 | Pixel hashes + full-cast continuity metrics | PASS |
| V-15 | Full cast читается как slow confident `notice→disapproval→arms-rise→both palms steam→flame reaction→release→recovery`; arms/hands не перескакивают, обе ладони остаются источниками, recovery возвращает exact stable idle | Full-cast normal/slow + Human-Eye QA | PASS |
| V-16 | Два независимых steam streams originate≤12 logical px from current rendered left/right palm sockets and target current visible flame≤12 px on desktop/mobile/landscape; when both palms visible source count=2, combined/detached/one-hand source=0 | Palm geometry + unlabeled continuous browser clips | PASS |
| V-17 | Active snowflake, conical shard, icicle, projectile-contact and legacy curved/Bézier ribbon renderer/assets/path/pixels=0; steam rises/fades to 0, freezes/clears correctly, and particle travel/collision does not alter core timing | Static audit + steam lifecycle trace + sampled frames | PASS |
| V-18 | Blind Gate 5 без HUD/debug/state/file labels правильно отвечает HE-01..HE-05; disclosed fixes before first observations=false; any unclear source/target, snow/ice interpretation, shrink, blur, dance, morph, flame pop or hard swap=0 | `blind-review.json` + continuous clips + timestamp-linked frames | PASS |
| V-19 | No legacy rhythm UI, body fragments, explicit sexualized/gory/extremist/religious/branded imitation, placeholder/flat concept screen; content safety rows PASS | Gates 5/6 safety review | PASS |
| V-20 | Servant full sequences at 1×/0.25×: flicker, full-pose ghost/double contour, luminance pop, clipping/wrap/teleport/shrink=0; root drift≤2 logical px; head/eye/torso landmark scale drift≤2% in source and after every required transform | Servant normal/slow motion + landmark matrix + Human-Eye QA | PASS |
| V-21 | Steam originates≤8 logical px from current rendered mouth socket, targets current flame≤12 px, exists only during blow/recovery tail and clears after event; snowflake assets/renderer/pixels=0 and horn-origin reading=0 | Socket/particle trace + unlabeled continuous clips | PASS |
| V-22 | Servant, Demoness and host on black/dark-red/neutral backgrounds: visible white matte, chroma spill, rectangular residue and sticker edge=0; partial-alpha audit and Human-Eye veto PASS | Edge composites + audit | PASS |
| V-23 | Accepted Inferno entry duration/composition unchanged; every rolling 5 s post-entry window contains visible authored internal movement in≥2 independent regions; whole-plate/crop-only drift, seam, loop pop=0 | Baseline diff + 15 s host clips | PASS |
| V-24 | Blind review identifies `mouth→steam→flame` and `left palm + right palm→steam→flame` without HUD/debug labels; ambiguous source/target, snow/ice interpretation or one-hand-only reading=0 | Blind first observations + timestamp/frame links | PASS |

## 4. Audio

| ID | Бинарное условие | Evidence | Статус |
|---|---|---|---|
| A-01 | Before trusted gesture audible sources=0; after gesture each ambience loop has≤1 source; oscillator/runtime-noise/per-tap arcade tone paths=0 | Static graph + browser smoke | PASS |
| A-02 | Accepted heat bursts use current authored fire/fanning mapping; rejected-only input starts 0; whoosh voices≤2, total voices≤10; mute не меняет gameplay | Audio trace | PASS |
| A-03 | Pause/menu/background/ad достигает silence≤100 ms, блокирует stale one-shots и resumes once after all reasons clear | Lifecycle smoke | PASS |
| A-04 | Cycle 07 leaves audio files, registry mapping, gain/mix constants and source fingerprints byte-equal the signed pre-C07 baseline; lifecycle smoke PASS | Fingerprints + lifecycle trace | PASS |
| A-05 | Codec failure делает один bounded fallback или silent degradation; uncaught error/repeated per-tap refetch=0 | Forced failure trace | PASS |

## 5. Performance

| ID | Бинарное условие | Evidence | Статус |
|---|---|---|---|
| PERF-01 | Ready-to-interactive p75≤3.0 s mid-tier Android/4G; initial≤3 MB; total package≤15 MB; main JS gzip≤350 KB | Network/build trace | PASS |
| PERF-02 | Critical art≤1.5 MiB, total art≤9.8 MiB, decoded textures≤64 MiB, both-codec audio≤2.2 MiB, texture side≤2048, particles≤120, voices≤10 | Asset/residency audit | PASS |
| PERF-03 | 10-minute Stage 7 median≥55 FPS desktop и≥30 FPS documented mid-tier mobile emulation; >50 ms frames≤1%; p95≤20/33 ms | Exact browser trace | PASS |
| PERF-04 | Input feedback p95≤100 ms; heap≤150 MB after 10-minute Stage 7; listeners/nodes/textures/particles не растут монотонно | Counters/heap trace | PASS |
| PERF-05 | Cycle 07 clips/steam FX укладываются в PERF-02/03; decoder/upload spikes>50 ms=0 после preload во время first attacks, overlap и Inferno entry | Performance timeline | PASS |
| PERF-06 | Quality downgrade silent: user-facing downgrade toast count=0; low/reduced сохраняют mouth steam, two-palm steam and host semantics plus identical core snapshot | Forced-load/reduced-motion browser test | PASS |
| PERF-07 | Refresh-only 30/40/60/120 Hz, startup spikes and hidden/resume gaps produce auto-downgrade count=0; sustained measured render cost over≥2 windows produces one reasoned bounded downgrade | Controller matrix + browser telemetry | PASS |
| PERF-08 | Instant decoded texture residency target≤56 MiB (documented exception required when exceeded) and hard≤64 MiB at startup/first attacks/overlap/Inferno/pause-resume; active-draw release, missing-frame flash, leaked handle, monotonic growth=0 | Clip lifecycle/residency trace | PASS |

## 6. Yandex Platform

| ID | Бинарное условие | Evidence | Статус |
|---|---|---|---|
| Y-01 | Core не импортирует Yandex; init timeout/reject≤5 s даёт playable Web fallback; LoadingAPI.ready once after interactive scene | Static/adapter tests | PASS |
| Y-02 | Gameplay start/stop, visibility, menu и ad используют idempotent pause-reason set; one reason не снимает another | Lifecycle matrix | PASS |
| Y-03 | Local/cloud merge сохраняет record maxima и не восстанавливает active run; guest/denied/unavailable playable | Save merge/browser trace | PASS |
| Y-04 | Best Score submits one improved integer [0,2147483647]; lower/duplicate/retry не уменьшает/дублирует | Adapter trace | PASS |
| Y-05 | Reward provider optional, never progression permission; Yandex и explicit Web test provider mutually exclusive; unavailable mode достигает Stage 7 | Provider contract/cycles | PASS |
| Y-06 | Reward success/cancel/error/unavailable/duplicate/late callbacks удовлетворяют G-05/G-06 и атомарно pause gameplay/audio/animation | Platform lifecycle trace | PASS |

## 7. QA

| ID | Бинарное условие | Evidence | Статус |
|---|---|---|---|
| Q-01 | Ordered Gates 1–6 завершены; final exact clean Build ID един для retest/blind/full regression, а superseded issue builds явно связаны. Implementation/fix, targeted-retest и blind-review owner IDs различны | Root manifest + signoff | PASS |
| Q-02 | Current typecheck/lint/full tests/assets/animation/edge/residency audits/build/static smoke/release audit и Cycle 07 evidence validator exit 0; skipped=0 | Gate 1 automation log | PASS |
| Q-03 | Cycle 07 evidence validator tests good/missing/stale/corrupt/still-only/old-semantics/owner-collision/missing-link all PASS | Node test result | PASS |
| Q-04 | Browser manifest содержит continuous Servant normal/slow, Demoness both-palm-steam normal/slow, full viewport/DPR transform matrix, three-background edges, concurrent events, Inferno entry/sustain, quality matrix and residency lifecycle; clip FPS/duration/hashes/times/state/browser identity complete | Validator report | PASS |
| Q-05 | Gates 2/4/5 просматривают production-browser continuous motion, не still-only/headless; HE-01..HE-05 имеют binary answers, unlabeled first observations до fix disclosure и timestamp/frame links | Blind/retest reviews | PASS |
| Q-06 | Gate 6 повторяет full seven-stage mouse/touch-emulated cycle, required viewports, reduced motion, cross-browser и neighboring gameplay/audio/platform regression | Regression manifest | PASS |
| Q-07 | Каждый Critical/High/Medium issue имеет severity/environment/steps/expected/actual/motion evidence/AC, Developer fix on new build, independent targeted retest and neighboring regression links; автор fix не закрывает issue; open Critical=0/High=0 | Defects/fixes/retests/signoff | PASS |
| Q-08 | QA_PLAN/AC/source assets manifest/reports не противоречат друг другу; every PASS ссылается на nonempty inventoried exact-build evidence | Traceability audit | PASS |

## 8. Release

| ID | Бинарное условие | Evidence | Статус |
|---|---|---|---|
| RLS-01 | Clean checkout на pinned Node воспроизводит Gate 1 offline; dist не содержит tests/docs/mocks/secrets/source maps/debug/unlisted files | Build/release audit | PASS |
| RLS-02 | `reports/corrective-cycle-07/<exact-build-id>/`, dist build manifest, commit, source/reference/asset fingerprints и final reports указывают один candidate; superseded issue builds linked but never signed; stale/working files=0 | Evidence validator | PASS |
| RLS-03 | Rebuild same commit/toolchain даёт equivalent sorted dist manifest; allowed nondeterminism explicitly listed | Two-build comparison | PASS |
| RLS-04 | ZIP имеет один root `index.html`, нет wrapper/path traversal/local absolute URLs; matches dist and reaches READY over static HTTP | Package/unpacked smoke | PASS |
| RLS-05 | Final report перечисляет Servant scale normalization, real-scene-transform Demoness sharpness, mouth/two-palm steam, obsolete snow/ice veto, inherited silent quality/host/residency, issue→fix→independent-retest→neighboring-regression links, evidence path, commands, reviewers, ZIP SHA/bytes и rollback | Release report audit | PASS |
| RLS-06 | Все применимые F/G/V/A/PERF/Y/Q/RLS PASS, validator exit 0, Critical=0/High=0; QA, independent reviewer и Release Agent sign one exact build | Final stop audit | PASS |

**Current decision:** DONE = YES при успешной валидации финального clean exact-build evidence. Все Cycle 07 строки `PASS`; authoritative evidence хранится в `reports/corrective-cycle-07/<exact-build-id>/`. Gameplay, audio и platform подтверждены frozen regression.
