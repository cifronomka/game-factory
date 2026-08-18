# Asset Plan — «Зажги»

## Назначение и статус

Это производственный реестр всех необходимых visual/audio assets для `inferno-clicker`: назначение, путь, формат, размер, ownership и budget. Художественные правила находятся в `ART_DIRECTION.md`, звуковые — в `AUDIO_DIRECTION.md`, техническая загрузка — в `TECHNICAL_ARCHITECTURE.md`.

**Статус planning stage:** финальные ассеты не созданы. Все строки ниже имеют статус `PLANNED`; смена на `IN REVIEW`/`READY` возможна только после provenance, optimization и QA. Пути указаны относительно корня игры. Source masters (`.kra`, `.psd`, `.blend`, `.wav`, DAW projects) не входят в runtime bundle и должны храниться в согласованном source-artifact storage, а не в `dist/`.

## Visual-reference audit и decomposition

Проверено `2026-08-18`:

- В локальной рабочей копии `games/inferno-clicker/visual-references/` находятся только `README.md` и `.gitkeep`.
- В remote `cifronomka/game-factory`, branch `main`, GitHub Contents API показывает семь PNG `941×1672` в `stage-references/`: файлы `22_45_07`, `22_45_14`, `22_45_23`, `22_45_28`, `22_45_33`, `22_45_40`, `22_45_46`. `characters/`, `concepts/` и `ui-mockups/` содержат только `.gitkeep`.
- Семь PNG прочитаны как concept-art последовательность стадий 1–7. Это композиционные/mood references, не production screens. Встроенные верхние плашки и надписи не экспортируются: stage title — DOM HUD, а масштабируемая рамка — отдельный 9-slice asset.
- Точный provenance в репозитории отсутствует: filenames указывают на Codex generation, но model/version, prompts, input references и подтверждение прав не записаны. Это **BLOCKER для присвоения производным изображениям статуса READY**, но не блокирует planning и procedural/placeholder implementation. До производства нужно заполнить provenance по правилам ниже.
- Локальный pipeline, которому нужны сами PNG, **BLOCKED до синхронизации remote `main` в рабочую копию**. В этом review изображения не копировались, production assets не создавались.

Reference → decomposition mapping:

| Reference | Используемое направление | Разделение на production layers | Что нельзя переносить напрямую |
|---|---|---|---|
| Stage 1 — tiny ember, почти чёрный зал | black-value hierarchy, центральный очаг, скрытая круговая площадка | far chamber; midground columns; ritual plane; foreground; flame core; glow/reveal mask | Цельный PNG, baked title, чрезмерно чёрный ember на low-brightness display |
| Stage 2 — малое пламя, проявленный круг | постепенное раскрытие камня/круга, тёплый центральный свет | те же environment layers; rune decals; flame overlay; embers; smoke | Новая несогласованная камера вместо reveal тех же слоёв |
| Stage 3 — слуга слева дует на пламя | читаемый левый character lane и направленный blow | servant sprite atlas; breath cone; ash particles; flame bend; background gate silhouette | Персонаж, запечённый в background; натуралистичный/страшный redesign |
| Stage 4 — алые врата, цепи, дальний силуэт | крупная арка, диагонали цепей, distant threat | gate layer; chain atlas; rune/crack atlas; demoness silhouette; red bounce light | Полная замена окружения, запечённый silhouette или flame |
| Stage 5 — центральная демонесса и огненные дуги | crown silhouette, властная поза, магические дуги | закрытый non-sexualized demoness sprite atlas; tendril overlay; suppression ring; flame remains independent | Исходная фотореалистичная/сексуализированная одежда и анатомия; цельная character+FX картинка |
| Stage 6 — высокий огонь, полный круг, пилоны/цепи | масштаб камеры, полный ritual circle, density peak до climax | pylon/observer atlas; chains; runes; taller flame layers; heat haze | Перегруженный единый raster; потеря тёмной HUD-периферии |
| Stage 7 — white-hot beam, lightning, winged silhouettes | power climax, вертикальный beam, дальние silhouettes | beam core/overlay; lightning/stage FX; winged silhouettes; active circle; smoke/heat haze | Бесконтрольная полноэкранная вспышка, baked text, существа/архитектура в одном фоне |

Камера и ritual-circle anchor должны быть едиными между стадиями. Различия семи concept PNG адаптируются как reveal/activation независимых layers; нельзя делать семь полноэкранных stage backgrounds, иначе появятся визуальные скачки, дублированная память и невозможность анимации.

## Visual asset registry

Path указан как ожидаемый runtime URL `/assets/...`; в репозитории это тот же путь без начального `/`. `Generated image` означает новый оригинальный output по этому brief с обязательным paintover/decomposition и provenance, а не crop из concept PNG.

