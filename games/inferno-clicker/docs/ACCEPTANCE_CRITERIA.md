# Acceptance Criteria — «Зажги», corrective cycle 04

Это единственный stop contract. DONE разрешён только для одного clean exact build, когда все применимые строки восьми групп ниже имеют `PASS`, evidence находится в `reports/animation-qa/<exact-build-id>/`, обязательный validator завершился с exit 0, open Critical=0 и High=0. Cycle 02/03 evidence — `SUPERSEDED` для long-exhale, Demoness, simultaneous-debuff, human-balance и sustained-Inferno условий.

Статусы: `NOT RUN`, `PASS`, `FAIL`, `BLOCKED`, `N/A — причина`. Новый Cycle 04 начинается с `NOT RUN`. Старый результат переносится только для неизменной подсистемы при документированном равенстве source/asset fingerprints; audio дополнительно требует нового lifecycle smoke.

## 1. Functional

| ID | Бинарное условие | Evidence | Статус |
|---|---|---|---|
| F-01 | New run принимает touch и mouse: каждый уникальный valid direct input меняет heat/score ровно один раз; cadence, rolling cap, rhythm state и one-per-step cap отсутствуют | Pass 1 input fixtures + Pass 2 touch/mouse cycle | NOT RUN |
| F-02 | За fixed step 50 ms команды 1–256 применяются по одному разу; 257-я и далее возвращают `input-overflow` без частичной мутации; duplicate IDs применяются 0 раз | `pass-1-static/runtime-contract.json` | NOT RUN |
| F-03 | Pause/menu/visibility/ad замораживают simulation, hazards, boost, animation и audio; после снятия всех причин происходит один resume без catch-up | Deterministic lifecycle + browser trace | NOT RUN |
| F-04 | Restart/reload не восстанавливает active run; records/settings сохраняются, malformed/corrupt save даёт safe fallback; Best Score не уменьшается | Persistence/platform regression | NOT RUN |
| F-05 | Нет UI/code/event/string для Resonance/SURGE/BREATH/cadence/counter/cancel-hazard и нет Stage-4 seal/permission state | Static/bundle scan + browser full cycle | NOT RUN |
| F-06 | Servant/Demoness остаются passive decay hazards; taps не отменяют attack и не уменьшают counter; Heat Window даёт heat×2 и не меняет direct score | Core trace + browser temporal sequence | NOT RUN |
| F-07 | Servant и Demoness debuffs могут существовать одновременно как два независимых timer/source state; `enemyDecayFactor=min(2.50,servantFactor×demonessFactor)`, поэтому 1.80×1.50 даёт ровно 2.50; taps сохраняют normal power, duplicate application=0 | `pass-1-static/debuff-mechanical-parity.json` | NOT RUN |
| F-08 | HUD строит responsive vertical status list: servant-only, demoness-only и both-active показывают отдельные source icon/portrait, character/effect name, modifier и duration; overlap/truncation/shared-timer=0 | Browser motion/screens + core/UI trace | NOT RUN |

## 2. Gameplay

| ID | Бинарное условие | Evidence | Статус |
|---|---|---|---|
| G-01 | V5 no-reward run на 60/30/15 FPS достигает stages 2–7 точно в `9000/43500/64500/102000/145200/164800 ms`; checkpoint 180000 ms: 786 taps, score 110498±1, heat 946.465417±0.01, hold 15060±10 ms, discrete state exact | `pass-1-static/canonical-v5-no-reward.json` | NOT RUN |
| G-02 | V5 optional boost начинается в 65000 ms; stages 5/6/7 в `75750/83950/102710 ms`; checkpoint: 944 taps, score 180220±1, heat 936.94±0.01, hold 65950±10 ms | `pass-1-static/canonical-v5-boosted.json` | NOT RUN |
| G-03 | No-reward rate matrix V2 к 180000 ms даёт maximum stage: 2 taps/s→4, 4 taps/s→5, 5 taps/s→6, 7.14 taps/s→7 | `pass-1-static/tap-rate-matrix.json` | NOT RUN |
| G-04 | Boosted 7.14 taps/s достигает Stage 7 раньше no-reward и имеет строго больший score/hold; reward нигде не является условием stage access | Paired matrix comparison | NOT RUN |
| G-05 | Reward success даёт только tapPower×2 на 20 active seconds, максимум один success/run; duplicate/late callback не повторяет reward | Reward trace + browser full cycle | NOT RUN |
| G-06 | Close/error/unavailable даёт boost/reward/heat/score/cooldown consumption 0; игрок продолжает тот же run и может достичь Stage 7 без reward | Provider-unavailable full cycle | NOT RUN |
| G-07 | Seven ranges, decay, score formula, stage bonuses, Heat Window, failure and Inferno hold совпадают с final GAME_DESIGN; heat 0..1000 и score 0..2147483647 | Cross-document/deterministic suite | NOT RUN |
| G-08 | `reports/BALANCE_REPORT.md` отделяет headless simulations от production-browser replays и для Casual/Fast mobile, Casual/Skilled mouse, Extreme burst и paired ×2 хранит raw rate statistics, pattern/duration, max/final stage, time-to-stage, hold и conclusion | Balance report/schema audit | NOT RUN |
| G-09 | Минимум три production-browser irregular replays/profile с raw pointer timestamps и declared touch/mouse method; Extreme burst≤10 s не считается sustainable; skilled no-reward replay достигает Stage 7, а paired ×2 даёт раньше Stage 7 или больше score/hold без изменения content access | Raw pointer logs + `no-reward-stage7.json` | NOT RUN |
| G-10 | Если balance constants изменены, BALANCE_REPORT содержит before/after результаты всех profiles и минимальное обоснование; если текущий balance проходит G-08/G-09, gameplay constants не изменены | Source fingerprint/config diff + report | NOT RUN |

