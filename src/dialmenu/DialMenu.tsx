'use client';

import React, { forwardRef, memo, useEffect, useImperativeHandle, useRef, useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
  Terminal, MessageSquare, Eye, FolderOpen, Scan, PenLine,
  Brain, Box, Database, Globe, FileJson, Key,
  Table, Clock,
  GitBranch, Repeat, Filter, ToggleLeft,
  Smartphone, Palette, LayoutDashboard, Component,
  ScissorsSquare, Wand2, ImagePlus, SlidersHorizontal, Layers, Eraser,
  Subtitles, Film, Play, Sparkles, Volume2, Clapperboard,
  type LucideIcon,
} from 'lucide-react';
import { dialSounds } from './sounds';

// ----------------------------------------------------------------------------
// Public types
// ----------------------------------------------------------------------------

export type DialNodeType =
  // Core
  | 'terminal' | 'prompt' | 'output' | 'file' | 'vision' | 'sketch'
  // AI
  | 'llm' | 'embeddings' | 'memory' | 'search' | 'parse' | 'apikey'
  // Data
  | 'database' | 'api' | 'json' | 'csv' | 'vector' | 'cache'
  // Logic
  | 'branch' | 'loop' | 'filter' | 'switch' | 'merge' | 'split'
  // Design
  | 'web' | 'mobile' | 'shader' | 'system' | 'component' | '3d'
  // Photo
  | 'segment' | 'enhance' | 'photo-edit' | 'layer' | 'replace'
  // Video
  | 'caption' | 'video-edit' | 'animate' | 'effects' | 'audio' | 'render';

interface DialMenuItem {
  type: DialNodeType;
  Icon: LucideIcon;
  label: string;
}

interface DialMenuPage {
  name: string;
  items: DialMenuItem[];
}

const DIAL_MENU_PAGES: DialMenuPage[] = [
  {
    name: 'Core',
    items: [
      { type: 'terminal', Icon: Terminal, label: 'Terminal' },
      { type: 'prompt', Icon: MessageSquare, label: 'Prompt' },
      { type: 'output', Icon: Eye, label: 'Output' },
      { type: 'file', Icon: FolderOpen, label: 'File' },
      { type: 'vision', Icon: Scan, label: 'Vision' },
      { type: 'sketch', Icon: PenLine, label: 'Sketch' },
    ],
  },
  {
    name: 'AI',
    items: [
      { type: 'llm', Icon: Brain, label: 'LLM' },
      { type: 'embeddings', Icon: Box, label: 'Embed' },
      { type: 'memory', Icon: Database, label: 'Memory' },
      { type: 'search', Icon: Globe, label: 'Search' },
      { type: 'parse', Icon: FileJson, label: 'Parse' },
      { type: 'apikey', Icon: Key, label: 'API Key' },
    ],
  },
  {
    name: 'Data',
    items: [
      { type: 'database', Icon: Database, label: 'Database' },
      { type: 'api', Icon: Globe, label: 'API' },
      { type: 'json', Icon: FileJson, label: 'JSON' },
      { type: 'csv', Icon: Table, label: 'CSV' },
      { type: 'vector', Icon: Box, label: 'Vector' },
      { type: 'cache', Icon: Clock, label: 'Cache' },
    ],
  },
  {
    name: 'Logic',
    items: [
      { type: 'branch', Icon: GitBranch, label: 'Branch' },
      { type: 'loop', Icon: Repeat, label: 'Loop' },
      { type: 'filter', Icon: Filter, label: 'Filter' },
      { type: 'switch', Icon: ToggleLeft, label: 'Switch' },
      { type: 'merge', Icon: GitBranch, label: 'Merge' },
      { type: 'split', Icon: GitBranch, label: 'Split' },
    ],
  },
  {
    name: 'Design',
    items: [
      { type: 'web', Icon: Globe, label: 'Web' },
      { type: 'mobile', Icon: Smartphone, label: 'Mobile' },
      { type: 'shader', Icon: Palette, label: 'Shader' },
      { type: 'system', Icon: LayoutDashboard, label: 'System' },
      { type: 'component', Icon: Component, label: 'Component' },
      { type: '3d', Icon: Box, label: '3D' },
    ],
  },
  {
    name: 'Photo',
    items: [
      { type: 'segment', Icon: ScissorsSquare, label: 'Segment' },
      { type: 'enhance', Icon: Wand2, label: 'Enhance' },
      { type: 'photo-edit', Icon: ImagePlus, label: 'Edit' },
      { type: 'filter', Icon: SlidersHorizontal, label: 'Filter' },
      { type: 'layer', Icon: Layers, label: 'Layer' },
      { type: 'replace', Icon: Eraser, label: 'Replace' },
    ],
  },
  {
    name: 'Video',
    items: [
      { type: 'caption', Icon: Subtitles, label: 'Caption' },
      { type: 'video-edit', Icon: Film, label: 'Edit' },
      { type: 'animate', Icon: Play, label: 'Animate' },
      { type: 'effects', Icon: Sparkles, label: 'Effects' },
      { type: 'audio', Icon: Volume2, label: 'Audio' },
      { type: 'render', Icon: Clapperboard, label: 'Render' },
    ],
  },
];