| ID | Asset name | Назначение | Stage | Примерный path | Формат / размер | Transparency | Animation / states | Метод производства | Статус |
|---|---|---|---|---|---|---|---|---|---|
| BG-001 | Infernal chamber — portrait | Дальний цельный тон/архитектурная масса при portrait crop | 1–7 | `/assets/backgrounds/bg-infernal-chamber-portrait.webp` | WebP lossy, `1024×2048`, ≤420 KB | Нет | Static; darkness/reveal только внешней маской | Generated image → manual paintover | PLANNED |
| BG-002 | Infernal chamber — landscape | Расширение той же камеры без stretch | 1–7 | `/assets/backgrounds/bg-infernal-chamber-landscape.webp` | WebP lossy, `1920×1080`, ≤430 KB | Нет | Static responsive alternate | Generated image → manual paintover/outpaint | PLANNED |
| BG-003 | Architecture midground | Колонны, арки и стены, раскрываемые светом | 1–7 | `/assets/backgrounds/bg-architecture-midground.webp` | WebP alpha, `896×1344`, ≤340 KB | Да | `dim/revealed`; subtle parallax | Generated image → layer extraction/paintover | PLANNED |
| BG-004 | Ritual plane | Единая площадка, круг и базовые трещины | 1–7 | `/assets/backgrounds/bg-ritual-plane.webp` | WebP alpha, `1024×1024`, ≤300 KB | Да | `hidden/dim/revealed`; fixed camera anchor | Generated image → corrected perspective paintover | PLANNED |
| BG-005 | Scarlet gate | Арка/врата и опоры стадии 4 | 4–7 | `/assets/backgrounds/bg-scarlet-gate.webp` | WebP alpha, `1024×1024`, ≤280 KB | Да | `silhouette/ember-lit/open`; light animated procedurally | Generated image → layer extraction/paintover | PLANNED |
| BG-006 | Foreground frame | Каменный край, пепел, depth framing | 1–7 | `/assets/backgrounds/bg-foreground-frame.webp` | WebP alpha, `896×1344`, ≤270 KB | Да | Static; minor parallax high/low only | Generated image → manual paintover | PLANNED |
| BG-007 | Chain atlas | Независимые диагонали/вертикали цепей | 4–7 | `/assets/backgrounds/bg-chains-atlas.webp` | WebP alpha atlas, `512×768`, ≤140 KB | Да | 6 pieces; idle sway/impact | Sprite animation from manual layers | PLANNED |
| BG-008 | Rune/crack atlas | Оригинальные glyphs и огненные трещины | 2–7 | `/assets/backgrounds/bg-runes-atlas.webp` | WebP alpha atlas, `768×768`, ≤180 KB | Да | 16 glyphs; `dim/lit/pulse`; cracks tint by heat | Manual layer atlas + procedural animation | PLANNED |
| BG-009 | Inferno pylons atlas | Пилоны/обелиски полного круга | 6–7 | `/assets/backgrounds/bg-inferno-pylons-atlas.webp` | WebP alpha atlas, `768×768`, ≤170 KB | Да | 6 pieces; `dim/lit`; reveal by stage | Generated image → layer extraction/paintover | PLANNED |
| CH-001 | Ash servant | Харизматичный слуга и телеграф порыва | 3–7, event-driven | `/assets/characters/character-ash-servant-atlas.webp` + `.json` | WebP alpha atlas, `1024×1024`, ≤420 KB | Да | `emerge/idle/inhale/blow/cancelled/retreat` | Sprite animation; generated-assisted exploration → full redraw | PLANNED |
| CH-002 | Fading demoness | Крупная угроза и Холодное клеймо | 4 silhouette; 5–7 events | `/assets/characters/character-fading-demoness-atlas.webp` + `.json` | WebP alpha atlas, `1536×1536`, ≤720 KB | Да | `silhouette/reveal/idle/cast/hold/seal-break/release` | Sprite animation; mandatory closed, non-sexualized manual redesign | PLANNED |
| CH-003 | Watchers | Дальние наблюдатели в арках | 6–7 | `/assets/characters/character-watchers-atlas.webp` | WebP alpha atlas, `1024×768`, ≤220 KB | Да | 5 silhouettes; slow idle/parallax | Generated image → silhouette extraction/manual cleanup | PLANNED |
| CH-004 | Watcher eyes | Дополнительный читаемый life signal | 6–7 | `/assets/characters/character-watcher-eyes-atlas.webp` | WebP alpha atlas, `256×128`, ≤28 KB | Да | `open/half/closed`; blink ≥4 s | Sprite animation, manual | PLANNED |
| CH-005 | Inferno winged silhouettes | Дальние крылатые формы из climax reference | 7 | `/assets/characters/character-inferno-wings-atlas.webp` | WebP alpha atlas, `768×512`, ≤120 KB | Да | 3 silhouettes; `idle/wing-shift`; no attack close-up | Generated image → silhouette extraction/manual cleanup | PLANNED |
| UI-001 | «Зажги» wordmark | Loading/title identity, не stage label | Boot/title | `/assets/ui/ui-logo-zazhgi.svg` | Optimized SVG, ≤35 KB | Да | Static / glow by CSS | Manual vector | PLANNED |
| UI-002 | Stone HUD panel/plate | Масштабируемая рамка верхней stage-плашки и кнопок | UI, 1–7 | `/assets/ui/ui-stone-panel.9.webp` | WebP alpha 9-slice, `384×384`, ≤55 KB | Да | `default/pressed/disabled`; DOM text separate | Manual/generated-assisted frame → manual 9-slice | PLANNED |
| UI-003 | HUD/gameplay glyphs | Heat, score, multiplier, time, resonance, surge, breath, heat-window, too-fast | UI, 1–7 | `/assets/ui/ui-hud-icons.svg` | SVG symbol sprite, ≤32 KB | Да | Icon states via DOM/CSS; no baked text | Manual vector sprite | PLANNED |
| UI-004 | System glyphs | Sound, info, retry, close | UI, all | `/assets/ui/ui-system-icons.svg` | SVG symbol sprite, ≤24 KB | Да | `default/focus/pressed/disabled` | Manual vector sprite | PLANNED |
| UI-005 | Debuff glyphs | Decay-up, tap-down, suppression | 3–7 events | `/assets/ui/ui-debuff-icons.svg` | SVG symbol sprite, ≤20 KB | Да | `telegraph/active/ending`; countdown in DOM | Manual vector sprite | PLANNED |
| UI-006 | Inferno seal icon | Rewarded CTA/active mode | Eligible stage 3–7 | `/assets/ui/ui-inferno-seal.svg` | Optimized SVG, ≤22 KB | Да | `cta/active/ending/unavailable`; purple-gold tint | Manual vector | PLANNED |
| UI-007 | Focus ring | Keyboard/focus-visible accessibility | UI, all | `/assets/ui/ui-focus-ring.svg` | Optimized SVG, ≤4 KB | Да | `focus-visible` | Manual vector | PLANNED |
| FX-001 | Shared noise tile | Flame warp, smoke drift, heat haze | 1–7 | `/assets/effects/fx-noise-tile.webp` | WebP lossless, `256×256`, ≤36 KB | Нет | Tiled; moving UV | Procedural generated texture, fixed seed | PLANNED |
| FX-002 | Particle shape atlas | Ember, spark, ash, smoke, soft glow primitives | 1–7/events | `/assets/effects/fx-particles-atlas.webp` | WebP alpha atlas, `256×256`, ≤28 KB | Да | Runtime transform/color/lifetime | Procedural bake + sprite particles | PLANNED |
| FX-003 | Flame fallback silhouette | Static low/off-quality readable core | 1–7 | `/assets/effects/fx-flame-fallback.svg` | Optimized SVG, ≤12 KB | Да | 7 size/color presets, no loop | Manual vector fallback | PLANNED |
| FX-004 | Suppression ring source | Холодное клеймо и debuff outline | 5–7 events | `/assets/effects/fx-suppression-ring.svg` | Optimized SVG, ≤16 KB | Да | 6 segments; `telegraph/broken/active/end` | Manual vector + procedural transform | PLANNED |
| FX-005 | Reward seal arc source | Фиолетово-золотой rewarded mode | Eligible stage 3–7 | `/assets/effects/fx-boost-seal-arcs.svg` | SVG symbol sprite, ≤18 KB | Да | 3 arcs; `start/active/last-3s/end` | Manual vector + procedural transform | PLANNED |
| FL-001 | Flame core | Бело-жёлтое ядро: основной scale/heat indicator | 1–7 | `/assets/effects/flame-core.json` | JSON params + PixiJS Graphics/SDF, ≤4 KB | Runtime alpha | Continuous heat; 7 stage presets; `normal/surge/rewarded/suppressed` | Procedural | PLANNED |
| FL-002 | Flame overlay/tongues | Оранжево-алые языки, живость поверх ядра | 2–7 | `/assets/effects/flame-overlay.json` | JSON params + FX-001 noise, ≤4 KB | Runtime alpha | 3–5 lobes; heat/decay bend; high/low/off | Procedural | PLANNED |
| FL-003 | Embers | Рост энергии, trails и rewarded tint | 1–7 | `/assets/effects/flame-embers.json` | JSON params + FX-002 sprites, ≤4 KB | Да | 1–80 particles; `normal/surge/rewarded/stage-burst` | Procedural sprite particles | PLANNED |
| FL-004 | Glow/reveal light | Освещение и постепенное открытие environment layers | 1–7 | `/assets/effects/flame-glow.json` | JSON params + render texture/CSS fallback, ≤4 KB | Да | Radius/intensity from heat; `warm/cold/rewarded` | Procedural render mask | PLANNED |
| FL-005 | Smoke + heat haze | Дым, пепел и distortion без изменения gameplay | 2–7 | `/assets/effects/flame-smoke-heat-haze.json` | JSON params + FX-001/002, ≤5 KB | Да | `smoke/ash/haze`; haze 6–7; high/low/off | Procedural particles + shader | PLANNED |
| FL-006 | Tap burst / cadence feedback | Мгновенный принятый tap; нейтрально отличает reduced cadence и reject | 1–7 | `/assets/effects/flame-tap-burst.json` | JSON params + FX-002, ≤5 KB | Да | `full`: flame flash+1–3 sparks; `reduced`: neutral ash ring при cadenceFactor<1; `rejected`: small gray ripple, throttled | Procedural particles/rings | PLANNED |
| FL-007 | Stage transition FX | Не запечённые вспышки/руны для каждой стадии | 2–7 entries/down | `/assets/effects/flame-stage-fx.json` | JSON params + FX-002/BG-008, ≤6 KB | Да | `stage-up-2…7/stage-down/inferno-enter`; max flash 3 Hz | Procedural particles/light | PLANNED |
| FL-008 | Inferno beam/lightning | White-hot vertical climax из stage-7 reference | 7 | `/assets/effects/flame-inferno-beam.json` | JSON params + procedural SDF/lines, ≤5 KB | Да | `enter/hold/fall`; reduced-motion static beam | Procedural | PLANNED |
| FL-009 | Gameplay rings | Resonance, surge, breath, enemy counters, heat window | 3–7 events | `/assets/effects/gameplay-rings.json` | JSON params + SVG sources, ≤8 KB | Да | `resonance-1…4/surge/breath/servant-4/demoness-6/heat-window` | Procedural vector animation | PLANNED |
| MAN-001 | Asset manifest | Paths, hashes, bytes, dimensions, provenance and stage groups | Build/runtime | `/assets/assets-manifest.json` | JSON UTF-8, ≤24 KB | N/A | Critical/lazy groups; content hashes | Build-generated metadata | PLANNED |

