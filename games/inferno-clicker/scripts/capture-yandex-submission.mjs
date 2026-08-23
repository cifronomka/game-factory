import { createHash } from 'node:crypto';
import { access, mkdir, mkdtemp, readFile, rename, rm, writeFile } from 'node:fs/promises';
import { join } from 'node:path';
import { chromium } from 'playwright-core';
import sharp from 'sharp';
import { buildIdentity, gameRoot, startVerifiedStaticServer, verifyBuildPayload } from './lib.mjs';

const submissionRoot = join(gameRoot, 'releases/yandex-submission-1.0.0');
const mediaRoot = join(submissionRoot, 'media');
const humanManifestPath = join(submissionRoot, 'asset-manifest.md');
const screenshotNames = [
  ...[1, 2, 3, 4].map((index) => `desktop-0${index}-1920x1080.png`),
  ...[1, 2, 3, 4].map((index) => `mobile-0${index}-1080x1920.png`),
];
const mediaManifestName = 'submission-media-manifest.json';
const residencyManagedCharacterPaths = new Set([
  ...['idle', 'inhale', 'blow', 'recovery'].map((clip) => `/assets/characters/ash-servant/ash-servant-${clip}-v7.webp`),
  ...['idle', 'cast', 'hold', 'recovery'].map((clip) => `/assets/characters/demoness/demoness-${clip}-v8.webp`),
]);

const browserCandidates = [
  process.env.INFERNO_BROWSER_PATH,
  'C:/Program Files (x86)/Google/Chrome/Application/chrome.exe',
  'C:/Program Files/Google/Chrome/Application/chrome.exe',
  `${process.env.LOCALAPPDATA || ''}/Google/Chrome/Application/chrome.exe`,
  '/usr/bin/google-chrome',
  '/usr/bin/chromium',
  '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome',
].filter(Boolean);
let executablePath = '';
for (const candidate of browserCandidates) {
  try { await access(candidate); executablePath = candidate; break; } catch { /* continue */ }
}
if (!executablePath) throw new Error('Chrome/Chromium is required to capture submission screenshots.');

await mkdir(mediaRoot, { recursive: true });
const transactionRoot = await mkdtemp(join(mediaRoot, '.submission-capture-'));
const stagedMediaRoot = join(transactionRoot, 'staged-media');
const backupRoot = join(transactionRoot, 'backup');
await mkdir(stagedMediaRoot, { recursive: true });
await mkdir(backupRoot, { recursive: true });

const sdkSource = `(() => {
  const listeners = new Map();
  const sdk = {
    environment: { i18n: { lang: 'ru' } },
    features: { LoadingAPI: { ready: async () => {} }, GameplayAPI: { start: () => {}, stop: () => {} } },
    getPlayer: async () => ({ isAuthorized: () => false, getData: async () => ({}), setData: async () => {} }),
    isAvailableMethod: async () => true,
    leaderboards: { setScore: async () => {}, getEntries: async () => ({ entries: [] }) },
    adv: { showRewardedVideo: ({ callbacks }) => { callbacks.onOpen?.(); callbacks.onRewarded?.(); callbacks.onClose?.(true); } },
    on: (name, callback) => { if (!listeners.has(name)) listeners.set(name, new Set()); listeners.get(name).add(callback); },
    off: (name, callback) => listeners.get(name)?.delete(callback)
  };
  window.YaGames = { init: async () => sdk };
})();`;

const captureCounters = { consoleErrors: 0, consoleWarnings: 0, pageErrors: 0, requestFailures: 0, httpErrors: 0 };
const captureFailureDetails = { consoleErrors: [], consoleWarnings: [], pageErrors: [], requestFailures: [], httpErrors: [] };
const expectedResidencyAborts = [];
const captureAssertions = [];
let verifiedServer;
let browser;
let preserveTransactionRoot = false;

async function pathExists(path) {
  try {
    await access(path);
    return true;
  } catch {
    return false;
  }
}

