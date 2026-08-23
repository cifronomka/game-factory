import assert from 'node:assert/strict';
import { createHash, randomUUID } from 'node:crypto';
import { spawnSync } from 'node:child_process';
import { access, mkdir, open, rename } from 'node:fs/promises';
import { isAbsolute, join, resolve } from 'node:path';
import { chromium } from 'playwright-core';
import { buildIdentity, gameRoot, startVerifiedStaticServer, verifyBuildPayload } from './lib.mjs';

const requestedEvidence = process.env.INFERNO_CYCLE09_EVIDENCE_DIR;
const evidenceRoot = requestedEvidence
  ? (isAbsolute(requestedEvidence) ? requestedEvidence : resolve(gameRoot, requestedEvidence))
  : join(gameRoot, 'reports/yandex-release-cycle-09-working');
const sha256 = (bytes) => createHash('sha256').update(bytes).digest('hex');
const attemptId = randomUUID();
const runStartedAt = new Date().toISOString();
const runStartedMs = Date.now();
const runStartedMono = performance.now();
const traceEvents = [];
let sequence = 0;

function event(type, scenarioId, data = {}) {
  const item = {
    sequence: ++sequence,
    type,
    scenarioId,
    at: new Date().toISOString(),
    monotonicMs: Number((performance.now() - runStartedMono).toFixed(3)),
    data,
  };
  traceEvents.push(item);
  return item;
}

async function firstAvailable(paths) {
  for (const path of paths.filter(Boolean)) {
    try { await access(path); return path; } catch { /* try next installed browser */ }
  }
  throw new Error('Google Chrome (or an explicit supported Chromium executable) is required for the production browser smoke.');
}

const executablePath = process.env.INFERNO_BROWSER_PATH || await firstAvailable([
  'C:/Program Files (x86)/Google/Chrome/Application/chrome.exe',
  'C:/Program Files/Google/Chrome/Application/chrome.exe',
  `${process.env.LOCALAPPDATA || ''}/Google/Chrome/Application/chrome.exe`,
  '/usr/bin/google-chrome',
  '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome',
]);
const inferredBrowserId = /yandex(?:browser)?/iu.test(executablePath)
  ? 'yandex-browser'
  : /opera|launcher\.exe/iu.test(executablePath) ? 'opera' : 'chrome';
const browserId = process.env.INFERNO_BROWSER_ID || inferredBrowserId;
if (!['chrome', 'yandex-browser', 'opera'].includes(browserId)) {
  throw new Error(`Unsupported production smoke browser ID: ${browserId}`);
}

function browserFileVersion(path) {
  const result = process.platform === 'win32'
    ? spawnSync('powershell.exe', ['-NoProfile', '-Command', '(Get-Item -LiteralPath $env:INFERNO_BROWSER_FILE).VersionInfo.ProductVersion'], {
        encoding: 'utf8', timeout: 3_000, env: { ...process.env, INFERNO_BROWSER_FILE: path },
      })
    : spawnSync(path, ['--version'], { encoding: 'utf8', timeout: 3_000 });
  const value = `${result.stdout ?? ''}${result.stderr ?? ''}`.trim();
  if (result.status !== 0 || !value) throw new Error(`Unable to resolve browser version for ${path}.`);
  return value;
}

function verifyBrowserIdentity(id, userAgent) {
  const matches = id === 'chrome'
    ? /Chrome\//u.test(userAgent) && !/(?:YaBrowser|OPR|Edg)\//u.test(userAgent)
    : id === 'yandex-browser' ? /YaBrowser\//u.test(userAgent) : /OPR\//u.test(userAgent);
  assert.equal(matches, true, `${id} producer does not match observed UA: ${userAgent}`);
}

