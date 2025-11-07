import { Point, Shape } from '../../lib/canvas-types';
import { isPointInShape } from './isPointInShape';

/**
 * Obtiene la forma en un punto específico
 * @param point Punto a verificar
 * @param shapes Lista de formas a verificar
 * @param isTouchEvent Si es un evento táctil
 * @returns La forma encontrada o null
 */
export function getShapeAtPoint(point: Point, shapes: Shape[], isTouchEvent = false): Shape | null {
  // Buscar en orden inverso (formas más arriba primero)
  for (let i = shapes.length - 1; i >= 0; i--) {
    const shape = shapes[i];
    if (shape.points.length > 0 && isPointInShape(point, shape, isTouchEvent)) {
      return shape;
    }
  }
  return null;
}