# Corrective Cycle 05 — visual animation polish

## Purpose

Этот цикл закрывает только три замечания пользовательского visual review:

1. сохранить утверждённый образ огня, но убрать ощущение дискретно меняющихся картинок;
2. сохранить принятого Ash Servant без redesign;
3. полностью заменить Demoness на спокойную властную Inferno Queen по последнему пользовательскому stage-5 reference и сделать причинно понятный cast в реальное пламя.

Gameplay balance, V5 fixtures, reward/platform rules, audio assets/mix и environment composition заморожены. Любое их изменение является scope violation.

## Authoritative Demoness reference

- Path: `visual-references/stage-references/stage-5-demoness-reference-view.jpg`.
- SHA-256: `6bdc58df781ed898a35d98d05dc5f8b47e38f0e79c018e2d1da3afe48eb740a1`.
- Сохраняются лицо, crown/hair, tall sovereign silhouette, soot/ember palette и ощущение силы.
- Production redesign обязан быть полностью закрытым, high-neck, 12+, без sexualized pose; это safety adaptation, а не смена identity.
- Concept pixels не входят в runtime asset.

## Flame contract

- Low/mid/high core и outer v2 atlases byte-identical; новые bitmap не создаются.
- `SpriteAnimator` предоставляет текущую и следующую authored cell, loop-aware sample и quintic mix.
- Canvas2D рисует complementary weights; две full-opacity copies, static blur mask и geometric replacement запрещены.
- Core и outer сохраняют независимые phase offsets. Tap не сбрасывает ни один clock.
- Heat непрерывно управляет brightness, glow radius/alpha, outer intensity, ember/smoke density и emission rate внутри stages.
- Все 6 upward и 6 downward adjacent crossings имеют 1.05 s reversible envelope; `6→7` — 1.5 s. Family mix непрерывен и одновременно содержит максимум две adjacent families.
- Normal и 0.25× production-browser review являются обязательными: unit tests не могут выдать perceptual PASS.

## Ash Servant contract

- `ash-servant-states-v3.webp`, metadata, placement, scale, appearance/idle/inhale/blow/recovery timing и cause→effect остаются byte/behavior identical.
- Разрешён только доказанный technical clipping fix; текущий Cycle 05 такого изменения не требует.

## Demoness v4 asset contract

- Runtime: `assets/characters/demoness/demoness-states-v4.webp` + JSON.
- Lossless VP8L `1536×1152`, 28 cells `192×288`, genuine alpha, no baked matte/environment/UI.
- Clips: appearance 4, idle 4, disapproval 4, cast 8, hold 4, settle 4.
- Source strips: four ImageGen outputs, exactly listed in `assets/PROVENANCE.md`; mechanical postprocess only removes uniform chroma field, keeps the largest full-body cluster, defringes edges, uniformly scales and root-aligns.
- Edge alpha=0; root span≤0.5 source px; current reference path/SHA and per-frame hashes/sockets are recorded in metadata.
- Placement `520×780` at stable root makes the visible Queen at least 1.25× the Servant height without covering the HUD or central tap zone.

## Demoness motion and causality

- Idle ≈6.67 s: slow breathing/shoulders with subtle hair/cloth motion, stable feet, no whole-body rocking, dance, bustle or twitch.
- Every seeded 5–9 active seconds: look at flame → restrained disapproval → one slow minimal head shake → return.
- Telegraph: cast-look → arms-rise → hands-to-flame → gather.
- Effect: 0.8 s cold-travel → contact → hold → release. Recovery uses separate authored settle frames and returns to the exact idle root.
- Hand socket is selected from the current authored frame. `FlameRig.getTargetAnchor()` returns the current visible flame aim point including heat, tap impulse, bend and suppression.
- Telegraph visibly gathers a bounded cyan charge at the authored hand socket. `spellReach` moves a high-contrast organic three-strand ribbon and leading contact point from hand to target. `impactStrength=0` before contact; flame reaction starts in the same or next 50 ms application step after contact, peaks later and settles in recovery.
- Portrait HUD effect cards occupy the lower safe lane above controls, not the Queen's hands, face or the central spell trajectory. Desktop/landscape retains the side lane.
- HUD labels and diagnostics are excluded from blind Human-Eye Semantic review.

## Pass 1 Human-Eye findings and fixes

- **H-05-01 — fixed:** on `390×844`, the original top-aligned debuff cards covered the cast origin and upper flame. Portrait signals now use the lower safe lane; source, trajectory and target remain unobstructed.
- **H-05-02 — fixed after blind first observations:** the first cold ribbon was mathematically correct but too thin to identify without relying on the already-cold flame. Hand charge, dark separation halo, two luminous moving strands, motes and a leading contact point make the travel legible; travel was lengthened from 0.5 s to 0.8 s without changing gameplay timing.
- **H-05-03 — fixed in cross-viewport regression:** the original `800×360` crop kept the flame visible but clipped the Queen's face and cast-hand socket. The short-landscape scene focus moved from logical `y=1225` to `y=1110`, keeping gaze, hand, ribbon and flame base inside the viewport without changing portrait composition or gameplay coordinates.
- Flame bitmap design, balance and audio remained unchanged while fixing all three findings.

## Three required QA passes

1. **Pass 1 — static/deterministic:** exact identity, typecheck/lint/full tests, assets/animation audits, reference/frame/root/socket checks, flame loop/transition tests, dynamic target and zero pre-contact reaction.
2. **Pass 2 — production-browser Human-Eye Semantic QA:** low/mid/high/Inferno at 1× and 0.25×, continuous heat, all 12 boundaries, ≥20 s idle, ≥3 disapproval cycles, ≥3 full casts; unlabelled first observations answer HE-01..HE-05 from `QA_PLAN.md`.
3. **Pass 3 — independent regression:** another reviewer repeats key desktop/mobile/landscape visual cases, full core/platform/audio regression, performance/residency and exact evidence validation.

Evidence belongs only under `reports/visual-polish/<exact-build-id>/`. Earlier Cycle 02–04 captures are `SUPERSEDED` for flame temporal smoothness, v4 Demoness identity and spatial causality.

## Stop condition

Cycle 05 is DONE only when:

- all applicable rows of `ACCEPTANCE_CRITERIA.md` are `PASS` for one clean exact build;
- Pass 2 gives binary PASS to HE-01..HE-05 without labels or prior fix disclosure;
- independent Pass 3 has open Critical=0 and High=0;
- `validate-visual-polish-evidence.mjs` exits 0;
- gameplay/audio fingerprints remain frozen and full regression has zero skipped/failing tests.

Until exact production-browser evidence exists, implementation may be test-green but the project remains `NOT RUN`/not DONE for perceptual acceptance.
