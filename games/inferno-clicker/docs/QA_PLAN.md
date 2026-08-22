# QA Plan — «Зажги», corrective cycle 07 steam and clarity correction

Case IDs этого документа квалифицируются как `QA:<ID>`, acceptance IDs — как `AC:<ID>`. Cycle 07 проверяет stable-scale Ash Servant, пар из фактического рта, sharp Demoness, пар из обеих фактических ладоней и строгую issue→fix→independent-retest→neighboring-regression traceability. Применимые C06 checks для authored motion, alpha edges, host, silent quality и residency сохраняются. Gameplay, reward, platform, flame/environment design и audio не переоткрываются; они проходят fingerprint regression на неизменность.

DONE разрешён только для одной финальной clean exact build после полного ordered C07 workflow. Evidence Cycle 02–06 не может дать PASS новым Cycle 07 условиям. Single still, contact sheet, headless renderer, координатное равенство или авторское self-review без просмотра continuous production-browser motion не доказывают scale stability, sharpness, attachment или semantic quality.

## Неподвижные правила Cycle 07

- Принятые identity/key poses, placement и gameplay phases Ash Servant сохраняются; bytes/frame count меняются для family-wide scale normalization, clean alpha, genuine in-betweens and per-frame mouth steam. Unintended anatomical scale drift≤2%, root drift≤2 logical px; snowflakes отсутствуют.
- Сохраняются текущие bitmap form, palette, glow, sparks, embers, lighting и progression flame. Нельзя заменять flame геометрическим/SVG/CSS/programmer-art вариантом или скрывать pop чрезмерным blur.
- Demoness сохраняет newest-reference identity, но получает resolution, export и runtime filtering, достаточные для real-`sceneTransform` upscale≤1.25×, а также отдельные per-frame left/right palm sockets. Она кастует steam из обеих рук; ice shards, icicles and legacy cold ribbon отсутствуют.
- Gameplay balance, V5 fixtures, direct-tap/reward rules, platform contract и audio assets/mix не меняются. Для audio достаточно fingerprint equality и lifecycle smoke; несовпадение fingerprint открывает отдельный review и не маскируется Cycle 07.
- Flicker, full-pose double exposure, white matte, Servant shrink>2%, blur from upscale>1.25×, morph, teleport, static host, snowflake, icicle/shard/ribbon residue, horn-origin/detached steam, one-hand-only Demoness steam или source miss — binary FAIL независимо от формальных метрик.

## Среды и identity

| ID | Среда | Обязательное использование |
|---|---|---|
| ENV-P1 | Production Chromium exact `dist/`, 1366×768, mouse | Normal/slow flame, Demoness full cycles, Human-Eye baseline |
| ENV-P2 | Production Chromium exact `dist/`, 390×844 touch emulation | Mobile composition, targeting, full-cycle regression |
| ENV-P3 | Production Chromium exact `dist/`, 800×360 touch emulation | Landscape clipping/targeting regression |
| ENV-R1 | Firefox stable, 1366×768 | Gate 6 cross-browser temporal regression |
| ENV-R2 | Safari stable, 390×844 DPR2 | Gate 6 cross-browser layout/temporal regression |
| ENV-Y1/Y2 | Yandex test console desktop/mobile | Existing platform lifecycle regression; не источник Cycle 07 visual truth |

Каждая browser запись хранит Build ID, full commit, source/asset/reference fingerprints, browser/version, OS, viewport, DPR, input type, monotonic capture timestamps, heat/stage и console log. Directory name обязан равняться exact clean Build ID `0.1.0+<12 hex>`; `working.*` запрещён.

## Ordered Cycle 07 QA workflow

### Gate 1 — Implementation validation

Владелец — implementation owner; этот pass не является независимым sign-off.

