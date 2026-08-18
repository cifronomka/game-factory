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
    scene/              # Pixi stage, layer composition, responsive camera
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

Dependency direction: `app → presentation/platform adapters → core`; `core` depends only on TypeScript types and injected clock/random interfaces. Platform callbacks dispatch commands, never mutate game state directly.

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
  scoreAcc: number;             // non-negative, capped at Number.MAX_SAFE_INTEGER
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

Random events используют injected seeded PRNG. Это позволяет воспроизводить encounter/surge sequence в тестах. Серверного authoritative anti-cheat в MVP нет; leaderboard submission проходит sanity checks и rate limit adapter, а риск client-side manipulation фиксируется как известное ограничение.

## Rendering

- Logical portrait canvas: `1080 × 1920`; responsive contain/crop policy сохраняет центральный flame и HUD safe areas.
- Сцена разделена на background darkness, environment layers, characters, flame, particles/FX и HUD overlay.
- Darkness — маска/тональный слой, управляемый normalized heat; stage reveal не требует загрузки цельного экрана на каждую стадию.
- Texture atlases — максимум `2048 × 2048`; крупные backgrounds — отдельные WebP/AVIF layers с WebP fallback.
- Heat distortion и bloom имеют `high/low/off` quality tiers; auto downgrade при p95 frame time выше `24 ms` на протяжении 5 s.
- `prefers-reduced-motion` или ручной Reduced FX отключает distortion/camera shake и ограничивает particles, не скрывая gameplay cues.

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
| Frame rate | 60 FPS target; ≥30 FPS p95 floor | 10-minute performance run | target mobile/desktop |
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

`npm run build` создаёт `dist/`; `npm run package` валидирует manifest и создаёт ZIP по `RELEASE_PLAN.md`. Runtime задаётся `.nvmrc` на актуальный Node LTS в момент реализации; `package-lock.json` обязателен. Build не обращается к сети после `npm ci` и не встраивает secrets.

## Testing strategy

- Unit/property tests: heat clamp, decay integration, scoring, combo, thresholds, encounters, boost timer, pause clock, corrupted save migration.
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