`*.json` frame metadata для `CH-001` и `CH-002` располагается рядом с atlas, входит в budget MAN-001 и проверяется на overlap/bleed. Для WebP alpha: padding `4 px`, extrusion `2 px`, integer pixel coordinates. Runtime JSON assets FL-001…009 описывают параметры и не содержат gameplay constants: duration/count/timing получает presentation из core events.

## Audio asset registry

Каждый логический audio asset поставляется парой с одинаковым basename: primary `assets/audio/<name>.opus`, fallback `assets/audio/<name>.mp3`. Runtime выбирает один format pack через capability check и не загружает оба. Лимит в таблице — суммарный размер Opus+MP3 пары; duration совпадает между форматами.

| ID | Назначение | Path basename | Формат | Длительность / лимит пары | Channels | Variants / загрузка | Источник | Владелец | Статус |
|---|---|---|---|---|---|---|---|---|---|
| MU-001 | Базовый dark bed | `assets/audio/music-dark-bed.{opus,mp3}` | Opus 72 kbps + MP3 96 kbps | `20.000 s`, ≤ 430 KB | Stereo | Seamless stem; critical after first gesture | Original composition | Audio Agent | PLANNED |
| MU-002 | Low pulse | `assets/audio/music-low-pulse.{opus,mp3}` | Opus 64 + MP3 96 kbps | `20.000 s`, ≤ 410 KB | Stereo | Stem; preload after interactive | Original composition | Audio Agent | PLANNED |
| MU-003 | Percussion | `assets/audio/music-percussion.{opus,mp3}` | Opus 64 + MP3 96 kbps | `20.000 s`, ≤ 410 KB | Stereo | Stem; preload near stage 3 | Original composition | Audio Agent | PLANNED |
| MU-004 | Infernal tonal layer | `assets/audio/music-infernal-tone.{opus,mp3}` | Opus 72 + MP3 96 kbps | `20.000 s`, ≤ 430 KB | Stereo | Stem; preload near stage 4 | Original composition | Audio Agent | PLANNED |
| MU-005 | Inferno climax layer | `assets/audio/music-inferno-climax.{opus,mp3}` | Opus 72 + MP3 96 kbps | `20.000 s`, ≤ 430 KB | Stereo | Stem; preload near stage 6 | Original composition | Audio Agent | PLANNED |
| MU-006 | Rewarded shimmer layer | `assets/audio/music-boost-shimmer.{opus,mp3}` | Opus 56 + MP3 80 kbps | `20.000 s`, ≤ 350 KB | Stereo | Phase-aligned stem; preload on CTA availability | Original composition | Audio Agent | PLANNED |
| AM-001 | Room ambience | `assets/audio/amb-dark-room.{opus,mp3}` | Opus 48 + MP3 64 kbps | `30 s`, ≤ 440 KB | Stereo | Seamless; after first gesture | Original recording/synthesis | Audio Agent | PLANNED |
| AM-002 | Fire crackle A | `assets/audio/amb-fire-crackle-a.{opus,mp3}` | Opus 40 + MP3 64 kbps | `10 s`, ≤ 150 KB | Mono | Seamless; critical after gesture | Licensed/recorded + edited | Audio Agent | PLANNED |
| AM-003 | Fire crackle B | `assets/audio/amb-fire-crackle-b.{opus,mp3}` | Opus 40 + MP3 64 kbps | `10 s`, ≤ 150 KB | Mono | Seamless; stage 4 lazy | Licensed/recorded + edited | Audio Agent | PLANNED |
| AM-004 | Chain room accents bank | `assets/audio/amb-chain-room-bank.{opus,mp3}` | Opus 48 + MP3 64 kbps | ≤ `18 s`, ≤ 280 KB | Mono | 4 cues via manifest; stage 4 lazy | Licensed/recorded + edited | Audio Agent | PLANNED |
| AM-005 | Wordless whisper texture | `assets/audio/amb-whispers-texture.{opus,mp3}` | Opus 48 + MP3 64 kbps | `20 s`, ≤ 300 KB | Stereo | Seamless; stage 6 lazy | Original synthesis, no speech sample | Audio Agent | PLANNED |
| SF-001 | Normal tap bank | `assets/audio/sfx-tap-bank.{opus,mp3}` | Opus 48 + MP3 64 kbps | 6×`0.09–0.16 s`, ≤ 60 KB | Mono | 6 cues; critical decoded pool | Original synthesis/foley | Audio Agent | PLANNED |
| SF-002 | Critical tap bank | `assets/audio/sfx-critical-bank.{opus,mp3}` | Opus 56 + MP3 80 kbps | 3×`0.22–0.35 s`, ≤ 60 KB | Mono | 3 cues | Original synthesis/foley | Audio Agent | PLANNED |
| SF-003 | Resonance/rhythm bank | `assets/audio/sfx-rhythm-bank.{opus,mp3}` | Opus 48 + MP3 64 kbps | 6 cues, total ≤ `2.5 s`, ≤ 85 KB | Mono | Resonance 1/2/3/4, surge, breath | Original synthesis | Audio Agent | PLANNED |
| SF-004 | Seven stage-up cues | `assets/audio/sfx-stage-up-bank.{opus,mp3}` | Opus 64 + MP3 96 kbps | 7×`0.7–1.4 s`, ≤ 230 KB | Stereo | One cue per stage | Original composition/sound design | Audio Agent | PLANNED |
| SF-005 | Stage-down bank | `assets/audio/sfx-stage-down-bank.{opus,mp3}` | Opus 48 + MP3 64 kbps | 2×`0.5–0.8 s`, ≤ 65 KB | Mono | 2 shuffle variants | Original sound design | Audio Agent | PLANNED |
| SF-006 | Ash servant bank | `assets/audio/sfx-ash-servant-bank.{opus,mp3}` | Opus 56 + MP3 80 kbps | 7 cues, total ≤ `6 s`, ≤ 150 KB | Mono | emerge×2, blow×3, cancelled×2 | Original synthesis/foley; no stock voice | Audio Agent | PLANNED |
| SF-007 | Demoness bank | `assets/audio/sfx-demoness-bank.{opus,mp3}` | Opus 64 + MP3 96 kbps | 4 cues, total ≤ `6 s`, ≤ 175 KB | Stereo | reveal×1, cast×2, seal-break×1 | Original synthesis; no speech | Audio Agent | PLANNED |
| SF-008 | Active debuff loop | `assets/audio/sfx-debuff-active.{opus,mp3}` | Opus 40 + MP3 64 kbps | `6 s`, ≤ 100 KB | Mono | Seamless, one instance | Original synthesis | Audio Agent | PLANNED |
| SF-009 | Debuff end bank | `assets/audio/sfx-debuff-end-bank.{opus,mp3}` | Opus 48 + MP3 64 kbps | 2×`0.4–0.7 s`, ≤ 55 KB | Mono | 2 shuffle variants | Original synthesis | Audio Agent | PLANNED |
| SF-010 | Inferno enter | `assets/audio/sfx-inferno-enter.{opus,mp3}` | Opus 64 + MP3 96 kbps | `1.8 s`, ≤ 75 KB | Stereo | Unique cue | Original composition/sound design | Audio Agent | PLANNED |
| SF-011 | Rewarded CTA | `assets/audio/sfx-reward-cta.{opus,mp3}` | Opus 48 + MP3 64 kbps | `0.45 s`, ≤ 30 KB | Mono | Optional focus/hover cue | Original synthesis | Audio Agent | PLANNED |
| SF-012 | Reward confirmed/start | `assets/audio/sfx-boost-start.{opus,mp3}` | Opus 64 + MP3 96 kbps | `1.3 s`, ≤ 65 KB | Stereo | Confirmed callback only | Original composition/sound design | Audio Agent | PLANNED |
| SF-013 | Reward ending countdown | `assets/audio/sfx-boost-ending.{opus,mp3}` | Opus 48 + MP3 64 kbps | `3.0 s`, ≤ 60 KB | Mono | 3 tick sequence | Original synthesis | Audio Agent | PLANNED |
| SF-014 | Reward ended | `assets/audio/sfx-boost-end.{opus,mp3}` | Opus 48 + MP3 64 kbps | `0.7 s`, ≤ 35 KB | Mono | Neutral release | Original synthesis | Audio Agent | PLANNED |
| SF-015 | UI controls bank | `assets/audio/sfx-ui-bank.{opus,mp3}` | Opus 40 + MP3 64 kbps | 3 cues, total ≤ `0.8 s`, ≤ 35 KB | Mono | press×2, disabled×1 | Original foley | Audio Agent | PLANNED |
| SF-016 | Personal best | `assets/audio/sfx-personal-best.{opus,mp3}` | Opus 56 + MP3 80 kbps | `1.1 s`, ≤ 50 KB | Stereo | One per session | Original composition | Audio Agent | PLANNED |
| SF-017 | Heat-window cues | `assets/audio/sfx-heat-window-bank.{opus,mp3}` | Opus 56 + MP3 80 kbps | 2 cues, total ≤ `2.4 s`, ≤ 75 KB | Stereo | Telegraph + active | Original synthesis | Audio Agent | PLANNED |
| AUD-MAN-001 | Cue offsets, loop samples, gain, codec paths | `assets/audio/audio-manifest.json` | JSON UTF-8 | ≤ 24 KB | N/A | All audio; critical preload | Manual/generated by build | Audio Agent + Developer | PLANNED |

