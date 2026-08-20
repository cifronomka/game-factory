// @ts-check

import { OptionalBitmap } from './optionalBitmap.js';

const CENTER_X = 540;
const HEARTH_Y = 1225;
export const INFERNAL_CHAMBER_URL = new URL('../../../assets/backgrounds/bg-infernal-chamber-production.webp', import.meta.url).href;

/** @param {number} value */
function clamp01(value) { return Math.max(0, Math.min(1, value)); }

/**
 * The generated chamber is a single coherent world. These regions are light
 * masks over that world, not replacement backgrounds or visible primitives.
 * @param {CanvasRenderingContext2D} context
 * @param {OptionalBitmap} bitmap
 * @param {number} alpha
 * @param {()=>void} clip
 * @param {string=} filter
 */
function revealRegion(context, bitmap, alpha, clip, filter = 'brightness(1.18) saturate(1.12)') {
  if (alpha <= 0 || !bitmap.isReady()) return;
  context.save();
  context.beginPath();
  clip();
  context.clip();
  context.globalAlpha = clamp01(alpha);
  context.filter = filter;
  bitmap.drawCover(context, 0, 0, 1080, 1920);
  context.restore();
}

/** Persistent environment art with continuous flame-driven illumination. */
export class EnvironmentScene {
  /** @param {{imageFactory?:(()=>HTMLImageElement|null)}=} options */
  constructor(options = {}) {
    this.background = new OptionalBitmap(INFERNAL_CHAMBER_URL, options);
  }

  async prepareCriticalAssets() {
    const status = await this.background.whenSettled();
    return status === 'ready' || status === 'unavailable';
  }

  async retryCriticalAssets() { return this.background.retry(); }

  /** @param {CanvasRenderingContext2D} context @param {any} state */
  drawFar(context, state) {
    context.fillStyle = '#030204';
    context.fillRect(0, 0, 1080, 1920);
    if (!this.background.isReady()) return;

    context.save();
    context.globalAlpha = 0.96;
    context.filter = `brightness(${0.48 + state.reveal * 0.55}) saturate(${0.72 + state.reveal * 0.38})`;
    this.background.drawCover(context, 0, 0, 1080, 1920);
    context.restore();

    const radius = 68 + state.lightRadius * 980;
    const innerDark = Math.max(0.03, 0.58 - state.reveal * 0.52);
    const outerDark = Math.max(0.28, 0.995 - state.reveal * 0.66);
    const veil = context.createRadialGradient(CENTER_X, HEARTH_Y, radius * 0.16, CENTER_X, HEARTH_Y - 110, radius);
    veil.addColorStop(0, `rgba(2,1,3,${innerDark})`);
    veil.addColorStop(0.58, `rgba(2,1,3,${Math.min(.98, innerDark + .22)})`);
    veil.addColorStop(1, `rgba(2,1,3,${outerDark})`);
    context.fillStyle = veil;
    context.fillRect(0, 0, 1080, 1920);

    const vignette = context.createRadialGradient(CENTER_X, 1030, 240, CENTER_X, 1030, 880);
    vignette.addColorStop(0, 'rgba(0,0,0,0)');
    vignette.addColorStop(1, `rgba(0,0,0,${0.72 - state.reveal * 0.28})`);
    context.fillStyle = vignette;
    context.fillRect(0, 0, 1080, 1920);
  }

  /** @param {CanvasRenderingContext2D} context @param {any} state */
  drawMidground(context, state) {
    revealRegion(context, this.background, state.environment.midground * 0.2, () => {
      context.rect(0, 380, 310, 850);
      context.rect(770, 380, 310, 850);
    });
    revealRegion(context, this.background, state.environment.gate * 0.34, () => context.rect(205, 180, 670, 835), 'brightness(1.25) saturate(1.28)');
    revealRegion(context, this.background, state.environment.chains * 0.32, () => context.rect(0, 245, 1080, 430), 'brightness(1.32) contrast(1.05)');
    revealRegion(context, this.background, state.environment.pylons * 0.28, () => {
      context.rect(0, 720, 275, 690);
      context.rect(805, 720, 275, 690);
    });
  }

  /** @param {CanvasRenderingContext2D} context @param {any} state @param {number} timeSeconds @param {number=} infernoEntryProgress */
  drawRitual(context, state, timeSeconds, infernoEntryProgress = 1) {
    const pulse = state.reducedMotion ? 1 : 0.94 + Math.sin(timeSeconds * 1.6) * 0.06;
    revealRegion(context, this.background, state.environment.ritual * 0.28 * pulse, () => context.ellipse(CENTER_X, HEARTH_Y + 45, 450, 310, 0, 0, Math.PI * 2), 'brightness(1.3) saturate(1.3)');
    revealRegion(context, this.background, state.environment.runes * 0.24 * pulse, () => context.ellipse(CENTER_X, HEARTH_Y + 45, 370, 245, 0, 0, Math.PI * 2), 'brightness(1.48) saturate(1.45)');
    if (state.stage === 7 && infernoEntryProgress < 1) {
      const entry = clamp01(infernoEntryProgress);
      const waveAlpha = Math.sin(entry * Math.PI) * (state.reducedMotion ? 0.36 : 0.72);
      const radiusX = 120 + entry * 340;
      const radiusY = 72 + entry * 210;
      context.save();
      context.globalCompositeOperation = 'screen';
      context.strokeStyle = `rgba(255,178,79,${waveAlpha})`;
      context.lineWidth = 4 + entry * 5;
      context.beginPath();
      context.ellipse(CENTER_X, HEARTH_Y + 45, radiusX, radiusY, 0, 0, Math.PI * 2);
      context.stroke();
      context.lineWidth = 2.5;
      for (let index = 0; index < 16; index += 1) {
        const angle = index / 16 * Math.PI * 2;
        const x = CENTER_X + Math.cos(angle) * radiusX;
        const y = HEARTH_Y + 45 + Math.sin(angle) * radiusY;
        const tangentX = -Math.sin(angle) * 12;
        const tangentY = Math.cos(angle) * 8;
        context.beginPath();
        context.moveTo(x - tangentX, y - tangentY);
        context.lineTo(x + tangentX, y + tangentY);
        context.lineTo(x + Math.cos(angle) * 10, y + Math.sin(angle) * 7);
        context.stroke();
      }
      context.restore();
    }
  }

  /** @param {CanvasRenderingContext2D} context @param {any} state */
  drawForeground(context, state) {
    revealRegion(context, this.background, state.environment.foreground * 0.12, () => context.rect(0, 1360, 1080, 560), 'brightness(1.05) saturate(.9)');
    const lowerVeil = context.createLinearGradient(0, 1380, 0, 1920);
    lowerVeil.addColorStop(0, 'rgba(2,1,3,0)');
    lowerVeil.addColorStop(1, `rgba(2,1,3,${0.72 - state.reveal * 0.34})`);
    context.fillStyle = lowerVeil;
    context.fillRect(0, 1380, 1080, 540);
  }
}
