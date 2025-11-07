import { Point } from '../../lib/canvas-types';

/**
 * Calcula el punto medio entre dos toques
 * @param touch1 Primer toque
 * @param touch2 Segundo toque
 * @returns Coordenadas del punto medio
 */
export function getTouchCenter(touch1: React.Touch, touch2: React.Touch): Point {
  return {
    x: (touch1.clientX + touch2.clientX) / 2,
    y: (touch1.clientY + touch2.clientY) / 2,
  };
}