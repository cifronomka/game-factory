# Corrective Cycle 04 — character polish, debuff clarity and living Inferno

## Status and scope

This is the active polish contract created from the user review dated 2026-08-20. It preserves direct-tap rules while versioning deterministic fixtures to V5 for concurrent hazards; current flame families, scoring, persistence, platform adapters, optional rewarded mock and audio registry remain. It does not authorize a rewrite or a new progression gate.

The cycle closes only after three passes on one exact build: implementation validation, independent temporal/gameplay/visual QA, and a full browser regression from Darkness through Inferno. Single still images do not prove character or Inferno motion.

## Ash Servant temporal contract

The existing character identity, hearth-side position, stationary root anchor and `decay ×1.80` hazard remain unchanged. The authored and interpolated presentation phases are:

| Gameplay interval | Visual phase | Normalized strength |
|---|---|---:|
| telegraph 0–150 ms | `prepare` — notices the hearth and braces | 0 |
| telegraph 150–700 ms | `inhale-ramp` — chest, shoulders and head visibly expand | 0 |
| telegraph 700–1000 ms | `inhale-hold` — short full-lung hold | 0 |
| effect 0–250 ms | `exhale-start` | 0→0.30 |
| effect 250–900 ms | `exhale-ramp` | 0.30→1.00 |
| effect 900–1700 ms | `exhale-peak` | 1.00 |
| effect 1700–2250 ms | `exhale-fade` | 1.00→0.20 |
| effect 2250–2500 ms | `exhale-end` | 0.20→0 |
| after effect, 0–450 ms presentation only | `recovery` → `idle` | 0 |

`exhaleStrength` is a presentation value derived from the active gameplay timer. Ash-stream length/opacity, lateral ember velocity and flame bend/suppression use that same value. They must ramp and recover; a binary one-frame switch is a failure. Root drift is at most 2 logical pixels, edge clipping and atlas wrap are zero. Idle remains restrained and slightly comic: breathing, small shoulder/head/ear/hand variation, without walking or boss-like posing.

## Demoness temporal and character contract

The Demoness is substantially taller than the Servant, remains clear of the central flame, and reads as a calm infernal queen rather than a dancing actor. The gameplay effect remains a passive decay hazard; taps do not cancel it or lose base power.

Idle uses slow breathing, cloth/hair drift, faint cold aura and long holds. A seeded presentation-only disapproval gesture may occur every 5–9 active idle seconds: look toward the hearth, pause, one slow negative head movement, return. The gesture cannot affect core state or restart an active cast.

| Gameplay interval | Visual phase | Cold strength |
|---|---|---:|
| telegraph 0–350 ms | `cast-look` — deliberate look toward hearth | 0 |
| telegraph 350–1350 ms | `arms-rise` — slow controlled raise | 0→0.20 |
| telegraph 1350–2000 ms | `cast-gather` — cold energy forms at hands | 0.20→0.45 |
| effect 0–500 ms | `cold-ramp` — ribbon reaches the flame | 0.45→1.00 |
| effect 500–3200 ms | `cold-hold` — stable authoritative suppression | 1.00 |
| effect 3200–4000 ms | `cold-release` — energy and arms lower | 1.00→0 |
| after effect, 0–800 ms presentation only | `recovery` → `idle` | 0 |

The ribbon originates at an authored hand socket and terminates at the hearth. Fire response follows `coldStrength`: lower brightness/height, fewer sparks, a restrained cold edge/haze, then a gradual warm recovery. Whole-body rhythmic rocking, rapid alternating poses, detached fragments, teleport and sudden scale changes are hard failures.

## Concurrent debuff contract

Servant and Demoness schedules may overlap. Core exposes each active source separately. Their decay factors multiply and the combined enemy factor is capped at `×2.50`:

`enemyDecayFactor = min(2.50, servantFactor × demonessFactor)`

Thus simultaneous `1.80 × 1.50` resolves to `2.50`, not `2.70`; taps retain their normal power. Friendly Heat Window and rewarded boost are separate statuses and do not masquerade as enemy debuffs.

The HUD renders a responsive vertical status list. Each enemy row contains a distinct source/icon, effect name, actual factor and remaining active time. Required copy:

- `Пепельный слуга` / `Пепельный выдох` / `Decay ×1,80`;
- `Демонесса угасания` / `Холодное угасание` / `Decay ×1,50`.

When both are active, both rows remain visible, readable and non-overlapping. An optional compact total may show `Общий decay ×2,50`, but it cannot replace the two source rows.

## Living Inferno contract

The first Stage 6→7 crossing runs one bounded 1.5-second climax: high-flame expansion, ember burst, rune wave, lighting pulse, restrained screen impulse and staged host reveal. Reduced Motion removes the screen impulse and lowers particle count without removing the semantic entry.

After entry, the scene never resolves to a static plate. At least five independently addressable host regions use different phase offsets, loop periods and amplitudes. At any 5-second observation window, at least two regions visibly change while no single whole-plate transform accounts for all motion. Wings, crown/body, watchers/eyes, smoke silhouettes and distant shapes must not move in lockstep. Presentation randomness is seeded and bounded; it never changes gameplay.

Stage 7 respects the existing particle, decoded-texture, frame-time and heap budgets. Full-resolution independent animations per demon are not required: sprite cells, cropped regions, transforms, light masks and pooled particles are combined deliberately.

## Balance verification

There is no `requiresBoost`, seal, provider permission or equivalent check for Stages 4–7. Rewarded remains optional `tapPower ×2` for 20 active seconds.

`reports/BALANCE_REPORT.md` records automatic simulations and actual production-browser input replays for five practically plausible profiles: casual mobile, fast mobile, casual mouse, skilled mouse and a short extreme burst. Rates are documented with burst/rest pattern and duration; impossible sustained automation is excluded from tuning decisions. Balance parameters change only if both deterministic and browser evidence show a target failure.

## Evidence and stop condition

Evidence lives under `reports/` and includes:

- complete Servant idle→inhale→hold→exhale ramp/peak/fade→recovery sequence with phase-synced flame metrics;
- Demoness idle, disapproval, full cast/cold response/recovery sequence;
- HUD states for Servant only, Demoness only and both simultaneous;
- Stage 6→7 entry plus a sustained Inferno sequence long enough to expose synchronization, seams or stopped loops;
- realistic balance profiles and mobile/desktop browser input results;
- Stage-7 performance samples on the required mobile and desktop profiles;
- issue/fix/regression history with open Critical=0 and High=0.

The goal remains incomplete while Servant exhale is abrupt, Demoness reads as dancing or fragmented, concurrent statuses overlap or disagree with core math, Inferno becomes static, no-ad progress has an artificial gate, temporal/browser QA is missing, or mobile Inferno performance misses its budget.
