import { Shape } from '../../lib/canvas-types';

/**
 * Verifica si dos formas son iguales
 * @param shape1 Primera forma
 * @param shape2 Segunda forma
 * @returns Verdadero si las formas son idénticas
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