async function createPage(baseUrl, options) {
  const context = await browser.newContext(options);
  await context.route('**/sdk.js', (route) => route.fulfill({ status: 200, contentType: 'text/javascript', body: sdkSource }));
  const page = await context.newPage();
  page.on('console', (message) => {
    if (message.type() === 'error') {
      captureCounters.consoleErrors += 1;
      captureFailureDetails.consoleErrors.push(message.text());
    }
    if (message.type() === 'warning') {
      captureCounters.consoleWarnings += 1;
      captureFailureDetails.consoleWarnings.push(message.text());
    }
  });
  page.on('pageerror', (error) => {
    captureCounters.pageErrors += 1;
    captureFailureDetails.pageErrors.push(error.message);
  });
  page.on('requestfailed', (request) => {
    const detail = { url: request.url(), errorText: request.failure()?.errorText ?? 'unknown' };
    let pathname = '';
    try { pathname = new URL(detail.url).pathname; } catch { /* invalid URLs remain unexpected */ }
    if (detail.errorText === 'net::ERR_ABORTED' && residencyManagedCharacterPaths.has(pathname)) {
      expectedResidencyAborts.push({ path: pathname, errorText: detail.errorText, reason: 'test-driver clip transition released the non-current decoded atlas' });
      return;
    }
    captureCounters.requestFailures += 1;
    captureFailureDetails.requestFailures.push(detail);
  });
  page.on('response', (response) => {
    if (response.status() < 400) return;
    captureCounters.httpErrors += 1;
    captureFailureDetails.httpErrors.push({ url: response.url(), status: response.status() });
  });
  await page.goto(`${baseUrl}/?infernoDebug=1`, { waitUntil: 'domcontentloaded' });
  await page.locator('.app-shell[data-app-state="ready"]').waitFor({ timeout: 20_000 });
  await page.waitForLoadState('networkidle');
  return { context, page };
}

async function settle(page) {
  await page.waitForLoadState('networkidle');
  await page.evaluate(() => new Promise((resolve) => requestAnimationFrame(() => requestAnimationFrame(resolve))));
}

async function shot(page, filename) {
  await settle(page);
  const assertion = await page.evaluate(() => {
    const app = document.querySelector('.app-shell');
    const canvas = document.querySelector('.inferno-presentation canvas');
    if (!(app instanceof HTMLElement) || !(canvas instanceof HTMLCanvasElement)) throw new Error('Gameplay surface is missing.');
    const rect = canvas.getBoundingClientRect();
    const viewportArea = Math.max(1, innerWidth * innerHeight);
    const visibleDebugOverlayCount = [...document.querySelectorAll('[class*="debug" i], [id*="debug" i], [data-debug]')]
      .filter((element) => {
        const style = getComputedStyle(element);
        const box = element.getBoundingClientRect();
        return style.display !== 'none' && style.visibility !== 'hidden' && Number(style.opacity) !== 0 && box.width > 0 && box.height > 0;
      }).length;
    return {
      appState: app.dataset.appState,
      gameplaySurfaceRatio: Math.max(0, Math.min(1, rect.width * rect.height / viewportArea)),
      visibleDebugOverlayCount,
      viewport: { width: innerWidth, height: innerHeight },
    };
  });
  const expectedAppState = /-01-/u.test(filename) ? 'ready' : 'playing';
  if (assertion.appState !== expectedAppState || assertion.gameplaySurfaceRatio < 0.7 || assertion.visibleDebugOverlayCount !== 0) {
    throw new Error(`${filename}: submission gameplay/debug assertion failed: ${JSON.stringify(assertion)}`);
  }
  captureAssertions.push({ filename, ...assertion });
  await page.screenshot({ path: join(stagedMediaRoot, filename), animations: 'disabled' });
}

async function keepPlayingUntilInfernoToastClears(page) {
  const canvas = page.locator('canvas');
  const box = await canvas.boundingBox();
  if (!box) throw new Error('Gameplay canvas is missing while waiting for the Inferno toast to clear.');
  const toast = page.locator('[data-toast]');
  const deadline = Date.now() + 4_500;
  while (await toast.isVisible() && Date.now() < deadline) {
    await canvas.click({ position: { x: box.width / 2, y: box.height * 0.55 } });
    await page.waitForTimeout(160);
  }
  await toast.waitFor({ state: 'hidden', timeout: 1_000 });
  const state = await page.evaluate(() => window.__INFERNO_E2E__.snapshot().state);
  if (state.phase !== 'PLAYING' || state.stage !== 7) {
    throw new Error(`Inferno capture lost its live Stage 7 state: ${JSON.stringify({ phase: state.phase, stage: state.stage })}`);
  }
}

