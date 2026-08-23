import { createHash } from 'node:crypto';
import { spawnSync } from 'node:child_process';
import {
  access, lstat, mkdir, mkdtemp, readFile, realpath, rename, rm, stat, writeFile,
} from 'node:fs/promises';
import {
  basename, dirname, extname, isAbsolute, join, relative, resolve,
} from 'node:path';
import { arch, platform, release } from 'node:os';
import { buildIdentity, gameRoot } from './lib.mjs';

const evidenceRootRaw = process.env.INFERNO_CYCLE09_EVIDENCE_DIR
  || join(gameRoot, 'reports', 'yandex-release-cycle-09-working');
const evidenceRoot = isAbsolute(evidenceRootRaw) ? evidenceRootRaw : resolve(gameRoot, evidenceRootRaw);
const localAppData = process.env.LOCALAPPDATA || '';
const programFiles = process.env.ProgramFiles || 'C:/Program Files';
const programFilesX86 = process.env['ProgramFiles(x86)'] || 'C:/Program Files (x86)';
const snapshotRoot = join(evidenceRoot, 'external-evidence-snapshots');
const sha256 = (bytes) => createHash('sha256').update(bytes).digest('hex');
const slash = (value) => value.replaceAll('\\', '/');

const browserDefinitions = [
  {
    id: 'chrome',
    label: 'Google Chrome',
    reportEnvironmentVariable: 'INFERNO_CHROME_RUN_REPORT',
    candidates: [
      `${programFilesX86}/Google/Chrome/Application/chrome.exe`,
      `${programFiles}/Google/Chrome/Application/chrome.exe`,
      `${localAppData}/Google/Chrome/Application/chrome.exe`,
      '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome',
      '/usr/bin/google-chrome',
    ],
  },
  {
    id: 'yandex-browser',
    label: 'Yandex Browser',
    reportEnvironmentVariable: 'INFERNO_YANDEX_BROWSER_RUN_REPORT',
    candidates: [
      `${localAppData}/Yandex/YandexBrowser/Application/browser.exe`,
      `${programFilesX86}/Yandex/YandexBrowser/Application/browser.exe`,
      `${programFiles}/Yandex/YandexBrowser/Application/browser.exe`,
      '/Applications/Yandex.app/Contents/MacOS/Yandex',
    ],
  },
  {
    id: 'firefox',
    label: 'Mozilla Firefox',
    reportEnvironmentVariable: 'INFERNO_FIREFOX_RUN_REPORT',
    candidates: [
      `${programFiles}/Mozilla Firefox/firefox.exe`,
      `${programFilesX86}/Mozilla Firefox/firefox.exe`,
      '/Applications/Firefox.app/Contents/MacOS/firefox',
      '/usr/bin/firefox',
    ],
  },
  {
    id: 'opera',
    label: 'Opera',
    reportEnvironmentVariable: 'INFERNO_OPERA_RUN_REPORT',
    candidates: [
      `${localAppData}/Programs/Opera/launcher.exe`,
      `${programFiles}/Opera/launcher.exe`,
      `${programFilesX86}/Opera/launcher.exe`,
      '/Applications/Opera.app/Contents/MacOS/Opera',
      '/usr/bin/opera',
    ],
  },
  {
    id: 'safari',
    label: 'Apple Safari',
    reportEnvironmentVariable: 'INFERNO_SAFARI_RUN_REPORT',
    candidates: ['/Applications/Safari.app/Contents/MacOS/Safari'],
  },
];

async function firstExisting(candidates) {
  for (const candidate of candidates.filter(Boolean)) {
    try {
      await access(candidate);
      return slash(candidate);
    } catch { /* continue */ }
  }
  return null;
}

function versionOf(executablePath) {
  if (!executablePath) return null;
  const result = platform() === 'win32'
    ? spawnSync('powershell.exe', [
        '-NoProfile',
        '-Command',
        '(Get-Item -LiteralPath $env:INFERNO_BROWSER_FILE).VersionInfo.ProductVersion',
      ], {
        encoding: 'utf8',
        timeout: 3_000,
        env: { ...process.env, INFERNO_BROWSER_FILE: executablePath },
      })
    : spawnSync(executablePath, ['--version'], { encoding: 'utf8', timeout: 3_000 });
  const text = `${result.stdout || ''}${result.stderr || ''}`.trim();
  return result.status === 0 && text ? text : null;
}

const identity = await buildIdentity();
const releaseManifestBytes = await readFile(join(gameRoot, 'dist/build-manifest.json'));
const releaseManifest = JSON.parse(releaseManifestBytes.toString('utf8'));
const releaseManifestSha256 = sha256(releaseManifestBytes);

function isPlainObject(value) {
  return value !== null && typeof value === 'object' && !Array.isArray(value);
}

function exactKeys(value, keys) {
  return isPlainObject(value)
    && JSON.stringify(Object.keys(value).sort()) === JSON.stringify([...keys].sort());
}

function parseTimestamp(value) {
  if (typeof value !== 'string') return null;
  const parsed = Date.parse(value);
  return Number.isFinite(parsed) ? parsed : null;
}

function timingErrors(value, label, parentStart = null, parentEnd = null) {
  const errors = [];
  const startedAt = parseTimestamp(value?.startedAt);
  const completedAt = parseTimestamp(value?.completedAt);
  if (startedAt === null || completedAt === null || completedAt < startedAt) {
    errors.push(`${label} timestamps are invalid or reversed`);
    return errors;
  }
  const elapsed = completedAt - startedAt;
  if (!Number.isFinite(value?.durationMs) || value.durationMs < 0 || Math.abs(value.durationMs - elapsed) > 2_000) {
    errors.push(`${label} durationMs does not match its timestamps`);
  }
  if ((parentStart !== null && startedAt < parentStart) || (parentEnd !== null && completedAt > parentEnd)) {
    errors.push(`${label} timestamps escape their parent interval`);
  }
  if (completedAt > Date.now() + 5 * 60_000) errors.push(`${label} completion timestamp is implausibly in the future`);
  return errors;
}

function validAttemptId(value) {
  return typeof value === 'string' && /^[A-Za-z0-9][A-Za-z0-9._:-]{15,127}$/u.test(value);
}

function exactBuildErrors(document, expectedKind) {
  const errors = [];
  if (document?.schemaVersion !== 1) errors.push('schemaVersion must equal 1');
  if (document?.kind !== expectedKind) errors.push(`kind must equal ${expectedKind}`);
  if (document?.status !== 'PASS') errors.push('terminal status must equal PASS');
  if (document?.cycle !== '09') errors.push('cycle must equal 09');
  if (document?.build?.buildId !== identity.buildId) errors.push('buildId mismatch');
  if (document?.build?.commitSha !== identity.commitSha) errors.push('commitSha mismatch');
  if (document?.build?.sourceFingerprint !== identity.sourceFingerprint) errors.push('sourceFingerprint mismatch');
  if (document?.build?.clean !== identity.clean) errors.push('clean-build identity mismatch');
  if (document?.build?.clean !== true) errors.push('external release evidence must be bound to a clean build');
  if (document?.build?.target !== 'yandex') errors.push('target must equal yandex');
  if (document?.build?.testDriver !== false) errors.push('external release evidence must use build.testDriver=false');
  if (document?.build?.buildManifestSha256 !== releaseManifestSha256) errors.push('release build-manifest SHA mismatch');
  if (releaseManifest?.buildId !== identity.buildId || releaseManifest?.commitSha !== identity.commitSha
    || releaseManifest?.sourceFingerprint !== identity.sourceFingerprint || releaseManifest?.clean !== identity.clean
    || releaseManifest?.version !== '1.0.0' || releaseManifest?.target !== 'yandex' || releaseManifest?.testDriver !== false) {
    errors.push('local dist/build-manifest.json is not the exact clean production build identity');
  }
  return errors;
}

function safeArtifactPath(value) {
  return typeof value === 'string'
    && value.length > 0
    && value.length <= 240
    && !value.includes('\\')
    && /^(?!\/)(?!.*(?:^|\/)\.\.(?:\/|$))[A-Za-z0-9._+\-/]+$/u.test(value);
}

