# Asset Plan — «Зажги»

## Corrective Cycle 07 active production contract

Cycle 07 сохраняет flame bitmap design, Inferno-host work и все audio recordings/mix byte-identical. Character assets version bump сохраняет key poses/identity, но стабилизирует анатомический scale Ash Servant, повышает фактическую резкость Demoness и заменяет C06 snow/ice FX единым bounded steam system из фактических sockets. Конкретные filenames, dimensions, counts and hashes становятся authoritative только после записи в manifest; C05/C06 character/FX rows считаются superseded inventory, а не target.

### Cycle 07 required registry delta

| ID | Required production artifact | Measurable contract | Load/residency |
|---|---|---|---|
| CH-ASH-SERVANT-C07 | Versioned clip atlases + JSON for appearance/idle/inhale/blow/recovery | retained identity/key poses; one family-wide scale reference; per-frame root/mouth/anatomical landmarks; root drift≤2 logical px; anatomical scale drift≤2%; clean alpha | preload appearance/idle before Stage 3; attack clip ahead of first event; release inactive clips |
| FX-STEAM-C07 | Reproducible bounded steam sprites/JSON or vector-particle draw contract shared by actors | soft translucent vapor, no crystalline/snow silhouette; independent source IDs; mouth origin≤8 px, each palm origin≤12 px, target≤12 px; pause/cleanup safe | load with first Servant attack; bounded density/lifetime per quality tier |
| CH-DEMONESS-C07 | Higher-resolution versioned clip atlases + JSON | exact `sceneTransform` effective upscale≤1.25× on full viewport/DPR matrix; unique authored cells; per-frame root/leftHand/rightHand sockets; scale drift≤2%; clean alpha | preload idle before Stage 5; cast/recovery ahead of first event; release inactive clips |
| CH-INFERNO-HOST-{MAIN,SENTINEL}-C06 | Unchanged accepted Cycle 06 authored atlases + JSON | accepted 1.5 s entry and post-entry independent motion preserved byte-identical | preload before Stage 7; release at run teardown |

`FX-SERVANT-SNOW-C06`, `FX-DEMONESS-ICE-C06` and their snowflake/icicle/shard draw contracts are `SUPERSEDED BY C07` and must not be loaded, rendered or accepted as fallback. Existing C06 steam-at-contact semantics are likewise superseded: C07 steam originates directly from the Servant mouth and both Demoness palms.

Все runtime paths указаны относительно корня игры. Точный размер, SHA-256, preload group, codec и длительность являются машиночитаемой частью `assets/assets-manifest.json`; источники и лицензии — `assets/PROVENANCE.md` и `assets/AUDIO_CREDITS.txt`.

## Visual registry

