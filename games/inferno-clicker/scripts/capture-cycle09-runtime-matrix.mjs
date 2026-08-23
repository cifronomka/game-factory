import { createHash } from 'node:crypto';
import { access, mkdir, mkdtemp, readFile, rename, rm, writeFile } from 'node:fs/promises';
import { isAbsolute, join } from 'node:path';
import { chromium } from 'playwright-core';
import sharp from 'sharp';
import { gameRoot, startVerifiedStaticServer } from './lib.mjs';
import {
  RUNTIME_VISUAL_FINGERPRINT_ALGORITHM,
  runtimeSheetPerceptualHashes,
} from './runtime-visual-fingerprint.mjs';

const requestedEvidence = process.env.INFERNO_CYCLE09_EVIDENCE_DIR;
const evidenceRoot = requestedEvidence
  ? (isAbsolute(requestedEvidence) ? requestedEvidence : join(gameRoot, requestedEvidence))
  : join(gameRoot, 'reports/yandex-release-cycle-09-working');
const outputRoot = join(evidenceRoot, 'visual');
const sha256 = (bytes) => createHash('sha256').update(bytes).digest('hex');
await mkdir(outputRoot, { recursive: true });
const transactionRoot = await mkdtemp(join(outputRoot, '.runtime-capture-'));
const stagedRoot = join(transactionRoot, 'staged');
const backupRoot = join(transactionRoot, 'backup');
await mkdir(stagedRoot, { recursive: true });
await mkdir(backupRoot, { recursive: true });
let preserveTransactionRoot = false;

async function pathExists(path) { try { await access(path); return true; } catch { return false; } }
async function promoteRuntime(names) {
  const records = [];
  try {
    for (const name of names) {
      const record = { target: join(outputRoot, name), backup: join(backupRoot, name), originalMoved: false, stagedMoved: false };
      records.push(record);
      if (await pathExists(record.target)) { await rename(record.target, record.backup); record.originalMoved = true; }
      await rename(join(stagedRoot, name), record.target);
      record.stagedMoved = true;
    }
  } catch (error) {
    const rollbackErrors = [];
    for (const record of [...records].reverse()) {
      try {
        if (record.stagedMoved) await rm(record.target, { force: true });
        if (record.originalMoved) await rename(record.backup, record.target);
      } catch (rollbackError) { rollbackErrors.push(rollbackError); }
    }
    if (rollbackErrors.length > 0) {
      preserveTransactionRoot = true;
      throw new AggregateError([error, ...rollbackErrors], 'Runtime evidence promotion failed and rollback was incomplete.');
    }
    throw error;
  }
}

const candidates = [
  process.env.INFERNO_BROWSER_PATH,
  'C:/Program Files (x86)/Google/Chrome/Application/chrome.exe',
  'C:/Program Files/Google/Chrome/Application/chrome.exe',
  `${process.env.LOCALAPPDATA || ''}/Google/Chrome/Application/chrome.exe`,
  `${process.env.LOCALAPPDATA || ''}/Yandex/YandexBrowser/Application/browser.exe`,
  '/usr/bin/google-chrome',
  '/usr/bin/chromium',
  '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome',
].filter(Boolean);
let executablePath = '';
for (const candidate of candidates) {
  try { await access(candidate); executablePath = candidate; break; } catch { /* next candidate */ }
}
if (!executablePath) throw new Error('Chrome/Chromium is required for Cycle 09 runtime evidence.');

const sdkSource = `(() => {
  const listeners = new Map();
  const sdk = {
    environment: { i18n: { lang: 'en' } },
    features: { LoadingAPI: { ready: async () => {} }, GameplayAPI: { start: () => {}, stop: () => {} } },
    getPlayer: async () => ({ isAuthorized: () => false }),
    isAvailableMethod: async () => false,
    adv: { showRewardedVideo: ({ callbacks }) => callbacks.onClose?.(false) },
    on: (name, callback) => { if (!listeners.has(name)) listeners.set(name, new Set()); listeners.get(name).add(callback); },
    off: (name, callback) => listeners.get(name)?.delete(callback)
  };
  sdk.emit = (name) => { for (const callback of listeners.get(name) || []) callback(); };
  window.__YSDK_VISUAL__ = sdk;
  window.YaGames = { init: async () => sdk };
})();`;

