// @ts-check

import './compatibility.js';
import { GameEngine, createInitialState } from './core/index.js';
import { WebPlatformService, YandexPlatformService, createDefaultSave, mapPlatformLocale } from './platforms/index.js';
import { createPresentation } from './presentation/index.js';
import { buildSave, recordsFromSave } from './app/save.js';
import { toPresentationEvent, toPresentationViewModel } from './app/viewModel.js';
import { SaveCoordinator } from './app/saveCoordinator.js';
import { PerformanceQualityController } from './app/performanceQuality.js';
import { createI18n } from './app/i18n.js';
import { preferredRuntimeRasterUrl } from './presentation/scene/rasterFormat.js';

const root = document.querySelector('#app');
if (!(root instanceof HTMLElement)) throw new Error('Application root is unavailable.');

function beginCriticalAssetPreload() {
  if (typeof Image !== 'function') return [];
  const pairs = [
    ['assets/backgrounds/bg-fire-chamber-yandex-v3.webp', 'assets/backgrounds/bg-fire-chamber-yandex-v3.png'],
    ['assets/flame/atlases/core-low-v2.webp', 'assets/flame/atlases/core-low-v2.png'],
    ['assets/flame/atlases/outer-low-v4.webp', 'assets/flame/atlases/outer-low-v4.png'],
  ];
  return pairs.map(([webp, png]) => {
    const image = new Image();
    image.decoding = 'async';
    image.src = preferredRuntimeRasterUrl(webp, png);
    return image;
  });
}

// Network/decode work starts before SDK/player/cloud waits. The presentation
// then reuses the browser cache and releases these temporary element handles.
const criticalAssetPreloads = beginCriticalAssetPreload();
const REMOTE_BOOTSTRAP_DEADLINE_MS = 5_000;

/** @returns {'web'|'yandex'} */
function platformTarget() { return globalThis.__INFERNO_PLATFORM_TARGET__ === 'yandex' ? 'yandex' : 'web'; }

function qualityTier() {
  const memory = Number(navigator.deviceMemory ?? 8);
  const cores = Number(navigator.hardwareConcurrency ?? 8);
  return memory <= 4 || cores <= 4 ? 'low' : 'high';
}

/** @param {'web'|'yandex'} target @param {(diagnostic:{type:string,detail?:Record<string,unknown>})=>void} onDiagnostic @param {number} bootstrapDeadlineAt */
function makePlatform(target, onDiagnostic, bootstrapDeadlineAt) {
  return target === 'yandex'
    ? new YandexPlatformService({ onDiagnostic, bootstrapDeadlineAt })
    : new WebPlatformService({ onDiagnostic });
}

/** @param {import('./app/i18n.js').I18n} i18n */
function applyDocumentLocale(i18n) {
  document.documentElement.lang = i18n.locale;
  document.title = i18n.t('app.title');
  document.querySelector('meta[name="description"]')?.setAttribute('content', i18n.t('app.description'));
}

/** @param {import('./app/i18n.js').I18n} i18n */
function installShell(i18n) {
  root.innerHTML = `<main class="app-shell" data-app-state="loading"><section class="boot-screen"><div><div class="boot-screen__mark"></div><h1>${i18n.t('app.title')}</h1><p>${i18n.t('boot.loading')}</p></div></section><section class="dialog-backdrop" data-dialog hidden></section><div class="toast" role="status" aria-live="polite" data-toast hidden></div></main>`;
  const shell = root.querySelector('.app-shell');
  const boot = root.querySelector('.boot-screen');
  const dialog = root.querySelector('[data-dialog]');
  const toast = root.querySelector('[data-toast]');
  if (!(shell instanceof HTMLElement) || !(boot instanceof HTMLElement)
    || !(dialog instanceof HTMLElement) || !(toast instanceof HTMLElement)) {
    throw new Error('Application shell is incomplete.');
  }
  return { shell, boot, dialog, toast };
}

