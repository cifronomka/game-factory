import { createHash } from 'node:crypto';
import { readFile, stat } from 'node:fs/promises';
import { isAbsolute, join, sep } from 'node:path';
import { parseAsync } from '@babel/core';
import sharp from 'sharp';
import { gameRoot, verifyBuildPayload, walk } from './lib.mjs';

const dist = join(gameRoot, 'dist');
const manifestBytes = await readFile(join(dist, 'build-manifest.json'));
const manifest = JSON.parse(manifestBytes.toString('utf8'));
const packageJson = JSON.parse(await readFile(join(gameRoot, 'package.json'), 'utf8'));
const invariant = (condition, message) => { if (!condition) throw new Error(message); };
const sha256 = (bytes) => createHash('sha256').update(bytes).digest('hex');
const reviewClockToleranceMs = 5 * 60_000;
const validTimestamp = (value) => Number.isFinite(Date.parse(value)) && Date.parse(value) <= Date.now() + reviewClockToleranceMs;
const evidenceRoot = process.env.INFERNO_CYCLE09_EVIDENCE_DIR
  ? (isAbsolute(process.env.INFERNO_CYCLE09_EVIDENCE_DIR)
      ? process.env.INFERNO_CYCLE09_EVIDENCE_DIR
      : join(gameRoot, process.env.INFERNO_CYCLE09_EVIDENCE_DIR))
  : join(gameRoot, 'reports/yandex-release-cycle-09-working');

invariant(packageJson.version === '1.0.0', 'Yandex release version must be 1.0.0.');
invariant(manifest.version === packageJson.version && manifest.target === 'yandex', 'Build manifest is not the 1.0.0 Yandex target.');
invariant(manifest.nativeEsm === false, 'Yandex build must not depend on native ESM.');
invariant(manifest.syntaxTarget === 'chrome49/firefox52/safari9/edge15' && manifest.transpiler === 'esbuild-iife+babel-preset-env', 'Compatibility transpilation identity is missing.');
invariant(manifest.testDriver === false, 'Release build must compile out the test driver.');
invariant(manifest.clean === true && /^1\.0\.0\+[a-f0-9]{12}$/u.test(manifest.buildId), `Release requires a clean exact build, got ${manifest.buildId}.`);
invariant(manifest.unpackedBytes < 90 * 1024 * 1024, 'Unpacked Yandex build exceeds 90 MiB.');
await verifyBuildPayload(dist, manifest);

const actualFiles = await walk(dist, () => true);
const releasePath = (path) => path.slice(dist.length + 1).split(sep).join('/');
const listed = new Map(manifest.files.map((entry) => [entry.path, entry]));
for (const path of actualFiles) {
  const relative = releasePath(path);
  if (relative === 'build-manifest.json') continue;
  invariant(listed.has(relative), `Unlisted release file: ${relative}`);
}
for (const [relative, entry] of listed) {
  const bytes = await readFile(join(dist, relative));
  invariant(bytes.length === entry.bytes && sha256(bytes) === entry.sha256, `Manifest mismatch: ${relative}`);
}

const forbiddenPath = /(?:^|\/)(?:src|tests|docs|visual-references|node_modules|dev)(?:\/|$)|(?:\.map|\.env|\.gitkeep|\.DS_Store)$/iu;
const badPaths = actualFiles.map(releasePath).filter((path) => forbiddenPath.test(path));
invariant(badPaths.length === 0, `Forbidden release paths: ${badPaths.join(', ')}`);

