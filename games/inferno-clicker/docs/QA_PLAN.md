# QA Plan — «Зажги», corrective cycle 08 alpha, clarity and scale correction

Case IDs этого документа квалифицируются как `QA:<ID>`, acceptance IDs — как `AC:<ID>`. Cycle 08 проверяет чистый внешний и внутренний alpha Ash Servant/Demoness, native sharp Demoness redraw, точное увеличение draw box `420×700 → 504×840`, visible-height dominance `≥1.25×` и строгую issue→fix→independent-retest→neighboring-regression traceability. Принятые C07 motion, scale stability, mouth/two-palm steam, host, quality и residency contracts сохраняются как baseline. Gameplay, reward, platform, flame/environment design и audio не переоткрываются; они проходят fingerprint regression на неизменность.

DONE разрешён только для одной финальной clean exact build после полного ordered C08 workflow. C07 evidence остаётся историческим baseline и не может дать PASS новым C08 условиям. Single still, contact sheet, headless renderer, номинальный draw-box размер или авторское self-review не доказывают отсутствие matte во внутренних просветах, фактическую чёткость или visible-bbox dominance.

## Неподвижные правила Cycle 08

- Принятые C07 identity/key poses, logical placement, stable anatomy, gameplay phases и mouth steam Ash Servant сохраняются; меняются только pixels/metadata, необходимые для genuine exterior/internal-gap alpha. Unintended anatomical scale drift≤2%, root drift≤2 logical px; white matte/fringe/islands=0.
- Сохраняются текущие bitmap form, palette, glow, sparks, embers, lighting и progression flame. Нельзя заменять flame геометрическим/SVG/CSS/programmer-art вариантом или скрывать pop чрезмерным blur.
- Demoness сохраняет newest-reference identity/poses/steam semantics, но перерисовывается в native-or-higher resolution с exact `512×832` RGBA cells и genuine alpha; апскейл C07 raster запрещён. Общий runtime draw box ровно `504×840` вместо `420×700`, feet/root anchor стабилен, visible bbox height во всех states/viewports `≥1.25×` Servant.
- Gameplay balance, V5 fixtures, direct-tap/reward rules, platform contract и audio assets/mix не меняются. Для audio достаточно fingerprint equality и lifecycle smoke; несовпадение fingerprint открывает отдельный review и не маскируется Cycle 08.
- Внешний halo, белый partial-alpha RGB, opaque white island во внутреннем просвете, sticker edge, удалённый настоящий highlight, upscaled-old-raster softness, неверный draw size, ratio<1.25, blur/morph/fragment или C07 motion/socket regression — binary FAIL независимо от формальных метрик.

## Среды и identity

| ID | Среда | Обязательное использование |
|---|---|---|
| ENV-P1 | Production Chromium exact `dist/`, 1366×768, mouse | Normal/slow flame, Demoness full cycles, Human-Eye baseline |
| ENV-P2 | Production Chromium exact `dist/`, 390×844 touch emulation | Mobile composition, targeting, full-cycle regression |
| ENV-P3 | Production Chromium exact `dist/`, 800×360 touch emulation | Landscape clipping/targeting regression |
| ENV-R1 | Firefox stable, 1366×768 | Gate 6 cross-browser temporal regression |
| ENV-R2 | Safari stable, 390×844 DPR2 | Gate 6 cross-browser layout/temporal regression |
| ENV-Y1/Y2 | Yandex test console desktop/mobile | Existing platform lifecycle regression; не источник Cycle 08 visual truth |

Каждая browser запись хранит Build ID, full commit, source/asset/reference fingerprints, browser/version, OS, viewport, DPR, input type, monotonic capture timestamps, heat/stage и console log. Directory name обязан равняться exact clean Build ID `<package-semver>+<12 hex>` (для текущего candidate — `0.1.1+<12 hex>`); `working.*` запрещён. Managed production-browser C08 capture обязан покрыть `2 characters × 2 playback speeds × 4 viewports` минимум при одном фактически измеренном DPR; отдельная exact-render matrix и runtime transform/upscale audit обязаны покрыть каждый из DPR1/DPR2. Это разделение явно фиксирует, что DPR2-строки не выдаются за browser screenshots, если управляемый browser session работает при DPR1.

