# QA Plan — «Зажги», corrective cycle 04

Case IDs этого документа квалифицируются как `QA:<ID>`, acceptance IDs — как `AC:<ID>`. Release разрешён только для одного clean exact build, прошедшего ровно три прохода ниже. Single still, contact sheet, headless render и любой Cycle 02/03 evidence не подтверждают новые long-exhale, Demoness, simultaneous-debuff, human-balance или sustained-Inferno условия.

## Неподвижные продуктовые правила

- Rewarded никогда не является permission gate. Сильный игрок без рекламы обязан достичь Stage 7. Rewarded — только добровольный `tapPower ×2` на 20 секунд active gameplay; close/error/unavailable ничего не ухудшает и не блокирует progression.
- Валидный direct tap применяется ровно один раз. Нет cadence, rolling cap, искусственного tap-rate cap или stage seal. Единственный защитный предел — 256 команд за один fixed step 50 ms; 257-я и далее отклоняются как технический overflow без частичной мутации.
- Servant и Demoness — passive decay hazards; taps их не отменяют. Heat Window даёт `heat ×2`, не меняя прямой score.
- Текущее fire audio сохраняется. Повторный perceptual listening не нужен только при точном совпадении `audioSourceFingerprint` и `audioAssetFingerprint` с ранее подписанным build и новом PASS lifecycle smoke. Любое изменение source/asset fingerprint снова открывает полный audio review.

## Среды

| ID | Среда | Input / viewport | Обязательность |
|---|---|---|---|
| ENV-D1 | Chrome stable, Windows 10/11 | mouse, 1440×900 | Browser/full cycle |
| ENV-D2 | Firefox stable, Windows 10/11 | mouse, 1366×768 | Browser regression |
| ENV-D3 | Safari stable, macOS | mouse/trackpad, 1440×900 DPR2 | Browser regression |
| ENV-M1 | Mid-tier Android 11+, Chrome | touch, 360×800, device DPR | Real device/performance |
| ENV-M2 | iPhone iOS 16+, Safari | touch, 390×844, device DPR | Real device/layout |
| ENV-M3 | Android large phone, Chrome | touch, 412×915 | Browser regression |
| ENV-L1 | Chrome landscape | touch, 800×360 | Layout/recovery |
| ENV-Y1 | Yandex Games test console desktop | mouse | Platform lifecycle |
| ENV-Y2 | Yandex Games test console mobile | touch | Platform lifecycle |

Записываются дата, OS/browser version, viewport/DPR, input, Build ID, full commit, source fingerprint и console log. Для Cycle 04 documented mid-tier mobile CPU/network/touch emulation является обязательным corrective evidence; реальный ENV-M1/M2 остаётся отдельной release-platform проверкой.

## Ровно три QA-прохода

### Pass 1 — Implementation validation

Владелец: implementation owner; результаты не являются независимым visual sign-off.

1. На clean checkout выполнить `node scripts/typecheck.mjs`, `node scripts/lint.mjs`, `node scripts/test.mjs`, `node scripts/assets-audit.mjs`, `node scripts/animation-assets-audit.mjs`, `node scripts/build.mjs`, `node scripts/e2e-smoke.mjs`, `node scripts/release-audit.mjs`. Exit code каждого — 0; skipped — 0.
2. Проверить atlas metadata hashes/schema/bounds/non-overlap, per-frame pixel SHA-256/provenance/duration/uniqueness, manifest/runtime clip parity и отсутствие static substitutes.
3. Прогнать V5 canonical и tap-rate matrix V2 при 60/30/15 FPS, pointer identity, 256/257 overflow, optional reward success/cancel/error/unavailable/duplicate/late, pause/restart/reload.
4. Детеминированно проверить sprite clocks, reduced-motion continuity, tap-does-not-reset, все 12 переходов, раздельные simultaneous-debuff states/UI timers, character phase diagnostics и audio lifecycle.
5. Implementation owner снимает первый полный browser cycle и self-review новых Servant/Demoness/Inferno сцен. Любой найденный clipping, teleport, club-like Demoness motion или статичный Inferno исправляется до передачи в Pass 2.

