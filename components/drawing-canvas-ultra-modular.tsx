'use client';

import React, { useRef, useEffect, useState, useCallback } from 'react';
import { cn } from '@/lib/utils';
import {
  // Zoom functions
  getTouchDistance,
  getTouchCenter,
  clamp,
  screenToCanvas,
  canvasToScreen,
  updatePanForZoom,
  // Drawing functions
  createShape,
  isPointInShape,
  getShapeAtPoint,
  // Event functions
  getEventCoordinates,
  handleZoomKeyboard,
  handleToolKeyboard,
  handleWheelZoom,
  handleTouchStart,
  handleTouchMove,
  handleTouchEnd,
  // Rendering functions
  clearCanvas,
  setupContext,
  drawShape,
  resizeCanvas,
  requestRender,
} from '@/functions';
import {
  Tool,
  Point,
  Shape,
  DrawingState,
} from '@/lib/canvas-types';

interface DrawingCanvasUltraModularProps {
  width?: number;
  height?: number;
  className?: string;
}

/**
 * Componente de canvas ultra-modular
 *
 * Cada función está en su propio archivo:
 * - functions/zoom/ - Funciones de zoom
 * - functions/drawing/ - Funciones de dibujo
 * - functions/events/ - Funciones de eventos
 * - functions/rendering/ - Funciones de renderizado
 */
