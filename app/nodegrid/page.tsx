'use client';

import './grid.css';
import React, { useState, useEffect, useRef, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import { motion, AnimatePresence, useAnimation } from 'framer-motion';
import { Loader2, Check, CircleCheck, ChevronUp, ChevronDown, GripVertical, Sparkles } from 'lucide-react';
import { soundEffects } from '../../src/utils/SoundEffects';

// ============================================================================
// TYPES
// ============================================================================

interface PhysicsConfig {
  boundaryMargin: number;
  maxVelocity: number;
  baseFriction: number;
  highSpeedFriction: number;
  bounceDamping: number;
  bounceFrictionBoost: number;
  minVelocity: number;
  momentumThreshold: number;
  velocitySampleCount: number;
  dragScale: number;
  panelWidth: number;
  soundEnabled: boolean;
  soundMinVolume: number;
  soundMaxVolume: number;
  // Shadow settings
  idleShadowY: number;
  idleShadowBlur: number;
  idleShadowSpread: number;
  idleShadowOpacity: number;
  dragShadowY: number;
  dragShadowBlur: number;
  dragShadowSpread: number;
  dragShadowOpacity: number;
}

interface DummyJob {
  id: string;
  name: string;
  status: 'completed' | 'processing';
  size: string;
  gradient: string;
}

// ============================================================================
// CONSTANTS
// ============================================================================

const HEADER_HEIGHT = 48;
const JOB_ROW_HEIGHT = 52;

const DEFAULT_CONFIG: PhysicsConfig = {
  boundaryMargin: 8,
  maxVelocity: 40,
  baseFriction: 0.975,
  highSpeedFriction: 0.94,
  bounceDamping: 0.45,
  bounceFrictionBoost: 0.85,
  minVelocity: 0.15,
  momentumThreshold: 1.5,
  velocitySampleCount: 6,
  dragScale: 1.018,
  panelWidth: 280,
  soundEnabled: true,
  soundMinVolume: 0.015,
  soundMaxVolume: 0.15,
  // Shadow settings (idle)
  idleShadowY: 24,
  idleShadowBlur: 24,
  idleShadowSpread: -12,
  idleShadowOpacity: 0.25,
  // Shadow settings (drag)
  dragShadowY: 32,
  dragShadowBlur: 40,
  dragShadowSpread: -8,
  dragShadowOpacity: 0.55,
};

// Greyscale gradients for thumbnails
const GRADIENTS = [
  'linear-gradient(135deg, #3a3a3a 0%, #2a2a2a 100%)',
  'linear-gradient(135deg, #4a4a4a 0%, #333333 100%)',
  'linear-gradient(135deg, #383838 0%, #282828 100%)',
  'linear-gradient(135deg, #454545 0%, #303030 100%)',
  'linear-gradient(135deg, #404040 0%, #2d2d2d 100%)',
  'linear-gradient(135deg, #3d3d3d 0%, #2b2b2b 100%)',
  'linear-gradient(135deg, #484848 0%, #323232 100%)',
  'linear-gradient(135deg, #3b3b3b 0%, #292929 100%)',
  'linear-gradient(135deg, #434343 0%, #2e2e2e 100%)',
  'linear-gradient(135deg, #3f3f3f 0%, #2c2c2c 100%)',
];

const DUMMY_NAMES = [
  'cosmic-nebula',
  'azure-crystal',
  'midnight-bloom',
  'solar-flare',
  'ocean-depths',
  'aurora-burst',
  'velvet-storm',
  'golden-hour',
  'neon-dreams',
  'frost-peak',
];

// Generate dummy jobs
const generateDummyJobs = (count: number): DummyJob[] => {
  return Array.from({ length: count }, (_, i) => ({
    id: `job-${i}`,
    name: DUMMY_NAMES[i % DUMMY_NAMES.length],
    status: i < 2 ? 'processing' : 'completed',
    size: `${(Math.random() * 50 + 1).toFixed(1)} MB`,
    gradient: GRADIENTS[i % GRADIENTS.length],
  }));
};

// ============================================================================
// SOUND EFFECTS (Simplified standalone version)
// ============================================================================

class PanelSoundEffects {
  private audioContext: AudioContext | null = null;
  private audioBuffer: AudioBuffer | null = null;

  async initialize() {
    if (this.audioContext) return;

    try {
      this.audioContext = new (window.AudioContext || (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext)();
      const response = await fetch('/hoverfx2.mp3');
      const arrayBuffer = await response.arrayBuffer();
      this.audioBuffer = await this.audioContext.decodeAudioData(arrayBuffer);
    } catch (e) {
      console.warn('Failed to initialize sound:', e);
    }
  }

  play(volume: number = 0.035, pitch: number = 0.8) {
    if (!this.audioContext || !this.audioBuffer) return;

    if (this.audioContext.state === 'suspended') {
      this.audioContext.resume().catch(() => {});
    }

    try {
      const ctx = this.audioContext;
      const now = ctx.currentTime;
      const duration = 0.06;

      const source = ctx.createBufferSource();
      const gainNode = ctx.createGain();

      source.buffer = this.audioBuffer;
      source.playbackRate.value = pitch;
      gainNode.gain.setValueAtTime(volume, now);
      gainNode.gain.setValueAtTime(volume, now + duration - 0.01);
      gainNode.gain.linearRampToValueAtTime(0, now + duration);

      source.connect(gainNode);
      gainNode.connect(ctx.destination);

      source.start(now);
      source.stop(now + duration);
    } catch (e) {
      console.warn('Failed to play sound:', e);
    }
  }

  // Play with random pitch variation for variety
  playRandomized(baseVolume: number = 0.035, basePitch: number = 0.8, pitchVariation: number = 0.15) {
    const pitch = basePitch + (Math.random() - 0.5) * 2 * pitchVariation;
    const volume = baseVolume * (0.9 + Math.random() * 0.2); // Slight volume variation too
    this.play(volume, pitch);
  }
}

const panelSounds = new PanelSoundEffects();

// ============================================================================
// PHYSICS PANEL COMPONENT
// ============================================================================

function PhysicsPanel({ config, jobs, onPositionChange, onSizeChange, onBounce }: { config: PhysicsConfig; jobs: DummyJob[]; onPositionChange?: (x: number, y: number) => void; onSizeChange?: (width: number, height: number) => void; onBounce?: (x: number, y: number, intensity: number) => void }) {
  const [position, setPosition] = useState(() => ({
    x: typeof window !== 'undefined' ? window.innerWidth / 2 - config.panelWidth / 2 : 400,
    y: typeof window !== 'undefined' ? window.innerHeight / 2 - HEADER_HEIGHT / 2 : 300,
  }));

  const [isExpanded, setIsExpanded] = useState(false);
  const [isDragging, setIsDragging] = useState(false);

  const panelRef = useRef<HTMLDivElement>(null);
  const innerPanelRef = useRef<HTMLDivElement>(null);
  const animationFrameRef = useRef<number | null>(null);
  const velocitySamplesRef = useRef<Array<{ x: number; y: number; t: number }>>([]);
  const isAnimatingRef = useRef(false);
  const justBouncedRef = useRef({ x: false, y: false });
  const bounceControls = useAnimation();

  // Track panel size changes with ResizeObserver
  useEffect(() => {
    const inner = innerPanelRef.current;
    if (!inner) return;

    const observer = new ResizeObserver((entries) => {
      for (const entry of entries) {
        const { width, height } = entry.contentRect;
        onSizeChange?.(width, height);
      }
    });

    observer.observe(inner);
    return () => observer.disconnect();
  }, [onSizeChange]);

  // Visual feedback constants
  const DRAG_TRANSITION = 'transform 0.15s cubic-bezier(0.4, 0, 0.2, 1), box-shadow 0.15s cubic-bezier(0.4, 0, 0.2, 1)';

  // Generate shadow strings from config
  const IDLE_SHADOW = `0 ${config.idleShadowY}px ${config.idleShadowBlur}px ${config.idleShadowSpread}px rgba(0, 0, 0, ${config.idleShadowOpacity})`;
  const DRAG_SHADOW = `0 ${config.dragShadowY}px ${config.dragShadowBlur}px ${config.dragShadowSpread}px rgba(0, 0, 0, ${config.dragShadowOpacity})`;

  // Initialize sound on mount
  useEffect(() => {
    panelSounds.initialize();
  }, []);

  // Get viewport bounds
  const getViewportBounds = useCallback((scale: number, panelWidth: number, panelHeight: number) => {
    const effectiveWidth = window.innerWidth / scale;
    const effectiveHeight = window.innerHeight / scale;
    return {
      minX: config.boundaryMargin,
      maxX: effectiveWidth - panelWidth - config.boundaryMargin,
      minY: config.boundaryMargin,
      maxY: effectiveHeight - panelHeight - config.boundaryMargin,
    };
  }, [config.boundaryMargin]);

  // Clamp velocity
  const clampVelocity = useCallback((vx: number, vy: number) => {
    const speed = Math.sqrt(vx * vx + vy * vy);
    if (speed > config.maxVelocity) {
      const ratio = config.maxVelocity / speed;
      return { vx: vx * ratio, vy: vy * ratio };
    }
    return { vx, vy };
  }, [config.maxVelocity]);

  // Calculate velocity from samples
  const calculateVelocityFromSamples = useCallback((): { x: number; y: number } => {
    const samples = velocitySamplesRef.current;
    if (samples.length < 2) return { x: 0, y: 0 };

    const now = performance.now();
    const maxAge = 80;

    const lastSample = samples[samples.length - 1];
    if (now - lastSample.t > maxAge) {
      return { x: 0, y: 0 };
    }

    let totalWeight = 0;
    let weightedVelX = 0;
    let weightedVelY = 0;

    for (let i = 1; i < samples.length; i++) {
      const prev = samples[i - 1];
      const curr = samples[i];
      const dt = curr.t - prev.t;
      const age = now - curr.t;

      if (age <= maxAge && dt >= 8 && dt < 100) {
        const weight = i / samples.length;
        const velX = ((curr.x - prev.x) / dt) * 16.67;
        const velY = ((curr.y - prev.y) / dt) * 16.67;
        weightedVelX += velX * weight;
        weightedVelY += velY * weight;
        totalWeight += weight;
      }
    }

    if (totalWeight === 0) return { x: 0, y: 0 };
    return {
      x: weightedVelX / totalWeight,
      y: weightedVelY / totalWeight,
    };
  }, []);

  // Animate momentum
  const animateMomentum = useCallback((
    startX: number,
    startY: number,
    velX: number,
    velY: number,
    scale: number,
    panelWidth: number,
    panelHeight: number
  ) => {
    const panel = panelRef.current;
    if (!panel) return;

    const clamped = clampVelocity(velX, velY);
    let x = startX;
    let y = startY;
    let vx = clamped.vx;
    let vy = clamped.vy;

    isAnimatingRef.current = true;
    justBouncedRef.current = { x: false, y: false };

    const animate = () => {
      const bounds = getViewportBounds(scale, panelWidth, panelHeight);

      const speed = Math.sqrt(vx * vx + vy * vy);
      const speedRatio = Math.min(speed / config.maxVelocity, 1);
      const friction = config.baseFriction - (speedRatio * (config.baseFriction - config.highSpeedFriction));

      const bounceMultiplierX = justBouncedRef.current.x ? config.bounceFrictionBoost : 1;
      const bounceMultiplierY = justBouncedRef.current.y ? config.bounceFrictionBoost : 1;

      vx *= friction * bounceMultiplierX;
      vy *= friction * bounceMultiplierY;

      justBouncedRef.current = { x: false, y: false };

      x += vx;
      y += vy;

      let didBounce = false;
      const preBounceSpeeed = Math.sqrt(vx * vx + vy * vy);

      // Calculate normalized impact force (0-1) based on pre-bounce speed
      const impactForce = Math.min(preBounceSpeeed / config.maxVelocity, 1);

      if (x < bounds.minX) {
        x = bounds.minX;
        vx = Math.abs(vx) * config.bounceDamping;
        justBouncedRef.current.x = true;
        didBounce = true;
        // Trigger pulse from left edge impact point
        onBounce?.(x, y + panelHeight / 2, impactForce);
      } else if (x > bounds.maxX) {
        x = bounds.maxX;
        vx = -Math.abs(vx) * config.bounceDamping;
        justBouncedRef.current.x = true;
        didBounce = true;
        // Trigger pulse from right edge impact point
        onBounce?.(x + panelWidth, y + panelHeight / 2, impactForce);
      }

      if (y < bounds.minY) {
        y = bounds.minY;
        vy = Math.abs(vy) * config.bounceDamping;
        justBouncedRef.current.y = true;
        didBounce = true;
        // Trigger pulse from top edge impact point
        onBounce?.(x + panelWidth / 2, y, impactForce);
      } else if (y > bounds.maxY) {
        y = bounds.maxY;
        vy = -Math.abs(vy) * config.bounceDamping;
        justBouncedRef.current.y = true;
        didBounce = true;
        // Trigger pulse from bottom edge impact point
        onBounce?.(x + panelWidth / 2, y + panelHeight, impactForce);
      }

      // Play bounce sound
      if (didBounce && preBounceSpeeed > 0.5 && config.soundEnabled) {
        const normalizedSpeed = Math.min(preBounceSpeeed / config.maxVelocity, 1);
        const impactVolume = config.soundMinVolume + (normalizedSpeed * normalizedSpeed) * (config.soundMaxVolume - config.soundMinVolume);
        panelSounds.play(impactVolume);
      }

      panel.style.left = x + 'px';
      panel.style.top = y + 'px';
      onPositionChange?.(x, y);

      const currentSpeed = Math.sqrt(vx * vx + vy * vy);
      if (currentSpeed > config.minVelocity) {
        animationFrameRef.current = requestAnimationFrame(animate);
      } else {
        isAnimatingRef.current = false;
        animationFrameRef.current = null;
        setPosition({ x, y });
        onPositionChange?.(x, y);
      }
    };

    if (animationFrameRef.current) {
      cancelAnimationFrame(animationFrameRef.current);
    }

    animationFrameRef.current = requestAnimationFrame(animate);
  }, [config, clampVelocity, getViewportBounds]);

  // Handle mouse down
  const handleMouseDown = (e: React.MouseEvent) => {
    const target = e.target as HTMLElement;
    if (target.closest('[data-no-drag]')) return;

    const panel = panelRef.current;
    if (!panel) return;

    const wasAnimating = animationFrameRef.current !== null;
    if (animationFrameRef.current) {
      cancelAnimationFrame(animationFrameRef.current);
      animationFrameRef.current = null;
      isAnimatingRef.current = false;
    }

    const innerPanel = panel.querySelector('[data-panel-inner]') as HTMLElement;
    const rect = panel.getBoundingClientRect();
    const scale = rect.width / config.panelWidth;

    let startCssX: number;
    let startCssY: number;
    if (wasAnimating) {
      startCssX = parseFloat(panel.style.left) || position.x;
      startCssY = parseFloat(panel.style.top) || position.y;
      setPosition({ x: startCssX, y: startCssY });
    } else {
      startCssX = position.x;
      startCssY = position.y;
    }

    const grabOffsetX = e.clientX - rect.left;
    const grabOffsetY = e.clientY - rect.top;
    const startRectLeft = rect.left;
    const startRectTop = rect.top;

    let hasMoved = false;
    let finalX = startCssX;
    let finalY = startCssY;

    velocitySamplesRef.current = [{ x: startCssX, y: startCssY, t: performance.now() }];

    const applyDragStyle = () => {
      if (innerPanel) {
        innerPanel.style.transition = DRAG_TRANSITION;
        innerPanel.style.transform = `scale(${config.dragScale})`;
        innerPanel.style.boxShadow = DRAG_SHADOW;
      }
      panel.style.cursor = 'grabbing';
      document.body.style.cursor = 'grabbing';
    };

    const removeDragStyle = () => {
      if (innerPanel) {
        innerPanel.style.transition = DRAG_TRANSITION;
        innerPanel.style.transform = 'scale(1)';
        innerPanel.style.boxShadow = IDLE_SHADOW;
      }
      panel.style.cursor = '';
      document.body.style.cursor = '';
    };

    const handleMouseMove = (moveEvent: MouseEvent) => {
      const targetViewportX = moveEvent.clientX - grabOffsetX;
      const targetViewportY = moveEvent.clientY - grabOffsetY;
      const viewportDeltaX = targetViewportX - startRectLeft;
      const viewportDeltaY = targetViewportY - startRectTop;
      const cssDeltaX = viewportDeltaX / scale;
      const cssDeltaY = viewportDeltaY / scale;

      if (!hasMoved && (Math.abs(cssDeltaX) > 2 || Math.abs(cssDeltaY) > 2)) {
        hasMoved = true;
        applyDragStyle();
      }

      if (hasMoved) {
        const currentRect = panel.getBoundingClientRect();
        const panelHeight = currentRect.height / scale;
        const panelWidth = currentRect.width / scale;
        const bounds = getViewportBounds(scale, panelWidth, panelHeight);

        finalX = Math.max(bounds.minX, Math.min(bounds.maxX, startCssX + cssDeltaX));
        finalY = Math.max(bounds.minY, Math.min(bounds.maxY, startCssY + cssDeltaY));
        panel.style.left = finalX + 'px';
        panel.style.top = finalY + 'px';
        onPositionChange?.(finalX, finalY);

        const now = performance.now();
        velocitySamplesRef.current.push({ x: finalX, y: finalY, t: now });

        if (velocitySamplesRef.current.length > config.velocitySampleCount) {
          velocitySamplesRef.current.shift();
        }
      }
    };

    const handleMouseUp = () => {
      document.removeEventListener('mousemove', handleMouseMove);
      document.removeEventListener('mouseup', handleMouseUp);

      removeDragStyle();

      if (hasMoved) {
        setIsDragging(true);
        setTimeout(() => setIsDragging(false), 50);

        const velocity = calculateVelocityFromSamples();
        const clamped = clampVelocity(velocity.x, velocity.y);
        const speed = Math.sqrt(clamped.vx * clamped.vx + clamped.vy * clamped.vy);

        if (speed > config.momentumThreshold) {
          const currentRect = panel.getBoundingClientRect();
          const panelHeight = currentRect.height / scale;
          const panelWidth = currentRect.width / scale;
          animateMomentum(finalX, finalY, clamped.vx, clamped.vy, scale, panelWidth, panelHeight);
        } else {
          setPosition({ x: finalX, y: finalY });
        }
      }
    };

    document.addEventListener('mousemove', handleMouseMove);
    document.addEventListener('mouseup', handleMouseUp);
  };

  // Handle touch start (mobile support)
  const handleTouchStart = (e: React.TouchEvent) => {
    const target = e.target as HTMLElement;
    if (target.closest('[data-no-drag]')) return;

    const panel = panelRef.current;
    if (!panel) return;

    const touch = e.touches[0];

    const wasAnimating = animationFrameRef.current !== null;
    if (animationFrameRef.current) {
      cancelAnimationFrame(animationFrameRef.current);
      animationFrameRef.current = null;
      isAnimatingRef.current = false;
    }

    const innerPanel = panel.querySelector('[data-panel-inner]') as HTMLElement;
    const rect = panel.getBoundingClientRect();
    const scale = rect.width / config.panelWidth;

    let startCssX: number;
    let startCssY: number;
    if (wasAnimating) {
      startCssX = parseFloat(panel.style.left) || position.x;
      startCssY = parseFloat(panel.style.top) || position.y;
      setPosition({ x: startCssX, y: startCssY });
    } else {
      startCssX = position.x;
      startCssY = position.y;
    }

    const grabOffsetX = touch.clientX - rect.left;
    const grabOffsetY = touch.clientY - rect.top;
    const startRectLeft = rect.left;
    const startRectTop = rect.top;

    let hasMoved = false;
    let finalX = startCssX;
    let finalY = startCssY;

    velocitySamplesRef.current = [{ x: startCssX, y: startCssY, t: performance.now() }];

    const applyDragStyle = () => {
      if (innerPanel) {
        innerPanel.style.transition = DRAG_TRANSITION;
        innerPanel.style.transform = `scale(${config.dragScale})`;
        innerPanel.style.boxShadow = DRAG_SHADOW;
      }
    };

    const removeDragStyle = () => {
      if (innerPanel) {
        innerPanel.style.transition = DRAG_TRANSITION;
        innerPanel.style.transform = 'scale(1)';
        innerPanel.style.boxShadow = IDLE_SHADOW;
      }
    };

    const handleTouchMove = (moveEvent: TouchEvent) => {
      moveEvent.preventDefault(); // Prevent scrolling while dragging
      const moveTouch = moveEvent.touches[0];

      const targetViewportX = moveTouch.clientX - grabOffsetX;
      const targetViewportY = moveTouch.clientY - grabOffsetY;
      const viewportDeltaX = targetViewportX - startRectLeft;
      const viewportDeltaY = targetViewportY - startRectTop;
      const cssDeltaX = viewportDeltaX / scale;
      const cssDeltaY = viewportDeltaY / scale;

      if (!hasMoved && (Math.abs(cssDeltaX) > 2 || Math.abs(cssDeltaY) > 2)) {
        hasMoved = true;
        applyDragStyle();
      }

      if (hasMoved) {
        const currentRect = panel.getBoundingClientRect();
        const panelHeight = currentRect.height / scale;
        const panelWidth = currentRect.width / scale;
        const bounds = getViewportBounds(scale, panelWidth, panelHeight);

        finalX = Math.max(bounds.minX, Math.min(bounds.maxX, startCssX + cssDeltaX));
        finalY = Math.max(bounds.minY, Math.min(bounds.maxY, startCssY + cssDeltaY));
        panel.style.left = finalX + 'px';
        panel.style.top = finalY + 'px';
        onPositionChange?.(finalX, finalY);

        const now = performance.now();
        velocitySamplesRef.current.push({ x: finalX, y: finalY, t: now });

        if (velocitySamplesRef.current.length > config.velocitySampleCount) {
          velocitySamplesRef.current.shift();
        }
      }
    };

    const handleTouchEnd = () => {
      document.removeEventListener('touchmove', handleTouchMove);
      document.removeEventListener('touchend', handleTouchEnd);

      removeDragStyle();

      if (hasMoved) {
        setIsDragging(true);
        setTimeout(() => setIsDragging(false), 50);

        const velocity = calculateVelocityFromSamples();
        const clamped = clampVelocity(velocity.x, velocity.y);
        const speed = Math.sqrt(clamped.vx * clamped.vx + clamped.vy * clamped.vy);

        if (speed > config.momentumThreshold) {
          const currentRect = panel.getBoundingClientRect();
          const panelHeight = currentRect.height / scale;
          const panelWidth = currentRect.width / scale;
          animateMomentum(finalX, finalY, clamped.vx, clamped.vy, scale, panelWidth, panelHeight);
        } else {
          setPosition({ x: finalX, y: finalY });
        }
      }
    };

    document.addEventListener('touchmove', handleTouchMove, { passive: false });
    document.addEventListener('touchend', handleTouchEnd);
  };

  // Handle toggle
  const handleToggle = () => {
    if (isDragging) return;
    soundEffects.playClickSound();
    setIsExpanded(!isExpanded);
    bounceControls.start({
      scale: [1, 1.015, 1],
      transition: { duration: 0.3, ease: 'easeOut' },
    });
  };

  // Cleanup
  useEffect(() => {
    return () => {
      if (animationFrameRef.current) {
        cancelAnimationFrame(animationFrameRef.current);
      }
    };
  }, []);

  // Calculate heights
  const activeCount = jobs.filter(j => j.status === 'processing').length;
  const jobsListHeight = jobs.length > 4 ? (4.5 * JOB_ROW_HEIGHT) + 14 : (jobs.length * JOB_ROW_HEIGHT) + 14;
  const expandedHeight = HEADER_HEIGHT + jobsListHeight;
  const currentHeight = isExpanded ? expandedHeight : HEADER_HEIGHT;

  const getHeaderText = () => {
    if (activeCount > 0) {
      return `${activeCount} job${activeCount !== 1 ? 's' : ''} processing`;
    }
    return `${jobs.length} job${jobs.length !== 1 ? 's' : ''} completed`;
  };

  return (
    <motion.div
      ref={panelRef}
      onMouseDown={handleMouseDown}
      onTouchStart={handleTouchStart}
      initial={{ opacity: 0, scale: 0.95, y: 10 }}
      animate={{ opacity: 1, scale: 1, y: 0 }}
      transition={{
        opacity: { duration: 0.15 },
        scale: { type: 'spring', stiffness: 400, damping: 25 },
        y: { type: 'spring', stiffness: 400, damping: 25 },
      }}
      style={{
        position: 'fixed',
        zIndex: 2147483647,
        userSelect: 'none',
        touchAction: 'none',
        left: position.x,
        top: position.y,
        width: config.panelWidth,
        cursor: 'grab',
      }}
    >
      <motion.div
        animate={bounceControls}
        style={{
          width: '100%',
          willChange: 'transform',
          backfaceVisibility: 'hidden',
          transform: 'translateZ(0)',
        }}
      >
        <motion.div
          ref={innerPanelRef}
          data-panel-inner
          initial={false}
          animate={{ height: currentHeight }}
          transition={{
            height: { type: 'spring', stiffness: 400, damping: 28 },
          }}
          style={{
            borderRadius: 12,
            border: '1px solid rgba(255, 255, 255, 0.1)',
            overflow: 'hidden',
            backgroundColor: '#262626', /* neutral-800 */
            boxShadow: IDLE_SHADOW,
          }}
        >
          {/* Header */}
          <button
            onClick={handleToggle}
            style={{
              width: '100%',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-between',
              padding: '0 16px',
              cursor: 'pointer',
              transition: 'background-color 0.15s',
              height: HEADER_HEIGHT,
              backgroundColor: '#262626', /* neutral-800 */
              border: 'none',
            }}
            onMouseEnter={(e) => { e.currentTarget.style.backgroundColor = 'rgba(64, 64, 64, 0.3)'; /* neutral-700/30 */ }}
            onMouseLeave={(e) => { e.currentTarget.style.backgroundColor = '#262626'; /* neutral-800 */ }}
          >
            <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
              {activeCount > 0 ? (
                <Loader2 size={15} style={{ color: '#2563eb', animation: 'spin 1s linear infinite' }} />
              ) : (
                <CircleCheck size={15} style={{ color: '#4ade80' }} />
              )}
              <span style={{ fontSize: 13, fontWeight: 500, color: '#e5e5e5' }}>
                {getHeaderText()}
              </span>
            </div>

            <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
              <span
                data-no-drag
                style={{
                  fontSize: 11,
                  padding: '4px 8px',
                  borderRadius: 6,
                  transition: 'all 0.2s',
                  color: '#737373',
                  cursor: 'pointer',
                  opacity: isExpanded ? 1 : 0,
                  pointerEvents: isExpanded ? 'auto' : 'none',
                }}
              >
                Clear
              </span>
              <GripVertical size={14} style={{ color: '#525252' }} />
              <ChevronUp
                size={13}
                style={{
                  color: '#525252',
                  transition: 'transform 0.3s ease-out',
                  transform: isExpanded ? 'rotate(180deg)' : 'rotate(0deg)',
                }}
              />
            </div>
          </button>

          {/* Jobs List */}
          <div style={{ position: 'relative' }}>
            <div
              style={{
                height: jobsListHeight,
                paddingTop: 6,
                paddingBottom: 8,
                overflowY: 'auto',
                scrollbarWidth: 'none',
                msOverflowStyle: 'none',
              }}
            >
            {jobs.map((job) => (
              <div
                key={job.id}
                style={{
                  width: '100%',
                  display: 'flex',
                  alignItems: 'center',
                  gap: 10,
                  borderRadius: 5,
                  cursor: 'pointer',
                  position: 'relative',
                  height: JOB_ROW_HEIGHT,
                  padding: '6px 16px 6px 12px',
                }}
              >
                {/* Thumbnail */}
                <div
                  style={{
                    width: 40,
                    height: 40,
                    borderRadius: 8,
                    flexShrink: 0,
                    transition: 'all 0.15s',
                    background: job.gradient,
                  }}
                />

                {/* Info */}
                <div style={{ flex: 1, textAlign: 'left', minWidth: 0 }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                    <div style={{ flex: 1, minWidth: 0 }}>
                      <span
                        style={{
                          display: 'block',
                          fontSize: 13,
                          fontWeight: 500,
                          color: '#fafafa', /* neutral-50 */
                          maxWidth: 150,
                          overflow: 'hidden',
                          textOverflow: 'ellipsis',
                          whiteSpace: 'nowrap',
                        }}
                      >
                        {job.name}
                      </span>
                    </div>
                    <span
                      data-no-drag
                      style={{
                        opacity: 0,
                        transition: 'opacity 0.15s',
                        fontSize: 11,
                        color: '#737373', /* neutral-500 */
                        cursor: 'pointer',
                        flexShrink: 0,
                      }}
                    >
                      Clear
                    </span>
                  </div>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                    {job.status === 'processing' ? (
                      <span style={{ fontSize: 11, color: '#737373' /* neutral-500 */ }}>
                        Generating...
                      </span>
                    ) : (
                      <>
                        <Check size={11} style={{ flexShrink: 0, color: '#737373' /* neutral-500 */ }} />
                        <span style={{ fontSize: 11, color: '#737373' /* neutral-500 */ }}>
                          Generated • {job.size}
                        </span>
                      </>
                    )}
                  </div>
                </div>
              </div>
            ))}
            </div>
            {/* Bottom gradient mask */}
            <div
              style={{
                position: 'absolute',
                bottom: 0,
                left: 0,
                right: 0,
                height: 40,
                background: 'linear-gradient(to top, #262626 0%, transparent 100%)',
                pointerEvents: 'none',
              }}
            />
          </div>
        </motion.div>
      </motion.div>
    </motion.div>
  );
}

// ============================================================================
// SIMPLE FLOATING PANEL (Spawnable)
// ============================================================================

const FLOATING_PANEL_SIZE = { width: 160, height: 160 }; // 4x4 grid units (40px each)

type ResizeEdge = 'n' | 's' | 'e' | 'w' | 'ne' | 'nw' | 'se' | 'sw' | null;

const GRID_CELL_SIZE = 40; // Grid cell size in pixels

function FloatingPanel({
  id,
  initialX,
  initialY,
  initialWidth,
  initialHeight,
  config,
  isTopPanel,
  isExiting,
  onPositionChange,
  onSizeChange,
  onBounce,
  onDragStart,
  onDragEnd,
  onDismiss,
  onConnectionDragStart,
  onConnectionDragMove,
  onConnectionDragEnd,
  isConnectionTarget,
  hasOutgoingConnection,
  hasIncomingConnection,
  onConnectionDelete
}: {
  id: string;
  initialX: number;
  initialY: number;
  initialWidth: number;
  initialHeight: number;
  config: PhysicsConfig;
  isTopPanel?: boolean;
  isExiting?: boolean;
  onPositionChange?: (id: string, x: number, y: number) => void;
  onSizeChange?: (id: string, width: number, height: number) => void;
  onBounce?: (x: number, y: number, intensity: number) => void;
  onDragStart?: (id: string) => void;
  onDragEnd?: () => void;
  onDismiss?: (id: string) => void;
  onConnectionDragStart?: (fromPanelId: string, startX: number, startY: number) => void;
  onConnectionDragMove?: (x: number, y: number) => void;
  onConnectionDragEnd?: (fromPanelId: string, toPanelId: string | null, dropX: number, dropY: number) => void;
  isConnectionTarget?: boolean;
  hasOutgoingConnection?: boolean;
  hasIncomingConnection?: boolean;
  onConnectionDelete?: (panelId: string) => void;
}) {
  const [position, setPosition] = useState({ x: initialX, y: initialY });
  const [size, setSize] = useState({ width: initialWidth, height: initialHeight });
  const [isDragging, setIsDragging] = useState(false);
  const [isHovered, setIsHovered] = useState(false);
  const [resizeEdge, setResizeEdge] = useState<ResizeEdge>(null);
  const [isResizing, setIsResizing] = useState(false);
  const [isTouchDevice, setIsTouchDevice] = useState(false);
  const panelRef = useRef<HTMLDivElement>(null);
  const innerPanelRef = useRef<HTMLDivElement>(null);
  const originalSizeRef = useRef({ width: initialWidth, height: initialHeight });
  const animationFrameRef = useRef<number | null>(null);
  const velocitySamplesRef = useRef<Array<{ x: number; y: number; t: number }>>([]);
  const isAnimatingRef = useRef(false);
  const justBouncedRef = useRef({ x: false, y: false });
  const touchedGridCellsRef = useRef<Set<string>>(new Set());
  const lastGridSoundTimeRef = useRef(0);

  const panelWidth = size.width;
  const panelHeight = size.height;

  const DRAG_TRANSITION = 'transform 0.15s cubic-bezier(0.4, 0, 0.2, 1), box-shadow 0.15s cubic-bezier(0.4, 0, 0.2, 1)';
  const IDLE_SHADOW = `0 ${config.idleShadowY}px ${config.idleShadowBlur}px ${config.idleShadowSpread}px rgba(0, 0, 0, ${config.idleShadowOpacity})`;
  const DRAG_SHADOW = `0 ${config.dragShadowY}px ${config.dragShadowBlur}px ${config.dragShadowSpread}px rgba(0, 0, 0, ${config.dragShadowOpacity})`;

  const EDGE_THRESHOLD = 12; // Pixels from edge to trigger resize
  const MIN_SIZE = 80; // Minimum panel dimension
  const MAX_SIZE = 660; // Maximum panel dimension

  // Report position/size on mount
  useEffect(() => {
    onPositionChange?.(id, position.x, position.y);
    onSizeChange?.(id, size.width, size.height);
  }, []);

  // Initialize sound on mount
  useEffect(() => {
    panelSounds.initialize();
  }, []);

  // Detect touch device
  useEffect(() => {
    setIsTouchDevice('ontouchstart' in window || navigator.maxTouchPoints > 0);
  }, []);

  // Detect which edge/corner mouse is near
  const getResizeEdge = useCallback((e: React.MouseEvent): ResizeEdge => {
    const panel = panelRef.current;
    if (!panel) return null;

    const rect = panel.getBoundingClientRect();
    const x = e.clientX - rect.left;
    const y = e.clientY - rect.top;

    const nearLeft = x < EDGE_THRESHOLD;
    const nearRight = x > rect.width - EDGE_THRESHOLD;
    const nearTop = y < EDGE_THRESHOLD;
    const nearBottom = y > rect.height - EDGE_THRESHOLD;

    if (nearTop && nearLeft) return 'nw';
    if (nearTop && nearRight) return 'ne';
    if (nearBottom && nearLeft) return 'sw';
    if (nearBottom && nearRight) return 'se';
    if (nearTop) return 'n';
    if (nearBottom) return 's';
    if (nearLeft) return 'w';
    if (nearRight) return 'e';

    return null;
  }, []);

  // Get cursor style based on edge
  const getCursor = useCallback((edge: ResizeEdge): string => {
    switch (edge) {
      case 'n':
      case 's':
        return 'ns-resize';
      case 'e':
      case 'w':
        return 'ew-resize';
      case 'nw':
      case 'se':
        return 'nwse-resize';
      case 'ne':
      case 'sw':
        return 'nesw-resize';
      default:
        return 'default';
    }
  }, []);

  // Get viewport bounds
  const getViewportBounds = useCallback((scale: number) => {
    const effectiveWidth = window.innerWidth / scale;
    const effectiveHeight = window.innerHeight / scale;
    return {
      minX: config.boundaryMargin,
      maxX: effectiveWidth - panelWidth - config.boundaryMargin,
      minY: config.boundaryMargin,
      maxY: effectiveHeight - panelHeight - config.boundaryMargin,
    };
  }, [config.boundaryMargin, panelWidth, panelHeight]);

  // Clamp velocity
  const clampVelocity = useCallback((vx: number, vy: number) => {
    const speed = Math.sqrt(vx * vx + vy * vy);
    if (speed > config.maxVelocity) {
      const ratio = config.maxVelocity / speed;
      return { vx: vx * ratio, vy: vy * ratio };
    }
    return { vx, vy };
  }, [config.maxVelocity]);

  // Calculate velocity from samples
  const calculateVelocityFromSamples = useCallback((): { x: number; y: number } => {
    const samples = velocitySamplesRef.current;
    if (samples.length < 2) return { x: 0, y: 0 };

    const now = performance.now();
    const maxAge = 80;

    const lastSample = samples[samples.length - 1];
    if (now - lastSample.t > maxAge) return { x: 0, y: 0 };

    let totalWeight = 0;
    let weightedVelX = 0;
    let weightedVelY = 0;

    for (let i = 1; i < samples.length; i++) {
      const prev = samples[i - 1];
      const curr = samples[i];
      const dt = curr.t - prev.t;
      const age = now - curr.t;

      if (age <= maxAge && dt >= 8 && dt < 100) {
        const weight = i / samples.length;
        const velX = ((curr.x - prev.x) / dt) * 16.67;
        const velY = ((curr.y - prev.y) / dt) * 16.67;
        weightedVelX += velX * weight;
        weightedVelY += velY * weight;
        totalWeight += weight;
      }
    }

    if (totalWeight === 0) return { x: 0, y: 0 };
    return { x: weightedVelX / totalWeight, y: weightedVelY / totalWeight };
  }, []);

  // Animate momentum
  const animateMomentum = useCallback((startX: number, startY: number, velX: number, velY: number, scale: number) => {
    const panel = panelRef.current;
    if (!panel) return;

    const clamped = clampVelocity(velX, velY);
    let x = startX;
    let y = startY;
    let vx = clamped.vx;
    let vy = clamped.vy;

    isAnimatingRef.current = true;
    justBouncedRef.current = { x: false, y: false };

    const animate = () => {
      const bounds = getViewportBounds(scale);

      const speed = Math.sqrt(vx * vx + vy * vy);
      const speedRatio = Math.min(speed / config.maxVelocity, 1);
      const friction = config.baseFriction - (speedRatio * (config.baseFriction - config.highSpeedFriction));

      const bounceMultiplierX = justBouncedRef.current.x ? config.bounceFrictionBoost : 1;
      const bounceMultiplierY = justBouncedRef.current.y ? config.bounceFrictionBoost : 1;

      vx *= friction * bounceMultiplierX;
      vy *= friction * bounceMultiplierY;

      justBouncedRef.current = { x: false, y: false };

      x += vx;
      y += vy;

      let didBounce = false;
      const preBounceSpeeed = Math.sqrt(vx * vx + vy * vy);
      const impactForce = Math.min(preBounceSpeeed / config.maxVelocity, 1);

      if (x < bounds.minX) {
        x = bounds.minX;
        vx = Math.abs(vx) * config.bounceDamping;
        justBouncedRef.current.x = true;
        didBounce = true;
        onBounce?.(x, y + panelHeight / 2, impactForce);
      } else if (x > bounds.maxX) {
        x = bounds.maxX;
        vx = -Math.abs(vx) * config.bounceDamping;
        justBouncedRef.current.x = true;
        didBounce = true;
        onBounce?.(x + panelWidth, y + panelHeight / 2, impactForce);
      }

      if (y < bounds.minY) {
        y = bounds.minY;
        vy = Math.abs(vy) * config.bounceDamping;
        justBouncedRef.current.y = true;
        didBounce = true;
        onBounce?.(x + panelWidth / 2, y, impactForce);
      } else if (y > bounds.maxY) {
        y = bounds.maxY;
        vy = -Math.abs(vy) * config.bounceDamping;
        justBouncedRef.current.y = true;
        didBounce = true;
        onBounce?.(x + panelWidth / 2, y + panelHeight, impactForce);
      }

      if (didBounce && preBounceSpeeed > 0.5 && config.soundEnabled) {
        const normalizedSpeed = Math.min(preBounceSpeeed / config.maxVelocity, 1);
        const impactVolume = config.soundMinVolume + (normalizedSpeed * normalizedSpeed) * (config.soundMaxVolume - config.soundMinVolume);
        panelSounds.play(impactVolume);
      }

      panel.style.left = x + 'px';
      panel.style.top = y + 'px';
      onPositionChange?.(id, x, y);

      const currentSpeed = Math.sqrt(vx * vx + vy * vy);
      if (currentSpeed > config.minVelocity) {
        animationFrameRef.current = requestAnimationFrame(animate);
      } else {
        isAnimatingRef.current = false;
        animationFrameRef.current = null;
        setPosition({ x, y });
        onPositionChange?.(id, x, y);
      }
    };

    if (animationFrameRef.current) cancelAnimationFrame(animationFrameRef.current);
    animationFrameRef.current = requestAnimationFrame(animate);
  }, [config, clampVelocity, getViewportBounds, id, onBounce, onPositionChange, panelHeight, panelWidth]);

  // Handle mouse move for edge detection (hover state)
  const handlePanelMouseMove = (e: React.MouseEvent) => {
    if (isDragging || isResizing) return;
    const edge = getResizeEdge(e);
    setResizeEdge(edge);
  };

  // Handle mouse leave
  const handlePanelMouseLeave = () => {
    if (!isResizing) {
      setResizeEdge(null);
    }
    setIsHovered(false);
  };

  // Handle mouse enter
  const handlePanelMouseEnter = () => {
    setIsHovered(true);
  };

  // Handle mouse down - either resize or drag
  const handleMouseDown = (e: React.MouseEvent) => {
    e.stopPropagation(); // Prevent grid click

    const panel = panelRef.current;
    if (!panel) return;

    const edge = getResizeEdge(e);

    // If on a resize edge, handle resize
    if (edge) {
      handleResizeStart(e, edge);
      return;
    }

    // Otherwise, handle drag
    const wasAnimating = animationFrameRef.current !== null;
    if (animationFrameRef.current) {
      cancelAnimationFrame(animationFrameRef.current);
      animationFrameRef.current = null;
      isAnimatingRef.current = false;
    }

    const innerPanel = innerPanelRef.current;
    const rect = panel.getBoundingClientRect();
    const scale = rect.width / panelWidth;

    let startCssX = wasAnimating ? (parseFloat(panel.style.left) || position.x) : position.x;
    let startCssY = wasAnimating ? (parseFloat(panel.style.top) || position.y) : position.y;
    if (wasAnimating) setPosition({ x: startCssX, y: startCssY });

    const grabOffsetX = e.clientX - rect.left;
    const grabOffsetY = e.clientY - rect.top;
    const startRectLeft = rect.left;
    const startRectTop = rect.top;

    let hasMoved = false;
    let finalX = startCssX;
    let finalY = startCssY;

    velocitySamplesRef.current = [{ x: startCssX, y: startCssY, t: performance.now() }];

    const applyDragStyle = () => {
      if (innerPanel) {
        innerPanel.style.transition = DRAG_TRANSITION;
        innerPanel.style.transform = `scale(${config.dragScale})`;
        innerPanel.style.boxShadow = DRAG_SHADOW;
      }
      panel.style.cursor = 'grabbing';
      document.body.style.cursor = 'grabbing';
    };

    const removeDragStyle = () => {
      if (innerPanel) {
        innerPanel.style.transition = DRAG_TRANSITION;
        innerPanel.style.transform = 'scale(1)';
        innerPanel.style.boxShadow = IDLE_SHADOW;
      }
      panel.style.cursor = '';
      document.body.style.cursor = '';
    };

    const handleMouseMove = (moveEvent: MouseEvent) => {
      const targetViewportX = moveEvent.clientX - grabOffsetX;
      const targetViewportY = moveEvent.clientY - grabOffsetY;
      const viewportDeltaX = targetViewportX - startRectLeft;
      const viewportDeltaY = targetViewportY - startRectTop;
      const cssDeltaX = viewportDeltaX / scale;
      const cssDeltaY = viewportDeltaY / scale;

      if (!hasMoved && (Math.abs(cssDeltaX) > 2 || Math.abs(cssDeltaY) > 2)) {
        hasMoved = true;
        setIsDragging(true);
        applyDragStyle();
        onDragStart?.(id);
      }

      if (hasMoved) {
        const bounds = getViewportBounds(scale);
        finalX = Math.max(bounds.minX, Math.min(bounds.maxX, startCssX + cssDeltaX));
        finalY = Math.max(bounds.minY, Math.min(bounds.maxY, startCssY + cssDeltaY));

        // Shift held: snap position to grid
        if (moveEvent.shiftKey) {
          finalX = snapToGrid(finalX);
          finalY = snapToGrid(finalY);
        }

        // Play grid sounds as panel moves over grid dots
        // Track current cell and play sound when entering a new one
        const centerX = finalX + panelWidth / 2;
        const centerY = finalY + panelHeight / 2;
        const cellX = Math.floor(centerX / GRID_CELL_SIZE);
        const cellY = Math.floor(centerY / GRID_CELL_SIZE);
        const cellKey = `${cellX},${cellY}`;

        // Build current cell set (just the one cell the center is in)
        const currentCell = new Set([cellKey]);

        // Play sound if this is a new cell (wasn't in previous set)
        if (!touchedGridCellsRef.current.has(cellKey)) {
          const now = performance.now();
          if (now - lastGridSoundTimeRef.current > 25) {
            const pitch = 1.0 + (Math.random() - 0.5) * 0.3;
            panelSounds.play(0.035, pitch);
            lastGridSoundTimeRef.current = now;
          }
        }

        // Update to current cell only (allows re-triggering when returning)
        touchedGridCellsRef.current = currentCell;

        panel.style.left = finalX + 'px';
        panel.style.top = finalY + 'px';
        onPositionChange?.(id, finalX, finalY);

        const now = performance.now();
        velocitySamplesRef.current.push({ x: finalX, y: finalY, t: now });
        if (velocitySamplesRef.current.length > config.velocitySampleCount) {
          velocitySamplesRef.current.shift();
        }
      }
    };

    const handleMouseUp = () => {
      document.removeEventListener('mousemove', handleMouseMove);
      document.removeEventListener('mouseup', handleMouseUp);
      removeDragStyle();
      setIsDragging(false);

      if (hasMoved) {
        onDragEnd?.();
        const velocity = calculateVelocityFromSamples();
        const clamped = clampVelocity(velocity.x, velocity.y);
        const speed = Math.sqrt(clamped.vx * clamped.vx + clamped.vy * clamped.vy);

        if (speed > config.momentumThreshold) {
          animateMomentum(finalX, finalY, clamped.vx, clamped.vy, scale);
        } else {
          setPosition({ x: finalX, y: finalY });
        }
      }
    };

    document.addEventListener('mousemove', handleMouseMove);
    document.addEventListener('mouseup', handleMouseUp);
  };

  // Handle touch start - for mobile drag support
  const handleTouchStart = (e: React.TouchEvent) => {
    e.stopPropagation();
    if (e.touches.length !== 1) return; // Only single touch

    const touch = e.touches[0];
    const panel = panelRef.current;
    if (!panel) return;

    // Check if near edge for resize
    const rect = panel.getBoundingClientRect();
    const x = touch.clientX - rect.left;
    const y = touch.clientY - rect.top;

    const nearLeft = x < EDGE_THRESHOLD * 2; // Larger touch targets
    const nearRight = x > rect.width - EDGE_THRESHOLD * 2;
    const nearTop = y < EDGE_THRESHOLD * 2;
    const nearBottom = y > rect.height - EDGE_THRESHOLD * 2;

    let edge: ResizeEdge = null;
    if (nearTop && nearLeft) edge = 'nw';
    else if (nearTop && nearRight) edge = 'ne';
    else if (nearBottom && nearLeft) edge = 'sw';
    else if (nearBottom && nearRight) edge = 'se';
    else if (nearTop) edge = 'n';
    else if (nearBottom) edge = 's';
    else if (nearLeft) edge = 'w';
    else if (nearRight) edge = 'e';

    if (edge) {
      handleTouchResizeStart(touch as unknown as Touch, edge);
      return;
    }

    // Handle drag
    const wasAnimating = animationFrameRef.current !== null;
    if (animationFrameRef.current) {
      cancelAnimationFrame(animationFrameRef.current);
      animationFrameRef.current = null;
      isAnimatingRef.current = false;
    }

    const innerPanel = innerPanelRef.current;
    const scale = rect.width / panelWidth;

    let startCssX = wasAnimating ? (parseFloat(panel.style.left) || position.x) : position.x;
    let startCssY = wasAnimating ? (parseFloat(panel.style.top) || position.y) : position.y;
    if (wasAnimating) setPosition({ x: startCssX, y: startCssY });

    const grabOffsetX = touch.clientX - rect.left;
    const grabOffsetY = touch.clientY - rect.top;
    const startRectLeft = rect.left;
    const startRectTop = rect.top;

    let hasMoved = false;
    let finalX = startCssX;
    let finalY = startCssY;

    velocitySamplesRef.current = [{ x: startCssX, y: startCssY, t: performance.now() }];

    const applyDragStyle = () => {
      if (innerPanel) {
        innerPanel.style.transition = DRAG_TRANSITION;
        innerPanel.style.transform = `scale(${config.dragScale})`;
        innerPanel.style.boxShadow = DRAG_SHADOW;
      }
    };

    const removeDragStyle = () => {
      if (innerPanel) {
        innerPanel.style.transition = DRAG_TRANSITION;
        innerPanel.style.transform = 'scale(1)';
        innerPanel.style.boxShadow = IDLE_SHADOW;
      }
    };

    const handleTouchMove = (moveEvent: TouchEvent) => {
      if (moveEvent.touches.length !== 1) return;
      moveEvent.preventDefault();

      const moveTouch = moveEvent.touches[0];
      const targetViewportX = moveTouch.clientX - grabOffsetX;
      const targetViewportY = moveTouch.clientY - grabOffsetY;
      const viewportDeltaX = targetViewportX - startRectLeft;
      const viewportDeltaY = targetViewportY - startRectTop;
      const cssDeltaX = viewportDeltaX / scale;
      const cssDeltaY = viewportDeltaY / scale;

      if (!hasMoved && (Math.abs(cssDeltaX) > 2 || Math.abs(cssDeltaY) > 2)) {
        hasMoved = true;
        setIsDragging(true);
        applyDragStyle();
        onDragStart?.(id);
      }

      if (hasMoved) {
        const bounds = getViewportBounds(scale);
        finalX = Math.max(bounds.minX, Math.min(bounds.maxX, startCssX + cssDeltaX));
        finalY = Math.max(bounds.minY, Math.min(bounds.maxY, startCssY + cssDeltaY));

        // Play grid sounds as panel moves over grid dots
        const centerX = finalX + panelWidth / 2;
        const centerY = finalY + panelHeight / 2;
        const cellX = Math.floor(centerX / GRID_CELL_SIZE);
        const cellY = Math.floor(centerY / GRID_CELL_SIZE);
        const cellKey = `${cellX},${cellY}`;

        // Build current cell set
        const currentCell = new Set([cellKey]);

        // Play sound if this is a new cell
        if (!touchedGridCellsRef.current.has(cellKey)) {
          const now = performance.now();
          if (now - lastGridSoundTimeRef.current > 25) {
            const pitch = 1.0 + (Math.random() - 0.5) * 0.3;
            panelSounds.play(0.035, pitch);
            lastGridSoundTimeRef.current = now;
          }
        }

        // Update to current cell only
        touchedGridCellsRef.current = currentCell;

        panel.style.left = finalX + 'px';
        panel.style.top = finalY + 'px';
        onPositionChange?.(id, finalX, finalY);

        const now = performance.now();
        velocitySamplesRef.current.push({ x: finalX, y: finalY, t: now });
        if (velocitySamplesRef.current.length > config.velocitySampleCount) {
          velocitySamplesRef.current.shift();
        }
      }
    };

    const handleTouchEnd = () => {
      document.removeEventListener('touchmove', handleTouchMove);
      document.removeEventListener('touchend', handleTouchEnd);
      removeDragStyle();
      setIsDragging(false);

      if (hasMoved) {
        onDragEnd?.();
        const velocity = calculateVelocityFromSamples();
        const clamped = clampVelocity(velocity.x, velocity.y);
        const speed = Math.sqrt(clamped.vx * clamped.vx + clamped.vy * clamped.vy);

        if (speed > config.momentumThreshold) {
          animateMomentum(finalX, finalY, clamped.vx, clamped.vy, scale);
        } else {
          setPosition({ x: finalX, y: finalY });
        }
      }
    };

    document.addEventListener('touchmove', handleTouchMove, { passive: false });
    document.addEventListener('touchend', handleTouchEnd);
  };

  // Handle touch resize start
  const handleTouchResizeStart = (touch: Touch, edge: ResizeEdge) => {
    if (!edge) return;

    const panel = panelRef.current;
    if (!panel) return;

    setIsResizing(true);
    onDragStart?.(id);

    const startMouseX = touch.clientX;
    const startMouseY = touch.clientY;
    const startX = position.x;
    const startY = position.y;
    const startWidth = size.width;
    const startHeight = size.height;
    const startAspectRatio = startWidth / startHeight;

    const handleTouchResizeMove = (moveEvent: TouchEvent) => {
      if (moveEvent.touches.length !== 1) return;
      moveEvent.preventDefault();

      const moveTouch = moveEvent.touches[0];
      const deltaX = moveTouch.clientX - startMouseX;
      const deltaY = moveTouch.clientY - startMouseY;

      let newX = startX;
      let newY = startY;
      let newWidth = startWidth;
      let newHeight = startHeight;

      // Handle horizontal resizing
      if (edge.includes('e')) {
        newWidth = Math.max(MIN_SIZE, startWidth + deltaX);
      }
      if (edge.includes('w')) {
        const widthDelta = Math.min(deltaX, startWidth - MIN_SIZE);
        newWidth = startWidth - widthDelta;
        newX = startX + widthDelta;
      }

      // Handle vertical resizing
      if (edge.includes('s')) {
        newHeight = Math.max(MIN_SIZE, startHeight + deltaY);
      }
      if (edge.includes('n')) {
        const heightDelta = Math.min(deltaY, startHeight - MIN_SIZE);
        newHeight = startHeight - heightDelta;
        newY = startY + heightDelta;
      }

      // Ensure size is within bounds
      newWidth = Math.max(MIN_SIZE, Math.min(MAX_SIZE, newWidth));
      newHeight = Math.max(MIN_SIZE, Math.min(MAX_SIZE, newHeight));

      // Apply bounds
      const bounds = getViewportBounds(1);
      newX = Math.max(bounds.minX, newX);
      newY = Math.max(bounds.minY, newY);

      // Play grid sound when size crosses grid boundaries
      const widthCells = Math.floor(newWidth / GRID_CELL_SIZE);
      const heightCells = Math.floor(newHeight / GRID_CELL_SIZE);
      const sizeKey = `${widthCells},${heightCells}`;

      const currentSizeCell = new Set([sizeKey]);
      if (!touchedGridCellsRef.current.has(sizeKey)) {
        const now = performance.now();
        if (now - lastGridSoundTimeRef.current > 25) {
          const pitch = 1.0 + (Math.random() - 0.5) * 0.3;
          panelSounds.play(0.02, pitch); // Lower volume for resize
          lastGridSoundTimeRef.current = now;
        }
      }
      touchedGridCellsRef.current = currentSizeCell;

      // Update state
      setSize({ width: newWidth, height: newHeight });
      setPosition({ x: newX, y: newY });

      // Update DOM directly for smoothness
      panel.style.left = newX + 'px';
      panel.style.top = newY + 'px';
      panel.style.width = newWidth + 'px';
      panel.style.height = newHeight + 'px';

      // Notify parent
      onPositionChange?.(id, newX, newY);
      onSizeChange?.(id, newWidth, newHeight);
    };

    const handleTouchResizeEnd = () => {
      document.removeEventListener('touchmove', handleTouchResizeMove);
      document.removeEventListener('touchend', handleTouchResizeEnd);
      setIsResizing(false);
      onDragEnd?.();
    };

    document.addEventListener('touchmove', handleTouchResizeMove, { passive: false });
    document.addEventListener('touchend', handleTouchResizeEnd);
  };

  // Snap value to grid
  const snapToGrid = (value: number): number => {
    return Math.round(value / GRID_CELL_SIZE) * GRID_CELL_SIZE;
  };

  // Check if panel has been resized from original size
  const hasBeenResized = size.width !== originalSizeRef.current.width || size.height !== originalSizeRef.current.height;

  // Reset to default size (scale from center, animated)
  const handleResetSize = (e: React.MouseEvent) => {
    e.stopPropagation();
    const { width: newWidth, height: newHeight } = originalSizeRef.current;

    // Calculate new position to keep center fixed
    const centerX = position.x + size.width / 2;
    const centerY = position.y + size.height / 2;
    const newX = centerX - newWidth / 2;
    const newY = centerY - newHeight / 2;

    // Animate the transition
    const panel = panelRef.current;
    if (panel) {
      panel.style.transition = 'width 0.2s ease, height 0.2s ease, left 0.2s ease, top 0.2s ease';
      panel.style.width = newWidth + 'px';
      panel.style.height = newHeight + 'px';
      panel.style.left = newX + 'px';
      panel.style.top = newY + 'px';

      // Remove transition after animation completes
      setTimeout(() => {
        panel.style.transition = '';
      }, 200);
    }

    setSize({ width: newWidth, height: newHeight });
    setPosition({ x: newX, y: newY });
    onSizeChange?.(id, newWidth, newHeight);
    onPositionChange?.(id, newX, newY);
  };

  // Dismiss panel
  const handleDismiss = (e: React.MouseEvent) => {
    e.stopPropagation();
    onDismiss?.(id);
  };

  // Handle connection drag start (mouse)
  const handleConnectionDragStart = (e: React.MouseEvent) => {
    e.stopPropagation();
    e.preventDefault();

    const panel = panelRef.current;
    if (!panel) return;

    const rect = panel.getBoundingClientRect();
    // Connection starts from the right side of the panel (where the triangle icon is)
    const startX = rect.right - 10;
    const startY = rect.top + 10;

    onConnectionDragStart?.(id, startX, startY);

    const handleMouseMove = (moveEvent: MouseEvent) => {
      onConnectionDragMove?.(moveEvent.clientX, moveEvent.clientY);
    };

    const handleMouseUp = (upEvent: MouseEvent) => {
      document.removeEventListener('mousemove', handleMouseMove);
      document.removeEventListener('mouseup', handleMouseUp);

      // Check if we're over another panel
      const elementsAtPoint = document.elementsFromPoint(upEvent.clientX, upEvent.clientY);
      let targetPanelId: string | null = null;

      for (const el of elementsAtPoint) {
        const panelEl = el.closest('[data-panel-id]');
        if (panelEl) {
          const panelId = panelEl.getAttribute('data-panel-id');
          if (panelId && panelId !== id) {
            targetPanelId = panelId;
            break;
          }
        }
      }

      onConnectionDragEnd?.(id, targetPanelId, upEvent.clientX, upEvent.clientY);
    };

    document.addEventListener('mousemove', handleMouseMove);
    document.addEventListener('mouseup', handleMouseUp);
  };

  // Handle connection drag start (touch)
  const handleConnectionTouchStart = (e: React.TouchEvent) => {
    e.stopPropagation();
    if (e.touches.length !== 1) return;

    const touch = e.touches[0];
    const panel = panelRef.current;
    if (!panel) return;

    const rect = panel.getBoundingClientRect();
    const startX = rect.right - 10;
    const startY = rect.top + 10;

    onConnectionDragStart?.(id, startX, startY);

    const handleTouchMove = (moveEvent: TouchEvent) => {
      moveEvent.preventDefault();
      if (moveEvent.touches.length !== 1) return;
      const moveTouch = moveEvent.touches[0];
      onConnectionDragMove?.(moveTouch.clientX, moveTouch.clientY);
    };

    const handleTouchEnd = (endEvent: TouchEvent) => {
      document.removeEventListener('touchmove', handleTouchMove);
      document.removeEventListener('touchend', handleTouchEnd);

      const endTouch = endEvent.changedTouches[0];
      const elementsAtPoint = document.elementsFromPoint(endTouch.clientX, endTouch.clientY);
      let targetPanelId: string | null = null;

      for (const el of elementsAtPoint) {
        const panelEl = el.closest('[data-panel-id]');
        if (panelEl) {
          const panelId = panelEl.getAttribute('data-panel-id');
          if (panelId && panelId !== id) {
            targetPanelId = panelId;
            break;
          }
        }
      }

      onConnectionDragEnd?.(id, targetPanelId, endTouch.clientX, endTouch.clientY);
    };

    document.addEventListener('touchmove', handleTouchMove, { passive: false });
    document.addEventListener('touchend', handleTouchEnd);
  };

  // Handle resize start
  const handleResizeStart = (e: React.MouseEvent, edge: ResizeEdge) => {
    if (!edge) return;

    const panel = panelRef.current;
    if (!panel) return;

    setIsResizing(true);
    onDragStart?.(id); // Bring to top while resizing

    const startMouseX = e.clientX;
    const startMouseY = e.clientY;
    const startX = position.x;
    const startY = position.y;
    const startWidth = size.width;
    const startHeight = size.height;
    const startAspectRatio = startWidth / startHeight;

    const cursor = getCursor(edge);
    document.body.style.cursor = cursor;

    const handleResizeMove = (moveEvent: MouseEvent) => {
      const deltaX = moveEvent.clientX - startMouseX;
      const deltaY = moveEvent.clientY - startMouseY;
      const shiftHeld = moveEvent.shiftKey;
      const cmdHeld = moveEvent.metaKey;

      let newX = startX;
      let newY = startY;
      let newWidth = startWidth;
      let newHeight = startHeight;

      // When CMD is held, we scale from center so we need to double the delta
      // to keep the edge under the cursor
      const scaleFactor = cmdHeld ? 2 : 1;

      // Handle horizontal resizing
      if (edge.includes('e')) {
        newWidth = startWidth + deltaX * scaleFactor;
      }
      if (edge.includes('w')) {
        newWidth = startWidth - deltaX * scaleFactor;
      }

      // Handle vertical resizing
      if (edge.includes('s')) {
        newHeight = startHeight + deltaY * scaleFactor;
      }
      if (edge.includes('n')) {
        newHeight = startHeight - deltaY * scaleFactor;
      }

      // CMD held with corners: lock aspect ratio
      if (cmdHeld) {
        const isCorner = edge.length === 2; // 'ne', 'nw', 'se', 'sw'

        if (isCorner) {
          const widthChange = newWidth - startWidth;
          const heightChange = newHeight - startHeight;

          // Use the larger delta to determine size
          if (Math.abs(widthChange) > Math.abs(heightChange)) {
            newHeight = newWidth / startAspectRatio;
          } else {
            newWidth = newHeight * startAspectRatio;
          }
        }
      }

      // Shift held: snap to grid
      if (shiftHeld) {
        newWidth = Math.max(GRID_CELL_SIZE, snapToGrid(newWidth));
        newHeight = Math.max(GRID_CELL_SIZE, snapToGrid(newHeight));
      }

      // Ensure size is within bounds
      newWidth = Math.max(MIN_SIZE, Math.min(MAX_SIZE, newWidth));
      newHeight = Math.max(MIN_SIZE, Math.min(MAX_SIZE, newHeight));

      // Calculate position based on final clamped size
      if (cmdHeld) {
        // CMD held: scale from center
        const startCenterX = startX + startWidth / 2;
        const startCenterY = startY + startHeight / 2;
        newX = startCenterX - newWidth / 2;
        newY = startCenterY - newHeight / 2;
      } else {
        // Normal resize: anchor opposite edge
        if (edge.includes('w')) {
          newX = startX + startWidth - newWidth;
        }
        if (edge.includes('n')) {
          newY = startY + startHeight - newHeight;
        }
      }

      // Apply bounds
      const bounds = getViewportBounds(1);
      newX = Math.max(bounds.minX, newX);
      newY = Math.max(bounds.minY, newY);

      // Adjust size if position was clamped
      if (edge.includes('w') && newX === bounds.minX) {
        newWidth = startX + startWidth - bounds.minX;
      }
      if (edge.includes('n') && newY === bounds.minY) {
        newHeight = startY + startHeight - bounds.minY;
      }

      // Play grid sound when size crosses grid boundaries
      const widthCells = Math.floor(newWidth / GRID_CELL_SIZE);
      const heightCells = Math.floor(newHeight / GRID_CELL_SIZE);
      const sizeKey = `${widthCells},${heightCells}`;

      const currentSizeCell = new Set([sizeKey]);
      if (!touchedGridCellsRef.current.has(sizeKey)) {
        const now = performance.now();
        if (now - lastGridSoundTimeRef.current > 25) {
          const pitch = 1.0 + (Math.random() - 0.5) * 0.3;
          panelSounds.play(0.02, pitch); // Lower volume for resize
          lastGridSoundTimeRef.current = now;
        }
      }
      touchedGridCellsRef.current = currentSizeCell;

      // Update state
      setSize({ width: newWidth, height: newHeight });
      setPosition({ x: newX, y: newY });

      // Update DOM directly for smoothness
      panel.style.left = newX + 'px';
      panel.style.top = newY + 'px';
      panel.style.width = newWidth + 'px';
      panel.style.height = newHeight + 'px';

      // Notify parent
      onPositionChange?.(id, newX, newY);
      onSizeChange?.(id, newWidth, newHeight);
    };

    const handleResizeEnd = () => {
      document.removeEventListener('mousemove', handleResizeMove);
      document.removeEventListener('mouseup', handleResizeEnd);
      document.body.style.cursor = '';
      setIsResizing(false);
      onDragEnd?.();
    };

    document.addEventListener('mousemove', handleResizeMove);
    document.addEventListener('mouseup', handleResizeEnd);
  };

  // Cleanup
  useEffect(() => {
    return () => {
      if (animationFrameRef.current) cancelAnimationFrame(animationFrameRef.current);
    };
  }, []);

  // Dynamic border opacity based on hover state (subtle increase)
  const borderOpacity = isHovered || isResizing ? 0.16 : 0.1;

  return (
    <motion.div
      ref={panelRef}
      data-panel-id={id}
      onMouseDown={handleMouseDown}
      onMouseMove={handlePanelMouseMove}
      onMouseEnter={handlePanelMouseEnter}
      onMouseLeave={handlePanelMouseLeave}
      onTouchStart={handleTouchStart}
      onClick={(e) => e.stopPropagation()}
      initial={{ opacity: 0, scale: 0.8 }}
      animate={isExiting ? { opacity: 0, scale: 0.8 } : { opacity: 1, scale: 1 }}
      transition={{
        opacity: { duration: 0.15 },
        scale: { type: 'spring', stiffness: 500, damping: 25 },
      }}
      style={{
        position: 'fixed',
        userSelect: 'none',
        left: position.x,
        top: position.y,
        width: panelWidth,
        height: panelHeight,
        zIndex: isDragging || isResizing ? 2147483647 : (isTopPanel ? 2147483646 : 2147483645),
        cursor: resizeEdge ? getCursor(resizeEdge) : 'default',
      }}
    >
      <div
        ref={innerPanelRef}
        style={{
          width: '100%',
          height: '100%',
          borderRadius: 12,
          position: 'relative',
          backgroundColor: '#2a2a2a',
          boxShadow: IDLE_SHADOW,
          border: `1px solid rgba(255, 255, 255, ${borderOpacity})`,
          transition: 'border-color 0.2s ease',
        }}
      >
        {/* Control icons - top right */}
        <div
          style={{
            position: 'absolute',
            top: 7,
            right: 7,
            display: 'flex',
            gap: 0,
            opacity: (isHovered || isResizing || isTouchDevice) ? 1 : 0,
            transition: 'opacity 0.2s ease',
            pointerEvents: (isHovered || isResizing || isTouchDevice) ? 'auto' : 'none',
          }}
        >
          {/* Reset size - only visible after resizing */}
          {hasBeenResized && (
            <button
              onClick={handleResetSize}
              onMouseDown={(e) => e.stopPropagation()}
              onMouseEnter={(e) => {
                const span = e.currentTarget.querySelector('span');
                if (span) span.style.backgroundColor = '#808080';
              }}
              onMouseLeave={(e) => {
                const span = e.currentTarget.querySelector('span');
                if (span) span.style.backgroundColor = '#444444';
              }}
              style={{
                width: 16,
                height: 16,
                border: 'none',
                borderRadius: 4,
                backgroundColor: 'transparent',
                cursor: 'pointer',
                padding: 0,
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
              }}
              title="Reset size"
            >
              <span
                style={{
                  width: 10,
                  height: 10,
                  borderRadius: 2,
                  backgroundColor: '#444444',
                  transition: 'background-color 0.2s ease',
                  display: 'block',
                  pointerEvents: 'none',
                }}
              />
            </button>
          )}
          {/* Dismiss button - filled circle */}
          <button
            onClick={handleDismiss}
            onMouseDown={(e) => e.stopPropagation()}
            onMouseEnter={(e) => {
              const span = e.currentTarget.querySelector('span');
              if (span) span.style.backgroundColor = '#808080';
            }}
            onMouseLeave={(e) => {
              const span = e.currentTarget.querySelector('span');
              if (span) span.style.backgroundColor = '#444444';
            }}
            style={{
              width: 16,
              height: 16,
              border: 'none',
              borderRadius: 4,
              backgroundColor: 'transparent',
              cursor: 'pointer',
              padding: 0,
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
            }}
            title="Dismiss"
          >
            <span
              style={{
                width: 10,
                height: 10,
                borderRadius: '50%',
                backgroundColor: '#444444',
                transition: 'background-color 0.2s ease',
                display: 'block',
                pointerEvents: 'none',
              }}
            />
          </button>
        </div>

        {/* Connection button - bottom right, always visible on hover */}
        <button
          onMouseDown={handleConnectionDragStart}
          onTouchStart={handleConnectionTouchStart}
          onMouseEnter={(e) => {
            const rect = e.currentTarget.querySelector('rect');
            if (rect) rect.style.stroke = '#808080';
          }}
          onMouseLeave={(e) => {
            const rect = e.currentTarget.querySelector('rect');
            if (rect) rect.style.stroke = '#444444';
          }}
          style={{
            position: 'absolute',
            bottom: 7,
            right: 7,
            width: 16,
            height: 16,
            border: 'none',
            borderRadius: 4,
            backgroundColor: 'transparent',
            cursor: 'crosshair',
            padding: 0,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            opacity: (isHovered || isResizing || isTouchDevice) ? 1 : 0,
            transition: 'opacity 0.2s ease',
            pointerEvents: (isHovered || isResizing || isTouchDevice) ? 'auto' : 'none',
          }}
          title="Drag to connect"
        >
          <svg width="10" height="10" viewBox="0 0 10 10" style={{ pointerEvents: 'none' }}>
            <rect
              x="1"
              y="1"
              width="8"
              height="8"
              fill="none"
              stroke="#444444"
              strokeWidth="1.5"
              rx="1"
              style={{ transition: 'stroke 0.2s ease' }}
            />
          </svg>
        </button>
      </div>
    </motion.div>
  );
}

// ============================================================================
// MAIN PAGE
// ============================================================================

// WebGL Noise Shader Overlay
function NoiseOverlay() {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [mounted, setMounted] = useState(false);
  const [ready, setReady] = useState(false);

  // Delay mounting to prevent flash
  useEffect(() => {
    const timer = setTimeout(() => setMounted(true), 250);
    return () => clearTimeout(timer);
  }, []);

  useEffect(() => {
    if (!mounted) return;
    const canvas = canvasRef.current;
    if (!canvas) return;

    const gl = canvas.getContext('webgl');
    if (!gl) return;

    // Vertex shader
    const vertexShaderSource = `
      attribute vec2 a_position;
      void main() {
        gl_Position = vec4(a_position, 0.0, 1.0);
      }
    `;

    // Fragment shader with film grain noise
    const fragmentShaderSource = `
      precision highp float;
      uniform vec2 u_resolution;
      uniform float u_time;

      float random(vec2 st) {
        return fract(sin(dot(st.xy, vec2(12.9898, 78.233))) * 43758.5453123);
      }

      void main() {
        vec2 st = gl_FragCoord.xy / u_resolution;

        // Animated noise
        float noise = random(st * 1000.0 + u_time * 0.1);

        // Film grain
        float grain = noise * 0.35;

        gl_FragColor = vec4(vec3(grain), grain);
      }
    `;

    // Compile shaders
    const compileShader = (source: string, type: number) => {
      const shader = gl.createShader(type)!;
      gl.shaderSource(shader, source);
      gl.compileShader(shader);
      return shader;
    };

    const vertexShader = compileShader(vertexShaderSource, gl.VERTEX_SHADER);
    const fragmentShader = compileShader(fragmentShaderSource, gl.FRAGMENT_SHADER);

    // Create program
    const program = gl.createProgram()!;
    gl.attachShader(program, vertexShader);
    gl.attachShader(program, fragmentShader);
    gl.linkProgram(program);
    gl.useProgram(program);

    // Set up geometry (full screen quad)
    const positions = new Float32Array([-1, -1, 1, -1, -1, 1, 1, 1]);
    const buffer = gl.createBuffer();
    gl.bindBuffer(gl.ARRAY_BUFFER, buffer);
    gl.bufferData(gl.ARRAY_BUFFER, positions, gl.STATIC_DRAW);

    const positionLocation = gl.getAttribLocation(program, 'a_position');
    gl.enableVertexAttribArray(positionLocation);
    gl.vertexAttribPointer(positionLocation, 2, gl.FLOAT, false, 0, 0);

    // Get uniform locations
    const resolutionLocation = gl.getUniformLocation(program, 'u_resolution');
    const timeLocation = gl.getUniformLocation(program, 'u_time');

    // Animation loop
    let animationId: number;
    let frameCount = 0;
    const render = (time: number) => {
      canvas.width = window.innerWidth;
      canvas.height = window.innerHeight;
      gl.viewport(0, 0, canvas.width, canvas.height);

      gl.uniform2f(resolutionLocation, canvas.width, canvas.height);
      gl.uniform1f(timeLocation, time * 0.001);

      gl.drawArrays(gl.TRIANGLE_STRIP, 0, 4);

      // Mark ready after a couple frames to ensure stable rendering
      frameCount++;
      if (frameCount === 3) {
        setReady(true);
      }

      animationId = requestAnimationFrame(render);
    };

    animationId = requestAnimationFrame(render);

    return () => cancelAnimationFrame(animationId);
  }, [mounted]);

  if (!mounted) return null;

  return (
    <canvas
      ref={canvasRef}
      style={{
        position: 'fixed',
        top: 0,
        left: 0,
        right: 0,
        bottom: 0,
        pointerEvents: 'none',
        zIndex: 1,
        mixBlendMode: 'overlay',
        opacity: ready ? 1 : 0,
        transition: 'opacity 1s ease-out'
      }}
    />
  );
}

// Dynamic dot grid canvas component with spring physics
type PulseEvent = {
  x: number;
  y: number;
  time: number;
  intensity: number; // 0-1 based on impact force
};

// Particle shape types
type ParticleShape = 'circle' | 'triangle' | 'square';
type ParticleColor = 'cyan' | 'blue';

// Particle type for impact explosions
interface Particle {
  x: number;
  y: number;
  vx: number;
  vy: number;
  rotation: number;
  rotationSpeed: number;
  size: number;
  opacity: number;
  life: number;
  maxLife: number;
  shape: ParticleShape;
  color?: ParticleColor;
}

// Floating panel data
interface FloatingPanelData {
  id: string;
  x: number;
  y: number;
  width: number;
  height: number;
  isExiting?: boolean;
}

// Connection between two panels
interface PanelConnection {
  id: string;
  fromPanelId: string;
  toPanelId: string;
}

// Active connection drag state
interface ConnectionDrag {
  fromPanelId: string;
  fromX: number;
  fromY: number;
  toX: number;
  toY: number;
  targetPanelId: string | null;
}

// Slice trail point
interface SlicePoint {
  x: number;
  y: number;
  time: number;
}

// Cut connection for retraction animation
interface CutConnection {
  id: string;
  fromPanelId: string;
  toPanelId: string;
  cutX: number;
  cutY: number;
  cutTime: number;
}

function DotGridCanvas({ panelX, panelY, panelWidth, panelHeight, pulses, mousePos, panels, connections, connectionDrag, sliceTrail, cutConnections, onCutAnimationComplete }: { panelX: number; panelY: number; panelWidth: number; panelHeight: number; pulses: PulseEvent[]; mousePos: { x: number; y: number } | null; panels: FloatingPanelData[]; connections: PanelConnection[]; connectionDrag: ConnectionDrag | null; sliceTrail: SlicePoint[]; cutConnections: CutConnection[]; onCutAnimationComplete: (id: string) => void }) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const animationRef = useRef<number | null>(null);
  const dotsRef = useRef<Map<string, { x: number; y: number; vx: number; vy: number; size: number; targetSize: number; brightness: number }>>(new Map());
  const lastPanelRef = useRef({ x: panelX, y: panelY, width: panelWidth, height: panelHeight });
  const pulsesRef = useRef<PulseEvent[]>(pulses);
  const mousePosRef = useRef<{ x: number; y: number } | null>(mousePos);
  const panelsRef = useRef<FloatingPanelData[]>(panels);
  const connectionsRef = useRef<PanelConnection[]>(connections);
  const connectionDragRef = useRef<ConnectionDrag | null>(connectionDrag);
  const sliceTrailRef = useRef<SlicePoint[]>(sliceTrail);
  const cutConnectionsRef = useRef<CutConnection[]>(cutConnections);
  const onCutAnimationCompleteRef = useRef(onCutAnimationComplete);

  // Update connectionDrag ref immediately (not waiting for effect) for faster line drawing
  connectionDragRef.current = connectionDrag;
  const lastPanelPositionsRef = useRef<Map<string, { x: number; y: number }>>(new Map());
  const panelVelocitiesRef = useRef<Map<string, { vx: number; vy: number }>>(new Map());
  const particlesRef = useRef<Particle[]>([]);
  const bouncyParticlesRef = useRef<Particle[]>([]);
  const lastPulseTimeRef = useRef(0);
  const lastParticleSoundTimeRef = useRef(0);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    const gridSize = 40;
    const maxDist = 400;
    const pushStrength = 25;
    const springStiffness = 0.08;
    const damping = 0.75;
    const parallaxFactor = 0.08;

    // Triangle particle settings
    const particleCount = 12; // Triangles per explosion
    const particleSpeed = 8; // Base velocity
    const particleGravity = 0.15;
    const particleFriction = 0.98;
    const particleLifespan = 1200; // ms

    // Bouncy particle settings (these bounce off the panel)
    const bouncyParticleCount = 16;
    const bouncyParticleSpeed = 6;
    const bouncyParticleGravity = 0.12;
    const bouncyParticleFriction = 0.99;
    const bouncyParticleLifespan = 2500; // longer life to see bounces
    const bouncyBounceDamping = 0.7; // energy loss on bounce
    const bouncySurfaceFriction = 0.6; // friction when resting on panel
    const particleCollisionDamping = 0.8; // energy loss on particle-particle collision


    // Random shape picker
    const randomShape = (): ParticleShape => {
      const shapes: ParticleShape[] = ['circle', 'triangle', 'square'];
      return shapes[Math.floor(Math.random() * shapes.length)];
    };

    // Spawn particles at impact point (regular - no collision)
    const spawnParticles = (x: number, y: number, intensity: number) => {
      const count = Math.floor(particleCount * (0.5 + intensity * 0.5));
      for (let i = 0; i < count; i++) {
        const angle = (Math.PI * 2 * i) / count + (Math.random() - 0.5) * 0.5;
        const speed = particleSpeed * (0.5 + Math.random() * 0.5) * intensity;
        particlesRef.current.push({
          x,
          y,
          vx: Math.cos(angle) * speed,
          vy: Math.sin(angle) * speed,
          rotation: Math.random() * Math.PI * 2,
          rotationSpeed: (Math.random() - 0.5) * 0.3,
          size: 3 + Math.random() * 4 * intensity,
          opacity: 0.8 + Math.random() * 0.2,
          life: particleLifespan,
          maxLife: particleLifespan,
          shape: randomShape(),
        });
      }
    };

    // Spawn bouncy particles that collide with the panel
    const spawnBouncyParticles = (x: number, y: number, intensity: number) => {
      const count = Math.floor(bouncyParticleCount * (0.5 + intensity * 0.5));
      for (let i = 0; i < count; i++) {
        const angle = (Math.PI * 2 * i) / count + (Math.random() - 0.5) * 0.8;
        const speed = bouncyParticleSpeed * (0.7 + Math.random() * 0.6) * intensity;
        // 40% chance of blue particles (smaller, pulse-colored)
        const isBlue = Math.random() < 0.4;
        const color: ParticleColor = isBlue ? 'blue' : 'cyan';
        // Blue particles are smaller
        const size = isBlue
          ? 1 + Math.random() * 2 * intensity  // 1-3 for blue
          : 2 + Math.random() * 4 * intensity; // 2-6 for cyan
        bouncyParticlesRef.current.push({
          x,
          y,
          vx: Math.cos(angle) * speed,
          vy: Math.sin(angle) * speed,
          rotation: Math.random() * Math.PI * 2,
          rotationSpeed: (Math.random() - 0.5) * 0.2,
          size,
          opacity: 0.9,
          life: bouncyParticleLifespan,
          maxLife: bouncyParticleLifespan,
          shape: randomShape(),
          color,
        });
      }
    };

    // Draw rounded triangle
    const drawRoundedTriangle = (ctx: CanvasRenderingContext2D, size: number, radius: number) => {
      const h = size * 0.866; // height factor
      const points = [
        { x: 0, y: -size },
        { x: -h, y: size * 0.5 },
        { x: h, y: size * 0.5 }
      ];

      ctx.beginPath();
      for (let i = 0; i < 3; i++) {
        const curr = points[i];
        const next = points[(i + 1) % 3];
        const prev = points[(i + 2) % 3];

        // Direction vectors
        const dx1 = curr.x - prev.x;
        const dy1 = curr.y - prev.y;
        const dx2 = next.x - curr.x;
        const dy2 = next.y - curr.y;

        const len1 = Math.sqrt(dx1 * dx1 + dy1 * dy1);
        const len2 = Math.sqrt(dx2 * dx2 + dy2 * dy2);

        // Points offset from corner
        const offset = Math.min(radius, len1 / 2, len2 / 2);
        const p1x = curr.x - (dx1 / len1) * offset;
        const p1y = curr.y - (dy1 / len1) * offset;
        const p2x = curr.x + (dx2 / len2) * offset;
        const p2y = curr.y + (dy2 / len2) * offset;

        if (i === 0) ctx.moveTo(p1x, p1y);
        else ctx.lineTo(p1x, p1y);
        ctx.quadraticCurveTo(curr.x, curr.y, p2x, p2y);
      }
      ctx.closePath();
    };

    // Draw rounded square
    const drawRoundedSquare = (ctx: CanvasRenderingContext2D, size: number, radius: number) => {
      const half = size * 0.7;
      const r = Math.min(radius, half);
      ctx.beginPath();
      ctx.moveTo(-half + r, -half);
      ctx.lineTo(half - r, -half);
      ctx.quadraticCurveTo(half, -half, half, -half + r);
      ctx.lineTo(half, half - r);
      ctx.quadraticCurveTo(half, half, half - r, half);
      ctx.lineTo(-half + r, half);
      ctx.quadraticCurveTo(-half, half, -half, half - r);
      ctx.lineTo(-half, -half + r);
      ctx.quadraticCurveTo(-half, -half, -half + r, -half);
      ctx.closePath();
    };

    // Draw a single particle (blue - regular, fades)
    const drawParticle = (ctx: CanvasRenderingContext2D, p: Particle) => {
      ctx.save();
      ctx.translate(p.x, p.y);
      ctx.rotate(p.rotation);

      const lifeRatio = p.life / p.maxLife;
      const alpha = p.opacity * lifeRatio;

      ctx.fillStyle = `rgba(37, 99, 235, ${alpha})`;
      ctx.strokeStyle = `rgba(100, 160, 255, ${alpha * 0.8})`;
      ctx.lineWidth = 0.5;

      if (p.shape === 'circle') {
        ctx.beginPath();
        ctx.arc(0, 0, p.size * 0.6, 0, Math.PI * 2);
        ctx.closePath();
      } else if (p.shape === 'triangle') {
        drawRoundedTriangle(ctx, p.size, p.size * 0.3);
      } else {
        drawRoundedSquare(ctx, p.size, p.size * 0.25);
      }

      ctx.fill();
      ctx.stroke();
      ctx.restore();
    };

    // Draw bouncy particle (cyan or blue variant)
    const drawBouncyParticle = (ctx: CanvasRenderingContext2D, p: Particle) => {
      ctx.save();
      ctx.translate(p.x, p.y);
      ctx.rotate(p.rotation);

      const alpha = p.opacity;

      if (p.color === 'blue') {
        // Pulse blue color (#2563EB = rgb(37, 99, 235))
        ctx.fillStyle = `rgba(37, 99, 235, ${alpha * 0.95})`;
        ctx.strokeStyle = `rgba(100, 160, 255, ${alpha * 0.8})`;
        ctx.lineWidth = 0.5;
      } else {
        // Cyan/white (original)
        ctx.fillStyle = `rgba(150, 220, 255, ${alpha * 0.9})`;
        ctx.strokeStyle = `rgba(220, 240, 255, ${alpha})`;
        ctx.lineWidth = 0.8;
      }

      if (p.shape === 'circle') {
        ctx.beginPath();
        ctx.arc(0, 0, p.size * 0.6, 0, Math.PI * 2);
        ctx.closePath();
      } else if (p.shape === 'triangle') {
        drawRoundedTriangle(ctx, p.size, p.size * 0.3);
      } else {
        drawRoundedSquare(ctx, p.size, p.size * 0.25);
      }

      ctx.fill();
      ctx.stroke();
      ctx.restore();
    };

    // Update particle physics (regular - no collision)
    const updateParticles = (deltaTime: number) => {
      particlesRef.current = particlesRef.current.filter(p => {
        p.life -= deltaTime;
        if (p.life <= 0) return false;

        p.vy += particleGravity;
        p.vx *= particleFriction;
        p.vy *= particleFriction;
        p.x += p.vx;
        p.y += p.vy;
        p.rotation += p.rotationSpeed;

        return true;
      });
    };

    // Update bouncy particles with collision against ALL floating panels
    const updateBouncyParticles = (deltaTime: number) => {
      const particles = bouncyParticlesRef.current;
      const floatingPanels = panelsRef.current;

      // Calculate panel velocities by comparing with last positions
      for (const fp of floatingPanels) {
        const lastPos = lastPanelPositionsRef.current.get(fp.id);
        if (lastPos) {
          panelVelocitiesRef.current.set(fp.id, {
            vx: fp.x - lastPos.x,
            vy: fp.y - lastPos.y
          });
        } else {
          panelVelocitiesRef.current.set(fp.id, { vx: 0, vy: 0 });
        }
        lastPanelPositionsRef.current.set(fp.id, { x: fp.x, y: fp.y });
      }

      // Particle-to-particle collision
      for (let i = 0; i < particles.length; i++) {
        for (let j = i + 1; j < particles.length; j++) {
          const p1 = particles[i];
          const p2 = particles[j];

          const dx = p2.x - p1.x;
          const dy = p2.y - p1.y;
          const dist = Math.sqrt(dx * dx + dy * dy);
          const minDist = (p1.size + p2.size) * 0.6;

          if (dist < minDist && dist > 0) {
            const overlap = minDist - dist;
            const nx = dx / dist;
            const ny = dy / dist;

            p1.x -= nx * overlap * 0.5;
            p1.y -= ny * overlap * 0.5;
            p2.x += nx * overlap * 0.5;
            p2.y += ny * overlap * 0.5;

            const dvx = p1.vx - p2.vx;
            const dvy = p1.vy - p2.vy;
            const dvn = dvx * nx + dvy * ny;

            if (dvn > 0) {
              const impulse = dvn * particleCollisionDamping;
              p1.vx -= impulse * nx;
              p1.vy -= impulse * ny;
              p2.vx += impulse * nx;
              p2.vy += impulse * ny;

              p1.rotationSpeed += (Math.random() - 0.5) * 0.1;
              p2.rotationSpeed += (Math.random() - 0.5) * 0.1;
            }
          }
        }
      }

      bouncyParticlesRef.current = particles.filter(p => {
        // Remove if way off screen
        if (p.y > height + 200 || p.x < -200 || p.x > width + 200) return false;

        // Apply gravity and friction first
        p.vy += bouncyParticleGravity;
        p.vx *= bouncyParticleFriction;
        p.vy *= bouncyParticleFriction;

        const pad = p.size * 0.9;
        let collided = false;
        let collisionSpeed = 0;
        let restingOnPanel: { fp: FloatingPanelData; panelVel: { vx: number; vy: number }; collisionTop: number; panelLeft: number; panelRight: number } | null = null;

        // FIRST PASS: Check ALL panels for collisions (including panels moving into resting particles)
        for (const fp of floatingPanels) {
          const panelLeft = fp.x;
          const panelRight = fp.x + fp.width;
          const panelTop = fp.y;
          const panelBottom = fp.y + fp.height;

          const panelVel = panelVelocitiesRef.current.get(fp.id) || { vx: 0, vy: 0 };

          const collisionLeft = panelLeft - pad;
          const collisionRight = panelRight + pad;
          const collisionTop = panelTop - pad;
          const collisionBottom = panelBottom + pad;

          const nextX = p.x + p.vx;
          const nextY = p.y + p.vy;

          const isInX = p.x > collisionLeft && p.x < collisionRight;
          const isInY = p.y > collisionTop && p.y < collisionBottom;
          const wouldBeInX = nextX > collisionLeft && nextX < collisionRight;
          const wouldBeInY = nextY > collisionTop && nextY < collisionBottom;

          // Check if this panel is moving into the particle (active collision from panel)
          const panelSpeed = Math.sqrt(panelVel.vx * panelVel.vx + panelVel.vy * panelVel.vy);
          const panelMovingIntoParticle = panelSpeed > 0.5 && (
            (panelVel.vx > 0 && p.x > panelRight - 20 && p.x < panelRight + pad + 10 && isInY) || // Panel moving right into particle
            (panelVel.vx < 0 && p.x < panelLeft + 20 && p.x > panelLeft - pad - 10 && isInY) ||  // Panel moving left into particle
            (panelVel.vy > 0 && p.y > panelBottom - 20 && p.y < panelBottom + pad + 10 && isInX) || // Panel moving down into particle
            (panelVel.vy < 0 && p.y < panelTop + 20 && p.y > panelTop - pad - 10 && isInX)  // Panel moving up into particle
          );

          // Collision detection
          if (panelMovingIntoParticle || (wouldBeInX && wouldBeInY) || (isInX && isInY)) {
            const distLeft = Math.abs(p.x - collisionLeft);
            const distRight = Math.abs(p.x - collisionRight);
            const distTop = Math.abs(p.y - collisionTop);
            const distBottom = Math.abs(p.y - collisionBottom);

            const minDist = Math.min(distLeft, distRight, distTop, distBottom);

            const minAngle = 1 * Math.PI / 180;
            const maxAngle = 3 * Math.PI / 180;
            const randomAngle = (minAngle + Math.random() * (maxAngle - minAngle)) * (Math.random() < 0.5 ? 1 : -1);

            const momentumTransfer = 0.8;

            if (minDist === distLeft) {
              const speed = Math.sqrt(p.vx * p.vx + p.vy * p.vy);
              const angle = Math.atan2(p.vy, -p.vx) + randomAngle;
              p.vx = Math.cos(angle) * speed * bouncyBounceDamping + panelVel.vx * momentumTransfer;
              p.vy = Math.sin(angle) * speed * bouncyBounceDamping + panelVel.vy * momentumTransfer;
              p.x = collisionLeft - 1;
              p.rotationSpeed = -p.rotationSpeed * 1.2;
              collided = true;
              collisionSpeed = speed;
              break;
            } else if (minDist === distRight) {
              const speed = Math.sqrt(p.vx * p.vx + p.vy * p.vy);
              const angle = Math.atan2(p.vy, -p.vx) + randomAngle;
              p.vx = Math.cos(angle) * speed * bouncyBounceDamping + panelVel.vx * momentumTransfer;
              p.vy = Math.sin(angle) * speed * bouncyBounceDamping + panelVel.vy * momentumTransfer;
              p.x = collisionRight + 1;
              p.rotationSpeed = -p.rotationSpeed * 1.2;
              collided = true;
              collisionSpeed = speed;
              break;
            } else if (minDist === distTop) {
              // Check if should rest on top instead of bounce
              const shouldRest = p.vy >= 0 && Math.abs(p.vy) < 1.5 && panelVel.vy >= -5;
              if (shouldRest) {
                restingOnPanel = { fp, panelVel, collisionTop, panelLeft, panelRight };
              } else {
                const speed = Math.sqrt(p.vx * p.vx + p.vy * p.vy);
                const angle = Math.atan2(-p.vy, p.vx) + randomAngle;
                p.vx = Math.cos(angle) * speed * bouncyBounceDamping + panelVel.vx * momentumTransfer;
                p.vy = Math.sin(angle) * speed * bouncyBounceDamping + panelVel.vy * momentumTransfer;
                p.y = collisionTop - 1;
                p.rotationSpeed = -p.rotationSpeed * 1.2;
                collided = true;
                collisionSpeed = speed;
                break;
              }
            } else {
              const speed = Math.sqrt(p.vx * p.vx + p.vy * p.vy);
              const angle = Math.atan2(-p.vy, p.vx) + randomAngle;
              p.vx = Math.cos(angle) * speed * bouncyBounceDamping + panelVel.vx * momentumTransfer;
              p.vy = Math.sin(angle) * speed * bouncyBounceDamping + panelVel.vy * momentumTransfer;
              p.y = collisionBottom + 1;
              p.rotationSpeed = -p.rotationSpeed * 1.2;
              collided = true;
              collisionSpeed = speed;
              break;
            }
          }
        }

        // Play subtle collision sound (only for significant impacts, throttled)
        if (collided && collisionSpeed > 2.5) {
          const now = performance.now();
          if (now - lastParticleSoundTimeRef.current > 20) { // Min 20ms between sounds
            const normalizedSpeed = Math.min((collisionSpeed - 2.5) / 8, 1);
            const volume = 0.01 + normalizedSpeed * 0.03; // Very subtle: 0.01 to 0.04
            panelSounds.play(volume);
            lastParticleSoundTimeRef.current = now;
          }
        }

        // SECOND PASS: Handle resting on panel (only if no collision occurred)
        if (!collided && restingOnPanel) {
          const { panelVel, collisionTop, panelLeft, panelRight } = restingOnPanel;

          if (panelVel.vy < -5) {
            // Panel moving up fast - launch particle (with clamped velocity)
            const launchStrength = 0.4;
            const maxLaunchVel = 8;
            p.vx += Math.max(-maxLaunchVel, Math.min(maxLaunchVel, panelVel.vx * launchStrength));
            p.vy = Math.max(-maxLaunchVel, panelVel.vy * launchStrength);
            p.rotationSpeed += (Math.random() - 0.5) * 0.2;
          } else {
            // Rest on panel
            p.vx = panelVel.vx + (p.vx - panelVel.vx) * bouncySurfaceFriction;
            p.vy = 0;
            p.y = collisionTop - 1;
            p.rotationSpeed *= 0.85;

            const margin = pad + 2;
            if (p.x < panelLeft + margin) {
              p.x = panelLeft + margin;
              p.vx = Math.max(panelVel.vx, p.vx);
            }
            if (p.x > panelRight - margin) {
              p.x = panelRight - margin;
              p.vx = Math.min(panelVel.vx, p.vx);
            }
          }

          p.x += p.vx;
          p.rotation += p.rotationSpeed;
          return true;
        }

        // Move particle
        p.x += p.vx;
        p.y += p.vy;
        p.rotation += p.rotationSpeed;

        return true;
      });
    };

    let width = window.innerWidth;
    let height = window.innerHeight;
    canvas.width = width;
    canvas.height = height;

    // Initialize dots
    const initDots = () => {
      dotsRef.current.clear();
      for (let gx = -gridSize; gx < width + gridSize * 2; gx += gridSize) {
        for (let gy = -gridSize; gy < height + gridSize * 2; gy += gridSize) {
          const key = `${gx},${gy}`;
          dotsRef.current.set(key, { x: gx, y: gy, vx: 0, vy: 0, size: 1, targetSize: 1, brightness: 1 });
        }
      }
    };

    initDots();

    let lastTime = performance.now();

    const animate = () => {
      const now = performance.now();
      const deltaTime = now - lastTime;
      lastTime = now;

      // Check for new pulses and spawn particles
      for (const pulse of pulsesRef.current) {
        if (pulse.time > lastPulseTimeRef.current) {
          spawnParticles(pulse.x, pulse.y, pulse.intensity);
          spawnBouncyParticles(pulse.x, pulse.y, pulse.intensity);
          lastPulseTimeRef.current = pulse.time;
        }
      }

      // Update particles
      updateParticles(deltaTime);

      const currentPanel = lastPanelRef.current;

      // No parallax offset - grid stays centered (main panel removed)
      const offsetX = 0;
      const offsetY = 0;

      const panelLeft = currentPanel.x;
      const panelRight = currentPanel.x + currentPanel.width;
      const panelTop = currentPanel.y;
      const panelBottom = currentPanel.y + currentPanel.height;

      ctx.clearRect(0, 0, width, height);

      // Pulse settings
      const pulseSpeed = 400; // pixels per second
      const pulseWidth = 80; // width of the pulse wave
      const pulseDuration = 2000; // how long pulse lasts in ms
      const denseGridSize = gridSize / 2; // Hidden dense grid at half spacing

      // Calculate pulse intensity at a given point (factors in impact force)
      const getPulseIntensity = (x: number, y: number) => {
        let maxIntensity = 0;
        for (const pulse of pulsesRef.current) {
          const age = now - pulse.time;
          if (age > pulseDuration) continue;

          // Scale pulse speed and width by impact intensity
          const intensityScale = 0.5 + pulse.intensity * 0.5; // 0.5-1.0 range
          const scaledSpeed = pulseSpeed * intensityScale;
          const scaledWidth = pulseWidth * intensityScale;

          const radius = (age / 1000) * scaledSpeed;
          const distFromPulse = Math.sqrt((x - pulse.x) ** 2 + (y - pulse.y) ** 2);
          const distFromWave = Math.abs(distFromPulse - radius);

          if (distFromWave < scaledWidth) {
            const waveIntensity = 1 - (distFromWave / scaledWidth);
            const fadeOut = 1 - (age / pulseDuration);
            // Multiply by impact intensity for force-reactive pulses
            maxIntensity = Math.max(maxIntensity, waveIntensity * fadeOut * pulse.intensity);
          }
        }
        return maxIntensity;
      };

      // Calculate hover glow intensity at a given point
      const getHoverIntensity = (x: number, y: number) => {
        const mouse = mousePosRef.current;
        if (!mouse) return 0;

        const hoverRadius = 120; // Radius of the hover glow
        const dx = x - mouse.x;
        const dy = y - mouse.y;
        const dist = Math.sqrt(dx * dx + dy * dy);

        if (dist > hoverRadius) return 0;

        // Smooth falloff
        const intensity = Math.pow(1 - dist / hoverRadius, 2);
        return intensity * 0.6; // Max hover intensity
      };

      // Helper to calculate push from a single panel
      const getPanelPush = (baseX: number, baseY: number, pLeft: number, pRight: number, pTop: number, pBottom: number) => {
        const closestX = Math.max(pLeft, Math.min(baseX, pRight));
        const closestY = Math.max(pTop, Math.min(baseY, pBottom));
        const dx = baseX - closestX;
        const dy = baseY - closestY;
        const dist = Math.sqrt(dx * dx + dy * dy);
        const normalizedDist = Math.min(dist / maxDist, 1);
        const pushAmount = dist > 0 ? Math.pow(1 - normalizedDist, 2) * pushStrength : 0;
        const pushX = dist > 0 ? (dx / dist) * pushAmount : 0;
        const pushY = dist > 0 ? (dy / dist) * pushAmount : 0;
        return { x: pushX, y: pushY };
      };

      // Helper to calculate displaced position from ALL panels (main + floating)
      const getDisplacedPosition = (baseX: number, baseY: number) => {
        // Start with push from main panel
        let totalPushX = 0;
        let totalPushY = 0;

        const mainPush = getPanelPush(baseX, baseY, panelLeft, panelRight, panelTop, panelBottom);
        totalPushX += mainPush.x;
        totalPushY += mainPush.y;

        // Add push from all floating panels
        const floatingPanels = panelsRef.current;
        for (const fp of floatingPanels) {
          const fpPush = getPanelPush(baseX, baseY, fp.x, fp.x + fp.width, fp.y, fp.y + fp.height);
          totalPushX += fpPush.x;
          totalPushY += fpPush.y;
        }

        return { x: baseX + totalPushX, y: baseY + totalPushY };
      };

      // Hidden dense grid - only visible during pulses
      // Draw at half the spacing (double density)
      for (let gx = -denseGridSize; gx < width + denseGridSize * 2; gx += denseGridSize) {
        for (let gy = -denseGridSize; gy < height + denseGridSize * 2; gy += denseGridSize) {
          // Skip points that align with the main grid (they'll be drawn by the main wireframe)
          const isMainGridPoint = (gx % gridSize === 0) && (gy % gridSize === 0);
          if (isMainGridPoint) continue;

          // Calculate displaced position with parallax
          const baseX = gx + offsetX;
          const baseY = gy + offsetY;
          const pos = getDisplacedPosition(baseX, baseY);

          const pulseIntensity = getPulseIntensity(pos.x, pos.y);
          if (pulseIntensity < 0.05) continue; // Skip if no pulse

          // Draw horizontal line to next dense grid point
          const nextGx = gx + denseGridSize;
          const nextBaseX = nextGx + offsetX;
          const nextPosH = getDisplacedPosition(nextBaseX, baseY);
          const nextPulseH = getPulseIntensity(nextPosH.x, nextPosH.y);
          const avgPulseH = (pulseIntensity + nextPulseH) / 2;

          if (avgPulseH > 0.05) {
            ctx.beginPath();
            ctx.moveTo(pos.x, pos.y);
            ctx.lineTo(nextPosH.x, nextPosH.y);
            ctx.strokeStyle = `rgba(37, 99, 235, ${avgPulseH * 0.9})`;
            ctx.lineWidth = 0.3 + avgPulseH * 0.5;
            ctx.stroke();
          }

          // Draw vertical line to next dense grid point
          const nextGy = gy + denseGridSize;
          const nextBaseY = nextGy + offsetY;
          const nextPosV = getDisplacedPosition(baseX, nextBaseY);
          const nextPulseV = getPulseIntensity(nextPosV.x, nextPosV.y);
          const avgPulseV = (pulseIntensity + nextPulseV) / 2;

          if (avgPulseV > 0.05) {
            ctx.beginPath();
            ctx.moveTo(pos.x, pos.y);
            ctx.lineTo(nextPosV.x, nextPosV.y);
            ctx.strokeStyle = `rgba(37, 99, 235, ${avgPulseV * 0.9})`;
            ctx.lineWidth = 0.3 + avgPulseV * 0.5;
            ctx.stroke();
          }
        }
      }

      // Main wireframe lines
      ctx.lineWidth = 0.5;
      dotsRef.current.forEach((dot, key) => {
        const [gxStr, gyStr] = key.split(',');
        const gx = parseInt(gxStr);
        const gy = parseInt(gyStr);

        // Get neighbors (right and bottom)
        const rightKey = `${gx + gridSize},${gy}`;
        const bottomKey = `${gx},${gy + gridSize}`;
        const rightDot = dotsRef.current.get(rightKey);
        const bottomDot = dotsRef.current.get(bottomKey);

        // Calculate opacity based on distance from closest panel
        let lineMinDist = Infinity;

        // Distance to main panel
        const mainClosestX2 = Math.max(panelLeft, Math.min(dot.x, panelRight));
        const mainClosestY2 = Math.max(panelTop, Math.min(dot.y, panelBottom));
        lineMinDist = Math.min(lineMinDist, Math.sqrt((dot.x - mainClosestX2) ** 2 + (dot.y - mainClosestY2) ** 2));

        // Distance to floating panels
        for (const fp of panelsRef.current) {
          const fpClosestX2 = Math.max(fp.x, Math.min(dot.x, fp.x + fp.width));
          const fpClosestY2 = Math.max(fp.y, Math.min(dot.y, fp.y + fp.height));
          lineMinDist = Math.min(lineMinDist, Math.sqrt((dot.x - fpClosestX2) ** 2 + (dot.y - fpClosestY2) ** 2));
        }

        const normalizedDist = Math.min(lineMinDist / maxDist, 1);
        const baseLineOpacity = (0.25 - normalizedDist * 0.2) * 0.5;

        // Get pulse intensity at this dot's position
        const pulseIntensity = getPulseIntensity(dot.x, dot.y);
        // Get hover intensity at this dot's position
        const hoverIntensity = getHoverIntensity(dot.x, dot.y);
        // Combined effect intensity
        const effectIntensity = Math.max(pulseIntensity, hoverIntensity);

        if (rightDot) {
          const avgPulse = (pulseIntensity + getPulseIntensity(rightDot.x, rightDot.y)) / 2;
          const avgHover = (hoverIntensity + getHoverIntensity(rightDot.x, rightDot.y)) / 2;
          const avgEffect = Math.max(avgPulse, avgHover);
          const lineOpacity = baseLineOpacity + avgEffect * 0.8;
          // Keep it blue - #2563EB base (37, 99, 235)
          const lineColor = avgEffect > 0.1
            ? `rgba(37, ${99 + avgEffect * 60}, 235, ${Math.max(0, lineOpacity + avgEffect * 0.7)})`
            : `rgba(160, 160, 160, ${Math.max(0, lineOpacity)})`;

          if (lineOpacity > 0.01) {
            ctx.beginPath();
            ctx.moveTo(dot.x, dot.y);
            ctx.lineTo(rightDot.x, rightDot.y);
            ctx.lineWidth = 0.5 + avgEffect * 2;
            ctx.strokeStyle = lineColor;
            ctx.stroke();
          }
        }

        if (bottomDot) {
          const avgPulse = (pulseIntensity + getPulseIntensity(bottomDot.x, bottomDot.y)) / 2;
          const avgHover = (hoverIntensity + getHoverIntensity(bottomDot.x, bottomDot.y)) / 2;
          const avgEffect = Math.max(avgPulse, avgHover);
          const lineOpacity = baseLineOpacity + avgEffect * 0.8;
          // Keep it blue - #2563EB base (37, 99, 235)
          const lineColor = avgEffect > 0.1
            ? `rgba(37, ${99 + avgEffect * 60}, 235, ${Math.max(0, lineOpacity + avgEffect * 0.7)})`
            : `rgba(160, 160, 160, ${Math.max(0, lineOpacity)})`;

          if (lineOpacity > 0.01) {
            ctx.beginPath();
            ctx.moveTo(dot.x, dot.y);
            ctx.lineTo(bottomDot.x, bottomDot.y);
            ctx.lineWidth = 0.5 + avgEffect * 2;
            ctx.strokeStyle = lineColor;
            ctx.stroke();
          }
        }
      });

      // Second pass: draw dots on top
      dotsRef.current.forEach((dot, key) => {
        const [gxStr, gyStr] = key.split(',');
        const gx = parseInt(gxStr);
        const gy = parseInt(gyStr);

        // Base position with parallax
        const baseX = gx + offsetX;
        const baseY = gy + offsetY;

        // Calculate target displacement from ALL panels
        let totalPushX = 0;
        let totalPushY = 0;
        let minDist = Infinity;

        // Push from main panel
        const mainPush = getPanelPush(baseX, baseY, panelLeft, panelRight, panelTop, panelBottom);
        totalPushX += mainPush.x;
        totalPushY += mainPush.y;

        // Calculate distance to main panel for brightness
        const mainClosestX = Math.max(panelLeft, Math.min(baseX, panelRight));
        const mainClosestY = Math.max(panelTop, Math.min(baseY, panelBottom));
        const mainDist = Math.sqrt((baseX - mainClosestX) ** 2 + (baseY - mainClosestY) ** 2);
        minDist = Math.min(minDist, mainDist);

        // Push from all floating panels
        const floatingPanels = panelsRef.current;
        for (const fp of floatingPanels) {
          const fpPush = getPanelPush(baseX, baseY, fp.x, fp.x + fp.width, fp.y, fp.y + fp.height);
          totalPushX += fpPush.x;
          totalPushY += fpPush.y;

          // Track closest panel for brightness
          const fpClosestX = Math.max(fp.x, Math.min(baseX, fp.x + fp.width));
          const fpClosestY = Math.max(fp.y, Math.min(baseY, fp.y + fp.height));
          const fpDist = Math.sqrt((baseX - fpClosestX) ** 2 + (baseY - fpClosestY) ** 2);
          minDist = Math.min(minDist, fpDist);
        }

        const targetX = baseX + totalPushX;
        const targetY = baseY + totalPushY;
        const dist = minDist; // Use closest panel distance for brightness
        const normalizedDist = Math.min(dist / maxDist, 1);

        // Spring physics
        const forceX = (targetX - dot.x) * springStiffness;
        const forceY = (targetY - dot.y) * springStiffness;

        dot.vx = (dot.vx + forceX) * damping;
        dot.vy = (dot.vy + forceY) * damping;

        dot.x += dot.vx;
        dot.y += dot.vy;

        // Ripple size effect: small near panel, peaks in middle, small at edges
        // Using sine curve for smooth ripple: smallest at 0, peak around 0.4-0.5, smallest at 1
        const ripple = Math.sin(normalizedDist * Math.PI);
        dot.targetSize = 0.8 + ripple * 2; // Range: 0.8 (near/far) to 2.8 (middle)
        dot.size += (dot.targetSize - dot.size) * 0.15;

        // Brightness uses a much tighter radius (only very close to panel)
        const brightnessRadius = 110;
        const brightnessDist = Math.min(dist / brightnessRadius, 1);
        const brightnessFalloff = Math.pow(brightnessDist, 2);

        // Base opacity for all dots
        const baseOpacity = 0.12;
        // Extra brightness only for dots very close to panel
        const brightnessBoost = (1 - brightnessFalloff) * 0.8;

        const opacity = baseOpacity + brightnessBoost;

        // Color: white near panel, grey far
        const colorValue = Math.round(130 + (1 - brightnessFalloff) * 125);

        ctx.beginPath();
        ctx.arc(dot.x, dot.y, Math.max(0.5, dot.size), 0, Math.PI * 2);
        ctx.fillStyle = `rgba(${colorValue}, ${colorValue}, ${colorValue}, ${Math.max(0, opacity)})`;
        ctx.fill();
      });

      // Draw grid-based connection lines using deformed dot positions
      const currentConnections = connectionsRef.current;
      const currentPanels = panelsRef.current;
      const currentDrag = connectionDragRef.current;
      const dots = dotsRef.current;

      // Helper to get panel center
      const getPanelCenter = (panelId: string) => {
        const panel = currentPanels.find(p => p.id === panelId);
        if (!panel) return null;
        return { x: panel.x + panel.width / 2, y: panel.y + panel.height / 2 };
      };

      // Snap to nearest grid coordinate (returns base grid coords, not actual position)
      const snapToGridCoords = (x: number, y: number) => ({
        gx: Math.round(x / gridSize) * gridSize,
        gy: Math.round(y / gridSize) * gridSize,
      });

      // Get actual deformed dot position from grid coordinates
      const getDotPos = (gx: number, gy: number) => {
        const key = `${gx},${gy}`;
        const dot = dots.get(key);
        return dot ? { x: dot.x, y: dot.y } : { x: gx, y: gy };
      };

      // Helper to check if a point is inside a panel (with margin)
      const isPointInPanel = (x: number, y: number, panel: FloatingPanelData, margin: number = 10) => {
        return x >= panel.x - margin && x <= panel.x + panel.width + margin &&
               y >= panel.y - margin && y <= panel.y + panel.height + margin;
      };

      // Helper to check if a path collides with any panel (except excluded ones)
      const pathCollidesWithPanels = (points: { gx: number; gy: number }[], excludePanelIds: string[]) => {
        for (const point of points) {
          for (const panel of currentPanels) {
            if (excludePanelIds.includes(panel.id)) continue;
            if (isPointInPanel(point.gx, point.gy, panel)) {
              return true;
            }
          }
        }
        return false;
      };

      // Build an L-shaped path (horizontal first or vertical first)
      const buildLPath = (startGrid: { gx: number; gy: number }, endGrid: { gx: number; gy: number }, horizontalFirst: boolean) => {
        const pathPoints: { gx: number; gy: number }[] = [];

        if (horizontalFirst) {
          // Horizontal then vertical
          const xStep = startGrid.gx < endGrid.gx ? gridSize : -gridSize;
          if (startGrid.gx !== endGrid.gx) {
            for (let gx = startGrid.gx; xStep > 0 ? gx <= endGrid.gx : gx >= endGrid.gx; gx += xStep) {
              pathPoints.push({ gx, gy: startGrid.gy });
            }
          } else {
            pathPoints.push({ gx: startGrid.gx, gy: startGrid.gy });
          }
          const yStep = startGrid.gy < endGrid.gy ? gridSize : -gridSize;
          if (startGrid.gy !== endGrid.gy) {
            for (let gy = startGrid.gy + yStep; yStep > 0 ? gy <= endGrid.gy : gy >= endGrid.gy; gy += yStep) {
              pathPoints.push({ gx: endGrid.gx, gy });
            }
          }
        } else {
          // Vertical then horizontal
          const yStep = startGrid.gy < endGrid.gy ? gridSize : -gridSize;
          if (startGrid.gy !== endGrid.gy) {
            for (let gy = startGrid.gy; yStep > 0 ? gy <= endGrid.gy : gy >= endGrid.gy; gy += yStep) {
              pathPoints.push({ gx: startGrid.gx, gy });
            }
          } else {
            pathPoints.push({ gx: startGrid.gx, gy: startGrid.gy });
          }
          const xStep = startGrid.gx < endGrid.gx ? gridSize : -gridSize;
          if (startGrid.gx !== endGrid.gx) {
            for (let gx = startGrid.gx + xStep; xStep > 0 ? gx <= endGrid.gx : gx >= endGrid.gx; gx += xStep) {
              pathPoints.push({ gx, gy: endGrid.gy });
            }
          }
        }

        return pathPoints;
      };

      // Draw a path through actual deformed grid dots, avoiding other panels
      const drawGridPath = (fromX: number, fromY: number, toX: number, toY: number, color: string, lineWidth: number, alpha: number, excludePanelIds: string[] = [], animated: boolean = false) => {
        const startGrid = snapToGridCoords(fromX, fromY);
        const endGrid = snapToGridCoords(toX, toY);

        // Try horizontal-first path
        let pathPoints = buildLPath(startGrid, endGrid, true);
        const horizontalFirstCollides = pathCollidesWithPanels(pathPoints, excludePanelIds);

        // Try vertical-first path
        const verticalFirstPath = buildLPath(startGrid, endGrid, false);
        const verticalFirstCollides = pathCollidesWithPanels(verticalFirstPath, excludePanelIds);

        // Choose the better path
        if (horizontalFirstCollides && !verticalFirstCollides) {
          pathPoints = verticalFirstPath;
        } else if (!horizontalFirstCollides && verticalFirstCollides) {
          // Keep horizontal-first (already set)
        } else if (horizontalFirstCollides && verticalFirstCollides) {
          // Both collide - try to find a path around
          // For now, just use the shorter one; could implement proper A* later
          if (verticalFirstPath.length < pathPoints.length) {
            pathPoints = verticalFirstPath;
          }
        }

        if (pathPoints.length < 2) return;

        // Get actual deformed positions for all path points
        const actualPoints = pathPoints.map(p => getDotPos(p.gx, p.gy));

        ctx.save();
        ctx.strokeStyle = color;
        ctx.lineWidth = lineWidth;
        ctx.lineCap = 'round';
        ctx.lineJoin = 'round';
        ctx.globalAlpha = alpha;

        // Draw smooth curved path through deformed dot positions
        ctx.beginPath();
        ctx.moveTo(actualPoints[0].x, actualPoints[0].y);

        if (actualPoints.length === 2) {
          // Just two points - straight line
          ctx.lineTo(actualPoints[1].x, actualPoints[1].y);
        } else {
          // Use quadratic curves for smooth corners
          for (let i = 1; i < actualPoints.length - 1; i++) {
            const prev = actualPoints[i - 1];
            const curr = actualPoints[i];
            const next = actualPoints[i + 1];

            // Calculate midpoints for smooth transitions
            const midX1 = (prev.x + curr.x) / 2;
            const midY1 = (prev.y + curr.y) / 2;
            const midX2 = (curr.x + next.x) / 2;
            const midY2 = (curr.y + next.y) / 2;

            if (i === 1) {
              // First segment: line to first midpoint, then curve
              ctx.lineTo(midX1, midY1);
            }

            // Quadratic curve through the corner point
            ctx.quadraticCurveTo(curr.x, curr.y, midX2, midY2);
          }

          // Final segment to last point
          ctx.lineTo(actualPoints[actualPoints.length - 1].x, actualPoints[actualPoints.length - 1].y);
        }
        ctx.stroke();

        // Draw energy flow - bright segment with gradient that flows along curved path
        if (animated && actualPoints.length >= 2) {
          // Sample points along the actual curved path (same curve logic as main drawing)
          const sampledPoints: { x: number; y: number }[] = [];
          const samplesPerSegment = 8;

          if (actualPoints.length === 2) {
            // Straight line - just use endpoints
            sampledPoints.push(actualPoints[0], actualPoints[1]);
          } else {
            // Sample along the curved path
            sampledPoints.push(actualPoints[0]);

            for (let i = 1; i < actualPoints.length - 1; i++) {
              const prev = actualPoints[i - 1];
              const curr = actualPoints[i];
              const next = actualPoints[i + 1];

              const midX1 = (prev.x + curr.x) / 2;
              const midY1 = (prev.y + curr.y) / 2;
              const midX2 = (curr.x + next.x) / 2;
              const midY2 = (curr.y + next.y) / 2;

              if (i === 1) {
                // Line from start to first midpoint
                for (let t = 1; t <= samplesPerSegment; t++) {
                  const tt = t / samplesPerSegment;
                  sampledPoints.push({
                    x: actualPoints[0].x + (midX1 - actualPoints[0].x) * tt,
                    y: actualPoints[0].y + (midY1 - actualPoints[0].y) * tt
                  });
                }
              }

              // Quadratic bezier from midX1,midY1 through curr to midX2,midY2
              for (let t = 1; t <= samplesPerSegment; t++) {
                const tt = t / samplesPerSegment;
                // Quadratic bezier formula: (1-t)²P0 + 2(1-t)tP1 + t²P2
                const x = (1-tt)*(1-tt)*midX1 + 2*(1-tt)*tt*curr.x + tt*tt*midX2;
                const y = (1-tt)*(1-tt)*midY1 + 2*(1-tt)*tt*curr.y + tt*tt*midY2;
                sampledPoints.push({ x, y });
              }
            }

            // Line from last midpoint to end
            const lastMidX = (actualPoints[actualPoints.length-2].x + actualPoints[actualPoints.length-1].x) / 2;
            const lastMidY = (actualPoints[actualPoints.length-2].y + actualPoints[actualPoints.length-1].y) / 2;
            for (let t = 1; t <= samplesPerSegment; t++) {
              const tt = t / samplesPerSegment;
              sampledPoints.push({
                x: lastMidX + (actualPoints[actualPoints.length-1].x - lastMidX) * tt,
                y: lastMidY + (actualPoints[actualPoints.length-1].y - lastMidY) * tt
              });
            }
          }

          // Calculate cumulative distances along sampled path
          const cumDist: number[] = [0];
          for (let i = 1; i < sampledPoints.length; i++) {
            const dx = sampledPoints[i].x - sampledPoints[i-1].x;
            const dy = sampledPoints[i].y - sampledPoints[i-1].y;
            cumDist.push(cumDist[i-1] + Math.sqrt(dx*dx + dy*dy));
          }
          const totalLen = cumDist[cumDist.length - 1];

          if (totalLen > 20) {
            // Continuous flowing energy - multiple soft pulses
            const speed = 0.12; // pixels per ms (faster)
            const pulseSpacing = 100; // distance between pulse centers
            const pulseWidth = 60; // width of each pulse's falloff

            // Draw curved segments with smooth flowing brightness
            for (let i = 0; i < sampledPoints.length - 1; i++) {
              const segMid = (cumDist[i] + cumDist[i + 1]) / 2;

              // Calculate brightness from multiple flowing pulses
              let brightness = 0;
              const flowPos = (now * speed) % pulseSpacing;

              // Check distance to nearest pulse (repeating pattern)
              for (let offset = -pulseSpacing; offset <= totalLen + pulseSpacing; offset += pulseSpacing) {
                const pulseCenter = flowPos + offset;
                const dist = Math.abs(segMid - pulseCenter);
                // Smooth cosine falloff
                if (dist < pulseWidth) {
                  const intensity = (Math.cos((dist / pulseWidth) * Math.PI) + 1) / 2;
                  brightness = Math.max(brightness, intensity);
                }
              }

              if (brightness > 0.02) {
                ctx.save();
                ctx.strokeStyle = `rgba(0, 200, 255, ${brightness * 0.9})`;
                ctx.lineWidth = lineWidth + brightness * 1.5;
                ctx.lineCap = 'round';
                ctx.beginPath();
                ctx.moveTo(sampledPoints[i].x, sampledPoints[i].y);
                ctx.lineTo(sampledPoints[i+1].x, sampledPoints[i+1].y);
                ctx.stroke();
                ctx.restore();
              }
            }
          }
        }

        // Draw nodes at start and end
        ctx.fillStyle = color;
        ctx.beginPath();
        ctx.arc(actualPoints[0].x, actualPoints[0].y, 4, 0, Math.PI * 2);
        ctx.fill();
        ctx.beginPath();
        ctx.arc(actualPoints[actualPoints.length - 1].x, actualPoints[actualPoints.length - 1].y, 4, 0, Math.PI * 2);
        ctx.fill();

        ctx.restore();
      };

      // Draw established connections with energy flow animation
      for (const conn of currentConnections) {
        const from = getPanelCenter(conn.fromPanelId);
        const to = getPanelCenter(conn.toPanelId);
        if (from && to) {
          drawGridPath(from.x, from.y, to.x, to.y, '#3B82F6', 2, 0.7, [conn.fromPanelId, conn.toPanelId], true);
        }
      }

      // Draw cut connection retraction animations
      const currentCutConnections = cutConnectionsRef.current;
      const cutAnimationDuration = 600; // 600ms retraction

      for (const cut of currentCutConnections) {
        const fromPanel = currentPanels.find(p => p.id === cut.fromPanelId);
        const toPanel = currentPanels.find(p => p.id === cut.toPanelId);

        if (fromPanel && toPanel) {
          const fromCenter = { x: fromPanel.x + fromPanel.width / 2, y: fromPanel.y + fromPanel.height / 2 };
          const toCenter = { x: toPanel.x + toPanel.width / 2, y: toPanel.y + toPanel.height / 2 };

          // Build the FULL original path (same as regular connection)
          const startGrid = snapToGridCoords(fromCenter.x, fromCenter.y);
          const endGrid = snapToGridCoords(toCenter.x, toCenter.y);

          const pathPoints: { gx: number; gy: number }[] = [];
          const xStep = startGrid.gx < endGrid.gx ? gridSize : -gridSize;
          if (startGrid.gx !== endGrid.gx) {
            for (let gx = startGrid.gx; xStep > 0 ? gx <= endGrid.gx : gx >= endGrid.gx; gx += xStep) {
              pathPoints.push({ gx, gy: startGrid.gy });
            }
          } else {
            pathPoints.push({ gx: startGrid.gx, gy: startGrid.gy });
          }
          const yStep = startGrid.gy < endGrid.gy ? gridSize : -gridSize;
          if (startGrid.gy !== endGrid.gy) {
            for (let gy = startGrid.gy + yStep; yStep > 0 ? gy <= endGrid.gy : gy >= endGrid.gy; gy += yStep) {
              pathPoints.push({ gx: endGrid.gx, gy });
            }
          }

          if (pathPoints.length < 2) continue;

          // Get actual deformed positions
          const actualPoints = pathPoints.map(p => getDotPos(p.gx, p.gy));

          // Find the point closest to the cut location (approximate middle of path)
          let cutIndex = Math.floor(actualPoints.length / 2);
          let minDist = Infinity;
          for (let i = 0; i < actualPoints.length; i++) {
            const d = Math.sqrt((actualPoints[i].x - cut.cutX) ** 2 + (actualPoints[i].y - cut.cutY) ** 2);
            if (d < minDist) {
              minDist = d;
              cutIndex = i;
            }
          }

          const elapsed = now - cut.cutTime;
          const progress = Math.min(1, elapsed / cutAnimationDuration);
          const easeOut = 1 - Math.pow(1 - progress, 3); // Cubic ease out
          const fadeAlpha = 0.7 * (1 - easeOut * 0.8);

          if (progress < 1) {
            ctx.save();
            ctx.strokeStyle = '#3B82F6';
            ctx.lineWidth = 2;
            ctx.lineCap = 'round';
            ctx.lineJoin = 'round';
            ctx.globalAlpha = fadeAlpha;

            // "From" side: points 0 to cutIndex, retracting toward 0
            const fromPointsCount = cutIndex + 1;
            const fromRetractAmount = Math.floor(fromPointsCount * easeOut);
            const fromVisibleEnd = Math.max(1, cutIndex - fromRetractAmount);

            if (fromVisibleEnd > 0) {
              const fromPoints = actualPoints.slice(0, fromVisibleEnd + 1);
              ctx.beginPath();
              ctx.moveTo(fromPoints[0].x, fromPoints[0].y);
              if (fromPoints.length === 2) {
                ctx.lineTo(fromPoints[1].x, fromPoints[1].y);
              } else if (fromPoints.length > 2) {
                for (let i = 1; i < fromPoints.length - 1; i++) {
                  const prev = fromPoints[i - 1];
                  const curr = fromPoints[i];
                  const next = fromPoints[i + 1];
                  const midX1 = (prev.x + curr.x) / 2;
                  const midY1 = (prev.y + curr.y) / 2;
                  const midX2 = (curr.x + next.x) / 2;
                  const midY2 = (curr.y + next.y) / 2;
                  if (i === 1) ctx.lineTo(midX1, midY1);
                  ctx.quadraticCurveTo(curr.x, curr.y, midX2, midY2);
                }
                ctx.lineTo(fromPoints[fromPoints.length - 1].x, fromPoints[fromPoints.length - 1].y);
              }
              ctx.stroke();
            }

            // "To" side: points cutIndex to end, retracting toward end
            const toPointsCount = actualPoints.length - cutIndex;
            const toRetractAmount = Math.floor(toPointsCount * easeOut);
            const toVisibleStart = Math.min(actualPoints.length - 2, cutIndex + toRetractAmount);

            if (toVisibleStart < actualPoints.length - 1) {
              const toPoints = actualPoints.slice(toVisibleStart);
              ctx.beginPath();
              ctx.moveTo(toPoints[0].x, toPoints[0].y);
              if (toPoints.length === 2) {
                ctx.lineTo(toPoints[1].x, toPoints[1].y);
              } else if (toPoints.length > 2) {
                for (let i = 1; i < toPoints.length - 1; i++) {
                  const prev = toPoints[i - 1];
                  const curr = toPoints[i];
                  const next = toPoints[i + 1];
                  const midX1 = (prev.x + curr.x) / 2;
                  const midY1 = (prev.y + curr.y) / 2;
                  const midX2 = (curr.x + next.x) / 2;
                  const midY2 = (curr.y + next.y) / 2;
                  if (i === 1) ctx.lineTo(midX1, midY1);
                  ctx.quadraticCurveTo(curr.x, curr.y, midX2, midY2);
                }
                ctx.lineTo(toPoints[toPoints.length - 1].x, toPoints[toPoints.length - 1].y);
              }
              ctx.stroke();
            }

            ctx.restore();
          } else {
            onCutAnimationCompleteRef.current(cut.id);
          }
        }
      }

      // Draw active drag
      if (currentDrag) {
        const from = getPanelCenter(currentDrag.fromPanelId);
        if (from) {
          // Grey while dragging, blue when over valid target
          const alpha = currentDrag.targetPanelId ? 0.85 : 0.5;
          const color = currentDrag.targetPanelId ? '#3B82F6' : '#888888';
          const excludeIds = currentDrag.targetPanelId
            ? [currentDrag.fromPanelId, currentDrag.targetPanelId]
            : [currentDrag.fromPanelId];
          drawGridPath(from.x, from.y, currentDrag.toX, currentDrag.toY, color, 2, alpha, excludeIds);
        }
      }

      // Draw slice trail - clean neon pink line
      const currentSliceTrail = sliceTrailRef.current;
      if (currentSliceTrail.length > 1) {
        const now = performance.now();

        ctx.save();
        ctx.lineCap = 'round';
        ctx.lineJoin = 'round';
        ctx.lineWidth = 2;

        ctx.beginPath();
        let started = false;
        for (let i = 0; i < currentSliceTrail.length; i++) {
          const point = currentSliceTrail[i];
          const age = now - point.time;
          const maxAge = 200; // Trail fades over 200ms

          if (age < maxAge) {
            if (!started) {
              ctx.moveTo(point.x, point.y);
              started = true;
            } else {
              ctx.lineTo(point.x, point.y);
            }
          }
        }
        // Light grey slice line
        const trailAlpha = currentSliceTrail.length > 0 ? Math.max(0, 1 - (now - currentSliceTrail[currentSliceTrail.length - 1].time) / 200) : 0;
        ctx.strokeStyle = `rgba(180, 180, 180, ${trailAlpha * 0.8})`;
        ctx.stroke();

        ctx.restore();
      }

      // Update bouncy particles with panel collision
      updateBouncyParticles(deltaTime);

      // Draw regular particles on top
      for (const particle of particlesRef.current) {
        drawParticle(ctx, particle);
      }

      // Draw bouncy particles (on top of everything)
      for (const particle of bouncyParticlesRef.current) {
        drawBouncyParticle(ctx, particle);
      }

      animationRef.current = requestAnimationFrame(animate);
    };

    animationRef.current = requestAnimationFrame(animate);

    const handleResize = () => {
      width = window.innerWidth;
      height = window.innerHeight;
      canvas.width = width;
      canvas.height = height;
      initDots();
    };

    window.addEventListener('resize', handleResize);

    return () => {
      window.removeEventListener('resize', handleResize);
      if (animationRef.current) cancelAnimationFrame(animationRef.current);
    };
  }, []);

  // Update refs when props change
  useEffect(() => {
    lastPanelRef.current = { x: panelX, y: panelY, width: panelWidth, height: panelHeight };
  }, [panelX, panelY, panelWidth, panelHeight]);

  useEffect(() => {
    pulsesRef.current = pulses;
  }, [pulses]);

  useEffect(() => {
    mousePosRef.current = mousePos;
  }, [mousePos]);

  useEffect(() => {
    panelsRef.current = panels;
  }, [panels]);

  useEffect(() => {
    connectionsRef.current = connections;
  }, [connections]);


  useEffect(() => {
    sliceTrailRef.current = sliceTrail;
  }, [sliceTrail]);

  useEffect(() => {
    cutConnectionsRef.current = cutConnections;
  }, [cutConnections]);

  useEffect(() => {
    onCutAnimationCompleteRef.current = onCutAnimationComplete;
  }, [onCutAnimationComplete]);

  return (
    <canvas
      ref={canvasRef}
      style={{
        position: 'fixed',
        top: 0,
        left: 0,
        right: 0,
        bottom: 0,
        pointerEvents: 'none',
        zIndex: 0,
      }}
    />
  );
}

