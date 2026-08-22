# Implementation Plan — «Зажги»

## Статус и границы

Документ задаёт порядок реализации `inferno-clicker`. Active Corrective Cycle 07 сохраняет завершённые M1–M4/M7–M10, применимые C06 improvements и замороженные V5 gameplay/audio/platform contracts. Он переоткрывает presentation milestones M5/M6, asset residency M13 и QA/release gates M11–M15. `CORRECTIVE_CYCLE_07.md` имеет precedence над конфликтующими Cycle 05/Cycle 06 presentation решениями; `CORRECTIVE_CYCLE_06.md` остаётся историческим.

Источник продуктовых правил — `GAME_DESIGN.md`, технических границ — `TECHNICAL_ARCHITECTURE.md`, production registry — `ASSET_PLAN.md`, stop condition — `ACCEPTANCE_CRITERIA.md`. Изменение механики сначала обновляет design + acceptance, изменение platform contract — platform + architecture + tests.

## Общие правила исполнения

- Каждый milestone создаёт идентифицированный commit/build и закрывается только указанным evidence; «работает у автора» не является gate.
- Core остаётся headless и не импортирует DOM, PixiJS, Web Audio или platform SDK.
- Concept PNG не копируются в runtime: Art производит отдельные layers/states по asset registry.
- QA может готовить fixtures параллельно, но PASS ставится только на фактической production build.
- Один файл одновременно имеет одного владельца; параллельные роли передают изменения через документы/asset registry и не редактируют один файл совместно.
- После любого QA defect выполняется `QA issue → Developer fix → independent targeted retest → neighboring regression`; milestone не закрывается автором исправления, а retest owner не совпадает с fix owner.

## Milestones

| ID | Milestone | Scope / deliverable | Зависимости | Gate / evidence |
|---|---|---|---|---|
| M1 | Playable core | Зафиксировать Node 24; zero-dependency ESM + JSDoc contracts, Node test/browser-QA skeleton; headless fixed-step clock; `READY/PLAYING/PAUSED/RESULTS`; pointer input через minimal DOM shell; heat/tap/decay/fail/restart; generic Web adapter; dev и production build | Pre-implementation docs accepted | lint, contract check, unit smoke, build; один tap меняет deterministic state, pause не тикает; без Canvas/Yandex imports в core |
| M2 | Direct-tap progression primitives | scoreAcc/score, каждый unique valid tap с полной baseTapPower, все timestamps внутри fixed step, emergency 256 commands/step guard, numeric cap и frame-rate-independent processing; без rolling cap, cadence, combo и cooldown | M1 | 100 unique taps/step принимаются; duplicate inputId и 257+ synthetic overflow различаются; formula/property tests проходят на 60/30/15 FPS |
| M3 | Direct seven-stage progression | Семь threshold/decay configs, stage-only multiplier, stage bonuses, Inferno hold, stageProgress, `runHighestStage`; единственный heat cap 1000; independent concurrent hazards, Heat Window, paired direct V5 traces, constant-rate matrix and human-profile fixtures | M2 | Boundary/event/fail tests stages 1–7; no-reward trace reaches stage 7; concurrent cap×2.50; every-valid-tap parity; exact 60/30/15 FPS rebaseline |
| M4 | Visual layers | Canvas 2D scene bootstrap; far/mid/ritual/foreground render passes; darkness/reveal masks; DOM HUD; multi-layer FlameRig core/outer/glow/embers/smoke/tap burst; responsive portrait/landscape layout. Product intent: visibly animated flame sprites/frames, not a static swap | M1, corrected M3 API; critical visual assets ready | Layer-order/mapper tests; flame animation evident on required viewports; concept PNG absent from runtime manifest |
| M5-C07 | Character asset correction | Preserve retained Servant/Demoness identity/key poses; rebuild Servant clip family with one scale reference and anatomical landmarks; produce sufficiently sharp Demoness sources for exact-scene-transform upscale≤1.25×; version root/mouth/leftHand/rightHand sockets, hashes and provenance; retain accepted host assets | M4 + approved Cycle 07 art/asset contracts | Unique-hash/landmark/edge audits PASS; Servant scale drift≤2%; root drift≤2 px; full viewport/DPR upscale matrix≤1.25×; blur/morph=0; no white matte |
| M6-C07 | Character runtime and steam FX | Remove active snowflake and ice/shard/contact renderers; sample actual current-frame mouth and two palm sockets through the real scene transform; drive bounded steam from mouth and both hands to live flame; preserve inherited host/quality behavior and low/reduced semantics | M5-C07 | Normal/slow motion tests, source/target geometry, static old-semantic veto, both-palm presence, exact transform, bounded pools/pause/cleanup and frozen core timing PASS |
| M7 | Audio | Authored fire ambience plus restrained air-fanning/attack ambience, unlock/mute, bounded sources, shared pause/provider lifecycle; no oscillator, cadence layer or mandatory per-tap sound | M1, corrected M3 event contract; audio exports ready; can integrate parallel to M5–M6 | Audio A-cases: no autoplay error, fire/fanning clarity, no tap-rate rhythm, loop/click/loudness and pause/resume evidence; gameplay fully readable muted |
| M8 | Yandex integration | `PlatformService` Yandex adapter, official loader/init, LoadingAPI ready, GameplayAPI lifecycle, web fallback; official docs revalidated on implementation date | M1 stable adapter contract; M3 pause model | Adapter contract suite + ENV-Y1/Y2 init/lifecycle smoke; static scan proves zero Yandex imports/globals in core |
| M9 | Optional boost provider | Explicit stage-4 PLAYING opener → pause/boost sheet → provider confirmation; terminal success queues only ×2 heat tapPower for 20 active seconds; Web/dev `Получить ×2 (тест)` uses same idempotent contract without fake-ad | corrected M3, M7, M8 | Test/Yandex success, cancel/error/unavailable/duplicate/late/background matrix; no-reward-to-Inferno trace PASS; no test provider in parallel with Yandex |
| M10 | Leaderboard / persistence | `InfernoSaveV1`, local/cloud merge/migration/recovery, settings/daily ritual records-only save, Best Score submit/get and unauthenticated fallback | M2–M3, M8 | Persistence fixtures and leaderboard contract tests; reload never restores active run; lower/duplicate score never reduces best |
| M11 | Browser QA | Full functional matrix on target touch/mouse browsers/viewports, direct stage 4→5 crossing, optional boost, lifecycle, storage failures, offline/Web fallback and later Yandex test environment; create issue log | corrected M3–M10 feature-complete build | QA report for exact Build ID; Critical/High issues routed to owners; no criterion promoted without evidence |
| M12 | Visual QA | Seven stages + event/boost/reduced-motion continuous motion; binary rubric, contrast/crop/safe-area, reference decomposition, content-safety and asset integrity review | M6-C07, M11 stable build | Every applicable Visual criterion PASS on reference viewport/DPR matrix with continuous clips, timestamp-linked frames and rubric sign-off; still-only evidence=0 |
| M13-C07 | Bounded clip residency/performance | Partition corrected higher-resolution clips into disposable resources; ahead-of-need preload, active/imminent pin, deterministic release; measure update/render separately from refresh; optimize without rule/audio changes | M6-C07–M12 exact candidate | Instant residency target≤56 MiB/hard≤64 MiB, spikes>50 ms after preload=0, no active release/missing flash/leak; 10-minute trace PASS |
| M14 | Corrective retest and regression | Для каждого independent defect оформить issue; Developer исправляет на новой build; другой QA owner выполняет targeted full-motion retest и neighboring regression; затем independent blind sign-off и полный functional/platform/visual/audio/performance pass | M11–M13 | Issue→fix→retest→regression links complete; still-only evidence=0; все применимые acceptance criteria кроме packaging PASS; open Critical=0, High=0; Reviewer sign-off |
| M15 | Release | Clean reproducible build, package, manifest/SHA-256, unzip/static-server smoke, Yandex test upload smoke, version/report/tag according to release gate | M14 | Release group PASS, ZIP/report воспроизводимы и соответствуют exact commit; публикация только после отдельного authorization |

