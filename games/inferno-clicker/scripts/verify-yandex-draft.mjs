import { createHash, randomBytes } from 'node:crypto';
import { spawnSync } from 'node:child_process';
import {
  mkdir,
  link,
  lstat,
  mkdtemp,
  open,
  readFile,
  readdir,
  realpath,
  rename,
  rm,
  stat,
  symlink,
  unlink,
} from 'node:fs/promises';
import { basename, dirname, extname, isAbsolute, join, relative, resolve, sep } from 'node:path';
import { tmpdir } from 'node:os';
import { buildIdentity, gameRoot, startVerifiedStaticServer, verifyBuildPayload } from './lib.mjs';
import { mergeInfernoSaves, parseInfernoSave } from '../src/platforms/types/save.js';

const archiveName = 'inferno-clicker-1.0.0-rc.zip';
const releaseDir = join(gameRoot, 'releases');
const archivePath = join(releaseDir, archiveName);
const checksumPath = `${archivePath}.sha256`;
const manifestPath = join(gameRoot, 'dist/build-manifest.json');
const acceptancePath = join(gameRoot, 'docs/ACCEPTANCE_CRITERIA.md');
const issueLedgerPath = join(gameRoot, 'docs/CYCLE09_ISSUES.md');
const submissionManifestPath = join(gameRoot, 'releases/yandex-submission-1.0.0/media/submission-media-manifest.json');
const requiredDevices = ['android', 'desktop', 'ios'];
const requiredLocales = ['en', 'ru'];
const requiredCategories = ['arcade', 'casual'];
const requiredAdvertising = ['rewarded'];
const requiredChecks = [
  'sdkInitialized',
  'gameReady',
  'locale',
  'focusPause',
  'rewardedReturn',
  'guestSave',
  'authorizedSave',
  'leaderboard',
  'titleAvailability',
];
const requiredZeroDiagnostics = [
  'consoleErrors',
  'consoleWarnings',
  'pageErrors',
  'requestFailures',
  'httpErrors',
  'unexpectedNetworkFailures',
];
const artifactKinds = Object.freeze(Object.fromEntries([
  'authorized-save', 'console-config', 'guest-save', 'leaderboard', 'lifecycle',
  'rewarded-close', 'rewarded-error', 'rewarded-success', 'sdk-ready', 'titles',
].map((id) => [id, `yandex-console-${id}-trace`])));
const requiredArtifactIds = Object.keys(artifactKinds).sort();
const debugEvidenceMap = Object.freeze({
  sdkInitialized: 'sdk-ready',
  gameReady: 'sdk-ready',
  locale: 'sdk-ready',
  focusPause: 'lifecycle',
  rewardedReturn: 'rewarded-success',
  guestSave: 'guest-save',
  authorizedSave: 'authorized-save',
  leaderboard: 'leaderboard',
  titleAvailability: 'titles',
});
const expectedAcceptanceIds = [
  'C09-A-01',
  ...[1, 2, 3, 4, 5, 6].map((value) => `C09-F-0${value}`),
  ...[1, 2, 3, 4, 5].map((value) => `C09-G-0${value}`),
  'C09-PERF-01', 'C09-PERF-02',
  'C09-Q-01', 'C09-Q-02', 'C09-Q-03',
  'C09-RLS-01', 'C09-RLS-02', 'C09-RLS-03', 'C09-RLS-04',
  'C09-V-01', 'C09-V-02', 'C09-V-03', 'C09-V-04',
  ...[1, 2, 3, 4, 5, 6, 7, 8].map((value) => `C09-Y-0${value}`),
].sort();
const expectedIssueIds = [
  'C09-DOC-001', 'C09-REL-001', 'C09-REL-002', 'C09-REL-003',
  'C09-REL-004', 'C09-REL-005', 'C09-REL-006', 'C09-REL-007',
  'C09-REL-008', 'C09-REL-009', 'C09-REL-010', 'C09-REL-011',
  'C09-REL-012', 'C09-SUB-001', 'C09-VIS-001', 'C09-VIS-002',
].sort();
const expectedIssueSeverities = Object.freeze({
  'C09-DOC-001': 'Medium', 'C09-REL-001': 'High', 'C09-REL-002': 'High', 'C09-REL-003': 'Medium',
  'C09-REL-004': 'Medium', 'C09-REL-005': 'Medium', 'C09-REL-006': 'Medium', 'C09-REL-007': 'Medium',
  'C09-REL-008': 'Medium', 'C09-REL-009': 'Medium', 'C09-REL-010': 'High', 'C09-REL-011': 'Medium',
  'C09-REL-012': 'Medium', 'C09-SUB-001': 'High', 'C09-VIS-001': 'High', 'C09-VIS-002': 'High',
});
const externallyBlockableIds = new Set([
  'C09-V-01', 'C09-PERF-01', 'C09-Q-03',
  'C09-Y-01', 'C09-Y-02', 'C09-Y-03', 'C09-Y-04', 'C09-Y-05', 'C09-Y-06', 'C09-Y-07',
  'C09-RLS-03', 'C09-RLS-04',
]);
const expectedSignoffKeys = [
  'acceptanceSha256', 'automationResultsSha256', 'buildId', 'buildManifestSha256', 'commitSha',
  'decision', 'evidenceInventorySha256', 'id', 'independent', 'issueLedgerSha256', 'reviewerId',
  'role', 'signedAt', 'sourceFingerprint', 'submissionMediaManifestSha256',
].sort();
const expectedSignoffRoles = ['Independent Reviewer', 'QA', 'Release Agent'];
const safeRelativePattern = /^(?!\/)(?!.*(?:^|\/)\.\.(?:\/|$))[A-Za-z0-9._+\-/]+$/u;
const shaPattern = /^[a-f0-9]{64}$/u;
const sha256 = (bytes) => createHash('sha256').update(bytes).digest('hex');
const invariant = (condition, message) => { if (!condition) throw new Error(message); };

function parseArguments(argv) {
  let evidence;
  for (const argument of argv) {
    if (argument.startsWith('--evidence=')) {
      invariant(evidence === undefined, '--evidence may be supplied only once.');
      evidence = argument.slice('--evidence='.length);
      invariant(evidence.length > 0, '--evidence requires a non-empty path.');
    } else {
      throw new Error(`Unsupported argument: ${argument}`);
    }
  }
  return evidence;
}

function parseJson(bytes, label) {
  try {
    return JSON.parse(bytes.toString('utf8'));
  } catch {
    throw new Error(`${label} is not valid JSON.`);
  }
}

function exactKeys(value, expected, label) {
  invariant(value && typeof value === 'object' && !Array.isArray(value), `${label} must be an object.`);
  const keys = Object.keys(value).sort();
  invariant(JSON.stringify(keys) === JSON.stringify(expected), `${label} has an unexpected key set.`);
}

function exactStringSet(actual, expected, label) {
  invariant(Array.isArray(actual), `${label} must be an array.`);
  invariant(actual.every((item) => typeof item === 'string'), `${label} must contain strings only.`);
  const sorted = [...actual].sort();
  invariant(new Set(sorted).size === sorted.length, `${label} must not contain duplicates.`);
  invariant(JSON.stringify(sorted) === JSON.stringify(expected), `${label} must equal ${expected.join(', ')}.`);
}

function canonical(value) {
  if (Array.isArray(value)) return value.map(canonical);
  if (value && typeof value === 'object') {
    return Object.fromEntries(Object.keys(value).sort().map((key) => [key, canonical(value[key])]));
  }
  return value;
}

function sameValue(left, right) {
  return JSON.stringify(canonical(left)) === JSON.stringify(canonical(right));
}

function timestamp(value, label) {
  invariant(typeof value === 'string' && Number.isFinite(Date.parse(value)), `${label} must be an ISO timestamp.`);
  return Date.parse(value);
}

function nonEmptyId(value, label) {
  invariant(typeof value === 'string' && /^[A-Za-z0-9][A-Za-z0-9._@/:+-]{1,127}$/u.test(value), `${label} is invalid.`);
  return value;
}

function validateDiagnostics(value, label) {
  exactKeys(value, [...requiredZeroDiagnostics].sort(), label);
  for (const counter of requiredZeroDiagnostics) invariant(value[counter] === 0, `${label}.${counter} must equal 0.`);
}

function validateConfiguration(configuration, label) {
  invariant(configuration && typeof configuration === 'object' && !Array.isArray(configuration), `${label} is missing.`);
  exactKeys(configuration, [
    'advertising', 'ageRating', 'categories', 'cloudSaves', 'devices', 'inAppPurchases',
    'interstitialAds', 'leaderboard', 'locales', 'orientation', 'stickyAds', 'titles', 'tv',
  ], label);
  exactStringSet(configuration.devices, requiredDevices, `${label}.devices`);
  exactStringSet(configuration.locales, requiredLocales, `${label}.locales`);
  exactStringSet(configuration.categories, requiredCategories, `${label}.categories`);
  exactStringSet(configuration.advertising, requiredAdvertising, `${label}.advertising`);
  invariant(configuration.orientation === 'any'
    && configuration.ageRating === '12+'
    && configuration.cloudSaves === true,
  `${label} orientation, age rating or cloud-saves setting differs from the release contract.`);
  invariant(configuration.tv === false
    && configuration.inAppPurchases === false
    && configuration.stickyAds === false
    && configuration.interstitialAds === false,
  `${label} must explicitly disable TV, purchases, sticky ads and interstitial ads.`);
  invariant(configuration.leaderboard?.technicalName === 'bestscore'
    && configuration.leaderboard?.type === 'numeric'
    && configuration.leaderboard?.order === 'DESC',
  `${label} leaderboard must be bestscore, numeric, DESC.`);
  exactKeys(configuration.leaderboard, ['order', 'technicalName', 'type'], `${label}.leaderboard`);
  invariant(configuration.titles?.ru === 'Зажги'
    && configuration.titles?.en === 'Ignite'
    && configuration.titles?.availabilityChecked === true
    && configuration.titles?.available === true,
  `${label} titles must be Зажги/Ignite with a successful availability check.`);
  exactKeys(configuration.titles, ['availabilityChecked', 'available', 'en', 'ru'], `${label}.titles`);
  return canonical({
    ...configuration,
    devices: [...configuration.devices].sort(),
    locales: [...configuration.locales].sort(),
    categories: [...configuration.categories].sort(),
    advertising: [...configuration.advertising].sort(),
  });
}

function validateArchiveBinding(binding, expected, label) {
  exactKeys(binding, ['bytes', 'name', 'sha256'], label);
  invariant(binding?.name === archiveName
    && binding?.bytes === expected.bytes
    && binding?.sha256 === expected.sha256,
  `${label} is bound to different archive bytes.`);
}

function validateSafeDescriptor(descriptor, label, expectedKeys) {
  exactKeys(descriptor, expectedKeys, label);
  invariant(typeof descriptor.path === 'string' && safeRelativePattern.test(descriptor.path), `${label}.path must be safe and relative.`);
  invariant(Number.isInteger(descriptor.bytes) && descriptor.bytes > 0 && descriptor.bytes <= 64 * 1024 * 1024,
    `${label}.bytes is invalid.`);
  invariant(shaPattern.test(descriptor.sha256 ?? ''), `${label}.sha256 is invalid.`);
}

async function readBoundFile(descriptor, evidenceDirectory, label, registry, expectedKeys, snapshotMetadata) {
  validateSafeDescriptor(descriptor, label, expectedKeys);
  const descriptorRoot = resolve(evidenceDirectory);
  const path = resolve(descriptorRoot, descriptor.path);
  const registryRoot = resolve(registry.root ?? descriptorRoot);
  const relation = relative(registryRoot, path).split(sep).join('/');
  invariant(relation.length > 0 && !relation.startsWith('../') && relation !== '..' && !isAbsolute(relation),
    `${label} escapes the logical evidence directory.`);
  const descriptorRootReal = await realpath(descriptorRoot);
  const registryRootReal = registry.realRoot ?? await realpath(registryRoot);
  const descriptorRootRelation = relative(registryRootReal, descriptorRootReal).split(sep).join('/');
  invariant(descriptorRootRelation === ''
    || (!descriptorRootRelation.startsWith('../') && descriptorRootRelation !== '..' && !isAbsolute(descriptorRootRelation)),
  `${label} descriptor root escapes the physical evidence directory.`);
  const info = await lstat(path);
  invariant(info.isFile() && !info.isSymbolicLink(), `${label} is not a regular non-link file.`);
  const pathReal = await realpath(path);
  const physicalRelation = relative(registryRootReal, pathReal).split(sep).join('/');
  invariant(physicalRelation.length > 0
    && !physicalRelation.startsWith('../') && physicalRelation !== '..' && !isAbsolute(physicalRelation),
  `${label} escapes the physical evidence directory through a symlinked parent.`);
  const bytes = await readFile(pathReal);
  invariant(bytes.length === descriptor.bytes && sha256(bytes) === descriptor.sha256, `${label} bytes/hash mismatch.`);
  invariant(!registry.paths.has(relation), `${label} reuses artifact path ${relation}.`);
  const caseFoldedRelation = relation.toLocaleLowerCase('en-US');
  invariant(!registry.caseFoldedPaths.has(caseFoldedRelation), `${label} reuses a case-folded artifact path ${relation}.`);
  invariant(!registry.hashes.has(descriptor.sha256), `${label} reuses artifact SHA-256 ${descriptor.sha256}.`);
  registry.paths.add(relation);
  registry.caseFoldedPaths.add(caseFoldedRelation);
  registry.hashes.add(descriptor.sha256);
  registry.files.set(relation, {
    bytes,
    bytesLength: bytes.length,
    id: snapshotMetadata?.id ?? label,
    role: snapshotMetadata?.role ?? 'attachment',
    sha256: descriptor.sha256,
    sourcePath: relation,
  });
  return { path, realPath: pathReal, relation, bytes };
}

