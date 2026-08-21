# QA Plan — «Зажги», corrective cycle 06 character polish

Case IDs этого документа квалифицируются как `QA:<ID>`, acceptance IDs — как `AC:<ID>`. Cycle 06 проверяет silent adaptive quality, Ash Servant/Demoness authored motion and attack causality, alpha edges, Inferno-host life и bounded clip residency. Gameplay, reward, platform, flame/environment design и audio не переоткрываются; они проходят fingerprint regression на неизменность.

DONE разрешён только для одного clean exact build после ровно трёх проходов. Evidence Cycle 02–05 не может дать PASS новым Cycle 06 условиям. Single still, contact sheet, headless renderer и координатное равенство без просмотра browser render не доказывают temporal/semantic quality.

## Неподвижные правила Cycle 06

- Принятые identity/key poses, size, placement и gameplay phases Ash Servant сохраняются; bytes/frame count меняются для genuine in-betweens, clean alpha, stable no-flicker motion и scarlet mouth snowflakes.
- Сохраняются текущие bitmap form, palette, glow, sparks, embers, lighting и progression flame. Нельзя заменять flame геометрическим/SVG/CSS/programmer-art вариантом или скрывать pop чрезмерным blur.
- Demoness сохраняет newest-reference identity, но получает high-resolution source, more unique authored frames, blue conical ice shards и evaporation/steam. Legacy cold ribbon запрещён.
- Gameplay balance, V5 fixtures, direct-tap/reward rules и audio assets/mix не меняются. Для audio достаточно fingerprint equality и lifecycle smoke; несовпадение fingerprint открывает отдельный audio review и не маскируется Cycle 06.
- Flicker, full-pose double exposure, white matte, blur from upscale>1.25×, morph, teleport, static host, ribbon residue, spell miss, steam before contact или fire reaction before contact — binary FAIL независимо от формальных метрик.

## Среды и identity

| ID | Среда | Обязательное использование |
|---|---|---|
| ENV-P1 | Production Chromium exact `dist/`, 1366×768, mouse | Normal/slow flame, Demoness full cycles, Human-Eye baseline |
| ENV-P2 | Production Chromium exact `dist/`, 390×844 touch emulation | Mobile composition, targeting, full-cycle regression |
| ENV-P3 | Production Chromium exact `dist/`, 800×360 touch emulation | Landscape clipping/targeting regression |
| ENV-R1 | Firefox stable, 1366×768 | Pass 3 cross-browser temporal regression |
| ENV-R2 | Safari stable, 390×844 DPR2 | Pass 3 cross-browser layout/temporal regression |
| ENV-Y1/Y2 | Yandex test console desktop/mobile | Existing platform lifecycle regression; не источник Cycle 06 visual truth |

Каждая browser запись хранит Build ID, full commit, source/asset/reference fingerprints, browser/version, OS, viewport, DPR, input type, monotonic capture timestamps, heat/stage и console log. Directory name обязан равняться exact clean Build ID `0.1.0+<12 hex>`; `working.*` запрещён.

## Ровно три QA-прохода

### Pass 1 — Implementation validation

Владелец — implementation owner; этот pass не является независимым sign-off.

1. На clean checkout выполнить текущие `typecheck`, `lint`, full tests, asset/animation audits, build, static browser smoke и release audit; exit code 0, skipped 0.
2. Зафиксировать `assets-manifest.json`: retained-key-pose lineage, Demoness reference SHA/provenance, каждый unique authored frame hash, dimensions, root/mouth/hand sockets, partial-alpha edge metrics, clip preload/release group и decoded bytes.
3. Снять из production browser flame low/mid/high/Inferno в normal playback и 0.25× slow playback, continuous-heat ramp и все upward/downward stage crossings. Автор устраняет любой обнаруженный pop, seam, hard swap, double/ghost flame и particle teleport до Pass 2.
4. Снять Servant appearance/idle/inhale/blow/recovery и Demoness idle/disapproval/full `hands→ice travel→contact→steam→fire reaction→recovery`. Проверить уникальность кадров, landmark continuity, no-flicker/no-matte, sockets и actual flame target.
5. Прогнать quality-controller matrix `30/40/60/120 Hz`, startup spikes, sustained render cost, hidden/resume и forced tiers; auto-quality toast count `0`.
6. Прогнать overlap/Inferno-entry clip-residency lifecycle и frozen gameplay/audio regression. Изменение gameplay или audio запрещает handoff.

### Pass 2 — Independent blind Human-Eye QA

Владелец — независимый QA/reviewer, не писавший production animation и не получивший список исправлений до первичных наблюдений.

