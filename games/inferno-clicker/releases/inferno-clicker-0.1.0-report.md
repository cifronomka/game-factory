# Release Report — «Зажги» / Inferno Clicker 0.1.0

## Identity and decision

- Version: `0.1.0`
- Build ID: `0.1.0+a17cdd65fd5a`
- Exact source commit: `a17cdd65fd5af4ec236fd777aa5dd4723664a897`
- Source fingerprint: `ac0f7dc2af7664c5a36bc5eb1c399a07abdd6d41fc652d05f1ba117e43eb9d7e`
- Planned publication tag: `inferno-clicker-v0.1.0`; not created because external publication was not authorized.
- Build/package date: `2026-08-22 04:26:39 +03:00` (`Europe/Moscow`)
- Decision: **LOCAL RELEASE PASS**. Exact ZIP is packaged and verified; Yandex upload/publication is N/A for this authorized scope.
- Owners: Product — user; implementation/release — `developer-c07-root`; targeted QA — `qa-targeted-visual-c07`; regression QA — `qa-regression-c07`; blind reviewer — `qa-blind-final2`.

## Toolchain and dependency lock

- OS: Microsoft Windows 10 Home
- Node.js: `v24.19.0`
- npm: `11.17.0`
- Browser: Microsoft Edge `151.0.4129.93`
- Production runtime dependencies: `N/A — zero external dependencies`
- Authoring dependency: `sharp@0.35.3`
- Lockfile: `package-lock.json`, SHA-256 `6d81390857ca4ef142bd716ac50a7b5d959859f53f440a3ed792b3c12293d029`
- `npm ci`: PASS — 6 packages audited, 0 vulnerabilities.

## Executed gates

| Command / gate | Result |
|---|---|
| `npm test` | PASS — 201/201, skipped 0 |
| `npm run lint` | PASS — 92 modules |
| `npm run typecheck` | PASS — 38 browser modules |
| `npm run assets:audit` | PASS — 18 bitmap assets; 8,504,934 art bytes; 66,987,008 decoded bytes; 10 audio assets |
| `npm run animation:audit` | PASS — 17 atlases |
| `npm run build` | PASS — 107 runtime files plus `build-manifest.json` |
| `npm run test:e2e` | PASS — exact production static-server smoke |
| `npm run release:audit` | PASS — 108 files / 15,611,968 bytes; no secrets, dev files, source maps or broken imports |
| `npm run evidence:cycle07 -- reports/corrective-cycle-07/0.1.0+a17cdd65fd5a` | PASS — 16 motion scenarios and complete required issue chains |
| `npm run package` | PASS — exact gated archive |
| Unpacked manifest comparison | PASS — 108/108 paths, byte sizes and SHA-256 hashes equal `dist/` |
| Unpacked HTTP smoke | PASS — root entry, build ID, main module, production platform index and 404 policy |

The same exact source commit was built twice. SHA-256 of `dist/build-manifest.json` remained `bb59cddd9e3b1427f2f8d8c9332d2ff320bb01ec0bf9cb1c64059787bb83c55b`; no nondeterministic manifest field was observed.

## Corrective Cycle 07 QA

- QA report: `reports/QA_REPORT.md`
- Visual QA report: `reports/VISUAL_QA_REPORT.md`
- Performance report: `reports/PERFORMANCE_REPORT.md`
- Immutable visual evidence: `reports/corrective-cycle-07/0.1.0+a17cdd65fd5a/`
- Matrix: Ash Servant and Demoness, normal/0.25×, `390×844`, `768×1024`, `1366×768`, `800×360`; 16/16 sequences and 192/192 sampled PNG reviewed.
- C07-01 Servant scale, C07-02 mouth steam, C07-03 Demoness sharpness, C07-04 two-palm steam and C07-05 particle-only renderer are VERIFIED. The superseded combined-fan candidate was rejected before the final fix.
- Blind review: PASS; Critical 0, High 0, ambiguous cause→target 0.
- Open issues: Critical 0, High 0, Medium 0.
- Frozen gameplay, audio and platform regression: PASS; exact source fingerprints unchanged outside the authorized presentation/tooling scope.

The exact Stage-7 overlap runs lasted 608 seconds on desktop and mobile viewports. Application render p95 was 1.5/1.7 ms, work above 50 ms was 0.00573/0.00572%, and final heap was 14.14/14.19 MB. The headless virtual display paced visible RAF at 28.65 FPS; this environmental refresh ceiling is recorded separately and is not presented as a physical-display result. An unbounded 656-second capacity run measured a 1.1 ms median interval. Physical display cadence remains an upload-environment recheck before public publication.

## Package

- Archive: `releases/inferno-clicker-0.1.0.zip`
- Bytes: `15,271,327`
- SHA-256: `26f1aa84aabccd49a7bc623fad4516b6ed25d2312fb3b3ca66dcf61b86965506`
- Sidecar: `releases/inferno-clicker-0.1.0.zip.sha256`, digest re-read and matched.
- Structure: no wrapper directory; one root `index.html`; no absolute or `..` paths.
- Extracted smoke root: fresh ignored report temp directory; no source, tests, docs, reports, source maps or credentials in the archive.

## Platform, publication and rollback

- Yandex platform requirements validation date: `2026-08-22`; Web/Yandex adapter contract, SDK-unavailable fallback, persistence, leaderboard and rewarded lifecycle regression PASS.
- Yandex test-environment upload: `N/A — external upload not authorized`.
- Platform submission identifier: `N/A — not submitted`.
- Public publish: `N/A — not authorized`.
- Rollback: this is the first packaged release. Before any future upload, retain this ZIP/checksum/report; if no prior accepted production artifact exists, rollback means disabling or unpublishing the distribution through the platform capability.

Reviewer and Release Agent sign-off: **PASS for local release artifact; no claim of external platform publication**.