function pngDimensions(bytes) {
  const signature = Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]);
  if (bytes.length < 45 || !bytes.subarray(0, 8).equals(signature)) throw new Error('PNG signature is invalid');
  if (bytes.readUInt32BE(8) !== 13 || bytes.subarray(12, 16).toString('ascii') !== 'IHDR') {
    throw new Error('PNG IHDR is missing or malformed');
  }
  const width = bytes.readUInt32BE(16);
  const height = bytes.readUInt32BE(20);
  if (width < 1 || height < 1 || width > 16_384 || height > 16_384) throw new Error('PNG dimensions are invalid');
  let offset = 8;
  let sawImageData = false;
  let sawEnd = false;
  while (offset < bytes.length) {
    if (offset + 12 > bytes.length) throw new Error('PNG chunk header is truncated');
    const length = bytes.readUInt32BE(offset);
    const type = bytes.subarray(offset + 4, offset + 8).toString('ascii');
    const next = offset + 12 + length;
    if (!/^[A-Za-z]{4}$/u.test(type) || next > bytes.length) throw new Error('PNG chunk structure is invalid');
    if (type === 'IDAT' && length > 0) sawImageData = true;
    if (type === 'IEND') {
      if (length !== 0 || next !== bytes.length) throw new Error('PNG IEND is malformed or not terminal');
      sawEnd = true;
    }
    offset = next;
  }
  if (!sawImageData || !sawEnd) throw new Error('PNG has no complete IDAT/IEND structure');
  return { width, height };
}

class ArtifactRegistry {
  constructor(reportPath) {
    this.reportPath = resolve(reportPath);
    this.root = dirname(this.reportPath);
    this.paths = new Map();
    this.hashes = new Map();
    this.artifacts = [];
  }

  async read(artifact, label, options = {}) {
    const errors = [];
    if (!isPlainObject(artifact) || !safeArtifactPath(artifact.path)) {
      return { errors: [`${label} path must be a safe report-relative path`] };
    }
    if (!Number.isInteger(artifact.bytes) || artifact.bytes <= 0 || !/^[a-f0-9]{64}$/u.test(artifact.sha256 ?? '')) {
      return { errors: [`${label} bytes/SHA-256 are invalid`] };
    }
    const base = options.basePath ? dirname(resolve(options.basePath)) : this.root;
    const path = resolve(base, artifact.path);
    const relation = slash(relative(this.root, path));
    if (relation === '..' || relation.startsWith('../') || isAbsolute(relation)) {
      return { errors: [`${label} escapes its evidence directory`] };
    }
    if (this.paths.has(relation)) errors.push(`${label} reuses artifact path already bound by ${this.paths.get(relation)}`);
    if (this.hashes.has(artifact.sha256)) errors.push(`${label} reuses artifact SHA-256 already bound by ${this.hashes.get(artifact.sha256)}`);
    if (options.png && extname(path).toLowerCase() !== '.png') errors.push(`${label} must use a .png filename`);
    if (options.json && extname(path).toLowerCase() !== '.json') errors.push(`${label} must use a .json filename`);
    let bytes;
    try {
      const fileInfo = await lstat(path);
      if (!fileInfo.isFile() || fileInfo.isSymbolicLink()) return { errors: [...errors, `${label} must be a regular non-symlink file`] };
      const [actualRoot, actualPath] = await Promise.all([realpath(this.root), realpath(path)]);
      const actualRelation = slash(relative(actualRoot, actualPath));
      if (actualRelation === '..' || actualRelation.startsWith('../') || isAbsolute(actualRelation)) {
        return { errors: [...errors, `${label} resolves outside its evidence directory`] };
      }
      bytes = await readFile(path);
    } catch (error) {
      return { errors: [...errors, `${label} is unreadable: ${error?.code ?? String(error)}`] };
    }
    const actualSha = sha256(bytes);
    if (bytes.length !== artifact.bytes) errors.push(`${label} byte count mismatch`);
    if (actualSha !== artifact.sha256) errors.push(`${label} SHA-256 mismatch`);
    let dimensions;
    if (options.png) {
      try {
        dimensions = pngDimensions(bytes);
        if (dimensions.width < (options.minWidth ?? 1) || dimensions.height < (options.minHeight ?? 1)) {
          errors.push(`${label} PNG dimensions ${dimensions.width}x${dimensions.height} are below the required minimum`);
        }
        if (artifact.width !== undefined && artifact.width !== dimensions.width) errors.push(`${label} declared PNG width mismatch`);
        if (artifact.height !== undefined && artifact.height !== dimensions.height) errors.push(`${label} declared PNG height mismatch`);
      } catch (error) {
        errors.push(`${label} ${error.message}`);
      }
    }
    if (errors.length === 0) {
      this.paths.set(relation, label);
      this.hashes.set(actualSha, label);
      this.artifacts.push({
        label,
        id: options.id ?? artifact.id ?? label,
        sourcePath: path,
        sourceRelativePath: relation,
        bytes,
        byteCount: bytes.length,
        sha256: actualSha,
        mediaType: options.png ? 'image/png' : (options.json ? 'application/json' : 'application/octet-stream'),
        dimensions,
      });
    }
    return { errors, bytes, path, dimensions };
  }

  addVerifiedBytes(path, bytes, label, id, mediaType = 'application/octet-stream') {
    const absolutePath = resolve(path);
    const pathKey = slash(absolutePath);
    const digest = sha256(bytes);
    const errors = [];
    if (this.paths.has(pathKey)) errors.push(`${label} reuses artifact path already bound by ${this.paths.get(pathKey)}`);
    if (this.hashes.has(digest)) errors.push(`${label} reuses artifact SHA-256 already bound by ${this.hashes.get(digest)}`);
    if (errors.length === 0) {
      this.paths.set(pathKey, label);
      this.hashes.set(digest, label);
      this.artifacts.push({
        label,
        id,
        sourcePath: absolutePath,
        sourceRelativePath: slash(relative(this.root, absolutePath)),
        bytes,
        byteCount: bytes.length,
        sha256: digest,
        mediaType,
      });
    }
    return errors;
  }
}

function safeSnapshotSegment(value) {
  return String(value).toLowerCase().replace(/[^a-z0-9._-]+/gu, '-').replace(/^-+|-+$/gu, '') || 'evidence';
}

async function verifyExistingSnapshot(destination, expected) {
  const manifestPath = join(destination, 'snapshot-manifest.json');
  const bytes = await readFile(manifestPath);
  const expectedBytes = Buffer.from(`${JSON.stringify(expected)}\n`);
  if (!bytes.equals(expectedBytes)) throw new Error(`immutable snapshot manifest was modified at ${slash(destination)}`);
  const actual = JSON.parse(bytes.toString('utf8'));
  if (JSON.stringify(actual) !== JSON.stringify(expected)) throw new Error(`immutable snapshot collision at ${slash(destination)}`);
  const reportBytes = await readFile(join(destination, expected.report.snapshotFile));
  if (reportBytes.length !== expected.report.bytes || sha256(reportBytes) !== expected.report.sha256) {
    throw new Error(`immutable report snapshot was modified at ${slash(destination)}`);
  }
  for (const artifact of expected.artifacts) {
    const artifactBytes = await readFile(join(destination, artifact.snapshotFile));
    if (artifactBytes.length !== artifact.bytes || sha256(artifactBytes) !== artifact.sha256) {
      throw new Error(`immutable artifact snapshot was modified at ${slash(destination)}`);
    }
  }
}

async function promoteSnapshot(category, reportPath, reportBytes, artifacts) {
  const reportSha = sha256(reportBytes);
  const categorySegment = safeSnapshotSegment(category);
  const destination = join(snapshotRoot, categorySegment, reportSha);
  const reportFile = `report-${reportSha}.json`;
  const artifactEntries = artifacts.map((artifact, index) => {
    const extension = artifact.mediaType === 'image/png' ? '.png' : artifact.mediaType === 'application/json' ? '.json' : (extname(artifact.sourcePath) || '.bin');
    const id = safeSnapshotSegment(artifact.id || `artifact-${index + 1}`);
    return {
      id: artifact.id,
      label: artifact.label,
      sourceRelativePath: artifact.sourceRelativePath,
      snapshotFile: `artifacts/${String(index + 1).padStart(2, '0')}-${id}-${artifact.sha256}${extension}`,
      mediaType: artifact.mediaType,
      bytes: artifact.byteCount,
      sha256: artifact.sha256,
      ...(artifact.dimensions ? { width: artifact.dimensions.width, height: artifact.dimensions.height } : {}),
    };
  });
  const snapshot = {
    schemaVersion: 1,
    kind: 'immutable-external-evidence-snapshot',
    cycle: '09',
    category,
    report: {
      sourceName: basename(reportPath),
      snapshotFile: reportFile,
      bytes: reportBytes.length,
      sha256: reportSha,
    },
    artifacts: artifactEntries,
  };

  await mkdir(dirname(destination), { recursive: true });
  try {
    await verifyExistingSnapshot(destination, snapshot);
  } catch (error) {
    if (error?.code !== 'ENOENT') throw error;
    const stageRoot = await mkdtemp(join(dirname(destination), `.snapshot-stage-${reportSha}-`));
    const stageDestination = join(stageRoot, reportSha);
    try {
      await mkdir(join(stageDestination, 'artifacts'), { recursive: true });
      await writeFile(join(stageDestination, reportFile), reportBytes, { flag: 'wx' });
      for (let index = 0; index < artifacts.length; index += 1) {
        await writeFile(join(stageDestination, artifactEntries[index].snapshotFile), artifacts[index].bytes, { flag: 'wx' });
      }
      await writeFile(join(stageDestination, 'snapshot-manifest.json'), `${JSON.stringify(snapshot)}\n`, { encoding: 'utf8', flag: 'wx' });
      try {
        await rename(stageDestination, destination);
      } catch (renameError) {
        if (!['EEXIST', 'ENOTEMPTY', 'EPERM'].includes(renameError?.code)) throw renameError;
        await verifyExistingSnapshot(destination, snapshot);
      }
    } finally {
      await rm(stageRoot, { recursive: true, force: true });
    }
  }
  await verifyExistingSnapshot(destination, snapshot);
  const snapshotManifestBytes = Buffer.from(`${JSON.stringify(snapshot)}\n`);
  return {
    root: slash(relative(evidenceRoot, destination)),
    manifest: {
      path: slash(relative(evidenceRoot, join(destination, 'snapshot-manifest.json'))),
      bytes: snapshotManifestBytes.length,
      sha256: sha256(snapshotManifestBytes),
    },
    report: {
      path: slash(relative(evidenceRoot, join(destination, reportFile))),
      bytes: reportBytes.length,
      sha256: reportSha,
    },
    artifacts: artifactEntries.map((artifact) => ({
      id: artifact.id,
      path: slash(relative(evidenceRoot, join(destination, artifact.snapshotFile))),
      mediaType: artifact.mediaType,
      bytes: artifact.bytes,
      sha256: artifact.sha256,
      ...(artifact.width ? { width: artifact.width, height: artifact.height } : {}),
    })),
  };
}

