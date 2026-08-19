# Asset Plan — «Зажги»

## Corrective Cycle 02 baseline

Этот документ описывает фактически подключённый candidate после пользовательского review 2026-08-20. Старые одиночные flame cards, статичные cutouts Пепельного слуги/Демонессы и `audio/fire-loop.*` удалены. Concept art остаётся только художественным ориентиром и не используется как плоский экран.

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
| CH-ASH-SERVANT | Отдельный живой персонаж и видимая атака на пламя | 3–7 | `/assets/characters/ash-servant/ash-servant-states-v2.webp` + JSON, 1536×1024 | Yes | 6-frame rows: appearance 10 fps once, idle 8 fps loop, inhale 10 fps once, blow 10 fps loop | Yes | Отдельный bounded ash stream | Yes | READY — preload S2 60% |
| CH-DEMONESS | Отдельный живой персонаж и угашающая атака | 4–7 | `/assets/characters/demoness/demoness-states-v2.webp` + JSON, 1536×1024 | Yes | 6-frame rows: appearance 10 fps once, idle 8 fps loop, cast 10 fps once, hold 10 fps loop | Yes | Отдельная cold ribbon/aura | Yes | READY — preload S3 60% |
| CH-INFERNO-HOST | Watchers/winged silhouettes кульминации | 6–7 | `/assets/characters/character-inferno-host.webp`, RGBA WebP 1024×683 | Yes | Reveal + restrained drift | Yes | Transform only | No | READY — preload S5 60% |

### Multilayer flame contract

Пламя не является одной картинкой. Renderer независимо рисует core, outer, additive glow, embers/sparks, smoke/heat haze, tap impulse, seal impulse и stage flare. Core/outer меняют реальный authored silhouette по кадрам. Tap не ускоряет sprite timeline: visual impulse агрегируется presentation-слоем и не меняет gameplay. `SpriteAnimator` использует application clock; pause/background замораживают кадры без catch-up.

Внутри family изменение стадии идёт через непрерывный heat-driven размер/свет и 8-frame flare. На границах `2↔3` и `5↔6` одновременно выполняется root-locked crossfade соседних authored families. Stage 7 использует high family с дополнительным вторым high-core pass; rewarded tint остаётся отдельным состоянием.

### Character state contract

- Servant: первое появление проигрывает `appearance`, затем `idle`; telegraph выбирает `inhale`, effect — `blow` и ash stream от персонажа к outer flame.
- Demoness: первое появление проигрывает `appearance`, затем `idle`; telegraph выбирает `cast`, effect — `hold` и cold ribbon к очагу.
- Окончание действия возвращает персонажа в `idle`; отдельный recovery asset в этом candidate не используется и не заявляется.
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
| Total registered art | 6,255,308 B | 9.8 MiB | PASS |
| Worst decoded bitmap residency | 64,269,312 B / 61.29 MiB | 64 MiB | PASS, margin is small |
| Both stored audio codec packs | 675,540 B | 2.2 MiB | PASS |
| Largest texture side | 1600 px | 2048 px | PASS |
| Working production package | 7,153,769 B / 70 files | 15 MiB | PASS offline; clean release identity still required |

## Verification status and remaining risk

Automated manifest/hash/magic/dimension/budget checks and atlas state tests pass. Motion quality, loop smoothness, character readability during action and stage transition pop still require exact-build browser video/hashed-frame evidence. Audio files and lifecycle are machine-audited, but classification as «wood fire»/«bellows» and absence of an audible loop seam require two independent real-device listening passes before release.
