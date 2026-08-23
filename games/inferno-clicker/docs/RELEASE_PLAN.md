# Release Plan — «Зажги»

## Назначение и gate

Документ описывает воспроизводимую production-сборку и упаковку `inferno-clicker` 1.0.0 для Yandex Games. Исторические 0.1.0/0.1.1 artifact/report/checksum сохраняются неизменяемыми rollback records. Active Yandex Cycle 09 candidate ещё не имеет финального Build ID/ZIP/draft evidence; upload на модерацию и public publish не разрешены.

Финальное продвижение запрещено, пока каждый применимый пункт `ACCEPTANCE_CRITERIA.md` не имеет `PASS` с evidence, открытые Critical/High не равны нулю либо QA report не завершён. Локальный `-rc.zip` допустим только при `PASS` локальных критериев, точных `BLOCKED_EXTERNAL` для недоступных Console/browser/real-device проверок и machine stop report с тремя подписями; такой RC имеет `promotable=false`. Код и assets внутри `dist/` вручную не исправляются: после любого изменения выполняется полная пересборка из source.

Active gate is `YANDEX_RELEASE_CYCLE_09.md`. C08 может служить baseline только после identity/fingerprint check; его PASS не закрывает rewarded, localization, SDK/data, compatibility, content/visual, submission или draft rows.

## Версионирование и идентичность

- Схема: Semantic Versioning `MAJOR.MINOR.PATCH`; 0.1.0/0.1.1 — immutable historical artifacts, active public-ready candidate — `1.0.0`.
- Git tag для опубликованной версии: `inferno-clicker-v<version>`.
- Build ID: `<version>+<short-commit-sha>`; commit должен быть clean и идентифицирован полным SHA.
- Submission working template: `releases/yandex-submission-1.0.0/release-report.md`; it is not release evidence.
- `package:yandex` generates the exact local report `releases/inferno-clicker-1.0.0-rc-report.md` from audited package bytes. Only post-draft promotion may create `releases/inferno-clicker-1.0.0-report.md` for the unchanged SHA.
- Release artifacts: ZIP, SHA-256 sidecar, manifest и report должны содержать одну версию/commit. Любое различие блокирует upload.
- Cycle 09 Build ID использует `1.0.0+` и первые 12 hex exact commit (`NOT RUN — финальный commit ещё не выбран`) и не переиспользует historical filenames; packaging fail-closed отказывается перезаписывать любой существующий ZIP/checksum.

## Toolchain lock и production build

Runtime зафиксирован в `.nvmrc`: Node.js 24. Production runtime не имеет внешних зависимостей; воспроизводимое authoring/build environment устанавливается `npm ci` по `package-lock.json`. Воспроизводимость задаётся exact Node/npm versions, lockfile hash, source commit и hashes build scripts. Историческая C08 команда ниже остаётся rollback-справкой и не является активным Yandex gate:

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

## Active Cycle 09 build contract

Процесс двухпроходный. Сначала clean diagnostic commit проходит полный gate/capture; его evidence используется независимым QA/Reviewer только для issue→fix→retest, Human-Eye verdict и подготовки AC, но не для packaging. Эти review/docs-файлы коммитятся отдельно. Затем второй clean exact commit заново выполняет единый `npm run release:gates:yandex` (lint, typecheck, full tests, deterministic asset builders/manifests, compatibility, visual matrices, mocked-SDK browser E2E, production build, environment audit, четыре ≥12-minute traces, `release:audit:yandex` и повторную сборку). После второго gate tracked-файлы больше не меняются: exact QA/Reviewer/Release sign-offs и machine stop report сохраняются в ignored evidence directory, только затем выполняется `npm run package:yandex`. Отдельные public interfaces: `build:yandex`, `test:yandex`, `release:audit:yandex`, `package:yandex`, `verify:draft:yandex`.

