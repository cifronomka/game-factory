import { createHash } from 'node:crypto';
import { spawn } from 'node:child_process';
import { access, mkdir, readFile, writeFile } from 'node:fs/promises';
import { basename, isAbsolute, join, relative, resolve } from 'node:path';
import process from 'node:process';
import { chromium } from 'playwright-core';
import { buildIdentity, gameRoot, sha256 } from './lib.mjs';

const RELEASE_DURATION_MS = 720_000;
const MIN_SHORT_DURATION_MS = 30_000;
const DEFAULT_PORT = 4_209;
const MAX_DECODED_BYTES = 64 * 1024 * 1024;
const MAX_HEAP_BYTES = 150 * 1024 * 1024;
const MAX_INPUT_P95_MS = 100;
const MAX_LONG_FRAME_RATIO = 0.01;
const SAMPLE_INTERVAL_MS = 500;

function parseArguments(argv) {
  const options = {
    durationMs: RELEASE_DURATION_MS,
    allowShort: false,
    allowEnvironmentBlocker: false,
    buildRoot: process.env.INFERNO_SOAK_BUILD_ROOT || 'dist',
    headed: process.env.INFERNO_SOAK_HEADED === '1',
    evidenceDir: process.env.INFERNO_CYCLE09_EVIDENCE_DIR
      || join(gameRoot, 'reports', 'yandex-release-cycle-09-working'),
    port: Number(process.env.INFERNO_SOAK_PORT || DEFAULT_PORT),
  };
  for (let index = 0; index < argv.length; index += 1) {
    const argument = argv[index];
    if (argument === '--allow-short') options.allowShort = true;
    else if (argument === '--allow-environment-blocker') options.allowEnvironmentBlocker = true;
    else if (argument === '--headed') options.headed = true;
    else if (argument === '--headless') options.headed = false;
    else if (argument.startsWith('--duration-ms=')) options.durationMs = Number(argument.slice('--duration-ms='.length));
    else if (argument === '--duration-ms') options.durationMs = Number(argv[++index]);
    else if (argument.startsWith('--root=')) options.buildRoot = argument.slice('--root='.length);
    else if (argument === '--root') options.buildRoot = argv[++index];
    else if (argument.startsWith('--evidence-dir=')) options.evidenceDir = argument.slice('--evidence-dir='.length);
    else if (argument === '--evidence-dir') options.evidenceDir = argv[++index];
    else if (argument.startsWith('--port=')) options.port = Number(argument.slice('--port='.length));
    else if (argument === '--port') options.port = Number(argv[++index]);
    else throw new Error(`Unknown soak option: ${argument}`);
  }
  if (!Number.isInteger(options.durationMs) || options.durationMs < MIN_SHORT_DURATION_MS) {
    throw new Error(`--duration-ms must be an integer >= ${MIN_SHORT_DURATION_MS}`);
  }
  if (options.durationMs < RELEASE_DURATION_MS && !options.allowShort) {
    throw new Error(`Runs below ${RELEASE_DURATION_MS}ms require --allow-short and are never release evidence.`);
  }
  if (!Number.isInteger(options.port) || options.port < 1 || options.port > 65_535) throw new Error('Invalid preview port.');
  const rootName = basename(String(options.buildRoot).replace(/[\\/]+$/u, ''));
  if (rootName !== 'dist' && rootName !== 'dist-e2e') throw new Error('--root must select dist or dist-e2e.');
  const resolvedRoot = resolve(gameRoot, options.buildRoot);
  if (relative(gameRoot, resolvedRoot).startsWith('..')) throw new Error('Build root must stay inside the game project.');
  options.buildRoot = resolvedRoot;
  options.evidenceDir = isAbsolute(options.evidenceDir) ? options.evidenceDir : resolve(gameRoot, options.evidenceDir);
  return options;
}

async function firstAvailable(paths) {
  for (const path of paths) {
    try {
      await access(path);
      return path;
    } catch { /* try the next installed Chromium browser */ }
  }
  throw new Error('Installed Chrome, Chromium, or Yandex Browser is required for the Yandex soak.');
}

function quantile(values, percentile) {
  if (values.length === 0) return null;
  const ordered = [...values].sort((left, right) => left - right);
  return ordered[Math.min(ordered.length - 1, Math.max(0, Math.ceil(ordered.length * percentile) - 1))];
}

function round(value, digits = 2) {
  if (!Number.isFinite(value)) return null;
  const factor = 10 ** digits;
  return Math.round(value * factor) / factor;
}

function delay(ms) {
  return new Promise((resolvePromise) => setTimeout(resolvePromise, ms));
}

