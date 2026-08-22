# Corrective Cycle 08 — clean character alpha and larger sharp Demoness

## Status, precedence and frozen scope

This is the active corrective contract created from the user review dated 2026-08-22. It supersedes Cycle 07 only for:

1. removal of white matte, fringe and internal-gap residue from Ash Servant and Demoness frames;
2. Demoness source clarity, genuine alpha and runtime scale;
3. the evidence needed to prove those corrections on the new exact build.

`CORRECTIVE_CYCLE_07.md` and its accepted evidence remain immutable historical records. C07 motion, stable Ash Servant anatomy, mouth/two-palm steam semantics, timings, sockets and state machines remain the inherited baseline unless a C08 asset rebuild requires coordinates to be remeasured against the same anatomy. A historical C07 `PASS` cannot close a new C08 criterion. The authoritative Demoness input is `visual-references/stage-references/stage-5-demoness-reference-view.jpg`, SHA-256 `6bdc58df781ed898a35d98d05dc5f8b47e38f0e79c018e2d1da3afe48eb740a1`; the native source manifest must bind this exact file and the face/crown-hair/silhouette/closed-costume/palette/proportions/hands/scale-dominance checklist.

Gameplay balance, encounter timing, heat, score, decay, input, reward, audio, platform adapters, persistence, flame/environment design and Inferno host are frozen. Cycle 08 is presentation-only and may change versioned character sources/atlases/metadata, internal draw placement, asset-pipeline cleanup, visual tests and evidence. Frozen source/runtime fingerprints and paired core replay must prove that no unrelated contract changed.

## User-observed defects and required result

### C08-01 — white residue on and inside both characters

1. **Observed:** Ash Servant and Demoness have white contamination around their outer contours and inside negative spaces such as bent elbows and gaps between limbs and torso. The result reads as a poor cutout from a white background.
2. **Required:** every frame has a genuine transparent background, clean outer silhouette and correctly transparent internal gaps. Visible white matte, low-chroma fringe, rectangular residue, opaque white islands and sticker edge count is `0` on black, dark-red and neutral-gray composites.
3. **Processing rule:** segmentation must preserve legitimate light material, eyes, skin, metal and authored highlights. A blanket “delete every white pixel” threshold is forbidden. Alpha is reconstructed from the character silhouette and all enclosed negative spaces; RGB on partially transparent edge pixels is color-decontaminated from nearby character material so filtering cannot reveal a white halo.
4. **Coverage:** all production appearance/idle/inhale/blow/recovery frames for Ash Servant and appearance/idle/disapproval/cast/hold/recovery frames for Demoness, including reduced/low tiers and transition samples.

### C08-02 — Demoness is still too soft

1. **Observed:** Demoness detail remains visibly softer than Ash Servant and may be sourced from insufficient resolution.
2. **Required:** redraw Demoness from the approved reference rather than enlarge the old raster. Preserve face, fire crown/hair, infernal silhouette, closed high-neck 12+ armor, palette, poses, palm semantics and identity. Face, crown, hair, hands and costume edges remain clear in source cells and in the production browser; blur, identity morph, duplicate limbs and fragments are binary `FAIL`.
3. **Source/export:** each authored Demoness cell is exactly `512×832` RGBA pixels. An eight-cell clip therefore uses a `4×2` atlas of `2048×1664` pixels. Raw redraws are at least cell-native and every frame records `sourceToAtlasUpscale = max(cellWidth/sourceFrameWidth, cellHeight/sourceFrameHeight) ≤1.0`; upscaling C07 atlas bytes into C08 cells is forbidden.
4. **Alpha:** transparent pixels are genuinely transparent and edge RGB is free of white matte contamination before atlas packing. RGB may use bounded lossy WebP compression, but alpha is lossless: every decoded frame must match its approved source mask exactly (`changedAlphaPixels=0`, `maxAlphaError=0`, `sourceAlpha≤12→encodedAlpha>12=0`). The versioned source, exported atlas and browser composite are all audited.

### C08-03 — Demoness must be 20% larger and taller than Ash Servant

1. **Required runtime placement:** replace the current Demoness logical draw box `420×700` with exactly `504×840`, which is `+20%` on both axes. This is a renderer/layout change backed by higher-resolution art, not a CSS/canvas stretch used to simulate clarity.
2. **Anchor:** keep the accepted feet/root baseline and grow primarily upward. A horizontal shift of only the minimum necessary pixels is allowed to preserve the HUD, flame and tap-target safe areas; per-state scale overrides are forbidden.
3. **Dominance:** for every required viewport/DPR and every Demoness production state, the visible non-transparent Demoness bbox height is at least `1.25×` the corresponding Ash Servant bbox height. The comparison uses rendered alpha bboxes, not nominal atlas or draw-box dimensions.
4. **Continuity:** feet/root drift remains `≤2 logical px`, unintended anatomical scale drift inside a clip remains `≤2%`, clipping and critical flame/HUD overlap count is `0`. Existing left/right palm sockets are remeasured per new frame so steam remains attached after the scale change.