## Ordered Cycle 08 QA workflow

### Gate 1 — Implementation validation

Владелец — implementation owner; этот pass не является независимым sign-off.

1. На clean checkout выполнить обязательные `npm run lint`, `npm run typecheck`, `npm test`, `npm run assets:audit`, `npm run animation:audit`, `npm run fingerprint:audit:cycle08`, `npm run build`, `npm run test:e2e`, `npm run release:audit`; exit code 0, skipped 0. Повторная build/release-audit пара дополнительно доказывает воспроизводимость manifest.
2. Зафиксировать `assets-manifest.json`: accepted C07 baseline hashes, Demoness reference SHA/provenance, raw native source dimensions, `sourceToAtlasUpscale≤1.0`, exact v6/v7 inventory, `512×832` cells and `504×840` draw size, unique frame hashes, visible alpha bboxes, root/mouth/leftHand/rightHand/anatomical landmarks, exterior/internal-gap/partial-alpha metrics, preload/release group and decoded bytes. Отдельное evidence подтверждает, что C08 Demoness не получена апскейлом C07 raster.
3. Снять из production browser flame low/mid/high/Inferno в normal playback и 0.25× slow playback, continuous-heat ramp и все upward/downward stage crossings. Автор устраняет любой обнаруженный pop, seam, hard swap, double/ghost flame и particle teleport до Gate 2.
4. Снять continuous motion Servant appearance/idle/inhale/blow/recovery и Demoness appearance/idle/disapproval/cast/hold/recovery при 1×/0.25×. Для каждого кадра получить black/dark-red/neutral-gray composites; проверить внешние края, локти, руки/корпус, волосы/рога, подол/ноги, sharp detail, exact draw size, visible-height ratio, roots и current-frame sockets.
5. Прогнать quality-controller matrix `30/40/60/120 Hz`, startup spikes, sustained render cost, hidden/resume и forced tiers; auto-quality toast count `0`.
6. Прогнать overlap/Inferno-entry clip-residency lifecycle и frozen gameplay/audio regression. Изменение gameplay или audio запрещает handoff.

### Gate 2 — QA issue capture

Владелец — QA/reviewer, не писавший production animation и не получивший fix summary до первичных наблюдений.

1. Запустить exact production build и просмотреть при 1×/0.25× минимум три полных Servant attacks, Demoness idle≥20 s, три disapproval/full casts, Inferno entry и ≥15 s sustained host motion. Raw continuous capture≥30 FPS обязателен.
2. Первичный blind set имеет случайный порядок/opaque clip IDs; HUD labels, debug overlays, state names и подсказки filename скрыты. Reviewer сначала записывает, что происходит, кто воздействует на какой объект и в каком порядке, затем получает diagnostic overlay для измерений.
3. Без текста reviewer обязан однозначно распознать: Servant выдыхает пар изо рта в огонь; Demoness направляет пар из обеих ладоней в огонь. Snow/ice interpretation, источник в рогах, только одна рука или detached effect = FAIL.
4. Reviewer отдельно сравнивает newest reference и C07 identity baseline с C08 idle/cast/recovery по face, crown/hair, silhouette, costume, proportions and details, затем проверяет наружный контур и каждый внутренний просвет на трёх фонах. Identity change, blur or matte residue = FAIL.
5. Каждый независимый дефект записывается отдельным issue со schema `id/severity/environment/build/steps/expected/actual/motionEvidence/timestampFrameLinks/acceptanceIds/owner/status`. Обязательные chain IDs: `C08-01-servant-white-matte`, `C08-02-servant-internal-residue`, `C08-03-demoness-white-matte`, `C08-04-demoness-sharpness-scale`. Outer fringe, internal-gap residue, erased highlight, insufficient redraw clarity, wrong `504×840` geometry и ratio<1.25 нельзя объединять за пределами этой утверждённой декомпозиции.

### Gate 3 — Developer fix

Developer получает issue, исправляет source/assets/tests на новом exact Build ID и связывает `issueId`, changed paths и verification commands. Автор исправления не меняет QA observation, severity или status на PASS и не выполняет окончательный retest.

### Gate 4 — Independent targeted retest and neighboring regression

