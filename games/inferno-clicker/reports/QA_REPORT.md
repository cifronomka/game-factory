# QA Report — «Зажги», corrective cycle 04

Дата: 2026-08-20 (Europe/Moscow)
Кандидат: Cycle 04 source candidate; authoritative exact-build identity хранится в `reports/animation-qa/index.json` после clean build.
Node: `24.19.0`
Решение: **IMPLEMENTATION VALIDATION PASS / EXACT-BUILD REGRESSION PENDING**.

## Pass 1 — implementation validation

| Проверка | Результат |
|---|---|
| `node scripts/typecheck.mjs` | PASS — 37 browser modules |
| `node scripts/lint.mjs` | PASS — 79 modules |
| `node scripts/test.mjs` | PASS — 139/139, skipped 0 |
| `node scripts/assets-audit.mjs` | PASS — 11 bitmaps; 818,566 B critical / 7,456,934 B art / 65,448,960 B decoded; 10 audio files / 675,540 B |
| `node scripts/animation-assets-audit.mjs` | PASS — 10 atlases |
| `node scripts/build.mjs` | PASS — 70 runtime files |
| `node scripts/release-audit.mjs` | PENDING — должен выполняться после final clean commit |

## Проверенная логика Cycle 04

- Every-valid-tap core, scoring, persistence and platform adapters сохранены; `requiresBoost`, seal и иные progression permissions отсутствуют.
- V5 no-reward и optional-boost traces совпадают на 60/30/15 FPS. No-reward достигает Stage 7 в `164,800 ms`; boost лишь ускоряет вход и увеличивает score/hold.
- Servant и Demoness имеют независимые schedules/timers. Одновременный factor вычисляется как `min(2.50, 1.80 × 1.50) = 2.50`; taps не отменяют hazards.
- HUD получает `debuffs[]` и строит две отдельные source rows. Общий factor отображается отдельно и не подменяет источники.
- Servant использует длинную phase curve inhale/exhale/recovery; flame bend, ash stream и ember drift получают одну strength curve.
- Demoness использует calm idle, presentation-only disapproval, deliberate cast/cold/recovery; Stage-4 silhouette не расходует appearance.
- Inferno host разбит на пять independently animated regions; Stage 6→7 payoff ограничен 1.5 s.

## Browser findings и fixes

Exploratory production-browser regression дошёл до Inferno без reward через реальный pointer path. В отдельном paired run explicit Web test provider активировал один ×2 на 20 active seconds. Console warnings/errors: 0.

Найден и исправлен High-кандидат `C04-UI-01`: при одновременных Servant/Demoness statuses landscape-grid мог выталкивать карточки за правую границу. Signals column и status list получили bounded `width/max-width/min-width`; после fix обе строки и capped total присутствуют одновременно.

Найден и исправлен High-кандидат `C04-ANIM-01`: v2 character atlases содержали root drift, frame-edge alpha и fragmented Demoness cells. V3 lossless repack имеет stable pivot/gutters и проверяется geometry/metadata audit.

Первый независимый temporal review нашёл и после отдельного fix/retest закрыл ещё четыре presentation-регрессии: `C04-ANIM-02` recovery больше не исчезает при stage-down, включая active Demoness effect на Stage 4; `C04-ANIM-03` Reduced Motion сохраняет спокойное независимое host motion; `C04-ANIM-04` coldStrength уменьшает не только flame height/color, но и tap/ambient sparks; `C04-ANIM-05` disapproval использует неподвижное тело и отдельно перемещаемый head/crown crop вместо whole-body pose shuffle. Stage 6→7 composed entry дополнен expanding high-flame overlay, rune activation wave и bounded screen impulse.

Соседний mapper-contract также синхронизирован: active Demoness encounter имеет приоритет над Stage-4 silhouette и покрыт отдельными mapper + CharacterScene regression tests.

ImageGen v4 Demoness candidates с baked matte и нежелательной сексуализацией отклонены и не попали в runtime/manifest.

## Passes и evidence

Pass 1 выполнен на source candidate. Pass 2 independent temporal review и Pass 3 exact-build full regression должны ссылаться на immutable evidence directory `reports/animation-qa/<build-id>/`; текущие historical Cycle 02/03 кадры не засчитываются. До появления clean exact identity этот файл не заявляет release PASS.

Open implementation Critical: 0. Open implementation High после локального regression: 0. Финальный независимый recheck и exact-browser evidence остаются обязательны.