const files = [];
const checks = [];
const evidenceCounters = { consoleErrors: 0, consoleWarnings: 0, pageErrors: 0, requestFailures: 0, httpErrors: 0 };
const runtimeModes = Object.freeze([
  Object.freeze({ id: 'normal', reducedMotion: false, forcedLow: false }),
  Object.freeze({ id: 'reduced', reducedMotion: true, forcedLow: false }),
  Object.freeze({ id: 'forced-low', reducedMotion: false, forcedLow: true }),
]);
let verifiedServer;
let browser;
try {
  verifiedServer = await startVerifiedStaticServer(join(gameRoot, 'dist-e2e'));
  const { baseUrl } = verifiedServer;
  const buildManifestBytes = await readFile(join(gameRoot, 'dist-e2e/build-manifest.json'));
  const buildManifest = JSON.parse(buildManifestBytes.toString('utf8'));
  if (buildManifest.target !== 'yandex' || buildManifest.testDriver !== true) throw new Error('Runtime evidence requires the instrumented Yandex build.');

  browser = await chromium.launch({
    executablePath,
    headless: true,
    args: ['--disable-gpu', '--disable-gpu-sandbox'],
  });
  for (const mode of runtimeModes) {
    for (const dpr of [1, 2, 3]) {
      const context = await browser.newContext({
        viewport: { width: 390, height: 844 },
        deviceScaleFactor: dpr,
        locale: 'en-US',
        isMobile: true,
        hasTouch: true,
      });
      await context.addInitScript(() => {
        let clockMs = 1_000;
        let callbackId = 0;
        const callbacks = new Map();
        Object.defineProperty(performance, 'now', { configurable: true, value: () => clockMs });
        Object.defineProperty(globalThis, 'requestAnimationFrame', {
          configurable: true,
          value: (callback) => {
            callbackId += 1;
            callbacks.set(callbackId, callback);
            return callbackId;
          },
        });
        Object.defineProperty(globalThis, 'cancelAnimationFrame', {
          configurable: true,
          value: (id) => callbacks.delete(id),
        });
        Object.defineProperty(globalThis, '__INFERNO_EVIDENCE_CLOCK__', {
          configurable: false,
          value: Object.freeze({
            advance(frames, stepMs = 50) {
              for (let frame = 0; frame < frames; frame += 1) {
                clockMs += stepMs;
                const batch = [...callbacks.values()];
                callbacks.clear();
                for (const callback of batch) callback(clockMs);
              }
              return { clockMs, queuedCallbacks: callbacks.size };
            },
          }),
        });
      });
      if (mode.forcedLow) {
        await context.addInitScript(() => {
          Object.defineProperty(navigator, 'deviceMemory', { configurable: true, value: 2 });
          Object.defineProperty(navigator, 'hardwareConcurrency', { configurable: true, value: 2 });
        });
      }
      await context.route('**/sdk.js', (route) => route.fulfill({ status: 200, contentType: 'text/javascript', body: sdkSource }));
      const page = await context.newPage();
      const failures = [];
      page.on('console', (message) => {
        if (message.type() === 'error' || message.type() === 'warning') {
          if (message.type() === 'error') evidenceCounters.consoleErrors += 1;
          else evidenceCounters.consoleWarnings += 1;
          failures.push(`console.${message.type()}: ${message.text()}`);
        }
      });
      page.on('pageerror', (error) => { evidenceCounters.pageErrors += 1; failures.push(`pageerror: ${error.message}`); });
      page.on('requestfailed', (request) => { evidenceCounters.requestFailures += 1; failures.push(`requestfailed: ${request.url()} ${request.failure()?.errorText ?? ''}`); });
      page.on('response', (response) => {
        if (response.status() < 400) return;
        evidenceCounters.httpErrors += 1;
        failures.push(`http.${response.status()}: ${response.url()}`);
      });
      await page.goto(`${baseUrl}/?infernoDebug=1`, { waitUntil: 'domcontentloaded' });
      await page.locator('.app-shell[data-app-state="ready"]').waitFor({ timeout: 20_000 });
      await page.waitForLoadState('networkidle');
      if (mode.reducedMotion) await page.locator('[data-action="motion"]').click();
      await page.waitForFunction((expected) => {
        const view = window.__INFERNO_E2E__.snapshot().view;
        return view.reducedMotion === expected.reducedMotion && view.quality === expected.quality;
      }, { reducedMotion: mode.reducedMotion, quality: mode.forcedLow ? 'low' : 'high' }, { polling: 50 });
      await page.evaluate(() => window.__INFERNO_EVIDENCE_CLOCK__.advance(2));
      const stageShots = [];
      for (let stage = 1; stage <= 7; stage += 1) {
        await page.evaluate((targetStage) => {
          window.__YSDK_VISUAL__.emit('game_api_resume');
          window.__INFERNO_E2E__.prepareStageEvidence(targetStage);
        }, stage);
        await page.waitForLoadState('networkidle');
        await page.waitForFunction((targetStage) => {
          const scene = window.__INFERNO_DIAGNOSTICS__().presentation.scene;
          const family = targetStage >= 6 ? 'high' : targetStage >= 3 ? 'mid' : 'low';
          return scene.assets?.[family]?.core === 'ready'
            && scene.assets?.[family]?.outer === 'ready'
            && (targetStage === 1 || scene.assets?.flare === 'ready');
        }, stage, { polling: 50, timeout: 20_000 });
        await page.evaluate((frames) => {
          window.__INFERNO_EVIDENCE_CLOCK__.advance(frames);
          window.__YSDK_VISUAL__.emit('game_api_pause');
          window.__INFERNO_EVIDENCE_CLOCK__.advance(2);
        }, stage >= 6 ? 34 : 23);
        await page.waitForFunction(() => window.__INFERNO_E2E__.snapshot().state.pauseReasons.includes('platform'), null, { polling: 50 });
        try {
          await page.waitForFunction((targetStage) => {
            const characters = window.__INFERNO_DIAGNOSTICS__().presentation.scene.characters;
            const requestedClip = (actor) => ['appearance', 'disapproval'].includes(actor.state) ? 'idle' : actor.clip;
            const servantClip = requestedClip(characters.servant);
            const wardenClip = requestedClip(characters.demoness);
            const servantReady = !characters.servant.visible
              || (characters.servant.asset === 'ready' && characters.servant.assetClip === servantClip);
            const wardenNeedsBitmap = characters.demoness.visible
              && !['silhouette', 'stage-exit'].includes(characters.demoness.state);
            const wardenReady = !wardenNeedsBitmap
              || (characters.demoness.asset === 'ready' && characters.demoness.assetClip === wardenClip);
            return servantReady && wardenReady && (targetStage < 6 || characters.host.asset === 'ready');
          }, stage, { polling: 50, timeout: 20_000 });
        } catch (error) {
          const characters = await page.evaluate(() => window.__INFERNO_DIAGNOSTICS__().presentation.scene.characters);
          throw new Error(`${mode.id} DPR ${dpr} stage ${stage} asset readiness timed out: ${JSON.stringify(characters)}`, { cause: error });
        }
        await page.evaluate(() => window.__INFERNO_EVIDENCE_CLOCK__.advance(1));
        const snapshot = await page.screenshot({ animations: 'disabled' });
        const metadata = await sharp(snapshot, { failOn: 'error' }).metadata();
        stageShots.push({ stage, bytes: snapshot, width: metadata.width, height: metadata.height });
        checks.push({ mode: mode.id, stage, dpr, viewportCss: { width: 390, height: 844 }, capturedPixels: { width: metadata.width, height: metadata.height } });
      }
      if (failures.length > 0) throw new Error(`${mode.id} DPR ${dpr} runtime evidence failures: ${failures.join(' | ')}`);
      const labelHeight = 28 * dpr;
      // Seven portrait stages are laid out horizontally so a human reviewer can inspect
      // every full-size scene in one useful contact sheet instead of a 6–18k px strip.
      const width = stageShots.reduce((sum, shot) => sum + shot.width, 0);
      const height = Math.max(...stageShots.map((shot) => labelHeight + shot.height));
      const composites = [];
      let left = 0;
      for (const shot of stageShots) {
        const label = Buffer.from(`<svg xmlns="http://www.w3.org/2000/svg" width="${shot.width}" height="${labelHeight}"><rect width="100%" height="100%" fill="#100b0d"/><text x="${8 * dpr}" y="${19 * dpr}" font-family="Arial,sans-serif" font-size="${12 * dpr}" fill="#ffffff">${mode.id} · Stage ${shot.stage} · 390×844 CSS · DPR ${dpr}</text></svg>`);
        composites.push({ input: label, left, top: 0 });
        composites.push({ input: shot.bytes, left, top: labelHeight });
        left += shot.width;
      }
      const filename = `runtime-seven-stages-${mode.id}-dpr${dpr}.png`;
      const bytes = await sharp({ create: { width, height, channels: 3, background: '#050407' } })
        .composite(composites)
        .png({ compressionLevel: 9, adaptiveFiltering: true })
        .toBuffer();
      await writeFile(join(stagedRoot, filename), bytes);
      files.push({
        filename,
        width,
        height,
        bytes: bytes.length,
        sha256: sha256(bytes),
        mode: mode.id,
        dpr,
        stages: 7,
        perceptualAlgorithm: RUNTIME_VISUAL_FINGERPRINT_ALGORITHM,
        stagePerceptualHashes: await runtimeSheetPerceptualHashes(bytes, dpr),
      });
      await context.close();
    }
  }

  const runtimeManifest = {
    schemaVersion: 1,
    cycle: '09',
    target: 'yandex',
    generatedBy: 'scripts/capture-cycle09-runtime-matrix.mjs',
    generatedAt: new Date().toISOString(),
    sourceFingerprint: buildManifest.sourceFingerprint,
    buildId: buildManifest.buildId,
    buildManifestSha256: sha256(buildManifestBytes),
    viewportCss: { width: 390, height: 844 },
    contactSheetLayout: 'seven-columns-horizontal',
    modes: runtimeModes.map((mode) => mode.id),
    dprs: [1, 2, 3],
    stages: [1, 2, 3, 4, 5, 6, 7],
    runtimeCheckCount: checks.length,
    consoleErrors: evidenceCounters.consoleErrors,
    consoleWarnings: evidenceCounters.consoleWarnings,
    pageErrors: evidenceCounters.pageErrors,
    requestFailures: evidenceCounters.requestFailures,
    httpErrors: evidenceCounters.httpErrors,
    unexpectedNetworkFailures: evidenceCounters.requestFailures + evidenceCounters.httpErrors,
    files,
    checks,
  };
  if (files.length !== 9 || checks.length !== 63 || Object.values(evidenceCounters).some((value) => value !== 0)) {
    throw new Error(`Runtime capture final counters/inventory are invalid: ${JSON.stringify({ files: files.length, checks: checks.length, evidenceCounters })}`);
  }
  for (const item of files) {
    const bytes = await readFile(join(stagedRoot, item.filename));
    const metadata = await sharp(bytes, { failOn: 'error' }).metadata();
    if (bytes.length !== item.bytes || sha256(bytes) !== item.sha256 || metadata.width !== item.width || metadata.height !== item.height) {
      throw new Error(`Staged runtime matrix validation failed: ${item.filename}`);
    }
  }
  await writeFile(join(stagedRoot, 'runtime-stage-matrix-manifest.json'), `${JSON.stringify(runtimeManifest, null, 2)}\n`);
  await promoteRuntime([...files.map((item) => item.filename), 'runtime-stage-matrix-manifest.json']);
  console.log(`Cycle 09 seven-stage runtime matrix PASS (${checks.length} mode/stage/DPR captures)`);
} finally {
  try {
    if (browser) await browser.close();
  } finally {
    try {
      if (verifiedServer) await verifiedServer.stop();
    } finally {
      if (!preserveTransactionRoot) await rm(transactionRoot, { recursive: true, force: true }).catch(() => {});
      else console.error(`Runtime evidence recovery data retained at ${transactionRoot}`);
    }
  }
}
