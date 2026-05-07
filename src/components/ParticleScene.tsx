'use client';

import { useRef, useState, useEffect, Suspense } from 'react';
import { Canvas, useFrame, useThree } from '@react-three/fiber';
import { OrbitControls } from '@react-three/drei';
import * as THREE from 'three';
import ParticleImage from './ParticleImage';
import { processImage } from '@/lib/imageProcessing';
import type { MouseWorldRef, ParticleControls, ProcessedImage } from '@/lib/types';

interface Props {
  imageDataUrl: string;
  controls: ParticleControls;
  onShapeChange: (s: import('@/lib/types').ParticleShape) => void;
}

// ─── ParticleGroup ─────────────────────────────────────────────────────────────
// Wraps the particle image in a group whose rotation follows the cursor,
// giving a parallax tilt without touching the camera that OrbitControls owns.
function ParticleGroup({
  image,
  controls,
  mouseWorld,
}: {
  image: ProcessedImage;
  controls: ParticleControls;
  mouseWorld: React.MutableRefObject<MouseWorldRef>;
}) {
  const groupRef = useRef<THREE.Group>(null);
  const smoothX = useRef(0);
  const smoothY = useRef(0);

  useFrame(() => {
    const targetX = mouseWorld.current.active ? (mouseWorld.current.x / 5) * 0.06 : 0;
    const targetY = mouseWorld.current.active ? (mouseWorld.current.y / 5) * 0.06 : 0;
    smoothX.current += (targetX - smoothX.current) * 0.04;
    smoothY.current += (targetY - smoothY.current) * 0.04;
    if (groupRef.current) {
      groupRef.current.rotation.y = smoothX.current;
      groupRef.current.rotation.x = -smoothY.current;
    }
  });

  return (
    <group ref={groupRef}>
      <ParticleImage image={image} controls={controls} mouseWorld={mouseWorld} />
    </group>
  );
}

// ─── SceneContent ──────────────────────────────────────────────────────────────
function SceneContent({
  image,
  controls,
  mouseWorld,
}: {
  image: ProcessedImage;
  controls: ParticleControls;
  mouseWorld: React.MutableRefObject<MouseWorldRef>;
}) {
  return (
    <>
      {/* Invisible full-canvas plane — R3F raycasts against it so e.point is
          in world space with no manual NDC projection. */}
      <mesh
        visible={false}
        onPointerMove={(e) => {
          mouseWorld.current.x = e.point.x;
          mouseWorld.current.y = e.point.y;
        }}
        onPointerEnter={() => { mouseWorld.current.active = true; }}
        onPointerLeave={() => { mouseWorld.current.active = false; }}
      >
        <planeGeometry args={[100, 100]} />
        <meshBasicMaterial side={THREE.DoubleSide} />
      </mesh>

      <ParticleGroup image={image} controls={controls} mouseWorld={mouseWorld} />

      <OrbitControls
        enablePan={false}
        enableZoom={true}
        zoomSpeed={0.6}
        minDistance={2}
        maxDistance={20}
        enableRotate={true}
        rotateSpeed={0.5}
        dampingFactor={0.07}
        enableDamping
      />
    </>
  );
}

// ─── ParticleScene ─────────────────────────────────────────────────────────────
export default function ParticleScene({ imageDataUrl, controls, onShapeChange }: Props) {
  const [image,           setImage]           = useState<ProcessedImage | null>(null);
  const [loading,         setLoading]         = useState(true);
  const [activeDensity,   setActiveDensity]   = useState(controls.density);
  const mouseWorld = useRef<MouseWorldRef>({ x: 0, y: 0, active: false });

  // Debounce density: wait 500 ms after the slider stops moving before re-sampling.
  // This avoids thrashing processImage on every tick while still reacting instantly.
  useEffect(() => {
    const t = setTimeout(() => setActiveDensity(controls.density), 500);
    return () => clearTimeout(t);
  }, [controls.density]);

  // Re-process whenever the image URL OR the settled density changes.
  useEffect(() => {
    setLoading(true);
    setImage(null);
    processImage(imageDataUrl, activeDensity).then((img) => {
      setImage(img);
      setLoading(false);
    });
  }, [imageDataUrl, activeDensity]);

  return (
    <div className="w-full h-full relative">
      {loading && (
        <div className="absolute inset-0 z-10 flex items-center justify-center bg-surface-900">
          <div className="flex flex-col items-center gap-4">
            <div className="w-8 h-8 rounded-full border-2 border-accent border-t-transparent animate-spin" />
            <p className="text-xs text-white/30 font-mono">Sampling pixels…</p>
          </div>
        </div>
      )}

      <Canvas
        className="w-full h-full"
        camera={{ position: [0, 0, 6], fov: 55, near: 0.1, far: 100 }}
        gl={{
          antialias: true,
          alpha: false,
          powerPreference: 'high-performance',
        }}
        dpr={typeof window !== 'undefined' ? Math.min(window.devicePixelRatio, 2) : 1}
        style={{ background: '#050507' }}
      >
        {image && (
          <Suspense fallback={null}>
            <SceneContent
              image={image}
              controls={controls}
              mouseWorld={mouseWorld}
            />
          </Suspense>
        )}
      </Canvas>

      {/* Shape toggle pill — top centre */}
      {image && !loading && (
        <div className="absolute top-5 left-1/2 -translate-x-1/2 z-30 flex gap-0.5 p-1 rounded-xl bg-surface-800/90 backdrop-blur border border-surface-600 shadow-lg select-none">
          {(['circle', 'square'] as const).map((s) => (
            <button
              key={s}
              onClick={() => onShapeChange(s)}
              className={[
                'flex items-center gap-1.5 px-4 py-2 sm:px-3 sm:py-1.5 rounded-lg text-[12px] sm:text-[11px] font-mono transition-all',
                controls.shape === s
                  ? 'bg-accent text-white shadow'
                  : 'text-white/40 hover:text-white/70',
              ].join(' ')}
            >
              {s === 'circle' ? (
                <svg viewBox="0 0 12 12" className="w-3 h-3" fill="currentColor">
                  <circle cx="6" cy="6" r="4.5" />
                </svg>
              ) : (
                <svg viewBox="0 0 12 12" className="w-3 h-3" fill="currentColor">
                  <rect x="1.5" y="1.5" width="9" height="9" rx="1" />
                </svg>
              )}
              {s === 'circle' ? 'Circle' : 'Block'}
            </button>
          ))}
        </div>
      )}

      {/* Particle count badge */}
      {image && !loading && (
        <div className="absolute top-5 right-6 font-mono text-[11px] text-white/20 select-none pointer-events-none">
          {image.pixels.length.toLocaleString()} particles
        </div>
      )}
    </div>
  );
}
