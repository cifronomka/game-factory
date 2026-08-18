# Implementation Plan — «Зажги»

## Статус и границы

Документ задаёт порядок будущей реализации `inferno-clicker`. На текущем pre-implementation review production-код, SDK, финальные assets, build и release artifacts не создавались. Начало M1 требует отдельной команды пользователя и принятого planning commit.

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
| M1 | Playable core | Зафиксировать Node/npm/lockfile, Vite + strict TypeScript, Vitest/Playwright skeleton; headless fixed-step clock; `READY/PLAYING/PAUSED/RESULTS`; pointer input через minimal DOM shell; heat/tap/decay/fail/restart; generic Web adapter; dev и production build | Pre-implementation docs accepted | `npm ci`, lint, typecheck, unit smoke, build; один tap меняет deterministic state, pause не тикает; без Pixi/Yandex imports в core |
| M2 | Progression primitives | scoreAcc/score, cadence curve, 8 taps/s cap, Resonance → SURGE → BREATH, numeric cap и frame-rate-independent timestamp processing; stage multiplier подаётся как test fixture, без семи stage configs | M1 | Formula/golden/property tests для stage-1 и injected multiplier проходят на 60/30/15 FPS с заданной tolerance |
| M3 | Stage system and full progression | Семь threshold/decay configs, multiplier, stage bonuses, Inferno hold, stageProgress, `runHighestStage`, reversible stage events, Servant/Demoness/Heat Window schedules и canonical no-ad trace как headless systems | M2 | Boundary/event/fail tests для stages 1–7; duplicate bonuses/events = 0; полный no-ad trace на 60/30/15 FPS находится в design windows |
| M4 | Visual layers | Pixi scene bootstrap; far/mid/ritual/foreground containers; darkness/reveal masks; DOM HUD; multi-layer FlameRig core/outer/glow/embers/smoke/tap burst; responsive portrait/landscape layout | M1, M3 API; critical visual assets ready | Layer-order/mapper tests; stages 1–2 playable на required viewports; concept PNG отсутствуют в runtime manifest |
| M5 | Characters | Отдельные servant, demoness и observers containers/atlases; presentation state machines для hidden/reveal/idle/telegraph/success/fail/retreat без новых gameplay rules | M3, M4; character assets ready | Domain-event→animation state tests; character signals читаемы без audio; content-safety review PASS |
| M6 | Animation / FX | Rune/crack emissive states, stage transitions, particles, glow, smoke/haze, Heat Window/debuff/reward cues, quality `high/low/off`, reduced-motion fallback, pooled cleanup | M4, M5 | FX caps/instrumentation, reversible transition tests, reduced-motion and missing-filter smoke; duplicate emitters/listeners = 0 |
| M7 | Audio | Web Audio mixer, five phase-aligned stems, ambience/SFX buses, unlock/mute, adaptive stage mix, bounded voices, shared pause/ad lifecycle | M1, M3 event contract; audio exports ready; can integrate parallel to M5–M6 | Audio A-cases: no autoplay error, tap onset budget, stage/event cues, loop/click/loudness and pause/resume evidence |
| M8 | Yandex integration | `PlatformService` Yandex adapter, official loader/init, LoadingAPI ready, GameplayAPI lifecycle, web fallback; official docs revalidated on implementation date | M1 stable adapter contract; M3 pause model | Adapter contract suite + ENV-Y1/Y2 init/lifecycle smoke; static scan proves zero Yandex imports/globals in core |
| M9 | Monetization | Explicit PLAYING opener → pause/boost sheet → rewarded confirmation; one idempotent reward/run; ×2 heat tapPower for 20 active seconds; failure/unavailable fallback | M2, M7, M8 | Reward success/cancel/error/unavailable/duplicate/late/background matrix; no-ad progression still PASS |
| M10 | Leaderboard / persistence | `InfernoSaveV1`, local/cloud merge/migration/recovery, settings/daily ritual records-only save, Best Score submit/get and unauthenticated fallback | M2–M3, M8 | Persistence fixtures and leaderboard contract tests; reload never restores active run; lower/duplicate score never reduces best |
| M11 | Browser QA | Full functional matrix on target touch/mouse browsers/viewports, lifecycle, storage failures, offline/Web fallback and Yandex test environment; create issue log | M4–M10 feature-complete build | QA report for exact Build ID; Critical/High issues routed to owners; no criterion promoted without evidence |
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

Первый рабочий шаг после разрешения — M1, а не производство максимальной Inferno-сцены. M1–M3 доказывают игровой core и баланс headless tests; затем M4 создаёт минимальный layered vertical slice stages 1–2. Это снижает риск построить дорогой art/audio pipeline вокруг непроверенной механики.

Открытые входы, которые не блокируют M1–M3, но блокируют соответствующие integrations: подтверждённый provenance production assets (M4–M7), повторная проверка Yandex API/policies (M8–M10) и реальные target devices/Yandex test environment (M11–M15).
