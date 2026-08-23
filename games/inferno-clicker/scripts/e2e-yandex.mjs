import nodeAssert from 'node:assert/strict';
import { createHash, randomUUID } from 'node:crypto';
import { spawnSync } from 'node:child_process';
import { access, mkdir, open, readFile, rename } from 'node:fs/promises';
import { isAbsolute, join, resolve } from 'node:path';
import { chromium } from 'playwright-core';
import { buildIdentity, gameRoot, startVerifiedStaticServer, verifyBuildPayload } from './lib.mjs';

const requestedEvidence = process.env.INFERNO_CYCLE09_EVIDENCE_DIR;
const evidenceRoot = requestedEvidence
  ? (isAbsolute(requestedEvidence) ? requestedEvidence : resolve(gameRoot, requestedEvidence))
  : join(gameRoot, 'reports/yandex-release-cycle-09-working');
const sha256 = (bytes) => createHash('sha256').update(bytes).digest('hex');
const attemptId = randomUUID();
const traceStartedMono = performance.now();
const traceEvents = [];
let traceSequence = 0;
let activeScenarioId = 'setup';
let scenarioAssertionSequence = 0;

function traceEvent(type, data = {}, scenarioId = activeScenarioId) {
  const item = {
    sequence: ++traceSequence,
    type,
    scenarioId,
    at: new Date().toISOString(),
    monotonicMs: Number((performance.now() - traceStartedMono).toFixed(3)),
    data,
  };
  traceEvents.push(item);
  return item;
}

function assertionMessage(method, args) {
  const index = method === 'ok' ? 1 : 2;
  return typeof args[index] === 'string' ? args[index] : `${method}-${scenarioAssertionSequence + 1}`;
}

function recordedAssertion(method, args) {
  const id = `${activeScenarioId}:${String(++scenarioAssertionSequence).padStart(3, '0')}`;
  const message = assertionMessage(method, args);
  try {
    nodeAssert[method](...args);
    traceEvent('assertion', { id, method, message, status: 'PASS' });
  } catch (error) {
    traceEvent('assertion', { id, method, message, status: 'FAIL', error: error instanceof Error ? error.message : String(error) });
    throw error;
  }
}

const assert = Object.freeze({
  deepEqual: (...args) => recordedAssertion('deepEqual', args),
  doesNotMatch: (...args) => recordedAssertion('doesNotMatch', args),
  equal: (...args) => recordedAssertion('equal', args),
  match: (...args) => recordedAssertion('match', args),
  ok: (...args) => recordedAssertion('ok', args),
});

async function firstAvailable(paths) {
  for (const path of paths) {
    try { await access(path); return path; } catch { /* try next installed browser */ }
  }
  throw new Error('A supported Chromium browser executable is required for Yandex E2E.');
}

const executablePath = process.env.INFERNO_BROWSER_PATH || await firstAvailable([
  'C:/Program Files (x86)/Google/Chrome/Application/chrome.exe',
  'C:/Program Files/Google/Chrome/Application/chrome.exe',
  `${process.env.LOCALAPPDATA || ''}/Google/Chrome/Application/chrome.exe`,
  `${process.env.LOCALAPPDATA || ''}/Yandex/YandexBrowser/Application/browser.exe`,
  '/usr/bin/google-chrome',
  '/usr/bin/chromium',
  '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome',
]);
const browserId = /yandex(?:browser)?/iu.test(executablePath) ? 'yandex-browser' : 'chrome';

function browserVersion(path) {
  const result = process.platform === 'win32'
    ? spawnSync('powershell.exe', ['-NoProfile', '-Command', '(Get-Item -LiteralPath $env:INFERNO_BROWSER_FILE).VersionInfo.ProductVersion'], {
        encoding: 'utf8', timeout: 3_000, env: { ...process.env, INFERNO_BROWSER_FILE: path },
      })
    : spawnSync(path, ['--version'], { encoding: 'utf8', timeout: 3_000 });
  const value = `${result.stdout ?? ''}${result.stderr ?? ''}`.trim();
  return result.status === 0 && value ? value : 'unknown';
}

const e2eManifestBytes = await readFile(join(gameRoot, 'dist-e2e/build-manifest.json'));
const e2eManifest = JSON.parse(e2eManifestBytes.toString('utf8'));
const currentIdentity = await buildIdentity();
nodeAssert.equal(e2eManifest.commitSha, currentIdentity.commitSha, 'Instrumented E2E build commit is stale.');
nodeAssert.equal(e2eManifest.sourceFingerprint, currentIdentity.sourceFingerprint, 'Instrumented E2E build source fingerprint is stale.');
nodeAssert.equal(e2eManifest.clean, currentIdentity.clean, 'Instrumented E2E build cleanliness no longer matches the current tree.');
await verifyBuildPayload(join(gameRoot, 'dist-e2e'), e2eManifest);
const verifiedServer = await startVerifiedStaticServer(join(gameRoot, 'dist-e2e'));
const BASE_URL = verifiedServer.baseUrl;

function sdkMockSource({
  locale,
  adOutcome,
  authorized = true,
  readyOutcome = 'resolve',
  initOutcome = 'resolve',
  playerOutcome = 'resolve',
  methodOutcome = 'resolve',
  cloudReadOutcome = 'resolve',
  cloudHighestStage = 5,
  leaderboardAvailable = true,
}) {
  return `(() => {
    const listeners = new Map();
    const cloud = { infernoSaveV1: {
      schemaVersion: 1, bestScore: 12345, highestStageReached: ${cloudHighestStage},
      longestInfernoHoldMs: 30000, maxMultiplier: 2.5, runsPlayed: 4,
      tutorialFlags: { tap: true }, settings: { muted: false, reducedMotion: false, updatedAt: 10 },
      dailyRitual: { date: null, rewardClaimed: false }, updatedAt: 10
    }};
    const calls = window.__YSDK_MOCK_CALLS__ = { init: 0, ready: 0, start: 0, stop: 0, ads: 0, getPlayer: 0, getData: 0, methodAvailability: 0, setData: [], setScore: [], getEntries: 0 };
    const player = {
      isAuthorized: () => ${authorized}, getUniqueID: () => 'current-player',
      getData: async () => {
        calls.getData += 1;
        const outcome = ${JSON.stringify(cloudReadOutcome)};
        if (outcome === 'hang') return new Promise(() => {});
        if (outcome === 'error') throw new Error('mock player.getData error');
        return { ...cloud };
      },
      setData: async (data, flush) => { calls.setData.push({ data, flush, at: performance.now() }); Object.assign(cloud, data); }
    };
    const sdk = window.__YSDK_MOCK__ = {
      environment: { i18n: { lang: ${JSON.stringify(locale)} } },
      features: {
        LoadingAPI: { ready: () => {
          calls.ready += 1;
          const outcome = ${JSON.stringify(readyOutcome)};
          if (outcome === 'hang') return new Promise(() => {});
          if (outcome === 'error') return Promise.reject(new Error('mock LoadingAPI.ready error'));
          return Promise.resolve();
        } },
        GameplayAPI: { start: () => { calls.start += 1; }, stop: () => { calls.stop += 1; } }
      },
      getPlayer: async () => {
        calls.getPlayer += 1;
        const outcome = ${JSON.stringify(playerOutcome)};
        if (outcome === 'hang') return new Promise(() => {});
        if (outcome === 'error') throw new Error('mock getPlayer error');
        return player;
      },
      isAvailableMethod: async () => {
        calls.methodAvailability += 1;
        const outcome = ${JSON.stringify(methodOutcome)};
        if (outcome === 'hang') return new Promise(() => {});
        if (outcome === 'error') throw new Error('mock isAvailableMethod error');
        return ${leaderboardAvailable};
      },
      leaderboards: {
        setScore: async (name, score) => { calls.setScore.push({ name, score }); },
        getEntries: async () => { calls.getEntries += 1; return { entries: [
          { rank: 1, score: 54321, player: { publicName: 'Top Player', uniqueID: 'top-player' } },
          { rank: 2, score: 12345, player: { publicName: 'Current Player', uniqueID: 'current-player' } }
        ]}; }
      },
      adv: { showRewardedVideo: ({ callbacks }) => {
        calls.ads += 1; callbacks.onOpen?.();
        const outcome = ${JSON.stringify(adOutcome)};
        if (outcome === 'success') { callbacks.onRewarded?.(); callbacks.onClose?.(true); }
        else if (outcome === 'delayed-success') { setTimeout(() => callbacks.onRewarded?.(), 25); setTimeout(() => callbacks.onClose?.(true), 100); }
        else if (outcome === 'close') callbacks.onClose?.(true);
        else callbacks.onError?.(new Error('mock ad error'));
      }},
      on: (name, callback) => { if (!listeners.has(name)) listeners.set(name, new Set()); listeners.get(name).add(callback); },
      off: (name, callback) => listeners.get(name)?.delete(callback)
    };
    sdk.emit = (name) => { for (const callback of listeners.get(name) || []) callback(); };
    window.YaGames = { init: async () => {
      calls.init += 1;
      if (${JSON.stringify(initOutcome)} === 'reject') throw new Error('mock YaGames.init rejection');
      if (${JSON.stringify(initOutcome)} === 'hang') return new Promise(() => {});
      return sdk;
    } };
  })();`;
}