function sdkMockBootstrap(configuration) {
  const listeners = new Map();
  const calls = globalThis.__YSDK_MOCK_CALLS__ = {
    init: 0,
    ready: [],
    start: [],
    stop: [],
    getData: [],
    setData: [],
    setScore: [],
    getEntries: [],
    adRequests: [],
    adOpen: [],
    rewarded: [],
    adClose: [],
    emits: [],
  };
  const event = (extra = {}) => ({ atMs: performance.now(), wallTime: Date.now(), ...extra });
  const cloud = {
    infernoSaveV1: {
      schemaVersion: 1,
      bestScore: 0,
      highestStageReached: 1,
      longestInfernoHoldMs: 0,
      maxMultiplier: 1,
      runsPlayed: 0,
      tutorialFlags: { tap: false },
      settings: { muted: false, reducedMotion: false, updatedAt: 1 },
      dailyRitual: { date: null, rewardClaimed: false },
      updatedAt: 1,
    },
  };
  const diagnostics = () => {
    try {
      const state = globalThis.__INFERNO_DIAGNOSTICS__?.().state;
      return state ? {
        phase: state.phase,
        runId: state.runId,
        activeRunTimeMs: state.activeRunTimeMs,
        activeRewardGranted: state.activeRewardGranted,
        queuedBoost: state.queuedBoost,
        boostMsLeft: state.boost?.msLeft ?? null,
        cooldownMs: state.sessionRewardCooldownMs,
      } : null;
    } catch {
      return null;
    }
  };
  const player = {
    isAuthorized: () => true,
    getUniqueID: () => `${configuration.id}-player`,
    getData: async () => {
      calls.getData.push(event());
      return JSON.parse(JSON.stringify(cloud));
    },
    setData: async (data, flush) => {
      calls.setData.push(event({ flush: Boolean(flush), data: JSON.parse(JSON.stringify(data)) }));
      Object.assign(cloud, JSON.parse(JSON.stringify(data)));
    },
  };
  const sdk = globalThis.__YSDK_MOCK__ = {
    environment: { i18n: { lang: configuration.locale } },
    features: {
      LoadingAPI: { ready: async () => { calls.ready.push(event()); } },
      GameplayAPI: {
        start: () => { calls.start.push(event()); },
        stop: () => { calls.stop.push(event()); },
      },
    },
    getPlayer: async () => player,
    isAvailableMethod: async () => true,
    leaderboards: {
      setScore: async (name, score) => { calls.setScore.push(event({ name, score })); },
      getEntries: async () => {
        calls.getEntries.push(event());
        return { entries: [{ rank: 1, score: 250_000, player: { publicName: 'Soak Leader', uniqueID: 'soak-leader' } }] };
      },
    },
    adv: {
      showRewardedVideo: ({ callbacks }) => {
        const requestIndex = calls.adRequests.length + 1;
        calls.adRequests.push(event({ requestIndex, before: diagnostics() }));
        callbacks.onOpen?.();
        calls.adOpen.push(event({ requestIndex, after: diagnostics() }));
        setTimeout(() => {
          callbacks.onRewarded?.();
          calls.rewarded.push(event({ requestIndex, after: diagnostics() }));
        }, 350);
        setTimeout(() => {
          callbacks.onClose?.(true);
          calls.adClose.push(event({ requestIndex, after: diagnostics() }));
        }, 900);
      },
    },
    on: (name, callback) => {
      if (!listeners.has(name)) listeners.set(name, new Set());
      listeners.get(name).add(callback);
    },
    off: (name, callback) => listeners.get(name)?.delete(callback),
  };
  sdk.emit = (name) => {
    calls.emits.push(event({ name, before: diagnostics() }));
    for (const callback of listeners.get(name) || []) callback();
  };
  globalThis.YaGames = {
    init: async () => {
      calls.init += 1;
      return sdk;
    },
  };
}

function metricsBootstrap() {
  const metrics = globalThis.__INFERNO_SOAK_METRICS__ = {
    frameDeltasMs: [],
    inputFeedbackMs: [],
    pendingInputs: [],
    canvasPointerDowns: 0,
    frameWarmupEndsAt: performance.now() + 5_000,
  };
  let previousFrame = null;
  const frame = (now) => {
    if (previousFrame !== null && now >= metrics.frameWarmupEndsAt && document.visibilityState === 'visible') {
      metrics.frameDeltasMs.push(now - previousFrame);
    }
    previousFrame = now;
    requestAnimationFrame(frame);
  };
  requestAnimationFrame(frame);
  addEventListener('pointerdown', (event) => {
    if (!(event.target instanceof HTMLCanvasElement)) return;
    metrics.canvasPointerDowns += 1;
    metrics.pendingInputs.push(performance.now());
  }, true);
  const attachScoreObserver = () => {
    const score = document.querySelector('[data-score]');
    if (!score) {
      setTimeout(attachScoreObserver, 50);
      return;
    }
    let prior = score.textContent;
    new MutationObserver(() => {
      if (score.textContent === prior) return;
      prior = score.textContent;
      const now = performance.now();
      const pending = metrics.pendingInputs.splice(0);
      for (const inputAt of pending) {
        const latency = now - inputAt;
        if (latency >= 0 && latency <= 2_000) metrics.inputFeedbackMs.push(latency);
      }
    }).observe(score, { childList: true, characterData: true, subtree: true });
  };
  if (document.readyState === 'loading') addEventListener('DOMContentLoaded', attachScoreObserver, { once: true });
  else attachScoreObserver();
}

function sdkMockSource(configuration) {
  return `(${sdkMockBootstrap.toString()})(${JSON.stringify(configuration)});`;
}

async function waitForServer(url) {
  const deadline = Date.now() + 15_000;
  while (Date.now() < deadline) {
    try {
      const response = await fetch(url);
      if (response.ok) return;
    } catch { /* preview is still starting */ }
    await delay(75);
  }
  throw new Error('Yandex soak preview server did not start.');
}

async function calibrateCompositor(browser) {
  const page = await browser.newPage({ viewport: { width: 1_280, height: 720 } });
  try {
    await page.goto('data:text/html,<canvas width="1280" height="720"></canvas>', { waitUntil: 'load' });
    await page.evaluate(() => {
      const context = document.querySelector('canvas').getContext('2d');
      globalThis.__SOAK_CALIBRATION__ = [];
      let previous = null;
      requestAnimationFrame(function frame(now) {
        if (previous !== null) globalThis.__SOAK_CALIBRATION__.push(now - previous);
        previous = now;
        context.fillStyle = '#180904';
        context.fillRect(0, 0, 1_280, 720);
        requestAnimationFrame(frame);
      });
    });
    await delay(3_500);
    const samples = await page.evaluate(() => globalThis.__SOAK_CALIBRATION__.slice(10));
    const medianFrameMs = quantile(samples, 0.5);
    const measuredFps = medianFrameMs ? 1_000 / medianFrameMs : 0;
    return {
      samples: samples.length,
      medianFrameMs: round(medianFrameMs),
      medianFps: round(measuredFps),
      desktopThresholdFps: 55,
      desktopThresholdProvable: Boolean(medianFrameMs && measuredFps >= 55),
      mobileThresholdFps: 30,
      mobileThresholdProvable: Boolean(medianFrameMs && measuredFps >= 30),
    };
  } finally {
    await page.close();
  }
}

