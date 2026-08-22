# Visual QA Report — «Зажги», corrective cycle 07

Дата: 2026-08-22
Exact build: `0.1.0+a17cdd65fd5a`
Решение: **PASS**

## Human-Eye verdict

- Ash Servant сохраняет стабильный размер и planted root через prepare, inhale, blow и recovery.
- Светлый рассеянный пар начинается у открытого рта и входит в отдельно видимое пламя; снежинок, horn-origin FX и ледяных частиц нет.
- Demoness сохраняет резкие лицо, корону, силуэт, ладони и костюм; blur, morph, прямоугольный matte и sticker halo не обнаружены.
- Две узкие полупрозрачные струи имеют разные корни у двух видимых ладоней, остаются раздельно прослеживаемыми и сходятся только внутри пламени; сосулек, осколков и единого общего веера нет.

## Матрица

Проверены 16 browser sequences / 192 sampled PNG:

- subjects: `ash-servant`, `demoness`;
- speeds: `normal`, `slow` (0.25×);
- viewports: `390x844`, `768x1024`, `1366x768`, `800x360`;
- по 12 кадров на сценарий с полным prepare→active steam→recovery охватом.

Edge composites на black/dark-red/neutral backgrounds и encoded partial-alpha audit PASS. Demoness effective DPR-adjusted upscale≤1.25×; Servant root/scale drift≤2%; socket distance gates≤8/12 logical px PASS.

## Независимые проверки

- Targeted retest `qa-targeted-visual-c07`: PASS после отдельного C07-04 fix; все 96 Demoness-кадров просмотрены.
- Blind review `qa-blind-final2`: PASS; 192/192 кадров, Critical 0, High 0, ambiguous cause→target 0; код, планы и описание исправлений до наблюдений не читались.
- Superseded candidates `0.1.0+45211cafc774` и `0.1.0+c71aee6a4718` не подписаны и не являются release evidence.

Authoritative inventory: `reports/corrective-cycle-07/0.1.0+a17cdd65fd5a/summary.json`.
