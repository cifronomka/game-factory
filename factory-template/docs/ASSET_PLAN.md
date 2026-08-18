# Asset Plan — {{GAME_TITLE}}

## Назначение

Является производственным реестром всех необходимых assets: что, кем, в каком виде и куда поставляется. Не определяет художественный стиль или игровые правила.

## Инструкции владельцам: Art Agent + Audio Agent + Game Architect

Создай по строке на каждый asset/atlas/вариант. Пути указывай относительно корня игры внутри `assets/`. Учитывай budgets архитектуры. Для generated assets фиксируй provenance/согласованные права; для procedural — алгоритм и seed policy.

## Реестр

| ID | Назначение | Path | Тип/формат | Размер/длительность | Прозрачность | Animation states | Источник | Владелец | Статус |
|---|---|---|---|---|---|---|---|---|---|
| {{ASSET_ID}} | {{USE}} | `assets/{{CATEGORY}}/{{FILE}}` | {{FORMAT}} | {{DIMENSIONS_OR_SECONDS}} | {{YES/NO/NA}} | {{STATES_OR_NA}} | {{GENERATED/PROCEDURAL/MANUAL}} | {{ROLE}} | {{TODO}} |

## Процедурные assets

{{SHAPES_PARTICLES_GRADIENTS_FONTS_AND_RUNTIME_COST}}

## Генерируемые assets

{{GENERATION_BRIEF_REFERENCES_PROVENANCE_POSTPROCESSING}}

## Naming convention

Используй lowercase kebab-case ASCII: `<category>-<subject>-<state>-<variant>.<ext>`. Версию не кодируй в имени без необходимости; source и optimized export различай каталогом/manifest. Дополнения: {{PROJECT_RULES}}.

## Пути

- `assets/backgrounds/`
- `assets/characters/`
- `assets/effects/`
- `assets/ui/`
- `assets/audio/`

## Budget summary и validation

{{TOTAL_DOWNLOAD_DECODE_MEMORY_ATLAS_AUDIO_BUDGET_AND_CHECK_COMMANDS}}
