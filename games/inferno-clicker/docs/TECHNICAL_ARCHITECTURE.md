# Technical Architecture — «Зажги»

## Назначение

Документ фиксирует технический контракт `inferno-clicker`: границы platform-agnostic core, выбранный browser-first стек, модель состояния, производительность, сборку и тестирование. Игровые числа определяет `GAME_DESIGN.md`, внешние ограничения — `PLATFORM_REQUIREMENTS.md`.

## Статус и владелец

- Этап: Yandex Release Cycle 09 / 1.0.0. Проверенный C08 art/motion baseline наследуется, но rewarded, localization, adapter selection, cloud rate limiting, goals, browser compatibility, visible content и release evidence переоткрыты. `YANDEX_RELEASE_CYCLE_09.md` имеет приоритет над конфликтующими прежними решениями.
- Владелец: Game Architect.
- Primary runtime: браузер внутри Yandex Games.
- Architecture rule: ни один модуль `src/core/` не импортирует Yandex SDK, VK Bridge, Android API, DOM или renderer.

## Выбранный стек

- **Language:** authoring modules `.js` с `// @ts-check` и JSDoc contracts; Yandex production собирается в compatibility bundle без runtime-зависимости от native ESM. Runtime assertions остаются на внешних границах.
- **Build/dev server:** воспроизводимые Node.js scripts на built-in API; asset-authoring использует зафиксированный `sharp@0.35.3` через `package-lock.json`.
- **Rendering:** layered Canvas 2D scene с независимыми render passes, pooled particles и low-resolution light/haze buffers; HTML/CSS overlay только для доступного HUD, меню и рекламной CTA.
- **Audio:** Web Audio API через небольшой собственный `AudioMixer`; тяжёлая engine-обвязка не нужна.
- **State:** явный serializable `GameState` и pure reducer/systems; без глобального mutable singleton.
- **Tests:** built-in `node:test` для core/contract suites, repository E2E smoke scripts и реальный browser QA через управляемый браузер; визуальные screenshots на эталонных viewport.
- **Package manager:** npm `11.17.0`; production runtime имеет ноль внешних зависимостей, authoring dependency устанавливается `npm ci`; минимальная версия Node фиксируется в `.nvmrc`.

Выбор минимизирует стартовый bundle и устраняет сетевую зависимость build после того, как package registry оказался недоступен в implementation environment. PixiJS/Vite/TypeScript отклонены для v0.1.0 как невоспроизводимые без registry; архитектурные контракты сохраняются через явные scene passes, JSDoc ports, runtime assertions и tests. Phaser/React остаются избыточными для одной сцены.

## Структура приложения

```text
src/
  app/                  # composition root, boot sequence, dependency injection
  core/
    model/              # GameState, configs, persisted schema
    systems/            # heat, decay, scoring, stages, encounters, boost
    commands/           # tap, start, restart, pause/resume
    events/             # typed domain events for presentation/audio/analytics
  presentation/
    scene/              # Canvas 2D layer passes, stage visual state mapper, responsive camera
      flame/            # independent multi-layer flame rig and emitters
      characters/       # servant, demoness and observer presentation state machines
      environment/      # chamber, fire-ring plane, gates, chains and reveal masks; no religious/esoteric marks
    ui/                 # DOM HUD, goals, dialogs, localized accessibility labels
    i18n/               # RU/EN dictionaries and SDK-locale mapping outside core
    input/              # pointer normalization and anti-duplicate gate
    audio/              # Web Audio mixer and adaptive layers
  assets/               # manifest, preload groups, validation
  platforms/
    types/              # PlatformService contract and capability results
    web/                 # local fallback
    yandex/              # only place importing Yandex SDK
    vk/                  # future adapter
    android/             # future wrapper bridge
  telemetry/            # domain-event mapping; no gameplay decisions
```

Dependency direction: `app → presentation/platform adapters → core`; `core` depends only on JSDoc value contracts and injected monotonic clock. Gameplay RNG в MVP отсутствует; session seed принадлежит только presentation/audio variations. Platform callbacks dispatch commands, never mutate game state directly.

`PresentationViewModel` Cycle 09 получает `rewardOffer`, `goals` и `nextGoal`; legacy `rewardedProvider` удаляется. Stage/effect fields передают stable IDs, а i18n layer выбирает RU/EN text. `goals` — восемь объектов `{id, current, target, complete}` в фиксированном порядке из `GAME_DESIGN.md`; `nextGoal` — первый incomplete или `null`.

