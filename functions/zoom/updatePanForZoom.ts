import { Point } from '../../lib/canvas-types';

/**
 * Actualiza el pan (desplazamiento) para mantener el zoom centrado en el punto especificado
 * @param zoomCenter Punto central del zoom en coordenadas de pantalla
 * @param newZoom Nuevo nivel de zoom en porcentaje
 * @param currentZoom Nivel de zoom actual en porcentaje
 * @param panOffset Desplazamiento actual del pan
 * @param offsetX Offset horizontal del viewport
 * @param offsetY Offset vertical del viewport
 * @param containerRect Rectángulo del contenedor
 * @returns Nuevo desplazamiento del pan
 */
export function updatePanForZoom(
  zoomCenter: Point,
  newZoom: number,
  currentZoom: number,
  panOffset: Point,
  offsetX: number,
  offsetY: number,
  containerRect: DOMRect
): Point {
  const currentScale = currentZoom / 100;
  const newScale = newZoom / 100;

  // Punto en coordenadas del canvas antes del zoom
  const canvasPointX = (zoomCenter.x - containerRect.left - panOffset.x) / currentScale - offsetX;
  const canvasPointY = (zoomCenter.y - containerRect.top - panOffset.y) / currentScale - offsetY;

  // Calcular nueva posición de pan para mantener el punto fijo durante el zoom
  const newPanX = zoomCenter.x - containerRect.left - (canvasPointX + offsetX) * newScale;
  const newPanY = zoomCenter.y - containerRect.top - (canvasPointY + offsetY) * newScale;

  return { x: newPanX, y: newPanY };
}