async function bootstrap() {
  const declaredBootstrapStart = Number(globalThis.__YANDEX_BOOTSTRAP_STARTED_AT__);
  const bootstrapStartedAt = Number.isFinite(declaredBootstrapStart) && declaredBootstrapStart > 0
    ? declaredBootstrapStart
    : Date.now();
  const bootstrapDeadlineAt = bootstrapStartedAt + REMOTE_BOOTSTRAP_DEADLINE_MS;
  const target = platformTarget();
  const fallbackLocale = mapPlatformLocale(navigator.language);
  let i18n = createI18n(fallbackLocale);
  applyDocumentLocale(i18n);
  let { shell, boot, dialog, toast } = installShell(i18n);
  const sdkReady = /** @type {Promise<boolean>|undefined} */ (globalThis.__YANDEX_SDK_READY__);
  if (target === 'yandex' && sdkReady) await sdkReady.catch(() => false);

  const platformDiagnostics = [];
  const debugEnabled = /(?:^|[?&])infernoDebug=1(?:&|$)/u.test(location.search);
  const platform = makePlatform(target, (event) => {
    platformDiagnostics.push({ at: Date.now(), ...event });
    if (platformDiagnostics.length > 100) platformDiagnostics.shift();
    if (debugEnabled) console.info('[platform]', event);
  }, bootstrapDeadlineAt);
  const initResult = await platform.init();
  const capabilities = initResult.ok ? initResult.value : Object.freeze({
    platform: 'web', locale: fallbackLocale, authorized: false, localSave: false, cloudSave: false,
    leaderboard: 'local-only', leaderboardRead: false, leaderboardWrite: false,
    rewardedProvider: 'unavailable', rewardedAds: false, interstitialAds: false, gameplayLifecycle: true,
    ...(target === 'yandex' ? { degradedFrom: 'yandex', degradedReason: initResult.error.code } : {}),
  });
  if (capabilities.locale !== i18n.locale) {
    i18n = createI18n(capabilities.locale);
    applyDocumentLocale(i18n);
    ({ shell, boot, dialog, toast } = installShell(i18n));
  }

  /** @param {string} message */
  function showToast(message) {
    toast.textContent = message;
    toast.hidden = false;
    shell.dataset.toastActive = 'true';
    clearTimeout(showToast.timer);
    showToast.timer = setTimeout(() => {
      toast.hidden = true;
      delete shell.dataset.toastActive;
    }, 3_200);
  }
  showToast.timer = /** @type {ReturnType<typeof setTimeout>|undefined} */ (undefined);

  const loaded = await platform.loadData();
  let persisted = loaded.ok && loaded.value ? loaded.value : createDefaultSave(Date.now());
  const initialReducedMotion = persisted.settings.reducedMotion
    || (typeof matchMedia === 'function' && matchMedia('(prefers-reduced-motion: reduce)').matches);
  const settings = {
    muted: persisted.settings.muted,
    reducedMotion: initialReducedMotion,
    updatedAt: initialReducedMotion === persisted.settings.reducedMotion ? persisted.settings.updatedAt : Date.now(),
    quality: qualityTier(),
  };
  const engine = new GameEngine(createInitialState(recordsFromSave(persisted)));
  let disposed = false;
  let unloaded = false;
  let performanceMonitoringReady = false;
  let lastFrame = performance.now();
  let previousPauseReasons = new Set();
  let rewardSequence = 0;
  const performanceQuality = new PerformanceQualityController();
  const saveCoordinator = new SaveCoordinator({
    initialValue: persisted,
    delayMs: 0,
    read: () => buildSave(engine.recordSnapshot(), persisted, settings, Date.now()),
    signature: (save) => JSON.stringify({
      schemaVersion: save.schemaVersion,
      bestScore: save.bestScore,
      highestStageReached: save.highestStageReached,
      longestInfernoHoldMs: save.longestInfernoHoldMs,
      maxMultiplier: save.maxMultiplier,
      runsPlayed: save.runsPlayed,
      tutorialFlags: save.tutorialFlags,
      settings: save.settings,
      dailyRitual: save.dailyRitual,
    }),
    save: async (save) => {
      const result = await platform.saveData(save);
      if (result.ok) persisted = save;
      return result;
    },
    onFailure: () => showToast(i18n.t('toast.saveError')),
  });

  async function flushPersistence() {
    await saveCoordinator.flushNow();
    await platform.flushData();
  }

  let gameplayTapSequence = 0;
  const presentation = createPresentation({
    host: shell,
    i18n,
    onPerformanceSample: ({ atMs, workMs, paused }) => {
      if (performanceQuality.observe(atMs, workMs, {
        visible: document.visibilityState !== 'hidden',
        paused: paused || !performanceMonitoringReady,
      })) settings.quality = settings.quality === 'high' ? 'low' : 'off';
    },
    callbacks: {
      onGameplayTap: () => {
        if (engine.state.phase === 'READY') {
          platform.startGameplay();
          void platform.resumeGame('game-ended');
          void platform.resumeGame('menu');
        }
        gameplayTapSequence += 1;
        engine.queueTap(engine.state.simulationTimeMs + 0.001, `pointer-${gameplayTapSequence}`);
      },
      onPauseToggle: () => togglePause(),
      onGoalsRequest: () => openGoalsFromCurrentState(),
      onMuteToggle: () => {
        settings.muted = !settings.muted;
        settings.updatedAt = Date.now();
        presentation.dispatch({ type: 'mute-changed', muted: settings.muted });
        saveCoordinator.request();
      },
      onReducedMotionToggle: () => {
        settings.reducedMotion = !settings.reducedMotion;
        settings.updatedAt = Date.now();
        saveCoordinator.request();
      },
      onRewardRequest: () => openRewardDialog(),
    },
  });

  const unsubscribePause = platform.subscribePauseChanges((snapshot) => {
    const next = new Set(snapshot.reasons);
    for (const reason of next) if (!previousPauseReasons.has(reason)) {
      engine.pause(/** @type {any} */ (reason));
      presentation.dispatch({ type: 'pause', reason });
      void flushPersistence();
    }
    for (const reason of previousPauseReasons) if (!next.has(reason)) {
      engine.resume(/** @type {any} */ (reason));
      presentation.dispatch({ type: 'resume', reason });
    }
    previousPauseReasons = next;
  });

  function closeDialog() {
    dialog.hidden = true;
    dialog.innerHTML = '';
  }

  function pauseForMenu() {
    platform.pauseGame('menu');
    engine.pause('menu');
  }

  function resumeFromMenu() {
    void platform.resumeGame('menu');
    engine.resume('menu');
    closeDialog();
  }

  function togglePause() {
    const state = engine.state;
    if (state.phase === 'RESULTS' || state.phase === 'AD_BREAK') return;
    if (state.pauseReasons.includes('menu')) resumeFromMenu();
    else {
      pauseForMenu();
      showPauseMenu();
    }
  }

  function showPauseMenu() {
    dialog.innerHTML = `<article class="dialog" role="dialog" aria-modal="true" aria-labelledby="pause-title"><h2 id="pause-title">${i18n.t('pause.title')}</h2><p>${i18n.t('pause.body')}</p><div class="dialog__actions"><button type="button" data-how>${i18n.t('pause.howTo')}</button><button type="button" data-goals>${i18n.t('pause.goals')}</button><button type="button" data-abandon>${i18n.t('pause.abandon')}</button><button type="button" data-primary data-continue>${i18n.t('hud.continue')}</button></div></article>`;
    dialog.hidden = false;
    const continueButton = /** @type {HTMLButtonElement} */ (dialog.querySelector('[data-continue]'));
    const abandonButton = /** @type {HTMLButtonElement} */ (dialog.querySelector('[data-abandon]'));
    const howButton = /** @type {HTMLButtonElement} */ (dialog.querySelector('[data-how]'));
    const goalsButton = /** @type {HTMLButtonElement} */ (dialog.querySelector('[data-goals]'));
    continueButton.addEventListener('click', resumeFromMenu, { once: true });
    abandonButton.addEventListener('click', showAbandonConfirmation, { once: true });
    howButton.addEventListener('click', () => showHowTo('pause'), { once: true });
    goalsButton.addEventListener('click', () => showGoals('pause'), { once: true });
    continueButton.focus();
  }

  /** @param {'pause'|'results'} backTarget */
  function showHowTo(backTarget) {
    dialog.innerHTML = `<article class="dialog dialog--scroll" role="dialog" aria-modal="true" aria-labelledby="how-title"><h2 id="how-title">${i18n.t('how.title')}</h2><p>${i18n.t('how.body')}</p><div class="dialog__actions"><button type="button" data-primary data-back>${i18n.t('common.back')}</button></div></article>`;
    dialog.hidden = false;
    const back = /** @type {HTMLButtonElement} */ (dialog.querySelector('[data-back]'));
    back.addEventListener('click', backTarget === 'results' ? showResults : showPauseMenu, { once: true });
    back.focus();
  }

  function openGoalsFromCurrentState() {
    if (engine.state.phase === 'RESULTS') {
      showGoals('results');
      return;
    }
    if (engine.state.phase === 'AD_BREAK') return;
    if (!engine.state.pauseReasons.includes('menu')) pauseForMenu();
    showGoals('pause');
  }

  /** @param {import('./app/goals.js').GoalViewModel} goal */
  function goalProgress(goal) {
    if (goal.completed) return i18n.t('goals.completed');
    const current = goal.unit === 'milliseconds' ? Math.floor(goal.current / 1_000) : goal.current;
    const targetValue = goal.unit === 'milliseconds' ? Math.floor(goal.target / 1_000) : goal.target;
    return i18n.t('goals.progress', { current: i18n.number(current), target: i18n.number(targetValue) });
  }

  /** @param {'pause'|'results'} backTarget */
  function showGoals(backTarget) {
    const view = toPresentationViewModel(engine.state, settings, capabilities);
    dialog.innerHTML = `<article class="dialog dialog--goals" role="dialog" aria-modal="true" aria-labelledby="goals-title"><h2 id="goals-title">${i18n.t('goals.title')}</h2><div class="goals-list" data-goal-list></div><div class="dialog__actions"><button type="button" data-primary data-back>${i18n.t('common.back')}</button></div></article>`;
    const list = /** @type {HTMLElement} */ (dialog.querySelector('[data-goal-list]'));
    for (const goal of view.goals) {
      const row = document.createElement('div');
      row.className = `goal-row${goal.completed ? ' goal-row--complete' : ''}`;
      const badge = document.createElement('span');
      badge.className = 'goal-row__badge';
      badge.setAttribute('aria-hidden', 'true');
      badge.textContent = goal.completed ? '✓' : String(view.goals.indexOf(goal) + 1);
      const copy = document.createElement('span');
      copy.className = 'goal-row__copy';
      const label = document.createElement('strong');
      label.textContent = i18n.t(goal.labelKey);
      const progress = document.createElement('small');
      progress.textContent = goalProgress(goal);
      copy.append(label, progress);
      row.append(badge, copy);
      list.append(row);
    }
    dialog.hidden = false;
    const back = /** @type {HTMLButtonElement} */ (dialog.querySelector('[data-back]'));
    back.addEventListener('click', backTarget === 'results' ? showResults : showPauseMenu, { once: true });
    back.focus();
  }

  function showAbandonConfirmation() {
    dialog.innerHTML = `<article class="dialog" role="dialog" aria-modal="true" aria-labelledby="abandon-title"><h2 id="abandon-title">${i18n.t('abandon.title')}</h2><p>${i18n.t('abandon.body')}</p><div class="dialog__actions"><button type="button" data-back>${i18n.t('common.back')}</button><button type="button" data-primary data-confirm-abandon>${i18n.t('abandon.confirm')}</button></div></article>`;
    const back = /** @type {HTMLButtonElement} */ (dialog.querySelector('[data-back]'));
    const confirm = /** @type {HTMLButtonElement} */ (dialog.querySelector('[data-confirm-abandon]'));
    back.addEventListener('click', showPauseMenu, { once: true });
    confirm.addEventListener('click', () => {
      if (!engine.abandonRun()) return;
      processEvents();
    }, { once: true });
    confirm.focus();
  }

  function openRewardDialog() {
    if (!engine.openRewardSheet()) return;
    platform.pauseGame('menu');
    dialog.innerHTML = `<article class="dialog" role="dialog" aria-modal="true" aria-labelledby="reward-title"><h2 id="reward-title">${i18n.t('reward.title')}</h2><p>${i18n.t('reward.body')}</p><div class="dialog__actions"><button type="button" data-cancel>${i18n.t('common.notNow')}</button><button type="button" data-primary data-confirm>${i18n.t('reward.confirm')}</button></div></article>`;
    dialog.hidden = false;
    const cancel = /** @type {HTMLButtonElement} */ (dialog.querySelector('[data-cancel]'));
    const confirm = /** @type {HTMLButtonElement} */ (dialog.querySelector('[data-confirm]'));
    cancel.addEventListener('click', () => {
      engine.cancelRewardSheet();
      void platform.resumeGame('menu');
      closeDialog();
    }, { once: true });
    confirm.addEventListener('click', () => void runReward(confirm), { once: true });
    confirm.focus();
  }

  /** @param {HTMLButtonElement} button */
  async function runReward(button) {
    button.disabled = true;
    rewardSequence += 1;
    const requestId = `app-reward-${rewardSequence}`;
    if (!engine.beginRewarded(requestId)) {
      engine.cancelRewardSheet();
      void platform.resumeGame('menu');
      closeDialog();
      return;
    }
    closeDialog();
    const result = await platform.showRewardedAd('heat-power-2x-60s', {
      onRewarded: () => { engine.grantRewarded(requestId); },
    });
    engine.resolveRewarded(requestId, result.status);
    void platform.resumeGame('menu');
    if (result.status === 'rewarded') showToast(i18n.t('reward.success'));
    else if (result.status === 'closed') showToast(i18n.t('reward.closed'));
    else if (result.status === 'error') showToast(i18n.t('reward.error'));
    else showToast(i18n.t('reward.unavailable'));
  }

  function showResults() {
    const state = engine.state;
    const view = toPresentationViewModel(state, settings, capabilities);
    platform.pauseGame('game-ended');
    platform.stopGameplay();
    const goal = view.nextGoal ? i18n.t('results.nextGoal', { goal: i18n.t(view.nextGoal.labelKey) }) : i18n.t('results.allGoals');
    dialog.innerHTML = `<article class="dialog" role="dialog" aria-modal="true" aria-labelledby="results-title"><h2 id="results-title">${i18n.t('results.title')}</h2><p>${state.abandoned ? i18n.t('results.abandoned') : i18n.t('results.finished')}</p><div class="dialog__stats"><div class="dialog__stat">${i18n.t('results.score')}<strong>${i18n.number(state.score)}</strong></div><div class="dialog__stat">${i18n.t('results.best')}<strong>${i18n.number(state.bestScore)}</strong></div><div class="dialog__stat">${i18n.t('results.stage')}<strong>${state.runHighestStage}/7</strong></div><div class="dialog__stat">${i18n.t('results.inferno')}<strong>${i18n.seconds(state.runLongestInfernoHoldMs)}${i18n.locale === 'ru' ? 'с' : 's'}</strong></div></div><p class="dialog__next-goal">${goal}</p><div class="dialog__actions"><button type="button" data-goals>${i18n.t('goals.title')}</button><button type="button" data-how>${i18n.t('how.title')}</button><button type="button" data-leaderboard>${i18n.t('results.leaderboard')}</button><button type="button" data-primary data-restart>${i18n.t('results.restart')}</button></div></article>`;
    dialog.hidden = false;
    const restart = /** @type {HTMLButtonElement} */ (dialog.querySelector('[data-restart]'));
    const leaderboard = /** @type {HTMLButtonElement} */ (dialog.querySelector('[data-leaderboard]'));
    const goals = /** @type {HTMLButtonElement} */ (dialog.querySelector('[data-goals]'));
    const how = /** @type {HTMLButtonElement} */ (dialog.querySelector('[data-how]'));
    restart.addEventListener('click', () => {
      if (engine.restart()) {
        closeDialog();
      }
    }, { once: true });
    leaderboard.addEventListener('click', () => {
      leaderboard.disabled = true;
      void showLeaderboard(state.runId);
    }, { once: true });
    goals.addEventListener('click', () => showGoals('results'), { once: true });
    how.addEventListener('click', () => showHowTo('results'), { once: true });
    restart.focus();
  }

  /** @param {number} expectedRunId */
  async function showLeaderboard(expectedRunId) {
    const result = await platform.getLeaderboard();
    if (engine.state.phase !== 'RESULTS' || engine.state.runId !== expectedRunId) return;
    if (!result.ok) {
      showToast(i18n.t('leaderboard.unavailable'));
      showResults();
      return;
    }
    dialog.innerHTML = `<article class="dialog" role="dialog" aria-modal="true" aria-labelledby="leaderboard-title"><h2 id="leaderboard-title">${i18n.t('leaderboard.title')}</h2><ol data-entries></ol><div class="dialog__actions"><button type="button" data-primary data-back-results>${i18n.t('common.back')}</button></div></article>`;
    const list = /** @type {HTMLOListElement} */ (dialog.querySelector('[data-entries]'));
    for (const entry of result.value) {
      const item = document.createElement('li');
      const displayName = entry.source === 'local' ? i18n.t('leaderboard.localBest') : entry.displayName;
      item.textContent = `${entry.rank}. ${displayName} — ${i18n.number(entry.score)}`;
      list.append(item);
    }
    if (result.value.length === 0) {
      const item = document.createElement('li');
      item.textContent = i18n.t('leaderboard.empty');
      list.append(item);
    }
    const back = /** @type {HTMLButtonElement} */ (dialog.querySelector('[data-back-results]'));
    back.addEventListener('click', showResults, { once: true });
    back.focus();
  }

  function processEvents() {
    for (const event of engine.drainEvents()) {
      const mapped = toPresentationEvent(event);
      if (mapped) {
        if (mapped.type === 'tap-accepted') {
          mapped.critical = engine.state.encounters.some((encounter) => encounter.kind === 'heat-window'
            && encounter.phase === 'effect');
        }
        presentation.dispatch(/** @type {any} */ (mapped));
      }
      // Persist effective run records (including an unfinished run) locally
      // on the next task. Yandex cloud writes remain coalesced/rate-limited by
      // the platform adapter, so this does not increase SDK write frequency.
      if (event.type === 'recordsChanged' || event.type === 'stageChanged' || event.type === 'tapAccepted') {
        saveCoordinator.request();
      }
      if (event.type === 'runEnded') {
        void flushPersistence();
        void platform.submitScore(engine.state.bestScore);
        showResults();
      }
      if (event.type === 'stageChanged' && Number(event.data?.to) === 7) showToast(i18n.t('toast.inferno'));
    }
  }

  function frame(now) {
    if (disposed) return;
    const delta = Math.min(100, Math.max(0, now - lastFrame));
    lastFrame = now;
    engine.advanceFrame(delta);
    processEvents();
    presentation.update(toPresentationViewModel(engine.state, settings, capabilities));
    shell.dataset.appState = engine.state.phase.toLowerCase();
    requestAnimationFrame(frame);
  }

  presentation.update(toPresentationViewModel(engine.state, settings, capabilities));
  if (!await presentation.prepareCriticalAssets()) {
    boot.innerHTML = `<div><div class="boot-screen__mark"></div><h1>${i18n.t('app.title')}</h1><p>${i18n.t('boot.assetError')}</p><button type="button" data-retry-assets>${i18n.t('boot.retry')}</button></div>`;
    const retry = /** @type {HTMLButtonElement} */ (boot.querySelector('[data-retry-assets]'));
    await new Promise((resolve) => retry.addEventListener('click', resolve, { once: true }));
    if (!await presentation.retryCriticalAssets()) showToast(i18n.t('boot.fallback'));
  }
  criticalAssetPreloads.length = 0;
  boot.remove();
  shell.dataset.appState = 'ready';
  performanceMonitoringReady = true;
  lastFrame = performance.now();
  requestAnimationFrame(frame);
  void platform.markReady().catch((error) => {
    platformDiagnostics.push({
      at: Date.now(),
      type: 'loading_ready_unhandled_failure',
      detail: { message: error instanceof Error ? error.message : String(error) },
    });
  });
  if (debugEnabled) {
    globalThis.__INFERNO_DIAGNOSTICS__ = () => ({
      build: document.querySelector('meta[name="build-id"]')?.getAttribute('content') ?? 'development',
      state: engine.state,
      presentation: presentation.getDiagnostics(),
      performance: performanceQuality.getDiagnostics(),
      platform: capabilities,
      platformDiagnostics: [...platformDiagnostics],
    });
  }
  if (typeof __INFERNO_TEST_DRIVER__ !== 'undefined' && __INFERNO_TEST_DRIVER__ && debugEnabled) {
    globalThis.__INFERNO_E2E__ = Object.freeze({
      /** @param {number} targetStage */
      reachStage(targetStage) {
        let guard = 0;
        while (engine.state.stage < targetStage && engine.state.phase !== 'RESULTS' && guard < 2_000) {
          gameplayTapSequence += 1;
          engine.queueTap(engine.state.simulationTimeMs + 0.001, `e2e-stage-${gameplayTapSequence}`);
          engine.advanceFrame(50);
          processEvents();
          guard += 1;
        }
        if (targetStage === 7 && engine.state.stage === 7) {
          for (let extra = 0; extra < 24; extra += 1) {
            gameplayTapSequence += 1;
            engine.queueTap(engine.state.simulationTimeMs + 0.001, `e2e-inferno-${gameplayTapSequence}`);
            engine.advanceFrame(50);
            processEvents();
          }
        }
        presentation.update(toPresentationViewModel(engine.state, settings, capabilities));
        return engine.state;
      },
      /** @param {number} targetStage */
      prepareStageEvidence(targetStage) {
        let guard = 0;
        while (engine.state.stage < targetStage && engine.state.phase !== 'RESULTS' && guard < 2_000) {
          gameplayTapSequence += 1;
          engine.queueTap(engine.state.simulationTimeMs + 0.001, `e2e-evidence-stage-${gameplayTapSequence}`);
          engine.advanceFrame(50);
          processEvents();
          guard += 1;
        }
        while (targetStage < 7 && engine.state.stage === targetStage && engine.state.stageProgress < 0.72 && guard < 2_500) {
          gameplayTapSequence += 1;
          engine.queueTap(engine.state.simulationTimeMs + 0.001, `e2e-evidence-fill-${gameplayTapSequence}`);
          engine.advanceFrame(50);
          processEvents();
          guard += 1;
        }
        if (targetStage === 7 && engine.state.stage === 7) {
          for (let extra = 0; extra < 36; extra += 1) {
            gameplayTapSequence += 1;
            engine.queueTap(engine.state.simulationTimeMs + 0.001, `e2e-evidence-inferno-${gameplayTapSequence}`);
            engine.advanceFrame(50);
            processEvents();
          }
        }
        presentation.update(toPresentationViewModel(engine.state, settings, capabilities));
        return engine.state;
      },
      /** @param {number} milliseconds */
      advanceActive(milliseconds) {
        const steps = Math.max(0, Math.ceil(milliseconds / 50));
        for (let step = 0; step < steps && engine.state.phase !== 'RESULTS'; step += 1) {
          if (step % 5 === 0) {
            gameplayTapSequence += 1;
            engine.queueTap(engine.state.simulationTimeMs + 0.001, `e2e-time-${gameplayTapSequence}`);
          }
          engine.advanceFrame(50);
          processEvents();
        }
        presentation.update(toPresentationViewModel(engine.state, settings, capabilities));
        return engine.state;
      },
      settleRewardOffer(maximumActiveMs = 20_000) {
        let elapsed = 0;
        while (elapsed < maximumActiveMs) {
          const view = toPresentationViewModel(engine.state, settings, capabilities);
          if (view.rewardOffer.available && view.rewardOffer.visible) break;
          gameplayTapSequence += 1;
          engine.queueTap(engine.state.simulationTimeMs + 0.001, `e2e-offer-${gameplayTapSequence}`);
          engine.advanceFrame(50);
          processEvents();
          elapsed += 50;
        }
        presentation.update(toPresentationViewModel(engine.state, settings, capabilities));
        return toPresentationViewModel(engine.state, settings, capabilities).rewardOffer;
      },
      endRun() {
        engine.pause('menu');
        const ended = engine.abandonRun();
        processEvents();
        presentation.update(toPresentationViewModel(engine.state, settings, capabilities));
        return ended;
      },
      snapshot() { return { state: engine.state, view: toPresentationViewModel(engine.state, settings, capabilities) }; },
    });
  }
  globalThis.addEventListener('pageshow', (rawEvent) => {
    const event = /** @type {PageTransitionEvent} */ (rawEvent);
    if (event.persisted) lastFrame = performance.now();
  });

  globalThis.addEventListener('pagehide', (rawEvent) => {
    void flushPersistence();
    const event = /** @type {PageTransitionEvent} */ (rawEvent);
    if (event.persisted || unloaded) return;
    unloaded = true;
    disposed = true;
    unsubscribePause();
    void platform.dispose();
    void presentation.destroy().catch(() => undefined);
  });
}

bootstrap().catch((error) => {
  console.error(error);
  const i18n = createI18n(mapPlatformLocale(navigator.language));
  applyDocumentLocale(i18n);
  root.innerHTML = `<main class="app-shell" data-app-state="error"><section class="fatal-screen"><div><h1>${i18n.t('fatal.title')}</h1><p>${i18n.t('fatal.body')}</p></div></section></main>`;
});
