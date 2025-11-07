import { Shape } from '../../lib/canvas-types';
import { drawPenStroke } from './shapes/drawPenStroke';
import { drawLine } from './shapes/drawLine';
import { drawRectangle } from './shapes/drawRectangle';
import { drawCircle } from './shapes/drawCircle';
import { drawTriangle } from './shapes/drawTriangle';
import { drawArrow } from './shapes/drawArrow';
import { drawText } from './shapes/drawText';

/**
 * Dibuja una forma en el contexto
 * @param ctx Contexto del canvas
 * @param shape Forma a dibujar
 * @param isSelected Si la forma está seleccionada
 */
export function drawShape(ctx: CanvasRenderingContext2D, shape: Shape, isSelected = false): void {
  ctx.save();

  // Configurar estilo
  ctx.strokeStyle = shape.color;
  ctx.lineWidth = shape.strokeWidth;
  ctx.lineCap = 'round';
  ctx.lineJoin = 'round';

  // Si está seleccionada, dibujar resaltado
  if (isSelected) {
    ctx.shadowColor = '#3b82f6';
    ctx.shadowBlur = 8;
  }

  // Dibujar según el tipo de forma
  switch (shape.type) {
    case 'pen':
      drawPenStroke(ctx, shape);
      break;
    case 'line':
      drawLine(ctx, shape);
      break;
    case 'rectangle':
      drawRectangle(ctx, shape);
      break;
    case 'circle':
      drawCircle(ctx, shape);
      break;
    case 'triangle':
      drawTriangle(ctx, shape);
      break;
    case 'arrow':
      drawArrow(ctx, shape);
      break;
    case 'text':
      drawText(ctx, shape);
      break;
    case 'eraser':
      // El borrador se dibuja de forma diferente
      break;
  }

  ctx.restore();
}