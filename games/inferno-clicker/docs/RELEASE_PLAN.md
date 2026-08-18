# Release Plan — «Зажги»

## Назначение и gate

Документ описывает будущую воспроизводимую production-сборку и упаковку `inferno-clicker` для Yandex Games. Сейчас planning stage: сборка, ZIP, upload и release report не создавались. Release Agent начинает исполнение только после implementation, platform integration, QA, fix cycle и regression QA.

Release запрещён, пока каждый применимый пункт `ACCEPTANCE_CRITERIA.md` не имеет `PASS` с evidence, открытые Critical/High не равны нулю либо QA report не завершён. Код и assets внутри `dist/` вручную не исправляются: после любого изменения выполняется полная пересборка из source.

## Версионирование и идентичность

- Схема: Semantic Versioning `MAJOR.MINOR.PATCH`; первый планируемый production candidate — `0.1.0` до явного решения о стабильном `1.0.0`.
- Git tag для опубликованной версии: `inferno-clicker-v<version>`.
- Build ID: `<version>+<short-commit-sha>`; commit должен быть clean и идентифицирован полным SHA.
- Release notes source: `games/inferno-clicker/releases/inferno-clicker-<version>-report.md`.
- Release artifacts: ZIP, SHA-256 sidecar, manifest и report должны содержать одну версию/commit. Любое различие блокирует upload.

## Toolchain lock и production build

На implementation stage должны быть зафиксированы exact Node.js major/minor в репозитории, package-manager version и lockfile. Release Agent записывает фактические версии в report и выполняет из clean checkout:

```text
npm ci
npm run lint
npm run typecheck
npm test
npm run build
npm run test:e2e
```

Build contract:

- каждая команда завершается с exit code 0;
- output создаётся только в `games/inferno-clicker/dist/`;
- повторная сборка того же clean commit с теми же зафиксированными tools даёт эквивалентный manifest файлов; допустимые nondeterministic metadata (например timestamp) перечисляются в report;
- production build содержит build ID и не требует dev server;
- runtime не запрашивает assets за пределами archive root и не зависит от absolute URL;
- bundle/package budgets проходят PERF-02–PERF-04 и соответствующие лимиты `TECHNICAL_ARCHITECTURE.md` / `ASSET_PLAN.md`.
- `npm run assets:audit` или согласованный эквивалент проверяет manifests, пути с учётом регистра, dimensions, codec pairs, forbidden extensions, external SVG references и hard limits с non-zero exit при нарушении.

Если итоговая архитектура утвердит другой package manager или названия scripts, Game Architect обязан атомарно обновить build contract здесь, в `TECHNICAL_ARCHITECTURE.md` и AC-01 до начала implementation.

## Pre-release sequence

1. Freeze scope и назначить SemVer/build ID на clean commit.
2. Проверить актуальные официальные Yandex Games package, SDK, ads, leaderboard, localization и content requirements; записать дату и sources в `PLATFORM_REQUIREMENTS.md`.
3. Выполнить clean install, lint, typecheck, automated tests, production build и E2E.
4. Запустить полный QA plan на точной production build, оформить issues.
5. Для каждого fix создать новую build, выполнить targeted retest и neighboring regression; старый candidate считается отозванным.
6. После полного regression обновить все acceptance statuses и evidence. Reviewer подтверждает отсутствие скрытой смены требований.
7. Только когда QA-критерии имеют PASS и остаются лишь package criteria, выполнить `npm run package`, затем создать checksum и release report.
8. Распаковать ZIP в новый temp-каталог, запустить через простой static HTTP server и повторить launch/input/audio/fallback smoke.
9. Загрузить в Yandex test environment, выполнить ENV-Y1/ENV-Y2 smoke; production publish выполняется отдельно после platform acceptance.

## Очистка production output

Из `dist/` и ZIP исключаются:

- `src/`, `tests/`, `docs/`, `visual-references/`, source art/audio masters и internal reports;
- `.env`, `.env.*`, credentials, tokens, cookies, signing data и local platform configuration;
- source maps (`*.map`), если отдельное security/release решение не разрешило их;
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

- [ ] Идентифицированы clean commit, Build ID, SemVer и зафиксированные tool versions.
- [ ] Актуальные требования Yandex Games повторно проверены и задокументированы.
- [ ] Clean install, lint, typecheck, tests, production build и E2E завершились с exit code 0.
- [ ] PERF-01–PERF-09 и asset budgets имеют PASS.
- [ ] Все применимые acceptance criteria имеют PASS с evidence.
- [ ] Открытых Critical = 0 и High = 0.
- [ ] Полный QA report и regression QA завершены на этой exact build.
- [ ] Все reference viewports и visual QA rubric имеют PASS.
- [ ] Yandex + Web fallback, persistence, leaderboard и rewarded lifecycle имеют PASS.
- [ ] Audio autoplay/mute/focus/ad pause-resume lifecycle имеет PASS.
- [ ] `dist/` audit не нашёл secrets, dev-only files, source maps или broken asset references.
- [ ] ZIP распакован, manifest совпал и smoke прошёл из нового temp-каталога.
- [ ] Entry point, relative paths, MIME expectations и platform package rules проверены.
- [ ] Версия внутри build, ZIP filename, tag, manifest и report согласованы.
- [ ] Размер ZIP и SHA-256 записаны и перепроверены.
- [ ] `npm run package` завершился с exit code 0 и создал ZIP только после QA gate.
- [ ] Reviewer и Release Agent подписали release decision.

На planning stage все пункты checklist не отмечены и считаются `NOT RUN`.

## Release report contract

Сохранить как `games/inferno-clicker/releases/inferno-clicker-<version>-report.md`:

- title, version, Build ID, full commit SHA, tag, build date/timezone и owners;
- OS, exact Node.js/package-manager versions, lockfile hash и executed commands with exit codes;
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

## Planning-stage decision and risks

- Release readiness: `NOT READY — planning only`.
- Art/audio payload may threaten startup and stage-7 memory budgets; mitigation — manifest budgets, staged loading and PERF-01–PERF-09 gate.
- Yandex APIs/policies may change before integration; mitigation — source/date revalidation immediately before adapter work and again before upload.
- Reward callback race may duplicate a boost or leave audio paused; mitigation — idempotent lifecycle contract and R/AC-P tests.
- No production ZIP, tag, report or upload is authorized by this document at the current stage.
