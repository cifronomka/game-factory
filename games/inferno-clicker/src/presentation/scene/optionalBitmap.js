// @ts-check

/** @returns {HTMLImageElement|null} */
function browserImageFactory() {
  if (typeof globalThis.Image !== 'function') return null;
  return new globalThis.Image();
}

/**
 * Non-blocking bitmap source. Missing browser Image support, decode failures and
 * network errors all leave procedural rendering available without throwing.
 */
export class OptionalBitmap {
  /** @param {string} url @param {{imageFactory?:(()=>HTMLImageElement|null),autoLoad?:boolean}=} options */
  constructor(url, options = {}) {
    this.url = url;
    this.imageFactory = options.imageFactory ?? browserImageFactory;
    this.attempts = 0;
    this.generation = 0;
    /** @type {'idle'|'loading'|'ready'|'failed'|'unavailable'} */
    this.status = options.autoLoad === false ? 'idle' : 'unavailable';
    /** @type {HTMLImageElement|null} */
    this.image = null;
    /** @type {Promise<'ready'|'failed'|'unavailable'>} */
    this.settled = Promise.resolve('unavailable');
    if (options.autoLoad !== false) this.startLoad();
  }

  startLoad() {
    if (this.status === 'loading' || this.status === 'ready') return this.settled;
    let image = null;
    try { image = this.imageFactory(); } catch { this.status = 'unavailable'; return this.settled; }
    if (!image) { this.status = 'unavailable'; return this.settled; }
    this.attempts += 1;
    const generation = ++this.generation;
    this.image = image;
    this.status = 'loading';
    this.settled = new Promise((resolve) => {
      image.addEventListener('load', () => {
        if (generation === this.generation) this.status = 'ready';
        resolve(generation === this.generation ? 'ready' : 'unavailable');
      }, { once: true });
      image.addEventListener('error', () => {
        if (generation === this.generation) this.status = 'failed';
        resolve(generation === this.generation ? 'failed' : 'unavailable');
      }, { once: true });
    });
    image.decoding = 'async';
    image.src = this.url;
    if (image.complete && image.naturalWidth > 0) this.status = 'ready';
    return this.settled;
  }

  async whenSettled(timeoutMs = 3_000) {
    if (this.status !== 'loading') return this.status;
    let timer;
    const timeout = new Promise((resolve) => { timer = setTimeout(() => resolve('failed'), timeoutMs); });
    const status = await Promise.race([this.settled, timeout]);
    clearTimeout(timer);
    return status;
  }

  async retry(timeoutMs = 3_000) {
    if (this.status === 'ready') return true;
    if (this.attempts >= 2) return false;
    this.startLoad();
    return (await this.whenSettled(timeoutMs)) === 'ready';
  }

  /** Release a non-critical decoded image so another clip can use the texture budget. */
  release() {
    this.generation += 1;
    if (this.image) this.image.src = '';
    this.image = null;
    this.status = 'idle';
    this.attempts = 0;
    this.settled = Promise.resolve('unavailable');
  }

  isReady() { return this.status === 'ready' && Boolean(this.image?.naturalWidth && this.image?.naturalHeight); }

  /** Cover/crop source into the destination rectangle. */
  /** @param {CanvasRenderingContext2D} context @param {number} x @param {number} y @param {number} width @param {number} height */
  drawCover(context, x, y, width, height) {
    const image = this.image;
    if (!image || !this.isReady()) return false;
    const sourceWidth = image.naturalWidth;
    const sourceHeight = image.naturalHeight;
    const scale = Math.max(width / sourceWidth, height / sourceHeight);
    const cropWidth = width / scale;
    const cropHeight = height / scale;
    const sourceX = (sourceWidth - cropWidth) / 2;
    const sourceY = (sourceHeight - cropHeight) / 2;
    context.drawImage(image, sourceX, sourceY, cropWidth, cropHeight, x, y, width, height);
    return true;
  }

  /** Contain source in the destination rectangle, preserving transparent edges. */
  /** @param {CanvasRenderingContext2D} context @param {number} x @param {number} y @param {number} width @param {number} height */
  drawContain(context, x, y, width, height) {
    const image = this.image;
    if (!image || !this.isReady()) return false;
    const scale = Math.min(width / image.naturalWidth, height / image.naturalHeight);
    const drawWidth = image.naturalWidth * scale;
    const drawHeight = image.naturalHeight * scale;
    context.drawImage(image, x + (width - drawWidth) / 2, y + height - drawHeight, drawWidth, drawHeight);
    return true;
  }
}