async function loadEvidence(path, expectedKind, category, validate, explicitlySupplied) {
  const normalizedPath = slash(relative(gameRoot, path));
  let bytes;
  try {
    const fileInfo = await lstat(path);
    if (!fileInfo.isFile() || fileInfo.isSymbolicLink()) {
      return {
        supplied: true,
        missing: false,
        valid: false,
        path: normalizedPath,
        errors: ['evidence report must be a regular non-symlink file'],
      };
    }
    bytes = await readFile(path);
  } catch (error) {
    const missing = error?.code === 'ENOENT' && !explicitlySupplied;
    return {
      supplied: explicitlySupplied || !missing,
      missing,
      valid: false,
      path: normalizedPath,
      errors: [error?.code === 'ENOENT' ? 'evidence file is missing' : `evidence read failed: ${String(error)}`],
    };
  }
  let document;
  try {
    document = JSON.parse(bytes.toString('utf8'));
  } catch {
    return {
      supplied: true,
      missing: false,
      valid: false,
      path: normalizedPath,
      bytes: bytes.length,
      sha256: sha256(bytes),
      errors: ['invalid JSON'],
    };
  }
  const registry = new ArtifactRegistry(path);
  let validation;
  try {
    validation = await validate(document, path, registry);
  } catch (error) {
    return {
      supplied: true,
      missing: false,
      valid: false,
      path: normalizedPath,
      bytes: bytes.length,
      sha256: sha256(bytes),
      errors: [`validation exception: ${error?.stack || String(error)}`],
    };
  }
  const errors = [
    ...(extname(path).toLowerCase() === '.json' ? [] : ['evidence report filename must end in .json']),
    ...exactBuildErrors(document, expectedKind),
    ...(validation?.errors ?? []),
  ];
  if (errors.length > 0) {
    return {
      supplied: true,
      missing: false,
      valid: false,
      path: normalizedPath,
      bytes: bytes.length,
      sha256: sha256(bytes),
      errors,
    };
  }
  let snapshot;
  try {
    snapshot = await promoteSnapshot(category, path, bytes, registry.artifacts);
  } catch (error) {
    return {
      supplied: true,
      missing: false,
      valid: false,
      path: normalizedPath,
      bytes: bytes.length,
      sha256: sha256(bytes),
      errors: [`snapshot promotion failed: ${error?.stack || String(error)}`],
    };
  }
  return {
    supplied: true,
    missing: false,
    valid: true,
    attemptId: document.attemptId,
    path: normalizedPath,
    bytes: bytes.length,
    sha256: sha256(bytes),
    snapshot,
  };
}

async function evidenceFromEnvironment(environmentVariable, expectedKind, category, validate) {
  const supplied = process.env[environmentVariable];
  if (!supplied) {
    return {
      supplied: false,
      missing: true,
      valid: false,
      environmentVariable,
      errors: ['environment variable is not set'],
    };
  }
  const path = isAbsolute(supplied) ? supplied : resolve(gameRoot, supplied);
  return {
    environmentVariable,
    ...await loadEvidence(path, expectedKind, category, validate, true),
  };
}

const requiredBrowserChecks = [
  'exactProductionBundle', 'sdkReady', 'sdkLifecycle', 'localeRuEn',
  'responsiveDesktop', 'responsiveMobile', 'sdkFailureFallback', 'consoleAndNetworkClean',
];
const requiredBrowserScenarios = [
  'production-boot-sdk-ready',
  'production-gameplay-start-stop',
  'production-locale-ru',
  'production-locale-en',
  'production-responsive-desktop',
  'production-responsive-mobile-portrait',
  'production-responsive-mobile-landscape',
  'production-sdk-fallback-local-only',
];
const requiredScenarioAssertions = {
  'production-boot-sdk-ready': ['english-lang', 'english-title', 'loading-ready-once', 'sdk-init-once', 'test-driver-disabled', 'yandex-capability-active'],
  'production-gameplay-start-stop': ['gameplay-resumed', 'gameplay-start-exact', 'gameplay-stop-exact', 'tap-recorded'],
  'production-locale-ru': ['localized-html-lang', 'localized-hud-control', 'localized-title'],
  'production-locale-en': ['localized-html-lang', 'localized-hud-control', 'localized-title'],
  'production-responsive-desktop': [
    'ultrawide-authored-side-fill',
    'viewport-1280x1024@100', 'viewport-1280x1024@125', 'viewport-1280x1024@80',
    'viewport-1920x1080', 'viewport-3840x1080-ultrawide', 'viewport-3840x2160',
  ],
  'production-responsive-mobile-portrait': ['touch-targets-48px', 'viewport-390x844-portrait'],
  'production-responsive-mobile-landscape': ['touch-targets-48px', 'viewport-844x390-short-landscape', 'viewport-rotation'],
  'production-sdk-fallback-local-only': ['local-only-degraded-target', 'no-test-provider-copy', 'rewarded-unavailable'],
};
const requiredDesktopMatrix = ['1280x1024@80', '1280x1024@100', '1280x1024@125', '1920x1080', '3840x2160', '3840x1080-ultrawide'];
const requiredMobileMatrix = ['844x390-short-landscape', '390x844-portrait', 'rotation'];
const requiredViewportSamples = [
  { id: '1280x1024@80', width: 1280, height: 1024, zoomPercent: 80, orientation: 'landscape' },
  { id: '1280x1024@100', width: 1280, height: 1024, zoomPercent: 100, orientation: 'landscape' },
  { id: '1280x1024@125', width: 1280, height: 1024, zoomPercent: 125, orientation: 'landscape' },
  { id: '1920x1080', width: 1920, height: 1080, zoomPercent: 100, orientation: 'landscape' },
  { id: '3840x2160', width: 3840, height: 2160, zoomPercent: 100, orientation: 'landscape' },
  { id: '3840x1080-ultrawide', width: 3840, height: 1080, zoomPercent: 100, orientation: 'landscape' },
  { id: '844x390-short-landscape', width: 844, height: 390, zoomPercent: 100, orientation: 'landscape' },
  { id: '390x844-portrait', width: 390, height: 844, zoomPercent: 100, orientation: 'portrait' },
  { id: 'rotation', width: 390, height: 844, zoomPercent: 100, orientation: 'portrait', rotatedFrom: '844x390-short-landscape' },
];
const counterKeys = ['consoleErrors', 'consoleWarnings', 'pageErrors', 'requestFailures', 'httpErrors', 'unexpectedNetworkFailures'];

function validateZeroCounters(counters, label) {
  const errors = [];
  if (!exactKeys(counters, counterKeys)) return [`${label} must contain the exact full diagnostic counter set`];
  for (const key of counterKeys) if (counters[key] !== 0) errors.push(`${label}.${key} must equal 0`);
  return errors;
}

function validateTypedEvents(events, label, startedAt, completedAt) {
  const errors = [];
  if (!Array.isArray(events) || events.length < 2) return { errors: [`${label} must contain at least two typed events`], types: [] };
  let previousAt = startedAt;
  const types = [];
  for (let index = 0; index < events.length; index += 1) {
    const event = events[index];
    const at = parseTimestamp(event?.at);
    if (!isPlainObject(event) || event.sequence !== index + 1 || typeof event.type !== 'string' || event.type.length === 0) {
      errors.push(`${label}[${index}] has invalid sequence/type`);
      continue;
    }
    if (at === null || at < previousAt || at > completedAt) errors.push(`${label}[${index}] timestamp is not monotonic/in-range`);
    else previousAt = at;
    types.push(event.type);
  }
  return { errors, types };
}

