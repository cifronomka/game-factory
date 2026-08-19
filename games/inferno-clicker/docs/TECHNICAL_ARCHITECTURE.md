# Technical Architecture — «Зажги»

## Назначение

Документ фиксирует технический контракт `inferno-clicker`: границы platform-agnostic core, выбранный browser-first стек, модель состояния, производительность, сборку и тестирование. Игровые числа определяет `GAME_DESIGN.md`, внешние ограничения — `PLATFORM_REQUIREMENTS.md`.

## Статус и владелец

- Этап: Corrective Cycle 02; техническая база candidate `0.1.0+dd459e6fed2e` существует, но progression, animation и audio подсистемы повторно открыты до новой regression.
- Владелец: Game Architect.
- Primary runtime: браузер внутри Yandex Games.
- Architecture rule: ни один модуль `src/core/` не импортирует Yandex SDK, VK Bridge, Android API, DOM или renderer.

## Выбранный стек

- **Language:** browser-native ES modules (`.js`) с `// @ts-check`, JSDoc contracts, runtime assertions на внешних границах и zero-dependency production runtime.
- **Build/dev server:** воспроизводимые Node.js scripts на built-in API; внешний package registry не требуется.
- **Rendering:** layered Canvas 2D scene с независимыми render passes, pooled particles и low-resolution light/haze buffers; HTML/CSS overlay только для доступного HUD, меню и рекламной CTA.
- **Audio:** Web Audio API через небольшой собственный `AudioMixer`; тяжёлая engine-обвязка не нужна.
- **State:** явный serializable `GameState` и pure reducer/systems; без глобального mutable singleton.
- **Tests:** built-in `node:test` для core/contract suites, repository E2E smoke scripts и реальный browser QA через управляемый браузер; визуальные screenshots на эталонных viewport.
- **Package manager:** N/A — runtime/build имеют ноль внешних зависимостей; минимальная версия Node фиксируется в `.nvmrc`.

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
      environment/      # chamber, ritual plane, gates, runes, chains and reveal masks
    ui/                 # DOM HUD, dialogs, accessibility labels
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

## Boot sequence

1. Render a lightweight branded loading shell without starting audio/gameplay.
2. На Yandex host условно загрузить `/sdk.js`, затем select adapter; Generic Web не запрашивает SDK; time-box platform `init()` to 5 s.
3. Load local settings and persistent records; cloud merge may complete afterward.
4. Load critical stage-1/2 flame atlas families, HUD, environment and initial wood-fire audio metadata.
5. Construct core and presentation, attach pause/resume listeners.
6. Mark platform ready only when no loading overlay remains and tap/click is accepted.
7. Unlock audio on the first trusted pointer gesture and start gameplay.