function collectPageFailures(page) {
  const failures = [];
  page.on('console', (message) => {
    if (message.type() === 'warning' || message.type() === 'error') {
      failures.push({ type: `console.${message.type()}`, detail: message.text(), at: Date.now() });
    }
  });
  page.on('pageerror', (error) => failures.push({ type: 'pageerror', detail: error.message, at: Date.now() }));
  page.on('requestfailed', (request) => failures.push({
    type: 'requestfailed',
    detail: `${request.method()} ${request.url()} ${request.failure()?.errorText || ''}`.trim(),
    at: Date.now(),
  }));
  page.on('response', (response) => {
    if (response.status() >= 400) failures.push({
      type: 'http',
      detail: `${response.status()} ${response.request().method()} ${response.url()}`,
      at: Date.now(),
    });
  });
  page.on('crash', () => failures.push({ type: 'crash', detail: 'Renderer crashed', at: Date.now() }));
  return failures;
}

class SessionTracker {
  constructor() {
    this.runActiveMax = new Map();
    this.runIds = new Set();
    this.maxStage = 1;
    this.maxInfernoHoldMs = 0;
    this.maxScore = 0;
    this.latest = null;
  }

  observe(diagnostics) {
    const state = diagnostics?.state;
    if (!state) return;
    this.latest = diagnostics;
    this.runIds.add(state.runId);
    this.runActiveMax.set(state.runId, Math.max(this.runActiveMax.get(state.runId) || 0, state.activeRunTimeMs));
    this.maxStage = Math.max(this.maxStage, state.stage, state.runHighestStage, state.records?.highestStageReached || 1);
    this.maxInfernoHoldMs = Math.max(
      this.maxInfernoHoldMs,
      state.currentInfernoHoldMs || 0,
      state.runLongestInfernoHoldMs || 0,
      state.records?.longestInfernoHoldMs || 0,
    );
    this.maxScore = Math.max(this.maxScore, state.score || 0, state.bestScore || 0, state.records?.bestScore || 0);
  }

  cumulativeActiveMs() {
    return [...this.runActiveMax.values()].reduce((total, value) => total + value, 0);
  }
}

function makeSessionResult(configuration) {
  return {
    id: configuration.id,
    device: configuration.device,
    locale: configuration.locale,
    rewarded: configuration.rewarded,
    viewport: configuration.viewport,
    startedAt: null,
    finishedAt: null,
    elapsedMs: 0,
    failures: [],
    assertions: [],
    interactions: { gameplayInputs: 0, goalsOpened: 0, abandons: 0, restarts: 0, sdkPauseCycles: 0 },
    functional: {},
    performance: {},
    sdk: {},
  };
}

function recordAssertion(result, name, passed, detail) {
  result.assertions.push({ name, passed: Boolean(passed), detail });
  if (!passed) result.failures.push({ type: 'assertion', detail: `${name}: ${detail}` });
}

async function diagnosticSnapshot(page, tracker) {
  const diagnostics = await page.evaluate(() => globalThis.__INFERNO_DIAGNOSTICS__?.() ?? null);
  tracker.observe(diagnostics);
  return diagnostics;
}

async function clickGameplay(page, configuration, canvasBox) {
  const x = canvasBox.x + canvasBox.width * 0.5;
  const y = canvasBox.y + canvasBox.height * 0.55;
  if (configuration.device === 'mobile') await page.touchscreen.tap(x, y);
  else await page.mouse.click(x, y);
}

async function inspectGoals(page, result, fromResults = false) {
  if (fromResults) await page.locator('[data-goals]').click({ timeout: 5_000 });
  else await page.locator('[data-action="goals"]').click({ timeout: 5_000 });
  await page.locator('.dialog--goals').waitFor({ state: 'visible', timeout: 5_000 });
  const title = await page.locator('#goals-title').innerText();
  const rowCount = await page.locator('.goal-row').count();
  recordAssertion(result, `goals-title-${result.interactions.goalsOpened + 1}`, title === (result.locale === 'ru' ? 'Цели' : 'Goals'), title);
  recordAssertion(result, `goals-count-${result.interactions.goalsOpened + 1}`, rowCount === 8, `${rowCount} rows`);
  result.interactions.goalsOpened += 1;
  await page.locator('[data-back]').click({ timeout: 5_000 });
  if (!fromResults) {
    await page.locator('[data-continue]').waitFor({ state: 'visible', timeout: 5_000 });
    await page.locator('[data-continue]').click({ timeout: 5_000 });
  }
}

async function sdkPauseCycle(page, tracker, result) {
  const before = await diagnosticSnapshot(page, tracker);
  await page.evaluate(() => globalThis.__YSDK_MOCK__.emit('game_api_pause'));
  await page.waitForFunction(() => globalThis.__INFERNO_DIAGNOSTICS__().state.pauseReasons.includes('platform'), null, { timeout: 5_000 });
  const paused = await diagnosticSnapshot(page, tracker);
  await delay(750);
  const held = await diagnosticSnapshot(page, tracker);
  const frozenDelta = held.state.activeRunTimeMs - paused.state.activeRunTimeMs;
  recordAssertion(result, 'sdk-pause-active-clock-frozen', frozenDelta <= 100, `${round(frozenDelta)}ms advanced`);
  await page.evaluate(() => globalThis.__YSDK_MOCK__.emit('game_api_resume'));
  await page.waitForFunction(() => !globalThis.__INFERNO_DIAGNOSTICS__().state.pauseReasons.includes('platform'), null, { timeout: 5_000 });
  const resumed = await diagnosticSnapshot(page, tracker);
  recordAssertion(result, 'sdk-pause-resumed', resumed.state.phase === (before.state.activeRunTimeMs > 0 ? 'PLAYING' : 'READY'), resumed.state.phase);
  result.interactions.sdkPauseCycles += 1;
}

