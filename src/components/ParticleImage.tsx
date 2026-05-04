'use client';

import { useRef, useMemo, useEffect } from 'react';
import { useFrame, useThree } from '@react-three/fiber';
import * as THREE from 'three';
import type { MouseWorldRef, ParticleControls, ProcessedImage } from '@/lib/types';

// ─── Vertex Shader ────────────────────────────────────────────────────────────
// AUTO-SIZE: uAutoScale is computed from the actual particle count so that
// as density decreases (fewer, more-spaced particles) the world-size of each
// particle scales up to fill its grid cell — the image always looks solid.
//   uBaseSize=1.0  → particles exactly fill their grid cell (slight overlap)
//   uBaseSize>1.0  → chunkier look (good for block mode)
//   uBaseSize<1.0  → visible gaps between particles
//
// SHAPE: uShape 0=circle, 1=square.  Squares use uniform aSize=1 so the
// block grid stays perfectly even.
const VERT = /* glsl */ `
  attribute vec3  aColor;
  attribute float aSize;

  varying vec3  vColor;
  varying float vCamDist;

  uniform float uBaseSize;
  uniform float uPixelRatio;
  uniform float uAutoScale;  // derived from particle count — auto-fills grid
  uniform float uShape;      // 0 = circle, 1 = square/block

  const float BASE_WORLD = 0.038;

  void main() {
    vColor   = aColor;
    vec4 mvPos = modelViewMatrix * vec4(position, 1.0);
    vCamDist   = -mvPos.z;

    // Blocks use a uniform size so the pixel grid is even;
    // circles use per-particle variation for an organic feel.
    float effectiveSize = mix(aSize, 1.0, uShape);

    float worldSize  = uBaseSize * effectiveSize * BASE_WORLD * uAutoScale;
    float screenSize = worldSize * uPixelRatio / max(vCamDist, 0.1);

    gl_PointSize = clamp(screenSize, 0.5, 32.0);
    gl_Position  = projectionMatrix * mvPos;
  }
`;

// ─── Fragment Shader ──────────────────────────────────────────────────────────
// Circle mode: tight crisp disc + subtle inner glow, additive blending.
// Block mode:  solid square with top-left directional lighting (Minecraft face)
//              and a thin dark border so adjacent blocks read as a pixel grid.
const FRAG = /* glsl */ `
  varying vec3  vColor;
  varying float vCamDist;

  uniform float uShape;

  void main() {
    float fade = clamp(1.0 - (vCamDist - 4.0) / 16.0, 0.15, 1.0);

    if (uShape > 0.5) {
      // ── Block / Minecraft mode ──────────────────────────────────────────────
      vec2  pc = gl_PointCoord; // [0,1] x [0,1]

      // Thin border — creates visible grid lines between adjacent blocks
      float border = 0.10;
      float bx = min(pc.x, 1.0 - pc.x);
      float by = min(pc.y, 1.0 - pc.y);
      if (bx < border || by < border) discard; // crisp gap, no soft fade

      // Minecraft-style face shading: top-left corner is lightest
      float lightY = 1.08 - pc.y * 0.22;  // top brighter, bottom darker
      float lightX = 1.03 - pc.x * 0.06;  // left very slightly brighter
      vec3 col = clamp(vColor * lightY * lightX, 0.0, 1.0);

      gl_FragColor = vec4(col, fade);

    } else {
      // ── Circle mode ─────────────────────────────────────────────────────────
      vec2  uv = gl_PointCoord * 2.0 - 1.0;
      float r2 = dot(uv, uv);
      if (r2 > 1.0) discard;

      // Softer disc edge = more of the circle is solid = visibly brighter
      float core = 1.0 - smoothstep(0.25, 1.0, r2);
      float glow = exp(-r2 * 6.0) * 0.8;

      // Bright-image fix: reduce alpha for near-white particles to prevent bloom.
      // 0.20 (not 0.12) keeps colours vivid while still preventing white wash.
      float lum        = dot(vColor, vec3(0.299, 0.587, 0.114));
      float alphaScale = mix(1.0, 0.15, lum);

      // Reduced glow colour boost (0.2 vs 0.5) so the hot-spot brightens
      // without pushing colours toward white
      gl_FragColor = vec4(
        vColor * (1.0 + glow * 0.2),
        (core + glow) * fade * alphaScale
      );
    }
  }
`;

