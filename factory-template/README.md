# Шаблон игрового проекта

Это эталонная заготовка одной игры. Она содержит контракты и каталоги, но не содержит конкретной механики, ассетов, SDK или готового HTML.

## Создание игры

Orchestrator из корня репозитория выполняет:

```bash
./scripts/create-game.sh <game-slug>
```

Скрипт проверяет slug, не перезаписывает существующий проект, копирует шаблон в `games/<game-slug>/` и удаляет возможные производные каталоги сборки. Пользователь не копирует ничего вручную.

Далее агент:

1. Заменяет placeholders в `docs/` и фиксирует `N/A` с причиной там, где это допустимо.
2. Согласует product/game design, acceptance draft и архитектуру.
3. Готовит art/audio directions и asset plan.
4. Реализует игру в `src/`, тесты в `tests/`, автоматизацию в `scripts/`.
5. Интегрирует платформы через adapters, не импортируя SDK в game core.
6. Выполняет QA → fix → regression до PASS.
7. Создаёт production build в `dist/` и версированный ZIP/report в `releases/`.

## Каталоги

- `docs/` — source of truth требований и проверок.
- `visual-references/` — референсы для анализа, не production assets.
- `assets/` — исходные игровые assets по типам.
- `src/` — исходный код; рекомендуемые границы: `core/`, `platforms/`, `ui/` после выбора архитектуры.
- `tests/` — автоматические и ручные test artifacts.
- `scripts/` — проектные build/QA/release scripts.
- `dist/` — производная production-сборка.
- `releases/` — ZIP и release reports.

Глобальные правила всегда читай в корневых `AGENTS.md` и `FACTORY_WORKFLOW.md`.
