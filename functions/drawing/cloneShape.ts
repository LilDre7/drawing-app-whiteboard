import { Shape } from '../../lib/canvas-types';

/**
 * Clona un objeto Shape
 * @param shape Forma a clonar
 * @returns Nueva forma clonada
 */
export function cloneShape(shape: Shape): Shape {
  return {
    ...shape,
    points: shape.points.map(p => ({ ...p })),
  };
}