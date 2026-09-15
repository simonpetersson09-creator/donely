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

  const close = useCallback(() => {
    setOffset(0);
    setDragging(false);
    movedRef.current = false;
  }, []);

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
      setOffset(next);
    },
    [enabled, dragging, revealWidth]
  );

  const onPointerUp = useCallback(
    (e: React.PointerEvent) => {
      if (!enabled) return;
      setDragging(false);
      (e.currentTarget as Element).releasePointerCapture?.(e.pointerId);
      if (offset <= -threshold) {
        setOffset(-revealWidth);
      } else {
        setOffset(0);
        movedRef.current = false;
      }
    },
    [enabled, offset, threshold, revealWidth]
  );

  const onPointerCancel = useCallback(() => {
    setDragging(false);
    setOffset(0);
    movedRef.current = false;
  }, []);

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
