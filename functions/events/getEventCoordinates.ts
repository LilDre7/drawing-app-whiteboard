import { Point } from '../../lib/canvas-types';

/**
 * Obtiene coordenadas del evento de mouse o touch
 * @param e Evento de mouse o touch
 * @returns Coordenadas del punto
 */
export function getEventCoordinates(e: React.MouseEvent | React.TouchEvent): Point {
  if ('touches' in e) {
    const touch = e.touches[0];
    return { x: touch.clientX, y: touch.clientY };
  } else {
    return { x: e.clientX, y: e.clientY };
  }
}