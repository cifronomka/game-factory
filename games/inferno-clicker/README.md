# «Зажги» (`inferno-clicker`)

Browser-first HTML5 clicker для Yandex Games о разгоне маленького уголька до стадии Инферно. Игрок поддерживает heat тапами/кликами, раскрывает скрытый во тьме инфернальный мир, переживает короткие помехи и соревнуется за Best Score.

## Текущий статус

**Candidate 1.0.0 — активный Yandex Release Cycle 09, статус `NOT READY / NOT RUN`.** Проверенный C08 baseline адаптируется для Desktop, Android и iOS (`Any`, RU+EN, 12+): официальный SDK/lifecycle/cloud/leaderboard, повторяемый rewarded ×2 на 60 секунд со стадии 3, восемь целей, compatibility/layout/content/white-spot audit и submission pack. Исторические 0.1.0/0.1.1 artifacts неизменяемы; финальный ZIP и release PASS закрыты до полного QA→fix→regression и Yandex draft gate.

## Source of truth

- `docs/PRODUCT_SPEC.md` — аудитория, ценность, KPI и продуктовые риски.
- `docs/GAME_DESIGN.md` — точные правила, формулы, семь стадий и баланс.
- `docs/TECHNICAL_ARCHITECTURE.md` — выбранный стек и границы core/adapters.
- `docs/ART_DIRECTION.md`, `AUDIO_DIRECTION.md`, `ASSET_PLAN.md` — production briefs.
- `docs/MONETIZATION.md`, `PLATFORM_REQUIREMENTS.md` — rewarded и Yandex/Web contracts.
- `docs/QA_PLAN.md`, `ACCEPTANCE_CRITERIA.md`, `RELEASE_PLAN.md` — verification и будущий stop condition.
- `docs/YANDEX_RELEASE_CYCLE_09.md` — authoritative delta для Yandex release 1.0.0.
- `docs/IMPLEMENTATION_PLAN.md` — порядок M1–M15, зависимости, parallel work и gates.

Глобальные правила: корневые `AGENTS.md` и `FACTORY_WORKFLOW.md`.

## Принятые рамки

- Название: «Зажги»; slug: `inferno-clicker`.
- Primary: Yandex Games Desktop + Android/iOS, orientation Any, RU+EN, 12+; TV/VK/RuStore вне Cycle 09.
- Input: primary touch tap и mouse click.
- Семь стадий: Тьма → Искра → Пепельный слуга → Алый порог → Хранительница угасания → Огненное кольцо → Инферно.
- Контент: stylized dark-fantasy fire arcade без gore, крови, натуралистичного хоррора, откровенного контента, рун и религиозной/ритуальной/эзотерической символики.
- Rewarded: добровольное видео после stage 3, ×2 heat power на 60 active seconds, следующий success после 90 active seconds от reward; без рекламы вся игра проходима.
- Game core не импортирует platform SDK.

## Следующий gate

C09-M2–M5: feature/platform/compatibility/content implementation и ordered QA на одном exact build. C09-M6 создаёт/проверяет ZIP и новый Yandex draft; отправка на модерацию и публикация требуют отдельного разрешения. Любое изменение reward/balance/platform lifecycle сначала обновляет specs, fixtures и acceptance criteria.
