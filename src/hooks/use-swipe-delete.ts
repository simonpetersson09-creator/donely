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
      movedRef.current = false;
      setDragging(true);
      (e.currentTarget as Element).setPointerCapture?.(e.pointerId);
    },
    [enabled]
  );

  const onPointerMove = useCallback(
    (e: React.PointerEvent) => {
      if (!enabled || !dragging) return;
      const delta = e.clientX - startXRef.current;
      if (Math.abs(delta) > 4) movedRef.current = true;
      // Only allow swiping left; right-swipe snaps back immediately.
      const next = Math.min(0, Math.max(-revealWidth, delta));
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