## Boot sequence

1. Render a lightweight branded loading shell without starting audio/gameplay.
2. Для target `yandex` без hostname-эвристики загрузить `/sdk.js` до application entry, вызвать `YaGames.init()` once, подписать SDK pause/resume и получить locale; time-box remote init to 5 s.
3. Load local settings and persistent records; cloud merge may complete afterward.
4. Load critical stage-1/2 flame atlas families, HUD, environment and initial wood-fire audio metadata.
5. Construct core and RU/EN presentation; browser pause coordinator уже создан до SDK/gameplay.
6. Вызвать `LoadingAPI.ready()` once только когда no loading overlay remains, HUD видим и tap/click accepted.
7. Unlock audio on the first trusted pointer gesture and start gameplay.

Adapter init failure не меняет build target: Yandex service остаётся local-only с unavailable rewarded/remote leaderboard и не блокирует game core. Production bundle не содержит test provider или бесплатный rewarded success.

## Game state

```ts
type GameState = {
  phase: 'LOADING' | 'READY' | 'PLAYING' | 'PAUSED' | 'AD_BREAK' | 'RESULTS' | 'ERROR';
  heat: number;                 // 0..1000
  scoreAcc: number;             // non-negative, capped at 2_147_483_647
  score: number;                // floor(scoreAcc), safe non-negative integer
  bestScore: number;
  multiplier: number;
  stage: 1 | 2 | 3 | 4 | 5 | 6 | 7;
  stageProgress: number;        // 0..1 within current threshold band
  decayRate: number;            // heat units/s, derived from config + effects
  tapPower: number;             // derived base value, not persisted independently
  encounters: Array<{
    kind: 'servant' | 'demoness' | 'heat-window';
    phase: 'telegraph' | 'effect';
    msLeft: number;
  }>;
  decayFactor: number;          // product of active enemy effects, capped at 2.50
  boost: null | { activeMsLeft: number };
  activeRunTimeMs: number;
  infernoHoldMs: number;
  runHighestStage: number;
  maxMultiplier: number;
  grantedStageBonuses: number[];
  pauseReasons: ('ad' | 'visibility' | 'platform' | 'menu')[]; // unique values, serializable
  runId: number;
};
```

Все thresholds и coefficients находятся в versioned immutable config. Core работает fixed simulation step `50 ms`; renderer интерполирует визуал. После frame gap входной frame delta ограничивается `100 ms`, а pause/background gap не догоняется. Во время `PAUSED` и `AD_BREAK` simulation clock, boost и session cooldown не идут. Каждый accepted tap применяет heat до cap `1000`; provider state не участвует в stage crossing. Первый `onRewarded` request ID ставит queued 60-s boost; application-level cooldown хранит `90 000 ms` active session time и не persisted.

Gameplay schedules в MVP детерминированы активным временем и versioned config; core PRNG для progression/encounters не используется. Только несмысловые visual/audio variations получают отдельный injected session seed и не меняют state/score. Серверного authoritative anti-cheat в MVP нет; leaderboard submission проходит sanity checks и rate limit adapter, а риск client-side manipulation фиксируется как известное ограничение.

## Rendering

- Logical portrait canvas: `1080 × 1920`; responsive contain/crop policy сохраняет центральный flame и HUD safe areas.
- Сцена разделена на независимые Canvas render passes в фиксированном порядке: far chamber/vignette → midground architecture/gates → ritual plane/runes/cracks → observers/characters → flame rig → local light/particles/smoke/distortion → foreground chains/ash → DOM HUD.
- Darkness — маска/тональный слой, управляемый normalized heat; stage reveal не требует загрузки цельного экрана на каждую стадию.
- Texture atlases — максимум `2048 × 2048`; крупные backgrounds — отдельные WebP/AVIF layers с WebP fallback.
- Heat distortion и bloom имеют `high/low/off` quality tiers. Auto quality использует измеренную стоимость application update/render, отдельно от RAF refresh interval: warm-up, visibility gate/resume reset и минимум два последовательных over-budget окна обязательны. Переход выполняется без toast; telemetry хранит p50/p95 render cost, refresh baseline, tier и reason.
- `prefers-reduced-motion` или ручной Reduced FX отключает distortion/camera shake и ограничивает particles, не скрывая gameplay cues.

