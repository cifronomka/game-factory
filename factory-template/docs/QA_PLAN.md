# QA Plan — {{GAME_TITLE}}

## Назначение

Определяет риско-ориентированную стратегию проверки, окружения, test cases и формат доказательств. Итоговый статус DONE ведётся в `ACCEPTANCE_CRITERIA.md`.

## Инструкции владельцу: QA Agent

Подготовь план до завершения implementation. Каждый дефект содержит build/version, severity, окружение, шаги, expected/actual и evidence. После fix выполни targeted retest и regression затронутых областей.

## Test environments

| ID | Device/OS | Browser/version | Input | Viewport/DPR | Platform mode |
|---|---|---|---|---|---|
| {{ENV_ID}} | {{DEVICE}} | {{BROWSER}} | {{TOUCH/MOUSE}} | {{SIZE}} | {{WEB/YANDEX/etc}} |

## Functional tests

{{CORE_LOOP_STATES_SCORING_PROGRESSION_RESTART_REWARDS}}

## Browser tests

{{SUPPORTED_BROWSERS_LOAD_REFRESH_BACKGROUND_OFFLINE_ERROR_CASES}}

## Mobile tests

{{SAFE_AREAS_ORIENTATION_RESIZE_MEMORY_THROTTLING}}

## Desktop tests

{{WINDOW_RESIZE_FOCUS_HIGH_DPI}}

## Touch tests

{{TAP_MULTI_TOUCH_SCROLL_PREVENTION_RAPID_INPUT_TARGET_SIZE}}

## Mouse tests

{{CLICK_HOVER_DRAG_RIGHT_CLICK_OUTSIDE_CANVAS}}

## Performance checks

{{FPS_FRAME_TIME_STARTUP_DOWNLOAD_MEMORY_LONG_SESSION_THRESHOLDS}}

## Visual checks

{{REFERENCE_VIEWPORTS_CLIPPING_CONTRAST_PROGRESS_STATES}}

## Audio checks

{{AUTOPLAY_UNLOCK_MUTE_LOOP_MIX_FOCUS_AD_PAUSE_RESUME}}

## Platform checks

{{INIT_SAVE_LOAD_LEADERBOARD_AD_CALLBACK_PAUSE_SUBMISSION}}

## Regression

Для каждого fix: {{TARGETED_CASES_AND_NEIGHBORING_SUITES}}. Полный smoke suite выполняется на release candidate.

## QA report / issue log

| ID | Build | Severity | Environment | Summary | Status | Evidence | Regression |
|---|---|---|---|---|---|---|---|
| {{ISSUE_OR_RUN_ID}} | {{VERSION}} | {{LEVEL}} | {{ENV_ID}} | {{RESULT}} | {{PASS/FAIL/OPEN}} | {{PATH}} | {{STATUS}} |
