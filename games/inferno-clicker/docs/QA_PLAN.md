# QA Plan — «Зажги», corrective cycle 05 visual polish

Case IDs этого документа квалифицируются как `QA:<ID>`, acceptance IDs — как `AC:<ID>`. Cycle 05 проверяет только качество flame/Demoness animation и отсутствие regression у принятого Ash Servant. Gameplay, reward, platform и audio contracts не переоткрываются и не меняются; они проходят соседнюю regression на неизменность.

DONE разрешён только для одного clean exact build после ровно трёх проходов. Evidence Cycle 02–04 не может дать PASS новым Cycle 05 условиям и помечается `SUPERSEDED` для flame temporal polish, новой Demoness, spatial targeting и Human-Eye Semantic QA. Single still, contact sheet, headless renderer и координатное равенство без просмотра browser render не являются temporal/semantic evidence.

## Неподвижные правила Cycle 05

- Принятый Ash Servant сохраняется: внешний вид, размер, placement, фазы и причинно-следственная реакция не перерабатываются. Допустим только доказанный технический fix clipping/frame glitch без смены образа.
- Сохраняются текущие bitmap form, palette, glow, sparks, embers, lighting и progression flame. Нельзя заменять flame геометрическим/SVG/CSS/programmer-art вариантом или скрывать pop чрезмерным blur.
- Demoness полностью пересобирается по новейшему пользовательскому reference. Reference SHA-256 и provenance фиксируются до review; лицо, силуэт, костюм, пропорции и характер должны быть стабильны между кадрами.
- Gameplay balance, V5 fixtures, direct-tap/reward rules и audio assets/mix не меняются. Для audio достаточно fingerprint equality и нового lifecycle smoke; несовпадение fingerprint открывает отдельный audio review и не маскируется Cycle 05.
- Видимый pop, hard image swap, morph, teleport, dance-like movement, spell miss либо реакция fire до контакта — бинарный FAIL независимо от формально зелёных метрик.

## Среды и identity

| ID | Среда | Обязательное использование |
|---|---|---|
| ENV-P1 | Production Chromium exact `dist/`, 1366×768, mouse | Normal/slow flame, Demoness full cycles, Human-Eye baseline |
| ENV-P2 | Production Chromium exact `dist/`, 390×844 touch emulation | Mobile composition, targeting, full-cycle regression |
| ENV-P3 | Production Chromium exact `dist/`, 800×360 touch emulation | Landscape clipping/targeting regression |
| ENV-R1 | Firefox stable, 1366×768 | Pass 3 cross-browser temporal regression |
| ENV-R2 | Safari stable, 390×844 DPR2 | Pass 3 cross-browser layout/temporal regression |
| ENV-Y1/Y2 | Yandex test console desktop/mobile | Existing platform lifecycle regression; не источник Cycle 05 visual truth |

Каждая browser запись хранит Build ID, full commit, source/asset/reference fingerprints, browser/version, OS, viewport, DPR, input type, monotonic capture timestamps, heat/stage и console log. Directory name обязан равняться exact clean Build ID `0.1.0+<12 hex>`; `working.*` запрещён.

## Ровно три QA-прохода

### Pass 1 — Implementation validation

Владелец — implementation owner; этот pass не является независимым sign-off.

1. На clean checkout выполнить текущие `typecheck`, `lint`, full tests, asset/animation audits, build, static browser smoke и release audit; exit code 0, skipped 0.
2. Зафиксировать `assets-manifest.json`: baseline/current fingerprints Ash Servant, flame design lineage, Demoness reference SHA/provenance, каждый authored/interpolated state, dimensions/anchor/hand sockets и decoded memory.
3. Снять из production browser flame low/mid/high/Inferno в normal playback и 0.25× slow playback, continuous-heat ramp и все upward/downward stage crossings. Автор устраняет любой обнаруженный pop, seam, hard swap, double/ghost flame и particle teleport до Pass 2.
4. Снять Demoness idle, disapproval и полный `idle→notice→prepare→arms-rise→hands-to-flame→cold-contact→fire-reaction→release→recovery→idle`. Проверить continuity landmarks, stable feet/root/scale, reference features, hand sockets и actual visible flame target.
5. Выполнить Ash Servant exact fingerprint/temporal regression и frozen gameplay/audio regression. Изменение gameplay или audio запрещает handoff без отдельного согласования.

