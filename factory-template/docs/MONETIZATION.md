# Monetization — {{GAME_TITLE}}

## Назначение

Определяет честные рекламные сценарии, награды, частотные ограничения и platform compliance. Технический SDK lifecycle описывается в архитектуре и platform requirements.

## Инструкции владельцам: Product/Game Designer + Platform Integration Agent

Монетизация не должна ломать core loop, маскировать обязательную функцию или наказывать за отказ. Любой placement опиши с trigger, consent, reward, cooldown, failure/cancel policy и аналитикой. Если формат неуместен, укажи `N/A — причина`.

## Rewarded ads

| Placement | Добровольный trigger | Награда | Лимит/cooldown | Cancel/error | Проверка |
|---|---|---|---|---|---|
| {{PLACEMENT}} | {{TRIGGER}} | {{EXACT_REWARD}} | {{CAP}} | {{NO_REWARD_OR_POLICY}} | {{TEST}}

Награда выдаётся ровно один раз только после подтверждённого rewarded callback.

## Interstitial

{{USE_ONLY_AT_NATURAL_BREAKS_OR_NA_REASON}}

## Anti-frustration rules

{{NO_FORCED_CLICK_NO_SURPRISE_ADS_COOLDOWN_RECOVERY_OFFLINE_FALLBACK}}

## Платформенные требования

{{AGE_RATING_DISCLOSURE_AD_LIFECYCLE_AND_CURRENT_PLATFORM_POLICY_LINKS}}

## Метрики и guardrails

{{IMPRESSION_COMPLETION_REWARD_RATE_RETENTION_CHURN_THRESHOLDS}}
