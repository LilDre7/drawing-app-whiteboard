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
  const textInputRef = useRef<HTMLInputElement>(null);
  const imageInputRef = useRef<HTMLInputElement>(null);
  const imageElementsRef = useRef<Map<string, HTMLImageElement>>(new Map());

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

  const [isEditingText, setIsEditingText] = useState(false);
  const [textPosition, setTextPosition] = useState<Point>({ x: 0, y: 0 });
  const [textValue, setTextValue] = useState("");

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

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    const resizeCanvas = () => {
      const rect = canvas.getBoundingClientRect();
      canvas.width = rect.width;
      canvas.height = rect.height;
      redrawCanvas();
    };

    resizeCanvas();
    window.addEventListener("resize", resizeCanvas);
    return () => window.removeEventListener("resize", resizeCanvas);
  }, []);

  useEffect(() => {
    redrawCanvas();
  }, [shapes, selectedShapeId, zoom, panOffset, draggedShape]);

  // Calculate the bounds of the shape
  const calculateBounds = (shape: Shape) => {
    if (shape.points.length === 0) return null;

    if (shape.type === "text" && shape.text) {
      const canvas = canvasRef.current;
      if (canvas) {
        const ctx = canvas.getContext("2d");
        if (ctx) {
          ctx.font = `${
            shape.strokeWidth * 8
          }px 'Comic Sans MS', cursive, sans-serif`;
          const metrics = ctx.measureText(shape.text);
          const textHeight = shape.strokeWidth * 8;
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

  // Redraw the canvas
  const redrawCanvas = () => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    ctx.setTransform(1, 0, 0, 1, 0, 0);
    ctx.clearRect(0, 0, canvas.width, canvas.height);

    const scale = zoom / 100;
    const offsetX = canvas.width / 2;
    const offsetY = canvas.height / 2;

    ctx.translate(offsetX + panOffset.x, offsetY + panOffset.y);
    ctx.scale(scale, scale);
    ctx.translate(-offsetX, -offsetY);

    shapes.forEach((shape) => {
      if ((isDragging || isResizing) && shape.id === selectedShapeId) return;
      drawShape(ctx, shape, shape.id === selectedShapeId);
    });

    if (draggedShape) {
      drawShape(ctx, draggedShape, true);
    }

    if (currentShape) {
      drawShape(ctx, currentShape, false);
    }
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
      if (shape.points.length < 2) return;
      ctx.beginPath();
      ctx.moveTo(shape.points[0].x, shape.points[0].y);
      shape.points.forEach((point) => {
        ctx.lineTo(point.x, point.y);
      });
      ctx.stroke();
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
      ctx.font = `${
        shape.strokeWidth * 8
      }px 'Comic Sans MS', cursive, sans-serif`;
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
        const handleSize = 8;
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

  const getMousePos = (e: React.MouseEvent<HTMLCanvasElement>): Point => {
    const canvas = canvasRef.current;
    if (!canvas) return { x: 0, y: 0 };
    const rect = canvas.getBoundingClientRect();
    const scale = zoom / 100;
    const offsetX = canvas.width / 2;
    const offsetY = canvas.height / 2;

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

  const handleMouseDown = (e: React.MouseEvent<HTMLCanvasElement>) => {
    const point = getMousePos(e);

    if (tool === "hand") {
      setIsPanning(true);
      setPanStart({ x: e.clientX - panOffset.x, y: e.clientY - panOffset.y });
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

    setIsDrawing(true);

    if (tool === "text") {
      setIsEditingText(true);
      setTextPosition(point);
      setTextValue("");
      setTimeout(() => textInputRef.current?.focus(), 0);
      return;
    }

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

        // Calculate new size based on which handle is being dragged
        let newWidth = originalSize.width;
        let newHeight = originalSize.height;
        let newX = shape.points[0].x;
        let newY = shape.points[0].y;

        const aspectRatio = originalSize.width / originalSize.height;

        if (resizeHandle === "se") {
          // Bottom-right: increase size
          const delta = Math.max(deltaX, deltaY);
          newWidth = originalSize.width + delta;
          newHeight = newWidth / aspectRatio;
        } else if (resizeHandle === "nw") {
          // Top-left: decrease size and move position
          const delta = Math.min(deltaX, deltaY);
          newWidth = originalSize.width - delta;
          newHeight = newWidth / aspectRatio;
          newX = shape.points[0].x + delta;
          newY = shape.points[0].y + delta;
        } else if (resizeHandle === "ne") {
          // Top-right
          newWidth = originalSize.width + deltaX;
          newHeight = newWidth / aspectRatio;
          newY = shape.points[0].y + deltaY;
        } else if (resizeHandle === "sw") {
          // Bottom-left
          newWidth = originalSize.width - deltaX;
          newHeight = newWidth / aspectRatio;
          newX = shape.points[0].x + deltaX;
        }

        // Ensure minimum size
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
    } else {
      setCurrentShape({
        ...currentShape,
        points: [currentShape.points[0], point],
      });
    }

    redrawCanvas();
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
          ctx.font = `${
            strokeWidth * 8
          }px 'Comic Sans MS', cursive, sans-serif`;
          const metrics = ctx.measureText(textValue);
          const textHeight = strokeWidth * 8;
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

  const handleZoomIn = () => setZoom(Math.min(zoom + 10, 200));
  const handleZoomOut = () => setZoom(Math.max(zoom - 10, 50));

  const handleUndo = () => {
    if (historyIndex > 0) {
      setHistoryIndex(historyIndex - 1);
      setShapes(history[historyIndex - 1]);
      setSelectedShapeId(null);
    }
  };

  const handleRedo = () => {
    if (historyIndex < history.length - 1) {
      setHistoryIndex(historyIndex + 1);
      setShapes(history[historyIndex + 1]);
      setSelectedShapeId(null);
    }
  };

  const handleClear = () => {
    saveToHistory();
    setShapes([]);
    setSelectedShapeId(null);
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
        // The canvas origin is at (canvas.width/2, canvas.height/2) in world space
        const offsetX = canvas.width / 2;
        const offsetY = canvas.height / 2;

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
    <div className="flex h-screen flex-col bg-background">
      <header className="flex h-12 items-center border-b bg-white dark:bg-card">
        {/* Left section - Menu and controls */}
        <MenuComponent />

        {/* Center section - History controls - Desktop only */}
        <div className="hidden h-full items-center gap-1 border-r px-2 sm:px-3 md:flex">
          <Button
            variant="ghost"
            size="icon"
            className="h-7 w-7"
            onClick={handleUndo}
            disabled={historyIndex <= 0}
            title="Deshacer"
          >
            <RotateCcw className="h-3.5 w-3.5" />
          </Button>
          <Button
            variant="ghost"
            size="icon"
            className="h-7 w-7"
            onClick={handleRedo}
            disabled={historyIndex >= history.length - 1}
            title="Rehacer"
          >
            <RotateCw className="h-3.5 w-3.5" />
          </Button>
        </div>

        {/* Center section - Title */}
        <div className="flex flex-1 items-center justify-center">
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
              className="border-b-2 border-blue-500 bg-transparent px-2 text-center text-sm text-foreground outline-none"
              style={{ width: `${Math.max(projectTitle.length * 8, 100)}px` }}
            />
          ) : (
            <span
              className="cursor-pointer text-sm text-muted-foreground hover:text-foreground"
              onClick={handleTitleClick}
              title="Click para editar"
            >
              {projectTitle}
            </span>
          )}
        </div>

        {/* Right section - Share button */}
        <div className="flex h-full items-center border-l px-4">
          <Button
            variant="ghost"
            size="icon"
            className={cn("h-7 w-7", showShareConfirm && "text-green-600")}
            onClick={handleShare}
            title="Compartir"
          >
            {showShareConfirm ? (
              <Check className="h-3.5 w-3.5" />
            ) : (
              <Link2 className="h-3.5 w-3.5" />
            )}
          </Button>
        </div>
      </header>

      <div className="relative flex-1 overflow-hidden">
        <div className="canvas-dots absolute inset-0 bg-[oklch(0.98_0_0)] dark:bg-[oklch(0.14_0_0)]">
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
              const touch = e.touches[0];
              handleMouseDown({
                ...e,
                clientX: touch.clientX,
                clientY: touch.clientY,
              } as unknown as React.MouseEvent<HTMLCanvasElement>);
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

          <input
            ref={imageInputRef}
            type="file"
            accept="image/*"
            onChange={handleImageUpload}
            className="hidden"
          />

          {isEditingText && (
            <input
              ref={textInputRef}
              type="text"
              value={textValue}
              onChange={(e) => setTextValue(e.target.value)}
              onBlur={handleTextComplete}
              onKeyDown={(e) => {
                if (e.key === "Enter") handleTextComplete();
                if (e.key === "Escape") {
                  setIsEditingText(false);
                  setTextValue("");
                }
              }}
              className="absolute border-2 border-blue-500 bg-white px-2 py-1 text-base outline-none dark:bg-card"
              style={{
                left: textPosition.x,
                top: textPosition.y - strokeWidth * 8,
                fontSize: `${strokeWidth * 8}px`,
                color: color,
              }}
              placeholder="Type text..."
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
