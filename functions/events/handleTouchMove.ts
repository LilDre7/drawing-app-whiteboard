import { Point } from '../../lib/canvas-types';

/**
 * Maneja el evento touch move
 * @param e Evento touch
 * @param getCoordinates Función para obtener coordenadas
 * @param onPinchMove Función para mover pinch
 * @param onDrawingMove Función para mover dibujo
 * @param isPinching Si está en modo pinch
 * @param offsetX Offset horizontal
 * @param offsetY Offset vertical
 */
export function handleTouchMove(
  e: React.TouchEvent,
  getCoordinates: (e: React.TouchEvent) => Point,
  onPinchMove: (touch1: React.Touch, touch2: React.Touch, offsetX: number, offsetY: number) => void,
  onDrawingMove: (point: Point) => void,
  isPinching: boolean,
  offsetX: number,
  offsetY: number
): void {
  e.preventDefault();

  // Manejar gesto de pinch
  if (e.touches.length === 2 && isPinching) {
    const touch1 = e.touches[0];
    const touch2 = e.touches[1];
    onPinchMove(touch1, touch2, offsetX, offsetY);
    return;
  }

  // Manejar toque normal para dibujo
  if (e.touches.length === 1 && !isPinching) {
    const point = getCoordinates(e);
    onDrawingMove(point);
  }
}