# Art Direction — «Зажги»

## Yandex Release Cycle 09 — active direction

Cycle 09 наследует C08 персонажей, authored motion, alpha и scale, но переоткрывает каждый runtime frame и seven-stage composite из-за оставшихся white/neutral spots и Yandex content review. Новые bitmap не нужны для rewarded UI; CTA/goals создаются DOM/CSS. Любая ретушь выпускается новым versioned asset ID, старые bytes не перезаписываются.

Из видимой сцены удаляются руны, пентаграммы, ritual/religious marks и узнаваемая эзотерическая символика; остаётся нейтральная dark-fantasy fire chamber. Видимое имя Demoness — `Хранительница угасания / Ember Warden`, stage 6 — `Огненное кольцо / Fire Ring`. Internal filenames могут сохранить legacy ID только как невидимую техническую совместимость.

Обязательный C09 visual audit: все 64 production character frames и полный runtime stages 1–7 на black, neutral-gray и dark-red, DPR 1/2/3, normal/reduced/forced-low. White matte, low-chroma fringe, opaque/internal-gap island, detached alpha, sticker edge, crop и filter-amplified spot count=`0`; legitimate skin/eyes/metal/highlights сохраняются. Все результаты начинаются `NOT RUN` и проходят QA→fix→independent retest→neighboring regression.

## Corrective Cycle 08 — inherited baseline

Cycle 08 наследует принятую C07 identity/composition огня, Ash Servant, Demoness, steam semantics и Inferno entry. Он переопределяет C07 только для очистки alpha у Ash Servant и Demoness, фактической чёткости/масштаба Demoness и нового evidence. `CORRECTIVE_CYCLE_07.md` и его PASS остаются историей, но не доказывают C08. Gameplay, audio, platform, flame/environment, позы и тайминги не меняются.

У обоих персонажей обязателен genuine alpha: по внешнему силуэту и во всех внутренних просветах, включая сгибы локтей и промежутки между руками и корпусом, visible white matte/fringe/opaque islands/sticker edge=`0`. Approved alpha каждого кадра побитно сохраняется после WebP encode/decode; у Servant detached partial-alpha contour tiles=`0`. Сохраняются настоящие светлые детали кожи, глаз, металла и бликов; грубое удаление всех белых пикселей запрещено. Плавность по-прежнему строится на уникальных authored in-betweens: full-body мерцание, morph-crossfade, reverse-as-recovery и перестановка одинаковых кадров не считаются анимацией.

Concept art из `visual-references/` задаёт mood, palette, fixed hearth/camera и путь darkness → Inferno. Его нельзя использовать как fullscreen screen или копировать пиксели в production. Persistent world, characters, flame layers, particles, neutral fire markings, glow, smoke, overlays, HUD и transition FX остаются раздельными.

## Visual language

- Dark-fantasy / infernal-casual, 12+, без gore, nudity, sexualized pose и реальных культовых символов.
- Portrait logical canvas `1080×1920`; landscape сохраняет центральный hearth и не растягивает art.
- Палитра: soot/charcoal → ember orange → scarlet → white-gold. Rewarded state добавляет purple-gold, не подменяя normal Inferno.
- Источник света — очаг. Мир раскрывается теми же слоями, а не семью разными backplates.
- Верхний title plaque из references — layout cue; игровой текст остаётся DOM HUD.

## Seven-stage reveal

| Stage | Main reveal | Flame treatment |
|---:|---|---|
| 1 | Почти чёрный chamber, едва заметный hearth anchor без символа | low family, маленький authored loop |
| 2 | Нейтральное огненное кольцо и трещины начинают читаться | low family + stage flare |
| 3 | Появляется Ash Servant | low→mid crossfade, appearance→idle |
| 4 | Gate/chains/scarlet accents, Ember Warden silhouette | mid family + stage flare |
| 5 | Ember Warden раскрывается и действует | mid family, appearance/idle/cast/hold |
| 6 | Fire Ring, neutral pylons и distant host | mid→high crossfade |
| 7 | White-gold climax, watchers/winged host | high family with reinforced high-core pass |