async function abandonAndRestart(page, tracker, result) {
  let diagnostics = await diagnosticSnapshot(page, tracker);
  if (diagnostics.state.phase === 'RESULTS') {
    await inspectGoals(page, result, true);
  } else {
    if (diagnostics.state.phase !== 'READY' && diagnostics.state.phase !== 'PLAYING') return false;
    await page.locator('[data-action="pause"]').click({ timeout: 5_000 });
    await page.locator('[data-abandon]').waitFor({ state: 'visible', timeout: 5_000 });
    await page.locator('[data-abandon]').click({ timeout: 5_000 });
    await page.locator('[data-confirm-abandon]').click({ timeout: 5_000 });
    await page.locator('[data-restart]').waitFor({ state: 'visible', timeout: 5_000 });
    diagnostics = await diagnosticSnapshot(page, tracker);
    recordAssertion(result, `abandon-result-${result.interactions.abandons + 1}`, diagnostics.state.phase === 'RESULTS' && diagnostics.state.abandoned, diagnostics.state.phase);
    result.interactions.abandons += 1;
    await inspectGoals(page, result, true);
  }
  await page.locator('[data-restart]').click({ timeout: 5_000 });
  await page.waitForFunction(() => globalThis.__INFERNO_DIAGNOSTICS__().state.phase === 'READY', null, { timeout: 5_000 });
  result.interactions.restarts += 1;
  return true;
}

async function exerciseReward(page, tracker, result) {
  const rewardButton = page.locator('[data-action="reward"]');
  if (!await rewardButton.isVisible() || !await rewardButton.isEnabled()) return false;
  const beforeCounts = await page.evaluate(() => ({
    open: globalThis.__YSDK_MOCK_CALLS__.adOpen.length,
    rewarded: globalThis.__YSDK_MOCK_CALLS__.rewarded.length,
    close: globalThis.__YSDK_MOCK_CALLS__.adClose.length,
  }));
  await rewardButton.click({ timeout: 5_000 });
  await page.locator('[data-confirm]').waitFor({ state: 'visible', timeout: 5_000 });
  await page.locator('[data-confirm]').click({ timeout: 5_000 });
  await page.waitForFunction((count) => globalThis.__YSDK_MOCK_CALLS__.adOpen.length > count, beforeCounts.open, { timeout: 5_000 });
  const opened = await diagnosticSnapshot(page, tracker);
  recordAssertion(result, `reward-${beforeCounts.open + 1}-not-granted-on-open`,
    opened.state.phase === 'AD_BREAK' && !opened.state.activeRewardGranted && !opened.state.boost && opened.state.sessionRewardCooldownMs === 0,
    JSON.stringify({ phase: opened.state.phase, granted: opened.state.activeRewardGranted, boost: opened.state.boost, cooldown: opened.state.sessionRewardCooldownMs }));
  await page.waitForFunction((count) => globalThis.__YSDK_MOCK_CALLS__.rewarded.length > count, beforeCounts.rewarded, { timeout: 5_000 });
  const earned = await diagnosticSnapshot(page, tracker);
  const grantActiveMs = tracker.cumulativeActiveMs();
  recordAssertion(result, `reward-${beforeCounts.rewarded + 1}-queued-on-rewarded`,
    earned.state.phase === 'AD_BREAK' && earned.state.activeRewardGranted && earned.state.queuedBoost && !earned.state.boost,
    JSON.stringify({ phase: earned.state.phase, granted: earned.state.activeRewardGranted, queued: earned.state.queuedBoost, boost: earned.state.boost }));
  recordAssertion(result, `reward-${beforeCounts.rewarded + 1}-cooldown-started`,
    earned.state.sessionRewardCooldownMs >= 89_900,
    `${round(earned.state.sessionRewardCooldownMs)}ms`);
  await page.waitForFunction((count) => globalThis.__YSDK_MOCK_CALLS__.adClose.length > count, beforeCounts.close, { timeout: 5_000 });
  await page.waitForFunction(() => globalThis.__INFERNO_DIAGNOSTICS__().state.activeRewardRequestId === null, null, { timeout: 5_000 });
  const closed = await diagnosticSnapshot(page, tracker);
  recordAssertion(result, `reward-${beforeCounts.close + 1}-starts-after-close`,
    closed.state.phase === 'PLAYING' && closed.state.boost?.msLeft >= 59_000,
    JSON.stringify({ phase: closed.state.phase, boost: closed.state.boost }));
  if (!result.functional.rewardGrantActiveTimesMs) result.functional.rewardGrantActiveTimesMs = [];
  const prior = result.functional.rewardGrantActiveTimesMs.at(-1);
  if (prior !== undefined) recordAssertion(result, `reward-${beforeCounts.rewarded + 1}-active-cadence`,
    grantActiveMs - prior >= 89_000,
    `${round(grantActiveMs - prior)}ms active between rewards`);
  result.functional.rewardGrantActiveTimesMs.push(grantActiveMs);
  return true;
}

async function sessionInputLoop(page, configuration, result, state, canvasBox, hardDeadline) {
  const intervalMs = configuration.device === 'mobile' ? 35 : 80;
  while (!state.done && Date.now() < hardDeadline && !page.isClosed()) {
    if (!state.actionLocked) {
      try {
        await clickGameplay(page, configuration, canvasBox);
        result.interactions.gameplayInputs += 1;
      } catch (error) {
        result.failures.push({ type: 'input', detail: error.message });
        return;
      }
    }
    await delay(intervalMs);
  }
}

