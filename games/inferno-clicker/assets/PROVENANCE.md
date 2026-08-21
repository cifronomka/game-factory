# Production asset provenance

## Authored visual registry

The runtime visual set was reviewed on 2026-08-20. Visual references were used as
concept-art guidance for mood, palette, silhouette and composition only. They are
not shipped as screens, crops or flattened backplates.

| ID | Runtime path | Authored content | Runtime policy |
|---|---|---|---|
| BG-001 | backgrounds/bg-infernal-chamber-production.webp | Persistent infernal chamber without baked UI or actors | startup critical |
| FL-LOW-CORE / OUTER | flame/atlases/{core,outer}-low-v2.webp | Two independent transparent 8-frame flame layers | startup critical; 10 fps |
| FL-MID-CORE / OUTER | flame/atlases/{core,outer}-mid-v2.webp | Two independent transparent 10-frame flame layers | preload at stage 2 progress 0.6; 10 fps |
| FL-HIGH-CORE / OUTER | flame/atlases/{core,outer}-high-v2.webp | Two independent transparent 12-frame Inferno layers | preload at stage 5 progress 0.6; 11 fps |
| FX-STAGE-FLARE | flame/transitions/stage-flare-v2.webp | Transparent 8-frame boundary flare | preload at stage 1 progress 0.6; 8 fps once; reverse downward |
| CH-ASH-SERVANT | characters/ash-servant/ash-servant-states-v3.webp | Complete appearance, idle, inhale and blow figures repacked into stable-root 256×280 cells | preload at stage 2 progress 0.6 |
| CH-DEMONESS | characters/demoness/demoness-states-v4.webp | Cycle 05 Inferno Queen: appearance, calm idle, restrained disapproval, 8-pose cast, hold and recovery in stable-root 192×288 cells | preload at stage 3 progress 0.6 |
| CH-INFERNO-HOST | characters/character-inferno-host.webp + character-inferno-host-v3.json | Five non-overlapping authored spatial regions from the transparent climax host | preload at stage 5 progress 0.6; independent periods 5.5–8.9 s |

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

Deterministic post-processing used Sharp only for grid crop/resize, removal of
the generated white/checker preview background into real alpha, WebP encoding,
and luminance-based separation of the same approved flame sequence into core and
outer layers. It did not invent new silhouettes or copy reference pixels.

All authored atlas cells use real alpha. Flame core and outer cells share the
same root pivot [0.5, 0.965], so family crossfades do not jump at the hearth.
Character atlases have no baked environment or UI. Runtime procedural work is
limited to compositing, light/reveal masks, bounded particles, glow, ash flow and
cold ribbon effects; it does not synthesize a geometric flame or humanoid.

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

The current bitmap registry decodes to 65,645,568 bytes (62.60 MiB) if every
stage asset is resident simultaneously. Startup-critical bitmaps are 818,566
compressed bytes and 12,581,888 decoded bytes; the remaining atlases are loaded
near their first use.

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