// Layout constants
const DIAL_RADIUS = 110;             // For decorative rings
const DIAL_ITEM_RADIUS = 125;        // For item placement (spread out from center)
const DIAL_ITEM_SIZE = 64;
const DIAL_START_ANGLE = -90;

export interface DialMenuControlPoint {
  x: number;
  y: number;
}

export interface DialMenuHandle {
  setExternalPointer: (point: DialMenuControlPoint | null) => void;
  confirmActive: () => void;
  nextPage: () => void;
  previousPage: () => void;
}

export const DIAL_MENU_CONTROL_LAYOUT = {
  itemCount: 6,
  startAngleDeg: DIAL_START_ANGLE,
  pointerRadius: DIAL_ITEM_RADIUS + 40,
} as const;

// Text scramble effect ---------------------------------------------------
const SCRAMBLE_CHARS = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789@#$%&*';

function ScrambleText({ text, trigger }: { text: string; trigger: number }) {
  const [displayText, setDisplayText] = useState(text);
  const [color, setColor] = useState('rgba(255, 255, 255, 0.7)');
  const frameRef = useRef<number>(0);
  const iterationRef = useRef(0);

  useEffect(() => {
    if (trigger === 0) {
      setDisplayText(text);
      setColor('rgba(255, 255, 255, 0.7)');
      return;
    }

    iterationRef.current = 0;
    const totalIterations = 12;
    const intervalMs = 40;

    const scramble = () => {
      iterationRef.current++;
      const progress = iterationRef.current / totalIterations;

      const blue = { r: 100, g: 160, b: 255 };
      const white = { r: 255, g: 255, b: 255 };
      const r = Math.round(blue.r + (white.r - blue.r) * progress);
      const g = Math.round(blue.g + (white.g - blue.g) * progress);
      const b = Math.round(blue.b + (white.b - blue.b) * progress);
      setColor(`rgba(${r}, ${g}, ${b}, 0.7)`);

      const result = text
        .split('')
        .map((char, idx) => {
          if (char === ' ') return ' ';
          const charThreshold = idx / text.length;
          if (progress > charThreshold + 0.3) {
            return char;
          }
          return SCRAMBLE_CHARS[Math.floor(Math.random() * SCRAMBLE_CHARS.length)];
        })
        .join('');

      setDisplayText(result);

      if (iterationRef.current < totalIterations) {
        frameRef.current = window.setTimeout(scramble, intervalMs);
      } else {
        setDisplayText(text);
        setColor('rgba(255, 255, 255, 0.7)');
      }
    };

    scramble();

    return () => {
      if (frameRef.current) {
        window.clearTimeout(frameRef.current);
      }
    };
  }, [text, trigger]);

  return <span style={{ color, transition: 'color 0.05s' }}>{displayText}</span>;
}

// ----------------------------------------------------------------------------
// DialMenu component
// ----------------------------------------------------------------------------

export interface DialMenuProps {
  isOpen: boolean;
  position: { x: number; y: number };
  onSelect: (type: DialNodeType) => void;
  onClose: () => void;
  /** Optional path to the rotating decorative SVG. Defaults to /images/radial-decoration.svg */
  decorationSrc?: string;
  /** Notify parent of item world positions (used by external grid deformation effects). */
  onItemsUpdate?: (items: Array<{ x: number; y: number; radius: number }>) => void;
  /** Whether external pointer input can move the menu like the mouse-follow effect. */
  externalPointerFollow?: boolean;
}

