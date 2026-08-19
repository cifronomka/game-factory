# Art Direction — «Зажги»

## Corrective Cycle 02

Пользовательский review 2026-08-20 установил новый baseline: огонь должен читаться как движущиеся языки пламени, а не как деформируемая статичная карточка; смена стадий должна быть анимирована; Пепельный слуга и Демонесса угасания должны иметь появление, живой idle и отдельное тушащее действие.

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

Кадры меняют silhouette, развилки, отрывы и negative spaces. Tint/opacity/scale/glow не засчитываются как authored frame variation. Geometric flame, moving crop, slice deformation и static-card fallback запрещены. Procedural остаются только glow/light masks, embers, smoke/haze и bounded tap/seal impulses.

Tap не выбирает кадр и не ускоряет animation loop. Height/brightness impulse визуально подтверждает раздувание и ограничивается presentation cap; gameplay принимает taps независимо.

## Character animation

### Ash Servant

- `appearance`: 6 frames at 10 fps, once.
- `idle`: 6 frames at 8 fps, loop; перенос веса, дыхание, движение головы/плеч.
- `inhale`: 6 frames at 10 fps, once during telegraph.
- `blow`: 6 frames at 10 fps, loop during effect.
- Отдельный ash stream связывает mouth/action lane с outer flame.

### Demoness

- Закрытый 12+ redesign, никакой сексуализации concept pose.
- `appearance`: 6 frames at 10 fps, once.
- `idle`: 6 frames at 8 fps, loop.
- `cast`: 6 frames at 10 fps, once during telegraph.
- `hold`: 6 frames at 10 fps, loop during effect.
- Отдельная cold ribbon связывает hand/action lane с hearth.

После effect state machine возвращается в `idle`; recovery выражен последними action poses и переходом в idle, отдельного recovery asset нет. Pause замораживает application clock. Персонаж не перекрывает центральный tap target и остаётся отдельным от flame/environment.

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

Автоматические atlas/state/pause/preload tests проходят, но они не доказывают субъективную плавность. Главные открытые риски: generative identity drift между character cells, frame-to-frame flame flicker и близость worst decoded residency `61.29 MiB` к hard limit `64 MiB`. До release нужны browser motion capture, quantitative frame comparison и два независимых visual reviewer.