Adapter init failure falls back to `web` capabilities without blocking the game. До Yandex integration Generic Web/dev явно сообщает capability `rewardedProvider='test'`; UI показывает только маркированную тестовую CTA, а не симулирует рекламу.

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
  encounter: null | {
    kind: 'servant' | 'demoness' | 'heat-window';
    phase: 'telegraph' | 'effect';
    msLeft: number;
  };
  boost: null | { kind: 'inferno-seal'; activeMsLeft: number };
  sealBroken: boolean;           // run-local; false on restart/reload, true only after one confirmed provider success
  sealCapImpulses: number;       // diagnostic count of accepted taps clamped at heat 559
  activeRunTimeMs: number;
  infernoHoldMs: number;
  runHighestStage: number;
  maxMultiplier: number;
  grantedStageBonuses: number[];
  pauseReasons: ('ad' | 'visibility' | 'platform' | 'menu')[]; // unique values, serializable
  runId: number;
};
```

Все thresholds и coefficients находятся в versioned immutable config. Core работает fixed simulation step `50 ms`; renderer интерполирует визуал. После frame gap входной frame delta ограничивается `100 ms`, а pause/background gap не догоняется. Во время `PAUSED` и `AD_BREAK` simulation clock и rewarded timer не идут, поэтому background tab и provider flow не сжигают heat. Пока `sealBroken=false`, каждый tap полностью получает Stage-4 score/feedback, но heat clamp'ится к `559`; только terminal confirmed reward ставит `sealBroken=true` до запуска queued 20-s boost. Restart/reload relock'ит seal.

Gameplay schedules в MVP детерминированы активным временем и versioned config; core PRNG для progression/encounters не используется. Только несмысловые visual/audio variations получают отдельный injected session seed и не меняют state/score. Серверного authoritative anti-cheat в MVP нет; leaderboard submission проходит sanity checks и rate limit adapter, а риск client-side manipulation фиксируется как известное ограничение.

## Rendering

- Logical portrait canvas: `1080 × 1920`; responsive contain/crop policy сохраняет центральный flame и HUD safe areas.
- Сцена разделена на независимые Canvas render passes в фиксированном порядке: far chamber/vignette → midground architecture/gates → ritual plane/runes/cracks → observers/characters → flame rig → local light/particles/smoke/distortion → foreground chains/ash → DOM HUD.
- Darkness — маска/тональный слой, управляемый normalized heat; stage reveal не требует загрузки цельного экрана на каждую стадию.
- Texture atlases — максимум `2048 × 2048`; крупные backgrounds — отдельные WebP/AVIF layers с WebP fallback.
- Heat distortion и bloom имеют `high/low/off` quality tiers; auto downgrade при p95 frame time выше `24 ms` на протяжении 5 s.
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

Размер, цвет и интенсивность каждого подслоя выводятся из `SceneVisualState`; character animation и environment reveal не зависят от flame animation timeline. `SpriteAnimator` выбирает atlas frame по application animation clock, фиксированному `fps`, `loop` и clip state; pause замораживает clock без catch-up. Reduced Motion сохраняет спокойный authored loop с пониженным fps, off фиксирует authored poster frame; static-card warp и geometric flame fallback не допускаются. Assets загружаются ahead-of-need, но сохраняются до teardown: worst full decoded residency `64,269,312 B / 61.29 MiB` учитывается целиком и остаётся ниже hard `64 MiB`.

### Character animation contract

`CharacterScene` использует atlas clips, а не один cutout с whole-body scale/rotate. Ash Servant имеет `appearance → idle → inhale → blow`, Demoness — `appearance → idle → cast → hold`; каждый clip содержит шесть authored frames, exact fps записан в `ASSET_PLAN.md`. После effect state machine возвращает actor в idle; отдельный recovery atlas не используется. Первый вход запускает appearance один раз, затем idle. Core telegraph/effect events выбирают attack clip; pause и teardown замораживают/отменяют clip без catch-up.

### Presentation events and automated verification

Core публикует typed domain events `tapAccepted`, `tapRejected`, `stageChanged`, `encounterStarted/Effect/Ended`, `sealBlocked`, `sealBroken`, `boostStarted/Ended`, `runEnded`, `recordsChanged` и `pauseReasonsChanged`. App/presentation агрегирует accepted taps в semantic `acceptedHeatBurst` не чаще одного раза за 120 ms для visual/audio fanning; это событие не возвращается в core и не может менять heat/score. Scene, DOM HUD, audio и telemetry подписываются независимо; ни один consumer не вызывает gameplay mutations напрямую.

- Headless core и deterministic clock позволяют unit/property simulations без DOM, Canvas, audio или SDK; отдельный seeded harness проверяет только несмысловые presentation/audio variations и не входит в gameplay state.
- `SceneVisualStateMapper` проверяется table-driven snapshot tests для семи stages и всех encounter/boost combinations без запуска WebGL.
- Renderer integration tests проверяют atlas bounds/hash, frame selection, layer order, unique passes/emitters, reversible transitions, pause freeze и cleanup; управляемый реальный браузер выполняет visual rubric, motion evidence и screenshot tests на exact build.
- Character state machines используют domain events и asset states из `ASSET_PLAN.md`; hit testing остаётся только у центральной gameplay zone и DOM controls.

## Input

`PointerEvent` — единый источник tap/click. Input layer принимает left mouse и каждый новый touch/pen contact внутри hit area, предотвращает browser scroll/zoom и дедуплицирует synthetic click после touch. Один физический `pointerdown` создаёт ровно одну команду `Tap`.

- Центральная зона пламени занимает не менее `96 × 96 CSS px`; основной gameplay также принимает tap по безопасной центральной области сцены.
- UI controls имеют минимум `48 × 48 CSS px` и не пробрасывают tap в core.
- Разные touch `pointerId` считаются отдельными физическими contacts; repeat одного активного pointerId до `pointerup/pointercancel`, synthetic compatibility click и повторный `inputId` не создают второй tap.
- Core обрабатывает все уникальные команды внутри `50 ms` step по `(timestamp, enqueue order)`. Нет rolling cap, cadence reduction или gameplay cooldown. Единственная аварийная защита — `256` уникальных команд в одном step (`>5120/s`); overflow помечается `input-overflow` и агрегируется для telemetry. Visual/audio consumers могут объединять feedback одного frame, но не gameplay heat/score.

## Persistence

Persisted schema `InfernoSaveV1` содержит `schemaVersion`, `bestScore`, all-time `highestStageReached`, `longestInfernoHoldMs`, stage-only `maxMultiplier` (`1..5`), `runsPlayed`, tutorial flags, audio/reduced-motion settings, daily-ritual date/status и `updatedAt`. Старое значение maxMultiplier выше 5 при load clamp'ится до 5. Текущий `runHighestStage`, heat, score, timers, encounters, `sealBroken` и boost не сохраняются и не восстанавливаются после reload/relaunch: новый run начинается в `READY` с `heat=30` и locked seal.

- Local: `localStorage` через web adapter; `SaveCoordinator` coalesces изменения на 500 ms, сериализует write, flushes при pause/visibility/pagehide и не позволяет позднему promise перезаписать новый максимум.
- Yandex: local-first, затем `Player.getData()/setData()` при доступном player; merge по максимуму для рекордов и по `updatedAt` для настроек.
- Corrupt/unknown save не приводит к crash: quarantine diagnostic, defaults, событие `save_recovered`.
- Failed cloud write повторяется максимум два раза с exponential backoff только в текущей сессии; local record остаётся источником восстановления.

## Platform abstraction

```ts
interface PlatformService {
  init(): Promise<PlatformCapabilities>;
  markReady(): Promise<Result<void>>;
  saveData(data: PersistedData): Promise<Result<void>>;
  loadData(): Promise<Result<PersistedData | null>>;
  submitScore(score: number): Promise<Result<void>>;
  getLeaderboard(): Promise<Result<LeaderboardEntry[]>>;
  showRewardedAd(placement: 'inferno-seal'): Promise<RewardedResult>;
  showInterstitial(placement: string): Promise<AdResult>;
  pauseGame(reason?: string): Result<void>;
  resumeGame(reason?: string): Result<void>;
  subscribePauseChanges(listener: (state: PauseSnapshot) => void): () => void;
  getPauseSnapshot(): PauseSnapshot;
  dispose(): void;
}
```

`PlatformCapabilities.rewardedProvider` имеет значение `'test' | 'yandex' | 'unavailable'`. `RewardedResult` различает `rewarded`, `closed`, `unavailable`, `error`; reward выдаётся только для `rewarded` и максимум один раз на request id. Generic Web/dev test provider возвращает тот же асинхронный terminal result без ad copy и взаимоисключается с Yandex; Yandex release не может содержать активный test provider. Adapter преобразует platform pause/resume в idempotent reason-set: игра возобновляется, только когда закрыты все причины (`ad`, `visibility`, `platform`, `menu`, `game-ended`). Yandex technical leaderboard name зафиксирован как `best-score`. SDK events `game_api_pause/resume` не дублируют Gameplay API markup; повторный `stop()` нужен только если после platform resume остаётся local pause reason.

## Asset loading

- Generated asset manifest содержит path, hash, bytes, dimensions/duration, clip summary, license/provenance и preload group; exact frame rectangles/fps/loop/pivot находятся в соседних atlas JSON.
- Critical group: HUD, low flame core/outer atlases, stage 1–2 background и wood/charcoal bed metadata; mid/high flame, character/action and transition groups грузятся ahead-of-need при достижении 60% текущего stage.
- Ошибка optional asset включает procedural/neutral fallback; ошибка critical asset показывает retry, но не оставляет чёрный экран.
- Audio декодируется по требованию после user gesture. Runtime graph этого candidate содержит два field-recording ambience beds, агрегированный fanning bus (120-ms window, 180-ms start cooldown, не более двух затухающих voices) и master lifecycle envelope; stage/character foley в registry не входит, oscillator/runtime-noise sources запрещены.
- Cache busting — content hashes; service worker в MVP не используется, чтобы не создавать stale-build риск внутри platform iframe.

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
node scripts/lint.mjs
node scripts/typecheck.mjs
node scripts/test.mjs
node scripts/build.mjs
node scripts/e2e-smoke.mjs
node scripts/package.mjs
```

