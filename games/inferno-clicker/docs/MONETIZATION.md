# Monetization — «Зажги» / Ignite

## Active contract — Yandex Release Cycle 09

Единственная монетизация 1.0.0 — добровольный Yandex rewarded-placement `heat-power-2x-60s`. Interstitial, sticky banner, IAP и third-party ads: `N/A — не входят в Cycle 09`. Test/fake provider удаляется из production и пользовательского интерфейса.

Все семь стадий, restart, local records, goals и Best Score доступны без рекламы. Rewarded ничего не разблокирует и не является условием продолжения.

## Placement

| Поле | Зафиксированное значение |
|---|---|
| Internal ID | `heat-power-2x-60s` |
| Eligibility | текущая попытка достигла `runHighestStage ≥3`; не зависит от persisted stage |
| Opener RU | `Посмотреть рекламу — ×2 к силе жара на 60 секунд` |
| Opener EN | `Watch an ad — ×2 heat power for 60 seconds` |
| Награда | `tapPower ×2.0` на `60 000 ms` активного gameplay; assisted heat не даёт прямой tap-score |
| Cooldown | `90 000 ms` активного gameplay от `onRewarded`, между попытками текущей app session; не persisted |
| Частота | повтор разрешён после завершения boost и cooldown; максимум один pending request |
| Close/error/timeout без предшествующего `onRewarded`/unavailable | reward=0, cooldown=0, progression mutation=0; новый запрос разрешён после cleanup |
| `onRewarded`, затем отсутствующий `onClose` | earned reward сохраняется ровно один раз; terminal timeout только освобождает ad pause/request |
| Provider | только `ysdk.adv.showRewardedVideo` в Yandex production |

Яндекс не задаёт отдельный лимит частоты rewarded на дату snapshot 2026-08-23; 90 секунд — продуктовый guardrail. Вызов всегда следует за явным user gesture и никогда не происходит автоматически.

## UX и lifecycle

1. После первого достижения stage 3 компактная DOM/CSS-плашка появляется только в safe `PLAYING`: нет encounter, pause/modal, active boost, cooldown или request. Presentation-only flame crossfade не меняет eligibility.
2. Плашка не перекрывает flame target. Нажатие только открывает локализованный confirm sheet и добавляет pause reason `menu`.
3. Confirm точно повторяет длительность и награду, заменяет `menu` на `ad`, останавливает gameplay/audio и вызывает Yandex SDK.
4. Первый `onRewarded` request ID ставит queued boost и запускает 90-секундный cooldown. Boost начинает расходоваться только после valid resume.
5. `onClose` завершает request. Если `onRewarded` не приходил, награды и cooldown нет. `onError` и timeout без предшествующего `onRewarded` обрабатываются тем же fail-safe cleanup; timeout после `onRewarded` не отнимает уже earned reward.
6. Pause, hidden, background, system dialog и ad не расходуют boost/cooldown. Снятие одной pause reason не снимает остальные.
7. При непрерывной игре boost заканчивается через 60 секунд, плашка остаётся скрыта ещё 30 секунд и затем может появиться снова в той же попытке.

## Anti-frustration и integrity

- Нет auto-open, urgency badge, ложной close-кнопки, наказания за отказ или рекламы поверх основного действия.
- Cancel/error/unavailable не изменяют heat, score, stage, records, cooldown или возможность пройти игру.
- Duplicate/late `onRewarded`, `onClose` и resume callbacks идемпотентны; одна request ID выдаёт максимум один boost.
- Все значения leaderboard проходят один и тот же sanity check; rewarded и no-reward runs сосуществуют в `bestscore`.
- Production static audit должен доказать отсутствие `(тест)`, `rewardedProvider='test'`, fake-ad UI и бесплатного terminal success.

## Privacy-safe events

Допустимые агрегированные события: `reward_offer_visible`, `reward_sheet_open`, `reward_confirmed`, `reward_started`, `rewarded`, `reward_closed`, `reward_error`, `boost_started`, `boost_completed`, `reward_offer_ready_again`. Параметры: locale, platform, run-age bucket, stage, heat bucket, result. Raw platform/user identifiers, точные tap traces и рекламный профиль не записываются.

## Release guardrails

| Метрика | Порог |
|---|---:|
| Duplicate reward grants | `0` |
| Progression difference после close/error/unavailable | `0` |
| No-reward stage-7 reachability | `PASS` на 60/30/15 FPS fixtures |
| Gameplay/audio movement во время ad | `0` |
| Offer до stage 3 или во время unsafe state | `0` |
| Следующий success раньше 90 active seconds | `0` |
| Production test-provider strings/paths | `0` |

Нарушение любого порога блокирует release и запускает QA→fix→independent retest→neighboring regression.
