'use client';

import { useRef, useState, useCallback, useEffect } from 'react';

interface Props {
  onConvert: (dataUrl: string) => void;
}

type Tool = 'pen' | 'eraser';

// Preset palette — white + vivid hues that look great as particles
const PALETTE = [
  '#ffffff', '#e2e8f0',
  '#f87171', '#fb923c', '#fbbf24',
  '#a3e635', '#34d399', '#38bdf8',
  '#818cf8', '#e879f9',
];

// Internal canvas resolution — high enough for dense particle sampling
const CW = 900;
const CH = 600;

export default function DrawPanel({ onConvert }: Props) {
  const canvasRef  = useRef<HTMLCanvasElement>(null);
  const drawing    = useRef(false);
  const lastPt     = useRef<{ x: number; y: number } | null>(null);
  const history    = useRef<ImageData[]>([]);

  const [tool,      setTool]      = useState<Tool>('pen');
  const [color,     setColor]     = useState('#ffffff');
  const [brushSize, setBrushSize] = useState(12);
  const [hasDrawn,  setHasDrawn]  = useState(false);

  // Canvas coords from a mouse event, accounting for display-to-internal scaling
  const ptFromEvent = (e: React.MouseEvent): { x: number; y: number } => {
    const canvas = canvasRef.current!;
    const rect   = canvas.getBoundingClientRect();
    return {
      x: (e.clientX - rect.left) * (CW / rect.width),
      y: (e.clientY - rect.top)  * (CH / rect.height),
    };
  };

  const saveHistory = useCallback(() => {
    const ctx = canvasRef.current?.getContext('2d');
    if (!ctx) return;
    history.current.push(ctx.getImageData(0, 0, CW, CH));
    if (history.current.length > 25) history.current.shift();
  }, []);

  const applyStroke = useCallback(
    (from: { x: number; y: number } | null, to: { x: number; y: number }) => {
      const ctx = canvasRef.current?.getContext('2d');
      if (!ctx) return;

      ctx.save();
      ctx.lineCap    = 'round';
      ctx.lineJoin   = 'round';
      ctx.lineWidth  = brushSize;

      if (tool === 'eraser') {
        ctx.globalCompositeOperation = 'destination-out';
        ctx.strokeStyle = 'rgba(0,0,0,1)';
        ctx.fillStyle   = 'rgba(0,0,0,1)';
      } else {
        ctx.globalCompositeOperation = 'source-over';
        ctx.strokeStyle = color;
        ctx.fillStyle   = color;
      }

      ctx.beginPath();
      if (from) {
        ctx.moveTo(from.x, from.y);
        ctx.lineTo(to.x, to.y);
        ctx.stroke();
      } else {
        // Single tap — paint a dot
        ctx.arc(to.x, to.y, brushSize / 2, 0, Math.PI * 2);
        ctx.fill();
      }
      ctx.restore();
    },
    [tool, color, brushSize],
  );

  const onMouseDown = useCallback(
    (e: React.MouseEvent) => {
      saveHistory();
      drawing.current = true;
      setHasDrawn(true);
      const pt = ptFromEvent(e);
      lastPt.current = pt;
      applyStroke(null, pt);
    },
    [saveHistory, applyStroke],
  );

  const onMouseMove = useCallback(
    (e: React.MouseEvent) => {
      if (!drawing.current) return;
      const pt = ptFromEvent(e);
      applyStroke(lastPt.current, pt);
      lastPt.current = pt;
    },
    [applyStroke],
  );

  const stopDrawing = useCallback(() => {
    drawing.current = false;
    lastPt.current  = null;
  }, []);

  const undo = useCallback(() => {
    const ctx = canvasRef.current?.getContext('2d');
    if (!ctx || history.current.length === 0) return;
    ctx.putImageData(history.current.pop()!, 0, 0);
  }, []);

  const clear = useCallback(() => {
    const ctx = canvasRef.current?.getContext('2d');
    if (!ctx) return;
    saveHistory();
    ctx.clearRect(0, 0, CW, CH);
    setHasDrawn(false);
  }, [saveHistory]);

  const handleConvert = useCallback(() => {
    onConvert(canvasRef.current!.toDataURL('image/png'));
  }, [onConvert]);

  // Keyboard undo
  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key === 'z') { e.preventDefault(); undo(); }
    };
    window.addEventListener('keydown', handler);
    return () => window.removeEventListener('keydown', handler);
  }, [undo]);

  return (
    <div className="flex flex-col items-center gap-3 w-full">

      {/* ── Toolbar ── */}
      <div className="flex items-center gap-2 px-3 py-2 rounded-xl bg-surface-800 border border-surface-600 flex-wrap justify-center w-full max-w-2xl">

        {/* Tool buttons */}
        <div className="flex gap-1">
          <ToolBtn active={tool === 'pen'} onClick={() => setTool('pen')} title="Pen">
            <svg viewBox="0 0 20 20" fill="currentColor" className="w-4 h-4">
              <path d="M13.586 3.586a2 2 0 112.828 2.828l-8 8a2 2 0 01-.707.464l-3 1a.5.5 0 01-.636-.636l1-3a2 2 0 01.464-.707l8-8z"/>
            </svg>
          </ToolBtn>
          <ToolBtn active={tool === 'eraser'} onClick={() => setTool('eraser')} title="Eraser">
            <svg viewBox="0 0 20 20" fill="currentColor" className="w-4 h-4">
              <path fillRule="evenodd" d="M8.22 5.22a.75.75 0 011.06 0l4.25 4.25a.75.75 0 010 1.06l-4.5 4.5a.75.75 0 01-1.06 0L3.72 10.78a.75.75 0 010-1.06l4.5-4.5zM5.04 9.97l2.98 2.98L4 15l1.04-5.03zM16.5 4.5l-1.5 1.5" clipRule="evenodd"/>
            </svg>
          </ToolBtn>
        </div>

        <div className="w-px h-5 bg-surface-600 hidden sm:block" />

        {/* Colour swatches */}
        <div className="flex gap-1 flex-wrap max-w-[180px]">
          {PALETTE.map((c) => (
            <button
              key={c}
              title={c}
              onClick={() => { setColor(c); setTool('pen'); }}
              style={{ background: c }}
              className={[
                'w-5 h-5 rounded-full border-2 transition-transform hover:scale-110',
                color === c && tool === 'pen' ? 'border-white scale-110' : 'border-transparent',
              ].join(' ')}
            />
          ))}
          {/* Custom colour */}
          <label className="relative w-5 h-5 rounded-full overflow-hidden border-2 border-surface-500 cursor-pointer hover:border-white/60 transition-colors" title="Custom colour">
            <span
              className="absolute inset-0 rounded-full"
              style={{ background: 'conic-gradient(red,yellow,lime,cyan,blue,magenta,red)' }}
            />
            <input
              type="color"
              value={color}
              onChange={(e) => { setColor(e.target.value); setTool('pen'); }}
              className="absolute inset-0 opacity-0 w-full h-full cursor-pointer"
            />
          </label>
        </div>

        <div className="w-px h-5 bg-surface-600 hidden sm:block" />

        {/* Brush size */}
        <div className="flex items-center gap-2">
          <span className="text-white/30 text-[10px] font-mono">Size</span>
          <input
            type="range" min={2} max={80} step={1}
            value={brushSize}
            onChange={(e) => setBrushSize(+e.target.value)}
            className="w-20"
          />
          <span className="text-white/50 text-[10px] font-mono w-5 text-right">{brushSize}</span>
        </div>

        <div className="w-px h-5 bg-surface-600 hidden sm:block" />

        {/* Undo / Clear */}
        <div className="flex gap-1">
          <ActionBtn onClick={undo} title="Undo (⌘Z)">Undo</ActionBtn>
          <ActionBtn onClick={clear} title="Clear canvas">Clear</ActionBtn>
        </div>
      </div>

      {/* ── Canvas ── */}
      <div className="relative rounded-xl overflow-hidden border border-surface-600 w-full max-w-2xl shadow-[0_0_60px_rgba(0,0,0,0.8)]">
        {/* Dot-grid background — purely visual, not part of canvas pixel data */}
        <div
          className="absolute inset-0 pointer-events-none"
          style={{
            backgroundImage: 'radial-gradient(circle, rgba(255,255,255,0.04) 1px, transparent 1px)',
            backgroundSize: '20px 20px',
            background: '#060608',
          }}
        />
        <div
          className="absolute inset-0 pointer-events-none"
          style={{
            background: '#060608',
            backgroundImage: 'radial-gradient(circle, rgba(255,255,255,0.04) 1px, transparent 1px)',
            backgroundSize: '20px 20px',
          }}
        />

        <canvas
          ref={canvasRef}
          width={CW}
          height={CH}
          style={{
            display: 'block',
            width: '100%',
            cursor: tool === 'eraser' ? 'cell' : 'crosshair',
            touchAction: 'none',
            position: 'relative',
            zIndex: 1,
          }}
          onMouseDown={onMouseDown}
          onMouseMove={onMouseMove}
          onMouseUp={stopDrawing}
          onMouseLeave={stopDrawing}
        />

        {/* Empty-canvas hint */}
        {!hasDrawn && (
          <div className="absolute inset-0 flex items-center justify-center pointer-events-none z-0">
            <p className="text-white/10 text-sm font-mono select-none">
              draw something, then convert to particles
            </p>
          </div>
        )}
      </div>

      {/* ── Convert button ── */}
      <button
        onClick={handleConvert}
        className="px-8 py-3 rounded-xl bg-accent hover:bg-accent-dim active:scale-95 text-white text-sm font-semibold transition-all shadow-lg shadow-accent/20 hover:shadow-accent/30 hover:scale-[1.02]"
      >
        Convert to Particles
      </button>
    </div>
  );
}

// ── Small helpers ─────────────────────────────────────────────────────────────

function ToolBtn({
  active, onClick, title, children,
}: { active: boolean; onClick: () => void; title: string; children: React.ReactNode }) {
  return (
    <button
      onClick={onClick}
      title={title}
      className={[
        'p-1.5 rounded-lg transition-all',
        active
          ? 'bg-accent text-white'
          : 'text-white/40 hover:text-white/70 hover:bg-surface-700',
      ].join(' ')}
    >
      {children}
    </button>
  );
}

function ActionBtn({ onClick, title, children }: { onClick: () => void; title: string; children: React.ReactNode }) {
  return (
    <button
      onClick={onClick}
      title={title}
      className="px-2 py-1 rounded-lg text-[10px] font-mono text-white/40 hover:text-white/70 hover:bg-surface-700 transition-all border border-transparent hover:border-surface-600"
    >
      {children}
    </button>
  );
}
