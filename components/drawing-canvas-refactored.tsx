'use client';

import React, { useRef, useEffect, useState, useCallback } from 'react';
import { cn } from '@/lib/utils';
import {
  useZoom,
  useDrawing,
  useCanvasEvents,
  useCanvasRenderer, // Assuming this is where DrawingConfig is used
} from '@/hooks';
import {
  Tool,
  Point,
  DrawingConfig,
  EventCallbacks,
} from '@/lib/canvas-types';
import { getCursorForTool } from '@/lib/canvas-utils';

interface DrawingCanvasRefactoredProps {
  // Estado inicial
  initialTool?: Tool;
  initialColor?: string;
  initialStrokeWidth?: number;
  initialZoom?: number;

  // Configuración
  width?: number;
  height?: number;
  backgroundColor?: string;
  isDarkMode?: boolean;

  // Eventos
  onToolChange?: (tool: Tool) => void;
  onShapeSelect?: (shapeId: string | null) => void;
  onDrawingComplete?: (shapes: any[]) => void;

  // Classes
  className?: string;
}

/**
 * Componente de canvas de dibujo refactorizado y modular
 *
 * Este componente implementa una arquitectura limpia y escalable:
 * - Separación de responsabilidades en hooks especializados
 * - Gestión de estado optimizada
 * - Renderizado eficiente con requestAnimationFrame
 * - Soporte para pinch-to-zoom táctil
 * - Eventos de teclado y mouse
 */