Audio bank cues имеют `40 ms` silence pad между regions, individual start/end offsets и zero-crossing trim в `audio-manifest.json`. Lossy encoder delay учитывается тестом sample alignment; если MP3 gapless metadata нестабильна в target browser, fallback loop играет через Web Audio decoded buffer и ручные sample points.

## Процедурные assets и runtime cost

Следующие элементы не имеют отдельного финального изображения и создаются runtime. Их параметры живут в data/config, а не в gameplay RNG:

| ID | Registry link / элемент | Алгоритм / параметры | Seed policy | High / low quality budget |
|---|---|---|---|---|
| PROC-01 | FL-001/002 — flame core + overlay | 3–5 layered bezier/SDF lobes, noise-warp из FX-001, gradient core→edge | `hash(sessionVisualSeed, "flame", frameBucket)`; deterministic QA override | High: ≤5 lobes/0.75×; low: 3/0.5×; off: SVG fallback |
| PROC-02 | FL-003 — embers/sparks | Object pool, ballistic motion, drag, age-based alpha/size; shapes из FX-002 | `hash(sessionVisualSeed, emitterId, spawnIndex)` | High/low/off: 80/28/0 live particles |
| PROC-03 | FL-005 — smoke/ash | Pooled quads, curl-like drift from tiled noise, no full-res blur | То же, отдельный emitter stream | High/low/off: 24/8/0 live particles |
| PROC-04 | FL-004 — dynamic light reveal | Radial/elliptic mask driven by heat and stageProgress; multiply/screen compositing | N/A, deterministic formula | High: 0.75× mask; low: 0.5×; off: CSS gradient |
| PROC-05 | Rune pulse | Per-glyph sine opacity/scale with stage offsets | Fixed glyph index offsets | High/low/off: 16/8/8 glyphs; off uses static opacity |
| PROC-06 | Servant blow | Directed ash cone + flame bend scalar | Event id + spawn index | High/low/off: 24/10/0 particles; off uses static ring |
| PROC-07 | Suppression ring | SVG FX-004 transform + cold radial mask | N/A | High: ring+mask; low/off: static ring |
| PROC-08 | Rewarded seal | Three SVG arcs rotating at distinct bounded speeds + golden ember tint | N/A | High: 3 arcs+particles; low: 3 arcs; off: static seal |
| PROC-09 | FL-005 — heat distortion | Quarter-resolution displacement from FX-001, stage 6–7 only | Fixed time function; no RNG | High: 0.25× buffer; low/off: disabled |
| PROC-10 | FL-007/008 — stage burst, beam, lightning | Short radial sparks/rune impulse; SDF beam and bounded line arcs | Stage transition id | High/low/off: 32/12/0 particles; off uses DOM label + static beam |
| PROC-11 | FL-009 — resonance/surge/breath ring | Four segments, expansion and contraction driven by exact core state/time | N/A | High/low: transformed vector segments; off: DOM icon/state text |
| PROC-12 | FL-009 — enemy tap counters | 4/6 breakable ring segments driven only by accepted tap events | Encounter id + segment index | All tiers: fixed segments; particles only high/low |
| PROC-13 | FL-009 — heat-window ring | `0.75 s` gather → `1.50 s` expansion from core event clock | Event id | High: glow+particles; low: ring; off: DOM icon/countdown |
| PROC-14 | FL-006 — cadence/tap feedback | Accepted tap with factor `1` uses full flame burst; factor `<1` uses neutral ash ring scaled by factor; rejected 9th+ input uses small gray ripple at most once per `500 ms` | Accepted/rejected input event id; no local rate calculation | Full/reduced/rejected states remain distinct on high/low/off; off uses DOM/CSS ring |