function validateTrace(trace, expectedKind, label, context, options = {}) {
  invariant(trace?.schemaVersion === 1
    && trace.kind === expectedKind
    && trace.status === 'PASS'
    && trace.cycle === '09',
  `${label} must be a typed Cycle 09 ${expectedKind} PASS trace.`);
  invariant(trace.draftId === context.draftId && trace.attemptId === context.attemptId,
    `${label} draft/attempt identity differs from the verified Console run.`);
  validateArchiveBinding(trace.archive, context.archive, `${label}.archive`);
  exactKeys(trace.build, [
    'buildId', 'buildManifestSha256', 'clean', 'commitSha', 'sourceFingerprint', 'target', 'testDriver',
  ], `${label}.build`);
  invariant(trace.build?.buildId === context.identity.buildId
    && trace.build?.commitSha === context.identity.commitSha
    && trace.build?.sourceFingerprint === context.identity.sourceFingerprint
    && trace.build?.clean === true
    && trace.build?.target === 'yandex'
    && trace.build?.testDriver === false
    && trace.build?.buildManifestSha256 === context.manifestSha256,
  `${label} is not bound to the exact clean production build.`);
  const startedAt = timestamp(trace.startedAt, `${label}.startedAt`);
  const completedAt = timestamp(trace.completedAt, `${label}.completedAt`);
  invariant(startedAt >= context.packagedAt
    && completedAt >= startedAt
    && completedAt <= context.evidenceCapturedAt,
  `${label} timestamps must be ordered between packaging and Console evidence capture.`);
  invariant(Number.isFinite(trace.durationMs) && trace.durationMs >= 0
    && Math.abs(trace.durationMs - (completedAt - startedAt)) <= 2_000,
  `${label}.durationMs differs from its timestamp interval.`);
  invariant(Array.isArray(trace.events) && trace.events.length >= (options.minimumEvents ?? 2), `${label}.events is incomplete.`);
  invariant(trace.events[0]?.type === 'trace-start' && trace.events.at(-1)?.type === 'trace-complete',
    `${label} must have trace-start/trace-complete boundary events.`);
  invariant(timestamp(trace.events[0].at, `${label}.trace-start.at`) === startedAt
    && timestamp(trace.events.at(-1).at, `${label}.trace-complete.at`) === completedAt,
  `${label} boundary event timestamps must equal trace startedAt/completedAt.`);
  let previousAt = startedAt;
  for (let index = 0; index < trace.events.length; index += 1) {
    const event = trace.events[index];
    invariant(event && typeof event === 'object' && !Array.isArray(event), `${label}.events[${index}] must be an object.`);
    invariant(event.sequence === index + 1, `${label}.events must have consecutive sequence values starting at 1.`);
    invariant(typeof event.type === 'string' && /^[a-z][a-z0-9._-]+$/u.test(event.type), `${label}.events[${index}].type is invalid.`);
    const at = timestamp(event.at, `${label}.events[${index}].at`);
    invariant(at >= previousAt && at <= completedAt, `${label}.events timestamp is not monotonic/in-range.`);
    previousAt = at;
  }
  return trace;
}

function events(trace, type) {
  return trace.events.filter((event) => event.type === type);
}

function oneEvent(trace, type, label) {
  const matches = events(trace, type);
  invariant(matches.length === 1, `${label} must contain exactly one ${type} event.`);
  return matches[0];
}

function ordered(trace, types, label) {
  let after = -1;
  const result = [];
  for (const type of types) {
    const index = trace.events.findIndex((event, candidate) => candidate > after && event.type === type);
    invariant(index >= 0, `${label} is missing ordered event ${type}.`);
    after = index;
    result.push(trace.events[index]);
  }
  return result;
}

function parseSave(value, label) {
  const parsed = parseInfernoSave(value);
  invariant(parsed.ok, `${label} is not a valid InfernoSaveV1.`);
  return parsed.value;
}

function validateConsoleConfigTrace(trace, context) {
  const [opened, uploadStart, uploadComplete, snapshot, saved] = ordered(trace, [
    'draft-open', 'archive-upload-start', 'archive-upload-complete', 'configuration-read', 'draft-save-complete',
  ], 'console-config trace');
  invariant(opened.draftId === context.draftId
    && uploadComplete.draftId === context.draftId
    && saved.draftId === context.draftId,
  'Console config trace draft identity is inconsistent.');
  validateArchiveBinding(uploadStart.archive, context.archive, 'archive-upload-start.archive');
  invariant(uploadComplete.accepted === true && uploadComplete.archiveSha256 === context.archive.sha256,
    'Console trace does not prove completion of the exact archive upload.');
  invariant(saved.persisted === true, 'Console trace does not prove that the draft configuration was saved.');
  const fromTrace = validateConfiguration(trace.configuration, 'console-config trace.configuration');
  invariant(sameValue(snapshot.configuration, trace.configuration), 'configuration-read differs from trace.configuration.');
  return fromTrace;
}

function validateSdkReadyTrace(trace) {
  const sessions = new Map();
  for (const event of trace.events) {
    const sessionId = event.sessionId;
    if (typeof sessionId !== 'string') continue;
    if (!sessions.has(sessionId)) sessions.set(sessionId, []);
    sessions.get(sessionId).push(event);
  }
  invariant(sessions.size >= 2, 'sdk-ready trace must contain separate RU and EN real launches.');
  const provenLocales = new Set();
  for (const [sessionId, sessionEvents] of sessions) {
    nonEmptyId(sessionId, `sdk-ready session ${sessionId}`);
    const scoped = { events: sessionEvents };
    const sequence = ordered(scoped, [
      'sdk-initialized', 'locale-mapped', 'game-interactive', 'loading-api-ready', 'session-complete',
    ], `sdk-ready session ${sessionId}`);
    invariant(events(scoped, 'sdk-initialized').length === 1
      && events(scoped, 'loading-api-ready').length === 1,
    `sdk-ready session ${sessionId} must initialize and call LoadingAPI.ready exactly once.`);
    const [init, locale, interactive, ready] = sequence;
    invariant(init.sdk === 'YaGames' && init.initialized === true, `sdk-ready session ${sessionId} did not initialize YaGames.`);
    invariant(['ru', 'en'].includes(locale.locale), `sdk-ready session ${sessionId} has an unsupported mapped locale.`);
    invariant(typeof locale.platformLang === 'string' && locale.platformLang.length >= 2,
      `sdk-ready session ${sessionId} has no source platform language.`);
    invariant(interactive.interactive === true && ready.ready === true,
      `sdk-ready session ${sessionId} did not prove interactive readiness and LoadingAPI.ready.`);
    invariant(timestamp(ready.at, 'loading-api-ready.at') >= timestamp(interactive.at, 'game-interactive.at'),
      `sdk-ready session ${sessionId} called ready before interactivity.`);
    provenLocales.add(locale.locale);
  }
  exactStringSet([...provenLocales], requiredLocales, 'sdk-ready proven locales');
}

function validateLifecycleTrace(trace) {
  const sequence = ordered(trace, [
    'game-api-pause', 'early-pause-add', 'game-api-resume', 'early-pause-remove', 'game-ready', 'gameplay-start',
    'window-blur', 'pause', 'gameplay-stop', 'game-api-pause', 'pause',
    'visibility-hidden', 'pause', 'game-api-resume', 'resume',
    'visibility-visible', 'resume', 'window-focus', 'resume', 'gameplay-start',
  ], 'lifecycle trace');
  const [earlyAdd, earlyRemove, blurAdd, platformAdd, visibilityAdd, platformRemove, visibilityRemove, blurRemove] = [
    sequence[1], sequence[3], sequence[7], sequence[10], sequence[12], sequence[14], sequence[16], sequence[18],
  ];
  invariant(earlyAdd.reason === 'platform' && sameValue(earlyAdd.reasons, ['platform'])
    && earlyRemove.reason === 'platform' && sameValue(earlyRemove.reasons, []),
  'Lifecycle trace does not prove early platform pause/resume before Game Ready.');
  invariant(blurAdd.reason === 'blur' && sameValue(blurAdd.reasons, ['blur'])
    && platformAdd.reason === 'platform' && sameValue([...platformAdd.reasons].sort(), ['blur', 'platform'])
    && visibilityAdd.reason === 'visibility' && sameValue([...visibilityAdd.reasons].sort(), ['blur', 'platform', 'visibility'])
    && platformRemove.reason === 'platform' && sameValue([...platformRemove.reasons].sort(), ['blur', 'visibility'])
    && visibilityRemove.reason === 'visibility' && sameValue(visibilityRemove.reasons, ['blur'])
    && blurRemove.reason === 'blur' && sameValue(blurRemove.reasons, []),
  'Lifecycle trace does not prove nested platform/blur/visibility pause-reason coordination.');
  invariant(events(trace, 'gameplay-start').length === 2 && events(trace, 'gameplay-stop').length === 1,
    'Lifecycle trace must prove exact GameplayAPI start/stop counts without duplicate transitions.');
}

function validateRewardRequest(event, label) {
  invariant(event.placement === 'heat-power-2x-60s'
    && event.userInitiated === true
    && event.confirmed === true
    && event.autoShown === false
    && Number.isInteger(event.stage) && event.stage >= 3 && event.stage <= 7
    && event.offerVisible === true
    && event.safeState === true
    && event.boostActive === false
    && event.attackActive === false,
  `${label} is not a confirmed voluntary heat-power-2x-60s request.`);
}

function validateActiveTimeline(trace, label) {
  let previous = -1;
  for (const event of trace.events) {
    invariant(Number.isSafeInteger(event.activeTimeMs) && event.activeTimeMs >= previous,
      `${label} activeTimeMs must be present, integral and monotonic on every event.`);
    previous = event.activeTimeMs;
  }
}

function validateRewardSuccess(trace) {
  validateActiveTimeline(trace, 'rewarded-success trace');
  const [request, opened, pauseAdded, suspended, rewarded, granted, closed, pauseRemoved, resumed, boostExpired, cooldownExpired, repeat] = ordered(trace, [
    'reward-request', 'reward-on-open', 'ad-pause-applied', 'audio-suspended', 'reward-on-rewarded', 'reward-grant',
    'reward-on-close', 'active-timer-resumed', 'audio-resumed', 'boost-end', 'cooldown-ready', 'reward-repeat-request',
  ], 'rewarded-success trace');
  validateRewardRequest(request, 'rewarded-success request');
  invariant(events(trace, 'reward-on-rewarded').length === 1 && events(trace, 'reward-grant').length === 1,
    'Rewarded success must have exactly one onRewarded and one grant.');
  invariant(rewarded.callback === 'onRewarded'
    && rewarded.placement === 'heat-power-2x-60s'
    && granted.source === 'onRewarded'
    && granted.placement === 'heat-power-2x-60s'
    && granted.multiplier === 2
    && granted.durationActiveMs === 60_000,
  'Rewarded grant is not an onRewarded-only ×2/60-active-second grant.');
  const paused = oneEvent(trace, 'active-timer-paused', 'rewarded-success trace');
  const frozen = oneEvent(trace, 'simulation-frozen', 'rewarded-success trace');
  ordered(trace, ['reward-on-open', 'ad-pause-applied', 'simulation-frozen', 'active-timer-paused', 'audio-suspended'],
    'rewarded-success pause entry');
  invariant(opened.activeTimeMs === pauseAdded.activeTimeMs
    && opened.activeTimeMs === suspended.activeTimeMs
    && opened.activeTimeMs === paused.activeTimeMs
    && opened.activeTimeMs === frozen.activeTimeMs
    && opened.activeTimeMs === rewarded.activeTimeMs
    && opened.activeTimeMs === granted.activeTimeMs
    && opened.activeTimeMs === closed.activeTimeMs,
  'Active time advanced while rewarded advertising was open.');
  invariant(pauseRemoved.activeTimeMs === closed.activeTimeMs && resumed.activeTimeMs === closed.activeTimeMs,
    'Rewarded close did not resume from the frozen active clock exactly once.');
  invariant(events(trace, 'audio-suspended').length === 1
    && events(trace, 'audio-resumed').length === 1
    && events(trace, 'ad-pause-applied').length === 1
    && events(trace, 'active-timer-paused').length === 1
    && events(trace, 'active-timer-resumed').length === 1
    && events(trace, 'simulation-frozen').length === 1,
  'Rewarded success pause/audio lifecycle counts are not exact.');
  const boostStarted = oneEvent(trace, 'boost-start', 'rewarded-success trace');
  const cooldownStarted = oneEvent(trace, 'cooldown-start', 'rewarded-success trace');
  ordered(trace, ['reward-grant', 'boost-start', 'cooldown-start'], 'rewarded-success grant timers');
  invariant(boostStarted.activeTimeMs === granted.activeTimeMs
    && boostExpired.activeTimeMs - boostStarted.activeTimeMs === 60_000,
    'Rewarded boost did not expire after exactly 60 active seconds.');
  invariant(cooldownStarted.activeTimeMs === granted.activeTimeMs
    && cooldownExpired.activeTimeMs - cooldownStarted.activeTimeMs === 90_000,
    'Rewarded cooldown did not expire after exactly 90 active seconds.');
  invariant(repeat.activeTimeMs === cooldownExpired.activeTimeMs
    && repeat.placement === 'heat-power-2x-60s',
  'Rewarded repeat request was not accepted after the 90-active-second cooldown.');
  const repeatSucceeded = oneEvent(trace, 'reward-repeat-succeeded', 'rewarded-success trace');
  invariant(repeatSucceeded.accepted === true && repeatSucceeded.activeTimeMs >= repeat.activeTimeMs,
    'Rewarded repeat request did not succeed.');
  invariant(events(trace, 'reward-auto-show').length === 0, 'Rewarded success trace contains an automatic ad show.');
  return {
    placement: 'heat-power-2x-60s',
    success: { onRewardedCount: 1, grantCount: 1, boostActiveMs: 60_000, cooldownActiveMs: 90_000, autoShown: false },
    repeatAfterCooldown: { activeMs: 90_000, requestSucceeded: true },
    pauseAudio: { simulationFrozen: true, adPauseApplied: true, audioSuspended: true, resumedOnce: true },
  };
}

