# Privacy and data note — Cycle 09

## Data used by the game

- Local browser storage: settings, tutorial flags and nonnegative gameplay records (`bestScore`, highest stage, longest Inferno hold, max multiplier, runs played, daily-goal state and timestamps).
- Yandex Player data, when available: the same save payload for cloud restore/merge. Active run, exact tap trace, rewarded cooldown and ad history are not saved.
- Yandex leaderboard: one integer Best Score under technical name `bestscore`.
- Yandex rewarded SDK: ad lifecycle/result supplied by the platform. The game records only the terminal outcome needed to grant or deny the boost.
- Locale: `ysdk.environment.i18n.lang`, reduced to RU or EN for presentation.

## Data not requested by the game

The game does not request a real name, email, phone, address, contacts, precise location, payment details, camera, microphone or third-party account. It does not require third-party registration and does not force Yandex authorization. Raw user/platform identifiers and exact per-tap histories are not included in product analytics.

## Behavior and retention

Local records remain until browser storage is cleared. Cloud/leaderboard retention is governed by Yandex services and the user's Yandex account/settings. Local gameplay remains available when cloud, leaderboard or ads are unavailable. Cloud payload size/rate and actual network endpoints must be recorded by the final QA trace.

Final privacy/data verification status: `NOT RUN — requires exact production bundle static/network audit and Yandex draft trace`. If implemented behavior differs from this note, release is blocked until code and submission disclosure agree.