const releaseManifestPath = join(gameRoot, 'dist/build-manifest.json');
const releaseManifestBytes = await (await import('node:fs/promises')).readFile(releaseManifestPath);
const releaseManifest = JSON.parse(releaseManifestBytes.toString('utf8'));
const currentIdentity = await buildIdentity();
assert.equal(releaseManifest.version, '1.0.0');
assert.equal(releaseManifest.target, 'yandex');
assert.equal(releaseManifest.testDriver, false, 'production smoke must execute the non-instrumented dist bundle');
assert.equal(releaseManifest.commitSha, currentIdentity.commitSha, 'Production smoke build commit is stale.');
assert.equal(releaseManifest.sourceFingerprint, currentIdentity.sourceFingerprint, 'Production smoke build source fingerprint is stale.');
assert.equal(releaseManifest.clean, currentIdentity.clean, 'Production smoke build cleanliness no longer matches the current tree.');
await verifyBuildPayload(join(gameRoot, 'dist'), releaseManifest);

const verifiedServer = await startVerifiedStaticServer(join(gameRoot, 'dist'));
const baseUrl = verifiedServer.baseUrl;
const aggregateCounters = {
  consoleErrors: 0,
  consoleWarnings: 0,
  pageErrors: 0,
  requestFailures: 0,
  httpErrors: 0,
  unexpectedNetworkFailures: 0,
};
const viewportSamples = [];

function sdkSource(locale) {
  return `(() => {
    const listeners = new Map();
    const calls = window.__PRODUCTION_SMOKE_SDK_CALLS__ = {
      init: 0, ready: 0, start: 0, stop: 0, setData: 0, setScore: 0
    };
    const player = {
      isAuthorized: () => false,
      getUniqueID: () => '',
      getData: async () => ({}),
      setData: async () => { calls.setData += 1; }
    };
    const sdk = window.__PRODUCTION_SMOKE_SDK__ = {
      environment: { i18n: { lang: ${JSON.stringify(locale)} } },
      features: {
        LoadingAPI: { ready: async () => { calls.ready += 1; } },
        GameplayAPI: {
          start: () => { calls.start += 1; },
          stop: () => { calls.stop += 1; }
        }
      },
      getPlayer: async () => player,
      isAvailableMethod: async () => false,
      leaderboards: {
        setScore: async () => { calls.setScore += 1; },
        getEntries: async () => ({ entries: [] })
      },
      adv: { showRewardedVideo: ({ callbacks }) => callbacks.onClose?.(true) },
      on: (name, callback) => {
        if (!listeners.has(name)) listeners.set(name, new Set());
        listeners.get(name).add(callback);
      },
      off: (name, callback) => listeners.get(name)?.delete(callback)
    };
    sdk.emit = (name) => { for (const callback of listeners.get(name) || []) callback(); };
    window.YaGames = { init: async () => { calls.init += 1; return sdk; } };
  })();`;
}

function collectPageEvidence(page, scenarioId) {
  page.on('console', (message) => {
    if (!['error', 'warning'].includes(message.type())) return;
    const key = message.type() === 'error' ? 'consoleErrors' : 'consoleWarnings';
    aggregateCounters[key] += 1;
    event('browser-console', scenarioId, { level: message.type(), text: message.text() });
  });
  page.on('pageerror', (error) => {
    aggregateCounters.pageErrors += 1;
    event('page-error', scenarioId, { message: error.message });
  });
  page.on('requestfailed', (request) => {
    aggregateCounters.requestFailures += 1;
    aggregateCounters.unexpectedNetworkFailures += 1;
    event('network-request-failed', scenarioId, { url: request.url(), reason: request.failure()?.errorText || '' });
  });
  page.on('response', (response) => {
    if (response.status() < 400) return;
    aggregateCounters.httpErrors += 1;
    aggregateCounters.unexpectedNetworkFailures += 1;
    event('network-http-error', scenarioId, { url: response.url(), status: response.status() });
  });
}

