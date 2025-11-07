"use client";

import React, { useRef, useState, useEffect, useCallback } from "react";
import { cn } from "@/lib/utils";
import { TextEditor } from "@/components/canvas/text-editor";
import { Toolbar } from "@/components/canvas/toolbar";
import { CommandHistory } from "@/lib/command-history"; // Assuming this path is correct
import { calculateBounds, isPointInShape, isPointInShapeForEraser, getResizeHandle } from "@/lib/shape-handlers";
import type { Tool, Point, Shape } from "@/lib/canvas-types";

interface DrawingCanvasProps {
  className?: string;
}

export default function DrawingCanvas({ className }: DrawingCanvasProps) {
  // Refs
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const imageInputRef = useRef<HTMLInputElement>(null);
  const commandHistoryRef = useRef<CommandHistory>(new CommandHistory());

  // State
  const [tool, setTool] = useState<Tool>("pencil");
  const [color, setColor] = useState("#1e293b");
  const [strokeWidth, setStrokeWidth] = useState(3);
  const [textSize, setTextSize] = useState(20);
  const [zoom, setZoom] = useState(100);
  const [panOffset, setPanOffset] = useState<Point>({ x: 0, y: 0 });
  const [shapes, setShapes] = useState<Shape[]>([]);
  const [currentShape, setCurrentShape] = useState<Shape | null>(null);
  const [isDrawing, setIsDrawing] = useState(false);
  const [selectedShapeId, setSelectedShapeId] = useState<string | null>(null);
  const [projectTitle, setProjectTitle] = useState("Untitled Project");
  const [isEditingTitle, setIsEditingTitle] = useState(false);

  // Touch state for mobile zoom and pan
  const [isPinching, setIsPinching] = useState(false);
  const [lastTouchDistance, setLastTouchDistance] = useState(0);
  const [touchStartPoint, setTouchStartPoint] = useState<Point>({ x: 0, y: 0 });
  const [lastPanPoint, setLastPanPoint] = useState<Point>({ x: 0, y: 0 });
  const [activeTouchId, setActiveTouchId] = useState<number | null>(null);

  // Text editing state
  const [isEditingText, setIsEditingText] = useState(false);
  const [textPosition, setTextPosition] = useState<Point>({ x: 0, y: 0 });
  const [textValue, setTextValue] = useState("");
  const [screenTextPosition, setScreenTextPosition] = useState<Point>({ x: 0, y: 0 });

  // Constants
  const viewportSize = { width: 1000, height: 800 };
  const scale = zoom / 100;

  // Helper functions
  const getMousePos = useCallback((e: React.MouseEvent): Point => {
    const rect = canvasRef.current?.getBoundingClientRect();
    if (!rect) return { x: 0, y: 0 };

    const rawX = e.clientX - rect.left;
    const rawY = e.clientY - rect.top;
    const scale = zoom / 100;
    const offsetX = viewportSize.width / 2;
    const offsetY = viewportSize.height / 2;

    const x = (rawX - offsetX - panOffset.x) / scale + offsetX;
    const y = (rawY - offsetY - panOffset.y) / scale + offsetY;

    return { x, y };
  }, [zoom, panOffset]);

  const getTouchPos = useCallback((touch: React.Touch): Point => {
    const rect = canvasRef.current?.getBoundingClientRect();
    if (!rect) return { x: 0, y: 0 };

    const rawX = touch.clientX - rect.left;
    const rawY = touch.clientY - rect.top;
    const scale = zoom / 100;
    const offsetX = viewportSize.width / 2;
    const offsetY = viewportSize.height / 2;

    const x = (rawX - offsetX - panOffset.x) / scale + offsetX;
    const y = (rawY - offsetY - panOffset.y) / scale + offsetY;

    return { x, y };
  }, [zoom, panOffset]);

  const getTouchDistance = useCallback((touch1: React.Touch, touch2: React.Touch): number => {
    const dx = touch1.clientX - touch2.clientX;
    const dy = touch1.clientY - touch2.clientY;
    return Math.sqrt(dx * dx + dy * dy);
  }, []);

  const getTouchCenter = useCallback((touch1: React.Touch, touch2: React.Touch): Point => {
    return {
      x: (touch1.clientX + touch2.clientX) / 2,
      y: (touch1.clientY + touch2.clientY) / 2
    };
  }, []);

  const getScreenPosition = useCallback((canvasPoint: Point): Point => {
    const scale = zoom / 100;
    const offsetX = viewportSize.width / 2;
    const offsetY = viewportSize.height / 2;

    const screenX = (canvasPoint.x - offsetX) * scale + offsetX + panOffset.x;
    const screenY = (canvasPoint.y - offsetY) * scale + offsetY + panOffset.y;

    return { x: screenX, y: screenY };
  }, [zoom, panOffset]);

  // Shape management
  const addShape = useCallback((shape: Shape) => {
    shape.bounds = calculateBounds(shape);
    setShapes((prev) => [...prev, shape]);
    const command = commandHistoryRef.current.createAddShapeCommand(shape);
    commandHistoryRef.current.executeCommand(command);
  }, []);

  // Drawing functions
  const drawShape = useCallback((ctx: CanvasRenderingContext2D, shape: Shape) => {
    if (!shape || !shape.points || shape.points.length === 0) return;

    // Set common properties with enhanced line quality
    ctx.strokeStyle = shape.color;
    ctx.lineWidth = shape.strokeWidth * 3; // Increase line thickness by 50%
    ctx.lineCap = "round";
    ctx.lineJoin = "round";
    ctx.globalAlpha = 0.95; // Slight transparency for smoother blending

    if (shape.type === "pencil") {
      if (shape.points.length > 1) {
        // Draw multiple strokes for thicker, smoother appearance
        for (let pass = 0; pass < 2; pass++) {
          ctx.beginPath();
          ctx.globalAlpha = pass === 0 ? 0.6 : 0.95; // Different opacity for each pass

          // Use quadratic curves for ultra-smooth lines
          ctx.moveTo(shape.points[0].x, shape.points[0].y);

          for (let i = 1; i < shape.points.length - 1; i++) {
            const xc = (shape.points[i].x + shape.points[i + 1].x) / 2;
            const yc = (shape.points[i].y + shape.points[i + 1].y) / 2;
            ctx.quadraticCurveTo(shape.points[i].x, shape.points[i].y, xc, yc);
          }

          // Last point
          if (shape.points.length > 1) {
            const lastPoint = shape.points[shape.points.length - 1];
            ctx.lineTo(lastPoint.x, lastPoint.y);
          }

          ctx.stroke();
        }
      }
    } else if (shape.type === "line" && shape.points.length >= 2) {
      ctx.beginPath();
      ctx.moveTo(shape.points[0].x, shape.points[0].y);
      ctx.lineTo(shape.points[shape.points.length - 1].x, shape.points[shape.points.length - 1].y);
      ctx.stroke();
    } else if (shape.type === "rectangle" && shape.points.length >= 2) {
      const start = shape.points[0];
      const end = shape.points[shape.points.length - 1];
      ctx.beginPath();
      ctx.rect(start.x, start.y, end.x - start.x, end.y - start.y);
      ctx.stroke();
    } else if (shape.type === "circle" && shape.points.length >= 2) {
      const center = shape.points[0];
      const edge = shape.points[shape.points.length - 1];
      const radius = Math.sqrt(
        Math.pow(edge.x - center.x, 2) + Math.pow(edge.y - center.y, 2)
      );
      ctx.beginPath();
      ctx.arc(center.x, center.y, radius, 0, 2 * Math.PI);
      ctx.stroke();
    } else if (shape.type === "text" && shape.text) {
      const fontSize = Math.max(12, shape.strokeWidth * 8);
      ctx.font = `${fontSize}px sans-serif`;
      ctx.fillStyle = shape.color;
      ctx.fillText(shape.text, shape.points[0].x, shape.points[0].y);
    } else if (shape.type === "image" && shape.imageData) {
      const img = new Image();
      img.onload = () => {
        ctx.drawImage(img, shape.points[0].x, shape.points[0].y, shape.width || 200, shape.height || 150);
      };
      img.src = shape.imageData;
    }

    // Reset global alpha
    ctx.globalAlpha = 1;
  }, []);

  const redrawCanvas = useCallback(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    // Clear canvas
    ctx.clearRect(0, 0, canvas.width, canvas.height);

    // Set up canvas with improved transformation
    const scale = zoom / 100;
    ctx.save();

    // Apply zoom and pan transformations
    ctx.translate(canvas.width / 2, canvas.height / 2);
    ctx.scale(scale, scale);
    ctx.translate(-viewportSize.width / 2 + panOffset.x / scale, -viewportSize.height / 2 + panOffset.y / scale);

    // Draw white background with padding
    ctx.fillStyle = "#ffffff";
    ctx.fillRect(0, 0, viewportSize.width, viewportSize.height);

    // Set better rendering properties
    ctx.imageSmoothingEnabled = true;
    ctx.imageSmoothingQuality = 'high';

    // Additional smoothing for canvas rendering
    ctx.shadowBlur = 0.3;
    ctx.shadowColor = 'transparent';

    // Draw shapes with better performance
    if (shapes.length > 0) {
      shapes.forEach((shape) => {
        if (shape && shape.points && shape.points.length > 0) {
          drawShape(ctx, shape);
        }
      });
    }

    // Draw current shape being drawn (only if valid)
    if (currentShape && currentShape.points && currentShape.points.length > 0) {
      drawShape(ctx, currentShape);
    }

    // Highlight selected shape with improved rendering
    if (selectedShapeId) {
      const selectedShape = shapes.find((s) => s.id === selectedShapeId);
      if (selectedShape && selectedShape.bounds) {
        // Draw selection border
        ctx.strokeStyle = "#3b82f6";
        ctx.lineWidth = 2 / scale; // Scale line width with zoom
        ctx.setLineDash([5 / scale, 5 / scale]); // Scale dash pattern
        ctx.strokeRect(
          selectedShape.bounds.x,
          selectedShape.bounds.y,
          selectedShape.bounds.width,
          selectedShape.bounds.height
        );
        ctx.setLineDash([]);
      }
    }

    ctx.restore();
  }, [shapes, currentShape, selectedShapeId, zoom, panOffset, drawShape]);

  // Event handlers
  const handleMouseDown = useCallback((e: React.MouseEvent) => {
    const point = getMousePos(e);

    if (tool === "select") {
      // Check for shape selection
      for (let i = shapes.length - 1; i >= 0; i--) {
        const shape = shapes[i];
        if (isPointInShape(point, shape)) {
          setSelectedShapeId(shape.id);
          return;
        }
      }
      // Deselect if clicking on empty space
      setSelectedShapeId(null);
      return;
    }

    if (tool === "text") {
      setTextPosition(point);
      setScreenTextPosition(getScreenPosition(point));
      setTextValue("");
      setIsEditingText(true);
      return;
    }

    // Start drawing new shape
    const newShape: Shape = {
      id: Date.now().toString(),
      type: tool,
      points: [point],
      color,
      strokeWidth,
      roughness: 0.2,
      imageHeight: undefined
    };

    setCurrentShape(newShape);
    setIsDrawing(true);
  }, [tool, color, strokeWidth, shapes, getMousePos, getScreenPosition]);

  const handleMouseMove = useCallback((e: React.MouseEvent) => {
    if (!isDrawing || !currentShape) return;

    const point = getMousePos(e);
    const updatedShape = {
      ...currentShape,
      points: [...currentShape.points, point],
    };

    setCurrentShape(updatedShape);
  }, [isDrawing, currentShape, getMousePos]);

  const handleMouseUp = useCallback(() => {
    if (!isDrawing || !currentShape) return;

    if (currentShape.points.length > 1) {
      addShape(currentShape);
    }

    setCurrentShape(null);
    setIsDrawing(false);
  }, [isDrawing, currentShape, addShape]);

  // Text editor handlers
  const handleTextComplete = useCallback(() => {
    if (!textValue.trim()) {
      setIsEditingText(false);
      return;
    }

    const newTextShape: Shape = {
      id: Date.now().toString(),
      type: "text",
      points: [textPosition],
      color,
      strokeWidth,
      text: textValue,
      textSize,
      roughness: 0,
      imageHeight: undefined
    };

    addShape(newTextShape);
    setIsEditingText(false);
    setTextValue("");
  }, [textValue, textPosition, color, strokeWidth, textSize, addShape]);

  // Touch event handlers
  const handleTouchStart = useCallback((e: React.TouchEvent) => {
    e.preventDefault(); // Prevent scrolling/zooming the page
    const touches = e.touches;

    if (touches.length === 2) {
      // Pinch zoom start
      setIsPinching(true);
      setIsDrawing(false); // Cancel any drawing
      const distance = getTouchDistance(touches[0], touches[1]);
      setLastTouchDistance(distance);
      const center = getTouchCenter(touches[0], touches[1]);
      setTouchStartPoint(center);
      setLastPanPoint(center);
      setActiveTouchId(null);
    } else if (touches.length === 1) {
      const touch = touches[0];
      if (!isPinching) {
        // Single touch - check if it's for drawing or panning
        setActiveTouchId(touch.identifier);
        const pos = getTouchPos(touch);

        // For drawing tools other than select, start drawing
        if (tool !== "select") {
          const newShape: Shape = {
            id: Date.now().toString(),
            type: tool,
            points: [pos],
            color,
            strokeWidth,
            roughness: 0.2,
            imageHeight: undefined
          };
          setCurrentShape(newShape);
          setIsDrawing(true);
        }

        setLastPanPoint({ x: touch.clientX, y: touch.clientY });
      }
    }
  }, [isPinching, tool, color, strokeWidth, getTouchDistance, getTouchCenter, getTouchPos]);

  const handleTouchMove = useCallback((e: React.TouchEvent) => {
    e.preventDefault();
    const touches = e.touches;

    if (touches.length === 2 && isPinching) {
      // Pinch zoom
      const currentDistance = getTouchDistance(touches[0], touches[1]);
      const scale = currentDistance / lastTouchDistance;

      setZoom(prevZoom => {
        const newZoom = prevZoom * scale;
        return Math.max(50, Math.min(200, newZoom)); // Limit zoom between 50% and 200%
      });

      setLastTouchDistance(currentDistance);

      // Also handle pan during pinch
      const currentCenter = getTouchCenter(touches[0], touches[1]);
      const deltaX = currentCenter.x - lastPanPoint.x;
      const deltaY = currentCenter.y - lastPanPoint.y;

      setPanOffset(prev => ({
        x: prev.x + deltaX,
        y: prev.y + deltaY
      }));

      setLastPanPoint(currentCenter);
    } else if (touches.length === 1 && !isPinching && activeTouchId !== null) {
      const touch = touches[0];
      if (touch.identifier === activeTouchId) {
        if (tool === "select") {
          // Pan mode for select tool
          const deltaX = touch.clientX - lastPanPoint.x;
          const deltaY = touch.clientY - lastPanPoint.y;

          setPanOffset(prev => ({
            x: prev.x + deltaX,
            y: prev.y + deltaY
          }));

          setLastPanPoint({ x: touch.clientX, y: touch.clientY });
        } else if (isDrawing && currentShape) {
          // Drawing mode
          const pos = getTouchPos(touch);
          const updatedShape = {
            ...currentShape,
            points: [...currentShape.points, pos],
          };
          setCurrentShape(updatedShape);
        }
      }
    }
  }, [isPinching, activeTouchId, tool, isDrawing, currentShape, lastTouchDistance, lastPanPoint, getTouchDistance, getTouchCenter, getTouchPos]);

  const handleTouchEnd = useCallback((e: React.TouchEvent) => {
    e.preventDefault();
    const touches = e.touches;

    if (touches.length === 0) {
      // All fingers lifted
      if (isDrawing && currentShape && currentShape.points.length > 1) {
        addShape(currentShape);
      }

      setIsPinching(false);
      setIsDrawing(false);
      setCurrentShape(null);
      setActiveTouchId(null);
    } else if (touches.length === 1 && isPinching) {
      // One finger lifted from pinch
      setIsPinching(false);
      const touch = touches[0];
      setLastPanPoint({ x: touch.clientX, y: touch.clientY });
    }
  }, [isDrawing, currentShape, isPinching, addShape]);

  // Toolbar handlers
  const handleZoomIn = useCallback(() => setZoom((prev) => Math.min(prev + 10, 200)), []);
  const handleZoomOut = useCallback(() => setZoom((prev) => Math.max(prev - 10, 50)), []);
  const handleResetZoom = useCallback(() => setZoom(100), []);
  const handleUndo = useCallback(() => {
    const command = commandHistoryRef.current.undo();
    // TODO: Implement undo logic
  }, []);
  const handleRedo = useCallback(() => {
    const command = commandHistoryRef.current.redo();
    // TODO: Implement redo logic
  }, []);
  const handleClear = useCallback(() => {
    setShapes([]);
    setSelectedShapeId(null);
  }, []);
  const handleDownload = useCallback(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    const link = document.createElement("a");
    link.download = `${projectTitle}.png`;
    link.href = canvas.toDataURL();
    link.click();
  }, [projectTitle]);
  const handleImageUpload = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = (event) => {
      const img = new Image();
      img.onload = () => {
        const maxWidth = 800;
        const maxHeight = 600;
        let width = img.width;
        let height = img.height;

        if (width > maxWidth || height > maxHeight) {
          const ratio = Math.min(maxWidth / width, maxHeight / height);
          width *= ratio;
          height *= ratio;
        }

        const newShape: Shape = {
          id: Date.now().toString(),
          type: "image",
          points: [{ x: 100, y: 100 }],
          color,
          strokeWidth: 2,
          imageData: event.target?.result as string,
          width,
          height,
          roughness: 0,
          imageHeight: undefined
        };

        addShape(newShape);
      };
      img.src = event.target?.result as string;
    };
    reader.readAsDataURL(file);
  }, [color, addShape]);
  const handleShare = useCallback(async () => {
    if (navigator.share) {
      try {
        await navigator.share({
          title: projectTitle,
          text: "Check out my drawing!",
          url: window.location.href,
        });
      } catch (error) {
        console.log("Share cancelled or failed");
      }
    } else {
      navigator.clipboard.writeText(window.location.href);
    }
  }, [projectTitle]);
  const handleTitleEdit = useCallback(() => setIsEditingTitle(true), []);
  const handleTitleComplete = useCallback(() => setIsEditingTitle(false), []);

  // Canvas setup
  useEffect(() => {
    const canvas = canvasRef.current;
    const container = containerRef.current;
    if (!canvas || !container) return;

    const resizeCanvas = () => {
      const rect = container.getBoundingClientRect();
      canvas.width = rect.width;
      canvas.height = rect.height;
      redrawCanvas();
    };

    resizeCanvas();
    window.addEventListener("resize", resizeCanvas);

    return () => {
      window.removeEventListener("resize", resizeCanvas);
    };
  }, [redrawCanvas]);

  // Redraw when dependencies change
  useEffect(() => {
    redrawCanvas();
  }, [redrawCanvas]);

  // Keyboard shortcuts
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.ctrlKey || e.metaKey) {
        if (e.key === "z" && !e.shiftKey) {
          e.preventDefault();
          handleUndo();
        } else if ((e.key === "z" && e.shiftKey) || e.key === "y") {
          e.preventDefault();
          handleRedo();
        } else if (e.key === "s") {
          e.preventDefault();
          handleDownload();
        }
      } else if (e.key === "Escape") {
        setSelectedShapeId(null);
        setIsEditingText(false);
      }
    };

    document.addEventListener("keydown", handleKeyDown);
    return () => document.removeEventListener("keydown", handleKeyDown);
  }, [handleUndo, handleRedo, handleDownload]);

  return (
    <div ref={containerRef} className={cn("relative w-full h-full", className)}>
      {/* Main Canvas */}
      <canvas
        ref={canvasRef}
        className="absolute inset-0 cursor-crosshair touch-none"
        onMouseDown={handleMouseDown}
        onMouseMove={handleMouseMove}
        onMouseUp={handleMouseUp}
        onMouseLeave={handleMouseUp}
        onTouchStart={handleTouchStart}
        onTouchMove={handleTouchMove}
        onTouchEnd={handleTouchEnd}
        onTouchCancel={handleTouchEnd}
      />

      {/* Toolbar */}
      <Toolbar
        tool={tool}
        color={color}
        strokeWidth={strokeWidth}
        textSize={textSize}
        zoom={zoom}
        projectTitle={projectTitle}
        isEditingTitle={isEditingTitle}
        onToolChange={setTool}
        onColorChange={setColor}
        onStrokeWidthChange={setStrokeWidth}
        onTextSizeChange={setTextSize}
        onZoomIn={handleZoomIn}
        onZoomOut={handleZoomOut}
        onResetZoom={handleResetZoom}
        onUndo={handleUndo}
        onRedo={handleRedo}
        onClear={handleClear}
        onDownload={handleDownload}
        onImageUpload={handleImageUpload}
        onShare={handleShare}
        onTitleChange={setProjectTitle}
        onTitleEdit={handleTitleEdit}
        onTitleComplete={handleTitleComplete}
        canUndo={false} // TODO: Implement proper history tracking
        canRedo={false}
      />

      {/* Text Editor */}
      <TextEditor
        screenPosition={screenTextPosition}
        fontSize={Math.max(12, textSize)}
        color={color}
        viewport={viewportSize}
        active={isEditingText}
        value={textValue}
        onChange={setTextValue}
        onComplete={handleTextComplete}
        onCancel={() => setIsEditingText(false)}
      />

      {/* Hidden file input for image upload */}
      <input
        ref={imageInputRef}
        type="file"
        accept="image/*"
        onChange={handleImageUpload}
        className="hidden"
      />
    </div>
  );
}