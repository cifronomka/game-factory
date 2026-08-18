# Acceptance Criteria — {{GAME_TITLE}}

## Назначение

Это проверяемый stop contract и единственный источник статуса DONE. Субъективные формулировки запрещены: каждый PASS содержит метод и доказательство для конкретной release candidate.

## Инструкции владельцам: Orchestrator + QA Agent + Release Agent

До implementation уточни project-specific критерии. Перед release заполни Build ID, статус и evidence. Допустимы только `PASS`, `FAIL`, `BLOCKED`, `N/A — причина`. Нельзя считать DONE при FAIL/BLOCKED, открытых Critical/High или незавершённом QA report.

- Release candidate / Build ID: `{{VERSION_OR_COMMIT}}`
- QA report: `{{PATH_OR_LINK}}`
- Проверено: `{{DATE_AND_ROLE}}`

## Обязательные критерии DONE

| ID | Проверяемое условие | Метод проверки | Статус | Evidence |
|---|---|---|---|---|
| AC-01 | Production build завершается с exit code 0 из clean checkout | `{{BUILD_COMMAND}}` | {{STATUS}} | {{LOG_PATH}} |
| AC-02 | Открытых Critical/High bugs нет | Проверка issue log QA report | {{STATUS}} | {{REPORT_PATH}} |
| AC-03 | В поддерживаемых сценариях нет uncaught errors и console errors | Browser/E2E console capture | {{STATUS}} | {{LOG_PATH}} |
| AC-04 | Игра запускается до интерактивного состояния в каждом обязательном окружении | Launch smoke matrix | {{STATUS}} | {{EVIDENCE}} |
| AC-05 | Все обязательные touch-сценарии работают | Touch test cases на target mobile | {{STATUS}} | {{EVIDENCE}} |
| AC-06 | Все обязательные mouse-сценарии работают | Mouse test cases на desktop | {{STATUS}} | {{EVIDENCE}} |
| AC-07 | Каждая required mechanic из GAME_DESIGN имеет PASS test | Requirements-to-tests trace | {{STATUS}} | {{MATRIX_PATH}} |
| AC-08 | Persistence сохраняет, загружает и безопасно обрабатывает пустые/старые/ошибочные данные | Persistence suite | {{STATUS}} | {{EVIDENCE}} |
| AC-09 | Platform integration и fallback проверены по матрице обязательных capabilities | Adapter contract/platform tests | {{STATUS}} | {{EVIDENCE}} |
| AC-10 | Performance укладывается в зафиксированные budgets на target devices | Профилирование по QA_PLAN | {{STATUS}} | {{REPORT_PATH}} |
| AC-11 | Production output не содержит secrets, sourcemaps/dev-only files без разрешения и соответствует package rules | Dist manifest audit | {{STATUS}} | {{MANIFEST_PATH}} |
| AC-12 | Release build создан из идентифицированного commit/version | Hash/version comparison | {{STATUS}} | {{EVIDENCE}} |
| AC-13 | Release ZIP создан и его корневая структура пригодна для загрузки | Распаковка в temp + manifest check | {{STATUS}} | {{ZIP_PATH_AND_HASH}} |
| AC-14 | QA report заполнен, все fix прошли regression QA | Report completeness audit | {{STATUS}} | {{REPORT_PATH}} |

## Project-specific criteria

| ID | Связанное требование | Проверяемое условие | Метод | Статус | Evidence |
|---|---|---|---|---|---|
| AC-P01 | {{REQ_ID}} | {{BINARY_MEASURABLE_CONDITION}} | {{TEST}} | {{STATUS}} | {{EVIDENCE}} |

## Решение

- DONE: {{YES/NO}}
- Невыполненные пункты: {{IDS_OR_NONE}}
- Подпись ролей QA/Reviewer/Release: {{ROLES_AND_DATE}}
