# Asset Plan — «Зажги»

## Назначение и статус

Это производственный реестр всех необходимых visual/audio assets для `inferno-clicker`: назначение, путь, формат, размер, ownership и budget. Художественные правила находятся в `ART_DIRECTION.md`, звуковые — в `AUDIO_DIRECTION.md`, техническая загрузка — в `TECHNICAL_ARCHITECTURE.md`.

**Статус planning stage:** финальные ассеты не созданы. Все строки ниже имеют статус `PLANNED`; смена на `IN REVIEW`/`READY` возможна только после provenance, optimization и QA. Пути указаны относительно корня игры. Source masters (`.kra`, `.psd`, `.blend`, `.wav`, DAW projects) не входят в runtime bundle и должны храниться в согласованном source-artifact storage, а не в `dist/`.

## Visual asset registry

| ID | Назначение | Path | Тип/формат | Размер | Прозрачность | States / загрузка | Источник | Владелец | Статус |
|---|---|---|---|---|---|---|---|---|---|
| BG-001 | Дальняя камера, portrait | `assets/backgrounds/bg-infernal-chamber-portrait.webp` | WebP lossy | `1024×2048`, ≤ 420 KB | Нет | Все стадии; critical preload | Original manual или generated-assisted + paintover | Art Agent | PLANNED |
| BG-002 | Дальняя камера, landscape | `assets/backgrounds/bg-infernal-chamber-landscape.webp` | WebP lossy | `1920×1080`, ≤ 430 KB | Нет | Landscape only; responsive alternate | Original manual или generated-assisted + paintover | Art Agent | PLANNED |
| BG-003 | Камни/арки среднего плана | `assets/backgrounds/bg-architecture-midground.webp` | WebP alpha | `896×1344`, ≤ 340 KB | Да | Reveal 1–7; critical preload | Original manual / decomposed | Art Agent | PLANNED |
| BG-004 | Ритуальная плоскость, круг/трещины | `assets/backgrounds/bg-ritual-plane.webp` | WebP alpha | `1024×1024`, ≤ 300 KB | Да | Reveal mask 1–7; critical preload | Original manual | Art Agent | PLANNED |
| BG-005 | Инфернальные врата и опоры | `assets/backgrounds/bg-scarlet-gate.webp` | WebP alpha | `1024×1024`, ≤ 280 KB | Да | Silhouette at 4, full at 5–7; preload near stage 3 | Original manual / decomposed | Art Agent | PLANNED |
| BG-006 | Передний каменный край и зола | `assets/backgrounds/bg-foreground-frame.webp` | WebP alpha | `896×1344`, ≤ 270 KB | Да | All stages; lazy after interactive | Original manual | Art Agent | PLANNED |
| BG-007 | Цепи: короткие/длинные/звенья | `assets/backgrounds/bg-chains-atlas.webp` | WebP alpha atlas | `512×768`, ≤ 140 KB | Да | 6 static pieces; stage 4–7 | Original manual | Art Agent | PLANNED |
| BG-008 | Оригинальные руны и crack decals | `assets/backgrounds/bg-runes-atlas.webp` | WebP alpha atlas | `768×768`, ≤ 180 KB | Да | 16 glyphs, dim/lit via tint; stage 2–7 | Original manual; no real symbols | Art Agent | PLANNED |
| CH-001 | Пепельный слуга | `assets/characters/character-ash-servant-atlas.webp` | WebP alpha atlas + JSON frames | `1024×1024`, ≤ 420 KB | Да | emerge, idle, inhale, blow, retreat; preload near stage 2 | Original manual или generated-assisted + full redraw | Art Agent | PLANNED |
| CH-002 | Демонесса угасания | `assets/characters/character-fading-demoness-atlas.webp` | WebP alpha atlas + JSON frames | `1536×1536`, ≤ 720 KB | Да | silhouette, reveal, idle, cast, hold, release; preload near stage 4 | Original manual или generated-assisted + full redraw | Art Agent | PLANNED |
| CH-003 | Наблюдатели в арках | `assets/characters/character-watchers-atlas.webp` | WebP alpha atlas | `1024×768`, ≤ 220 KB | Да | 5 silhouettes; stage 6–7 | Original manual | Art Agent | PLANNED |
| CH-004 | Глаза наблюдателей | `assets/characters/character-watcher-eyes-atlas.webp` | WebP alpha atlas | `256×128`, ≤ 28 KB | Да | open, half, closed; stage 6–7 | Original manual | Art Agent | PLANNED |
| UI-001 | Логотип/wordmark «Зажги» | `assets/ui/ui-logo-zazhgi.svg` | Optimized SVG | `viewBox 0 0 1024 420`, ≤ 35 KB | Да | Loading/title state | Original lettering, outlined | Art Agent | PLANNED |
| UI-002 | Масштабируемая panel/button skin | `assets/ui/ui-stone-panel.9.webp` | WebP alpha, 9-slice metadata | `384×384`, ≤ 55 KB | Да | default/pressed via tint/scale | Original manual | Art Agent | PLANNED |
| UI-003 | HUD/gameplay glyphs | `assets/ui/ui-hud-icons.svg` | SVG symbol sprite | `viewBox 0 0 512 512`, ≤ 32 KB | Да | heat, score, multiplier, stage, time, resonance, surge, breath, heat-window, too-fast | Original manual | Art Agent | PLANNED |
| UI-004 | System glyphs | `assets/ui/ui-system-icons.svg` | SVG symbol sprite | `viewBox 0 0 512 512`, ≤ 24 KB | Да | sound on/off, info, retry, close | Original manual | Art Agent | PLANNED |
| UI-005 | Debuff states | `assets/ui/ui-debuff-icons.svg` | SVG symbol sprite | `viewBox 0 0 512 256`, ≤ 20 KB | Да | decay-up, tap-down, suppression | Original manual | Art Agent | PLANNED |
| UI-006 | «Печать Инферно x2» icon | `assets/ui/ui-inferno-seal.svg` | Optimized SVG | `viewBox 0 0 512 512`, ≤ 22 KB | Да | CTA/active/ending by CSS tint | Original abstract glyph | Art Agent | PLANNED |
| UI-007 | Focus-visible high-contrast ring | `assets/ui/ui-focus-ring.svg` | Optimized SVG | `viewBox 0 0 128 128`, ≤ 4 KB | Да | focus-visible | Original manual | Art Agent | PLANNED |
| FX-001 | Низкочастотный noise для flame/smoke | `assets/effects/fx-noise-tile.webp` | WebP lossless | `256×256`, ≤ 36 KB | Нет | Tiled procedural sampling; critical preload | Procedurally authored; fixed seed | Art Agent | PLANNED |
| FX-002 | Soft particle shape atlas | `assets/effects/fx-particles-atlas.webp` | WebP alpha atlas | `256×256`, ≤ 28 KB | Да | ember, spark, smoke, ash, glow | Original procedural bake | Art Agent | PLANNED |
| FX-003 | Flame fallback core | `assets/effects/fx-flame-fallback.svg` | Optimized SVG | `viewBox 0 0 256 512`, ≤ 12 KB | Да | Reduced quality / no-filter fallback | Original manual | Art Agent | PLANNED |
| FX-004 | Cold suppression mask | `assets/effects/fx-suppression-ring.svg` | Optimized SVG | `viewBox 0 0 512 512`, ≤ 16 KB | Да | enter/active/exit via runtime transform | Original abstract glyph | Art Agent | PLANNED |
| FX-005 | Rewarded seal arc segments | `assets/effects/fx-boost-seal-arcs.svg` | SVG symbol sprite | `viewBox 0 0 512 512`, ≤ 18 KB | Да | 3 independent arcs | Original abstract glyph | Art Agent | PLANNED |
| MAN-001 | Runtime metadata, sizes, hashes, stage groups | `assets/assets-manifest.json` | JSON UTF-8 | ≤ 20 KB | N/A | Critical/lazy groups, content hashes | Manual/generated by build | Developer + Art/Audio | PLANNED |

