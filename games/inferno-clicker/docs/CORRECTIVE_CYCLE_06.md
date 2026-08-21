# Corrective Cycle 06 — character motion, readable attacks and silent quality adaptation

## Status and precedence

This is the active corrective contract created from the user review dated 2026-08-22. It supersedes Cycle 05 only where the requirements below conflict. `CORRECTIVE_CYCLE_05.md` remains immutable historical evidence: its Ash Servant byte-identity rule, cold-ribbon solution and keep-all-atlases residency policy are no longer implementation requirements.

Gameplay balance, deterministic V5 fixtures, reward/platform behavior, environment/flame design and all audio assets, mapping and mix are frozen. Cycle 06 changes presentation assets, presentation runtime, loading/residency policy, tests and evidence only. Before/after core snapshots and audio fingerprints must be identical.

## User-observed defects and required outcomes

| ID | Current visible result | Required result | Probable technical cause | Verification |
|---|---|---|---|---|
| C06-01 | Toast «Эффекты снижены для плавной игры» appears without useful action, including on capable hardware | Adaptive quality is silent; no downgrade toast is ever emitted | Presentation downgrade unconditionally calls the generic toast path | Force every tier transition; downgrade-toast count `0`, unrelated toast smoke PASS |
| C06-02 | Quality can downgrade after startup, low-refresh operation or tab suspension | Downgrade only after sustained measured render cost; startup, 30/40/60/120 Hz cadence and hidden/resume gaps do not trigger it | RAF interval is treated as render cost; no warm-up/visibility gating/confirmation/recovery | Deterministic quality-controller matrix plus 10-minute browser trace with reason/metric/tier timeline |
| C06-03 | Ash Servant flickers/ghosts and its outline pulses | One stable body identity with restrained living idle and no flicker, double exposure or luminance pop | Crossfade of distant full-body poses, sparse frames and dirty atlas pixels | Normal and 0.25× full-sequence review; flicker/ghost/double-contour count `0`; root drift `≤2 logical px` |
| C06-04 | Servant movement is sparse and recovery reuses/reverses existing poses | Preserve accepted key poses and add genuine authored in-betweens for appearance, idle, inhale, blow and a separate recovery | Temporal smoothness is simulated by blending or reverse playback | Pixel-hash uniqueness and ordered landmark continuity; at least one unique authored in-between between each retained semantic key-pose pair |
| C06-05 | Servant seems to extinguish fire remotely with an ash-colored line effect | Scarlet snowflakes visibly leave the rendered mouth and travel to the current visible flame while the servant exhales | Fixed mouth origin, line renderer and unused per-frame mouth sockets | Origin-to-mouth socket `≤8 logical px`; endpoint-to-visible-flame `≤12 px`; particles exist only during blow/recovery tail |
| C06-06 | Demoness is visibly softer than the Servant and morphs between a small number of poses | High-resolution Demoness with clear face/crown/hands and genuine authored in-betweens across idle, pose change, cast, hold and recovery | About 2.7× source upscale, chroma fringe, duplicated cells and full-pose alpha blending | Effective upscale `≤1.25×` at required DPR/viewports; unique-frame audit and landmark continuity; blur/morph/double-hand count `0` |
| C06-07 | Demoness emits a crooked blue ribbon | Several readable blue conical ice shards launch from the current rendered hands toward the current visible flame | Curve renderer implements the Cycle 05 ribbon contract rather than projectiles | Legacy ribbon path absent; shard origin-to-hand `≤12 px`, target error `≤12 px`, readable conical silhouette/orientation on every required viewport |
| C06-08 | At contact the fire reacts, but ice does not visibly evaporate | Each shard disappears or breaks at flame contact; steam rises from the actual contact before fading | No projectile impact lifecycle or bounded steam emitter | Steam count `0` before contact; starts `0–100 ms` after contact, rises, fades and returns to `0`; fire reaction never precedes contact |
| C06-09 | White matte/fringe makes characters look roughly cut out | All character silhouettes have natural alpha edges without white halo, rectangular residue or sticker edge | White matte/chroma fringe is preserved and amplified by scale/shadow | Composite-edge audit on black, dark-red and neutral backgrounds plus Human-Eye veto; visible white-matte defects `0` |
| C06-10 | Final devils enter well but settle into a nearly static plate | Preserve current entry timing/composition; afterward authored asynchronous internal motion makes the host visibly alive | Whole rectangular regions move by only a few pixels; no internal authored motion | Entry duration/landmarks unchanged; every rolling 5 s window has visible internal motion in at least two independently phased regions; seam/loop-pop count `0` |

## Implementation surfaces and ownership

| Problem IDs | Expected production surfaces | Required tests/evidence |
|---|---|---|
| C06-01/02 | `src/app/performanceQuality.js`, `src/main.js`, render-loop integration in `src/presentation/scene/infernoScene.js` | `tests/app/performanceQuality.test.js`, toast integration test, browser quality telemetry |
| C06-03/04/05 | versioned `assets/characters/ash-servant/*` clip atlases/JSON; `src/presentation/scene/characterScene.js`; optional reusable sprite/emitter module | character-scene/atlas/animation audits; Servant normal/slow blind clips |
| C06-06/07/08 | versioned `assets/characters/demoness/*`, versioned `assets/fx/*ice*`/`*steam*`; `characterScene.js` or isolated projectile/impact scene; `flameRig.js` contact contract | unique-frame/upscale/geometry/contact/steam/pause/pool tests and browser clips |
| C06-09 | all changed character atlases, `assets/PROVENANCE.md`, reproducible defringe/repack pipeline and animation asset audit | partial-alpha composite audit on three backgrounds plus Human-Eye veto |
| C06-10 | versioned Inferno-host authored states/metadata; host renderer in `characterScene.js` | entry baseline comparison, ≥15 s sustained motion capture and rolling-window metric |
| All asset changes | `assets/assets-manifest.json`, clip loading/`OptionalBitmap` ownership, asset/residency audits | manifest/hash/provenance/budget/close-dispose evidence |
| All requirements | active docs, `tests/**`, Cycle 06 evidence validator/report | exact-build traceability, frozen gameplay/audio fingerprints, three QA passes |