### Pass 2 — Independent temporal/gameplay/visual QA

Владелец: независимый QA subagent, не участвовавший в production implementation. Он критически проверяет motion, scale, loops, overlaps, debuff UI, balance anomalies и static Inferno elements; автор fix не закрывает собственный дефект.

1. Запустить production `dist/` exact build. Снять browser temporal evidence Servant long exhale, Demoness head-shake/full cast, three debuff UI states, Stage 6→7 payoff и ≥30 s sustained Inferno.
2. Провести production-browser input replays: practically plausible irregular touch sequences в mobile/touch emulation и mouse sequences на desktop viewport. Constant-rate headless simulations сохраняются отдельно и не выдаются за human measurement.
3. Заполнить `reports/BALANCE_REPORT.md`: raw input intervals/rates, длительность, max/final stage, time-to-stage, hold, ×2 comparison и вывод о необходимости минимальной balance change. Хотя бы один practically plausible skilled no-reward production-browser replay достигает Stage 7; иначе goal FAIL и возвращается в balance fix.
4. Независимо выдать PASS/FAIL каждой temporal/visual строке и defects с timestamp/frame evidence. Pass 2 FAIL возвращает работу implementer; после fix Pass 2 повторяется на новом Build ID.

### Pass 3 — Full regression and release evidence

Владелец: regression QA/release reviewer, отличный от implementation owner.

1. Пройти полную сессию `Тьма→Искра→Пепельный слуга→Алый порог→Демонесса→Круг Инферно→Инферно` мышью и touch, с no-reward, optional ×2, pause/background/restart/reload и simultaneous debuffs.
2. Создать ровно 17 свежих still PNG: P05/P35/P65/P100 для 360×640, 390×844, 768×1024, 1366×768 и P100 для 800×360; heat drift≤5. Выполнить mobile/touch-emulated Stage-7 performance и ENV-Y1/Y2 lifecycle; реальное устройство остаётся отдельной release-platform проверкой, а не новым corrective blocker.
3. Audio: выполнить lifecycle smoke. Предыдущий perceptual sign-off переносится только при byte-equal audio fingerprints; иначе listening review открывается заново.
4. Запустить evidence validator, проверить defect regression, open Critical=0/High=0 и подписать один exact build.

## V5 deterministic contract

Допуски replay: heat ±0.01, score ±1, Inferno hold ±10 ms; discrete stages/events/tap counts совпадают точно.

| Fixture | Binary result at 180000 ms | Status |
|---|---|---|
| V5 no reward strong run, 60/30/15 FPS | Stages 2–7 at `9000/43500/64500/102000/145200/164800 ms`; 786 accepted taps; score 110498; heat 946.465417; Inferno hold 15060 ms | NOT RUN |
| V5 optional boost starts at 65000 ms | Stages 5/6/7 at `75750/83950/102710 ms`; 944 accepted taps; score 180220; heat 936.94; Inferno hold 65950 ms | NOT RUN |
| Reward cancel/error/unavailable | Same progression rules as no-reward; reward/boost/cooldown consumption 0; Stage 7 remains reachable | NOT RUN |

### Tap-rate simulation matrix

Каждый case длится до canonical checkpoint 180000 ms, использует равномерные уникальные taps и passive hazards. Reward disabled, кроме явно boosted строки.

| Rate | Required result | Status |
|---:|---|---|
| 2 taps/s | Maximum stage exactly 4 | NOT RUN |
| 4 taps/s | Maximum stage exactly 5 | NOT RUN |
| 5 taps/s | Maximum stage exactly 6 | NOT RUN |
| 7.14 taps/s | Stage 7 reached without reward | NOT RUN |
| 7.14 taps/s + optional boost at 65000 ms | Stage 7 reached earlier than no-reward; final score and Inferno hold strictly greater; no stage is exclusively reward-gated | NOT RUN |

### Human browser balance profiles

