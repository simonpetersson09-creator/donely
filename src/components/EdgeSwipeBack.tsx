import { useRouter } from "@tanstack/react-router";
import { useEffect, useRef, type ReactNode } from "react";

const EDGE_WIDTH = 28; // px from the left edge where the gesture may start
const TRIGGER_RATIO = 0.32; // fraction of screen width needed to go back
const TRIGGER_VELOCITY = 0.45; // px/ms flick shortcut

/**
 * iOS-style "swipe from the left edge to go back" gesture.
 * Purely presentational: it drags the current screen to the right while the
 * finger moves and calls router.history.back() when the swipe is committed.
 */
export function EdgeSwipeBack({ children }: { children: ReactNode }) {
  const router = useRouter();
  const surfaceRef = useRef<HTMLDivElement>(null);
  const state = useRef({
    active: false,
    startX: 0,
    startY: 0,
    startTime: 0,
    lastX: 0,
    lastTime: 0,
    width: 1,
  });

  useEffect(() => {
    const surface = surfaceRef.current;
    if (!surface) return;

    const setTransform = (x: number, animate: boolean) => {
      surface.style.transition = animate
        ? "transform 220ms cubic-bezier(0.32, 0.72, 0, 1)"
        : "none";
      surface.style.transform = x === 0 ? "" : `translate3d(${x}px, 0, 0)`;
    };

    const reset = (animate: boolean) => {
      setTransform(0, animate);
      if (animate) {
        window.setTimeout(() => {
          if (!state.current.active) surface.style.transition = "";
        }, 240);
      }
    };

    const canGoBack = () => {
      // Root screen has nothing to return to.
      if (typeof window === "undefined") return false;
      if (window.location.pathname === "/") return false;
      return window.history.length > 1;
    };

    const onTouchStart = (event: TouchEvent) => {
      if (event.touches.length !== 1) return;
      const touch = event.touches[0];
      if (touch.clientX > EDGE_WIDTH) return;
      if (!canGoBack()) return;

      state.current = {
        active: true,
        startX: touch.clientX,
        startY: touch.clientY,
        startTime: event.timeStamp,
        lastX: touch.clientX,
        lastTime: event.timeStamp,
        width: window.innerWidth || 1,
      };
    };

    const onTouchMove = (event: TouchEvent) => {
      const s = state.current;
      if (!s.active) return;
      const touch = event.touches[0];
      const dx = touch.clientX - s.startX;
      const dy = touch.clientY - s.startY;

      // Vertical intent wins – abandon the gesture.
      if (Math.abs(dy) > Math.abs(dx) && Math.abs(dy) > 12) {
        s.active = false;
        reset(true);
        return;
      }

      if (dx <= 0) return;
      if (event.cancelable) event.preventDefault();

      s.lastX = touch.clientX;
      s.lastTime = event.timeStamp;
      setTransform(Math.min(dx, s.width), false);
    };

    const onTouchEnd = (event: TouchEvent) => {
      const s = state.current;
      if (!s.active) return;
      s.active = false;

      const dx = s.lastX - s.startX;
      const elapsed = Math.max(event.timeStamp - s.startTime, 1);
      const velocity = dx / elapsed;
      const committed = dx > s.width * TRIGGER_RATIO || velocity > TRIGGER_VELOCITY;

      if (committed) {
        setTransform(s.width, true);
        window.setTimeout(() => {
          surface.style.transition = "";
          surface.style.transform = "";
          router.history.back();
        }, 200);
      } else {
        reset(true);
      }
    };

    surface.addEventListener("touchstart", onTouchStart, { passive: true });
    surface.addEventListener("touchmove", onTouchMove, { passive: false });
    surface.addEventListener("touchend", onTouchEnd, { passive: true });
    surface.addEventListener("touchcancel", onTouchEnd, { passive: true });

    return () => {
      surface.removeEventListener("touchstart", onTouchStart);
      surface.removeEventListener("touchmove", onTouchMove);
      surface.removeEventListener("touchend", onTouchEnd);
      surface.removeEventListener("touchcancel", onTouchEnd);
    };
  }, [router]);

  return (
    <div ref={surfaceRef} className="min-h-screen will-change-transform">
      {children}
    </div>
  );
}