function validateRewardClose(trace) {
  validateActiveTimeline(trace, 'rewarded-close trace');
  const [request, opened, pauseAdded, suspended, closed, pauseRemoved, resumed, retry] = ordered(trace, [
    'reward-request', 'reward-on-open', 'ad-pause-applied', 'audio-suspended', 'reward-on-close',
    'active-timer-resumed', 'audio-resumed', 'reward-retry-available',
  ], 'rewarded-close trace');
  validateRewardRequest(request, 'rewarded-close request');
  invariant(closed.rewarded === false && retry.available === true,
    'Rewarded close trace does not prove an immediately available retry after close without reward.');
  const paused = oneEvent(trace, 'active-timer-paused', 'rewarded-close trace');
  ordered(trace, ['reward-on-open', 'ad-pause-applied', 'active-timer-paused', 'audio-suspended'],
    'rewarded-close pause entry');
  invariant(opened.activeTimeMs === pauseAdded.activeTimeMs
    && opened.activeTimeMs === suspended.activeTimeMs
    && opened.activeTimeMs === paused.activeTimeMs
    && opened.activeTimeMs === closed.activeTimeMs
    && pauseRemoved.activeTimeMs === closed.activeTimeMs
    && resumed.activeTimeMs === closed.activeTimeMs,
  'Active time advanced or pause/audio restoration failed during close-without-reward.');
  invariant(events(trace, 'reward-on-rewarded').length === 0
    && events(trace, 'reward-grant').length === 0
    && events(trace, 'cooldown-start').length === 0
    && events(trace, 'cooldown-ready').length === 0,
  'Close without reward granted a reward or started cooldown.');
  return { onRewardedCount: 0, grantCount: 0, cooldownStarted: false, retryAvailable: true };
}

function validateRewardError(trace) {
  validateActiveTimeline(trace, 'rewarded-error trace');
  const [request, error, retry] = ordered(trace, ['reward-request', 'reward-on-error', 'reward-retry-available'], 'rewarded-error trace');
  validateRewardRequest(request, 'rewarded-error request');
  invariant(typeof error.code === 'string' && error.code.length >= 1 && retry.available === true,
    'Rewarded error trace has no typed SDK error or retry proof.');
  invariant(events(trace, 'reward-on-rewarded').length === 0
    && events(trace, 'reward-grant').length === 0
    && events(trace, 'cooldown-start').length === 0
    && events(trace, 'cooldown-ready').length === 0,
  'Rewarded error granted a reward or started cooldown.');
  const opened = events(trace, 'reward-on-open');
  if (opened.length > 0) {
    invariant(opened.length === 1
      && events(trace, 'ad-pause-applied').length === 1
      && events(trace, 'active-timer-paused').length === 1
      && events(trace, 'active-timer-resumed').length === 1
      && events(trace, 'audio-suspended').length === 1
      && events(trace, 'audio-resumed').length === 1,
    'Rewarded error after ad open did not restore pause/audio exactly once.');
  }
  return { onRewardedCount: 0, grantCount: 0, cooldownStarted: false, retryAvailable: true };
}

function validateGuestSaveTrace(trace) {
  const [player, localWrite, localReadback, cloudSkip, leaderboardSkip, promptCount] = ordered(trace, [
    'guest-player-state', 'guest-local-save-write', 'guest-local-save-readback', 'guest-cloud-save-skipped',
    'guest-leaderboard-skipped', 'auth-prompt-count',
  ], 'guest-save trace');
  invariant(player.authorized === false, 'Guest trace does not identify a guest player.');
  const written = parseSave(localWrite.save, 'guest local write');
  const readback = parseSave(localReadback.save, 'guest local readback');
  invariant(sameValue(written, readback), 'Guest local save did not survive an immediate readback.');
  invariant(cloudSkip.reason === 'unauthorized'
    && cloudSkip.sdkCalls === 0
    && leaderboardSkip.reason === 'unauthorized'
    && leaderboardSkip.sdkCalls === 0
    && promptCount.count === 0,
  'Guest flow attempted cloud/ranking authorization or prompted the player.');
  return written;
}

function validateAuthorizedSaveTrace(trace) {
  const [initialWrite, readEvent, mergeEvent, localMergeWrite] = ordered(trace, [
    'authorized-save-write', 'authorized-save-read', 'authorized-save-merge', 'authorized-local-merge-write', 'cloud-set-data',
  ], 'authorized-save trace');
  invariant(initialWrite.authorized === true && initialWrite.storage === 'local', 'Authorized save trace does not prove an immediate authorized local write.');
  parseSave(initialWrite.save, 'authorized initial local write');
  const local = parseSave(readEvent.localSave, 'authorized local read');
  const cloud = parseSave(readEvent.cloudSave, 'authorized cloud read');
  invariant(readEvent.method === 'player.getData' && readEvent.key === 'infernoSaveV1',
    'Authorized save trace does not use player.getData(infernoSaveV1).');
  const merged = parseSave(mergeEvent.save, 'authorized merged save');
  const persistedLocal = parseSave(localMergeWrite.save, 'authorized merged local write');
  invariant(sameValue(merged, mergeInfernoSaves(local, cloud)), 'Authorized merge is not max-record/latest-wins V1 merge.');
  invariant(sameValue(persistedLocal, merged), 'Authorized merged save was not immediately written locally.');
  const writes = events(trace, 'cloud-set-data');
  invariant(writes.length >= 3, 'Authorized save trace must contain two rate-limited writes and a final flush.');
  const regularWrites = writes.filter((event) => event.flush === false);
  const flushWrites = writes.filter((event) => event.flush === true);
  invariant(regularWrites.length >= 2 && flushWrites.length >= 1, 'Authorized save trace lacks regular writes or final flush.');
  for (let index = 1; index < regularWrites.length; index += 1) {
    invariant(timestamp(regularWrites[index].at, 'cloud-set-data.at') - timestamp(regularWrites[index - 1].at, 'cloud-set-data.at') >= 5_000,
      'Authorized cloud setData calls occurred more often than once per five seconds.');
  }
  let previousCloudSave = merged;
  for (let index = 0; index < writes.length; index += 1) {
    const write = writes[index];
    invariant(write.method === 'player.setData'
      && write.key === 'infernoSaveV1'
      && write.ok === true,
    'Authorized cloud write does not prove successful player.setData(infernoSaveV1).');
    const cloudSave = parseSave(write.save, 'authorized cloud write save');
    invariant((index !== 0 || sameValue(cloudSave, merged))
      && cloudSave.bestScore >= previousCloudSave.bestScore
      && cloudSave.highestStageReached >= previousCloudSave.highestStageReached
      && cloudSave.longestInfernoHoldMs >= previousCloudSave.longestInfernoHoldMs
      && cloudSave.maxMultiplier >= previousCloudSave.maxMultiplier
      && cloudSave.runsPlayed >= previousCloudSave.runsPlayed
      && cloudSave.updatedAt >= previousCloudSave.updatedAt,
    'Authorized cloud write regressed a saved maximum or latest-wins timestamp.');
    previousCloudSave = cloudSave;
  }
  const finalFlush = flushWrites.at(-1);
  invariant(finalFlush === writes.at(-1)
    && ['run-end', 'background'].includes(finalFlush.reason),
  'Authorized trace does not end with a run-end/background final cloud flush.');
  return merged;
}

function validateLeaderboardTrace(trace, minimumScore) {
  const [readAvailability, writeAvailability, policy, setScore, getEntries] = ordered(trace, [
    'leaderboard-availability-check', 'leaderboard-availability-check', 'leaderboard-policy',
    'leaderboard-score-submit', 'leaderboard-score-read',
  ], 'leaderboard trace');
  const availability = [readAvailability, writeAvailability];
  invariant(sameValue(availability.map((event) => event.method).sort(), ['leaderboards.getEntries', 'leaderboards.setScore'])
    && availability.every((event) => event.available === true && event.via === 'ysdk.isAvailableMethod'),
  'Leaderboard trace does not prove direct read/write isAvailableMethod checks.');
  invariant(policy.readLimit === 20
    && policy.readWindowMs === 300_000
    && policy.cacheMs === 15_000,
  'Leaderboard trace does not prove the configured Yandex API limits/cache policy.');
  invariant(setScore.technicalName === 'bestscore'
    && setScore.method === 'ysdk.leaderboards.setScore'
    && Number.isInteger(setScore.score)
    && setScore.score >= minimumScore
    && setScore.ok === true,
  'Leaderboard trace does not prove a successful direct bestscore numeric write.');
  invariant(getEntries.technicalName === 'bestscore'
    && getEntries.method === 'ysdk.leaderboards.getEntries'
    && getEntries.includeUser === true
    && Number.isInteger(getEntries.quantityTop) && getEntries.quantityTop >= 1 && getEntries.quantityTop <= 10
    && Number.isInteger(getEntries.quantityAround) && getEntries.quantityAround >= 0 && getEntries.quantityAround <= 3
    && getEntries.ok === true,
  'Leaderboard trace does not prove a limited direct bestscore read.');
  return setScore.score;
}

const crcTable = (() => {
  const table = new Uint32Array(256);
  for (let value = 0; value < 256; value += 1) {
    let current = value;
    for (let bit = 0; bit < 8; bit += 1) current = (current & 1) ? (0xedb88320 ^ (current >>> 1)) : (current >>> 1);
    table[value] = current >>> 0;
  }
  return table;
})();

function crc32(bytes) {
  let value = 0xffffffff;
  for (const byte of bytes) value = crcTable[(value ^ byte) & 0xff] ^ (value >>> 8);
  return (value ^ 0xffffffff) >>> 0;
}

function pngDimensions(bytes, label) {
  invariant(bytes.length >= 33 && bytes.subarray(0, 8).equals(Buffer.from('89504e470d0a1a0a', 'hex')), `${label} has no PNG signature.`);
  let offset = 8;
  let width;
  let height;
  let chunks = 0;
  let sawImageData = false;
  let sawEnd = false;
  while (offset + 12 <= bytes.length) {
    const length = bytes.readUInt32BE(offset);
    invariant(length <= 32 * 1024 * 1024 && offset + 12 + length <= bytes.length, `${label} has a truncated/oversized PNG chunk.`);
    const type = bytes.subarray(offset + 4, offset + 8).toString('ascii');
    const payloadEnd = offset + 8 + length;
    const expectedCrc = bytes.readUInt32BE(payloadEnd);
    invariant(crc32(bytes.subarray(offset + 4, payloadEnd)) === expectedCrc, `${label} has a bad ${type} CRC.`);
    if (chunks === 0) {
      invariant(type === 'IHDR' && length === 13, `${label} does not start with a valid IHDR.`);
      width = bytes.readUInt32BE(offset + 8);
      height = bytes.readUInt32BE(offset + 12);
    }
    if (type === 'IDAT' && length > 0) sawImageData = true;
    offset = payloadEnd + 4;
    chunks += 1;
    if (type === 'IEND') {
      invariant(length === 0, `${label} has a nonempty IEND.`);
      sawEnd = true;
      break;
    }
  }
  invariant(sawImageData && sawEnd && offset === bytes.length
    && width >= 640 && height >= 360 && width <= 16_384 && height <= 16_384,
  `${label} is incomplete, implausible or below 640×360.`);
  return { width, height };
}

