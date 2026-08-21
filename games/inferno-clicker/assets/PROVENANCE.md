# Production asset provenance

## Authored visual registry

The runtime visual set was reviewed on 2026-08-22. Visual references were used as
concept-art guidance for mood, palette, silhouette and composition only. They are
not shipped as screens, crops or flattened backplates.

| ID | Runtime path | Authored content | Runtime policy |
|---|---|---|---|
| BG-001 | backgrounds/bg-infernal-chamber-production.webp | Persistent infernal chamber without baked UI or actors | startup critical |
| FL-LOW-CORE / OUTER | flame/atlases/{core,outer}-low-v2.webp | Two independent transparent 8-frame flame layers | startup critical; 10 fps |
| FL-MID-CORE / OUTER | flame/atlases/{core,outer}-mid-v2.webp | Two independent transparent 10-frame flame layers | preload at stage 2 progress 0.6; 10 fps |
| FL-HIGH-CORE / OUTER | flame/atlases/{core,outer}-high-v2.webp | Two independent transparent 12-frame Inferno layers | preload at stage 5 progress 0.6; 11 fps |
| FX-STAGE-FLARE | flame/transitions/stage-flare-v2.webp | Transparent 8-frame boundary flare | preload at stage 1 progress 0.6; 8 fps once; reverse downward |
| CH-ASH-SERVANT-*-C06 | characters/ash-servant/ash-servant-{idle,inhale,blow,recovery}-v4.webp | Four disposable clip atlases, each with 8 clean stable-root 256×320 authored cells | idle plus one imminent clip retained; deterministic release after commit |
| CH-DEMONESS-*-C06 | characters/demoness/demoness-{idle,cast,hold,recovery}-v5.webp | High-resolution Inferno Queen clips, each with 8 clean stable-root 400×600 authored cells | idle plus one imminent clip retained; deterministic release after commit |
| CH-INFERNO-HOST-{MAIN,SENTINEL}-C06 | characters/character-inferno-host-{main,sentinel}-v4.webp | Two separately decoded five-frame actors with independent animation phases | preload at stage 5 progress 0.6; 2 fps after the accepted 1.5 s entry |

The matching JSON files are the production clip metadata and preserve frame
rectangles, loop mode, fps and shared pivots. Exact optimized byte sizes,
dimensions and SHA-256 hashes are recorded in assets-manifest.json.

### Corrective-cycle generation record

The new visual sequences were created with the built-in OpenAI ImageGen tool on
2026-08-20. Source output identifiers are retained here so the optimized WebP
exports can be traced back without shipping the large PNG masters:

| Runtime group | ImageGen source output |
|---|---|
| low flame sequence | `exec-7d73f711-8e80-447a-94ba-84071f9b3199.png` |
| mid flame sequence | `exec-64ba18f7-97c1-4598-a630-fa6a52787bd6.png` |
| high flame sequence | `exec-91455fe4-afdd-473c-a830-765bd2afb529.png` |
| Ash Servant state sequence | `exec-9f80d3c6-4232-4948-8745-11033de0acad.png` |
| Demoness state sequence | `exec-86104605-2285-459d-96ba-f6131a8e98b5.png` |
| stage flare sequence | `exec-65226e28-0b1d-4787-8306-2777cb371876.png` |
| Cycle 05 Demoness idle/disapproval | `exec-00aba88d-53bf-4cd7-acc0-32fa817f3d83.png` |
| Cycle 05 Demoness prepare | `exec-b496bce4-cde7-48cc-8f28-e714aa533761.png` |
| Cycle 05 Demoness cast/hold | `exec-95bc3866-463d-4f7f-a360-c4108501e277.png` |
| Cycle 05 Demoness recovery | `exec-5631088d-5ad8-4f6f-b17d-0e7b87a0f757.png` |
| Cycle 06 Ash Servant clean reference | `exec-4d9991c0-a0e5-4c31-aab0-08104946fe77.png` |
| Cycle 06 Ash Servant 4×10 state sheet | `exec-8fd887e2-2501-4d1c-bf09-e986e7136b44.png` |
| Cycle 06 Demoness idle | `exec-2ff961c0-e5c5-4342-964d-0a8c9f1bfcb3.png` |
| Cycle 06 Demoness cast | `exec-65acdc74-e439-4b3a-bbd9-cab8ac687d5f.png` |
| Cycle 06 Demoness hold | `exec-642603ec-9513-47bf-987a-a533c52656f1.png` |
| Cycle 06 Demoness recovery | `exec-6e9fd541-0c73-49b7-950c-c5804f519edb.png` |
| Cycle 06 Inferno host (boundary-corrected) | `exec-0fc7dd6d-4093-4188-a269-ec3cd1c7001a.png` |
| Cycle 06 Ash Servant recovery continuity replacement | `exec-80ff85fc-c3ce-4e4c-bbac-793433d3eb19.png` |
| Cycle 06 stable Inferno sentinel loop | `exec-b056f60f-d8b1-4abb-b5e9-2eeb2a6f3afa.png` |
| Cycle 06 stable crowned Inferno host loop | `exec-f928b29e-3dc9-4eec-acc8-53b07e739bc6.png` |

