import { Point } from '../../lib/canvas-types';

/**
 * Maneja eventos de rueda para zoom
 * @param e Evento de rueda
 * @param currentZoom Zoom actual
 * @param onZoomIn Función para zoom in
 * @param onZoomOut Función para zoom out
 * @param onPanChange Función para cambiar pan
 * @param panOffset Pan offset actual
 */
export function handleWheelZoom(
  e: React.WheelEvent,
  currentZoom: number,
  onZoomIn: () => void,
  onZoomOut: () => void,
  onPanChange: (panOffset: Point) => void,
  panOffset: Point
): void {
  e.preventDefault();

  // Ctrl/Cmd + wheel para zoom
  if (e.ctrlKey || e.metaKey) {
    if (e.deltaY > 0) {
      onZoomOut();
    } else {
      onZoomIn();
    }
    return;
  }

  // Wheel normal para pan
  const deltaX = e.deltaX;
  const deltaY = e.deltaY;

  onPanChange({
    x: panOffset.x + deltaX,
    y: panOffset.y + deltaY,
  });
}