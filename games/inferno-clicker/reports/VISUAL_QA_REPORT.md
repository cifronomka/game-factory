# Visual QA Report — «Зажги», corrective cycle 04

Дата: 2026-08-20
Решение: **IMPLEMENTATION SLICE PASS / EXACT TEMPORAL SIGN-OFF PENDING**.

## Что проверено

- Servant сохраняет прежний образ/anchor, но полный action теперь состоит из prepare, inhale ramp/hold, exhale start/ramp/peak/fade/end и recovery. Один `exhaleStrength` синхронизирует персонажа, ash stream, ember drift и реакцию огня.
- Demoness выше Servant, сохраняет clear flame lane, двигается медленно и властно. Idle работает на 1.2 fps, presentation-only disapproval запускается раз в 5–9 active seconds, cold cast имеет отдельные look/raise/gather/ramp/hold/release/recovery phases.
- V3 character atlases имеют lossless alpha, stable root, gutters и coherent whole-body frames. Дефектные v4 ImageGen candidates отклонены.
- Concurrent debuffs отображаются двумя отдельными карточками с character/effect/factor/time и optional total `×2,50`.
- Inferno host имеет пять addressable regions с разными периодами/фазами; whole-plate-only drift отсутствует. Stage 6→7 использует bounded 1.5-second reveal/payoff.

## Автоматическая temporal evidence

| Проверка | Результат |
|---|---|
| Character atlas alpha/root/centroid/fragment geometry | PASS |
| Exact Servant and Demoness phase maps | PASS |
| Recovery, active-effect stage-down, pause freeze and re-entry | PASS |
| Independent host clocks and calm reduced-motion animation | PASS |
| Flame reaction does not reset authored flame loop | PASS |
| Concurrent reaction/source preservation | PASS |
| Local head/crown disapproval gesture without whole-body transform | PASS |
| Stage 6→7 composed flame/rune/light/host entry contract | PASS |

## Не переносить как PASS

Cycle 02/03 stills и contact sheets являются historical material. Формальный visual PASS возможен только для fresh clean exact build после просмотра полного Servant cycle, ≥18 s Demoness idle/disapproval + full cast, three debuff states, Stage 6→7 entry и sustained Inferno. Authoritative artifacts и независимые verdicts должны находиться в `reports/animation-qa/<build-id>/`.

Open visual Critical: 0. Open visual High после implementation review: 0.