Deterministic post-processing used Sharp only for grid crop/resize, removal of
the generated white/checker preview background into real alpha, WebP encoding,
and luminance-based separation of the same approved flame sequence into core and
outer layers. It did not invent new silhouettes or copy reference pixels.

All authored atlas cells use real alpha. Flame core and outer cells share the
same root pivot [0.5, 0.965], so family crossfades do not jump at the hearth.
Character atlases have no baked environment or UI. Runtime procedural work is
limited to compositing, light/reveal masks, bounded particles, glow, scarlet
snowflakes, conical ice shards and contact steam; it does not synthesize a
geometric flame or humanoid. Full-pose character dissolve is not used.

Cycle 06 sources are retained under `visual-references/cycle-06-sources/`. The
servant prompt requested four forward-authored rows (idle, inhale, exhale and
recovery) with consistent identity and root. The Demoness prompts requested
separate idle, cast, hold and recovery sheets at higher source resolution. The
final host correction prompts required one stable crowned host and one stable
sentinel across six self-contained cells; the first five cells of each loop are
shipped on independently phased clocks. Sharp performs only
checker/near-white alpha extraction, component cleanup, defringe, uniform fit,
metadata measurement and high-quality WebP encoding via
`scripts/build-cycle06-character-assets.mjs`.

Cycle 04 losslessly repacked each complete source-space character cluster into
`1536×1120` VP8L atlases with 24 `256×280` cells, an 8-pixel transparent gutter,
bottom root at y=272 and centered body. Visible RGBA pixels and alpha are retained;
no scale, redraw or ImageGen interpolation occurs in this repack. Per-cell pixel
hashes, source ranges, root/centroid/edge metrics and sockets are recorded in the
v3 metadata. All 48 cells have zero alpha on the outer four pixels, root span is
at most two source pixels and the largest-body connected-component ratio is at
least 0.998.

Cycle 05 replaces that rejected exploration with four newly generated, spacious
four-pose strips. The authoritative reference is
`visual-references/stage-references/stage-5-demoness-reference-view.jpg`, SHA-256
`6bdc58df781ed898a35d98d05dc5f8b47e38f0e79c018e2d1da3afe48eb740a1`.
The generated design keeps its face, crown/hair, soot/ember palette and sovereign
silhouette, while applying the mandatory closed high-neck 12+ costume. Mechanical
post-processing removes only the uniform near-white chroma field, retains the
largest connected full-body cluster, defringes the alpha edge, scales uniformly
and aligns the skirt root. It neither paints new anatomy nor borrows reference
pixels. The final v4 atlas contains 28 cells with zero edge-alpha pixels and at
most 0.5 source-pixel root drift.

Cycle 06 character clips are mutually disposable residency groups. The manifest
records both physical decoded bytes and the runtime group bound; the audit uses
the two largest members of each group because the currently rendered and one
imminent decoded clip may overlap. Superseded resources are released on commit.
Startup-critical bitmaps remain 818,566 compressed bytes and 12,581,888 decoded
bytes.

## Authored audio

All five source recordings are CC0 1.0 assets from OpenGameArt:

| Runtime group | Source recording | Creator | Source | Runtime treatment |
|---|---|---|---|---|
| audio/fire/embers-wood-bed.* | Fireplace Sound Loop | PagDev | https://opengameart.org/content/fireplace-sound-loop | mono 44.1 kHz continuous wood/ember bed |
| audio/fire/charcoal-crackle.* | Fire Crackling | AntumDeluge | https://opengameart.org/content/fire-crackling | mono 44.1 kHz low-gain crackle layer |
| audio/fan/fan-soft-a.* | Short Wind Sound | remaxim | https://opengameart.org/content/short-wind-sound | selected 0.75 s segment, 30 ms fade-in / 170 ms fade-out |
| audio/fan/fan-soft-b.* | Air whoosh | pyranostudios | https://opengameart.org/content/air-whoosh | selected 0.75 s segment, 30 ms fade-in / 170 ms fade-out |
| audio/fan/fan-soft-c.* | Air Woosh Move | Almitory | https://opengameart.org/content/air-woosh-move | selected 0.75 s segment, 30 ms fade-in / 170 ms fade-out |

License deed: https://creativecommons.org/publicdomain/zero/1.0/

Each runtime group ships Vorbis/Ogg first and MP3 as the browser fallback.
Encoding used FFmpeg 6.0 with libvorbis and libmp3lame after macOS afconvert
rejected both target encoders in the available command-line environment. The
source WAV/OGG downloads are not shipped. Runtime accepted taps are aggregated
for 120 ms, use one of the three fanning variants, enforce a 180 ms cooldown and
permit at most two fan voices. No tap tone, pitch ladder or gameplay timing rule
is derived from audio.

## Retired assets

The former gas-burner-like ambience, single-card flame images and static
Servant/Demoness cutouts were removed. They are not referenced by source,
manifest or production output.

## Verification boundary

Visual acceptance still requires captured stage-boundary and encounter-state
evidence on the production build. Audio acceptance still requires audible loop
seam, loudness and mobile lifecycle QA on real Chromium and Safari/WebKit
devices. Provenance, codec fallback, frame registry and hard budgets are
machine-auditable through the manifest and repository tests.