export function DrawingCanvasRefactored({
  initialTool = 'pen',
  initialColor = '#1e293b',
  initialStrokeWidth = 2,
  initialZoom = 100,
  width = 800,
  height = 600,
  backgroundColor = '#ffffff',
  isDarkMode = false,
  onToolChange,
  onShapeSelect,
  onDrawingComplete,
  className,
}: DrawingCanvasRefactoredProps) {
  // Refs del canvas
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const previewCanvasRef = useRef<HTMLCanvasElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);

  // Estados de configuración
  const [tool, setTool] = useState<Tool>(initialTool);
  const [color, setColor] = useState(initialColor);
  const [strokeWidth, setStrokeWidth] = useState(initialStrokeWidth);
  const [textSize, setTextSize] = useState(20);
  const [roughness] = useState(0.2);

  // Estados de texto
  const [isEditingText, setIsEditingText] = useState(false);
  const [textPosition, setTextPosition] = useState<Point>({ x: 0, y: 0 });
  const [textValue, setTextValue] = useState('');

  // Calcular offsets del viewport
  const offsetX = width / 2;
  const offsetY = height / 2;

  // Hook de zoom - gestiona todo lo relacionado con zoom y pan
  const zoom = useZoom(initialZoom, {
    onZoomChange: (zoomLevel) => {
      console.log('Zoom changed:', zoomLevel);
    },
    onRequestRender: () => {
      renderer.requestRender();
    },
  });

  // Hook de dibujo - gestiona formas y estado de dibujo
  const drawing = useDrawing({
    onShapeAdd: (shape) => {
      console.log('Shape added:', shape.id);
      onDrawingComplete?.(drawing.shapes);
    },
    onShapeSelect: (shapeId) => {
      onShapeSelect?.(shapeId);
    },
    onRequestRender: () => {
      renderer.requestRender();
    },
  });

  // Hook de renderizado - gestiona el dibujo en los canvases
  const renderer = useCanvasRenderer(
    {
      canvasRef,
      previewCanvasRef,
      containerRef,
    },
    {
      shapes: drawing.shapes,
      currentShape: drawing.currentShape,
      selectedShapeId: drawing.selectedShapeId,
      dpr: window.devicePixelRatio || 1,
      offsetX,
      offsetY,
      scale: zoom.scale,
      panOffset: zoom.panOffset,
      backgroundColor,
      isDarkMode,
    }
  );

  // Callbacks de eventos
  const eventCallbacks: EventCallbacks = {
    onShapeSelect: drawing.selectShape,
    onDrawingStart: () => {
      const config: DrawingConfig = {
        color,
        strokeWidth,
        roughness,
        textSize,
      };
      // TODO: Iniciar dibujo con punto actual
    },
    onDrawingEnd: () => {
      drawing.stopDrawing();
    },
    onTextComplete: (text, position) => {
      // TODO: Crear forma de texto
    },
  };

  // Hook de eventos - gestiona todos los eventos de usuario
  const events = useCanvasEvents(
    {
      containerRef,
      canvasRef,
      zoom: zoom.zoom,
      panOffset: zoom.panOffset,
      offsetX,
      offsetY,
      onZoomIn: zoom.zoomIn,
      onZoomOut: zoom.zoomOut,
      onPanChange: zoom.setPan,
      screenToCanvas: zoom.screenToCanvas,
    },
    eventCallbacks
  );

  // Configuración de eventos táctiles para pinch-to-zoom
  const handleTouchStart = useCallback((e: React.TouchEvent) => {
    e.preventDefault();

    // Detectar gesto de pinch (dos dedos)
    if (e.touches.length === 2) {
      const touch1 = e.touches[0];
      const touch2 = e.touches[1];
      zoom.startPinchZoom(touch1, touch2);
      return;
    }

    // Manejar toque normal para dibujo
    if (e.touches.length === 1 && !zoom.isPinching) {
      events.handleMouseDown(e);
    }
  }, [zoom, events]);

  const handleTouchMove = useCallback((e: React.TouchEvent) => {
    e.preventDefault();

    // Manejar gesto de pinch
    if (e.touches.length === 2 && zoom.isPinching) {
      const touch1 = e.touches[0];
      const touch2 = e.touches[1];
      zoom.applySmoothPinchZoom(touch1, touch2, offsetX, offsetY);
      return;
    }

    // Manejar toque normal para dibujo
    if (e.touches.length === 1 && !zoom.isPinching) {
      events.handleMouseMove(e);
    }
  }, [zoom, events, offsetX, offsetY]);

  const handleTouchEnd = useCallback((e: React.TouchEvent) => {
    e.preventDefault();

    // Finalizar gesto de pinch
    if (e.touches.length < 2 && zoom.isPinching) {
      zoom.endPinchZoom();
    }

    // Manejar fin de dibujo
    if (!zoom.isPinching && e.touches.length === 0) {
      events.handleMouseUp();
    }
  }, [zoom, events]);

  // Efecto para configurar el tamaño del canvas
  useEffect(() => {
    renderer.resizeCanvas(width, height);
  }, [renderer, width, height]);

  // Efecto para limpiar recursos
  useEffect(() => {
    return () => {
      zoom.cleanup();
    };
  }, [zoom]);

  // Estilo del cursor basado en la herramienta y estado
  const cursorStyle = getCursorForTool(tool, false);

  return (
    <div
      ref={containerRef}
      className={cn(
        'relative w-full h-full overflow-hidden',
        'bg-[oklch(0.98_0_0)] dark:bg-[oklch(0.14_0_0)]',
        className
      )}
      style={{ width, height }}
    >
      {/* Canvas principal - dibujos confirmados */}
      <canvas
        ref={canvasRef}
        className={cn(
          'absolute inset-0 h-full w-full touch-none',
          zoom.isPinching
            ? 'cursor-zoom-in'
            : cursorStyle
        )}
        onMouseDown={events.handleMouseDown}
        onMouseMove={events.handleMouseMove}
        onMouseUp={events.handleMouseUp}
        onMouseLeave={events.handleMouseUp}
        onWheel={events.handleWheel}
        onTouchStart={handleTouchStart}
        onTouchMove={handleTouchMove}
        onTouchEnd={handleTouchEnd}
      />

      {/* Canvas de previsualización - trazo actual */}
      <canvas
        ref={previewCanvasRef}
        className='absolute inset-0 h-full w-full pointer-events-none touch-none'
      />

      {/* Overlay para edición de texto */}
      {isEditingText && (
        <div
          className='absolute bg-white dark:bg-gray-800 border border-gray-300 dark:border-gray-600 rounded p-2'
          style={{
            left: textPosition.x,
            top: textPosition.y,
          }}
        >
          <input
            type='text'
            value={textValue}
            onChange={(e) => setTextValue(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === 'Enter') {
                eventCallbacks.onTextComplete?.(textValue, textPosition);
                setIsEditingText(false);
                setTextValue('');
              } else if (e.key === 'Escape') {
                setIsEditingText(false);
                setTextValue('');
              }
            }}
            placeholder='Enter text...'
            className='px-2 py-1 border rounded dark:bg-gray-700 dark:text-white'
            autoFocus
          />
        </div>
      )}

      {/* Controles de zoom (solo desktop) */}
      <div className='absolute bottom-4 right-4 flex flex-col gap-2'>
        <button
          onClick={zoom.zoomIn}
          className='bg-white dark:bg-gray-800 border border-gray-300 dark:border-gray-600 rounded p-2 hover:bg-gray-100 dark:hover:bg-gray-700'
          title='Zoom In'
        >
          <svg className='w-4 h-4' fill='none' stroke='currentColor' viewBox='0 0 24 24'>
            <path strokeLinecap='round' strokeLinejoin='round' strokeWidth={2} d='M12 4v16m8-8H4' />
          </svg>
        </button>
        <div className='bg-white dark:bg-gray-800 border border-gray-300 dark:border-gray-600 rounded px-2 py-1 text-center text-sm'>
          {Math.round(zoom.zoom)}%
        </div>
        <button
          onClick={zoom.zoomOut}
          className='bg-white dark:bg-gray-800 border border-gray-300 dark:border-gray-600 rounded p-2 hover:bg-gray-100 dark:hover:bg-gray-700'
          title='Zoom Out'
        >
          <svg className='w-4 h-4' fill='none' stroke='currentColor' viewBox='0 0 24 24'>
            <path strokeLinecap='round' strokeLinejoin='round' strokeWidth={2} d='M20 12H4' />
          </svg>
        </button>
      </div>

      {/* Indicador de herramienta */}
      <div className='absolute top-4 left-4 bg-white dark:bg-gray-800 border border-gray-300 dark:border-gray-600 rounded px-3 py-2 text-sm'>
        <span className='font-medium'>{tool}</span>
      </div>
    </div>
  );
}

export default DrawingCanvasRefactored;