One production file has one owner at a time. Art generates versioned assets and metadata; Developer integrates runtime/tests; QA does not edit the candidate it signs off. Generated asset versions are never silently overwritten in place.

## Presentation contracts

### Silent adaptive quality

- Quality telemetry separates refresh cadence from measured application update/render duration. A warm-up interval, `document.visibilityState` gate, resume reset and at least two consecutive over-budget observation windows are mandatory before downgrade.
- The controller records `timestamp`, measured render p50/p95, refresh baseline, old/new tier and machine-readable reason for QA. It never emits user-facing copy for an automatic tier change.
- Automatic changes affect presentation only. Gameplay step, accepted input IDs, score, heat, event order, timers, platform lifecycle and audio are byte/behavior identical.
- Reduced Motion is an accessibility preference, not a performance downgrade. Low/reduced modes reduce optional particle density and expensive filters but retain the semantic snowflake, ice/contact/steam and living-character cues.

### Ash Servant

- The accepted character identity, palette, scale, hearth-side placement and gameplay phase timings remain. Asset bytes and frame count may change to correct motion and edges.
- No runtime interpolation may crossfade two materially different full-body poses. Smoothness comes from close, unique authored poses. Complementary sub-frame blending is allowed only between adjacent poses that pass the no-ghost landmark threshold.
- `appearance`, `idle`, `inhale`, `blow` and `recovery` are forward-authored clips. Reverse playback and reordered idle cells do not count as authored recovery or added frames.
- Metadata provides per-frame root and mouth sockets. The scarlet snowflake emitter follows the sampled mouth socket and aims at the live `FlameRig` target; it is bounded and presentation-only.

### Demoness and cold impact

- The authoritative identity reference remains `visual-references/stage-references/stage-5-demoness-reference-view.jpg`; the production asset remains closed, high-neck, 12+ and preserves the sovereign silhouette.
- Source/export resolution must support the largest required rendered bbox at DPR 2 without more than `1.25×` effective upscale. Every semantic clip uses unique authored cells; duplicates, permutations and reverse playback do not satisfy frame requirements.
- Cast uses multiple blue conical ice shards. Their transforms derive from current hand sockets and the live flame target. A shard cannot trigger a fire response until its hit geometry intersects the current flame mask.
- Impact owns a bounded lifecycle `travel → contact → evaporation/steam → cleared`. Steam starts at the sampled contact point, rises and fades; pause freezes it without catch-up, cancellation/teardown clears all pooled entries.

### Character edges and Inferno host

- All production character cells use genuine alpha. White premultiplication matte, chroma spill, opaque cell-border pixels, rectangular extraction remnants and environment/UI baked into a character atlas are forbidden.
- Edge validation samples partial-alpha silhouette pixels after compositing, not only atlas-cell borders. Automation flags luminance/chroma outliers; browser review on three contrasting backgrounds remains authoritative.
- The accepted Inferno entry, composition and duration are preserved. Post-entry motion must be authored inside the figures (breathing, head/shoulder/hand/wing/eye changes) and use independent phase offsets. Whole-plate drift cannot be the sole evidence of life.

## Bounded clip residency

- New frame count must not be paid for by retaining every decoded atlas. Large character animation is partitioned into clip atlases or equivalent independently disposable resources.
- The loader preloads the next required clip ahead of its first visible use, pins only currently rendered and imminent clips, and releases inactive optional clips after a deterministic grace interval. Active draw references cannot be released.
- Hard decoded-texture residency remains `≤64 MiB` at every sampled instant, including first Demoness cast, overlapping encounters, Inferno entry, pause/resume and reduced-motion transitions. Target operating margin is `≤56 MiB`; exceeding 56 MiB requires an explicit report but exceeding 64 MiB fails.
- Load/decode/upload spikes `>50 ms`, missing-frame fallback flashes, repeat-fetch loops, leaked bitmap handles and monotonic residency growth are all zero after preload.

## Frozen fingerprints

- Core configuration, deterministic fixture outputs and gameplay source fingerprint are frozen to the accepted pre-Cycle-06 baseline except test/evidence plumbing that cannot affect runtime rules.
- Every audio file, registry mapping, gain/mix constant and lifecycle behavior is frozen. No new character SFX is authorized by this cycle.
- Flame bitmap families and stage/environment composition remain unchanged; only their already-defined reaction to a correctly timed character contact may be driven by the new visual effect lifecycle.

## Required QA and stop condition

Cycle 06 uses three ordered passes on one clean exact build:

1. implementation validation: lint/typecheck/full automated tests, asset uniqueness/edge/residency audits, quality-controller matrix and frozen gameplay/audio fingerprints;
2. independent production-browser Human-Eye review at normal and 0.25× on required portrait/desktop/short-landscape viewports, with HUD/debug labels hidden for semantic observations;
3. regression QA after fixes: full seven-stage run, overlap, pause/resume, reduced motion, cross-browser, 10-minute performance/residency and neighboring gameplay/audio/platform suites.

DONE requires every applicable `ACCEPTANCE_CRITERIA.md` row PASS for that exact build, evidence inventory/hash validation PASS, open Critical `0`, open High `0`, no skipped required test, and explicit proof that gameplay/audio fingerprints did not change. A still image cannot prove motion, causality, flicker absence or residency lifetime.
