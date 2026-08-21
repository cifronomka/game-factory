// @ts-check

import { CharacterScene } from '../../src/presentation/scene/characterScene.js';

const canvas = /** @type {HTMLCanvasElement} */ (document.querySelector('canvas'));
const context = /** @type {CanvasRenderingContext2D} */ (canvas.getContext('2d'));
const mode = new URLSearchParams(location.search).get('mode') ?? 'servant';
const scene = new CharacterScene();
scene.setFlameTarget({ x: 540, y: 1_105 });
const started = performance.now();

function baseState() {
  const stage = mode.startsWith('servant') ? 3 : mode === 'demoness' ? 5 : 7;
  return { stage, stageProgress: 1, paused: false, encounters: [], hostLevel: 0, reducedMotion: false };
}

function drawTarget(time) {
  const pulse = 0.92 + Math.sin(time * 5) * 0.08;
  const glow = context.createRadialGradient(540, 1_105, 10, 540, 1_105, 150);
  glow.addColorStop(0, `rgba(255,235,176,${0.7 * pulse})`);
  glow.addColorStop(0.25, `rgba(255,107,38,${0.5 * pulse})`);
  glow.addColorStop(1, 'rgba(112,20,8,0)');
  context.fillStyle = glow;
  context.fillRect(380, 920, 320, 350);
  context.fillStyle = '#ffb33c';
  context.beginPath();
  context.moveTo(540, 1_018);
  context.quadraticCurveTo(610, 1_095, 540, 1_165);
  context.quadraticCurveTo(470, 1_095, 540, 1_018);
  context.fill();
}

function frame(now) {
  const time = (now - started) / 1_000;
  const state = baseState();
  if (mode === 'servant') state.encounters = [{ kind: 'servant', phase: 'active', progress: (time % 2.5) / 2.5 }];
  if (mode === 'servant-recovery' && time % 4 < 2.5) state.encounters = [{ kind: 'servant', phase: 'active', progress: (time % 4) / 2.5 }];
  if (mode === 'demoness') state.encounters = [{ kind: 'demoness', phase: 'active', progress: (time % 4) / 4 }];
  if (mode === 'combined') state.encounters = [
    { kind: 'servant', phase: 'active', progress: (time % 2.5) / 2.5 },
    { kind: 'demoness', phase: 'active', progress: (time % 4) / 4 },
  ];
  if (mode === 'host') state.hostLevel = 2;
  scene.setState(state);
  scene.update(1 / 60);
  context.clearRect(0, 0, canvas.width, canvas.height);
  drawTarget(time);
  scene.draw(context, state, time);
  scene.drawImpactFx(context, time, false);
  requestAnimationFrame(frame);
}

requestAnimationFrame(frame);
