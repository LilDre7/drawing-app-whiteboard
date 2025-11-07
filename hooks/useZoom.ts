import { useState, useRef, useCallback } from 'react';

export interface Point {
  x: number;
  y: number;
}

export interface ZoomState {
  zoom: number;
  panOffset: Point;
  scale: number;
  isPinching: boolean;
}

export interface ZoomCallbacks {
  onZoomChange?: (zoom: number) => void;
  onPanChange?: (panOffset: Point) => void;
  onRequestRender?: () => void;
}

/**
 * Hook personalizado para manejar el zoom y pan del canvas
 * Soporta tanto zoom por botones como pinch-to-zoom táctil
 */
export function useZoom(initialZoom = 100, callbacks: ZoomCallbacks = {}) {
  const [zoom, setZoom] = useState(initialZoom);
  const [panOffset, setPanOffset] = useState<Point>({ x: 0, y: 0 });

  // Estados para pinch-to-zoom
  const [isPinching, setIsPinching] = useState(false);
  const [initialTouchDistance, setInitialTouchDistance] = useState(0);
  const [pinchCenter, setPinchCenter] = useState<Point>({ x: 0, y: 0 });
  const [initialScale, setInitialScale] = useState(1);

  const pinchAnimationRef = useRef<number>();
  const containerRef = useRef<HTMLDivElement>(null);

  const scale = zoom / 100;

  // Callbacks
  const { onZoomChange, onPanChange, onRequestRender } = callbacks;

  /**
   * Restringe un valor entre un mínimo y un máximo
   */
  const clamp = useCallback((value: number, min: number, max: number): number => {
    return Math.min(Math.max(value, min), max);
  }, []);

  /**
   * Calcula la distancia entre dos puntos táctiles
   */
  const getTouchDistance = useCallback((touch1: React.Touch, touch2: React.Touch): number => {
    const dx = touch1.clientX - touch2.clientX;
    const dy = touch1.clientY - touch2.clientY;
    return Math.sqrt(dx * dx + dy * dy);
  }, []);

  /**
   * Calcula el punto medio entre dos toques
   */
  const getTouchCenter = useCallback((touch1: React.Touch, touch2: React.Touch): Point => {
    return {
      x: (touch1.clientX + touch2.clientX) / 2,
      y: (touch1.clientY + touch2.clientY) / 2,
    };
  }, []);

  /**
   * Zoom in mediante botón
   */
  const zoomIn = useCallback(() => {
    const newZoom = clamp(zoom + 10, 50, 400);
    setZoom(newZoom);
    onZoomChange?.(newZoom);
    onRequestRender?.();
  }, [zoom, clamp, onZoomChange, onRequestRender]);

  /**
   * Zoom out mediante botón
   */
  const zoomOut = useCallback(() => {
    const newZoom = clamp(zoom - 10, 50, 400);
    setZoom(newZoom);
    onZoomChange?.(newZoom);
    onRequestRender?.();
  }, [zoom, clamp, onZoomChange, onRequestRender]);

  /**
   * Establecer zoom directamente
   */
  const setZoomLevel = useCallback((newZoom: number) => {
    const clampedZoom = clamp(newZoom, 50, 400);
    setZoom(clampedZoom);
    onZoomChange?.(clampedZoom);
    onRequestRender?.();
  }, [clamp, onZoomChange, onRequestRender]);

  /**
   * Establecer pan offset directamente
   */
  const setPan = useCallback((newPanOffset: Point) => {
    setPanOffset(newPanOffset);
    onPanChange?.(newPanOffset);
    onRequestRender?.();
  }, [onPanChange, onRequestRender]);

  /**
   * Actualiza el pan para mantener el zoom centrado
   */
  const updatePanForZoom = useCallback((zoomCenter: Point, newZoom: number, offsetX: number, offsetY: number) => {
    const container = containerRef.current;
    if (!container) return;

    const rect = container.getBoundingClientRect();
    const currentScale = zoom / 100;
    const newScale = newZoom / 100;

    // Convertir coordenadas de pantalla a coordenadas del canvas
    const canvasPointX = (zoomCenter.x - rect.left - panOffset.x) / currentScale - offsetX;
    const canvasPointY = (zoomCenter.y - rect.top - panOffset.y) / currentScale - offsetY;

    // Calcular nueva posición de pan
    const newPanX = zoomCenter.x - rect.left - (canvasPointX + offsetX) * newScale;
    const newPanY = zoomCenter.y - rect.top - (canvasPointY + offsetY) * newScale;

    setPan({ x: newPanX, y: newPanY });
  }, [zoom, panOffset, setPan]);

  /**
   * Inicia el gesto de pinch-to-zoom
   */
  const startPinchZoom = useCallback((touch1: React.Touch, touch2: React.Touch) => {
    const distance = getTouchDistance(touch1, touch2);
    const center = getTouchCenter(touch1, touch2);

    setInitialTouchDistance(distance);
    setPinchCenter(center);
    setInitialScale(zoom / 100);
    setIsPinching(true);
  }, [getTouchDistance, getTouchCenter, zoom]);

  /**
   * Aplica zoom de forma suave usando requestAnimationFrame
   */
  const applySmoothPinchZoom = useCallback((touch1: React.Touch, touch2: React.Touch, offsetX: number, offsetY: number) => {
    if (pinchAnimationRef.current) {
      cancelAnimationFrame(pinchAnimationRef.current);
    }

    const animate = () => {
      const currentDistance = getTouchDistance(touch1, touch2);
      const center = getTouchCenter(touch1, touch2);

      const zoomFactor = currentDistance / initialTouchDistance;
      const newScale = clamp(initialScale * zoomFactor, 0.5, 4.0);
      const newZoom = newScale * 100;

      setPinchCenter(center);
      updatePanForZoom(center, newZoom, offsetX, offsetY);
      setZoom(newZoom);

      if (isPinching) {
        onRequestRender?.();
      }
    };

    pinchAnimationRef.current = requestAnimationFrame(animate);
  }, [initialTouchDistance, initialScale, isPinching, getTouchDistance, getTouchCenter, clamp, updatePanForZoom, onRequestRender]);

  /**
   * Finaliza el gesto de pinch-to-zoom
   */
  const endPinchZoom = useCallback(() => {
    setIsPinching(false);

    if (pinchAnimationRef.current) {
      cancelAnimationFrame(pinchAnimationRef.current);
      pinchAnimationRef.current = undefined;
    }

    setInitialTouchDistance(0);
    setInitialScale(1);
  }, []);

  /**
   * Convierte coordenadas de pantalla a coordenadas del canvas
   */
  const screenToCanvas = useCallback((screenPoint: Point, offsetX: number, offsetY: number): Point => {
    const scale = zoom / 100;
    return {
      x: (screenPoint.x - offsetX - panOffset.x) / scale + offsetX,
      y: (screenPoint.y - offsetY - panOffset.y) / scale + offsetY,
    };
  }, [zoom, panOffset]);

  /**
   * Convierte coordenadas del canvas a coordenadas de pantalla
   */
  const canvasToScreen = useCallback((canvasPoint: Point, offsetX: number, offsetY: number): Point => {
    const scale = zoom / 100;
    return {
      x: (canvasPoint.x - offsetX) * scale + offsetX + panOffset.x,
      y: (canvasPoint.y - offsetY) * scale + offsetY + panOffset.y,
    };
  }, [zoom, panOffset]);

  /**
   * Limpia recursos al desmontar
   */
  const cleanup = useCallback(() => {
    endPinchZoom();
  }, [endPinchZoom]);

  return {
    // Estado
    zoom,
    panOffset,
    scale,
    isPinching,

    // Refs
    containerRef,

    // Acciones
    zoomIn,
    zoomOut,
    setZoomLevel,
    setPan,
    startPinchZoom,
    applySmoothPinchZoom,
    endPinchZoom,

    // Utilidades
    screenToCanvas,
    canvasToScreen,
    cleanup,

    // Estado completo para conveniencia
    state: {
      zoom,
      panOffset,
      scale,
      isPinching,
    } as ZoomState,
  };
}