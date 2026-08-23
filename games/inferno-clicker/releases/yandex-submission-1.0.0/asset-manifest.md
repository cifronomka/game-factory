# Submission media manifest

Icon/cover must be original card artwork, not gameplay screenshots. Shared RU/EN media contains no overlaid words, so one set is used for both languages. System/browser/Yandex UI and debug panel must not appear. Final files require SHA-256 and independent visual sign-off.

| ID | Required filename | Pixels/format | Intended content | Status | SHA-256 |
|---|---|---|---|---|---|
| ICON | `media/icon-512.png` | 512×512 PNG | isolated ember/flame emblem, no text, no screenshot, no religious/esoteric mark | PASS | `38ea20080d30c2821524196a9b36884ee8a11f2fe2e4cc6ac5a9205f536fd52d` |
| COVER | `media/cover-800x470.png` | 800×470 PNG | authored fire progression composition, no UI/screenshot/text | PASS | `3450033d4bf7d859a3c66a5e3a284eff3c2a3a2e4b084a8b0c68e7eccb25b79f` |
| DESK-01 | `media/desktop-01-1920x1080.png` | 1920×1080 PNG, 16:9 | early-stage real gameplay, visible tap objective | PASS | `f35372a7aac9ef2431b6844674cb0d9c3f9a631d428246bc4d2371f126ad8865` |
| DESK-02 | `media/desktop-02-1920x1080.png` | 1920×1080 PNG, 16:9 | mid-stage real gameplay with Ash Servant telegraph | PASS | `d8a12903c50d27b2ccb372f0430513d00dc688fdff0fa02028fac90ddf5aa777` |
| DESK-03 | `media/desktop-03-1920x1080.png` | 1920×1080 PNG, 16:9 | Ember Warden and high-fire real gameplay | PASS | `ecee169ac2d93b67e95a3d28951661ac6b038c46d1e5d7477c6e5b320793237f` |
| DESK-04 | `media/desktop-04-1920x1080.png` | 1920×1080 PNG, 16:9 | Inferno real gameplay with score/goal context | PASS | `a041c4f6e715fd50904e102d931d3c550c1de9f539bdc644443c7ed4c5d9a9e0` |
| MOB-01 | `media/mobile-01-1080x1920.png` | 1080×1920 PNG, 9:16 | early-stage portrait real gameplay | PASS | `5b5ea12dd4de42d0705768c5da5dc664965a70583306969d0dffd519b5deb0a1` |
| MOB-02 | `media/mobile-02-1080x1920.png` | 1080×1920 PNG, 9:16 | mid-stage portrait real gameplay and warning | PASS | `f6a0f0c0f26943984c07fa6cc00c703d4de8d43d370ef8fd8194554e257ffc51` |
| MOB-03 | `media/mobile-03-1080x1920.png` | 1080×1920 PNG, 9:16 | stage-3 rewarded offer in valid real gameplay | PASS | `a467b5c849dae4ef304d7d041daa33536e2a3c8590dd446d6d764b77f09a7753` |
| MOB-04 | `media/mobile-04-1080x1920.png` | 1080×1920 PNG, 9:16 | Inferno/result-goal real gameplay state | PASS | `6062d92d9734bfa5dec004b67f3f3e3405357e34164ce329da0ecf56864dbb68` |

For every screenshot: game content area≥70%, black field only if part of actual game composition, no crop/distortion, no broken/white spots, no prohibited symbols, no platform/system/debug overlay. Long side is within the documented 1280–2560 range. Maskable icon, showcase cover and promo video are `N/A — optional and not required for Cycle 09`.

Machine-readable dimensions, byte sizes and hashes are in
`media/submission-media-manifest.json`. Icon and cover sources are retained in
`visual-references/yandex-release-09/`; gameplay captures come from the
test-driver build of the exact same Yandex source fingerprint with SDK transport
mocked and no visible debug overlay. The final release bundle compiles that
state-mutating test driver out and the release audit verifies its absence.
