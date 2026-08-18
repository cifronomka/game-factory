# Release Plan — {{GAME_TITLE}}

## Назначение

Описывает воспроизводимую production-сборку, очистку, упаковку, версионирование и финальные проверки загрузочного пакета. Не разрешает release без PASS acceptance.

## Инструкции владельцу: Release Agent

Работай только с идентифицированной release candidate. Не исправляй код внутри `dist/`; пересобирай из source. Сохрани команды, версии tools, manifest, checksum и report. Сначала проверь `ACCEPTANCE_CRITERIA.md`.

## Версионирование

- Схема: {{SEMVER_OR_OTHER}}
- Версия/commit/tag: {{VERSION}}
- Release notes source: {{PATH}}

## Production build

```text
{{CLEAN_INSTALL_COMMAND}}
{{TEST_COMMAND}}
{{BUILD_COMMAND}}
```

Ожидаемый output: `dist/`. Требования воспроизводимости: {{LOCKFILE_RUNTIME_TOOL_VERSIONS}}.

## Очистка dev files

Исключить: source maps (если не разрешены), tests, local configs, credentials, editor files, caches, internal docs и mock SDK. Проектные исключения: {{LIST}}.

## Packaging и ZIP structure

ZIP: `releases/{{GAME_SLUG}}-{{VERSION}}.zip`. В корне архива должен находиться platform entry point и production assets, без дополнительной оборачивающей папки, если платформа не требует иного.

```text
archive-root/
  {{ENTRY_POINT}}
  {{BUNDLES_AND_ASSETS}}
```

## Checks before upload

- [ ] Все применимые acceptance criteria имеют PASS.
- [ ] Clean production build и полный smoke test выполнены.
- [ ] ZIP распакован в новый temp-каталог и запущен/проверен.
- [ ] Размеры, entry point, MIME/relative paths и platform package rules проверены.
- [ ] Секреты/dev-only файлы отсутствуют.
- [ ] Версия внутри build, filename, report и tag согласована.
- [ ] SHA-256 записан.

## Release report

Сохранить как `releases/{{GAME_SLUG}}-{{VERSION}}-report.md`:

- build/version/commit и дата;
- команды и окружение сборки;
- ссылка на QA report и acceptance decision;
- ZIP filename, size, SHA-256 и manifest;
- известные ограничения (только некритические, одобренные);
- platform upload status и rollback reference.
