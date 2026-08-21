// @ts-check

import { GameEngine, createInitialState } from './core/index.js';
import { WebPlatformService, YandexPlatformService, createDefaultSave } from './platforms/index.js';
import { createPresentation } from './presentation/index.js';
import { buildSave, recordsFromSave } from './app/save.js';
import { toPresentationEvent, toPresentationViewModel } from './app/viewModel.js';
import { SaveCoordinator } from './app/saveCoordinator.js';
import { PerformanceQualityController } from './app/performanceQuality.js';

const root = document.querySelector('#app');
if (!(root instanceof HTMLElement)) throw new Error('Application root is unavailable.');
root.innerHTML = `<main class="app-shell" data-app-state="loading"><section class="boot-screen"><div><div class="boot-screen__mark"></div><h1>Зажги</h1><p>Пробуждаем древнее пламя…</p></div></section><section class="dialog-backdrop" data-dialog hidden></section><div class="toast" role="status" data-toast hidden></div></main>`;

const shell = /** @type {HTMLElement} */ (root.querySelector('.app-shell'));
const boot = /** @type {HTMLElement} */ (root.querySelector('.boot-screen'));
const dialog = /** @type {HTMLElement} */ (root.querySelector('[data-dialog]'));
const toast = /** @type {HTMLElement} */ (root.querySelector('[data-toast]'));

/** @param {string} message */
function showToast(message) {
  toast.textContent = message;
  toast.hidden = false;
  clearTimeout(showToast.timer);
  showToast.timer = setTimeout(() => { toast.hidden = true; }, 2800);
}
showToast.timer = /** @type {ReturnType<typeof setTimeout>|undefined} */ (undefined);

function qualityTier() {
  const memory = Number(navigator.deviceMemory ?? 8);
  const cores = Number(navigator.hardwareConcurrency ?? 8);
  return memory <= 4 || cores <= 4 ? 'low' : 'high';
}

function makePlatform() {
  return globalThis.YaGames
    ? new YandexPlatformService({ onDiagnostic: (event) => console.info('[platform]', event) })
    : new WebPlatformService({ onDiagnostic: (event) => console.info('[platform]', event) });
}