| ID / asset | Назначение | Stage | Runtime path / format | Transparent | Animation / states | Generated image | Procedural | Sprite animation | Status |
|---|---|---:|---|---|---|---|---|---|---|
| BG-001 Infernal chamber | Постоянный background, архитектура и ritual anchor | 1–7 | `/assets/backgrounds/bg-infernal-chamber-production.webp`, RGB WebP 768×1365 | No | Региональный reveal и лёгкий parallax поверх bitmap | Yes | Только masks/light | No | READY |
| FL-LOW-CORE | Живое внутреннее пламя | 1–2 | `/assets/flame/atlases/core-low-v2.webp` + JSON, 1024×1024 | Yes | 8 frames, 10 fps loop, pivot `(0.50,.965)` | Yes | No body synthesis | Yes | READY — startup critical |
| FL-LOW-OUTER | Независимые янтарные языки | 1–2 | `/assets/flame/atlases/outer-low-v2.webp` + JSON, 1024×1024 | Yes | 8 frames, 10 fps loop, phase +2 | Yes | No body synthesis | Yes | READY — startup critical |
| FL-MID-CORE | Среднее ядро | 3–5 | `/assets/flame/atlases/core-mid-v2.webp` + JSON, 1600×1280 | Yes | 10 frames, 10 fps loop | Yes | No body synthesis | Yes | READY — preload S2 60% |
| FL-MID-OUTER | Более широкие асимметричные языки | 3–5 | `/assets/flame/atlases/outer-mid-v2.webp` + JSON, 1600×1280 | Yes | 10 frames, 10 fps loop, phase +3 | Yes | No body synthesis | Yes | READY — preload S2 60% |
| FL-HIGH-CORE | Высокое ветвящееся ядро/Inferno column | 6–7 | `/assets/flame/atlases/core-high-v2.webp` + JSON, 1536×1280 | Yes | 12 frames, 11 fps loop | Yes | No body synthesis | Yes | READY — preload S5 60% |
| FL-HIGH-OUTER | Высокие внешние языки | 6–7 | `/assets/flame/atlases/outer-high-v2.webp` + JSON, 1536×1280 | Yes | 12 frames, 11 fps loop, phase +4 | Yes | No body synthesis | Yes | READY — preload S5 60% |
| FX-STAGE-FLARE | Скрывает texture swap и подчёркивает каждый stage boundary | 1–7 | `/assets/flame/transitions/stage-flare-v2.webp` + JSON, 1024×1024 | Yes | 8 frames at 8 fps; forward upward, reverse + cool tint downward; family crossfade 1.05 s, entry S7 1.5 s | Yes | Runtime tint/light | Yes | READY — preload S1 60% |
| CH-ASH-SERVANT | Cycle 05 historical baseline; C06 clip set also historical under C07 | 3–7 | `/assets/characters/ash-servant/ash-servant-states-v3.webp` + JSON | Yes | Sparse baseline used only for retained-key-pose/fingerprint comparison | Existing generated source | N/A — historical | Yes | SUPERSEDED BY C07 |
| CH-DEMONESS | Cycle 05 historical baseline; C06 clip set also historical under C07 | 4–7 | `/assets/characters/demoness/demoness-states-v4.webp` + JSON | Yes | Sparse/duplicated baseline used only for identity comparison | ImageGen Cycle 05 | N/A — historical ribbon | Yes | SUPERSEDED BY C07 |
| CH-INFERNO-HOST | Cycle 05 historical baseline; entry reference only | 6–7 | `/assets/characters/character-inferno-host.webp` + JSON | Yes | Accepted entry/composition reference; post-entry crop motion superseded | Yes | N/A — historical | Spatial crop | SUPERSEDED BY C06 |

### Multilayer flame contract

Пламя не является одной картинкой. Renderer независимо рисует core, outer, additive glow, embers/sparks, smoke/heat haze, tap impulse и stage flare. Core/outer меняют реальный authored silhouette по кадрам, а каждый display frame смешивает текущую и следующую authored cell complementary weights с quintic timing, включая last→first seam. Character reaction накладывает только bounded bend/height/brightness/cold-edge поверх продолжающегося authored loop и не сбрасывает его timeline. Seal impulse отсутствует.

Внутри family изменение стадии идёт через непрерывные heat-driven brightness/glow/scale/particle/smoke channels и 8-frame flare. Все 12 соседних upward/downward crossings имеют 1.05 s reversible boundary envelope; family changes дополнительно используют непрерывный root-locked mix не более двух families, а `6→7` длится 1.5 s. Stage 7 использует high family с дополнительным вторым high-core pass; rewarded tint остаётся отдельным состоянием.

### Character state contract

- Servant: forward-authored `prepare → inhale-ramp → inhale-hold → exhale-start → exhale-ramp → exhale-peak → exhale-fade → exhale-end → recovery`; один family-wide scale reference предотвращает pose-dependent fit/shrink, а normalized strength управляет mouth steam и существующей flame reaction. Reverse recovery запрещён.
- Demoness: Stage 4 silhouette не расходует reveal; Stage 5 запускает authored appearance. Спокойный 6.67 s idle и presentation-only disapproval раз в 5–9 s не двигают root. Attack: `cast-look → arms-rise → cast-gather → steam-start → steam-travel → steam-hold → steam-release → recovery`.
- Shared steam emitter каждый frame следует interpolated `mouth`, `leftHand` или `rightHand` socket после реального scene transform и направляется к `FlameRig.getTargetAnchor()`. У Demoness обе видимые ладони создают отдельные потоки. Snowflakes, ice shards, icicles, projectile collision и fixed world origins отсутствуют; core effect timing не зависит от travel.
- Recovery использует все authored settle frames: 800 ms Servant и 1000 ms Demoness.
- `encounters[]` допускает одновременную работу обоих actors. HUD получает отдельные `debuffs[]` rows и общий capped factor, но не влияет на animation/gameplay clocks.
- Reduced Motion сохраняет authored poses/frames с уменьшенной частотой эффектов; static cutout fallback отсутствует.