Снижение stage использует тот же authored stage-flare atlas в обратном порядке с cool tint и root-locked target. Это осознанный V2 candidate contract: отдельный collapse atlas не заявляется. Каждый boundary дополнительно меняет environment reveal и glow за 0.8–1.5 s.

## Authored flame

- Low: core 8 frames + outer 8 frames, `256×512` cells, 10 fps.
- Mid: core 10 + outer 10, `320×640` cells, 10 fps.
- High: core 12 + outer 12, `256×640` cells, 11 fps.
- Core и outer имеют независимые фазовые offset и общий root pivot `(0.50,.965)`.
- Family switch crossfade: 1.05 s; вход Stage 7: 1.5 s.
- Stage flare: 8 frames, 8 fps one-shot, forward upward / reverse + cool tint downward.

Кадры меняют silhouette, развилки, отрывы и negative spaces. Tint/opacity/scale/glow не засчитываются как authored frame variation. Runtime между соседними authored cells использует complementary temporal blend с quintic timing; core/outer сохраняют независимую phase, tap не сбрасывает clocks, loop seam смешивается тем же способом. Geometric flame, moving crop, slice deformation и static-card fallback запрещены. Procedural остаются только glow/light masks, embers, smoke/haze, bounded tap/stage impulses и синхронизированная реакция на персонажей.

Tap не выбирает кадр и не ускоряет animation loop. Height/brightness impulse визуально подтверждает раздувание и ограничивается presentation cap; gameplay принимает taps независимо.

## Character animation

### Ash Servant

- `appearance`: 6 frames at 10 fps, once.
- `idle`: restrained breathing/head/shoulder loop с уникальными промежуточными poses и root drift≤2 logical px; принятые ключевые poses сохраняются.
- Telegraph: `prepare → inhale-ramp → inhale-hold`; effect: `exhale-start → ramp → peak → fade → end`; eight-frame Cycle 07 recovery lasts 800 ms.
- Recovery имеет собственные forward-authored кадры. Все poses нормализованы к одной шкале персонажа: root drift≤2 logical px, непреднамеренный scale drift головы/торса/конечностей≤2%; индивидуальный alpha-fit кадра не должен уменьшать всё тело при вытянутых руках.
- Из покадрового mouth socket выходит читаемый мягкий поток пара к текущему пламени. Начало следует фактическому рту в каждом кадре; снежинки, crystalline silhouettes и эффект из рогов запрещены. `mouth→steam→flame` и bend/suppression совпадают по presentation phase.
- C08 очищает все appearance/idle/inhale/blow/recovery frames снаружи и во внутренних negative spaces без редизайна, изменения logical placement или масштаба. Частично прозрачный edge получает RGB от ближайшего материала персонажа, поэтому bilinear filtering не проявляет белый ореол.

### Demoness

- Reference: `visual-references/stage-references/stage-5-demoness-reference-view.jpg`, SHA-256 закреплён в atlas metadata/provenance. Сохраняются лицо, crown/hair, infernal silhouette и soot/ember palette; костюм закрыт high-neck armor для 12+.
- C08 redraw выполняется из approved reference в native-or-higher resolution, а не апскейлом C07 raster. Каждый production cell планируется ровно `512×832` RGBA с genuine alpha; внешний край и внутренние просветы не содержат белой подложки/ореола. Face/crown/hair/hands должны быть не мягче Ash Servant; чрезмерный glow/drop-shadow не может маскировать недостаток resolution. Appearance, calm idle, restrained disapproval, cast, hold и recovery содержат уникальные authored in-betweens; root drift≤2 logical px, unintended scale drift≤2%, blur/morph=0.
- Idle loop длится примерно 6.67 s: дыхание/плечи и вторичные hair/cloth детали едва движутся, feet/root неподвижны. Каждые 5–9 active секунд: `look at flame → restrained disapproval → one slow head shake → return`; whole-body dance/fidget запрещены.
- Telegraph: `cast-look → arms-rise → hands-to-flame → cast-gather`; effect: `steam-start → steam-travel → steam-hold → steam-release`; recovery ≤800 ms.
- Два мягких потока пара начинаются у текущих authored `leftHand` и `rightHand` palm sockets и направляются к текущей видимой точке flame. Обе видимые ладони обязаны читаться как независимые источники; detached или single-origin effect, сосульки, conical shards и legacy ribbon запрещены. Bend/height/brightness/glow/sparks огня следуют существующей presentation phase, не Canvas collision и не particle travel.
- Единый runtime draw box Demoness меняется с `420×700` на `504×840` (`+20%` по ширине и высоте). Feet/root baseline сохраняется, рост идёт преимущественно вверх; уменьшать отдельные states запрещено. Visible rendered alpha-bbox в каждом state и viewport минимум в `1.25` раза выше Ash Servant, но не перекрывает HUD и центральный flame target.