FL-006 не пересчитывает cadence самостоятельно: presentation получает итоговый `cadenceFactor` из core. Зафиксированная curve для скользящего окна — `1 / 1 / 1 / 0.70 / 0.45 / 0.25 / 0.15 / 0.10`; input 9+ rejected. Neutral ash ring подтверждает принятие reduced tap, но не имитирует полный heat/score burst.

Cosmetic seeds никогда не читают и не изменяют core gameplay state и не вводят gameplay PRNG. Simulation должна быть frame-rate independent; automated visual tests фиксируют `sessionVisualSeed` и animation time. При `prefers-reduced-motion: reduce` PROC-02/03 сокращаются минимум на 60%, PROC-09 отключается, PROC-04/07/08 остаются статическими indicators.

## Generated-assisted assets и provenance

Generated-assisted разрешён только для BG-001/002/003/004/005/006/009 и ранних silhouette explorations CH-001/002/003/005. Финальные characters обязаны пройти полный manual redraw/paintover, anatomy/content review и atlas decomposition; модельный output и семь stage-reference PNG нельзя использовать как цельный экран.

До статуса `IN REVIEW` для каждого asset в `assets/assets-manifest.json` фиксируются:

- author/tool/model/version и дата генерации или имя художника;
- prompt/brief hash и список входных references;
- лицензия и подтверждение права использования каждого input/reference;
- manual edits и ответственный reviewer;
- content checks: no gore, blood, eroticization, brand/IP imitation, real extremist/religious symbols;
- source hash, optimized export hash и связь source→export.

