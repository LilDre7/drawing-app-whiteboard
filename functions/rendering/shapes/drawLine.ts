import { Shape } from '../../../lib/canvas-types';

/**
 * Dibuja una línea
 * @param ctx Contexto del canvas
 * @param shape Forma de tipo línea
 */
export function drawLine(ctx: CanvasRenderingContext2D, shape: Shape): void {
  if (shape.points.length < 2) return;

  ctx.beginPath();
  ctx.moveTo(shape.points[0].x, shape.points[0].y);
  ctx.lineTo(shape.points[shape.points.length - 1].x, shape.points[shape.points.length - 1].y);
  ctx.stroke();
}