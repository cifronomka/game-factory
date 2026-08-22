# QA Report — «Зажги», corrective cycle 07

Дата: 2026-08-22 (Europe/Moscow)
Решение: **PASS**
Exact build: `0.1.0+a17cdd65fd5a`
Commit: `a17cdd65fd5af4ec236fd777aa5dd4723664a897`
Source fingerprint: `ac0f7dc2af7664c5a36bc5eb1c399a07abdd6d41fc652d05f1ba117e43eb9d7e`

## Gate 1 — automation

| Проверка | Результат |
|---|---|
| `npm test` | PASS — 201/201, skipped 0 |
| `npm run lint` | PASS — 92 modules |
| `npm run typecheck` | PASS — 38 browser modules |
| `npm run assets:audit` | PASS — 18 bitmap assets; 8,504,934 art bytes; 66,987,008 decoded bytes; 10 audio assets |
| `npm run animation:audit` | PASS — 17 atlases |
| `npm run build` | PASS — 107 runtime files |
| `npm run test:e2e` | PASS |
| `npm run release:audit` | PASS — 108 dist files; 15,611,968 bytes |
| `npm run evidence:cycle07 -- reports/corrective-cycle-07/0.1.0+a17cdd65fd5a` | PASS — 16 motion scenarios; complete issue ledger |
| 10-minute Stage-7 overlap performance | PASS — application p95 1.5/1.7 ms desktop/mobile; heap 14.14/14.19 MB |
| `npm run package` + unpacked manifest/HTTP smoke | PASS — 108/108 files identical |

Повторная сборка того же commit дала идентичный SHA-256 `dist/build-manifest.json`: `BB59CDDD9E3B1427F2F8D8C9332D2FF320BB01EC0BF9CB1C64059787BB83C55B`.

## QA → fix → regression

- C07-01: стабильность масштаба/корня Ash Servant — VERIFIED.
- C07-02: светлый пар из текущего mouth socket, снежинки и horn-origin отсутствуют — VERIFIED.
- C07-03: Demoness остаётся резкой и identity-stable, matte/blur/morph отсутствуют — VERIFIED.
- C07-04: первый candidate `0.1.0+c71aee6a4718` отклонён targeted QA из-за слияния каналов в один веер. Developer сузил независимые particle lanes; новый candidate `0.1.0+a17cdd65fd5a` прошёл повторный targeted retest во всех 96 Demoness-кадрах.
- C07-05: активный steam renderer не содержит quadratic/Bezier ribbon paths — VERIFIED статическим negative gate и browser evidence.

Независимый targeted owner: `qa-targeted-visual-c07`.
Слепой reviewer: `qa-blind-final2`; просмотрено 16/16 последовательностей и 192/192 PNG; verdict PASS; Critical 0, High 0, ambiguous cause→target 0.
Regression owner: `qa-regression-c07`.

## Итог

Authoritative evidence: `reports/corrective-cycle-07/0.1.0+a17cdd65fd5a/`. Все зарегистрированные Critical/High/Medium имеют report, fix, независимый retest и neighboring regression. Open Critical: 0. Open High: 0.