Нельзя просить имитировать конкретного живого художника, использовать чужой branded character/IP или reference с неизвестными правами. Если provenance отсутствует, asset остаётся `BLOCKED` и не попадает в production manifest.

## Naming convention и export rules

- Lowercase kebab-case ASCII: `<category>-<subject>-<state>-<variant>.<ext>`; display title «Зажги» не используется в filename.
- Semantic variants кодируются suffix (`-portrait`, `-landscape`, `-a`, `-b`); версия не кодируется в имени, versioning выполняет Git/manifest hash.
- Атласы имеют парный JSON с тем же basename; audio format pairs — одинаковый basename и одинаковые cue/loop IDs.
- Цветовые raster assets экспортируются в sRGB, без embedded thumbnails/EXIF; прозрачность — straight alpha; SVG очищается от scripts, external URLs, metadata и embedded raster, если это не согласовано.
- Runtime paths принадлежат только `assets/backgrounds/`, `assets/characters/`, `assets/effects/`, `assets/ui/`, `assets/audio/` и корневому `assets/assets-manifest.json`.

## Loading groups

| Группа | Состав | Когда загружать | Failure fallback |
|---|---|---|---|
| `critical-visual` | BG-001 или BG-002, BG-003/004/008, UI-002…007, FX-001…003, FL-001…009 configs | До interactive; responsive background только один | CSS dark gradient, SVG flame fallback, system text/icons |
| `critical-audio` | SF-001, SF-003, AM-002 и MU-001 выбранного codec pack | SF-001/SF-003 network preload до interactive и decode после gesture; AM-002/MU-001 грузятся после gesture, не блокируя interactive | Silent play; audio-locked/mute state, retry on next gesture |
| `stage-3` | CH-001, SF-006 | При progress текущей stage 2 ≥ 60% | Силуэт/простая procedural ash cue |
| `stage-4` | BG-005, BG-007, AM-003/004, MU-003 | При progress текущей stage 3 ≥ 60% | Existing architecture + procedural chains cue |
| `stage-5` | CH-002, MU-004, SF-007/008/009 | При progress текущей stage 4 ≥ 60% | Demoness silhouette + cold ring, no mechanic loss |
| `stage-6` | BG-009, CH-003/004, MU-005, AM-005, SF-017 | При progress текущей stage 5 ≥ 60% | Static dark silhouettes; music remains previous layers |
| `stage-7` | CH-005 | При progress текущей stage 6 ≥ 60% | Existing watchers silhouettes; FL-008 static beam remains available |
| `rewarded` | UI-006, FX-005, MU-006, SF-011…014 | Когда rewarded capability и CTA доступны | Text/icon-only CTA; reward mechanics still exact |