function localSave(bestScore, overrides = {}) {
  return {
    schemaVersion: 1,
    bestScore,
    highestStageReached: 3,
    longestInfernoHoldMs: 0,
    maxMultiplier: 1.5,
    runsPlayed: 2,
    tutorialFlags: { tap: true },
    settings: { muted: false, reducedMotion: false, updatedAt: 20 },
    dailyRitual: { date: null, rewardClaimed: false },
    updatedAt: 20,
    ...overrides,
  };
}

async function installSdkRoute(context, options) {
  await context.route('**/sdk.js', async (route) => {
    if (options?.failureMode === 'abort') { await route.abort('failed'); return; }
    if (options?.failureMode === 'http-error') {
      await route.fulfill({ status: 503, contentType: 'text/plain; charset=utf-8', body: 'deliberate SDK HTTP failure' });
      return;
    }
    if (options?.delayMs) await new Promise((resolve) => setTimeout(resolve, options.delayMs));
    await route.fulfill({
      status: 200,
      contentType: 'text/javascript; charset=utf-8',
      body: options && options.failureMode !== 'absent' ? sdkMockSource(options) : '/* deliberate SDK load failure */',
    });
  });
}

const aggregateCounters = { consoleErrors: 0, consoleWarnings: 0, pageErrors: 0, requestFailures: 0, httpErrors: 0 };

