// @ts-check

const FULL_REACH = 1;
export const STEAM_CONTACT_REACH = 0.97;

/** @param {number} value @param {number} low @param {number} high */
function clamp(value, low, high) { return Math.max(low, Math.min(high, value)); }

/**
 * Pure stream geometry shared by rendering and flame-contact diagnostics.
 * @param {{x:number,y:number}} source
 * @param {{x:number,y:number}} target
 * @param {number} reach
 */
export function steamStreamGeometry(source, target, reach = FULL_REACH) {
  const boundedReach = clamp(Number(reach) || 0, 0, FULL_REACH);
  const leading = Object.freeze({
    x: source.x + (target.x - source.x) * boundedReach,
    y: source.y + (target.y - source.y) * boundedReach,
  });
  return Object.freeze({
    source: Object.freeze({ x: source.x, y: source.y }),
    target: Object.freeze({ x: target.x, y: target.y }),
    leading,
    reach: boundedReach,
    contact: boundedReach >= STEAM_CONTACT_REACH,
    contactPoint: boundedReach >= STEAM_CONTACT_REACH ? leading : null,
  });
}

/**
 * A deterministic, fixed-size particle sample. It has no retained particle
 * state, so pause freezes it with the scene clock and cleanup is immediate.
 * @param {{time:number,strength:number,source:{x:number,y:number},target:{x:number,y:number},reach?:number,reducedMotion?:boolean,seed?:number}} options
 */
export function steamParticles(options) {
  const geometry = steamStreamGeometry(options.source, options.target, options.reach ?? FULL_REACH);
  const strength = clamp(Number(options.strength) || 0, 0, 1);
  if (strength <= 0 || geometry.reach <= 0) return Object.freeze([]);
  const count = options.reducedMotion ? 32 : 64;
  const seed = Number(options.seed) || 0;
  const axisX = geometry.target.x - geometry.source.x;
  const axisY = geometry.target.y - geometry.source.y;
  const axisLength = Math.max(1, Math.hypot(axisX, axisY));
  const normalX = -axisY / axisLength;
  const normalY = axisX / axisLength;
  return Object.freeze(Array.from({ length: count }, (_, index) => {
    const cycle = ((options.time * (0.08 + index * 0.0007) + (index + 0.35) / count + seed * 0.031) % 1 + 1) % 1;
    const progress = cycle * geometry.reach;
    const envelope = Math.sin(Math.PI * progress);
    const lateral = Math.sin(index * 4.137 + options.time * 1.31 + seed) * (5 + progress * 17) * envelope;
    const curl = Math.cos(index * 2.73 + options.time * 0.83) * 6 * envelope;
    return Object.freeze({
      x: geometry.source.x + axisX * progress + normalX * lateral,
      y: geometry.source.y + axisY * progress + normalY * lateral - curl,
      progress,
      radius: 7 + progress * 8 + index % 3 * 1.5,
      alpha: (0.065 + envelope * 0.085) * strength,
    });
  }));
}

/**
 * Draws a soft directed vapor stream whose first mark is exactly at source.
 * @param {CanvasRenderingContext2D} context
 * @param {{time:number,strength:number,source:{x:number,y:number},target:{x:number,y:number},reach?:number,reducedMotion?:boolean,seed?:number,tint?:'warm'|'neutral'}} options
 */
export function drawSteamStream(context, options) {
  const geometry = steamStreamGeometry(options.source, options.target, options.reach ?? FULL_REACH);
  const strength = clamp(Number(options.strength) || 0, 0, 1);
  if (strength <= 0 || geometry.reach <= 0) return geometry;
  const warm = options.tint === 'warm';
  const particles = steamParticles(options);

  context.save();
  context.globalCompositeOperation = 'source-over';
  context.shadowColor = 'rgba(16,18,20,.28)';
  context.shadowBlur = 4;
  context.fillStyle = warm
    ? `rgba(215,213,208,${0.36 * strength})`
    : `rgba(205,207,204,${0.38 * strength})`;
  context.beginPath();
  context.ellipse(geometry.source.x, geometry.source.y, 5 + strength * 2, 3 + strength, 0, 0, Math.PI * 2);
  context.fill();
  for (const [index, particle] of particles.entries()) {
    context.fillStyle = warm
      ? `rgba(207,207,203,${particle.alpha})`
      : `rgba(198,201,199,${particle.alpha})`;
    context.beginPath();
    context.ellipse(
      particle.x,
      particle.y,
      particle.radius * (1.18 + index % 3 * 0.16),
      particle.radius * (0.72 + index % 2 * 0.14),
      Math.sin(options.time * 0.7 + index * 1.9) * 0.42,
      0,
      Math.PI * 2,
    );
    context.fill();
  }
  context.restore();
  return geometry;
}
