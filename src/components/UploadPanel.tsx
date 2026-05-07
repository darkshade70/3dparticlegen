'use client';

import { useCallback, useRef, useState } from 'react';
import DrawPanel from './DrawPanel';
import HoloGenTitle from './HoloGenTitle';

interface Props {
  onUpload: (dataUrl: string) => void;
}

type Tab = 'upload' | 'draw';

const ACCEPTED = ['image/png', 'image/jpeg', 'image/jpg', 'image/webp', 'image/heic', 'image/heif'];

export default function UploadPanel({ onUpload }: Props) {
  const [tab,      setTab]      = useState<Tab>('upload');
  const [dragging, setDragging] = useState(false);
  const [error,    setError]    = useState<string | null>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  const handleFile = useCallback(
    (file: File) => {
      if (!file.type.startsWith('image/') && !ACCEPTED.includes(file.type)) {
        setError('Unsupported format — use PNG, JPG, WEBP, or HEIC.');
        return;
      }
      setError(null);
      const reader = new FileReader();
      reader.onload = (e) => {
        if (typeof e.target?.result === 'string') onUpload(e.target.result);
      };
      reader.readAsDataURL(file);
    },
    [onUpload],
  );

  const onDrop = useCallback(
    (e: React.DragEvent) => {
      e.preventDefault();
      setDragging(false);
      const file = e.dataTransfer.files[0];
      if (file) handleFile(file);
    },
    [handleFile],
  );

  return (
    <div className="flex items-center justify-center w-full h-full bg-surface-900 overflow-y-auto">
      {/* Ambient glow */}
      <div className="pointer-events-none fixed inset-0 flex items-center justify-center">
        <div className="w-[700px] h-[700px] rounded-full bg-accent/5 blur-[140px]" />
      </div>

      <div className="relative z-10 flex flex-col items-center gap-6 px-4 py-10 w-full max-w-2xl">

        {/* Title */}
        <div className="flex flex-col items-center gap-2 w-full">
          <HoloGenTitle />
          <p className="text-sm text-white/40 leading-relaxed text-center">
            Upload a photo or draw your own.
          </p>
        </div>

        {/* Tab selector */}
        <div className="flex gap-1 p-1 rounded-xl bg-surface-800 border border-surface-600">
          {(['upload', 'draw'] as Tab[]).map((t) => (
            <button
              key={t}
              onClick={() => setTab(t)}
              className={[
                'px-5 py-2 rounded-lg text-sm font-medium transition-all',
                tab === t
                  ? 'bg-accent text-white shadow-md shadow-accent/30'
                  : 'text-white/40 hover:text-white/70',
              ].join(' ')}
            >
              {t === 'upload' ? 'Upload Image' : 'Draw'}
            </button>
          ))}
        </div>

        {/* ── Upload tab ── */}
        {tab === 'upload' && (
          <div className="flex flex-col items-center gap-4 w-full">
            <div
              className={[
                'relative w-full rounded-2xl border transition-all duration-200 cursor-pointer',
                'bg-surface-800/60 backdrop-blur-sm',
                dragging
                  ? 'border-accent shadow-[0_0_30px_rgba(99,102,241,0.25)] scale-[1.01]'
                  : 'border-surface-600 hover:border-surface-500 hover:bg-surface-800',
              ].join(' ')}
              onDragEnter={(e) => { e.preventDefault(); setDragging(true); }}
              onDragOver={(e)  => { e.preventDefault(); setDragging(true); }}
              onDragLeave={() => setDragging(false)}
              onDrop={onDrop}
              onClick={() => inputRef.current?.click()}
            >
              <input
                ref={inputRef}
                type="file"
                accept="image/*"
                className="hidden"
                onChange={(e) => { const f = e.target.files?.[0]; if (f) handleFile(f); }}
              />

              <div className="flex flex-col items-center gap-4 py-10 sm:py-14 px-8">
                <div className={[
                  'w-14 h-14 rounded-2xl flex items-center justify-center transition-all duration-200',
                  dragging ? 'bg-accent/20' : 'bg-surface-700',
                ].join(' ')}>
                  <svg width="24" height="24" viewBox="0 0 24 24" fill="none"
                    stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"
                    className={dragging ? 'text-accent-glow' : 'text-white/40'}>
                    <path d="M21 15v4a2 2 0 01-2 2H5a2 2 0 01-2-2v-4" />
                    <polyline points="17 8 12 3 7 8" />
                    <line x1="12" y1="3" x2="12" y2="15" />
                  </svg>
                </div>
                <div className="flex flex-col gap-1 text-center">
                  <p className="text-sm font-medium text-white/80">
                    {dragging ? 'Drop to transform' : (
                      <>
                        <span className="sm:hidden">Tap to choose a photo</span>
                        <span className="hidden sm:inline">Drop an image here</span>
                      </>
                    )}
                  </p>
                  <p className="text-xs text-white/30">
                    <span className="sm:hidden">PNG, JPG, WEBP or camera photo</span>
                    <span className="hidden sm:inline">or click to browse — PNG, JPG, WEBP</span>
                  </p>
                </div>
              </div>
            </div>

            {error && <p className="text-xs text-red-400/80">{error}</p>}

            <div className="flex flex-wrap justify-center gap-2">
              {['50k+ particles', 'Spring physics', 'Cursor repulsion', 'Luminance depth'].map((t) => (
                <span key={t} className="text-[11px] font-mono px-3 py-1 rounded-full bg-surface-700 text-white/30 border border-surface-600">
                  {t}
                </span>
              ))}
            </div>
          </div>
        )}

        {/* ── Draw tab ── */}
        {tab === 'draw' && (
          <div className="w-full">
            <DrawPanel onConvert={onUpload} />
          </div>
        )}

      </div>
    </div>
  );
}