function validateBrowserViewportSamples(samples) {
  const errors = [];
  if (!Array.isArray(samples) || samples.length !== requiredViewportSamples.length) {
    return ['browser raw trace must contain the exact typed viewport sample count'];
  }
  const actualById = new Map();
  for (const sample of samples) {
    if (!isPlainObject(sample) || typeof sample.id !== 'string' || actualById.has(sample.id)) {
      errors.push('browser raw trace viewport sample IDs must be present and unique');
      continue;
    }
    actualById.set(sample.id, sample);
  }
  if (JSON.stringify([...actualById.keys()].sort()) !== JSON.stringify(requiredViewportSamples.map((item) => item.id).sort())) {
    errors.push('browser raw trace typed viewport sample ID set is incomplete');
  }
  for (const expected of requiredViewportSamples) {
    const sample = actualById.get(expected.id);
    if (!sample) continue;
    for (const key of ['width', 'height', 'zoomPercent', 'orientation']) {
      if (sample[key] !== expected[key]) errors.push(`browser viewport sample ${expected.id}.${key} mismatch`);
    }
    if (expected.rotatedFrom && JSON.stringify(sample.rotatedFrom) !== JSON.stringify(expected.rotatedFrom)) {
      errors.push(`browser viewport sample ${expected.id} does not prove the portrait-to-landscape rotation`);
    }
    const observed = sample.observed;
    if (!isPlainObject(observed)
      || !Number.isFinite(observed.innerWidth) || !Number.isFinite(observed.innerHeight)
      || !Number.isFinite(observed.dpr) || observed.dpr <= 0
      || !Number.isFinite(observed.visualScale) || observed.visualScale <= 0
      || !Number.isFinite(observed.documentWidth) || !Number.isFinite(observed.documentHeight)
      || !isPlainObject(observed.shell) || !isPlainObject(observed.canvas)) {
      errors.push(`browser viewport sample ${expected.id} lacks typed observed geometry`);
      continue;
    }
    const tolerance = 2;
    if (observed.documentWidth > observed.innerWidth + tolerance || observed.documentHeight > observed.innerHeight + tolerance) {
      errors.push(`browser viewport sample ${expected.id} has document overflow`);
    }
    for (const [rectangleName, rectangle] of [['shell', observed.shell], ['canvas', observed.canvas]]) {
      if (!['left', 'top', 'right', 'bottom'].every((key) => Number.isFinite(rectangle[key]))) {
        errors.push(`browser viewport sample ${expected.id} ${rectangleName} geometry is incomplete`);
      } else if (rectangle.left < -tolerance || rectangle.top < -tolerance
        || rectangle.right > observed.innerWidth + tolerance || rectangle.bottom > observed.innerHeight + tolerance) {
        errors.push(`browser viewport sample ${expected.id} ${rectangleName} escapes the viewport`);
      }
    }
  }
  return errors;
}

function browserUserAgentMatches(browserId, userAgent) {
  if (typeof userAgent !== 'string' || userAgent.length < 20) return false;
  if (browserId === 'chrome') return /Chrome\//u.test(userAgent) && !/(?:YaBrowser|OPR|Edg)\//u.test(userAgent);
  if (browserId === 'yandex-browser') return /YaBrowser\//u.test(userAgent);
  if (browserId === 'firefox') return /Firefox\//u.test(userAgent) && !/Seamonkey\//iu.test(userAgent);
  if (browserId === 'opera') return /OPR\//u.test(userAgent);
  return /Version\//u.test(userAgent) && /Safari\//u.test(userAgent) && !/(?:Chrome|Chromium|CriOS|FxiOS|OPR|Edg)\//u.test(userAgent);
}

async function validateBrowserRun(document, browserId, reportPath, registry) {
  const errors = [];
  if (document?.browser?.id !== browserId) errors.push(`browser.id must equal ${browserId}`);
  if (typeof document?.browser?.version !== 'string' || document.browser.version.length === 0 || document.browser.version === 'unknown') errors.push('browser version is missing');
  if (!browserUserAgentMatches(browserId, document?.browser?.userAgent)) errors.push(`browser userAgent does not prove ${browserId}`);
  if (!validAttemptId(document?.attemptId)) errors.push('browser attemptId is missing or invalid');
  if (JSON.stringify(document?.scenarios) !== JSON.stringify(requiredBrowserScenarios)) errors.push('production browser scenario ID set/order is incomplete');
  if (!Array.isArray(document?.scenarioResults)
    || JSON.stringify(document.scenarioResults.map((item) => item?.id)) !== JSON.stringify(requiredBrowserScenarios)
    || document.scenarioResults.some((item) => item?.status !== 'PASS' || !Number.isFinite(item?.durationMs) || item.durationMs < 1)) {
    errors.push('production browser scenario results are incomplete');
  }
  errors.push(...timingErrors(document, 'browser report'));
  if (JSON.stringify(document?.responsiveMatrix?.desktop) !== JSON.stringify(requiredDesktopMatrix)
    || JSON.stringify(document?.responsiveMatrix?.mobile) !== JSON.stringify(requiredMobileMatrix)) errors.push('browser viewport/zoom/orientation matrix is incomplete');
  for (const check of requiredBrowserChecks) if (document?.checks?.[check] !== true) errors.push(`browser check ${check} is not PASS`);
  const reportCounters = Object.fromEntries(counterKeys.map((key) => [key, document?.[key]]));
  errors.push(...validateZeroCounters(reportCounters, 'browser report counters'));

  const traceArtifact = await registry.read(document?.rawTrace, 'browser raw trace', { id: 'raw-trace', json: true });
  errors.push(...traceArtifact.errors);
  if (traceArtifact.bytes && traceArtifact.errors.length === 0) {
    try {
      const trace = JSON.parse(traceArtifact.bytes.toString('utf8'));
      if (trace?.schemaVersion !== 1 || trace?.kind !== 'production-browser-run-trace' || trace?.cycle !== '09') errors.push('browser raw trace schema/kind/cycle mismatch');
      if (trace?.attemptId !== document.attemptId) errors.push('browser raw trace attemptId mismatch');
      if (trace?.browser?.id !== browserId || trace?.browser?.version !== document.browser.version) errors.push('browser raw trace browser identity mismatch');
      if (trace?.browser?.userAgent !== document.browser.userAgent || !browserUserAgentMatches(browserId, trace?.browser?.userAgent)) errors.push('browser raw trace userAgent mismatch');
      for (const buildError of exactBuildErrors({ ...trace, status: 'PASS' }, 'production-browser-run-trace')) errors.push(`browser raw trace ${buildError}`);
      errors.push(...timingErrors(trace, 'browser raw trace'));
      if (trace?.startedAt !== document.startedAt || trace?.completedAt !== document.completedAt || trace?.durationMs !== document.durationMs) errors.push('browser raw trace timing differs from report');
      errors.push(...validateZeroCounters(trace?.counters, 'browser raw trace counters'));
      if (JSON.stringify(trace?.counters) !== JSON.stringify(reportCounters)) errors.push('browser raw trace counters differ from report');
      if (JSON.stringify(trace?.viewportSamples) !== JSON.stringify(document.viewportSamples)) errors.push('browser raw trace viewport samples differ from report');
      errors.push(...validateBrowserViewportSamples(trace?.viewportSamples));
      const runStart = parseTimestamp(trace.startedAt);
      const runEnd = parseTimestamp(trace.completedAt);
      const typedTraceEvents = validateTypedEvents(trace?.events, 'browser raw trace events', runStart, runEnd);
      errors.push(...typedTraceEvents.errors);
      let previousMonotonic = -1;
      if (Array.isArray(trace?.events)) {
        for (const [index, event] of trace.events.entries()) {
          if (!requiredBrowserScenarios.includes(event?.scenarioId)) errors.push(`browser raw trace event ${index + 1} has an unknown scenarioId`);
          if (!Number.isFinite(event?.monotonicMs) || event.monotonicMs < previousMonotonic || event.monotonicMs > trace.durationMs + 2_000) {
            errors.push(`browser raw trace event ${index + 1} monotonicMs is invalid`);
          }
          previousMonotonic = event?.monotonicMs ?? previousMonotonic;
          if (!isPlainObject(event?.data)) errors.push(`browser raw trace event ${index + 1} data must be a typed object`);
        }
      }
      if (!Array.isArray(trace?.scenarioResults) || JSON.stringify(trace.scenarioResults.map((item) => item?.id)) !== JSON.stringify(requiredBrowserScenarios)) {
        errors.push('browser raw trace scenario set/order is incomplete');
      } else {
        let previousEnd = runStart;
        for (let index = 0; index < trace.scenarioResults.length; index += 1) {
          const scenario = trace.scenarioResults[index];
          const label = `browser raw trace scenario ${scenario.id}`;
          if (scenario.status !== 'PASS') errors.push(`${label} is not PASS`);
          errors.push(...timingErrors(scenario, label, runStart, runEnd));
          const scenarioStart = parseTimestamp(scenario.startedAt);
          const scenarioEnd = parseTimestamp(scenario.completedAt);
          if (scenarioStart !== null && previousEnd !== null && scenarioStart < previousEnd) errors.push(`${label} overlaps or reorders the prior scenario`);
          previousEnd = scenarioEnd;
          const assertions = scenario.assertions;
          const assertionIds = Array.isArray(assertions) ? assertions.map((item) => item?.id).sort() : [];
          if (JSON.stringify(assertionIds) !== JSON.stringify(requiredScenarioAssertions[scenario.id])) {
            errors.push(`${label} exact assertion set is incomplete`);
          } else {
            const seen = new Set();
            for (const assertion of assertions) {
              const at = parseTimestamp(assertion?.at);
              if (seen.has(assertion.id) || assertion.status !== 'PASS' || at === null || at < scenarioStart || at > scenarioEnd) errors.push(`${label} assertion ${assertion?.id} is invalid`);
              seen.add(assertion.id);
            }
          }
          const scenarioEvents = Array.isArray(trace.events) ? trace.events.filter((event) => event.scenarioId === scenario.id) : [];
          if (scenarioEvents[0]?.type !== 'scenario-start' || scenarioEvents.at(-1)?.type !== 'scenario-complete') errors.push(`${label} must start/complete with typed boundary events`);
          for (const event of scenarioEvents) {
            const at = parseTimestamp(event.at);
            if (at === null || at < scenarioStart || at > scenarioEnd) errors.push(`${label} contains an out-of-bounds trace event`);
          }
          const assertionEventIds = scenarioEvents.filter((event) => event.type === 'assertion').map((event) => event.data?.id).sort();
          if (JSON.stringify(assertionEventIds) !== JSON.stringify(assertionIds)) errors.push(`${label} assertion events differ from assertion records`);
          const reportResult = document.scenarioResults?.[index];
          if (JSON.stringify(reportResult) !== JSON.stringify(scenario)) errors.push(`${label} typed result differs from report`);
        }
      }
    } catch (error) {
      errors.push(`browser raw trace is not valid typed JSON: ${error?.message ?? String(error)}`);
    }
  }
  return { errors };
}

