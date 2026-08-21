// @ts-check

import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';

test('runtime observes scene work cost and silently applies presentation quality downgrade', async () => {
  const mainSource = await readFile(new URL('../../src/main.js', import.meta.url), 'utf8');
  const sceneSource = await readFile(new URL('../../src/presentation/scene/infernoScene.js', import.meta.url), 'utf8');

  assert.match(sceneSource, /performance\.now\(\) - workStartedAt/);
  assert.match(mainSource, /onPerformanceSample: \(\{ atMs, workMs, paused \}\)/);
  assert.match(mainSource, /document\.visibilityState !== 'hidden'/);
  assert.match(mainSource, /paused: paused \|\| !performanceMonitoringReady/);
  assert.doesNotMatch(mainSource, /Эффекты снижены для плавной игры/);

  assert.match(mainSource, /Не удалось синхронизировать рекорд/);
  assert.match(mainSource, /ИНФЕРНО — удерживай пламя!/);
  assert.match(mainSource, /Включён упрощённый процедурный фон/);
});