function collectFailures(page, options = {}) {
  const failures = [];
  Object.defineProperty(failures, 'expectedSdkFailures', { value: [], enumerable: false });
  page.on('console', (message) => {
    if (message.type() === 'error' || message.type() === 'warning') {
      if (options.expectedSdkNetworkFailure && /failed to load resource/iu.test(message.text())) {
        failures.expectedSdkFailures.push({ type: 'console', level: message.type(), text: message.text() });
        traceEvent('expected-sdk-network-failure', { type: 'console', level: message.type(), text: message.text() });
        return;
      }
      traceEvent('browser-console', { level: message.type(), text: message.text() });
      if (message.type() === 'error') aggregateCounters.consoleErrors += 1;
      else aggregateCounters.consoleWarnings += 1;
      failures.push(`console.${message.type()}: ${message.text()}`);
    }
  });
  page.on('pageerror', (error) => {
    traceEvent('page-error', { message: error.message });
    aggregateCounters.pageErrors += 1;
    failures.push(`pageerror: ${error.message}`);
  });
  page.on('requestfailed', (request) => {
    const reason = request.failure()?.errorText || '';
    // The test-only 90-second synchronous time warp can retire an imminent
    // character clip before its optional decode finishes. Real-time sessions
    // do not cross those authored clip phases within one network turn.
    if (reason.includes('ERR_ABORTED') && /\/assets\/characters\//u.test(request.url())) return;
    if (options.expectedSdkNetworkFailure && /\/sdk\.js(?:$|\?)/u.test(request.url())) {
      failures.expectedSdkFailures.push({ type: 'requestfailed', url: request.url(), reason });
      traceEvent('expected-sdk-network-failure', { type: 'requestfailed', url: request.url(), reason });
      return;
    }
    traceEvent('network-request-failed', { url: request.url(), reason });
    aggregateCounters.requestFailures += 1;
    failures.push(`requestfailed: ${request.url()} ${reason}`);
  });
  page.on('response', (response) => {
    if (response.status() < 400) return;
    if (options.expectedSdkNetworkFailure && /\/sdk\.js(?:$|\?)/u.test(response.url())) {
      failures.expectedSdkFailures.push({ type: 'http', url: response.url(), status: response.status() });
      traceEvent('expected-sdk-network-failure', { type: 'http', url: response.url(), status: response.status() });
      return;
    }
    traceEvent('network-http-error', { url: response.url(), status: response.status() });
    aggregateCounters.httpErrors += 1;
    failures.push(`http.${response.status()}: ${response.url()}`);
  });
  return failures;
}

async function readyPage(browser, options) {
  const context = await browser.newContext({
    viewport: options.viewport ?? { width: 1280, height: 720 },
    deviceScaleFactor: options.dpr ?? 1,
    locale: options.browserLocale ?? 'en-US',
  });
  if (options.disablePointerEvents) {
    await context.addInitScript(() => { Object.defineProperty(globalThis, 'PointerEvent', { value: undefined, configurable: true }); });
  }
  if (options.localSave) {
    await context.addInitScript((save) => {
      localStorage.setItem('inferno-clicker:save:v1', JSON.stringify(save));
    }, options.localSave);
  }
  await installSdkRoute(context, options.sdk);
  const page = await context.newPage();
  const failures = collectFailures(page, { expectedSdkNetworkFailure: options.expectedSdkNetworkFailure });
  const navigationStartedMs = Date.now();
  await page.goto(`${BASE_URL}/?infernoDebug=1`, { waitUntil: 'domcontentloaded' });
  await page.locator('.app-shell[data-app-state="ready"]').waitFor({ timeout: 20_000 });
  await page.locator('.boot-screen').waitFor({ state: 'detached', timeout: 20_000 });
  return { context, page, failures, readyDurationMs: Date.now() - navigationStartedMs };
}

async function exerciseNonblockingStartup(browser) {
  const context = await browser.newContext({ viewport: { width: 1280, height: 720 }, locale: 'en-US' });
  await installSdkRoute(context, { locale: 'en', adOutcome: 'success', delayMs: 750 });
  const page = await context.newPage();
  const failures = collectFailures(page);
  const requested = [];
  page.on('request', (request) => requested.push(request.url()));
  await page.goto(`${BASE_URL}/?infernoDebug=1`, { waitUntil: 'domcontentloaded' });
  await page.locator('.boot-screen').waitFor({ state: 'visible', timeout: 500 });
  const preloadNames = ['bg-fire-chamber-yandex-v3', 'core-low-v2', 'outer-low-v4'];
  const deadline = Date.now() + 700;
  while (Date.now() < deadline && !preloadNames.every((name) => requested.some((url) => url.includes(name)))) {
    await new Promise((resolve) => setTimeout(resolve, 20));
  }
  assert.equal(preloadNames.every((name) => requested.some((url) => url.includes(name))), true,
    'critical background/low-flame requests must start while the SDK loader is still pending');
  await page.locator('.app-shell[data-app-state="ready"]').waitFor({ timeout: 20_000 });
  assert.deepEqual(failures, []);
  await context.close();
}

async function exerciseHungLoadingReady(browser) {
  const { context, page, failures } = await readyPage(browser, {
    sdk: { locale: 'en', adOutcome: 'success', readyOutcome: 'hang' },
  });
  assert.equal(await page.evaluate(() => window.__YSDK_MOCK_CALLS__.ready), 1,
    'LoadingAPI.ready must be invoked once even when its promise never settles');
  const canvas = page.locator('canvas');
  const box = await canvas.boundingBox();
  if (!box) throw new Error('Gameplay canvas is missing while LoadingAPI.ready is stalled.');
  await canvas.click({ position: { x: box.width / 2, y: box.height * 0.55 } });
  await page.waitForFunction(() => window.__YSDK_MOCK_CALLS__.start === 1);
  await page.locator('.app-shell[data-app-state="playing"]').waitFor({ timeout: 1_000 });
  const before = await page.evaluate(() => window.__INFERNO_E2E__.snapshot().state.simulationTimeMs);
  await page.waitForTimeout(150);
  const after = await page.evaluate(() => window.__INFERNO_E2E__.snapshot().state.simulationTimeMs);
  assert.ok(after > before, 'core RAF and UI must continue while LoadingAPI.ready remains pending');
  assert.deepEqual(failures, []);
  await context.close();
}

async function exerciseReward(browser, outcome, locale) {
  const { context, page, failures } = await readyPage(browser, { sdk: { locale, adOutcome: outcome } });
  const expectedRussian = ['ru', 'be', 'kk', 'uk', 'uz'].includes(locale);
  assert.equal(await page.title(), expectedRussian ? 'Зажги' : 'Ignite');
  assert.equal(await page.locator('html').getAttribute('lang'), expectedRussian ? 'ru' : 'en');
  assert.match(await page.locator('.inferno-hud__score').innerText(), expectedRussian ? /12[\s ]?345/u : /12,345/u);
  assert.deepEqual(await page.evaluate(() => ({ init: window.__YSDK_MOCK_CALLS__.init, ready: window.__YSDK_MOCK_CALLS__.ready })), { init: 1, ready: 1 });

  await page.evaluate(() => { window.__INFERNO_E2E__.reachStage(3); window.__INFERNO_E2E__.settleRewardOffer(); });
  const reward = page.locator('[data-action="reward"]');
  await reward.waitFor({ state: 'visible' });
  assert.doesNotMatch(await reward.innerText(), /test|тест|получить/iu);
  await reward.click();
  await page.locator('[data-confirm]').click();
  await page.waitForFunction(() => window.__YSDK_MOCK_CALLS__.ads === 1);
  const after = await page.evaluate(() => window.__INFERNO_E2E__.snapshot());
  if (outcome === 'success') {
    assert.ok(after.state.boost?.msLeft > 59_000);
    assert.ok(after.state.sessionRewardCooldownMs > 89_000);
    await page.locator('[data-action="pause"]').click();
    await page.waitForFunction(() => window.__INFERNO_E2E__.snapshot().state.pauseReasons.includes('menu'));
    const pausedTimers = await page.evaluate(() => {
      const before = window.__INFERNO_E2E__.snapshot().state;
      window.__INFERNO_E2E__.advanceActive(5_000);
      const afterPause = window.__INFERNO_E2E__.snapshot().state;
      return {
        boostBefore: before.boost?.msLeft,
        boostAfter: afterPause.boost?.msLeft,
        cooldownBefore: before.sessionRewardCooldownMs,
        cooldownAfter: afterPause.sessionRewardCooldownMs,
      };
    });
    assert.equal(pausedTimers.boostAfter, pausedTimers.boostBefore, 'boost active time must freeze under menu pause');
    assert.equal(pausedTimers.cooldownAfter, pausedTimers.cooldownBefore, 'cooldown active time must freeze under menu pause');
    await page.locator('[data-continue]').click();
    await page.waitForFunction(() => window.__INFERNO_E2E__.snapshot().state.phase === 'PLAYING');
    const resumedTimers = await page.evaluate(() => {
      const before = window.__INFERNO_E2E__.snapshot().state;
      window.__INFERNO_E2E__.advanceActive(1_000);
      const afterResume = window.__INFERNO_E2E__.snapshot().state;
      return {
        boostDelta: before.boost.msLeft - afterResume.boost.msLeft,
        cooldownDelta: before.sessionRewardCooldownMs - afterResume.sessionRewardCooldownMs,
      };
    });
    assert.equal(resumedTimers.boostDelta, 1_000, 'boost must consume exactly resumed active time');
    assert.equal(resumedTimers.cooldownDelta, 1_000, 'cooldown must consume exactly resumed active time');
    const offer = await page.evaluate(() => {
      window.__INFERNO_E2E__.advanceActive(90_000);
      return window.__INFERNO_E2E__.settleRewardOffer(20_000);
    });
    assert.equal(offer.available, true, 'rewarded must become available after 90 active seconds');
    await reward.click();
    await page.locator('[data-confirm]').click();
    await page.waitForFunction(() => window.__YSDK_MOCK_CALLS__.ads === 2);
  } else {
    assert.equal(after.state.boost, null);
    assert.equal(after.state.sessionRewardCooldownMs, 0);
    const offer = await page.evaluate(() => window.__INFERNO_E2E__.settleRewardOffer());
    assert.equal(offer.available, true, `${outcome} must permit an immediate retry`);
  }
  assert.deepEqual(failures, []);
  await context.close();
}

async function exerciseDelayedRewardLifecycle(browser) {
  const { context, page, failures } = await readyPage(browser, { sdk: { locale: 'en', adOutcome: 'delayed-success' } });
  await page.evaluate(() => { window.__INFERNO_E2E__.reachStage(3); window.__INFERNO_E2E__.settleRewardOffer(); });
  await page.locator('[data-action="reward"]').click();
  await page.locator('[data-confirm]').click();
  await page.waitForFunction(() => window.__INFERNO_E2E__.snapshot().state.activeRewardGranted === true);
  const earnedBeforeClose = await page.evaluate(() => window.__INFERNO_E2E__.snapshot().state);
  assert.equal(earnedBeforeClose.phase, 'AD_BREAK', 'onRewarded alone must not resume gameplay before terminal close');
  assert.equal(earnedBeforeClose.boost, null, 'earned boost remains queued during the ad break');
  assert.equal(earnedBeforeClose.queuedBoost, true);
  assert.ok(earnedBeforeClose.sessionRewardCooldownMs > 89_000);
  const duringAd = await page.evaluate(() => {
    const before = window.__INFERNO_E2E__.snapshot().state.sessionRewardCooldownMs;
    window.__INFERNO_E2E__.advanceActive(5_000);
    return { before, after: window.__INFERNO_E2E__.snapshot().state.sessionRewardCooldownMs };
  });
  assert.equal(duringAd.after, duringAd.before, 'reward cooldown must freeze while the SDK ad pause is active');
  await page.waitForFunction(() => window.__INFERNO_E2E__.snapshot().state.activeRewardRequestId === null);
  const closed = await page.evaluate(() => window.__INFERNO_E2E__.snapshot().state);
  assert.equal(closed.phase, 'PLAYING');
  assert.ok(closed.boost?.msLeft > 59_000);
  await page.evaluate(() => window.dispatchEvent(new Event('blur')));
  await page.waitForFunction(() => window.__INFERNO_E2E__.snapshot().state.pauseReasons.includes('visibility'));
  const backgroundTimers = await page.evaluate(() => {
    const before = window.__INFERNO_E2E__.snapshot().state;
    window.__INFERNO_E2E__.advanceActive(5_000);
    const afterBackground = window.__INFERNO_E2E__.snapshot().state;
    return {
      boostBefore: before.boost.msLeft,
      boostAfter: afterBackground.boost.msLeft,
      cooldownBefore: before.sessionRewardCooldownMs,
      cooldownAfter: afterBackground.sessionRewardCooldownMs,
    };
  });
  assert.equal(backgroundTimers.boostAfter, backgroundTimers.boostBefore, 'boost must freeze while the page is unfocused');
  assert.equal(backgroundTimers.cooldownAfter, backgroundTimers.cooldownBefore, 'cooldown must freeze while the page is unfocused');
  await page.evaluate(() => window.dispatchEvent(new Event('focus')));
  await page.waitForFunction(() => !window.__INFERNO_E2E__.snapshot().state.pauseReasons.includes('visibility'));
  assert.deepEqual(failures, []);
  await context.close();
}

async function exerciseLifecycleCloudLeaderboard(browser) {
  const { context, page, failures } = await readyPage(browser, {
    sdk: { locale: 'en', adOutcome: 'success', cloudHighestStage: 1 },
  });
  await page.waitForFunction(() => window.__YSDK_MOCK_CALLS__.setScore.length === 1);
  assert.deepEqual(await page.evaluate(() => window.__YSDK_MOCK_CALLS__.setScore), [
    { name: 'best-score', score: 12_345 },
  ], 'authorized startup must backfill the merged local/cloud best without a user action');
  const beforeEarlyPause = await page.evaluate(() => ({ start: window.__YSDK_MOCK_CALLS__.start, stop: window.__YSDK_MOCK_CALLS__.stop }));
  await page.evaluate(() => window.__YSDK_MOCK__.emit('game_api_pause'));
  await page.waitForFunction(() => window.__INFERNO_E2E__.snapshot().state.pauseReasons.includes('platform'));
  await page.evaluate(() => window.__YSDK_MOCK__.emit('game_api_resume'));
  await page.waitForFunction(() => !window.__INFERNO_E2E__.snapshot().state.pauseReasons.includes('platform'));
  assert.deepEqual(await page.evaluate(() => ({ start: window.__YSDK_MOCK_CALLS__.start, stop: window.__YSDK_MOCK_CALLS__.stop })), beforeEarlyPause,
    'early SDK pause/resume in READY must not emit GameplayAPI markup');
  const initialCanvas = page.locator('canvas');
  const initialCanvasBox = await initialCanvas.boundingBox();
  if (!initialCanvasBox) throw new Error('Gameplay canvas is missing before the lifecycle run.');
  await initialCanvas.click({ position: { x: initialCanvasBox.width / 2, y: initialCanvasBox.height * 0.55 } });
  await page.waitForFunction(() => window.__YSDK_MOCK_CALLS__.start === 1);
  await page.evaluate(() => window.__INFERNO_E2E__.reachStage(3));
  await page.waitForFunction(() => {
    const raw = localStorage.getItem('inferno-clicker:save:v1');
    return raw && JSON.parse(raw).highestStageReached >= 3;
  });
  const liveMilestone = await page.evaluate(() => ({
    save: JSON.parse(localStorage.getItem('inferno-clicker:save:v1')),
    goal: window.__INFERNO_E2E__.snapshot().view.goals.find((item) => item.id === 'stage-3'),
    phase: window.__INFERNO_E2E__.snapshot().state.phase,
  }));
  assert.equal(liveMilestone.phase, 'PLAYING');
  assert.equal(liveMilestone.save.highestStageReached, 3,
    'an unfinished-run stage milestone must be persisted locally before results');
  assert.equal(liveMilestone.goal.completed, true,
    'the stage-3 goal must complete visibly before finishRun mutates persistent records');
  await page.waitForLoadState('networkidle');
  await page.locator('[data-action="mute"]').click();
  await page.waitForFunction(() => window.__YSDK_MOCK_CALLS__.setData.length === 1, null, { timeout: 3_000 });
  const firstCloudWrite = await page.evaluate(() => window.__YSDK_MOCK_CALLS__.setData[0]);
  await page.locator('[data-action="motion"]').click();
  await page.waitForTimeout(900);
  assert.equal(await page.evaluate(() => window.__YSDK_MOCK_CALLS__.setData.length), 1,
    'a second settings mutation inside five seconds must remain queued');
  await page.waitForFunction(() => window.__YSDK_MOCK_CALLS__.setData.length === 2, null, { timeout: 6_000 });
  const coalescedCloudWrites = await page.evaluate(() => window.__YSDK_MOCK_CALLS__.setData);
  assert.ok(coalescedCloudWrites[1].at - firstCloudWrite.at >= 4_900,
    `cloud setData cadence was ${coalescedCloudWrites[1].at - firstCloudWrite.at} ms instead of at least five seconds`);
  assert.equal(coalescedCloudWrites[1].data.infernoSaveV1.settings.muted, true);
  assert.equal(coalescedCloudWrites[1].data.infernoSaveV1.settings.reducedMotion, true,
    'the deferred cloud write must contain the latest settings snapshot');
  const before = await page.evaluate(() => ({ ...window.__YSDK_MOCK_CALLS__ }));
  await page.evaluate(() => window.__YSDK_MOCK__.emit('game_api_pause'));
  await page.waitForFunction(() => window.__INFERNO_E2E__.snapshot().state.pauseReasons.includes('platform'));
  assert.equal(await page.evaluate(() => window.__INFERNO_E2E__.snapshot().state.phase), 'PAUSED');
  assert.equal(await page.evaluate(() => window.__YSDK_MOCK_CALLS__.stop), before.stop + 1, 'SDK pause must stop gameplay exactly once');
  assert.equal(await page.evaluate(() => window.__YSDK_MOCK_CALLS__.start), before.start, 'SDK pause cannot start gameplay');
  await page.evaluate(() => window.dispatchEvent(new Event('blur')));
  await page.waitForFunction(() => window.__INFERNO_E2E__.snapshot().state.pauseReasons.includes('visibility'));
  assert.equal(await page.evaluate(() => window.__YSDK_MOCK_CALLS__.stop), before.stop + 1, 'nested visibility pause must not duplicate GameplayAPI.stop');
  await page.evaluate(() => window.__YSDK_MOCK__.emit('game_api_resume'));
  await page.waitForFunction(() => !window.__INFERNO_E2E__.snapshot().state.pauseReasons.includes('platform'));
  assert.equal(await page.evaluate(() => window.__INFERNO_E2E__.snapshot().state.pauseReasons.includes('visibility')), true);
  assert.equal(await page.evaluate(() => window.__YSDK_MOCK_CALLS__.start), before.start, 'platform resume cannot clear a nested visibility pause');
  await page.evaluate(() => window.dispatchEvent(new Event('focus')));
  await page.waitForFunction(() => !window.__INFERNO_E2E__.snapshot().state.pauseReasons.includes('visibility'));
  assert.equal(await page.evaluate(() => window.__YSDK_MOCK_CALLS__.start), before.start + 1, 'final nested resume must start gameplay exactly once');
  assert.equal(await page.evaluate(() => window.__YSDK_MOCK_CALLS__.stop), before.stop + 1, 'nested lifecycle must stop gameplay exactly once');

  const beforeEnd = await page.evaluate(() => ({ ...window.__YSDK_MOCK_CALLS__ }));
  assert.equal(await page.evaluate(() => window.__INFERNO_E2E__.endRun()), true);
  await page.locator('[data-leaderboard]').waitFor({ state: 'visible' });
  assert.equal(await page.evaluate((value) => window.__YSDK_MOCK_CALLS__.stop, beforeEnd.stop), beforeEnd.stop + 1, 'run end must stop gameplay exactly once');
  await page.waitForFunction(() => window.__YSDK_MOCK_CALLS__.setData.some((item) => item.flush === true), null, { timeout: 10_000 });
  const writes = await page.evaluate(() => window.__YSDK_MOCK_CALLS__.setData);
  assert.ok(writes.some((item) => item.flush === true), 'final cloud write must use flush=true');
  assert.ok(writes.length <= 3, `cloud save burst was not coalesced: ${writes.length}`);
  assert.equal(await page.evaluate(() => window.__YSDK_MOCK_CALLS__.setScore.length), 1,
    'run-end submission must deduplicate an already backfilled unchanged best');
  await page.locator('[data-leaderboard]').click();
  await page.locator('[data-entries] li').first().waitFor();
  assert.match(await page.locator('[data-entries]').innerText(), /Top Player.*54,321/su);
  assert.equal(await page.evaluate(() => window.__YSDK_MOCK_CALLS__.getEntries), 1);
  await page.locator('[data-back-results]').click();
  const startsBeforeRestart = await page.evaluate(() => window.__YSDK_MOCK_CALLS__.start);
  await page.locator('[data-restart]').click();
  await page.waitForFunction(() => window.__INFERNO_E2E__.snapshot().state.phase === 'READY');
  assert.equal(await page.evaluate(() => window.__YSDK_MOCK_CALLS__.start), startsBeforeRestart, 'restart remains READY and must not start gameplay');
  const canvas = page.locator('canvas');
  const canvasBox = await canvas.boundingBox();
  if (!canvasBox) throw new Error('Gameplay canvas is missing after restart.');
  await canvas.click({ position: { x: canvasBox.width / 2, y: Math.min(canvasBox.height - 1, canvasBox.height * 0.55) } });
  await page.waitForFunction((expected) => window.__YSDK_MOCK_CALLS__.start === expected + 1, startsBeforeRestart);
  assert.equal(await page.evaluate(() => window.__YSDK_MOCK_CALLS__.start), startsBeforeRestart + 1, 'first post-restart gameplay tap starts exactly once');
  assert.deepEqual(failures, []);
  await context.close();
}

async function exerciseCloudMergeGuestAvailability(browser) {
  const authorized = await readyPage(browser, {
    sdk: { locale: 'en', adOutcome: 'success', authorized: true },
    localSave: localSave(22_222),
  });
  await authorized.page.waitForFunction(() => window.__YSDK_MOCK_CALLS__.setScore.length === 1);
  const authorizedState = await authorized.page.evaluate(() => ({
    calls: window.__YSDK_MOCK_CALLS__,
    diagnostics: window.__INFERNO_DIAGNOSTICS__(),
  }));
  assert.deepEqual(authorizedState.calls.setScore, [{ name: 'best-score', score: 22_222 }],
    'local/cloud merge must backfill the maximum Best Score');
  assert.equal(authorizedState.diagnostics.state.bestScore, 22_222);
  assert.equal(authorizedState.diagnostics.state.records.highestStageReached, 5,
    'cloud maximum stage must survive a higher local Best Score');
  await authorized.page.waitForFunction(() => window.__YSDK_MOCK_CALLS__.setData.length >= 1);
  const mergedWrite = await authorized.page.evaluate(() => window.__YSDK_MOCK_CALLS__.setData[0].data.infernoSaveV1);
  assert.equal(mergedWrite.bestScore, 22_222);
  assert.equal(mergedWrite.highestStageReached, 5);
  assert.deepEqual(authorized.failures, []);
  await authorized.context.close();

  const guest = await readyPage(browser, {
    sdk: { locale: 'en', adOutcome: 'success', authorized: false, leaderboardAvailable: false },
    localSave: localSave(33_333, { highestStageReached: 6 }),
  });
  const guestState = await guest.page.evaluate(() => ({
    calls: window.__YSDK_MOCK_CALLS__,
    diagnostics: window.__INFERNO_DIAGNOSTICS__(),
  }));
  assert.equal(guestState.diagnostics.platform.authorized, false);
  assert.equal(guestState.diagnostics.platform.leaderboardWrite, false);
  assert.equal(guestState.diagnostics.state.bestScore, 33_333);
  assert.equal(guestState.calls.setData.length, 0, 'guest must never write cloud data');
  assert.equal(guestState.calls.setScore.length, 0, 'guest/unavailable leaderboard must not prompt or submit');
  assert.deepEqual(guest.failures, []);
  await guest.context.close();
}

async function exerciseFallbackMultitouch(browser) {
  const { context, page, failures } = await readyPage(browser, {
    sdk: { locale: 'en', adOutcome: 'success' },
    viewport: { width: 390, height: 844 },
    dpr: 2,
    disablePointerEvents: true,
  });
  const dispatch = async (type, identifiers) => page.locator('canvas').evaluate((canvas, payload) => {
    const rect = canvas.getBoundingClientRect();
    const contacts = payload.identifiers.map((identifier, index) => ({
      identifier,
      clientX: rect.left + rect.width / 2 + index * 2,
      clientY: rect.top + rect.height * 0.48,
    }));
    const event = new Event(payload.type, { bubbles: true, cancelable: true });
    Object.defineProperty(event, 'changedTouches', { value: contacts });
    Object.defineProperty(event, 'touches', { value: payload.type === 'touchend' ? [] : contacts });
    canvas.dispatchEvent(event);
  }, { type, identifiers });
  await dispatch('touchstart', [11, 12]);
  await page.waitForFunction(() => window.__INFERNO_E2E__.snapshot().state.score >= 2);
  const afterDistinct = await page.evaluate(() => window.__INFERNO_E2E__.snapshot().state.score);
  await dispatch('touchstart', [11, 12]);
  await page.waitForTimeout(120);
  assert.equal(await page.evaluate(() => window.__INFERNO_E2E__.snapshot().state.score), afterDistinct, 'duplicate fallback contacts must be deduplicated');
  await dispatch('touchend', [11, 12]);
  await dispatch('touchstart', [11]);
  await page.waitForFunction((score) => window.__INFERNO_E2E__.snapshot().state.score > score, afterDistinct);
  assert.equal(await page.evaluate(() => window.__YSDK_MOCK_CALLS__.start), 1, 'fallback touch gesture starts gameplay once');
  await dispatch('touchend', [11]);

  const beforeLongTouch = await page.evaluate(() => window.__INFERNO_E2E__.snapshot().state.score);
  await dispatch('touchstart', [21]);
  await page.waitForFunction((score) => window.__INFERNO_E2E__.snapshot().state.score > score, beforeLongTouch);
  const afterLongTouch = await page.evaluate(() => window.__INFERNO_E2E__.snapshot().state.score);
  await page.waitForTimeout(850);
  await dispatch('touchend', [21]);
  await page.locator('canvas').evaluate((canvas) => {
    const rect = canvas.getBoundingClientRect();
    canvas.dispatchEvent(new MouseEvent('mousedown', {
      bubbles: true,
      cancelable: true,
      button: 0,
      clientX: rect.left + rect.width / 2,
      clientY: rect.top + rect.height * 0.48,
    }));
  });
  await page.waitForTimeout(150);
  assert.equal(await page.evaluate(() => window.__INFERNO_E2E__.snapshot().state.score), afterLongTouch,
    'a synthetic mousedown after a >800ms fallback touch must not create a duplicate gameplay tap');
  assert.deepEqual(failures, []);
  await context.close();
}

async function assertFirstGameplayTap(page, label) {
  const before = await page.evaluate(() => {
    const state = window.__INFERNO_E2E__.snapshot().state;
    return { score: state.score, simulationTimeMs: state.simulationTimeMs };
  });
  const canvas = page.locator('canvas');
  const box = await canvas.boundingBox();
  if (!box) throw new Error(`${label}: gameplay canvas is missing.`);
  await canvas.click({ position: { x: box.width / 2, y: box.height * 0.55 } });
  await page.locator('.app-shell[data-app-state="playing"]').waitFor({ timeout: 1_000 });
  await page.waitForFunction((score) => window.__INFERNO_E2E__.snapshot().state.score > score, before.score);
  const after = await page.evaluate(() => {
    const state = window.__INFERNO_E2E__.snapshot().state;
    return { score: state.score, simulationTimeMs: state.simulationTimeMs };
  });
  assert.ok(after.score > before.score, `${label}: the first gameplay tap must be accepted.`);
  assert.ok(after.simulationTimeMs >= before.simulationTimeMs, `${label}: simulation time must remain monotonic after input.`);
}

async function exerciseSdkFailure(browser) {
  const { context, page, failures, readyDurationMs } = await readyPage(browser, { sdk: null, viewport: { width: 390, height: 844 }, dpr: 3 });
  assert.equal(await page.title(), 'Ignite');
  assert.equal(await page.locator('[data-action="reward"]').isHidden(), true);
  const diagnostics = await page.evaluate(() => window.__INFERNO_DIAGNOSTICS__());
  assert.ok(readyDurationMs <= 6_000, 'missing YaGames global must reach interactive local-only play within the bootstrap allowance');
  assert.equal(diagnostics.platform.rewardedAds, false);
  assert.equal(diagnostics.platform.degradedFrom, 'yandex');
  assert.doesNotMatch(await page.locator('body').innerText(), /test provider|тестов|получить ×2/iu);
  await assertFirstGameplayTap(page, 'missing YaGames global local fallback');
  assert.deepEqual(failures, []);
  await context.close();
}

async function exerciseRemoteBootstrapDeadline(browser, failureMode) {
  const outcomes = {
    init: { initOutcome: 'hang' },
    player: { playerOutcome: 'hang' },
    method: { methodOutcome: 'hang' },
    cloud: { cloudReadOutcome: 'hang' },
  };
  const { context, page, failures, readyDurationMs } = await readyPage(browser, {
    sdk: { locale: 'en', adOutcome: 'success', ...outcomes[failureMode] },
    localSave: localSave(7_777),
  });
  const values = await page.evaluate(() => ({
    diagnostics: window.__INFERNO_DIAGNOSTICS__(),
    calls: window.__YSDK_MOCK_CALLS__,
  }));
  assert.ok(readyDurationMs <= 6_000,
    `${failureMode} hang must not extend the absolute five-second remote bootstrap window`);
  assert.equal(values.diagnostics.state.records.bestScore, 7_777,
    `${failureMode} hang must preserve and load the local record before play`);
  if (failureMode === 'init') {
    assert.equal(values.diagnostics.platform.degradedFrom, 'yandex');
    assert.equal(values.diagnostics.platform.rewardedAds, false);
  } else {
    assert.equal(values.diagnostics.platform.platform, 'yandex');
    assert.equal(values.diagnostics.platform.degradedFrom, undefined);
  }
  if (failureMode === 'player') assert.equal(values.diagnostics.platform.cloudSave, false);
  if (failureMode === 'method') {
    assert.equal(values.diagnostics.platform.leaderboardRead, false);
    assert.equal(values.diagnostics.platform.leaderboardWrite, false);
  }
  if (failureMode === 'cloud') assert.equal(values.calls.getData, 1);
  await assertFirstGameplayTap(page, `${failureMode} remote bootstrap fallback`);
  assert.deepEqual(failures, []);
  await context.close();
}

async function exerciseSdkLoaderFailure(browser, failureMode) {
  const networkFailure = ['abort', 'http-error'].includes(failureMode);
  const sdk = failureMode === 'init-reject'
    ? { locale: 'en', adOutcome: 'success', initOutcome: 'reject' }
    : failureMode === 'load-timeout'
      ? { locale: 'en', adOutcome: 'success', delayMs: 7_500 }
      : { locale: 'en', adOutcome: 'success', failureMode };
  const { context, page, failures, readyDurationMs } = await readyPage(browser, {
    sdk,
    expectedSdkNetworkFailure: networkFailure,
    viewport: { width: 390, height: 844 },
    dpr: 2,
  });
  const diagnostics = await page.evaluate(() => window.__INFERNO_DIAGNOSTICS__());
  assert.ok(readyDurationMs <= 6_000, `${failureMode} must reach interactive local-only play within the absolute bootstrap deadline allowance`);
  assert.equal(diagnostics.platform.degradedFrom, 'yandex', `${failureMode} must degrade to the local Web adapter`);
  assert.equal(diagnostics.platform.rewardedAds, false);
  assert.equal(await page.locator('[data-action="reward"]').isHidden(), true);
  if (networkFailure) {
    assert.ok(failures.expectedSdkFailures.length >= 1, `${failureMode} must record an expected SDK loader failure`);
  }
  await assertFirstGameplayTap(page, `${failureMode} SDK loader fallback`);
  assert.deepEqual(failures, []);
  await context.close();
}

async function exerciseLoadingReadyRejection(browser) {
  const { context, page, failures } = await readyPage(browser, {
    sdk: { locale: 'en', adOutcome: 'success', readyOutcome: 'error' },
  });
  const values = await page.evaluate(() => ({
    calls: window.__YSDK_MOCK_CALLS__,
    diagnostics: window.__INFERNO_DIAGNOSTICS__(),
  }));
  assert.equal(values.calls.ready, 1, 'a rejected LoadingAPI.ready call remains at-most-once');
  assert.ok(values.diagnostics.platform.degradedFrom == null, 'LoadingAPI.ready rejection must not replace an initialized SDK adapter');
  assert.equal(values.diagnostics.platformDiagnostics.some((item) => item.type === 'loading_ready_failed'), true);
  const canvas = page.locator('canvas');
  const box = await canvas.boundingBox();
  if (!box) throw new Error('Gameplay canvas is missing after LoadingAPI.ready rejection.');
  await canvas.click({ position: { x: box.width / 2, y: box.height * 0.55 } });
  await page.waitForFunction(() => window.__YSDK_MOCK_CALLS__.start === 1);
  assert.deepEqual(failures, []);
  await context.close();
}

async function exerciseToastRewardSeparation(browser) {
  const { context, page, failures } = await readyPage(browser, {
    sdk: { locale: 'ru', adOutcome: 'success' },
    viewport: { width: 390, height: 844 },
    dpr: 3,
  });
  await page.evaluate(() => {
    window.__INFERNO_E2E__.reachStage(3);
    window.__INFERNO_E2E__.settleRewardOffer();
  });
  const reward = page.locator('[data-action="reward"]');
  await reward.waitFor({ state: 'visible' });
  await page.evaluate(() => window.__INFERNO_E2E__.reachStage(7));
  await page.locator('[data-toast]').waitFor({ state: 'visible' });
  assert.equal(await reward.evaluate((element) => getComputedStyle(element).visibility), 'hidden',
    'a transient status toast must suppress the rewarded placard instead of overlapping it');
  await page.locator('[data-toast]').waitFor({ state: 'hidden', timeout: 5_000 });
  await reward.waitFor({ state: 'visible' });
  assert.deepEqual(failures, []);
  await context.close();
}

async function assertViewportFit(page, label) {
  const result = await page.evaluate(() => {
    const shell = document.querySelector('.app-shell');
    const canvas = document.querySelector('canvas');
    if (!(shell instanceof HTMLElement) || !(canvas instanceof HTMLCanvasElement)) {
      throw new Error('Responsive shell/canvas is missing.');
    }
    const shellRect = shell.getBoundingClientRect();
    const canvasRect = canvas.getBoundingClientRect();
    return {
      viewport: { width: innerWidth, height: innerHeight },
      document: {
        width: document.documentElement.scrollWidth,
        height: document.documentElement.scrollHeight,
      },
      shell: { left: shellRect.left, top: shellRect.top, right: shellRect.right, bottom: shellRect.bottom },
      canvas: { left: canvasRect.left, top: canvasRect.top, right: canvasRect.right, bottom: canvasRect.bottom },
    };
  });
  const tolerance = 1.5;
  assert.ok(result.document.width <= result.viewport.width + tolerance, `${label}: horizontal page overflow`);
  assert.ok(result.document.height <= result.viewport.height + tolerance, `${label}: vertical page overflow`);
  for (const [name, rect] of [['shell', result.shell], ['canvas', result.canvas]]) {
    assert.ok(rect.left >= -tolerance && rect.top >= -tolerance, `${label}: ${name} starts outside viewport`);
    assert.ok(rect.right <= result.viewport.width + tolerance, `${label}: ${name} exceeds viewport width`);
    assert.ok(rect.bottom <= result.viewport.height + tolerance, `${label}: ${name} exceeds viewport height`);
  }
}

async function exerciseResponsiveMatrix(browser) {
  const { context, page, failures } = await readyPage(browser, {
    sdk: { locale: 'en', adOutcome: 'success' },
    viewport: { width: 1280, height: 1024 },
  });
  const desktopMatrix = [
    { label: '1280x1024 @100%', width: 1280, height: 1024 },
    { label: '1280x1024 @125%', width: 1024, height: 819 },
    { label: '1280x1024 @80%', width: 1600, height: 1280 },
    { label: '1920x1080 @100%', width: 1920, height: 1080 },
    { label: '3840x2160 @100%', width: 3840, height: 2160 },
    { label: '3840x1080 ultrawide', width: 3840, height: 1080 },
  ];
  for (const item of desktopMatrix) {
    await page.setViewportSize({ width: item.width, height: item.height });
    await page.evaluate(() => new Promise((resolve) => requestAnimationFrame(() => requestAnimationFrame(resolve))));
    await assertViewportFit(page, item.label);
  }
  const sideFillWidth = await page.evaluate(() => Number.parseFloat(getComputedStyle(document.querySelector('.app-shell'), '::before').width));
  assert.ok(sideFillWidth > 0, 'ultrawide must render authored side fill');

  await page.setViewportSize({ width: 844, height: 390 });
  await page.locator('[data-action="goals"]').click();
  const goalsDialog = page.locator('.dialog--goals');
  await goalsDialog.waitFor({ state: 'visible' });
  const dialogFit = await page.evaluate(() => {
    const dialog = document.querySelector('.dialog--goals');
    const list = document.querySelector('.goals-list');
    if (!(dialog instanceof HTMLElement) || !(list instanceof HTMLElement)) throw new Error('Goals dialog is missing.');
    const rect = dialog.getBoundingClientRect();
    return {
      rect: { left: rect.left, top: rect.top, right: rect.right, bottom: rect.bottom },
      viewport: { width: innerWidth, height: innerHeight },
      backdropOverflow: getComputedStyle(dialog.parentElement).overflow,
      listOverflow: getComputedStyle(list).overflowY,
    };
  });
  assert.ok(dialogFit.rect.left >= 0 && dialogFit.rect.top >= 0
    && dialogFit.rect.right <= dialogFit.viewport.width && dialogFit.rect.bottom <= dialogFit.viewport.height,
  'goals dialog must fit a short landscape viewport');
  assert.equal(dialogFit.backdropOverflow, 'hidden', 'only the goals list may scroll');
  assert.equal(dialogFit.listOverflow, 'auto', 'goals list must own its overflow');
  const shortLandscapeTargets = await page.locator('button:visible').evaluateAll((buttons) => buttons.map((button) => {
    const rect = button.getBoundingClientRect();
    return { width: rect.width, height: rect.height, label: button.textContent };
  }));
  assert.ok(shortLandscapeTargets.every((target) => target.width >= 48 && target.height >= 48),
    `844x390 has undersized touch targets: ${JSON.stringify(shortLandscapeTargets)}`);
  await assertViewportFit(page, '844x390 goals dialog');
  await page.locator('[data-back]').click();
  await page.locator('[data-how]').click();
  await page.locator('.dialog--scroll').waitFor({ state: 'visible' });
  await assertViewportFit(page, '844x390 how-to dialog');
  const howRect = await page.locator('.dialog--scroll').boundingBox();
  assert.ok(howRect && howRect.y >= 0 && howRect.y + howRect.height <= 390, 'how-to dialog must fit short landscape');
  assert.equal(await page.locator('.dialog--scroll').evaluate((element) => getComputedStyle(element).overflow), 'hidden', 'how-to dialog must not scroll');
  await page.locator('[data-back]').click();
  await page.locator('[data-continue]').click();
  assert.equal(await page.evaluate(() => window.__YSDK_MOCK_CALLS__.start), 0,
    'READY → goals/how-to → continue must not call GameplayAPI.start before a gameplay tap');

  await page.setViewportSize({ width: 390, height: 844 });
  await page.evaluate(() => new Promise((resolve) => requestAnimationFrame(() => requestAnimationFrame(resolve))));
  await assertViewportFit(page, '390x844 after rotation');
  assert.deepEqual(failures, []);
  await context.close();
}

async function withTimeout(promise, timeoutMs, label) {
  let timer;
  try {
    return await Promise.race([
      promise,
      new Promise((_, reject) => { timer = setTimeout(() => reject(new Error(`${label} timed out after ${timeoutMs} ms.`)), timeoutMs); }),
    ]);
  } finally {
    clearTimeout(timer);
  }
}

async function atomicWrite(path, bytes) {
  const temporary = `${path}.tmp-${attemptId}`;
  const handle = await open(temporary, 'wx');
  try {
    await handle.writeFile(bytes);
    await handle.sync();
  } finally {
    await handle.close();
  }
  await rename(temporary, path);
}

let browser;
try {
  const runStartedAt = new Date().toISOString();
  const runStartedMs = Date.now();
  assert.equal(e2eManifest.target, 'yandex');
  assert.equal(e2eManifest.testDriver, true);
  browser = await chromium.launch({ executablePath, headless: true, args: ['--disable-gpu-sandbox'] });
  const scenarioDefinitions = [
    ['nonblocking-startup', () => exerciseNonblockingStartup(browser)],
    ['loading-ready-timeout', () => exerciseHungLoadingReady(browser)],
    ['reward-success-ru', () => exerciseReward(browser, 'success', 'ru')],
    ['reward-close-en', () => exerciseReward(browser, 'close', 'en')],
    ['reward-error-ru-fallback', () => exerciseReward(browser, 'error', 'kk')],
    ['reward-delayed-lifecycle', () => exerciseDelayedRewardLifecycle(browser)],
    ['cloud-leaderboard-lifecycle', () => exerciseLifecycleCloudLeaderboard(browser)],
    ['cloud-merge-guest-unavailable', () => exerciseCloudMergeGuestAvailability(browser)],
    ['fallback-long-touch-multitouch', () => exerciseFallbackMultitouch(browser)],
    ['sdk-failure-local-only', () => exerciseSdkFailure(browser)],
    ['sdk-route-abort-local-only', () => exerciseSdkLoaderFailure(browser, 'abort')],
    ['sdk-http-error-local-only', () => exerciseSdkLoaderFailure(browser, 'http-error')],
    ['sdk-load-timeout-local-only', () => exerciseSdkLoaderFailure(browser, 'load-timeout')],
    ['sdk-init-reject-local-only', () => exerciseSdkLoaderFailure(browser, 'init-reject')],
    ['sdk-init-timeout-local-only', () => exerciseRemoteBootstrapDeadline(browser, 'init')],
    ['sdk-player-timeout-local-save', () => exerciseRemoteBootstrapDeadline(browser, 'player')],
    ['sdk-method-timeout-local-save', () => exerciseRemoteBootstrapDeadline(browser, 'method')],
    ['sdk-cloud-read-timeout-local-save', () => exerciseRemoteBootstrapDeadline(browser, 'cloud')],
    ['loading-ready-rejection-nonblocking', () => exerciseLoadingReadyRejection(browser)],
    ['toast-reward-separation', () => exerciseToastRewardSeparation(browser)],
    ['responsive-desktop-mobile-rotation', () => exerciseResponsiveMatrix(browser)],
  ];
  const scenarioResults = [];
  for (const [id, action] of scenarioDefinitions) {
    activeScenarioId = id;
    scenarioAssertionSequence = 0;
    const startedAt = new Date().toISOString();
    const startedMs = Date.now();
    traceEvent('scenario-start', { attemptId });
    await withTimeout(action(), 45_000, id);
    traceEvent('scenario-complete', { status: 'PASS' });
    const completedAt = new Date().toISOString();
    const assertions = traceEvents
      .filter((item) => item.scenarioId === id && item.type === 'assertion')
      .map((item) => ({ id: item.data.id, status: item.data.status, at: item.at, method: item.data.method, message: item.data.message }));
    nodeAssert.ok(assertions.length > 0, `${id} did not record any assertions`);
    scenarioResults.push({ id, status: 'PASS', startedAt, completedAt, durationMs: Math.max(1, Date.now() - startedMs), assertions });
  }
  activeScenarioId = 'report';
  const scenarios = scenarioResults.map((item) => item.id);
  const completedAt = new Date().toISOString();
  const durationMs = Math.max(1, Date.now() - runStartedMs);
  const detectedBrowserVersion = browserVersion(executablePath);
  const responsiveMatrix = {
    desktop: ['1280x1024@80', '1280x1024@100', '1280x1024@125', '1920x1080', '3840x2160', '3840x1080-ultrawide'],
    mobile: ['844x390-short-landscape', '390x844-portrait', 'rotation'],
  };
  const build = {
    buildId: e2eManifest.buildId,
    commitSha: e2eManifest.commitSha,
    sourceFingerprint: e2eManifest.sourceFingerprint,
    clean: e2eManifest.clean,
    buildManifestSha256: sha256(e2eManifestBytes),
    target: e2eManifest.target,
    testDriver: e2eManifest.testDriver,
  };
  const counters = {
    consoleErrors: aggregateCounters.consoleErrors,
    consoleWarnings: aggregateCounters.consoleWarnings,
    pageErrors: aggregateCounters.pageErrors,
    requestFailures: aggregateCounters.requestFailures,
    httpErrors: aggregateCounters.httpErrors,
    unexpectedNetworkFailures: aggregateCounters.requestFailures + aggregateCounters.httpErrors,
  };
  const traceName = `browser-e2e-${browserId}-trace.json`;
  const traceBytes = Buffer.from(`${JSON.stringify({
    schemaVersion: 1,
    kind: 'mocked-browser-run-trace',
    cycle: '09',
    attemptId,
    browser: { id: browserId, version: detectedBrowserVersion },
    build,
    startedAt: runStartedAt,
    completedAt,
    durationMs,
    scenarioResults,
    responsiveMatrix,
    events: traceEvents,
    counters,
  }, null, 2)}\n`);
  await mkdir(evidenceRoot, { recursive: true });
  await atomicWrite(join(evidenceRoot, traceName), traceBytes);
  const report = {
    schemaVersion: 1,
    kind: 'mocked-browser-run',
    status: 'PASS',
    cycle: '09',
    attemptId,
    browser: {
      id: browserId,
      executablePath: executablePath.replaceAll('\\', '/'),
      version: detectedBrowserVersion,
      engine: 'chromium',
      headless: true,
    },
    build,
    startedAt: runStartedAt,
    completedAt,
    durationMs,
    scenarios,
    scenarioResults,
    responsiveMatrix,
    rawTrace: { path: traceName, bytes: traceBytes.length, sha256: sha256(traceBytes) },
    checks: {
      sdkLifecycle: scenarios.includes('cloud-leaderboard-lifecycle'),
      localeRuEn: scenarios.includes('reward-success-ru') && scenarios.includes('reward-close-en'),
      pointerAndTouchFallback: scenarios.includes('fallback-long-touch-multitouch'),
      responsiveAndRotation: scenarios.includes('responsive-desktop-mobile-rotation'),
      cloudSave: scenarios.includes('cloud-leaderboard-lifecycle'),
      leaderboard: scenarios.includes('cloud-leaderboard-lifecycle'),
      rewardedTerminalMatrix: ['reward-success-ru', 'reward-close-en', 'reward-error-ru-fallback', 'reward-delayed-lifecycle']
        .every((id) => scenarios.includes(id)),
      loaderFailureMatrix: ['sdk-route-abort-local-only', 'sdk-http-error-local-only', 'sdk-load-timeout-local-only', 'sdk-init-reject-local-only',
        'sdk-init-timeout-local-only', 'sdk-player-timeout-local-save', 'sdk-method-timeout-local-save',
        'sdk-cloud-read-timeout-local-save', 'loading-ready-rejection-nonblocking']
        .every((id) => scenarios.includes(id)),
      consoleAndNetworkClean: Object.values(counters).every((value) => value === 0),
    },
    ...counters,
  };
  await atomicWrite(join(evidenceRoot, `browser-e2e-${browserId}.json`), Buffer.from(`${JSON.stringify(report, null, 2)}\n`));
  console.log('Yandex mocked browser E2E PASS (event-traced nonblocking boot, full SDK loader/init/ready failure matrix, RU/EN, exact lifecycle, cloud, leaderboard, rewarded terminal matrix/repeat, touch fallback and responsive layout)');
} finally {
  await browser?.close();
  await verifiedServer.stop();
}
