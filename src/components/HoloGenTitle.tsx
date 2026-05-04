'use client';

import { useRef, useEffect, useState } from 'react';
import { Canvas, useFrame, useThree } from '@react-three/fiber';
import * as THREE from 'three';

// ─── Constants ────────────────────────────────────────────────────────────────
const SPRING   = 0.04;
const DAMPING  = 0.88;
const CANVAS_W = 900;
const CANVAS_H = 180;
const STEP     = 3;
const SCALE_X  = 5.5;
const SCALE_Y  = 5.5 * (CANVAS_H / CANVAS_W); // ≈ 1.1

const REPULSION_RADIUS = 1.2;
const REPULSION_FORCE  = 0.15;

// ─── Shaders ──────────────────────────────────────────────────────────────────
const vertexShader = /* glsl */`
  attribute vec3 aColor;
  uniform float uSize;
  varying vec3 vColor;

  void main() {
    vColor = aColor;
    vec4 mvPos = modelViewMatrix * vec4(position, 1.0);
    gl_PointSize = uSize * 180.0 / -mvPos.z;
    gl_Position = projectionMatrix * mvPos;
  }
`;

const fragmentShader = /* glsl */`
  varying vec3 vColor;

  void main() {
    vec2 uv = gl_PointCoord * 2.0 - 1.0;
    float r2 = dot(uv, uv);
    if (r2 > 1.0) discard;

    float core = 1.0 - smoothstep(0.2, 1.0, r2);
    float glow = exp(-r2 * 5.0) * 0.8;
    gl_FragColor = vec4(vColor * (1.0 + glow * 0.3), (core + glow) * 0.85);
  }
`;

// ─── Particle positions sampled from offscreen canvas ─────────────────────────
function sampleText(): { positions: Float32Array; colors: Float32Array; count: number } {
  const offscreen = document.createElement('canvas');
  offscreen.width  = CANVAS_W;
  offscreen.height = CANVAS_H;
  const ctx = offscreen.getContext('2d')!;

  ctx.fillStyle = '#000000';
  ctx.fillRect(0, 0, CANVAS_W, CANVAS_H);
  ctx.fillStyle = '#ffffff';
  ctx.font = 'bold 110px Inter, system-ui, sans-serif';
  ctx.textBaseline = 'middle';
  ctx.textAlign = 'center';
  ctx.fillText('HoloGen', CANVAS_W / 2, CANVAS_H / 2);

  const imageData = ctx.getImageData(0, 0, CANVAS_W, CANVAS_H);
  const data = imageData.data;

  const posArr: number[] = [];
  const colArr: number[] = [];

  for (let y = 0; y < CANVAS_H; y += STEP) {
    for (let x = 0; x < CANVAS_W; x += STEP) {
      const idx = (y * CANVAS_W + x) * 4;
      const brightness = (data[idx] + data[idx + 1] + data[idx + 2]) / 3;
      if (brightness > 100) {
        // Map pixel coords to world space
        const wx = ((x / CANVAS_W) - 0.5) * SCALE_X;
        const wy = (0.5 - (y / CANVAS_H)) * SCALE_Y;
        posArr.push(wx, wy, 0);

        const rand = Math.random();
        colArr.push(
          0.5 + rand * 0.3,
          0.4 + rand * 0.3,
          1.0,
        );
      }
    }
  }

  const count = posArr.length / 3;
  return {
    positions: new Float32Array(posArr),
    colors:    new Float32Array(colArr),
    count,
  };
}