export default function GridPlayground() {
  const router = useRouter();
  const [config] = useState<PhysicsConfig>(DEFAULT_CONFIG);
  // Main panel is off-screen (no longer visible, only floating panels affect grid)
  const [panelPos] = useState({ x: -9999, y: -9999 });
  const [panelSize] = useState({ width: 0, height: 0 });
  const [pulses, setPulses] = useState<PulseEvent[]>([]);
  const [mousePos, setMousePos] = useState<{ x: number; y: number } | null>(null);
  const [floatingPanels, setFloatingPanels] = useState<FloatingPanelData[]>([]);
  const [canvasResetKey, setCanvasResetKey] = useState(0);
  const panelIdCounter = useRef(1); // Start at 1 since we have a default panel
  const hasSpawnedDefaultPanel = useRef(false);
  const isDraggingRef = useRef(false); // Track if any panel is being dragged
  const sliceDragRef = useRef<{ startX: number; startY: number; lastX: number; lastY: number; isSlicing: boolean } | null>(null);
  const viewportRef = useRef({ width: typeof window !== 'undefined' ? window.innerWidth : 0, height: typeof window !== 'undefined' ? window.innerHeight : 0 });
  const [resizeKey, setResizeKey] = useState(0); // Forces panel re-init on resize
  const [topPanelId, setTopPanelId] = useState<string | null>(null); // Last dragged panel stays on top
  const [connections, setConnections] = useState<PanelConnection[]>([]); // Connections between panels
  const [connectionDrag, setConnectionDrag] = useState<ConnectionDrag | null>(null); // Active connection drag
  const [sliceTrail, setSliceTrail] = useState<SlicePoint[]>([]); // Visual trail for slice gesture
  const [cutConnections, setCutConnections] = useState<CutConnection[]>([]); // Connections being animated after cut
  const lastConnectionTargetRef = useRef<string | null>(null); // Track previous connection target for sound
  const touchedGridDotsRef = useRef<Set<string>>(new Set()); // Track grid dots touched during connection drag
  const lastDotSoundTimeRef = useRef(0); // Throttle dot sounds when moving fast

  // Disable CSS zoom on this page for proper canvas alignment
  useEffect(() => {
    document.documentElement.classList.add('no-zoom');
    return () => {
      document.documentElement.classList.remove('no-zoom');
    };
  }, []);

  // Clear all panels and connections with animation
  const clearAll = useCallback(() => {
    // Mark all panels as exiting to trigger exit animations
    setFloatingPanels(prev => prev.map(p => ({ ...p, isExiting: true })));
    // Clear connections immediately
    setConnections([]);
    setCutConnections([]);
    setConnectionDrag(null);
    setSliceTrail([]);
    // Remove panels after animation completes and reset canvas
    setTimeout(() => {
      setFloatingPanels([]);
      panelIdCounter.current = 0;
      setCanvasResetKey(k => k + 1); // Force canvas remount to reset dot positions
    }, 200);
  }, []);

  // Disable cmd+k and cmd+u shortcuts, handle ESC to clear all
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      // Disable cmd+k and cmd+u
      if ((e.metaKey || e.ctrlKey) && (e.key === 'k' || e.key === 'u')) {
        e.preventDefault();
        e.stopPropagation();
        return;
      }

      // ESC clears all (only if 2+ panels)
      if (e.key === 'Escape' && floatingPanels.length >= 2) {
        e.preventDefault();
        clearAll();
      }
    };

    window.addEventListener('keydown', handleKeyDown, true);
    return () => window.removeEventListener('keydown', handleKeyDown, true);
  }, [floatingPanels.length, clearAll]);

  // Spawn a default panel on mount
  useEffect(() => {
    if (hasSpawnedDefaultPanel.current) return;
    hasSpawnedDefaultPanel.current = true;

    // Center the panel in the viewport
    const x = (window.innerWidth - FLOATING_PANEL_SIZE.width) / 2;
    const y = (window.innerHeight - FLOATING_PANEL_SIZE.height) / 2;

    setFloatingPanels([{
      id: 'floating-panel-0',
      x,
      y,
      width: FLOATING_PANEL_SIZE.width,
      height: FLOATING_PANEL_SIZE.height,
    }]);
  }, []);

  // Keep floating panels centered on resize
  useEffect(() => {
    const handleResize = () => {
      const oldWidth = viewportRef.current.width;
      const oldHeight = viewportRef.current.height;
      const newWidth = window.innerWidth;
      const newHeight = window.innerHeight;

      if (oldWidth === 0 || oldHeight === 0) {
        viewportRef.current = { width: newWidth, height: newHeight };
        return;
      }

      // Scale panel positions proportionally
      setFloatingPanels(prev => prev.map(p => ({
        ...p,
        x: (p.x / oldWidth) * newWidth,
        y: (p.y / oldHeight) * newHeight,
      })));

      // Force FloatingPanel components to reinitialize with new positions
      setResizeKey(k => k + 1);

      viewportRef.current = { width: newWidth, height: newHeight };
    };

    // Initialize viewport size
    viewportRef.current = { width: window.innerWidth, height: window.innerHeight };

    window.addEventListener('resize', handleResize);
    return () => window.removeEventListener('resize', handleResize);
  }, []);


  const handleBounce = useCallback((x: number, y: number, intensity: number) => {
    setPulses(prev => {
      // Keep only recent pulses (last 2 seconds) plus new one
      const now = performance.now();
      const recent = prev.filter(p => now - p.time < 2000);
      return [...recent, { x, y, time: now, intensity }];
    });
  }, []);

  // Line segment intersection helper
  const lineSegmentsIntersect = useCallback((x1: number, y1: number, x2: number, y2: number, x3: number, y3: number, x4: number, y4: number) => {
    const denom = (y4 - y3) * (x2 - x1) - (x4 - x3) * (y2 - y1);
    if (Math.abs(denom) < 0.0001) return false; // Parallel lines

    const ua = ((x4 - x3) * (y1 - y3) - (y4 - y3) * (x1 - x3)) / denom;
    const ub = ((x2 - x1) * (y1 - y3) - (y2 - y1) * (x1 - x3)) / denom;

    return ua >= 0 && ua <= 1 && ub >= 0 && ub <= 1;
  }, []);

  // Track mouse position for hover glow and slice detection
  const handleMouseMove = useCallback((e: React.MouseEvent) => {
    setMousePos({ x: e.clientX, y: e.clientY });

    // Check for slice gesture
    if (sliceDragRef.current?.isSlicing) {
      const { lastX, lastY } = sliceDragRef.current;
      const currX = e.clientX;
      const currY = e.clientY;
      const now = performance.now();

      // Add point to slice trail
      setSliceTrail(prev => {
        // Remove old points (older than 300ms)
        const recent = prev.filter(p => now - p.time < 300);
        return [...recent, { x: currX, y: currY, time: now }];
      });

      // Check if the mouse movement crosses any connection line
      // We need to check against the actual L-shaped grid path, not just the direct line
      const gridSize = 40; // Same as in DotGridCanvas

      if (connections.length > 0) {
        for (const conn of connections) {
          const fromPanel = floatingPanels.find(p => p.id === conn.fromPanelId);
          const toPanel = floatingPanels.find(p => p.id === conn.toPanelId);

          if (fromPanel && toPanel) {
            const fromX = fromPanel.x + fromPanel.width / 2;
            const fromY = fromPanel.y + fromPanel.height / 2;
            const toX = toPanel.x + toPanel.width / 2;
            const toY = toPanel.y + toPanel.height / 2;

            // Build the L-shaped grid path (same logic as DotGridCanvas)
            const startGx = Math.round(fromX / gridSize) * gridSize;
            const startGy = Math.round(fromY / gridSize) * gridSize;
            const endGx = Math.round(toX / gridSize) * gridSize;
            const endGy = Math.round(toY / gridSize) * gridSize;

            const pathPoints: { x: number; y: number }[] = [];

            // Horizontal segment points
            const xStep = startGx < endGx ? gridSize : -gridSize;
            if (startGx !== endGx) {
              for (let gx = startGx; xStep > 0 ? gx <= endGx : gx >= endGx; gx += xStep) {
                pathPoints.push({ x: gx, y: startGy });
              }
            } else {
              pathPoints.push({ x: startGx, y: startGy });
            }

            // Vertical segment points
            const yStep = startGy < endGy ? gridSize : -gridSize;
            if (startGy !== endGy) {
              for (let gy = startGy + yStep; yStep > 0 ? gy <= endGy : gy >= endGy; gy += yStep) {
                pathPoints.push({ x: endGx, y: gy });
              }
            }

            // Check intersection with each segment of the path
            let intersected = false;
            let cutPoint = { x: (lastX + currX) / 2, y: (lastY + currY) / 2 };

            for (let i = 0; i < pathPoints.length - 1; i++) {
              const p1 = pathPoints[i];
              const p2 = pathPoints[i + 1];

              if (lineSegmentsIntersect(lastX, lastY, currX, currY, p1.x, p1.y, p2.x, p2.y)) {
                intersected = true;
                // Calculate intersection point for better cut position
                cutPoint = { x: (p1.x + p2.x) / 2, y: (p1.y + p2.y) / 2 };
                break;
              }
            }

            if (intersected) {
              // Slice this connection!
              setCutConnections(prev => [...prev, {
                id: conn.id,
                fromPanelId: conn.fromPanelId,
                toPanelId: conn.toPanelId,
                cutX: cutPoint.x,
                cutY: cutPoint.y,
                cutTime: now,
              }]);
              setConnections(prev => prev.filter(c => c.id !== conn.id));
              // Play cut sound
              panelSounds.playRandomized(0.05, 0.7, 0.15);
              break;
            }
          }
        }
      }

      sliceDragRef.current.lastX = currX;
      sliceDragRef.current.lastY = currY;
    }
  }, [connections, floatingPanels, lineSegmentsIntersect]);

  const handleMouseLeave = useCallback(() => {
    setMousePos(null);
    sliceDragRef.current = null;
  }, []);

  // Start potential slice gesture on mouse down (only on background)
  const handleMouseDown = useCallback((e: React.MouseEvent) => {
    // Only start slice if clicking on the background (not on a panel)
    const target = e.target as HTMLElement;
    if (target.closest('[data-panel-id]')) return;

    sliceDragRef.current = {
      startX: e.clientX,
      startY: e.clientY,
      lastX: e.clientX,
      lastY: e.clientY,
      isSlicing: false,
    };
  }, []);

  // End slice gesture on mouse up
  const handleMouseUp = useCallback(() => {
    if (sliceDragRef.current?.isSlicing) {
      // Delay resetting isDragging to prevent spawn
      setTimeout(() => {
        isDraggingRef.current = false;
      }, 50);
    }
    sliceDragRef.current = null;
  }, []);

  // Start potential slice gesture on touch (only on background)
  const handleTouchStart = useCallback((e: React.TouchEvent) => {
    if (e.touches.length !== 1) return;
    const touch = e.touches[0];
    const target = e.target as HTMLElement;
    if (target.closest('[data-panel-id]')) return;

    sliceDragRef.current = {
      startX: touch.clientX,
      startY: touch.clientY,
      lastX: touch.clientX,
      lastY: touch.clientY,
      isSlicing: false,
    };
  }, []);

  // Handle touch move for slice gesture
  const handleTouchMoveSlice = useCallback((e: React.TouchEvent) => {
    if (e.touches.length !== 1) return;
    const touch = e.touches[0];

    // Check for slice gesture
    if (sliceDragRef.current?.isSlicing) {
      const { lastX, lastY } = sliceDragRef.current;
      const currX = touch.clientX;
      const currY = touch.clientY;
      const now = performance.now();

      // Add point to slice trail
      setSliceTrail(prev => {
        const newTrail = [...prev, { x: currX, y: currY, time: now }];
        const cutoff = now - 300;
        return newTrail.filter(p => p.time > cutoff);
      });

      // Check for intersection with connection lines
      for (const conn of connections) {
        const fromPanel = floatingPanels.find(p => p.id === conn.fromPanelId);
        const toPanel = floatingPanels.find(p => p.id === conn.toPanelId);
        if (!fromPanel || !toPanel) continue;

        const fromCenter = { x: fromPanel.x + fromPanel.width / 2, y: fromPanel.y + fromPanel.height / 2 };
        const toCenter = { x: toPanel.x + toPanel.width / 2, y: toPanel.y + toPanel.height / 2 };

        const gridSize = 40;
        const snapToGrid = (val: number) => Math.round(val / gridSize) * gridSize;

        const fromGridX = snapToGrid(fromCenter.x);
        const fromGridY = snapToGrid(fromCenter.y);
        const toGridX = snapToGrid(toCenter.x);
        const toGridY = snapToGrid(toCenter.y);

        const segments: Array<{ x1: number; y1: number; x2: number; y2: number }> = [];
        if (Math.abs(toGridX - fromGridX) >= Math.abs(toGridY - fromGridY)) {
          const midX = fromGridX + Math.round((toGridX - fromGridX) / 2 / gridSize) * gridSize;
          segments.push({ x1: fromGridX, y1: fromGridY, x2: midX, y2: fromGridY });
          segments.push({ x1: midX, y1: fromGridY, x2: midX, y2: toGridY });
          segments.push({ x1: midX, y1: toGridY, x2: toGridX, y2: toGridY });
        } else {
          const midY = fromGridY + Math.round((toGridY - fromGridY) / 2 / gridSize) * gridSize;
          segments.push({ x1: fromGridX, y1: fromGridY, x2: fromGridX, y2: midY });
          segments.push({ x1: fromGridX, y1: midY, x2: toGridX, y2: midY });
          segments.push({ x1: toGridX, y1: midY, x2: toGridX, y2: toGridY });
        }

        for (const seg of segments) {
          if (lineSegmentsIntersect(lastX, lastY, currX, currY, seg.x1, seg.y1, seg.x2, seg.y2)) {
            setCutConnections(prev => [...prev, {
              ...conn,
              cutX: currX,
              cutY: currY,
              cutTime: now,
            }]);
            setConnections(prev => prev.filter(c => c.id !== conn.id));
            panelSounds.playRandomized(0.05, 0.7, 0.15);
            break;
          }
        }
      }

      sliceDragRef.current.lastX = currX;
      sliceDragRef.current.lastY = currY;
    }
  }, [connections, floatingPanels, lineSegmentsIntersect]);

  // End slice gesture on touch end
  const handleTouchEnd = useCallback(() => {
    if (sliceDragRef.current?.isSlicing) {
      setTimeout(() => {
        isDraggingRef.current = false;
      }, 50);
    }
    sliceDragRef.current = null;
  }, []);

  // Detect when we start actually slicing (moved enough distance)
  useEffect(() => {
    const handleGlobalMouseMove = (e: MouseEvent) => {
      if (sliceDragRef.current && !sliceDragRef.current.isSlicing) {
        const dx = e.clientX - sliceDragRef.current.startX;
        const dy = e.clientY - sliceDragRef.current.startY;
        const dist = Math.sqrt(dx * dx + dy * dy);

        // Start slicing after moving 10px
        if (dist > 10) {
          sliceDragRef.current.isSlicing = true;
          isDraggingRef.current = true; // Prevent click-to-spawn
        }
      }
    };

    const handleGlobalMouseUp = () => {
      if (sliceDragRef.current?.isSlicing) {
        // Delay resetting isDragging to prevent spawn
        setTimeout(() => {
          isDraggingRef.current = false;
        }, 50);
      }
      sliceDragRef.current = null;
    };

    // Touch handlers for slice gesture
    const handleGlobalTouchMove = (e: TouchEvent) => {
      if (e.touches.length !== 1) return;
      const touch = e.touches[0];

      if (sliceDragRef.current && !sliceDragRef.current.isSlicing) {
        const dx = touch.clientX - sliceDragRef.current.startX;
        const dy = touch.clientY - sliceDragRef.current.startY;
        const dist = Math.sqrt(dx * dx + dy * dy);

        // Start slicing after moving 10px
        if (dist > 10) {
          sliceDragRef.current.isSlicing = true;
          isDraggingRef.current = true;
        }
      }
    };

    const handleGlobalTouchEnd = () => {
      if (sliceDragRef.current?.isSlicing) {
        setTimeout(() => {
          isDraggingRef.current = false;
        }, 50);
      }
      sliceDragRef.current = null;
    };

    window.addEventListener('mousemove', handleGlobalMouseMove);
    window.addEventListener('mouseup', handleGlobalMouseUp);
    window.addEventListener('touchmove', handleGlobalTouchMove);
    window.addEventListener('touchend', handleGlobalTouchEnd);

    return () => {
      window.removeEventListener('mousemove', handleGlobalMouseMove);
      window.removeEventListener('mouseup', handleGlobalMouseUp);
      window.removeEventListener('touchmove', handleGlobalTouchMove);
      window.removeEventListener('touchend', handleGlobalTouchEnd);
    };
  }, []);

  // Spawn floating panel on click
  const handleGridClick = useCallback((e: React.MouseEvent) => {
    // Don't spawn if we just finished dragging
    if (isDraggingRef.current) return;

    // Play spawn sound
    panelSounds.playRandomized(0.04, 0.9, 0.1);

    // Spawn panel centered on click position
    const x = e.clientX - FLOATING_PANEL_SIZE.width / 2;
    const y = e.clientY - FLOATING_PANEL_SIZE.height / 2;
    const id = `floating-panel-${panelIdCounter.current++}`;

    setFloatingPanels(prev => [...prev, {
      id,
      x,
      y,
      width: FLOATING_PANEL_SIZE.width,
      height: FLOATING_PANEL_SIZE.height,
    }]);
  }, []);

  // Spawn floating panel on touch (mobile)
  const handleGridTouch = useCallback((e: React.TouchEvent) => {
    // Don't spawn if we just finished dragging
    if (isDraggingRef.current) return;
    if (e.changedTouches.length !== 1) return;

    // Play spawn sound
    panelSounds.playRandomized(0.04, 0.9, 0.1);

    const touch = e.changedTouches[0];
    // Spawn panel centered on touch position
    const x = touch.clientX - FLOATING_PANEL_SIZE.width / 2;
    const y = touch.clientY - FLOATING_PANEL_SIZE.height / 2;
    const id = `floating-panel-${panelIdCounter.current++}`;

    setFloatingPanels(prev => [...prev, {
      id,
      x,
      y,
      width: FLOATING_PANEL_SIZE.width,
      height: FLOATING_PANEL_SIZE.height,
    }]);
  }, []);

  // Update floating panel position
  const handleFloatingPanelPositionChange = useCallback((id: string, x: number, y: number) => {
    setFloatingPanels(prev => prev.map(p =>
      p.id === id ? { ...p, x, y } : p
    ));
  }, []);

  // Update floating panel size
  const handleFloatingPanelSizeChange = useCallback((id: string, width: number, height: number) => {
    setFloatingPanels(prev => prev.map(p =>
      p.id === id ? { ...p, width, height } : p
    ));
  }, []);

  // Dismiss floating panel with exit animation
  const handleFloatingPanelDismiss = useCallback((id: string) => {
    // Mark panel as exiting to trigger animation
    setFloatingPanels(prev => prev.map(p =>
      p.id === id ? { ...p, isExiting: true } : p
    ));
    // Also remove any connections involving this panel immediately
    setConnections(prev => prev.filter(c => c.fromPanelId !== id && c.toPanelId !== id));
    // Remove panel after animation completes
    setTimeout(() => {
      setFloatingPanels(prev => prev.filter(p => p.id !== id));
    }, 200);
  }, []);

  // Connection handlers
  const handleConnectionDragStart = useCallback((fromPanelId: string, startX: number, startY: number) => {
    isDraggingRef.current = true;
    // Reset touched grid dots for new connection drag
    touchedGridDotsRef.current.clear();

    setConnectionDrag({
      fromPanelId,
      fromX: startX,
      fromY: startY,
      toX: startX,
      toY: startY,
      targetPanelId: null,
    });
  }, []);

  const handleConnectionDragMove = useCallback((x: number, y: number) => {
    setConnectionDrag(prev => {
      if (!prev) return null;

      // Check which grid dots the line currently passes through
      const gridSize = 40;
      const fromX = prev.fromX;
      const fromY = prev.fromY;

      // Build set of dots currently touched by the line
      const currentlyTouched = new Set<string>();
      const lineLength = Math.sqrt((x - fromX) ** 2 + (y - fromY) ** 2);
      const steps = Math.max(1, Math.ceil(lineLength / 10)); // Check every 10px

      for (let i = 0; i <= steps; i++) {
        const t = i / steps;
        const px = fromX + (x - fromX) * t;
        const py = fromY + (y - fromY) * t;

        // Find nearest grid dot
        const dotX = Math.round(px / gridSize) * gridSize;
        const dotY = Math.round(py / gridSize) * gridSize;
        const dotKey = `${dotX},${dotY}`;

        // Check if close enough to the dot (within 15px)
        const dist = Math.sqrt((px - dotX) ** 2 + (py - dotY) ** 2);
        if (dist < 15) {
          currentlyTouched.add(dotKey);
        }
      }

      // Play sound for any dots that are newly touched (weren't touched before)
      // Throttle to avoid harsh sound when moving very fast
      const now = performance.now();
      currentlyTouched.forEach(dotKey => {
        if (!touchedGridDotsRef.current.has(dotKey)) {
          if (now - lastDotSoundTimeRef.current > 25) { // Min 25ms between sounds
            const pitch = 1.0 + (Math.random() - 0.5) * 0.3;
            panelSounds.play(0.035, pitch);
            lastDotSoundTimeRef.current = now;
          }
        }
      });

      // Update the touched set to reflect current state
      touchedGridDotsRef.current = currentlyTouched;

      // Check if hovering over a panel
      const elementsAtPoint = document.elementsFromPoint(x, y);
      let targetPanelId: string | null = null;

      for (const el of elementsAtPoint) {
        const panelEl = el.closest('[data-panel-id]');
        if (panelEl) {
          const panelId = panelEl.getAttribute('data-panel-id');
          if (panelId && panelId !== prev.fromPanelId) {
            // Check if connection already exists (either direction)
            const existingConnection = connections.find(
              c => (c.fromPanelId === prev.fromPanelId && c.toPanelId === panelId) ||
                   (c.fromPanelId === panelId && c.toPanelId === prev.fromPanelId)
            );
            if (!existingConnection) {
              targetPanelId = panelId;
            }
            break;
          }
        }
      }

      // Play sound when first entering a valid target
      if (targetPanelId && targetPanelId !== lastConnectionTargetRef.current) {
        soundEffects.playHoverSound('connection-target');
      }
      lastConnectionTargetRef.current = targetPanelId;

      return { ...prev, toX: x, toY: y, targetPanelId };
    });
  }, [connections]);

  const handleConnectionDragEnd = useCallback((fromPanelId: string, toPanelId: string | null, dropX: number, dropY: number) => {
    let targetId = toPanelId;

    if (toPanelId) {
      // Connecting to existing panel - check if connection already exists
      const existingConnection = connections.find(
        c => (c.fromPanelId === fromPanelId && c.toPanelId === toPanelId) ||
             (c.fromPanelId === toPanelId && c.toPanelId === fromPanelId)
      );
      if (existingConnection) {
        targetId = null; // Don't create duplicate connection
      }
    } else {
      // Dropped on empty space - spawn a new panel and connect to it
      const newPanelId = `floating-panel-${panelIdCounter.current++}`;
      const x = dropX - FLOATING_PANEL_SIZE.width / 2;
      const y = dropY - FLOATING_PANEL_SIZE.height / 2;

      setFloatingPanels(prev => [...prev, {
        id: newPanelId,
        x,
        y,
        width: FLOATING_PANEL_SIZE.width,
        height: FLOATING_PANEL_SIZE.height,
      }]);

      targetId = newPanelId;
      // Play spawn sound
      panelSounds.playRandomized(0.04, 0.9, 0.1);
    }

    if (targetId) {
      const connectionId = `connection-${fromPanelId}-${targetId}`;
      setConnections(prev => [...prev, {
        id: connectionId,
        fromPanelId,
        toPanelId: targetId,
      }]);
      // Play connection complete sound
      soundEffects.playQuickStartClick(0.06);
    }

    setConnectionDrag(null);
    lastConnectionTargetRef.current = null; // Reset target tracking
    touchedGridDotsRef.current.clear(); // Clear touched grid dots
    // Delay resetting to prevent click event from spawning a panel
    setTimeout(() => {
      isDraggingRef.current = false;
    }, 50);
  }, [connections]);

  const handleConnectionDelete = useCallback((panelId: string) => {
    setConnections(prev => prev.filter(c => c.fromPanelId !== panelId));
  }, []);

  const handleCutAnimationComplete = useCallback((connectionId: string) => {
    setCutConnections(prev => prev.filter(c => c.id !== connectionId));
  }, []);

  // Handle drag state changes to prevent click-spawn during drag
  const handleDragStart = useCallback((panelId: string) => {
    isDraggingRef.current = true;
    setTopPanelId(panelId);
  }, []);

  const handleDragEnd = useCallback(() => {
    // Delay resetting to prevent click event from firing
    setTimeout(() => {
      isDraggingRef.current = false;
    }, 50);
  }, []);

  return (
    <div
      style={{
        minHeight: '100vh',
        color: '#fff',
        position: 'relative',
        backgroundColor: '#171717', /* neutral-900 */
      }}
      onMouseDown={handleMouseDown}
      onMouseUp={handleMouseUp}
      onMouseMove={handleMouseMove}
      onMouseLeave={handleMouseLeave}
      onClick={handleGridClick}
      onTouchStart={handleTouchStart}
      onTouchMove={handleTouchMoveSlice}
      onTouchEnd={(e) => {
        // Only spawn panel if not slicing (check before handleTouchEnd clears the ref)
        const wasSlicing = sliceDragRef.current?.isSlicing;
        handleTouchEnd();
        if (!wasSlicing) {
          handleGridTouch(e);
        }
      }}
    >
      {/* WebGL Noise shader overlay */}
      <NoiseOverlay />

      {/* Global styles */}
      <style jsx global>{`
        .scrollbar-none::-webkit-scrollbar {
          display: none;
        }

        /* Animated generating text with shimmer */
        @keyframes textShimmer {
          0% { opacity: 0.5; }
          50% { opacity: 1; }
          100% { opacity: 0.5; }
        }
        @keyframes ellipsisFade {
          0%, 100% { opacity: 0.2; }
          50% { opacity: 1; }
        }
        .animate-generating {
          animation: textShimmer 2s ease-in-out infinite;
        }
        .animate-ellipsis span {
          display: inline-block;
        }
        .animate-ellipsis span:nth-child(1) {
          animation: ellipsisFade 1.2s ease-in-out infinite;
          animation-delay: 0s;
        }
        .animate-ellipsis span:nth-child(2) {
          animation: ellipsisFade 1.2s ease-in-out infinite;
          animation-delay: 0.15s;
        }
        .animate-ellipsis span:nth-child(3) {
          animation: ellipsisFade 1.2s ease-in-out infinite;
          animation-delay: 0.3s;
        }
      `}</style>

      {/* Dynamic dot grid */}
      <DotGridCanvas
        key={canvasResetKey}
        panelX={panelPos.x}
        panelY={panelPos.y}
        panelWidth={panelSize.width}
        panelHeight={panelSize.height}
        pulses={pulses}
        mousePos={mousePos}
        panels={floatingPanels.filter(p => !p.isExiting)}
        connections={connections}
        connectionDrag={connectionDrag}
        sliceTrail={sliceTrail}
        cutConnections={cutConnections}
        onCutAnimationComplete={handleCutAnimationComplete}
      />

      {/* Robot Logo - Top Left */}
      <div style={{ position: 'fixed', top: 32, left: 32, zIndex: 10 }}>
        <button
          onClick={() => {
            soundEffects.playQuickStartClick();
            router.push('/');
          }}
          onMouseEnter={() => soundEffects.playHoverSound('logo')}
          className="btn-skin"
          style={{
            width: 44,
            height: 44,
            borderRadius: 12,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            cursor: 'pointer',
            border: 'none',
            boxShadow: 'inset 0 1px 0 rgba(255, 255, 255, 0.08), 0 0 0 1px #171717',
          }}
        >
          <span
            style={{
              display: 'block',
              width: 20,
              height: 20,
              backgroundImage: 'url(/images/new-robot-logo.svg)',
              backgroundSize: 'contain',
              backgroundPosition: 'center',
              backgroundRepeat: 'no-repeat',
            }}
          />
        </button>
      </div>

      {/* Clear All - Top Right (only visible with 2+ panels) */}
      <AnimatePresence>
        {floatingPanels.filter(p => !p.isExiting).length >= 2 && (
          <motion.div
            initial={{ opacity: 0, y: -10 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -10 }}
            transition={{ duration: 0.2, ease: 'easeOut' }}
            onClick={(e) => {
              e.stopPropagation();
              soundEffects.playQuickStartClick();
              clearAll();
            }}
            onMouseEnter={() => soundEffects.playHoverSound('clear-all')}
            style={{
              position: 'fixed',
              top: 32,
              right: 32,
              zIndex: 10,
              display: 'flex',
              alignItems: 'center',
              gap: 10,
              cursor: 'pointer',
            }}
          >
            <span style={{ fontSize: 12, color: 'rgba(255,255,255,0.3)' }}>Clear all</span>
            <span style={{
              padding: '3px 7px',
              backgroundColor: 'rgba(255,255,255,0.08)',
              borderRadius: 4,
              fontSize: 11,
              fontWeight: 500,
              color: 'rgba(255,255,255,0.45)',
              fontFamily: 'monospace',
            }}>ESC</span>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Title and description */}
      <div style={{
        position: 'fixed',
        bottom: 32,
        left: 32,
        maxWidth: 320,
        zIndex: 10,
      }}>
        <h1 style={{ fontSize: 19, fontWeight: 600, color: 'rgba(255,255,255,0.8)' }}>
          Node Editor Canvas
        </h1>
        <p style={{ fontSize: 14, color: 'rgba(255,255,255,0.4)', marginTop: 6, lineHeight: 1.57 }}>
          Click anywhere to spawn nodes. Drag from the corner square to connect them. Slice through lines to cut connections.
        </p>
      </div>

      {/* Keyboard shortcuts - hidden on mobile via media query */}
      <div
        style={{
          position: 'fixed',
          bottom: 32,
          right: 32,
          display: 'grid',
          gridTemplateColumns: 'auto auto',
          gap: '6px 10px',
          alignItems: 'center',
          zIndex: 10,
        }}>
        <span style={{ fontSize: 12, color: 'rgba(255,255,255,0.3)', textAlign: 'right' }}>Snap to grid</span>
        <span style={{
          padding: '3px 7px',
          backgroundColor: 'rgba(255,255,255,0.08)',
          borderRadius: 4,
          fontSize: 11,
          fontWeight: 500,
          color: 'rgba(255,255,255,0.45)',
          fontFamily: 'monospace',
          minWidth: 72,
          textAlign: 'center',
        }}>⇧ Shift</span>
        <span style={{ fontSize: 12, color: 'rgba(255,255,255,0.3)', textAlign: 'right' }}>Scale from center</span>
        <span style={{
          padding: '3px 7px',
          backgroundColor: 'rgba(255,255,255,0.08)',
          borderRadius: 4,
          fontSize: 11,
          fontWeight: 500,
          color: 'rgba(255,255,255,0.45)',
          fontFamily: 'monospace',
          minWidth: 72,
          textAlign: 'center',
        }}>⌘ + Drag</span>
        <span style={{ fontSize: 12, color: 'rgba(255,255,255,0.3)', textAlign: 'right' }}>Lock aspect ratio</span>
        <span style={{
          padding: '3px 7px',
          backgroundColor: 'rgba(255,255,255,0.08)',
          borderRadius: 4,
          fontSize: 11,
          fontWeight: 500,
          color: 'rgba(255,255,255,0.45)',
          fontFamily: 'monospace',
          minWidth: 72,
          textAlign: 'center',
        }}>⌘ + Corner</span>
      </div>

      {/* Spawned floating panels */}
      {floatingPanels.map(panel => (
        <FloatingPanel
          key={`${panel.id}-${resizeKey}`}
          id={panel.id}
          initialX={panel.x}
          initialY={panel.y}
          initialWidth={panel.width}
          initialHeight={panel.height}
          config={config}
          isTopPanel={panel.id === topPanelId}
          isExiting={panel.isExiting}
          onPositionChange={handleFloatingPanelPositionChange}
          onSizeChange={handleFloatingPanelSizeChange}
          onBounce={handleBounce}
          onDragStart={handleDragStart}
          onDragEnd={handleDragEnd}
          onDismiss={handleFloatingPanelDismiss}
          onConnectionDragStart={handleConnectionDragStart}
          onConnectionDragMove={handleConnectionDragMove}
          onConnectionDragEnd={handleConnectionDragEnd}
          isConnectionTarget={connectionDrag?.targetPanelId === panel.id}
          hasOutgoingConnection={connections.some(c => c.fromPanelId === panel.id)}
          hasIncomingConnection={connections.some(c => c.toPanelId === panel.id)}
          onConnectionDelete={handleConnectionDelete}
        />
      ))}
    </div>
  );
}