1. На clean checkout выполнить текущие `typecheck`, `lint`, full tests, asset/animation audits, build, static browser smoke и release audit; exit code 0, skipped 0.
2. Зафиксировать `assets-manifest.json`: retained-key-pose lineage, Demoness reference SHA/provenance, каждый unique authored frame hash, dimensions, root/mouth/leftHand/rightHand/anatomical landmarks, partial-alpha edge metrics, clip preload/release group и decoded bytes.
3. Снять из production browser flame low/mid/high/Inferno в normal playback и 0.25× slow playback, continuous-heat ramp и все upward/downward stage crossings. Автор устраняет любой обнаруженный pop, seam, hard swap, double/ghost flame и particle teleport до Gate 2.
4. Снять continuous motion Servant appearance/idle/inhale/blow/recovery и Demoness idle/disapproval/full `both palms→steam→flame reaction→release→recovery` при 1×/0.25×. Проверить уникальность кадров, anatomical scale continuity, no-flicker/no-matte/no-blur, current-frame sockets, both-palm presence и actual flame target.
5. Прогнать quality-controller matrix `30/40/60/120 Hz`, startup spikes, sustained render cost, hidden/resume и forced tiers; auto-quality toast count `0`.
6. Прогнать overlap/Inferno-entry clip-residency lifecycle и frozen gameplay/audio regression. Изменение gameplay или audio запрещает handoff.

### Gate 2 — QA issue capture

Владелец — QA/reviewer, не писавший production animation и не получивший fix summary до первичных наблюдений.

1. Запустить exact production build и просмотреть при 1×/0.25× минимум три полных Servant attacks, Demoness idle≥20 s, три disapproval/full casts, Inferno entry и ≥15 s sustained host motion. Raw continuous capture≥30 FPS обязателен.
2. Первичный blind set имеет случайный порядок/opaque clip IDs; HUD labels, debug overlays, state names и подсказки filename скрыты. Reviewer сначала записывает, что происходит, кто воздействует на какой объект и в каком порядке, затем получает diagnostic overlay для измерений.
3. Без текста reviewer обязан однозначно распознать: Servant выдыхает пар изо рта в огонь; Demoness направляет пар из обеих ладоней в огонь. Snow/ice interpretation, источник в рогах, только одна рука или detached effect = FAIL.
4. Reviewer отдельно сравнивает newest reference с idle/cast/recovery frames по face, silhouette, costume, proportions и details; любое изменение identity между соседними states — FAIL.
5. Каждый независимый дефект записывается отдельным issue со schema `id/severity/environment/build/steps/expected/actual/motionEvidence/timestampFrameLinks/acceptanceIds/owner/status`. Shrink, wrong emitter origin, blur и old snow/ice semantics нельзя объединять в один issue.

### Gate 3 — Developer fix

Developer получает issue, исправляет source/assets/tests на новом exact Build ID и связывает `issueId`, changed paths и verification commands. Автор исправления не меняет QA observation, severity или status на PASS и не выполняет окончательный retest.

### Gate 4 — Independent targeted retest and neighboring regression

1. Retest owner отличается от fix owner. Он сначала повторяет исходные steps и полный affected motion на новой build при 1×/0.25×, не читая fix summary до записи first-observation text.
2. Для Servant neighboring regression включает appearance/idle/inhale/blow/recovery, pause/resume, cancel/cleanup, reduced/forced-low и concurrent Demoness event. Для Demoness — idle/disapproval/cast/hold/recovery, обе ладони, all required viewports/DPR, pause/resume, reduced/forced-low и concurrent Servant event.
3. Retest связывает original issue, fix Build ID, continuous motion, timestamped frames, binary measurements и результат. Любой FAIL возвращается Developer как новая revision того же issue; старый candidate отзывается.

### Gate 5 — Independent blind Human-Eye sign-off

Независимый reviewer, отличный от fix и retest owners, просматривает случайно упорядоченные opaque clips финального candidate. Он подтверждает HE-01..HE-05 до раскрытия diagnostics/fix notes. First-observation text, clip timestamps and frame links обязательны; still-only evidence отклоняется.

### Gate 6 — Full regression and sign-off

Владелец — regression QA, отличный от implementation owner и Gate 5 reviewer.

