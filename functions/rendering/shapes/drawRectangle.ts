import { Shape } from '../../../lib/canvas-types';

/**
 * Dibuja un rectángulo
 * @param ctx Contexto del canvas
 * @param shape Forma de tipo rectángulo
 */
export function drawRectangle(ctx: CanvasRenderingContext2D, shape: Shape): void {
  if (shape.points.length < 2) return;

  const start = shape.points[0];
  const end = shape.points[shape.points.length - 1];
  const width = end.x - start.x;
  const height = end.y - start.y;

  ctx.beginPath();
  ctx.rect(start.x, start.y, width, height);
  ctx.stroke();
}