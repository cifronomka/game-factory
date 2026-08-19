# Audio Direction — «Зажги»

## Corrective Cycle 02

Пользовательский review 2026-08-20 классифицировал прежний `Fire Loop by qubodup` как газовую горелку. Этот OGG/FLAC удалён. Новый candidate использует два полевых fire layers и три коротких fanning variants: игрок должен слышать дерево/угли и ощущать, что раздувает огонь опахалом, а не нажимает arcade-кнопку.

## Runtime sources

| Layer | Assets | Role |
|---|---|---|
| Wood/ember bed | `assets/audio/fire/embers-wood-bed.{ogg,mp3}` | Основной 29.26 s fire loop |
| Charcoal crackle | `assets/audio/fire/charcoal-crackle.{ogg,mp3}` | Негромкий 3.59 s crackle loop |
| Fanning A/B/C | `assets/audio/fan/fan-soft-{a,b,c}.{ogg,mp3}` | Три 0.75 s варианта раздувания |

OGG Vorbis — primary, MP3 — matching browser fallback. Runtime не загружает внешние URL; source pages, авторы, CC0, edits и hashes записаны в `assets/PROVENANCE.md`, `assets/AUDIO_CREDITS.txt` и manifest.

## Sound character

- Wood bed: uneven dry crackle, ember body и open-air space; steady jet hiss, propane roar и tonal hum запрещены.
- Crackle: редкие transient pops ниже уровня основного действия; слой не должен превращаться в короткий очевидный loop.
- Fanning: мягкий широкий air push с быстрым входом и длинным спадом; не click, laser, pitched sweep или одинаковый per-tap whoosh.
- Taps не создают pitch ladder, score jingle или hidden rhythm cue.
- Stage и character one-shots не входят в текущий candidate registry и не заявляются как реализованные.

## Tap aggregation

Gameplay продолжает принимать каждый valid tap. Audio получает те же `tap-accepted` events, но только presentation-слой:

1. собирает их в 120 ms окно;
2. выбирает один из трёх fanning buffers;
3. не стартует новый fan чаще чем раз в 180 ms;
4. допускает максимум 2 одновременных fan voices;
5. меняет gain в ограниченном диапазоне по размеру burst, не меняя playback rate или core state.

Таким образом частое раздувание слышимо, но не становится пулемётом и не влияет на heat/score.

## Runtime graph

```text
wood loop ─────┐
crackle loop ──┴→ ambienceBus ─┐
fan voices ─────→ fanBus ──────┼→ master → destination
                               └→ mute/pause envelope
```

- После trusted gesture assets загружаются одной coalesced попыткой.
- OGG decode failure пробует соответствующий MP3; неудача конкретной пары даёт silence без refetch на каждый tap.
- Максимум 2 ambience + 2 fan sources; `AudioMixerState` hard cap — 10 voices.
- Stage увеличивает ambienceBus в узком диапазоне; tap rate не управляет EQ/pitch/loop cadence.
- Reduced sensory снижает ambience/fan gains, сохраняя visual feedback.

## Lifecycle

1. До trusted gesture не создаётся playable source и не возникает autoplay rejection.
2. Menu, visibility, platform и ad reasons образуют set. Первый reason плавно глушит master ≤100 ms, последний resume возвращает его за 250 ms.
3. Pause очищает pending fan window; после resume нет catch-up burst.
4. Mute имеет приоритет над resume.
5. Destroy останавливает loops/voices, очищает timers и закрывает context; late decode не может создать source.

## Objective QA

### Automated

- OGG/MP3 magic, bytes, hashes, durations, license and credits match manifest.
- `createOscillator`, generated noise, pitch ladder и legacy `fire-loop.*` references в production source = 0.
- Repeated unlock starts exactly two ambience sources once.
- Failed decode performs one bounded codec pass and does not refetch on later taps.
- 100 rapid taps preserve gameplay events while fan starts follow 120/180 ms limits; active fan voices ≤2.
- Pause/mute/destroy/resume rejection paths produce no unhandled promise and no duplicate source.

### Perceptual

Нужны два независимых слушателя на exact build:

1. Оба классифицируют base bed как «дерево/угли/открытый огонь»; ответ «газ/горелка/факел/струя» = FAIL.
2. Оба слышат при серии taps раздувание/опахало; «клик/лазер/ритм/синтетический свист» = FAIL.
3. За 10 минут нет audible seam click/pop, раздражающего high hiss или fatigue >2/5.
4. Mute, background и provider pause дают тишину; resume не даёт burst.

## Mix guardrails

- Master decoded/mixed peak должен оставаться ≤−1 dBFS.
- Wood bed ниже fanning attention; crackle значительно тише wood bed.
- Fanning gain capped, variants rotate; одновременная сумма не должна маскировать HUD/system audio.
- Компрессор/limiter не используется для превращения плохого steady hiss в «огонь».

## Status and risk

Registry, codec fallback, source lifecycle и aggregation покрыты автоматическими тестами. Субъективное соответствие «не газовая горелка» и отсутствие loop seam ещё не являются PASS: это внешний listening gate до release. Если новый bed снова воспринимается как газовый, меняется сам source asset, а не EQ поверх него.
