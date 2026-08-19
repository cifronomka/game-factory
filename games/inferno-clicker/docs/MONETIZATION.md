# Monetization — «Зажги»

## Назначение

Документ определяет единственный MVP provider-flow — «Печать Инферно». Это заранее показанный progression gate между stages 4 и 5: подтверждённый success навсегда ломает печать для текущего run и одновременно даёт временный ×2. Taps до, у и после gate остаются прямыми; modal никогда не открывается автоматически.

## Решение MVP

- Rewarded: **да, один placement**.
- Interstitial, sticky banner, покупки: **N/A для MVP** — короткая score-based сессия не имеет достаточно естественных пауз; добавление без данных создаст frustration risk.
- Пока настоящая реклама отсутствует, Web/dev предоставляет честно подписанный test provider; он не имитирует рекламу, но возвращает тот же terminal success contract. Production Yandex позднее заменяет только provider adapter на официальный rewarded SDK callback.

## Rewarded placement

| Placement | Добровольный trigger | Точная награда | Ограничения | Close/error/unavailable | Проверка |
|---|---|---|---|---|---|
| `inferno-seal` / «Печать Инферно» | Отдельная CTA при `runHighestStage ≥4`, active run ≥45 s и `sealBroken=false`; никогда не на основном tap target | атомарно `sealBroken=true` до boost + `tapPower ×2.0` на 20 s active gameplay; unlock живёт до restart, дополнительный heat не даёт прямых tap-score points | 1 успешная активация на run; locked heat cap 559 при threshold stage 5 = 560; 90 s cooldown после success в одной app session; таймеры стоят на pause | Seal остаётся locked, награда/лимит/cooldown не расходуются; показать retry-status ≤2 s; безопасно resume | adapter tests: test/Yandex rewarded, closed/error/unavailable/duplicate/late; seal reset и core timer tests |

## Почему gate должен быть явным

Без success игрок может бесконечно продолжать честный stage-4 score-run: каждый tap принимается, начисляет `60` points при multiplier ×2 и реагирует визуально, но heat не выше 559. UI заранее показывает `559 / 560`, lock и последствия подтверждения. Full progression не маскируется под случайную difficulty spike: только success снимает ceiling и открывает stages 5–7 текущего run.

Public leaderboard остаётся один — **Best Score** и принимает locked/unlocked runs. Assisted heat не даёт прямых tap-score points: `scoreTapPower` делит tapPower на rewarded factor. Более высокий score после success возможен только косвенно через доступ к stage multipliers и удержание; analytics обязательно разделяет `sealBroken` и provider.

## Web/dev test provider

- Opener CTA: `Получить ×2 (тест)`. Confirm text: `Активировать тестовый ×2 и сломать печать`.
- После отдельного confirm adapter не рисует fake-ad, countdown, close-кнопку или рекламный бренд. Он асинхронно завершает тот же idempotent request terminal outcome `rewarded`; core не знает, был provider `web-test`, `dev-test` или `yandex`.
- Test provider доступен только пока для данного build/config не подключён настоящий rewarded provider и никогда не работает параллельно с Yandex rewarded.
- Test outcome помечается `provider=test`; он пригоден для gameplay/QA и локальных рекордов, но исключается из production ad-completion метрики.

## UX flow

1. Capability доступна, `runHighestStage ≥4`, elapsed active gameplay ≥45 s, cooldown завершён, `sealBroken=false` и successful use ещё не было.
2. Неблокирующая CTA в `PLAYING` показывает две части результата: `сломать печать для этого забега` и `×2 на 20 секунд`; она только открывает sheet.
3. Явный click добавляет pause reason `menu`. Yandex sheet говорит `Посмотреть рекламу и получить ×2`; Web/dev sheet использует test wording и не называет действие рекламой.
4. Только отдельное подтверждение внутри sheet заменяет `menu` на pause reason `ad`; audio fades to silence ≤100 ms, затем platform запускает официальный rewarded либо без fake-ad UI завершает test provider.
5. Только terminal `rewarded` атомарно ломает seal; queued 20-s boost начинается после valid resume.
6. Boost показывает remaining ring и финальный cue за 3 s до окончания; после expiry tapPower возвращается к base, seal остаётся broken до restart.

## Anti-frustration rules

- Нет auto-open, red notification badges, ложной close-кнопки, placement поверх flame или наказания за отказ.
- Компактная CTA скрывается во время encounter, stage transition, любого pause и active boost; в явно открытом pause/boost sheet используется отдельный confirm control, а не эта CTA.
- Heat, decay и encounter timers заморожены на рекламе; игрок возвращается в идентичное pre-ad состояние.
- Double callback/повторный resume не выдаёт reward дважды.
- Ошибка сети не запускает cooldown и не уменьшает heat/score; seal остаётся locked и CTA допускает повторный добровольный запрос.
- Seal success не требуется для tutorial, stages 1–4, restart, сохранения или leaderboard view; он явно требуется только для crossing stage 5.
- Frequency guardrail строже возможного platform maximum: один rewarded success на run.

## Platform compliance

- Yandex ad вызывается только официальным SDK и только после user gesture.
- Gameplay/audio paused на весь fullscreen lifecycle с учётом `game_api_pause/resume`.
- CTA заранее сообщает конкретную reward; reward выдаётся только по подтверждённому rewarded callback.
- Перед integration/release Platform Agent повторно проверяет актуальные правила: https://yandex.com/dev/games/doc/en/concepts/requirements и ad placement docs.
- Web/dev test provider не выдаёт себя за рекламу. Для production Web/VK/Android настоящий reward provider включается только после отдельной проверки API и обновления platform matrix.

## Analytics events без персональных данных

`seal_shown`, `seal_blocked`, `seal_sheet_open`, `reward_confirmed`, `reward_started`, `rewarded`, `reward_closed`, `reward_error`, `seal_broken`, `boost_started`, `boost_completed`; параметры: run age bucket, stage, heat bucket, platform, provider=`test|yandex|other`, result. Raw user identifiers, ad identifiers и точные tap traces не отправляются.

## Метрики и guardrails

| Метрика | Planning target/guardrail | Решение при нарушении |
|---|---:|---|
| Seal sheet open among stage-4 runs | ≥75% | если ниже — проверить, видны ли lock, 559/560 и две части reward; не добавлять auto-open |
| Reward completion | ≥70% после старта показа | исследовать provider/error UX |
| Reward duplicate grants | 0 | release blocker |
| Seal unlock on close/error/unavailable | 0 | release blocker |
| `canonicalSealNoBoostV3` remains at stage 4 / `canonicalSealBoostedV3` reaches stage 7 | 100% at 60/30/15 FPS | release blocker; не менять числа без versioned rebaseline |
| Web/dev test success through production reward contract | 100%, exactly once/request | release blocker |
| D1 retention degradation among ad-exposed cohort | не хуже control более чем на 3 pp после достаточной выборки | снизить prominence/frequency |

## Post-MVP decision gate

Interstitial можно рассматривать только при данных о сессии и наличии естественной паузы после завершения run: не чаще одного раза после минимум двух завершённых runs и не ранее 180 s app session. Это не часть текущих требований и не реализуется без отдельного product/platform/QA change request.