export function DrawingCanvasUltraModular({
  width = 800,
  height = 600,
  className,
}: DrawingCanvasUltraModularProps) {
  // Refs
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const renderRafRef = useRef<number>();

  // Estados
  const [tool, setTool] = useState<Tool>('pen');
  const [color, setColor] = useState('#1e293b');
  const [strokeWidth, setStrokeWidth] = useState(2);
  const [zoom, setZoom] = useState(100);
  const [panOffset, setPanOffset] = useState<Point>({ x: 0, y: 0 });
  const [shapes, setShapes] = useState<Shape[]>([]);
  const [isDrawing, setIsDrawing] = useState(false);
  const [currentShape, setCurrentShape] = useState<Shape | null>(null);

  // Constantes
  const dpr = window.devicePixelRatio || 1;
  const offsetX = width / 2;
  const offsetY = height / 2;
  const scale = zoom / 100;

  // === FUNCIONES DE ZOOM ===
  const zoomIn = useCallback(() => {
    const newZoom = clamp(zoom + 10, 50, 400);
    setZoom(newZoom);
    requestRender(renderCanvas, renderRafRef);
  }, [zoom]);

  const zoomOut = useCallback(() => {
    const newZoom = clamp(zoom - 10, 50, 400);
    setZoom(newZoom);
    requestRender(renderCanvas, renderRafRef);
  }, [zoom]);

  const startPinchZoom = useCallback((touch1: React.Touch, touch2: React.Touch) => {
    const distance = getTouchDistance(touch1, touch2);
    const center = getTouchCenter(touch1, touch2);
    console.log('Pinch zoom started:', distance, center);
    // TODO: Implementar lógica completa de pinch
  }, []);

  // === FUNCIONES DE DIBUJO ===
  const startDrawing = useCallback((point: Point) => {
    const newShape = createShape(tool, point, color, strokeWidth, 0.2);
    setCurrentShape(newShape);
    setIsDrawing(true);
  }, [tool, color, strokeWidth]);

  const continueDrawing = useCallback((point: Point) => {
    if (!isDrawing || !currentShape) return;

    const updatedShape = {
      ...currentShape,
      points: [...currentShape.points, point],
    };

    setCurrentShape(updatedShape);
    requestRender(renderCanvas, renderRafRef);
  }, [isDrawing, currentShape]);

  const stopDrawing = useCallback(() => {
    if (!isDrawing || !currentShape) return;

    setShapes(prev => [...prev, currentShape]);
    setCurrentShape(null);
    setIsDrawing(false);
    requestRender(renderCanvas, renderRafRef);
  }, [isDrawing, currentShape]);

  // === FUNCIONES DE EVENTOS ===
  const handleMouseDown = useCallback((e: React.MouseEvent | React.TouchEvent) => {
    const coords = getEventCoordinates(e);
    const canvasPoint = screenToCanvas(coords, offsetX, offsetY, zoom, panOffset);
    startDrawing(canvasPoint);
  }, [startDrawing, offsetX, offsetY, zoom, panOffset]);

  const handleMouseMove = useCallback((e: React.MouseEvent | React.TouchEvent) => {
    const coords = getEventCoordinates(e);
    const canvasPoint = screenToCanvas(coords, offsetX, offsetY, zoom, panOffset);
    continueDrawing(canvasPoint);
  }, [continueDrawing, offsetX, offsetY, zoom, panOffset]);

  const handleMouseUp = useCallback(() => {
    stopDrawing();
  }, [stopDrawing]);

  const handleKeyDown = useCallback((e: KeyboardEvent) => {
    handleZoomKeyboard(e, zoomIn, zoomOut);
    handleToolKeyboard(e, setTool);

    if (e.key === 'Escape') {
      stopDrawing();
    }
  }, [zoomIn, zoomOut, stopDrawing]);

  const handleWheel = useCallback((e: React.WheelEvent) => {
    handleWheelZoom(e, zoom, zoomIn, zoomOut, setPanOffset, panOffset);
  }, [zoom, zoomIn, zoomOut, panOffset]);

  // === FUNCIONES DE RENDERIZADO ===
  const renderCanvas = useCallback(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    // Limpiar canvas
    clearCanvas(canvas);

    // Configurar contexto
    setupContext(ctx, dpr, scale, panOffset);

    // Dibujar fondo
    ctx.fillStyle = '#ffffff';
    ctx.fillRect(0, 0, canvas.width / dpr, canvas.height / dpr);

    // Dibujar todas las formas
    shapes.forEach(shape => {
      drawShape(ctx, shape);
    });

    // Dibujar forma actual
    if (currentShape) {
      drawShape(ctx, currentShape);
    }
  }, [shapes, currentShape, dpr, scale, panOffset]);

  // === EVENTOS TÁCTILES ===
  const handleTouchStartCallback = useCallback((e: React.TouchEvent) => {
    handleTouchStart(
      e,
      (e) => getEventCoordinates(e),
      startPinchZoom,
      (point) => {
        const canvasPoint = screenToCanvas(point, offsetX, offsetY, zoom, panOffset);
        startDrawing(canvasPoint);
      },
      false // isPinching
    );
  }, [startPinchZoom, startDrawing, offsetX, offsetY, zoom, panOffset]);

  const handleTouchMoveCallback = useCallback((e: React.TouchEvent) => {
    handleTouchMove(
      e,
      (e) => getEventCoordinates(e),
      (touch1, touch2, offsetX, offsetY) => {
        // TODO: Implementar movimiento de pinch
        console.log('Pinch move');
      },
      (point) => {
        const canvasPoint = screenToCanvas(point, offsetX, offsetY, zoom, panOffset);
        continueDrawing(canvasPoint);
      },
      false, // isPinching
      offsetX,
      offsetY
    );
  }, [continueDrawing, offsetX, offsetY, zoom, panOffset]);

  const handleTouchEndCallback = useCallback((e: React.TouchEvent) => {
    handleTouchEnd(
      e,
      () => {
        // TODO: Implementar fin de pinch
        console.log('Pinch end');
      },
      stopDrawing,
      false // isPinching
    );
  }, [stopDrawing]);

  // === EFECTOS ===
  useEffect(() => {
    if (canvasRef.current) {
      resizeCanvas(canvasRef.current, width, height, dpr);
      renderCanvas();
    }
  }, [width, height, dpr, renderCanvas]);

  useEffect(() => {
    document.addEventListener('keydown', handleKeyDown);
    return () => document.removeEventListener('keydown', handleKeyDown);
  }, [handleKeyDown]);

  return (
    <div
      ref={containerRef}
      className={cn(
        'relative w-full h-full overflow-hidden bg-white',
        className
      )}
      style={{ width, height }}
    >
      <canvas
        ref={canvasRef}
        className='absolute inset-0 h-full w-full cursor-crosshair'
        onMouseDown={handleMouseDown}
        onMouseMove={handleMouseMove}
        onMouseUp={handleMouseUp}
        onMouseLeave={handleMouseUp}
        onWheel={handleWheel}
        onTouchStart={handleTouchStartCallback}
        onTouchMove={handleTouchMoveCallback}
        onTouchEnd={handleTouchEndCallback}
      />

      {/* Controles de zoom */}
      <div className='absolute bottom-4 right-4 flex flex-col gap-2'>
        <button
          onClick={zoomIn}
          className='bg-white border border-gray-300 rounded p-2 hover:bg-gray-100'
          title='Zoom In'
        >
          <svg className='w-4 h-4' fill='none' stroke='currentColor' viewBox='0 0 24 24'>
            <path strokeLinecap='round' strokeLinejoin='round' strokeWidth={2} d='M12 4v16m8-8H4' />
          </svg>
        </button>
        <div className='bg-white border border-gray-300 rounded px-2 py-1 text-center text-sm'>
          {Math.round(zoom)}%
        </div>
        <button
          onClick={zoomOut}
          className='bg-white border border-gray-300 rounded p-2 hover:bg-gray-100'
          title='Zoom Out'
        >
          <svg className='w-4 h-4' fill='none' stroke='currentColor' viewBox='0 0 24 24'>
            <path strokeLinecap='round' strokeLinejoin='round' strokeWidth={2} d='M20 12H4' />
          </svg>
        </button>
      </div>

      {/* Indicador de herramienta */}
      <div className='absolute top-4 left-4 bg-white border border-gray-300 rounded px-3 py-2 text-sm'>
        <span className='font-medium'>{tool}</span>
      </div>
    </div>
  );
}

export default DrawingCanvasUltraModular;