import type { ProcessedImage, SampledPixel } from './types';

// 300k particles — high-definition mode, smooth on modern GPUs
const MAX_PARTICLES = 300_000;
const ALPHA_THRESHOLD = 30;

/**
 * Loads a data-URL image, draws it to an offscreen canvas, and samples
 * pixels at a stride determined by the requested density.
 *
 * density (1–100) maps to stride via:
 *   stride = max(1, round(10 - density × 0.09))
 *   density=100 → stride 1   density=75 → stride 3   density=50 → stride 6
 *
 * At density=75 on a 1200px canvas an image yields ~80–100k sampled pixels,
 * which after transparency filtering and the MAX_PARTICLES cap lands around
 * 50–80k — enough for high-fidelity detail.
 */
export async function processImage(
  dataUrl: string,
  density: number,
): Promise<ProcessedImage> {
  const img = await loadImage(dataUrl);

  const canvas = document.createElement('canvas');
  // Higher res canvas = more pixels available for HD sampling at high density
  const maxDim = 1600;
  const scale = Math.min(1, maxDim / Math.max(img.width, img.height));
  canvas.width = Math.round(img.width * scale);
  canvas.height = Math.round(img.height * scale);

  const ctx = canvas.getContext('2d')!;
  ctx.drawImage(img, 0, 0, canvas.width, canvas.height);

  const { data, width, height } = ctx.getImageData(0, 0, canvas.width, canvas.height);
  const aspectRatio = width / height;

  // Stride formula: density=100→1, density=85→2, density=70→3, density=50→5, density=30→7
  // At density≥85 on 1200px canvas: raw samples ≥ 360k → capped to 150k after filtering.
  // At density=50: ~58k raw samples, typically 40-50k after alpha filtering.
  const rawStride = Math.max(1, Math.round(10 - density * 0.09));

  const estimatedCount = Math.floor(width / rawStride) * Math.floor(height / rawStride);
  const overrun = estimatedCount / MAX_PARTICLES;
  const stride = overrun > 1 ? Math.ceil(rawStride * Math.sqrt(overrun)) : rawStride;

  const pixels: SampledPixel[] = [];

  for (let py = 0; py < height; py += stride) {
    for (let px = 0; px < width; px += stride) {
      const idx = (py * width + px) * 4;
      const a = data[idx + 3];
      if (a < ALPHA_THRESHOLD) continue;

      const r = data[idx]     / 255;
      const g = data[idx + 1] / 255;
      const b = data[idx + 2] / 255;

      pixels.push({
        x: px / width - 0.5,
        y: -(py / height - 0.5), // flip y: canvas down → Three.js up
        r, g, b,
        lum: 0.299 * r + 0.587 * g + 0.114 * b,
      });
    }
  }

  return { pixels, aspectRatio };
}

function loadImage(src: string): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.onload = () => resolve(img);
    img.onerror = reject;
    img.src = src;
  });
}