## 3. Visual

| ID | Бинарное условие | Evidence | Статус |
|---|---|---|---|
| V-01 | Flame core и outer для каждой family имеют ≥8 ordered authored frames с metadata SHA, per-frame pixel SHA/provenance/duration; duplicate frame hashes/static substitute=0 | `pass-1-static/atlas-metadata-audit.json` | NOT RUN |
| V-02 | P05/P35/P65/P100 browser idle длится ≥2 s, имеет ≥12 samples и ≥8 distinct pHashes; alpha/tongue metrics показывают silhouette motion, invariant-card shimmer=0 | Motion manifest + flame metrics + independent Pass 2 review | NOT RUN |
| V-03 | Reduced motion остаётся authored animation (≥2 pHashes/2 s), а tap не сбрасывает loop и не вызывает flicker; visible loop seam count=0 | Reduced/tap/seam cases | NOT RUN |
| V-04 | Все 6 upward и 6 downward crossings для composed scene длятся 0.8–1.5 s, имеют ≥3 intermediate opacity states, max opacity step≤0.20 и one-frame pop=0 | Transition sequences/metrics | NOT RUN |
| V-05 | Servant phases/times equal `CORRECTIVE_CYCLE_04.md`: prepare 0–150, inhale-ramp 150–700, inhale-hold 700–1000 ms; exhale start 0–250, ramp 250–900, peak 900–1700, fade 1700–2250, end 2250–2500 ms; recovery≤450 ms | Temporal frames/state trace + independent review | NOT RUN |
| V-06 | Servant `exhaleStrength`, ash-stream, lateral ember velocity and flame bend/suppression follow the same piecewise curve with absolute error≤0.05 and peak alignment±1 frame; root drift≤2 px, clipping/teleport/edge-alpha/wrap=0 | Phase-aligned metrics + frames | NOT RUN |
| V-07 | Demoness rendered bbox height≥1.25× Servant and does not intersect flame critical bbox; idle capture≥18 s is calm; rapid periodic whole-body sway, dance/club-like loop and bustle=0 | Geometry + independent temporal review | NOT RUN |
| V-08 | During ≥18 s active idle, seeded disapproval occurs every 5–9 s as `look→pause→one slow negative head movement→return`, affects core 0 times and never restarts active cast; root drift≤2 px, teleport/clipping=0 | Head gesture frames/track metrics | NOT RUN |
| V-09 | Demoness timings equal `CORRECTIVE_CYCLE_04.md`: cast-look 0–350, arms-rise 350–1350, gather 1350–2000; cold ramp 0–500, hold 500–3200, release 3200–4000; recovery≤800 ms. Ribbon hand→hearth and flame response track coldStrength with error≤0.05/±50 ms; fragments=0 | Cast/cold/fire temporal metrics + blind review | NOT RUN |
| V-10 | First Stage 6→7 uses one exact 1.5 s climax with high-flame expansion, ember burst, rune wave, lighting pulse, restrained impulse and staged host reveal; Reduced Motion removes impulse only; HUD readable and clipping/pop=0 | Inferno payoff sequence + geometry | NOT RUN |
| V-11 | Sustained Inferno capture≥30 s has ≥5 addressable regions; ≥2 visibly change in every sliding 5 s window; phases/periods/amplitudes differ, lockstep/whole-plate-only/seam/freeze/teleport/clipping=0 | `metrics/inferno-ambient.json` + independent review | NOT RUN |
| V-12 | Ровно 17 свежих exact-build RGB/RGBA PNG соответствуют viewport/dimensions/DPR/browser/timestamp/build/source fingerprint и heat±5; previous captures reused=0 | Stills manifest + evidence validator | NOT RUN |
| V-13 | HUD/controls и one/two-debuff vertical stack fully visible at 360×640, 390×844, 768×1024, 1366×768, 800×360; target sizes≥48 CSS px, primary≥96 CSS px; flame/character/status overlap=0 | Browser geometry + independent review | NOT RUN |
| V-14 | No legacy rhythm UI, detached body fragments, explicit sexualized/gory/extremist/religious/branded imitation, placeholder/flat concept screen; independent reviewer passes every safety row | Fresh still/motion safety rubric | NOT RUN |