Rates не нормализуются под математический fixture: они вычисляются из raw monotonic timestamps practically plausible irregular sequences, воспроизведённых через настоящий production browser input path. Для каждого профиля report хранит median/p10/p90 interval, sustained taps/s, peak 2-second taps/s, active/rest pattern, trial duration, pointer type и capture/replay method. Минимум три trials каждого профиля. Report прямо маркирует их browser QA patterns, а не биометрические human measurements.

| Profile | Browser pattern | Binary purpose | Status |
|---|---|---|---|
| Casual mobile | Irregular touch replay, устойчивый темп ≥120 s | Не упирается постоянно в ранние stages; max stage и удержание документированы | NOT RUN |
| Fast mobile | Быстрый irregular touch replay: ≥3 active segments по ≥20 s с recorded rests | Значимая progression без impossible sustained speed | NOT RUN |
| Casual mouse | Irregular mouse replay, устойчивый темп ≥120 s | Max stage/time/hold документированы | NOT RUN |
| Skilled mouse | Irregular mouse bursts: ≥6 segments по ≥10 s с rest | Хотя бы один no-reward full run достигает Stage 7 | NOT RUN |
| Extreme burst | Короткие irregular series ≤10 s; отдельно от sustainable profiles | Не используется как основание для long-run balance | NOT RUN |
| Optional ×2 paired | Тот же записанный human trace с одним optional boost | Stage/time/score advantage строгий, но content access не меняется | NOT RUN |

## Temporal evidence contract

Все кадры снимаются из production browser build, не из test renderer. Manifest записывается после файлов. Для каждого sample обязательны path, SHA-256, pHash, monotonic `captureMs`, Build ID/source fingerprint, viewport/DPR/browser version, heat/stage, clip и frame index. PNG — декодируемый 8-bit RGB/RGBA; GIF/contact sheet не является evidence.

- Flame P05/P35/P65/P100: 2.0 s без input, ≥30 FPS capture, ≥12 сохранённых samples (рекомендовано 24 с шагом ≤100 ms), ≥8 distinct pHashes. Отдельные cases: reduced motion (не static), tap continuity, loop seam.
- Все 12 crossings: запись начинается ≥150 ms до threshold и заканчивается ≥150 ms после settle; 0.8–1.5 s, ≥12 samples, ≥3 intermediate opacity states, max opacity step ≤0.20, one-frame pop=0.
- Servant: `prepare` 0–150 ms, `inhale-ramp` 150–700 ms, `inhale-hold` 700–1000 ms; effect `exhale-start` 0–250, `exhale-ramp` 250–900, `exhale-peak` 900–1700, `exhale-fade` 1700–2250, `exhale-end` 2250–2500 ms; presentation `recovery→idle`≤450 ms. По каждому sample записаны `exhaleStrength`, ash-stream, lateral ember velocity и flame bend/suppression: они следуют frozen piecewise curve из `CORRECTIVE_CYCLE_04.md` с error≤0.05, maximum совпадает с peak±1 frame, затем восстанавливаются. Root drift≤2 logical px, clipping/teleport/edge-alpha/wrap=0.
- Demoness: спокойный idle capture≥18 s содержит seeded disapproval gesture с interval 5–9 active seconds: `look→pause→one slow negative head movement→return`, не меняющий core и не перезапускающий cast. Cast: `cast-look` 0–350, `arms-rise` 350–1350, `cast-gather` 1350–2000 ms; effect `cold-ramp` 0–500, `cold-hold` 500–3200, `cold-release` 3200–4000 ms; recovery≤800 ms. Torso/feet root drift≤2 px, rapid periodic whole-body sway и club-like repeated motion=0. Demoness rendered bbox height≥1.25× Servant и не перекрывает flame critical bbox. Ribbon originates at authored hand socket and ends at hearth; cold strength и flame response следуют curve с error≤0.05/±50 ms; fragments/teleports/clipping=0.
- Debuffs: отдельные sequences/screens для only Servant, only Demoness и both active. Одновременно видны две responsive rows с required copy `Пепельный слуга / Пепельный выдох / Decay ×1,80` и `Демонесса угасания / Холодное угасание / Decay ×1,50`, source icon и independent duration; overlap/truncation=0. Runtime: `min(2.50, servantFactor×demonessFactor)`, то есть simultaneous 1.80×1.50 даёт ровно 2.50, taps сохраняют power; UI timers/factors совпадают с core в пределах 50 ms.
- Inferno: Stage 6→7 sequence начинается ≥500 ms до crossing и покрывает exact 1.5 s climax плюс ≥3 s after: high-flame expansion, ember burst, rune wave, lighting pulse, restrained impulse и staged host reveal; Reduced Motion убирает impulse, но не entry semantics. Затем ≥30 s continuous capture: ≥5 independently addressable region tracks, минимум 2 visibly change в каждом sliding 5 s window, different phases/periods/amplitudes, no lockstep/whole-plate-only motion, seam/clipping/teleport/freeze=0.
- Pause/background frames доказывают frame index/time delta=0; resume не делает catch-up. Tap impulse не сбрасывает authored loop и не создаёт flicker.