1. Retest owner отличается от fix owner. Он сначала повторяет исходные steps и полный affected motion на новой build при 1×/0.25×, не читая fix summary до записи first-observation text.
2. Для Servant neighboring regression включает все frames appearance/idle/inhale/blow/recovery на трёх фонах, mouth socket, pause/resume, reduced/forced-low и concurrent Demoness event. Для Demoness — все frames appearance/idle/disapproval/cast/hold/recovery, `512×832` cells, `504×840` draw box, visible-height ratio, обе ладони, all required viewports/DPR, pause/resume, reduced/forced-low и concurrent Servant event.
3. Retest связывает original issue, fix Build ID, continuous motion, timestamped frames, binary measurements и результат. Любой FAIL возвращается Developer как новая revision того же issue; старый candidate отзывается.

### Gate 5 — Independent blind Human-Eye sign-off

Независимый reviewer, отличный от fix и retest owners, просматривает случайно упорядоченные opaque clips финального candidate. Он подтверждает HE-01..HE-05 до раскрытия diagnostics/fix notes. First-observation text, clip timestamps and frame links обязательны; still-only evidence отклоняется.

### Gate 6 — Full regression and sign-off

Владелец — regression QA, отличный от implementation owner и Gate 5 reviewer.

1. Пройти `Тьма→Искра→Пепельный страж→Алый порог→Демонесса→Круг Инферно→Инферно` мышью и touch-emulation; проверить upward/downward transitions, pause/background/resume, reduced motion, restart/reload и optional reward без изменения balance.
2. Повторить Servant mouth-steam, Demoness both-palm steam и Inferno host на ENV-P2/P3 и минимум одном ENV-R; выполнить C08 exterior/internal-gap alpha, native sharpness, exact draw-size and bbox-ratio review на black/dark-red/neutral-gray backgrounds, normal/reduced/forced-low tiers.
3. Выполнить 10-minute Stage 7/overlap performance and instantaneous residency trace, exact audio lifecycle smoke и frozen gameplay/platform suite.
4. Исполнить `npm run evidence:cycle08 -- reports/corrective-cycle-08/<exact-build-id>`; open Critical=0, High=0, все применимые AC PASS, все evidence hashes/identity и issue→fix→retest→regression links совпадают. Validator реализован и имеет negative fixtures; release status остаётся `NOT RUN`, пока он не завершится с code 0 на финальном clean exact build.

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

### Ash Servant — C07 behavior with C08 alpha cleanup

- Retained semantic key poses сохраняют identity/palette/scale/placement; exact timing соответствует core phases. Между каждой соседней retained key-pose pair есть ≥1 unique authored in-between; duplicate hash, permutation и reverse playback не засчитываются.
- Root drift≤2 logical px. Нормализованные head/eye/torso landmark distances относительно root дают unintended scale drift≤2% во всех appearance/idle/inhale/blow/recovery frames и после каждого required viewport transform. Flicker, ghost/double contour, shrink/pulse, luminance pop, clipping/wrap/teleport=0 при 1×/0.25× и pause/resume.
- Steam origin-to-current rendered mouth socket≤8 logical px, endpoint-to-current visible flame≤12 px. Пар существует только в blow/recovery tail; emitter bounded, pause-safe и очищается. Active snowflake renderer/assets/pixels=0; horn-origin reading=0.
- Для каждого production frame проверяются внешний контур и все enclosed transparent components. В сгибах локтей, между руками и корпусом, около рогов/волос, одежды и ног visible white residue=0; C07 logical draw size, accepted scale and placement не меняются.

### Demoness

