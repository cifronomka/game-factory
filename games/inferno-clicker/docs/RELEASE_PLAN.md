# Release Plan — «Зажги»

## Назначение и gate

Документ описывает воспроизводимую production-сборку и упаковку `inferno-clicker` для Yandex Games. Локальный candidate `0.1.0`, принятый в Cycle 07, сохраняется как исторический artifact/rollback baseline. Active Cycle 08 patch candidate ещё не собран, не проверен и не упакован; upload/public publish не разрешены.

Release запрещён, пока каждый применимый пункт `ACCEPTANCE_CRITERIA.md` не имеет `PASS` с evidence, открытые Critical/High не равны нулю либо QA report не завершён. Код и assets внутри `dist/` вручную не исправляются: после любого изменения выполняется полная пересборка из source.

Active gate is Corrective Cycle 08. It supersedes C07 only for Ash Servant/Demoness alpha cleanup, native Demoness clarity, draw-box scale and corresponding evidence. `CORRECTIVE_CYCLE_07.md`, its report and packaged artifact remain historical, but their PASS cannot close new C08 rows. Gameplay, audio, platform, flame/environment and Inferno host may carry forward only when exact frozen fingerprints and full neighboring regression match.

## Версионирование и идентичность

- Схема: Semantic Versioning `MAJOR.MINOR.PATCH`; `0.1.0` — immutable historical C07 baseline, active C08 patch candidate — `0.1.1`.
- Git tag для опубликованной версии: `inferno-clicker-v<version>`.
- Build ID: `<version>+<short-commit-sha>`; commit должен быть clean и идентифицирован полным SHA.
- Release notes source: `games/inferno-clicker/releases/inferno-clicker-<version>-report.md`.
- Release artifacts: ZIP, SHA-256 sidecar, manifest и report должны содержать одну версию/commit. Любое различие блокирует upload.
- C08 candidate зафиксирован как `0.1.1`; он не переиспользует C07 Build ID/artifact filename, а packaging fail-closed отказывается перезаписывать существующий ZIP/checksum.

## Toolchain lock и production build

Runtime зафиксирован в `.nvmrc`: Node.js 24. Production runtime не имеет внешних зависимостей; воспроизводимое authoring/build environment устанавливается `npm ci` по `package-lock.json`, включая `sharp@0.35.3`. Воспроизводимость задаётся exact Node/npm versions, lockfile hash, source commit и hashes build scripts. Release Agent записывает фактические tool versions в report и выполняет из clean checkout:

```text
npm run lint
npm run typecheck
npm test
npm run assets:audit
npm run animation:audit
npm run fingerprint:audit:cycle08
npm run build
npm run test:e2e
npm run release:audit
```

For the C08 candidate, Release Agent runs that contract through `npm run release:gates:cycle08 -- <immutable-log-dir>`, which records all nine required command logs, repeats build/release audit, and fails if the two build manifests differ.

Build contract:

- каждая команда завершается с exit code 0;
- output создаётся только в `games/inferno-clicker/dist/`;
- повторная сборка того же clean commit с теми же зафиксированными tools даёт эквивалентный manifest файлов; допустимые nondeterministic metadata (например timestamp) перечисляются в report;
- production build содержит build ID и не требует dev server;
- runtime не запрашивает local assets за пределами archive root и не зависит от absolute asset URL; официальный Yandex loader `/sdk.js` является единственным root-relative exception;
- bundle/package budgets проходят `AC:PERF-02` и asset budgets — `AC:PERF-08`; frame budgets отдельно проходят `AC:PERF-03`/`AC:PERF-04` по `TECHNICAL_ARCHITECTURE.md` / `ASSET_PLAN.md`.
- `node scripts/assets-audit.mjs` проверяет manifests, пути с учётом регистра, dimensions, codec pairs, forbidden extensions, external SVG references и hard limits с non-zero exit при нарушении.

Если итоговая архитектура утвердит другой package manager или названия scripts, Game Architect обязан атомарно обновить build contract здесь, в `TECHNICAL_ARCHITECTURE.md` и `AC:RLS-01` до начала implementation.

## Pre-release sequence