1. Пройти `Тьма→Искра→Пепельный страж→Алый порог→Демонесса→Круг Инферно→Инферно` мышью и touch-emulation; проверить upward/downward transitions, pause/background/resume, reduced motion, restart/reload и optional reward без изменения balance.
2. Повторить Servant mouth-steam, Demoness both-palm steam и Inferno host на ENV-P2/P3 и минимум одном ENV-R; выполнить scale/sharpness/edge review на black/dark-red/neutral backgrounds, normal/reduced/forced-low tiers.
3. Выполнить 10-minute Stage 7/overlap performance and instantaneous residency trace, exact audio lifecycle smoke и frozen gameplay/platform suite.
4. Исполнить `node scripts/validate-corrective-cycle-07-evidence.mjs reports/corrective-cycle-07/<exact-build-id>`; open Critical=0, High=0, все применимые AC PASS, все evidence hashes/identity и issue→fix→retest→regression links совпадают.

## Temporal capture contract

Все captures происходят из production browser build. Raw recording ≥30 capture FPS; sampled PNG — genuine decoded 8-bit RGB/RGBA. Для каждого sample обязательны path, SHA-256, pHash, strictly increasing `captureMs`, heat/stage, animation state и actual flame bbox/anchor. Manifest записывается после всех файлов.

### Flame

Для `low`, `mid`, `high`, `inferno` обязательны два scenario одного exact build:

- normal: ≥4 s, ≥24 sampled frames, ≥3 полных loops;
- slow: 0.25×, ≥8 s, ≥24 sampled frames, тот же source sequence/asset fingerprint;
- ≥8 distinct pHashes и видимое движение tongues/core/outer/glow; static-card shimmer=0;
- `visiblePopCount=0`, `loopSeamCount=0`, `ghostOrDoubleCount=0`, `particleTeleportCount=0`;
- seam delta не превышает `1.25 × p95` внутренних adjacent deltas; ни один internal adjacent delta не является one-frame outlier >`1.50 × p95` без диагностированного input/transition event;
- Human-Eye veto: pop, impossible tongue jump, glow flash или single-frame scale jump, видимый при 1× либо 0.25×, означает FAIL.

Continuous heat case проходит 0→1000 без reset и содержит ≥12 ordered heat samples и ≥6 distinct rolling visual response levels. Rolling 500 ms means для scale/brightness/glow/particle density/secondary-flame intensity меняются с heat; plateau на полном внутреннем диапазоне stage, discrete-only update и one-frame jump запрещены. Tap не сбрасывает loop.

Каждый из 6 upward и 6 downward crossings начинается ≥250 ms до threshold и заканчивается после settle. Transition длится 0.8–1.5 s, имеет ≥4 промежуточных blend/scale/intensity states, max opacity step≤0.20, hard asset swap/one-frame pop/ghosting=0. Geometry flame остаётся совместимой на соседних states.

### Ash Servant Cycle 07

- Retained semantic key poses сохраняют identity/palette/scale/placement; exact timing соответствует core phases. Между каждой соседней retained key-pose pair есть ≥1 unique authored in-between; duplicate hash, permutation и reverse playback не засчитываются.
- Root drift≤2 logical px. Нормализованные head/eye/torso landmark distances относительно root дают unintended scale drift≤2% во всех appearance/idle/inhale/blow/recovery frames и после каждого required viewport transform. Flicker, ghost/double contour, shrink/pulse, luminance pop, clipping/wrap/teleport=0 при 1×/0.25× и pause/resume.
- Steam origin-to-current rendered mouth socket≤8 logical px, endpoint-to-current visible flame≤12 px. Пар существует только в blow/recovery tail; emitter bounded, pause-safe и очищается. Active snowflake renderer/assets/pixels=0; horn-origin reading=0.

### Demoness