- Reference manifest содержит newest user-reference path/SHA-256/provenance и feature checklist: face, crown/hair, silhouette, costume, palette, proportions, scale dominance. Каждый пункт должен быть PASS у Gates 4, 5 и 6.
- Source master dimensions are native-or-higher and every packed cell is exactly `512×832` RGBA. Every frame and clip maximum records `sourceToAtlasUpscale≤1.0`; this source→atlas gate is separate from runtime effective-upscale≤1.25×. Provenance and hashes prove the frames were redrawn from the approved reference, not produced by resizing C07 atlas bytes. Exterior and internal-gap genuine alpha passes all three-background composites.
- Runtime draw box is exactly `504×840` in every state, versus C07 `420×700`; width and height delta are each `+20%`. Feet/root grows primarily upward and drifts≤2 logical px; critical flame/UI overlap, fragment/clipping/teleport/sliding=0.
- Visible rendered alpha-bbox height≥1.25× the corresponding Ash Servant bbox for every state and required viewport/DPR; the minimum ratio over the whole matrix is reported. Nominal draw-box comparison alone is insufficient.
- Effective upscale≤1.25× on the same matrix, computed through exact runtime `sceneTransform` and DPR; face/crown/hair/hands не мягче Servant по edge/detail comparison. Filter-radius budget записан в evidence; blur/morph/double-hand=0. Unique pixel hashes подтверждают authored in-betweens; duplicate/permutation/reverse не засчитываются.
- Calm idle capture≥20 s: ≥3 breathing periods, subtle chest/shoulder/torso motion и secondary hair/cloth/detail motion; rapid periodic whole-body sway, bustle, twitch и dance/club-like loop=0.
- Disapproval capture содержит ≥3 полных `look-at-fire→slow gaze shift→frown→pause→one restrained head shake→return-to-fire` cycles. Gesture медленный, не двигает whole body и не прерывает active cast.
- Control sequence содержит минимум 19 semantic samples: `idle-breath-1`, `idle-breath-2`, `look-fire`, `disapproval`, `head-start`, `head-mid`, `head-end`, `prepare-1`, `prepare-2`, `arms-halfway`, `hands-to-flame`, `steam-start`, `steam-mid`, `steam-full`, `flame-reaction`, `steam-hold`, `cast-ending`, `recovery`, `idle-return`. Между `idle→cast` и `cast→recovery` — ≥8 distinct intermediate sampled poses; adjacent identity/costume/morph discontinuities=0.
- Два независимых steam origins находятся у текущих rendered `leftHand` и `rightHand` palm sockets (каждый distance≤12 logical px), trajectories converge на actual visible flame, endpoint error≤12 px. При видимости обеих ладоней active source count=2; one-hand/combined/detached source=0.
- Active conical shard/icicle/snowflake/legacy Bézier ribbon renderer, asset, path and pixels=0. Steam появляется и развивается по existing presentation phase, rises/fades to zero, а ее travel/collision не изменяет core effect schedule. Pause/cancel/teardown lifecycle errors=0.

### Alpha edges, host and quality/residency

- Every Servant/Demoness frame is composited on black, dark-red and neutral-gray. Approved source-mask SHA-256 must equal decoded WebP alpha SHA-256 with changed pixels/max error/low-alpha leak count all `0`; Servant detached partial-alpha block/tile pixels are `0`. Audit separately labels exterior contour, partial-alpha band and enclosed negative spaces; visible white halo, low-chroma white fringe, opaque rectangular residue, internal white island and sticker edge count=0. Legitimate opaque pale skin/eyes/metal/highlights remain present. Human-Eye veto overrides a passing numeric scan.
- Accepted 1.5 s Inferno entry duration/composition matches baseline. In every rolling 5 s after entry, ≥2 independently phased authored internal regions visibly move; whole-plate/crop drift, seam and loop pop=0.
- Auto quality: 30/40/60/120 Hz refresh-only fixtures, warm-up spikes and hidden/resume produce downgrade count=0; sustained over-budget render cost over ≥2 windows produces one bounded downgrade with reason telemetry and user-facing toast count=0.
- Instant decoded residency target≤56 MiB, hard≤64 MiB in startup/first attacks/overlap/Inferno/pause-resume. Demoness uses exactly one full atlas plus one bounded `512×832` handoff frame-cache counted in the total; full-atlas overlap=0. Active draw release=0, missing-frame flash=0, decode/upload spike>50 ms=0, leaked handles and monotonic growth=0.

## Human-Eye Semantic rubric

Reviewer видит opaque IDs и rendered motion без UI/debug/state labels. До раскрытия diagnostics он отвечает бинарно:

