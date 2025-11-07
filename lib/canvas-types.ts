export type Tool = "select" | "pen" | "eraser" | "text" | "line" | "rectangle" | "circle" | "triangle" | "arrow" | "hand";

export type Roughness = 0 | 1 | 2;

export interface Point {
  x: number;
  y: number;
}

export interface Shape {
  id: string;
  type: Tool;
  points: Point[];
  color: string;
  strokeWidth: number;
  roughness: Roughness;
  // Para texto
  text?: string;
  textSize?: number;
  // Para imágenes
  imageData?: string;
  width?: number;
  height?: number;
}

export interface DrawingState {
  isDrawing: boolean;
  currentShape: Shape | null;
  selectedShapeId: string | null;
}

export interface TextState {
  isEditingText: boolean;
  textPosition: Point;
  textValue: string;
  screenTextPosition: Point;
  textSize: number;
}

export interface CanvasSize {
  width: number;
  height: number;
}

export interface ViewportSize {
  width: number;
  height: number;
}

export interface DrawingCallbacks {
  onRequestRender?: () => void;
  onRequestPreviewRender?: () => void;
  onShapeAdd?: (shape: Shape) => void;
  onShapeUpdate?: (shape: Shape) => void;
  onShapeSelect?: (shapeId: string | null) => void;
}

export interface EventCallbacks {
  onShapeSelect?: (shapeId: string | null) => void;
  onDrawingStart?: () => void;
  onDrawingEnd?: () => void;
  onTextComplete?: (text: string, position: Point) => void;
}

export interface RendererConfig {
  dpr: number;
  offsetX: number;
  offsetY: number;
  scale: number;
  panOffset: Point;
}