const requiredDeviceChecks = ['touchInput', 'portrait', 'landscape', 'rotation', 'safeAreas', 'audioLifecycle', 'rewardedAndNoReward', 'consoleAndNetworkClean'];
const requiredDeviceSessionIds = ['no-rewarded', 'with-rewarded'];
const deviceCommonEvents = [
  'session-start', 'touch-input-verified', 'portrait-verified', 'landscape-verified',
  'rotation-verified', 'safe-area-verified', 'audio-suspended', 'audio-resumed',
  'run-complete', 'session-complete',
];
const deviceRewardedEvents = ['reward-request', 'reward-on-rewarded', 'reward-grant', 'reward-close-without-reward', 'reward-error', 'reward-retry-available'];

function percentile(values, fraction) {
  const sorted = [...values].sort((a, b) => a - b);
  return sorted[Math.max(0, Math.ceil(sorted.length * fraction) - 1)];
}

function validateDeviceTrace(trace, document, session, platformId) {
  const errors = [];
  if (trace?.schemaVersion !== 1 || trace?.kind !== 'real-device-session-trace' || trace?.cycle !== '09') errors.push(`${session.id}: trace schema/kind/cycle mismatch`);
  if (trace?.reportAttemptId !== document.attemptId || trace?.attemptId !== session.attemptId) errors.push(`${session.id}: trace attempt identity mismatch`);
  if (trace?.sessionId !== session.id || trace?.device?.platform !== platformId) errors.push(`${session.id}: trace session/device identity mismatch`);
  if (trace?.device?.model !== document.device?.model || trace?.device?.osVersion !== document.device?.osVersion || trace?.device?.browser !== document.device?.browser) errors.push(`${session.id}: trace device details differ from report`);
  if (trace?.device?.physicalOrRealDeviceCloud !== true) errors.push(`${session.id}: trace does not identify a physical/real-device-cloud run`);
  for (const buildError of exactBuildErrors({ ...trace, status: 'PASS' }, 'real-device-session-trace')) errors.push(`${session.id}: trace ${buildError}`);
  errors.push(...timingErrors(trace, `${session.id} trace`));
  if (trace?.startedAt !== session.startedAt || trace?.completedAt !== session.completedAt || trace?.durationMs !== session.durationMs) errors.push(`${session.id}: trace timing differs from session summary`);
  const startedAt = parseTimestamp(trace?.startedAt);
  const completedAt = parseTimestamp(trace?.completedAt);
  const typedEvents = validateTypedEvents(trace?.events, `${session.id} trace events`, startedAt, completedAt);
  errors.push(...typedEvents.errors);
  if (trace?.events?.[0]?.type !== 'session-start' || trace?.events?.at(-1)?.type !== 'session-complete') errors.push(`${session.id}: trace session boundary events are missing`);
  for (const type of deviceCommonEvents) if (!typedEvents.types.includes(type)) errors.push(`${session.id}: trace event ${type} is missing`);
  if (session.id === 'no-rewarded') {
    if (!typedEvents.types.includes('rewarded-not-used')) errors.push(`${session.id}: rewarded-not-used event is missing`);
    if (typedEvents.types.some((type) => type.startsWith('reward-') && type !== 'rewarded-not-used')) errors.push(`${session.id}: rewarded events contradict the no-rewarded session`);
  } else {
    for (const type of deviceRewardedEvents) if (!typedEvents.types.includes(type)) errors.push(`${session.id}: trace event ${type} is missing`);
    if (typedEvents.types.filter((type) => type === 'reward-on-rewarded').length !== 1 || typedEvents.types.filter((type) => type === 'reward-grant').length !== 1) {
      errors.push(`${session.id}: trace must prove exactly one onRewarded grant`);
    }
  }
  const runsCompleted = typedEvents.types.filter((type) => type === 'run-complete').length;
  if (runsCompleted < 2 || session.runsCompleted !== runsCompleted) errors.push(`${session.id}: runsCompleted must be derived from at least two trace events`);

  const samples = trace?.samples;
  let computed;
  if (!Array.isArray(samples) || samples.length < 72) {
    errors.push(`${session.id}: at least 72 typed performance samples are required`);
  } else {
    let previousAt = startedAt;
    let totalFrames = 0;
    let totalLongFrames = 0;
    const fps = [];
    const heaps = [];
    const feedback = [];
    for (let index = 0; index < samples.length; index += 1) {
      const sample = samples[index];
      const at = parseTimestamp(sample?.at);
      if (!isPlainObject(sample) || sample.sequence !== index + 1 || at === null || at < previousAt || at > completedAt || (index > 0 && at - previousAt > 15_000)) {
        errors.push(`${session.id}: performance sample ${index + 1} sequence/timestamp is invalid`);
      }
      previousAt = at ?? previousAt;
      if (!(Number.isFinite(sample?.fps) && sample.fps > 0 && sample.fps <= 240)
        || !Number.isInteger(sample?.frames) || sample.frames <= 0
        || !Number.isInteger(sample?.longFrames) || sample.longFrames < 0 || sample.longFrames > sample.frames
        || !Number.isInteger(sample?.heapBytes) || sample.heapBytes <= 0
        || !(Number.isFinite(sample?.inputFeedbackMs) && sample.inputFeedbackMs >= 0)) {
        errors.push(`${session.id}: performance sample ${index + 1} metrics are invalid`);
        continue;
      }
      fps.push(sample.fps);
      totalFrames += sample.frames;
      totalLongFrames += sample.longFrames;
      heaps.push(sample.heapBytes);
      feedback.push(sample.inputFeedbackMs);
    }
    if (parseTimestamp(samples[0]?.at) - startedAt > 15_000 || completedAt - parseTimestamp(samples.at(-1)?.at) > 15_000) errors.push(`${session.id}: samples do not span the full session`);
    if (fps.length > 0) {
      computed = {
        medianFps: percentile(fps, 0.5),
        longFrameRate: totalLongFrames / totalFrames,
        heapPeakBytes: Math.max(...heaps),
        inputFeedbackP95Ms: percentile(feedback, 0.95),
      };
      if (computed.medianFps < 30 || computed.longFrameRate > 0.01
        || computed.heapPeakBytes > 150 * 1024 * 1024 || computed.inputFeedbackP95Ms > 100) {
        errors.push(`${session.id}: recomputed mobile FPS/long-frame/heap/input thresholds fail`);
      }
      for (const key of Object.keys(computed)) {
        const tolerance = key === 'longFrameRate' ? 1e-9 : 1e-6;
        if (!Number.isFinite(session?.performance?.[key]) || Math.abs(session.performance[key] - computed[key]) > tolerance) errors.push(`${session.id}: declared ${key} differs from trace-derived value`);
      }
    }
  }
  const diagnosticMap = {
    consoleErrors: 'console-error',
    consoleWarnings: 'console-warning',
    pageErrors: 'page-error',
    unexpectedNetworkFailures: 'unexpected-network-failure',
  };
  for (const [key, type] of Object.entries(diagnosticMap)) {
    const derived = typedEvents.types.filter((item) => item === type).length;
    if (session?.diagnostics?.[key] !== derived || derived !== 0) errors.push(`${session.id}: diagnostic ${key} must equal the trace-derived zero count`);
  }
  return { errors, computed };
}