- Reference manifest содержит newest user-reference path/SHA-256/provenance и feature checklist: face, crown/hair, silhouette, costume, palette, proportions, scale dominance. Каждый пункт должен быть PASS у Gates 4, 5 и 6.
- Character bbox height≥1.25× Ash Servant, не перекрывает critical flame/UI; feet/root drift≤2 logical px, unintended scale drift≤2%, fragment/clipping/teleport/sliding=0.
- Effective upscale≤1.25× на каждом required viewport/DPR, вычисленный через exact runtime `sceneTransform` и DPR; face/crown/hands не мягче Servant по edge/detail comparison. Filter-radius budget записан в evidence; blur/morph/double-hand=0. Unique pixel hashes подтверждают authored in-betweens; duplicate/permutation/reverse не засчитываются.
- Calm idle capture≥20 s: ≥3 breathing periods, subtle chest/shoulder/torso motion и secondary hair/cloth/detail motion; rapid periodic whole-body sway, bustle, twitch и dance/club-like loop=0.
- Disapproval capture содержит ≥3 полных `look-at-fire→slow gaze shift→frown→pause→one restrained head shake→return-to-fire` cycles. Gesture медленный, не двигает whole body и не прерывает active cast.
- Control sequence содержит минимум 19 semantic samples: `idle-breath-1`, `idle-breath-2`, `look-fire`, `disapproval`, `head-start`, `head-mid`, `head-end`, `prepare-1`, `prepare-2`, `arms-halfway`, `hands-to-flame`, `steam-start`, `steam-mid`, `steam-full`, `flame-reaction`, `steam-hold`, `cast-ending`, `recovery`, `idle-return`. Между `idle→cast` и `cast→recovery` — ≥8 distinct intermediate sampled poses; adjacent identity/costume/morph discontinuities=0.
- Два независимых steam origins находятся у текущих rendered `leftHand` и `rightHand` palm sockets (каждый distance≤12 logical px), trajectories converge на actual visible flame, endpoint error≤12 px. При видимости обеих ладоней active source count=2; one-hand/combined/detached source=0.
- Active conical shard/icicle/snowflake/legacy Bézier ribbon renderer, asset, path and pixels=0. Steam появляется и развивается по existing presentation phase, rises/fades to zero, а ее travel/collision не изменяет core effect schedule. Pause/cancel/teardown lifecycle errors=0.

### Alpha edges, host and quality/residency

- Partial-alpha silhouettes композятся на black, dark-red and neutral backgrounds. Visible white halo, chroma spill, opaque rectangular residue and sticker edge count=0 for Servant, Demoness and host; Human-Eye veto overrides a passing numeric border scan.
- Accepted 1.5 s Inferno entry duration/composition matches baseline. In every rolling 5 s after entry, ≥2 independently phased authored internal regions visibly move; whole-plate/crop drift, seam and loop pop=0.
- Auto quality: 30/40/60/120 Hz refresh-only fixtures, warm-up spikes and hidden/resume produce downgrade count=0; sustained over-budget render cost over ≥2 windows produces one bounded downgrade with reason telemetry and user-facing toast count=0.
- Instant decoded residency target≤56 MiB, hard≤64 MiB in startup/first attacks/overlap/Inferno/pause-resume. Active draw release=0, missing-frame flash=0, decode/upload spike>50 ms after preload=0, leaked handles and monotonic growth=0.

## Human-Eye Semantic rubric

Reviewer видит opaque IDs и rendered motion без UI/debug/state labels. До раскрытия diagnostics он отвечает бинарно:

| ID | Вопрос | PASS |
|---|---|---|
| HE-01 | Кто и на что воздействует? | Servant выдыхает пар изо рта в огонь; Demoness направляет пар из обеих ладоней в центральное пламя |
| HE-02 | Откуда выходит эффект? | current mouth и две current palms; horns, one combined hand point, detached source, snow или ice = FAIL |
| HE-03 | Как читается idle/disapproval? | спокойная властная угроза и сдержанное неодобрение; dance/fuss/twitch/comedy отсутствуют |
| HE-04 | Стабилен ли персонаж? | лицо, костюм, силуэт и пропорции распознаются как одна героиня во всех key states; morph/fragment=0 |
| HE-05 | Плавны, стабильны и резки ли characters? | Servant shrink/flicker и Demoness blur/morph/double contour/white matte/static host не замечены ни на 1×, ни на 0.25× |