const DialMenuComponent = forwardRef<DialMenuHandle, DialMenuProps>(function DialMenu({
  isOpen,
  position,
  onSelect,
  onClose,
  decorationSrc = '/images/radial-decoration.svg',
  onItemsUpdate,
  externalPointerFollow = true,
}, ref) {
  const menuRef = useRef<HTMLDivElement>(null);
  const [hoveredItem, setHoveredItem] = useState<DialNodeType | null>(null);
  const [revealedCount, setRevealedCount] = useState(0);
  const [currentPage, setCurrentPage] = useState(0);
  const [scrollDirection, setScrollDirection] = useState<'up' | 'down'>('down');
  const [rotationKey, setRotationKey] = useState(0);
  const [ringRotation, setRingRotation] = useState(0);

  const targetRingAngleRef = useRef(0);
  const currentRingAngleRef = useRef(0);

  const targetTiltRef = useRef({ x: 0, y: 0 });
  const currentTiltRef = useRef({ x: 0, y: 0 });

  const targetPositionRef = useRef(position);
  const currentPositionRef = useRef(position);
  const animationFrameRef = useRef<number>(0);

  const tiltContainerRef = useRef<HTMLDivElement>(null);
  const ringRotationRef = useRef<SVGSVGElement>(null);
  const contentParallaxRefs = useRef<(HTMLDivElement | null)[]>([]);
  const buttonBgRefs = useRef<(HTMLDivElement | null)[]>([]);
  const hoveredItemRef = useRef<DialNodeType | null>(null);
  const externalPointerRef = useRef<DialMenuControlPoint | null>(null);

  const onItemsUpdateRef = useRef(onItemsUpdate);
  onItemsUpdateRef.current = onItemsUpdate;

  const currentPageItems = DIAL_MENU_PAGES[currentPage].items;
  const itemCount = currentPageItems.length;
  const pageCount = DIAL_MENU_PAGES.length;

  const setActiveItem = (type: DialNodeType | null) => {
    if (hoveredItemRef.current === type) return;
    hoveredItemRef.current = type;
    setHoveredItem(type);
  };

  const updateExternalPointer = (point: DialMenuControlPoint | null) => {
    externalPointerRef.current = point;
    if (!point) {
      setActiveItem(null);
      return;
    }

    const inputAngle = Math.atan2(point.y - position.y, point.x - position.x);
    const inputAngleDegrees = inputAngle * (180 / Math.PI);
    const segmentAngle = 360 / itemCount;
    const nextIndex = Math.round((inputAngleDegrees - DIAL_START_ANGLE) / segmentAngle);
    const normalizedIndex = ((nextIndex % itemCount) + itemCount) % itemCount;
    setActiveItem(currentPageItems[normalizedIndex]?.type ?? null);
  };

  const confirmActive = () => {
    const activeItem = hoveredItemRef.current;
    if (!activeItem) return;

    dialSounds.playRandomized(0.04, 0.85, 0.1);
    onSelect(activeItem);
  };

  const changePage = (direction: 1 | -1) => {
    const segmentAngle = 360 / pageCount;

    setScrollDirection(direction > 0 ? 'down' : 'up');
    setCurrentPage((prev) => (prev + direction + pageCount) % pageCount);
    setRotationKey((key) => key + 1);
    setRingRotation((rotation) => rotation - direction * segmentAngle);
    setActiveItem(null);
    externalPointerRef.current = null;
    dialSounds.play(0.03, direction > 0 ? 1.1 : 0.9);
  };

  useImperativeHandle(ref, () => ({
    setExternalPointer: updateExternalPointer,
    confirmActive,
    nextPage: () => changePage(1),
    previousPage: () => changePage(-1),
  }));

  // Initialize the audio context on first open (after user gesture).
  useEffect(() => {
    if (isOpen) {
      void dialSounds.initialize();
    }
  }, [isOpen]);

  // Wheel/scroll handler for page navigation
  const lastScrollTimeRef = useRef(0);
  useEffect(() => {
    if (!isOpen) return;

    const handleWheel = (e: WheelEvent) => {
      e.preventDefault();
      e.stopPropagation();

      const now = Date.now();
      if (now - lastScrollTimeRef.current < 350) return;

      const delta = e.deltaY !== 0 ? e.deltaY : e.deltaX;
      if (Math.abs(delta) < 50) return;

      lastScrollTimeRef.current = now;

      if (delta > 0) {
        changePage(1);
      } else {
        changePage(-1);
      }
    };

    window.addEventListener('wheel', handleWheel, { passive: false, capture: true });
    return () => {
      window.removeEventListener('wheel', handleWheel, { capture: true });
    };
  }, [isOpen, pageCount]);

  // Reset state when menu closes
  useEffect(() => {
    if (!isOpen) {
      setCurrentPage(0);
      setRotationKey(0);
      setRingRotation(0);
      setActiveItem(null);
      externalPointerRef.current = null;
    }
  }, [isOpen]);

  // Reset position and tilt when opened
  useEffect(() => {
    if (isOpen) {
      currentPositionRef.current = position;
      targetPositionRef.current = position;
      currentTiltRef.current = { x: 0, y: 0 };
      targetTiltRef.current = { x: 0, y: 0 };
      currentRingAngleRef.current = 0;
      if (menuRef.current) {
        menuRef.current.style.left = `${position.x}px`;
        menuRef.current.style.top = `${position.y}px`;
      }
    }
  }, [isOpen, position]);

  // Spawn-point ref (so menu can drift toward cursor)
  const spawnPositionRef = useRef(position);
  useEffect(() => {
    if (isOpen) {
      spawnPositionRef.current = position;
    }
  }, [isOpen, position]);

  // Mouse-follow + tilt animation loop
  useEffect(() => {
    if (!isOpen) return;

    const mouseRef = { x: targetPositionRef.current.x, y: targetPositionRef.current.y };

    const handleMouseMove = (e: MouseEvent) => {
      targetPositionRef.current = { x: e.clientX, y: e.clientY };
      mouseRef.x = e.clientX;
      mouseRef.y = e.clientY;
    };

    const animate = () => {
      const externalPointer = externalPointerRef.current;
      if (externalPointer) {
        mouseRef.x = externalPointer.x;
        mouseRef.y = externalPointer.y;
        if (externalPointerFollow) {
          targetPositionRef.current = externalPointer;
        } else {
          targetPositionRef.current = spawnPositionRef.current;
        }
      }

      const current = currentPositionRef.current;
      const target = targetPositionRef.current;
      const spawn = spawnPositionRef.current;

      const mouseToMenuDx = target.x - current.x;
      const mouseToMenuDy = target.y - current.y;
      const mouseToMenuDist = Math.sqrt(mouseToMenuDx * mouseToMenuDx + mouseToMenuDy * mouseToMenuDy);

      const ringBoundary = DIAL_ITEM_RADIUS + 20;

      const maxOffset = 25;
      const followStrength = 0.12;
      let offsetX = -(target.x - spawn.x) * followStrength;
      let offsetY = -(target.y - spawn.y) * followStrength;
      const offsetDist = Math.sqrt(offsetX * offsetX + offsetY * offsetY);
      if (offsetDist > maxOffset) {
        const scale = maxOffset / offsetDist;
        offsetX *= scale;
        offsetY *= scale;
      }
      const parallaxTargetX = spawn.x + offsetX;
      const parallaxTargetY = spawn.y + offsetY;

      if (mouseToMenuDist > ringBoundary) {
        const spawnToCursorDx = target.x - spawn.x;
        const spawnToCursorDy = target.y - spawn.y;
        const spawnToCursorDist = Math.sqrt(spawnToCursorDx * spawnToCursorDx + spawnToCursorDy * spawnToCursorDy);

        const maxDist = 250;
        const normalizedDist = Math.min(1, spawnToCursorDist / maxDist);

        const eased = normalizedDist * normalizedDist * normalizedDist * normalizedDist * normalizedDist;
        const gravityStrength = 0.001 + eased * 0.06;

        spawnPositionRef.current = {
          x: spawn.x + spawnToCursorDx * gravityStrength,
          y: spawn.y + spawnToCursorDy * gravityStrength,
        };
      }

      const targetX = parallaxTargetX;
      const targetY = parallaxTargetY;

      const lerpFactor = 0.08;
      const newX = current.x + (targetX - current.x) * lerpFactor;
      const newY = current.y + (targetY - current.y) * lerpFactor;

      const dx = mouseRef.x - current.x;
      const dy = mouseRef.y - current.y;
      const dist = Math.sqrt(dx * dx + dy * dy);
      if (dist > 20) {
        targetRingAngleRef.current = Math.atan2(dy, dx) * (180 / Math.PI);
      }

      let angleDiff = targetRingAngleRef.current - currentRingAngleRef.current;
      while (angleDiff > 180) angleDiff -= 360;
      while (angleDiff < -180) angleDiff += 360;
      currentRingAngleRef.current += angleDiff * 0.15;

      const maxTilt = 12;
      const tiltRange = 200;

      const normalizedX = Math.max(-1, Math.min(1, dx / tiltRange));
      const normalizedY = Math.max(-1, Math.min(1, dy / tiltRange));

      targetTiltRef.current = {
        x: -normalizedY * maxTilt,
        y: normalizedX * maxTilt,
      };

      const tiltLerp = 0.1;
      currentTiltRef.current = {
        x: currentTiltRef.current.x + (targetTiltRef.current.x - currentTiltRef.current.x) * tiltLerp,
        y: currentTiltRef.current.y + (targetTiltRef.current.y - currentTiltRef.current.y) * tiltLerp,
      };

      const tiltX = currentTiltRef.current.x;
      const tiltY = currentTiltRef.current.y;

      if (tiltContainerRef.current) {
        tiltContainerRef.current.style.transform = `rotateX(${tiltX}deg) rotateY(${tiltY}deg)`;
      }

      if (ringRotationRef.current) {
        ringRotationRef.current.style.transform = `rotate(${currentRingAngleRef.current - 30}deg)`;
      }

      contentParallaxRefs.current.forEach((el) => {
        if (el) {
          el.style.transform = `translate(${-tiltY * 0.15}px, ${tiltX * 0.15}px)`;
        }
      });
      buttonBgRefs.current.forEach((el) => {
        if (el) {
          const brightness = 36 + Math.max(0, tiltX) * 0.25;
          el.style.background = `rgb(${brightness}, ${brightness}, ${brightness})`;
        }
      });

      currentPositionRef.current = { x: newX, y: newY };
      if (menuRef.current) {
        menuRef.current.style.left = `${newX}px`;
        menuRef.current.style.top = `${newY}px`;
      }

      if (Math.abs(newX - current.x) > 0.5 || Math.abs(newY - current.y) > 0.5) {
        const items: Array<{ x: number; y: number; radius: number }> = [];
        for (let i = 0; i < itemCount; i++) {
          const angle = (DIAL_START_ANGLE + (360 / itemCount) * i) * (Math.PI / 180);
          items.push({
            x: newX + Math.cos(angle) * DIAL_ITEM_RADIUS,
            y: newY + Math.sin(angle) * DIAL_ITEM_RADIUS,
            radius: DIAL_ITEM_SIZE / 2,
          });
        }
        onItemsUpdateRef.current?.(items);
      }

      animationFrameRef.current = requestAnimationFrame(animate);
    };

    window.addEventListener('mousemove', handleMouseMove);
    animationFrameRef.current = requestAnimationFrame(animate);

    return () => {
      window.removeEventListener('mousemove', handleMouseMove);
      cancelAnimationFrame(animationFrameRef.current);
    };
  }, [isOpen, itemCount]);

  // Track if this is initial open or page change
  const isInitialOpenRef = useRef(true);

  // Staggered reveal
  useEffect(() => {
    if (!isOpen) {
      setRevealedCount(0);
      onItemsUpdateRef.current?.([]);
      isInitialOpenRef.current = true;
      return;
    }

    const isPageChange = !isInitialOpenRef.current;
    isInitialOpenRef.current = false;

    setRevealedCount(0);

    let count = 0;
    const revealDelay = isPageChange ? 25 : 50;
    const revealInterval = setInterval(() => {
      count++;
      setRevealedCount(count);

      const pos = currentPositionRef.current;
      const items: Array<{ x: number; y: number; radius: number }> = [];
      for (let i = 0; i < Math.min(count, itemCount); i++) {
        const angle = (DIAL_START_ANGLE + (360 / itemCount) * i) * (Math.PI / 180);
        items.push({
          x: pos.x + Math.cos(angle) * DIAL_ITEM_RADIUS,
          y: pos.y + Math.sin(angle) * DIAL_ITEM_RADIUS,
          radius: DIAL_ITEM_SIZE / 2,
        });
      }
      onItemsUpdateRef.current?.(items);

      if (!isPageChange) {
        dialSounds.play(0.025, 0.9 + count * 0.08);
      }

      if (count >= itemCount) {
        clearInterval(revealInterval);
      }
    }, revealDelay);

    return () => clearInterval(revealInterval);
  }, [isOpen, itemCount, currentPage]);

  // Click-outside / escape to close
  useEffect(() => {
    if (!isOpen) return;

    const handleClick = (e: MouseEvent) => {
      if (menuRef.current && !menuRef.current.contains(e.target as Node)) {
        onClose();
      }
    };

    const handleEscape = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };

    const timer = setTimeout(() => {
      window.addEventListener('click', handleClick);
      window.addEventListener('keydown', handleEscape);
    }, 10);

    return () => {
      clearTimeout(timer);
      window.removeEventListener('click', handleClick);
      window.removeEventListener('keydown', handleEscape);
    };
  }, [isOpen, onClose]);

  return (
    <AnimatePresence>
      {isOpen && (
        <motion.div
          ref={menuRef}
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          transition={{ duration: 0.1 }}
          style={{
            position: 'fixed',
            left: position.x,
            top: position.y,
            zIndex: 200000,
            pointerEvents: 'auto',
            perspective: 800,
          }}
        >
          <div
            ref={tiltContainerRef}
            style={{
              transform: 'rotateX(0deg) rotateY(0deg)',
              transformStyle: 'preserve-3d',
            }}
          >
            {/* Rotating ring that follows mouse angle */}
            <motion.div
              initial={{ opacity: 0, scale: 0.8 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.8 }}
              transition={{ duration: 0.2 }}
              style={{
                position: 'absolute',
                left: -(DIAL_RADIUS + 24),
                top: -(DIAL_RADIUS + 24),
                width: (DIAL_RADIUS + 24) * 2,
                height: (DIAL_RADIUS + 24) * 2,
                pointerEvents: 'none',
              }}
            >
              <svg style={{ position: 'absolute', inset: 0, width: '100%', height: '100%' }}>
                <circle
                  cx={DIAL_RADIUS + 24}
                  cy={DIAL_RADIUS + 24}
                  r={DIAL_RADIUS + 16}
                  fill="none"
                  stroke="rgba(255, 255, 255, 0.06)"
                  strokeWidth={1}
                />
              </svg>
              <svg
                ref={ringRotationRef}
                style={{
                  position: 'absolute',
                  inset: 0,
                  width: '100%',
                  height: '100%',
                  transform: 'rotate(-30deg)',
                  transformOrigin: 'center',
                }}
              >
                <path
                  d={`M ${DIAL_RADIUS + 24 + DIAL_RADIUS + 16} ${DIAL_RADIUS + 24}
                      A ${DIAL_RADIUS + 16} ${DIAL_RADIUS + 16} 0 0 1
                      ${DIAL_RADIUS + 24 + Math.cos(Math.PI / 3) * (DIAL_RADIUS + 16)}
                      ${DIAL_RADIUS + 24 + Math.sin(Math.PI / 3) * (DIAL_RADIUS + 16)}`}
                  fill="none"
                  stroke="rgba(255, 255, 255, 0.14)"
                  strokeWidth={2}
                  strokeLinecap="round"
                />
              </svg>
            </motion.div>

            {/* Decorative rings - rotating SVG */}
            <div
              style={{
                position: 'absolute',
                left: 0,
                top: 0,
                width: (DIAL_RADIUS + 24) * 2,
                height: (DIAL_RADIUS + 24) * 2,
                transform: 'translate(-50%, -50%)',
                pointerEvents: 'none',
                opacity: revealedCount >= itemCount ? 1 : 0,
                transition: 'opacity 0.5s ease-out 0.1s',
                zIndex: 0,
              }}
            >
              <img
                src={decorationSrc}
                alt=""
                style={{
                  width: '100%',
                  height: '100%',
                  animation: 'dialmenu-spin-slow 60s linear infinite',
                  willChange: 'transform',
                }}
              />
            </div>

            {/* Center disc with blur */}
            <div
              style={{
                position: 'absolute',
                left: 0,
                top: 0,
                transform: 'translate(-50%, -50%)',
                width: 100,
                height: 100,
                borderRadius: '50%',
                background: 'rgba(28, 28, 28, 0.35)',
                backdropFilter: 'blur(8px)',
                WebkitBackdropFilter: 'blur(8px)',
                border: '1px solid rgba(255, 255, 255, 0.04)',
                pointerEvents: 'none',
              }}
            />

            {/* Page indicator */}
            <div
              style={{
                position: 'absolute',
                left: 0,
                top: 0,
                transform: 'translate(-50%, -50%)',
                display: 'flex',
                flexDirection: 'column',
                alignItems: 'center',
                gap: 4,
                opacity: revealedCount >= itemCount ? 1 : 0,
                transition: 'opacity 0.3s ease',
                pointerEvents: 'none',
              }}
            >
              <span
                style={{
                  fontSize: 11,
                  fontWeight: 600,
                  letterSpacing: '1.5px',
                  textTransform: 'uppercase',
                  fontFamily: 'monospace',
                  minWidth: 50,
                  textAlign: 'center',
                }}
              >
                <ScrambleText text={DIAL_MENU_PAGES[currentPage].name.toUpperCase()} trigger={rotationKey} />
              </span>
              <motion.svg
                width={110}
                height={110}
                style={{
                  position: 'absolute',
                  top: '50%',
                  left: '50%',
                  marginLeft: -55,
                  marginTop: -55,
                  pointerEvents: 'none',
                }}
                animate={{ rotate: ringRotation }}
                transition={{ type: 'spring', stiffness: 300, damping: 30 }}
              >
                {DIAL_MENU_PAGES.map((_, idx) => {
                  const segmentAngle = 360 / DIAL_MENU_PAGES.length;
                  const gapAngle = 12;
                  const startAngle = -90 + idx * segmentAngle + gapAngle / 2;
                  const endAngle = startAngle + segmentAngle - gapAngle;
                  const radius = 48;
                  const cx = 55;
                  const cy = 55;

                  const startRad = (startAngle * Math.PI) / 180;
                  const endRad = (endAngle * Math.PI) / 180;
                  const x1 = cx + radius * Math.cos(startRad);
                  const y1 = cy + radius * Math.sin(startRad);
                  const x2 = cx + radius * Math.cos(endRad);
                  const y2 = cy + radius * Math.sin(endRad);
                  const largeArc = segmentAngle - gapAngle > 180 ? 1 : 0;

                  const isActive = idx === 0;

                  return (
                    <path
                      key={idx}
                      d={`M ${x1} ${y1} A ${radius} ${radius} 0 ${largeArc} 1 ${x2} ${y2}`}
                      fill="none"
                      stroke={isActive ? 'rgba(255, 255, 255, 0.6)' : 'rgba(255, 255, 255, 0.12)'}
                      strokeWidth={3}
                      strokeLinecap="round"
                    />
                  );
                })}
              </motion.svg>
            </div>

            <AnimatePresence mode="popLayout">
              {currentPageItems.map((item, index) => {
                const angle = (DIAL_START_ANGLE + (360 / itemCount) * index) * (Math.PI / 180);
                const x = Math.cos(angle) * DIAL_ITEM_RADIUS;
                const y = Math.sin(angle) * DIAL_ITEM_RADIUS;
                const isHovered = hoveredItem === item.type;
                const isRevealed = index < revealedCount;

                const isInitialReveal = rotationKey === 0;
                const rotationOffset = scrollDirection === 'down' ? 60 : -60;
                const startAngle = angle + (rotationOffset * Math.PI / 180);
                const startX = Math.cos(startAngle) * DIAL_ITEM_RADIUS;
                const startY = Math.sin(startAngle) * DIAL_ITEM_RADIUS;

                const exitAngle = angle - (rotationOffset * Math.PI / 180);
                const exitX = Math.cos(exitAngle) * DIAL_ITEM_RADIUS;
                const exitY = Math.sin(exitAngle) * DIAL_ITEM_RADIUS;

                return (
                  <motion.div
                    key={`${rotationKey}-${item.type}`}
                    layout={false}
                    initial={isInitialReveal ? {
                      scale: 0,
                      x: 0,
                      y: 0,
                      opacity: 0,
                    } : {
                      scale: 0.6,
                      x: startX - DIAL_ITEM_SIZE / 2,
                      y: startY - DIAL_ITEM_SIZE / 2,
                      opacity: 0,
                      rotate: rotationOffset * 0.5,
                    }}
                    animate={isRevealed ? {
                      scale: isHovered ? 1.08 : 1,
                      x: x - DIAL_ITEM_SIZE / 2,
                      y: y - DIAL_ITEM_SIZE / 2,
                      opacity: 1,
                      rotate: 0,
                    } : isInitialReveal ? {
                      scale: 0,
                      x: 0,
                      y: 0,
                      opacity: 0,
                    } : {
                      scale: 0.6,
                      x: startX - DIAL_ITEM_SIZE / 2,
                      y: startY - DIAL_ITEM_SIZE / 2,
                      opacity: 0,
                      rotate: rotationOffset * 0.5,
                    }}
                    exit={{
                      scale: 0.6,
                      x: exitX - DIAL_ITEM_SIZE / 2,
                      y: exitY - DIAL_ITEM_SIZE / 2,
                      opacity: 0,
                      rotate: -rotationOffset * 0.5,
                      transition: {
                        type: 'spring',
                        stiffness: 350,
                        damping: 22,
                        delay: index * 0.01,
                      },
                    }}
                    transition={{
                      type: 'spring',
                      stiffness: isInitialReveal ? 600 : 350,
                      damping: isInitialReveal ? 28 : 22,
                      delay: isInitialReveal ? 0 : index * 0.015,
                    }}
                    onMouseEnter={() => {
                      setActiveItem(item.type);
                      dialSounds.play(0.015, 1.2);
                    }}
                    onMouseLeave={() => setActiveItem(null)}
                    onClick={(e) => {
                      e.stopPropagation();
                      dialSounds.playRandomized(0.04, 0.85, 0.1);
                      onSelect(item.type);
                    }}
                    style={{
                      position: 'absolute',
                      width: DIAL_ITEM_SIZE,
                      height: DIAL_ITEM_SIZE,
                      cursor: isRevealed ? 'pointer' : 'default',
                      pointerEvents: isRevealed ? 'auto' : 'none',
                    }}
                  >
                    <div
                      ref={(el) => { buttonBgRefs.current[index] = el; }}
                      style={{
                        position: 'absolute',
                        inset: 0,
                        borderRadius: 12,
                        background: 'rgb(36, 36, 36)',
                        border: isHovered ? '1px solid rgba(255, 255, 255, 0.18)' : '1px solid rgba(255, 255, 255, 0.06)',
                        boxShadow: '0 24px 24px -12px rgba(0, 0, 0, 0.25)',
                        transition: 'border-color 0.15s ease',
                      }}
                    />
                    <div
                      ref={(el) => { contentParallaxRefs.current[index] = el; }}
                      style={{
                        position: 'absolute',
                        inset: 0,
                        display: 'flex',
                        flexDirection: 'column',
                        alignItems: 'center',
                        justifyContent: 'center',
                        gap: 4,
                        transform: 'translate(0px, 0px)',
                      }}
                    >
                      <item.Icon
                        size={20}
                        strokeWidth={1.5}
                        style={{
                          color: isHovered ? 'rgba(255, 255, 255, 0.9)' : 'rgba(255, 255, 255, 0.5)',
                          transition: 'color 0.15s ease',
                          filter: 'drop-shadow(0px 1px 2px rgba(0, 0, 0, 0.4))',
                        }}
                      />
                      <span
                        style={{
                          fontSize: 9,
                          fontWeight: 500,
                          color: isHovered ? 'rgba(255, 255, 255, 0.7)' : 'rgba(255, 255, 255, 0.35)',
                          letterSpacing: '0.3px',
                          textTransform: 'uppercase',
                          transition: 'color 0.15s ease',
                          textShadow: '0px 1px 2px rgba(0, 0, 0, 0.5)',
                        }}
                      >
                        {item.label}
                      </span>
                    </div>
                  </motion.div>
                );
              })}
            </AnimatePresence>
          </div>
        </motion.div>
      )}
    </AnimatePresence>
  );
});

export const DialMenu = memo(DialMenuComponent);
