# Release Plan — «Зажги»

## Назначение и gate

Документ описывает воспроизводимую production-сборку и упаковку `inferno-clicker` для Yandex Games. Implementation candidate `0.1.0` собирается локально; ZIP и upload остаются закрыты release gate до завершения QA, regression и применимых acceptance checks.

Release запрещён, пока каждый применимый пункт `ACCEPTANCE_CRITERIA.md` не имеет `PASS` с evidence, открытые Critical/High не равны нулю либо QA report не завершён. Код и assets внутри `dist/` вручную не исправляются: после любого изменения выполняется полная пересборка из source.

Active gate is Corrective Cycle 07. Cycle 02–06 reports cannot be carried forward for changed character scale/sharpness/effects/evidence workflow. `CORRECTIVE_CYCLE_06.md` remains historical. Gameplay, audio and platform may carry forward only when exact frozen fingerprints and full neighboring regression match.

## Версионирование и идентичность

- Схема: Semantic Versioning `MAJOR.MINOR.PATCH`; первый планируемый production candidate — `0.1.0` до явного решения о стабильном `1.0.0`.
- Git tag для опубликованной версии: `inferno-clicker-v<version>`.
- Build ID: `<version>+<short-commit-sha>`; commit должен быть clean и идентифицирован полным SHA.
- Release notes source: `games/inferno-clicker/releases/inferno-clicker-<version>-report.md`.
- Release artifacts: ZIP, SHA-256 sidecar, manifest и report должны содержать одну версию/commit. Любое различие блокирует upload.

## Toolchain lock и production build

Runtime зафиксирован в `.nvmrc`: Node.js 24. External dependencies и package manager отсутствуют; поэтому lockfile не создаётся, а воспроизводимость задаётся Node major, source commit и hashes build scripts. Release Agent записывает фактическую Node version в report и выполняет из clean checkout:

```text
node scripts/lint.mjs
node scripts/typecheck.mjs
node scripts/test.mjs
node scripts/build.mjs
node scripts/e2e-smoke.mjs
```

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
4. Выполнить Cycle 07 Servant scale/landmark, mouth/two-palm socket, obsolete snow/ice, alpha-edge и exact-scene-transform Demoness upscale audits; повторить inherited quality-controller, clip-residency and frozen gameplay/audio/platform fingerprint comparisons.
5. Выполнить Gates 1–2 из `QA_PLAN.md`: continuous normal/0.25× motion, full viewport/DPR matrix, three-background edge composites, first observations before fix disclosure; оформить отдельный issue на каждый независимый defect.
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

## Checks before upload

- [x] Идентифицированы clean commit, Build ID, SemVer и зафиксированные tool versions.
- [x] Актуальные требования Yandex Games повторно проверены и задокументированы.
- [x] Clean install, lint, typecheck, tests, production build и E2E завершились с exit code 0.
- [x] PERF-01–PERF-09 и asset budgets имеют PASS.
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

Cycle 07 checklist закрыт для финального clean exact candidate: automation, production-browser viewport review, asset/animation audits, frozen gameplay/audio/platform regression и formal evidence validation обязательны и перечисляются в release report. Production publication в каталоге платформы остаётся отдельным внешним действием.

## Release report contract

Сохранить как `games/inferno-clicker/releases/inferno-clicker-<version>-report.md`:

- title, version, Build ID, full commit SHA, tag, build date/timezone и owners;
- OS, exact Node.js version, `N/A — zero external dependencies` для package-manager/lockfile и executed commands with exit codes;
- production `dist/` manifest path/hash и reproducibility comparison result;
- QA report path, acceptance decision и counts of open issues by severity;
- list of regression runs и exact tested environments/browser versions;
- ZIP filename, byte size, SHA-256 и unpacked-manifest comparison;
- Yandex test-environment result и platform requirement validation date;
- known limitations только если noncritical и явно approved Product + QA + Reviewer;
- upload/publish status, platform submission identifier и rollback reference.

## Rollback and post-upload smoke

- Rollback target is the last previously accepted ZIP and its checksum; для первого release rollback означает unpublish/disable distribution согласно capability платформы.
- Keep prior accepted artifact/report; never rebuild an old version from an unverified working tree.
- После upload, но до public release, повторить launch, one tap/click, mute, pause/resume, local save/load, leaderboard unavailable/success path as available и rewarded success/cancel path в Yandex test environment.
- Любой new fatal/console error, package-path failure, data-loss symptom, stuck ad pause или score submission regression переоткрывает gate, увеличивает candidate build metadata и перезапускает затронутую regression.

## Current candidate decision and risks

- Release readiness: `NOT READY — implementation candidate; browser/Yandex environment gates pending`.
- Art/audio payload may threaten startup and stage-7 memory budgets; mitigation — manifest budgets, staged loading and PERF-01–PERF-09 gate.
- Yandex APIs/policies may change before integration; mitigation — source/date revalidation immediately before adapter work and again before upload.
- Reward callback race may duplicate a boost or leave audio paused; mitigation — idempotent lifecycle contract and `QA:R-01…R-07` / `AC:Y-09` / `AC:Y-10` / `AC:A-07` / `AC:A-08` tests.
- Production ZIP/tag/upload разрешаются только после финального gate; build и QA reports создаются до него.
- Additional authored frames can exceed decoded memory despite a small package; mitigation is independently disposable clip resources and `AC:PERF-08`, not keeping all atlases resident.
