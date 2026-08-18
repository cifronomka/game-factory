# Производственный workflow фабрики

## Назначение

Этот документ задаёт порядок производства любой игры, входы/выходы этапов, допустимый параллелизм и точки запрета. Операционные роли описаны в `AGENTS.md`.

## Жизненный цикл

```text
IDEA
  ↓
PLAN
  ↓
PRODUCT_SPEC → GAME_DESIGN → ACCEPTANCE DRAFT
  ↓                  ↓
  ├── TECHNICAL_ARCHITECTURE ──┐
  ├── ART_DIRECTION ────────────┼→ ASSET_PLAN
  └── AUDIO_DIRECTION ──────────┘
                  ↓
            IMPLEMENTATION
                  ↓
       PLATFORM INTEGRATION
                  ↓
                 QA
                  ↓
          issue? → FIX ─┐
                  ↑     ↓
                  └ REGRESSION QA
                        ↓
                     RELEASE
```

## Этапы и gates

| Этап | Обязательные входы | Выход / gate |
|---|---|---|
| Idea / Plan | Запрос и ограничения | Scope, slug, target platforms, открытые вопросы |
| Product | Plan | Заполненный `PRODUCT_SPEC.md` с рисками и KPI |
| Game Design | Product spec | Проверяемые правила, состояния и баланс в `GAME_DESIGN.md` |
| Acceptance draft | Product + game design | Черновые критерии DONE, связанные с требованиями |
| Architecture | Базовые product/game design | `TECHNICAL_ARCHITECTURE.md`, выбранный стек, границы core/adapters |
| Art + Audio | Product/game tone | Раздельные направления и ограничения браузера |
| Asset planning | Art, audio, architecture | Полный `ASSET_PLAN.md` с путями, форматами и ownership |
| Implementation | Утверждённые базовые документы | Работающий core, тесты и воспроизводимая сборка |
| Platform integration | Platform contract + core interface | Адаптер целевой платформы и fallback web adapter |
| QA | Testable build + QA plan | QA report, дефекты, evidence, обновлённые статусы acceptance |
| Fix / Regression | Воспроизводимый issue | Исправление и повторная проверка затронутых сценариев |
| Release | Все применимые acceptance PASS | Production build, ZIP, версия и release report |

## Параллельная работа

После стабилизации базовых `PRODUCT_SPEC.md` и `GAME_DESIGN.md` техническое исследование, art research и audio research могут идти параллельно. Art и Audio могут параллельно заполнять разные части `ASSET_PLAN.md`, но orchestrator затем объединяет и проверяет конфликты бюджета, форматов и производительности. QA может готовить тест-кейсы одновременно с implementation, но исполняет их на идентифицированной сборке.

Нельзя начинать implementation до базовой спецификации и архитектуры. Нельзя финализировать asset plan до направлений art/audio и ограничений архитектуры. Нельзя интегрировать SDK напрямую в core. Нельзя выпускать релиз до завершения QA, fix cycle и regression QA.

## Передача результатов

Каждая роль читает актуальные upstream-документы и записывает результат в файлы проекта. Handoff включает: что решено, какие требования затронуты, что осталось открытым, как проверить результат. Устные решения или текст чата должны быть перенесены в соответствующий документ; пользователь ничего не переносит вручную.

## Цикл дефектов

```text
QA → issue → Product / Developer / Art / Audio / Platform Agent
   → fix → targeted tests → regression QA → PASS или новый issue
```

QA назначает severity: Critical (невозможно использовать/потеря данных), High (сломана ключевая функция), Medium, Low. Issue закрывается только после независимой повторной проверки. Любая смена ожидаемого поведения сначала оформляется как изменение спецификации, а не как «исправление теста».

## Условие DONE

Orchestrator использует `games/<slug>/docs/ACCEPTANCE_CRITERIA.md` как исполняемый stop contract. Релиз разрешён, только если каждый применимый критерий имеет PASS и ссылку на доказательство, Critical/High отсутствуют, QA report завершён, production build и release ZIP воспроизводимы. Неприменимый пункт требует обоснования `N/A`.
