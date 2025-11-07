import { useRef, useCallback, useEffect } from 'react';
import { Shape, Point, RendererConfig } from '../lib/canvas-types';

export interface CanvasRefs {
  canvasRef: React.RefObject<HTMLCanvasElement>;
  previewCanvasRef: React.RefObject<HTMLCanvasElement>;
  containerRef: React.RefObject<HTMLDivElement>;
}

export interface UseCanvasRendererConfig extends RendererConfig {
  shapes: Shape[];
  currentShape: Shape | null;
  selectedShapeId: string | null;
  backgroundColor?: string;
  isDarkMode?: boolean;
}

export interface UseCanvasRendererReturn {
  requestRender: () => void;
  requestPreviewRender: () => void;
  clearCanvas: () => void;
  resizeCanvas: (width: number, height: number) => void;
}

/**
 * Hook personalizado para manejar el renderizado del canvas
 */
export function useCanvasRenderer(
  refs: CanvasRefs,
  config: UseCanvasRendererConfig
): UseCanvasRendererReturn {
  const { canvasRef, previewCanvasRef, containerRef } = refs;
  const {
    shapes,
    currentShape,
    selectedShapeId,
    dpr,
    offsetX,
    offsetY,
    scale,
    panOffset,
    backgroundColor = '#ffffff',
    isDarkMode = false,
  } = config;

  const renderRafRef = useRef<number>();
  const previewRenderRafRef = useRef<number>();

  /**
   * Limpia un canvas
   */
  const clearCanvas = useCallback((canvas: HTMLCanvasElement) => {
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    ctx.clearRect(0, 0, canvas.width, canvas.height);
  }, []);

  /**
   * Configura el contexto del canvas
   */
  const setupContext = useCallback((ctx: CanvasRenderingContext2D) => {
    ctx.scale(dpr, dpr);
    ctx.scale(scale, scale);
    ctx.translate(panOffset.x / scale, panOffset.y / scale);
  }, [dpr, scale, panOffset]);

  /**
   * Dibuja una forma en el contexto
   */
  const drawShape = useCallback((ctx: CanvasRenderingContext2D, shape: Shape, isSelected = false) => {
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
  }, []);

  /**
   * Dibuja un trazo de lápiz
   */
  const drawPenStroke = useCallback((ctx: CanvasRenderingContext2D, shape: Shape) => {
    if (shape.points.length < 2) return;

    ctx.beginPath();
    ctx.moveTo(shape.points[0].x, shape.points[0].y);

    for (let i = 1; i < shape.points.length; i++) {
      ctx.lineTo(shape.points[i].x, shape.points[i].y);
    }

    ctx.stroke();
  }, []);

  /**
   * Dibuja una línea
   */
  const drawLine = useCallback((ctx: CanvasRenderingContext2D, shape: Shape) => {
    if (shape.points.length < 2) return;

    ctx.beginPath();
    ctx.moveTo(shape.points[0].x, shape.points[0].y);
    ctx.lineTo(shape.points[shape.points.length - 1].x, shape.points[shape.points.length - 1].y);
    ctx.stroke();
  }, []);

  /**
   * Dibuja un rectángulo
   */
  const drawRectangle = useCallback((ctx: CanvasRenderingContext2D, shape: Shape) => {
    if (shape.points.length < 2) return;

    const start = shape.points[0];
    const end = shape.points[shape.points.length - 1];
    const width = end.x - start.x;
    const height = end.y - start.y;

    ctx.beginPath();
    ctx.rect(start.x, start.y, width, height);
    ctx.stroke();
  }, []);

  /**
   * Dibuja un círculo
   */
  const drawCircle = useCallback((ctx: CanvasRenderingContext2D, shape: Shape) => {
    if (shape.points.length < 2) return;

    const start = shape.points[0];
    const end = shape.points[shape.points.length - 1];
    const radius = Math.sqrt(Math.pow(end.x - start.x, 2) + Math.pow(end.y - start.y, 2));

    ctx.beginPath();
    ctx.arc(start.x, start.y, radius, 0, Math.PI * 2);
    ctx.stroke();
  }, []);

  /**
   * Dibuja un triángulo
   */
  const drawTriangle = useCallback((ctx: CanvasRenderingContext2D, shape: Shape) => {
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
  }, []);

  /**
   * Dibuja una flecha
   */
  const drawArrow = useCallback((ctx: CanvasRenderingContext2D, shape: Shape) => {
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
  }, []);

  /**
   * Dibuja texto
   */
  const drawText = useCallback((ctx: CanvasRenderingContext2D, shape: Shape) => {
    if (!shape.text || shape.points.length === 0) return;

    const position = shape.points[0];
    const fontSize = shape.textSize || 20;

    ctx.font = `${fontSize}px system-ui, -apple-system, sans-serif`;
    ctx.fillStyle = shape.color;
    ctx.fillText(shape.text, position.x, position.y);
  }, []);

  /**
   * Renderiza el canvas principal
   */
  const render = useCallback(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    // Limpiar canvas
    clearCanvas(canvas);

    // Configurar contexto
    setupContext(ctx);

    // Dibujar fondo
    ctx.fillStyle = backgroundColor;
    ctx.fillRect(0, 0, canvas.width / dpr, canvas.height / dpr);

    // Dibujar todas las formas
    shapes.forEach(shape => {
      drawShape(ctx, shape, shape.id === selectedShapeId);
    });
  }, [canvasRef, clearCanvas, setupContext, backgroundColor, shapes, selectedShapeId, drawShape, dpr]);

  /**
   * Renderiza el canvas de previsualización
   */
  const renderPreview = useCallback(() => {
    const canvas = previewCanvasRef.current;
    if (!canvas || !currentShape) return;

    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    // Limpiar canvas
    clearCanvas(canvas);

    // Configurar contexto
    setupContext(ctx);

    // Dibujar forma actual
    drawShape(ctx, currentShape, false);
  }, [previewCanvasRef, currentShape, clearCanvas, setupContext, drawShape]);

  /**
   * Solicita renderizado del canvas principal
   */
  const requestRender = useCallback(() => {
    if (renderRafRef.current) {
      cancelAnimationFrame(renderRafRef.current);
    }

    renderRafRef.current = requestAnimationFrame(() => {
      render();
      renderRafRef.current = undefined;
    });
  }, [render]);

  /**
   * Solicita renderizado del canvas de previsualización
   */
  const requestPreviewRender = useCallback(() => {
    if (previewRenderRafRef.current) {
      cancelAnimationFrame(previewRenderRafRef.current);
    }

    previewRenderRafRef.current = requestAnimationFrame(() => {
      renderPreview();
      previewRenderRafRef.current = undefined;
    });
  }, [renderPreview]);

  /**
   * Redimensiona los canvases
   */
  const resizeCanvas = useCallback((width: number, height: number) => {
    const setupCanvas = (canvas: HTMLCanvasElement) => {
      canvas.width = width * dpr;
      canvas.height = height * dpr;
      canvas.style.width = `${width}px`;
      canvas.style.height = `${height}px`;
    };

    if (canvasRef.current) setupCanvas(canvasRef.current);
    if (previewCanvasRef.current) setupCanvas(previewCanvasRef.current);

    requestRender();
  }, [canvasRef, previewCanvasRef, dpr, requestRender]);

  /**
   * Limpia ambos canvases
   */
  const clearAllCanvases = useCallback(() => {
    if (canvasRef.current) clearCanvas(canvasRef.current);
    if (previewCanvasRef.current) clearCanvas(previewCanvasRef.current);
  }, [canvasRef, previewCanvasRef, clearCanvas]);

  /**
   * Efecto para renderizar cuando cambian las dependencias
   */
  useEffect(() => {
    requestRender();
  }, [requestRender]);

  useEffect(() => {
    requestPreviewRender();
  }, [requestPreviewRender]);

  /**
   * Limpieza al desmontar
   */
  useEffect(() => {
    return () => {
      if (renderRafRef.current) {
        cancelAnimationFrame(renderRafRef.current);
      }
      if (previewRenderRafRef.current) {
        cancelAnimationFrame(previewRenderRafRef.current);
      }
    };
  }, []);

  return {
    requestRender,
    requestPreviewRender,
    clearCanvas: clearAllCanvases,
    resizeCanvas,
  };
}