## Dependencies and safe parallel work

```text
M1 → M2 → M3 ───────────────┬→ M4 → M5-C07 → M6-C07 ─┬→ M11 → M12 → M13-C07 → M14 → M15
 │                           │                 │
 └─ adapter contract ────────┴→ M8 → M9 ──────┤
 M3 domain events ─────────────→ M7 ──────────┤
 M2/M3 records + M8 ───────────→ M10 ────────┘
```

- После фиксации M3 Art Agent может производить environment/flame/character exports по разным asset IDs параллельно с Developer, не редактируя runtime code. Интеграция идёт последовательно M4→M6.
- Audio Agent может готовить/проверять stems, loops и SFX параллельно M4–M6; Developer подключает их только после стабильного domain-event contract.
- Platform Integration Agent может реализовывать Yandex/Web adapters параллельно M4–M7 после фиксации `PlatformService`; core files ему не принадлежат.
- QA Agent с M1 поддерживает fixtures/case mapping, с M4 готовит visual baselines и с M8 platform matrix; исполнение acceptance — только на идентифицированной build.
- Reviewer выполняет gate review после M3, M10, M13 и M14. Release Agent не начинает M15 до regression sign-off.

## Implementation handoff

Corrective order: freeze gameplay/audio/platform fingerprints → record C07 issues independently → produce/version stable-scale Servant and sharp Demoness clips/metadata → integrate actual mouth/two-palm sockets through the shared scene transform → replace snow/ice with bounded steam → preserve inherited host and silent-quality behavior → partition/preload/release corrected resources → implementation automation/motion capture → Developer fix → independent targeted retest → neighboring regression → independent unlabeled 1×/0.25× motion sign-off → full regression → release gate. Cycle 02–06 screenshots/reports do not close Cycle 07.

Числовая база не перебалансирована молча: `baseTapPower=3`, heat cap `1000`, thresholds `80/220/380/560/730/900`, stage decays `0,5/2/4/6,5/9/13/18`, multipliers и event schedules сохраняются. Optional eligibility `runHighestStage≥4` + `45 000 ms`, boost `×2` на `20 000 ms`, V5 checkpoint `180 000 ms`; authoritative outputs находятся в `GAME_DESIGN.md`, `BALANCE_REPORT.md` и fixtures. Production Yandex rewarded требует test console перед release.
