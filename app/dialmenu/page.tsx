'use client';

import './dialmenu.css';
import React, { useCallback, useEffect, useRef, useState } from 'react';
import Link from 'next/link';
import { ArrowLeft } from 'lucide-react';
import { DialMenu, type DialNodeType } from '../../src/dialmenu/DialMenu';

interface SpawnedNode {
  id: string;
  type: DialNodeType;
  x: number;
  y: number;
}

export default function DialMenuDemo() {
  const [menu, setMenu] = useState<{ isOpen: boolean; position: { x: number; y: number } }>({
    isOpen: false,
    position: { x: 0, y: 0 },
  });
  const [spawned, setSpawned] = useState<SpawnedNode[]>([]);
  const [lastSelected, setLastSelected] = useState<DialNodeType | null>(null);
  const idRef = useRef(0);

  const openAt = useCallback((x: number, y: number) => {
    setMenu({ isOpen: true, position: { x, y } });
  }, []);

  const handleClose = useCallback(() => {
    setMenu((prev) => ({ ...prev, isOpen: false }));
  }, []);

  const handleSelect = useCallback((type: DialNodeType) => {
    setLastSelected(type);
    setSpawned((prev) => [
      ...prev,
      { id: `n${idRef.current++}`, type, x: menu.position.x, y: menu.position.y },
    ]);
    setMenu((prev) => ({ ...prev, isOpen: false }));
  }, [menu.position.x, menu.position.y]);

  // Open menu on left click anywhere on the empty stage
  const handleStageMouseDown = useCallback((e: React.MouseEvent<HTMLDivElement>) => {
    if (e.button !== 0) return;
    if ((e.target as HTMLElement).closest('[data-dial-ui]')) return;
    if (menu.isOpen) {
      handleClose();
      return;
    }
    openAt(e.clientX, e.clientY);
  }, [menu.isOpen, handleClose, openAt]);

  // Right click also opens (matches the source app behavior)
  const handleContextMenu = useCallback((e: React.MouseEvent<HTMLDivElement>) => {
    e.preventDefault();
    if ((e.target as HTMLElement).closest('[data-dial-ui]')) return;
    openAt(e.clientX, e.clientY);
  }, [openAt]);

  // Open in the center on first mount so the demo is immediately visible
  useEffect(() => {
    const t = setTimeout(() => {
      openAt(window.innerWidth / 2, window.innerHeight / 2);
    }, 250);
    return () => clearTimeout(t);
  }, [openAt]);

  return (
    <div
      onMouseDown={handleStageMouseDown}
      onContextMenu={handleContextMenu}
      style={{
        position: 'fixed',
        inset: 0,
        background: '#0e0e0e',
        backgroundImage:
          'radial-gradient(rgba(255,255,255,0.05) 1px, transparent 1px)',
        backgroundSize: '32px 32px',
        backgroundPosition: '-1px -1px',
        overflow: 'hidden',
        cursor: 'crosshair',
        userSelect: 'none',
      }}
    >
      {/* Top bar */}
      <div
        data-dial-ui
        style={{
          position: 'fixed',
          top: 16,
          left: 16,
          right: 16,
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          gap: 12,
          zIndex: 10,
          pointerEvents: 'none',
        }}
      >
        <Link
          href="/"
          style={{
            pointerEvents: 'auto',
            display: 'inline-flex',
            alignItems: 'center',
            gap: 8,
            padding: '8px 12px',
            borderRadius: 10,
            background: 'rgba(38, 38, 38, 0.7)',
            backdropFilter: 'blur(8px)',
            border: '1px solid #2a2a2a',
            color: '#a3a3a3',
            fontSize: 13,
            textDecoration: 'none',
          }}
        >
          <ArrowLeft size={14} /> Back
        </Link>

        <div
          style={{
            pointerEvents: 'none',
            padding: '8px 14px',
            borderRadius: 999,
            background: 'rgba(28, 28, 28, 0.6)',
            border: '1px solid #262626',
            backdropFilter: 'blur(8px)',
            color: '#a3a3a3',
            fontSize: 12,
            letterSpacing: 0.3,
          }}
        >
          Click anywhere to open the dial · scroll to switch pages · esc to close
        </div>

        <div
          style={{
            pointerEvents: 'none',
            minWidth: 120,
            textAlign: 'right',
            fontSize: 12,
            color: '#737373',
          }}
        >
          {lastSelected ? (
            <>
              Last selected:{' '}
              <span style={{ color: '#e5e5e5', textTransform: 'uppercase', letterSpacing: 0.5 }}>
                {lastSelected}
              </span>
            </>
          ) : (
            'No selection yet'
          )}
        </div>
      </div>

      {/* Spawned node markers - just a subtle visual to show selections happened */}
      {spawned.map((node) => (
        <div
          key={node.id}
          style={{
            position: 'fixed',
            left: node.x,
            top: node.y,
            transform: 'translate(-50%, -50%)',
            padding: '6px 10px',
            borderRadius: 10,
            background: '#1f1f1f',
            border: '1px solid #2e2e2e',
            color: '#d4d4d4',
            fontSize: 11,
            letterSpacing: 0.5,
            textTransform: 'uppercase',
            boxShadow: '0 8px 24px -8px rgba(0,0,0,0.6)',
            pointerEvents: 'none',
          }}
        >
          {node.type}
        </div>
      ))}

      {/* Reset button */}
      {spawned.length > 0 && (
        <button
          data-dial-ui
          onClick={(e) => { e.stopPropagation(); setSpawned([]); }}
          style={{
            position: 'fixed',
            bottom: 24,
            left: '50%',
            transform: 'translateX(-50%)',
            padding: '8px 14px',
            borderRadius: 10,
            background: '#1f1f1f',
            border: '1px solid #2e2e2e',
            color: '#a3a3a3',
            fontSize: 12,
            cursor: 'pointer',
            zIndex: 11,
          }}
        >
          Clear {spawned.length} node{spawned.length === 1 ? '' : 's'}
        </button>
      )}

      <div data-dial-ui>
        <DialMenu
          isOpen={menu.isOpen}
          position={menu.position}
          onSelect={handleSelect}
          onClose={handleClose}
        />
      </div>
    </div>
  );
}
