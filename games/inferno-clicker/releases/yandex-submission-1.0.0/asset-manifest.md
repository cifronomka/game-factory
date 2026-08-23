# Submission media manifest

Icon/cover must be original card artwork, not gameplay screenshots. Shared RU/EN media contains no overlaid words, so one set is used for both languages. System/browser/Yandex UI and debug panel must not appear. Final files require SHA-256 and independent visual sign-off.

| ID | Required filename | Pixels/format | Intended content | Status | SHA-256 |
|---|---|---|---|---|---|
| ICON | `media/icon-512.png` | 512×512 PNG | isolated ember/flame emblem, no text, no screenshot, no religious/esoteric mark | PASS | `38ea20080d30c2821524196a9b36884ee8a11f2fe2e4cc6ac5a9205f536fd52d` |
| COVER | `media/cover-800x470.png` | 800×470 PNG | authored fire progression composition, no UI/screenshot/text | PASS | `3450033d4bf7d859a3c66a5e3a284eff3c2a3a2e4b084a8b0c68e7eccb25b79f` |
| DESK-01 | `media/desktop-01-1920x1080.png` | 1920×1080 PNG, 16:9 | early-stage real gameplay, visible tap objective | PASS | `21e5cfafdb61d2ce1a40c0aa769d988432f46806ab886f47c9a699d3ce1e80aa` |
| DESK-02 | `media/desktop-02-1920x1080.png` | 1920×1080 PNG, 16:9 | mid-stage real gameplay with Ash Servant telegraph | PASS | `09f5948224dfae432bacc6d6d2f784ff10939e79d4b80b08aa66723f8a4e72d2` |
| DESK-03 | `media/desktop-03-1920x1080.png` | 1920×1080 PNG, 16:9 | Ember Warden and high-fire real gameplay | PASS | `a0f4745f23860b12cbcefdf453806f7c3497797abaa78ad0c48e2b489ea4509e` |
| DESK-04 | `media/desktop-04-1920x1080.png` | 1920×1080 PNG, 16:9 | Inferno real gameplay with score/goal context | PASS | `16dd1cbb9d1aa5c6aebac61e0e4acda32e2af159e2830030203c473f0e4a3c4d` |
| MOB-01 | `media/mobile-01-1080x1920.png` | 1080×1920 PNG, 9:16 | early-stage portrait real gameplay | PASS | `4dc67671a1e41d50b6d74c95077c995e57c21de0b9b5840cc7676f4c4f9a1f11` |
| MOB-02 | `media/mobile-02-1080x1920.png` | 1080×1920 PNG, 9:16 | mid-stage portrait real gameplay and warning | PASS | `3e77bc5649f05f5bb8776f6d5a798c4301592efeb9e5781d9e20f0177bccafb8` |
| MOB-03 | `media/mobile-03-1080x1920.png` | 1080×1920 PNG, 9:16 | stage-3 rewarded offer in valid real gameplay | PASS | `9df4a2b5086a823920fcf6c8566415394b2910f0c7785b919f1e8ad5c552c5b1` |
| MOB-04 | `media/mobile-04-1080x1920.png` | 1080×1920 PNG, 9:16 | Inferno/result-goal real gameplay state | PASS | `633da497a127be0fa447927694d1edc4031f80602feb602a93672db750c085ef` |

For every screenshot: game content area≥70%, black field only if part of actual game composition, no crop/distortion, no broken/white spots, no prohibited symbols, no platform/system/debug overlay. Long side is within the documented 1280–2560 range. Maskable icon, showcase cover and promo video are `N/A — optional and not required for Cycle 09`.

Machine-readable dimensions, byte sizes and hashes are in
`media/submission-media-manifest.json`. Icon and cover sources are retained in
`visual-references/yandex-release-09/`; gameplay captures come from the
test-driver build of the exact same Yandex source fingerprint with SDK transport
mocked and no visible debug overlay. The final release bundle compiles that
state-mutating test driver out and the release audit verifies its absence.
