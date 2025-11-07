import { Shape } from '../../../lib/canvas-types';

/**
 * Dibuja una flecha
 * @param ctx Contexto del canvas
 * @param shape Forma de tipo flecha
 */
export function drawArrow(ctx: CanvasRenderingContext2D, shape: Shape): void {
  if (shape.points.length < 2) return;

  const start = shape.points[0];
  const end = shape.points[shape.points.length - 1];

  // Dibujar línea principal
  ctx.beginPath();
  ctx.moveTo(start.x, start.y);
  ctx.lineTo(end.x, end.y);
  ctx.stroke();

  // Dibujar cabeza de flecha
  const angle = Math.atan2(end.y - start.y, end.x - start.x);
  const arrowLength = 15;
  const arrowAngle = Math.PI / 6;

  ctx.beginPath();
  ctx.moveTo(end.x, end.y);
  ctx.lineTo(
    end.x - arrowLength * Math.cos(angle - arrowAngle),
    end.y - arrowLength * Math.sin(angle - arrowAngle)
  );
  ctx.moveTo(end.x, end.y);
  ctx.lineTo(
    end.x - arrowLength * Math.cos(angle + arrowAngle),
    end.y - arrowLength * Math.sin(angle + arrowAngle)
  );
  ctx.stroke();
}