### Stage presentation contract

Core является единственным владельцем `stage` и `stageProgress`. Pure `SceneVisualStateMapper` преобразует их вместе с encounter/boost states в целевые opacity, tint, light radius, emitter limits и animation state каждого container. Presentation не изменяет heat, thresholds или timers.

- `stageChanged` немедленно меняет semantic visual state; environment layers и текущая/следующая flame family выполняют обратимый fade `0.8–1.5 s`, а authored transition clip даёт не менее трёх промежуточных состояний. Колебание около порога не создаёт резкого мигания и не вводит gameplay hysteresis.
- Новый `stageChanged` во время fade меняет target существующего tween, а не запускает второй tween/particle system. Stage cue дедуплицируется согласно audio/QA contract.
- Actual normalized heat непрерывно управляет flame scale, reveal mask и light radius через `SceneVisualStateMapper`; `stageProgress` остаётся доступным только для HUD progress. Ни heat, ни stage не подменяют дискретные character/event states.
- Far/mid/ritual/character/flame/FX containers обновляются независимо. Пауза замораживает animation clocks и emitters через общий application clock; renderer не использует wall-clock catch-up.
- Visual reference PNG используются только для mood, perspective, reveal density и composition targets. Они не входят в runtime manifest и не могут быть полноэкранным background; production scene собирается из элементов `ASSET_PLAN.md`.

### Multi-layer flame rig

Пламя — самостоятельный `FlameRig`, а не один raster sprite с warp/deformation. Оно содержит:

1. `flame-core-low/mid/high` — authored RGBA WebP atlases с 8/10/12 ordered frames, органическим бело-золотым ядром и единым hearth pivot;
2. `flame-outer-low/mid/high` — независимые authored RGBA WebP atlases с 8/10/12 ordered frames и отличающейся фазой янтарно-алых языков;
3. `flame-glow` — отдельный low-resolution additive light buffer, который не меняет alpha художественных слоёв;
4. `flame-embers` — pooled sparks/embers emitters с quality caps;
5. `flame-smoke-haze` — независимые smoke particles и quarter-resolution heat distortion;
6. `flame-tap-burst` — pooled one-shot ripple/spark feedback на accepted tap;
7. `flame-stage-fx` — один authored 8-frame flare atlas: forward для upward, reverse + cool tint для downward boundary; на family boundaries он совмещён с root-locked crossfade;
8. `flame-fan-response` — bounded brightness/height/ember impulse, запускаемый presentation event и не влияющий на core taps; отдельный fan-response bitmap в этом candidate не заявляется.

Размер, цвет и интенсивность каждого подслоя выводятся из `SceneVisualState`; character animation и environment reveal не зависят от flame animation timeline. Для близких adjacent authored cells `SpriteAnimator` может отдавать `current/next/mix`, но full-body crossfade далёких поз запрещён: actor smoothness обеспечивают уникальные близкие in-betweens. Family position пламени остаётся непрерывным reversible scalar; tap не меняет clip clocks. Pause замораживает clock без catch-up. Reduced Motion сохраняет спокойный authored loop и все semantic attack cues. Большие character clips загружаются ahead-of-need как независимо освобождаемые ресурсы: render-active/imminent clips pinned, inactive optional clips закрываются после bounded grace interval. Instant decoded residency `≤64 MiB`, target `≤56 MiB`; lifecycle audit включает overlapping encounters, Inferno entry, pause/resume и teardown.

### Character animation contract

`CharacterScene` использует atlas clips и phase interpolation, а не один cutout с whole-body dance/warp. Core отдаёт независимые `encounters[]`; presentation derives phase progress from each source timer and never changes hazard timing.

