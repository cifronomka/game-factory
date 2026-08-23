import sharp from 'sharp';

export const RUNTIME_VISUAL_FINGERPRINT_ALGORITHM = 'stage-dhash-horizontal-16x16-lanczos3-grayscale-v1';
export const RUNTIME_VISUAL_FINGERPRINT_STAGES = 7;

function bitsToHex(bits) {
  let output = '';
  for (let index = 0; index < bits.length; index += 4) {
    let value = 0;
    for (let offset = 0; offset < 4; offset += 1) value = (value << 1) | bits[index + offset];
    output += value.toString(16);
  }
  return output;
}

async function stageDhash(input) {
  const width = 16;
  const height = 16;
  const pixels = await sharp(input, { failOn: 'error' })
    .removeAlpha()
    .resize(width + 1, height, { fit: 'fill', kernel: 'lanczos3' })
    .greyscale()
    .raw()
    .toBuffer();
  const bits = [];
  for (let y = 0; y < height; y += 1) {
    for (let x = 0; x < width; x += 1) {
      const offset = y * (width + 1) + x;
      bits.push(pixels[offset] > pixels[offset + 1] ? 1 : 0);
    }
  }
  return bitsToHex(bits);
}

export async function runtimeSheetPerceptualHashes(bytes, dpr) {
  if (![1, 2, 3].includes(dpr)) throw new Error(`Unsupported runtime visual DPR: ${dpr}`);
  const metadata = await sharp(bytes, { failOn: 'error' }).metadata();
  if (!Number.isInteger(metadata.width) || !Number.isInteger(metadata.height)
    || metadata.width % RUNTIME_VISUAL_FINGERPRINT_STAGES !== 0) {
    throw new Error('Runtime visual sheet has invalid dimensions for seven-stage fingerprinting.');
  }
  const stageWidth = metadata.width / RUNTIME_VISUAL_FINGERPRINT_STAGES;
  const labelHeight = 28 * dpr;
  const stageHeight = metadata.height - labelHeight;
  if (stageHeight <= 0) throw new Error('Runtime visual sheet is shorter than its review label.');
  const hashes = [];
  for (let stage = 0; stage < RUNTIME_VISUAL_FINGERPRINT_STAGES; stage += 1) {
    const stageBytes = await sharp(bytes, { failOn: 'error' })
      .extract({ left: stage * stageWidth, top: labelHeight, width: stageWidth, height: stageHeight })
      .png()
      .toBuffer();
    hashes.push(await stageDhash(stageBytes));
  }
  return hashes;
}
