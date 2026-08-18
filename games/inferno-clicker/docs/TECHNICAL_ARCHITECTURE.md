# Technical Architecture — «Зажги»

## Назначение

Документ фиксирует технический контракт будущей реализации `inferno-clicker`: границы platform-agnostic core, выбранный browser-first стек, модель состояния, производительность, сборку и тестирование. Игровые числа определяет `GAME_DESIGN.md`, внешние ограничения — `PLATFORM_REQUIREMENTS.md`.

## Статус и владелец

- Этап: planning approved candidate; implementation ещё не начат.
- Владелец: Game Architect.
- Primary runtime: браузер внутри Yandex Games.
- Architecture rule: ни один модуль `src/core/` не импортирует Yandex SDK, VK Bridge, Android API, DOM или renderer.

## Выбранный стек

- **Language:** TypeScript со строгим режимом.
- **Build/dev server:** Vite; точные версии фиксируются lockfile при старте implementation.
- **Rendering:** PixiJS для layered 2D scene, particles и shader-based glow/heat distortion; HTML/CSS overlay только для доступного HUD, меню и рекламной CTA.
- **Audio:** Web Audio API через небольшой собственный `AudioMixer`; тяжёлая engine-обвязка не нужна.
- **State:** явный serializable `GameState` и pure reducer/systems; без глобального mutable singleton.
- **Tests:** Vitest для core/contract tests, Playwright для browser/E2E, визуальные screenshots на эталонных viewport.
- **Package manager:** npm с committed lockfile.

Выбор минимизирует стартовый bundle, но сохраняет удобную layered-сцену. Phaser отклонён как избыточный полный game engine для одной сцены; чистый Canvas 2D — из-за усложнения batching/filters; React — как ненужная runtime-зависимость для HUD с несколькими состояниями.

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
    scene/              # Pixi stage, layer containers, stage visual state mapper, responsive camera
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

Dependency direction: `app → presentation/platform adapters → core`; `core` depends only on TypeScript types and injected monotonic clock. Gameplay RNG в MVP отсутствует; session seed принадлежит только presentation/audio variations. Platform callbacks dispatch commands, never mutate game state directly.

## Boot sequence

1. Render a lightweight branded loading shell without starting audio/gameplay.
2. Select adapter by build/runtime environment; time-box platform `init()` to 5 s.
3. Load local settings and persistent records; cloud merge may complete afterward.
4. Load critical stage-1/2 visuals, HUD and initial audio metadata.
5. Construct core and presentation, attach pause/resume listeners.
6. Mark platform ready only when no loading overlay remains and tap/click is accepted.
7. Unlock audio on the first trusted pointer gesture and start gameplay.

