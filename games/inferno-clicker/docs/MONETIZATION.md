# Monetization — «Зажги»

## Назначение

Документ определяет единственную MVP-монетизацию — добровольную rewarded-механику «Печать Инферно». Она усиливает power fantasy, не является условием прохождения семи стадий и не создаёт неожиданных остановок core loop.

## Решение MVP

- Rewarded: **да, один placement**.
- Interstitial, sticky banner, покупки: **N/A для MVP** — короткая score-based сессия не имеет достаточно естественных пауз; добавление без данных создаст frustration risk.
- Rewarded доступна только при capability платформы; generic Web не подменяет рекламу фальшивой наградой.

## Rewarded placement

| Placement | Добровольный trigger | Точная награда | Ограничения | Close/error/unavailable | Проверка |
|---|---|---|---|---|---|
| `inferno-seal` / «Печать Инферно» | Отдельная CTA, когда в текущем run `runHighestStage ≥3`; никогда не на основном tap target | `tapPower ×2.0` на 20 s active gameplay; дополнительный heat не даёт прямых tap-score points; purple-gold flame/glow/particles и отдельный audio layer | 1 успешная активация на run; CTA не раньше 45 s active run; 90 s cooldown после success в одной app session; таймер стоит на pause | Ничего не выдать и не списать лимит/cooldown; показать сообщение ≤2 s; безопасно resume | adapter tests: rewarded/closed/error/unavailable/duplicate callback; core timer test |

## Почему boost остаётся сильным, но необязательным

Печать помогает пережить трудный decay/debuff и увидеть более мощное визуальное состояние, но базовый tap-score считается от обычной силы тапа. Поэтому reward не умножает очки напрямую и все семь стадий достижимы без рекламы по тестовой tap timeline. Он увеличивает шанс удержания высокого multiplier, поэтому остаётся полезным, но баланс обязан проходить отдельный no-ad acceptance scenario.

Public leaderboard остаётся один — **Best Score**. UI не маркирует игроков как «платящих»: просмотр доступен всем, а run без рекламы имеет математически достижимую целевую длительность/стадии. Product analytics отдельно сравнивает boosted/unboosted runs; если top-score distribution покажет, что boost фактически обязателен, до release уменьшается duration/power или leaderboard submission исключает assisted runs через change review.

## UX flow

1. Capability доступна, `runHighestStage ≥3`, elapsed active gameplay ≥45 s, cooldown завершён и успешный boost ещё не использован.
2. Неблокирующая CTA в `PLAYING` показывает reward и слово «реклама» до клика; она только открывает sheet и сама не запускает рекламу.
3. Явный click добавляет pause reason `menu` и открывает confirm sheet: «Посмотреть рекламу и получить x2 силу тапа на 20 секунд».
4. Только отдельное подтверждение внутри sheet заменяет `menu` на pause reason `ad`; audio fades to silence ≤100 ms, затем platform показывает rewarded.
5. Только `rewarded` terminal result создаёт boost; его 20 s начинаются после valid resume.
6. Boost показывает remaining ring и финальный cue за 3 s до окончания; затем множители возвращаются к base без потери heat.

## Anti-frustration rules

- Нет auto-open, red notification badges, ложной close-кнопки, placement поверх flame или наказания за отказ.
- Компактная CTA скрывается во время encounter, stage transition, любого pause и active boost; в явно открытом pause/boost sheet используется отдельный confirm control, а не эта CTA.
- Heat, combo и encounter timers заморожены на рекламе; игрок возвращается в идентичное pre-ad состояние.
- Double callback/повторный resume не выдаёт reward дважды.
- Ошибка сети не запускает cooldown и не ухудшает run.
- Boost не требуется для tutorial, restart, сохранения, leaderboard view или достижения Inferno.
- Frequency guardrail строже возможного platform maximum: один rewarded success на run.

## Platform compliance

- Yandex ad вызывается только официальным SDK и только после user gesture.
- Gameplay/audio paused на весь fullscreen lifecycle с учётом `game_api_pause/resume`.
- CTA заранее сообщает конкретную reward; reward выдаётся только по подтверждённому rewarded callback.
- Перед integration/release Platform Agent повторно проверяет актуальные правила: https://yandex.com/dev/games/doc/en/concepts/requirements и ad placement docs.
- Для Web/VK/Android reward включается только после отдельной проверки provider API и обновления platform matrix.

## Analytics events без персональных данных

`reward_cta_shown`, `reward_confirmed`, `reward_started`, `rewarded`, `reward_closed`, `reward_error`, `boost_started`, `boost_completed`; параметры: run age bucket, stage, heat bucket, platform, result. Raw user identifiers, ad identifiers и точные tap traces не отправляются.

## Метрики и guardrails

| Метрика | Planning target/guardrail | Решение при нарушении |
|---|---:|---|
| CTA acceptance among shown | наблюдать, без launch target | проверить ясность reward, не усиливать давление |
| Reward completion | ≥70% после старта показа | исследовать provider/error UX |
| Reward duplicate grants | 0 | release blocker |
| Heat/score change on close/error | 0 | release blocker |
| Seven stages reachable in no-ad scripted balance run | 100% required | ослабить decay/encounters, не усиливать reward |
| Median session difference boosted vs unboosted | monitor | если boosted необходим для нормальной сессии — rebalance |
| D1 retention degradation among ad-exposed cohort | не хуже control более чем на 3 pp после достаточной выборки | снизить prominence/frequency |

## Post-MVP decision gate

Interstitial можно рассматривать только при данных о сессии и наличии естественной паузы после завершения run: не чаще одного раза после минимум двух завершённых runs и не ранее 180 s app session. Это не часть текущих требований и не реализуется без отдельного product/platform/QA change request.
