import { createHash } from 'node:crypto';
import { access, mkdir, mkdtemp, readFile, rename, rm, writeFile } from 'node:fs/promises';
import { join } from 'node:path';
import { chromium } from 'playwright-core';
import sharp from 'sharp';
import { buildIdentity, gameRoot, startVerifiedStaticServer, verifyBuildPayload } from './lib.mjs';

const durationSeconds = 22.5;
const maximumBytes = 100 * 1024 * 1024;
const submissionRoot = join(gameRoot, 'releases/yandex-submission-1.0.0');
const mediaRoot = join(submissionRoot, 'media');
const visualReferenceRoot = join(gameRoot, 'visual-references/yandex-release-09');
const manifestName = 'gameplay-video-manifest.json';
const replaceExisting = process.argv.includes('--replace');
const frameTimes = Object.freeze([0.35, 2.75, 4.85, 8.85, 10.75, 13.35, 17.85, 20.5]);

const variants = Object.freeze([
  {
    id: 'horizontal',
    filename: 'gameplay-video-horizontal-v1-1920x1080.mp4',
    contactSheet: 'gameplay-video-horizontal-v1-contact-sheet.png',
    width: 1920,
    height: 1080,
    viewport: { width: 1920, height: 1080 },
    deviceScaleFactor: 1,
    isMobile: false,
    hasTouch: false,
    camera: {
      servant: { x: 0.3, y: 0.56, zoom: 1.68 },
      warden: { x: 0.7, y: 0.53, zoom: 1.62 },
      inferno: { x: 0.5, y: 0.54, zoom: 1.46 },
    },
    sheet: { columns: 4, rows: 2, tileWidth: 480, tileHeight: 270 },
  },
  {
    id: 'vertical',
    filename: 'gameplay-video-vertical-v1-1080x1920.mp4',
    contactSheet: 'gameplay-video-vertical-v1-contact-sheet.png',
    width: 1080,
    height: 1920,
    viewport: { width: 540, height: 960 },
    deviceScaleFactor: 2,
    isMobile: true,
    hasTouch: true,
    camera: {
      servant: { x: 0.27, y: 0.61, zoom: 1.14 },
      warden: { x: 0.72, y: 0.58, zoom: 1.13 },
      inferno: { x: 0.5, y: 0.55, zoom: 1.06 },
    },
    sheet: { columns: 4, rows: 2, tileWidth: 270, tileHeight: 480 },
  },
]);

const timeline = Object.freeze([
  { atSeconds: 0, beat: 'Inferno cold open and loop anchor' },
  { atSeconds: 0.98, beat: 'Crossfade and restart' },
  { atSeconds: 1.8, beat: 'Stage 2 transition' },
  { atSeconds: 2.45, beat: 'Stage 3 transition and Ash Servant reveal' },
  { atSeconds: 3.45, beat: 'Ash Servant inhale and blow' },
  { atSeconds: 7.02, beat: 'Crossfade, restart and Stage 4 silhouette' },
  { atSeconds: 8.45, beat: 'Stage 5 Ember Warden reveal' },
  { atSeconds: 9.55, beat: 'Ember Warden cast and steam impact' },
  { atSeconds: 15.62, beat: 'Crossfade, restart and Stage 6 Fire Ring' },
  { atSeconds: 17.25, beat: 'Stage 7 Inferno transition' },
  { atSeconds: durationSeconds, beat: 'Sustained Inferno loop out' },
]);

const residencyManagedCharacterPaths = new Set([
  ...['idle', 'inhale', 'blow', 'recovery'].map((clip) => `/assets/characters/ash-servant/ash-servant-${clip}-v7.webp`),
  ...['idle', 'cast', 'hold', 'recovery'].map((clip) => `/assets/characters/demoness/demoness-${clip}-v8.webp`),
]);

const sdkSource = `(() => {
  const listeners = new Map();
  const sdk = {
    environment: { i18n: { lang: 'ru' } },
    features: { LoadingAPI: { ready: async () => {} }, GameplayAPI: { start: () => {}, stop: () => {} } },
    getPlayer: async () => ({ isAuthorized: () => false, getData: async () => ({}), setData: async () => {} }),
    isAvailableMethod: async () => true,
    leaderboards: { setScore: async () => {}, getEntries: async () => ({ entries: [] }) },
    adv: { showRewardedVideo: ({ callbacks }) => callbacks.onClose?.(false) },
    on: (name, callback) => { if (!listeners.has(name)) listeners.set(name, new Set()); listeners.get(name).add(callback); },
    off: (name, callback) => listeners.get(name)?.delete(callback)
  };
  window.YaGames = { init: async () => sdk };
})();`;

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
  try {
    await access(candidate);
    executablePath = candidate;
    break;
  } catch { /* continue */ }
}
if (!executablePath) throw new Error('Chrome/Chromium is required to capture Yandex gameplay video.');

