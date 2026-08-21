# Asset Plan — «Зажги»

## Corrective Cycle 05 production baseline

Этот документ описывает фактически подключённый Cycle 05 candidate. Flame bitmap design и audio recordings не меняются: runtime добавляет sub-frame temporal blending, continuous heat response и reversible stage envelopes. Принятый Ash Servant остаётся byte-identical. Demoness заменена на reference-driven v4 Inferno Queen с настоящим alpha, стабильным root, спокойным idle и полным направленным cast/recovery.

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
| CH-ASH-SERVANT | Stationary comic devil и читаемый длинный выдох | 3–7 | `/assets/characters/ash-servant/ash-servant-states-v3.webp` + JSON, lossless VP8L 1536×1120, 24 cells 256×280 | Yes, gutter ≥8 | appearance; restrained idle 4 fps; phase-selected prepare/inhale/hold/exhale ramp/peak/fade; 450 ms authored reverse recovery | Existing generated source, lossless repack | Ash stream, ember drift, proportional flame bend | Yes | READY — preload S2 60% |
| CH-DEMONESS | Высокая спокойная Inferno Queen по newest user reference | 4–7 | `/assets/characters/demoness/demoness-states-v4.webp` + JSON, lossless VP8L 1536×1152, 28 cells 192×288 | Yes, gutter ≥4, edge alpha=0 | appearance 4; idle 4/0.6 fps; disapproval 4; cast 8; hold 4; recovery 4; sub-frame blend | ImageGen Cycle 05; chroma-key removal/stable-root repack only | Dynamic hand→actual flame ribbon; separate travel/contact/impact | Yes | READY — preload S3 60% |
| CH-INFERNO-HOST | Living watchers/winged silhouettes кульминации | 6–7 | `/assets/characters/character-inferno-host.webp` + `/assets/characters/character-inferno-host-v3.json`, RGBA WebP 1024×683 | Yes | 5 real non-overlapping regions, independent 5.5–8.9 s periods; 1.5 s Stage 6→7 staged reveal | Yes | Region transforms/glow; no whole-plate drift | Spatial crop animation | READY — preload S5 60% |

### Multilayer flame contract

Пламя не является одной картинкой. Renderer независимо рисует core, outer, additive glow, embers/sparks, smoke/heat haze, tap impulse и stage flare. Core/outer меняют реальный authored silhouette по кадрам, а каждый display frame смешивает текущую и следующую authored cell complementary weights с quintic timing, включая last→first seam. Character reaction накладывает только bounded bend/height/brightness/cold-edge поверх продолжающегося authored loop и не сбрасывает его timeline. Seal impulse отсутствует.

Внутри family изменение стадии идёт через непрерывные heat-driven brightness/glow/scale/particle/smoke channels и 8-frame flare. Все 12 соседних upward/downward crossings имеют 1.05 s reversible boundary envelope; family changes дополнительно используют непрерывный root-locked mix не более двух families, а `6→7` длится 1.5 s. Stage 7 использует high family с дополнительным вторым high-core pass; rewarded tint остаётся отдельным состоянием.

### Character state contract

- Servant: `prepare → inhale-ramp → inhale-hold → exhale-start → exhale-ramp → exhale-peak → exhale-fade → exhale-end → recovery`; один normalized strength одновременно управляет ash stream, ember drift и flame reaction.
- Demoness: Stage 4 silhouette не расходует reveal; Stage 5 запускает authored appearance. Спокойный 6.67 s idle и presentation-only disapproval раз в 5–9 s не двигают root. Attack: `cast-look → arms-rise → cast-gather → cold-travel → contact → cold-hold → cold-release → recovery`.
- Cold ribbon начинается у authored hand socket и каждый frame направляется к `FlameRig.getTargetAnchor()`, который учитывает текущие heat/impulse/bend/suppression. Flame reaction использует отдельный `impactStrength=0` до фактического contact; energy возле рук не влияет на огонь заранее.
- Recovery использует authored settle frames: 450 ms Servant и 800 ms Demoness.
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
- Candidate сохраняет загруженные atlases до завершения run/session; worst full residency учитывается целиком, а не маскируется preload-группами.

## Measured budgets

| Budget | Result | Hard limit | Status |
|---|---:|---:|---|
| Startup critical art | 818,566 B | 1.5 MiB | PASS |
| Total registered art | 7,182,484 B | 9.8 MiB | PASS |
| Worst decoded bitmap residency | 65,645,568 B / 62.60 MiB | 64 MiB | PASS, margin is small |
| Both stored audio codec packs | 675,540 B | 2.2 MiB | PASS |
| Largest texture side | 1600 px | 2048 px | PASS |
| Working production package | 8,430,646 B / 71 files | 15 MiB | PASS offline; clean release identity still required |

## Verification status and remaining risk

Automated manifest/hash/magic/dimension/budget checks and atlas state tests pass. Motion quality, loop smoothness, character readability during action and stage transition pop still require exact-build browser video/hashed-frame evidence. Audio files and lifecycle are machine-audited, but classification as «wood fire»/«bellows» and absence of an audible loop seam require two independent real-device listening passes before release.