- Ash Servant keeps one stationary hearth-side root. The 1.0 s telegraph is split into prepare/inhale/hold; the 2.5 s effect into exhale start/ramp/peak/fade/end followed by a separately authored 800 ms presentation-only recovery using all eight cells. Appearance, idle, inhale, blow and recovery contain unique ordered in-betweens; reverse playback and full-pose ghost crossfade are forbidden. Atlas normalization uses one clip-family reference scale instead of fitting every alpha bbox independently. Per-frame root/mouth/anatomical landmarks prove root drift `≤2 logical px` and unintended scale drift `≤2%`. The sampled mouth drives bounded steam to `FlameRig.getTargetAnchor()`; snowflake and fixed horn/world emitters are forbidden.
- C08 Ash Servant atlases preserve C07 logical draw size, anatomy, root and state timing. Only pixels/metadata needed for clean exterior and enclosed-gap alpha may change; `root`, `mouth`, anatomical landmarks and visible alpha bbox are remeasured after cleanup.
- Demoness C08 is redrawn from the approved reference at native-or-higher resolution and packed into exact `512×832` RGBA cells; resizing C07 atlas pixels into those cells is forbidden. Appearance/idle/disapproval/cast/hold/recovery retain unique forward-authored poses and distinct per-frame `leftHand`/`rightHand` palm sockets. Two accepted bounded steam streams follow the transformed palm sockets toward the live flame target. Blue ice shards, icicles, cold ribbon and projectile-contact semantics remain forbidden; presentation travel/collision never drives core timing.
- Inferno host preserves its accepted entry timing/composition. Post-entry main host and sentinel are separate five-frame atlases and application clocks with an initial phase offset; translating or scaling rectangular crops of one static plate is not sufficient.
- Character atlases use genuine alpha for exterior background and every enclosed negative space. The asset pipeline derives a silhouette/internal-gap mask, then color-decontaminates only partial-alpha edge RGB from nearby character material. C08 WebP keeps alpha lossless and verifies approved-mask SHA-256 against decoded alpha after encoding; changed alpha pixels, max alpha error and low-alpha leaks are all zero. A global light-pixel deletion threshold is forbidden because it would erase skin, eyes, metal and authored highlights. Every frame passes matte/fringe/island inspection after composition on black, dark-red and neutral-gray backgrounds.
- Demoness has one logical draw box of exactly `504×840`, replacing C07 `420×700` (`+20%` on both axes), with a stable feet/root baseline and no per-state scale override. The shared transform helper returns the same scale/translation for draw and QA. For every required state/viewport/DPR, effective upscale remains `≤1.25×` and the visible rendered Demoness alpha-bbox height is `≥1.25×` the corresponding Servant bbox height. Critical flame/HUD overlap and clipping are `0`; only a minimal constant horizontal anchor correction is allowed.
- Versioned frame metadata includes `cellSize:{width:512,height:832}`, `drawSize:{width:504,height:840}`, source/reference hashes, frame rect, visible `alphaBbox`, `root`, both palm sockets and anatomical landmarks. A typical eight-cell clip is `2048×1664` on a `4×2` grid and stays within the `2048 px` texture-side limit.
- `steamStrength` controls only visible vapor density; per-source `steamReach` advances presentation from each current rendered socket to `FlameRig.getTargetAnchor()`. Existing encounter phase drives the already-approved flame response independently of Canvas collision. Target coordinates include current heat, tap impulse, bend and suppression, so a fixed hearth miss is impossible. Whole-body rhythmic rocking, detached components and one combined hand origin are forbidden.
- Servant and Demoness may animate attacks simultaneously. HUD receives a vertical `debuffs[]` list with source, effect, factor and remaining time for each; combined core factor is displayed only as an optional total and never replaces source rows.
- Stage-7 host is split into two separately decoded actors with different deterministic phase offsets/periods. Stage 6→7 adds one bounded 1.5 s entry sequence; ambient host/flame/runes/particles continue afterward. Reduced Motion removes the camera impulse and lowers particle cost without making the scene static.

Pause and teardown freeze/clear all actor, recovery, idle-gesture and host clocks without wall-clock catch-up. Exact timings and binary QA metrics are fixed in `CORRECTIVE_CYCLE_04.md`.

### Presentation events and automated verification

Core публикует typed domain events `tapAccepted`, `tapRejected`, `stageChanged`, `encounterStarted/Effect/Ended`, `boostStarted/Ended`, `runEnded`, `recordsChanged` и `pauseReasonsChanged`. App/presentation агрегирует accepted taps в semantic `acceptedHeatBurst` не чаще одного раза за 120 ms для visual/audio fanning; это событие не возвращается в core и не может менять heat/score. Scene, DOM HUD, audio и telemetry подписываются независимо; ни один consumer не вызывает gameplay mutations напрямую.

