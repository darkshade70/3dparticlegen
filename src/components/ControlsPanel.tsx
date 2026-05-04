'use client';

import { useState } from 'react';
import type { ParticleControls } from '@/lib/types';

type NumericKey = Exclude<keyof ParticleControls, 'shape'>;

interface Props {
  controls: ParticleControls;
  onChange: (c: ParticleControls) => void;
  onNewImage: () => void;
  onResetView: () => void;
}

interface SliderDef {
  key: NumericKey;
  label: string;
  hint: string;
  min: number;
  max: number;
  step: number;
  format: (v: number) => string;
}

/** Estimate particle count from density, matching imageProcessing.ts stride formula. */
function estimateCount(density: number): string {
  const stride = Math.max(1, Math.round(10 - density * 0.09));
  const raw = Math.floor(1200 / stride) ** 2;
  const capped = Math.min(150_000, raw);
  return capped >= 1000 ? `~${Math.round(capped / 1000)}k` : String(capped);
}

// ── Two groups of sliders ─────────────────────────────────────────────────────

const PARTICLE_SLIDERS: SliderDef[] = [
  {
    key: 'density',
    label: 'Detail / count',
    hint: 'How many particles are sampled. Auto-reprocesses 0.5 s after you stop.',
    min: 5, max: 100, step: 1,
    format: (v) => estimateCount(v),
  },
  {
    key: 'particleSize',
    label: 'Particle size',
    hint: '1.0 = auto-fit to density. >1 = chunkier, <1 = fine gaps.',
    min: 0.3, max: 8, step: 0.1,
    format: (v) => v.toFixed(1),
  },
];

const INTERACTION_SLIDERS: SliderDef[] = [
  {
    key: 'interactionStrength',
    label: 'Repulsion force',
    hint: 'How hard the cursor blasts particles away.',
    min: 1, max: 100, step: 1,
    format: (v) => v.toFixed(0),
  },
  {
    key: 'interactionRadius',
    label: 'Repulsion radius',
    hint: 'How wide the cursor influence reaches.',
    min: 0.1, max: 3.5, step: 0.05,
    format: (v) => v.toFixed(2),
  },
  {
    key: 'depth',
    label: 'Depth (Z)',
    hint: 'Bright pixels pop forward; dark pixels recede back.',
    min: 0, max: 5, step: 0.05,
    format: (v) => v.toFixed(2),
  },
];

export default function ControlsPanel({ controls, onChange, onNewImage, onResetView }: Props) {
  const [open,       setOpen]       = useState(true);
  const [activeHint, setActiveHint] = useState<string | null>(null);

  const set = (key: NumericKey, value: number) =>
    onChange({ ...controls, [key]: value });

  const renderSlider = ({ key, label, hint, min, max, step, format }: SliderDef) => (
    <div key={key} className="py-2 border-b border-surface-700/40 last:border-0">
      <div className="flex justify-between items-center mb-1.5">
        <div className="flex items-center gap-1">
          <span className="text-white/60 text-[11px]">{label}</span>
          <button
            onMouseEnter={() => setActiveHint(key)}
            onMouseLeave={() => setActiveHint(null)}
            onFocus={() => setActiveHint(key)}
            onBlur={() => setActiveHint(null)}
            className="w-3.5 h-3.5 rounded-full bg-surface-600 text-white/30 hover:text-white/60 flex items-center justify-center text-[9px] leading-none transition-colors"
            aria-label={hint}
          >?</button>
        </div>
        <span className="text-white/80 text-[11px] tabular-nums">{format(controls[key])}</span>
      </div>
      {activeHint === key && (
        <p className="text-[10px] text-accent-glow/80 mb-1.5 leading-snug">{hint}</p>
      )}
      <input
        type="range" min={min} max={max} step={step}
        value={controls[key]}
        onChange={(e) => set(key, parseFloat(e.target.value))}
        className="w-full"
      />
    </div>
  );

  return (
    <div className="absolute bottom-6 left-6 z-20 select-none" style={{ fontFamily: 'var(--font-mono, monospace)' }}>

      <button
        onClick={() => setOpen((o) => !o)}
        className="mb-2 flex items-center gap-2 px-3 py-1.5 rounded-lg bg-surface-800/90 backdrop-blur border border-surface-600 text-white/40 hover:text-white/70 hover:border-surface-500 transition-all text-[10px] uppercase tracking-widest"
      >
        Controls
        <svg className={`w-3 h-3 transition-transform ${open ? 'rotate-180' : ''}`}
          viewBox="0 0 12 12" fill="none" stroke="currentColor" strokeWidth="1.5">
          <path d="M2 4l4 4 4-4" />
        </svg>
      </button>

      {open && (
        <div className="flex flex-col p-3 rounded-xl bg-surface-800/90 backdrop-blur-md border border-surface-600 w-[250px] shadow-[0_8px_32px_rgba(0,0,0,0.6)]">

          {/* ── Particle appearance group ── */}
          <p className="text-[9px] uppercase tracking-widest text-white/20 mb-1 px-1">Particles</p>
          <div className="px-1">
            {PARTICLE_SLIDERS.map(renderSlider)}
          </div>

          {/* ── Interaction group ── */}
          <p className="text-[9px] uppercase tracking-widest text-white/20 mt-3 mb-1 px-1">Cursor interaction</p>
          <div className="px-1">
            {INTERACTION_SLIDERS.map(renderSlider)}
          </div>

          {/* Zoom hint */}
          <p className="text-[9px] text-white/20 text-center mt-2 px-1 leading-snug">
            Scroll to zoom · drag to rotate
          </p>

          <div className="flex gap-2 mt-3">
            <button
              onClick={onResetView}
              className="flex-1 py-1.5 rounded-lg bg-surface-700 text-white/50 hover:text-white/80 hover:bg-surface-600 transition-all text-[11px] border border-surface-600"
            >
              Reset view
            </button>
            <button
              onClick={onNewImage}
              className="flex-1 py-1.5 rounded-lg bg-accent/20 text-accent-glow hover:bg-accent/30 transition-all text-[11px] border border-accent/30"
            >
              New image
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