1. Запустить exact production build и просмотреть при 1×/0.25× минимум три полных Servant attacks, Demoness idle≥20 s, три disapproval/full casts, Inferno entry и ≥15 s sustained host motion.
2. Первичный blind set имеет случайный порядок/opaque clip IDs; HUD labels, debug overlays, state names и подсказки filename скрыты. Reviewer сначала записывает, что происходит, кто воздействует на какой объект и в каком порядке, затем получает diagnostic overlay для измерений.
3. Без текста reviewer обязан однозначно распознать: Servant выдыхает изо рта алые снежинки в огонь; Demoness направляет синие конусообразные льдины из рук в огонь; при contact лёд испаряется в пар и только затем реагирует fire.
4. Reviewer отдельно сравнивает newest reference с idle/cast/recovery frames по face, silhouette, costume, proportions и details; любое изменение identity между соседними states — FAIL.
5. Первичные observations, ответы без labels, timestamps/frames и severity сохраняются до раскрытия fix summary. Critical/High возвращают build implementer; повторный Pass 2 выполняется на новом exact Build ID.

### Pass 3 — Full regression and sign-off

Владелец — regression QA, отличный от implementation owner и Pass 2 reviewer.

1. Пройти `Тьма→Искра→Пепельный страж→Алый порог→Демонесса→Круг Инферно→Инферно` мышью и touch-emulation; проверить upward/downward transitions, pause/background/resume, reduced motion, restart/reload и optional reward без изменения balance.
2. Повторить Servant, Demoness ice/contact/steam и Inferno host на ENV-P2/P3 и минимум одном ENV-R; выполнить edge review на black/dark-red/neutral backgrounds, normal/reduced/forced-low tiers.
3. Выполнить 10-minute Stage 7/overlap performance and instantaneous residency trace, exact audio lifecycle smoke и frozen gameplay/platform suite.
4. Исполнить `node scripts/validate-corrective-cycle-06-evidence.mjs reports/corrective-cycle-06/<exact-build-id>`; open Critical=0, High=0, все применимые AC PASS, все evidence hashes/identity совпадают.

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

### Ash Servant Cycle 06

- Retained semantic key poses сохраняют identity/palette/scale/placement; exact timing соответствует core phases. Между каждой соседней retained key-pose pair есть ≥1 unique authored in-between; duplicate hash, permutation и reverse playback не засчитываются.
- Root drift≤2 logical px; flicker, ghost/double contour, luminance pop, clipping/wrap/teleport=0 при 1×/0.25× и pause/resume.
- Snowflake origin-to-current rendered mouth socket≤8 logical px, endpoint-to-current visible flame≤12 px. Scarlet snowflakes существуют только в blow/recovery tail; emitter bounded и очищается.

### Demoness

- Reference manifest содержит newest user-reference path/SHA-256/provenance и feature checklist: face, crown/hair, silhouette, costume, palette, proportions, scale dominance. Каждый пункт должен быть PASS у Pass 2 и Pass 3.
- Character bbox height≥1.25× Ash Servant, не перекрывает critical flame/UI; feet/root drift≤2 logical px, unintended scale drift≤2%, fragment/clipping/teleport/sliding=0.
- Effective upscale≤1.25× на каждом required viewport/DPR; face/crown/hands не мягче Servant по edge/detail comparison. Unique pixel hashes подтверждают authored in-betweens; duplicate/permutation/reverse не засчитываются.
- Calm idle capture≥20 s: ≥3 breathing periods, subtle chest/shoulder/torso motion и secondary hair/cloth/detail motion; rapid periodic whole-body sway, bustle, twitch и dance/club-like loop=0.
- Disapproval capture содержит ≥3 полных `look-at-fire→slow gaze shift→frown→pause→one restrained head shake→return-to-fire` cycles. Gesture медленный, не двигает whole body и не прерывает active cast.
- Control sequence содержит минимум 19 semantic samples: `idle-breath-1`, `idle-breath-2`, `look-fire`, `disapproval`, `head-start`, `head-mid`, `head-end`, `prepare-1`, `prepare-2`, `arms-halfway`, `hands-to-flame`, `cold-start`, `cold-mid`, `cold-full`, `contact`, `fire-reacts`, `cast-ending`, `recovery`, `idle-return`. Между `idle→cast` и `cast→recovery` — ≥8 distinct intermediate sampled poses; adjacent identity/costume/morph discontinuities=0.
- Conical shard origin находится у текущих rendered hand sockets (distance≤12 logical px), oriented trajectory converges на actual visible flame, endpoint error≤12 px; legacy Bézier ribbon pixels/path=0.
- `contactMs` — первый frame пересечения shard с actual visible flame mask. Steam before contact=0; evaporation/steam starts in `[contactMs, contactMs+100 ms]`, rises/fades to zero. Fire reaction before contact=0 and settles during recovery.

