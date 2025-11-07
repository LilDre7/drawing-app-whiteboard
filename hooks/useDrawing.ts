import { useState, useCallback } from 'react';
import { Shape, Tool, Point, DrawingState, DrawingCallbacks } from '../lib/canvas-types';
import { createShape, generateId, isDrawingTool, isTextTool } from '../lib/canvas-utils';

export interface DrawingConfig {
  color: string;
  strokeWidth: number;
  roughness: number;
  textSize: number;
}

export interface UseDrawingReturn extends DrawingState {
  shapes: Shape[];

  // Acciones
  startDrawing: (point: Point, tool: Tool, config: DrawingConfig) => void;
  continueDrawing: (point: Point) => void;
  stopDrawing: () => void;
  selectShape: (shapeId: string | null) => void;
  addShape: (shape: Shape) => void;
  updateShape: (shape: Shape) => void;
  deleteShape: (shapeId: string) => void;
  clearShapes: () => void;

  // Utilidades
  getShapeAtPoint: (point: Point, isTouchEvent?: boolean) => Shape | null;
  getShapesInBounds: (bounds: { min: Point; max: Point }) => Shape[];
}

/**
 * Hook personalizado para manejar el estado y lógica de dibujo
 */
export function useDrawing(callbacks: DrawingCallbacks = {}): UseDrawingReturn {
  const [shapes, setShapes] = useState<Shape[]>([]);
  const [isDrawing, setIsDrawing] = useState(false);
  const [currentShape, setCurrentShape] = useState<Shape | null>(null);
  const [selectedShapeId, setSelectedShapeId] = useState<string | null>(null);

  const { onRequestRender, onShapeAdd, onShapeUpdate, onShapeSelect } = callbacks;

  /**
   * Inicia el dibujo de una nueva forma
   */
  const startDrawing = useCallback((point: Point, tool: Tool, config: DrawingConfig) => {
    if (!isDrawingTool(tool) && !isTextTool(tool)) return;

    const shape = createShape(tool, point, config.color, config.strokeWidth, config.roughness);

    // Para texto, establecer propiedades adicionales
    if (isTextTool(tool)) {
      shape.text = '';
      shape.textSize = config.textSize;
    }

    setCurrentShape(shape);
    setIsDrawing(true);
    setSelectedShapeId(null);
  }, []);

  /**
   * Continúa el dibujo añadiendo puntos a la forma actual
   */
  const continueDrawing = useCallback((point: Point) => {
    if (!isDrawing || !currentShape) return;

    const updatedShape = {
      ...currentShape,
      points: [...currentShape.points, point],
    };

    setCurrentShape(updatedShape);
    onRequestRender?.();
  }, [isDrawing, currentShape, onRequestRender]);

  /**
   * Detiene el dibujo y añade la forma a la colección
   */
  const stopDrawing = useCallback(() => {
    if (!isDrawing || !currentShape) return;

    // Solo añadir la forma si tiene puntos válidos
    if (currentShape.points.length > 0) {
      const finalShape = { ...currentShape };
      setShapes(prev => [...prev, finalShape]);
      onShapeAdd?.(finalShape);
    }

    setCurrentShape(null);
    setIsDrawing(false);
    onRequestRender?.();
  }, [isDrawing, currentShape, onShapeAdd, onRequestRender]);

  /**
   * Selecciona una forma por su ID
   */
  const selectShape = useCallback((shapeId: string | null) => {
    setSelectedShapeId(shapeId);
    onShapeSelect?.(shapeId);
    onRequestRender?.();
  }, [onShapeSelect, onRequestRender]);

  /**
   * Añade una forma directamente a la colección
   */
  const addShape = useCallback((shape: Shape) => {
    setShapes(prev => [...prev, shape]);
    onShapeAdd?.(shape);
    onRequestRender?.();
  }, [onShapeAdd, onRequestRender]);

  /**
   * Actualiza una forma existente
   */
  const updateShape = useCallback((updatedShape: Shape) => {
    setShapes(prev =>
      prev.map(shape =>
        shape.id === updatedShape.id ? updatedShape : shape
      )
    );
    onShapeUpdate?.(updatedShape);
    onRequestRender?.();
  }, [onShapeUpdate, onRequestRender]);

  /**
   * Elimina una forma por su ID
   */
  const deleteShape = useCallback((shapeId: string) => {
    setShapes(prev => prev.filter(shape => shape.id !== shapeId));

    if (selectedShapeId === shapeId) {
      setSelectedShapeId(null);
      onShapeSelect?.(null);
    }

    onRequestRender?.();
  }, [selectedShapeId, onShapeSelect, onRequestRender]);

  /**
   * Limpia todas las formas
   */
  const clearShapes = useCallback(() => {
    setShapes([]);
    setCurrentShape(null);
    setSelectedShapeId(null);
    setIsDrawing(false);
    onShapeSelect?.(null);
    onRequestRender?.();
  }, [onShapeSelect, onRequestRender]);

  /**
   * Obtiene la forma en un punto específico
   */
  const getShapeAtPoint = useCallback((point: Point, isTouchEvent = false): Shape | null => {
    // Buscar en orden inverso (formas más arriba primero)
    for (let i = shapes.length - 1; i >= 0; i--) {
      const shape = shapes[i];
      if (shape.points.length > 0 && isPointInShape(point, shape, isTouchEvent)) {
        return shape;
      }
    }
    return null;
  }, [shapes]);

  /**
   * Obtiene todas las formas dentro de un rectángulo
   */
  const getShapesInBounds = useCallback((bounds: { min: Point; max: Point }): Shape[] => {
    return shapes.filter(shape => {
      return shape.points.some(point =>
        point.x >= bounds.min.x && point.x <= bounds.max.x &&
        point.y >= bounds.min.y && point.y <= bounds.max.y
      );
    });
  }, [shapes]);

  return {
    // Estado
    shapes,
    isDrawing,
    currentShape,
    selectedShapeId,

    // Acciones
    startDrawing,
    continueDrawing,
    stopDrawing,
    selectShape,
    addShape,
    updateShape,
    deleteShape,
    clearShapes,

    // Utilidades
    getShapeAtPoint,
    getShapesInBounds,
  };
}

// Importar isPointInShape para uso interno
import { isPointInShape } from '../lib/canvas-utils';