- Headless core и deterministic clock позволяют unit/property simulations без DOM, Canvas, audio или SDK; отдельный seeded harness проверяет только несмысловые presentation/audio variations и не входит в gameplay state.
- `SceneVisualStateMapper` проверяется table-driven snapshot tests для семи stages, all single/concurrent encounter combinations and boost without launching Canvas.
- Renderer integration tests проверяют atlas bounds/hash/reference SHA, exact C08 cell/draw dimensions, source-not-upscaled declaration, approved-mask→decoded-WebP exact alpha parity, detached Servant contour tiles=0, exterior/internal alpha masks, partial-alpha edge RGB, frame selection/interpolation, one-family Servant scale, real-scene-transform/DPR upscale and Demoness/Servant visible-bbox ratio, stable roots, current mouth and independent left/right palm→visible-flame geometry, layer order, pause freeze and cleanup; a managed production browser records continuous temporal and three-background evidence on the exact build.
- Character state machines используют domain events и asset states из `ASSET_PLAN.md`; hit testing остаётся только у центральной gameplay zone и DOM controls.

## Input

`PointerEvent` — основной источник tap/click; compatibility path использует взаимоисключающие touch/mouse listeners, если Pointer Events недоступны. Input layer принимает left mouse и каждый новый touch/pen contact внутри hit area, предотвращает browser scroll/zoom, context menu, drag/select и дедуплицирует synthetic click после touch. Один физический контакт создаёт ровно одну команду `Tap`.

- Центральная зона пламени занимает не менее `96 × 96 CSS px`; основной gameplay также принимает tap по безопасной центральной области сцены.
- UI controls имеют минимум `48 × 48 CSS px` и не пробрасывают tap в core.
- Разные touch `pointerId` считаются отдельными физическими contacts; repeat одного активного pointerId до `pointerup/pointercancel`, synthetic compatibility click и повторный `inputId` не создают второй tap.
- Core обрабатывает все уникальные команды внутри `50 ms` step по `(timestamp, enqueue order)`. Нет rolling cap, cadence reduction или gameplay cooldown. Единственная аварийная защита — `256` уникальных команд в одном step (`>5120/s`); overflow помечается `input-overflow` и агрегируется для telemetry. Visual/audio consumers могут объединять feedback одного frame, но не gameplay heat/score.

## Persistence

Persisted schema `InfernoSaveV1` содержит `schemaVersion`, `bestScore`, all-time `highestStageReached`, `longestInfernoHoldMs`, stage-only `maxMultiplier` (`1..5`), `runsPlayed`, tutorial flags, audio/reduced-motion settings, legacy daily-goal date/status и `updatedAt`. Goals вычисляются из record fields и не требуют migration. Текущий `runHighestStage`, heat, score, timers, encounters, boost и cooldown не сохраняются: новый run начинается в `READY` с `heat=30`.

- Local: `localStorage` записывается без ожидания cloud; `SaveCoordinator` детерминированно coalesces изменения, flushes при result/pause/visibility/pagehide и не позволяет позднему promise перезаписать новый максимум.
- Yandex: local-first, затем `Player.getData()/setData()` при доступном player; merge по максимуму для рекордов и по `updatedAt` для настроек. Latest-wins cloud queue пишет не чаще одного раза за 5 секунд, объединяет pending maxima и поддерживает explicit `flushData()`.
- Corrupt/unknown save не приводит к crash: quarantine diagnostic, defaults, событие `save_recovered`.
- Failed cloud write повторяется максимум два раза с exponential backoff только в текущей сессии; local record остаётся источником восстановления.

## Platform abstraction

```ts
interface PlatformService {
  init(): Promise<PlatformCapabilities>;
  markReady(): Promise<Result<void>>;
  saveData(data: PersistedData): Promise<Result<void>>;
  flushData(): Promise<Result<void>>;
  loadData(): Promise<Result<PersistedData | null>>;
  submitScore(score: number): Promise<Result<void>>;
  getLeaderboard(): Promise<Result<LeaderboardEntry[]>>;
  showRewardedAd(placement: 'heat-power-2x-60s'): Promise<RewardedResult>;
  showInterstitial(placement: string): Promise<AdResult>;
  pauseGame(reason?: string): Result<void>;
  resumeGame(reason?: string): Result<void>;
  subscribePauseChanges(listener: (state: PauseSnapshot) => void): () => void;
  getPauseSnapshot(): PauseSnapshot;
  dispose(): void;
}
```