### Alpha edges, host and quality/residency

- Partial-alpha silhouettes композятся на black, dark-red and neutral backgrounds. Visible white halo, chroma spill, opaque rectangular residue and sticker edge count=0 for Servant, Demoness and host; Human-Eye veto overrides a passing numeric border scan.
- Accepted 1.5 s Inferno entry duration/composition matches baseline. In every rolling 5 s after entry, ≥2 independently phased authored internal regions visibly move; whole-plate/crop drift, seam and loop pop=0.
- Auto quality: 30/40/60/120 Hz refresh-only fixtures, warm-up spikes and hidden/resume produce downgrade count=0; sustained over-budget render cost over ≥2 windows produces one bounded downgrade with reason telemetry and user-facing toast count=0.
- Instant decoded residency target≤56 MiB, hard≤64 MiB in startup/first attacks/overlap/Inferno/pause-resume. Active draw release=0, missing-frame flash=0, decode/upload spike>50 ms after preload=0, leaked handles and monotonic growth=0.

## Human-Eye Semantic rubric

Reviewer видит opaque IDs и rendered motion без UI/debug/state labels. До раскрытия diagnostics он отвечает бинарно:

| ID | Вопрос | PASS |
|---|---|---|
| HE-01 | Кто и на что воздействует? | Servant выдыхает алые снежинки изо рта в огонь; Demoness бросает синие льдины из рук в центральное пламя |
| HE-02 | Каков порядок причины и эффекта? | mouth/hands→snow/ice travel→contact→evaporation/steam→fire reaction; иной порядок = FAIL |
| HE-03 | Как читается idle/disapproval? | спокойная властная угроза и сдержанное неодобрение; dance/fuss/twitch/comedy отсутствуют |
| HE-04 | Стабилен ли персонаж? | лицо, костюм, силуэт и пропорции распознаются как одна героиня во всех key states; morph/fragment=0 |
| HE-05 | Плавны и живы ли characters? | flicker/morph/double contour/white matte/static host не замечены ни на 1×, ни на 0.25× |

Pass 2 обязан PASS по всем пяти строкам с first-observation text и timestamp/frame links. Формальные координаты не могут превратить Human-Eye FAIL в PASS.

## Exact evidence layout

```text
reports/corrective-cycle-06/index.json
reports/corrective-cycle-06/<exact-build-id>/
  manifest.json
  README.md
  pass-1-implementation/
    automation.log
    assets-manifest.json
    servant-continuity.json
    flame-temporal.json
    demoness-continuity.json
    ice-contact-steam.json
    alpha-edge-audit.json
    quality-controller.json
    clip-residency.json
    gameplay-audio-fingerprint-regression.json
  pass-2-independent-blind/
    browser/manifest.json
    browser/frames/<scenario-id>/*.png
    metrics/{flame.json,transitions.json,demoness.json,spell-contact.json,performance.json}
    blind-review.json
    defects.json
  pass-3-regression/
    full-cycle.json
    cross-browser.json
    audio-lifecycle.json
    regression.json
    signoff.json
```

`browser/manifest.json` содержит scenarios: `servant-appearance/idle/blow/recovery × normal/slow`, `demoness-idle/disapproval/cast/ice-contact-steam × normal/slow`, `character-edges × 3 backgrounds`, `inferno-entry/host-sustain`, `quality-refresh/startup/hidden/load`, `residency-overlap/inferno/pause`. Все evidence files перечислены с bytes/SHA-256; unlisted/missing/tampered/stale files запрещены.

Validator hard-fails missing/stale/corrupt evidence, wrong pass count/order/owners, stale build/reference/source fingerprints, non-genuine PNG, incomplete flame matrix, отсутствующие 19 Demoness states, missing blind semantics, pre-contact fire reaction, spell miss, open Critical/High или любой final decision не `PASS`. Fixture tests обязаны покрывать good/missing/stale/corrupt.

## Frozen regression contract

Cycle 06 не меняет следующие числа: V5 no-reward stages 2–7 `9000/43500/64500/102000/145200/164800 ms`, checkpoint 180000 ms = 786 taps, score 110498±1, heat 946.465417±0.01, hold 15060±10 ms; optional ×2 starts 65000 ms, stages 5/6/7 `75750/83950/102710 ms`, 944 taps, score 180220±1, heat 936.94±0.01, hold 65950±10 ms. Tap matrix stays 2 tps→4, 4→5, 5→6, 7.14→7 without reward. Audio assets/mix stay unchanged; only lifecycle smoke is repeated.

Все новые Cycle 06 checks имеют `NOT RUN` до exact-build evidence. Current decision: DONE = NO.