### Pass 2 — Independent blind Human-Eye QA

Владелец — независимый QA/reviewer, не писавший production animation и не получивший список исправлений до первичных наблюдений.

1. Запустить exact production build и самостоятельно просмотреть несколько полных loops flame каждого уровня при 1× и 0.25×, continuous heat ramp, все stage crossings, Demoness idle ≥20 s, минимум три disapproval и минимум три full casts.
2. Первичный blind set имеет случайный порядок/opaque clip IDs; HUD labels, debug overlays, state names и подсказки filename скрыты. Reviewer сначала записывает, что происходит, кто воздействует на какой объект и в каком порядке, затем получает diagnostic overlay для измерений.
3. Без текста reviewer обязан однозначно распознать: Demoness замечает рост fire, выражает медленное неодобрение, направляет руки/взгляд/cold stream к фактическому flame, effect касается flame, и только затем fire пригибается/тускнеет/теряет sparks. Любая другая цель, «танец», суета, morph или реакция до контакта — FAIL.
4. Reviewer отдельно сравнивает newest reference с idle/cast/recovery frames по face, silhouette, costume, proportions и details; любое изменение identity между соседними states — FAIL.
5. Первичные observations, ответы без labels, timestamps/frames и severity сохраняются до раскрытия fix summary. Critical/High возвращают build implementer; повторный Pass 2 выполняется на новом exact Build ID.

### Pass 3 — Full regression and sign-off

Владелец — regression QA, отличный от implementation owner и Pass 2 reviewer.

1. Пройти `Тьма→Искра→Пепельный страж→Алый порог→Демонесса→Круг Инферно→Инферно` мышью и touch-emulation; проверить upward/downward transitions, pause/background/resume, reduced motion, restart/reload и optional reward без изменения balance.
2. Повторить flame low/mid/high/Inferno normal+slow, Ash Servant, Demoness idle/disapproval/cast/contact/recovery на ENV-P2/P3 и минимум одном ENV-R. Проверить UI/flame/characters на clipping и target clearance.
3. Выполнить mobile-emulated Stage 7 performance/residency, exact audio lifecycle smoke и frozen gameplay/platform suite. Реальные физические devices/Yandex публикация остаются release-platform evidence, а не подменяют Cycle 05 browser gate.
4. Исполнить `node scripts/validate-visual-polish-evidence.mjs reports/visual-polish/<exact-build-id>`; open Critical=0, High=0, все применимые AC PASS, все evidence hashes/identity совпадают.

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

### Ash Servant carry-forward

`servantBaselineFingerprint === servantCurrentFingerprint`, visual/temporal contract unchanged, root drift≤2 logical px, edge alpha/wrap/clipping/teleport=0. Если байты менялись только ради frame/clipping fix, required signed diff перечисляет изменённые files/pixels, сохраняет reference and timing fingerprints, а Pass 2/3 повторяют полную appearance/idle/attack/recovery regression; redesign или semantic timing change запрещены.

### Demoness