`PlatformCapabilities` содержит `locale: 'ru'|'en'`, `authorized` и отдельные booleans `rewarded`, `leaderboardRead`, `leaderboardWrite`, `cloudRead`, `cloudWrite`; provider identity не передаётся в view model. `RewardedResult` различает `rewarded`, `closed`, `unavailable`, `error`; первый `rewarded` request ID выдаёт максимум одну награду. Adapter преобразует platform/browser pause/resume в idempotent reason-set: игра возобновляется, только когда закрыты все причины (`ad`, `visibility`, `platform`, `menu`, `game-ended`). Technical leaderboard name — `best-score`; read/write предваряет `isAvailableMethod`. Guest/auth-required не запускает login без отдельного user action.

## Asset loading

- Generated asset manifest содержит path, hash, bytes, dimensions/duration, clip summary, license/provenance и preload group; exact frame rectangles/fps/loop/pivot находятся в соседних atlas JSON.
- Loader выбирает WebP либо PNG fallback один раз по capability и не загружает оба формата одного asset; network path имеет `fetch` и XHR fallback. Decode/upload error даёт bounded retry или approved procedural/local fallback без бесконечного refetch.
- C08 character records additionally contain raw native source dimensions, per-frame `sourceToAtlasUpscale≤1.0`, approved/decoded alpha SHA-256 with `encodedAlphaExact=true`, `cellSize`, logical `drawSize`, visible `alphaBbox`, exterior/internal-gap alpha metrics, partial-alpha decontamination metrics and the accepted C07 baseline hash. Runtime URLs are Ash Servant v6 and Demoness v7; superseded C07 bytes remain traceable through hashes/Git history but are excluded from production assets.
- Critical group: HUD, low flame core/outer atlases, stage 1–2 background и wood/charcoal bed metadata; mid/high flame, character/action and transition groups грузятся ahead-of-need при достижении 60% текущего stage.
- Ошибка optional asset включает procedural/neutral fallback; ошибка critical asset показывает retry, но не оставляет чёрный экран.
- Audio декодируется по требованию после user gesture. Runtime graph этого candidate содержит два field-recording ambience beds, агрегированный fanning bus (120-ms window, 180-ms start cooldown, не более двух затухающих voices) и master lifecycle envelope; stage/character foley в registry не входит, oscillator/runtime-noise sources запрещены.
- Cache busting — content hashes; service worker в MVP не используется, чтобы не создавать stale-build риск внутри platform iframe.
- Demoness clip resources remain independently disposable: exactly one `2048×1664` atlas is resident. Before a switch, the current `512×832` authored cell is copied to one canvas cache, the old atlas is released, then the new atlas starts decoding; the cache is discarded on commit. Audit residency includes the cache and must stay `≤64 MiB`; the calculated C08 maximum is 64,814,080 B (61.81 MiB), a documented exception above the 56 MiB target.

## Performance constraints

| Ограничение | Бюджет | Метод измерения | Target |
|---|---:|---|---|
| Ready to interactive, warm CDN | ≤3.0 s p75 | Navigation marks → platform ready | mid-tier Android, 4G profile |
| Initial compressed transfer | ≤3.0 MB | Browser network log | JS/CSS + critical assets |
| Total production package | ≤15 MB | dist manifest | без source maps/tests |
| Main JS gzip | ≤350 KB | bundle analyzer | production build |
| Frame delivery | median ≥55 FPS on ENV-D1, ≥30 FPS on ENV-M1; frames >50 ms ≤1% | 10-minute performance run | documented desktop + mid-tier Android profiles |
| Frame time | p95 ≤20 ms high tier; ≤33 ms low tier | PerformanceObserver/profiler | active stage 7 |
| Input visual feedback | ≤100 ms p95 | pointer timestamp → first changed frame | touch/mouse |
| JS heap | ≤150 MB after 10 min | browser memory sample | stage 7 stress |
| Resume correctness | 0 simulation steps while paused; first step ≤100 ms after valid resume | deterministic lifecycle test | ad/visibility/platform |

## Build process

Воспроизводимые команды implementation/release:

```text
npm run lint
npm run typecheck
npm test
npm run build:yandex
npm run test:yandex
npm run package:yandex
```