async function sessionControlLoop(page, configuration, result, state, tracker, start, durationMs, hardDeadline) {
  const goalTimes = [0.09, 0.45, 0.79].map((fraction) => start + durationMs * fraction);
  const firstAbandonAt = start + Math.max(18_000, durationMs * 0.33);
  const abandonTimes = [firstAbandonAt, start + Math.max(firstAbandonAt - start + 7_000, durationMs * 0.67)];
  const sdkPauseAt = start + Math.min(12_000, durationMs * 0.18);
  let sdkPauseDone = false;
  let goalIndex = 0;
  let abandonIndex = 0;
  let lastHeapSampleAt = 0;
  const heapSamples = [];
  while (!state.done && Date.now() < hardDeadline && !page.isClosed()) {
    try {
      const diagnostics = await diagnosticSnapshot(page, tracker);
      const now = Date.now();
      if (now - lastHeapSampleAt >= 2_000) {
        const heap = await page.evaluate(() => globalThis.performance?.memory?.usedJSHeapSize ?? null);
        if (Number.isFinite(heap)) heapSamples.push(heap);
        lastHeapSampleAt = now;
      }
      if (!state.actionLocked && !sdkPauseDone && now >= sdkPauseAt && diagnostics.state.phase === 'PLAYING') {
        state.actionLocked = true;
        await sdkPauseCycle(page, tracker, result);
        sdkPauseDone = true;
        state.actionLocked = false;
      } else if (!state.actionLocked && goalIndex < goalTimes.length && now >= goalTimes[goalIndex]
        && (diagnostics.state.phase === 'READY' || diagnostics.state.phase === 'PLAYING')) {
        state.actionLocked = true;
        await inspectGoals(page, result, false);
        goalIndex += 1;
        state.actionLocked = false;
      } else if (!state.actionLocked && abandonIndex < abandonTimes.length && now >= abandonTimes[abandonIndex]
        && (diagnostics.state.phase === 'READY' || diagnostics.state.phase === 'PLAYING' || diagnostics.state.phase === 'RESULTS')) {
        state.actionLocked = true;
        const restarted = await abandonAndRestart(page, tracker, result);
        if (restarted) abandonIndex += 1;
        state.actionLocked = false;
      } else if (!state.actionLocked && configuration.rewarded && diagnostics.state.phase === 'PLAYING') {
        state.actionLocked = true;
        await exerciseReward(page, tracker, result);
        state.actionLocked = false;
      }
      if (Date.now() - start >= durationMs && tracker.cumulativeActiveMs() >= durationMs) state.done = true;
    } catch (error) {
      state.actionLocked = false;
      state.done = true;
      result.failures.push({ type: 'control', detail: error.message });
      break;
    }
    await delay(SAMPLE_INTERVAL_MS);
  }
  result.performance.heapSamplesBytes = heapSamples;
}

