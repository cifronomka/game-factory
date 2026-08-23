# Submission media manifest

Icon/cover must be original card artwork, not gameplay screenshots. Shared RU/EN media contains no overlaid words, so one set is used for both languages. System/browser/Yandex UI and debug panel must not appear. Final files require SHA-256 and independent visual sign-off.

| ID | Required filename | Pixels/format | Intended content | Status | SHA-256 |
|---|---|---|---|---|---|
| ICON | `media/icon-512.png` | 512×512 PNG | isolated ember/flame emblem, no text, no screenshot, no religious/esoteric mark | PASS | `38ea20080d30c2821524196a9b36884ee8a11f2fe2e4cc6ac5a9205f536fd52d` |
| COVER | `media/cover-800x470.png` | 800×470 PNG | authored fire progression composition, no UI/screenshot/text | PASS | `3450033d4bf7d859a3c66a5e3a284eff3c2a3a2e4b084a8b0c68e7eccb25b79f` |
| DESK-01 | `media/desktop-01-1920x1080.png` | 1920×1080 PNG, 16:9 | early-stage real gameplay, visible tap objective | PASS | `f5e493c6a05391d35dc35fa12cbbef0cde37cd80aa013d4a88dee48f7a79679f` |
| DESK-02 | `media/desktop-02-1920x1080.png` | 1920×1080 PNG, 16:9 | mid-stage real gameplay with Ash Servant telegraph | PASS | `bf588560082db8e4fbb07c1ba10356607cc3824d7372a58a325ad32bebe10990` |
| DESK-03 | `media/desktop-03-1920x1080.png` | 1920×1080 PNG, 16:9 | Ember Warden and high-fire real gameplay | PASS | `73799ada03f2c5a304914a0b2242d99ed9aadaf2085c4f630d4c54985fbac67c` |
| DESK-04 | `media/desktop-04-1920x1080.png` | 1920×1080 PNG, 16:9 | Inferno real gameplay with score/goal context | PASS | `5003bac2ef9b2c680ab2abdcc290b373e124735a4b1238d3c059e8191e4695c9` |
| MOB-01 | `media/mobile-01-1080x1920.png` | 1080×1920 PNG, 9:16 | early-stage portrait real gameplay | PASS | `2540907ed5abc38e98599b90c67b6bb22b7c75d61e476bfe0fffc8d6038ac697` |
| MOB-02 | `media/mobile-02-1080x1920.png` | 1080×1920 PNG, 9:16 | mid-stage portrait real gameplay and warning | PASS | `0b7d514ecdef92665cd17a109382fd2ca80ab02ea23aeb6a6187b6c098660ef2` |
| MOB-03 | `media/mobile-03-1080x1920.png` | 1080×1920 PNG, 9:16 | stage-3 rewarded offer in valid real gameplay | PASS | `c6da8208900f7aba80bdecaf210de5b6b1f424ed21f149b2c49f484495c3240e` |
| MOB-04 | `media/mobile-04-1080x1920.png` | 1080×1920 PNG, 9:16 | Inferno/result-goal real gameplay state | PASS | `6f9aae70384a61f4185b50e01b6f847c4bec371a801aa04adba63f1b55b8281d` |

For every screenshot: game content area≥70%, black field only if part of actual game composition, no crop/distortion, no broken/white spots, no prohibited symbols, no platform/system/debug overlay. Long side is within the documented 1280–2560 range. Maskable icon, showcase cover and promo video are `N/A — optional and not required for Cycle 09`.

Machine-readable dimensions, byte sizes and hashes are in
`media/submission-media-manifest.json`. Icon and cover sources are retained in
`visual-references/yandex-release-09/`; gameplay captures come from the
test-driver build of the exact same Yandex source fingerprint with SDK transport
mocked and no visible debug overlay. The final release bundle compiles that
state-mutating test driver out and the release audit verifies its absence.
