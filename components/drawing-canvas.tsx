"use client";

import type React from "react";

import { useRef, useState, useEffect } from "react";
import { Button } from "@/components/ui/button";
import {
  Pencil,
  Minus,
  Eraser,
  Download,
  ZoomOut,
  ZoomIn,
  RotateCcw,
  RotateCw,
  Plus,
  MousePointer2,
  MessageSquare,
  MoreHorizontal,
  Hand,
  Square,
  Circle,
  Link2,
  ImageIcon,
  Check,
  Trash2,
} from "lucide-react";
import { cn } from "@/lib/utils";

import MenuComponent from "@/components/menu";

// Helper hook to position and show/hide the textarea editor like Excalidraw
function useTextEditor(params: {
  screenPosition: { x: number; y: number };
  fontSize: number;
  color: string;
  viewport: { width: number; height: number };
  active: boolean;
}) {
  const { screenPosition, fontSize, color, viewport, active } = params;
  const ref = useRef<HTMLTextAreaElement>(null);

  const minWidth = 120;
  const minHeight = fontSize + 8;

  // Desired absolute position over the canvas (baseline -> top conversion)
  const left = Math.max(0, screenPosition.x);
  const top = Math.max(0, screenPosition.y - fontSize);

  // Hide if any edge would overflow the viewport (behavior requested)
  const hidden =
    !active ||
    left < 0 ||
    top < 0 ||
    left + minWidth > (viewport.width || 0) ||
    top + minHeight > (viewport.height || 0);

  const style: React.CSSProperties = {
    position: "absolute",
    left: `${left}px`,
    top: `${top}px`,
    fontSize: `${fontSize}px`,
    color,
    minWidth: `${minWidth}px`,
    minHeight: `${minHeight}px`,
    maxWidth: "90%",
    maxHeight: `${Math.max(50, (viewport.height || 0) - 16)}px`,
    overflow: "auto",
    lineHeight: 1.2,
    whiteSpace: "pre-wrap",
    wordBreak: "break-word",
    display: hidden ? "none" : undefined,
  };

  return { ref, style, hidden } as const;
}

type Tool =
  | "select"
  | "pencil"
  | "line"
  | "rectangle"
  | "circle"
  | "text"
  | "eraser"
  | "hand"
  | "image";

interface Point {
  x: number;
  y: number;
}

interface Shape {
  id: string;
  type: Tool;
  points: Point[];
  color: string;
  strokeWidth: number;
  text?: string;
  imageData?: string;
  imageWidth?: number;
  imageHeight?: number;
  bounds?: {
    minX: number;
    minY: number;
    maxX: number;
    maxY: number;
  };
}

type ResizeHandle = "nw" | "ne" | "sw" | "se" | null;