async function runSession(browser, baseUrl, configuration, durationMs, releaseEligible) {
  const result = makeSessionResult(configuration);
  const tracker = new SessionTracker();
  const context = await browser.newContext({
    viewport: configuration.viewport,
    deviceScaleFactor: configuration.device === 'mobile' ? 2 : 1,
    isMobile: configuration.device === 'mobile',
    hasTouch: configuration.device === 'mobile',
    locale: configuration.locale === 'ru' ? 'ru-RU' : 'en-US',
    reducedMotion: 'no-preference',
  });
  await context.addInitScript(metricsBootstrap);
  await context.route('**/sdk.js', (route) => route.fulfill({
    status: 200,
    contentType: 'text/javascript; charset=utf-8',
    body: sdkMockSource(configuration),
  }));
  const page = await context.newPage();
  const pageFailures = collectPageFailures(page);
  try {
    await page.goto(`${baseUrl}/?infernoDebug=1`, { waitUntil: 'domcontentloaded', timeout: 30_000 });
    await page.locator('.app-shell[data-app-state="ready"]').waitFor({ timeout: 30_000 });
    await page.locator('.boot-screen').waitFor({ state: 'detached', timeout: 30_000 });
    recordAssertion(result, 'localized-title', await page.title() === (configuration.locale === 'ru' ? 'Зажги' : 'Ignite'), await page.title());
    recordAssertion(result, 'localized-document', await page.locator('html').getAttribute('lang') === configuration.locale, await page.locator('html').getAttribute('lang'));
    const startupCalls = await page.evaluate(() => ({ init: globalThis.__YSDK_MOCK_CALLS__.init, ready: globalThis.__YSDK_MOCK_CALLS__.ready.length }));
    recordAssertion(result, 'sdk-init-once', startupCalls.init === 1, JSON.stringify(startupCalls));
    recordAssertion(result, 'game-ready-once', startupCalls.ready === 1, JSON.stringify(startupCalls));
    const canvas = page.locator('canvas');
    const canvasBox = await canvas.boundingBox();
    if (!canvasBox) throw new Error('Gameplay canvas is missing.');
    result.startedAt = new Date().toISOString();
    const start = Date.now();
    const hardDeadline = start + durationMs + Math.max(60_000, Math.ceil(durationMs * 0.25));
    const state = { actionLocked: false, done: false };
    await clickGameplay(page, configuration, canvasBox);
    result.interactions.gameplayInputs += 1;
    await page.waitForFunction(() => globalThis.__INFERNO_DIAGNOSTICS__().state.phase === 'PLAYING', null, { timeout: 5_000 });
    await Promise.all([
      sessionInputLoop(page, configuration, result, state, canvasBox, hardDeadline),
      sessionControlLoop(page, configuration, result, state, tracker, start, durationMs, hardDeadline),
    ]);
    await diagnosticSnapshot(page, tracker);
    result.elapsedMs = Date.now() - start;
    result.finishedAt = new Date().toISOString();
    const browserMetrics = await page.evaluate(() => ({
      frameDeltasMs: [...globalThis.__INFERNO_SOAK_METRICS__.frameDeltasMs],
      inputFeedbackMs: [...globalThis.__INFERNO_SOAK_METRICS__.inputFeedbackMs],
      pendingInputCount: globalThis.__INFERNO_SOAK_METRICS__.pendingInputs.length,
      canvasPointerDowns: globalThis.__INFERNO_SOAK_METRICS__.canvasPointerDowns,
    }));
    const sdkCalls = await page.evaluate(() => JSON.parse(JSON.stringify(globalThis.__YSDK_MOCK_CALLS__)));
    const diagnostics = tracker.latest;
    const medianFrameMs = quantile(browserMetrics.frameDeltasMs, 0.5);
    const medianFps = medianFrameMs ? 1_000 / medianFrameMs : 0;
    const longFrames = browserMetrics.frameDeltasMs.filter((value) => value > 50).length;
    const longFrameRatio = browserMetrics.frameDeltasMs.length > 0 ? longFrames / browserMetrics.frameDeltasMs.length : 1;
    const inputP95Ms = quantile(browserMetrics.inputFeedbackMs, 0.95);
    const maximumHeapBytes = Math.max(0, ...(result.performance.heapSamplesBytes || []));
    result.performance = {
      frameSamples: browserMetrics.frameDeltasMs.length,
      medianFrameMs: round(medianFrameMs),
      medianFps: round(medianFps),
      longFramesOver50Ms: longFrames,
      longFrameRatio: round(longFrameRatio, 6),
      inputFeedbackSamples: browserMetrics.inputFeedbackMs.length,
      inputFeedbackP95Ms: round(inputP95Ms),
      unmatchedInputs: browserMetrics.pendingInputCount,
      canvasPointerDowns: browserMetrics.canvasPointerDowns,
      heapSamples: result.performance.heapSamplesBytes?.length || 0,
      maximumHeapBytes,
      maximumHeapMiB: round(maximumHeapBytes / 1024 / 1024),
      inGameQuality: diagnostics?.performance ?? null,
    };
    result.functional = {
      ...result.functional,
      maxStage: tracker.maxStage,
      maxInfernoHoldMs: round(tracker.maxInfernoHoldMs),
      maxScore: tracker.maxScore,
      runIds: [...tracker.runIds].sort((left, right) => left - right),
      completedAttempts: diagnostics?.state.records?.runsPlayed ?? 0,
      cumulativeActiveMs: round(tracker.cumulativeActiveMs()),
      finalPhase: diagnostics?.state.phase ?? null,
      finalAudio: diagnostics?.presentation?.audio ?? null,
      finalSave: sdkCalls.setData.at(-1)?.data?.infernoSaveV1 ?? null,
    };
    result.sdk = {
      init: sdkCalls.init,
      ready: sdkCalls.ready.length,
      gameplayStarts: sdkCalls.start.length,
      gameplayStops: sdkCalls.stop.length,
      getData: sdkCalls.getData.length,
      setData: sdkCalls.setData.length,
      flushWrites: sdkCalls.setData.filter((item) => item.flush).length,
      scoreWrites: sdkCalls.setScore.length,
      adRequests: sdkCalls.adRequests.length,
      adOpen: sdkCalls.adOpen.length,
      rewardedCallbacks: sdkCalls.rewarded.length,
      adClose: sdkCalls.adClose.length,
      emittedLifecycleEvents: sdkCalls.emits.map((item) => item.name),
    };
    recordAssertion(result, 'elapsed-real-time', result.elapsedMs >= durationMs, `${result.elapsedMs}ms / ${durationMs}ms`);
    recordAssertion(result, 'active-gameplay-real-time', tracker.cumulativeActiveMs() >= durationMs,
      `${round(tracker.cumulativeActiveMs())}ms / ${durationMs}ms`);
    recordAssertion(result, 'console-network-clean', pageFailures.length === 0, `${pageFailures.length} failures`);
    recordAssertion(result, 'median-fps', medianFps >= (configuration.device === 'desktop' ? 55 : 30), `${round(medianFps)} FPS`);
    recordAssertion(result, 'long-frame-ratio', longFrameRatio <= MAX_LONG_FRAME_RATIO, `${round(longFrameRatio * 100, 3)}%`);
    recordAssertion(result, 'heap', maximumHeapBytes > 0 && maximumHeapBytes <= MAX_HEAP_BYTES, `${round(maximumHeapBytes / 1024 / 1024)} MiB`);
    recordAssertion(result, 'input-feedback-p95', inputP95Ms !== null && inputP95Ms <= MAX_INPUT_P95_MS, `${round(inputP95Ms)}ms from ${browserMetrics.inputFeedbackMs.length} samples`);
    recordAssertion(result, 'audio-unlocked', diagnostics?.presentation?.audio?.unlocked === true, JSON.stringify(diagnostics?.presentation?.audio));
    recordAssertion(result, 'authored-audio-loaded', diagnostics?.presentation?.audio?.authoredWoodActive === true
      && diagnostics?.presentation?.audio?.authoredAudioFailed === false
      && diagnostics?.presentation?.audio?.fanBuffers === 3,
    JSON.stringify(diagnostics?.presentation?.audio));
    recordAssertion(result, 'real-pointer-inputs', browserMetrics.canvasPointerDowns >= Math.max(50, result.interactions.gameplayInputs * 0.9),
      `${browserMetrics.canvasPointerDowns}/${result.interactions.gameplayInputs}`);
    recordAssertion(result, 'sdk-pause-resume-covered', result.interactions.sdkPauseCycles === 1
      && sdkCalls.emits.some((item) => item.name === 'game_api_pause')
      && sdkCalls.emits.some((item) => item.name === 'game_api_resume'),
    JSON.stringify(sdkCalls.emits.map((item) => item.name)));
    recordAssertion(result, 'save-covered', sdkCalls.setData.length >= (releaseEligible ? 2 : 1)
      && sdkCalls.setData.some((item) => item.flush), `${sdkCalls.setData.length} writes; ${result.sdk.flushWrites} flush`);
    recordAssertion(result, 'gameplay-lifecycle-covered', sdkCalls.start.length >= (releaseEligible ? 3 : 2)
      && sdkCalls.stop.length >= (releaseEligible ? 2 : 1), `${sdkCalls.start.length} starts / ${sdkCalls.stop.length} stops`);
    recordAssertion(result, 'ui-abandon-restart-covered', result.interactions.abandons >= 2 && result.interactions.restarts >= 2,
      `${result.interactions.abandons} abandons / ${result.interactions.restarts} restarts`);
    recordAssertion(result, 'goals-covered', result.interactions.goalsOpened >= (releaseEligible ? 3 : 2), `${result.interactions.goalsOpened} openings`);
    if (releaseEligible) {
      recordAssertion(result, 'stage-seven-reached', tracker.maxStage === 7, `stage ${tracker.maxStage}`);
      recordAssertion(result, 'attempt-records', diagnostics.state.records.runsPlayed >= 2, `${diagnostics.state.records.runsPlayed} attempts`);
      recordAssertion(result, 'inferno-held', tracker.maxInfernoHoldMs >= 60_000, `${round(tracker.maxInfernoHoldMs)}ms`);
      if (configuration.rewarded) {
        recordAssertion(result, 'rewarded-repeat-covered', sdkCalls.rewarded.length >= 2, `${sdkCalls.rewarded.length} rewards`);
        recordAssertion(result, 'reward-callback-accounting', sdkCalls.adRequests.length === sdkCalls.adOpen.length
          && sdkCalls.adOpen.length === sdkCalls.rewarded.length && sdkCalls.rewarded.length === sdkCalls.adClose.length,
        JSON.stringify(result.sdk));
      } else recordAssertion(result, 'no-reward-session-is-ad-free', sdkCalls.adRequests.length === 0, `${sdkCalls.adRequests.length} requests`);
    } else if (!configuration.rewarded) {
      recordAssertion(result, 'short-no-reward-session-is-ad-free', sdkCalls.adRequests.length === 0, `${sdkCalls.adRequests.length} requests`);
    }
  } catch (error) {
    result.failures.push({ type: 'fatal', detail: error.stack || error.message });
    result.finishedAt = new Date().toISOString();
  } finally {
    result.failures.push(...pageFailures);
    await context.close();
  }
  result.passed = result.failures.length === 0 && result.assertions.every((assertion) => assertion.passed);
  return result;
}

