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
  const count = options.reducedMotion ? 8 : 18;
  const seed = Number(options.seed) || 0;
  const axisX = geometry.target.x - geometry.source.x;
  const axisY = geometry.target.y - geometry.source.y;
  const axisLength = Math.max(1, Math.hypot(axisX, axisY));
  const normalX = -axisY / axisLength;
  const normalY = axisX / axisLength;
  return Object.freeze(Array.from({ length: count }, (_, index) => {
    const cycle = ((options.time * (0.21 + index * 0.0017) + index / count + seed * 0.071) % 1 + 1) % 1;
    const progress = cycle * geometry.reach;
    const envelope = Math.sin(Math.PI * progress);
    const lateral = Math.sin(index * 4.137 + options.time * 1.91 + seed) * (3 + progress * 13) * envelope;
    const curl = Math.cos(index * 2.73 + options.time * 1.23) * 4 * envelope;
    return Object.freeze({
      x: geometry.source.x + axisX * progress + normalX * lateral,
      y: geometry.source.y + axisY * progress + normalY * lateral - curl,
      progress,
      radius: 3.5 + progress * 8 + index % 3,
      alpha: (0.045 + envelope * 0.13) * strength,
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
  context.globalCompositeOperation = 'screen';
  context.shadowColor = warm ? 'rgba(236,226,216,.16)' : 'rgba(232,226,218,.14)';
  context.shadowBlur = 6;
  context.fillStyle = warm
    ? `rgba(236,230,222,${0.12 * strength})`
    : `rgba(230,226,220,${0.09 * strength})`;
  context.beginPath();
  context.ellipse(geometry.source.x, geometry.source.y, 4 + strength * 2, 2.5 + strength, 0, 0, Math.PI * 2);
  context.fill();
  for (const [index, particle] of particles.entries()) {
    context.fillStyle = warm
      ? `rgba(230,225,218,${particle.alpha * 1.08})`
      : `rgba(222,219,214,${particle.alpha * 0.8})`;
    context.beginPath();
    context.ellipse(
      particle.x,
      particle.y,
      particle.radius * (1.35 + index % 3 * 0.12),
      particle.radius * (0.42 + index % 2 * 0.08),
      Math.sin(options.time * 0.7 + index * 1.9) * 0.24,
      0,
      Math.PI * 2,
    );
    context.fill();
  }
  context.restore();
  return geometry;
}