## 4. Audio

| ID | Бинарное условие | Evidence | Статус |
|---|---|---|---|
| A-01 | Before trusted gesture audible sources=0; after gesture each ambience loop has ≤1 source; oscillator/runtime-noise/per-tap arcade tone paths=0 | Static graph + browser lifecycle smoke | NOT RUN |
| A-02 | Accepted heat bursts use authored fire/fanning mapping; rejected-only input starts 0; whoosh voices≤2, total voices≤10; mute does not change accepted gameplay taps | Deterministic audio graph trace | NOT RUN |
| A-03 | Pause/menu/background/ad reaches silence≤100 ms, blocks stale one-shots and resumes once after all reasons clear without duplicate loops | `pass-1-static/audio-lifecycle.json` + browser smoke | NOT RUN |
| A-04 | Prior perceptual fire-audio sign-off may carry forward only when current and prior `audioSourceFingerprint` plus `audioAssetFingerprint` are byte-equal and A-03 PASS; otherwise two new independent 10-minute listening reviews are present | Exact manifest fingerprints + signoff | NOT RUN |
| A-05 | Codec failure falls back once or degrades silently; uncaught error=0 and repeated per-tap refetch=0 | Forced failure trace | NOT RUN |

## 5. Performance

| ID | Бинарное условие | Evidence | Статус |
|---|---|---|---|
| PERF-01 | Ready-to-interactive p75≤3.0 s on mid-tier Android/4G warm CDN; initial≤3 MB; total package≤15 MB; main JS gzip≤350 KB | Network/build trace | NOT RUN |
| PERF-02 | Critical art≤1.5 MiB, total art≤9.8 MiB, decoded textures≤64 MiB, both-codec audio≤2.2 MiB, texture side≤2048, particles≤120, voices≤10 | Asset/static and runtime residency audits | NOT RUN |
| PERF-03 | 10-minute Stage-7 median≥55 FPS ENV-D1 и≥30 FPS documented mid-tier mobile emulation; >50 ms frames≤1%; frame p95≤20 ms high tier и≤33 ms emulated low tier | Desktop/emulated-mobile trace | NOT RUN |
| PERF-04 | Pointer-to-first-changed-frame p95≤100 ms for touch/mouse; heap≤150 MB after 10-minute Stage 7; listeners/nodes/particles do not grow monotonically | Input/heap counters | NOT RUN |
| PERF-05 | Quality downgrades exactly once after p95>24 ms for 5 s, changes presentation only and preserves identical core snapshot | Forced-load test | NOT RUN |
| PERF-06 | В documented mid-tier mobile CPU/network/touch emulation sustained Stage 7≥10 min: median≥30 FPS, frame p95≤33 ms, >50 ms frames≤1%, heap≤150 MB; Inferno motion активно в каждом 5 s window после downgrade | Emulated-mobile Stage-7 trace + counters | NOT RUN |

## 6. Yandex Platform