| ID | Вопрос | PASS |
|---|---|---|
| HE-01 | Кто и на что воздействует? | Servant выдыхает пар изо рта в огонь; Demoness направляет пар из обеих ладоней в центральное пламя |
| HE-02 | Откуда выходит эффект? | current mouth и две current palms; horns, one combined hand point, detached source, snow или ice = FAIL |
| HE-03 | Как читается idle/disapproval? | спокойная властная угроза и сдержанное неодобрение; dance/fuss/twitch/comedy отсутствуют |
| HE-04 | Стабилен ли персонаж? | лицо, костюм, силуэт и пропорции распознаются как одна героиня во всех key states; morph/fragment=0 |
| HE-05 | Чисты, стабильны и резки ли characters? | На внешних краях и во внутренних просветах Servant/Demoness нет white matte; Demoness чёткая, больше C07 ровно на 20% по обеим осям и видимо выше Servant; shrink/morph/double contour отсутствуют на 1×/0.25× |

Gate 5 обязан PASS по всем пяти строкам с first-observation text и timestamp/frame links на continuous motion. Формальные координаты не могут превратить Human-Eye FAIL в PASS.

## Exact evidence layout

```text
reports/corrective-cycle-08/index.json
reports/corrective-cycle-08/<exact-build-id>/
  summary.json              # schema/cycle/status/build identity, owners, pass mapping and complete file inventory
  automation.json           # exact required commands and test counts
  assets.json               # eight atlases, alpha/source/geometry/upscale/residency metrics
  visual.json               # all-frame counts, findings, 2×3×4×2 exact-render matrix and managed-browser captures
  issues.json               # four required issue→fix→retest→neighboring-regression chains
  independent.json          # blind independent observations and verdict
  regression.json           # required neighboring/full-regression scenarios and final counts
  acceptance.json           # 15 explicit PASS records, each bound to inventoried path/bytes/SHA-256
  visual/render-manifest.json # immutable SHA-bound input reviewed before final evidence generation
  visual/motion/*.webp      # four genuine 96-page normal/slow review animations
  visual/browser/*.png      # production-browser subject/speed/viewport matrix
  visual/*.png              # inventoried black/dark-red/neutral-gray viewport/DPR captures
  issues/*.png              # inventoried original and independent-retest evidence
```

`summary.json.passes` указывает семь pass-файлов (`automation/assets/visual/issues/independent/regression/acceptance`), а `summary.json.files` перечисляет bytes/SHA-256 каждого файла, кроме самого summary. `visual.json` покрывает `Ash Servant/Demoness × black/dark-red/neutral-gray × 390×844/768×1024/1366×768/800×360 × DPR1/2`; managed-browser evidence отдельно покрывает оба characters, normal/slow и четыре viewports, а genuine animated WebP связывает по три полных 32-frame cycles с exact 100/400 ms timing. Unlisted/missing/tampered/stale files запрещены.

Validator hard-fails missing/stale/corrupt evidence, wrong gate order/owners, same fix/retest owner, stale build/reference/source fingerprints, upscaled-C07 Demoness source, wrong cell/draw dimensions, missing state/frame/background/internal-gap coverage, visible matte veto, erased-highlight veto, Demoness/Servant ratio<1.25, effective upscale>1.25×, clipping/critical overlap, blur/morph, C07 socket/motion regression, open Critical/High или любой final decision не `PASS`. Fixture tests cover at least good/missing/stale/corrupt/wrong-dimensions/missing-internal-gap/matte-veto/upscaled-source/ratio-fail/owner-collision/missing-link.

## Frozen regression contract

Cycle 08 не меняет принятые C07 числа: V5 no-reward stages 2–7 `9000/43500/64500/102000/145200/164800 ms`, checkpoint 180000 ms = 786 taps, score 110498±1, heat 946.465417±0.01, hold 15060±10 ms; optional ×2 starts 65000 ms, stages 5/6/7 `75750/83950/102710 ms`, 944 taps, score 180220±1, heat 936.94±0.01, hold 65950±10 ms. Tap matrix stays 2 tps→4, 4→5, 5→6, 7.14→7 without reward. Gameplay, audio assets/mix and platform contract stay unchanged; only paired replay/fingerprint and lifecycle regressions are repeated.

Historical Cycle 07 remains accepted for its own build. All new Cycle 08 checks are `NOT RUN`; current decision is `DONE = NO`. Authoritative C08 identity, hashes and evidence must be published in `reports/corrective-cycle-08/<exact-build-id>/` before any status changes to PASS.