После effect state machine возвращается в `idle` через отдельный authored recovery. Pause замораживает application clock. Персонаж не перекрывает центральный tap target и остаётся отдельным от flame/environment. Servant и Demoness могут действовать одновременно: каждый сохраняет собственный таймер, позу и FX.

### Inferno host

Принятый первый переход 6→7 длительностью 1.5 s и его композиция сохраняются. После reveal left/right wings, watchers, crown/body и вторичные фигуры имеют authored internal changes (дыхание, голова/плечи/руки/крылья/глаза) с разными фазами. В каждом rolling 5-секундном окне sustained Inferno видимо меняются минимум две области; whole-plate/crop drift не засчитывается.

## Quality tiers

- High: native authored fps, ≤80 embers, ≤24 smoke, ≤2 pulses.
- Low: те же authored frames с ограниченными particles; static fallback запрещён.
- Off/reduced: authored poster/спокойная выборка кадров, impulse/flash и частицы сокращены, но telegraph/effect pose остаются различимы.
- Auto downgrade беззвучен и не показывает toast; меняет только optional presentation cost, но не gameplay timing и не semantic attack cues.

## Visual QA rubric

PASS требует exact-build evidence:

1. За 2 s idle минимум 12 sampled frames и минимум 8 различных authored flame cells; silhouette tongues действительно меняются.
2. Каждый из шести upward boundaries и применимые downward boundaries показывает ≥3 промежуточных состояния без pop/black frame/root jump.
3. Servant и Demoness в blind test различимы в appearance/idle/attack; без HUD читаются `mouth→steam→flame` и `left palm + right palm→steam→flame`. Snow/ice interpretations и неясный источник означают FAIL.
4. Characters/host/HUD остаются читаемы на `360×640`, `390×844`, `768×1024`, `1366×768` и `800×360`.
5. Reduced Motion не превращает actors/flame в прежние static cards и не меняет encounter timing.
6. P05→P100 сохраняет сильный последовательный reveal; Inferno не выжигает HUD и silhouettes.
7. Для каждого кадра Servant/Demoness approved-mask SHA равен decoded-WebP alpha SHA; changed/max-error/low-alpha-leak=`0`. Black, dark-red и neutral-gray composites имеют `0` видимых белых внешних ореолов и внутренних matte islands; отдельно проверяются локти, руки/корпус, волосы/рога, подол и ноги.
8. Demoness source cells равны `512×832`, runtime draw box равен `504×840`, delta от C07 `420×700` составляет `+20%/+20%`, а минимальный visible-bbox ratio к Servant — `≥1.25`.

## Remaining risk

Автоматические atlas/state/pause/preload tests не доказывают качество вырезки и субъективную резкость. Главные Cycle 08 риски — сохранённый белый RGB в partial-alpha edge, пропущенные внутренние matte islands, потеря настоящих светлых деталей, апскейл старого Demoness raster вместо redraw, неверная фактическая высота и рост decoded residency. Production-browser review при 1×/0.25× на трёх контрастных фонах, exact-`sceneTransform` matrix, independent targeted retest и neighboring regression обязательны.
