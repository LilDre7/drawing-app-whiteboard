// Hooks principales
export { useZoom } from './useZoom';
export { useDrawing } from './useDrawing';
export { useCanvasEvents } from './useCanvasEvents';
export { useCanvasRenderer } from './useCanvasRenderer';

// Tipos relacionados con hooks
export type { Point, ZoomState, ZoomCallbacks } from './useZoom';
export type { UseDrawingReturn, DrawingConfig } from './useDrawing';
export type { UseCanvasEventsConfig, UseCanvasEventsReturn } from './useCanvasEvents';
export type { CanvasRefs, UseCanvasRendererConfig, UseCanvasRendererReturn } from './useCanvasRenderer';