# Balance Report — Corrective Cycle 04

## Verdict

The existing stage thresholds, base tap power and stage decay table remain unchanged. Deterministic evidence does not justify a balance rewrite:

- the required no-reward V5 progression trace reaches Inferno at `164.800 s`, inside the `90–180 s` target;
- a practically plausible skilled-mouse burst/rest hypothesis reaches Inferno without reward at `87.770 s`;
- casual mobile, casual mouse and fast mobile expose Stages 4, 5 and 6 respectively in a three-minute run;
- the optional ×2 control improves skilled-mouse Inferno entry by exactly `20.000 s`, longest continuous hold by `61.746 s`, and score by `18,199` without changing progression permission;
- every deterministic result is identical at 60/30/15 FPS within the documented observation tolerance.

This is a **headless deterministic PASS**, not a production-browser PASS. Real touch-emulation and mouse replay evidence has not yet been captured for this build; browser acceptance remains open.

## Mechanical contract under test

- Every unique valid tap is processed at full base power. There is no cadence, rolling rate, combo or reward permission gate.
- `heat = min(1000, heat + tapPower)` is the only upper clamp. Stage 5 is crossed at heat `560` through the same formula as every other stage.
- Ash Servant and Demoness schedules are independent and may overlap.
- Active enemy factors combine as `min(2.50, 1.80 × 1.50) = 2.50`. They affect decay only; taps do not cancel either timer and retain full tapPower.
- Heat Window and rewarded ×2 are positive, separate channels and never appear as enemy debuffs.
- The emergency protection remains 256 commands per 50-ms fixed step. The fastest human hypothesis below produces one input per 100 ms, so the protection is not a balance factor.

## Deterministic methodology

Source fixture: `tests/fixtures/human-input-profiles.json`. Runner: `tests/fixtures/canonical-direct.js`. Each run begins at heat 30 with the first input at active time 0, lasts `180.000 s`, and is replayed against the same 50-ms core simulation from render loops of 60, 30 and 15 FPS.

The rates below are test hypotheses chosen to be maintainable or briefly achievable by a human, not claims from instrumented users. `Pattern rate` describes the active sequence; `accepted average` is accepted taps divided by the full three-minute checkpoint, including declared rests.

| Profile | Browser input contract | Pattern rate | Accepted average | Reward |
|---|---|---:|---:|---|
| casual mobile | touch intervals repeat `420/380/450/350/400 ms` | `2.50 taps/s` | `450 / 180 s = 2.50` | none |
| fast mobile | touch intervals repeat `200/220/240/210/230 ms` | `4.55 taps/s` | `819 / 180 s = 4.55` | none |
| casual mouse | mouse intervals repeat `300/250/280/260/310 ms` | `3.57 clicks/s` | `643 / 180 s = 3.57` | none |
| skilled mouse | mouse intervals `120/140/160/150/130 ms` for `8.0 s`, then `1.3 s` rest | `7.14 clicks/s` in bursts | `1126 / 180 s = 6.26` | none |
| extreme burst | fast-mobile pattern, then exactly `3.0 s` at `100 ms`, then fast-mobile pattern | `10.00 clicks/s` for 3 s only | `835 / 180 s = 4.64` | none |
| rewarded control | identical to skilled mouse | same as skilled | `1126 / 180 s = 6.26` | one success at first eligible safe instant ≥65 s |

The extreme burst is deliberately short and is not used as the sustained progression target. No profile assumes more than 10 inputs/s, and only the extreme profile reaches 10 inputs/s.

## Exact deterministic results

| Profile | First entry by stage | Maximum / final stage | Final heat | Longest Inferno hold | Score | Concurrent enemy sources observed |
|---|---|---|---:|---:|---:|---:|
| casual mobile | S2 `6.800 s`; S3 `32.420 s`; S4 `84.800 s` | S4 / S4 | `410.829123` | `0` | `28,085` | 1 |
| fast mobile | S2 `3.720 s`; S3 `15.600 s`; S4 `33.000 s`; S5 `60.500 s`; S6 `122.760 s` | S6 / S6 | `759.406952` | `0` | `82,455` | 2 |
| casual mouse | S2 `4.750 s`; S3 `20.690 s`; S4 `45.630 s`; S5 `97.430 s` | S5 / S5 | `569.175515` | `0` | `50,457` | 2 |
| skilled mouse | S2 `2.360 s`; S3 `10.820 s`; S4 `21.820 s`; S5 `35.720 s`; S6 `59.420 s`; S7 `87.770 s` | S7 / S7 | `911.368834` | `13.063498 s` | `191,514` | 2 |
| extreme burst | S2 `3.720 s`; S3 `15.600 s`; S4 `33.000 s`; S5 `60.000 s`; S6 `106.100 s` | S6 / S6 | `758.042902` | `0` | `85,372` | 2 |
| skilled mouse + ×2 | same through S6; S7 `67.770 s` | S7 / S7 | `911.369145` | `74.809383 s` | `209,713` | 2 |