`*.json` frame metadata для `CH-001` и `CH-002` располагается рядом с atlas (`character-…-atlas.json`), входит в budget MAN-001 и проверяется на отсутствие overlap/bleed. Для WebP alpha требуется padding `4 px`, extrusion `2 px`; координаты atlas — integer pixels.

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

| ID | Элемент | Алгоритм / параметры | Seed policy | High / low quality budget |
|---|---|---|---|---|
| PROC-01 | Flame body | 3–5 layered bezier/SDF lobes, noise-warp из FX-001, gradient core→edge | `hash(sessionVisualSeed, "flame", frameBucket)`; deterministic QA override | High: ≤5 lobes/0.75×; low: 3/0.5×; off: SVG fallback |
| PROC-02 | Embers/sparks | Object pool, ballistic motion, drag, age-based alpha/size; shapes из FX-002 | `hash(sessionVisualSeed, emitterId, spawnIndex)` | High/low/off: 80/28/0 live particles |
| PROC-03 | Smoke/ash | Pooled quads, curl-like drift from tiled noise, no full-res blur | То же, отдельный emitter stream | High/low/off: 24/8/0 live particles |
| PROC-04 | Dynamic light reveal | Radial/elliptic mask driven by heat and stageProgress; multiply/screen compositing | N/A, deterministic formula | High: 0.75× mask; low: 0.5×; off: CSS gradient |
| PROC-05 | Rune pulse | Per-glyph sine opacity/scale with stage offsets | Fixed glyph index offsets | High/low/off: 16/8/8 glyphs; off uses static opacity |
| PROC-06 | Servant blow | Directed ash cone + flame bend scalar | Event id + spawn index | High/low/off: 24/10/0 particles; off uses static ring |
| PROC-07 | Suppression ring | SVG FX-004 transform + cold radial mask | N/A | High: ring+mask; low/off: static ring |
| PROC-08 | Rewarded seal | Three SVG arcs rotating at distinct bounded speeds + golden ember tint | N/A | High: 3 arcs+particles; low: 3 arcs; off: static seal |
| PROC-09 | Heat distortion | Quarter-resolution displacement from FX-001, stage 6–7 only | Fixed time function; no RNG | High: 0.25× buffer; low/off: disabled |
| PROC-10 | Stage burst | Short radial sparks/rune brightness impulse | Stage transition id | High/low/off: 32/12/0 particles; off uses DOM label pulse |
| PROC-11 | Resonance/surge/breath ring | Four segments, expansion and contraction driven by exact core state/time | N/A | High/low: transformed SVG segments; off: DOM icon/state text |
| PROC-12 | Enemy tap counters | 4/6 breakable ring segments driven only by accepted tap events | Encounter id + segment index | All tiers: fixed segments; particles only high/low |
| PROC-13 | Heat-window ring | `0.75 s` gather → `1.50 s` expansion from core event clock | Event id | High: glow+particles; low: ring; off: DOM icon/countdown |

