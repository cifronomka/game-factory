# Platform Requirements — {{GAME_TITLE}}

## Назначение

Хранит универсальную матрицу внешних требований платформ и acceptance checks. Primary target первой реализации — Yandex Games; game core остаётся независимым от любого SDK.

## Инструкции владельцу: Platform Integration Agent

Перед интеграцией проверь актуальную официальную документацию и запиши дату/ссылки. Не копируй platform-specific логику в core. Для каждой capability определи поддержку, fallback web behavior, lifecycle и тест.

## Общий контракт

`PlatformService`: `init`, `saveData`, `loadData`, `submitScore`, `getLeaderboard`, `showRewardedAd`, `showInterstitial`, `pauseGame`, `resumeGame`.

Adapters: `src/platforms/yandex/`, `src/platforms/vk/`, `src/platforms/web/`, `src/platforms/android/`. Core использует dependency injection и capability/error result; отсутствие функции не приводит к crash.

## Матрица capabilities

| Capability | Yandex | VK | Web fallback | Android/RuStore | Core behavior if unavailable |
|---|---|---|---|---|---|
| Init | {{TBD}} | {{TBD}} | Local | {{TBD}} | {{POLICY}} |
| Save/load | {{TBD}} | {{TBD}} | Local storage | {{TBD}} | {{POLICY}} |
| Leaderboard | {{TBD}} | {{TBD}} | Disabled/local | {{TBD}} | {{POLICY}} |
| Rewarded/interstitial | {{TBD}} | {{TBD}} | Mock/disabled | {{TBD}} | {{POLICY}} |
| Pause/resume | {{TBD}} | {{TBD}} | Visibility API | {{TBD}} | {{POLICY}} |

## Yandex Games — primary

- SDK init/loading-ready lifecycle: {{REQUIREMENTS}}
- Player/auth/save/leaderboard: {{REQUIREMENTS}}
- Ads and gameplay/audio pause: {{REQUIREMENTS}}
- Browser/mobile/orientation/localization: {{REQUIREMENTS}}
- Submission/content/package constraints: {{REQUIREMENTS}}
- Official sources checked: {{URLS_AND_DATE}}

## VK Mini Apps

- Bridge init, user/storage/leaderboard: {{REQUIREMENTS}}
- Ads/lifecycle/back navigation: {{REQUIREMENTS}}
- Package/submission constraints: {{REQUIREMENTS}}
- Official sources checked: {{URLS_AND_DATE}}

## Web adapter

{{LOCAL_PERSISTENCE_VISIBILITY_NO_SDK_CAPABILITY_FALLBACKS}}

## Android / RuStore

- Wrapper/runtime and back button/lifecycle: {{REQUIREMENTS}}
- Storage, ads, billing/leaderboards if used: {{REQUIREMENTS}}
- Signing/package/privacy/submission: {{REQUIREMENTS}}
- Official sources checked: {{URLS_AND_DATE}}

## Platform test matrix

| Platform | Environment/device | Scenario | Expected | Evidence |
|---|---|---|---|---|
| {{PLATFORM}} | {{ENV}} | {{SCENARIO}} | {{EXPECTED}} | {{LINK_OR_PATH}} |
