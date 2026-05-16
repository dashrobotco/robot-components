'use client';

import './dialmenu.css';
import React, { useCallback, useRef, useState } from 'react';
import Link from 'next/link';
import { ArrowLeft } from 'lucide-react';
import { DialMenu, type DialMenuHandle, type DialNodeType } from '../../src/dialmenu/DialMenu';
import { useDualSenseDialControls } from './useDualSenseDialControls';

export default function DialMenuDemo() {
  const [menu, setMenu] = useState<{ isOpen: boolean; position: { x: number; y: number } }>({
    isOpen: false,
    position: { x: 0, y: 0 },
  });
  const [lastSelected, setLastSelected] = useState<DialNodeType | null>(null);
  const dialMenuRef = useRef<DialMenuHandle>(null);
  const virtualCursorRef = useRef<HTMLDivElement>(null);

  const openAt = useCallback((x: number, y: number) => {
    setMenu({ isOpen: true, position: { x, y } });
  }, []);

  const handleClose = useCallback(() => {
    setMenu((prev) => ({ ...prev, isOpen: false }));
  }, []);

  const handleSelect = useCallback((type: DialNodeType) => {
    setLastSelected(type);
    setMenu((prev) => ({ ...prev, isOpen: false }));
  }, []);

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

  useDualSenseDialControls({
    menu,
    dialMenuRef,
    cursorRef: virtualCursorRef,
    openAt,
    closeMenu: handleClose,
  });

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

      <div data-dial-ui>
        <div
          ref={virtualCursorRef}
          style={{
            position: 'fixed',
            left: 0,
            top: 0,
            width: 14,
            height: 14,
            borderRadius: '50%',
            border: '1px solid rgba(255,255,255,0.65)',
            background: 'rgba(255,255,255,0.16)',
            boxShadow: '0 0 18px rgba(255,255,255,0.18)',
            pointerEvents: 'none',
            zIndex: 9,
            transform: 'translate3d(50vw, 50vh, 0) translate(-50%, -50%)',
            willChange: 'transform',
          }}
        />
        <DialMenu
          ref={dialMenuRef}
          isOpen={menu.isOpen}
          position={menu.position}
          onSelect={handleSelect}
          onClose={handleClose}
          externalPointerFollow={false}
        />
      </div>
    </div>
  );
}
