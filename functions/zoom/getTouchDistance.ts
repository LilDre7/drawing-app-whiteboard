/**
 * Calcula la distancia euclidiana entre dos puntos táctiles
 * @param touch1 Primer toque
 * @param touch2 Segundo toque
 * @returns Distancia en píxeles
 */
export function getTouchDistance(touch1: React.Touch, touch2: React.Touch): number {
  const dx = touch1.clientX - touch2.clientX;
  const dy = touch1.clientY - touch2.clientY;
  return Math.sqrt(dx * dx + dy * dy);
}