The skilled profile does not hold Inferno permanently: its rest windows create exits, and its longest uninterrupted segment is `13.063498 s`. That is intended evidence of difficulty after reveal, not a failed progression run. The rewarded control reaches the same content without special permission but creates a much longer early hold and higher score.

## Versioned canonical and constant-rate controls

`canonicalDirectNoRewardV5` reaches Stages 2–7 at `9.000 / 43.500 / 64.500 / 102.000 / 145.200 / 164.800 s`; checkpoint output is 786 accepted taps, score `110,498`, heat `946.465417`, current hold `15.060 s`.

`canonicalDirectBoostedV5` uses one optional success at 65 s and reaches Stages 2–7 at `9.000 / 43.500 / 64.500 / 75.750 / 83.950 / 102.710 s`; checkpoint output is 944 accepted taps, score `180,220`, heat `936.94`, current hold `65.950 s`.

The constant-rate V2 matrix remains a diagnostic control, not a human model: 2 taps/s peaks at S4, 4 taps/s at S5, 5 taps/s at S6, and 7.14 taps/s reaches S7 at `66.920 s`.

## Required production-browser replay

The browser pass must use the exact timestamp sequences from `human-input-profiles.json` rather than an unbounded auto-clicker:

1. Use one clean production build and reset records/run before each profile.
2. Replay `casual-mobile` and `fast-mobile` through the production pointer path under a 390×844 touch-emulation viewport; replay the three mouse profiles at a desktop viewport.
3. Preserve each listed interval, burst and rest. Record actual dispatch-to-accept latency, accepted tap count, first stage-entry timestamps, maximum stage, final stage/heat, and console errors.
4. Run the rewarded control through the visible sheet/provider contract. Do not mutate core state or call a progression helper.
5. Confirm two simultaneous enemy rows remain separately readable and that taps continue during both effects.
6. Compare accepted counts exactly and stage timestamps against headless values with browser scheduling tolerance defined by QA. A dropped unique pointer event, duplicate synthetic click, hidden rate cap, missing source row, or reward-dependent crossing is a defect, not a reason to rewrite balance.

### Exploratory production-browser result

The current production pointer path was replayed in the in-app Chromium browser with no core mutation helper and no reward. One sustained skilled-mouse run dispatched `727` accepted primary-pointer clicks over `112.542 s` in three bounded segments (`271/45.006 s`, `276/45.041 s`, `180/22.649 s`) and reached Stage 7. Observed average was `6.46 clicks/s`; console warnings/errors were `0`. This confirms that no-reward Inferno is practically reachable without a hidden permission gate and is directionally consistent with the deterministic skilled profile.

A separate paired run used the visible confirmation sheet and the asynchronous Web test provider. The UI reported exactly one `×2` boost for 20 active seconds; content access was unchanged, while progression/hold became easier.

The same browser run observed Servant and Demoness active together: source rows displayed `×1.80` and `×1.50`, total `×2.50`, and gameplay input remained accepted. A landscape overflow found during this observation was fixed in the HUD grid and must be rechecked on the clean exact build.

Status: **PARTIAL PASS.** Mouse/pointer plausibility and no-reward reachability are observed. Exact timestamp replays under 390×844 touch emulation and the immutable clean-build raw logs remain Pass 2 evidence work; real-device claims are not made here.

## Decision and regression risks

No stage threshold, base tapPower, per-stage decay, event duration, or reward duration was changed. Only the required concurrent scheduling/stacking semantics changed and the fixtures were rebaselined to V5/V2.

Regression risks to keep in the browser and full suite:

- presentation reading the deprecated single `encounter` projection instead of the authoritative `encounters[]` can hide one source;
- two independent boundary transitions at the same timestamp must emit two complete source event sequences without duplicate timers;
- stage exit cancels Servant and Heat Window under their existing rules, while an already-active Demoness effect finishes;
- the UI total must display the capped `×2.50`, not raw `×2.70`, while source rows retain `×1.80` and `×1.50`;
- pause/ad/background freezes all source timers without catch-up;
- optional reward may be offered only in a safe no-encounter instant, but its absence never affects stage calculation.
