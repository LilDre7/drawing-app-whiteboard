export type Tool = "pencil" | "line" | "rectangle" | "circle" | "text" | "select" | "eraser" | "image";

export interface Point {
  x: number;
  y: number;
}

export interface Bounds {
  x: number;
  y: number;
  width: number;
  height: number;
}

export interface Shape {
  imageWidth?: number;
  imageHeight: any;
  id: string;
  type: Tool;
  points: Point[];
  color: string;
  strokeWidth: number;
  roughness?: number;
  text?: string;
  textSize?: number;
  imageData?: string;
  width?: number;
  height?: number;
  bounds?: Bounds;
}