async function bootstrap() {
  const sdkReady = /** @type {Promise<boolean>|undefined} */ (globalThis.__YANDEX_SDK_READY__);
  if (sdkReady) await sdkReady.catch(() => false);
  const platform = makePlatform();
  const initResult = await platform.init();
  const capabilities = initResult.ok ? initResult.value : {
    platform: 'web', localSave: false, cloudSave: false, leaderboard: 'local-only', rewardedAds: true,
    rewardedProvider: 'test',
    interstitialAds: false, gameplayLifecycle: true,
  };
  const loaded = await platform.loadData();
  let persisted = loaded.ok && loaded.value ? loaded.value : createDefaultSave(Date.now());
  const settings = {
    muted: persisted.settings.muted,
    reducedMotion: persisted.settings.reducedMotion || matchMedia('(prefers-reduced-motion: reduce)').matches,
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
    onFailure: () => showToast('Не удалось синхронизировать рекорд — игра продолжится'),
  });

  let gameplayTapSequence = 0;
  const presentation = createPresentation({
    host: shell,
    onPerformanceSample: ({ atMs, workMs, paused }) => {
      if (performanceQuality.observe(atMs, workMs, {
        visible: document.visibilityState !== 'hidden',
        paused: paused || !performanceMonitoringReady,
      })) settings.quality = settings.quality === 'high' ? 'low' : 'off';
    },
    callbacks: {
      onGameplayTap: () => {
        if (engine.state.phase === 'READY') void platform.resumeGame('menu');
        gameplayTapSequence += 1;
        engine.queueTap(engine.state.simulationTimeMs + 0.001, `pointer-${gameplayTapSequence}`);
      },
      onPauseToggle: () => togglePause(),
      onMuteToggle: () => {
        settings.muted = !settings.muted;
        presentation.dispatch({ type: 'mute-changed', muted: settings.muted });
        saveCoordinator.request();
      },
      onReducedMotionToggle: () => {
        settings.reducedMotion = !settings.reducedMotion;
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
      void saveCoordinator.flushNow();
    }
    for (const reason of previousPauseReasons) if (!next.has(reason)) {
      engine.resume(/** @type {any} */ (reason));
      presentation.dispatch({ type: 'resume', reason });
    }
    previousPauseReasons = next;
  });

  function togglePause() {
    const state = engine.state;
    if (state.phase === 'RESULTS' || state.phase === 'AD_BREAK') return;
    if (state.pauseReasons.includes('menu')) {
      void platform.resumeGame('menu');
      engine.resume('menu');
      closeDialog();
    } else {
      platform.pauseGame('menu');
      engine.pause('menu');
      showPauseMenu();
    }
  }

  function closeDialog() {
    dialog.hidden = true;
    dialog.innerHTML = '';
  }

  function showPauseMenu() {
    dialog.innerHTML = `<article class="dialog" role="dialog" aria-modal="true" aria-labelledby="pause-title"><h2 id="pause-title">Пауза</h2><p>Жар и все активные таймеры остановлены.</p><div class="dialog__actions"><button type="button" data-abandon>Завершить попытку</button><button type="button" data-primary data-continue>Продолжить</button></div></article>`;
    dialog.hidden = false;
    const continueButton = /** @type {HTMLButtonElement} */ (dialog.querySelector('[data-continue]'));
    const abandonButton = /** @type {HTMLButtonElement} */ (dialog.querySelector('[data-abandon]'));
    continueButton.addEventListener('click', togglePause, { once: true });
    abandonButton.addEventListener('click', showAbandonConfirmation, { once: true });
    continueButton.focus();
  }

  function showAbandonConfirmation() {
    dialog.innerHTML = `<article class="dialog" role="dialog" aria-modal="true" aria-labelledby="abandon-title"><h2 id="abandon-title">Завершить попытку?</h2><p>Текущий результат сохранится, но попытка будет отмечена как завершённая.</p><div class="dialog__actions"><button type="button" data-back>Назад</button><button type="button" data-primary data-confirm-abandon>Завершить</button></div></article>`;
    const back = /** @type {HTMLButtonElement} */ (dialog.querySelector('[data-back]'));
    const confirm = /** @type {HTMLButtonElement} */ (dialog.querySelector('[data-confirm-abandon]'));
    back.addEventListener('click', showPauseMenu, { once: true });
    confirm.addEventListener('click', () => {
      if (!engine.abandonRun()) return;
      void platform.resumeGame('menu');
      closeDialog();
    }, { once: true });
    confirm.focus();
  }

  function openRewardDialog() {
    if (!engine.openRewardSheet()) return;
    platform.pauseGame('menu');
    const isTestProvider = capabilities.rewardedProvider === 'test';
    const description = isTestProvider
      ? 'Активировать тестовый ×2 к силе жара на 20 секунд? Это тест, реклама не показывается.'
      : 'Посмотреть короткую рекламу и получить ×2 к силе жара на 20 секунд активной игры?';
    const confirmLabel = isTestProvider ? 'Получить ×2 (тест)' : 'Посмотреть рекламу';
    dialog.innerHTML = `<article class="dialog" role="dialog" aria-modal="true" aria-labelledby="reward-title"><h2 id="reward-title">Усиление жара ×2</h2><p>${description}</p><div class="dialog__actions"><button type="button" data-cancel>Не сейчас</button><button type="button" data-primary data-confirm>${confirmLabel}</button></div></article>`;
    dialog.hidden = false;
    const cancel = /** @type {HTMLButtonElement} */ (dialog.querySelector('[data-cancel]'));
    const confirm = /** @type {HTMLButtonElement} */ (dialog.querySelector('[data-confirm]'));
    cancel.addEventListener('click', () => {
      engine.cancelRewardSheet();
      platform.resumeGame('menu');
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
      closeDialog();
      return;
    }
    const rewardResult = platform.showRewardedAd('inferno-seal');
    platform.resumeGame('menu');
    closeDialog();
    const result = await rewardResult;
    engine.resolveRewarded(requestId, result.status);
    if (result.status === 'rewarded') showToast(capabilities.rewardedProvider === 'test' ? 'Тестовый ×2 активирован на 20 секунд' : 'Сила жара ×2 на 20 секунд');
    else if (result.status === 'closed') showToast('Награда не получена');
    else showToast('Множитель сейчас недоступен');
  }

  function showResults() {
    const state = engine.state;
    platform.pauseGame('game-ended');
    dialog.innerHTML = `<article class="dialog" role="dialog" aria-modal="true" aria-labelledby="results-title"><h2 id="results-title">Пламя угасло</h2><p>${state.abandoned ? 'Попытка завершена.' : 'Жар иссяк, но след огня сохранился.'}</p><div class="dialog__stats"><div class="dialog__stat">Счёт<strong>${state.score.toLocaleString('ru-RU')}</strong></div><div class="dialog__stat">Рекорд<strong>${state.bestScore.toLocaleString('ru-RU')}</strong></div><div class="dialog__stat">Стадия<strong>${state.runHighestStage}/7</strong></div><div class="dialog__stat">Инферно<strong>${(state.runLongestInfernoHoldMs / 1000).toFixed(1)}с</strong></div></div><div class="dialog__actions"><button type="button" data-leaderboard>Таблица лидеров</button><button type="button" data-primary data-restart>Ещё попытка</button></div></article>`;
    dialog.hidden = false;
    const restart = /** @type {HTMLButtonElement} */ (dialog.querySelector('[data-restart]'));
    const leaderboard = /** @type {HTMLButtonElement} */ (dialog.querySelector('[data-leaderboard]'));
    restart.addEventListener('click', () => {
      if (engine.restart()) {
        closeDialog();
        void platform.resumeGame('game-ended');
      }
    });
    leaderboard.addEventListener('click', () => {
      leaderboard.disabled = true;
      void showLeaderboard(state.runId);
    }, { once: true });
    restart.focus();
  }

  /** @param {number} expectedRunId */
  async function showLeaderboard(expectedRunId) {
    const result = await platform.getLeaderboard();
    if (engine.state.phase !== 'RESULTS' || engine.state.runId !== expectedRunId) return;
    if (!result.ok) {
      showToast('Таблица сейчас недоступна — локальный рекорд сохранён');
      showResults();
      return;
    }
    dialog.innerHTML = `<article class="dialog" role="dialog" aria-modal="true" aria-labelledby="leaderboard-title"><h2 id="leaderboard-title">Лучший счёт</h2><ol data-entries></ol><div class="dialog__actions"><button type="button" data-primary data-back-results>Назад</button></div></article>`;
    const list = /** @type {HTMLOListElement} */ (dialog.querySelector('[data-entries]'));
    for (const entry of result.value) {
      const item = document.createElement('li');
      item.textContent = `${entry.rank}. ${entry.displayName} — ${entry.score.toLocaleString('ru-RU')}`;
      list.append(item);
    }
    if (result.value.length === 0) {
      const item = document.createElement('li');
      item.textContent = 'Пока нет результатов';
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
      if (event.type === 'recordsChanged') saveCoordinator.request();
      if (event.type === 'runEnded') {
        void saveCoordinator.flushNow();
        void platform.submitScore(engine.state.bestScore);
        showResults();
      }
      if (event.type === 'stageChanged' && Number(event.data?.to) === 7) showToast('ИНФЕРНО — удерживай пламя!');
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
    boot.innerHTML = `<div><div class="boot-screen__mark"></div><h1>Зажги</h1><p>Не удалось загрузить фон.</p><button type="button" data-retry-assets>Повторить</button></div>`;
    const retry = /** @type {HTMLButtonElement} */ (boot.querySelector('[data-retry-assets]'));
    await new Promise((resolve) => retry.addEventListener('click', resolve, { once: true }));
    if (!await presentation.retryCriticalAssets()) showToast('Включён упрощённый процедурный фон');
  }
  boot.remove();
  await platform.markReady();
  shell.dataset.appState = 'ready';
  performanceMonitoringReady = true;
  globalThis.__INFERNO_DIAGNOSTICS__ = () => ({
    build: document.querySelector('meta[name="build-id"]')?.getAttribute('content') ?? 'development',
    state: engine.state,
    presentation: presentation.getDiagnostics(),
    performance: performanceQuality.getDiagnostics(),
    platform: capabilities,
  });
  requestAnimationFrame(frame);

  globalThis.addEventListener('pageshow', (rawEvent) => {
    const event = /** @type {PageTransitionEvent} */ (rawEvent);
    if (event.persisted) lastFrame = performance.now();
  });

  globalThis.addEventListener('pagehide', (rawEvent) => {
    void saveCoordinator.flushNow();
    const event = /** @type {PageTransitionEvent} */ (rawEvent);
    if (event.persisted) return;
    if (unloaded) return;
    unloaded = true;
    disposed = true;
    unsubscribePause();
    platform.dispose();
    void presentation.destroy().catch(() => undefined);
  });
}

bootstrap().catch((error) => {
  console.error(error);
  shell.dataset.appState = 'error';
  shell.innerHTML = `<section class="fatal-screen"><div><h1>Пламя не зажглось</h1><p>Обновите страницу. Ваши сохранённые рекорды останутся на устройстве.</p></div></section>`;
});