export default function DrawingCanvas() {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const previewCanvasRef = useRef<HTMLCanvasElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  // Text editor overlay state and ref are managed via useTextEditor
  const [isEditingText, setIsEditingText] = useState(false);
  const [textPosition, setTextPosition] = useState<Point>({ x: 0, y: 0 });
  const [textValue, setTextValue] = useState("");
  const [screenTextPosition, setScreenTextPosition] = useState<Point>({
    x: 0,
    y: 0,
  });
  const imageInputRef = useRef<HTMLInputElement>(null);
  const imageElementsRef = useRef<Map<string, HTMLImageElement>>(new Map());
  const devicePixelRatioRef = useRef<number>(1);
  const viewportSizeRef = useRef<{ width: number; height: number }>({
    width: 0,
    height: 0,
  });
  const rafIdRef = useRef<number | null>(null);
  const previewRafIdRef = useRef<number | null>(null);
  const [roughness, setRoughness] = useState(0.2);

  const [tool, setTool] = useState<Tool>("select");
  const [isDrawing, setIsDrawing] = useState(false);
  const [shapes, setShapes] = useState<Shape[]>([]);
  const [currentShape, setCurrentShape] = useState<Shape | null>(null);
  const [color, setColor] = useState("#1e293b");
  const [strokeWidth, setStrokeWidth] = useState(2);
  const [zoom, setZoom] = useState(100);
  const [showShareConfirm, setShowShareConfirm] = useState(false);

  const [projectTitle, setProjectTitle] = useState("Untitled Project");
  const [isEditingTitle, setIsEditingTitle] = useState(false);
  const titleInputRef = useRef<HTMLInputElement>(null);

  const [panOffset, setPanOffset] = useState<Point>({ x: 0, y: 0 });
  const [isPanning, setIsPanning] = useState(false);
  const [panStart, setPanStart] = useState<Point>({ x: 0, y: 0 });

  // Calculate screen position from canvas coordinates (relative to canvas container)
  const getScreenPosition = (canvasPoint: Point): Point => {
    const canvas = canvasRef.current;
    if (!canvas) return { x: 0, y: 0 };

    const scale = zoom / 100;
    const offsetX = canvas.width / 2;
    const offsetY = canvas.height / 2;

    // Convert canvas world coordinates to screen coordinates
    const screenX = (canvasPoint.x - offsetX) * scale + offsetX + panOffset.x;
    const screenY = (canvasPoint.y - offsetY) * scale + offsetY + panOffset.y;

    return { x: screenX, y: screenY };
  };

  // Get minimum font size for mobile readability
  const getFontSize = (baseSize: number): number => {
    if (typeof window === "undefined") return baseSize;
    const isMobile = window.innerWidth < 768;
    const minSize = isMobile ? 16 : baseSize;
    return Math.max(minSize, baseSize);
  };

  const textEditor = useTextEditor({
    screenPosition: screenTextPosition,
    fontSize: getFontSize(strokeWidth * 8),
    color,
    viewport: viewportSizeRef.current,
    active: isEditingText,
  });

  // Update screen position when text position, zoom, or pan changes
  useEffect(() => {
    if (isEditingText && canvasRef.current) {
      const scale = zoom / 100;
      const offsetX = viewportSizeRef.current.width / 2;
      const offsetY = viewportSizeRef.current.height / 2;

      const screenX =
        (textPosition.x - offsetX) * scale + offsetX + panOffset.x;
      const screenY =
        (textPosition.y - offsetY) * scale + offsetY + panOffset.y;

      setScreenTextPosition({ x: screenX, y: screenY });
    }
  }, [isEditingText, textPosition, zoom, panOffset]);

  const [selectedShapeId, setSelectedShapeId] = useState<string | null>(null);
  const [isDragging, setIsDragging] = useState(false);
  const [dragStart, setDragStart] = useState<Point>({ x: 0, y: 0 });
  const [shapeStartPoints, setShapeStartPoints] = useState<Point[]>([]);
  const [draggedShape, setDraggedShape] = useState<Shape | null>(null);
  const [history, setHistory] = useState<Shape[][]>([]);
  const [historyIndex, setHistoryIndex] = useState(-1);
  const [isErasing, setIsErasing] = useState(false);

  const [isResizing, setIsResizing] = useState(false);
  const [resizeHandle, setResizeHandle] = useState<ResizeHandle>(null);
  const [resizeStart, setResizeStart] = useState<Point>({ x: 0, y: 0 });
  const [originalSize, setOriginalSize] = useState<{
    width: number;
    height: number;
  }>({ width: 0, height: 0 });

  // request a render on next animation frame
  const requestRender = () => {
    if (rafIdRef.current != null) cancelAnimationFrame(rafIdRef.current);
    rafIdRef.current = requestAnimationFrame(() => {
      rafIdRef.current = null;
      redrawCanvas();
    });
  };

  const requestPreviewRender = () => {
    if (previewRafIdRef.current != null)
      cancelAnimationFrame(previewRafIdRef.current);
    previewRafIdRef.current = requestAnimationFrame(() => {
      previewRafIdRef.current = null;
      redrawPreview();
    });
  };

  // Handle responsive canvas sizing with devicePixelRatio
  useEffect(() => {
    const canvas = canvasRef.current;
    const preview = previewCanvasRef.current;
    const container = containerRef.current;
    if (!canvas || !preview || !container) return;

    const applySize = () => {
      const rect = container.getBoundingClientRect();
      viewportSizeRef.current = { width: rect.width, height: rect.height };
      const dpr = Math.max(1, Math.floor(window.devicePixelRatio || 1));
      devicePixelRatioRef.current = dpr;
      const targetWidth = Math.max(1, Math.round(rect.width * dpr));
      const targetHeight = Math.max(1, Math.round(rect.height * dpr));
      if (canvas.width !== targetWidth || canvas.height !== targetHeight) {
        canvas.width = targetWidth;
        canvas.height = targetHeight;
      }
      if (preview.width !== targetWidth || preview.height !== targetHeight) {
        preview.width = targetWidth;
        preview.height = targetHeight;
      }
      requestRender();
      requestPreviewRender();
    };

    applySize();

    const ro = new ResizeObserver(() => applySize());
    ro.observe(container);

    const onWindowResize = () => applySize();
    window.addEventListener("resize", onWindowResize);

    return () => {
      ro.disconnect();
      window.removeEventListener("resize", onWindowResize);
      if (rafIdRef.current != null) cancelAnimationFrame(rafIdRef.current);
      if (previewRafIdRef.current != null)
        cancelAnimationFrame(previewRafIdRef.current);
    };
  }, []);

  useEffect(() => {
    requestRender();
  }, [shapes, selectedShapeId, zoom, panOffset, draggedShape]);

  // Calculate the bounds of the shape
  const calculateBounds = (shape: Shape) => {
    if (shape.points.length === 0) return null;

    if (shape.type === "text" && shape.text) {
      const canvas = canvasRef.current;
      if (canvas) {
        const ctx = canvas.getContext("2d");
        if (ctx) {
          const baseFontSize = shape.strokeWidth * 8;
          const fontSize = getFontSize(baseFontSize);
          ctx.font = `${fontSize}px 'Comic Sans MS', cursive, sans-serif`;
          const metrics = ctx.measureText(shape.text);
          const textHeight = fontSize;
          return {
            minX: shape.points[0].x,
            minY: shape.points[0].y - textHeight,
            maxX: shape.points[0].x + metrics.width,
            maxY: shape.points[0].y,
          };
        }
      }
    }

    if (shape.type === "image" && shape.imageWidth && shape.imageHeight) {
      return {
        minX: shape.points[0].x,
        minY: shape.points[0].y,
        maxX: shape.points[0].x + shape.imageWidth,
        maxY: shape.points[0].y + shape.imageHeight,
      };
    }

    if (shape.type === "rectangle" && shape.points.length >= 2) {
      const start = shape.points[0];
      const end = shape.points[shape.points.length - 1];
      return {
        minX: Math.min(start.x, end.x),
        minY: Math.min(start.y, end.y),
        maxX: Math.max(start.x, end.x),
        maxY: Math.max(start.y, end.y),
      };
    }

    if (shape.type === "circle" && shape.points.length >= 2) {
      const start = shape.points[0];
      const end = shape.points[shape.points.length - 1];
      const radius = Math.sqrt(
        Math.pow(end.x - start.x, 2) + Math.pow(end.y - start.y, 2)
      );
      return {
        minX: start.x - radius,
        minY: start.y - radius,
        maxX: start.x + radius,
        maxY: start.y + radius,
      };
    }

    const xs = shape.points.map((p) => p.x);
    const ys = shape.points.map((p) => p.y);

    return {
      minX: Math.min(...xs),
      minY: Math.min(...ys),
      maxX: Math.max(...xs),
      maxY: Math.max(...ys),
    };
  };

  // Check if the point is inside the shape
  const isPointInShape = (point: Point, shape: Shape): boolean => {
    const bounds = shape.bounds || calculateBounds(shape);
    if (!bounds) return false;

    const padding = 10;
    return (
      point.x >= bounds.minX - padding &&
      point.x <= bounds.maxX + padding &&
      point.y >= bounds.minY - padding &&
      point.y <= bounds.maxY + padding
    );
  };

  // Get the resize handle of the shape
  const getResizeHandle = (point: Point, shape: Shape): ResizeHandle => {
    if (shape.type !== "image" || !shape.bounds) return null;

    const handleSize = 8;
    const bounds = shape.bounds;

    // Check each corner
    if (
      Math.abs(point.x - bounds.minX) < handleSize &&
      Math.abs(point.y - bounds.minY) < handleSize
    ) {
      return "nw";
    }
    if (
      Math.abs(point.x - bounds.maxX) < handleSize &&
      Math.abs(point.y - bounds.minY) < handleSize
    ) {
      return "ne";
    }
    if (
      Math.abs(point.x - bounds.minX) < handleSize &&
      Math.abs(point.y - bounds.maxY) < handleSize
    ) {
      return "sw";
    }
    if (
      Math.abs(point.x - bounds.maxX) < handleSize &&
      Math.abs(point.y - bounds.maxY) < handleSize
    ) {
      return "se";
    }

    return null;
  };

  // Redraw the canvas (base layer only, committed shapes)
  const redrawCanvas = () => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    const dpr = devicePixelRatioRef.current;
    ctx.setTransform(1, 0, 0, 1, 0, 0);
    ctx.clearRect(0, 0, canvas.width, canvas.height);

    // Work in CSS pixel space by scaling first by DPR
    ctx.scale(dpr, dpr);

    const scale = zoom / 100;
    const offsetX = viewportSizeRef.current.width / 2;
    const offsetY = viewportSizeRef.current.height / 2;

    ctx.translate(offsetX + panOffset.x, offsetY + panOffset.y);
    ctx.scale(scale, scale);
    ctx.translate(-offsetX, -offsetY);

    // Dibujar solo los shapes comprometidos (committed shapes)
    shapes.forEach((shape) => {
      if ((isDragging || isResizing) && shape.id === selectedShapeId) return;
      drawShape(ctx, shape, shape.id === selectedShapeId);
    });

    // Dibujar el shape que se está arrastrando
    if (draggedShape) {
      drawShape(ctx, draggedShape, true);
    }

    // IMPORTANTE: Dibujar currentShape SOLO si NO es pencil y está dibujando
    // Los pencil strokes van SOLO en el preview canvas
    if (currentShape && currentShape.type !== "pencil" && isDrawing) {
      drawShape(ctx, currentShape, false);
    }
  };

  // Redraw only the preview (transient) content
  // Redraw only the preview (transient) content
  const redrawPreview = () => {
    const canvas = previewCanvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;
    const dpr = devicePixelRatioRef.current;

    // Siempre limpiar primero
    ctx.setTransform(1, 0, 0, 1, 0, 0);
    ctx.clearRect(0, 0, canvas.width, canvas.height);

    // Solo dibujar si hay un currentShape de tipo pencil Y está dibujando activamente
    if (!currentShape || currentShape.type !== "pencil" || !isDrawing) {
      return;
    }

    ctx.scale(dpr, dpr);

    const scale = zoom / 100;
    const offsetX = viewportSizeRef.current.width / 2;
    const offsetY = viewportSizeRef.current.height / 2;
    ctx.translate(offsetX + panOffset.x, offsetY + panOffset.y);
    ctx.scale(scale, scale);
    ctx.translate(-offsetX, -offsetY);

    // Dibujar el trazo de pencil en progreso
    drawPencilStylized(
      ctx,
      currentShape.points,
      currentShape.color,
      currentShape.strokeWidth,
      Math.max(0, Math.min(1, roughness))
    );
  };

  // Draw the shape on the canvas
  const drawShape = (
    ctx: CanvasRenderingContext2D,
    shape: Shape,
    isSelected: boolean
  ) => {
    ctx.strokeStyle = shape.color;
    ctx.lineWidth = shape.strokeWidth;
    ctx.lineCap = "round";
    ctx.lineJoin = "round";

    if (shape.type === "pencil") {
      drawPencilStylized(
        ctx,
        shape.points,
        shape.color,
        shape.strokeWidth,
        Math.max(0, Math.min(1, roughness))
      );
    } else if (shape.type === "line") {
      if (shape.points.length < 2) return;
      ctx.beginPath();
      ctx.moveTo(shape.points[0].x, shape.points[0].y);
      ctx.lineTo(
        shape.points[shape.points.length - 1].x,
        shape.points[shape.points.length - 1].y
      );
      ctx.stroke();
    } else if (shape.type === "rectangle") {
      if (shape.points.length < 2) return;
      const start = shape.points[0];
      const end = shape.points[shape.points.length - 1];
      ctx.strokeRect(start.x, start.y, end.x - start.x, end.y - start.y);
    } else if (shape.type === "circle") {
      if (shape.points.length < 2) return;
      const start = shape.points[0];
      const end = shape.points[shape.points.length - 1];
      const radius = Math.sqrt(
        Math.pow(end.x - start.x, 2) + Math.pow(end.y - start.y, 2)
      );
      ctx.beginPath();
      ctx.arc(start.x, start.y, radius, 0, 2 * Math.PI);
      ctx.stroke();
    } else if (shape.type === "text" && shape.text) {
      const baseFontSize = shape.strokeWidth * 8;
      const fontSize = getFontSize(baseFontSize);
      ctx.font = `${fontSize}px 'Comic Sans MS', cursive, sans-serif`;
      ctx.fillStyle = shape.color;
      ctx.fillText(shape.text, shape.points[0].x, shape.points[0].y);
    } else if (
      shape.type === "image" &&
      shape.imageWidth &&
      shape.imageHeight
    ) {
      const img = imageElementsRef.current.get(shape.id);
      if (img && img.complete && img.naturalWidth > 0) {
        ctx.drawImage(
          img,
          shape.points[0].x,
          shape.points[0].y,
          shape.imageWidth,
          shape.imageHeight
        );
      }
    }

    if (isSelected && shape.bounds) {
      ctx.strokeStyle = "#3b82f6";
      ctx.lineWidth = 2;
      ctx.setLineDash([5, 5]);
      const padding = 5;
      ctx.strokeRect(
        shape.bounds.minX - padding,
        shape.bounds.minY - padding,
        shape.bounds.maxX - shape.bounds.minX + padding * 2,
        shape.bounds.maxY - shape.bounds.minY + padding * 2
      );
      ctx.setLineDash([]);

      if (shape.type === "image") {
        const handleSize = 12;
        ctx.fillStyle = "#3b82f6";

        // Draw corner handles
        ctx.fillRect(
          shape.bounds.minX - handleSize / 2,
          shape.bounds.minY - handleSize / 2,
          handleSize,
          handleSize
        );
        ctx.fillRect(
          shape.bounds.maxX - handleSize / 2,
          shape.bounds.minY - handleSize / 2,
          handleSize,
          handleSize
        );
        ctx.fillRect(
          shape.bounds.minX - handleSize / 2,
          shape.bounds.maxY - handleSize / 2,
          handleSize,
          handleSize
        );
        ctx.fillRect(
          shape.bounds.maxX - handleSize / 2,
          shape.bounds.maxY - handleSize / 2,
          handleSize,
          handleSize
        );
      }
    }
  };

  // Stylized pencil: smoothing + jitter/roughness
  const drawPencilStylized = (
    ctx: CanvasRenderingContext2D,
    points: Point[],
    color: string,
    width: number,
    rough: number
  ) => {
    if (points.length < 2) return;
    const smoothed = smoothPoints(points);
    const jittered = applyJitter(
      smoothed,
      Math.max(0, Math.min(1, rough)) * Math.max(0.2, width * 0.2)
    );
    ctx.strokeStyle = color;
    ctx.lineWidth = width;
    ctx.lineCap = "round";
    ctx.lineJoin = "round";
    ctx.beginPath();
    ctx.moveTo(jittered[0].x, jittered[0].y);
    for (let i = 1; i < jittered.length - 1; i++) {
      const midX = (jittered[i].x + jittered[i + 1].x) / 2;
      const midY = (jittered[i].y + jittered[i + 1].y) / 2;
      ctx.quadraticCurveTo(jittered[i].x, jittered[i].y, midX, midY);
    }
    ctx.lineTo(
      jittered[jittered.length - 1].x,
      jittered[jittered.length - 1].y
    );
    ctx.stroke();
  };

  // Simple moving-average smoothing for points
  const smoothPoints = (pts: Point[], windowSize = 3): Point[] => {
    if (pts.length <= 2) return pts.slice();
    const half = Math.floor(windowSize / 2);
    const out: Point[] = [];
    for (let i = 0; i < pts.length; i++) {
      let sumX = 0,
        sumY = 0,
        count = 0;
      for (let j = -half; j <= half; j++) {
        const idx = Math.min(pts.length - 1, Math.max(0, i + j));
        sumX += pts[idx].x;
        sumY += pts[idx].y;
        count++;
      }
      out.push({ x: sumX / count, y: sumY / count });
    }
    return out;
  };

  // Apply jitter based on roughness factor
  const applyJitter = (pts: Point[], amount: number): Point[] => {
    if (amount <= 0) return pts.slice();
    return pts.map((p) => ({
      x: p.x + (Math.random() - 0.5) * amount,
      y: p.y + (Math.random() - 0.5) * amount,
    }));
  };

  const getMousePos = (e: React.MouseEvent<HTMLCanvasElement>): Point => {
    const canvas = canvasRef.current;
    if (!canvas) return { x: 0, y: 0 };
    const rect = canvas.getBoundingClientRect();
    const scale = zoom / 100;
    const offsetX = rect.width / 2;
    const offsetY = rect.height / 2;

    const rawX = e.clientX - rect.left;
    const rawY = e.clientY - rect.top;

    const x = (rawX - offsetX - panOffset.x) / scale + offsetX;
    const y = (rawY - offsetY - panOffset.y) / scale + offsetY;

    return { x, y };
  };

  const saveToHistory = () => {
    const newHistory = history.slice(0, historyIndex + 1);
    newHistory.push([...shapes]);
    setHistory(newHistory);
    setHistoryIndex(newHistory.length - 1);
  };

  const handleMouseDown = (
    e: React.MouseEvent<HTMLCanvasElement> | React.TouchEvent<HTMLCanvasElement>
  ) => {
    // Get coordinates from mouse or touch event
    const clientX = "touches" in e ? e.touches[0]?.clientX : e.clientX;
    const clientY = "touches" in e ? e.touches[0]?.clientY : e.clientY;

    if (clientX === undefined || clientY === undefined) return;

    // Create a synthetic mouse event for getMousePos
    const syntheticEvent = {
      ...e,
      clientX,
      clientY,
    } as React.MouseEvent<HTMLCanvasElement>;

    const point = getMousePos(syntheticEvent);

    if (tool === "hand") {
      setIsPanning(true);
      setPanStart({ x: clientX - panOffset.x, y: clientY - panOffset.y });
      return;
    }

    if (tool === "select") {
      if (selectedShapeId) {
        const selectedShape = shapes.find((s) => s.id === selectedShapeId);
        if (selectedShape && selectedShape.type === "image") {
          const handle = getResizeHandle(point, selectedShape);
          if (handle) {
            setIsResizing(true);
            setResizeHandle(handle);
            setResizeStart(point);
            setOriginalSize({
              width: selectedShape.imageWidth || 0,
              height: selectedShape.imageHeight || 0,
            });
            return;
          }
        }
      }

      const clickedShape = [...shapes]
        .reverse()
        .find((shape) => isPointInShape(point, shape));
      if (clickedShape) {
        setSelectedShapeId(clickedShape.id);
        setIsDragging(true);
        setDragStart(point);
        setShapeStartPoints([...clickedShape.points]);
      } else {
        setSelectedShapeId(null);
      }
      return;
    }

    if (tool === "text") {
      // Prevent default to avoid any interference
      e.preventDefault();
      setIsEditingText(true);
      setTextPosition(point);
      setTextValue("");
      // Calculate screen position directly from event for accurate placement
      const canvas = canvasRef.current;
      if (canvas) {
        const rect = canvas.getBoundingClientRect();
        // Get screen coordinates directly from mouse/touch event
        // These are relative to the canvas container
        const screenX = clientX - rect.left;
        const screenY = clientY - rect.top;
        setScreenTextPosition({ x: screenX, y: screenY });

        // Focus the input after state updates
        // Use a longer timeout for mobile devices
        const isTouchEvent = "touches" in e;
        requestAnimationFrame(() => {
          setTimeout(
            () => {
              if (textEditor.ref.current) {
                // For mobile, try to scroll into view but don't force it
                if (isTouchEvent) {
                  try {
                    textEditor.ref.current.scrollIntoView({
                      behavior: "smooth",
                      block: "center",
                      inline: "nearest",
                    });
                  } catch (e) {
                    // Ignore scroll errors on mobile
                  }
                }

                // Focus the input
                textEditor.ref.current.focus();

                // On mobile, just position cursor at start
                if (isTouchEvent && textEditor.ref.current.setSelectionRange) {
                  setTimeout(() => {
                    if (textEditor.ref.current) {
                      textEditor.ref.current.setSelectionRange(0, 0);
                    }
                  }, 50);
                } else if (!isTouchEvent) {
                  // On desktop, select all text
                  textEditor.ref.current.select();
                }
              }
            },
            isTouchEvent ? 150 : 50
          );
        });
      }
      return;
    }

    setIsDrawing(true);

    if (tool === "eraser") {
      setIsErasing(true);
      const eraserRadius = strokeWidth * 5;
      const newShapes = shapes.filter((shape) => {
        return !isPointInShape(point, shape);
      });
      if (newShapes.length !== shapes.length) {
        saveToHistory();
        setShapes(newShapes);
      }
      return;
    }

    const newShape: Shape = {
      id: Date.now().toString(),
      type: tool,
      points: [point],
      color,
      strokeWidth,
    };
    setCurrentShape(newShape);
  };

  const handleMouseMove = (e: React.MouseEvent<HTMLCanvasElement>) => {
    if (isPanning && tool === "hand") {
      setPanOffset({
        x: e.clientX - panStart.x,
        y: e.clientY - panStart.y,
      });
      return;
    }

    const point = getMousePos(e);

    if (isResizing && selectedShapeId && resizeHandle) {
      const shape = shapes.find((s) => s.id === selectedShapeId);
      if (shape && shape.type === "image") {
        const deltaX = point.x - resizeStart.x;
        const deltaY = point.y - resizeStart.y;

        let newWidth = originalSize.width;
        let newHeight = originalSize.height;
        let newX = shape.points[0].x;
        let newY = shape.points[0].y;

        const aspectRatio = originalSize.width / originalSize.height;

        if (resizeHandle === "se") {
          const delta = Math.max(deltaX, deltaY);
          newWidth = originalSize.width + delta;
          newHeight = newWidth / aspectRatio;
        } else if (resizeHandle === "nw") {
          const delta = Math.min(deltaX, deltaY);
          newWidth = originalSize.width - delta;
          newHeight = newWidth / aspectRatio;
          newX = shape.points[0].x + delta;
          newY = shape.points[0].y + delta;
        } else if (resizeHandle === "ne") {
          newWidth = originalSize.width + deltaX;
          newHeight = newWidth / aspectRatio;
          newY = shape.points[0].y + deltaY;
        } else if (resizeHandle === "sw") {
          newWidth = originalSize.width - deltaX;
          newHeight = newWidth / aspectRatio;
          newX = shape.points[0].x + deltaX;
        }

        if (newWidth > 20 && newHeight > 20) {
          const updatedShape = {
            ...shape,
            points: [{ x: newX, y: newY }],
            imageWidth: newWidth,
            imageHeight: newHeight,
          };
          updatedShape.bounds = calculateBounds(
            updatedShape
          ) as Shape["bounds"];
          setDraggedShape(updatedShape);
        }
      }
      return;
    }

    if (tool === "eraser" && isErasing) {
      const newShapes = shapes.filter((shape) => {
        return !isPointInShape(point, shape);
      });
      if (newShapes.length !== shapes.length) {
        setShapes(newShapes);
      }
      return;
    }

    if (tool === "select" && isDragging && selectedShapeId) {
      const shape = shapes.find((s) => s.id === selectedShapeId);
      if (shape && shapeStartPoints.length > 0) {
        const deltaX = point.x - dragStart.x;
        const deltaY = point.y - dragStart.y;

        const updatedShape = {
          ...shape,
          points: shapeStartPoints.map((p) => ({
            x: p.x + deltaX,
            y: p.y + deltaY,
          })),
          imageWidth: shape.imageWidth,
          imageHeight: shape.imageHeight,
        };
        updatedShape.bounds = calculateBounds(updatedShape) as Shape["bounds"];
        setDraggedShape(updatedShape);
      }
      return;
    }

    if (!isDrawing || !currentShape) return;

    if (tool === "pencil") {
      setCurrentShape({
        ...currentShape,
        points: [...currentShape.points, point],
      });
      requestPreviewRender(); // Preview solo
    } else {
      // Para líneas, rectángulos, círculos
      setCurrentShape({
        ...currentShape,
        points: [currentShape.points[0], point],
      });
      requestRender(); // Canvas base
    }
  };

  const handleMouseUp = () => {
    if (isPanning) {
      setIsPanning(false);
      return;
    }

    if (isErasing) {
      setIsErasing(false);
      return;
    }

    if (isResizing && selectedShapeId && draggedShape) {
      saveToHistory();
      setShapes(
        shapes.map((s) => (s.id === selectedShapeId ? draggedShape : s))
      );
      setDraggedShape(null);
      setIsResizing(false);
      setResizeHandle(null);
      return;
    }

    if (isDragging && selectedShapeId && draggedShape) {
      saveToHistory();
      setShapes(
        shapes.map((s) => (s.id === selectedShapeId ? draggedShape : s))
      );
      setDraggedShape(null);
      setShapeStartPoints([]);
    }

    if (currentShape && isDrawing) {
      const shapeWithBounds = {
        ...currentShape,
        bounds: calculateBounds(currentShape),
      };
      saveToHistory();
      setShapes([...shapes, shapeWithBounds as Shape]);
      setCurrentShape(null);
    }

    setIsDrawing(false);
    setIsDragging(false);

    // Limpiar ambos canvas
    requestPreviewRender();
    requestRender();
  };

  const handleTextComplete = () => {
    if (textValue.trim()) {
      const canvas = canvasRef.current;
      let bounds = {
        minX: textPosition.x,
        minY: textPosition.y - strokeWidth * 8,
        maxX: textPosition.x + textValue.length * strokeWidth * 5,
        maxY: textPosition.y,
      };

      if (canvas) {
        const ctx = canvas.getContext("2d");
        if (ctx) {
          const baseFontSize = strokeWidth * 8;
          const fontSize = getFontSize(baseFontSize);
          ctx.font = `${fontSize}px 'Comic Sans MS', cursive, sans-serif`;
          const metrics = ctx.measureText(textValue);
          const textHeight = fontSize;
          bounds = {
            minX: textPosition.x,
            minY: textPosition.y - textHeight,
            maxX: textPosition.x + metrics.width,
            maxY: textPosition.y,
          };
        }
      }

      const newShape: Shape = {
        id: Date.now().toString(),
        type: "text",
        points: [textPosition],
        color,
        strokeWidth,
        text: textValue,
        bounds,
      };
      saveToHistory();
      setShapes([...shapes, newShape]);
    }
    setIsEditingText(false);
    setTextValue("");
  };

  const saveAsImage = () => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    const link = document.createElement("a");
    link.download = `whiteboard-${Date.now()}.png`;
    link.href = canvas.toDataURL();
    link.click();
  };

  // Zoom in the canvas
  const handleZoomIn = () => {
    setZoom(Math.min(zoom + 10, 200));
    requestRender();
  };
  // Zoom out the canvas
  const handleZoomOut = () => {
    setZoom(Math.max(zoom - 10, 50));
    requestRender();
  };

  // Undo the last action
  const handleUndo = () => {
    if (historyIndex > 0) {
      setHistoryIndex(historyIndex - 1);
      setShapes(history[historyIndex - 1]);
      setSelectedShapeId(null);
    }
  };

  // Redo the last action
  const handleRedo = () => {
    if (historyIndex < history.length - 1) {
      setHistoryIndex(historyIndex + 1);
      setShapes(history[historyIndex + 1]);
      setSelectedShapeId(null);
    }
  };

  // Clear the canvas
  const handleClear = () => {
    // Save the current state to history
    saveToHistory();
    // Clear the canvas
    setShapes([]);
    // Clear the selected shape
    setSelectedShapeId(null);
    // Clear all in the canvas
    setCurrentShape(null);
    // Clear the preview canvas
    requestPreviewRender();
    // Clear the canvas
    requestRender();
  };

  const handleImageUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = (event) => {
      if (!event.target?.result) return;

      const imageDataUrl = event.target.result as string;

      const img = new Image();
      img.onload = () => {
        const canvas = canvasRef.current;
        if (!canvas) return;

        const maxWidth = 300;
        const maxHeight = 300;
        let width = img.width;
        let height = img.height;

        if (width > maxWidth || height > maxHeight) {
          const ratio = Math.min(maxWidth / width, maxHeight / height);
          width = width * ratio;
          height = height * ratio;
        }

        // Calculate position in world coordinates (considering zoom and pan)
        // The canvas origin is at (viewportWidth/2, viewportHeight/2) in world space
        const offsetX = viewportSizeRef.current.width / 2;
        const offsetY = viewportSizeRef.current.height / 2;

        // Position at the center of the visible viewport
        const centerX = offsetX - width / 2;
        const centerY = offsetY - height / 2;

        const shapeId = Date.now().toString();

        // Store the image element before creating the shape
        imageElementsRef.current.set(shapeId, img);

        const newShape: Shape = {
          id: shapeId,
          type: "image",
          points: [{ x: centerX, y: centerY }],
          color,
          strokeWidth,
          imageData: imageDataUrl,
          imageWidth: width,
          imageHeight: height,
          bounds: {
            minX: centerX,
            minY: centerY,
            maxX: centerX + width,
            maxY: centerY + height,
          },
        };

        saveToHistory();
        setShapes((prevShapes) => [...prevShapes, newShape]);
        setTool("select");

        // Force a redraw after state update
        requestAnimationFrame(() => {
          redrawCanvas();
        });
      };
      img.onerror = () => {
        console.error("Error loading image");
        alert("Error al cargar la imagen. Por favor, intenta con otra imagen.");
      };
      img.src = imageDataUrl;
    };
    reader.onerror = () => {
      console.error("Error reading file");
    };
    reader.readAsDataURL(file);

    if (imageInputRef.current) {
      imageInputRef.current.value = "";
    }
  };

  const handleShare = async () => {
    const url = window.location.href;

    if (navigator.share) {
      try {
        await navigator.share({
          title: "Whiteboard",
          text: "Mira mi whiteboard",
          url: url,
        });
      } catch (err) {
        console.log("Error sharing:", err);
      }
    } else {
      try {
        await navigator.clipboard.writeText(url);
        setShowShareConfirm(true);
        setTimeout(() => setShowShareConfirm(false), 2000);
      } catch (err) {
        console.log("Error copying to clipboard:", err);
      }
    }
  };

  const handleTitleClick = () => {
    setIsEditingTitle(true);
    setTimeout(() => titleInputRef.current?.focus(), 0);
  };

  const handleTitleComplete = () => {
    setIsEditingTitle(false);
    if (projectTitle.trim() === "") {
      setProjectTitle("Untitled Project");
    }
  };

  return (
    <div className="flex h-screen flex-col bg-trasnparet mb-4">
      <header className="flex h-12 items-center mb-4 border-b dark:bg-slate-950 md:border-0 md:bg-transparent md:px-4 md:pt-4">
        <div className="flex h-full w-full items-center md:gap-3">
          {/* Menu block - Solo en desktop con borde */}
          <div className="flex h-full items-center border-r px-3 md:rounded-lg md:border md:border-slate-200 md:px-3 dark:md:border-slate-800">
            <MenuComponent />
          </div>

          {/* History controls - Desktop only como bloque separado */}
          <div className="hidden h-full items-center gap-0.5 md:flex md:rounded-lg md:border md:border-slate-200 md:px-2 dark:md:border-slate-800">
            <Button
              variant="ghost"
              size="icon"
              className="h-8 w-8 text-slate-600 hover:text-slate-900 dark:text-slate-400 dark:hover:text-slate-100"
              onClick={handleUndo}
              disabled={historyIndex <= 0}
              title="Deshacer"
            >
              <RotateCcw className="h-4 w-4" />
            </Button>
            <Button
              variant="ghost"
              size="icon"
              className="h-8 w-8 text-slate-600 hover:text-slate-900 dark:text-slate-400 dark:hover:text-slate-100"
              onClick={handleRedo}
              disabled={historyIndex >= history.length - 1}
              title="Rehacer"
            >
              <RotateCw className="h-4 w-4" />
            </Button>
          </div>

          {/* Center section - App Name (sin bloque) */}
          <div className="flex flex-1 items-center justify-center">
            <span className="text-sm font-medium text-slate-900 dark:text-slate-100">
            </span>
          </div>

          {/* Right section - Actions con nombre de proyecto */}
          <div className="flex h-full items-center gap-2 border-l px-2 md:rounded-lg md:border md:border-slate-200 md:px-3 dark:md:border-slate-800">
            {/* Project Title - Desktop only */}
            <div className="hidden items-center gap-2 md:flex">
              {isEditingTitle ? (
                <input
                  ref={titleInputRef}
                  type="text"
                  value={projectTitle}
                  onChange={(e) => setProjectTitle(e.target.value)}
                  onBlur={handleTitleComplete}
                  onKeyDown={(e) => {
                    if (e.key === "Enter") handleTitleComplete();
                    if (e.key === "Escape") {
                      setIsEditingTitle(false);
                      setProjectTitle(projectTitle || "Untitled Project");
                    }
                  }}
                  className="border-b border-slate-900 bg-transparent px-2 text-sm text-slate-900 outline-none dark:border-slate-100 dark:text-slate-100"
                  style={{
                    width: `${Math.max(projectTitle.length * 8, 100)}px`,
                  }}
                />
              ) : (
                <button
                  className="flex items-center gap-1.5 text-sm text-slate-500 hover:text-slate-900 dark:text-slate-500 dark:hover:text-slate-100"
                  onClick={handleTitleClick}
                  title="Click para editar el nombre del proyecto"
                >
                  <svg
                    className="h-3.5 w-3.5"
                    fill="none"
                    viewBox="0 0 24 24"
                    stroke="currentColor"
                  >
                    <path
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      strokeWidth={2}
                      d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z"
                    />
                  </svg>
                  {projectTitle}
                </button>
              )}
              <div className="h-6 w-px bg-slate-200 dark:bg-slate-800" />
            </div>

            {/* Export - Desktop only */}
            <Button
              variant="ghost"
              size="icon"
              className="hidden h-8 w-8 text-slate-600 hover:text-slate-900 dark:text-slate-400 dark:hover:text-slate-100 md:flex"
              onClick={saveAsImage}
              title="Exportar"
            >
              <Download className="h-4 w-4" />
            </Button>

            {/* Clear - Desktop only */}
            <Button
              variant="ghost"
              size="icon"
              className="hidden h-8 w-8 text-slate-600 hover:text-red-600 dark:text-slate-400 dark:hover:text-red-400 md:flex"
              onClick={handleClear}
              title="Borrar todo"
            >
              <Trash2 className="h-4 w-4" />
            </Button>

            <div className="mx-1 hidden h-6 w-px bg-slate-200 dark:bg-slate-800 md:block" />

            {/* Share */}
            <Button
              variant="ghost"
              size="icon"
              className={`h-8 w-8 ${
                showShareConfirm
                  ? "text-green-600 dark:text-green-400"
                  : "text-slate-600 hover:text-slate-900 dark:text-slate-400 dark:hover:text-slate-100"
              }`}
              onClick={handleShare}
              title="Compartir"
            >
              {showShareConfirm ? (
                <Check className="h-4 w-4" />
              ) : (
                <Link2 className="h-4 w-4" />
              )}
            </Button>
          </div>
        </div>
      </header>

      <div className="relative flex-1 overflow-hidden">
        <div
          ref={containerRef}
          className="canvas-dots absolute inset-0 bg-[oklch(0.98_0_0)] dark:bg-[oklch(0.14_0_0)]"
        >
          {/* Base canvas (committed drawings) */}
          <canvas
            ref={canvasRef}
            className={cn(
              "h-full w-full touch-none",
              tool === "hand"
                ? isPanning
                  ? "cursor-grabbing"
                  : "cursor-grab"
                : tool === "select"
                ? "cursor-default"
                : "cursor-crosshair"
            )}
            onMouseDown={handleMouseDown}
            onMouseMove={handleMouseMove}
            onMouseUp={handleMouseUp}
            onMouseLeave={handleMouseUp}
            // 👇 agrega estos para móvil
            onTouchStart={(e) => {
              e.preventDefault();
              handleMouseDown(e);
            }}
            onTouchMove={(e) => {
              e.preventDefault();
              const touch = e.touches[0];
              handleMouseMove({
                ...e,
                clientX: touch.clientX,
                clientY: touch.clientY,
              } as unknown as React.MouseEvent<HTMLCanvasElement>);
            }}
            onTouchEnd={(e) => {
              e.preventDefault();
              handleMouseUp();
            }}
          />

          {/* Preview canvas (current transient stroke) */}
          <canvas
            ref={previewCanvasRef}
            className="pointer-events-none absolute inset-0 h-full w-full"
          />

          <input
            ref={imageInputRef}
            type="file"
            accept="image/*"
            onChange={handleImageUpload}
            className="hidden"
          />

          {isEditingText && (
            <textarea
              ref={textEditor.ref}
              value={textValue}
              onChange={(e) => {
                setTextValue(e.target.value);
                requestAnimationFrame(() => {
                  if (textEditor.ref.current) {
                    textEditor.ref.current.style.height = "auto";
                    textEditor.ref.current.style.height = `${textEditor.ref.current.scrollHeight}px`;
                  }
                });
              }}
              onBlur={handleTextComplete}
              onKeyDown={(e) => {
                if (e.key === "Enter" && !e.shiftKey) {
                  e.preventDefault();
                  handleTextComplete();
                }
                if (e.key === "Escape") {
                  setIsEditingText(false);
                  setTextValue("");
                }
              }}
              className="absolute border-2 border-blue-500 bg-white px-2 py-1 text-base outline-none dark:bg-card z-[100] resize-none"
              style={textEditor.style}
              placeholder="Escribe texto... (Enter = terminar, Shift+Enter = salto)"
              autoFocus
              autoComplete="off"
              autoCorrect="off"
              autoCapitalize="off"
              spellCheck="false"
            />
          )}
        </div>

        {/* Tools bar - Vertical on mobile */}
        <div className="absolute left-4 top-1/2 flex -translate-y-1/2 flex-col items-center gap-2 overflow-y-auto rounded-xl border bg-white p-2 shadow-lg dark:bg-card sm:left-6 sm:gap-2.5 sm:p-2.5 md:hidden">
          <div className="flex flex-col items-center gap-2 sm:gap-2.5">
            <Button
              variant="ghost"
              size="icon"
              className={cn(
                "h-9 w-9 rounded-lg sm:h-10 sm:w-10",
                tool === "select" &&
                  "bg-blue-100 text-blue-600 hover:bg-blue-100 dark:bg-blue-950 dark:text-blue-400"
              )}
              onClick={() => setTool("select")}
              title="Seleccionar"
            >
              <MousePointer2 className="h-4 w-4 sm:h-5 sm:w-5" />
            </Button>
            <Button
              variant="ghost"
              size="icon"
              className={cn(
                "h-9 w-9 rounded-lg sm:h-10 sm:w-10",
                tool === "hand" &&
                  "bg-blue-100 text-blue-600 hover:bg-blue-100 dark:bg-blue-950 dark:text-blue-400"
              )}
              onClick={() => setTool("hand")}
              title="Mano (Pan)"
            >
              <Hand className="h-4 w-4 sm:h-5 sm:w-5" />
            </Button>
            <Button
              variant="ghost"
              size="icon"
              className={cn(
                "h-9 w-9 rounded-lg sm:h-10 sm:w-10",
                tool === "pencil" &&
                  "bg-blue-100 text-blue-600 hover:bg-blue-100 dark:bg-blue-950 dark:text-blue-400"
              )}
              onClick={() => setTool("pencil")}
              title="Dibujo libre"
            >
              <Pencil className="h-4 w-4 sm:h-5 sm:w-5" />
            </Button>
            <Button
              variant="ghost"
              size="icon"
              className={cn(
                "h-9 w-9 rounded-lg sm:h-10 sm:w-10",
                tool === "rectangle" &&
                  "bg-blue-100 text-blue-600 hover:bg-blue-100 dark:bg-blue-950 dark:text-blue-400"
              )}
              onClick={() => setTool("rectangle")}
              title="Rectángulo"
            >
              <Square className="h-4 w-4 sm:h-5 sm:w-5" />
            </Button>
            <Button
              variant="ghost"
              size="icon"
              className={cn(
                "h-9 w-9 rounded-lg sm:h-10 sm:w-10",
                tool === "circle" &&
                  "bg-blue-100 text-blue-600 hover:bg-blue-100 dark:bg-blue-950 dark:text-blue-400"
              )}
              onClick={() => setTool("circle")}
              title="Círculo"
            >
              <Circle className="h-4 w-4 sm:h-5 sm:w-5" />
            </Button>
            <Button
              variant="ghost"
              size="icon"
              className={cn(
                "h-9 w-9 rounded-lg sm:h-10 sm:w-10",
                tool === "text" &&
                  "bg-blue-100 text-blue-600 hover:bg-blue-100 dark:bg-blue-950 dark:text-blue-400"
              )}
              onClick={() => setTool("text")}
              title="Texto"
            >
              <MessageSquare className="h-4 w-4 sm:h-5 sm:w-5" />
            </Button>
            <Button
              variant="ghost"
              size="icon"
              className="h-9 w-9 rounded-lg sm:h-10 sm:w-10"
              onClick={() => imageInputRef.current?.click()}
              title="Agregar imagen"
            >
              <ImageIcon className="h-4 w-4 sm:h-5 sm:w-5" />
            </Button>
            <Button
              variant="ghost"
              size="icon"
              className={cn(
                "h-9 w-9 rounded-lg sm:h-10 sm:w-10",
                tool === "eraser" &&
                  "bg-blue-100 text-blue-600 hover:bg-blue-100 dark:bg-blue-950 dark:text-blue-400"
              )}
              onClick={() => setTool("eraser")}
              title="Borrador"
            >
              <Eraser className="h-4 w-4 sm:h-5 sm:w-5" />
            </Button>
            <div className="my-1 h-px w-5 bg-border sm:my-1.5 sm:w-6" />
            <Button
              variant="ghost"
              size="icon"
              className="h-9 w-9 rounded-lg text-red-600 hover:bg-red-50 hover:text-red-700 dark:hover:bg-red-950 sm:h-10 sm:w-10"
              onClick={handleClear}
              title="Borrar todo"
            >
              <Trash2 className="h-4 w-4 sm:h-5 sm:w-5" />
            </Button>
            <Button
              variant="ghost"
              size="icon"
              className="h-9 w-9 rounded-lg sm:h-10 sm:w-10"
              onClick={saveAsImage}
              title="Exportar"
            >
              <Download className="h-4 w-4 sm:h-5 sm:w-5" />
            </Button>
            <Button
              variant="ghost"
              size="icon"
              className="h-9 w-9 rounded-lg sm:h-10 sm:w-10"
              title="Más opciones"
            >
              <MoreHorizontal className="h-4 w-4 sm:h-5 sm:w-5" />
            </Button>
          </div>
        </div>

        {/* Tools bar - Horizontal on desktop */}
        <div className="absolute bottom-4 left-1/2 hidden -translate-x-1/2 items-center gap-1 overflow-x-auto rounded-xl border bg-white px-2 py-2 shadow-lg dark:bg-card md:bottom-6 md:flex md:gap-1">
          <div className="flex items-center gap-1">
            <Button
              variant="ghost"
              size="icon"
              className={cn(
                "h-9 w-9 rounded-lg sm:h-10 sm:w-10",
                tool === "select" &&
                  "bg-blue-100 text-blue-600 hover:bg-blue-100 dark:bg-blue-950 dark:text-blue-400"
              )}
              onClick={() => setTool("select")}
              title="Seleccionar"
            >
              <MousePointer2 className="h-4 w-4 sm:h-5 sm:w-5" />
            </Button>
            <Button
              variant="ghost"
              size="icon"
              className={cn(
                "h-9 w-9 rounded-lg sm:h-10 sm:w-10",
                tool === "hand" &&
                  "bg-blue-100 text-blue-600 hover:bg-blue-100 dark:bg-blue-950 dark:text-blue-400"
              )}
              onClick={() => setTool("hand")}
              title="Mano (Pan)"
            >
              <Hand className="h-4 w-4 sm:h-5 sm:w-5" />
            </Button>
            <Button
              variant="ghost"
              size="icon"
              className={cn(
                "h-9 w-9 rounded-lg sm:h-10 sm:w-10",
                tool === "pencil" &&
                  "bg-blue-100 text-blue-600 hover:bg-blue-100 dark:bg-blue-950 dark:text-blue-400"
              )}
              onClick={() => setTool("pencil")}
              title="Dibujo libre"
            >
              <Pencil className="h-4 w-4 sm:h-5 sm:w-5" />
            </Button>
            <Button
              variant="ghost"
              size="icon"
              className={cn(
                "h-9 w-9 rounded-lg sm:h-10 sm:w-10",
                tool === "rectangle" &&
                  "bg-blue-100 text-blue-600 hover:bg-blue-100 dark:bg-blue-950 dark:text-blue-400"
              )}
              onClick={() => setTool("rectangle")}
              title="Rectángulo"
            >
              <Square className="h-4 w-4 sm:h-5 sm:w-5" />
            </Button>
            <Button
              variant="ghost"
              size="icon"
              className={cn(
                "h-9 w-9 rounded-lg sm:h-10 sm:w-10",
                tool === "circle" &&
                  "bg-blue-100 text-blue-600 hover:bg-blue-100 dark:bg-blue-950 dark:text-blue-400"
              )}
              onClick={() => setTool("circle")}
              title="Círculo"
            >
              <Circle className="h-4 w-4 sm:h-5 sm:w-5" />
            </Button>
            <Button
              variant="ghost"
              size="icon"
              className={cn(
                "h-9 w-9 rounded-lg sm:h-10 sm:w-10",
                tool === "text" &&
                  "bg-blue-100 text-blue-600 hover:bg-blue-100 dark:bg-blue-950 dark:text-blue-400"
              )}
              onClick={() => setTool("text")}
              title="Texto"
            >
              <MessageSquare className="h-4 w-4 sm:h-5 sm:w-5" />
            </Button>
            <Button
              variant="ghost"
              size="icon"
              className="h-9 w-9 rounded-lg sm:h-10 sm:w-10"
              onClick={() => imageInputRef.current?.click()}
              title="Agregar imagen"
            >
              <ImageIcon className="h-4 w-4 sm:h-5 sm:w-5" />
            </Button>
            <Button
              variant="ghost"
              size="icon"
              className={cn(
                "h-9 w-9 rounded-lg sm:h-10 sm:w-10",
                tool === "eraser" &&
                  "bg-blue-100 text-blue-600 hover:bg-blue-100 dark:bg-blue-950 dark:text-blue-400"
              )}
              onClick={() => setTool("eraser")}
              title="Borrador"
            >
              <Eraser className="h-4 w-4 sm:h-5 sm:w-5" />
            </Button>
            <div className="mx-1 h-5 w-px bg-border sm:h-6" />
            <Button
              variant="ghost"
              size="icon"
              className="h-9 w-9 rounded-lg text-red-600 hover:bg-red-50 hover:text-red-700 dark:hover:bg-red-950 sm:h-10 sm:w-10"
              onClick={handleClear}
              title="Borrar todo"
            >
              <Trash2 className="h-4 w-4 sm:h-5 sm:w-5" />
            </Button>
            <Button
              variant="ghost"
              size="icon"
              className="h-9 w-9 rounded-lg sm:h-10 sm:w-10"
              onClick={saveAsImage}
              title="Exportar"
            >
              <Download className="h-4 w-4 sm:h-5 sm:w-5" />
            </Button>
            {/* <Button
              variant="ghost"
              size="icon"
              className="h-9 w-9 rounded-lg sm:h-10 sm:w-10"
              title="Más opciones"
            >
              <MoreHorizontal className="h-4 w-4 sm:h-5 sm:w-5" />
            </Button> */}
          </div>
        </div>

        <div className="absolute right-4 top-4 flex items-center gap-1.5 rounded-lg border bg-white p-1.5 shadow-lg dark:bg-card sm:right-6 sm:top-6 sm:gap-2 sm:p-2">
          <input
            type="color"
            value={color}
            onChange={(e) => setColor(e.target.value)}
            className="h-7 w-7 cursor-pointer rounded border-0 sm:h-8 sm:w-8"
            title="Color"
          />
          <div className="h-5 w-px bg-border sm:h-6" />
          <div className="flex items-center gap-0.5 sm:gap-1">
            <Button
              variant="ghost"
              size="icon"
              className="h-7 w-7 sm:h-8 sm:w-8"
              onClick={() => setStrokeWidth(Math.max(1, strokeWidth - 1))}
            >
              <Minus className="h-3 w-3" />
            </Button>
            <span className="min-w-[18px] text-center text-xs font-medium sm:min-w-[20px]">
              {strokeWidth}
            </span>
            <Button
              variant="ghost"
              size="icon"
              className="h-7 w-7 sm:h-8 sm:w-8"
              onClick={() => setStrokeWidth(Math.min(10, strokeWidth + 1))}
            >
              <Plus className="h-3 w-3" />
            </Button>
          </div>
        </div>

        {/* History controls - Mobile bottom */}
        <div className="absolute bottom-4 left-4 flex items-center gap-1 rounded-lg border bg-white p-1.5 shadow-lg dark:bg-card sm:bottom-6 sm:left-6 sm:gap-1 sm:p-2 md:hidden">
          <Button
            variant="ghost"
            size="icon"
            className="h-7 w-7 sm:h-8 sm:w-8"
            onClick={handleUndo}
            disabled={historyIndex <= 0}
            title="Deshacer"
          >
            <RotateCcw className="h-3.5 w-3.5 sm:h-4 sm:w-4" />
          </Button>
          <Button
            variant="ghost"
            size="icon"
            className="h-7 w-7 sm:h-8 sm:w-8"
            onClick={handleRedo}
            disabled={historyIndex >= history.length - 1}
            title="Rehacer"
          >
            <RotateCw className="h-3.5 w-3.5 sm:h-4 sm:w-4" />
          </Button>
        </div>

        {/* Zoom controls - Bottom on all screens */}
        <div className="absolute bottom-4 right-4 flex items-center gap-1 rounded-lg border bg-white p-1.5 shadow-lg dark:bg-card sm:bottom-6 sm:right-6 sm:gap-1 sm:p-2 md:bottom-6 md:right-6">
          <Button
            variant="ghost"
            size="icon"
            className="h-7 w-7 sm:h-8 sm:w-8"
            onClick={handleZoomOut}
            title="Zoom out"
          >
            <ZoomOut className="h-3.5 w-3.5 sm:h-4 sm:w-4" />
          </Button>
          <div className="mx-0.5 min-w-[45px] text-center text-xs font-medium sm:mx-1 sm:min-w-[50px] sm:text-sm">
            {zoom}%
          </div>
          <Button
            variant="ghost"
            size="icon"
            className="h-7 w-7 sm:h-8 sm:w-8"
            onClick={handleZoomIn}
            title="Zoom in"
          >
            <ZoomIn className="h-3.5 w-3.5 sm:h-4 sm:w-4" />
          </Button>
        </div>
      </div>
    </div>
  );
}
