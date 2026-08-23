# Submission media manifest

Icon/cover must be original card artwork, not gameplay screenshots. Shared RU/EN media contains no overlaid words, so one set is used for both languages. System/browser/Yandex UI and debug panel must not appear. Final files require SHA-256 and independent visual sign-off.

| ID | Required filename | Pixels/format | Intended content | Status | SHA-256 |
|---|---|---|---|---|---|
| ICON | `media/icon-512.png` | 512×512 PNG | isolated ember/flame emblem, no text, no screenshot, no religious/esoteric mark | PASS | `38ea20080d30c2821524196a9b36884ee8a11f2fe2e4cc6ac5a9205f536fd52d` |
| COVER | `media/cover-800x470.png` | 800×470 PNG | authored fire progression composition, no UI/screenshot/text | PASS | `3450033d4bf7d859a3c66a5e3a284eff3c2a3a2e4b084a8b0c68e7eccb25b79f` |
| DESK-01 | `media/desktop-01-1920x1080.png` | 1920×1080 PNG, 16:9 | early-stage real gameplay, visible tap objective | PASS | `2634bb03939b0c97d01486f9424f69d368b296f06501ed6f5c37fb95f4ba11f2` |
| DESK-02 | `media/desktop-02-1920x1080.png` | 1920×1080 PNG, 16:9 | mid-stage real gameplay with Ash Servant telegraph | PASS | `ad535bd5558c3410004b5fe1cc0169f17535e090a60912c2aa3f814ac866f2a7` |
| DESK-03 | `media/desktop-03-1920x1080.png` | 1920×1080 PNG, 16:9 | Ember Warden and high-fire real gameplay | PASS | `5ce1cc719ca8a155fa94498dee00c25ecda10a24463ddf2f09a835f645a17bda` |
| DESK-04 | `media/desktop-04-1920x1080.png` | 1920×1080 PNG, 16:9 | Inferno real gameplay with score/goal context | PASS | `98986fb07dcf254eb626e5c893e8dbbd6eb9a2deebd9cd522db136d0be88b197` |
| MOB-01 | `media/mobile-01-1080x1920.png` | 1080×1920 PNG, 9:16 | early-stage portrait real gameplay | PASS | `6a33447d9f17a9ddac158af1e291c282f6eda042ec0db036d49fbbd89509ac3b` |
| MOB-02 | `media/mobile-02-1080x1920.png` | 1080×1920 PNG, 9:16 | mid-stage portrait real gameplay and warning | PASS | `6de30e7c4fcd14129e13f20b591b7511e00e6af2736c764bb01eca50e230cb48` |
| MOB-03 | `media/mobile-03-1080x1920.png` | 1080×1920 PNG, 9:16 | stage-3 rewarded offer in valid real gameplay | PASS | `8e4d4f05d589ad1c33f30e22b2d04b3c2a91ac4fd20cc6458b206f8691e69bfd` |
| MOB-04 | `media/mobile-04-1080x1920.png` | 1080×1920 PNG, 9:16 | Inferno/result-goal real gameplay state | PASS | `871c628628e0a4f67252981b77cac3fa20dbc06b390ea96889b23a488803d16b` |

For every screenshot: game content area≥70%, black field only if part of actual game composition, no crop/distortion, no broken/white spots, no prohibited symbols, no platform/system/debug overlay. Long side is within the documented 1280–2560 range. Maskable icon, showcase cover and promo video are `N/A — optional and not required for Cycle 09`.

Machine-readable dimensions, byte sizes and hashes are in
`media/submission-media-manifest.json`. Icon and cover sources are retained in
`visual-references/yandex-release-09/`; gameplay captures come from the
test-driver build of the exact same Yandex source fingerprint with SDK transport
mocked and no visible debug overlay. The final release bundle compiles that
state-mutating test driver out and the release audit verifies its absence.
