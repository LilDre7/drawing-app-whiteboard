import { Point } from '../../lib/canvas-types';

/**
 * Configura el contexto del canvas con transformaciones
 * @param ctx Contexto del canvas
 * @param dpr Device pixel ratio
 * @param scale Escala de zoom
 * @param panOffset Desplazamiento del pan
 */
export function setupContext(
  ctx: CanvasRenderingContext2D,
  dpr: number,
  scale: number,
  panOffset: Point
): void {
  ctx.scale(dpr, dpr);
  ctx.scale(scale, scale);
  ctx.translate(panOffset.x / scale, panOffset.y / scale);
}