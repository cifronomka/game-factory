# Gameplay video — Yandex submission 1.0.0

Local candidate status: `PASS`. Yandex Console upload/save/reload verification:
`NOT RUN`. These files are optional promotional materials and their presence
does not authorize submission to moderation or publication.

## Official constraints

Verified against the official [draft-field documentation](https://yandex.ru/dev/games/doc/ru/console/add-new-game/draft)
and [game/media requirements](https://yandex.ru/dev/games/doc/ru/concepts/requirements)
on 2026-08-25:

- format: MP4;
- horizontal aspect ratio: 16:9;
- vertical aspect ratio: 9:16;
- minimum height: 400 px;
- maximum duration: 28 seconds;
- maximum file size: 100 MB;
- a non-advertising gameplay video must show real gameplay for at least 70% of
  its duration; the remainder may be visual treatment.

The Console separately describes advertising videos. The two files below are
prepared for the horizontal and vertical **gameplay video** fields, so the 70%
non-advertising-video rule is treated as a release gate.

## Delivery artifacts

| Field | Horizontal | Vertical |
|---|---|---|
| File | `media/gameplay-video-horizontal-v1-1920x1080.mp4` | `media/gameplay-video-vertical-v1-1080x1920.mp4` |
| Dimensions/aspect | 1920×1080, 16:9 | 1080×1920, 9:16 |
| Bytes | 24,958,383 | 25,093,830 |
| Duration | 22.486667 s | 22.5155 s |
| Frame rate | 30 fps | 30 fps |
| MIME/codecs | `video/mp4;codecs=avc1.420028,mp4a.40.2`; H.264 + AAC | `video/mp4;codecs=avc1.420028,mp4a.40.2`; H.264 + AAC |
| Tracks | video + audio | video + audio |
| Audio | stereo, 48,000 Hz, 22.357 s; RMS `0.024112471258485778`; peak `0.2985572814941406` | stereo, 48,000 Hz, 22.39966666666667 s; RMS `0.025064576492090245`; peak `0.38216733932495117` |
| SHA-256 | `08ff5285a9a46c28f74cf3b1562505f21c61fe1968f7f19450dc406ec1c9e144` | `20d38ecae8aefebc9fee6b8858ebc843606764c1e73b57a4ee08ea4d3292c190` |
| Local status | PASS | PASS |
| Console upload | NOT RUN | NOT RUN |

Both files are below 28 seconds and 100 MB, use the required aspect ratios,
and exceed the 400 px minimum height.

## Editorial and gameplay proof

The edit is 22.5 seconds, text-free and shared by RU/EN. Its measured real
gameplay share is 94.6%, above the 70% gate. It has no browser/platform UI or
debug overlay and is designed to loop seamlessly.

The montage opens and closes on sustained Inferno, with brief crossfades joining
real gameplay beats: stage 2 and 3 transitions; Ash Servant reveal, inhale and
blow; stage 4 silhouette; Ember Warden reveal, cast and steam impact; Fire Ring;
and the stage 7 Inferno transition. Character emphasis and zoom/crop are used
inside gameplay footage rather than replacing it with unrelated cinematics.

Capture diagnostics recorded in `media/gameplay-video-manifest.json` are zero
console errors, console warnings, page errors, request failures and HTTP errors
for both outputs. Each capture records seven expected recorded-Blob aborts;
these are classified by the capture manifest as expected and are not unexpected
network failures.

## Visual evidence

| Variant | Contact sheet | Pixels/bytes | SHA-256 |
|---|---|---|---|
| Horizontal | `visual-references/yandex-release-09/gameplay-video-horizontal-v1-contact-sheet.png` | 1920×540, 1,654,650 B | `e696639ae0168658bac8fc99bf2a2442acc1ce5c96df9418e9d13c9c19fdd90a` |
| Vertical | `visual-references/yandex-release-09/gameplay-video-vertical-v1-contact-sheet.png` | 1080×960, 1,896,274 B | `5889b69bb3e10ccc175c5c65efeff6b3e619ac5ca7cd0700373a6018521b92c9` |

The capture build is `1.0.0+working.60d69ef5a069`, commit
`9c7f264e52f0cc92b9deee39e6be56b50cfc1ad2`, Yandex target, source fingerprint
`60d69ef5a069201c9826e9241f1196cb4152dd438527be64012bc3d5ae898bcb`.
The capture-build manifest SHA-256 is
`6b3475fdf9dd8d5fbf589c85a4f10184562d8be82b8efacb6219c830da3d679d`.

## Console handoff

Upload the horizontal candidate to the horizontal gameplay-video field and the
vertical candidate to the vertical gameplay-video field for both RU and EN; the
files contain no localized text. Save draft `574315`, reload it, verify playback
and aspect/crop in each locale, then record the four resulting Console file IDs
in `console-checklist.md`. Leave moderation submission and public release
untouched.
