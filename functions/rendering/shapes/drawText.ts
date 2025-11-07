import { Shape } from '../../../lib/canvas-types';

/**
 * Dibuja texto
 * @param ctx Contexto del canvas
 * @param shape Forma de tipo texto
 */
export function drawText(ctx: CanvasRenderingContext2D, shape: Shape): void {
  if (!shape.text || shape.points.length === 0) return;

  const position = shape.points[0];
  const fontSize = shape.textSize || 20;

  ctx.font = `${fontSize}px system-ui, -apple-system, sans-serif`;
  ctx.fillStyle = shape.color;
  ctx.fillText(shape.text, position.x, position.y);
}