# «Зажги» (`inferno-clicker`)

Browser-first HTML5 clicker для Yandex Games о разгоне маленького уголька до стадии Инферно. Игрок поддерживает heat тапами/кликами, раскрывает скрытый во тьме инфернальный мир, переживает короткие помехи и соревнуется за Best Score.

## Текущий статус

**Candidate 0.1.1 — активный Corrective Cycle 08.** Headless core, layered Canvas 2D presentation, authored audio, Web/Yandex adapters, persistence, leaderboard и rewarded flow сохранены; Ash Servant/Demoness пересобраны с чистым alpha, а Demoness — в native `512×832` cells и runtime `504×840`. Исторический `0.1.0` остаётся rollback baseline; новый ZIP и публикация закрыты до полного C08 browser/device/regression gate.

## Source of truth

- `docs/PRODUCT_SPEC.md` — аудитория, ценность, KPI и продуктовые риски.
- `docs/GAME_DESIGN.md` — точные правила, формулы, семь стадий и баланс.
- `docs/TECHNICAL_ARCHITECTURE.md` — выбранный стек и границы core/adapters.
- `docs/ART_DIRECTION.md`, `AUDIO_DIRECTION.md`, `ASSET_PLAN.md` — production briefs.
- `docs/MONETIZATION.md`, `PLATFORM_REQUIREMENTS.md` — rewarded и Yandex/Web contracts.
- `docs/QA_PLAN.md`, `ACCEPTANCE_CRITERIA.md`, `RELEASE_PLAN.md` — verification и будущий stop condition.
- `docs/IMPLEMENTATION_PLAN.md` — порядок M1–M15, зависимости, parallel work и gates.

Глобальные правила: корневые `AGENTS.md` и `FACTORY_WORKFLOW.md`.

## Принятые рамки

- Название: «Зажги»; slug: `inferno-clicker`.
- Primary: Yandex Games; future: VK Mini Apps, generic Web, Android/RuStore wrapper.
- Input: primary touch tap и mouse click.
- Семь стадий: Тьма → Искра → Пепельный слуга → Алый порог → Демонесса угасания → Круг Инферно → Инферно.
- Контент: stylized dark fantasy / infernal occult casual, без gore, крови, натуралистичного хоррора и откровенного контента.
- Game core не импортирует platform SDK.

## Следующий gate

M11–M14: browser/device, visual/audio и Yandex regression на идентифицированной production build. После PASS всех применимых критериев M15 создаёт ZIP и release report; публикация требует отдельного разрешения. Любое изменение числового баланса или platform lifecycle сначала обновляет связанные specs и acceptance criteria.