Две независимые `build:yandex` одного commit/toolchain должны дать эквивалентный sorted manifest. Candidate ZIP создаётся один раз, получает SHA-256, распаковывается в новый temp directory и проходит HTTP smoke. Именно эти bytes загружаются в Yandex draft и после verification без rebuild копируются/переименовываются в `releases/inferno-clicker-1.0.0.zip`.

## Pre-release sequence

1. Freeze scope, SemVer 1.0.0 и clean exact source commit; повторно проверить SHA rollback 0.1.1.
2. Зафиксировать актуальные официальные Yandex Games package, SDK, ads, leaderboard, localization и content requirements с датой/sources.
3. Завершить implementation и deterministic tests для rewarded 60/90/repeat, goals, RU/EN, SDK lifecycle, cloud/leaderboard, compatibility и responsive input.
4. Выпустить только versioned visual fixes; выполнить 64-frame black/gray/red DPR1/2/3, seven-stage normal/reduced/forced-low и transition-flare audits.
5. Оформить каждый дефект в Cycle 09 issue ledger; Developer/Art выполняет fix, другой QA — targeted retest и neighboring regression.
6. Снять submission media заново с exact source fingerprint, синхронизировать hashes и получить независимый Human-Eye sign-off каждого из 10 файлов.
7. На первом clean diagnostic commit выполнить полный gate/capture, включая четыре реальные по времени ≥12-minute sessions desktop/mobile × rewarded/no-rewarded; независимый Reviewer проверяет exact hashes, QA закрывает ledger/AC, затем review/docs коммитятся. Этот проход никогда не упаковывается.
8. На втором clean exact commit повторить полный `release:gates:yandex`. Непреодолимый compositor/browser/device blocker не ослабляет числовой порог и записывается `BLOCKED_EXTERNAL`; проверить immutable inventory, после чего QA, independent Reviewer и Release Agent подписывают exact Build ID вне tracked source. Critical=0, High=0, skipped=0.
9. Создать один атомарно валидированный `inferno-clicker-1.0.0-rc.zip`; две временные упаковки обязаны дать одинаковые bytes, fresh extraction/inventory/hash/owned ephemeral HTTP smoke — PASS.
10. При авторизованном доступе загрузить эти точные RC bytes в новый Yandex draft и выполнить Desktop/mobile RU/EN SDK/Game Ready, lifecycle, real rewarded, guest/authorized cloud и leaderboard checks.
11. Только после совпадения draft-tested SHA без rebuild разрешено скопировать те же bytes в `inferno-clicker-1.0.0.zip`. Moderation/publication требуют отдельного разрешения пользователя.

## Очистка production output

Из `dist/` и ZIP исключаются:

- `src/`, `tests/`, `docs/`, `visual-references/`, source art/audio masters и internal reports;
- `.env`, `.env.*`, credentials, tokens, cookies, signing data и local platform configuration;
- source maps (`*.map`); их включение потребует отдельного change review и одновременного изменения `C09-RLS-02` до сборки candidate;
- `node_modules/`, package-manager cache, coverage, screenshots, traces, temp files и logs;
- editor/OS metadata (`.DS_Store`, `.idea/`, `.vscode/`), Git files и GitHub workflow files;
- mock/fake SDK, test fixtures, debug overlays, development analytics endpoints и hot-reload client;
- unused assets, duplicate unoptimized masters и files absent from production asset manifest.

Automated audit scans filenames and file content for common secret patterns. Любое совпадение проверяется до упаковки; подтверждённый secret является release blocker.

## Packaging and ZIP structure

До draft verification файл: `games/inferno-clicker/releases/inferno-clicker-1.0.0-rc.zip`. Финальный `inferno-clicker-1.0.0.zip` появляется только как byte-identical promotion после проверки SHA в черновике.

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

The preceding C08 checklist is historical after Cycle 09 begins; unchecked C08 rows are not silently promoted. Cycle 09 requires its own baseline identity and all checks below.

## Active Cycle 09 checks before package/draft

