export type ParticleShape = 'circle' | 'square';

export interface ParticleControls {
  /** 1–100: how many pixels to sample (higher = more particles) */
  density: number;
  /** Base point size multiplier */
  particleSize: number;
  /** Repulsion force multiplier */
  interactionStrength: number;
  /** Radius of cursor influence in world units */
  interactionRadius: number;
  /** Max z-displacement for depth effect */
  depth: number;
  /** Render as smooth circles or Minecraft-style pixel blocks */
  shape: ParticleShape;
}

export interface SampledPixel {
  /** Normalised x in [-0.5, 0.5] relative to image centre */
  x: number;
  /** Normalised y in [-0.5, 0.5] relative to image centre */
  y: number;
  r: number;
  g: number;
  b: number;
  /** Pre-computed luminance (0.299r + 0.587g + 0.114b) used to drive z-depth */
  lum: number;
}

export interface ProcessedImage {
  pixels: SampledPixel[];
  aspectRatio: number;
}

export interface MouseWorldRef {
  x: number;
  y: number;
  active: boolean;
}
