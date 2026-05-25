'use client';

import { useEffect, useRef, useState, type RefObject } from 'react';
import {
  DIAL_MENU_CONTROL_LAYOUT,
  type DialMenuHandle,
  type DialMenuControlPoint,
} from '../../src/dialmenu/DialMenu';

interface DialMenuState {
  isOpen: boolean;
  position: DialMenuControlPoint;
}

interface UseDualSenseDialControlsOptions {
  menu: DialMenuState;
  dialMenuRef: RefObject<DialMenuHandle>;
  cursorRef: RefObject<HTMLDivElement>;
  openAt: (x: number, y: number) => void;
  closeMenu: () => void;
}

interface UseDualSenseDialControlsResult {
  gamepadLabel: string;
}

const GAMEPAD_LEFT_STICK_DEADZONE = 0.35;
const GAMEPAD_RIGHT_STICK_DEADZONE = 0.18;
const CURSOR_SPEED = 18;

export function useDualSenseDialControls({
  menu,
  dialMenuRef,
  cursorRef,
  openAt,
  closeMenu,
}: UseDualSenseDialControlsOptions): UseDualSenseDialControlsResult {
  const [gamepadLabel, setGamepadLabel] = useState('DualSense not detected');

  const cursorPositionRef = useRef<DialMenuControlPoint | null>(null);
  const latestRef = useRef({ menu, dialMenuRef, cursorRef, openAt, closeMenu });
  const buttonsRef = useRef({
    r2WasPressed: false,
    l1WasPressed: false,
    r1WasPressed: false,
    crossWasPressed: false,
    circleWasPressed: false,
  });

  useEffect(() => {
    latestRef.current = { menu, dialMenuRef, cursorRef, openAt, closeMenu };
    if (!menu.isOpen) {
      dialMenuRef.current?.setExternalPointer(null);
    }
  }, [closeMenu, cursorRef, dialMenuRef, menu, openAt]);

  useEffect(() => {
    let isPolling = true;

    cursorPositionRef.current = {
      x: window.innerWidth / 2,
      y: window.innerHeight / 2,
    };
    if (cursorRef.current) {
      cursorRef.current.style.transform =
        `translate3d(${cursorPositionRef.current.x}px, ${cursorPositionRef.current.y}px, 0) translate(-50%, -50%)`;
    }

    const pollGamepad = () => {
      if (!isPolling) return;

      const pads = navigator.getGamepads?.() ?? [];
      const pad = Array.from(pads).find((candidate) => candidate);
      const latest = latestRef.current;
      const buttons = buttonsRef.current;

      if (!pad) {
        setGamepadLabel((current) => (
          current === 'DualSense not detected' ? current : 'DualSense not detected'
        ));
        requestAnimationFrame(pollGamepad);
        return;
      }

      const nextLabel = pad.id || 'Gamepad connected';
      setGamepadLabel((current) => (current === nextLabel ? current : nextLabel));

      const leftX = pad.axes[0] ?? 0;
      const leftY = pad.axes[1] ?? 0;
      const rightX = pad.axes[2] ?? 0;
      const rightY = pad.axes[3] ?? 0;
      const magnitude = Math.hypot(leftX, leftY);
      const rightMagnitude = Math.hypot(rightX, rightY);
      const l1Pressed = Boolean(pad.buttons[4]?.pressed);
      const r1Pressed = Boolean(pad.buttons[5]?.pressed);
      const r2Pressed = (pad.buttons[7]?.value ?? 0) > 0.45 || Boolean(pad.buttons[7]?.pressed);
      const crossPressed = Boolean(pad.buttons[0]?.pressed);
      const circlePressed = Boolean(pad.buttons[1]?.pressed);

      if (r2Pressed && !buttons.r2WasPressed) {
        if (latest.menu.isOpen) {
          latest.closeMenu();
        } else {
          const cursor = cursorPositionRef.current ?? {
            x: window.innerWidth / 2,
            y: window.innerHeight / 2,
          };
          latest.openAt(cursor.x, cursor.y);
        }
      }
      buttons.r2WasPressed = r2Pressed;

      if (rightMagnitude > GAMEPAD_RIGHT_STICK_DEADZONE) {
        const cursor = cursorPositionRef.current ?? {
          x: window.innerWidth / 2,
          y: window.innerHeight / 2,
        };
        const speed = CURSOR_SPEED * Math.min(1, rightMagnitude);
        cursorPositionRef.current = {
          x: Math.max(0, Math.min(window.innerWidth, cursor.x + rightX * speed)),
          y: Math.max(0, Math.min(window.innerHeight, cursor.y + rightY * speed)),
        };
        if (latest.cursorRef.current) {
          latest.cursorRef.current.style.transform =
            `translate3d(${cursorPositionRef.current.x}px, ${cursorPositionRef.current.y}px, 0) translate(-50%, -50%)`;
        }
      }

      if (latest.menu.isOpen && l1Pressed && !buttons.l1WasPressed) {
        latest.dialMenuRef.current?.previousPage();
      }
      buttons.l1WasPressed = l1Pressed;

      if (latest.menu.isOpen && r1Pressed && !buttons.r1WasPressed) {
        latest.dialMenuRef.current?.nextPage();
      }
      buttons.r1WasPressed = r1Pressed;

      if (latest.menu.isOpen && magnitude > GAMEPAD_LEFT_STICK_DEADZONE) {
        const angle = Math.atan2(leftY, leftX);
        latest.dialMenuRef.current?.setExternalPointer({
          x: latest.menu.position.x + Math.cos(angle) * DIAL_MENU_CONTROL_LAYOUT.pointerRadius,
          y: latest.menu.position.y + Math.sin(angle) * DIAL_MENU_CONTROL_LAYOUT.pointerRadius,
        });
      } else {
        latest.dialMenuRef.current?.setExternalPointer(null);
      }

      if (latest.menu.isOpen && crossPressed && !buttons.crossWasPressed) {
        latest.dialMenuRef.current?.confirmActive();
      }
      buttons.crossWasPressed = crossPressed;

      if (latest.menu.isOpen && circlePressed && !buttons.circleWasPressed) {
        latest.closeMenu();
      }
      buttons.circleWasPressed = circlePressed;

      requestAnimationFrame(pollGamepad);
    };

    const frame = requestAnimationFrame(pollGamepad);
    return () => {
      isPolling = false;
      cancelAnimationFrame(frame);
    };
  }, []);

  return {
    gamepadLabel,
  };
}