function sha256(bytes) {
  return createHash('sha256').update(bytes).digest('hex');
}

async function pathExists(path) {
  try {
    await access(path);
    return true;
  } catch {
    return false;
  }
}

async function makeContactSheet(framePaths, outputPath, sheet) {
  const width = sheet.columns * sheet.tileWidth;
  const height = sheet.rows * sheet.tileHeight;
  const composite = [];
  for (let index = 0; index < framePaths.length; index += 1) {
    const input = await sharp(framePaths[index], { failOn: 'error' })
      .resize(sheet.tileWidth, sheet.tileHeight, { fit: 'cover', position: 'centre', kernel: 'lanczos3' })
      .jpeg({ quality: 88, chromaSubsampling: '4:4:4' })
      .toBuffer();
    composite.push({
      input,
      left: (index % sheet.columns) * sheet.tileWidth,
      top: Math.floor(index / sheet.columns) * sheet.tileHeight,
    });
  }
  await sharp({ create: { width, height, channels: 3, background: '#050302' } })
    .composite(composite)
    .png({ compressionLevel: 9, adaptiveFiltering: false })
    .toFile(outputPath);
}

async function captureVariant(browser, baseUrl, variant, transactionRoot) {
  const frameRoot = join(transactionRoot, `${variant.id}-frames`);
  await mkdir(frameRoot, { recursive: true });
  const framePaths = frameTimes.map((_, index) => join(frameRoot, `frame-${String(index + 1).padStart(2, '0')}.jpg`));
  const videoPath = join(transactionRoot, variant.filename);
  const sheetPath = join(transactionRoot, variant.contactSheet);
  const counters = { consoleErrors: 0, consoleWarnings: 0, pageErrors: 0, requestFailures: 0, httpErrors: 0 };
  const details = { consoleErrors: [], consoleWarnings: [], pageErrors: [], requestFailures: [], httpErrors: [] };
  const expectedResidencyAborts = [];
  const expectedRecordedBlobAborts = [];
  const context = await browser.newContext({
    viewport: variant.viewport,
    deviceScaleFactor: variant.deviceScaleFactor,
    locale: 'ru-RU',
    isMobile: variant.isMobile,
    hasTouch: variant.hasTouch,
    acceptDownloads: true,
  });
  await context.addInitScript(() => {
    const NativeAudioContext = globalThis.AudioContext || globalThis.webkitAudioContext;
    if (!NativeAudioContext || globalThis.__TRAILER_AUDIO_PATCHED__) return;
    globalThis.__TRAILER_AUDIO_PATCHED__ = true;
    const captureInputs = new WeakMap();
    const nativeConnect = AudioNode.prototype.connect;
    AudioNode.prototype.connect = function connectWithCapture(destination, ...args) {
      const result = nativeConnect.call(this, destination, ...args);
      const captureInput = captureInputs.get(this.context);
      if (captureInput && destination === this.context.destination) {
        try { nativeConnect.call(this, captureInput); } catch { /* optional capture mirror */ }
      }
      return result;
    };
    class CapturedAudioContext extends NativeAudioContext {
      constructor(...args) {
        super(...args);
        const sink = this.createMediaStreamDestination();
        const gain = this.createGain();
        gain.gain.value = 4;
        const compressor = this.createDynamicsCompressor();
        compressor.threshold.value = -14;
        compressor.knee.value = 8;
        compressor.ratio.value = 6;
        compressor.attack.value = 0.004;
        compressor.release.value = 0.22;
        nativeConnect.call(gain, compressor);
        nativeConnect.call(compressor, sink);
        captureInputs.set(this, gain);
        globalThis.__TRAILER_AUDIO_STREAM__ = sink.stream;
      }
    }
    Object.defineProperty(globalThis, 'AudioContext', { configurable: true, value: CapturedAudioContext });
    if ('webkitAudioContext' in globalThis) Object.defineProperty(globalThis, 'webkitAudioContext', { configurable: true, value: CapturedAudioContext });
  });
  await context.route('**/sdk.js', (route) => route.fulfill({ status: 200, contentType: 'text/javascript', body: sdkSource }));
  const page = await context.newPage();
  page.on('console', (message) => {
    if (message.type() === 'error') {
      counters.consoleErrors += 1;
      details.consoleErrors.push(message.text());
    }
    if (message.type() === 'warning') {
      counters.consoleWarnings += 1;
      details.consoleWarnings.push(message.text());
    }
  });
  page.on('pageerror', (error) => {
    counters.pageErrors += 1;
    details.pageErrors.push(error.message);
  });
  page.on('requestfailed', (request) => {
    const detail = { url: request.url(), errorText: request.failure()?.errorText ?? 'unknown' };
    if (detail.errorText === 'net::ERR_ABORTED' && detail.url.startsWith('blob:')) {
      expectedRecordedBlobAborts.push(detail);
      return;
    }
    let pathname = '';
    try { pathname = new URL(detail.url).pathname; } catch { /* invalid URL remains unexpected */ }
    if (detail.errorText === 'net::ERR_ABORTED' && residencyManagedCharacterPaths.has(pathname)) {
      expectedResidencyAborts.push({ path: pathname, errorText: detail.errorText });
      return;
    }
    counters.requestFailures += 1;
    details.requestFailures.push(detail);
  });
  page.on('response', (response) => {
    if (response.status() < 400) return;
    counters.httpErrors += 1;
    details.httpErrors.push({ url: response.url(), status: response.status() });
  });
  await page.exposeFunction('__saveTrailerFrame', async (index, base64) => {
    if (!Number.isInteger(index) || index < 0 || index >= framePaths.length) throw new Error(`Unsafe trailer frame index: ${index}`);
    await writeFile(framePaths[index], Buffer.from(base64, 'base64'));
  });

  try {
    await page.goto(`${baseUrl}/?infernoDebug=1`, { waitUntil: 'domcontentloaded' });
    await page.locator('.app-shell[data-app-state="ready"]').waitFor({ timeout: 20_000 });
    await page.waitForLoadState('networkidle');
    const canvas = page.locator('.inferno-presentation canvas');
    const box = await canvas.boundingBox();
    if (!box) throw new Error(`${variant.id}: gameplay canvas is unavailable.`);
    await canvas.click({ position: { x: box.width / 2, y: box.height * 0.55 } });
    await page.waitForFunction(() => globalThis.__TRAILER_AUDIO_STREAM__?.getAudioTracks().length === 1, null, { timeout: 10_000 });
    await page.evaluate(() => window.__INFERNO_E2E__.prepareStageEvidence(7));
    await page.waitForLoadState('networkidle');
    await page.evaluate(() => {
      let pointerId = 1000;
      globalThis.__TRAILER_TAP_TIMER__ = setInterval(() => {
        const target = document.querySelector('.inferno-presentation canvas');
        if (!(target instanceof HTMLCanvasElement)) return;
        const rect = target.getBoundingClientRect();
        pointerId += 1;
        const common = {
          bubbles: true,
          cancelable: true,
          pointerId,
          pointerType: 'mouse',
          isPrimary: true,
          button: 0,
          clientX: rect.left + rect.width * 0.5,
          clientY: rect.top + rect.height * 0.55,
        };
        target.dispatchEvent(new PointerEvent('pointerdown', { ...common, buttons: 1 }));
        target.dispatchEvent(new PointerEvent('pointerup', { ...common, buttons: 0 }));
      }, 140);
    });
    await page.waitForTimeout(1_650);

    const sourceDimensions = await canvas.evaluate((element) => ({ width: element.width, height: element.height }));
    if (sourceDimensions.width !== variant.width || sourceDimensions.height !== variant.height) {
      throw new Error(`${variant.id}: expected ${variant.width}x${variant.height} source canvas, got ${sourceDimensions.width}x${sourceDimensions.height}.`);
    }

    await page.evaluate(({ captureDuration, captureFrameTimes, width, height, camera, filename }) => {
      const source = document.querySelector('.inferno-presentation canvas');
      if (!(source instanceof HTMLCanvasElement)) throw new Error('Gameplay canvas is unavailable.');
      const output = document.createElement('canvas');
      output.width = width;
      output.height = height;
      const context = output.getContext('2d', { alpha: false, desynchronized: true });
      if (!context) throw new Error('Trailer compositor is unavailable.');
      const videoStream = output.captureStream(30);
      const audioTrack = globalThis.__TRAILER_AUDIO_STREAM__?.getAudioTracks()[0];
      if (!audioTrack) throw new Error('Captured game audio is unavailable.');
      videoStream.addTrack(audioTrack);
      const requestedMime = 'video/mp4;codecs=avc1.42E01E,mp4a.40.2';
      if (!MediaRecorder.isTypeSupported(requestedMime)) throw new Error(`Unsupported trailer MIME: ${requestedMime}`);
      const chunks = [];
      const framePromises = [];
      const capturedFrames = new Set();
      const recorder = new MediaRecorder(videoStream, {
        mimeType: requestedMime,
        videoBitsPerSecond: 8_000_000,
        audioBitsPerSecond: 128_000,
      });
      recorder.addEventListener('dataavailable', (event) => {
        if (event.data.size > 0) chunks.push(event.data);
      });

      const clamp = (value, min, max) => Math.max(min, Math.min(max, value));
      const smooth = (value) => {
        const t = clamp(value, 0, 1);
        return t * t * (3 - 2 * t);
      };
      const mix = (from, to, progress) => from + (to - from) * progress;
      const envelope = (seconds, start, peakStart, peakEnd, end) => {
        if (seconds <= start || seconds >= end) return 0;
        if (seconds < peakStart) return smooth((seconds - start) / Math.max(0.001, peakStart - start));
        if (seconds <= peakEnd) return 1;
        return 1 - smooth((seconds - peakEnd) / Math.max(0.001, end - peakEnd));
      };
      const fadePulse = (seconds, center, radius) => 1 - smooth(Math.abs(seconds - center) / radius);
      const cameraAt = (seconds) => {
        let focus = camera.inferno;
        let strength = envelope(seconds, 0, 0.05, 0.7, 0.9);
        const servantStrength = envelope(seconds, 3.25, 4.1, 6.65, 6.95);
        if (servantStrength > strength) { focus = camera.servant; strength = servantStrength; }
        const wardenStrength = envelope(seconds, 9.35, 10.1, 15.25, 15.55);
        if (wardenStrength > strength) { focus = camera.warden; strength = wardenStrength; }
        const finaleStrength = envelope(seconds, 17.0, 18.1, captureDuration, captureDuration + 0.01);
        if (finaleStrength > strength) { focus = camera.inferno; strength = finaleStrength; }
        return {
          zoom: mix(1, focus.zoom, strength),
          x: mix(0.5, focus.x, strength),
          y: mix(0.5, focus.y, strength),
        };
      };

      const startedAt = performance.now();
      let animationFrame = 0;
      const draw = () => {
        const seconds = Math.max(0, (performance.now() - startedAt) / 1000);
        const view = cameraAt(seconds);
        const sourceWidth = source.width / view.zoom;
        const sourceHeight = source.height / view.zoom;
        const sourceX = clamp(source.width * view.x - sourceWidth / 2, 0, source.width - sourceWidth);
        const sourceY = clamp(source.height * view.y - sourceHeight / 2, 0, source.height - sourceHeight);
        context.fillStyle = '#050302';
        context.fillRect(0, 0, width, height);
        context.drawImage(source, sourceX, sourceY, sourceWidth, sourceHeight, 0, 0, width, height);
        const fade = Math.max(
          fadePulse(seconds, 1.0, 0.22),
          fadePulse(seconds, 7.02, 0.22),
          fadePulse(seconds, 15.62, 0.22),
        );
        if (fade > 0) {
          context.fillStyle = `rgba(3,1,1,${fade.toFixed(4)})`;
          context.fillRect(0, 0, width, height);
        }
        for (let index = 0; index < captureFrameTimes.length; index += 1) {
          if (capturedFrames.has(index) || seconds < captureFrameTimes[index]) continue;
          capturedFrames.add(index);
          const base64 = output.toDataURL('image/jpeg', 0.9).split(',')[1];
          framePromises.push(globalThis.__saveTrailerFrame(index, base64));
        }
        if (seconds <= captureDuration + 0.5) animationFrame = requestAnimationFrame(draw);
      };
      draw();
      recorder.start(500);

      globalThis.__TRAILER_CAPTURE__ = Object.freeze({
        startedAt,
        async stopAndDownload() {
          if (recorder.state === 'inactive') throw new Error('Trailer recorder is already inactive.');
          const stopped = new Promise((resolve, reject) => {
            recorder.addEventListener('error', () => reject(recorder.error || new Error('MediaRecorder failed.')), { once: true });
            recorder.addEventListener('stop', resolve, { once: true });
          });
          recorder.stop();
          await stopped;
          cancelAnimationFrame(animationFrame);
          clearInterval(globalThis.__TRAILER_TAP_TIMER__);
          await Promise.all(framePromises);
          const blob = new Blob(chunks, { type: recorder.mimeType });
          const audioContext = new AudioContext();
          const decodedAudio = await audioContext.decodeAudioData((await blob.arrayBuffer()).slice(0));
          let audioSquareSum = 0;
          let audioPeak = 0;
          let audioSamples = 0;
          for (let channel = 0; channel < decodedAudio.numberOfChannels; channel += 1) {
            const samples = decodedAudio.getChannelData(channel);
            for (let index = 0; index < samples.length; index += 64) {
              const value = Math.abs(samples[index]);
              audioSquareSum += value * value;
              audioPeak = Math.max(audioPeak, value);
              audioSamples += 1;
            }
          }
          const audio = {
            channels: decodedAudio.numberOfChannels,
            sampleRate: decodedAudio.sampleRate,
            duration: decodedAudio.duration,
            rms: Math.sqrt(audioSquareSum / Math.max(1, audioSamples)),
            peak: audioPeak,
          };
          await audioContext.close();
          const url = URL.createObjectURL(blob);
          const metadata = await new Promise((resolve, reject) => {
            const video = document.createElement('video');
            video.preload = 'metadata';
            video.addEventListener('loadedmetadata', () => resolve({
              width: video.videoWidth,
              height: video.videoHeight,
              duration: video.duration,
            }), { once: true });
            video.addEventListener('error', () => reject(new Error('Recorded MP4 metadata could not be decoded.')), { once: true });
            video.src = url;
          });
          const link = document.createElement('a');
          link.href = url;
          link.download = filename;
          document.body.append(link);
          link.click();
          link.remove();
          setTimeout(() => URL.revokeObjectURL(url), 5_000);
          return {
            ...metadata,
            mimeType: recorder.mimeType,
            bytes: blob.size,
            streamTracks: videoStream.getTracks().map((track) => track.kind).sort(),
            capturedFrameCount: capturedFrames.size,
            audio,
          };
        },
      });
    }, {
      captureDuration: durationSeconds,
      captureFrameTimes: frameTimes,
      width: variant.width,
      height: variant.height,
      camera: variant.camera,
      filename: variant.filename,
    });

    await page.evaluate(async ({ captureDuration }) => {
      const waitUntil = async (seconds) => {
        const delay = globalThis.__TRAILER_CAPTURE__.startedAt + seconds * 1000 - performance.now();
        if (delay > 0) await new Promise((resolve) => setTimeout(resolve, delay));
      };
      const restart = () => {
        if (!window.__INFERNO_E2E__.endRun()) throw new Error('Trailer run could not end for the next montage beat.');
        const button = document.querySelector('[data-restart]');
        if (!(button instanceof HTMLButtonElement)) throw new Error('Trailer restart control is unavailable.');
        button.click();
      };
      await waitUntil(0.98);
      restart();
      await waitUntil(1.8);
      window.__INFERNO_E2E__.reachStage(2);
      await waitUntil(2.45);
      window.__INFERNO_E2E__.reachStage(3);
      await waitUntil(3.45);
      window.__INFERNO_E2E__.advanceActive(window.__INFERNO_E2E__.snapshot().state.encounterClocks.servantMs ?? 0);
      await waitUntil(7.02);
      restart();
      window.__INFERNO_E2E__.reachStage(4);
      await waitUntil(8.45);
      window.__INFERNO_E2E__.reachStage(5);
      await waitUntil(9.55);
      window.__INFERNO_E2E__.advanceActive(window.__INFERNO_E2E__.snapshot().state.encounterClocks.demonessMs ?? 0);
      await waitUntil(15.62);
      restart();
      window.__INFERNO_E2E__.reachStage(6);
      await waitUntil(17.25);
      window.__INFERNO_E2E__.reachStage(7);
      await waitUntil(captureDuration);
    }, { captureDuration: durationSeconds });

    const downloadPromise = page.waitForEvent('download', { timeout: 20_000 });
    const metadata = await page.evaluate(() => globalThis.__TRAILER_CAPTURE__.stopAndDownload());
    const download = await downloadPromise;
    await download.saveAs(videoPath);
    if (metadata.width !== variant.width || metadata.height !== variant.height) {
      throw new Error(`${variant.id}: decoded MP4 is ${metadata.width}x${metadata.height}, expected ${variant.width}x${variant.height}.`);
    }
    if (!(metadata.duration >= 22 && metadata.duration <= 23.5)) {
      throw new Error(`${variant.id}: decoded MP4 duration ${metadata.duration}s is outside the 22–23.5s gate.`);
    }
    if (!/video\/mp4/iu.test(metadata.mimeType) || !/avc1/iu.test(metadata.mimeType) || !/mp4a/iu.test(metadata.mimeType)) {
      throw new Error(`${variant.id}: expected H.264/AAC MP4, got ${metadata.mimeType}.`);
    }
    if (JSON.stringify(metadata.streamTracks) !== JSON.stringify(['audio', 'video'])) {
      throw new Error(`${variant.id}: recorded stream must contain exactly audio and video, got ${JSON.stringify(metadata.streamTracks)}.`);
    }
    if (metadata.audio.channels !== 2 || metadata.audio.sampleRate !== 48_000
      || metadata.audio.duration < 22 || metadata.audio.duration > 23.5
      || metadata.audio.rms < 0.005 || metadata.audio.peak < 0.04 || metadata.audio.peak > 1) {
      throw new Error(`${variant.id}: recorded game-audio gate failed: ${JSON.stringify(metadata.audio)}.`);
    }
    if (metadata.capturedFrameCount !== frameTimes.length) {
      throw new Error(`${variant.id}: captured ${metadata.capturedFrameCount}/${frameTimes.length} review frames.`);
    }
    const bytes = await readFile(videoPath);
    if (bytes.length <= 0 || bytes.length > maximumBytes || bytes.subarray(4, 12).toString('ascii') !== 'ftypisom') {
      throw new Error(`${variant.id}: MP4 byte/header/size validation failed (${bytes.length} bytes).`);
    }
    if (Object.values(counters).some((count) => count !== 0)) {
      throw new Error(`${variant.id}: browser/network failures: ${JSON.stringify({ counters, details })}`);
    }
    if (expectedResidencyAborts.length > residencyManagedCharacterPaths.size
      || new Set(expectedResidencyAborts.map((entry) => entry.path)).size !== expectedResidencyAborts.length) {
      throw new Error(`${variant.id}: unexpected character residency-abort pattern: ${JSON.stringify(expectedResidencyAborts)}`);
    }
    if (expectedRecordedBlobAborts.length > 32) {
      throw new Error(`${variant.id}: unexpected recorded-blob abort count: ${expectedRecordedBlobAborts.length}.`);
    }
    for (const framePath of framePaths) {
      const frame = await sharp(framePath, { failOn: 'error' }).metadata();
      if (frame.width !== variant.width || frame.height !== variant.height || frame.format !== 'jpeg') {
        throw new Error(`${variant.id}: invalid review frame ${framePath}.`);
      }
    }
    await makeContactSheet(framePaths, sheetPath, variant.sheet);
    const sheetBytes = await readFile(sheetPath);
    const sheetMetadata = await sharp(sheetBytes, { failOn: 'error' }).metadata();
    return {
      id: variant.id,
      filename: variant.filename,
      width: variant.width,
      height: variant.height,
      aspectRatio: variant.width > variant.height ? '16:9' : '9:16',
      bytes: bytes.length,
      sha256: sha256(bytes),
      durationSeconds: metadata.duration,
      mimeType: metadata.mimeType,
      codecs: ['H.264', 'AAC'],
      audioTrack: true,
      audio: metadata.audio,
      videoTrack: true,
      frameRate: 30,
      consoleErrors: counters.consoleErrors,
      consoleWarnings: counters.consoleWarnings,
      pageErrors: counters.pageErrors,
      requestFailures: counters.requestFailures,
      httpErrors: counters.httpErrors,
      expectedResidencyAborts,
      expectedRecordedBlobAborts: expectedRecordedBlobAborts.length,
      contactSheet: {
        filename: variant.contactSheet,
        width: sheetMetadata.width,
        height: sheetMetadata.height,
        bytes: sheetBytes.length,
        sha256: sha256(sheetBytes),
      },
    };
  } finally {
    await context.close();
  }
}

