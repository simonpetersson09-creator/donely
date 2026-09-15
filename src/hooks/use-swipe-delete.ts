import { useCallback, useRef, useState } from "react";

interface UseSwipeDeleteOptions {
  onDelete: () => void;
  threshold?: number;
  revealWidth?: number;
  enabled?: boolean;
}

export function useSwipeDelete({
  onDelete,
  threshold = 60,
  revealWidth = 72,
  enabled = true,
}: UseSwipeDeleteOptions) {
  const [offset, setOffset] = useState(0);
  const [dragging, setDragging] = useState(false);
  const startXRef = useRef(0);
  const startYRef = useRef(0);
  const movedRef = useRef(false);
  // Mirror of offset that is always current — onPointerUp must not depend on
  // a possibly stale closure value or fast swipes snap back instead of opening.
  const offsetRef = useRef(0);

  const applyOffset = useCallback((value: number) => {
    offsetRef.current = value;
    setOffset(value);
  }, []);

  const close = useCallback(() => {
    applyOffset(0);
    setDragging(false);
    movedRef.current = false;
  }, [applyOffset]);

  const confirmDelete = useCallback(() => {
    onDelete();
    close();
  }, [onDelete, close]);

  const onPointerDown = useCallback(
    (e: React.PointerEvent) => {
      if (!enabled) return;
      startXRef.current = e.clientX;
      startYRef.current = e.clientY;
      movedRef.current = false;
      setDragging(true);
      (e.currentTarget as Element).setPointerCapture?.(e.pointerId);
    },
    [enabled]
  );

  const onPointerMove = useCallback(
    (e: React.PointerEvent) => {
      if (!enabled || !dragging) return;
      const deltaX = e.clientX - startXRef.current;
      const deltaY = e.clientY - startYRef.current;
      // Only treat horizontal motion as a swipe when it clearly dominates
      // vertical scrolling and is larger than a normal tap jitter.
      if (Math.abs(deltaX) > 10 && Math.abs(deltaX) > Math.abs(deltaY)) {
        movedRef.current = true;
      }
      // Only allow swiping left; right-swipe snaps back immediately.
      const next = Math.min(0, Math.max(-revealWidth, deltaX));
      applyOffset(next);
    },
    [enabled, dragging, revealWidth, applyOffset]
  );

  const onPointerUp = useCallback(
    (e: React.PointerEvent) => {
      if (!enabled) return;
      setDragging(false);
      (e.currentTarget as Element).releasePointerCapture?.(e.pointerId);
      if (offsetRef.current <= -threshold) {
        applyOffset(-revealWidth);
      } else {
        applyOffset(0);
        movedRef.current = false;
      }
    },
    [enabled, threshold, revealWidth, applyOffset]
  );

  const onPointerCancel = useCallback(() => {
    setDragging(false);
    applyOffset(0);
    movedRef.current = false;
  }, [applyOffset]);

  const shouldTriggerAction = useCallback(() => {
    const didMove = movedRef.current;
    movedRef.current = false;
    return !didMove;
  }, []);

  return {
    offset,
    dragging,
    open: offset <= -threshold,
    handlers: {
      onPointerDown,
      onPointerMove,
      onPointerUp,
      onPointerCancel,
    },
    confirmDelete,
    close,
    shouldTriggerAction,
  };
}