// ─── Physics constants ────────────────────────────────────────────────────────
const SPRING   = 0.022;  // halved — particles drift home slowly and gracefully
const DAMPING  = 0.920;  // higher — velocity decays slower, floaty re-assembly
const IDLE_AMP = 0.0045;
const IDLE_SPD = 0.00035;
const SCENE_SCALE = 5;

interface Props {
  image: ProcessedImage;
  controls: ParticleControls;
  mouseWorld: React.MutableRefObject<MouseWorldRef>;
}

export default function ParticleImage({ image, controls, mouseWorld }: Props) {
  const { pixels, aspectRatio } = image;
  const count = pixels.length;
  const { size } = useThree();
  const isBlock = controls.shape === 'square';

  // ── Auto-size: keep the image fully covered at any density.
  // FILL_FACTOR=3 means each particle is 3× its grid cell — enough overlap for
  // additive blending to produce vivid colour while still scaling up at low density.
  // At 100k particles this produces the same world-size as the original BASE_WORLD=0.038
  // at size=1.5 (the "very cool" reference), and at 10k it's 3× bigger automatically.
  const autoScale = useMemo(() => {
    const BASE_WORLD  = 0.038;
    const FILL_FACTOR = 3.0;
    const gridStep    = SCENE_SCALE / Math.sqrt(count);
    return (gridStep * FILL_FACTOR) / BASE_WORLD;
  }, [count]);

  // ── Original particle positions ───────────────────────────────────────────
  const originalPos = useMemo(() => {
    const arr    = new Float32Array(count * 3);
    const scaleX = SCENE_SCALE;
    const scaleY = SCENE_SCALE / aspectRatio;
    pixels.forEach((p, i) => {
      arr[i * 3]     = p.x * scaleX;
      arr[i * 3 + 1] = p.y * scaleY;
      arr[i * 3 + 2] = p.lum - 0.5; // luminance-based z depth (scaled at runtime)
    });
    return arr;
  }, [pixels, aspectRatio]);

  // Scatter sphere for load-in animation
  const currentPos = useMemo(() => {
    const arr = new Float32Array(count * 3);
    for (let i = 0; i < count; i++) {
      const theta = Math.random() * Math.PI * 2;
      const phi   = Math.acos(2 * Math.random() - 1);
      const r     = 4 + Math.random() * 6;
      arr[i * 3]     = Math.sin(phi) * Math.cos(theta) * r;
      arr[i * 3 + 1] = Math.sin(phi) * Math.sin(theta) * r;
      arr[i * 3 + 2] = Math.cos(phi) * r;
    }
    return arr;
  }, [count]);

  const velocity   = useMemo(() => new Float32Array(count * 3), [count]);
  const noisePhase = useMemo(() => {
    const arr = new Float32Array(count);
    for (let i = 0; i < count; i++) arr[i] = Math.random() * Math.PI * 2;
    return arr;
  }, [count]);
  const zDir = useMemo(() => {
    const arr = new Float32Array(count);
    for (let i = 0; i < count; i++) arr[i] = Math.random() * 2 - 1;
    return arr;
  }, [count]);

  // ── GPU attributes ────────────────────────────────────────────────────────
  const colors = useMemo(() => {
    const arr = new Float32Array(count * 3);
    pixels.forEach((p, i) => {
      // Use raw sampled colours — no artificial boost that shifts colour accuracy
      arr[i * 3]     = p.r;
      arr[i * 3 + 1] = p.g;
      arr[i * 3 + 2] = p.b;
    });
    return arr;
  }, [pixels]);

  const sizes = useMemo(() => {
    const arr = new Float32Array(count);
    for (let i = 0; i < count; i++) arr[i] = 0.75 + Math.random() * 0.5;
    return arr;
  }, [count]);

  // ── Three.js refs ─────────────────────────────────────────────────────────
  const geoRef  = useRef<THREE.BufferGeometry>(null);
  const matRef  = useRef<THREE.ShaderMaterial>(null);
  const posAttr = useRef<THREE.BufferAttribute | null>(null);

  useEffect(() => {
    const geo = geoRef.current;
    if (!geo) return;
    const pa = new THREE.BufferAttribute(currentPos, 3);
    pa.setUsage(THREE.DynamicDrawUsage);
    geo.setAttribute('position', pa);
    geo.setAttribute('aColor', new THREE.BufferAttribute(colors, 3));
    geo.setAttribute('aSize',  new THREE.BufferAttribute(sizes, 1));
    posAttr.current = pa;
    return () => { geo.dispose(); };
  }, [currentPos, colors, sizes]);

  // ── Physics loop ──────────────────────────────────────────────────────────
  useFrame(({ clock }) => {
    const pa = posAttr.current;
    if (!pa) return;

    const t        = clock.getElapsedTime();
    const { x: mx, y: my, active } = mouseWorld.current;
    const radius   = controls.interactionRadius;
    const strength = controls.interactionStrength * 0.01;
    const depthScale = controls.depth * 2.0;

    for (let i = 0; i < count; i++) {
      const i3 = i * 3;
      const cx = currentPos[i3],     cy = currentPos[i3 + 1], cz = currentPos[i3 + 2];
      const ox = originalPos[i3],    oy = originalPos[i3 + 1];
      const oz = originalPos[i3 + 2] * depthScale;

      // Spring toward home
      velocity[i3]     += (ox - cx) * SPRING;
      velocity[i3 + 1] += (oy - cy) * SPRING;
      velocity[i3 + 2] += (oz - cz) * SPRING;

      // Cursor repulsion
      if (active) {
        const dx   = cx - mx;
        const dy   = cy - my;
        const dist = Math.sqrt(dx * dx + dy * dy);
        if (dist < radius && dist > 0.001) {
          const t01  = 1 - dist / radius;
          const force = t01 * t01 * strength;
          const inv   = 1 / dist;
          velocity[i3]     += (dx * inv) * force;
          velocity[i3 + 1] += (dy * inv) * force;
          velocity[i3 + 2] += force * controls.depth * (0.5 + zDir[i] * 0.5);
        }
      }

      // Idle breathing
      const phase = t * IDLE_SPD * 1000 + noisePhase[i];
      velocity[i3]     += Math.sin(phase * 1.1) * IDLE_AMP * 0.25;
      velocity[i3 + 1] += Math.cos(phase * 0.8) * IDLE_AMP * 0.25;
      velocity[i3 + 2] += Math.sin(phase * 0.6) * IDLE_AMP * 0.12;

      velocity[i3]     *= DAMPING;
      velocity[i3 + 1] *= DAMPING;
      velocity[i3 + 2] *= DAMPING;

      currentPos[i3]     = cx + velocity[i3];
      currentPos[i3 + 1] = cy + velocity[i3 + 1];
      currentPos[i3 + 2] = cz + velocity[i3 + 2];
    }

    pa.needsUpdate = true;
    if (matRef.current) matRef.current.uniforms.uTime.value = t;
  });

  // fov=55° → tan(27.5°)≈0.5206 → divisor=1.0413
  const pixelRatio = size.height / 1.0413;

  const uniforms = useMemo(() => ({
    uTime:       { value: 0 },
    uBaseSize:   { value: controls.particleSize },
    uPixelRatio: { value: pixelRatio },
    uAutoScale:  { value: autoScale },
    uShape:      { value: isBlock ? 1.0 : 0.0 },
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }), []);

  useEffect(() => {
    if (!matRef.current) return;
    matRef.current.uniforms.uBaseSize.value   = controls.particleSize;
    matRef.current.uniforms.uPixelRatio.value = pixelRatio;
    matRef.current.uniforms.uAutoScale.value  = autoScale;
    matRef.current.uniforms.uShape.value      = isBlock ? 1.0 : 0.0;
  }, [controls.particleSize, pixelRatio, autoScale, isBlock]);

  return (
    <points>
      <bufferGeometry ref={geoRef} />
      <shaderMaterial
        ref={matRef}
        vertexShader={VERT}
        fragmentShader={FRAG}
        uniforms={uniforms}
        transparent
        depthWrite={false}
        blending={isBlock ? THREE.NormalBlending : THREE.AdditiveBlending}
      />
    </points>
  );
}
