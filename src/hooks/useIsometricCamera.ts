import { useCallback, useRef } from 'react';
import type { Camera } from '../engine/types';

export interface SmoothCameraState extends Camera {
  targetX: number;
  targetY: number;
}

export function useIsometricCamera(initialX: number, initialY: number, initialZoom = 1.05) {
  const cameraRef = useRef<SmoothCameraState>({
    x: initialX,
    y: initialY,
    zoom: initialZoom,
    targetX: initialX,
    targetY: initialY,
    targetZoom: initialZoom,
  });

  const dragState = useRef<{
    active: boolean;
    moved: boolean;
    startX: number;
    startY: number;
    lastX: number;
    lastY: number;
    pinchDist: number | null;
  }>({
    active: false,
    moved: false,
    startX: 0,
    startY: 0,
    lastX: 0,
    lastY: 0,
    pinchDist: null,
  });

  const centerOn = useCallback((x: number, y: number, zoom = 1.05) => {
    cameraRef.current = {
      x,
      y,
      zoom,
      targetX: x,
      targetY: y,
      targetZoom: zoom,
    };
  }, []);

  const zoomBy = useCallback((factor: number, pivotX?: number, pivotY?: number) => {
    const cam = cameraRef.current;
    const nextZoom = Math.max(0.4, Math.min(2.6, cam.targetZoom * factor));
    if (pivotX === undefined || pivotY === undefined) {
      cam.targetZoom = nextZoom;
      return;
    }
    const scaleChange = nextZoom / cam.targetZoom;
    cam.targetX = pivotX - (pivotX - cam.targetX) * scaleChange;
    cam.targetY = pivotY - (pivotY - cam.targetY) * scaleChange;
    cam.targetZoom = nextZoom;
  }, []);

  const stepCameraAnimation = useCallback(() => {
    const cam = cameraRef.current;
    const lerp = 0.28;
    if (Math.abs(cam.targetX - cam.x) > 0.05) {
      cam.x += (cam.targetX - cam.x) * lerp;
    } else {
      cam.x = cam.targetX;
    }
    if (Math.abs(cam.targetY - cam.y) > 0.05) {
      cam.y += (cam.targetY - cam.y) * lerp;
    } else {
      cam.y = cam.targetY;
    }
    if (Math.abs(cam.targetZoom - cam.zoom) > 0.0008) {
      cam.zoom += (cam.targetZoom - cam.zoom) * lerp;
    } else {
      cam.zoom = cam.targetZoom;
    }
  }, []);

  const onMouseDown = useCallback((e: React.MouseEvent<HTMLCanvasElement>) => {
    dragState.current = {
      active: true,
      moved: false,
      startX: e.clientX,
      startY: e.clientY,
      lastX: e.clientX,
      lastY: e.clientY,
      pinchDist: null,
    };
  }, []);

  const onMouseMove = useCallback((e: React.MouseEvent<HTMLCanvasElement>) => {
    if (!dragState.current.active) return;
    const dx = e.clientX - dragState.current.lastX;
    const dy = e.clientY - dragState.current.lastY;
    if (Math.hypot(e.clientX - dragState.current.startX, e.clientY - dragState.current.startY) > 5) {
      dragState.current.moved = true;
    }
    dragState.current.lastX = e.clientX;
    dragState.current.lastY = e.clientY;

    const cam = cameraRef.current;
    cam.x += dx;
    cam.y += dy;
    cam.targetX += dx;
    cam.targetY += dy;
  }, []);

  const onMouseUp = useCallback((): boolean => {
    const wasClick = !dragState.current.moved;
    dragState.current.active = false;
    return wasClick;
  }, []);

  const onWheel = useCallback(
    (e: React.WheelEvent<HTMLCanvasElement>) => {
      const rect = e.currentTarget.getBoundingClientRect();
      const px = e.clientX - rect.left;
      const py = e.clientY - rect.top;
      const factor = e.deltaY < 0 ? 1.13 : 0.885;
      zoomBy(factor, px, py);
    },
    [zoomBy]
  );

  const onTouchStart = useCallback((e: React.TouchEvent<HTMLCanvasElement>) => {
    if (e.touches.length === 1) {
      const t = e.touches[0];
      dragState.current = {
        active: true,
        moved: false,
        startX: t.clientX,
        startY: t.clientY,
        lastX: t.clientX,
        lastY: t.clientY,
        pinchDist: null,
      };
    } else if (e.touches.length === 2) {
      const d = Math.hypot(
        e.touches[0].clientX - e.touches[1].clientX,
        e.touches[0].clientY - e.touches[1].clientY
      );
      dragState.current.pinchDist = d;
      dragState.current.moved = true;
    }
  }, []);

  const onTouchMove = useCallback(
    (e: React.TouchEvent<HTMLCanvasElement>) => {
      if (e.touches.length === 1 && dragState.current.active) {
        const t = e.touches[0];
        const dx = t.clientX - dragState.current.lastX;
        const dy = t.clientY - dragState.current.lastY;
        if (Math.hypot(t.clientX - dragState.current.startX, t.clientY - dragState.current.startY) > 7) {
          dragState.current.moved = true;
        }
        dragState.current.lastX = t.clientX;
        dragState.current.lastY = t.clientY;
        const cam = cameraRef.current;
        cam.x += dx;
        cam.y += dy;
        cam.targetX += dx;
        cam.targetY += dy;
      } else if (e.touches.length === 2 && dragState.current.pinchDist) {
        const d = Math.hypot(
          e.touches[0].clientX - e.touches[1].clientX,
          e.touches[0].clientY - e.touches[1].clientY
        );
        const ratio = d / dragState.current.pinchDist;
        dragState.current.pinchDist = d;
        const rect = e.currentTarget.getBoundingClientRect();
        const midX = (e.touches[0].clientX + e.touches[1].clientX) / 2 - rect.left;
        const midY = (e.touches[0].clientY + e.touches[1].clientY) / 2 - rect.top;
        zoomBy(ratio, midX, midY);
      }
    },
    [zoomBy]
  );

  const onTouchEnd = useCallback((): boolean => {
    const wasTap = !dragState.current.moved;
    dragState.current.active = false;
    dragState.current.pinchDist = null;
    return wasTap;
  }, []);

  return {
    cameraRef,
    centerOn,
    zoomBy,
    stepCameraAnimation,
    handlers: {
      onMouseDown,
      onMouseMove,
      onMouseUp,
      onWheel,
      onTouchStart,
      onTouchMove,
      onTouchEnd,
    },
  };
}
