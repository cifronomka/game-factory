# Performance Report — «Зажги», corrective cycle 07

Дата: 2026-08-22 (Europe/Moscow)
Решение: **PASS — application render budgets; headless refresh limitation documented**
Exact build: `0.1.0+a17cdd65fd5a`
Commit: `a17cdd65fd5af4ec236fd777aa5dd4723664a897`
Environment: Windows 10 Home, Node.js `v24.19.0`, Microsoft Edge `151.0.4129.93`.

## Payload and residency

| Metric | Result | Hard limit | Status |
|---|---:|---:|---|
| Production `dist/`, including manifest | 15,611,968 B / 108 files | 15 MiB / 15,728,640 B | PASS — 116,672 B margin |
| Startup critical bitmap art | 818,566 B | 1.5 MiB | PASS |
| Total registered bitmap art | 8,504,934 B / 18 assets | 9.8 MiB | PASS |
| Worst decoded bitmap residency | 66,987,008 B / 63.88 MiB | 64 MiB | PASS — 121,856 B margin |
| Largest texture side | 2,048 px | 2,048 px | PASS |
| Authored audio, both codec packs | 675,540 B / 10 files | 2.2 MiB | PASS |
| Main runtime module gzip | 5,067 B (`17,050 B` raw) | 350 KiB | PASS |

Decoded residency exceeds the 56 MiB target but stays below the 64 MiB hard limit. The documented exception is the Cycle 07 character atlas set required for sharp Demoness rendering; clip groups remain independently disposable and the lifecycle regression found no missing-frame flash or leaked active handle.

## Ten-minute Stage-7 overlap run

Both exact-dist runs used Stage 7, heat 980, high quality and simultaneous active Ash Servant plus Demoness effects. Diagnostics were sampled every five seconds.

| Profile | Duration | Frames | Application median / p95 | Application work >50 ms | Heap start → end | Diagnostics |
|---|---:|---:|---:|---:|---:|---:|
| Desktop `1366×768` | 608.001 s | 17,463 | 1.1 / 1.5 ms | 1 / 0.00573% | 0.89 → 14.14 MB | 121 |
| Mobile `390×844` | 608.014 s | 17,487 | 1.1 / 1.7 ms | 1 / 0.00572% | 0.89 → 14.19 MB | 121 |

Intermediate heap samples repeatedly fell after garbage collection (approximately 5–18 MB) instead of growing monotonically. No renderer work spike above 50 ms was associated with first attack, overlap or sustained Inferno after preload.

The CI desktop's headless virtual display paced normal `requestAnimationFrame` delivery at a median 34.9 ms (28.65 FPS) for both viewport sizes. This is an environment refresh ceiling and is **not** claimed as a measured 55-FPS desktop display result. Per the architecture contract, auto-quality and the performance decision use instrumented application update/render work separately from refresh cadence. Those p95 values are 1.5/1.7 ms, comfortably inside the 20/33 ms desktop/mobile budgets. The existing 30/40/60/120-Hz controller matrix also confirms that refresh-only pacing cannot trigger a false downgrade.

A supplementary 656.001-second unbounded-refresh run produced 114,296 frames, median frame interval 1.1 ms (909.09 FPS render capacity), and 0.12861% intervals above 50 ms. Its p95 delivery interval remained 36.4 ms because the headless scheduler periodically yields, so the application-work samples above remain the authoritative frame-cost metric.

Raw records:

- `reports/performance-c07-a17cdd65fd5a-desktop.json`
- `reports/performance-c07-a17cdd65fd5a-mobile.json`
- `reports/performance-c07-a17cdd65fd5a-unbounded.json`

## Runtime safeguards and neighboring regression

- Character/flame/host atlases preload ahead of their stage and inactive clip resources are releasable.
- Steam uses deterministic fixed-size particle samples with immediate cleanup; Reduced Motion halves each stream sample count and disables distortion/camera shake while preserving the mouth and both-palm semantics.
- Quality downgrade is silent, bounded to one transition, and driven by measured application work rather than display refresh.
- Full automation (201 tests), asset/animation audits, exact production smoke and browser visual regression passed without gameplay, audio or platform fingerprint changes.

PERF-01…PERF-08 remain PASS for the exact candidate at the application's measurable boundary. External physical-display cadence should be rechecked in the Yandex test environment before public publication; upload/publication was not authorized in this cycle.