Asset failure не меняет heat, score, decay, reward или enemy timing. Loader логирует один structured warning на asset ID, применяет fallback и не делает retry-loop чаще двух попыток за сессию.

## Budget summary

| Budget | Target | Hard limit | Метод проверки до READY |
|---|---:|---:|---|
| Critical-first-load art | ≤ `1.8 MB` | `2.0 MB` | Sum selected responsive critical group after production compression |
| Total art transfer | ≤ `4.0 MB` | `5.0 MB` | Manifest sum of image/SVG exports; portrait+landscape total |
| Decoded textures at once | ≤ `48 MB` | `64 MB` | `Σ(width×height×4)` only resident stage/current-orientation assets + browser profile |
| Critical selected-codec audio | ≤ `350 KB` | `500 KB` | MU-001 + AM-002 + SF-001 + SF-003 for chosen codec only |
| Total selected-codec audio | ≤ `2.2 MB` | `2.8 MB` | Sum only `.opus` or only `.mp3` runtime-selected pack |
| Total stored audio, both codecs | ≤ `4.5 MB` | `5.6 MB` | Sum `.opus` + `.mp3` in release |
| Total game asset transfer, one session to stage 7 | ≤ `6.5 MB` | `8.0 MB` | Network log with one background orientation and one audio codec |
| Initial JS/CSS/assets payload | ≤ `2.7 MB` target | `3.0 MB` | Cold-load transfer before interactive; includes code, styles, selected responsive critical art and selected-codec SF-001/SF-003 banks; audio не воспроизводится до gesture |
| Full release package | ≤ `13 MB` target | `15 MB` | Uncompressed file-size sum inside production ZIP |
| Atlas/texture dimension | ≤ `1536 px` | `2048 px` | Decode metadata audit |
| Concurrent visual FX | High: 80 ember + 24 smoke + 2 ripples; low: 28+8+1; off: 0 particles | 120 total particles | Runtime counters at stage 7 + boost + debuff for `high/low/off` |
| Concurrent audio voices | Typical ≤ 10 | Hard cap 16 | Web Audio instrumentation under 20 taps/s stress |

