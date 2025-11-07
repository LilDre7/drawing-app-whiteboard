import { Shape } from '../../../lib/canvas-types';

/**
 * Dibuja un círculo
 * @param ctx Contexto del canvas
 * @param shape Forma de tipo círculo
 */
export function drawCircle(ctx: CanvasRenderingContext2D, shape: Shape): void {
  if (shape.points.length < 2) return;

  const start = shape.points[0];
  const end = shape.points[shape.points.length - 1];
  const radius = Math.sqrt(Math.pow(end.x - start.x, 2) + Math.pow(end.y - start.y, 2));

  ctx.beginPath();
  ctx.arc(start.x, start.y, radius, 0, Math.PI * 2);
  ctx.stroke();
}