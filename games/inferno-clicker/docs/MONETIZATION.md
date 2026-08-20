# Monetization — «Зажги»

## Назначение

Документ определяет единственный MVP provider-flow — добровольное «Усиление жара ×2». Rewarded никогда не открывает контент, stage или permission: все семь стадий доступны прямыми taps без рекламы. Modal не открывается автоматически.

## Решение MVP

- Rewarded: **да, один optional placement**.
- Interstitial, sticky banner, покупки: **N/A для MVP** — короткая score-based сессия не имеет достаточно естественных пауз.
- Пока настоящая реклама отсутствует, Web/dev предоставляет честно подписанный test provider. Он не имитирует рекламу, но возвращает тот же terminal success contract. Production Yandex позднее заменяет только provider adapter.

## Rewarded placement

| Placement | Добровольный trigger | Точная награда | Ограничения | Close/error/unavailable | Проверка |
|---|---|---|---|---|---|
| internal `inferno-seal` для adapter compatibility; UI «Усиление жара ×2» | отдельная CTA при `runHighestStage ≥4` и active run ≥45 s; никогда не на основном tap target | `tapPower ×2.0` на 20 s active gameplay; дополнительный heat не даёт прямых tap-score points и ничего не разблокирует | 1 success/run; 90 s session cooldown после success; таймеры стоят на pause | reward/use/cooldown не расходуются; безопасный resume; progression не меняется | adapter lifecycle, duplicate/late, core timer/scoring и no-reward-to-Inferno tests |

Public leaderboard остаётся один — **Best Score** и принимает boosted/non-boosted runs. Assisted heat не даёт прямых tap-score points: `scoreTapPower` делит `tapPower` на rewarded factor. Более высокий score возможен только косвенно через более быстрый вход в высокие stages и удержание.

## Web/dev test provider

- Opener CTA и confirm: `Получить ×2 (тест)`; пояснение: `Тестовый ×2 к силе жара на 20 секунд. Реклама не показывается.`
- Adapter не рисует fake-ad, countdown, close-кнопку или рекламный бренд. Он асинхронно завершает тот же idempotent request terminal outcome `rewarded`.
- Test provider взаимоисключается с Yandex rewarded и исключается из production ad-completion metrics.

## UX flow

1. Capability доступна, `runHighestStage ≥4`, elapsed active gameplay ≥45 s, cooldown завершён и successful use ещё не было.
2. Неблокирующая CTA в safe `PLAYING` обещает только `×2 на 20 секунд` и открывает sheet.
3. Явный click добавляет pause reason `menu`; Yandex sheet говорит `Посмотреть рекламу и получить ×2`, Web/dev sheet использует test wording.
4. Отдельный confirm заменяет `menu` на pause reason `ad`; audio fades to silence ≤100 ms, затем запускается provider.
5. Только terminal `rewarded` ставит queued 20-s boost; boost начинается после valid resume.
6. После expiry `tapPower` возвращается к base. Stage thresholds, heat, progression permission и records не меняются.

## Anti-frustration rules

- Нет auto-open, red notification badges, ложной close-кнопки, placement поверх flame или наказания за отказ.
- CTA скрывается во время encounter, stage transition, любого pause и active boost.
- Heat, decay, encounter и boost timers заморожены на рекламе.
- Double callback/повторный resume не выдаёт reward дважды.
- Ошибка сети не запускает cooldown и не уменьшает heat/score; повторный добровольный запрос разрешён.
- Все stages, tutorial, restart, save и leaderboard доступны при unavailable provider.
- Frequency guardrail: один rewarded success на run.

## Platform compliance

- Yandex ad вызывается только официальным SDK и после user gesture.
- Gameplay/audio paused на весь fullscreen lifecycle с учётом `game_api_pause/resume`.
- CTA заранее сообщает точную временную reward; выдача только по confirmed rewarded callback.
- Web/dev test provider не выдаёт себя за рекламу.
- Перед release Platform Agent повторно проверяет актуальные требования Yandex.

## Analytics events без персональных данных

`boost_sheet_open`, `reward_confirmed`, `reward_started`, `rewarded`, `reward_closed`, `reward_error`, `boost_started`, `boost_completed`; параметры: run age bucket, stage, heat bucket, platform, provider=`test|yandex|other`, result. Raw identifiers и точные tap traces не отправляются.

## Метрики и guardrails

| Метрика | Planning target/guardrail | Решение при нарушении |
|---|---:|---|
| Optional sheet open among eligible runs | 15–60% | проверить понятность CTA; не добавлять auto-open и не блокировать progression |
| Reward completion | ≥70% после старта настоящего показа | исследовать provider/error UX |
| Reward duplicate grants | 0 | release blocker |
| Progression difference after close/error/unavailable | 0 | release blocker |
| `canonicalDirectNoRewardV5` достигает stage 7 | 100% at 60/30/15 FPS | release blocker |
| Web/dev test success through production reward contract | 100%, exactly once/request | release blocker |
| D1 retention degradation among ad-exposed cohort | не хуже control более чем на 3 pp после достаточной выборки | снизить prominence/frequency |

## Post-MVP decision gate

Interstitial можно рассматривать только после минимум двух завершённых runs и не ранее 180 s app session. Это не часть текущих требований и не реализуется без отдельного product/platform/QA change request.
