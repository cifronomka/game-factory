# Submission media manifest

Icon/cover are localized original card artwork, not gameplay screenshots. The
only lettering is the matching game title: `ЗАЖГИ` for RU and `IGNITE` for EN.
The accepted v3 title fill is deep ember red, not the superseded gold/orange
metallic treatment.
Generic `icon-512.png` and `cover-800x470.png` are exact byte-for-byte RU
aliases available if the Console exposes only one shared file. System/browser/
Yandex UI and debug panels must not appear. `PASS` below records local file and
visual review. The four localized files were uploaded and saved in Yandex draft
`574315` on 2026-08-25; exact Console file IDs are recorded in
`console-checklist.md`.

| ID | Required filename | Pixels/format | Intended content | Status | SHA-256 |
|---|---|---|---|---|---|
| ICON-RU | `media/icon-512-ru.png` | 512×512 PNG, 568,165 B | rich three-character fire composition with deep-red title `ЗАЖГИ`; no UI/platform/prohibited mark | PASS | `224e287d57cb72fbd51cdff861ded5986604b5f9a25a1b3495dc0613222f065a` |
| ICON-EN | `media/icon-512-en.png` | 512×512 PNG, 542,576 B | rich three-character fire composition with deep-red title `IGNITE`; no UI/platform/prohibited mark | PASS | `d5106f33d472b56f3618738b27607dc220338a17a85aed4c1ba44aa84d7b0996` |
| ICON-DEFAULT | `media/icon-512.png` | 512×512 PNG, 568,165 B | exact byte-for-byte alias of ICON-RU | PASS | `224e287d57cb72fbd51cdff861ded5986604b5f9a25a1b3495dc0613222f065a` |
| COVER-RU | `media/cover-800x470-ru.png` | 800×470 PNG, 828,367 B | rich Ash Servant / Inferno / Ember Warden card with deep-red title `ЗАЖГИ`; no gameplay UI | PASS | `e4425c885c7f4d1ce4692078b6eb85b2f24aff5b917165bd7227c1fd9c5454d5` |
| COVER-EN | `media/cover-800x470-en.png` | 800×470 PNG, 825,592 B | rich Ash Servant / Inferno / Ember Warden card with deep-red title `IGNITE`; no gameplay UI | PASS | `e17433ffaf07ff55d7ddab86c1eac6b43d6856105199741a79fe03388fd104cb` |
| COVER-DEFAULT | `media/cover-800x470.png` | 800×470 PNG, 828,367 B | exact byte-for-byte alias of COVER-RU | PASS | `e4425c885c7f4d1ce4692078b6eb85b2f24aff5b917165bd7227c1fd9c5454d5` |
| DESK-01 | `media/desktop-01-1920x1080.png` | 1920×1080 PNG, 16:9 | early-stage real gameplay, visible tap objective | PASS | `2634bb03939b0c97d01486f9424f69d368b296f06501ed6f5c37fb95f4ba11f2` |
| DESK-02 | `media/desktop-02-1920x1080.png` | 1920×1080 PNG, 16:9 | mid-stage real gameplay with Ash Servant telegraph | PASS | `ad535bd5558c3410004b5fe1cc0169f17535e090a60912c2aa3f814ac866f2a7` |
| DESK-03 | `media/desktop-03-1920x1080.png` | 1920×1080 PNG, 16:9 | Ember Warden and high-fire real gameplay | PASS | `5ce1cc719ca8a155fa94498dee00c25ecda10a24463ddf2f09a835f645a17bda` |
| DESK-04 | `media/desktop-04-1920x1080.png` | 1920×1080 PNG, 16:9 | Inferno real gameplay with score/goal context | PASS | `98986fb07dcf254eb626e5c893e8dbbd6eb9a2deebd9cd522db136d0be88b197` |
| MOB-01 | `media/mobile-01-1080x1920.png` | 1080×1920 PNG, 9:16 | early-stage portrait real gameplay | PASS | `6a33447d9f17a9ddac158af1e291c282f6eda042ec0db036d49fbbd89509ac3b` |
| MOB-02 | `media/mobile-02-1080x1920.png` | 1080×1920 PNG, 9:16 | mid-stage portrait real gameplay and warning | PASS | `6de30e7c4fcd14129e13f20b591b7511e00e6af2736c764bb01eca50e230cb48` |
| MOB-03 | `media/mobile-03-1080x1920.png` | 1080×1920 PNG, 9:16 | stage-3 rewarded offer in valid real gameplay | PASS | `8e4d4f05d589ad1c33f30e22b2d04b3c2a91ac4fd20cc6458b206f8691e69bfd` |
| MOB-04 | `media/mobile-04-1080x1920.png` | 1080×1920 PNG, 9:16 | Inferno/result-goal real gameplay state | PASS | `871c628628e0a4f67252981b77cac3fa20dbc06b390ea96889b23a488803d16b` |
| VIDEO-H | `media/gameplay-video-horizontal-v1-1920x1080.mp4` | 1920×1080 MP4, 16:9, 24,958,383 B, 22.486667 s, 30 fps, H.264 + stereo AAC 48 kHz | text-free RU/EN gameplay montage: stage transitions, character reveals, blow/cast actions and Inferno loop; 94.6% real gameplay | PASS — local artifact/audio; Console upload NOT RUN | `08ff5285a9a46c28f74cf3b1562505f21c61fe1968f7f19450dc406ec1c9e144` |
| VIDEO-V | `media/gameplay-video-vertical-v1-1080x1920.mp4` | 1080×1920 MP4, 9:16, 25,093,830 B, 22.5155 s, 30 fps, H.264 + stereo AAC 48 kHz | portrait rendering of the same text-free RU/EN gameplay montage; 94.6% real gameplay | PASS — local artifact/audio; Console upload NOT RUN | `20d38ecae8aefebc9fee6b8858ebc843606764c1e73b57a4ee08ea4d3292c190` |