async function captureGameplay(baseUrl) {
  const desktop = await createPage(baseUrl, { viewport: { width: 1920, height: 1080 }, deviceScaleFactor: 1, locale: 'ru-RU' });
  try {
    await shot(desktop.page, 'desktop-01-1920x1080.png');
    await desktop.page.evaluate(() => { window.__INFERNO_E2E__.reachStage(3); window.__INFERNO_E2E__.advanceActive(8_000); });
    await shot(desktop.page, 'desktop-02-1920x1080.png');
    await desktop.page.evaluate(() => { window.__INFERNO_E2E__.reachStage(5); window.__INFERNO_E2E__.advanceActive(10_000); });
    await shot(desktop.page, 'desktop-03-1920x1080.png');
    await desktop.page.evaluate(() => window.__INFERNO_E2E__.reachStage(7));
    await keepPlayingUntilInfernoToastClears(desktop.page);
    await shot(desktop.page, 'desktop-04-1920x1080.png');
  } finally {
    await desktop.context.close();
  }

  const mobile = await createPage(baseUrl, { viewport: { width: 360, height: 640 }, deviceScaleFactor: 3, locale: 'ru-RU', isMobile: true, hasTouch: true });
  try {
    await shot(mobile.page, 'mobile-01-1080x1920.png');
    await mobile.page.evaluate(() => { window.__INFERNO_E2E__.reachStage(3); window.__INFERNO_E2E__.advanceActive(8_000); });
    await shot(mobile.page, 'mobile-02-1080x1920.png');
    await mobile.page.evaluate(() => { window.__INFERNO_E2E__.advanceActive(3_000); window.__INFERNO_E2E__.settleRewardOffer(10_000); });
    await shot(mobile.page, 'mobile-03-1080x1920.png');
    await mobile.page.evaluate(() => window.__INFERNO_E2E__.reachStage(7));
    await keepPlayingUntilInfernoToastClears(mobile.page);
    await shot(mobile.page, 'mobile-04-1080x1920.png');
  } finally {
    await mobile.context.close();
  }
}

async function restoreTransaction(records) {
  const rollbackErrors = [];
  for (const record of [...records].reverse()) {
    try {
      if (record.stagedMoved) await rm(record.target, { force: true });
      if (record.originalMoved) await rename(record.backup, record.target);
    } catch (error) {
      rollbackErrors.push(error);
    }
  }
  return rollbackErrors;
}

async function promoteSubmission(stagedHumanManifestPath) {
  const records = [];
  const moveStagedFile = async (staged, target, backup) => {
    const record = { staged, target, backup, originalMoved: false, stagedMoved: false };
    records.push(record);
    if (await pathExists(target)) {
      await rename(target, backup);
      record.originalMoved = true;
    }
    await rename(staged, target);
    record.stagedMoved = true;
  };

  try {
    for (const filename of [...screenshotNames, mediaManifestName]) {
      await moveStagedFile(join(stagedMediaRoot, filename), join(mediaRoot, filename), join(backupRoot, filename));
    }
    await moveStagedFile(stagedHumanManifestPath, humanManifestPath, join(backupRoot, 'asset-manifest.md'));
  } catch (error) {
    const rollbackErrors = await restoreTransaction(records);
    if (rollbackErrors.length > 0) {
      preserveTransactionRoot = true;
      throw new AggregateError([error, ...rollbackErrors], 'Submission promotion failed and rollback was incomplete.');
    }
    throw error;
  }
}