## Обязательный evidence layout

```text
reports/animation-qa/index.json
reports/animation-qa/<exact-build-id>/
  manifest.json
  README.md
  pass-1-static/
    automation.log
    test-results.json
    asset-audit.json
    atlas-metadata-audit.json
    frame-uniqueness.json
    runtime-contract.json
    canonical-v5-no-reward.json
    canonical-v5-boosted.json
    tap-rate-matrix.json
    debuff-mechanical-parity.json
    audio-lifecycle.json
  pass-2-browser/
    full-cycle/{touch-390x844.json,mouse-1366x768.json,provider-unavailable.json,console.json}
    balance/{BALANCE_REPORT.md,human-input-profiles.json,no-reward-stage7.json,optional-boost-paired.json,raw/*.json}
    stills/{manifest.json,17 PNG}
    motion/manifest.json
    motion/flame/{p05,p35,p65,p100,reduced-motion,tap-continuity,loop-seam}/
    motion/transitions/{up-1-2..up-6-7,down-7-6..down-2-1}/
    motion/servant/{appearance,idle,long-inhale-exhale-fire-reaction}/
    motion/demoness/{silhouette-reveal,calm-idle,disapproval-head-shake,full-cold-cast}/
    motion/debuffs/{servant-only,demoness-only,both-active}/
    motion/inferno/{stage-6-to-7-payoff,sustained-30s}/
    metrics/{flame-motion.json,loop-seams.json,transitions.json,character-causality.json,debuff-parity.json,inferno-ambient.json,geometry.json,performance-browser.json}
  pass-3-independent/
    independent-review.md
    regression-cycle.json
    device-matrix.md
    yandex-console.md
    defects.md
    signoff.md
    signoff.json
```

`manifest.json` перечисляет SHA-256 и bytes каждого evidence-файла, кроме самого себя, и содержит ровно `pass-1-static`, `pass-2-browser`, `pass-3-independent`. Directory name равен clean Build ID. `working.*`, отсутствующий directory, stale fingerprint, повреждённый PNG или пропущенный case всегда FAIL.

## Traceability и regression

| Change | Mandatory neighbors |
|---|---|
| Gameplay/input | V5 both fixtures, V2 simulations separated from irregular browser profiles, BALANCE_REPORT, score/decay/concurrent hazards, touch/mouse, restart/reload |
| Reward/platform | No-reward Stage 7, optional boost advantage, cancel/error/unavailable/duplicate/late, pause/audio lifecycle |
| Flame/transition | Asset audit, all flame cases, 12 crossings, reduced motion, layout, performance |
| Character/debuff/Inferno | Long phase-synced Servant, no-dance Demoness/head-shake/cold cast, three debuff UI states/mechanical parity, 6→7 payoff and sustained asynchronous Inferno |
| Audio lifecycle only | Fingerprint equality, mute/pause/ad/suspend smoke; changed fingerprint reopens full listening |

Cycle 02/03 fixtures, screenshots and reports are `SUPERSEDED` для новых условий; они могут использоваться только как historical debugging material. Все Cycle 04 строки остаются `NOT RUN` до полного evidence одного clean exact build. DONE = NO.