1. Freeze scope и назначить SemVer/build ID на clean commit.
2. Проверить актуальные официальные Yandex Games package, SDK, ads, leaderboard, localization и content requirements; записать дату и sources в `PLATFORM_REQUIREMENTS.md`.
3. Выполнить clean install, lint, typecheck, automated tests, production build и E2E.
4. Выполнить Cycle 08 audit каждого Servant/Demoness frame: exterior/internal-gap alpha masks, black/dark-red/neutral-gray composites, Demoness native source proof, exact `512×832` cells, runtime `420×700→504×840`, `+20%/+20%`, visible-height ratio `≥1.25`, roots/sockets and exact-scene-transform upscale. Повторить inherited C07 motion/steam, quality-controller, clip-residency and frozen gameplay/audio/platform fingerprint comparisons.
5. Выполнить Gates 1–2 из `QA_PLAN.md`: continuous normal/0.25× motion, full viewport/DPR matrix, three-background exterior/internal composites and first observations before fix disclosure; оформить отдельный issue на каждый independent outer-fringe, internal-residue, erased-highlight, clarity, dimension or ratio defect.
6. Developer исправляет каждый issue на новой exact build и связывает changed paths/tests; автор fix не закрывает issue.
7. Независимый QA owner выполняет targeted full-motion retest и neighboring regression для каждого fix. Любой FAIL возвращает issue Developer; старый candidate считается отозванным.
8. На финальной exact build выполнить independent unlabeled blind sign-off, full regression и 10-minute Stage-7/overlap trace; затем обновить acceptance statuses/evidence. Reviewer подтверждает отсутствие скрытой смены требований.
9. Только когда QA-критерии имеют PASS и остаются лишь package criteria, выполнить `node scripts/package.mjs`, затем создать checksum и release report.
10. Распаковать ZIP в новый temp-каталог, запустить через простой static HTTP server и повторить launch/input/audio/fallback smoke.
11. Загрузить в Yandex test environment, выполнить ENV-Y1/ENV-Y2 smoke; production publish выполняется отдельно после platform acceptance.

## Очистка production output

Из `dist/` и ZIP исключаются:

- `src/`, `tests/`, `docs/`, `visual-references/`, source art/audio masters и internal reports;
- `.env`, `.env.*`, credentials, tokens, cookies, signing data и local platform configuration;
- source maps (`*.map`); их включение потребует отдельного change review и одновременного изменения `AC:RLS-03` до сборки candidate;
- `node_modules/`, package-manager cache, coverage, screenshots, traces, temp files и logs;
- editor/OS metadata (`.DS_Store`, `.idea/`, `.vscode/`), Git files и GitHub workflow files;
- mock/fake SDK, test fixtures, debug overlays, development analytics endpoints и hot-reload client;
- unused assets, duplicate unoptimized masters и files absent from production asset manifest.

Automated audit scans filenames and file content for common secret patterns. Любое совпадение проверяется до упаковки; подтверждённый secret является release blocker.

## Packaging and ZIP structure

Файл: `games/inferno-clicker/releases/inferno-clicker-<version>.zip`.

Корень архива не имеет дополнительной папки-обёртки:

```text
archive-root/
  index.html
  assets/
    <hashed-production-files>
  <other-production-runtime-files-only>
```

Порядок упаковки:

1. Сгенерировать sorted manifest для каждого файла `dist/`: relative path, bytes, SHA-256.
2. Проверить, что `index.html` ровно один и расположен в корне, пути не absolute и не выходят через `..`.
3. Создать ZIP только из содержимого `dist/`, а не из каталога `dist/` как wrapper.
4. Записать размер и SHA-256 ZIP в `.sha256` и report.
5. Распаковать в новый temp directory; сравнить распакованный manifest с исходным `dist/`.
6. Запустить unpacked build через HTTP и выполнить smoke; открытие через `file://` не является acceptance test.

## Historical Cycle 07 checks — closed baseline only

- [x] Идентифицированы clean commit, Build ID, SemVer и зафиксированные tool versions.
- [x] Актуальные требования Yandex Games повторно проверены и задокументированы.
- [x] Clean install, lint, typecheck, tests, production build и E2E завершились с exit code 0.
- [x] Historical C07 PERF-01–PERF-08 и asset budgets имеют PASS.
- [x] Все применимые acceptance criteria имеют PASS с evidence.
- [x] Открытых Critical = 0 и High = 0.
- [x] Полный QA report и regression QA завершены на этой exact build.
- [x] Все reference viewports и visual QA rubric имеют PASS.
- [x] Yandex + Web fallback, persistence, leaderboard и rewarded lifecycle имеют PASS.
- [x] Audio autoplay/mute/focus/ad pause-resume lifecycle имеет PASS.
- [x] `dist/` audit не нашёл secrets, dev-only files, source maps или broken asset references.
- [x] ZIP распакован, manifest совпал и smoke прошёл из нового temp-каталога.
- [x] Entry point, relative paths, MIME expectations и platform package rules проверены.
- [x] Версия внутри build, ZIP filename, tag, manifest и report согласованы.
- [x] Размер ZIP и SHA-256 записаны и перепроверены.
- [x] `node scripts/package.mjs` завершился с exit code 0 и создал ZIP только после QA gate.
- [x] Reviewer и Release Agent подписали release decision.
- [x] Automatic quality downgrade toast count=0; refresh/startup/hidden false downgrade=0.
- [x] Servant scale drift≤2%, mouth steam attachment, Demoness exact-transform upscale≤1.25×/sharpness, two-palm steam, obsolete snow/ice veto, host and white-matte requirements PASS.
- [x] Instant decoded residency≤64 MiB (target≤56 MiB), active-resource release/missing flash/leak=0.
- [x] Gameplay, audio and platform fingerprints equal the signed pre-Cycle-07 baseline.

