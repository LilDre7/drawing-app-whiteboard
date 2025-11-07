import { Point, Shape } from '../../lib/canvas-types';
import { distance } from '../../lib/canvas-utils';

/**
 * Verifica si un punto está dentro de una forma para el borrador
 * @param point Punto a verificar
 * @param shape Forma a verificar
 * @param isTouchEvent Si es un evento táctil (aumenta tolerancia)
 * @returns Verdadero si el punto está dentro de la forma para borrar
 */
export function isPointInShapeForEraser(point: Point, shape: Shape, isTouchEvent = false): boolean {
  if (shape.type === 'eraser') return false;

  const threshold = shape.type === 'text' ? 30 : 15;

  return shape.points.some(p => distance(point, p) < threshold);
}