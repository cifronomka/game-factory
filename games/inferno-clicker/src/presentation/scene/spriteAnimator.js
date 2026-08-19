// @ts-check

/** @typedef {{x:number,y:number,w:number,h:number}} SpriteFrame */
/** @typedef {{fps:number,loop:boolean,frames:readonly SpriteFrame[]}} SpriteClip */

/**
 * Small application-clock sprite player. It deliberately has no wall-clock
 * dependency, so pause/background gaps cannot advance authored animation.
 */
export class SpriteAnimator {
  /** @param {Record<string,SpriteClip>} clips @param {string} initialClip */
  constructor(clips, initialClip) {
    this.clips = clips;
    this.clipName = initialClip;
    this.elapsed = 0;
    this.paused = false;
  }

  /** @param {string} name @param {boolean=} restart */
  setClip(name, restart = false) {
    if (!this.clips[name]) throw new Error(`Unknown sprite clip: ${name}`);
    if (name !== this.clipName || restart) {
      this.clipName = name;
      this.elapsed = 0;
    }
  }

  /** @param {number} seconds */
  update(seconds) {
    if (this.paused) return;
    this.elapsed += Math.max(0, Math.min(0.05, seconds));
  }

  /** @param {boolean} paused */
  setPaused(paused) { this.paused = paused; }

  /** @returns {SpriteClip} */
  get clip() { return this.clips[this.clipName]; }

  getFrameIndex() {
    const { frames, fps, loop } = this.clip;
    if (frames.length === 0) return 0;
    // Repeated 50 ms application-clock steps can land just below an exact
    // frame boundary in binary floating point (for example 0.3999999999).
    const raw = Math.floor((this.elapsed + 1e-9) * fps);
    return loop ? raw % frames.length : Math.min(frames.length - 1, raw);
  }

  /** @returns {SpriteFrame} */
  getFrame() { return this.clip.frames[this.getFrameIndex()]; }

  isComplete() {
    const { frames, fps, loop } = this.clip;
    return !loop && this.elapsed + 1e-9 >= frames.length / fps;
  }

  snapshot() {
    return Object.freeze({ clip: this.clipName, frame: this.getFrameIndex(), elapsed: this.elapsed, complete: this.isComplete(), paused: this.paused });
  }
}

/**
 * Draws one atlas cell into a pivot-anchored destination rectangle.
 * @param {CanvasRenderingContext2D} context
 * @param {HTMLImageElement} image
 * @param {SpriteFrame} frame
 * @param {{anchorX:number,anchorY:number,width:number,height:number,pivot?:readonly [number,number],alpha?:number,filter?:string,scaleX?:number,scaleY?:number}} placement
 */
export function drawSpriteFrame(context, image, frame, placement) {
  const pivot = placement.pivot ?? [0.5, 1];
  const width = placement.width * (placement.scaleX ?? 1);
  const height = placement.height * (placement.scaleY ?? 1);
  const x = placement.anchorX - width * pivot[0];
  const y = placement.anchorY - height * pivot[1];
  context.save();
  context.globalAlpha *= placement.alpha ?? 1;
  context.filter = placement.filter ?? 'none';
  context.drawImage(image, frame.x, frame.y, frame.w, frame.h, x, y, width, height);
  context.restore();
}

/** @param {number} columns @param {number} count @param {number} width @param {number} height */
export function gridFrames(columns, count, width, height) {
  return Object.freeze(Array.from({ length: count }, (_, index) => Object.freeze({
    x: (index % columns) * width,
    y: Math.floor(index / columns) * height,
    w: width,
    h: height,
  })));
}
