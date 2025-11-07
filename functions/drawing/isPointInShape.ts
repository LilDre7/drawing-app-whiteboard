import { Point, Shape } from '../../lib/canvas-types';
import { distance } from '../../lib/canvas-utils';

/**
 * Verifica si un punto está dentro de una forma
 * @param point Punto a verificar
 * @param shape Forma a verificar
 * @param isTouchEvent Si es un evento táctil (aumenta tolerancia)
 * @returns Verdadero si el punto está dentro de la forma
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