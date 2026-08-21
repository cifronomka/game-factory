# Asset Plan — «Зажги»

## Corrective Cycle 06 active production contract

Cycle 06 сохраняет flame bitmap design и все audio recordings/mix byte-identical. Character assets version bump: принятые key poses/identity сохраняются, но добавляются genuine in-betweens, clean alpha, higher-resolution Demoness, scarlet snowflake/ice/steam FX и authored Inferno-host internal motion. Конкретные filenames, dimensions, counts and hashes становятся authoritative только после записи в manifest; старые v3/v4 rows ниже считаются superseded inventory, а не target.

### Cycle 06 required registry delta

| ID | Required production artifact | Measurable contract | Load/residency |
|---|---|---|---|
| CH-ASH-SERVANT-C06 | Versioned clip atlases + JSON for appearance/idle/inhale/blow/recovery | retained key poses; unique forward-authored in-between between every semantic key pair; per-frame root/mouth sockets; no white matte; root drift≤2 logical px | preload appearance/idle before Stage 3; attack clip ahead of first event; release inactive clips |
| FX-SERVANT-SNOW-C06 | Scarlet snowflake sprites/JSON or reproducible vector draw contract | readable snowflake silhouette; bounded pool; origin mouth≤8 px, target flame≤12 px | load with servant attack; particle cap included in tier budget |
| CH-DEMONESS-C06 | High-resolution versioned clip atlases + JSON | effective upscale≤1.25× at DPR2 targets; unique appearance/idle/disapproval/cast/hold/recovery cells; per-frame root/hand sockets; clean alpha | preload idle before Stage 5; cast/recovery ahead of first event; release inactive clips |
| FX-DEMONESS-ICE-C06 | Blue conical shard sprites/JSON or reproducible draw contract | multiple oriented cones; legacy ribbon geometry absent; contact driven by live flame mask | load with cast clip; bounded projectile pool |
| FX-DEMONESS-STEAM-C06 | Evaporation/steam sprites/JSON or reproducible particle contract | starts only 0–100 ms after contact; rises/fades to zero; clean pause/teardown | share impact group; bounded pool and lifetime |
| CH-INFERNO-HOST-{MAIN,SENTINEL}-C06 | Two versioned authored atlases + JSON | accepted 1.5 s entry preserved; main host and sentinel use separate decoded resources and independent phases | preload before Stage 7; release at run teardown |

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
| CH-ASH-SERVANT | Cycle 05 historical baseline; superseded by C06 clip set | 3–7 | `/assets/characters/ash-servant/ash-servant-states-v3.webp` + JSON | Yes | Sparse baseline used only for retained-key-pose/fingerprint comparison | Existing generated source | N/A — historical | Yes | SUPERSEDED BY C06 |
| CH-DEMONESS | Cycle 05 historical baseline; superseded by high-resolution C06 clip set | 4–7 | `/assets/characters/demoness/demoness-states-v4.webp` + JSON | Yes | Sparse/duplicated baseline used only for identity comparison | ImageGen Cycle 05 | N/A — historical ribbon | Yes | SUPERSEDED BY C06 |
| CH-INFERNO-HOST | Cycle 05 historical baseline; entry reference only | 6–7 | `/assets/characters/character-inferno-host.webp` + JSON | Yes | Accepted entry/composition reference; post-entry crop motion superseded | Yes | N/A — historical | Spatial crop | SUPERSEDED BY C06 |

### Multilayer flame contract

Пламя не является одной картинкой. Renderer независимо рисует core, outer, additive glow, embers/sparks, smoke/heat haze, tap impulse и stage flare. Core/outer меняют реальный authored silhouette по кадрам, а каждый display frame смешивает текущую и следующую authored cell complementary weights с quintic timing, включая last→first seam. Character reaction накладывает только bounded bend/height/brightness/cold-edge поверх продолжающегося authored loop и не сбрасывает его timeline. Seal impulse отсутствует.

Внутри family изменение стадии идёт через непрерывные heat-driven brightness/glow/scale/particle/smoke channels и 8-frame flare. Все 12 соседних upward/downward crossings имеют 1.05 s reversible boundary envelope; family changes дополнительно используют непрерывный root-locked mix не более двух families, а `6→7` длится 1.5 s. Stage 7 использует high family с дополнительным вторым high-core pass; rewarded tint остаётся отдельным состоянием.

### Character state contract

- Servant: forward-authored `prepare → inhale-ramp → inhale-hold → exhale-start → exhale-ramp → exhale-peak → exhale-fade → exhale-end → recovery`; один normalized strength управляет scarlet snowflakes и flame reaction. Reverse recovery запрещён.
- Demoness: Stage 4 silhouette не расходует reveal; Stage 5 запускает authored appearance. Спокойный 6.67 s idle и presentation-only disapproval раз в 5–9 s не двигают root. Attack: `cast-look → arms-rise → cast-gather → cold-travel → contact → cold-hold → cold-release → recovery`.
- Conical ice shards начинаются у authored hand sockets и каждый frame направляются к `FlameRig.getTargetAnchor()`. При contact shard исчезает/раскалывается и запускает bounded steam в точке hit; `impactStrength=0` до contact.
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

## Measured budgets

| Budget | Result | Hard limit | Status |
|---|---:|---:|---|
| Startup critical art | 818,566 B | 1.5 MiB | PASS |
| Total registered art | 9,703,758 B | 9.8 MiB | PASS |
| Worst decoded bitmap residency | 64,838,656 B (61.84 MiB); target 56 MiB exceeded, hard cap preserved | 64 MiB | PASS hard gate; target exception recorded for high-resolution Demoness |
| Both stored audio codec packs | 675,540 B | 2.2 MiB | PASS |
| Largest texture side | 1600 px | 2048 px | PASS |
| Working production package | 8,430,646 B / 71 files | 15 MiB | PASS offline; clean release identity still required |

## Verification status and remaining risk

Cycle 06 status is `NOT RUN`: manifests must list every clip, unique frame hash, socket, partial-alpha edge metrics, preload/release group and decoded byte count. Motion/causality/edge quality require exact-build browser video/hashed frames. Audio remains frozen and is verified by fingerprint equality plus lifecycle regression; no new listening classification is opened unless a fingerprint changes.
