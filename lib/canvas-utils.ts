import { Point, Roughness, Shape, Tool } from './canvas-types';

/**
 * Calcula la distancia euclidiana entre dos puntos
 */
export function distance(p1: Point, p2: Point): number {
  const dx = p1.x - p2.x;
  const dy = p1.y - p2.y;
  return Math.sqrt(dx * dx + dy * dy);
}

/**
 * Genera un ID único para formas
 */
export function generateId(): string {
  return Date.now().toString(36) + Math.random().toString(36).substr(2);
}

/**
 * Verifica si un punto está dentro de una forma
 */
export function isPointInShape(point: Point, shape: Shape, isTouchEvent = false): boolean {
  const threshold = isTouchEvent ? 20 : 10; // Más tolerancia para touch

  if (shape.type === 'text' && shape.text) {
    // Para texto, usar un rectángulo alrededor del texto
    const padding = 10;
    const minX = Math.min(...shape.points.map(p => p.x)) - padding;
    const maxX = Math.max(...shape.points.map(p => p.x)) + padding;
    const minY = Math.min(...shape.points.map(p => p.y)) - padding;
    const maxY = Math.max(...shape.points.map(p => p.y)) + padding;

    return point.x >= minX && point.x <= maxX && point.y >= minY && point.y <= maxY;
  }

  if (shape.type === 'eraser') {
    // El borrador no es seleccionable
    return false;
  }

  // Para otras formas, verificar si el punto está cerca de alguno de los puntos de la forma
  return shape.points.some(p => distance(point, p) < threshold);
}

/**
 * Verifica si un punto está dentro de una forma para el borrador
 */
export function isPointInShapeForEraser(point: Point, shape: Shape, isTouchEvent = false): boolean {
  if (shape.type === 'eraser') return false;

  const threshold = shape.type === 'text' ? 30 : 15;

  return shape.points.some(p => distance(point, p) < threshold);
}

/**
 * Obtiene los límites de una forma
 */
export function getShapeBounds(shape: Shape): { min: Point; max: Point } | null {
  if (shape.points.length === 0) return null;

  const xs = shape.points.map(p => p.x);
  const ys = shape.points.map(p => p.y);

  return {
    min: { x: Math.min(...xs), y: Math.min(...ys) },
    max: { x: Math.max(...xs), y: Math.max(...ys) }
  };
}

/**
 * Crea una nueva forma con valores por defecto
 */
export function createShape(type: Tool, point: Point, color: string, strokeWidth: number, roughness: Roughness): Shape {
  return {
    id: generateId(),
    type,
    points: [point],
    color,
    strokeWidth,
    roughness
  };
}

/**
 * Verifica si una herramienta es de tipo dibujo
 */
export function isDrawingTool(tool: Tool): boolean {
  return ['pen', 'line', 'rectangle', 'circle', 'triangle', 'arrow'].includes(tool);
}

/**
 * Verifica si una herramienta requiere texto
 */
export function isTextTool(tool: Tool): boolean {
  return tool === 'text';
}

/**
 * Obtiene el cursor apropiado para una herramienta
 */
export function getCursorForTool(tool: Tool, isPanning = false): string {
  if (isPanning) return 'cursor-grabbing';

  switch (tool) {
    case 'hand': return 'cursor-grab';
    case 'select': return 'cursor-default';
    case 'text': return 'cursor-text';
    default: return 'cursor-crosshair';
  }
}

/**
 * Convierte un color hex a RGB
 */
export function hexToRgb(hex: string): { r: number; g: number; b: number } | null {
  const result = /^#?([a-f\d]{2})([a-f\d]{2})([a-f\d]{2})$/i.exec(hex);
  return result ? {
    r: parseInt(result[1], 16),
    g: parseInt(result[2], 16),
    b: parseInt(result[3], 16)
  } : null;
}

/**
 * Convierte color RGB a string
 */
export function rgbToString(rgb: { r: number; g: number; b: number }): string {
  return `rgb(${rgb.r}, ${rgb.g}, ${rgb.b})`;
}

/**
 * Clona un objeto Shape
 */
export function cloneShape(shape: Shape): Shape {
  return {
    ...shape,
    points: shape.points.map(p => ({ ...p })),
  };
}

/**
 * Verifica si dos formas son iguales
 */
export function areShapesEqual(shape1: Shape, shape2: Shape): boolean {
  if (shape1.id !== shape2.id) return false;
  if (shape1.type !== shape2.type) return false;
  if (shape1.color !== shape2.color) return false;
  if (shape1.strokeWidth !== shape2.strokeWidth) return false;
  if (shape1.roughness !== shape2.roughness) return false;
  if (shape1.points.length !== shape2.points.length) return false;

  for (let i = 0; i < shape1.points.length; i++) {
    if (shape1.points[i].x !== shape2.points[i].x || shape1.points[i].y !== shape2.points[i].y) {
      return false;
    }
  }

  return true;
}