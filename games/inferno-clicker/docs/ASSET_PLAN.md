# Asset Plan — «Зажги»

## Corrective Cycle 08 active production contract

Cycle 08 наследует C07 flame, Inferno host, authored character motion, mouth/two-palm steam и все audio recordings/mix byte-identical. Новый character asset version bump сохраняет identity/key poses/timings, очищает внешний и внутренний white matte у Ash Servant и Demoness, а Demoness перерисовывается нативно чёткой и размещается на 20% крупнее. Конкретные filenames, counts and hashes становятся authoritative только после записи в manifest; принятые C07 character atlases сохраняются как исторический baseline и не перезаписываются.

### Cycle 08 required registry delta

| ID | Required production artifact | Measurable contract | Load/residency |
|---|---|---|---|
| CH-ASH-SERVANT-C08 | `ash-servant-{idle,inhale,blow,recovery}-v6.{webp,json}` | Four `1024×640` atlases, 8 unique `256×320` cells each; C07 identity/scale/motion preserved; genuine exterior/internal-gap alpha; visible white matte/fringe/islands and detached contour tiles=0; lossless decoded-alpha parity; recomputed root/mouth/anatomical landmarks and alpha bbox; source→atlas≤1.0 | same C07 preload groups; active plus one imminent clip at most |
| CH-DEMONESS-C08 | `demoness-{idle,cast,hold,recovery}-v7.{webp,json}` | Four `2048×1664` atlases, 8 unique native-redrawn `512×832` cells each; genuine exterior/internal alpha with lossless decoded-alpha parity; draw box `504×840`; per-frame root/leftHand/rightHand/alpha bbox; rendered bbox height≥1.25× Servant; source→atlas≤1.0 | one resident full atlas; one bounded `512×832` frame-cache during decode handoff |
| FX-STEAM-C07 | Accepted C07 bounded steam implementation and assets, unchanged | mouth origin≤8 px, each palm origin≤12 px, target≤12 px; new frame sockets remeasured without changing semantics/timing | inherited load/lifetime/quality-tier policy |
| CH-INFERNO-HOST-{MAIN,SENTINEL}-C06 | Unchanged accepted authored atlases + JSON | accepted 1.5 s entry and post-entry independent motion preserved byte-identical | preload before Stage 7; release at run teardown |

`FX-SERVANT-SNOW-C06`, `FX-DEMONESS-ICE-C06` and their snowflake/icicle/shard draw contracts remain `SUPERSEDED BY C07` and must not be loaded, rendered or accepted as fallback. C08 does not change accepted steam behavior; it updates sockets only as needed to follow corrected frames.

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
| CH-ASH-SERVANT | Historical pre-C08 lineage, including accepted C07 clip family | 3–7 | exact C07 paths/hashes recorded in C08 baseline evidence | Yes | Retained identity/key poses/motion and C08 before/after comparison only | Existing generated source | N/A — historical | Yes | SUPERSEDED BY C08 FOR ALPHA CLEANUP |
| CH-DEMONESS | Historical pre-C08 lineage, including accepted C07 clip family | 4–7 | exact C07 paths/hashes recorded in C08 baseline evidence | Yes | Identity/pose/`420×700` runtime baseline only; not a source to upscale | Existing generated source | N/A — historical | Yes | SUPERSEDED BY C08 FOR REDRAW/SCALE |
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
- C08 alpha masks cover exterior background and enclosed negative spaces for every Servant/Demoness state. Partial-alpha edge RGB is decontaminated from adjacent character material; fully opaque pale highlights are preserved and cannot be deleted by a global white threshold. Approved per-frame alpha SHA-256 must equal decoded WebP alpha SHA-256; changed/max-error/low-alpha-leak counts are all zero.
- Demoness uses exactly `512×832` cells. The common logical draw box is exactly `504×840` instead of C07 `420×700`; one stable feet/root anchor and scale apply across states. An eight-frame clip is planned as a `2048×1664` (`4×2`) atlas, within the `2048 px` side limit.
- `appearance` and `disapproval` reuse authored frames from `demoness-idle-v7`; they do not create duplicate unregistered atlases. All 32 raw Demoness redraws and assembled-source hashes live in `visual-references/cycle-08-sources/source-manifest.json`.

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
- Large character animation is partitioned into independently disposable clip resources. Servant may pin active plus one imminent clip. Demoness pins exactly one full atlas; a single decoded frame is cached before the old atlas is released and remains visible until the requested atlas commits. Flame families retain at most the two families needed by a boundary transition.

## Cycle 08 budget gate

| Budget | Last accepted baseline | Hard limit | Cycle 08 status |
|---|---:|---:|---|
| Startup critical art | 818,566 B | 1.5 MiB | NOT RUN — C08 characters remain optional ahead-of-need groups; exact manifest must confirm no startup delta |
| Total registered art | 10,235,636 B | 9.8 MiB | PASS in asset audit candidate; 40,408 B headroom; exact clean-build evidence still required |
| Worst decoded bitmap residency | 64,814,080 B (61.81 MiB), including one `512×832×4` Demoness frame-cache | 64 MiB; target≤56 MiB | HARD PASS / documented target exception; browser lifecycle trace NOT RUN |
| Both stored audio codec packs | 675,540 B | 2.2 MiB | NOT RUN — fingerprint equality must confirm unchanged bytes |
| Largest texture side | 2048 px | 2048 px | PASS in manifest/asset audit candidate; exact clean-build evidence still required |
| Working production package | pending final `dist/build-manifest.json` | 15 MiB | NOT RUN — rebuild exact C08 candidate; superseded character versions are excluded from `assets/` |

## Verification status and remaining risk

Cycle 08 status is `NOT RUN`: manifests must list every clip, unique frame hash, native source and `512×832` cell dimensions, `504×840` draw size, root/mouth/leftHand/rightHand/anatomical landmarks, visible alpha bbox, exterior/internal-gap and partial-alpha metrics, real-scene-transform upscale/height-ratio matrix, preload/release group and decoded byte count. C07 evidence remains the comparison baseline but cannot prove corrected pixels or geometry. Audio remains frozen and is verified only by fingerprint equality plus lifecycle regression; no new listening classification is opened unless a fingerprint changes.