`node scripts/build.mjs` создаёт `dist/`; `node scripts/package.mjs` валидирует manifest и создаёт ZIP по `RELEASE_PLAN.md`. Runtime задаётся `.nvmrc` на Node 24 LTS. External dependency lockfile не нужен, поскольку production/build dependency graph пуст; toolchain фиксируется Node major и хешами scripts. Build не обращается к сети и не встраивает secrets. Runtime assets загружаются только из archive root; внешняя сеть допустима лишь внутри platform adapters для SDK/ads/cloud/leaderboard, а её отсутствие сохраняет playable Web fallback.

## Testing strategy

- Unit/property tests: heat clamp, decay integration, every-valid-tap throughput, scoring, thresholds, encounters, boost timer, pause clock, corrupted save migration.
- Deterministic simulations: scripted tap timelines на 60/30/15 FPS дают одинаковое core state в допустимой погрешности `≤0.01 heat`, `≤1 score` и `≤10 ms` для hold time.
- Adapter contract suite: web и Yandex mock проходят одинаковые success/closed/unavailable/error cases.
- E2E: boot, touch emulation, mouse, seven stages, restart, persistence, rewarded lifecycle, offline/no-SDK fallback.
- Visual regression: stages 1–7 на `360×640`, `390×844`, `768×1024`, `1366×768` с rubric из `QA_PLAN.md`.
- Performance run: stage-7 maximum FX, 10 minutes, quality auto-degrade verified.

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
