import { useCallback, useRef, useEffect } from 'react';
import { Point, Tool, EventCallbacks } from '../lib/canvas-types';
import { isPointInShape, isPointInShapeForEraser } from '../lib/canvas-utils';

export interface UseCanvasEventsConfig {
  containerRef: React.RefObject<HTMLDivElement>;
  canvasRef: React.RefObject<HTMLCanvasElement>;
  zoom: number;
  panOffset: Point;
  offsetX: number;
  offsetY: number;
  onZoomIn: () => void;
  onZoomOut: () => void;
  onPanChange: (panOffset: Point) => void;
  screenToCanvas: (point: Point, offsetX: number, offsetY: number) => Point;
}

export interface UseCanvasEventsReturn {
  handleMouseDown: (e: React.MouseEvent | React.TouchEvent) => void;
  handleMouseMove: (e: React.MouseEvent | React.TouchEvent) => void;
  handleMouseUp: () => void;
  handleKeyDown: (e: KeyboardEvent) => void;
  handleWheel: (e: React.WheelEvent) => void;
}

/**
 * Hook personalizado para manejar eventos del canvas
 */
export function useCanvasEvents(
  config: UseCanvasEventsConfig,
  callbacks: EventCallbacks = {}
): UseCanvasEventsReturn {
  const {
    containerRef,
    canvasRef,
    zoom,
    panOffset,
    offsetX,
    offsetY,
    onZoomIn,
    onZoomOut,
    onPanChange,
    screenToCanvas,
  } = config;

  const {
    onShapeSelect,
    onDrawingStart,
    onDrawingEnd,
    onTextComplete,
  } = callbacks;

  const isDraggingRef = useRef(false);
  const isPanningRef = useRef(false);
  const lastPanPointRef = useRef<Point>({ x: 0, y: 0 });
  const draggedShapeRef = useRef<{ id: string; offset: Point } | null>(null);

  /**
   * Obtiene coordenadas del evento de mouse o touch
   */
  const getEventCoordinates = useCallback((e: React.MouseEvent | React.TouchEvent): Point => {
    if ('touches' in e) {
      const touch = e.touches[0];
      return { x: touch.clientX, y: touch.clientY };
    } else {
      return { x: e.clientX, y: e.clientY };
    }
  }, []);

  /**
   * Maneja el evento de mouse/touch down
   */
  const handleMouseDown = useCallback((e: React.MouseEvent | React.TouchEvent) => {
    const coords = getEventCoordinates(e);
    const canvasPoint = screenToCanvas(coords, offsetX, offsetY);

    // Detectar si hay un gesto de pan (herramienta mano)
    if (e.shiftKey || e.ctrlKey) {
      isPanningRef.current = true;
      lastPanPointRef.current = coords;
      return;
    }

    // Detectar si se está haciendo clic en una forma para arrastrar
    const canvas = canvasRef.current;
    if (canvas) {
      const isTouchEvent = 'touches' in e;
      const shapeAtPoint = isPointInShape(canvasPoint, { id: '', type: 'pen', points: [], color: '', strokeWidth: 0, roughness: 0 }, isTouchEvent);

      if (shapeAtPoint) {
        // TODO: Implementar lógica de arrastre de formas
        isDraggingRef.current = true;
        draggedShapeRef.current = {
          id: shapeAtPoint.id,
          offset: {
            x: coords.x - panOffset.x,
            y: coords.y - panOffset.y,
          },
        };
        onShapeSelect?.(shapeAtPoint.id);
        return;
      }
    }

    // Iniciar dibujo
    onDrawingStart?.();
  }, [getEventCoordinates, screenToCanvas, offsetX, offsetY, panOffset, onShapeSelect, onDrawingStart]);

  /**
   * Maneja el evento de mouse/touch move
   */
  const handleMouseMove = useCallback((e: React.MouseEvent | React.TouchEvent) => {
    const coords = getEventCoordinates(e);

    // Manejar pan
    if (isPanningRef.current) {
      const deltaX = coords.x - lastPanPointRef.current.x;
      const deltaY = coords.y - lastPanPointRef.current.y;

      onPanChange({
        x: panOffset.x + deltaX,
        y: panOffset.y + deltaY,
      });

      lastPanPointRef.current = coords;
      return;
    }

    // Manejar arrastre de formas
    if (isDraggingRef.current && draggedShapeRef.current) {
      // TODO: Implementar lógica de actualización de posición de forma
      return;
    }

    // Continuar dibujo
    const canvasPoint = screenToCanvas(coords, offsetX, offsetY);
    // TODO: Implementar lógica de continuación de dibujo
  }, [getEventCoordinates, screenToCanvas, offsetX, offsetY, panOffset, onPanChange]);

  /**
   * Maneja el evento de mouse/touch up
   */
  const handleMouseUp = useCallback(() => {
    if (isDraggingRef.current) {
      isDraggingRef.current = false;
      draggedShapeRef.current = null;
    }

    if (isPanningRef.current) {
      isPanningRef.current = false;
    }

    onDrawingEnd?.();
  }, [onDrawingEnd]);

  /**
   * Maneja eventos de teclado
   */
  const handleKeyDown = useCallback((e: KeyboardEvent) => {
    // Ctrl/Cmd + scroll para zoom
    if (e.ctrlKey || e.metaKey) {
      switch (e.key) {
        case '+':
        case '=':
          e.preventDefault();
          onZoomIn();
          break;
        case '-':
        case '_':
          e.preventDefault();
          onZoomOut();
          break;
        case '0':
          e.preventDefault();
          // TODO: Implementar reset de zoom
          break;
      }
    }

    // Escape para cancelar acciones
    if (e.key === 'Escape') {
      handleMouseUp();
    }

    // Teclas de herramientas
    switch (e.key) {
      case 'v':
      case 'b':
        // TODO: Cambiar a herramienta de selección
        break;
      case 'p':
      case 'd':
        // TODO: Cambiar a herramienta de lápiz
        break;
      case 'e':
        // TODO: Cambiar a herramienta de borrador
        break;
      case 't':
        // TODO: Cambiar a herramienta de texto
        break;
      case 'h':
        // TODO: Cambiar a herramienta de mano
        break;
    }
  }, [onZoomIn, onZoomOut, handleMouseUp]);

  /**
   * Maneja eventos de rueda para zoom
   */
  const handleWheel = useCallback((e: React.WheelEvent) => {
    e.preventDefault();

    // Ctrl/Cmd + wheel para zoom
    if (e.ctrlKey || e.metaKey) {
      const delta = e.deltaY > 0 ? -10 : 10;
      const newZoom = Math.min(Math.max(zoom + delta, 50), 400);

      if (delta < 0) {
        onZoomOut();
      } else {
        onZoomIn();
      }

      return;
    }

    // Wheel normal para pan
    const deltaX = e.deltaX;
    const deltaY = e.deltaY;

    onPanChange({
      x: panOffset.x + deltaX,
      y: panOffset.y + deltaY,
    });
  }, [zoom, panOffset, onZoomIn, onZoomOut, onPanChange]);

  /**
   * Configura listeners globales
   */
  useEffect(() => {
    const handleGlobalKeyDown = (e: KeyboardEvent) => {
      handleKeyDown(e);
    };

    const handleGlobalMouseUp = () => {
      handleMouseUp();
    };

    document.addEventListener('keydown', handleGlobalKeyDown);
    document.addEventListener('mouseup', handleGlobalMouseUp);
    document.addEventListener('touchend', handleGlobalMouseUp);

    return () => {
      document.removeEventListener('keydown', handleGlobalKeyDown);
      document.removeEventListener('mouseup', handleGlobalMouseUp);
      document.removeEventListener('touchend', handleGlobalMouseUp);
    };
  }, [handleKeyDown, handleMouseUp]);

  return {
    handleMouseDown,
    handleMouseMove,
    handleMouseUp,
    handleKeyDown,
    handleWheel,
  };
}