async function readyPage(browser, scenarioId, {
  locale = 'en',
  viewport = { width: 1280, height: 1024 },
  sdk = true,
  deviceScaleFactor = 1,
  isMobile = false,
  hasTouch = false,
} = {}) {
  const context = await browser.newContext({ viewport, screen: viewport, deviceScaleFactor, isMobile, hasTouch, locale: locale === 'ru' ? 'ru-RU' : 'en-US' });
  await context.route('**/sdk.js', async (route) => route.fulfill({
    status: 200,
    contentType: 'text/javascript; charset=utf-8',
    body: sdk ? sdkSource(locale) : '/* deliberate production local-only fallback: YaGames is absent */',
  }));
  const page = await context.newPage();
  page.setDefaultTimeout(15_000);
  page.setDefaultNavigationTimeout(20_000);
  collectPageEvidence(page, scenarioId);
  event('navigation-requested', scenarioId, { url: `${baseUrl}/?infernoDebug=1` });
  await page.goto(`${baseUrl}/?infernoDebug=1`, { waitUntil: 'domcontentloaded' });
  await page.locator('.app-shell[data-app-state="ready"]').waitFor();
  await page.locator('.boot-screen').waitFor({ state: 'detached' });
  event('application-ready', scenarioId, { locale, sdk });
  return { context, page };
}

function assertionCollector(scenarioId) {
  const assertions = [];
  return {
    check(id, condition, detail = {}) {
      assert.equal(Boolean(condition), true, `${scenarioId}/${id}`);
      const at = new Date().toISOString();
      assertions.push({ id, status: 'PASS', at, detail });
      event('assertion', scenarioId, { id, status: 'PASS', ...detail });
    },
    get value() { return assertions; },
  };
}

async function viewportState(page) {
  return page.evaluate(() => {
    const shell = document.querySelector('.app-shell');
    const canvas = document.querySelector('canvas');
    if (!(shell instanceof HTMLElement) || !(canvas instanceof HTMLCanvasElement)) throw new Error('Runtime shell/canvas is missing.');
    const shellRect = shell.getBoundingClientRect();
    const canvasRect = canvas.getBoundingClientRect();
    return {
      innerWidth,
      innerHeight,
      dpr: devicePixelRatio,
      visualScale: visualViewport?.scale ?? 1,
      documentWidth: document.documentElement.scrollWidth,
      documentHeight: document.documentElement.scrollHeight,
      shell: { left: shellRect.left, top: shellRect.top, right: shellRect.right, bottom: shellRect.bottom },
      canvas: { left: canvasRect.left, top: canvasRect.top, right: canvasRect.right, bottom: canvasRect.bottom },
    };
  });
}

function viewportFits(value) {
  const tolerance = 1.5;
  const rectangles = [value.shell, value.canvas];
  return value.documentWidth <= value.innerWidth + tolerance
    && value.documentHeight <= value.innerHeight + tolerance
    && rectangles.every((rect) => rect.left >= -tolerance && rect.top >= -tolerance
      && rect.right <= value.innerWidth + tolerance && rect.bottom <= value.innerHeight + tolerance);
}

async function recordViewport(page, scenarioId, definition, assertions) {
  await page.setViewportSize({ width: definition.width, height: definition.height });
  const session = await page.context().newCDPSession(page);
  await session.send('Emulation.setPageScaleFactor', { pageScaleFactor: definition.zoomPercent / 100 });
  await page.waitForTimeout(100);
  const observed = await viewportState(page);
  assertions.check(`viewport-${definition.id}`, viewportFits(observed), observed);
  const sample = {
    id: definition.id,
    width: definition.width,
    height: definition.height,
    zoomPercent: definition.zoomPercent,
    orientation: definition.width >= definition.height ? 'landscape' : 'portrait',
    ...(definition.rotatedFrom ? { rotatedFrom: definition.rotatedFrom } : {}),
    observed,
  };
  viewportSamples.push(sample);
  event('viewport-sample', scenarioId, sample);
  await session.detach();
}

