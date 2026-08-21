# Art Direction — «Зажги»

## Corrective Cycle 05

Пользовательский review Cycle 05 установил final visual-polish baseline: существующий образ огня сохраняется, но authored cells должны восприниматься как непрерывно горящие языки без кадровых скачков; Ash Servant остаётся принятым; Demoness полностью пересобирается по newest user reference как спокойная властная Inferno Queen с ясным hand→flame cast и реакцией огня только после контакта.

Concept art из `visual-references/` задаёт mood, palette, fixed hearth/camera и путь darkness → Inferno. Его нельзя использовать как fullscreen screen или копировать пиксели в production. Persistent world, characters, flame layers, particles, runes, glow, smoke, overlays, HUD и transition FX остаются раздельными.

## Visual language

- Dark-fantasy / infernal-casual, 12+, без gore, nudity, sexualized pose и реальных культовых символов.
- Portrait logical canvas `1080×1920`; landscape сохраняет центральный hearth и не растягивает art.
- Палитра: soot/charcoal → ember orange → scarlet → white-gold. Rewarded state добавляет purple-gold, не подменяя normal Inferno.
- Источник света — очаг. Мир раскрывается теми же слоями, а не семью разными backplates.
- Верхний title plaque из references — layout cue; игровой текст остаётся DOM HUD.

## Seven-stage reveal

| Stage | Main reveal | Flame treatment |
|---:|---|---|
| 1 | Почти чёрный chamber, едва заметный ritual anchor | low family, маленький authored loop |
| 2 | Рунный круг и трещины начинают читаться | low family + stage flare |
| 3 | Появляется Ash Servant | low→mid crossfade, appearance→idle |
| 4 | Gate/chains/scarlet accents, Demoness silhouette | mid family + stage flare |
| 5 | Demoness раскрывается и действует | mid family, appearance/idle/cast/hold |
| 6 | Ritual circle, pylons и distant host | mid→high crossfade |
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
- `idle`: 6 authored frames at restrained 4 fps; дыхание и малые движения головы/плеч без перемещения root.
- Telegraph: `prepare → inhale-ramp → inhale-hold`; effect: `exhale-start → ramp → peak → fade → end`; recovery ≤450 ms.
- Отдельный ash stream, lateral ember drift и bend/suppression пламени используют один `exhaleStrength`, поэтому причина и эффект совпадают по кадру.

### Demoness

- Reference: `visual-references/stage-references/stage-5-demoness-reference-view.jpg`, SHA-256 закреплён в atlas metadata/provenance. Сохраняются лицо, crown/hair, infernal silhouette и soot/ember palette; костюм закрыт high-neck armor для 12+.
- V4 atlas: 28 transparent cells `192×288`: appearance 4, calm idle 4, restrained disapproval 4, cast 8, hold 4, recovery 4; root drift≤0.5 source px, edge alpha=0.
- Idle loop длится примерно 6.67 s: дыхание/плечи и вторичные hair/cloth детали едва движутся, feet/root неподвижны. Каждые 5–9 active секунд: `look at flame → restrained disapproval → one slow head shake → return`; whole-body dance/fidget запрещены.
- Telegraph: `cast-look → arms-rise → hands-to-flame → cast-gather`; effect: `cold-travel → contact → cold-hold → cold-release`; recovery ≤800 ms.
- Cold ribbon начинается у текущего authored hand socket, идёт к текущей видимой точке flame и имеет отдельные `spellReach` и `impactStrength`. Bend/height/brightness/glow/sparks огня не реагируют до contact.
- Demoness rendered bbox минимум в 1.25 раза выше Ash Servant, но не перекрывает HUD и центральный flame target.

После effect state machine возвращается в `idle` через отдельный authored recovery. Pause замораживает application clock. Персонаж не перекрывает центральный tap target и остаётся отдельным от flame/environment. Servant и Demoness могут действовать одновременно: каждый сохраняет собственный таймер, позу и FX.

### Inferno host

Host bitmap разделён metadata на пять непересекающихся пространственных регионов: left/right wings, left/right watchers и crown. У регионов разные фазы и периоды 5.5–8.9 s; whole-plate drift запрещён. Первый переход 6→7 длится 1.5 s и сочетает staged host reveal, расширение high flame, ember burst, rune wave и bounded lighting pulse. В каждом 5-секундном окне sustained Inferno видимо меняются минимум две области.

## Quality tiers

- High: native authored fps, ≤80 embers, ≤24 smoke, ≤2 pulses.
- Low: те же authored frames с ограниченными particles; static fallback запрещён.
- Off/reduced: authored poster/спокойная выборка кадров, impulse/flash и частицы сокращены, но telegraph/effect pose остаются различимы.
- Auto downgrade меняет presentation cost, но не gameplay timing.

## Visual QA rubric

PASS требует exact-build evidence:

1. За 2 s idle минимум 12 sampled frames и минимум 8 различных authored flame cells; silhouette tongues действительно меняются.
2. Каждый из шести upward boundaries и применимые downward boundaries показывает ≥3 промежуточных состояния без pop/black frame/root jump.
3. Servant и Demoness в blind test различимы в appearance/idle/attack; attack cause и влияние на flame читаются без HUD label.
4. Characters/host/HUD остаются читаемы на `360×640`, `390×844`, `768×1024`, `1366×768` и `800×360`.
5. Reduced Motion не превращает actors/flame в прежние static cards и не меняет encounter timing.
6. P05→P100 сохраняет сильный последовательный reveal; Inferno не выжигает HUD и silhouettes.

## Remaining risk

Автоматические atlas/state/pause/preload tests проверяют механику, но не доказывают субъективную плавность. Cycle 05 v4 использует новые просторные source strips и mechanical alpha/root repack; ранние baked-matte candidates не входят в repo. Первый `390×844` Human-Eye pass уже перенёс effect cards из зоны рук/пламени вниз и усилил 0.8 s hand→flame ribbon после blind finding о слабой читаемости траектории. Открытые риски до exact sign-off: perceptual ghosting при blend далёких hand poses и близость worst decoded residency `62.60 MiB` к hard limit `64 MiB`; production-browser normal/0.25× evidence и независимый regression остаются обязательными.
