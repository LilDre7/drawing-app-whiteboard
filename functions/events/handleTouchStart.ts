import { Point } from '../../lib/canvas-types';

/**
 * Maneja el evento touch start
 * @param e Evento touch
 * @param getCoordinates Función para obtener coordenadas
 * @param onPinchStart Función para iniciar pinch
 * @param onDrawingStart Función para iniciar dibujo
 * @param isPinching Si está en modo pinch
 */
export function handleTouchStart(
  e: React.TouchEvent,
  getCoordinates: (e: React.TouchEvent) => Point,
  onPinchStart: (touch1: React.Touch, touch2: React.Touch) => void,
  onDrawingStart: (point: Point) => void,
  isPinching: boolean
): void {
  e.preventDefault();

  // Detectar gesto de pinch (dos dedos)
  if (e.touches.length === 2) {
    const touch1 = e.touches[0];
    const touch2 = e.touches[1];
    onPinchStart(touch1, touch2);
    return;
  }

  // Manejar toque normal para dibujo
  if (e.touches.length === 1 && !isPinching) {
    const point = getCoordinates(e);
    onDrawingStart(point);
  }
}