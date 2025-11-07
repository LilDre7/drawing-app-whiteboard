import { Point } from '../../lib/canvas-types';

/**
 * Convierte coordenadas de pantalla a coordenadas del canvas
 * @param screenPoint Punto en coordenadas de pantalla
 * @param offsetX Offset horizontal del viewport
 * @param offsetY Offset vertical del viewport
 * @param zoom Nivel de zoom actual
 * @param panOffset Desplazamiento actual del pan
 * @returns Punto en coordenadas del canvas
 */
export function screenToCanvas(
  screenPoint: Point,
  offsetX: number,
  offsetY: number,
  zoom: number,
  panOffset: Point
): Point {
  const scale = zoom / 100;
  return {
    x: (screenPoint.x - offsetX - panOffset.x) / scale + offsetX,
    y: (screenPoint.y - offsetY - panOffset.y) / scale + offsetY,
  };
}