Cycle 07 checklist остаётся закрытым только для исторического candidate `0.1.0`; ни одна отметка `[x]` выше не переносится как C08 PASS.

## Active Cycle 08 checks before packaging/upload

- [x] Patch SemVer назначен: `0.1.1`; historical C07 ZIP/report/checksum не изменены. Exact clean Build ID ещё NOT RUN.
- [ ] Все affected Servant/Demoness frames имеют genuine exterior/internal-gap alpha; approved-mask and decoded-WebP alpha SHA-256 match exactly (`changed/max-error/low-alpha-leak=0`), Servant detached contour tiles=0; на black/dark-red/neutral-gray visible white matte/fringe/islands/sticker edge=0, настоящие светлые детали сохранены.
- [ ] Demoness redrawn from approved reference at native-or-higher resolution; every cell exactly `512×832` RGBA; evidence исключает апскейл C07 raster; face/crown/hair/hands/armor sharpness PASS.
- [ ] Runtime draw box in every Demoness state exactly `504×840` against C07 `420×700`; deltas `+20%/+20%`; feet/root stable and growth primarily upward.
- [ ] Minimum visible Demoness/Servant alpha-bbox height ratio across states/viewports/DPR is `≥1.25`; critical HUD/flame overlap and clipping=0; effective upscale≤1.25×.
- [ ] Recomputed root/mouth/two-palm sockets preserve C07 scale and steam attachment in normal/reduced/forced-low, solo/concurrent and pause/resume cases.
- [ ] New atlas/package/residency audit passes: texture side≤2048, exactly one full Demoness atlas + one bounded frame-cache, decoded hard≤64 MiB, package≤15 MiB.
- [ ] Paired C07/C08 core replay and gameplay/audio/platform/flame/environment/host fingerprints prove no out-of-scope change.
- [ ] Ordered C08 QA/fix/retest/regression/blind workflow and C08 validator/negative fixtures PASS on one exact candidate; every new AC row PASS, skipped=0, Critical=0/High=0.
- [ ] Only after the preceding items: clean build/package, ZIP checksum, unpacked HTTP smoke, release report and Reviewer/Release Agent signatures complete.

Until every item is checked with C08 evidence, packaging, test-environment upload and publication are blocked.

## Release report contract

Сохранить как `games/inferno-clicker/releases/inferno-clicker-<version>-report.md`:

- title, version, Build ID, full commit SHA, tag, build date/timezone и owners;
- OS, exact Node.js/npm versions, production `zero external dependencies`, authoring dependency и lockfile hash, а также executed commands with exit codes;
- production `dist/` manifest path/hash и reproducibility comparison result;
- QA report path, acceptance decision и counts of open issues by severity;
- list of regression runs и exact tested environments/browser versions;
- ZIP filename, byte size, SHA-256 и unpacked-manifest comparison;
- Yandex test-environment result и platform requirement validation date;
- known limitations только если noncritical и явно approved Product + QA + Reviewer;
- upload/publish status, platform submission identifier и rollback reference.
- C08-specific before/after alpha evidence, native Demoness source/cell proof, exact draw-size and visible-bbox matrix, accepted C07 baseline hashes, and the C08 validator/signoff result.

## Rollback and post-upload smoke

- Rollback target is the last previously accepted ZIP and its checksum; для первого release rollback означает unpublish/disable distribution согласно capability платформы.
- Keep prior accepted artifact/report; never rebuild an old version from an unverified working tree.
- После upload, но до public release, повторить launch, one tap/click, mute, pause/resume, local save/load, leaderboard unavailable/success path as available и rewarded success/cancel path в Yandex test environment.
- Любой new fatal/console error, package-path failure, data-loss symptom, stuck ad pause или score submission regression переоткрывает gate, увеличивает candidate build metadata и перезапускает затронутую regression.

## Current candidate decision and risks

- Release readiness: `NOT READY — CYCLE 08 NOT RUN`; no C08 candidate is authorized for packaging, upload or publication.
- Art/audio payload may threaten startup and stage-7 memory budgets; mitigation — manifest budgets, staged loading and PERF-01–PERF-09 gate.
- Yandex APIs/policies may change before integration; mitigation — source/date revalidation immediately before adapter work and again before upload.
- Reward callback race may duplicate a boost or leave audio paused; mitigation — idempotent lifecycle contract and `QA:R-01…R-07` / `AC:Y-09` / `AC:Y-10` / `AC:A-07` / `AC:A-08` tests.
- New production ZIP/tag/upload разрешаются только после финального C08 gate; historical C07 artifact remains untouched as rollback evidence.
- Additional authored frames can exceed decoded memory despite a small package; mitigation is independently disposable clip resources and `AC:PERF-08`, not keeping all atlases resident.