For every screenshot: game content area≥70%, black field only if part of actual game composition, no crop/distortion, no broken/white spots, no prohibited symbols, no platform/system/debug overlay. Long side is within the documented 1280–2560 range. Maskable icon and showcase cover are `N/A — optional and not required for Cycle 09`. The optional horizontal and vertical gameplay-video candidates now pass local format, geometry, duration, size and gameplay-share checks; their upload to draft `574315` remains `NOT RUN`.

## Localized card-art provenance

| Delivery variants | Versioned ImageGen source | Source dimensions/bytes | Source SHA-256 | Prompt intent |
|---|---|---|---|---|
| `icon-512-ru.png`, `icon-512.png` | `visual-references/yandex-release-09/submission-icon-rich-title-red-v3-ru-source.png` | 1254×1254, 2,650,716 B | `2d7b29fdce6be58d1df249fdfb5cc967582b069fc14caa01910e5b98f8418ea5` | square small-size card with the three fire characters and readable `ЗАЖГИ` in deep ember red, explicitly not gold; no UI, platform mark, watermark, religious, ritual or esoteric symbol |
| `icon-512-en.png` | `visual-references/yandex-release-09/submission-icon-rich-title-red-v3-en-source.png` | 1254×1254, 2,510,258 B | `e5f490febeba714d1e150dff614bd2cae4177c8c3e74898360b126ee3ec1e3ed` | same composition with readable deep-red `IGNITE` and the same exclusions |
| `cover-800x470-ru.png`, `cover-800x470.png` | `visual-references/yandex-release-09/submission-cover-characters-title-red-v3-ru-source.png` | 1635×962, 2,605,271 B | `73118f116a8d376f03d8f1590e334dc45eca5c4fb42998372860f4ce39971a3a` | wide card: Ash Servant left, Inferno center, Ember Warden right, readable `ЗАЖГИ` in deep ember red, explicitly not gold; no gameplay/platform UI or prohibited symbol |
| `cover-800x470-en.png` | `visual-references/yandex-release-09/submission-cover-characters-title-red-v3-en-source.png` | 1634×963, 2,608,901 B | `cfa0b1fc4991eeeb13938971be3431b1f5264cfe67fc305df5016361abc27583` | same composition with readable deep-red `IGNITE` and the same exclusions |

Machine-readable dimensions, byte sizes and hashes are in
`media/submission-media-manifest.json`; gameplay-video metadata is in
`media/gameplay-video-manifest.json`. Icon and cover sources are retained in
`visual-references/yandex-release-09/`; gameplay captures come from the
test-driver build of the exact same Yandex source fingerprint with SDK transport
mocked and no visible debug overlay. The final release bundle compiles that
state-mutating test driver out and the release audit verifies its absence.

Gameplay-video editorial intent, exact media metadata, contact-sheet evidence
and the no-moderation upload boundary are documented in `GAMEPLAY_VIDEO.md`.
