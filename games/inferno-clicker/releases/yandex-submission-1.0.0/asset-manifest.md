# Submission media manifest

Icon/cover must be original card artwork, not gameplay screenshots. Shared RU/EN media contains no overlaid words, so one set is used for both languages. System/browser/Yandex UI and debug panel must not appear. Final files require SHA-256 and independent visual sign-off.

| ID | Required filename | Pixels/format | Intended content | Status | SHA-256 |
|---|---|---|---|---|---|
| ICON | `media/icon-512.png` | 512×512 PNG | isolated ember/flame emblem, no text, no screenshot, no religious/esoteric mark | PASS | `38ea20080d30c2821524196a9b36884ee8a11f2fe2e4cc6ac5a9205f536fd52d` |
| COVER | `media/cover-800x470.png` | 800×470 PNG | authored fire progression composition, no UI/screenshot/text | PASS | `3450033d4bf7d859a3c66a5e3a284eff3c2a3a2e4b084a8b0c68e7eccb25b79f` |
| DESK-01 | `media/desktop-01-1920x1080.png` | 1920×1080 PNG, 16:9 | early-stage real gameplay, visible tap objective | PASS | `d399ce3e89497dac29acfddbf7e17b0182d2867ee775c196317c0cd325c5b29f` |
| DESK-02 | `media/desktop-02-1920x1080.png` | 1920×1080 PNG, 16:9 | mid-stage real gameplay with Ash Servant telegraph | PASS | `e53768148a455f2b2a03f68c8d1c8af6880222d96b29718276d0d2026ca8b854` |
| DESK-03 | `media/desktop-03-1920x1080.png` | 1920×1080 PNG, 16:9 | Ember Warden and high-fire real gameplay | PASS | `6102d4802d77f175b530aeb109ce0605b68a789bcfedde860c1411c2d88f374d` |
| DESK-04 | `media/desktop-04-1920x1080.png` | 1920×1080 PNG, 16:9 | Inferno real gameplay with score/goal context | PASS | `87a2372b03a20f736ea0ff8d24c8ca01e60c808e7253aaa57f1ffe777e7cc8f2` |
| MOB-01 | `media/mobile-01-1080x1920.png` | 1080×1920 PNG, 9:16 | early-stage portrait real gameplay | PASS | `293c56d2593d1d26badc94fe5bb477647417b1991be88cbbe6f637dc3fd57496` |
| MOB-02 | `media/mobile-02-1080x1920.png` | 1080×1920 PNG, 9:16 | mid-stage portrait real gameplay and warning | PASS | `313cc02928647732a3fd9a1d0e396b1f8f64105bf135581a30495d3df8bd5503` |
| MOB-03 | `media/mobile-03-1080x1920.png` | 1080×1920 PNG, 9:16 | stage-3 rewarded offer in valid real gameplay | PASS | `2c33f855a087baec66cb862a216a5ac07ae20dd673adbf41f857e724798dcfef` |
| MOB-04 | `media/mobile-04-1080x1920.png` | 1080×1920 PNG, 9:16 | Inferno/result-goal real gameplay state | PASS | `df39552e0f4d4d0b985887b4198e752ee481c8af0f6341f83b2e4d88e56d59d5` |

For every screenshot: game content area≥70%, black field only if part of actual game composition, no crop/distortion, no broken/white spots, no prohibited symbols, no platform/system/debug overlay. Long side is within the documented 1280–2560 range. Maskable icon, showcase cover and promo video are `N/A — optional and not required for Cycle 09`.

Machine-readable dimensions, byte sizes and hashes are in
`media/submission-media-manifest.json`. Icon and cover sources are retained in
`visual-references/yandex-release-09/`; gameplay captures come from the
test-driver build of the exact same Yandex source fingerprint with SDK transport
mocked and no visible debug overlay. The final release bundle compiles that
state-mutating test driver out and the release audit verifies its absence.
