# «Зажги» (`inferno-clicker`)

Browser-first HTML5 clicker для Yandex Games о разгоне маленького уголька до стадии Инферно. Игрок поддерживает heat тапами/кликами, раскрывает скрытый во тьме инфернальный мир, переживает короткие помехи и соревнуется за Best Score.

## Текущий статус

**Pre-implementation review завершён; Implementation не начат.** В проекте нет игровой механики, production HTML/JS, SDK Yandex, финальных assets, release build или ZIP. Документация согласована для старта M1; начало реализации требует отдельной команды пользователя.

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

После отдельного разрешения Implementation Agent начинает с M1 (playable headless core и минимальный shell), затем идёт по `docs/IMPLEMENTATION_PLAN.md`. Любое изменение числового баланса или platform lifecycle сначала обновляет связанные specs и acceptance criteria.
