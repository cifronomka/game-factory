# Game Design — {{GAME_TITLE}}

## Назначение

Фиксирует проверяемую модель игрового опыта: действия игрока, правила, состояния, прогрессию и баланс. Product goals находятся в `PRODUCT_SPEC.md`, способы реализации — в `TECHNICAL_ARCHITECTURE.md`.

## Инструкции владельцу: Product/Game Designer

Опиши правила достаточно точно для Developer и QA. Используй числа, формулы, state transitions и примеры. Каждая обязательная механика должна иметь соответствующий критерий в `ACCEPTANCE_CRITERIA.md`.

## Core loop

{{PLAYER_ACTION_FEEDBACK_PROGRESS_LOOP}}

## Правила

{{INPUTS_ALLOWED_ACTIONS_CONSTRAINTS}}

## Scoring

- Формула: `{{FORMULA}}`
- Округление/границы: {{ROUNDING_AND_LIMITS}}
- Отображение: {{DISPLAY_RULES}}

## Прогрессия

{{SESSION_AND_META_PROGRESSION}}

## Сложность

{{DIFFICULTY_CURVE_AND_ADAPTATION}}

## Проигрыш и рестарт

{{FAIL_CONDITIONS_RESTART_COST_STATE_RESET}}

## Награды

{{REWARD_TYPES_TRIGGERS_CAPS}}

## Игровые состояния

| Состояние | Вход | Допустимые действия | Выход | Pause policy |
|---|---|---|---|---|
| {{STATE}} | {{ENTRY}} | {{ACTIONS}} | {{EXIT}} | {{POLICY}} |

## Retention-механика

{{RETURN_REASON_WITHOUT_DARK_PATTERNS}}

## Баланс

| Параметр | Старт | Формула/кривая | Min/Max | Обоснование | Как тестировать |
|---|---:|---|---|---|---|
| {{PARAMETER}} | {{VALUE}} | {{CURVE}} | {{LIMITS}} | {{RATIONALE}} | {{TEST}}

## Edge cases и вопросы

{{OFFLINE_BACKGROUND_RAPID_INPUT_CLOCK_CHANGE_OTHER_CASES}}