async function validateTitlesTrace(trace, tracePath, context, registry) {
  ordered(trace, ['title-ru-observed', 'title-en-observed', 'availability-checked'], 'title trace');
  const rendered = [
    oneEvent(trace, 'title-ru-observed', 'title trace'),
    oneEvent(trace, 'title-en-observed', 'title trace'),
  ];
  const byLocale = new Map(rendered.map((event) => [event.locale, event]));
  invariant(byLocale.size === 2
    && byLocale.get('ru')?.title === 'Зажги'
    && byLocale.get('en')?.title === 'Ignite'
    && rendered.every((event) => event.draftId === context.draftId),
  'Title trace does not prove exact RU/EN titles in the exact draft.');
  const result = oneEvent(trace, 'availability-checked', 'title trace');
  invariant(result.draftId === context.draftId
    && result.available === true
    && result.ru === 'Зажги'
    && result.en === 'Ignite',
  'Title availability result does not prove both exact available titles.');
  invariant(trace.titles?.ru === 'Зажги' && trace.titles?.en === 'Ignite'
    && trace.titles?.availabilityChecked === true && trace.titles?.available === true,
  'Title trace.titles differs from the exact available titles.');
  invariant(Array.isArray(trace.screenshots) && trace.screenshots.length === 2, 'Title trace must bind two PNG screenshots.');
  const screenshots = [];
  for (const descriptor of trace.screenshots) {
    invariant(['title-ru', 'title-en'].includes(descriptor?.id), 'Title screenshot id is invalid.');
    const locale = descriptor.id === 'title-ru' ? 'ru' : 'en';
    const expectedKeys = ['bytes', 'capturedAt', 'height', 'id', 'path', 'sha256', 'width'];
    exactKeys(descriptor, expectedKeys, `title screenshot ${locale}`);
    const file = await readBoundFile(descriptor, dirname(tracePath), `title screenshot ${locale}`, registry, expectedKeys, {
      id: descriptor.id,
      role: 'attachment',
    });
    const dimensions = pngDimensions(file.bytes, `title screenshot ${locale}`);
    invariant(descriptor.width === dimensions.width && descriptor.height === dimensions.height,
      `Title screenshot ${locale} dimensions must be declared and equal its PNG IHDR.`);
    const capturedAt = timestamp(descriptor.capturedAt, `title screenshot ${locale}.capturedAt`);
    invariant(capturedAt >= timestamp(trace.startedAt, 'title trace startedAt')
      && capturedAt <= timestamp(trace.completedAt, 'title trace completedAt'),
    `Title screenshot ${locale} timestamp is outside the title trace.`);
    screenshots.push({ ...descriptor, locale, path: file.relation });
  }
  exactStringSet(screenshots.map((item) => item.locale), requiredLocales, 'title screenshot locales');
  const review = trace.review;
  const reviewerId = nonEmptyId(review?.reviewerId, 'title independent reviewer id');
  invariant(review.independent === true && reviewerId !== 'root' && reviewerId !== context.operatorId
    && review.draftId === context.draftId && review.decision === 'APPROVE_TITLES',
  'Title reviewer must independently approve the exact draft.');
  const reviewedAt = timestamp(review.reviewedAt, 'title independent review reviewedAt');
  invariant(reviewedAt >= timestamp(trace.startedAt, 'title trace startedAt')
    && reviewedAt <= timestamp(trace.completedAt, 'title trace completedAt')
    && screenshots.every((item) => timestamp(item.capturedAt, `title screenshot ${item.locale}.capturedAt`) <= reviewedAt),
  'Title independent review timestamp is outside the title trace interval.');
  invariant(review.titles?.ru === 'Зажги' && review.titles?.en === 'Ignite'
    && review.titles?.availabilityChecked === true && review.titles?.available === true,
    'Title independent review does not approve the exact available titles.');
  invariant(sameValue(review.screenshots, trace.screenshots.map(({ id, path, bytes, sha256: digest, width, height, capturedAt }) => ({
    id, path, bytes, sha256: digest, width, height, capturedAt,
  }))), 'Title independent review is not bound to the exact screenshot bytes.');
  invariant(review.observations?.draftIdVisible === true
    && review.observations?.titlesVisible === true
    && review.observations?.availabilityVisible === true
    && review.observations?.realConsoleUi === true
    && review.observations?.titleCollisionAbsent === true,
  'Title independent review observations are incomplete.');
  return { screenshots, review: { reviewedAt: review.reviewedAt, reviewerId, decision: review.decision } };
}

async function walkExtracted(root) {
  const files = [];
  async function visit(directory) {
    for (const entry of await readdir(directory, { withFileTypes: true })) {
      const path = join(directory, entry.name);
      const info = await lstat(path);
      if (info.isDirectory() && !info.isSymbolicLink()) await visit(path);
      else {
        invariant(info.isFile() && !info.isSymbolicLink(), `Extracted archive contains a non-regular entry: ${relative(root, path)}`);
        files.push(path);
      }
    }
  }
  await visit(root);
  return files.sort();
}

function expectedMime(path) {
  const mime = new Map([
    ['.html', 'text/html'], ['.js', 'text/javascript'], ['.css', 'text/css'], ['.json', 'application/json'],
    ['.txt', 'text/plain'], ['.svg', 'image/svg+xml'], ['.webp', 'image/webp'], ['.png', 'image/png'],
    ['.mp3', 'audio/mpeg'], ['.ogg', 'audio/ogg'], ['.opus', 'audio/ogg'], ['.flac', 'audio/flac'],
  ]);
  return mime.get(extname(path)) ?? 'application/octet-stream';
}

