# Performance Report — «Зажги», corrective cycle 04

Дата: 2026-08-20
Решение: offline budgets PASS; exact-browser Stage-7 trace pending.

## Payload и assets

| Metric | Result | Hard limit | Status |
|---|---:|---:|---|
| Working production `dist/`, including manifest | 8,430,646 B / 71 files | 15 MiB | PASS |
| Startup critical bitmap art | 818,566 B | 1.5 MiB | PASS |
| Total registered bitmap art | 7,456,934 B / 11 assets | 9.8 MiB | PASS |
| Worst decoded bitmap residency | 65,448,960 B / 62.42 MiB | 64 MiB | PASS — 1.58 MiB margin |
| Largest texture side | 1,600 px | 2,048 px | PASS |
| Authored audio, both codec packs | 675,540 B / 10 files | 2.2 MiB | PASS |

`assets:audit` и `animation:audit` проверяют file magic/hash, metadata hash/schema, frame bounds, per-frame hashes/alpha/uniqueness, pivot/geometry, runtime clip parity, preload group и budgets.

## Runtime safeguards

- character/flame/host atlases загружаются ahead-of-stage, а не все на startup;
- Inferno использует один host bitmap с пятью independently transformed crop regions, pooled particles и bounded effects;
- quality downgrade меняет только presentation и выполняется максимум один раз;
- high/low/off и Reduced Motion caps покрыты тестами;
- presentation aggregation не теряет gameplay taps;
- pause замораживает application animation clock без catch-up.

## Оставшийся exact-browser gate

До финального sign-off требуются 10-minute Stage-7 traces для desktop и documented mid-tier mobile emulation: median FPS, p95 frame time, >50 ms frame share, heap/listener/particle growth и подтверждение, что не менее двух Inferno regions продолжают двигаться в каждом 5-second window после downgrade. Offline budget PASS не подменяет этот gate.