## Asset and runtime implementation contract

- Record the C07 baseline path, SHA-256, cell dimensions, alpha bbox and rendered geometry before replacement. Production files are exactly Ash Servant v6 (`1024×640`, `256×320` cells) and Demoness v7 (`2048×1664`, `512×832` cells); C07 bytes are preserved by baseline hashes/Git history but superseded copies are excluded from runtime `assets/` and `dist/`.
- Rebuild every affected frame with an alpha mask that includes exterior background and enclosed negative spaces. Apply edge color decontamination only to partial-alpha pixels; do not recolor fully opaque authored highlights. Servant partial-alpha tiles not adjacent to an opaque authored pixel are removed before a one-pixel defringed antialias band is encoded.
- Pack Demoness into `512×832` cells and record atlas grid, frame rectangles, root, visible alpha bbox, `leftHand`, `rightHand`, anatomical landmarks, source provenance and unique frame hashes in JSON/manifest metadata.
- Recompute Ash Servant `root`, `mouth`, anatomical landmarks and alpha bbox after cleanup without changing its logical placement, design or scale. Recompute Demoness sockets and landmarks after redraw.
- Configure Demoness runtime draw size as `504×840` for all states. One scale/anchor policy applies across the clip family; the feet/root baseline is stable and scaling is not pose-dependent.
- Keep exactly one full Demoness atlas resident. During a clip handoff one bounded `512×832` canvas frame-cache freezes the last valid pose, the old atlas is released, and only then may the next atlas decode. An eight-frame `2048×1664` atlas stays within the `2048 px` texture-side limit; full-atlas overlap is forbidden and the cache bytes are counted in residency evidence.
- No public core, save, audio or platform interface changes are introduced. Internal atlas URLs/versions, frame metadata, draw dimensions and socket coordinates may change.

## Required evidence and QA gates

1. **Baseline and provenance:** C07/C08 source and atlas hashes, reference SHA, raw native source dimensions, exact v6/v7 inventory, cell size, export settings, per-frame `sourceToAtlasUpscale≤1.0` and a declaration that C08 frames were not produced by upscaling C07 rasters.
2. **Alpha audit:** per-frame exterior and enclosed-gap masks and SHA-256; decoded-WebP parity (`changedAlphaPixels=0`, `maxAlphaError=0`, low-alpha leak count `0`); detached Servant partial-alpha tiles `0`; counts/locations of suspicious light low-chroma pixels by alpha band; composites on black, dark-red and neutral-gray backgrounds. Automated results never override a Human-Eye matte veto.
3. **Clarity audit:** source-cell crops and exact-browser crops for face, crown/hair, hands and armor in idle/cast/recovery; exact `sceneTransform`/DPR upscale matrix remains `≤1.25×`; blur/morph/fragment count is `0`.
4. **Geometry audit:** baseline `420×700`, candidate `504×840`, scale deltas `+20%/+20%`, per-frame rendered alpha bboxes, minimum Demoness/Servant height ratio `≥1.25`, stable feet/root, socket attachment, clipping and HUD/flame overlap results.
5. **Motion review:** continuous production-browser playback at `1×` and `0.25×` on `390×844`, `768×1024`, `1366×768` and `800×360`, DPR 1 and 2 where supported. Review all affected states, solo and concurrent actors, plus pause/reduced/forced-low behavior.
6. **Frozen regression:** paired core replay and exact gameplay/audio/platform fingerprints match the accepted C07 baseline. Any mismatch is outside C08 scope and blocks release pending separate review.

Evidence belongs in `reports/corrective-cycle-08/<exact-build-id>/`. The root `summary.json` inventories every evidence file and maps the seven required passes (`automation`, `assets`, `visual`, `issues`, `independent`, `regression`, `acceptance`). Every acceptance PASS binds at least one inventoried path/bytes/SHA-256 artifact; every new C08 acceptance row starts as `NOT RUN`. C07 reports may be cited as baseline but may not be copied forward as proof of the corrected pixels, clarity, dimensions or geometry.

## Stop condition

Cycle 08 is DONE only when all applicable acceptance rows, including the new C08 rows, are `PASS` on one final clean exact build; C08 evidence validation exits `0`; open Critical=`0`, High=`0`; skipped required checks=`0`; independent targeted retest and neighboring regression are complete; and frozen gameplay/audio/platform fingerprints match C07. Until then release readiness is `NOT READY — CYCLE 08 NOT RUN`.