async function scenarioBootSdkReady(browser, assertions) {
  const { context, page } = await readyPage(browser, 'production-boot-sdk-ready');
  const values = await page.evaluate(() => ({
    title: document.title,
    lang: document.documentElement.lang,
    calls: window.__PRODUCTION_SMOKE_SDK_CALLS__,
    testDriver: typeof window.__INFERNO_E2E__,
    diagnostics: window.__INFERNO_DIAGNOSTICS__(),
  }));
  assertions.check('english-title', values.title === 'Ignite', { title: values.title });
  assertions.check('english-lang', values.lang === 'en', { lang: values.lang });
  assertions.check('sdk-init-once', values.calls.init === 1, { init: values.calls.init });
  assertions.check('loading-ready-once', values.calls.ready === 1, { ready: values.calls.ready });
  assertions.check('test-driver-disabled', values.testDriver === 'undefined');
  assertions.check('yandex-capability-active', values.diagnostics.platform.degradedFrom == null);
  await context.close();
}

async function scenarioGameplayLifecycle(browser, assertions) {
  const scenarioId = 'production-gameplay-start-stop';
  const { context, page } = await readyPage(browser, scenarioId);
  const canvas = page.locator('canvas');
  const box = await canvas.boundingBox();
  if (!box) throw new Error('Production gameplay canvas has no bounding box.');
  await canvas.click({ position: { x: box.width / 2, y: box.height * 0.55 } });
  await page.waitForFunction(() => window.__PRODUCTION_SMOKE_SDK_CALLS__.start === 1);
  await page.evaluate(() => window.__PRODUCTION_SMOKE_SDK__.emit('game_api_pause'));
  await page.waitForFunction(() => window.__PRODUCTION_SMOKE_SDK_CALLS__.stop === 1);
  await page.evaluate(() => window.__PRODUCTION_SMOKE_SDK__.emit('game_api_resume'));
  await page.waitForFunction(() => window.__PRODUCTION_SMOKE_SDK_CALLS__.start === 2);
  await page.waitForFunction(() => window.__INFERNO_DIAGNOSTICS__().state.phase === 'PLAYING');
  const values = await page.evaluate(() => ({
    calls: window.__PRODUCTION_SMOKE_SDK_CALLS__,
    phase: window.__INFERNO_DIAGNOSTICS__().state.phase,
    score: window.__INFERNO_DIAGNOSTICS__().state.score,
  }));
  assertions.check('gameplay-start-exact', values.calls.start === 2, { start: values.calls.start });
  assertions.check('gameplay-stop-exact', values.calls.stop === 1, { stop: values.calls.stop });
  assertions.check('gameplay-resumed', values.phase === 'PLAYING', { phase: values.phase });
  assertions.check('tap-recorded', values.score >= 1, { score: values.score });
  await context.close();
}

async function scenarioLocale(browser, scenarioId, locale, title, lang, assertions) {
  const { context, page } = await readyPage(browser, scenarioId, { locale });
  assertions.check('localized-title', await page.title() === title, { observed: await page.title(), expected: title });
  assertions.check('localized-html-lang', await page.locator('html').getAttribute('lang') === lang, { expected: lang });
  const pauseText = await page.locator('[data-action="pause"]').innerText();
  assertions.check('localized-hud-control', locale === 'ru' ? /пауза/iu.test(pauseText) : /pause/iu.test(pauseText), { pauseText });
  await context.close();
}

const desktopViewports = [
  { id: '1280x1024@80', width: 1280, height: 1024, zoomPercent: 80 },
  { id: '1280x1024@100', width: 1280, height: 1024, zoomPercent: 100 },
  { id: '1280x1024@125', width: 1280, height: 1024, zoomPercent: 125 },
  { id: '1920x1080', width: 1920, height: 1080, zoomPercent: 100 },
  { id: '3840x2160', width: 3840, height: 2160, zoomPercent: 100 },
  { id: '3840x1080-ultrawide', width: 3840, height: 1080, zoomPercent: 100 },
];
const mobileViewports = [
  { id: '390x844-portrait', width: 390, height: 844, zoomPercent: 100 },
  { id: '844x390-short-landscape', width: 844, height: 390, zoomPercent: 100 },
  { id: 'rotation', width: 390, height: 844, zoomPercent: 100, rotatedFrom: '844x390-short-landscape' },
];

