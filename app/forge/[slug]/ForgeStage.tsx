'use client';

import { useState, useEffect, useCallback } from 'react';
import Link from 'next/link';
import { Minus, Plus, RotateCcw, ChevronLeft } from 'lucide-react';
import ForgeComponentLoader from './ForgeComponentLoader';

const ZOOM_MIN = 0.25;
const ZOOM_MAX = 3;
const ZOOM_STEP = 0.1;

function clamp(n: number, min: number, max: number) {
  return Math.max(min, Math.min(max, n));
}

export default function ForgeStage({ slug }: { slug: string }) {
  const [zoom, setZoom] = useState(1);

  const zoomIn = useCallback(() => setZoom((z) => clamp(z + ZOOM_STEP, ZOOM_MIN, ZOOM_MAX)), []);
  const zoomOut = useCallback(() => setZoom((z) => clamp(z - ZOOM_STEP, ZOOM_MIN, ZOOM_MAX)), []);
  const zoomReset = useCallback(() => setZoom(1), []);

  // Expose the current zoom as a CSS variable so portaled components
  // (which sit outside this scaled wrapper) can scale themselves to match.
  useEffect(() => {
    document.documentElement.style.setProperty('--forge-zoom', String(zoom));
    return () => {
      document.documentElement.style.removeProperty('--forge-zoom');
    };
  }, [zoom]);

  // Cmd/Ctrl +/- and 0 for zoom (preventDefault so browser zoom doesn't fire)
  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if (!(e.metaKey || e.ctrlKey)) return;
      if (e.key === '-' || e.key === '_') {
        e.preventDefault();
        zoomOut();
      } else if (e.key === '=' || e.key === '+') {
        e.preventDefault();
        zoomIn();
      } else if (e.key === '0') {
        e.preventDefault();
        zoomReset();
      }
    };
    window.addEventListener('keydown', handler);
    return () => window.removeEventListener('keydown', handler);
  }, [zoomIn, zoomOut, zoomReset]);

  return (
    <div style={{ display: 'flex', height: '100vh', width: '100vw', overflow: 'hidden' }}>
      {/* Left: stage */}
      <div
        style={{
          flex: 1,
          position: 'relative',
          overflow: 'hidden',
          backgroundColor: '#0d0d0d',
          backgroundImage: `radial-gradient(circle, rgba(255,255,255,0.06) 1px, transparent 1px)`,
          backgroundSize: '24px 24px',
        }}
      >
        {/* Top bar: back + zoom */}
        <div
          style={{
            position: 'absolute',
            top: 16,
            left: 16,
            right: 16,
            display: 'flex',
            justifyContent: 'space-between',
            alignItems: 'center',
            zIndex: 10,
            pointerEvents: 'none',
          }}
        >
          <Link
            href="/forge"
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: 4,
              height: 30,
              padding: '0 10px 0 8px',
              backgroundColor: 'rgba(38, 38, 38, 0.8)',
              border: '1px solid #2B2B2B',
              borderRadius: 8,
              backdropFilter: 'blur(8px)',
              color: '#a3a3a3',
              fontSize: 11,
              fontWeight: 500,
              textDecoration: 'none',
              pointerEvents: 'auto',
              transition: 'background-color 0.15s ease, color 0.15s ease',
            }}
            onMouseEnter={(e) => {
              e.currentTarget.style.backgroundColor = 'rgba(64, 64, 64, 0.8)';
              e.currentTarget.style.color = '#e5e5e5';
            }}
            onMouseLeave={(e) => {
              e.currentTarget.style.backgroundColor = 'rgba(38, 38, 38, 0.8)';
              e.currentTarget.style.color = '#a3a3a3';
            }}
          >
            <ChevronLeft size={12} />
            Forge
          </Link>

          <ZoomControls
            zoom={zoom}
            onZoomIn={zoomIn}
            onZoomOut={zoomOut}
            onReset={zoomReset}
          />
        </div>

        {/* Scaled stage */}
        <div
          style={{
            position: 'absolute',
            inset: 0,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
          }}
        >
          <div
            style={{
              transform: `scale(${zoom})`,
              transformOrigin: 'center center',
              transition: 'transform 0.12s ease-out',
            }}
          >
            <ForgeComponentLoader slug={slug} />
          </div>
        </div>
      </div>

      {/* Right: Tweakpane column */}
      <div
        style={{
          width: 316,
          padding: '8px 8px 0 8px',
          flexShrink: 0,
          height: '100vh',
          overflowY: 'auto',
        }}
      >
        <div id="forge-tweakpane-slot" />
      </div>
    </div>
  );
}

function ZoomControls({
  zoom,
  onZoomIn,
  onZoomOut,
  onReset,
}: {
  zoom: number;
  onZoomIn: () => void;
  onZoomOut: () => void;
  onReset: () => void;
}) {
  const pct = Math.round(zoom * 100);
  return (
    <div
      style={{
        display: 'flex',
        alignItems: 'center',
        gap: 2,
        padding: 3,
        backgroundColor: 'rgba(38, 38, 38, 0.8)',
        border: '1px solid #2B2B2B',
        borderRadius: 8,
        backdropFilter: 'blur(8px)',
        pointerEvents: 'auto',
      }}
    >
      <ZoomButton onClick={onZoomOut} disabled={zoom <= ZOOM_MIN} title="Zoom out (⌘−)">
        <Minus size={12} />
      </ZoomButton>
      <button
        type="button"
        onClick={onReset}
        title="Reset (⌘0)"
        style={{
          minWidth: 52,
          height: 24,
          padding: '0 6px',
          fontSize: 11,
          fontWeight: 500,
          color: '#a3a3a3',
          background: 'transparent',
          border: 'none',
          outline: 'none',
          cursor: 'pointer',
          borderRadius: 5,
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          gap: 4,
        }}
      >
        {pct}%
      </button>
      <ZoomButton onClick={onZoomIn} disabled={zoom >= ZOOM_MAX} title="Zoom in (⌘+)">
        <Plus size={12} />
      </ZoomButton>
      <div style={{ width: 1, height: 16, background: '#2B2B2B', margin: '0 2px' }} />
      <ZoomButton onClick={onReset} title="Reset zoom (⌘0)">
        <RotateCcw size={11} />
      </ZoomButton>
    </div>
  );
}

function ZoomButton({
  onClick,
  disabled,
  title,
  children,
}: {
  onClick: () => void;
  disabled?: boolean;
  title?: string;
  children: React.ReactNode;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled}
      title={title}
      style={{
        width: 24,
        height: 24,
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        background: 'transparent',
        border: 'none',
        outline: 'none',
        borderRadius: 5,
        cursor: disabled ? 'default' : 'pointer',
        color: disabled ? '#404040' : '#a3a3a3',
        transition: 'background-color 0.15s ease, color 0.15s ease',
      }}
      onMouseEnter={(e) => {
        if (!disabled) {
          e.currentTarget.style.backgroundColor = 'rgba(82,82,82,0.4)';
          e.currentTarget.style.color = '#e5e5e5';
        }
      }}
      onMouseLeave={(e) => {
        e.currentTarget.style.backgroundColor = 'transparent';
        e.currentTarget.style.color = disabled ? '#404040' : '#a3a3a3';
      }}
    >
      {children}
    </button>
  );
}