Gate 5 обязан PASS по всем пяти строкам с first-observation text и timestamp/frame links на continuous motion. Формальные координаты не могут превратить Human-Eye FAIL в PASS.

## Exact evidence layout

```text
reports/corrective-cycle-07/index.json
reports/corrective-cycle-07/<exact-build-id>/
  manifest.json
  README.md
  gate-1-implementation/
    automation.log
    assets-manifest.json
    servant-continuity.json
    servant-scale.json
    flame-temporal.json
    demoness-continuity.json
    scene-transform-upscale.json
    steam-sockets.json
    obsolete-fx-audit.json
    alpha-edge-audit.json
    quality-controller.json
    clip-residency.json
    gameplay-audio-fingerprint-regression.json
  gate-2-issues/
    defects.json
    browser/manifest.json
    browser/clips/<opaque-scenario-id>/*
    browser/frames/<opaque-scenario-id>/*.png
    first-observations.json
  gate-3-fixes/
    fixes.json
  gate-4-independent-retest/
    retests.json
    neighboring-regression.json
    browser/manifest.json
  gate-5-independent-blind/
    browser/manifest.json
    browser/clips/<opaque-scenario-id>/*
    browser/frames/<scenario-id>/*.png
    metrics/{flame.json,transitions.json,servant-scale.json,demoness-sharpness.json,steam-sockets.json,performance.json}
    blind-review.json
  gate-6-regression/
    full-cycle.json
    cross-browser.json
    audio-lifecycle.json
    regression.json
    signoff.json
```

`browser/manifest.json` содержит scenarios: `servant-appearance/idle/blow/recovery × normal/slow`, `demoness-idle/disapproval/cast/both-palm-steam/recovery × normal/slow`, `character-edges × 3 backgrounds`, `scene-transform × viewport/DPR matrix`, `concurrent-servant-demoness`, `inferno-entry/host-sustain`, `quality-refresh/startup/hidden/load`, `residency-overlap/inferno/pause`. Motion clips имеют duration/FPS/SHA-256 и timestamp-linked sampled frames; все evidence files перечислены с bytes/SHA-256. Unlisted/missing/tampered/stale files запрещены.

Validator hard-fails missing/stale/corrupt evidence, wrong gate order/owners, same fix/retest owner, stale build/reference/source fingerprints, still-only/contact-sheet-only capture, missing first-observation text, disclosed fix notes before observation, missing issue→fix→retest→neighboring-regression links, non-genuine PNG, incomplete viewport/DPR matrix, missing Demoness states, old snow/ice semantics, source miss, Servant scale drift>2%, effective upscale>1.25×, blur/morph, one-hand-only steam, open Critical/High или любой final decision не `PASS`. Fixture tests обязаны покрывать good/missing/stale/corrupt/still-only/old-semantics/owner-collision/missing-link.

## Frozen regression contract

Cycle 07 не меняет следующие числа: V5 no-reward stages 2–7 `9000/43500/64500/102000/145200/164800 ms`, checkpoint 180000 ms = 786 taps, score 110498±1, heat 946.465417±0.01, hold 15060±10 ms; optional ×2 starts 65000 ms, stages 5/6/7 `75750/83950/102710 ms`, 944 taps, score 180220±1, heat 936.94±0.01, hold 65950±10 ms. Tap matrix stays 2 tps→4, 4→5, 5→6, 7.14→7 without reward. Audio assets/mix and platform contract stay unchanged; only lifecycle smoke is repeated.

Все Cycle 07 checks имеют `PASS` для финального clean exact candidate при успешном запуске strict evidence validator. Current decision: DONE = YES; authoritative identity и hashes публикуются в `reports/corrective-cycle-07/<exact-build-id>/`.