- [ ] `1.0.0` version and exact clean Build ID recorded; historical 0.1.0/0.1.1 files/hashes unchanged.
- [ ] Product/game/monetization/platform/architecture/art/audio/asset/QA/acceptance contracts agree on stage-3, 60-s boost, 90-active-s cooldown, repeats, goals and RU+EN.
- [ ] Production target loads SDK before app independent of hostname; test/fake rewarded paths and native-ESM runtime dependency absent.
- [ ] SDK init/ready/gameplay/pause, local/cloud≤1 write/5 s, guest, `best-score` and rewarded terminal matrices PASS.
- [ ] Desktop official matrix + zoom and mobile/tablet portrait/landscape/rotation/input compatibility PASS.
- [ ] All 64 frames and seven-stage runtime pass black/gray/red DPR1/2/3 audit; content scrub and low-brightness review PASS.
- [ ] Four meaningful ≥12-minute traces meet functional/performance thresholds; Critical=0, High=0, skipped=0.
- [ ] RU/EN metadata final; icon, cover, 4 desktop and 4 mobile screenshots exist, hashes recorded, actual gameplay≥70%, provenance complete.
- [ ] Reproducible `build:yandex`, fresh-unpack HTTP smoke, ZIP structure/size/security audit and SHA-256 PASS.
- [ ] Exact ZIP uploaded to a new Yandex draft; debug-panel SDK/Game Ready, Desktop/mobile, RU/EN, real rewarded, cloud and leaderboard PASS.
- [ ] QA→fix→independent retest→neighboring regression and QA/Reviewer/Release Agent sign-off complete on the same ZIP SHA.

Until every checkbox is checked with Cycle 09 evidence, final ZIP promotion and release readiness are blocked. Submission to moderation/publication remains outside scope even after this checklist passes.

Перед `package:yandex` строки `C09-RLS-01/02` имеют только `READY_FOR_PACKAGE`; это не PASS. Пакет создаётся во временном каталоге, проверяется двумя нормализованными ZIP-потоками, fresh extraction и owned-server smoke, после чего exact `package-results.json` единственный переводит эти две строки в post-package `PASS`. Остальные строки после gate не редактируются: любое изменение tracked-файла меняет exact Git identity и блокирует packaging.

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
- Cycle 09-specific RU/EN dictionary/metadata hashes, reward/goals contracts, SDK/data/browser/content/visual/session evidence, submission asset hashes, Yandex draft ID/config/debug results and exact uploaded ZIP SHA.

## Rollback and post-upload smoke

- Rollback target is the last previously accepted ZIP and its checksum; для первого release rollback означает unpublish/disable distribution согласно capability платформы.
- Keep prior accepted artifact/report; never rebuild an old version from an unverified working tree.
- После upload, но до public release, повторить launch, one tap/click, mute, pause/resume, local save/load, leaderboard unavailable/success path as available и rewarded success/cancel path в Yandex test environment.
- Любой new fatal/console error, package-path failure, data-loss symptom, stuck ad pause или score submission regression переоткрывает gate, увеличивает candidate build metadata и перезапускает затронутую regression.

## Current candidate decision and risks

- Release readiness: `NOT READY — YANDEX CYCLE 09 NOT RUN`; no 1.0.0 candidate is authorized for final promotion, moderation or publication.
- Art/audio payload may threaten startup and stage-7 memory budgets; mitigation — manifest budgets, staged loading and PERF-01–PERF-09 gate.
- Yandex APIs/policies may change before integration; mitigation — source/date revalidation immediately before adapter work and again before upload.
- Reward callback race may duplicate a boost or leave audio paused; mitigation — idempotent lifecycle contract, `C09-QA-F-07/08`, `C09-G-02/03/04`, `C09-Y-02/06` и `C09-A-01` tests.
- New final ZIP/tag разрешаются только после финального Cycle 09 gate; historical artifacts remain untouched as rollback evidence. Draft upload допускается только для exact pre-release candidate после local QA gate.
- Additional authored frames can exceed decoded memory despite a small package; mitigation is independently disposable clip resources and `AC:PERF-08`, not keeping all atlases resident.