async function auditArchive(manifest, manifestBytes, archiveBytes) {
  invariant(Array.isArray(manifest.files) && manifest.files.length > 0, 'Build manifest file inventory is missing.');
  const manifestPaths = manifest.files.map((item) => item.path);
  invariant(manifest.files.every((item) => item && typeof item === 'object'
    && typeof item.path === 'string' && safeRelativePattern.test(item.path)
    && item.path !== 'build-manifest.json'
    && Number.isInteger(item.bytes) && item.bytes > 0
    && shaPattern.test(item.sha256 ?? '')),
  'Build manifest contains an invalid file record.');
  invariant(new Set(manifestPaths).size === manifestPaths.length, 'Build manifest contains duplicate file paths.');
  invariant(JSON.stringify(manifestPaths) === JSON.stringify([...manifestPaths].sort()), 'Build manifest files are not sorted canonically.');
  invariant(manifest.files.reduce((sum, item) => sum + item.bytes, manifestBytes.length) === manifest.unpackedBytes,
    'Build manifest self-inclusive unpacked byte total is invalid.');
  const expectedRelative = [...manifestPaths, 'build-manifest.json'].sort();
  const listing = spawnSync('tar', ['-tf', archivePath], { cwd: gameRoot, encoding: 'utf8', maxBuffer: 16 * 1024 * 1024 });
  invariant(listing.status === 0, `Unable to list RC ZIP: ${listing.stderr || listing.stdout || 'tar failed'}`);
  const rawEntries = String(listing.stdout).split(/\r?\n/u).filter(Boolean);
  invariant(rawEntries.length > 0 && rawEntries.every((entry) => entry === entry.trim()), 'ZIP contains malformed entry names.');
  const allEntries = rawEntries.map((entry) => entry.replace(/^\.\//u, ''));
  invariant(allEntries.every((entry) => safeRelativePattern.test(entry)
    && !entry.endsWith('/')
    && !entry.includes('\\')),
  'ZIP contains an unsafe, directory or backslash entry.');
  invariant(new Set(allEntries).size === allEntries.length, 'ZIP contains duplicate entries.');
  invariant(JSON.stringify([...allEntries].sort()) === JSON.stringify(expectedRelative), 'ZIP inventory differs from the exact build manifest.');
  const verbose = spawnSync('tar', ['-tvf', archivePath], { cwd: gameRoot, encoding: 'utf8', maxBuffer: 32 * 1024 * 1024 });
  invariant(verbose.status === 0, `Unable to inspect RC ZIP entry types: ${verbose.stderr || verbose.stdout || 'tar failed'}`);
  const metadataLines = String(verbose.stdout).split(/\r?\n/u).filter(Boolean);
  invariant(metadataLines.length === allEntries.length && metadataLines.every((line) => line.trimStart().startsWith('-')),
    'ZIP contains a symlink, hardlink, device or other non-regular entry.');

  const extractionRoot = await mkdtemp(join(tmpdir(), 'inferno-yandex-draft-zip-audit-'));
  let server;
  try {
    const extract = spawnSync('tar', ['-xf', archivePath, '-C', extractionRoot], {
      cwd: gameRoot,
      encoding: 'utf8',
      maxBuffer: 32 * 1024 * 1024,
    });
    invariant(extract.status === 0, `Unable to extract RC ZIP: ${extract.stderr || extract.stdout || 'tar failed'}`);
    await verifyBuildPayload(extractionRoot, manifest);
    const extractedFiles = await walkExtracted(extractionRoot);
    const actualRelative = extractedFiles.map((path) => relative(extractionRoot, path).split(sep).join('/')).sort();
    invariant(JSON.stringify(actualRelative) === JSON.stringify(expectedRelative), 'Fresh extraction inventory differs from the ZIP/build manifest.');
    let extractedBytes = 0;
    const expectedByPath = new Map(manifest.files.map((item) => [item.path, item]));
    expectedByPath.set('build-manifest.json', { path: 'build-manifest.json', bytes: manifestBytes.length, sha256: sha256(manifestBytes) });
    for (const path of extractedFiles) {
      const relation = relative(extractionRoot, path).split(sep).join('/');
      const info = await stat(path);
      const bytes = await readFile(path);
      const expected = expectedByPath.get(relation);
      invariant(info.isFile() && expected && bytes.length === expected.bytes && sha256(bytes) === expected.sha256,
        `Fresh extraction byte/hash mismatch: ${relation}`);
      extractedBytes += bytes.length;
    }
    invariant(extractedBytes === manifest.unpackedBytes, `Fresh extraction byte total drift: ${extractedBytes} != ${manifest.unpackedBytes}`);
    invariant(archiveBytes.length > 0, 'RC archive is empty.');

    server = await startVerifiedStaticServer(extractionRoot);
    for (const relation of expectedRelative) {
      const requestPath = relation === 'index.html' ? '/' : `/${relation}`;
      const response = await fetch(`${server.baseUrl}${requestPath}`, { signal: AbortSignal.timeout(15_000) });
      invariant(response.status === 200 && response.headers.get('x-inferno-server-nonce') === server.nonce,
        `Owned HTTP audit failed for ${requestPath}.`);
      invariant(response.headers.get('content-type')?.startsWith(expectedMime(relation)),
        `Owned HTTP audit returned the wrong MIME for ${requestPath}.`);
      const bytes = Buffer.from(await response.arrayBuffer());
      const expected = expectedByPath.get(relation);
      invariant(bytes.length === expected.bytes && sha256(bytes) === expected.sha256,
        `Owned HTTP audit returned different bytes for ${requestPath}.`);
    }
    const missing = await fetch(`${server.baseUrl}/definitely-missing-cycle09-draft-verification`, {
      signal: AbortSignal.timeout(15_000),
    });
    invariant(missing.status === 404 && missing.headers.get('x-inferno-server-nonce') === server.nonce,
      'Owned HTTP audit did not return an owned 404.');
    return {
      entries: allEntries.length,
      exactInventoryAndHashes: true,
      regularFilesOnly: true,
      freshExtraction: true,
      extractedBytes,
      ownedHttpFilesChecked: expectedRelative.length,
      ownedHttpMimeAndBytes: true,
      owned404: true,
    };
  } finally {
    await server?.stop();
    await rm(extractionRoot, { recursive: true, force: true });
  }
}

function acceptanceRowsFromDocument(bytes) {
  const lines = bytes.toString('utf8').split(/\r?\n/u).filter((line) => line.startsWith('| C09-'));
  invariant(lines.length === expectedAcceptanceIds.length, 'Acceptance document must contain exactly 33 Cycle 09 rows.');
  const rows = lines.map((line) => {
    const match = line.match(/^\| (C09-[A-Z]+-\d+) \| ([^|]+) \| ([^|]+) \| ([^|]+) \|$/u);
    invariant(match && match.slice(1).every((cell) => cell.length > 0 && cell === cell.trim()),
      `Malformed Cycle 09 acceptance row: ${line}`);
    const rawStatus = match[4];
    if (rawStatus === 'PASS' || rawStatus === 'READY_FOR_PACKAGE') return { id: match[1], status: rawStatus };
    const blocked = rawStatus.match(/^BLOCKED_EXTERNAL — (.+)$/u);
    invariant(blocked, `${match[1]} has unsupported acceptance status ${rawStatus}.`);
    return { id: match[1], status: 'BLOCKED_EXTERNAL', reason: blocked[1] };
  }).sort((left, right) => left.id.localeCompare(right.id));
  return validateAcceptanceRows(rows);
}

function expectedBlockerMappings(blockers) {
  invariant(Array.isArray(blockers)
    && blockers.every((item) => typeof item === 'string' && item.length > 0 && item === item.trim())
    && new Set(blockers).size === blockers.length,
  'External blockers must be unique, nonempty exact strings.');
  const browserCriteria = ['C09-Q-03', 'C09-RLS-04', 'C09-V-01'];
  const deviceCriteria = ['C09-PERF-01', 'C09-Q-03', 'C09-RLS-04', 'C09-V-01'];
  const consoleCriteria = [
    'C09-RLS-03', 'C09-RLS-04',
    'C09-Y-01', 'C09-Y-02', 'C09-Y-03', 'C09-Y-04', 'C09-Y-05', 'C09-Y-06', 'C09-Y-07',
  ].sort();
  const policies = [
    ...['Yandex Browser', 'Mozilla Firefox', 'Opera', 'Apple Safari'].map((name) => ({
      pattern: new RegExp(`^${name.replace(/[.*+?^${}()|[\]\\]/gu, '\\$&')} executed Cycle 09 production run evidence$`, 'u'),
      criteria: browserCriteria,
    })),
    { pattern: /^Android physical device or real-device cloud exact-build run$/u, criteria: deviceCriteria },
    { pattern: /^iOS physical device or real-device cloud exact-build run$/u, criteria: deviceCriteria },
    { pattern: /^authorized Yandex Games Console exact-RC draft\/debug trace$/u, criteria: consoleCriteria },
    {
      pattern: /^Host compositor calibration cannot prove one or more required FPS thresholds\.$/u,
      criteria: ['C09-PERF-01', 'C09-Q-03', 'C09-RLS-04'],
    },
  ];
  return [...blockers].sort().map((blocker) => {
    const matches = policies.filter((policy) => policy.pattern.test(blocker));
    invariant(matches.length === 1, `Unknown or ambiguous external blocker category: ${blocker}`);
    return { blocker, criteria: [...matches[0].criteria].sort() };
  });
}

function validateBlockers(blockers, rows, stopMappings, gateStatus) {
  const mappings = expectedBlockerMappings(blockers);
  const byCriterion = new Map();
  for (const mapping of mappings) {
    for (const id of mapping.criteria) {
      const list = byCriterion.get(id) ?? [];
      list.push(mapping.blocker);
      byCriterion.set(id, list);
    }
  }
  const blockedRows = rows.filter((item) => item.status === 'BLOCKED_EXTERNAL');
  invariant(sameValue(blockedRows.map((item) => item.id).sort(), [...byCriterion.keys()].sort()),
    'Blocked acceptance IDs differ from the static blocker policy.');
  for (const row of blockedRows) {
    invariant(row.reason === [...byCriterion.get(row.id)].sort().join('; '),
      `${row.id} blocker reason differs from the exact mapped blockers.`);
  }
  invariant(sameValue([...(stopMappings ?? [])].sort((a, b) => (
    a.blocker < b.blocker ? -1 : a.blocker > b.blocker ? 1 : 0
  )), mappings),
    'Stop-report blocker mappings differ from the static blocker policy.');
  if (gateStatus === 'PASS') invariant(blockers.length === 0 && blockedRows.length === 0, 'PASS gate retains external blockers.');
  else invariant(blockers.length > 0 && blockedRows.length > 0, 'PASS_WITH_EXTERNAL_BLOCKERS lacks mapped blockers.');
}

function validateAcceptanceRows(rows) {
  invariant(Array.isArray(rows) && rows.length === expectedAcceptanceIds.length, 'prePackageAcceptance must contain exactly 33 rows.');
  const ids = rows.map((item) => item?.id);
  invariant(JSON.stringify(ids) === JSON.stringify(expectedAcceptanceIds), 'prePackageAcceptance has a missing, duplicate or unsorted ID.');
  for (const item of rows) {
    if (item.status === 'PASS') {
      invariant(Object.keys(item).sort().join(',') === 'id,status', `${item.id} PASS row has unexpected fields.`);
    } else if (item.status === 'READY_FOR_PACKAGE') {
      invariant(['C09-RLS-01', 'C09-RLS-02'].includes(item.id)
        && Object.keys(item).sort().join(',') === 'id,status', `READY_FOR_PACKAGE is invalid for ${item.id}.`);
    } else if (item.status === 'BLOCKED_EXTERNAL') {
      invariant(externallyBlockableIds.has(item.id) && typeof item.reason === 'string' && item.reason.trim().length >= 8
        && Object.keys(item).sort().join(',') === 'id,reason,status',
        `${item.id} has an invalid external blocker.`);
    } else throw new Error(`${item.id} has unsupported pre-package status ${item.status}.`);
  }
  invariant(rows.find((item) => item.id === 'C09-RLS-01')?.status === 'READY_FOR_PACKAGE'
    && rows.find((item) => item.id === 'C09-RLS-02')?.status === 'READY_FOR_PACKAGE',
  'C09-RLS-01/02 must be READY_FOR_PACKAGE in the immutable pre-package contract.');
  invariant(rows.every((item) => ['C09-RLS-01', 'C09-RLS-02'].includes(item.id) || item.status !== 'READY_FOR_PACKAGE'),
    'Only C09-RLS-01/02 may be READY_FOR_PACKAGE.');
  return rows;
}

function validatePostPackageAcceptance(rows) {
  invariant(Array.isArray(rows) && rows.length === 2
    && rows[0]?.id === 'C09-RLS-01' && rows[0]?.status === 'PASS' && typeof rows[0]?.evidence === 'string' && rows[0].evidence.length >= 16
    && rows[1]?.id === 'C09-RLS-02' && rows[1]?.status === 'PASS' && typeof rows[1]?.evidence === 'string' && rows[1].evidence.length >= 16,
  'postPackageAcceptance must contain exact PASS records for C09-RLS-01 and C09-RLS-02.');
}

function validateIssueLedger(bytes, stopIssues) {
  const text = bytes.toString('utf8');
  const lines = text.split(/\r?\n/u).filter((line) => line.startsWith('| C09-'));
  invariant(lines.length === expectedIssueIds.length, `Issue ledger must contain exactly ${expectedIssueIds.length} Cycle 09 issue rows.`);
  const rows = lines.map((line) => {
    const match = line.match(/^\| ([^|]+) \| ([^|]+) \| ([^|]+) \| ([^|]+) \| ([^|]+) \| ([^|]+) \| ([^|]+) \| ([^|]+) \| ([^|]+) \|$/u);
    invariant(match && match.slice(1).every((cell) => cell.length > 0 && cell === cell.trim()),
      `Malformed Cycle 09 issue row: ${line}`);
    const cells = match.slice(1);
    invariant(cells.length === 9
      && /^C09-[A-Z]+-\d+$/u.test(cells[0])
      && ['Critical', 'High', 'Medium', 'Low'].includes(cells[1])
      && cells.slice(2, 8).every((cell) => cell.length > 0)
      && /^[A-Z_]+$/u.test(cells[8]),
    `Invalid Cycle 09 issue row: ${line}`);
    return { id: cells[0], severity: cells[1], status: cells[8] };
  }).sort((left, right) => left.id.localeCompare(right.id));
  invariant(sameValue(rows.map((item) => item.id), expectedIssueIds)
    && rows.every((item) => item.status === 'CLOSED' && item.severity === expectedIssueSeverities[item.id]),
  `Issue ledger IDs/statuses differ from the exact ${expectedIssueIds.length} CLOSED issues.`);
  const counts = Object.fromEntries(['Critical', 'High', 'Medium', 'Low']
    .map((severity) => [`${severity.toLowerCase()}Open`, rows.filter((item) => item.severity === severity && item.status !== 'CLOSED').length]));
  counts.totalOpen = Object.values(counts).reduce((sum, value) => sum + value, 0);
  const summaryLines = text.split(/\r?\n/u).filter((line) => line.startsWith('Open issue counts'));
  invariant(summaryLines.length === 1, 'Issue ledger must contain one canonical open-count summary.');
  const summary = summaryLines[0].match(/^Open issue counts(?: while retest is pending)?: Critical (\d+); High (\d+); Medium (\d+)(?:; Low (\d+))?\. These counts must become Critical 0 \/ High 0 before local RC packaging; external environment blockers remain separate and never close an issue\.$/u);
  invariant(summary
    && Number(summary[1]) === counts.criticalOpen
    && Number(summary[2]) === counts.highOpen
    && Number(summary[3]) === counts.mediumOpen
    && Number(summary[4] ?? 0) === counts.lowOpen,
  'Issue ledger summary differs from the exact issue rows.');
  invariant(Object.entries(counts).every(([key, value]) => stopIssues?.[key] === value)
    && stopIssues?.totalIssues === rows.length && stopIssues?.closedTotal === rows.length,
    'Stop-report issue counts differ from the exact CLOSED issue ledger.');
}

function validateSignoffs(signoffs, hashes, identity, gateCompletedAt, packagedAt) {
  invariant(Array.isArray(signoffs) && signoffs.length === 3, 'Package must carry exactly three signoffs.');
  invariant(JSON.stringify(signoffs.map((item) => item.role).sort()) === JSON.stringify(expectedSignoffRoles),
    'Package signoff roles differ from QA/Independent Reviewer/Release Agent.');
  invariant(new Set(signoffs.map((item) => item.id)).size === 3 && new Set(signoffs.map((item) => item.reviewerId)).size === 3,
    'Signoff IDs and reviewer IDs must be unique.');
  for (const signoff of signoffs) {
    exactKeys(signoff, expectedSignoffKeys, `${signoff?.role ?? 'unknown'} signoff`);
    nonEmptyId(signoff.id, `${signoff.role} signoff.id`);
    nonEmptyId(signoff.reviewerId, `${signoff.role} signoff.reviewerId`);
    invariant(/^[A-Za-z0-9][A-Za-z0-9._@/+-]{1,127}$/u.test(signoff.id)
      && /^[A-Za-z0-9][A-Za-z0-9._@/+-]{1,127}$/u.test(signoff.reviewerId),
    `${signoff.role} signoff IDs do not match the package schema.`);
    const signedAt = timestamp(signoff.signedAt, `${signoff.role} signoff.signedAt`);
    invariant(signedAt >= gateCompletedAt && signedAt <= packagedAt,
      `${signoff.role} signoff timestamp is outside the completed-gate/package interval.`);
    invariant(signoff.decision === 'APPROVE_LOCAL_RC'
      && signoff.buildId === identity.buildId
      && signoff.commitSha === identity.commitSha
      && signoff.sourceFingerprint === identity.sourceFingerprint
      && signoff.buildManifestSha256 === hashes.manifest
      && signoff.automationResultsSha256 === hashes.automation
      && signoff.acceptanceSha256 === hashes.acceptance
      && signoff.submissionMediaManifestSha256 === hashes.submission
      && signoff.evidenceInventorySha256 === hashes.inventory
      && signoff.issueLedgerSha256 === hashes.issueLedger,
    `${signoff.role} signoff is not bound to every exact local-RC input.`);
    if (signoff.role === 'Release Agent') {
      invariant(signoff.independent === false && signoff.reviewerId === 'root', 'Release Agent signoff must be root and non-independent.');
    } else {
      invariant(signoff.independent === true && signoff.reviewerId !== 'root', `${signoff.role} signoff must be independent and non-root.`);
    }
  }
}

async function atomicAppendOnlyWrite(outputPath, bytes, label = 'draft verification') {
  const tempPath = join(dirname(outputPath), `.${basename(outputPath)}.${process.pid}.${randomBytes(12).toString('hex')}.tmp`);
  let handle;
  let linked = false;
  try {
    handle = await open(tempPath, 'wx', 0o600);
    await handle.writeFile(bytes);
    await handle.sync();
    await handle.close();
    handle = undefined;
    try {
      await link(tempPath, outputPath);
      linked = true;
    } catch (error) {
      if (error?.code === 'EEXIST') throw new Error(`Refusing to overwrite append-only ${label}: ${outputPath}`);
      throw error;
    }
    if (process.platform !== 'win32') {
      const directoryHandle = await open(dirname(outputPath), 'r');
      try { await directoryHandle.sync(); } finally { await directoryHandle.close(); }
    }
    await unlink(tempPath);
  } catch (error) {
    try { await handle?.close(); } catch { /* preserve the original failure */ }
    if (!linked) await rm(tempPath, { force: true });
    else {
      throw new Error(`${error instanceof Error ? error.message : String(error)} Output was atomically linked and remains recoverable at ${outputPath}; temp recovery file: ${tempPath}`);
    }
    throw error;
  }
}

async function assertPathMissing(path, label) {
  try {
    await lstat(path);
  } catch (error) {
    if (error?.code === 'ENOENT') return;
    throw error;
  }
  throw new Error(`Refusing to overwrite or reuse ${label}: ${path}`);
}

async function writeNewSyncedFile(path, bytes) {
  await mkdir(dirname(path), { recursive: true });
  const handle = await open(path, 'wx', 0o600);
  try {
    await handle.writeFile(bytes);
    await handle.sync();
  } finally {
    await handle.close();
  }
}

async function createConsoleEvidenceSnapshot(reportDir, registry, binding) {
  invariant(registry.files instanceof Map
    && registry.files.size === registry.paths.size
    && registry.files.size > 1,
  'Console evidence registry is incomplete and cannot be snapshotted.');
  const registered = [...registry.files.values()].sort((left, right) => (
    left.sourcePath < right.sourcePath ? -1 : left.sourcePath > right.sourcePath ? 1 : 0
  ));
  const files = registered.map((record) => ({
    bytes: record.bytesLength,
    id: record.id,
    path: record.role === 'root-evidence'
      ? 'payload/__root_console_evidence__.json'
      : `payload/${record.sourcePath}`,
    role: record.role,
    sha256: record.sha256,
    sourcePath: record.sourcePath,
  })).sort((left, right) => (left.path < right.path ? -1 : left.path > right.path ? 1 : 0));
  const paths = new Set();
  const caseFoldedPaths = new Set();
  const digests = new Set();
  for (const file of files) {
    invariant(safeRelativePattern.test(file.path) && safeRelativePattern.test(file.sourcePath),
      `Snapshot file path is unsafe: ${file.path}`);
    const caseFoldedPath = file.path.toLocaleLowerCase('en-US');
    invariant(!paths.has(file.path) && !caseFoldedPaths.has(caseFoldedPath),
      `Snapshot contains a duplicate or case-colliding path: ${file.path}`);
    invariant(!digests.has(file.sha256), `Snapshot contains duplicate evidence bytes: ${file.sha256}`);
    paths.add(file.path);
    caseFoldedPaths.add(caseFoldedPath);
    digests.add(file.sha256);
  }
  invariant(files.filter((file) => file.role === 'root-evidence').length === 1,
    'Snapshot must contain exactly one root Console evidence document.');
  const addressPayload = {
    schemaVersion: 1,
    kind: 'yandex-console-evidence-snapshot',
    cycle: '09',
    binding,
    files,
  };
  const snapshotId = sha256(Buffer.from(JSON.stringify(canonical(addressPayload)), 'utf8'));
  const manifest = {
    ...addressPayload,
    snapshotId,
    contentAddress: {
      algorithm: 'sha256',
      canonicalization: 'recursive-key-sort/json-stringify/utf8',
      payloadSha256: snapshotId,
    },
  };
  const manifestBytes = Buffer.from(`${JSON.stringify(manifest, null, 2)}\n`, 'utf8');
  const manifestSha256 = sha256(manifestBytes);
  const parsedManifest = parseJson(manifestBytes, 'Console evidence snapshot manifest');
  const {
    contentAddress: parsedContentAddress,
    snapshotId: parsedSnapshotId,
    ...parsedAddressPayload
  } = parsedManifest;
  invariant(parsedSnapshotId === snapshotId
    && parsedContentAddress?.algorithm === 'sha256'
    && parsedContentAddress?.canonicalization === 'recursive-key-sort/json-stringify/utf8'
    && parsedContentAddress?.payloadSha256 === snapshotId
    && sha256(Buffer.from(JSON.stringify(canonical(parsedAddressPayload)), 'utf8')) === snapshotId,
  'Console evidence snapshot content-address contract is not reproducible.');
  const snapshotRoot = join(reportDir, 'console-evidence-snapshots');
  await mkdir(snapshotRoot, { recursive: true });
  const snapshotRootInfo = await lstat(snapshotRoot);
  invariant(snapshotRootInfo.isDirectory() && !snapshotRootInfo.isSymbolicLink(),
    'Console evidence snapshot root must be a real directory.');
  const reportDirReal = await realpath(reportDir);
  const snapshotRootReal = await realpath(snapshotRoot);
  const snapshotRootRelation = relative(reportDirReal, snapshotRootReal).split(sep).join('/');
  invariant(snapshotRootRelation === 'console-evidence-snapshots',
    'Console evidence snapshot root escapes or aliases the exact release report directory.');
  const snapshotDirectory = join(snapshotRoot, snapshotId);
  const reservationPath = join(snapshotRoot, `${snapshotId}.reserved`);
  const publicationMarkerPath = join(snapshotRoot, `${snapshotId}.published`);
  await assertPathMissing(snapshotDirectory, 'content-addressed Console evidence snapshot');
  await assertPathMissing(reservationPath, 'Console evidence snapshot reservation');
  await assertPathMissing(publicationMarkerPath, 'Console evidence snapshot publication marker');

  const stagingDirectory = await mkdtemp(join(snapshotRoot, `.staging-${snapshotId}-`));
  let reservationHandle;
  let promoted = false;
  try {
    const recordBySourcePath = new Map(registered.map((record) => [record.sourcePath, record]));
    for (const file of files) {
      const record = recordBySourcePath.get(file.sourcePath);
      invariant(record && record.bytes.length === file.bytes && sha256(record.bytes) === file.sha256,
        `Snapshot source bytes changed before staging: ${file.sourcePath}`);
      await writeNewSyncedFile(join(stagingDirectory, ...file.path.split('/')), record.bytes);
    }
    await writeNewSyncedFile(join(stagingDirectory, 'snapshot-manifest.json'), manifestBytes);

    const reservationBytes = Buffer.from(`${JSON.stringify({
      schemaVersion: 1,
      kind: 'yandex-console-evidence-snapshot-reservation',
      snapshotId,
      manifestSha256,
    }, null, 2)}\n`, 'utf8');
    reservationHandle = await open(reservationPath, 'wx', 0o400);
    await reservationHandle.writeFile(reservationBytes);
    await reservationHandle.sync();
    await reservationHandle.close();
    reservationHandle = undefined;
    await assertPathMissing(snapshotDirectory, 'content-addressed Console evidence snapshot');
    await rename(stagingDirectory, snapshotDirectory);
    promoted = true;

    const expectedByPath = new Map(files.map((file) => [file.path, file]));
    expectedByPath.set('snapshot-manifest.json', {
      bytes: manifestBytes.length,
      path: 'snapshot-manifest.json',
      sha256: manifestSha256,
    });
    const publishedFiles = await walkExtracted(snapshotDirectory);
    const publishedPaths = publishedFiles
      .map((path) => relative(snapshotDirectory, path).split(sep).join('/'))
      .sort();
    invariant(sameValue(publishedPaths, [...expectedByPath.keys()].sort()),
      'Published Console evidence snapshot inventory differs from its manifest.');
    for (const path of publishedFiles) {
      const relation = relative(snapshotDirectory, path).split(sep).join('/');
      const expected = expectedByPath.get(relation);
      const bytes = await readFile(path);
      invariant(expected && bytes.length === expected.bytes && sha256(bytes) === expected.sha256,
        `Published Console evidence snapshot bytes changed: ${relation}`);
    }
    const markerBytes = Buffer.from(`${JSON.stringify({
      schemaVersion: 1,
      kind: 'yandex-console-evidence-snapshot-publication',
      snapshotId,
      manifestSha256,
      reservationSha256: sha256(reservationBytes),
    }, null, 2)}\n`, 'utf8');
    await atomicAppendOnlyWrite(publicationMarkerPath, markerBytes, 'Console evidence snapshot publication marker');
    if (process.platform !== 'win32') {
      const directoryHandle = await open(snapshotRoot, 'r');
      try { await directoryHandle.sync(); } finally { await directoryHandle.close(); }
    }
    return {
      directory: snapshotDirectory,
      fileCount: files.length,
      manifestBytes: manifestBytes.length,
      manifestPath: join(snapshotDirectory, 'snapshot-manifest.json'),
      manifestSha256,
      publicationMarker: {
        bytes: markerBytes.length,
        path: publicationMarkerPath,
        sha256: sha256(markerBytes),
      },
      reservation: {
        bytes: reservationBytes.length,
        path: reservationPath,
        sha256: sha256(reservationBytes),
      },
      snapshotId,
    };
  } catch (error) {
    try { await reservationHandle?.close(); } catch { /* preserve the original failure */ }
    if (!promoted) await rm(stagingDirectory, { recursive: true, force: true });
    throw error;
  }
}

async function expectSelfTestFailure(action, pattern, label) {
  try {
    await action();
  } catch (error) {
    invariant(pattern.test(error instanceof Error ? error.message : String(error)),
      `${label} failed for the wrong reason: ${error instanceof Error ? error.message : String(error)}`);
    return;
  }
  throw new Error(`${label} unexpectedly passed.`);
}

async function runSelfTests() {
  const sandbox = await mkdtemp(join(tmpdir(), 'inferno-yandex-verify-self-test-'));
  const sandboxRelation = relative(resolve(tmpdir()), resolve(sandbox)).split(sep).join('/');
  invariant(sandboxRelation.startsWith('inferno-yandex-verify-self-test-')
    && !sandboxRelation.includes('/'),
  'Self-test sandbox is outside the operating-system temporary directory.');
  try {
    const evidenceRoot = join(sandbox, 'evidence');
    const outsideRoot = join(sandbox, 'outside');
    const reportDir = join(sandbox, 'report');
    await Promise.all([
      mkdir(evidenceRoot, { recursive: true }),
      mkdir(outsideRoot, { recursive: true }),
      mkdir(reportDir, { recursive: true }),
    ]);
    const outsideBytes = Buffer.from('{"outside":true}\n', 'utf8');
    await writeNewSyncedFile(join(outsideRoot, 'trace.json'), outsideBytes);
    await symlink(outsideRoot, join(evidenceRoot, 'escape'), process.platform === 'win32' ? 'junction' : 'dir');
    const emptyRegistry = {
      root: evidenceRoot,
      realRoot: await realpath(evidenceRoot),
      paths: new Set(),
      caseFoldedPaths: new Set(),
      hashes: new Set(),
      files: new Map(),
    };
    await expectSelfTestFailure(() => readBoundFile({
      bytes: outsideBytes.length,
      path: 'escape/trace.json',
      sha256: sha256(outsideBytes),
    }, evidenceRoot, 'self-test escaped artifact', emptyRegistry, ['bytes', 'path', 'sha256']),
    /escapes the physical evidence directory through a symlinked parent/u,
    'Symlinked-parent containment check');

    const rootBytes = Buffer.from('{"root":true}\n', 'utf8');
    const traceBytes = Buffer.from('{"trace":true}\n', 'utf8');
    await writeNewSyncedFile(join(evidenceRoot, 'root.json'), rootBytes);
    await writeNewSyncedFile(join(evidenceRoot, 'trace.json'), traceBytes);
    const rootDigest = sha256(rootBytes);
    const registry = {
      root: evidenceRoot,
      realRoot: await realpath(evidenceRoot),
      paths: new Set(['root.json']),
      caseFoldedPaths: new Set(['root.json']),
      hashes: new Set([rootDigest]),
      files: new Map([['root.json', {
        bytes: rootBytes,
        bytesLength: rootBytes.length,
        id: 'console-evidence',
        role: 'root-evidence',
        sha256: rootDigest,
        sourcePath: 'root.json',
      }]]),
    };
    await readBoundFile({
      bytes: traceBytes.length,
      path: 'trace.json',
      sha256: sha256(traceBytes),
    }, evidenceRoot, 'self-test trace', registry, ['bytes', 'path', 'sha256'], {
      id: 'trace',
      role: 'trace',
    });
    const binding = {
      archive: { bytes: 1, name: archiveName, sha256: 'a'.repeat(64) },
      build: { buildId: 'self-test', buildManifestSha256: 'b'.repeat(64) },
      console: { attemptId: 'self-test-attempt', draftId: 'self-test-draft', evidenceSha256: rootDigest },
    };
    const snapshot = await createConsoleEvidenceSnapshot(reportDir, registry, binding);
    const snapshotManifest = parseJson(await readFile(snapshot.manifestPath), 'self-test snapshot manifest');
    invariant(snapshotManifest.snapshotId === snapshot.snapshotId
      && snapshot.manifestSha256 === sha256(await readFile(snapshot.manifestPath))
      && snapshotManifest.files.length === registry.files.size,
    'Content-addressed snapshot self-test binding is invalid.');
    await expectSelfTestFailure(() => createConsoleEvidenceSnapshot(reportDir, registry, binding),
      /Refusing to overwrite or reuse content-addressed Console evidence snapshot/u,
      'Snapshot reuse check');
    console.log('verify:draft:yandex self-test PASS (symlink containment, atomic snapshot, reuse refusal)');
  } finally {
    await rm(sandbox, { recursive: true, force: true });
  }
}

async function main() {
const cliEvidence = parseArguments(process.argv.slice(2));
const environmentEvidence = process.env.INFERNO_YANDEX_CONSOLE_EVIDENCE;
if (cliEvidence && environmentEvidence) {
  invariant(resolve(gameRoot, cliEvidence) === resolve(gameRoot, environmentEvidence),
    '--evidence and INFERNO_YANDEX_CONSOLE_EVIDENCE resolve to different files.');
}
const suppliedEvidence = cliEvidence || environmentEvidence;
invariant(suppliedEvidence, 'Supply Console evidence with --evidence=<path> or INFERNO_YANDEX_CONSOLE_EVIDENCE.');
const evidencePath = isAbsolute(suppliedEvidence) ? suppliedEvidence : resolve(gameRoot, suppliedEvidence);
const evidenceDirectory = dirname(evidencePath);
const evidenceInfo = await lstat(evidencePath);
invariant(evidenceInfo.isFile() && !evidenceInfo.isSymbolicLink(), 'Console evidence must be a regular non-link file.');
const evidenceDirectoryReal = await realpath(evidenceDirectory);
const evidencePathReal = await realpath(evidencePath);
const evidenceDirectoryInfo = await stat(evidenceDirectoryReal);
invariant(evidenceDirectoryInfo.isDirectory(), 'Console evidence root does not resolve to a directory.');
const evidencePhysicalRelation = relative(evidenceDirectoryReal, evidencePathReal).split(sep).join('/');
invariant(evidencePhysicalRelation.length > 0
  && !evidencePhysicalRelation.startsWith('../') && evidencePhysicalRelation !== '..' && !isAbsolute(evidencePhysicalRelation),
'Console evidence root document escapes its physical evidence directory.');

const [manifestBytes, archiveBytes, checksumBytes, evidenceBytes, acceptanceBytes, issueLedgerBytes, submissionManifestBytes] = await Promise.all([
  readFile(manifestPath),
  readFile(archivePath),
  readFile(checksumPath),
  readFile(evidencePathReal),
  readFile(acceptancePath),
  readFile(issueLedgerPath),
  readFile(submissionManifestPath),
]);
const manifest = parseJson(manifestBytes, 'dist/build-manifest.json');
await verifyBuildPayload(join(gameRoot, 'dist'), manifest);
const archiveInfo = await lstat(archivePath);
invariant(archiveInfo.isFile() && !archiveInfo.isSymbolicLink(), `${archiveName} is not a regular non-link file.`);
const archiveSha256 = sha256(archiveBytes);
const manifestSha256 = sha256(manifestBytes);
const reportDir = join(gameRoot, 'reports/yandex-release-cycle-09', manifest.buildId ?? 'invalid-build-id');
const packageReportPath = join(reportDir, 'package-results.json');
const automationPath = join(reportDir, 'automation-results.json');
const inventoryPath = join(reportDir, 'evidence-inventory.json');
const stopReportPath = join(reportDir, 'local-rc-stop-report.json');
const [packageReportBytes, automationBytes, inventoryBytes, stopReportBytes] = await Promise.all([
  readFile(packageReportPath), readFile(automationPath), readFile(inventoryPath), readFile(stopReportPath),
]);
for (const [label, path] of [
  ['build manifest', manifestPath], ['checksum', checksumPath], ['package report', packageReportPath],
  ['automation report', automationPath], ['evidence inventory', inventoryPath], ['stop report', stopReportPath],
  ['acceptance contract', acceptancePath], ['issue ledger', issueLedgerPath], ['submission manifest', submissionManifestPath],
]) {
  const info = await lstat(path);
  invariant(info.isFile() && !info.isSymbolicLink(), `${label} must be a regular non-link file.`);
}
const packageReport = parseJson(packageReportBytes, 'package-results.json');
const automation = parseJson(automationBytes, 'automation-results.json');
const inventory = parseJson(inventoryBytes, 'evidence-inventory.json');
const stopReport = parseJson(stopReportBytes, 'local-rc-stop-report.json');
const hashes = {
  manifest: manifestSha256,
  automation: sha256(automationBytes),
  acceptance: sha256(acceptanceBytes),
  submission: sha256(submissionManifestBytes),
  inventory: sha256(inventoryBytes),
  issueLedger: sha256(issueLedgerBytes),
  stop: sha256(stopReportBytes),
  package: sha256(packageReportBytes),
};

invariant(manifest.version === '1.0.0'
  && manifest.target === 'yandex'
  && manifest.clean === true
  && manifest.testDriver === false
  && manifest.nativeEsm === false
  && typeof manifest.buildId === 'string'
  && /^1\.0\.0\+[a-f0-9]{12}$/u.test(manifest.buildId)
  && /^[a-f0-9]{40}$/u.test(manifest.commitSha ?? '')
  && shaPattern.test(manifest.sourceFingerprint ?? ''),
'Build manifest is not a clean production Yandex 1.0.0 release identity.');

const currentIdentity = await buildIdentity();
invariant(currentIdentity.clean === true
  && currentIdentity.buildId === manifest.buildId
  && currentIdentity.commitSha === manifest.commitSha
  && currentIdentity.sourceFingerprint === manifest.sourceFingerprint,
'Current clean Git identity differs from the packaged build manifest.');

const checksumMatch = checksumBytes.toString('utf8').match(/^([a-f0-9]{64})  (inferno-clicker-1\.0\.0-rc\.zip)\r?\n?$/u);
invariant(checksumMatch && checksumMatch[1] === archiveSha256 && checksumMatch[2] === archiveName,
'RC checksum file does not exactly match the local archive.');

const packagedAt = timestamp(packageReport.packagedAt, 'package-results.packagedAt');
const gateCompletedAt = timestamp(automation.completedAt, 'automation-results.completedAt');
invariant(gateCompletedAt <= packagedAt && packagedAt <= Date.now() + 5 * 60 * 1000,
  'Gate/package timestamps are out of order or in the future.');
invariant(automation.schemaVersion === 1
  && automation.cycle === '09'
  && automation.target === 'yandex'
  && ['PASS', 'PASS_WITH_EXTERNAL_BLOCKERS'].includes(automation.status)
  && automation.buildId === manifest.buildId
  && automation.commitSha === manifest.commitSha
  && automation.sourceFingerprint === manifest.sourceFingerprint
  && automation.buildManifestSha256 === manifestSha256
  && automation.evidenceInventorySha256 === hashes.inventory
  && automation.evidenceInventoryFiles === inventory.files?.length
  && automation.submissionMediaManifestSha256 === hashes.submission
  && automation.browserE2e === 'PASS'
  && Array.isArray(automation.externalBlockers)
  && Number.isInteger(automation.testsPassed) && automation.testsPassed > 0
  && automation.testsFailed === 0
  && automation.testsSkipped === 0
  && Array.isArray(automation.commands) && automation.commands.length > 0
  && automation.commands.every((command) => command?.exitCode === 0
    && Number.isFinite(Date.parse(command.startedAt))
    && Number.isFinite(Date.parse(command.completedAt))
    && Date.parse(command.completedAt) >= Date.parse(command.startedAt))
  && automation.reproducibleBuild === true
  && automation.reproduciblePayload === true,
'automation-results.json is not the exact successful local RC gate.');

invariant(inventory.schemaVersion === 1
  && inventory.cycle === '09'
  && inventory.buildId === manifest.buildId
  && inventory.commitSha === manifest.commitSha
  && inventory.sourceFingerprint === manifest.sourceFingerprint
  && Array.isArray(inventory.files) && inventory.files.length > 0,
'evidence-inventory.json identity is invalid.');
const inventoryPaths = new Set();
const inventoryByPath = new Map();
invariant(sameValue(inventory.files.map((item) => item?.path), [...inventory.files.map((item) => item?.path)].sort()),
  'Evidence inventory paths are not in canonical sorted order.');
for (const item of inventory.files) {
  invariant(item && typeof item.path === 'string' && safeRelativePattern.test(item.path)
    && Number.isInteger(item.bytes) && item.bytes > 0 && shaPattern.test(item.sha256 ?? ''),
  'Evidence inventory contains an invalid file record.');
  invariant(!inventoryPaths.has(item.path), `Evidence inventory contains duplicate path ${item.path}.`);
  inventoryPaths.add(item.path);
  inventoryByPath.set(item.path, item);
  const path = resolve(reportDir, item.path);
  const relation = relative(reportDir, path).split(sep).join('/');
  invariant(relation === item.path, `Evidence inventory path is not canonical: ${item.path}`);
  const info = await lstat(path);
  invariant(info.isFile() && !info.isSymbolicLink(), `Evidence inventory item is not a regular file: ${item.path}`);
  const bytes = await readFile(path);
  invariant(bytes.length === item.bytes && sha256(bytes) === item.sha256, `Gated evidence changed: ${item.path}`);
}
for (const command of automation.commands) {
  const item = inventoryByPath.get(command.log?.path);
  invariant(item && command.log.bytes === item.bytes && command.log.sha256 === item.sha256,
    `Automation command log is not bound to the evidence inventory: ${command.id ?? command.command ?? 'unknown'}`);
}

const documentedAcceptance = acceptanceRowsFromDocument(acceptanceBytes);
const prePackageAcceptance = validateAcceptanceRows(packageReport.prePackageAcceptance);
invariant(sameValue(prePackageAcceptance, documentedAcceptance),
  'package-results prePackageAcceptance differs from docs/ACCEPTANCE_CRITERIA.md.');
validatePostPackageAcceptance(packageReport.postPackageAcceptance);
invariant(packageReport.schemaVersion === 1
  && packageReport.status === (automation.status === 'PASS_WITH_EXTERNAL_BLOCKERS' ? 'RC_READY_WITH_EXTERNAL_BLOCKERS' : 'RC_READY')
  && packageReport.promotable === false
  && Array.isArray(packageReport.externalBlockers)
  && packageReport.archive === archiveName
  && packageReport.bytes === archiveBytes.length
  && packageReport.sha256 === archiveSha256
  && packageReport.entries === manifest.files.length + 1
  && packageReport.buildId === manifest.buildId
  && packageReport.commitSha === manifest.commitSha
  && packageReport.sourceFingerprint === manifest.sourceFingerprint
  && packageReport.buildManifestSha256 === hashes.manifest
  && packageReport.automationResultsSha256 === hashes.automation
  && packageReport.acceptanceSha256 === hashes.acceptance
  && packageReport.submissionMediaManifestSha256 === hashes.submission
  && packageReport.evidenceInventorySha256 === hashes.inventory
  && packageReport.issueLedgerSha256 === hashes.issueLedger
  && packageReport.localRcStopReportSha256 === hashes.stop
  && packageReport.reproduciblePayload === true
  && packageReport.reproducibleArchiveBytes === true
  && packageReport.archiveAudit?.freshExtraction === true
  && packageReport.archiveAudit?.exactInventoryAndHashes === true
  && packageReport.archiveAudit?.regularFilesOnly === true
  && packageReport.archiveAudit?.unpackedBytes === manifest.unpackedBytes
  && packageReport.archiveAudit?.ownedEphemeralHttpServer === true
  && sameValue(packageReport.archiveAudit?.httpSmoke, ['/', '/game.js', '/styles.css', 'representative raster asset', '404'])
  && packageReport.gateReport === `reports/yandex-release-cycle-09/${manifest.buildId}/automation-results.json`,
'package-results.json is not the exact fully audited local RC record.');
invariant(packageReport.gateStatus === automation.status
  && sameValue([...(packageReport.externalBlockers ?? [])].sort(), [...(automation.externalBlockers ?? [])].sort()),
'Package gate status/blockers differ from automation-results.json.');

invariant(stopReport.schemaVersion === 1
  && stopReport.kind === 'local-rc-stop-report'
  && stopReport.status === (automation.status === 'PASS_WITH_EXTERNAL_BLOCKERS'
    ? 'READY_FOR_PACKAGE_WITH_EXTERNAL_BLOCKERS' : 'READY_FOR_PACKAGE')
  && stopReport.promotable === false
  && Array.isArray(stopReport.externalBlockers)
  && stopReport.build?.buildId === manifest.buildId
  && stopReport.build?.commitSha === manifest.commitSha
  && stopReport.build?.sourceFingerprint === manifest.sourceFingerprint
  && stopReport.build?.buildManifestSha256 === hashes.manifest
  && stopReport.gate?.automationResultsSha256 === hashes.automation
  && stopReport.gate?.evidenceInventorySha256 === hashes.inventory
  && stopReport.acceptance?.sha256 === hashes.acceptance
  && stopReport.issues?.criticalOpen === 0
  && stopReport.issues?.highOpen === 0
  && stopReport.issues?.totalOpen === 0
  && stopReport.issues?.ledgerSha256 === hashes.issueLedger
  && stopReport.submissionMediaManifestSha256 === hashes.submission,
'local-rc-stop-report.json is incomplete or bound to another candidate.');
invariant(sameValue(stopReport.acceptance?.criteria, prePackageAcceptance),
  'Stop-report acceptance differs from package prePackageAcceptance.');
invariant(sameValue([...(stopReport.externalBlockers ?? [])].sort(), [...(packageReport.externalBlockers ?? [])].sort()),
  'Stop-report blockers differ from package-results.json.');
invariant(sameValue(stopReport.signoffs, packageReport.signoffs), 'Package signoffs differ from the immutable stop report.');
validateIssueLedger(issueLedgerBytes, stopReport.issues);
validateBlockers(packageReport.externalBlockers ?? [], prePackageAcceptance,
  stopReport.acceptance?.blockedMappings, automation.status);
validateSignoffs(packageReport.signoffs, hashes, manifest, gateCompletedAt, packagedAt);

const archiveAudit = await auditArchive(manifest, manifestBytes, archiveBytes);

const evidence = parseJson(evidenceBytes, 'Yandex Console evidence');
invariant(evidence.schemaVersion === 1
  && evidence.kind === 'yandex-console-draft'
  && evidence.status === 'PASS'
  && evidence.cycle === '09',
'Console evidence must be a typed Cycle 09 yandex-console-draft PASS document.');
const draftId = nonEmptyId(evidence.draftId, 'Console evidence draftId');
invariant(/^[A-Za-z0-9][A-Za-z0-9._:-]{2,127}$/u.test(draftId), 'Console evidence draftId has an unsupported format.');
const attemptId = nonEmptyId(evidence.attemptId, 'Console evidence attemptId');
invariant(/^[A-Za-z0-9][A-Za-z0-9._:-]{15,127}$/u.test(attemptId), 'Console evidence attemptId is too short or invalid.');
const operatorId = nonEmptyId(evidence.operatorId, 'Console evidence operatorId');
invariant(/^[A-Za-z0-9][A-Za-z0-9._@:-]{2,127}$/u.test(operatorId), 'Console evidence operatorId has an unsupported format.');
const evidenceStartedAt = timestamp(evidence.startedAt, 'Console evidence startedAt');
const evidenceCapturedAt = timestamp(evidence.completedAt, 'Console evidence completedAt');
invariant(evidenceStartedAt >= packagedAt
  && evidenceCapturedAt >= evidenceStartedAt
  && evidenceCapturedAt <= Date.now() + 5 * 60 * 1000
  && Number.isFinite(evidence.durationMs)
  && Math.abs(evidence.durationMs - (evidenceCapturedAt - evidenceStartedAt)) <= 2_000,
  'Console evidence timestamps/duration must be ordered after packaging and not in the future.');
const archive = { name: archiveName, bytes: archiveBytes.length, sha256: archiveSha256 };
validateArchiveBinding(evidence.archive, archive, 'Console evidence archive');
exactKeys(evidence.build, [
  'buildId', 'buildManifestSha256', 'clean', 'commitSha', 'packageResultsSha256',
  'sourceFingerprint', 'target', 'testDriver',
], 'Console evidence build');
invariant(evidence.build?.target === 'yandex'
  && evidence.build?.clean === true
  && evidence.build?.testDriver === false
  && evidence.build?.buildId === manifest.buildId
  && evidence.build?.commitSha === manifest.commitSha
  && evidence.build?.sourceFingerprint === manifest.sourceFingerprint
  && evidence.build?.buildManifestSha256 === hashes.manifest
  && evidence.build?.packageResultsSha256 === hashes.package,
'Console evidence build/package identity differs from the exact local RC.');
validateDiagnostics(evidence.diagnostics, 'Console evidence diagnostics');
exactKeys(evidence.checks, [...requiredChecks].sort(), 'Console evidence checks');
exactKeys(evidence.debugEvidence, [...requiredChecks].sort(), 'Console evidence debugEvidence');
for (const check of requiredChecks) {
  invariant(evidence.checks?.[check] === true, `Console check ${check} is not PASS.`);
  invariant(evidence.debugEvidence?.[check] === debugEvidenceMap[check],
    `Console check ${check} is not linked to its required typed artifact.`);
}
invariant(Array.isArray(evidence.artifacts)
  && JSON.stringify(evidence.artifacts.map((item) => item.id).sort()) === JSON.stringify(requiredArtifactIds),
'Console evidence must contain the exact ten typed artifact IDs.');

const rootEvidenceRelation = relative(resolve(evidenceDirectory), resolve(evidencePath)).split(sep).join('/');
invariant(rootEvidenceRelation.length > 0
  && !rootEvidenceRelation.startsWith('../') && rootEvidenceRelation !== '..' && !isAbsolute(rootEvidenceRelation)
  && safeRelativePattern.test(rootEvidenceRelation),
'Console evidence root filename must be a safe relative snapshot path.');
const rootEvidenceSha256 = sha256(evidenceBytes);
const registry = {
  root: resolve(evidenceDirectory),
  realRoot: evidenceDirectoryReal,
  paths: new Set([rootEvidenceRelation]),
  caseFoldedPaths: new Set([rootEvidenceRelation.toLocaleLowerCase('en-US')]),
  hashes: new Set([rootEvidenceSha256]),
  files: new Map([[rootEvidenceRelation, {
    bytes: evidenceBytes,
    bytesLength: evidenceBytes.length,
    id: 'console-evidence',
    role: 'root-evidence',
    sha256: rootEvidenceSha256,
    sourcePath: rootEvidenceRelation,
  }]]),
};
const context = {
  draftId,
  attemptId,
  operatorId,
  archive,
  packagedAt,
  evidenceCapturedAt,
  identity: manifest,
  manifestSha256: hashes.manifest,
};
const traces = new Map();
for (const descriptor of evidence.artifacts) {
  exactKeys(descriptor, ['bytes', 'id', 'path', 'sha256'], `Console artifact ${descriptor?.id ?? '?'}`);
  invariant(requiredArtifactIds.includes(descriptor.id), `Unsupported Console artifact id ${descriptor.id}.`);
  const file = await readBoundFile(descriptor, evidenceDirectory, `Console artifact ${descriptor.id}`, registry,
    ['bytes', 'id', 'path', 'sha256'], { id: descriptor.id, role: 'trace' });
  const trace = parseJson(file.bytes, `Console artifact ${descriptor.id}`);
  validateTrace(trace, artifactKinds[descriptor.id], `Console artifact ${descriptor.id}`, context, {
    minimumEvents: 2,
  });
  traces.set(descriptor.id, { trace, descriptor: { ...descriptor, path: file.relation }, path: file.path });
}

const consoleConfiguration = validateConsoleConfigTrace(traces.get('console-config').trace, context);
const evidenceConfiguration = validateConfiguration(evidence.configuration, 'Console evidence configuration');
invariant(sameValue(consoleConfiguration, evidenceConfiguration),
  'Top-level Console configuration differs from the typed console-config trace.');
validateSdkReadyTrace(traces.get('sdk-ready').trace);
validateLifecycleTrace(traces.get('lifecycle').trace);
const rewarded = validateRewardSuccess(traces.get('rewarded-success').trace);
rewarded.closeWithoutReward = validateRewardClose(traces.get('rewarded-close').trace);
rewarded.error = validateRewardError(traces.get('rewarded-error').trace);
invariant(sameValue(evidence.rewarded, rewarded), 'Top-level rewarded summary differs from the three typed rewarded traces.');
validateGuestSaveTrace(traces.get('guest-save').trace);
const mergedSave = validateAuthorizedSaveTrace(traces.get('authorized-save').trace);
const leaderboardScore = validateLeaderboardTrace(traces.get('leaderboard').trace, mergedSave.bestScore);
const titleEvidence = await validateTitlesTrace(traces.get('titles').trace, traces.get('titles').path, context, registry);
invariant(registry.files.size === 1 + traces.size + titleEvidence.screenshots.length,
  'Console evidence registry does not equal root JSON + exact typed traces + exact referenced attachments.');

const outputPath = join(reportDir, 'draft-verification.json');
await assertPathMissing(outputPath, 'append-only draft verification');
const evidenceSnapshot = await createConsoleEvidenceSnapshot(reportDir, registry, {
  archive,
  build: {
    buildId: manifest.buildId,
    buildManifestSha256: hashes.manifest,
    commitSha: manifest.commitSha,
    sourceFingerprint: manifest.sourceFingerprint,
    target: manifest.target,
    testDriver: manifest.testDriver,
  },
  console: {
    attemptId,
    completedAt: evidence.completedAt,
    draftId,
    evidenceSha256: rootEvidenceSha256,
    operatorId,
  },
  package: {
    bytes: packageReportBytes.length,
    packageResultsSha256: hashes.package,
  },
});
const output = {
  schemaVersion: 2,
  kind: 'yandex-draft-verification',
  cycle: '09',
  status: 'PASS',
  verifiedAt: new Date().toISOString(),
  appendOnly: true,
  promotionAuthorized: false,
  consequence: 'The exact RC ZIP passed fail-closed package, archive and typed Yandex draft verification. No rebuild, final rename, moderation submission or publication was performed.',
  build: {
    version: manifest.version,
    target: manifest.target,
    buildId: manifest.buildId,
    commitSha: manifest.commitSha,
    sourceFingerprint: manifest.sourceFingerprint,
    buildManifestSha256: hashes.manifest,
  },
  package: {
    path: relative(gameRoot, packageReportPath).split(sep).join('/'),
    bytes: packageReportBytes.length,
    sha256: hashes.package,
    status: packageReport.status,
    automationResultsSha256: hashes.automation,
    evidenceInventorySha256: hashes.inventory,
    localRcStopReportSha256: hashes.stop,
    acceptanceSha256: hashes.acceptance,
    issueLedgerSha256: hashes.issueLedger,
    submissionMediaManifestSha256: hashes.submission,
    prePackageAcceptanceCount: prePackageAcceptance.length,
    postPackageAcceptance: packageReport.postPackageAcceptance,
    signoffs: packageReport.signoffs,
  },
  archive: {
    path: relative(gameRoot, archivePath).split(sep).join('/'),
    ...archive,
    checksumVerified: true,
    ...archiveAudit,
  },
  consoleEvidence: {
    path: relative(gameRoot, evidencePath).split(sep).join('/'),
    bytes: evidenceBytes.length,
    sha256: rootEvidenceSha256,
    startedAt: evidence.startedAt,
    completedAt: evidence.completedAt,
    durationMs: evidence.durationMs,
    draftId,
    attemptId,
    operatorId,
    artifactCount: traces.size,
    physicalEvidenceFiles: registry.paths.size,
    snapshot: {
      appendOnly: true,
      contentAddressed: true,
      fileCount: evidenceSnapshot.fileCount,
      manifest: {
        bytes: evidenceSnapshot.manifestBytes,
        path: relative(gameRoot, evidenceSnapshot.manifestPath).split(sep).join('/'),
        sha256: evidenceSnapshot.manifestSha256,
      },
      path: relative(gameRoot, evidenceSnapshot.directory).split(sep).join('/'),
      publicationMarker: {
        bytes: evidenceSnapshot.publicationMarker.bytes,
        path: relative(gameRoot, evidenceSnapshot.publicationMarker.path).split(sep).join('/'),
        sha256: evidenceSnapshot.publicationMarker.sha256,
      },
      reservation: {
        bytes: evidenceSnapshot.reservation.bytes,
        path: relative(gameRoot, evidenceSnapshot.reservation.path).split(sep).join('/'),
        sha256: evidenceSnapshot.reservation.sha256,
      },
      snapshotId: evidenceSnapshot.snapshotId,
    },
  },
  configuration: consoleConfiguration,
  checks: Object.fromEntries(requiredChecks.map((check) => [check, true])),
  diagnostics: Object.fromEntries(requiredZeroDiagnostics.map((counter) => [counter, 0])),
  rewarded,
  cloudAndLeaderboard: {
    mergedBestScore: mergedSave.bestScore,
    leaderboardScore,
    guestLocalPersistence: true,
    authorizedMaximaLatestWins: true,
    cloudWriteIntervalMs: 5_000,
    finalFlush: true,
  },
  artifacts: [...traces.entries()].map(([id, value]) => ({ id, ...value.descriptor, attemptId: value.trace.attemptId })),
  titles: titleEvidence,
};

await atomicAppendOnlyWrite(outputPath, Buffer.from(`${JSON.stringify(output, null, 2)}\n`, 'utf8'));
console.log(`verify:draft:yandex PASS: ${outputPath}`);
}

const cliArguments = process.argv.slice(2);
if (cliArguments.includes('--self-test')) {
  invariant(cliArguments.length === 1, '--self-test cannot be combined with other arguments.');
  await runSelfTests();
} else {
  await main();
}