Adapter init failure falls back to `web` capabilities without blocking the game; the UI hides unavailable leaderboard/ad actions.

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
  rhythm: { phase: 'NORMAL' | 'SURGE' | 'BREATH'; charges: number; phaseMsLeft: number };
  acceptedTapTimesMs: number[]; // rolling 1 s input/cadence window
  encounter: null | { kind: string; endsAtMs: number; intensity: number };
  boost: null | { kind: 'inferno-seal'; activeMsLeft: number };
  activeRunTimeMs: number;
  infernoHoldMs: number;
  runHighestStage: number;
  maxMultiplier: number;
  grantedStageBonuses: number[];
  pauseReasons: ('ad' | 'visibility' | 'platform' | 'menu')[]; // unique values, serializable
  runId: string;
};
```

Все thresholds и coefficients находятся в versioned immutable config. Core работает fixed simulation step `50 ms`; renderer интерполирует визуал. После frame gap входной frame delta ограничивается `100 ms`, а pause/background gap не догоняется. Во время `PAUSED` и `AD_BREAK` simulation clock и rewarded timer не идут, поэтому background tab и реклама не сжигают heat.

Gameplay schedules в MVP детерминированы активным временем и versioned config; core PRNG для progression/encounters не используется. Только несмысловые visual/audio variations получают отдельный injected session seed и не меняют state/score. Серверного authoritative anti-cheat в MVP нет; leaderboard submission проходит sanity checks и rate limit adapter, а риск client-side manipulation фиксируется как известное ограничение.

## Rendering

- Logical portrait canvas: `1080 × 1920`; responsive contain/crop policy сохраняет центральный flame и HUD safe areas.
- Сцена разделена на независимые Pixi containers в фиксированном порядке: far chamber/vignette → midground architecture/gates → ritual plane/runes/cracks → observers/characters → flame rig → local light/particles/smoke/distortion → foreground chains/ash → DOM HUD.
- Darkness — маска/тональный слой, управляемый normalized heat; stage reveal не требует загрузки цельного экрана на каждую стадию.
- Texture atlases — максимум `2048 × 2048`; крупные backgrounds — отдельные WebP/AVIF layers с WebP fallback.
- Heat distortion и bloom имеют `high/low/off` quality tiers; auto downgrade при p95 frame time выше `24 ms` на протяжении 5 s.
- `prefers-reduced-motion` или ручной Reduced FX отключает distortion/camera shake и ограничивает particles, не скрывая gameplay cues.

### Stage presentation contract

Core является единственным владельцем `stage` и `stageProgress`. Pure `SceneVisualStateMapper` преобразует их вместе с rhythm/encounter/boost states в целевые opacity, tint, light radius, emitter limits и animation state каждого container. Presentation не изменяет heat, thresholds или timers.

- `stageChanged` немедленно меняет semantic visual state; environment layers выполняют обратимый fade `0.8–1.5 s`, поэтому колебание около порога не создаёт резкого мигания и не вводит gameplay hysteresis.
- Новый `stageChanged` во время fade меняет target существующего tween, а не запускает второй tween/particle system. Stage cue дедуплицируется согласно audio/QA contract.
- `stageProgress` непрерывно управляет reveal mask, rune emissive gain и light radius только внутри текущего stage; он не подменяет дискретные character/event states.
- Far/mid/ritual/character/flame/FX containers обновляются независимо. Пауза замораживает animation clocks и emitters через общий application clock; renderer не использует wall-clock catch-up.
- Visual reference PNG используются только для mood, perspective, reveal density и composition targets. Они не входят в runtime manifest и не могут быть полноэкранным background; production scene собирается из элементов `ASSET_PLAN.md`.

### Multi-layer flame rig

Пламя — самостоятельный `FlameRig`, а не один raster sprite/loop. Оно содержит:

1. `flame-core` — непрерывно видимое бело-золотое/угольное ядро и static SVG fallback;
2. `flame-outer` — 3–5 procedural bezier/SDF lobes и stage-dependent ribbon overlay;
3. `flame-glow` — отдельный low-resolution additive light buffer, который не меняет alpha художественных слоёв;
4. `flame-embers` — pooled sparks/embers emitters с quality caps;
5. `flame-smoke-haze` — независимые smoke particles и quarter-resolution heat distortion;
6. `flame-tap-burst` — pooled one-shot ripple/spark feedback на accepted tap;
7. `flame-stage-fx` — конфигурации stage-up, cold suppression shell, Heat Window ring, rewarded seal и stage-7 vertical beam/lightning.

Размер, цвет и интенсивность каждого подслоя выводятся из `SceneVisualState`; character animation и environment reveal не зависят от flame animation timeline. При `low/off` качестве или потере WebGL filters остаются core, outer fallback, progress ring и state icons.

### Presentation events and automated verification

Core публикует typed domain events `tapAccepted`, `tapRejected`, `stageChanged`, `rhythmChanged`, `encounterChanged`, `boostChanged`, `runEnded` и `pauseReasonsChanged`. Scene, DOM HUD, audio и telemetry подписываются независимо; ни один consumer не вызывает gameplay mutations напрямую.

- Headless core и deterministic clock позволяют unit/property simulations без DOM, PixiJS, audio или SDK; отдельный seeded harness проверяет только несмысловые presentation/audio variations и не входит в gameplay state.
- `SceneVisualStateMapper` проверяется table-driven snapshot tests для семи stages и всех rhythm/encounter/boost combinations без запуска WebGL.
- Renderer integration tests проверяют layer order, unique container/emitters, reversible transitions и cleanup; Playwright выполняет visual rubric/screenshot tests на production build.
- Character state machines используют domain events и asset states из `ASSET_PLAN.md`; hit testing остаётся только у центральной gameplay zone и DOM controls.

## Input

`PointerEvent` — единый источник tap/click. Input layer принимает только primary pointer, предотвращает browser scroll/zoom внутри игрового hit area и дедуплицирует synthetic click после touch. Один `pointerdown` создаёт не более одной команды `Tap`.

- Центральная зона пламени занимает не менее `96 × 96 CSS px`; основной gameplay также принимает tap по безопасной центральной области сцены.
- UI controls имеют минимум `48 × 48 CSS px` и не пробрасывают tap в core.
- Multi-touch не увеличивает tap rate: одновременно учитывается только первый primary pointer.
- Input gate принимает максимум одну gameplay-команду на simulation step, а core — максимум `8` taps в любом скользящем окне `1.0 s`, как задано в `GAME_DESIGN.md`. Overflow не влияет на heat, score, Resonance или counter events; аномальные burst `>30 input/s` дополнительно агрегируются для telemetry без сырых tap timelines.

## Persistence

Persisted schema `InfernoSaveV1` содержит `schemaVersion`, `bestScore`, all-time `highestStageReached`, `longestInfernoHoldMs`, `maxMultiplier`, `runsPlayed`, tutorial flags, audio/reduced-motion settings, daily-ritual date/status и `updatedAt`. Текущий `runHighestStage`, heat, score, timers, encounters и boost не сохраняются и не восстанавливаются после reload/relaunch: новый run начинается в `READY` с `heat=30`.

- Local: `localStorage` через web adapter, debounce 500 ms после изменения рекорда/настроек и flush при pause/visibility change.
- Yandex: local-first, затем `Player.getData()/setData()` при доступном player; merge по максимуму для рекордов и по `updatedAt` для настроек.
- Corrupt/unknown save не приводит к crash: quarantine diagnostic, defaults, событие `save_recovered`.
- Failed cloud write повторяется с backoff только в текущей сессии; local record остаётся источником восстановления.

## Platform abstraction

```ts
interface PlatformService {
  init(): Promise<PlatformCapabilities>;
  saveData(data: PersistedData): Promise<Result<void>>;
  loadData(): Promise<Result<PersistedData | null>>;
  submitScore(score: number): Promise<Result<void>>;
  getLeaderboard(): Promise<Result<LeaderboardEntry[]>>;
  showRewardedAd(placement: 'inferno-seal'): Promise<RewardedResult>;
  showInterstitial(placement: string): Promise<AdResult>;
  pauseGame(reason?: string): void;
  resumeGame(reason?: string): void;
}
```

`RewardedResult` различает `rewarded`, `closed`, `unavailable`, `error`; reward выдаётся только для `rewarded` и максимум один раз на request id. Adapter преобразует platform pause/resume в idempotent reason-set: игра возобновляется, только когда закрыты все причины (`ad`, `visibility`, `platform`, `menu`).

## Asset loading

- Generated asset manifest содержит path, hash, bytes, dimensions/duration и preload group.
- Critical group: HUD, flame base, stage 1–2 background, tap SFX; остальные stage layers грузятся ahead-of-need при достижении 60% текущего stage.
- Ошибка optional asset включает procedural/neutral fallback; ошибка critical asset показывает retry, но не оставляет чёрный экран.
- Audio декодируется по требованию после user gesture; одновременно держатся только нужные adaptive layers.
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

Планируемые команды после implementation:

```text
npm ci
npm run lint
npm run typecheck
npm test
npm run build
npm run test:e2e
npm run package
```

`npm run build` создаёт `dist/`; `npm run package` валидирует manifest и создаёт ZIP по `RELEASE_PLAN.md`. Runtime задаётся `.nvmrc` на актуальный Node LTS в момент реализации; `package-lock.json` обязателен. Build не обращается к сети после `npm ci` и не встраивает secrets. Runtime assets загружаются только из archive root; внешняя сеть допустима лишь внутри platform adapters для SDK/ads/cloud/leaderboard, а её отсутствие сохраняет playable Web fallback.

## Testing strategy

- Unit/property tests: heat clamp, decay integration, scoring, rhythm, thresholds, encounters, boost timer, pause clock, corrupted save migration.
- Deterministic simulations: scripted tap timelines на 60/30/15 FPS дают одинаковое core state в допустимой погрешности `≤0.01 heat`, `≤1 score` и `≤10 ms` для hold time.
- Adapter contract suite: web и Yandex mock проходят одинаковые success/closed/unavailable/error cases.
- E2E: boot, touch emulation, mouse, seven stages, restart, persistence, rewarded lifecycle, offline/no-SDK fallback.
- Visual regression: stages 1–7 на `360×640`, `390×844`, `768×1024`, `1366×768` с rubric из `QA_PLAN.md`.
- Performance run: stage-7 maximum FX, 10 minutes, quality auto-degrade verified.

## Architecture decisions и риски

| Решение/риск | Статус | Обоснование/митигация | Владелец |
|---|---|---|---|
| PixiJS + DOM HUD | Решено | Богатая layered scene без полного engine; UI остаётся доступным | Architect |
| Fixed-step core | Решено | Баланс не зависит от FPS, deterministic QA | Architect |
| No active-run restore | Решено | Снижает clock/save exploits; сохраняются только records/settings | Product + Architect |
| WebGL/shader cost | Риск | Quality tiers, reduced FX, frame-time downgrade | Developer + Art |
| Client-side leaderboard manipulation | Принят для MVP | Sanity checks; серверная валидация — post-MVP decision | Product + Platform |
| SDK/API drift | Риск | SDK только в adapters; official docs recheck перед integration/release | Platform Agent |
| Package budgets vs layered audio/art | Риск | Critical/optional groups и budgets из `ASSET_PLAN.md` | Architect + Art + Audio |
| Stage-threshold visual chatter | Риск | Core остаётся без hysteresis; reversible target-based fades, event deduplication и mapper tests предотвращают flicker/duplicate emitters | Developer + QA |
| Reference-to-runtime flattening | Запрещено | Concept PNG не входят в runtime; каждый background/character/flame/FX/UI элемент имеет отдельный registry entry и layer owner | Architect + Art |