async function scenarioDesktop(browser, assertions) {
  const scenarioId = 'production-responsive-desktop';
  const { context, page } = await readyPage(browser, scenarioId);
  for (const definition of desktopViewports) await recordViewport(page, scenarioId, definition, assertions);
  const sideFill = await page.evaluate(() => Number.parseFloat(getComputedStyle(document.querySelector('.app-shell'), '::before').width));
  assertions.check('ultrawide-authored-side-fill', sideFill > 0, { width: sideFill });
  await context.close();
}

async function scenarioMobile(browser, scenarioId, definition, assertions) {
  const { context, page } = await readyPage(browser, scenarioId, {
    viewport: { width: definition.width, height: definition.height },
    deviceScaleFactor: 2,
    isMobile: true,
    hasTouch: true,
  });
  await recordViewport(page, scenarioId, definition, assertions);
  if (scenarioId === 'production-responsive-mobile-landscape') {
    await page.evaluate(() => window.dispatchEvent(new Event('orientationchange')));
    await recordViewport(page, scenarioId, mobileViewports[2], assertions);
  }
  const targets = await page.locator('button:visible').evaluateAll((buttons) => buttons.map((button) => {
    const rect = button.getBoundingClientRect();
    return { width: rect.width, height: rect.height };
  }));
  assertions.check('touch-targets-48px', targets.length > 0 && targets.every((target) => target.width >= 48 && target.height >= 48), { targets });
  await context.close();
}