async function validateRealDeviceRun(document, devicePlatform, reportPath, registry) {
  const errors = [];
  if (document?.device?.platform !== devicePlatform) errors.push(`device.platform must equal ${devicePlatform}`);
  if (document?.device?.physicalOrRealDeviceCloud !== true) errors.push('device must be physical or real-device cloud');
  for (const key of ['model', 'osVersion', 'browser']) if (typeof document?.device?.[key] !== 'string' || document.device[key].length < 2) errors.push(`device.${key} is missing`);
  if (!validAttemptId(document?.attemptId)) errors.push('real-device report attemptId is missing or invalid');
  errors.push(...timingErrors(document, 'real-device report'));
  const sessions = document?.sessions;
  if (!Array.isArray(sessions) || JSON.stringify(sessions.map((item) => item?.id).sort()) !== JSON.stringify(requiredDeviceSessionIds)) {
    errors.push('real-device rewarded/no-rewarded session set is incomplete');
  } else {
    const orderedIntervals = sessions.map((session) => ({
      id: session.id,
      start: parseTimestamp(session.startedAt),
      end: parseTimestamp(session.completedAt),
    })).sort((left, right) => (left.start ?? Number.POSITIVE_INFINITY) - (right.start ?? Number.POSITIVE_INFINITY));
    for (let index = 1; index < orderedIntervals.length; index += 1) {
      if (orderedIntervals[index - 1].end === null || orderedIntervals[index].start === null
        || orderedIntervals[index].start < orderedIntervals[index - 1].end) errors.push('real-device sessions overlap or have invalid chronology');
    }
    const sessionAttempts = new Set();
    for (const session of sessions) {
      if (!validAttemptId(session?.attemptId) || sessionAttempts.has(session.attemptId)) errors.push(`${session?.id}: session attemptId is missing or reused`);
      sessionAttempts.add(session?.attemptId);
      const reportStart = parseTimestamp(document.startedAt);
      const reportEnd = parseTimestamp(document.completedAt);
      errors.push(...timingErrors(session, `${session.id} session`, reportStart, reportEnd));
      if (session.status !== 'PASS' || !Number.isFinite(session.durationMs) || session.durationMs < 720_000) errors.push(`${session.id}: session must PASS for at least 12 measured minutes`);
      if (!Array.isArray(session?.evidence) || JSON.stringify(session.evidence.map((item) => item?.id).sort()) !== JSON.stringify(['screenshot', 'trace'])) {
        errors.push(`${session.id}: exact trace and screenshot artifact set is required`);
        continue;
      }
      const screenshot = session.evidence.find((item) => item.id === 'screenshot');
      const screenshotResult = await registry.read(screenshot, `${session.id} screenshot`, { id: `${session.id}-screenshot`, png: true, minWidth: 320, minHeight: 320 });
      errors.push(...screenshotResult.errors);
      const traceArtifact = session.evidence.find((item) => item.id === 'trace');
      const traceResult = await registry.read(traceArtifact, `${session.id} trace`, { id: `${session.id}-trace`, json: true });
      errors.push(...traceResult.errors);
      if (traceResult.bytes && traceResult.errors.length === 0) {
        try {
          const trace = JSON.parse(traceResult.bytes.toString('utf8'));
          errors.push(...validateDeviceTrace(trace, document, session, devicePlatform).errors);
        } catch (error) {
          errors.push(`${session.id}: trace is not valid typed JSON: ${error?.message ?? String(error)}`);
        }
      }
    }
  }
  for (const check of requiredDeviceChecks) if (document?.checks?.[check] !== true) errors.push(`device check ${check} is not PASS`);
  return { errors };
}

const requiredConsoleArtifactIds = [
  'authorized-save', 'console-config', 'guest-save', 'leaderboard', 'lifecycle',
  'rewarded-close', 'rewarded-error', 'rewarded-success', 'sdk-ready', 'titles',
];
const requiredConsoleEvents = {
  'authorized-save': ['authorized-save-write', 'authorized-save-read', 'authorized-save-merge'],
  'console-config': ['configuration-read'],
  'guest-save': ['guest-local-save-write', 'guest-leaderboard-skipped'],
  leaderboard: ['leaderboard-availability-check', 'leaderboard-score-submit', 'leaderboard-score-read'],
  lifecycle: ['gameplay-start', 'gameplay-stop', 'pause', 'resume'],
  'sdk-ready': ['sdk-initialized', 'loading-api-ready'],
  titles: ['title-ru-observed', 'title-en-observed', 'availability-checked'],
};
const orderedConsoleEvents = {
  'authorized-save': ['authorized-save-write', 'authorized-save-read', 'authorized-save-merge'],
  'console-config': ['configuration-read'],
  'guest-save': ['guest-local-save-write', 'guest-leaderboard-skipped'],
  leaderboard: ['leaderboard-availability-check', 'leaderboard-score-submit', 'leaderboard-score-read'],
  lifecycle: ['gameplay-start', 'pause', 'gameplay-stop', 'resume'],
  'sdk-ready': ['sdk-initialized', 'loading-api-ready'],
  titles: ['title-ru-observed', 'title-en-observed', 'availability-checked'],
};

function eventOrderErrors(types, orderedTypes, label) {
  const errors = [];
  let previousIndex = -1;
  for (const type of orderedTypes) {
    const index = types.indexOf(type);
    if (index < 0 || index <= previousIndex) errors.push(`${label} event ${type} is missing or out of order`);
    previousIndex = index;
  }
  return errors;
}

function consoleConfigurationErrors(configuration) {
  const errors = [];
  if (JSON.stringify(configuration?.devices) !== JSON.stringify(['desktop', 'android', 'ios'])) errors.push('Console devices must be desktop/android/ios');
  if (configuration?.orientation !== 'any' || configuration?.ageRating !== '12+' || configuration?.cloudSaves !== true) errors.push('Console orientation/age/cloud configuration mismatch');
  if (JSON.stringify(configuration?.locales) !== JSON.stringify(['ru', 'en'])) errors.push('Console locales must be ru/en');
  if (JSON.stringify(configuration?.categories) !== JSON.stringify(['arcade', 'casual'])) errors.push('Console categories must be arcade/casual');
  if (JSON.stringify(configuration?.advertising) !== JSON.stringify(['rewarded'])) errors.push('Console advertising must contain rewarded only');
  if (configuration?.tv !== false || configuration?.inAppPurchases !== false || configuration?.stickyAds !== false || configuration?.interstitialAds !== false) errors.push('TV/IAP/sticky/interstitial must be explicitly disabled');
  if (configuration?.titles?.ru !== 'Зажги' || configuration?.titles?.en !== 'Ignite'
    || configuration?.titles?.availabilityChecked !== true || configuration?.titles?.available !== true) errors.push('Console title values/availability are not proven');
  if (configuration?.leaderboard?.technicalName !== 'best-score' || configuration?.leaderboard?.type !== 'numeric' || configuration?.leaderboard?.order !== 'DESC') errors.push('Console leaderboard configuration mismatch');
  return errors;
}

function validateConsoleTraceBase(trace, document, artifactId) {
  const errors = [];
  if (trace?.schemaVersion !== 1 || trace?.kind !== `yandex-console-${artifactId}-trace` || trace?.cycle !== '09') errors.push(`Console ${artifactId} trace schema/kind/cycle mismatch`);
  if (trace?.draftId !== document.draftId || trace?.attemptId !== document.attemptId) errors.push(`Console ${artifactId} trace draft/attempt identity mismatch`);
  for (const buildError of exactBuildErrors({ ...trace, status: 'PASS' }, `yandex-console-${artifactId}-trace`)) errors.push(`Console ${artifactId} trace ${buildError}`);
  errors.push(...timingErrors(trace, `Console ${artifactId} trace`));
  const typedEvents = validateTypedEvents(trace?.events, `Console ${artifactId} trace events`, parseTimestamp(trace?.startedAt), parseTimestamp(trace?.completedAt));
  errors.push(...typedEvents.errors);
  if (trace?.events?.[0]?.type !== 'trace-start' || trace?.events?.at(-1)?.type !== 'trace-complete') errors.push(`Console ${artifactId} trace boundary events are missing`);
  return { errors, eventTypes: typedEvents.types };
}