## Audio registry

Каждая логическая запись поставляется в OGG Vorbis и matching MP3 fallback. Runtime сначала пытается OGG, затем MP3; две codec-копии одного asset никогда не играют одновременно.

| ID / asset | Назначение | Runtime paths | Runtime behavior | Source / license | Status |
|---|---|---|---|---|---|
| AU-WOOD | Основной древесный/угольный bed | `/assets/audio/fire/embers-wood-bed.{ogg,mp3}` | 29.26 s loop, long-lived ambience | Fireplace Sound Loop, PagDev, CC0 | READY |
| AU-CRACKLE | Негромкий слой треска | `/assets/audio/fire/charcoal-crackle.{ogg,mp3}` | 3.59 s loop at low gain | Fire Crackling, AntumDeluge, CC0 | READY |
| AU-FAN-A | Раздувание/опахало | `/assets/audio/fan/fan-soft-a.{ogg,mp3}` | 0.75 s one-shot | Short Wind Sound, remaxim, CC0 | READY |
| AU-FAN-B | Вариант раздувания | `/assets/audio/fan/fan-soft-b.{ogg,mp3}` | 0.75 s one-shot | Air whoosh, pyranostudios, CC0 | READY |
| AU-FAN-C | Вариант раздувания | `/assets/audio/fan/fan-soft-c.{ogg,mp3}` | 0.75 s one-shot | Air Woosh Move, Almitory, CC0 | READY |

Accepted taps объединяются в окно 120 ms, новый fan voice стартует не чаще одного раза за 180 ms, варианты чередуются, одновременно допускается не более двух fan voices. Tap tone, oscillator, pitch ladder и процедурный noise отсутствуют. Menu/visibility/platform/ad pause reasons управляют одним master lifecycle; mute и destroy не допускают позднего возрождения source.

## Loading and fallback

- Startup critical: BG-001, low core и low outer — 818,566 compressed bytes.
- Stage flare начинает грузиться при 60% Stage 1; mid + Servant — при 60% Stage 2; Demoness — при 60% Stage 3; high + host — при 60% Stage 5.
- Ошибка critical image даёт bounded retry/safe darkness. Optional late asset остаётся невидимым до успешной загрузки; старые static-card ассеты не являются fallback.
- Audio создаёт graph и загружает media только после trusted gesture. Failed codec pair деградирует конкретный asset до silence без повторного fetch на каждый tap.
- Large character animation partitioned into independently disposable clip resources. Active plus one imminent clip are pinned; inactive optional clips are released immediately after the requested atlas commits. Flame families likewise retain at most the two families needed by a boundary transition. A delayed decode freezes the last valid authored cell instead of interpreting an old atlas with new-clip timing.

## Cycle 07 budget gate

| Budget | Pre-C07 baseline | Hard limit | Cycle 07 status |
|---|---:|---:|---|
| Startup critical art | 818,566 B | 1.5 MiB | NOT RUN — corrected characters are optional ahead-of-need groups but exact manifest must confirm no startup delta |
| Total registered art | 9,703,758 B | 9.8 MiB | NOT RUN — recompute after C07 sources/obsolete FX removal |
| Worst decoded bitmap residency | 64,838,656 B (61.84 MiB) | 64 MiB; target≤56 MiB | NOT RUN — exact instantaneous overlap trace required; pre-C07 exception is not carried forward |
| Both stored audio codec packs | 675,540 B | 2.2 MiB | NOT RUN — fingerprint equality must confirm unchanged bytes |
| Largest texture side | 1600 px | 2048 px | NOT RUN — recompute after sharp Demoness export |
| Working production package | 8,430,646 B / 71 files | 15 MiB | NOT RUN — rebuild exact candidate and exclude superseded snow/ice resources |

## Verification status and remaining risk

Cycle 07 status is `NOT RUN`: manifests must list every clip, unique frame hash, root/mouth/leftHand/rightHand/anatomical landmarks, partial-alpha edge metrics, real-scene-transform upscale matrix, preload/release group and decoded byte count. Scale stability, sharpness, source attachment and semantic readability require exact-build continuous browser motion plus timestamp-linked hashed frames. Audio remains frozen and is verified by fingerprint equality plus lifecycle regression; no new listening classification is opened unless a fingerprint changes.
