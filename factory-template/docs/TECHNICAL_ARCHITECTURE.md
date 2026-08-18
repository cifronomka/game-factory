# Technical Architecture — {{GAME_TITLE}}

## Назначение

Определяет технические решения и границы системы, позволяющие реализовать утверждённый design. Не диктует игровые правила и не дублирует platform compliance checklist.

## Инструкции владельцу: Game Architect

Самостоятельно выбери минимально достаточный стек на основе требований, поддержки браузеров, производительности и сопровождаемости; не перекладывай выбор на пользователя. Запиши альтернативы и причины решения. Core обязан оставаться независимым от SDK платформ.

## Выбранный стек

- Runtime/rendering: {{STACK}}
- Language/tooling: {{LANGUAGE_AND_TOOLS}}
- Почему: {{DECISION_RATIONALE}}
- Отклонённые варианты: {{ALTERNATIVES_AND_TRADEOFFS}}

## Структура приложения

```text
src/
  core/          # platform-agnostic rules and state
  ui/            # presentation/input binding
  platforms/     # adapters: web, yandex, vk, android
  assets/        # loading/catalog code, if needed
```

{{MODULE_DEPENDENCY_RULES}}

## Game state

{{STATE_SCHEMA_TRANSITIONS_SERIALIZATION_VERSIONING}}

## Rendering

{{RENDER_PIPELINE_RESOLUTION_SCALING_DPR}}

## Input

{{TOUCH_MOUSE_KEYBOARD_GESTURE_NORMALIZATION}}

## Persistence

{{LOCAL_CLOUD_MERGE_MIGRATION_FAILURE_POLICY}}

## Platform abstraction

Game core зависит только от порта, аналогичного:

```ts
interface PlatformService {
  init(): Promise<void>;
  saveData(data: unknown): Promise<void>;
  loadData(): Promise<unknown | null>;
  submitScore(score: number): Promise<void>;
  getLeaderboard(): Promise<unknown>;
  showRewardedAd(): Promise<{ rewarded: boolean }>;
  showInterstitial(): Promise<void>;
  pauseGame(reason?: string): void;
  resumeGame(reason?: string): void;
}
```

Планируемые adapters: `src/platforms/yandex/`, `vk/`, `web/`, `android/`. SDK импортируется только внутри соответствующего adapter. Опиши lifecycle, capabilities, error/fallback semantics: {{PLATFORM_CONTRACT_DETAILS}}.

## Asset loading

{{MANIFEST_PRELOAD_LAZY_LOAD_FAILURE_MEMORY_CACHE}}

## Performance constraints

| Ограничение | Бюджет | Метод измерения | Target devices |
|---|---:|---|---|
| {{METRIC}} | {{BUDGET}} | {{METHOD}} | {{DEVICES}} |

## Build process

{{DEV_TEST_PRODUCTION_COMMANDS_OUTPUT_REPRODUCIBILITY}}

## Testing strategy

{{UNIT_INTEGRATION_E2E_CONTRACT_VISUAL_PERFORMANCE_TESTS}}

## Architecture decisions и риски

| Решение/риск | Статус | Обоснование/митигация | Владелец |
|---|---|---|---|
| {{ITEM}} | {{DECIDED/OPEN}} | {{DETAILS}} | {{OWNER}} |