Cosmetic seeds никогда не читают и не изменяют core gameplay RNG. Simulation должна быть frame-rate independent; automated visual tests фиксируют `sessionVisualSeed` и animation time. При `prefers-reduced-motion: reduce` PROC-02/03 сокращаются минимум на 60%, PROC-09 отключается, PROC-04/07/08 остаются статическими indicators.

## Generated-assisted assets и provenance

Generated-assisted разрешён только для BG-001/002/003/005 и ранних silhouette explorations CH-001/002. Финальные characters обязаны пройти полный manual redraw/paintover, anatomy/content review и atlas decomposition; модельный output нельзя использовать как цельный экран.

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
| `critical-visual` | BG-001 или BG-002, BG-003, BG-004, UI-002…007, FX-001…003 | До interactive; responsive background только один | CSS dark gradient, SVG flame fallback, system text/icons |
| `critical-audio` | SF-001, SF-003, AM-002 и MU-001 выбранного codec pack | SF-001/SF-003 network preload до interactive и decode после gesture; AM-002/MU-001 грузятся после gesture, не блокируя interactive | Silent play; audio-locked/mute state, retry on next gesture |
| `stage-3` | CH-001, SF-006 | При progress текущей stage 2 ≥ 60% | Силуэт/простая procedural ash cue |
| `stage-4` | BG-005, BG-007, AM-003/004, MU-003 | При progress текущей stage 3 ≥ 60% | Existing architecture + procedural chains cue |
| `stage-5` | CH-002, MU-004, SF-007/008/009 | При progress текущей stage 4 ≥ 60% | Demoness silhouette + cold ring, no mechanic loss |
| `stage-6` | CH-003/004, MU-005, AM-005, SF-017 | При progress текущей stage 5 ≥ 60% | Static dark silhouettes; music remains previous layers |
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
- Риск: одновременная резидентность всех крупных слоёв превышает target decoded memory. Loader обязан выгружать alternate orientation и невидимые character atlases, сохраняя fallback silhouette.
- Риск: MP3 fallback может иметь encoder delay. Обязательны manifest loop samples и browser loop test; при дефекте используется decoded-buffer scheduling.
- Риск: поздний concept art может не укладываться в composition/content/budget. Он адаптируется под этот контракт, а конфликт фиксируется; требования не меняются молча.
- Никакой `PLANNED` asset не является готовым. Implementation может начинаться с процедурных/fallback placeholders, но release требует READY или документированного одобренного fallback для каждой manifest entry.
