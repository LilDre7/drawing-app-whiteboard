import { Point, Shape } from '../../lib/canvas-types';

/**
 * Obtiene todas las formas dentro de un rectángulo
 * @param bounds Límites del rectángulo (min y max)
 * @param shapes Lista de formas a verificar
 * @returns Array de formas dentro de los límites
 */
export function getShapesInBounds(bounds: { min: Point; max: Point }, shapes: Shape[]): Shape[] {
  return shapes.filter(shape => {
    return shape.points.some(point =>
      point.x >= bounds.min.x && point.x <= bounds.max.x &&
      point.y >= bounds.min.y && point.y <= bounds.max.y
    );
  });
}