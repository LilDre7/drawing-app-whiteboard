import { Shape } from '../../../lib/canvas-types';

/**
 * Dibuja un triángulo
 * @param ctx Contexto del canvas
 * @param shape Forma de tipo triángulo
 */
export function drawTriangle(ctx: CanvasRenderingContext2D, shape: Shape): void {
  if (shape.points.length < 2) return;

  const start = shape.points[0];
  const end = shape.points[shape.points.length - 1];
  const width = end.x - start.x;
  const height = end.y - start.y;

  ctx.beginPath();
  ctx.moveTo(start.x + width / 2, start.y);
  ctx.lineTo(start.x, start.y + height);
  ctx.lineTo(start.x + width, start.y + height);
  ctx.closePath();
  ctx.stroke();
}