try {
  const captureBuildManifestBytes = await readFile(join(gameRoot, 'dist-e2e/build-manifest.json'));
  const captureBuildManifest = JSON.parse(captureBuildManifestBytes.toString('utf8'));
  const currentIdentity = await buildIdentity();
  if (captureBuildManifest.target !== 'yandex' || captureBuildManifest.testDriver !== true) {
    throw new Error('Submission capture requires the instrumented Yandex build.');
  }
  if (captureBuildManifest.commitSha !== currentIdentity.commitSha
    || captureBuildManifest.sourceFingerprint !== currentIdentity.sourceFingerprint
    || captureBuildManifest.clean !== currentIdentity.clean) {
    throw new Error('Submission capture refuses a stale instrumented build; run build:yandex:test first.');
  }
  await verifyBuildPayload(join(gameRoot, 'dist-e2e'), captureBuildManifest);
  verifiedServer = await startVerifiedStaticServer(join(gameRoot, 'dist-e2e'));

  browser = await chromium.launch({ executablePath, headless: true });
  await captureGameplay(verifiedServer.baseUrl);
  await browser.close();
  browser = undefined;

  if (Object.values(captureCounters).some((count) => count !== 0)) {
    throw new Error(`Submission capture recorded browser/network failures: ${JSON.stringify({ counters: captureCounters, details: captureFailureDetails })}`);
  }
  if (expectedResidencyAborts.length > residencyManagedCharacterPaths.size
    || new Set(expectedResidencyAborts.map((entry) => entry.path)).size !== expectedResidencyAborts.length) {
    throw new Error(`Submission capture recorded an unexpected residency-abort pattern: ${JSON.stringify(expectedResidencyAborts)}`);
  }
  if (captureAssertions.length !== screenshotNames.length
    || captureAssertions.some((entry, index) => entry.filename !== screenshotNames[index]
      || entry.appState !== (/-01-/u.test(entry.filename) ? 'ready' : 'playing')
      || entry.gameplaySurfaceRatio < 0.7
      || entry.visibleDebugOverlayCount !== 0)) {
    throw new Error(`Submission capture assertions are incomplete or invalid: ${JSON.stringify(captureAssertions)}`);
  }

  const expected = [
    ['icon-512.png', 512, 512, 'original ImageGen icon', mediaRoot],
    ['cover-800x470.png', 800, 470, 'original ImageGen cover', mediaRoot],
    ...[1, 2, 3, 4].map((index) => [`desktop-0${index}-1920x1080.png`, 1920, 1080, 'exact release gameplay', stagedMediaRoot]),
    ...[1, 2, 3, 4].map((index) => [`mobile-0${index}-1080x1920.png`, 1080, 1920, 'exact release gameplay', stagedMediaRoot]),
  ];
  const files = [];
  for (const [filename, width, height, source, root] of expected) {
    const bytes = await readFile(join(root, filename));
    const metadata = await sharp(bytes, { failOn: 'error' }).metadata();
    if (metadata.width !== width || metadata.height !== height || metadata.format !== 'png') {
      throw new Error(`${filename}: expected ${width}x${height} PNG, got ${metadata.width}x${metadata.height} ${metadata.format}`);
    }
    files.push({ filename, width, height, bytes: bytes.length, sha256: createHash('sha256').update(bytes).digest('hex'), source });
  }

  const mediaManifest = {
    schemaVersion: 1,
    version: '1.0.0',
    generatedAt: new Date().toISOString(),
    captureBuild: {
      manifest: 'dist-e2e/build-manifest.json',
      buildId: captureBuildManifest.buildId,
      commitSha: captureBuildManifest.commitSha,
      sourceFingerprint: captureBuildManifest.sourceFingerprint,
      target: captureBuildManifest.target,
      testDriver: captureBuildManifest.testDriver,
      manifestSha256: createHash('sha256').update(captureBuildManifestBytes).digest('hex'),
    },
    gameplayShareRequiredMinimum: 0.7,
    gameplayShareMinimum: Math.min(...captureAssertions.map((entry) => entry.gameplaySurfaceRatio)),
    systemOrDebugOverlay: captureAssertions.some((entry) => entry.visibleDebugOverlayCount !== 0),
    captureCounters,
    expectedResidencyAborts,
    captureAssertions,
    files,
  };
  const stagedMediaManifestPath = join(stagedMediaRoot, mediaManifestName);
  await writeFile(stagedMediaManifestPath, `${JSON.stringify(mediaManifest, null, 2)}\n`);
  const verifiedMediaManifest = JSON.parse(await readFile(stagedMediaManifestPath, 'utf8'));
  if (verifiedMediaManifest.files.length !== files.length
    || verifiedMediaManifest.captureAssertions.length !== screenshotNames.length
    || Object.values(verifiedMediaManifest.captureCounters).some((count) => count !== 0)) {
    throw new Error('Staged submission media manifest failed its final validation.');
  }

  const humanManifest = await readFile(humanManifestPath, 'utf8');
  let synchronizedRows = 0;
  const synchronizedHumanManifest = humanManifest.split(/(?<=\n)/u).map((line) => {
    const file = files.find((item) => line.includes(`\`media/${item.filename}\``));
    if (!file) return line;
    synchronizedRows += 1;
    return line.replace(/\| `(?:[a-f0-9]{64}|NOT RUN)` \|(\r?\n)?$/u, `| \`${file.sha256}\` |$1`);
  }).join('');
  if (synchronizedRows !== files.length) throw new Error(`Human submission manifest matched ${synchronizedRows}/${files.length} media rows.`);
  for (const file of files) {
    if (!synchronizedHumanManifest.includes(`\`${file.sha256}\``)) throw new Error(`Human submission manifest did not synchronize ${file.filename}.`);
  }
  const stagedHumanManifestPath = join(transactionRoot, 'asset-manifest.md');
  await writeFile(stagedHumanManifestPath, synchronizedHumanManifest, 'utf8');

  await promoteSubmission(stagedHumanManifestPath);
  console.log('Yandex submission media PASS (icon, cover, 4 desktop, 4 mobile)');
} finally {
  try {
    if (browser) await browser.close();
  } finally {
    try {
      if (verifiedServer) await verifiedServer.stop();
    } finally {
      if (!preserveTransactionRoot) await rm(transactionRoot, { recursive: true, force: true }).catch(() => {});
      else console.error(`Submission recovery data retained at ${transactionRoot}`);
    }
  }
}