async function inspectBuild(buildRoot) {
  const manifestPath = join(buildRoot, 'build-manifest.json');
  const manifest = JSON.parse(await readFile(manifestPath, 'utf8'));
  if (manifest.target !== 'yandex') throw new Error(`Build target is ${manifest.target}, expected yandex.`);
  const identity = await buildIdentity();
  if (manifest.sourceFingerprint !== identity.sourceFingerprint) {
    throw new Error(`Build is stale: manifest ${manifest.sourceFingerprint}, source ${identity.sourceFingerprint}. Run npm run build:yandex.`);
  }
  const assetManifestPath = join(gameRoot, 'assets', 'assets-manifest-yandex-1.0.0.json');
  const assetManifest = JSON.parse(await readFile(assetManifestPath, 'utf8'));
  if (assetManifest.maximumDecodedResidencyBytes > MAX_DECODED_BYTES) {
    throw new Error(`Decoded asset residency is ${assetManifest.maximumDecodedResidencyBytes} bytes, over 64 MiB.`);
  }
  return {
    identity,
    manifest,
    manifestPath,
    manifestSha256: await sha256(manifestPath),
    assetManifest: {
      path: relative(gameRoot, assetManifestPath).replaceAll('\\', '/'),
      sha256: await sha256(assetManifestPath),
      maximumDecodedResidencyBytes: assetManifest.maximumDecodedResidencyBytes,
      maximumDecodedResidencyMiB: round(assetManifest.maximumDecodedResidencyBytes / 1024 / 1024),
      limitBytes: MAX_DECODED_BYTES,
      passed: assetManifest.maximumDecodedResidencyBytes <= MAX_DECODED_BYTES,
    },
  };
}

const SESSION_CONFIGURATIONS = Object.freeze([
  Object.freeze({ id: 'desktop-reward-ru', device: 'desktop', locale: 'ru', rewarded: true, viewport: { width: 1_920, height: 1_080 } }),
  Object.freeze({ id: 'desktop-no-reward-en', device: 'desktop', locale: 'en', rewarded: false, viewport: { width: 1_280, height: 1_024 } }),
  Object.freeze({ id: 'mobile-reward-en', device: 'mobile', locale: 'en', rewarded: true, viewport: { width: 390, height: 844 } }),
  Object.freeze({ id: 'mobile-no-reward-ru', device: 'mobile', locale: 'ru', rewarded: false, viewport: { width: 412, height: 915 } }),
]);