// ─── Inner scene (must be inside <Canvas>) ───────────────────────────────────
function HoloParticles({ positions, colors, count }: {
  positions: Float32Array;
  colors:    Float32Array;
  count:     number;
}) {
  const meshRef    = useRef<THREE.Points>(null);
  const materialRef = useRef<THREE.ShaderMaterial>(null);

  // Physics state stored as refs (mutated every frame, no re-render needed)
  const originalPos = useRef<Float32Array>(new Float32Array(positions));
  const currentPos  = useRef<Float32Array>(new Float32Array(positions));
  const velocity    = useRef<Float32Array>(new Float32Array(count * 3));

  // Mouse world position from invisible plane raycast
  const mouse = useRef({ x: 0, y: 0, active: false });

  // Keep geometry ref so we can update it each frame
  const geoRef = useRef<THREE.BufferGeometry>(null);

  useFrame(() => {
    const cur  = currentPos.current;
    const orig = originalPos.current;
    const vel  = velocity.current;
    const mx   = mouse.current.x;
    const my   = mouse.current.y;

    for (let i = 0; i < count; i++) {
      const i3 = i * 3;
      const px = cur[i3];
      const py = cur[i3 + 1];

      // Repulsion from cursor
      if (mouse.current.active) {
        const dx   = px - mx;
        const dy   = py - my;
        const dist = Math.sqrt(dx * dx + dy * dy);
        if (dist < REPULSION_RADIUS && dist > 0) {
          const t     = 1 - dist / REPULSION_RADIUS;
          const force = t * t * REPULSION_FORCE;
          vel[i3]     += (dx / dist) * force;
          vel[i3 + 1] += (dy / dist) * force;
          vel[i3 + 2] += force * 0.3;
        }
      }

      // Spring back to original position
      vel[i3]     += (orig[i3]     - cur[i3])     * SPRING;
      vel[i3 + 1] += (orig[i3 + 1] - cur[i3 + 1]) * SPRING;
      vel[i3 + 2] += (orig[i3 + 2] - cur[i3 + 2]) * SPRING;

      // Damping
      vel[i3]     *= DAMPING;
      vel[i3 + 1] *= DAMPING;
      vel[i3 + 2] *= DAMPING;

      // Integrate
      cur[i3]     += vel[i3];
      cur[i3 + 1] += vel[i3 + 1];
      cur[i3 + 2] += vel[i3 + 2];
    }

    // Push updated positions to GPU
    if (geoRef.current) {
      const posAttr = geoRef.current.getAttribute('position') as THREE.BufferAttribute;
      posAttr.array = cur;
      posAttr.needsUpdate = true;
    }
  });

  return (
    <>
      {/* Invisible hit-plane for raycasting */}
      <mesh
        visible={false}
        onPointerMove={(e) => {
          mouse.current.x = e.point.x;
          mouse.current.y = e.point.y;
        }}
        onPointerEnter={() => { mouse.current.active = true; }}
        onPointerLeave={() => { mouse.current.active = false; }}
      >
        <planeGeometry args={[100, 100]} />
        <meshBasicMaterial side={THREE.DoubleSide} />
      </mesh>

      {/* Particles */}
      <points ref={meshRef}>
        <bufferGeometry ref={geoRef}>
          <bufferAttribute
            attach="attributes-position"
            array={currentPos.current}
            count={count}
            itemSize={3}
          />
          <bufferAttribute
            attach="attributes-aColor"
            array={colors}
            count={count}
            itemSize={3}
          />
        </bufferGeometry>
        <shaderMaterial
          ref={materialRef}
          vertexShader={vertexShader}
          fragmentShader={fragmentShader}
          uniforms={{ uSize: { value: 1.8 } }}
          blending={THREE.AdditiveBlending}
          depthWrite={false}
          transparent
        />
      </points>
    </>
  );
}

// ─── Public component ─────────────────────────────────────────────────────────
export default function HoloGenTitle() {
  const [particleData, setParticleData] = useState<{
    positions: Float32Array;
    colors:    Float32Array;
    count:     number;
  } | null>(null);

  useEffect(() => {
    // Wait for fonts so Inter is available when we paint to the offscreen canvas
    document.fonts.ready.then(() => {
      setParticleData(sampleText());
    });
  }, []);

  if (!particleData) return <div style={{ width: '100%', height: 160 }} />;

  return (
    <Canvas
      camera={{ position: [0, 0, 3.5], fov: 45, near: 0.01, far: 100 }}
      gl={{
        antialias:        true,
        alpha:            true,
        powerPreference:  'high-performance',
      }}
      dpr={typeof window !== 'undefined' ? Math.min(window.devicePixelRatio, 2) : 1}
      style={{ width: '100%', height: 160, background: 'transparent' }}
    >
      <HoloParticles
        positions={particleData.positions}
        colors={particleData.colors}
        count={particleData.count}
      />
    </Canvas>
  );
}
