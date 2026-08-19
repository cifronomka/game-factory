# Implementation Plan — «Зажги»

## Статус и границы

Документ задаёт порядок реализации `inferno-clicker`. Предыдущий Candidate 0.1.0 снят с release path новым corrective contract: direct-tap baseline M1–M2 сохраняется, но M3/M9 и связанные presentation/tests reopened для progression seal и test provider. M11–M15 заблокированы до новой exact build и полной regression.

Источник продуктовых правил — `GAME_DESIGN.md`, технических границ — `TECHNICAL_ARCHITECTURE.md`, production registry — `ASSET_PLAN.md`, stop condition — `ACCEPTANCE_CRITERIA.md`. Изменение механики сначала обновляет design + acceptance, изменение platform contract — platform + architecture + tests.

## Общие правила исполнения

- Каждый milestone создаёт идентифицированный commit/build и закрывается только указанным evidence; «работает у автора» не является gate.
- Core остаётся headless и не импортирует DOM, PixiJS, Web Audio или platform SDK.
- Concept PNG не копируются в runtime: Art производит отдельные layers/states по asset registry.
- QA может готовить fixtures параллельно, но PASS ставится только на фактической production build.
- Один файл одновременно имеет одного владельца; параллельные роли передают изменения через документы/asset registry и не редактируют один файл совместно.
- После любого QA defect выполняется `issue → fix → targeted retest → neighboring regression`; milestone не закрывается автором исправления.

## Milestones

