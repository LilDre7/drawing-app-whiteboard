import { Shape } from '../../../lib/canvas-types';

/**
 * Dibuja un trazo de lápiz
 * @param ctx Contexto del canvas
 * @param shape Forma de tipo lápiz
 */
export function drawPenStroke(ctx: CanvasRenderingContext2D, shape: Shape): void {
  if (shape.points.length < 2) return;

  ctx.beginPath();
  ctx.moveTo(shape.points[0].x, shape.points[0].y);

  for (let i = 1; i < shape.points.length; i++) {
    ctx.lineTo(shape.points[i].x, shape.points[i].y);
  }

  ctx.stroke();
}