const html = await readFile(join(dist, 'index.html'), 'utf8');
const game = await readFile(join(dist, 'game.js'), 'utf8');
invariant(html.includes("window.__INFERNO_PLATFORM_TARGET__ = 'yandex';"), 'Yandex adapter target is not explicit.');
invariant(html.includes("sdk.src = '/sdk.js'"), 'Official /sdk.js loader is missing.');
invariant(html.indexOf("sdk.src = '/sdk.js'") < html.indexOf('src="./game.js"'), 'SDK loader must appear before the game bundle.');
invariant(html.includes('document.head.appendChild(sdk)') && !html.includes('document.head.append(sdk)'), 'SDK loader must use the Safari 9-compatible appendChild path.');
invariant(!/type=["']module["']/u.test(html), 'Native module entry remains in Yandex HTML.');
invariant(!/DevPlatformService|allowDevMocks|inferno-seal|["']Получить ×2["']|\(тест\)|test-provider/u.test(`${html}\n${game}`), 'Production bundle contains a legacy/free test reward path.');
invariant(!/__INFERNO_E2E__|reachStage\(|advanceActive\(|settleRewardOffer\(/u.test(game), 'Production bundle contains the mutating E2E driver.');
invariant(!/bg-infernal-chamber-production|ash-servant-[^"']*-v6\.webp|demoness-[^"']*-v7\.webp/iu.test(game), 'Production bundle references retired visual assets.');
invariant(!/outer-(?:low|mid|high)-v[23]\.(?:webp|png)/u.test(game), 'Production bundle references a superseded outer flame v2/v3.');
for (const family of ['low', 'mid', 'high']) invariant(game.includes(`outer-${family}-v4`), `Production bundle is missing outer-${family}-v4.`);

const forbiddenSyntax = new Set(['ArrowFunctionExpression', 'ClassDeclaration', 'ClassExpression', 'AwaitExpression', 'OptionalCallExpression', 'OptionalMemberExpression', 'RestElement', 'SpreadElement', 'ForOfStatement', 'BigIntLiteral']);
let unsupportedSyntaxCount = 0;
const productionStringFragments = [];
const inlineScripts = [...html.matchAll(/<script(?![^>]*\bsrc=)[^>]*>([\s\S]*?)<\/script>/giu)].map((match) => match[1]);
invariant(inlineScripts.length === 1, `Expected one inline compatibility loader, found ${inlineScripts.length}.`);
for (const [sourceName, source] of [['game.js', game], ...inlineScripts.map((script, index) => [`index.html:inline-${index + 1}`, script])]) {
  const productionAst = await parseAsync(source, { sourceType: 'script', babelrc: false, configFile: false });
  invariant(Boolean(productionAst), `Production compatibility source cannot be parsed: ${sourceName}.`);
  const syntaxStack = [productionAst];
  const syntaxSeen = new Set();
  while (syntaxStack.length > 0) {
    const node = syntaxStack.pop();
    if (!node || typeof node !== 'object' || syntaxSeen.has(node)) continue;
    syntaxSeen.add(node);
    if (forbiddenSyntax.has(node.type)
      || (node.type === 'VariableDeclaration' && node.kind !== 'var')
      || ((node.type === 'FunctionDeclaration' || node.type === 'FunctionExpression' || node.type === 'ObjectMethod') && node.async)
      || (node.type === 'LogicalExpression' && node.operator === '??')) unsupportedSyntaxCount += 1;
    if (node.type === 'StringLiteral' || node.type === 'DirectiveLiteral') productionStringFragments.push(node.value);
    if (node.type === 'TemplateElement') productionStringFragments.push(node.value?.cooked ?? node.value?.raw ?? '');
    for (const value of Object.values(node)) {
      if (Array.isArray(value)) for (const item of value) syntaxStack.push(item);
      else if (value && typeof value === 'object') syntaxStack.push(value);
    }
  }
}
invariant(unsupportedSyntaxCount === 0, `Production bundle retains ${unsupportedSyntaxCount} unsupported syntax nodes.`);
const productionTextCorpus = productionStringFragments.join('\n');
for (const requiredVisibleName of ['Хранительница угасания', 'Ember Warden', 'Огненное кольцо', 'Fire Ring']) {
  invariant(productionTextCorpus.includes(requiredVisibleName), `Required localized visible name is missing: ${requiredVisibleName}.`);
}
invariant(!/Демонесса угасания|Fading Demoness|Круг Инферно|Inferno Circle/iu.test(productionTextCorpus),
  'Production text retains a prohibited legacy visible name.');

const yandexAssets = JSON.parse(await readFile(join(gameRoot, 'assets/assets-manifest-yandex-1.0.0.json'), 'utf8'));
invariant(yandexAssets.maximumDecodedResidencyBytes <= 64 * 1024 * 1024, 'Decoded asset residency exceeds 64 MiB.');
invariant(Array.isArray(yandexAssets.residencyModel?.scenarios) && yandexAssets.residencyModel.scenarios.length >= 4, 'State-derived residency scenarios are missing.');
invariant(yandexAssets.maximumDecodedResidencyBytes === Math.max(...yandexAssets.residencyModel.scenarios.map((scenario) => scenario.decodedBytes)), 'Maximum decoded residency does not match the scenario model.');
invariant(yandexAssets.alphaAudit.frames === 64, 'Cycle 09 alpha audit must cover 64 frames.');
invariant(yandexAssets.alphaAudit.detachedPartialAlphaPixelCountMax === 0, 'Detached partial alpha remains in Cycle 09 assets.');
invariant(yandexAssets.alphaAudit.entries.every((entry) => entry.matteRatioMax <= 0.01), 'Character matte ratio exceeds the approved threshold.');
invariant(yandexAssets.alphaAudit.entries.every((entry) => entry.internalNeutralResidueRatioMax <= 0.005), 'Character neutral residue exceeds the approved threshold.');
invariant(yandexAssets.outerFlameAudit?.frames === 30
  && yandexAssets.outerFlameAudit?.entries?.length === 3
  && yandexAssets.outerFlameAudit?.sourceInternalLowChromaMattePixelCount > 0
  && yandexAssets.outerFlameAudit?.sourceInternalOliveMattePixelCount > 0
  && yandexAssets.outerFlameAudit?.sourceStickerEdgePixelCount > 0
  && yandexAssets.outerFlameAudit?.suppressedMattePixelCount > 0
  && yandexAssets.outerFlameAudit?.featheredStickerEdgePixelCount > 0
  && yandexAssets.outerFlameAudit?.detachedAlphaPixelCount === 0
  && yandexAssets.outerFlameAudit?.internalLowChromaMattePixelCount === 0
  && yandexAssets.outerFlameAudit?.internalOliveMattePixelCount === 0
  && yandexAssets.outerFlameAudit?.neutralEdgePixelCount === 0
  && yandexAssets.outerFlameAudit?.coolEdgePixelCount === 0
  && yandexAssets.outerFlameAudit?.stickerEdgePixelCount === 0
  && yandexAssets.outerFlameAudit?.pngWebpDecodedRgbaParity === true,
'Cycle 09 outer flame cleanup/parity audit is incomplete.');
invariant(yandexAssets.stageFlareAudit?.frames === 8
  && yandexAssets.stageFlareAudit?.sourceDetachedAlphaPixelCount > 0
  && yandexAssets.stageFlareAudit?.detachedAlphaPixelCount === 0
  && yandexAssets.stageFlareAudit?.neutralEdgePixelCount === 0
  && yandexAssets.stageFlareAudit?.coolEdgePixelCount === 0
  && yandexAssets.stageFlareAudit?.backgroundAudits?.length === 3
  && yandexAssets.stageFlareAudit.backgroundAudits.every((entry) => entry.detachedAlphaPixelCount === 0
    && entry.neutralEdgePixelCount === 0 && entry.coolEdgePixelCount === 0)
  && yandexAssets.stageFlareAudit?.pngWebpDecodedRgbaParity === true,
'Cycle 09 stage-flare cleanup/parity audit is incomplete.');
invariant(yandexAssets.compatibilityFormatsLoadedTogether === false, 'Compatibility formats must not load together.');

const visualManifest = JSON.parse(await readFile(join(evidenceRoot, 'visual/character-matrix-manifest.json'), 'utf8'));
invariant(visualManifest.sourceFingerprint === manifest.sourceFingerprint, 'Cycle 09 visual matrices are stale for the final source fingerprint.');
invariant(validTimestamp(visualManifest.generatedAt), 'Cycle 09 visual matrix has an invalid generation timestamp.');
invariant(visualManifest.frameCount === 64 && visualManifest.compositeCheckCount === 576, 'Visual matrix must prove 64 frames across 3 backgrounds and DPR 1/2/3.');
invariant(JSON.stringify(visualManifest.backgrounds) === JSON.stringify(['black', 'dark-red', 'neutral-gray']), 'Visual matrix background set is incomplete.');
invariant(JSON.stringify(visualManifest.dprs) === JSON.stringify([1, 2, 3]), 'Visual matrix DPR set is incomplete.');
const expectedVisualClips = [
  ['ash-servant', 'idle'], ['ash-servant', 'inhale'], ['ash-servant', 'blow'], ['ash-servant', 'recovery'],
  ['ember-warden', 'idle'], ['ember-warden', 'cast'], ['ember-warden', 'hold'], ['ember-warden', 'recovery'],
];
invariant(Array.isArray(visualManifest.clips)
  && visualManifest.clips.length === expectedVisualClips.length
  && JSON.stringify(visualManifest.clips.map((entry) => [entry.id.slice(0, -(entry.clip.length + 1)), entry.clip, entry.frames]))
    === JSON.stringify(expectedVisualClips.map(([character, clip]) => [character, clip, 8])),
'Visual matrix clip inventory differs from the exact 64-frame character contract.');
const expectedVisualFiles = visualManifest.backgrounds.flatMap((background) => visualManifest.dprs.map((dpr) => ({
  filename: `characters-${background}-dpr${dpr}.png`, background, dpr, frames: 64,
})));
invariant(Array.isArray(visualManifest.files)
  && visualManifest.files.length === expectedVisualFiles.length
  && new Set(visualManifest.files.map((entry) => entry.filename)).size === expectedVisualFiles.length
  && JSON.stringify(visualManifest.files.map(({ filename, background, dpr, frames }) => ({ filename, background, dpr, frames }))) === JSON.stringify(expectedVisualFiles),
'Visual matrix sheet inventory is not the exact background/DPR Cartesian set.');
const expectedVisualChecks = visualManifest.backgrounds.flatMap((background) => visualManifest.dprs.flatMap((dpr) => expectedVisualClips.flatMap(([character, clip]) =>
  Array.from({ length: 8 }, (_, frame) => `${background}:${dpr}:${character}:${clip}:${frame}`))));
const actualVisualChecks = visualManifest.checks?.map((entry) => `${entry.background}:${entry.dpr}:${entry.character}:${entry.clip}:${entry.frame}`) ?? [];
invariant(actualVisualChecks.length === expectedVisualChecks.length
  && new Set(actualVisualChecks).size === expectedVisualChecks.length
  && JSON.stringify(actualVisualChecks) === JSON.stringify(expectedVisualChecks),
'Visual matrix contains an unexpected, missing, reordered or duplicate frame composite.');
for (const item of visualManifest.files) {
  invariant(/^[a-z0-9-]+\.png$/u.test(item.filename), `Unsafe visual matrix filename: ${item.filename}`);
  const bytes = await readFile(join(evidenceRoot, 'visual', item.filename));
  const metadata = await sharp(bytes, { failOn: 'error' }).metadata();
  invariant(bytes.length === item.bytes && sha256(bytes) === item.sha256, `Visual matrix mismatch: ${item.filename}`);
  invariant(metadata.width === item.width && metadata.height === item.height, `Visual matrix dimensions mismatch: ${item.filename}`);
}
const runtimeManifest = JSON.parse(await readFile(join(evidenceRoot, 'visual/runtime-stage-matrix-manifest.json'), 'utf8'));
invariant(runtimeManifest.sourceFingerprint === manifest.sourceFingerprint, 'Seven-stage runtime matrices are stale for the final source fingerprint.');
invariant(validTimestamp(runtimeManifest.generatedAt), 'Seven-stage runtime matrix has an invalid generation timestamp.');
invariant(runtimeManifest.runtimeCheckCount === 63, 'Seven-stage runtime matrix must cover normal/reduced/forced-low stages 1–7 at DPR 1/2/3.');
invariant(JSON.stringify(runtimeManifest.modes) === JSON.stringify(['normal', 'reduced', 'forced-low']), 'Runtime quality/motion mode matrix is incomplete.');
invariant(JSON.stringify(runtimeManifest.stages) === JSON.stringify([1, 2, 3, 4, 5, 6, 7]), 'Runtime stage matrix is incomplete.');
invariant(JSON.stringify(runtimeManifest.dprs) === JSON.stringify([1, 2, 3]), 'Runtime DPR matrix is incomplete.');
invariant(runtimeManifest.contactSheetLayout === 'seven-columns-horizontal', 'Runtime contact sheets must expose all seven full scenes horizontally for Human-Eye review.');
invariant(runtimeManifest.consoleErrors === 0 && runtimeManifest.consoleWarnings === 0 && runtimeManifest.unexpectedNetworkFailures === 0, 'Runtime visual capture recorded browser failures.');
invariant(runtimeManifest.pageErrors === 0 && runtimeManifest.requestFailures === 0 && runtimeManifest.httpErrors === 0,
'Runtime visual capture did not prove zero page/request/HTTP errors.');
const expectedRuntimeFiles = runtimeManifest.modes.flatMap((mode) => runtimeManifest.dprs.map((dpr) => ({
  filename: `runtime-seven-stages-${mode}-dpr${dpr}.png`, mode, dpr, stages: 7,
})));
invariant(Array.isArray(runtimeManifest.files)
  && runtimeManifest.files.length === expectedRuntimeFiles.length
  && new Set(runtimeManifest.files.map((entry) => entry.filename)).size === expectedRuntimeFiles.length
  && JSON.stringify(runtimeManifest.files.map(({ filename, mode, dpr, stages }) => ({ filename, mode, dpr, stages }))) === JSON.stringify(expectedRuntimeFiles),
'Runtime contact-sheet inventory is not the exact mode/DPR Cartesian set.');
const expectedRuntimeChecks = runtimeManifest.modes.flatMap((mode) => runtimeManifest.dprs.flatMap((dpr) =>
  runtimeManifest.stages.map((stage) => `${mode}:${stage}:${dpr}`)));
const actualRuntimeChecks = runtimeManifest.checks?.map((entry) => `${entry.mode}:${entry.stage}:${entry.dpr}`) ?? [];
invariant(actualRuntimeChecks.length === expectedRuntimeChecks.length
  && new Set(actualRuntimeChecks).size === expectedRuntimeChecks.length
  && JSON.stringify(actualRuntimeChecks) === JSON.stringify(expectedRuntimeChecks),
'Runtime matrix contains an unexpected, missing, reordered or duplicate mode/stage/DPR capture.');
for (const item of runtimeManifest.files) {
  invariant(/^runtime-seven-stages-(?:normal|reduced|forced-low)-dpr[123]\.png$/u.test(item.filename), `Unsafe runtime matrix filename: ${item.filename}`);
  const bytes = await readFile(join(evidenceRoot, 'visual', item.filename));
  const metadata = await sharp(bytes, { failOn: 'error' }).metadata();
  invariant(bytes.length === item.bytes && sha256(bytes) === item.sha256, `Runtime matrix mismatch: ${item.filename}`);
  invariant(metadata.width === item.width && metadata.height === item.height, `Runtime matrix dimensions mismatch: ${item.filename}`);
}
const outerFlameEvidence = JSON.parse(await readFile(join(evidenceRoot, 'visual/outer-flame-v4/outer-flame-v4-audit.json'), 'utf8'));
invariant(outerFlameEvidence.sourceFingerprint === manifest.sourceFingerprint
  && validTimestamp(outerFlameEvidence.generatedAt)
  && outerFlameEvidence.algorithmVersion === 'outer-flame-c09-v4-v1'
  && JSON.stringify(outerFlameEvidence.families?.map((entry) => entry.family)) === JSON.stringify(['low', 'mid', 'high'])
  && outerFlameEvidence.families.reduce((sum, entry) => sum + entry.layout.frames, 0) === 30,
'Outer-flame v4 Human-Eye evidence is stale or incomplete.');
for (const family of outerFlameEvidence.families) {
  invariant(family.metrics?.sourceInternalLowChromaMattePixelCount > 0
    && family.metrics?.sourceInternalOliveMattePixelCount > 0
    && family.metrics?.sourceStickerEdgePixelCount > 0
    && family.metrics?.suppressedMattePixelCount > 0
    && family.metrics?.detachedAlphaPixelCount === 0
    && family.metrics?.internalLowChromaMattePixelCount === 0
    && family.metrics?.internalOliveMattePixelCount === 0
    && family.metrics?.neutralEdgePixelCount === 0
    && family.metrics?.coolEdgePixelCount === 0
    && family.metrics?.stickerEdgePixelCount === 0
    && family.pngWebpVisibleDecodedRgbaParity === true,
  `Outer-flame v4 ${family.family} metrics do not close the internal matte/sticker defect.`);
  for (const format of ['png', 'webp']) {
    const output = family.output[format];
    const bytes = await readFile(join(gameRoot, output.path));
    invariant(bytes.length === output.bytes && sha256(bytes) === output.sha256, `Outer-flame v4 ${family.family} ${format} evidence mismatch.`);
  }
  const reviewFilename = `outer-${family.family}-v4-black-gray-red.png`;
  const reviewBytes = await readFile(join(evidenceRoot, 'visual/outer-flame-v4', reviewFilename));
  const reviewMetadata = await sharp(reviewBytes, { failOn: 'error' }).metadata();
  invariant(reviewBytes.length === family.review.bytes && sha256(reviewBytes) === family.review.sha256
    && reviewMetadata.width === family.review.width && reviewMetadata.height === family.review.height,
  `Outer-flame v4 ${family.family} black/gray/red matrix is missing or stale.`);
}
const stageFlareEvidence = JSON.parse(await readFile(join(evidenceRoot, 'visual/stage-flare-v3/stage-flare-v3-audit.json'), 'utf8'));
invariant(stageFlareEvidence.sourceFingerprint === manifest.sourceFingerprint, 'Stage-flare visual evidence is stale for the final source fingerprint.');
invariant(validTimestamp(stageFlareEvidence.generatedAt)
  && stageFlareEvidence.contract?.frames === 8
  && stageFlareEvidence.contract?.grid === '4x2'
  && stageFlareEvidence.contract?.frameWidth === 256
  && stageFlareEvidence.contract?.frameHeight === 512
  && stageFlareEvidence.contract?.fps === 8
  && stageFlareEvidence.contract?.loop === false
  && stageFlareEvidence.metrics?.detachedAlphaPixelCount === 0
  && stageFlareEvidence.metrics?.neutralEdgePixelCount === 0
  && stageFlareEvidence.metrics?.coolEdgePixelCount === 0
  && stageFlareEvidence.backgroundAudits?.length === 3
  && stageFlareEvidence.pngWebpDecodedRgbaParity === true,
'Stage-flare visual evidence does not prove the accepted eight-frame contract and zero-residue cleanup.');
for (const format of ['png', 'webp']) {
  const bytes = await readFile(join(gameRoot, stageFlareEvidence.output[format]));
  invariant(bytes.length === stageFlareEvidence.output[`${format}Bytes`]
    && sha256(bytes) === stageFlareEvidence.output[`${format}Sha256`],
  `Stage-flare ${format.toUpperCase()} evidence does not match the source asset.`);
}
const stageFlareReviewBytes = await readFile(join(evidenceRoot, 'visual/stage-flare-v3/stage-flare-v3-black-neutral-gray-dark-red.png'));
const stageFlareReviewMetadata = await sharp(stageFlareReviewBytes, { failOn: 'error' }).metadata();
invariant(stageFlareReviewBytes.length === stageFlareEvidence.review?.bytes
  && sha256(stageFlareReviewBytes) === stageFlareEvidence.review?.sha256
  && stageFlareReviewMetadata.width === 3072
  && stageFlareReviewMetadata.height === 1024,
'Stage-flare black/gray/red Human-Eye matrix is missing, stale or malformed.');
const exactVisualReviewFiles = [
  ...visualManifest.files.map((item) => ({ id: `character/${item.filename}`, sha256: item.sha256 })),
  ...runtimeManifest.files.map((item) => ({ id: `runtime/${item.filename}`, sha256: item.sha256 })),
  ...outerFlameEvidence.families.map((item) => ({ id: `outer/${item.family}`, sha256: item.review.sha256 })),
  { id: 'flare/stage-flare-v3', sha256: stageFlareEvidence.review.sha256 },
].sort((left, right) => left.id.localeCompare(right.id));
invariant(new Set(exactVisualReviewFiles.map((item) => item.id)).size === exactVisualReviewFiles.length,
'Exact visual review inventory contains duplicate IDs.');
const visualHumanReview = JSON.parse(await readFile(join(gameRoot, 'releases/yandex-submission-1.0.0/visual-human-review.json'), 'utf8'));
const latestCurrentVisualGenerationTime = Math.max(...[
  visualManifest.generatedAt, runtimeManifest.generatedAt, outerFlameEvidence.generatedAt, stageFlareEvidence.generatedAt,
].map((value) => Date.parse(value)));
invariant(visualHumanReview.schemaVersion === 1
  && visualHumanReview.kind === 'cycle09-visual-human-review'
  && visualHumanReview.status === 'PASS'
  && visualHumanReview.cycle === '09'
  && visualHumanReview.sourceFingerprint === manifest.sourceFingerprint
  && visualHumanReview.reviewer?.independent === true
  && typeof visualHumanReview.reviewer?.id === 'string'
  && /^[A-Za-z0-9][A-Za-z0-9._@/+-]{1,127}$/u.test(visualHumanReview.reviewer.id)
  && visualHumanReview.reviewer.id !== 'root'
  && validTimestamp(visualHumanReview.evidenceGeneratedAt)
  && validTimestamp(visualHumanReview.reviewer?.reviewedAt)
  && Date.parse(visualHumanReview.reviewer.reviewedAt) >= Date.parse(visualHumanReview.evidenceGeneratedAt)
  && Date.parse(visualHumanReview.evidenceGeneratedAt) <= latestCurrentVisualGenerationTime,
'Cycle 09 visuals lack an independent exact-source Human-Eye review.');
const reviewedVisualFiles = visualHumanReview.files?.map((item) => ({ id: item.id, sha256: item.sha256 })) ?? [];
invariant(reviewedVisualFiles.length === exactVisualReviewFiles.length
  && new Set(reviewedVisualFiles.map((item) => item.id)).size === exactVisualReviewFiles.length
  && JSON.stringify([...reviewedVisualFiles].sort((left, right) => left.id.localeCompare(right.id))) === JSON.stringify(exactVisualReviewFiles)
  && visualHumanReview.files.every((item) => item.verdict === 'PASS' && typeof item.observation === 'string' && item.observation.length >= 12),
'Cycle 09 Human-Eye review is not bound to every exact character/runtime/outer/flare sheet hash.');
invariant(visualHumanReview.coverage?.characterFrames === 64
  && visualHumanReview.coverage?.characterComposites === 576
  && visualHumanReview.coverage?.runtimeScenes === 63
  && visualHumanReview.coverage?.whiteOrNeutralSpots === 0
  && visualHumanReview.coverage?.detachedAlpha === 0
  && visualHumanReview.coverage?.matteOrStickerResidue === 0
  && visualHumanReview.coverage?.ritualReligiousEsotericSymbols === 0,
'Cycle 09 Human-Eye review does not close the white-spot/content/runtime coverage contract.');
const compatibilityReport = JSON.parse(await readFile(join(evidenceRoot, 'compatibility-audit.json'), 'utf8'));
invariant(compatibilityReport.sourceFingerprint === manifest.sourceFingerprint, 'Compatibility evidence is stale for the final source fingerprint.');
invariant(compatibilityReport.syntaxTarget === manifest.syntaxTarget && compatibilityReport.transpiler === manifest.transpiler, 'Compatibility evidence used another transpilation target.');
invariant(compatibilityReport.unsupportedSyntaxCount === 0 && Object.values(compatibilityReport.invariants).every(Boolean), 'Compatibility evidence contains a failed invariant.');

const soakReport = JSON.parse(await readFile(join(evidenceRoot, 'soak-yandex.json'), 'utf8'));
const soakEnvironmentBlocked = soakReport.status === 'BLOCKED_ENV';
invariant(['PASS', 'BLOCKED_ENV'].includes(soakReport.status) && soakReport.releaseEligible === true, 'Four-session Yandex release soak has no valid terminal evidence.');
invariant(soakReport.configuration?.durationMs >= 720_000
  && soakReport.configuration?.minimumReleaseDurationMs === 720_000
  && soakReport.configuration?.timewarp === false
  && soakReport.configuration?.mockedYandexSdk === true,
'Release soak must use four real-time 12-minute sessions with the mocked SDK boundary.');
invariant(soakReport.build?.sourceFingerprint === manifest.sourceFingerprint
  && soakReport.build?.buildId === manifest.buildId
  && soakReport.build?.commitSha === manifest.commitSha
  && soakReport.build?.clean === true
  && soakReport.build?.manifestSha256 === sha256(manifestBytes)
  && soakReport.build?.target === 'yandex'
  && soakReport.build?.version === '1.0.0'
  && soakReport.build?.testDriver === false,
'Release soak was not run against the exact production Yandex source.');
invariant(soakReport.assetResidency?.passed === true
  && soakReport.assetResidency?.maximumDecodedResidencyBytes <= 64 * 1024 * 1024,
'Release soak asset residency evidence is over budget.');
invariant(Array.isArray(soakReport.sessions) && soakReport.sessions.length === 4, 'Release soak must contain exactly four sessions.');
if (soakEnvironmentBlocked) {
  invariant(soakReport.configuration?.environmentBlockerExitAllowed === true
    && soakReport.environment?.compositorCalibration?.desktopThresholdProvable === false
    && soakReport.environment?.compositorCalibration?.desktopThresholdFps === 55
    && soakReport.environment?.compositorCalibration?.medianFps > 0
    && soakReport.environment?.compositorCalibration?.medianFps < 55,
  'BLOCKED_ENV soak lacks a measured host-compositor limitation.');
  invariant(Array.isArray(soakReport.failures) && soakReport.failures.length === 1
    && /^2\/4 browser sessions failed\.$/u.test(soakReport.failures[0]),
  'BLOCKED_ENV soak contains a non-compositor aggregate failure.');
}
const requiredSoakCombinations = new Set(['desktop:true', 'desktop:false', 'mobile:true', 'mobile:false']);
for (const session of soakReport.sessions) {
  requiredSoakCombinations.delete(`${session.device}:${Boolean(session.rewarded)}`);
  const compositorOnlySessionBlock = soakEnvironmentBlocked && session.device === 'desktop'
    && session.passed === false
    && session.failures?.length === 1
    && /^median-fps:/u.test(session.failures[0]?.detail ?? '')
    && session.assertions?.filter((assertion) => !assertion.passed).length === 1
    && session.assertions?.find((assertion) => !assertion.passed)?.name === 'median-fps';
  invariant((session.passed === true
      && Array.isArray(session.failures) && session.failures.length === 0
      && Array.isArray(session.assertions) && session.assertions.every((assertion) => assertion.passed === true)
    || compositorOnlySessionBlock),
  `Soak session contains a non-environment failure: ${session.id}.`);
  invariant(session.elapsedMs >= 720_000,
  `Soak session failed or was shorter than 12 minutes: ${session.id}.`);
  invariant(session.functional?.maxStage === 7
    && session.functional?.completedAttempts >= 2
    && session.functional?.runIds?.length >= 3
    && session.interactions?.goalsOpened >= 3
    && session.interactions?.restarts >= 2,
  `Soak session lacks several runs/goals/full progression: ${session.id}.`);
  const fpsFloor = session.device === 'desktop' ? 55 : 30;
  const fpsSatisfied = Number.isFinite(session.performance?.medianFps)
    && (session.performance.medianFps >= fpsFloor || compositorOnlySessionBlock);
  invariant(fpsSatisfied
    && Number.isFinite(session.performance?.longFrameRatio) && session.performance.longFrameRatio <= 0.01
    && Number.isFinite(session.performance?.maximumHeapBytes) && session.performance.maximumHeapBytes > 0
    && session.performance.maximumHeapBytes <= 150 * 1024 * 1024
    && Number.isFinite(session.performance?.inputFeedbackP95Ms) && session.performance.inputFeedbackP95Ms <= 100,
  `Soak performance thresholds failed: ${session.id}.`);
  invariant(session.sdk?.setData >= 2 && session.sdk?.flushWrites >= 1
    && session.sdk?.gameplayStarts >= 3 && session.sdk?.gameplayStops >= 2,
  `Soak SDK save/lifecycle coverage is incomplete: ${session.id}.`);
  if (session.rewarded) invariant(session.sdk?.rewardedCallbacks >= 2, `Rewarded repeat is missing in soak session: ${session.id}.`);
  else invariant(session.sdk?.adRequests === 0, `No-reward soak session requested an ad: ${session.id}.`);
}
invariant(requiredSoakCombinations.size === 0, `Missing soak combinations: ${[...requiredSoakCombinations].join(', ')}.`);

const environmentReport = JSON.parse(await readFile(join(evidenceRoot, 'environment-audit.json'), 'utf8'));
invariant(environmentReport.build?.sourceFingerprint === manifest.sourceFingerprint
  && environmentReport.build?.buildId === manifest.buildId
  && environmentReport.build?.commitSha === manifest.commitSha
  && environmentReport.build?.clean === true,
'Environment audit is stale or was not run on the clean exact build.');
invariant(['PASS', 'BLOCKED_EXTERNAL'].includes(environmentReport.status), 'Environment audit has an invalid terminal status.');
invariant(Array.isArray(environmentReport.invalidSuppliedEvidence) && environmentReport.invalidSuppliedEvidence.length === 0,
'Environment audit retained invalid supplied evidence.');
invariant(environmentReport.browsers?.some((item) => item.id === 'chrome' && item.covered === true), 'Executed Chrome exact-build coverage is missing.');
invariant(environmentReport.browsers?.every((item) => item.covered === (item.runEvidence?.valid === true)), 'Browser coverage contains a fail-open evidence state.');
invariant(environmentReport.status === 'PASS'
  ? environmentReport.browsers.every((item) => item.covered === true)
    && Object.values(environmentReport.externalEvidence ?? {}).every((item) => item.valid === true)
  : (Array.isArray(environmentReport.missingRequiredEnvironments) && environmentReport.missingRequiredEnvironments.length > 0),
'Environment blocker status lacks exact missing environments.');

const snapshotPathPattern = /^(?!\/)(?!.*(?:^|\/)\.\.(?:\/|$))[A-Za-z0-9._+\-/]+$/u;
async function verifyEnvironmentSnapshot(snapshot, label) {
  invariant(snapshot && typeof snapshot.root === 'string' && snapshotPathPattern.test(snapshot.root), `${label}: immutable snapshot root is unsafe.`);
  const records = [snapshot.manifest, snapshot.report, ...(snapshot.artifacts ?? [])];
  invariant(records.length >= 3
    && records.every((record) => record && typeof record.path === 'string' && snapshotPathPattern.test(record.path)
      && record.path.startsWith(`${snapshot.root}/`) && Number.isInteger(record.bytes) && record.bytes > 0
      && /^[a-f0-9]{64}$/u.test(record.sha256))
    && new Set(records.map((record) => record.path)).size === records.length
    && new Set(records.slice(1).map((record) => record.sha256)).size === records.length - 1,
  `${label}: immutable snapshot pointer inventory is malformed or reused.`);
  for (const record of records) {
    const bytes = await readFile(join(evidenceRoot, record.path));
    invariant(bytes.length === record.bytes && sha256(bytes) === record.sha256, `${label}: immutable snapshot bytes changed: ${record.path}`);
  }
  const snapshotDocument = JSON.parse(await readFile(join(evidenceRoot, snapshot.manifest.path), 'utf8'));
  invariant(snapshotDocument.schemaVersion === 1
    && snapshotDocument.kind === 'immutable-external-evidence-snapshot'
    && snapshotDocument.cycle === '09'
    && `${snapshot.root}/${snapshotDocument.report?.snapshotFile}` === snapshot.report.path
    && snapshotDocument.report?.bytes === snapshot.report.bytes
    && snapshotDocument.report?.sha256 === snapshot.report.sha256,
  `${label}: immutable snapshot manifest/report binding is invalid.`);
  const manifestArtifacts = snapshotDocument.artifacts ?? [];
  invariant(manifestArtifacts.length === snapshot.artifacts.length
    && JSON.stringify(manifestArtifacts.map((item) => ({
      id: item.id,
      path: `${snapshot.root}/${item.snapshotFile}`,
      mediaType: item.mediaType,
      bytes: item.bytes,
      sha256: item.sha256,
      ...(item.width ? { width: item.width, height: item.height } : {}),
    }))) === JSON.stringify(snapshot.artifacts),
  `${label}: immutable snapshot artifact binding is invalid.`);
}
for (const browserEvidence of environmentReport.browsers.filter((item) => item.runEvidence?.valid === true)) {
  await verifyEnvironmentSnapshot(browserEvidence.runEvidence.snapshot, `Browser ${browserEvidence.id}`);
}
for (const [id, externalEvidence] of Object.entries(environmentReport.externalEvidence ?? {})) {
  if (externalEvidence.valid === true) await verifyEnvironmentSnapshot(externalEvidence.snapshot, `External ${id}`);
}

const mediaManifest = JSON.parse(await readFile(join(gameRoot, 'releases/yandex-submission-1.0.0/media/submission-media-manifest.json'), 'utf8'));
const humanMediaManifest = await readFile(join(gameRoot, 'releases/yandex-submission-1.0.0/asset-manifest.md'), 'utf8');
const expectedMediaNames = [
  'icon-512.png', 'cover-800x470.png',
  ...[1, 2, 3, 4].map((index) => `desktop-0${index}-1920x1080.png`),
  ...[1, 2, 3, 4].map((index) => `mobile-0${index}-1080x1920.png`),
];
invariant(mediaManifest.files.length === 10
  && validTimestamp(mediaManifest.generatedAt)
  && JSON.stringify(mediaManifest.files.map((item) => item.filename)) === JSON.stringify(expectedMediaNames)
  && mediaManifest.gameplayShareRequiredMinimum === 0.7
  && mediaManifest.gameplayShareMinimum >= mediaManifest.gameplayShareRequiredMinimum
  && mediaManifest.systemOrDebugOverlay === false,
'Submission media inventory/presentation contract is incomplete.');
invariant(Object.values(mediaManifest.captureCounters ?? {}).length === 5
  && Object.values(mediaManifest.captureCounters).every((count) => count === 0),
'Submission capture recorded or omitted browser/network counters.');
const allowedResidencyAborts = new Set([
  ...['idle', 'inhale', 'blow', 'recovery'].map((clip) => `/assets/characters/ash-servant/ash-servant-${clip}-v7.webp`),
  ...['idle', 'cast', 'hold', 'recovery'].map((clip) => `/assets/characters/demoness/demoness-${clip}-v8.webp`),
]);
const residencyAborts = mediaManifest.expectedResidencyAborts ?? [];
invariant(Array.isArray(residencyAborts)
  && residencyAborts.length <= allowedResidencyAborts.size
  && new Set(residencyAborts.map((entry) => entry.path)).size === residencyAborts.length
  && residencyAborts.every((entry) => allowedResidencyAborts.has(entry.path)
    && entry.errorText === 'net::ERR_ABORTED'
    && entry.reason === 'test-driver clip transition released the non-current decoded atlas'),
'Submission capture residency cancellations are not a bounded, explicit test-driver transition set.');
const expectedScreenshotNames = expectedMediaNames.filter((name) => /^(?:desktop|mobile)-/u.test(name));
invariant(mediaManifest.captureAssertions?.length === 8
  && JSON.stringify(mediaManifest.captureAssertions.map((item) => item.filename)) === JSON.stringify(expectedScreenshotNames)
  && mediaManifest.captureAssertions.every((item) => item.appState === (/-01-/u.test(item.filename) ? 'ready' : 'playing')
    && item.gameplaySurfaceRatio >= 0.7 && item.visibleDebugOverlayCount === 0),
'Submission capture DOM/gameplay assertions are incomplete.');
invariant(mediaManifest.captureBuild?.target === 'yandex' && mediaManifest.captureBuild?.testDriver === true, 'Submission screenshots lack instrumented Yandex capture identity.');
invariant(mediaManifest.captureBuild?.sourceFingerprint === manifest.sourceFingerprint, 'Submission screenshots are stale for the final source fingerprint.');
for (const item of mediaManifest.files) {
  const bytes = await readFile(join(gameRoot, 'releases/yandex-submission-1.0.0/media', item.filename));
  const metadata = await sharp(bytes, { failOn: 'error' }).metadata();
  invariant(sha256(bytes) === item.sha256 && bytes.length === item.bytes, `Submission media mismatch: ${item.filename}`);
  invariant(metadata.format === 'png' && metadata.width === item.width && metadata.height === item.height, `Submission media dimensions mismatch: ${item.filename}`);
  invariant(humanMediaManifest.includes(`\`media/${item.filename}\``) && humanMediaManifest.includes(`\`${item.sha256}\``), `Human submission media manifest is stale: ${item.filename}`);
}
const mediaManifestSha256 = sha256(await readFile(join(gameRoot, 'releases/yandex-submission-1.0.0/media/submission-media-manifest.json')));
const submissionHumanReview = JSON.parse(await readFile(join(gameRoot, 'releases/yandex-submission-1.0.0/submission-human-review.json'), 'utf8'));
invariant(submissionHumanReview.schemaVersion === 1
  && submissionHumanReview.kind === 'submission-human-review'
  && submissionHumanReview.status === 'PASS'
  && submissionHumanReview.cycle === '09'
  && submissionHumanReview.sourceFingerprint === manifest.sourceFingerprint
  && submissionHumanReview.mediaManifestSha256 === mediaManifestSha256
  && submissionHumanReview.reviewer?.independent === true
  && typeof submissionHumanReview.reviewer?.id === 'string'
  && /^[A-Za-z0-9][A-Za-z0-9._@/+-]{1,127}$/u.test(submissionHumanReview.reviewer.id)
  && submissionHumanReview.reviewer.id !== 'root'
  && validTimestamp(submissionHumanReview.reviewer?.reviewedAt)
  && Date.parse(submissionHumanReview.reviewer.reviewedAt) >= Date.parse(mediaManifest.generatedAt),
'Submission media lacks an independent exact-hash Human-Eye sign-off.');
invariant(submissionHumanReview.files?.length === 10
  && new Set(submissionHumanReview.files.map((item) => item.filename)).size === 10
  && JSON.stringify(submissionHumanReview.files.map((item) => item.filename)) === JSON.stringify(expectedMediaNames)
  && submissionHumanReview.files.every((review, index) => review.sha256 === mediaManifest.files[index].sha256 && review.verdict === 'PASS'),
'Submission Human-Eye review inventory is incomplete or stale.');
invariant(submissionHumanReview.files.filter((item) => /^(?:desktop|mobile)-/u.test(item.filename)).every((item) => item.realGameplay === true
  && item.gameplayShareAtLeast70 === true && item.noSystemOrDebugOverlay === true && item.cropAndReadability === true),
'Submission screenshots did not pass the required Human-Eye gameplay/crop review.');

const total = (await Promise.all(actualFiles.map(async (path) => (await stat(path)).size))).reduce((sum, value) => sum + value, 0);
invariant(total === manifest.unpackedBytes, `Unpacked byte total drift: ${total} != ${manifest.unpackedBytes}`);
console.log(`Yandex local RC audit PASS${soakEnvironmentBlocked ? ' WITH HOST-COMPOSITOR BLOCKER' : ''} (${actualFiles.length} files, ${total} bytes, decoded ${(yandexAssets.maximumDecodedResidencyBytes / 1024 / 1024).toFixed(2)} MiB)`);
