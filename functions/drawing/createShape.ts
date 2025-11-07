import { Shape, Tool, Point } from '../../lib/canvas-types';
import { generateId } from '../../lib/canvas-utils';

/**
 * Crea una nueva forma con valores por defecto
 * @param type Tipo de herramienta/forma
 * @param point Punto inicial de la forma
 * @param color Color de la forma
 * @param strokeWidth Grosor del trazo
 * @param roughness Nivel de rugosidad
 * @returns Nueva forma creada
 */
export function createShape(
  type: Tool,
  point: Point,
  color: string,
  strokeWidth: number,
  roughness: number
): Shape {
  return {
    id: generateId(),
    type,
    points: [point],
    color,
    strokeWidth,
    roughness,
  };
}