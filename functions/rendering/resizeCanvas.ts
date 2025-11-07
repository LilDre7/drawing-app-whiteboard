/**
 * Redimensiona un canvas
 * @param canvas Canvas a redimensionar
 * @param width Nuevo ancho
 * @param height Nuevo alto
 * @param dpr Device pixel ratio
 */
export function resizeCanvas(
  canvas: HTMLCanvasElement,
  width: number,
  height: number,
  dpr: number
): void {
  canvas.width = width * dpr;
  canvas.height = height * dpr;
  canvas.style.width = `${width}px`;
  canvas.style.height = `${height}px`;
}