async function scenarioSdkFallback(browser, assertions) {
  const scenarioId = 'production-sdk-fallback-local-only';
  const { context, page } = await readyPage(browser, scenarioId, { sdk: false, viewport: { width: 390, height: 844 }, deviceScaleFactor: 3, isMobile: true, hasTouch: true });
  const values = await page.evaluate(() => ({
    diagnostics: window.__INFERNO_DIAGNOSTICS__(),
    rewardHidden: document.querySelector('[data-action="reward"]')?.hidden ?? true,
    body: document.body.innerText,
  }));
  assertions.check('local-only-degraded-target', values.diagnostics.platform.degradedFrom === 'yandex', values.diagnostics.platform);
  assertions.check('rewarded-unavailable', values.diagnostics.platform.rewardedAds === false && values.rewardHidden);
  assertions.check('no-test-provider-copy', !/test provider|тестов|получить ×2/iu.test(values.body));
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
  browser = await chromium.launch({ executablePath, headless: true, args: ['--disable-gpu-sandbox'] });
  const probeContext = await browser.newContext();
  const probePage = await probeContext.newPage();
  const observedUserAgent = await probePage.evaluate(() => navigator.userAgent);
  verifyBrowserIdentity(browserId, observedUserAgent);
  await probeContext.close();

  const definitions = [
    ['production-boot-sdk-ready', (checks) => scenarioBootSdkReady(browser, checks)],
    ['production-gameplay-start-stop', (checks) => scenarioGameplayLifecycle(browser, checks)],
    ['production-locale-ru', (checks) => scenarioLocale(browser, 'production-locale-ru', 'ru', 'Зажги', 'ru', checks)],
    ['production-locale-en', (checks) => scenarioLocale(browser, 'production-locale-en', 'en', 'Ignite', 'en', checks)],
    ['production-responsive-desktop', (checks) => scenarioDesktop(browser, checks)],
    ['production-responsive-mobile-portrait', (checks) => scenarioMobile(browser, 'production-responsive-mobile-portrait', mobileViewports[0], checks)],
    ['production-responsive-mobile-landscape', (checks) => scenarioMobile(browser, 'production-responsive-mobile-landscape', mobileViewports[1], checks)],
    ['production-sdk-fallback-local-only', (checks) => scenarioSdkFallback(browser, checks)],
  ];
  const scenarioResults = [];
  for (const [id, action] of definitions) {
    const startedAt = new Date().toISOString();
    const startedMs = Date.now();
    const assertions = assertionCollector(id);
    event('scenario-start', id);
    await withTimeout(action(assertions), 45_000, id);
    event('scenario-complete', id, { status: 'PASS' });
    const completedAt = new Date().toISOString();
    scenarioResults.push({
      id,
      status: 'PASS',
      startedAt,
      completedAt,
      durationMs: Math.max(1, Date.now() - startedMs),
      assertions: assertions.value,
    });
  }

  for (const [key, value] of Object.entries(aggregateCounters)) assert.equal(value, 0, `${key} must equal zero`);
  const completedAt = new Date().toISOString();
  const build = {
    buildId: releaseManifest.buildId,
    commitSha: releaseManifest.commitSha,
    sourceFingerprint: releaseManifest.sourceFingerprint,
    clean: releaseManifest.clean,
    buildManifestSha256: sha256(releaseManifestBytes),
    target: releaseManifest.target,
    testDriver: releaseManifest.testDriver,
  };
  const traceName = `browser-production-${browserId}-trace.json`;
  const trace = {
    schemaVersion: 1,
    kind: 'production-browser-run-trace',
    cycle: '09',
    attemptId,
    browser: { id: browserId, version: browserFileVersion(executablePath), engine: 'chromium', userAgent: observedUserAgent },
    build,
    startedAt: runStartedAt,
    completedAt,
    durationMs: Math.max(1, Date.now() - runStartedMs),
    scenarioResults,
    viewportSamples,
    events: traceEvents,
    counters: aggregateCounters,
  };
  const traceBytes = Buffer.from(`${JSON.stringify(trace, null, 2)}\n`);
  const responsiveMatrix = {
    desktop: desktopViewports.map(({ id }) => id),
    mobile: ['844x390-short-landscape', '390x844-portrait', 'rotation'],
  };
  const report = {
    schemaVersion: 1,
    kind: 'production-browser-run',
    status: 'PASS',
    cycle: '09',
    attemptId,
    browser: {
      id: browserId,
      executablePath: executablePath.replaceAll('\\', '/'),
      version: browserFileVersion(executablePath),
      engine: 'chromium',
      headless: true,
      userAgent: observedUserAgent,
    },
    build,
    startedAt: runStartedAt,
    completedAt,
    durationMs: trace.durationMs,
    scenarios: scenarioResults.map(({ id }) => id),
    scenarioResults,
    responsiveMatrix,
    viewportSamples,
    rawTrace: { path: traceName, bytes: traceBytes.length, sha256: sha256(traceBytes) },
    checks: {
      exactProductionBundle: true,
      sdkReady: true,
      sdkLifecycle: true,
      localeRuEn: true,
      responsiveDesktop: true,
      responsiveMobile: true,
      sdkFailureFallback: true,
      consoleAndNetworkClean: true,
    },
    ...aggregateCounters,
  };
  const reportBytes = Buffer.from(`${JSON.stringify(report, null, 2)}\n`);
  await mkdir(evidenceRoot, { recursive: true });
  await atomicWrite(join(evidenceRoot, traceName), traceBytes);
  await atomicWrite(join(evidenceRoot, `browser-production-${browserId}.json`), reportBytes);
  console.log(`Yandex production browser smoke PASS (${browserId}, exact ${build.buildId}, testDriver=false, ${scenarioResults.length} scenarios)`);
} finally {
  await browser?.close();
  await verifiedServer.stop();
}
