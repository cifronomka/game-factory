# Corrective Cycle 07 — stable scale, sharp Demoness and steam casting

## Status, precedence and frozen scope

This is the active corrective contract created from the user review dated 2026-08-22. It supersedes Cycle 06 only for Ash Servant scale stability and attack FX, Demoness sharpness and attack FX, and the evidence/review process needed to verify those changes. `CORRECTIVE_CYCLE_06.md` remains immutable historical evidence; its scarlet-snowflake and ice-shard/contact semantics are historical and must not be implemented or accepted after Cycle 07. The same precedence applies to any older snow/ice wording still retained for history in `PRODUCT_SPEC.md` or other pre-C07 documents.

Gameplay balance, encounter schedules and durations, deterministic V5 fixtures, reward/platform behavior, flame/environment design, audio assets, mapping and mix remain frozen. Cycle 07 is presentation-only: it may change character atlases/metadata, visual emitters, presentation rendering, tests and QA evidence, but it must not change core event timing, heat, score, decay, input, platform adapters or audio. Before/after core snapshots and gameplay/audio/platform fingerprints must match.

## User-observed defects and technical plan

### C07-01 — Ash Servant shrinks while exhaling

1. **Current visible result:** the Servant's whole body becomes visibly smaller during blow/recovery even though the hearth-side root remains near the same point.
2. **Required result:** only the authored pose changes. Head, torso and limb scale remain visually stable across idle, inhale, blow and recovery; unintended anatomical scale drift is `≤2%`, root drift is `≤2 logical px`.
3. **Probable technical cause:** each source pose is independently alpha-cropped and fitted into the atlas cell. A pose with farther-extending arms therefore causes the entire body to be scaled down; existing checks measure root/centroid but not stable anatomical landmarks.
4. **Expected production surfaces:** versioned Ash Servant sources/atlases/JSON; the atlas builder; `assets/assets-manifest.json`; `assets/PROVENANCE.md`; `src/presentation/scene/characterScene.js`; atlas-geometry, scene and animation-audit tests.
5. **Verification:** measure head/eye/torso landmark distances relative to the sampled root on every frame and every required viewport. Drift must be `≤2%`, root drift `≤2 px`, and blind 1×/0.25× review of at least three full attacks must report no shrink, pulse or recovery jump.

### C07-02 — snowflakes leave the Servant's horns instead of a mouth exhale

1. **Current visible result:** snowflakes appear, and on some poses their fixed origin reads as the horns rather than the mouth.
2. **Required result:** snowflakes are absent. A readable, non-flame steam plume begins at the actual rendered mouth of the current frame and travels toward the current visible flame while the Servant exhales.
3. **Probable technical cause:** the Cycle 06 snowflake renderer uses a constant origin while atlas mouth coordinates are static or unused by runtime.
4. **Expected production surfaces:** per-frame `mouth` sockets in versioned Servant atlas JSON; atlas builder; a bounded reusable steam-emitter module; `characterScene.js`; manifest/provenance; scene/emitter/contract tests and visual harness.
5. **Verification:** static audit finds no active snowflake renderer, snowflake asset or snowflake semantic fixture. For every sampled blow frame, steam origin is within `8 logical px` of the current rendered mouth socket and targets the current visible flame within `12 px`. Steam is present only during the intended blow/tail window, freezes on pause and clears on cancel/teardown. Blind QA must describe “steam from the mouth”.

### C07-03 — Demoness is visibly blurred

1. **Current visible result:** the face, crown and hands are softer than the other characters, especially in landscape and active poses.
2. **Required result:** the Demoness remains sharp and identity-stable in idle, cast and recovery on every required viewport/DPR; `blur=0`, `morph=0`, unintended scale drift `≤2%`.
3. **Probable technical cause:** insufficient per-cell source resolution is enlarged by the real landscape/DPR transform, lossy export and a large runtime glow/drop-shadow. The existing resolution check may use a portrait approximation rather than the exact scene transform used by rendering.
4. **Expected production surfaces:** higher-resolution versioned Demoness sources/atlases/JSON; atlas builder; manifest/provenance; `characterScene.js`; the shared scene-transform calculation in `infernoScene.js`; scene/bitmap/atlas/audit tests.
5. **Verification:** the test derives rendered physical pixels from the same `sceneTransform` used by the renderer and proves effective upscale `≤1.25×` for the full viewport/DPR matrix. Face/crown/hands are compared in idle/cast/recovery at 1× and 0.25×; Human-Eye review records `blur=0`, `morph=0`, double-hand/fragment count `0`.

### C07-04 — Demoness throws icicles instead of casting steam from her hands

1. **Current visible result:** blue conical icicles/shards fly toward the flame and steam appears only after their contact.
2. **Required result:** icicles, shards and the legacy cold ribbon are absent. Two readable steam streams originate at the current rendered left and right palms and travel toward the current visible flame. Both hands must contribute whenever both are visible; the effect must not appear detached from either hand.
3. **Probable technical cause:** Cycle 06 explicitly implemented an ice-projectile/contact state machine and a single/combined hand origin instead of two per-frame palm sockets.
4. **Expected production surfaces:** per-frame `leftHand` and `rightHand` sockets in versioned Demoness atlas JSON; atlas builder; shared bounded steam emitter; `characterScene.js`; manifest/provenance; scene/emitter/contract tests and visual harness.
5. **Verification:** static and pixel audits find no active icicle/shard/ribbon renderer or assets. Each visible stream begins within `12 logical px` of its corresponding palm, converges on the live flame within `12 px`, freezes on pause and clears after the event. Blind QA must describe “steam from both hands”; a one-hand or detached source is FAIL. Flame presentation reaction may follow the existing effect phase, but Canvas collision/steam travel must not change core timing.

