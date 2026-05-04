'use client';

import { useState, useCallback } from 'react';
import UploadPanel from '@/components/UploadPanel';
import ParticleScene from '@/components/ParticleScene';
import ControlsPanel from '@/components/ControlsPanel';
import type { ParticleControls, ParticleShape } from '@/lib/types';

const DEFAULT_CONTROLS: ParticleControls = {
  density: 95,
  particleSize: 1.2,
  interactionStrength: 55,
  interactionRadius: 0.4,
  depth: 1.4,
  shape: 'circle',
};

export default function Home() {
  const [imageData, setImageData] = useState<string | null>(null);
  const [controls, setControls] = useState<ParticleControls>(DEFAULT_CONTROLS);
  const [resetKey, setResetKey] = useState(0);

  const handleImageUpload = useCallback((dataUrl: string) => {
    setImageData(dataUrl);
    setResetKey((k) => k + 1);
  }, []);

  const handleReset = useCallback(() => {
    setImageData(null);
  }, []);

  const handleViewReset = useCallback(() => {
    setResetKey((k) => k + 1);
  }, []);

  const handleShapeChange = useCallback((shape: ParticleShape) => {
    setControls((c) => ({ ...c, shape }));
  }, []);

  return (
    <main className="relative w-screen h-screen overflow-hidden bg-surface-900">
      {!imageData ? (
        <UploadPanel onUpload={handleImageUpload} />
      ) : (
        <>
          <ParticleScene
            key={resetKey}
            imageDataUrl={imageData}
            controls={controls}
            onShapeChange={handleShapeChange}
          />
          <ControlsPanel
            controls={controls}
            onChange={setControls}
            onNewImage={handleReset}
            onResetView={handleViewReset}
          />
        </>
      )}
    </main>
  );
}