await mkdir(mediaRoot, { recursive: true });
await mkdir(visualReferenceRoot, { recursive: true });
const transactionRoot = await mkdtemp(join(mediaRoot, '.gameplay-video-capture-'));
let server;
let browser;
try {
  for (const variant of variants) {
    const targets = [join(mediaRoot, variant.filename), join(visualReferenceRoot, variant.contactSheet)];
    if (!replaceExisting && (await Promise.all(targets.map(pathExists))).some(Boolean)) {
      throw new Error(`${variant.id}: a versioned gameplay-video artifact already exists; pass --replace only for an explicitly approved replacement.`);
    }
  }
  const buildManifestPath = join(gameRoot, 'dist-e2e/build-manifest.json');
  const buildManifestBytes = await readFile(buildManifestPath);
  const buildManifest = JSON.parse(buildManifestBytes.toString('utf8'));
  const identity = await buildIdentity();
  if (buildManifest.target !== 'yandex' || buildManifest.testDriver !== true) {
    throw new Error('Gameplay-video capture requires npm run build:yandex:test.');
  }
  if (buildManifest.commitSha !== identity.commitSha
    || buildManifest.sourceFingerprint !== identity.sourceFingerprint
    || buildManifest.clean !== identity.clean) {
    throw new Error('Gameplay-video capture refuses a stale instrumented build; run npm run build:yandex:test.');
  }
  await verifyBuildPayload(join(gameRoot, 'dist-e2e'), buildManifest);
  server = await startVerifiedStaticServer(join(gameRoot, 'dist-e2e'));
  browser = await chromium.launch({ executablePath, headless: true });
  const files = [];
  for (const variant of variants) files.push(await captureVariant(browser, server.baseUrl, variant, transactionRoot));
  await browser.close();
  browser = undefined;

  const manifest = {
    schemaVersion: 1,
    kind: 'yandex-gameplay-video',
    version: '1.0.0',
    generatedAt: new Date().toISOString(),
    yandexConstraints: {
      maximumDurationSeconds: 28,
      maximumBytes,
      format: 'MP4',
      horizontalAspectRatio: '16:9',
      verticalAspectRatio: '9:16',
      minimumHeight: 400,
      gameplayDurationShareMinimum: 0.7,
    },
    editorial: {
      durationSeconds,
      locale: 'text-free/shared-ru-en',
      gameplayDurationShare: 0.946,
      browserOrPlatformUiVisible: false,
      debugOverlayVisible: false,
      seamlessLoop: true,
      timeline,
    },
    captureBuild: {
      manifest: 'dist-e2e/build-manifest.json',
      buildId: buildManifest.buildId,
      commitSha: buildManifest.commitSha,
      sourceFingerprint: buildManifest.sourceFingerprint,
      target: buildManifest.target,
      testDriver: buildManifest.testDriver,
      manifestSha256: sha256(buildManifestBytes),
    },
    files,
    consoleUploadStatus: 'NOT_RUN',
  };
  const manifestPath = join(transactionRoot, manifestName);
  await writeFile(manifestPath, `${JSON.stringify(manifest, null, 2)}\n`);
  JSON.parse(await readFile(manifestPath, 'utf8'));

  for (const variant of variants) {
    if (replaceExisting) {
      await rm(join(mediaRoot, variant.filename), { force: true });
      await rm(join(visualReferenceRoot, variant.contactSheet), { force: true });
    }
    await rename(join(transactionRoot, variant.filename), join(mediaRoot, variant.filename));
    await rename(join(transactionRoot, variant.contactSheet), join(visualReferenceRoot, variant.contactSheet));
  }
  if (replaceExisting) await rm(join(mediaRoot, manifestName), { force: true });
  await rename(manifestPath, join(mediaRoot, manifestName));
  console.log(`Yandex gameplay video PASS (${files.map((file) => `${file.id} ${file.durationSeconds.toFixed(3)}s ${file.bytes}B`).join('; ')})`);
} finally {
  if (browser) await browser.close().catch(() => {});
  if (server) await server.stop().catch(() => {});
  await rm(transactionRoot, { recursive: true, force: true }).catch(() => {});
}
