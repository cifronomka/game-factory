import { createHash } from 'node:crypto';
import { mkdir, readFile, writeFile } from 'node:fs/promises';
import { isAbsolute, join } from 'node:path';
import { parseAsync } from '@babel/core';
import { gameRoot } from './lib.mjs';

const rootArgument = process.argv.find((argument) => argument.startsWith('--root='));
const buildRoot = join(gameRoot, rootArgument?.slice('--root='.length) ?? 'dist-e2e');
const requestedEvidence = process.env.INFERNO_CYCLE09_EVIDENCE_DIR;
const evidenceRoot = requestedEvidence
  ? (isAbsolute(requestedEvidence) ? requestedEvidence : join(gameRoot, requestedEvidence))
  : join(gameRoot, 'reports/yandex-release-cycle-09-working');
await mkdir(evidenceRoot, { recursive: true });
const sha256 = (bytes) => createHash('sha256').update(bytes).digest('hex');
const [gameBytes, htmlBytes, stylesBytes, manifestBytes] = await Promise.all([
  readFile(join(buildRoot, 'game.js')),
  readFile(join(buildRoot, 'index.html')),
  readFile(join(buildRoot, 'styles.css')),
  readFile(join(buildRoot, 'build-manifest.json')),
]);
const game = gameBytes.toString('utf8');
const html = htmlBytes.toString('utf8');
const styles = stylesBytes.toString('utf8');
const manifest = JSON.parse(manifestBytes.toString('utf8'));
const forbiddenTypes = new Set([
  'ArrowFunctionExpression', 'ClassDeclaration', 'ClassExpression', 'AwaitExpression',
  'OptionalCallExpression', 'OptionalMemberExpression',
  'RestElement', 'SpreadElement', 'ForOfStatement', 'BigIntLiteral',
]);
const violations = [];
const inlineScripts = [...html.matchAll(/<script(?![^>]*\bsrc=)[^>]*>([\s\S]*?)<\/script>/giu)].map((match) => match[1]);
const syntaxSources = [['game.js', game], ...inlineScripts.map((source, index) => [`index.html:inline-${index + 1}`, source])];
for (const [sourceName, source] of syntaxSources) {
  const ast = await parseAsync(source, { sourceType: 'script', babelrc: false, configFile: false });
  if (!ast) throw new Error(`Compatibility audit could not parse ${sourceName}.`);
  const seen = new Set();
  const stack = [ast];
  while (stack.length > 0) {
    const node = stack.pop();
    if (!node || typeof node !== 'object' || seen.has(node)) continue;
    seen.add(node);
    if (typeof node.type === 'string') {
      if (forbiddenTypes.has(node.type)) violations.push({ source: sourceName, type: node.type, start: node.start ?? null });
      if (node.type === 'VariableDeclaration' && node.kind !== 'var') violations.push({ source: sourceName, type: `VariableDeclaration:${node.kind}`, start: node.start ?? null });
      if ((node.type === 'FunctionDeclaration' || node.type === 'FunctionExpression' || node.type === 'ObjectMethod') && node.async) {
        violations.push({ source: sourceName, type: `${node.type}:async`, start: node.start ?? null });
      }
      if (node.type === 'LogicalExpression' && node.operator === '??') violations.push({ source: sourceName, type: 'nullish-coalescing', start: node.start ?? null });
    }
    for (const value of Object.values(node)) {
      if (Array.isArray(value)) for (const item of value) stack.push(item);
      else if (value && typeof value === 'object') stack.push(value);
    }
  }
}
if (violations.length > 0) throw new Error(`Compatibility bundle retains unsupported syntax: ${JSON.stringify(violations.slice(0, 20))}`);

const invariants = {
  iifeNoNativeModule: !/type=["']module["']/u.test(html) && manifest.nativeEsm === false,
  compatibilityTargetDeclared: manifest.syntaxTarget === 'chrome49/firefox52/safari9/edge15'
    && manifest.transpiler === 'esbuild-iife+babel-preset-env',
  globalThisBootstrap: html.includes('window.globalThis = window.globalThis || window;'),
  inlineLoaderEs5: inlineScripts.length === 1 && html.includes('document.head.appendChild(sdk)') && !html.includes('document.head.append(sdk)'),
  sdkBeforeGame: html.indexOf("sdk.src = '/sdk.js'") >= 0 && html.indexOf("sdk.src = '/sdk.js'") < html.indexOf('src="./game.js"'),
  cssFullscreenFallback: /\.boot-screen,.fatal-screen\{[^}]*top:0;right:0;bottom:0;left:0;inset:0/u.test(styles)
    && /\.dialog-backdrop\{[^}]*top:0;right:0;bottom:0;left:0;inset:0/u.test(styles),
  cssSafeAreaFallback: /padding:24px;padding:max\(/u.test(styles) && /padding:12px;padding:max\(/u.test(styles),
  cssMinWidthFallback: /\.dialog\{width:100%;max-width:500px;width:min\(/u.test(styles),
  hudFullscreenFallback: game.includes('top:0;right:0;bottom:0;left:0;inset:0;width:100%;height:100%'),
  hudMinWidthFallback: game.includes('width:88vw;max-width:520px;width:min(520px,88vw)'),
  fetchXhrFallback: game.includes('XMLHttpRequest') && game.includes('fetch'),
  intlFallback: game.includes('old engines may expose a partial Intl implementation') === false && game.includes('NumberFormat'),
};
const failed = Object.entries(invariants).filter(([, value]) => !value).map(([name]) => name);
if (failed.length > 0) throw new Error(`Compatibility invariants failed: ${failed.join(', ')}`);

const report = {
  schemaVersion: 1,
  target: 'yandex',
  buildRoot: rootArgument?.slice('--root='.length) ?? 'dist-e2e',
  buildId: manifest.buildId,
  sourceFingerprint: manifest.sourceFingerprint,
  syntaxTarget: manifest.syntaxTarget,
  transpiler: manifest.transpiler,
  unsupportedSyntaxCount: violations.length,
  parsedSyntaxSources: syntaxSources.map(([sourceName]) => sourceName),
  invariants,
  game: { bytes: gameBytes.length, sha256: sha256(gameBytes) },
  html: { bytes: htmlBytes.length, sha256: sha256(htmlBytes) },
  styles: { bytes: stylesBytes.length, sha256: sha256(stylesBytes) },
};
await writeFile(join(evidenceRoot, 'compatibility-audit.json'), `${JSON.stringify(report, null, 2)}\n`);
console.log(`Yandex compatibility audit PASS (${manifest.syntaxTarget}, ${gameBytes.length} byte IIFE, unsupported syntax 0)`);