`build:yandex` создаёт compatibility bundle и `dist/`; `package:yandex` валидирует Yandex target, manifest и ZIP по `RELEASE_PLAN.md`. Pipeline сначала собирает единый IIFE через esbuild, затем пропускает его через Babel `@babel/preset-env` с явными minimum targets Chrome 49 / Firefox 52 / Safari 9 / Edge 15. Отдельный AST-аудит fail-closed запрещает оставшиеся `class`, arrow/async functions, optional chaining, object spread/rest, `for…of`, `const` и `let`; CSS-аудит требует fallback перед `inset`, `min/max/clamp`, safe-area и 8-digit color declarations. Runtime задаётся `.nvmrc` на Node 24 LTS. Authoring/transpilation dependencies фиксируются lockfile и не попадают в runtime. Build не обращается к сети и не встраивает secrets. Runtime assets загружаются из archive root; `/sdk.js` — единственный platform loader path, а SDK/ads/cloud/leaderboard network failures сохраняют local-only gameplay.

## Testing strategy

- Unit/property tests: heat clamp, decay integration, every-valid-tap throughput, scoring, thresholds, encounters, 60-s boost/90-s active cooldown/repeat, goals/nextGoal, pause clock, cloud queue/merge и corrupt save recovery.
- Deterministic simulations: no-reward V5 и новый rewarded C09 trace на 60/30/15 FPS дают одинаковый core state within `≤0.01 heat`, `≤1 score`, `≤10 ms` hold. Human plausibility проверяется production browser input path.
- Adapter contract suite: mocked Yandex покрывает SDK success/failure, RU/EN, ready once, gameplay lifecycle, guest/authorized, cloud rate limit/flush, leaderboard availability и rewarded success/closed/error/timeout/duplicate/late.
- Browser E2E: production target без hostname dependency/test provider; touch/mouse fallback, seven stages, goals, restart, persistence, no-SDK local-only и lifecycle.
- Visual regression: seven-stage runtime и 64 character frames на black/gray/red, DPR 1/2/3, official desktop matrix, mobile portrait/landscape, zoom/rotation/safe areas.
- Performance: четыре session traces `≥12 минут` desktop/mobile × rewarded/no-reward; median FPS, long frames, heap, input p95 и decoded residency фиксируются по `QA_PLAN.md`.

## Architecture decisions и риски

| Решение/риск | Статус | Обоснование/митигация | Владелец |
|---|---|---|---|
| Canvas 2D render passes + DOM HUD | Решено при implementation | Zero-dependency layered scene без registry/runtime dependency; UI остаётся доступным | Architect |
| Fixed-step core | Решено | Баланс не зависит от FPS, deterministic QA | Architect |
| No active-run restore | Решено | Снижает clock/save exploits; сохраняются только records/settings | Product + Architect |
| WebGL/shader cost | Риск | Quality tiers, reduced FX, frame-time downgrade | Developer + Art |
| Client-side leaderboard manipulation | Принят для MVP | Sanity checks; серверная валидация — post-MVP decision | Product + Platform |
| SDK/API drift | Риск | SDK только в adapters; official docs recheck перед integration/release | Platform Agent |
| Package budgets vs layered audio/art | Риск | Critical/optional groups и budgets из `ASSET_PLAN.md` | Architect + Art + Audio |
| Stage-threshold visual chatter | Риск | Core остаётся без hysteresis; reversible target-based fades, event deduplication и mapper tests предотвращают flicker/duplicate emitters | Developer + QA |
| Reference-to-runtime flattening | Запрещено | Concept PNG не входят в runtime; каждый background/character/flame/FX/UI элемент имеет отдельный registry entry и layer owner | Architect + Art |
| C08 alpha cleanup erases real highlights | Риск | Mask exterior/internal negative spaces first; decontaminate partial-alpha RGB only; three-background Human-Eye veto | Art + QA |
| C08 Demoness is an upscaled C07 raster | Запрещено | Native-or-higher redraw, `512×832` cells, source hashes/dimensions and detail crops are mandatory evidence | Art + Reviewer |
| Larger Demoness breaks composition/residency | Риск | Exact `504×840` common draw box, root-locked geometry matrix, `≥1.25×` visible-height rule, one full Demoness atlas and one bounded handoff-frame cache | Architect + QA |
