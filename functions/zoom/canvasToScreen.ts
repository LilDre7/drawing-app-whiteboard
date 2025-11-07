import { Point } from '../../lib/canvas-types';

/**
 * Convierte coordenadas del canvas a coordenadas de pantalla
 * @param canvasPoint Punto en coordenadas del canvas
 * @param offsetX Offset horizontal del viewport
 * @param offsetY Offset vertical del viewport
 * @param zoom Nivel de zoom actual
 * @param panOffset Desplazamiento actual del pan
 * @returns Punto en coordenadas de pantalla
 */
export function canvasToScreen(
  canvasPoint: Point,
  offsetX: number,
  offsetY: number,
  zoom: number,
  panOffset: Point
): Point {
  const scale = zoom / 100;
  return {
    x: (canvasPoint.x - offsetX) * scale + offsetX + panOffset.x,
    y: (canvasPoint.y - offsetY) * scale + offsetY + panOffset.y,
  };
}