| ID | Milestone | Scope / deliverable | Зависимости | Gate / evidence |
|---|---|---|---|---|
| M1 | Playable core | Зафиксировать Node 24; zero-dependency ESM + JSDoc contracts, Node test/browser-QA skeleton; headless fixed-step clock; `READY/PLAYING/PAUSED/RESULTS`; pointer input через minimal DOM shell; heat/tap/decay/fail/restart; generic Web adapter; dev и production build | Pre-implementation docs accepted | lint, contract check, unit smoke, build; один tap меняет deterministic state, pause не тикает; без Canvas/Yandex imports в core |
| M2 | Direct-tap progression primitives | scoreAcc/score, каждый unique valid tap с полной baseTapPower, все timestamps внутри fixed step, emergency 256 commands/step guard, numeric cap и frame-rate-independent processing; без rolling cap, cadence, combo и cooldown | M1 | 100 unique taps/step принимаются; duplicate inputId и 257+ synthetic overflow различаются; formula/property tests проходят на 60/30/15 FPS |
| M3 | Stage system, seal and paired progression | Семь неизменённых threshold/decay configs, stage-only multiplier, stage bonuses, Inferno hold, stageProgress, `runHighestStage`; run-local `sealBroken`, locked cap 559 before threshold 560; accepted-at-cap score/feedback; reset/idempotency; automatic hazards, Heat Window и paired V3 traces | M2 | Boundary/event/fail tests stages 1–7; no-success trace caps at stage 4, success trace reaches stage 7; every-valid-tap parity; seal callback/reset/duplicate tests; exact 60/30/15 FPS rebaseline |
| M4 | Visual layers | Canvas 2D scene bootstrap; far/mid/ritual/foreground render passes; darkness/reveal masks; DOM HUD; multi-layer FlameRig core/outer/glow/embers/smoke/tap burst; clear seal lock/559→560 state; responsive portrait/landscape layout. Product intent: visibly animated flame sprites/frames, not a static swap | M1, corrected M3 API; critical visual assets ready | Layer-order/mapper tests; seal visible/readable without audio; flame animation evident on required viewports; concept PNG absent from runtime manifest |
| M5 | Characters | Отдельные servant, demoness и observers containers/atlases; appearance/idle/attack presentation states tied to domain events without new gameplay rules | corrected M3, M4; character assets ready | Domain-event→appearance/idle/attack tests; character signals readable without audio; content-safety review PASS |
| M6 | Animation / FX | Rune/crack emissive states, stage transitions, particles, glow, smoke/haze, Heat Window/debuff/reward cues, quality `high/low/off`, reduced-motion fallback, pooled cleanup | M4, M5 | FX caps/instrumentation, reversible transition tests, reduced-motion and missing-filter smoke; duplicate emitters/listeners = 0 |
| M7 | Audio | Authored fire ambience plus restrained air-fanning/attack ambience, unlock/mute, bounded sources, shared pause/provider lifecycle; no oscillator, cadence layer or mandatory per-tap sound | M1, corrected M3 event contract; audio exports ready; can integrate parallel to M5–M6 | Audio A-cases: no autoplay error, fire/fanning clarity, no tap-rate rhythm, loop/click/loudness and pause/resume evidence; gameplay fully readable muted |
| M8 | Yandex integration | `PlatformService` Yandex adapter, official loader/init, LoadingAPI ready, GameplayAPI lifecycle, web fallback; official docs revalidated on implementation date | M1 stable adapter contract; M3 pause model | Adapter contract suite + ENV-Y1/Y2 init/lifecycle smoke; static scan proves zero Yandex imports/globals in core |
| M9 | Seal provider integration | Explicit stage-4 PLAYING opener → pause/seal sheet → provider confirmation; terminal success atomically breaks seal for run and queues ×2 heat tapPower for 20 active seconds; Web/dev `Получить ×2 (тест)` uses same idempotent contract without fake-ad; Yandex adapter later replaces provider callback | corrected M3, M7, M8 | Test/Yandex success, cancel/error/unavailable/duplicate/late/background matrix; no-success stage-4 cap and success-to-Inferno traces PASS; no test provider in parallel with real Yandex provider |
| M10 | Leaderboard / persistence | `InfernoSaveV1`, local/cloud merge/migration/recovery, settings/daily ritual records-only save, Best Score submit/get and unauthenticated fallback | M2–M3, M8 | Persistence fixtures and leaderboard contract tests; reload never restores active run; lower/duplicate score never reduces best |
| M11 | Browser QA | Full functional matrix on target touch/mouse browsers/viewports, seal cap/sheet/test success, lifecycle, storage failures, offline/Web fallback and later Yandex test environment; create issue log | corrected M3–M10 feature-complete build | QA report for exact Build ID; Critical/High issues routed to owners; no criterion promoted without evidence |
| M12 | Visual QA | Seven stages + event/boost/reduced-motion captures; binary rubric, contrast/crop/safe-area, reference decomposition, content-safety and asset integrity review | M6, M11 stable build | Every applicable Visual criterion PASS on reference viewport matrix with screenshots/rubric sign-off |
| M13 | Performance optimization | Measure startup, bundle/assets, stage-7 frame/frame-time/heap/input/audio voices; optimize atlases, preload, shaders, emitters and auto quality without rule changes | M6–M12 representative assets/build | PERF budgets and asset audit PASS; 10-minute trace shows no monotonic resource growth |
| M14 | Regression | Исправить все issues, выполнить targeted + neighboring regression, затем полный functional/platform/visual/audio/performance pass на новом candidate | M11–M13 | Все применимые acceptance criteria кроме packaging имеют PASS/evidence; open Critical=0, High=0; Reviewer sign-off |
| M15 | Release | Clean reproducible build, package, manifest/SHA-256, unzip/static-server smoke, Yandex test upload smoke, version/report/tag according to release gate | M14 | Release group PASS, ZIP/report воспроизводимы и соответствуют exact commit; публикация только после отдельного authorization |

## Dependencies and safe parallel work

```text
M1 → M2 → M3 ───────────────┬→ M4 → M5 → M6 ─┬→ M11 → M12 → M13 → M14 → M15
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

Corrective order: M3 seal state/formulas/events → M9 Web/dev test provider and provider contract → M4/M5/M7 product-intent presentation updates → targeted core/app/platform/presentation tests → новая clean build → M11 browser QA → M12 visual/audio QA → M13 performance → M14 full regression → M15 release. Старые V2/no-ad-to-Inferno evidence и прежние screenshots не закрывают этот цикл.

Числовая база не перебалансирована молча: `baseTapPower=3`, thresholds `80/220/380/560/730/900`, stage decays `0,5/2/4/6,5/9/13/18`, multipliers и event schedules сохраняются. Новые числа — только locked cap `559`, eligibility `runHighestStage≥4` + `45 000 ms`, boost `×2` на `20 000 ms`, paired checkpoint `117 000 ms`; authoritative expected results находятся в `GAME_DESIGN.md`. Production Yandex rewarded остаётся последующей заменой Web/dev test provider и требует test console перед release.