function deriveRewardedTrace(trace, terminal) {
  const errors = [];
  const events = trace.events ?? [];
  const byType = (type) => events.filter((event) => event.type === type);
  const forbidden = ['reward-on-rewarded', 'reward-grant', 'cooldown-start'];
  if (terminal === 'success') {
    for (const type of ['reward-request', 'reward-on-open', 'reward-on-rewarded', 'reward-grant', 'boost-start', 'boost-end', 'cooldown-start', 'cooldown-ready', 'reward-on-close', 'reward-repeat-request', 'reward-repeat-succeeded', 'ad-pause-applied', 'simulation-frozen', 'active-timer-paused', 'active-timer-resumed', 'audio-suspended', 'audio-resumed']) {
      if (byType(type).length < 1) errors.push(`rewarded success trace event ${type} is missing`);
    }
    errors.push(...eventOrderErrors(events.map((event) => event.type), ['reward-request', 'reward-on-open', 'reward-on-rewarded', 'reward-grant', 'reward-on-close'], 'rewarded success terminal'));
    errors.push(...eventOrderErrors(events.map((event) => event.type), ['boost-start', 'boost-end'], 'rewarded success boost'));
    errors.push(...eventOrderErrors(events.map((event) => event.type), ['cooldown-start', 'cooldown-ready', 'reward-repeat-request', 'reward-repeat-succeeded'], 'rewarded success cooldown/repeat'));
    errors.push(...eventOrderErrors(events.map((event) => event.type), ['audio-suspended', 'audio-resumed'], 'rewarded success audio'));
    if (byType('reward-on-rewarded').length !== 1 || byType('reward-grant').length !== 1) errors.push('rewarded success trace must contain exactly one initial onRewarded/grant');
    const boostStart = byType('boost-start')[0]?.activeTimeMs;
    const boostEnd = byType('boost-end')[0]?.activeTimeMs;
    const cooldownStart = byType('cooldown-start')[0]?.activeTimeMs;
    const cooldownReady = byType('cooldown-ready')[0]?.activeTimeMs;
    const repeatAt = byType('reward-repeat-request')[0]?.activeTimeMs;
    const timerPausedAt = byType('active-timer-paused')[0]?.activeTimeMs;
    const timerResumedAt = byType('active-timer-resumed')[0]?.activeTimeMs;
    if (![boostStart, boostEnd, cooldownStart, cooldownReady, repeatAt].every(Number.isFinite)
      || boostEnd - boostStart !== 60_000 || cooldownReady - cooldownStart !== 90_000 || repeatAt - cooldownStart !== 90_000) {
      errors.push('rewarded success active-time trace does not prove exact 60/90 timing');
    }
    if (!Number.isFinite(timerPausedAt) || timerResumedAt !== timerPausedAt) errors.push('rewarded success trace does not prove frozen active-time during pause/ad/background');
    if (byType('audio-resumed').length !== 1) errors.push('rewarded success trace must resume audio exactly once');
    if (byType('reward-request')[0]?.autoShown !== false) errors.push('rewarded success trace must prove a voluntary non-auto request');
    return {
      errors,
      derived: {
        onRewardedCount: byType('reward-on-rewarded').length,
        grantCount: byType('reward-grant').length,
        boostActiveMs: Number.isFinite(boostStart) && Number.isFinite(boostEnd) ? boostEnd - boostStart : null,
        cooldownActiveMs: Number.isFinite(cooldownStart) && Number.isFinite(cooldownReady) ? cooldownReady - cooldownStart : null,
        autoShown: byType('reward-request')[0]?.autoShown,
        repeatActiveMs: Number.isFinite(cooldownStart) && Number.isFinite(repeatAt) ? repeatAt - cooldownStart : null,
        repeatSucceeded: byType('reward-repeat-succeeded').length === 1,
        simulationFrozen: byType('simulation-frozen').length === 1,
        adPauseApplied: byType('ad-pause-applied').length === 1,
        audioSuspended: byType('audio-suspended').length === 1,
        resumedOnce: byType('audio-resumed').length === 1,
      },
    };
  }
  const terminalType = terminal === 'close' ? 'reward-on-close' : 'reward-on-error';
  for (const type of ['reward-request', terminalType, 'reward-retry-available']) if (byType(type).length !== 1) errors.push(`rewarded ${terminal} trace event ${type} must occur exactly once`);
  for (const type of forbidden) if (byType(type).length !== 0) errors.push(`rewarded ${terminal} trace must not contain ${type}`);
  errors.push(...eventOrderErrors(events.map((event) => event.type), ['reward-request', terminalType, 'reward-retry-available'], `rewarded ${terminal}`));
  return {
    errors,
    derived: {
      onRewardedCount: byType('reward-on-rewarded').length,
      grantCount: byType('reward-grant').length,
      cooldownStarted: byType('cooldown-start').length > 0,
      retryAvailable: byType('reward-retry-available').length === 1,
    },
  };
}

async function validateConsoleRun(document, reportPath, registry) {
  const errors = [];
  if (typeof document?.draftId !== 'string' || !/^[A-Za-z0-9._:-]{3,128}$/u.test(document.draftId)) errors.push('draftId is missing or invalid');
  if (!validAttemptId(document?.attemptId)) errors.push('Console attemptId is missing or invalid');
  if (typeof document?.operatorId !== 'string' || !/^[A-Za-z0-9._@:-]{3,128}$/u.test(document.operatorId)) errors.push('Console operatorId is missing or invalid');
  errors.push(...timingErrors(document, 'Console report'));
  errors.push(...consoleConfigurationErrors(document?.configuration));
  for (const check of ['sdkInitialized', 'gameReady', 'locale', 'focusPause', 'rewardedReturn', 'guestSave', 'authorizedSave', 'leaderboard', 'titleAvailability']) {
    if (document?.checks?.[check] !== true) errors.push(`Console check ${check} is not PASS`);
  }
  errors.push(...validateZeroCounters(document?.diagnostics, 'Console diagnostics'));

  if (!Array.isArray(document?.artifacts) || JSON.stringify(document.artifacts.map((item) => item?.id).sort()) !== JSON.stringify(requiredConsoleArtifactIds)) {
    errors.push('Console exact typed artifact inventory is incomplete');
  } else {
    const traces = new Map();
    for (const artifact of document.artifacts) {
      const result = await registry.read(artifact, `Console ${artifact.id}`, { id: artifact.id, json: true });
      errors.push(...result.errors);
      if (!result.bytes || result.errors.length > 0) continue;
      try {
        const trace = JSON.parse(result.bytes.toString('utf8'));
        const base = validateConsoleTraceBase(trace, document, artifact.id);
        errors.push(...base.errors);
        traces.set(artifact.id, { trace, eventTypes: base.eventTypes });
        for (const requiredType of requiredConsoleEvents[artifact.id] ?? []) if (!base.eventTypes.includes(requiredType)) errors.push(`Console ${artifact.id} trace event ${requiredType} is missing`);
        errors.push(...eventOrderErrors(base.eventTypes, orderedConsoleEvents[artifact.id] ?? [], `Console ${artifact.id} trace`));
        if (artifact.id === 'console-config' && JSON.stringify(trace.configuration) !== JSON.stringify(document.configuration)) errors.push('Console configuration trace differs from report');
        if (artifact.id === 'titles') {
          if (JSON.stringify(trace.titles) !== JSON.stringify(document.configuration?.titles)) errors.push('Console title trace values differ from report');
          if (!isPlainObject(trace.review) || trace.review.independent !== true || typeof trace.review.reviewerId !== 'string'
            || trace.review.reviewerId.length < 3 || trace.review.reviewerId === document.operatorId) errors.push('Console title trace lacks an independent reviewer identity');
          const reviewedAt = parseTimestamp(trace.review?.reviewedAt);
          if (reviewedAt === null || reviewedAt < parseTimestamp(trace.startedAt) || reviewedAt > parseTimestamp(trace.completedAt)) errors.push('Console title independent review timestamp is out of trace bounds');
          if (!Array.isArray(trace.screenshots) || JSON.stringify(trace.screenshots.map((item) => item?.id).sort()) !== JSON.stringify(['title-en', 'title-ru'])) {
            errors.push('Console title trace requires separate RU/EN PNG screenshots');
          } else {
            for (const screenshot of trace.screenshots) {
              const screenshotResult = await registry.read(screenshot, `Console titles ${screenshot.id}`, {
                id: `titles-${screenshot.id}`,
                basePath: result.path,
                png: true,
                minWidth: 320,
                minHeight: 240,
              });
              errors.push(...screenshotResult.errors);
            }
          }
        }
      } catch (error) {
        errors.push(`Console ${artifact.id} is not valid typed JSON: ${error?.message ?? String(error)}`);
      }
    }
    for (const [artifactId, terminal] of [['rewarded-success', 'success'], ['rewarded-close', 'close'], ['rewarded-error', 'error']]) {
      const trace = traces.get(artifactId)?.trace;
      if (!trace) continue;
      const reward = deriveRewardedTrace(trace, terminal);
      errors.push(...reward.errors);
      if (terminal === 'success') {
        const declared = document?.rewarded?.success;
        for (const key of ['onRewardedCount', 'grantCount', 'boostActiveMs', 'cooldownActiveMs', 'autoShown']) if (declared?.[key] !== reward.derived[key]) errors.push(`Console rewarded success ${key} differs from typed trace`);
        if (document?.rewarded?.repeatAfterCooldown?.activeMs !== reward.derived.repeatActiveMs || document?.rewarded?.repeatAfterCooldown?.requestSucceeded !== reward.derived.repeatSucceeded) errors.push('Console rewarded repeat result differs from typed trace');
        for (const [key, derivedKey] of [['simulationFrozen', 'simulationFrozen'], ['adPauseApplied', 'adPauseApplied'], ['audioSuspended', 'audioSuspended'], ['resumedOnce', 'resumedOnce']]) {
          if (document?.rewarded?.pauseAudio?.[key] !== reward.derived[derivedKey]) errors.push(`Console rewarded pause/audio ${key} differs from typed trace`);
        }
      } else {
        const declared = document?.rewarded?.[terminal === 'close' ? 'closeWithoutReward' : 'error'];
        for (const key of ['onRewardedCount', 'grantCount', 'cooldownStarted', 'retryAvailable']) if (declared?.[key] !== reward.derived[key]) errors.push(`Console rewarded ${terminal} ${key} differs from typed trace`);
      }
    }
  }

  if (document?.archive?.name !== 'inferno-clicker-1.0.0-rc.zip'
    || !Number.isInteger(document?.archive?.bytes) || document.archive.bytes <= 0
    || !/^[a-f0-9]{64}$/u.test(document?.archive?.sha256 ?? '')) errors.push('Console archive identity is incomplete');
  const archivePath = join(gameRoot, 'releases/inferno-clicker-1.0.0-rc.zip');
  try {
    const archiveInfo = await lstat(archivePath);
    if (!archiveInfo.isFile() || archiveInfo.isSymbolicLink()) throw new Error('exact RC is not a regular non-symlink file');
    const archiveBytes = await readFile(archivePath);
    if (archiveBytes.length !== document?.archive?.bytes || sha256(archiveBytes) !== document?.archive?.sha256) errors.push('Console archive bytes/SHA do not match the local exact RC');
    else errors.push(...registry.addVerifiedBytes(archivePath, archiveBytes, 'Console exact RC archive', 'exact-rc-archive', 'application/zip'));
  } catch (error) {
    errors.push(`local exact RC archive is unavailable for Console SHA comparison: ${error?.code ?? error?.message ?? String(error)}`);
  }
  return { errors };
}