| ID | Бинарное условие | Evidence | Статус |
|---|---|---|---|
| Y-01 | Core contains no Yandex import/global; init timeout/reject≤5 s yields playable Web fallback; LoadingAPI.ready once after interactive critical scene | Static/adapter tests + ENV-Y trace | NOT RUN |
| Y-02 | Gameplay start/stop, visibility, menu and ad use idempotent pause reason set; one reason cannot clear another | Lifecycle matrix | NOT RUN |
| Y-03 | Local/cloud merge preserves record maxima and never restores active run; guest/denied/unavailable remains playable | Save merge/browser trace | NOT RUN |
| Y-04 | Best Score submits one improved integer in `[0,2147483647]`; lower/duplicate/retry cannot reduce/duplicate it; failure is nonblocking | Adapter/platform trace | NOT RUN |
| Y-05 | Reward provider is optional capability, never progression permission. Yandex and explicit Web test provider are mutually exclusive; unavailable mode still reaches Stage 7 | Provider contract + browser cycles | NOT RUN |
| Y-06 | Reward success/cancel/error/unavailable/duplicate/late callbacks satisfy G-05/G-06 and pause gameplay/audio atomically | ENV-Y1/Y2 reward trace | NOT RUN |

## 7. QA

| ID | Бинарное условие | Evidence | Статус |
|---|---|---|---|
| Q-01 | Ровно три прохода `implementation validation`, `independent QA`, `full regression` завершены для одного exact clean Build ID; Pass 2 reviewer не участвовал в implementation, Pass 3 verifier не является единственным fix author | Root evidence manifest + signoff | NOT RUN |
| Q-02 | `typecheck`, `lint`, full tests, assets, animation assets, build, static smoke, release audit and evidence validator exit 0; skipped=0 | `pass-1-static/automation.log` | NOT RUN |
| Q-03 | Animation asset validator tests include good/missing/corrupt fixtures; evidence validator tests include good/missing/stale/corrupt fixtures and all pass | Test report | NOT RUN |
| Q-04 | Motion manifest содержит flame baseline, 12 crossings, long Servant sequence, Demoness calm idle/head-shake/full cast, three debuff states, 6→7 payoff и sustained Inferno; genuine decoded samples/hash/time/state/browser identity complete, validator exit 0 | Motion manifest/validator log | NOT RUN |
| Q-05 | Full production-browser touch-emulated/mouse cycles и all target viewports complete; ENV-Y1/Y2 lifecycle complete; unexpected console error/unhandled rejection=0. Реальные mobile devices учитываются отдельным release-platform gate, не подменяя corrective evidence | Pass 2/3 logs | NOT RUN |
| Q-06 | Every fixed Critical/High/Medium has independent retest plus neighbor regression; issue log has severity/environment/steps/expected/actual/evidence/AC; open Critical=0, High=0 | Defects/signoff | NOT RUN |
| Q-07 | QA_PLAN, GAME_DESIGN, architecture, executable fixtures, `BALANCE_REPORT.md` and reports have no numeric/semantic contradiction; every PASS links nonempty exact-build evidence | Traceability audit | NOT RUN |

## 8. Release

| ID | Бинарное условие | Evidence | Статус |
|---|---|---|---|
| RLS-01 | Clean checkout on pinned Node 24 reproduces all Pass 1 commands offline; `dist/` contains no `.gitkeep`, tests/docs/mocks/secrets/source maps/debug markers/unlisted files | Build/release audit | NOT RUN |
| RLS-02 | Evidence directory name, Build ID, commit, source fingerprint, dist manifest and report identify one candidate; `working.*` and stale files=0 | Evidence validator/identity comparison | NOT RUN |
| RLS-03 | Rebuild of same commit/toolchain produces equivalent sorted dist manifest; allowed nondeterministic fields explicitly listed | Two-build comparison | NOT RUN |
| RLS-04 | ZIP has one root `index.html`, no wrapper/path traversal/absolute local URLs, matches dist manifest, extracts and reaches READY by static HTTP | Package/unpacked smoke | NOT RUN |
| RLS-05 | Final release report records commands/exits, tools, fingerprints, exact evidence, environments, defects, reviewers, ZIP bytes/SHA-256, Yandex status and rollback/unpublish procedure | Release report audit | NOT RUN |
| RLS-06 | All applicable F/G/V/A/PERF/Y/Q and RLS-01–RLS-05 PASS; validator exit 0; Critical=0, High=0; QA, independent reviewers and Release Agent sign | Final stop audit | NOT RUN |

**Current decision:** DONE = NO. Reward is not and may never become a Stage-7 permission gate. All new Cycle 04 long-exhale, Demoness, debuff, human-balance, Inferno payoff/ambient and mobile-performance criteria are `NOT RUN`; Cycle 03 evidence cannot pass them.