- Reference manifest содержит newest user-reference path/SHA-256/provenance и feature checklist: face, crown/hair, silhouette, costume, palette, proportions, scale dominance. Каждый пункт должен быть PASS у Pass 2 и Pass 3.
- Character bbox height≥1.25× Ash Servant, не перекрывает critical flame/UI; feet/root drift≤2 logical px, unintended scale drift≤2%, fragment/clipping/teleport/sliding=0.
- Calm idle capture≥20 s: ≥3 breathing periods, subtle chest/shoulder/torso motion и secondary hair/cloth/detail motion; rapid periodic whole-body sway, bustle, twitch и dance/club-like loop=0.
- Disapproval capture содержит ≥3 полных `look-at-fire→slow gaze shift→frown→pause→one restrained head shake→return-to-fire` cycles. Gesture медленный, не двигает whole body и не прерывает active cast.
- Control sequence содержит минимум 19 semantic samples: `idle-breath-1`, `idle-breath-2`, `look-fire`, `disapproval`, `head-start`, `head-mid`, `head-end`, `prepare-1`, `prepare-2`, `arms-halfway`, `hands-to-flame`, `cold-start`, `cold-mid`, `cold-full`, `contact`, `fire-reacts`, `cast-ending`, `recovery`, `idle-return`. Между `idle→cast` и `cast→recovery` — ≥8 distinct intermediate sampled poses; adjacent identity/costume/morph discontinuities=0.
- Spell origin находится у текущих rendered hand sockets (distance≤12 logical px). Trajectory/gaze/palms/body converge на текущую видимую flame alpha/bbox, а не на fixed hearth coordinate; endpoint-to-visible-flame distance≤12 logical px во всех mobile/desktop samples.
- `contactMs` — первый frame пересечения leading cold effect с actual visible flame mask. Fire bend/scale/brightness/glow/spark response до contact = 0; первая реакция наступает в `[contactMs, contactMs+100 ms]`, достигает peak после contact и полностью settles during recovery.

## Human-Eye Semantic rubric

Reviewer видит opaque IDs и rendered motion без UI/debug/state labels. До раскрытия diagnostics он отвечает бинарно:

| ID | Вопрос | PASS |
|---|---|---|
| HE-01 | Кто и на что воздействует? | «Demoness/женский персонаж пытается охладить или потушить центральное пламя»; иная/неясная цель = FAIL |
| HE-02 | Каков порядок причины и эффекта? | руки/взгляд→cold effect→контакт с flame→реакция flame; иной порядок = FAIL |
| HE-03 | Как читается idle/disapproval? | спокойная властная угроза и сдержанное неодобрение; dance/fuss/twitch/comedy отсутствуют |
| HE-04 | Стабилен ли персонаж? | лицо, костюм, силуэт и пропорции распознаются как одна героиня во всех key states; morph/fragment=0 |
| HE-05 | Плавен ли flame? | pop/seam/hard picture swap/ghost frame не замечены ни на 1×, ни на 0.25× |

Pass 2 обязан PASS по всем пяти строкам с first-observation text и timestamp/frame links. Формальные координаты не могут превратить Human-Eye FAIL в PASS.

## Exact evidence layout

```text
reports/visual-polish/index.json
reports/visual-polish/<exact-build-id>/
  manifest.json
  README.md
  pass-1-implementation/
    automation.log
    assets-manifest.json
    servant-regression.json
    flame-temporal.json
    demoness-continuity.json
    spell-contact.json
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

`browser/manifest.json` содержит scenarios: flame `low/mid/high/inferno × normal/slow`, `continuous-heat`, `transitions-up`, `transitions-down`, `servant-regression`, `demoness-idle`, `demoness-disapproval`, `demoness-full-cast`, `demoness-spell-contact`, `demoness-fire-reaction`. Все actual evidence files, кроме root manifest, перечислены с bytes/SHA-256; unlisted/missing/tampered/stale files запрещены.

Validator hard-fails missing/stale/corrupt evidence, wrong pass count/order/owners, stale build/reference/source fingerprints, non-genuine PNG, incomplete flame matrix, отсутствующие 19 Demoness states, missing blind semantics, pre-contact fire reaction, spell miss, open Critical/High или любой final decision не `PASS`. Fixture tests обязаны покрывать good/missing/stale/corrupt.

## Frozen regression contract

Cycle 05 не меняет следующие числа: V5 no-reward stages 2–7 `9000/43500/64500/102000/145200/164800 ms`, checkpoint 180000 ms = 786 taps, score 110498±1, heat 946.465417±0.01, hold 15060±10 ms; optional ×2 starts 65000 ms, stages 5/6/7 `75750/83950/102710 ms`, 944 taps, score 180220±1, heat 936.94±0.01, hold 65950±10 ms. Tap matrix stays 2 tps→4, 4→5, 5→6, 7.14→7 without reward. Audio assets/mix stay unchanged; only lifecycle smoke is new.

Все новые Cycle 05 checks имеют `NOT RUN` до exact-build evidence. Current decision: DONE = NO.