В начале implementation Developer должен реализовать `npm run assets:audit` (или эквивалентный project script), который читает оба manifest, проверяет существование/path case, дубликаты IDs, declared/actual dimensions, file size, codec pairs, forbidden extensions/external SVG references и budget totals; команда должна завершаться non-zero при hard-limit violation. Дополнительно production QA выполняет:

```text
1. clean build → manifest/hash audit;
2. cold-load network capture на portrait и landscape;
3. decoded-memory profile на стадии 7 с boost и debuff;
4. audio loop/click, LUFS/true-peak и 20 taps/s polyphony stress;
5. missing-asset simulation для каждой loading group;
6. provenance/content/crop/contrast/reduced-motion review.
```

## Ownership, handoff и риски

- Art Agent владеет BG/CH/UI/FX production и visual provenance; Audio Agent — MU/AM/SF, loop/loudness и audio provenance; Developer владеет manifest loader/audit; QA независимо присваивает READY evidence.
- **Pre-implementation blocker:** семь remote stage PNG отсутствуют локально; перед любым reference-driven production шагом нужно синхронизировать `visual-references/stage-references/` из `main` и проверить SHA. Planning не блокируется этим расхождением.
- **M4–M7/READY blocker:** для семи reference PNG нет полного provenance record. Это не блокирует headless M1–M3, но до устранения они используются только как mood/composition reference, не как source pixels и не как основание для production exports.
- Cross-doc correction: stage-5 concept полезен по crown silhouette и магическим дугам, но конфликтует с `PRODUCT_SPEC.md`/`ART_DIRECTION.md` по 12+, фотореализму и сексуализации. CH-002 требует закрытого non-sexualized redesign; reference не переопределяет content rules.
- Риск: одновременная резидентность всех крупных слоёв превышает target decoded memory. Loader обязан выгружать alternate orientation и dormant character atlases, подгружать их до предсказуемого telegraph либо использовать fallback silhouette, не меняя event timing.
- Риск: семь concepts меняют архитектуру/камеру сильнее, чем допустимо для плавного reveal. BG-001…009 должны быть сведены в одну перспективу и один ritual anchor; seven-screen implementation запрещена.
- Риск: MP3 fallback может иметь encoder delay. Обязательны manifest loop samples и browser loop test; при дефекте используется decoded-buffer scheduling.
- Риск: detailed stage-6/7 composition может потерять HUD/flame readability. Тёмная периферия, independent masks и density caps обязательны; full-screen orange raster не используется.
- Никакой `PLANNED` asset не является готовым. Implementation может начинаться с процедурных/fallback placeholders, но release требует READY или документированного одобренного fallback для каждой manifest entry.