const browsers = [];
for (const definition of browserDefinitions) {
  const executablePath = await firstExisting(definition.candidates);
  const externalPath = process.env[definition.reportEnvironmentVariable];
  const localPath = join(evidenceRoot, `browser-production-${definition.id}.json`);
  const runEvidence = externalPath
    ? await evidenceFromEnvironment(
      definition.reportEnvironmentVariable,
      'production-browser-run',
      `browser-${definition.id}`,
      (document, path, registry) => validateBrowserRun(document, definition.id, path, registry),
    )
    : await loadEvidence(
      localPath,
      'production-browser-run',
      `browser-${definition.id}`,
      (document, path, registry) => validateBrowserRun(document, definition.id, path, registry),
      false,
    );
  browsers.push({
    id: definition.id,
    label: definition.label,
    requiredByCycle09: true,
    available: Boolean(executablePath),
    covered: runEvidence.valid,
    executablePath,
    version: versionOf(executablePath),
    runEvidence,
  });
}

const androidEvidence = await evidenceFromEnvironment(
  'INFERNO_ANDROID_REAL_DEVICE_REPORT',
  'real-device-run',
  'device-android',
  (document, path, registry) => validateRealDeviceRun(document, 'android', path, registry),
);
const iosEvidence = await evidenceFromEnvironment(
  'INFERNO_IOS_REAL_DEVICE_REPORT',
  'real-device-run',
  'device-ios',
  (document, path, registry) => validateRealDeviceRun(document, 'ios', path, registry),
);
const consoleEvidence = await evidenceFromEnvironment(
  'INFERNO_YANDEX_CONSOLE_REPORT',
  'yandex-console-draft',
  'yandex-console-draft',
  validateConsoleRun,
);

const evidenceEntries = [
  ...browsers.map((item) => ({ label: `${item.label} executed Cycle 09 production run evidence`, evidence: item.runEvidence })),
  { label: 'Android physical device or real-device cloud exact-build run', evidence: androidEvidence },
  { label: 'iOS physical device or real-device cloud exact-build run', evidence: iosEvidence },
  { label: 'authorized Yandex Games Console exact-RC draft/debug trace', evidence: consoleEvidence },
];
const missing = evidenceEntries.filter((item) => item.evidence.missing).map((item) => item.label);
const invalid = evidenceEntries
  .filter((item) => item.evidence.supplied && !item.evidence.valid)
  .map((item) => ({ label: item.label, path: item.evidence.path ?? null, errors: item.evidence.errors }));
const attemptOwners = new Map();
for (const item of evidenceEntries.filter((entry) => entry.evidence.valid)) {
  const priorOwner = attemptOwners.get(item.evidence.attemptId);
  if (priorOwner) {
    invalid.push({
      label: item.label,
      path: item.evidence.path ?? null,
      errors: [`attemptId is reused by ${priorOwner}`],
    });
  } else {
    attemptOwners.set(item.evidence.attemptId, item.label);
  }
}
const status = invalid.length > 0 ? 'FAIL' : missing.length > 0 ? 'BLOCKED_EXTERNAL' : 'PASS';
const report = {
  schemaVersion: 1,
  cycle: '09',
  generatedAt: new Date().toISOString(),
  status,
  build: {
    buildId: identity.buildId,
    commitSha: identity.commitSha,
    sourceFingerprint: identity.sourceFingerprint,
    clean: identity.clean,
    target: releaseManifest.target,
    testDriver: releaseManifest.testDriver,
    buildManifestSha256: releaseManifestSha256,
  },
  host: { platform: platform(), release: release(), arch: arch(), node: process.version },
  browsers,
  localAutomatedCoverage: {
    mockedFunctionalSuite: 'browser-e2e-* evidence is intentionally excluded from release-browser coverage',
    productionBrowserEvidence: 'browser-production-<browser-id>.json with build.testDriver=false',
    desktopViewports: requiredDesktopMatrix,
    mobileOrientations: requiredMobileMatrix,
  },
  externalEvidence: {
    androidRealDevice: androidEvidence,
    iosRealDevice: iosEvidence,
    yandexConsoleDraft: consoleEvidence,
  },
  missingRequiredEnvironments: missing,
  invalidSuppliedEvidence: invalid,
  releaseConsequence: status === 'PASS'
    ? 'No environment blocker detected by this audit; every accepted external input has an immutable content-addressed snapshot.'
    : status === 'FAIL'
      ? 'A supplied evidence file is invalid. Release gates must fail closed until the evidence is corrected.'
      : 'Local RC may be produced, but Cycle 09 cannot be declared final or promoted as draft-verified.',
};

await mkdir(evidenceRoot, { recursive: true });
const outputPath = join(evidenceRoot, 'environment-audit.json');
const temporaryOutput = join(evidenceRoot, `.environment-audit-${process.pid}-${Date.now()}.tmp`);
await writeFile(temporaryOutput, `${JSON.stringify(report, null, 2)}\n`, { encoding: 'utf8', flag: 'wx' });
try {
  await rename(temporaryOutput, outputPath);
} catch (error) {
  if (platform() !== 'win32') throw error;
  const existing = await stat(outputPath).catch(() => null);
  if (existing?.isFile()) await rm(outputPath);
  await rename(temporaryOutput, outputPath);
}
console.log(`Yandex environment audit ${report.status}: ${outputPath}`);
if (missing.length > 0) console.log(`External environments missing: ${missing.join('; ')}`);
if (invalid.length > 0) {
  for (const item of invalid) console.error(`Invalid supplied evidence: ${item.label}: ${item.errors.join('; ')}`);
  process.exitCode = 1;
}
