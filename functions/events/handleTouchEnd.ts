/**
 * Maneja el evento touch end
 * @param e Evento touch
 * @param onPinchEnd Función para finalizar pinch
 * @param onDrawingEnd Función para finalizar dibujo
 * @param isPinching Si está en modo pinch
 */
export function handleTouchEnd(
  e: React.TouchEvent,
  onPinchEnd: () => void,
  onDrawingEnd: () => void,
  isPinching: boolean
): void {
  e.preventDefault();

  // Finalizar gesto de pinch
  if (e.touches.length < 2 && isPinching) {
    onPinchEnd();
  }

  // Manejar fin de dibujo
  if (!isPinching && e.touches.length === 0) {
    onDrawingEnd();
  }
}