### C07-05 — QA accepted obvious motion and semantic defects

1. **Current visible result:** Cycle 06 could receive a declared PASS from still-heavy evidence and counters even though shrink, wrong emitter origin, blur and incorrect spell semantics remained visible.
2. **Required result:** QA observes complete motion before seeing fix notes, files one reproducible issue per independent defect, sends it to Development, and accepts it only after an independent targeted retest plus neighboring regression on a new exact build.
3. **Probable technical cause:** the evidence validator proves file presence, hashes and declarative counters more strongly than it proves blind first observations, continuous motion coverage and issue-to-fix-to-retest traceability.
4. **Expected production surfaces:** this contract; `QA_PLAN.md`; `ACCEPTANCE_CRITERIA.md`; `IMPLEMENTATION_PLAN.md`; a Cycle 07 evidence validator with negative fixtures; a production-browser motion harness; `reports/corrective-cycle-07/<exact-build-id>/`.
5. **Verification:** the validator rejects still-only/contact-sheet-only evidence, missing first-observation text, missing timestamps/frame links, disclosed fix summary before observation, old snow/ice semantics, same implementation/retest owner, missing issue/fix/retest/regression links, or any open Critical/High. Required order is `QA issue → Developer fix → independent targeted retest → neighboring regression → independent blind motion sign-off → full regression`.

## Presentation contracts

### Ash Servant

- Preserve identity, palette, hearth-side root, appearance/idle/inhale/blow/recovery timings and authored forward motion from Cycle 06.
- Atlas normalization uses one character-scale reference across the clip family rather than fitting each pose independently. Per-frame metadata includes `root`, `mouth` and anatomical scale landmarks.
- Unintended anatomical scale drift is `≤2%` and root drift is `≤2 logical px` in source cells and after the real viewport transform.
- A bounded steam plume follows the interpolated current-frame mouth socket. Snowflakes and horn-origin effects are forbidden at every quality/reduced-motion tier.

### Demoness

- Preserve the approved sovereign identity, closed high-neck 12+ costume, placement, encounter timing and authored idle/disapproval/cast/recovery motion.
- Atlas/export resolution and runtime filters must support every required viewport/DPR through the exact renderer `sceneTransform` with effective upscale `≤1.25×`. Face, crown and both hands remain sharp; blur, morph, double hands, fragments and pose-dependent identity loss are binary FAIL.
- Atlas metadata provides distinct per-frame `leftHand` and `rightHand` palm sockets. A bounded steam stream follows each visible palm toward the live flame target. Active ice shards, icicles, projectile contact and cold-ribbon semantics are forbidden.
- Pause freezes both streams without wall-clock catch-up; cancel/recovery/teardown clears them. Low/reduced modes may reduce optional particle density but must retain both readable hand origins and the same presentation timing.

### Shared steam emitter

- The renderer consumes sampled socket positions after atlas interpolation and after the same scene transform used to draw the owning character; hard-coded world origins are forbidden.
- Steam is visually distinct from flame, snow, ice and sparks: soft translucent vapor with upward dissipation, bounded count/lifetime and no opaque cones or crystalline silhouettes.
- One emitter implementation may serve mouth and hands, but every source has a stable source ID, current socket, target, lifecycle and pool ownership so pause/cleanup and measurements are independent.
- Steam is presentation-only. Its reach, collision or particle count cannot mutate encounter start/end, core `impactStrength`, heat, score, decay or event order.

## Required QA evidence and stop condition

Cycle 07 uses one exact clean build per candidate and preserves all applicable C06 checks that do not conflict with this contract. C06 evidence is historical and cannot close C07 rows.

1. **Implementation validation:** automated tests/audits/build, real-scene-transform upscale matrix, Servant anatomical-scale matrix, per-frame socket geometry, frozen gameplay/audio/platform fingerprints.
2. **QA issue capture:** each observed shrink, detached/wrong emitter, blur/morph or obsolete snow/ice visual is a separate issue with severity, environment, steps, expected, actual, motion evidence and linked acceptance ID.
3. **Developer fix:** the implementation owner links changed source/assets/tests and a new exact Build ID; the developer cannot close the issue.
4. **Independent targeted retest:** a QA owner distinct from the fix author replays the complete affected motion plus pause/reduced-motion/cleanup, records first observations before fix disclosure, and links timestamped frames/video.
5. **Neighboring regression and blind sign-off:** retest Servant/Demoness concurrent action, viewport/DPR matrix, flame/UI overlap and unchanged core timing. An independent reviewer sees randomly ordered opaque clips at 1× and 0.25× without HUD/debug/state/file labels and must identify mouth steam and two-hand steam without prompting.
6. **Full regression:** all applicable functional, gameplay, visual, audio, performance, platform and release checks run on the final exact build.

Motion evidence must include a continuous browser capture at `≥30 capture FPS` plus timestamp-linked sampled frames. A still image, contact sheet, headless renderer, coordinate-only assertion or author self-review cannot prove scale stability, sharpness, emitter attachment or semantic readability.

DONE requires every applicable `ACCEPTANCE_CRITERIA.md` row PASS for the final exact build, `validate-corrective-cycle-07-evidence.mjs` exit `0`, validator negative fixtures PASS, open Critical `0`, open High `0`, skipped required tests `0`, and exact equality of frozen gameplay/audio/platform fingerprints. Release cannot begin before independent retest and neighboring regression are complete.