async function main() {
  const options = parseArguments(process.argv.slice(2));
  const releaseEligible = options.durationMs >= RELEASE_DURATION_MS;
  const evidencePath = join(options.evidenceDir, 'soak-yandex.json');
  const startedAt = new Date().toISOString();
  const evidence = {
    schemaVersion: 1,
    cycle: '09',
    game: 'inferno-clicker',
    runType: releaseEligible ? 'release-soak' : 'non-release-short-smoke',
    releaseEligible,
    status: 'RUNNING',
    startedAt,
    finishedAt: null,
    configuration: {
      durationMs: options.durationMs,
      minimumWallAndActiveGameplayMs: options.durationMs,
      minimumReleaseDurationMs: RELEASE_DURATION_MS,
      parallelSessions: SESSION_CONFIGURATIONS.length,
      buildRoot: relative(gameRoot, options.buildRoot).replaceAll('\\', '/'),
      evidencePath: relative(gameRoot, evidencePath).replaceAll('\\', '/'),
      mockedYandexSdk: true,
      testDriverRequired: false,
      timewarp: false,
      browserMode: options.headed ? 'headed-offscreen' : 'headless',
      environmentBlockerExitAllowed: options.allowEnvironmentBlocker,
    },
    thresholds: {
      desktopMedianFps: 55,
      mobileMedianFps: 30,
      longFrameRatio: MAX_LONG_FRAME_RATIO,
      heapBytes: MAX_HEAP_BYTES,
      inputFeedbackP95Ms: MAX_INPUT_P95_MS,
      decodedAssetResidencyBytes: MAX_DECODED_BYTES,
    },
    build: null,
    browser: null,
    environment: null,
    assetResidency: null,
    sessions: [],
    failures: [],
  };
  await mkdir(options.evidenceDir, { recursive: true });
  let server;
  let browsers = [];
  let progressTimer;
  try {
    const build = await inspectBuild(options.buildRoot);
    evidence.build = {
      buildId: build.manifest.buildId,
      version: build.manifest.version,
      target: build.manifest.target,
      testDriver: Boolean(build.manifest.testDriver),
      sourceFingerprint: build.manifest.sourceFingerprint,
      currentSourceFingerprint: build.identity.sourceFingerprint,
      commitSha: build.manifest.commitSha,
      clean: build.manifest.clean,
      manifestSha256: build.manifestSha256,
      unpackedBytes: build.manifest.unpackedBytes,
    };
    evidence.assetResidency = build.assetManifest;
    const executablePath = process.env.INFERNO_BROWSER_PATH || await firstAvailable([
      'C:/Program Files (x86)/Google/Chrome/Application/chrome.exe',
      'C:/Program Files/Google/Chrome/Application/chrome.exe',
      `${process.env.LOCALAPPDATA || ''}/Google/Chrome/Application/chrome.exe`,
      `${process.env.LOCALAPPDATA || ''}/Yandex/YandexBrowser/Application/browser.exe`,
      '/usr/bin/google-chrome',
      '/usr/bin/chromium',
      '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome',
    ]);
    const baseUrl = `http://127.0.0.1:${options.port}`;
    server = spawn(process.execPath, ['scripts/serve.mjs', '--root', relative(gameRoot, options.buildRoot), '--port', String(options.port)], {
      cwd: gameRoot,
      stdio: ['ignore', 'pipe', 'pipe'],
    });
    let serverStderr = '';
    server.stderr.on('data', (chunk) => { serverStderr += String(chunk); });
    await waitForServer(baseUrl);
    const launchOptions = {
      executablePath,
      headless: !options.headed,
      args: [
        '--enable-precise-memory-info',
        '--disable-background-timer-throttling',
        '--disable-renderer-backgrounding',
        '--disable-backgrounding-occluded-windows',
        '--disable-features=CalculateNativeWinOcclusion',
        '--autoplay-policy=no-user-gesture-required',
        ...(options.headed ? ['--window-position=-32000,-32000', '--window-size=1280,1024'] : []),
      ],
    };
    browsers = await Promise.all(SESSION_CONFIGURATIONS.map(() => chromium.launch(launchOptions)));
    evidence.browser = { executablePath, version: await browsers[0].version(), isolatedBrowserProcesses: browsers.length };
    evidence.environment = { compositorCalibration: await calibrateCompositor(browsers[0]) };
    const wallStart = Date.now();
    console.log(`Cycle09 Yandex ${releaseEligible ? 'release soak' : 'non-release smoke'}: 4 parallel real-time sessions, ${options.durationMs}ms each, ${relative(gameRoot, options.buildRoot)}.`);
    progressTimer = setInterval(() => {
      const elapsedMs = Date.now() - wallStart;
      console.log(`Cycle09 soak progress: ${Math.floor(elapsedMs / 60_000)}m elapsed, ${Math.max(0, Math.ceil((options.durationMs - elapsedMs) / 60_000))}m nominal remaining.`);
    }, 60_000);
    const settled = await Promise.allSettled(SESSION_CONFIGURATIONS.map((configuration, index) => runSession(
      browsers[index],
      baseUrl,
      configuration,
      options.durationMs,
      releaseEligible,
    )));
    for (let index = 0; index < settled.length; index += 1) {
      const item = settled[index];
      if (item.status === 'fulfilled') evidence.sessions.push(item.value);
      else {
        const configuration = SESSION_CONFIGURATIONS[index];
        evidence.sessions.push({ ...makeSessionResult(configuration), passed: false, failures: [{ type: 'fatal', detail: item.reason?.stack || String(item.reason) }] });
      }
    }
    if (server.exitCode !== null && server.exitCode !== 0) evidence.failures.push(`Preview exited ${server.exitCode}: ${serverStderr}`);
    const failedSessions = evidence.sessions.filter((session) => !session.passed);
    if (failedSessions.length > 0) evidence.failures.push(`${failedSessions.length}/${evidence.sessions.length} browser sessions failed.`);
    const nonFpsFailures = evidence.sessions.flatMap((session) => session.failures)
      .filter((failure) => failure.type !== 'assertion' || !failure.detail.startsWith('median-fps:'));
    const calibration = evidence.environment.compositorCalibration;
    const compositorBlocked = failedSessions.length > 0
      && nonFpsFailures.length === 0
      && failedSessions.every((session) => (session.device === 'desktop'
        ? calibration.desktopThresholdProvable === false
        : calibration.mobileThresholdProvable === false));
    evidence.status = evidence.failures.length === 0
      ? releaseEligible ? 'PASS' : 'NON_RELEASE_SMOKE_PASS'
      : compositorBlocked ? releaseEligible ? 'BLOCKED_ENV' : 'NON_RELEASE_SMOKE_BLOCKED_ENV'
        : releaseEligible ? 'FAIL' : 'NON_RELEASE_SMOKE_FAIL';
  } catch (error) {
    evidence.failures.push(error.stack || error.message);
    evidence.status = releaseEligible ? 'FAIL' : 'NON_RELEASE_SMOKE_FAIL';
  } finally {
    if (progressTimer) clearInterval(progressTimer);
    await Promise.all(browsers.map((browser) => browser.close().catch(() => undefined)));
    if (server && server.exitCode === null) server.kill('SIGTERM');
    evidence.finishedAt = new Date().toISOString();
    const canonical = JSON.stringify(evidence, null, 2);
    evidence.evidenceSha256 = createHash('sha256').update(canonical).digest('hex');
    await writeFile(evidencePath, `${JSON.stringify(evidence, null, 2)}\n`, 'utf8');
    console.log(`Cycle09 Yandex soak ${evidence.status}: ${evidencePath}`);
  }
  const allowedEnvironmentBlocker = options.allowEnvironmentBlocker && evidence.status === 'BLOCKED_ENV';
  if (!['PASS', 'NON_RELEASE_SMOKE_PASS'].includes(evidence.status) && !allowedEnvironmentBlocker) process.exitCode = 1;
}

await main();
