"use client";

import type React from "react";

import { useRef, useState, useEffect, useCallback } from "react";
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

  const minWidth = 100;
  const minHeight = fontSize + 12;
  const padding = 8;

  // Desired absolute position over the canvas (baseline -> top conversion)
  // Ensure text editor stays within reasonable bounds
  // On mobile, be more restrictive with positioning to prevent off-screen issues
  const isMobileDevice = typeof window !== "undefined" && window.innerWidth < 768;
  const minLeft = isMobileDevice ? padding * 2 : padding;
  const maxLeft = isMobileDevice ? viewport.width - 120 : viewport.width - 100;
  const minTop = isMobileDevice ? padding * 2 : padding;
  const maxTop = isMobileDevice ? viewport.height - 100 : viewport.height - 50;

  // Stabilize positioning for mobile to prevent flickering
  const rawLeft = screenPosition.x;
  const rawTop = screenPosition.y - fontSize - 4;

  const left = isMobileDevice
    ? Math.max(minLeft, Math.min(rawLeft, maxLeft))
    : Math.max(minLeft, Math.min(screenPosition.x, maxLeft));
  const top = isMobileDevice
    ? Math.max(minTop, Math.min(rawTop, maxTop))
    : Math.max(minTop, Math.min(screenPosition.y - fontSize - 4, maxTop));

  // Hide only if completely outside viewport with generous tolerance
  const tolerance = 150; // Allow 150px tolerance outside viewport

  // Use safe fallback values for SSR
  const getSafeViewportWidth = () => {
    if (typeof window !== "undefined") {
      // Use fixed viewport for mobile to prevent screen growth
      if (isMobileDevice) {
        return Math.min(375, viewport.width || 375);
      }
      return viewport.width || window.innerWidth || 1000;
    }
    return viewport.width || 1000;
  };

  const getSafeViewportHeight = () => {
    if (typeof window !== "undefined") {
      // Use fixed viewport for mobile to prevent screen growth
      if (isMobileDevice) {
        return Math.min(667, viewport.height || 667);
      }
      return viewport.height || window.innerHeight || 800;
    }
    return viewport.height || 800;
  };

  const viewportWidth = getSafeViewportWidth();
  const viewportHeight = getSafeViewportHeight();

  const hidden =
    !active ||
    // More generous bounds for mobile to prevent flickering
    (isMobileDevice ? (
      left + minWidth < -200 ||
      top + minHeight < -200 ||
      left > viewportWidth + 200 ||
      top > viewportHeight + 200
    ) : (
      left + minWidth < -tolerance ||
      top + minHeight < -tolerance ||
      left > viewportWidth + tolerance ||
      top > viewportHeight + tolerance
    ));

  const style: React.CSSProperties = {
    position: "absolute",
    left: `${left}px`,
    top: `${top}px`,
    fontSize: `${fontSize}px`,
    color,
    minWidth: "20px",
    minHeight: `${fontSize}px`,
    maxWidth: isMobileDevice ? "70vw" : "600px",
    maxHeight: isMobileDevice
      ? "120px"
      : `${Math.max(40, (viewport.height || 0) - 32)}px`,
    overflow: "hidden",
    lineHeight: isMobileDevice ? 1.4 : 4,
    whiteSpace: "pre-wrap",
    wordBreak: "break-word",
    padding: isMobileDevice ? "4px 2px" : "0",
    border: "none",
    borderRadius: isMobileDevice ? "4px" : "0",
    backgroundColor: "transparent",
    boxShadow: "none",
    outline: "none",
    resize: "none",
    fontFamily:
      "'Fredoka', 'Comic Neue', 'Patrick Hand', 'Nunito', -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif",
    fontWeight: "600",
    display: hidden ? "none" : undefined,
    zIndex: 1000,
    textAlign: "left",
    caretColor: "#3b82f6",
    transform: isMobileDevice ? "translateZ(0)" : "none", // Hardware acceleration for mobile
    willChange: isMobileDevice ? "transform" : "auto",
    // Prevent viewport zoom and improve mobile text input
    touchAction: "manipulation",
    WebkitUserSelect: "text" as any,
    userSelect: "text",
    WebkitTapHighlightColor: "transparent",
    // Improve rendering stability on mobile
    WebkitAppearance: "none" as any,
    WebkitTransform: "translateZ(0)",
    backfaceVisibility: "hidden" as any,
    // Ensure text visibility
    opacity: 1,
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

type ResizeHandle =
  | "nw"
  | "ne"
  | "sw"
  | "se"
  | "text-nw"
  | "text-ne"
  | "text-sw"
  | "text-se"
  | null;

// Command Pattern interfaces for undo/redo system
interface Command {
  execute(): void;
  undo(): void;
  getDescription(): string;
}

interface AddShapeCommand extends Command {
  type: "addShape";
  shape: Shape;
}

interface DeleteShapesCommand extends Command {
  type: "deleteShapes";
  shapes: Shape[];
}

interface MoveShapeCommand extends Command {
  type: "moveShape";
  shapeId: string;
  oldPoints: Point[];
  newPoints: Point[];
  oldImageWidth?: number;
  oldImageHeight?: number;
  newImageWidth?: number;
  newImageHeight?: number;
}

interface ModifyShapeCommand extends Command {
  type: "modifyShape";
  shapeId: string;
  oldShape: Shape;
  newShape: Shape;
}

type HistoryCommand =
  | AddShapeCommand
  | DeleteShapesCommand
  | MoveShapeCommand
  | ModifyShapeCommand;

// Command factory functions
const createAddShapeCommand = (
  shape: Shape,
  addShape: (shape: Shape) => void,
  removeShape: (shapeId: string) => void
): AddShapeCommand => ({
  type: "addShape",
  shape,
  execute() {
    addShape(shape);
  },
  undo() {
    removeShape(shape.id);
  },
  getDescription() {
    return `Agregar ${shape.type}`;
  },
});

const createDeleteShapesCommand = (
  shapes: Shape[],
  addShape: (shape: Shape) => void,
  removeShape: (shapeId: string) => void
): DeleteShapesCommand => ({
  type: "deleteShapes",
  shapes,
  execute() {
    shapes.forEach((shape) => removeShape(shape.id));
  },
  undo() {
    shapes.forEach((shape) => addShape(shape));
  },
  getDescription() {
    const shapeTypes = shapes.map((s) => s.type).join(", ");
    return `Eliminar ${shapeTypes}`;
  },
});

const createMoveShapeCommand = (
  shapeId: string,
  oldPoints: Point[],
  newPoints: Point[],
  oldImageWidth: number | undefined,
  oldImageHeight: number | undefined,
  newImageWidth: number | undefined,
  newImageHeight: number | undefined,
  updateShape: (
    shapeId: string,
    points: Point[],
    imageWidth?: number,
    imageHeight?: number
  ) => void
): MoveShapeCommand => ({
  type: "moveShape",
  shapeId,
  oldPoints,
  newPoints,
  oldImageWidth,
  oldImageHeight,
  newImageWidth,
  newImageHeight,
  execute() {
    updateShape(shapeId, newPoints, newImageWidth, newImageHeight);
  },
  undo() {
    updateShape(shapeId, oldPoints, oldImageWidth, oldImageHeight);
  },
  getDescription() {
    return `Mover figura`;
  },
});

const createModifyShapeCommand = (
  shapeId: string,
  oldShape: Shape,
  newShape: Shape,
  updateShapeFully: (shapeId: string, newShape: Shape) => void
): ModifyShapeCommand => ({
  type: "modifyShape",
  shapeId,
  oldShape,
  newShape,
  execute() {
    updateShapeFully(shapeId, newShape);
  },
  undo() {
    updateShapeFully(shapeId, oldShape);
  },
  getDescription() {
    return `Modificar ${newShape.type}`;
  },
});

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

  // Throttling para mejorar rendimiento en móvil
  const lastUpdateTimeRef = useRef<number>(0);
  const isTouchDeviceRef = useRef<boolean>(false);

  // Referencia para almacenar la información original de redimensionado
  const resizeDataRef = useRef<{
    originalStart: Point;
    originalEnd: Point;
    aspectRatio: number;
  } | null>(null);

  const [tool, setTool] = useState<Tool>("select");
  const [isDrawing, setIsDrawing] = useState(false);
  const [shapes, setShapes] = useState<Shape[]>([]);
  const [currentShape, setCurrentShape] = useState<Shape | null>(null);
  const [showWelcome, setShowWelcome] = useState(true);
  const [color, setColor] = useState("#1e293b");
  const [strokeWidth, setStrokeWidth] = useState(4)// Trazo más grueso
  const [textSize, setTextSize] = useState(24); // Texto más grande
  const [zoom, setZoom] = useState(100);
  const [showShareConfirm, setShowShareConfirm] = useState(false);


  // Estados para pinch-to-zoom mejorado
  const [isPinching, setIsPinching] = useState(false);
  const [initialTouchDistance, setInitialTouchDistance] = useState(0); // Distancia inicial entre dedos
  const [lastTouchDistance, setLastTouchDistance] = useState(0); // Última distancia calculada
  const [pinchCenter, setPinchCenter] = useState({ x: 0, y: 0 }); // Punto medio entre dedos
  const [initialScale, setInitialScale] = useState(1); // Escala inicial cuando comienza el pinch
  const pinchAnimationRef = useRef<number>(undefined); // Referencia para requestAnimationFrame

  const [projectTitle, setProjectTitle] = useState("Give a name");
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
  const [commands, setCommands] = useState<HistoryCommand[]>([]);
  const [commandIndex, setCommandIndex] = useState(-1);
  const MAX_COMMANDS = 100; // Límite de comandos para manejar memoria

  // Funny welcome messages
  const welcomeMessages = [
    "Your canvas is ready to make some magic! ✨",
    "Time to create something... or just doodle. We won't judge. 😎",
    "Welcome! Your masterpiece starts with that first awkward line. 🎨",
    "Let's get creative! (Or at least entertain ourselves for 5 minutes) 🖌️",
    "Ready to draw the next Mona Lisa... or another cat. We're not picky. 🐱",
    "Your canvas awaits! Warning: may cause sudden bursts of creativity 🌟",
    "Time to make art! Or beautiful mistakes. Those count too, right? 🎭",
    "Welcome! Let's create something that makes your friends say 'Wow!' or 'Huh?' 🤔",
    "Your digital canvas is ready! Go wild or draw tiny circles. Whatever works. 🌀",
    "Ready to unleash your inner artist? Or your inner procrastinator? Both are valid. 🎪",
  ];

  const getRandomWelcomeMessage = () => {
    return welcomeMessages[Math.floor(Math.random() * welcomeMessages.length)];
  };

  const [welcomeMessage] = useState(getRandomWelcomeMessage());

  // Helper functions for shape manipulation

  // Function to add roughness/hand-drawn effect to points
  const addRoughnessToPoints = (
    points: Point[],
    roughnessAmount: number = 1.5
  ): Point[] => {
    if (points.length < 2) return points;

    const roughPoints: Point[] = [];
    roughPoints.push(points[0]);

    for (let i = 1; i < points.length - 1; i++) {
      const prevPoint = points[i - 1];
      const currentPoint = points[i];
      const nextPoint = points[i + 1];

      // Calculate line direction for perpendicular offsets
      const lineDirX = nextPoint.x - prevPoint.x;
      const lineDirY = nextPoint.y - prevPoint.y;
      const lineLength = Math.sqrt(lineDirX * lineDirX + lineDirY * lineDirY);

      // Normalize line direction
      const normDirX = lineDirX / lineLength;
      const normDirY = lineDirY / lineLength;

      // Calculate perpendicular direction
      const perpDirX = -normDirY;
      const perpDirY = normDirX;

      // Create zigzag effect with alternating perpendicular offsets
      const zigzagIntensity = roughnessAmount * 2.5; // Much more exaggerated
      const perpendicularOffset = (i % 2 === 0 ? 1 : -1) * zigzagIntensity;

      // Add random jitter for cartoonish effect
      const jitterX = (Math.random() - 0.5) * roughnessAmount * 1.5;
      const jitterY = (Math.random() - 0.5) * roughnessAmount * 1.5;

      // Apply both perpendicular offset and jitter
      const roughPoint = {
        x: currentPoint.x + perpDirX * perpendicularOffset + jitterX,
        y: currentPoint.y + perpDirY * perpendicularOffset + jitterY,
      };

      roughPoints.push(roughPoint);
    }

    // Add last point with slight jitter
    if (points.length > 1) {
      const lastPoint = points[points.length - 1];
      const finalJitterX = (Math.random() - 0.5) * roughnessAmount * 0.5;
      const finalJitterY = (Math.random() - 0.5) * roughnessAmount * 0.5;

      roughPoints.push({
        x: lastPoint.x + finalJitterX,
        y: lastPoint.y + finalJitterY,
      });
    }

    return roughPoints;
  };

  // Function to create wavy line effect
  const createWavyLine = (
    start: Point,
    end: Point,
    segments: number = 3
  ): Point[] => {
    const points: Point[] = [];
    const dx = (end.x - start.x) / segments;
    const dy = (end.y - start.y) / segments;

    for (let i = 0; i <= segments; i++) {
      const baseX = start.x + dx * i;
      const baseY = start.y + dy * i;

      // Add perpendicular wave effect - much more exaggerated
      const perpX = -dy;
      const perpY = dx;
      const length = Math.sqrt(perpX * perpX + perpY * perpY);
      const perpNormX = perpX / length;
      const perpNormY = perpY / length;

      const waveAmplitude = 3.5; // Much more wavy
      const waveOffset = Math.sin(i * Math.PI * 1.5) * waveAmplitude; // More complex wave pattern

      points.push({
        x: baseX + perpNormX * waveOffset,
        y: baseY + perpNormY * waveOffset,
      });
    }

    return addRoughnessToPoints(points, 2.5); // Much more roughness
  };

  // Enhanced validation and clean shapes array
  const validateShapes = useCallback((shapesArray: Shape[]) => {
    return shapesArray.filter((shape) => {
      // Basic shape validation
      if (!shape || !shape.id || typeof shape.id !== "string") {
        console.warn("Invalid shape: missing or invalid id", shape);
        return false;
      }

      if (!shape.type || typeof shape.type !== "string") {
        console.warn("Invalid shape: missing or invalid type", shape);
        return false;
      }

      if (
        !shape.points ||
        !Array.isArray(shape.points) ||
        shape.points.length === 0
      ) {
        console.warn("Invalid shape: missing or empty points array", shape);
        return false;
      }

      // Validate all points are properly formed
      const validPoints = shape.points.filter(
        (p) =>
          p &&
          typeof p === "object" &&
          typeof p.x === "number" &&
          typeof p.y === "number" &&
          !isNaN(p.x) &&
          !isNaN(p.y) &&
          isFinite(p.x) &&
          isFinite(p.y)
      );

      if (validPoints.length === 0) {
        console.warn("Invalid shape: no valid points", shape);
        return false;
      }

      // If some points were invalid, log warning but keep shape if it has valid points
      if (validPoints.length !== shape.points.length) {
        console.warn(
          `Shape ${shape.id} had ${
            shape.points.length - validPoints.length
          } invalid points, cleaning up`
        );
        shape.points = validPoints; // Clean up the points in place
      }

      // Validate other essential properties
      if (!shape.color || typeof shape.color !== "string") {
        console.warn("Invalid shape: missing or invalid color", shape);
        return false;
      }

      if (
        !shape.strokeWidth ||
        typeof shape.strokeWidth !== "number" ||
        shape.strokeWidth <= 0
      ) {
        console.warn("Invalid shape: invalid strokeWidth", shape);
        return false;
      }

      return true;
    });
  }, []);

  // Enhanced periodic validation of shapes to prevent corruption (client-side only)
  useEffect(() => {
    // Only run on client side
    if (typeof window === "undefined") return;

    const interval = setInterval(() => {
      setShapes((prevShapes) => {
        if (!Array.isArray(prevShapes)) {
          console.warn("Shapes array is not valid, resetting to empty array");
          return [];
        }

        const validatedShapes = validateShapes(prevShapes);
        const removedCount = prevShapes.length - validatedShapes.length;

        if (removedCount > 0) {
          console.warn(
            `Cleaned up ${removedCount} invalid shapes during periodic validation`
          );
          console.log(
            `Previous shapes count: ${prevShapes.length}, Valid shapes count: ${validatedShapes.length}`
          );
        }

        return validatedShapes;
      });
    }, 5000); // Validate every 5 seconds (more frequent to catch bugs early)

    return () => clearInterval(interval);
  }, [validateShapes]);

  // Additional validation on window focus/visibility change to catch potential corruption
  useEffect(() => {
    const handleVisibilityChange = () => {
      if (document.visibilityState === "visible") {
        setShapes((prevShapes) => {
          if (!Array.isArray(prevShapes)) {
            console.warn(
              "Shapes array corrupted on visibility change, resetting"
            );
            return [];
          }
          return validateShapes(prevShapes);
        });
      }
    };

    const handleFocus = () => {
      setShapes((prevShapes) => {
        if (!Array.isArray(prevShapes)) {
          console.warn("Shapes array corrupted on window focus, resetting");
          return [];
        }
        return validateShapes(prevShapes);
      });
    };

    document.addEventListener("visibilitychange", handleVisibilityChange);
    window.addEventListener("focus", handleFocus);

    return () => {
      document.removeEventListener("visibilitychange", handleVisibilityChange);
      window.removeEventListener("focus", handleFocus);
    };
  }, [validateShapes]);

  const addShape = (shape: Shape) => {
    // Comprehensive shape validation before adding
    if (!shape) {
      console.warn("Attempted to add null/undefined shape");
      return;
    }

    if (!shape.id || typeof shape.id !== "string") {
      console.warn("Shape missing valid id:", shape);
      return;
    }

    if (!shape.type || typeof shape.type !== "string") {
      console.warn("Shape missing valid type:", shape);
      return;
    }

    if (!shape.points || !Array.isArray(shape.points)) {
      console.warn("Shape missing valid points array:", shape);
      return;
    }

    // Validate and clean points
    const validPoints = shape.points.filter(
      (p) =>
        p &&
        typeof p === "object" &&
        typeof p.x === "number" &&
        typeof p.y === "number" &&
        !isNaN(p.x) &&
        !isNaN(p.y) &&
        isFinite(p.x) &&
        isFinite(p.y)
    );

    if (validPoints.length === 0) {
      console.warn("Shape has no valid points, not adding:", shape);
      return;
    }

    // Validate other essential properties
    if (!shape.color || typeof shape.color !== "string") {
      console.warn("Shape missing valid color:", shape);
      return;
    }

    if (
      !shape.strokeWidth ||
      typeof shape.strokeWidth !== "number" ||
      shape.strokeWidth <= 0
    ) {
      console.warn("Shape missing valid strokeWidth:", shape);
      return;
    }

    // Create valid shape by cloning and validating the original
    const validShape: Shape = {
      ...shape,
      points: validPoints,
      bounds: calculateBounds(shape) || undefined,
    };

    setShapes((prev) => {
      // Ensure prev is a valid array
      const prevShapes = Array.isArray(prev) ? prev : [];

      // Check for duplicate IDs and replace if found
      const existingIndex = prevShapes.findIndex((s) => s && s.id === shape.id);
      let newShapes: Shape[];

      if (existingIndex !== -1) {
        console.warn(`Shape with id ${shape.id} already exists, replacing`);
        newShapes = [...prevShapes];
        newShapes[existingIndex] = validShape;
      } else {
        newShapes = [...prevShapes, validShape];
      }

      // Hide welcome message when first shape is added
      if (prevShapes.length === 0 && newShapes.length > 0) {
        setShowWelcome(false);
      }

      // Final validation of the entire array
      return validateShapes(newShapes);
    });
  };

  const removeShape = (shapeId: string) => {
    setShapes((prev) => {
      // Ensure prev is a valid array
      const prevShapes = Array.isArray(prev) ? prev : [];

      // Filter out the shape with matching ID
      const filteredShapes = prevShapes.filter(
        (shape) => shape && shape.id && shape.id !== shapeId
      );

      // Validate the resulting array
      return validateShapes(filteredShapes);
    });
  };

  const updateShape = (
    shapeId: string,
    points: Point[],
    imageWidth?: number,
    imageHeight?: number
  ) => {
    setShapes((prev) => {
      // Ensure prev is a valid array
      const prevShapes = Array.isArray(prev) ? prev : [];

      const updatedShapes = prevShapes.map((shape) => {
        if (!shape || !shape.id) return shape;

        if (shape.id === shapeId) {
          // Validate the new points
          const validPoints = points.filter(
            (p) =>
              p &&
              typeof p === "object" &&
              typeof p.x === "number" &&
              typeof p.y === "number" &&
              !isNaN(p.x) &&
              !isNaN(p.y) &&
              isFinite(p.x) &&
              isFinite(p.y)
          );

          if (validPoints.length === 0) {
            console.warn(
              `Cannot update shape ${shapeId}: no valid points provided`
            );
            return shape; // Return original shape if points are invalid
          }

          const updatedShape = {
            ...shape,
            points: validPoints,
          };

          // Recalcular bounds con el shape actualizado (nuevos puntos)
          const recalculatedBounds = calculateBounds(updatedShape);
          if (recalculatedBounds) {
            updatedShape.bounds = recalculatedBounds;
          }

          if (imageWidth !== undefined) updatedShape.imageWidth = imageWidth;
          if (imageHeight !== undefined) updatedShape.imageHeight = imageHeight;

          return updatedShape;
        }
        return shape;
      });

      // Validate the resulting array
      return validateShapes(updatedShapes);
    });
  };

  const updateShapeFully = (shapeId: string, newShape: Shape) => {
    setShapes((prev) =>
      prev.map((shape) => {
        if (shape.id === shapeId) {
          // Forzar recálculo de bounds para texto y otros tipos que lo necesiten
          const updatedShape = { ...newShape, id: shapeId };

          // Recalcular bounds específicamente para texto
          if (newShape.type === "text") {
            const recalculatedBounds = calculateBounds(updatedShape);
            if (recalculatedBounds) {
              updatedShape.bounds = recalculatedBounds;
            }
          }

          return updatedShape;
        }
        return shape;
      })
    );
  };

  // New saveToHistory function for commands
  const saveToHistory = (command: HistoryCommand) => {
    setCommands((prev) => {
      // Eliminar comandos futuros si estamos en medio del historial
      const newCommands = prev.slice(0, commandIndex + 1);
      // Agregar el nuevo comando
      newCommands.push(command);
      // Mantener solo los últimos MAX_COMMANDS
      if (newCommands.length > MAX_COMMANDS) {
        return newCommands.slice(-MAX_COMMANDS);
      }
      return newCommands;
    });
    setCommandIndex((prev) => Math.min(prev + 1, MAX_COMMANDS - 1));
  };
  const [isErasing, setIsErasing] = useState(false);
  const [cursorStyle, setCursorStyle] = useState<string>("cursor-default");

  const [isResizing, setIsResizing] = useState(false);
  const [resizeHandle, setResizeHandle] = useState<ResizeHandle>(null);
  const [resizeStart, setResizeStart] = useState<Point>({ x: 0, y: 0 });
  const [originalSize, setOriginalSize] = useState<{
    width: number;
    height: number;
  }>({ width: 0, height: 0 });

  // request a render on next animation frame
  const requestRender = () => {
    // Prevenir repintado durante edición de texto en móvil
    if (isEditingText && isTouchDeviceRef.current) {
      return; // No renderizar durante edición de texto en móvil
    }

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

    // Variables para controlar el redimensionamiento
    let isEditingTextMobile = false;
    let resizeTimeout: NodeJS.Timeout | null = null;
    let lastViewportHeight = window.innerHeight;

    const applySize = (force = false) => {
      const rect = container.getBoundingClientRect();
      viewportSizeRef.current = { width: rect.width, height: rect.height };
      const dpr = Math.max(1, Math.floor(window.devicePixelRatio || 1));
      devicePixelRatioRef.current = dpr;
      const targetWidth = Math.max(1, Math.round(rect.width * dpr));
      const targetHeight = Math.max(1, Math.round(rect.height * dpr));

      // Solo redimensionar si realmente es necesario o si se fuerza
      const needsResize =
        canvas.width !== targetWidth || canvas.height !== targetHeight;

      if (needsResize || force) {
        canvas.width = targetWidth;
        canvas.height = targetHeight;
        preview.width = targetWidth;
        preview.height = targetHeight;
        requestRender();
        requestPreviewRender();
      }
    };

    // Función mejorada que detecta si el cambio es por el teclado
    const smartResizeObserver = () => {
      const currentHeight = window.innerHeight;
      const heightChange = Math.abs(currentHeight - lastViewportHeight);

      // Si estamos editando texto y el cambio de altura es pequeño (probablemente teclado)
      if (isEditingTextMobile && heightChange < 300) {
        // NO redimensionar el canvas, solo actualizar la referencia del viewport
        const rect = container.getBoundingClientRect();
        viewportSizeRef.current = {
          width: rect.width,
          height: rect.height,
        };
        // No llamar a applySize() para evitar repintado
        return;
      }

      lastViewportHeight = currentHeight;

      // Para otros cambios, usar debounce para evitar múltiples redimensiones
      if (resizeTimeout) {
        clearTimeout(resizeTimeout);
      }

      resizeTimeout = setTimeout(() => {
        applySize();
      }, 100);
    };

    // Función que se puede llamar externamente para indicar que se está editando texto
    const setEditingTextMobile = (editing: boolean) => {
      isEditingTextMobile = editing;
    };

    // Exponer la función globalmente para que pueda ser usada por el editor de texto
    (window as any).setEditingTextMobile = setEditingTextMobile;

    // ResizeObserver mejorado
    const ro = new ResizeObserver(() => smartResizeObserver());
    ro.observe(container);

    // Evento window resize mejorado
    const onWindowResize = () => smartResizeObserver();
    window.addEventListener("resize", onWindowResize);

    // También escuchar cambios de orientation que pueden afectar el viewport
    const onOrientationChange = () => {
      // Dar tiempo a que se complete el cambio de orientación
      setTimeout(() => {
        isEditingTextMobile = false; // Resetear estado al cambiar orientación
        applySize(true); // Forzar redimensionado
      }, 500);
    };
    window.addEventListener("orientationchange", onOrientationChange);

    // Aplicar tamaño inicial
    applySize();

    return () => {
      ro.disconnect();
      window.removeEventListener("resize", onWindowResize);
      window.removeEventListener("orientationchange", onOrientationChange);
      if (resizeTimeout) {
        clearTimeout(resizeTimeout);
      }
      if (rafIdRef.current != null) cancelAnimationFrame(rafIdRef.current);
      if (previewRafIdRef.current != null)
        cancelAnimationFrame(previewRafIdRef.current);
      // Limpiar referencia global
      delete (window as any).setEditingTextMobile;
    };
  }, []);

  useEffect(() => {
    requestRender();
  }, [shapes, selectedShapeId, zoom, panOffset, draggedShape]);

  // Limpiar estado de pinch y animaciones al desmontar
  useEffect(() => {
    return () => {
      // Finalizar gesture de pinch
      endPinchZoom();

      // Cancelar cualquier animación pendiente
      if (pinchAnimationRef.current) {
        cancelAnimationFrame(pinchAnimationRef.current);
        pinchAnimationRef.current = null as unknown as number;
      }
    };
  }, []);

  // Calculate the bounds of the shape
  const calculateBounds = (shape: Shape) => {
    if (shape.points.length === 0) return null;

    if (shape.type === "text" && shape.text) {
      const canvas = canvasRef.current;
      if (canvas) {
        const ctx = canvas.getContext("2d");
        if (ctx) {
          const fontSize = Math.max(12, getFontSize(shape.strokeWidth * 8));
          ctx.font = `${fontSize}px 'Fredoka', 'Comic Neue', 'Patrick Hand', 'Nunito', -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif`;
          const metrics = ctx.measureText(shape.text);
          const textHeight = fontSize;
          const padding = Math.max(10, fontSize / 2); // Increased padding for better selection area
          return {
            minX: shape.points[0].x - padding,
            minY: shape.points[0].y - textHeight - padding,
            maxX: shape.points[0].x + Math.max(metrics.width, 20) + padding, // Minimum width for selection
            maxY: shape.points[0].y + padding,
          };
        }
      }
      // Fallback bounds if canvas context is not available
      const fallbackSize = Math.max(12, shape.strokeWidth * 8);
      const fallbackPadding = 8;
      return {
        minX: shape.points[0].x - fallbackPadding,
        minY: shape.points[0].y - fallbackSize - fallbackPadding,
        maxX:
          shape.points[0].x +
          Math.max(shape.text.length * fallbackSize * 0.6, 50) +
          fallbackPadding,
        maxY: shape.points[0].y + fallbackPadding,
      };
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
  const isPointInShape = (
    point: Point,
    shape: Shape,
    isTouchEvent: boolean = false
  ): boolean => {
    const bounds = shape.bounds || calculateBounds(shape);
    if (!bounds) return false;

    // Padding diferenciado para touch vs mouse
    const basePadding = isTouchEvent ? 15 : 8;

    // Padding adicional basado en el grosor del stroke para figuras geométricas
    const strokeWidthPadding =
      shape.type === "rectangle" ||
      shape.type === "circle" ||
      shape.type === "line"
        ? Math.max(shape.strokeWidth * 2, 4)
        : 0;

    const totalPadding = basePadding + strokeWidthPadding;

    // Para texto, imagen y pencil, usar el bounding box completo
    if (
      shape.type === "text" ||
      shape.type === "image" ||
      shape.type === "pencil"
    ) {
      // Para texto, usar un padding mucho más grande para mejorar la detección
      const textPadding = shape.type === "text" ? basePadding * 4 : basePadding; // 4x más grande para texto

      const isInside =
        point.x >= bounds.minX - textPadding &&
        point.x <= bounds.maxX + textPadding &&
        point.y >= bounds.minY - textPadding &&
        point.y <= bounds.maxY + textPadding;

      return isInside;
    }

    // Para líneas, verificar si el punto está cerca de la línea
    if (shape.type === "line" && shape.points.length >= 2) {
      const start = shape.points[0];
      const end = shape.points[shape.points.length - 1];
      return isPointNearLine(point, start, end, totalPadding);
    }

    // Para rectángulos, verificar SOLO si el punto está cerca de los bordes (no el interior)
    if (shape.type === "rectangle" && shape.points.length >= 2) {
      const start = shape.points[0];
      const end = shape.points[shape.points.length - 1];

      // Calcular las esquinas del rectángulo (ordenadas correctamente)
      const minX = Math.min(start.x, end.x);
      const minY = Math.min(start.y, end.y);
      const maxX = Math.max(start.x, end.x);
      const maxY = Math.max(start.y, end.y);

      // Definir los cuatro bordes
      const topLeft = { x: minX, y: minY };
      const topRight = { x: maxX, y: minY };
      const bottomRight = { x: maxX, y: maxY };
      const bottomLeft = { x: minX, y: maxY };

      // Verificar si está cerca de cualquier borde PERO no dentro del rectángulo
      const nearTopEdge = isPointNearLine(
        point,
        topLeft,
        topRight,
        totalPadding
      );
      const nearRightEdge = isPointNearLine(
        point,
        topRight,
        bottomRight,
        totalPadding
      );
      const nearBottomEdge = isPointNearLine(
        point,
        bottomRight,
        bottomLeft,
        totalPadding
      );
      const nearLeftEdge = isPointNearLine(
        point,
        bottomLeft,
        topLeft,
        totalPadding
      );

      // Verificar que el punto no esté claramente dentro del rectángulo (a menos que esté muy cerca del borde)
      const isInsideRectangle =
        point.x > minX + totalPadding &&
        point.x < maxX - totalPadding &&
        point.y > minY + totalPadding &&
        point.y < maxY - totalPadding;

      // Solo retornar true si está cerca de un borde Y no está claramente dentro
      return (
        (nearTopEdge || nearRightEdge || nearBottomEdge || nearLeftEdge) &&
        !isInsideRectangle
      );
    }

    // Para círculos, verificar SOLO si el punto está cerca del perímetro (no el interior)
    if (shape.type === "circle" && shape.points.length >= 2) {
      const center = shape.points[0];
      const edgePoint = shape.points[shape.points.length - 1];
      const radius = Math.sqrt(
        // Corrected: use edgePoint.y instead of edge.y
        Math.pow(edgePoint.x - center.x, 2) +
          Math.pow(edgePoint.y - center.y, 2)
      );
      const distance = Math.sqrt(
        Math.pow(point.x - center.x, 2) + Math.pow(point.y - center.y, 2)
      );

      // Verificar si está cerca del perímetro del círculo
      const nearPerimeter = Math.abs(distance - radius) <= totalPadding;

      // Verificar que no esté claramente dentro del círculo (a menos que esté muy cerca del borde)
      const isInsideCircle = distance < radius - totalPadding;

      // Solo retornar true si está cerca del perímetro Y no está claramente dentro
      return nearPerimeter && !isInsideCircle;
    }

    return false;
  };

  // Función específica para el borrador - más permisiva que la selección normal
  const isPointInShapeForEraser = (
    point: Point,
    shape: Shape,
    isTouchEvent: boolean = false
  ): boolean => {
    const bounds = shape.bounds || calculateBounds(shape);
    if (!bounds) return false;

    // Padding más generoso para el borrador
    const basePadding = isTouchEvent ? 20 : 12;
    const eraserRadius = strokeWidth * 5; // El radio del borrador actual
    const totalPadding = Math.max(basePadding, eraserRadius);

    // Para texto, imagen y pencil, usar el bounding box completo con padding generoso
    if (
      shape.type === "text" ||
      shape.type === "image" ||
      shape.type === "pencil"
    ) {
      return (
        point.x >= bounds.minX - totalPadding &&
        point.x <= bounds.maxX + totalPadding &&
        point.y >= bounds.minY - totalPadding &&
        point.y <= bounds.maxY + totalPadding
      );
    }

    // Para líneas, verificar si el punto está cerca de la línea con umbral mayor
    if (shape.type === "line" && shape.points.length >= 2) {
      const start = shape.points[0];
      const end = shape.points[shape.points.length - 1];
      return isPointNearLine(point, start, end, totalPadding);
    }

    // Para rectángulos, el borrador debe poder detectar TODO el rectángulo (interior + bordes)
    if (shape.type === "rectangle" && shape.points.length >= 2) {
      return (
        point.x >= bounds.minX - totalPadding &&
        point.x <= bounds.maxX + totalPadding &&
        point.y >= bounds.minY - totalPadding &&
        point.y <= bounds.maxY + totalPadding
      );
    }

    // Para círculos, el borrador debe poder detectar TODO el círculo (interior + perímetro)
    if (shape.type === "circle" && shape.points.length >= 2) {
      const center = shape.points[0];
      const edgePoint = shape.points[shape.points.length - 1];
      const radius = Math.sqrt(
        Math.pow(edgePoint.x - center.x, 2) +
          Math.pow(edgePoint.y - center.y, 2)
      );
      const distance = Math.sqrt(
        Math.pow(point.x - center.x, 2) + Math.pow(point.y - center.y, 2)
      );

      // Detectar si está dentro o cerca del círculo
      return distance <= radius + totalPadding;
    }

    return false;
  };

  // Helper function to check if a point is near a line segment
  const isPointNearLine = (
    point: Point,
    start: Point,
    end: Point,
    threshold: number
  ): boolean => {
    // Calcular la distancia del punto a la línea
    const A = point.x - start.x;
    const B = point.y - start.y;
    const C = end.x - start.x;
    const D = end.y - start.y;

    const dot = A * C + B * D;
    const lenSq = C * C + D * D;
    let param = -1;

    if (lenSq !== 0) {
      param = dot / lenSq;
    }

    let xx, yy;

    if (param < 0) {
      xx = start.x;
      yy = start.y;
    } else if (param > 1) {
      xx = end.x;
      yy = end.y;
    } else {
      xx = start.x + param * C;
      yy = start.y + param * D;
    }

    const dx = point.x - xx;
    const dy = point.y - yy;
    const distance = Math.sqrt(dx * dx + dy * dy);

    return distance <= threshold;
  };

  // Get the resize handle of the shape
  const getResizeHandle = (
    point: Point,
    shape: Shape,
    isTouchEvent: boolean = false
  ): ResizeHandle => {
    if (shape.type === "text" && shape.bounds) {
      // Check for text resize handles at all four corners
      const basePadding = isTouchEvent ? 12 : 8;
      const selectionX = shape.bounds.minX - basePadding;
      const selectionY = shape.bounds.minY - basePadding;
      const selectionWidth =
        shape.bounds.maxX - shape.bounds.minX + basePadding * 2;
      const selectionHeight =
        shape.bounds.maxY - shape.bounds.minY + basePadding * 2;
      const handleSize = isTouchEvent ? 12 : 8;

      // Top-left corner handle
      if (
        Math.abs(point.x - selectionX) < handleSize / 2 &&
        Math.abs(point.y - selectionY) < handleSize / 2
      ) {
        return "text-nw";
      }

      // Top-right corner handle
      if (
        Math.abs(point.x - (selectionX + selectionWidth)) < handleSize / 2 &&
        Math.abs(point.y - selectionY) < handleSize / 2
      ) {
        return "text-ne";
      }

      // Bottom-left corner handle
      if (
        Math.abs(point.x - selectionX) < handleSize / 2 &&
        Math.abs(point.y - (selectionY + selectionHeight)) < handleSize / 2
      ) {
        return "text-sw";
      }

      // Bottom-right corner handle
      if (
        Math.abs(point.x - (selectionX + selectionWidth)) < handleSize / 2 &&
        Math.abs(point.y - (selectionY + selectionHeight)) < handleSize / 2
      ) {
        return "text-se";
      }

      return null;
    }

    // Add resize handles for geometric shapes
    if (shape.bounds) {
      const handleSize = isTouchEvent ? 12 : 8;
      const bounds = shape.bounds;

      // Check each corner for rectangles and circles
      if (shape.type === "rectangle" && shape.points.length >= 2) {
        // Para rectángulos, usar directamente los puntos del rectángulo
        const start = shape.points[0];
        const end = shape.points[1];

        // Calcular las esquinas reales del rectángulo
        const minX = Math.min(start.x, end.x);
        const minY = Math.min(start.y, end.y);
        const maxX = Math.max(start.x, end.x);
        const maxY = Math.max(start.y, end.y);

        // Las posiciones de los handles deben coincidir exactamente con cómo se dibujan
        const handlePositions = {
          nw: { x: minX, y: minY },
          ne: { x: maxX, y: minY },
          sw: { x: minX, y: maxY },
          se: { x: maxX, y: maxY },
        };

        // Aumentar el área de detección
        const detectionRadius = handleSize * 2;

        // Check each corner handle position
        if (
          Math.abs(point.x - handlePositions.nw.x) < detectionRadius &&
          Math.abs(point.y - handlePositions.nw.y) < detectionRadius
        ) {
          return "nw";
        }
        if (
          Math.abs(point.x - handlePositions.ne.x) < detectionRadius &&
          Math.abs(point.y - handlePositions.ne.y) < detectionRadius
        ) {
          return "ne";
        }
        if (
          Math.abs(point.x - handlePositions.sw.x) < detectionRadius &&
          Math.abs(point.y - handlePositions.sw.y) < detectionRadius
        ) {
          return "sw";
        }
        if (
          Math.abs(point.x - handlePositions.se.x) < detectionRadius &&
          Math.abs(point.y - handlePositions.se.y) < detectionRadius
        ) {
          return "se";
        }
      } else if (shape.type === "circle" && shape.points.length >= 2) {
        // Para círculos, usar puntos en el perímetro en las direcciones cardinales
        const center = shape.points[0];
        const edge = shape.points[1];
        const radius = Math.sqrt(
          Math.pow(edge.x - center.x, 2) + Math.pow(edge.y - center.y, 2)
        );

        // Posiciones de handles en las direcciones cardinales
        const handlePositions = {
          nw: { x: center.x - radius, y: center.y - radius }, // Esquina superior izquierda
          ne: { x: center.x + radius, y: center.y - radius }, // Esquina superior derecha
          sw: { x: center.x - radius, y: center.y + radius }, // Esquina inferior izquierda
          se: { x: center.x + radius, y: center.y + radius }, // Esquina inferior derecha
        };

        // Aumentar el área de detección para círculos
        const detectionRadius = handleSize * 2.5;

        // Check each corner handle position
        if (
          Math.abs(point.x - handlePositions.nw.x) < detectionRadius &&
          Math.abs(point.y - handlePositions.nw.y) < detectionRadius
        ) {
          return "nw";
        }
        if (
          Math.abs(point.x - handlePositions.ne.x) < detectionRadius &&
          Math.abs(point.y - handlePositions.ne.y) < detectionRadius
        ) {
          return "ne";
        }
        if (
          Math.abs(point.x - handlePositions.sw.x) < detectionRadius &&
          Math.abs(point.y - handlePositions.sw.y) < detectionRadius
        ) {
          return "sw";
        }
        if (
          Math.abs(point.x - handlePositions.se.x) < detectionRadius &&
          Math.abs(point.y - handlePositions.se.y) < detectionRadius
        ) {
          return "se";
        }
      } else if (shape.type === "image") {
        // Para imágenes, usar los bounds
        const handlePositions = {
          nw: { x: bounds.minX, y: bounds.minY },
          ne: { x: bounds.maxX, y: bounds.minY },
          sw: { x: bounds.minX, y: bounds.maxY },
          se: { x: bounds.maxX, y: bounds.maxY },
        };

        // Aumentar el área de detección
        const detectionRadius = handleSize * 2;

        // Check each corner handle position
        if (
          Math.abs(point.x - handlePositions.nw.x) < detectionRadius &&
          Math.abs(point.y - handlePositions.nw.y) < detectionRadius
        ) {
          return "nw";
        }
        if (
          Math.abs(point.x - handlePositions.ne.x) < detectionRadius &&
          Math.abs(point.y - handlePositions.ne.y) < detectionRadius
        ) {
          return "ne";
        }
        if (
          Math.abs(point.x - handlePositions.sw.x) < detectionRadius &&
          Math.abs(point.y - handlePositions.sw.y) < detectionRadius
        ) {
          return "sw";
        }
        if (
          Math.abs(point.x - handlePositions.se.x) < detectionRadius &&
          Math.abs(point.y - handlePositions.se.y) < detectionRadius
        ) {
          return "se";
        }
      }

      // Special resize handles for lines (endpoints)
      if (shape.type === "line" && shape.points.length >= 2) {
        const start = shape.points[0];
        const end = shape.points[shape.points.length - 1];

        // Check line endpoints
        if (
          Math.sqrt(
            Math.pow(point.x - start.x, 2) + Math.pow(point.y - start.y, 2)
          ) < handleSize
        ) {
          return "nw"; // Start point
        }
        if (
          Math.sqrt(
            Math.pow(point.x - end.x, 2) + Math.pow(point.y - end.y, 2)
          ) < handleSize
        ) {
          return "se"; // End point
        }
      }
    }

    return null;
  };

  // Draw resize preview outline
  const drawResizePreview = (ctx: CanvasRenderingContext2D) => {
    if (!isResizing || !selectedShapeId || !resizeHandle || !draggedShape)
      return;

    ctx.save();

    // Make the preview much more visible
    ctx.strokeStyle = "#ff0000"; // Red color for high visibility
    ctx.lineWidth = 3; // Thicker lines
    ctx.setLineDash([8, 4]); // More prominent dashes
    ctx.fillStyle = "rgba(193, 168, 168, 0.15)"; // Red semi-transparent fill

    if (draggedShape.type === "rectangle" && draggedShape.points.length >= 2) {
      const start = draggedShape.points[0];
      const end = draggedShape.points[draggedShape.points.length - 1];

      // Draw preview rectangle with visible red fill
      ctx.fillRect(start.x, start.y, end.x - start.x, end.y - start.y);
      ctx.strokeRect(start.x, start.y, end.x - start.x, end.y - start.y);

      // Draw corner indicators for extra visibility
      ctx.fillStyle = "#ff0000";
      const cornerSize = 6;
      ctx.fillRect(
        start.x - cornerSize / 2,
        start.y - cornerSize / 2,
        cornerSize,
        cornerSize
      );
      ctx.fillRect(
        end.x - cornerSize / 2,
        start.y - cornerSize / 2,
        cornerSize,
        cornerSize
      );
      ctx.fillRect(
        start.x - cornerSize / 2,
        end.y - cornerSize / 2,
        cornerSize,
        cornerSize
      );
      ctx.fillRect(
        end.x - cornerSize / 2,
        end.y - cornerSize / 2,
        cornerSize,
        cornerSize
      );
    } else if (
      draggedShape.type === "circle" &&
      draggedShape.points.length >= 2
    ) {
      const center = draggedShape.points[0];
      const edge = draggedShape.points[draggedShape.points.length - 1];
      const radius = Math.sqrt(
        Math.pow(edge.x - center.x, 2) + Math.pow(edge.y - center.y, 2)
      );

      // Draw preview circle with red fill
      ctx.beginPath();
      ctx.arc(center.x, center.y, radius, 0, 2 * Math.PI);
      ctx.fill();
      ctx.stroke();

      // Draw center point for extra visibility
      ctx.fillStyle = "#ff0000";
      ctx.beginPath();
      ctx.arc(center.x, center.y, 4, 0, 2 * Math.PI);
      ctx.fill();
    } else if (
      draggedShape.type === "line" &&
      draggedShape.points.length >= 2
    ) {
      const start = draggedShape.points[0];
      const end = draggedShape.points[draggedShape.points.length - 1];

      // Draw very visible preview line
      ctx.lineWidth = Math.max(draggedShape.strokeWidth + 4, 6); // Much thicker
      ctx.setLineDash([]);
      ctx.strokeStyle = "#ff0000"; // Solid red
      ctx.beginPath();
      ctx.moveTo(start.x, start.y);
      ctx.lineTo(end.x, end.y);
      ctx.stroke();

      // Draw very visible endpoints as larger circles
      ctx.fillStyle = "#ff0000";
      ctx.beginPath();
      ctx.arc(start.x, start.y, 8, 0, 2 * Math.PI);
      ctx.fill();
      ctx.beginPath();
      ctx.arc(end.x, end.y, 8, 0, 2 * Math.PI);
      ctx.fill();

      // Draw white centers for the endpoints
      ctx.fillStyle = "#ffffff";
      ctx.beginPath();
      ctx.arc(start.x, start.y, 4, 0, 2 * Math.PI);
      ctx.fill();
      ctx.beginPath();
      ctx.arc(end.x, end.y, 4, 0, 2 * Math.PI);
      ctx.fill();
    }

    ctx.restore();
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

    // Dibujar preview de redimensionamiento si está activo (dibujar primero para que esté debajo)
    if (isResizing && selectedShapeId && draggedShape) {
      drawResizePreview(ctx);
    }

    // Dibujar el shape que se está arrastrando (arriba de la preview)
    if (draggedShape) {
      drawShape(ctx, draggedShape, true);
    }

    // NO dibujar currentShape aquí - se maneja en el preview canvas
    // Esto mantiene la separación clara entre contenido comprometido y transitorio
  };

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

    // Solo dibujar si hay un currentShape Y está dibujando activamente
    if (!currentShape || !isDrawing) {
      return;
    }

    ctx.scale(dpr, dpr);

    const scale = zoom / 100;
    const offsetX = viewportSizeRef.current.width / 2;
    const offsetY = viewportSizeRef.current.height / 2;
    ctx.translate(offsetX + panOffset.x, offsetY + panOffset.y);
    ctx.scale(scale, scale);
    ctx.translate(-offsetX, -offsetY);

    // Dibujar la forma actual en progreso (cualquier tipo)
    // Hacerla más visible durante el dibujo
    if (
      currentShape.type === "line" ||
      currentShape.type === "rectangle" ||
      currentShape.type === "circle"
    ) {
      // Para formas geométricas, hacerlas más visibles
      ctx.save();

      // Mejora: Añadir efecto de vista previa más visible
      ctx.strokeStyle = currentShape.color;
      ctx.lineWidth = Math.max(currentShape.strokeWidth, 2);
      ctx.lineCap = "round";
      ctx.lineJoin = "round";
      ctx.globalAlpha = 0.85; // Ligeramente más opaco para mejor visibilidad

      // Añadir línea punteada para indicar que es una vista previa
      ctx.setLineDash([5, 3]);

      if (currentShape.type === "line" && currentShape.points.length >= 2) {
        ctx.beginPath();
        ctx.moveTo(currentShape.points[0].x, currentShape.points[0].y);
        ctx.lineTo(
          currentShape.points[currentShape.points.length - 1].x,
          currentShape.points[currentShape.points.length - 1].y
        );
        ctx.stroke();

        // Dibujar puntos en los extremos para mayor visibilidad
        ctx.fillStyle = currentShape.color;
        ctx.beginPath();
        ctx.arc(
          currentShape.points[0].x,
          currentShape.points[0].y,
          Math.max(3, currentShape.strokeWidth / 2 + 1),
          0,
          2 * Math.PI
        );
        ctx.fill();
        ctx.beginPath();
        ctx.arc(
          currentShape.points[currentShape.points.length - 1].x,
          currentShape.points[currentShape.points.length - 1].y,
          Math.max(3, currentShape.strokeWidth / 2 + 1),
          0,
          2 * Math.PI
        );
        ctx.fill();
      } else if (
        currentShape.type === "rectangle" &&
        currentShape.points.length >= 2
      ) {
        const start = currentShape.points[0];
        const end = currentShape.points[currentShape.points.length - 1];

        // Dibujar el rectángulo principal
        ctx.strokeRect(start.x, start.y, end.x - start.x, end.y - start.y);

        // Añadir puntos en las esquinas para mayor visibilidad
        ctx.fillStyle = currentShape.color;
        const cornerSize = Math.max(3, currentShape.strokeWidth / 2 + 1);
        ctx.fillRect(
          start.x - cornerSize / 2,
          start.y - cornerSize / 2,
          cornerSize,
          cornerSize
        );
        ctx.fillRect(
          end.x - cornerSize / 2,
          start.y - cornerSize / 2,
          cornerSize,
          cornerSize
        );
        ctx.fillRect(
          start.x - cornerSize / 2,
          end.y - cornerSize / 2,
          cornerSize,
          cornerSize
        );
        ctx.fillRect(
          end.x - cornerSize / 2,
          end.y - cornerSize / 2,
          cornerSize,
          cornerSize
        );
      } else if (
        currentShape.type === "circle" &&
        currentShape.points.length >= 2
      ) {
        const start = currentShape.points[0];
        const end = currentShape.points[currentShape.points.length - 1];
        const radius = Math.sqrt(
          Math.pow(end.x - start.x, 2) + Math.pow(end.y - start.y, 2)
        );
        ctx.beginPath();
        ctx.arc(start.x, start.y, radius, 0, 2 * Math.PI);
        ctx.stroke();

        // Dibujar punto central y punto en el perímetro para mayor visibilidad
        ctx.fillStyle = currentShape.color;
        ctx.beginPath();
        ctx.arc(
          start.x,
          start.y,
          Math.max(3, currentShape.strokeWidth / 2 + 1),
          0,
          2 * Math.PI
        );
        ctx.fill();
        ctx.beginPath();
        ctx.arc(
          end.x,
          end.y,
          Math.max(3, currentShape.strokeWidth / 2 + 1),
          0,
          2 * Math.PI
        );
        ctx.fill();
      }
      ctx.restore();
    } else {
      drawShape(ctx, currentShape, false);
    }
  };

  // Draw the shape on the canvas
  const drawShape = (
    ctx: CanvasRenderingContext2D,
    shape: Shape,
    isSelected: boolean
  ) => {
    // Validate shape before drawing
    if (!shape || !shape.points || shape.points.length === 0) {
      return;
    }

    // Validate all points have valid coordinates
    const validPoints = shape.points.filter(
      (p) =>
        p &&
        typeof p.x === "number" &&
        typeof p.y === "number" &&
        !isNaN(p.x) &&
        !isNaN(p.y) &&
        isFinite(p.x) &&
        isFinite(p.y)
    );

    if (validPoints.length === 0) {
      return;
    }

    // Set drawing properties with validation - moderately thicker lines
    ctx.strokeStyle = shape.color || "#000000";
    ctx.lineWidth = Math.max(2, Math.min(40, (shape.strokeWidth || 2) * 1.8)); // Moderately thicker lines
    ctx.lineCap = "round";
    ctx.lineJoin = "round";

    // Use valid points for drawing
    const drawingShape = { ...shape, points: validPoints };

    if (drawingShape.type === "pencil") {
      drawPencilStylized(
        ctx,
        shape.points,
        shape.color,
        shape.strokeWidth,
        Math.max(0, Math.min(1, roughness))
      );
    } else if (shape.type === "line") {
      if (shape.points.length < 2) return;

      // Create wavy line effect for hand-drawn appearance - much more segments
      const wavyPoints = createWavyLine(
        shape.points[0],
        shape.points[shape.points.length - 1],
        Math.max(3, Math.min(8, Math.floor(Math.random() * 4) + 4)) // More segments for more cartoonish effect
      );

      ctx.beginPath();
      ctx.moveTo(wavyPoints[0].x, wavyPoints[0].y);

      // Draw wavy line using quadratic curves for smoothness
      for (let i = 1; i < wavyPoints.length - 1; i++) {
        const xc = (wavyPoints[i].x + wavyPoints[i + 1].x) / 2;
        const yc = (wavyPoints[i].y + wavyPoints[i + 1].y) / 2;
        ctx.quadraticCurveTo(wavyPoints[i].x, wavyPoints[i].y, xc, yc);
      }

      // Last segment
      if (wavyPoints.length > 1) {
        ctx.lineTo(
          wavyPoints[wavyPoints.length - 1].x,
          wavyPoints[wavyPoints.length - 1].y
        );
      }

      ctx.stroke();
    } else if (shape.type === "rectangle") {
      if (shape.points.length < 2) return;
      const start = shape.points[0];
      const end = shape.points[shape.points.length - 1];

      // Create rough rectangle points
      const rectPoints = [
        start,
        { x: end.x, y: start.y },
        end,
        { x: start.x, y: end.y },
        start,
      ];

      // Add roughness to each side
      const roughRectPoints = addRoughnessToPoints(rectPoints, 2);

      ctx.beginPath();
      ctx.moveTo(roughRectPoints[0].x, roughRectPoints[0].y);
      for (let i = 1; i < roughRectPoints.length; i++) {
        ctx.lineTo(roughRectPoints[i].x, roughRectPoints[i].y);
      }
      ctx.stroke();

      // Draw second time for sketchy effect
      ctx.globalAlpha = 0.4;
      ctx.beginPath();
      ctx.moveTo(roughRectPoints[0].x + 1, roughRectPoints[0].y - 1);
      for (let i = 1; i < roughRectPoints.length; i++) {
        ctx.lineTo(roughRectPoints[i].x + 1, roughRectPoints[i].y - 1);
      }
      ctx.stroke();
      ctx.globalAlpha = 1;
    } else if (shape.type === "circle") {
      if (shape.points.length < 2) return;
      const start = shape.points[0];
      const end = shape.points[shape.points.length - 1];
      const radius = Math.sqrt(
        Math.pow(end.x - start.x, 2) + Math.pow(end.y - start.y, 2)
      );

      // Draw smooth circle using arc() method
      ctx.beginPath();
      ctx.arc(start.x, start.y, radius, 0, 2 * Math.PI);
      ctx.stroke();
    } else if (shape.type === "text" && shape.text) {
      const fontSize = Math.max(12, getFontSize(shape.strokeWidth * 8)); // Ensure minimum readable font size
      ctx.font = `${fontSize}px 'Fredoka', 'Comic Neue', 'Patrick Hand', 'Nunito', -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif`;
      ctx.fillStyle = shape.color;
      ctx.textBaseline = "alphabetic";
      ctx.textAlign = "left";
      // Ensure text is always rendered if it exists
      if (shape.text && shape.text.trim().length > 0) {
        // Double-check font is set properly
        if (
          !ctx.font.includes("Fredoka") &&
          !ctx.font.includes("Patrick Hand") &&
          !ctx.font.includes("Nunito")
        ) {
          ctx.font = `${fontSize}px 'Fredoka', 'Comic Neue', 'Patrick Hand', 'Nunito', -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif`;
        }
        ctx.fillText(shape.text, shape.points[0].x, shape.points[0].y);
      }
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
      // Ensure bounds are always in sync with current shape points (especially during dragging)
      const currentBounds = calculateBounds(shape);
      const boundsToUse = currentBounds || shape.bounds;

      if (shape.type === "text") {
        // Draw rectangular selection that completely surrounds the text
        const padding = 6;
        const selectionX = boundsToUse.minX - padding;
        const selectionY = boundsToUse.minY - padding;
        const selectionWidth =
          boundsToUse.maxX - boundsToUse.minX + padding * 2;
        const selectionHeight =
          boundsToUse.maxY - boundsToUse.minY + padding * 2;

        // Draw solid border rectangle
        ctx.strokeStyle = "#ff0000";
        ctx.lineWidth = 1;
        ctx.setLineDash([]);
        ctx.strokeRect(selectionX, selectionY, selectionWidth, selectionHeight);

        // Draw corner resize indicators (small L-shaped lines)
        const cornerSize = 8;
        const cornerLineWidth = 2;
        ctx.strokeStyle = "#3b82f6";
        ctx.lineWidth = cornerLineWidth;

        // Top-left corner (L-shape)
        ctx.beginPath();
        ctx.moveTo(selectionX - cornerSize / 2, selectionY);
        ctx.lineTo(selectionX + cornerSize / 2, selectionY);
        ctx.moveTo(selectionX, selectionY - cornerSize / 2);
        ctx.lineTo(selectionX, selectionY + cornerSize / 2);
        ctx.stroke();

        // Top-right corner (L-shape)
        ctx.beginPath();
        ctx.moveTo(selectionX + selectionWidth - cornerSize / 2, selectionY);
        ctx.lineTo(selectionX + selectionWidth + cornerSize / 2, selectionY);
        ctx.moveTo(selectionX + selectionWidth, selectionY - cornerSize / 2);
        ctx.lineTo(selectionX + selectionWidth, selectionY + cornerSize / 2);
        ctx.stroke();

        // Bottom-left corner (L-shape)
        ctx.beginPath();
        ctx.moveTo(selectionX - cornerSize / 2, selectionY + selectionHeight);
        ctx.lineTo(selectionX + cornerSize / 2, selectionY + selectionHeight);
        ctx.moveTo(selectionX, selectionY + selectionHeight - cornerSize / 2);
        ctx.lineTo(selectionX, selectionY + selectionHeight + cornerSize / 2);
        ctx.stroke();

        // Bottom-right corner (L-shape)
        ctx.beginPath();
        ctx.moveTo(
          selectionX + selectionWidth - cornerSize / 2,
          selectionY + selectionHeight
        );
        ctx.lineTo(
          selectionX + selectionWidth + cornerSize / 2,
          selectionY + selectionHeight
        );
        ctx.moveTo(
          selectionX + selectionWidth,
          selectionY + selectionHeight - cornerSize / 2
        );
        ctx.lineTo(
          selectionX + selectionWidth,
          selectionY + selectionHeight + cornerSize / 2
        );
        ctx.stroke();
      } else {
        // Draw rectangular selection for other shapes with visible dotted border
        const padding = 8;

        // Draw more visible dotted border
        ctx.strokeStyle = "#2563eb"; // Darker blue for better visibility
        ctx.lineWidth = 2;
        ctx.setLineDash([8, 4]); // More prominent dashes

        // Draw the selection rectangle
        ctx.strokeRect(
          boundsToUse.minX - padding,
          boundsToUse.minY - padding,
          boundsToUse.maxX - boundsToUse.minX + padding * 2,
          boundsToUse.maxY - boundsToUse.minY + padding * 2
        );

        // Add a second dotted line for extra visibility
        ctx.strokeStyle = "#60a5fa"; // Lighter blue
        ctx.lineWidth = 1;
        ctx.setLineDash([4, 8]);
        ctx.strokeRect(
          boundsToUse.minX - padding - 2,
          boundsToUse.minY - padding - 2,
          boundsToUse.maxX - boundsToUse.minX + padding * 2 + 4,
          boundsToUse.maxY - boundsToUse.minY + padding * 2 + 4
        );
        ctx.setLineDash([]);

        if (
          shape.type === "image" ||
          shape.type === "rectangle" ||
          shape.type === "circle"
        ) {
          const handleSize = 12;
          ctx.fillStyle = "#3b82f6";

          // Para rectángulos, dibujar handles en las esquinas exactas del rectángulo
          if (shape.type === "rectangle" && shape.points.length >= 2) {
            const start = shape.points[0];
            const end = shape.points[1];
            const minX = Math.min(start.x, end.x);
            const minY = Math.min(start.y, end.y);
            const maxX = Math.max(start.x, end.x);
            const maxY = Math.max(start.y, end.y);

            // Draw corner handles en las esquinas exactas del rectángulo
            ctx.fillRect(
              minX - handleSize / 2,
              minY - handleSize / 2,
              handleSize,
              handleSize
            );
            ctx.fillRect(
              maxX - handleSize / 2,
              minY - handleSize / 2,
              handleSize,
              handleSize
            );
            ctx.fillRect(
              minX - handleSize / 2,
              maxY - handleSize / 2,
              handleSize,
              handleSize
            );
            ctx.fillRect(
              maxX - handleSize / 2,
              maxY - handleSize / 2,
              handleSize,
              handleSize
            );
          } else if (shape.type === "circle" && shape.points.length >= 2) {
            // Para círculos, dibujar handles en las direcciones cardinales
            const center = shape.points[0];
            const edge = shape.points[1];
            const radius = Math.sqrt(
              Math.pow(edge.x - center.x, 2) + Math.pow(edge.y - center.y, 2)
            );

            // Draw handles en las esquinas del cuadro delimitador del círculo
            ctx.fillRect(
              center.x - radius - handleSize / 2,
              center.y - radius - handleSize / 2,
              handleSize,
              handleSize
            );
            ctx.fillRect(
              center.x + radius - handleSize / 2,
              center.y - radius - handleSize / 2,
              handleSize,
              handleSize
            );
            ctx.fillRect(
              center.x - radius - handleSize / 2,
              center.y + radius - handleSize / 2,
              handleSize,
              handleSize
            );
            ctx.fillRect(
              center.x + radius - handleSize / 2,
              center.y + radius - handleSize / 2,
              handleSize,
              handleSize
            );
          } else {
            // Para imágenes, usar los bounds
            ctx.fillRect(
              boundsToUse.minX - handleSize / 2,
              boundsToUse.minY - handleSize / 2,
              handleSize,
              handleSize
            );
            ctx.fillRect(
              boundsToUse.maxX - handleSize / 2,
              boundsToUse.minY - handleSize / 2,
              handleSize,
              handleSize
            );
            ctx.fillRect(
              boundsToUse.minX - handleSize / 2,
              boundsToUse.maxY - handleSize / 2,
              handleSize,
              handleSize
            );
            ctx.fillRect(
              boundsToUse.maxX - handleSize / 2,
              boundsToUse.maxY - handleSize / 2,
              handleSize,
              handleSize
            );
          }

          // Add white centers to corner handles for better visibility
          ctx.fillStyle = "#ffffff";
          const centerHandleSize = 6;

          if (shape.type === "rectangle" && shape.points.length >= 2) {
            const start = shape.points[0];
            const end = shape.points[1];
            const minX = Math.min(start.x, end.x);
            const minY = Math.min(start.y, end.y);
            const maxX = Math.max(start.x, end.x);
            const maxY = Math.max(start.y, end.y);

            ctx.fillRect(
              minX - centerHandleSize / 2,
              minY - centerHandleSize / 2,
              centerHandleSize,
              centerHandleSize
            );
            ctx.fillRect(
              maxX - centerHandleSize / 2,
              minY - centerHandleSize / 2,
              centerHandleSize,
              centerHandleSize
            );
            ctx.fillRect(
              minX - centerHandleSize / 2,
              maxY - centerHandleSize / 2,
              centerHandleSize,
              centerHandleSize
            );
            ctx.fillRect(
              maxX - centerHandleSize / 2,
              maxY - centerHandleSize / 2,
              centerHandleSize,
              centerHandleSize
            );
          } else {
            ctx.fillRect(
              boundsToUse.minX - centerHandleSize / 2,
              boundsToUse.minY - centerHandleSize / 2,
              centerHandleSize,
              centerHandleSize
            );
            ctx.fillRect(
              boundsToUse.maxX - centerHandleSize / 2,
              boundsToUse.minY - centerHandleSize / 2,
              centerHandleSize,
              centerHandleSize
            );
            ctx.fillRect(
              boundsToUse.minX - centerHandleSize / 2,
              boundsToUse.maxY - centerHandleSize / 2,
              centerHandleSize,
              centerHandleSize
            );
            ctx.fillRect(
              boundsToUse.maxX - centerHandleSize / 2,
              boundsToUse.maxY - centerHandleSize / 2,
              centerHandleSize,
              centerHandleSize
            );
          }
        } else if (shape.type === "line" && shape.points.length >= 2) {
          const handleSize = 8;
          const start = shape.points[0];
          const end = shape.points[shape.points.length - 1];

          // Draw circular handles for line endpoints (more visible)
          ctx.fillStyle = "#3b82f6";
          ctx.beginPath();
          ctx.arc(start.x, start.y, handleSize / 2, 0, 2 * Math.PI);
          ctx.fill();
          ctx.beginPath();
          ctx.arc(end.x, end.y, handleSize / 2, 0, 2 * Math.PI);
          ctx.fill();

          // Add white centers
          ctx.fillStyle = "#ffffff";
          ctx.beginPath();
          ctx.arc(start.x, start.y, handleSize / 4, 0, 2 * Math.PI);
          ctx.fill();
          ctx.beginPath();
          ctx.arc(end.x, end.y, handleSize / 4, 0, 2 * Math.PI);
          ctx.fill();
        }
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
    ctx.lineWidth = width * 1.8; // Moderately thicker pencil strokes
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
      x: p.x + (Math.random() - 0.5) * amount * 2, // Much more jitter
      y: p.y + (Math.random() - 0.5) * amount * 2,
    }));
  };

  const getMousePos = (
    e: React.MouseEvent<HTMLCanvasElement> | React.TouchEvent<HTMLCanvasElement>
  ): Point => {
    const canvas = canvasRef.current;
    if (!canvas) return { x: 0, y: 0 };
    const rect = canvas.getBoundingClientRect();
    const scale = zoom / 100;
    const offsetX = rect.width / 2;
    const offsetY = rect.height / 2;

    // Manejar tanto eventos de mouse como de touch
    let clientX, clientY;
    if ("touches" in e) {
      // Evento táctil
      const touch = e.touches[0] || { clientX: 0, clientY: 0 };
      clientX = touch.clientX;
      clientY = touch.clientY;
    } else {
      // Evento de mouse
      clientX = e.clientX;
      clientY = e.clientY;
    }

    const rawX = clientX - rect.left;
    const rawY = clientY - rect.top;

    const x = (rawX - offsetX - panOffset.x) / scale + offsetX;
    const y = (rawY - offsetY - panOffset.y) / scale + offsetY;

    return { x, y };
  };

  const handleMouseDown = (
    e: React.MouseEvent<HTMLCanvasElement> | React.TouchEvent<HTMLCanvasElement>
  ) => {
    // Get coordinates from mouse or touch event
    const clientX = "touches" in e ? e.touches[0]?.clientX : e.clientX;
    const clientY = "touches" in e ? e.touches[0]?.clientY : e.clientY;

    if (clientX === undefined || clientY === undefined) return;

    const point = getMousePos(e);

    if (tool === "hand") {
      setIsPanning(true);
      setPanStart({ x: clientX - panOffset.x, y: clientY - panOffset.y });
      return;
    }

    if (tool === "select") {
      if (selectedShapeId) {
        const selectedShape = shapes.find((s) => s.id === selectedShapeId);
        if (selectedShape) {
          const handle = getResizeHandle(point, selectedShape, "touches" in e);
          if (handle) {
            if (
              selectedShape.type === "text" &&
              (handle === "text-nw" ||
                handle === "text-ne" ||
                handle === "text-sw" ||
                handle === "text-se")
            ) {
              // Handle text resizing
              setIsResizing(true);
              setResizeHandle(handle);
              setResizeStart(point);
              setOriginalSize({
                width: selectedShape.strokeWidth * 8, // Convert to text size
                height: selectedShape.strokeWidth * 8,
              });
              // Limpiar resizeData para texto
              resizeDataRef.current = null;
              return;
            } else if (selectedShape.type === "image") {
              // Handle image resizing
              setIsResizing(true);
              setResizeHandle(handle);
              setResizeStart(point);
              setOriginalSize({
                width: selectedShape.imageWidth || 0,
                height: selectedShape.imageHeight || 0,
              });
              // Limpiar resizeData para imágenes
              resizeDataRef.current = null;
              return;
            } else if (
              (selectedShape.type === "rectangle" ||
                selectedShape.type === "circle" ||
                selectedShape.type === "line") &&
              (handle === "nw" ||
                handle === "ne" ||
                handle === "sw" ||
                handle === "se")
            ) {
              // Handle geometric shape resizing
              setIsResizing(true);
              setResizeHandle(handle);
              setResizeStart(point);

              // Store original dimensions for geometric shapes
              if (
                selectedShape.type === "rectangle" &&
                selectedShape.points.length >= 2
              ) {
                const start = selectedShape.points[0];
                const end = selectedShape.points[1];
                setOriginalSize({
                  width: Math.abs(end.x - start.x),
                  height: Math.abs(end.y - start.y),
                });
              } else if (
                selectedShape.type === "circle" &&
                selectedShape.points.length >= 2
              ) {
                const center = selectedShape.points[0];
                const edge = selectedShape.points[1];
                const radius = Math.sqrt(
                  Math.pow(edge.x - center.x, 2) +
                    Math.pow(edge.y - center.y, 2)
                );
                setOriginalSize({
                  width: radius * 2,
                  height: radius * 2,
                });
              } else if (
                selectedShape.type === "line" &&
                selectedShape.points.length >= 2
              ) {
                const start = selectedShape.points[0];
                const end = selectedShape.points[1];
                setOriginalSize({
                  width: Math.abs(end.x - start.x),
                  height: Math.abs(end.y - start.y),
                });
              }
              // Limpiar resizeData para formas geométricas (se inicializará en el primer movimiento)
              resizeDataRef.current = null;
              return;
            }
          }
        }
      }

      const clickedShape = [...shapes]
        .reverse()
        .find((shape) => isPointInShape(point, shape, "touches" in e));
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

      // Detectar si es dispositivo móvil y prevenir el redimensionamiento del canvas
      const isTouchEvent = "touches" in e;
      if (isTouchEvent && (window as any).setEditingTextMobile) {
        (window as any).setEditingTextMobile(true);
      }

      // Check if clicking on existing text to edit it
      const clickedShape = [...shapes]
        .reverse()
        .find(
          (shape) =>
            shape.type === "text" && isPointInShape(point, shape, isTouchEvent)
        );

      if (clickedShape && clickedShape.text) {
        // Edit existing text
        setIsEditingText(true);
        setTextPosition(clickedShape.points[0]);
        setTextValue(clickedShape.text);
        // Set text size from existing text
        if (clickedShape.strokeWidth) {
          setTextSize(clickedShape.strokeWidth * 8);
        }
      } else {
        // Create new text
        setIsEditingText(true);
        setTextPosition(point);
        setTextValue("");
      }

      // Calculate screen position directly from event for accurate placement
      const canvas = canvasRef.current;
      if (canvas) {
        const rect = canvas.getBoundingClientRect();
        // Get screen coordinates directly from mouse/touch event
        // These are relative to the canvas container
        let screenX = clientX - rect.left;
        let screenY = clientY - rect.top;

        // On mobile, adjust for visual viewport offset to prevent text from going off-screen
        if (isTouchEvent && typeof window !== "undefined") {
          // Account for visual viewport changes (virtual keyboard, zoom, etc.)
          const visualViewport = (window as any).visualViewport;
          if (visualViewport) {
            // Adjust for visual viewport offset
            screenY += visualViewport.offsetTop - window.scrollY;
          }

          // Ensure the text editor stays within reasonable bounds on mobile
          const mobilePadding = 20;
          const maxEditorHeight = Math.min(200, window.innerHeight * 0.3);

          // Adjust Y position if too close to bottom of screen
          if (screenY > window.innerHeight - maxEditorHeight - mobilePadding) {
            screenY = Math.max(mobilePadding, window.innerHeight - maxEditorHeight - mobilePadding);
          }

          // Adjust X position if outside viewport
          if (screenX > window.innerWidth - 120) {
            screenX = Math.max(mobilePadding, window.innerWidth - 120);
          }
        }

        setScreenTextPosition({ x: screenX, y: screenY });

        // Focus the input after state updates
        // Use a longer timeout for mobile devices
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

                // On mobile, position cursor at end for existing text, start for new
                if (isTouchEvent && textEditor.ref.current.setSelectionRange) {
                  setTimeout(() => {
                    if (textEditor.ref.current) {
                      const position = clickedShape?.text
                        ? textEditor.ref.current.value.length
                        : 0;
                      textEditor.ref.current.setSelectionRange(
                        position,
                        position
                      );
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
        return !isPointInShapeForEraser(point, shape, "touches" in e);
      });
      if (newShapes.length !== shapes.length) {
        const deletedShapes = shapes.filter(
          (shape) => !newShapes.includes(shape)
        );
        const deleteCommand = createDeleteShapesCommand(
          deletedShapes,
          addShape,
          removeShape
        );
        saveToHistory(deleteCommand);
        deleteCommand.execute();
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

  const handleMouseMove = (
    e: React.MouseEvent<HTMLCanvasElement> | React.TouchEvent<HTMLCanvasElement>
  ) => {
    if (isPanning && tool === "hand") {
      const clientX = "touches" in e ? e.touches[0]?.clientX : e.clientX;
      const clientY = "touches" in e ? e.touches[0]?.clientY : e.clientY;
      if (clientX !== undefined && clientY !== undefined) {
        setPanOffset({
          x: clientX - panStart.x,
          y: clientY - panStart.y,
        });
      }
      return;
    }

    // Detectar dispositivo táctil para throttling
    if ("touches" in e) {
      isTouchDeviceRef.current = true;
    }

    // Throttling para dispositivos móviles (limitar actualizaciones a ~60fps)
    if (isTouchDeviceRef.current && "touches" in e) {
      const now = Date.now();
      if (now - lastUpdateTimeRef.current < 16) {
        // ~60fps
        return;
      }
      lastUpdateTimeRef.current = now;
    }

    const point = getMousePos(e);

    // Update cursor based on what we're hovering over
    if (tool === "select" && selectedShapeId) {
      const selectedShape = shapes.find((s) => s.id === selectedShapeId);
      if (selectedShape) {
        const handle = getResizeHandle(
          point,
          selectedShape,
          isTouchDeviceRef.current
        );
        if (handle) {
          if (handle === "text-nw" || handle === "text-se") {
            setCursorStyle("cursor-nwse-resize");
          } else if (handle === "text-ne" || handle === "text-sw") {
            setCursorStyle("cursor-nesw-resize");
          } else {
            setCursorStyle("cursor-nwse-resize");
          }
        } else {
          setCursorStyle("cursor-move");
        }
      } else {
        setCursorStyle("cursor-default");
      }
    } else {
      setCursorStyle("cursor-default");
    }

    if (isResizing && selectedShapeId && resizeHandle) {
      const shape = shapes.find((s) => s.id === selectedShapeId);
      if (shape) {
        if (
          shape.type === "text" &&
          (resizeHandle === "text-nw" ||
            resizeHandle === "text-ne" ||
            resizeHandle === "text-sw" ||
            resizeHandle === "text-se")
        ) {
          // Handle text resizing from any corner - use original size as base
          const deltaX = point.x - resizeStart.x;
          const deltaY = point.y - resizeStart.y;

          // Calculate distance from start point
          const distance = Math.sqrt(deltaX * deltaX + deltaY * deltaY);

          // Determine if we should increase or decrease based on which handle
          const isIncreasing =
            (resizeHandle === "text-se" && (deltaX > 0 || deltaY > 0)) ||
            (resizeHandle === "text-sw" && (deltaX < 0 || deltaY > 0)) ||
            (resizeHandle === "text-ne" && (deltaX > 0 || deltaY < 0)) ||
            (resizeHandle === "text-nw" && (deltaX < 0 || deltaY < 0));

          // Use original size as base, not the current potentially modified size
          const baseTextSize = originalSize.width; // originalSize.width stores the original text size
          const sizeChange = Math.round(distance / 3); // Make resizing more gradual
          const newTextSize = isIncreasing
            ? baseTextSize + sizeChange
            : baseTextSize - sizeChange;

          // Clamp text size between 12px and 72px
          const clampedTextSize = Math.max(12, Math.min(72, newTextSize));

          // Always update the dragged shape during resizing for smooth feedback
          const updatedShape = {
            ...shape,
            strokeWidth: clampedTextSize / 8, // Convert back to strokeWidth format
          };
          updatedShape.bounds = calculateBounds(
            updatedShape
          ) as Shape["bounds"];
          setDraggedShape(updatedShape);
        } else if (shape.type === "image") {
          // Handle image resizing - CORREGIDO
          const imageX = shape.points[0].x;
          const imageY = shape.points[0].y;
          const currentWidth = shape.imageWidth || originalSize.width;
          const currentHeight = shape.imageHeight || originalSize.height;

          const aspectRatio = originalSize.width / originalSize.height;

          // Sensibilidad reducida para imágenes
          const sensitivityFactor = 0.7;

          let newWidth = currentWidth;
          let newHeight = currentHeight;
          let newX = imageX;
          let newY = imageY;

          // Redimensionar según el handle con lógica correcta
          switch (resizeHandle) {
            case "se": // Esquina inferior derecha - aumentar ancho y alto
              const deltaSE = Math.max(
                (point.x - resizeStart.x) * sensitivityFactor,
                (point.y - resizeStart.y) * sensitivityFactor
              );
              newWidth = originalSize.width + deltaSE;
              newHeight = newWidth / aspectRatio;
              break;

            case "nw": // Esquina superior izquierda - mover origen y cambiar tamaño
              const deltaNW = Math.min(
                (point.x - resizeStart.x) * sensitivityFactor,
                (point.y - resizeStart.y) * sensitivityFactor
              );
              newWidth = originalSize.width - deltaNW;
              newHeight = newWidth / aspectRatio;
              newX = imageX + deltaNW;
              newY = imageY + deltaNW;
              break;

            case "ne": // Esquina superior derecha - mover origen Y y cambiar tamaño
              const deltaX_NE = (point.x - resizeStart.x) * sensitivityFactor;
              const deltaY_NE = (point.y - resizeStart.y) * sensitivityFactor;
              newWidth = originalSize.width + deltaX_NE;
              newHeight = newWidth / aspectRatio;
              newY = imageY + deltaY_NE;
              break;

            case "sw": // Esquina inferior izquierda - mover origen X y cambiar tamaño
              const deltaX_SW = (point.x - resizeStart.x) * sensitivityFactor;
              const deltaY_SW = (point.y - resizeStart.y) * sensitivityFactor;
              newWidth = originalSize.width - deltaX_SW;
              newHeight = newWidth / aspectRatio;
              newX = imageX + deltaX_SW;
              break;
          }

          // Asegurar dimensiones mínimas
          const minSize = 30;
          if (newWidth < minSize) {
            newWidth = minSize;
            newHeight = newWidth / aspectRatio;
          }

          if (newWidth > minSize && newHeight > minSize) {
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
        } else if (shape.type === "rectangle" && shape.points.length >= 2) {
          // Handle rectangle resizing - CORREGIDO
          const start = shape.points[0];
          const end = shape.points[shape.points.length - 1];

          // Calcular las esquinas reales del rectángulo (ordenado)
          const minX = Math.min(start.x, end.x);
          const minY = Math.min(start.y, end.y);
          const maxX = Math.max(start.x, end.x);
          const maxY = Math.max(start.y, end.y);

          // Inicializar resizeData si es necesario
          if (!resizeDataRef.current) {
            resizeDataRef.current = {
              originalStart: { x: minX, y: minY },
              originalEnd: { x: maxX, y: maxY },
              aspectRatio: (maxX - minX) / Math.max(1, maxY - minY),
            };
          }

          const originalData = resizeDataRef.current;

          // Sensibilidad reducida para movimientos más suaves
          const sensitivityFactor = 0.8;

          let newMinX = minX;
          let newMinY = minY;
          let newMaxX = maxX;
          let newMaxY = maxY;

          // Redimensionar según el handle con lógica correcta
          switch (resizeHandle) {
            case "se": // Esquina inferior derecha - mover maxX, maxY
              newMaxX =
                originalData.originalEnd.x +
                (point.x - resizeStart.x) * sensitivityFactor;
              newMaxY =
                originalData.originalEnd.y +
                (point.y - resizeStart.y) * sensitivityFactor;
              break;

            case "nw": // Esquina superior izquierda - mover minX, minY
              newMinX =
                originalData.originalStart.x +
                (point.x - resizeStart.x) * sensitivityFactor;
              newMinY =
                originalData.originalStart.y +
                (point.y - resizeStart.y) * sensitivityFactor;
              break;

            case "ne": // Esquina superior derecha - mover maxX, minY
              newMaxX =
                originalData.originalEnd.x +
                (point.x - resizeStart.x) * sensitivityFactor;
              newMinY =
                originalData.originalStart.y +
                (point.y - resizeStart.y) * sensitivityFactor;
              break;

            case "sw": // Esquina inferior izquierda - mover minX, maxY
              newMinX =
                originalData.originalStart.x +
                (point.x - resizeStart.x) * sensitivityFactor;
              newMaxY =
                originalData.originalEnd.y +
                (point.y - resizeStart.y) * sensitivityFactor;
              break;
          }

          // Asegurar dimensiones mínimas y que las coordenadas estén en orden correcto
          const minSize = 20;
          if (Math.abs(newMaxX - newMinX) < minSize) {
            if (resizeHandle === "nw" || resizeHandle === "sw") {
              newMinX = newMaxX - minSize;
            } else {
              newMaxX = newMinX + minSize;
            }
          }
          if (Math.abs(newMaxY - newMinY) < minSize) {
            if (resizeHandle === "nw" || resizeHandle === "ne") {
              newMinY = newMaxY - minSize;
            } else {
              newMaxY = newMinY + minSize;
            }
          }

          // Crear nuevos puntos manteniendo la estructura original
          let newStart, newEnd;
          if (start.x <= end.x) {
            newStart = { x: newMinX, y: start.y <= end.y ? newMinY : newMaxY };
            newEnd = { x: newMaxX, y: start.y <= end.y ? newMaxY : newMinY };
          } else {
            newStart = { x: newMaxX, y: start.y <= end.y ? newMinY : newMaxY };
            newEnd = { x: newMinX, y: start.y <= end.y ? newMaxY : newMinY };
          }

          const updatedShape = {
            ...shape,
            points: [newStart, newEnd],
          };
          updatedShape.bounds = calculateBounds(
            updatedShape
          ) as Shape["bounds"];
          setDraggedShape(updatedShape);
        } else if (shape.type === "circle" && shape.points.length >= 2) {
          // Handle circle resizing - CORREGIDO
          const center = shape.points[0];
          const edge = shape.points[shape.points.length - 1];

          // Calcular el radio original
          const originalRadius = Math.sqrt(
            Math.pow(edge.x - center.x, 2) + Math.pow(edge.y - center.y, 2)
          );

          // Inicializar resizeData si es necesario para círculos
          if (!resizeDataRef.current) {
            resizeDataRef.current = {
              originalStart: center,
              originalEnd: edge,
              aspectRatio: 1, // Los círculos tienen aspect ratio 1:1
            };
          }

          // Sensibilidad reducida para círculos
          const sensitivityFactor = 0.6;

          // Calcular la distancia desde el centro hasta el punto actual
          const currentDistance = Math.sqrt(
            Math.pow(point.x - center.x, 2) + Math.pow(point.y - center.y, 2)
          );

          // Calcular el cambio en el radio
          const radiusChange =
            (currentDistance -
              Math.sqrt(
                Math.pow(resizeStart.x - center.x, 2) +
                  Math.pow(resizeStart.y - center.y, 2)
              )) *
            sensitivityFactor;

          // Aplicar el cambio al radio original
          let newRadius = originalRadius + radiusChange;

          // Asegurar radio mínimo
          newRadius = Math.max(15, newRadius);

          // Calcular el ángulo original para mantener la orientación
          const originalAngle = Math.atan2(
            edge.y - center.y,
            edge.x - center.x
          );

          // Calcular nuevo punto en el perímetro
          const newEdge = {
            x: center.x + Math.cos(originalAngle) * newRadius,
            y: center.y + Math.sin(originalAngle) * newRadius,
          };

          const updatedShape = {
            ...shape,
            points: [center, newEdge],
          };
          updatedShape.bounds = calculateBounds(
            updatedShape
          ) as Shape["bounds"];
          setDraggedShape(updatedShape);
        } else if (shape.type === "line" && shape.points.length >= 2) {
          // Handle line resizing from endpoints - CORREGIDO
          const start = shape.points[0];
          const end = shape.points[shape.points.length - 1];

          // Sensibilidad reducida para líneas
          const sensitivityFactor = 0.9;

          let newStart = { ...start };
          let newEnd = { ...end };

          if (resizeHandle === "nw") {
            // Redimensionar desde el punto de inicio
            newStart = {
              x: start.x + (point.x - resizeStart.x) * sensitivityFactor,
              y: start.y + (point.y - resizeStart.y) * sensitivityFactor,
            };
          } else if (resizeHandle === "se") {
            // Redimensionar desde el punto final
            newEnd = {
              x: end.x + (point.x - resizeStart.x) * sensitivityFactor,
              y: end.y + (point.y - resizeStart.y) * sensitivityFactor,
            };
          }

          const updatedShape = {
            ...shape,
            points: [newStart, newEnd],
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
        return !isPointInShapeForEraser(point, shape, isTouchDeviceRef.current);
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

    // Mejora: Solo actualizar el currentShape si estamos dibujando y hay un cambio significativo
    if (!isDrawing || !currentShape) return;

    if (tool === "pencil") {
      setCurrentShape({
        ...currentShape,
        points: [...currentShape.points, point],
      });
      requestPreviewRender(); // Preview solo
    } else if (tool === "rectangle" || tool === "line" || tool === "circle") {
      // Para formas geométricas, actualizar más eficientemente
      const startPoint = currentShape.points[0];
      // Solo actualizar si el punto realmente cambió significativamente
      if (
        Math.abs(point.x - startPoint.x) > 1 ||
        Math.abs(point.y - startPoint.y) > 1
      ) {
        setCurrentShape({
          ...currentShape,
          points: [startPoint, point],
        });
        requestPreviewRender(); // Usar preview render para consistencia
      }
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
      const originalShape = shapes.find((s) => s.id === selectedShapeId);
      if (originalShape) {
        // Check if it's text resizing
        if (originalShape.type === "text" && draggedShape.type === "text") {
          // For text, we need to update the strokeWidth (font size) property
          const modifyCommand = createModifyShapeCommand(
            selectedShapeId,
            originalShape,
            draggedShape,
            updateShapeFully
          );
          saveToHistory(modifyCommand);
          modifyCommand.execute();
        } else {
          // For images and other shapes, use move command
          const moveCommand = createMoveShapeCommand(
            selectedShapeId,
            originalShape.points,
            draggedShape.points,
            originalShape.imageWidth,
            originalShape.imageHeight,
            draggedShape.imageWidth,
            draggedShape.imageHeight,
            updateShape
          );
          saveToHistory(moveCommand);
          moveCommand.execute();
        }
      }
      setDraggedShape(null);
      setIsResizing(false);
      setResizeHandle(null);
      // Limpiar resizeData al completar el redimensionado
      resizeDataRef.current = null;
      return;
    }

    if (isDragging && selectedShapeId && draggedShape) {
      const originalShape = shapes.find((s) => s.id === selectedShapeId);
      if (originalShape) {
        const moveCommand = createMoveShapeCommand(
          selectedShapeId,
          shapeStartPoints,
          draggedShape.points,
          originalShape.imageWidth,
          originalShape.imageHeight,
          draggedShape.imageWidth,
          draggedShape.imageHeight,
          updateShape
        );
        saveToHistory(moveCommand);
        moveCommand.execute();
      }
      setDraggedShape(null);
      setShapeStartPoints([]);
    }

    if (currentShape && isDrawing) {
      // Additional validation before committing the shape
      if (currentShape.points && currentShape.points.length > 0) {
        const validPoints = currentShape.points.filter(
          (p) =>
            p &&
            typeof p.x === "number" &&
            typeof p.y === "number" &&
            !isNaN(p.x) &&
            !isNaN(p.y)
        );

        if (validPoints.length > 0) {
          const shapeWithBounds = {
            ...currentShape,
            points: validPoints,
            bounds: calculateBounds({ ...currentShape, points: validPoints }),
          };

          const addCommand = createAddShapeCommand(
            shapeWithBounds as Shape,
            addShape,
            removeShape
          );
          saveToHistory(addCommand);
          addCommand.execute();
        } else {
          console.warn("Current shape has no valid points, not adding");
        }
      }
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

      // Check if we're editing existing text
      const existingTextShape = shapes.find(
        (shape) =>
          shape.type === "text" &&
          shape.points[0].x === textPosition.x &&
          shape.points[0].y === textPosition.y
      );

      // Calculate bounds with proper text measurement
      let bounds = {
        minX: textPosition.x,
        minY: textPosition.y - textSize,
        maxX: textPosition.x + textValue.length * textSize * 0.6,
        maxY: textPosition.y,
      };

      if (canvas) {
        const ctx = canvas.getContext("2d");
        if (ctx) {
          const fontSize = getFontSize(textSize);
          ctx.font = `${fontSize}px 'Fredoka', 'Comic Neue', 'Patrick Hand', 'Nunito', -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif`;
          const metrics = ctx.measureText(textValue);
          const textHeight = fontSize;
          const padding = 10; // Consistent padding with other text calculations
          bounds = {
            minX: textPosition.x - padding,
            minY: textPosition.y - textHeight - padding,
            maxX: textPosition.x + Math.max(metrics.width, 50) + padding, // Ensure minimum width
            maxY: textPosition.y + padding,
          };
        }
      }

      if (existingTextShape) {
        // Update existing text shape
        const updatedShape: Shape = {
          ...existingTextShape,
          text: textValue,
          strokeWidth: textSize / 8, // Convert back to strokeWidth format
          bounds,
        };

        const modifyCommand = createModifyShapeCommand(
          existingTextShape.id,
          existingTextShape,
          updatedShape,
          updateShapeFully
        );
        saveToHistory(modifyCommand);
        modifyCommand.execute();
      } else {
        // Create new text shape
        const newShape: Shape = {
          id: Date.now().toString(),
          type: "text",
          points: [textPosition],
          color,
          strokeWidth: textSize / 8, // Convert textSize to strokeWidth format
          text: textValue,
          bounds,
        };
        const addCommand = createAddShapeCommand(
          newShape,
          addShape,
          removeShape
        );
        saveToHistory(addCommand);
        addCommand.execute();
      }
    }
    setIsEditingText(false);
    setTextValue("");

    // Restaurar el redimensionamiento normal del canvas cuando se termina de editar texto
    if ((window as any).setEditingTextMobile) {
      (window as any).setEditingTextMobile(false);
    }

    // Forzar un repintado suave después de terminar la edición de texto en móvil
    if (isTouchDeviceRef.current) {
      setTimeout(() => {
        requestRender();
      }, 100);
    }
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
    setZoom(Math.min(zoom + 10, 400));
    requestRender();
  };
  // Zoom out the canvas
  const handleZoomOut = () => {
    setZoom(Math.max(zoom - 10, 50));
    requestRender();
  };

  /**
   * Calcula la distancia euclidiana entre dos puntos táctiles
   * @param touch1 Primer toque
   * @param touch2 Segundo toque
   * @returns Distancia en píxeles
   */
  const getTouchDistance = (
    touch1: React.Touch,
    touch2: React.Touch
  ): number => {
    const dx = touch1.clientX - touch2.clientX;
    const dy = touch1.clientY - touch2.clientY;
    return Math.sqrt(dx * dx + dy * dy);
  };

  /**
   * Calcula el punto medio entre dos toques
   * @param touch1 Primer toque
   * @param touch2 Segundo toque
   * @returns Coordenadas del punto medio
   */
  const getTouchCenter = (
    touch1: React.Touch,
    touch2: React.Touch
  ): { x: number; y: number } => {
    return {
      x: (touch1.clientX + touch2.clientX) / 2,
      y: (touch1.clientY + touch2.clientY) / 2,
    };
  };

  /**
   * Restringe un valor entre un mínimo y un máximo (clamp function)
   * @param value Valor a restringir
   * @param min Valor mínimo
   * @param max Valor máximo
   * @returns Valor restringido
   */
  const clamp = (value: number, min: number, max: number): number => {
    return Math.min(Math.max(value, min), max);
  };

  /**
   * Inicia el gesto de pinch-to-zoom
   * @param touch1 Primer dedo
   * @param touch2 Segundo dedo
   */
  const startPinchZoom = (touch1: React.Touch, touch2: React.Touch) => {
    const distance = getTouchDistance(touch1, touch2);
    const center = getTouchCenter(touch1, touch2);

    // Guardar estado inicial del gesto
    setInitialTouchDistance(distance);
    setLastTouchDistance(distance);
    setPinchCenter(center);
    setInitialScale(zoom / 100); // Convertir zoom de porcentaje a escala decimal
    setIsPinching(true);
  };

  /**
   * Aplica el zoom de forma suave usando requestAnimationFrame
   * @param touch1 Primer dedo
   * @param touch2 Segundo dedo
   */
  const applySmoothPinchZoom = (touch1: React.Touch, touch2: React.Touch) => {
    // Cancelar animación anterior si existe
    if (pinchAnimationRef.current) {
      cancelAnimationFrame(pinchAnimationRef.current);
    }

    const animate = () => {
      const currentDistance = getTouchDistance(touch1, touch2);
      const center = getTouchCenter(touch1, touch2);

      // Calcular factor de zoom basado en la distancia inicial vs actual
      const zoomFactor = currentDistance / initialTouchDistance;

      // Aplicar factor de zoom a la escala inicial y restringir entre límites
      const newScale = clamp(initialScale * zoomFactor, 0.5, 4.0);
      const newZoom = newScale * 100; // Convertir de escala decimal a porcentaje

      // Actualizar último distancia para siguiente frame
      setLastTouchDistance(currentDistance);
      setPinchCenter(center);

      // Calcular ajuste de pan para mantener el zoom centrado
      updatePanForZoom(center, newZoom);

      // Aplicar nuevo zoom
      setZoom(newZoom);

      // Continuar animación si sigue en modo pinch
      if (isPinching) {
        requestRender();
      }
    };

    // Ejecutar animación
    pinchAnimationRef.current = requestAnimationFrame(animate);
  };

  /**
   * Actualiza el pan (desplazamiento) para mantener el zoom centrado en el punto especificado
   * @param zoomCenter Punto central del zoom en coordenadas de pantalla
   * @param newZoom Nuevo nivel de zoom en porcentaje
   */
  const updatePanForZoom = (
    zoomCenter: { x: number; y: number },
    newZoom: number
  ) => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    const rect = canvas.getBoundingClientRect();

    // Calcular offsets del viewport
    const viewportOffsetX = viewportSizeRef.current.width / 2;
    const viewportOffsetY = viewportSizeRef.current.height / 2;

    // Convertir coordenadas de pantalla a coordenadas del canvas antes del zoom
    const currentScale = zoom / 100;
    const newScale = newZoom / 100;

    // Punto en coordenadas del canvas antes del zoom
    const canvasPointX =
      (zoomCenter.x - rect.left - panOffset.x) / currentScale - viewportOffsetX;
    const canvasPointY =
      (zoomCenter.y - rect.top - panOffset.y) / currentScale - viewportOffsetY;

    // Calcular nueva posición de pan para mantener el punto fijo durante el zoom
    const newPanX =
      zoomCenter.x - rect.left - (canvasPointX + viewportOffsetX) * newScale;
    const newPanY =
      zoomCenter.y - rect.top - (canvasPointY + viewportOffsetY) * newScale;

    setPanOffset({ x: newPanX, y: newPanY });
  };

  /**
   * Maneja el gesto de pinch-to-zoom durante el movimiento
   * @param touch1 Primer dedo
   * @param touch2 Segundo dedo
   */
  const handlePinchZoom = (touch1: React.Touch, touch2: React.Touch) => {
    if (!isPinching) return;

    const currentDistance = getTouchDistance(touch1, touch2);
    const center = getTouchCenter(touch1, touch2);

    // Aplicar zoom de forma suave
    applySmoothPinchZoom(touch1, touch2);
  };

  /**
   * Finaliza el gesto de pinch-to-zoom
   */
  const endPinchZoom = () => {
    setIsPinching(false);

    // Cancelar cualquier animación pendiente
    if (pinchAnimationRef.current) {
      cancelAnimationFrame(pinchAnimationRef.current);
      pinchAnimationRef.current = undefined;
    }

    // Resetear estados
    setInitialTouchDistance(0);
    setLastTouchDistance(0);
    setInitialScale(1);
  };

  // Undo the last action
  const handleUndo = () => {
    if (commandIndex >= 0) {
      const commandToUndo = commands[commandIndex];
      commandToUndo.undo();
      setCommandIndex(commandIndex - 1);
      setSelectedShapeId(null);
    }
  };

  // Redo the last action
  const handleRedo = () => {
    if (commandIndex < commands.length - 1) {
      const commandToRedo = commands[commandIndex + 1];
      commandToRedo.execute();
      setCommandIndex(commandIndex + 1);
      setSelectedShapeId(null);
    }
  };

  // Clear the canvas
  const handleClear = () => {
    // Save the current state to history
    if (shapes.length > 0) {
      const deleteCommand = createDeleteShapesCommand(
        shapes,
        addShape,
        removeShape
      );
      saveToHistory(deleteCommand);
      deleteCommand.execute();
    }
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

        const addCommand = createAddShapeCommand(
          newShape,
          addShape,
          removeShape
        );
        saveToHistory(addCommand);
        addCommand.execute();
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
    <div className="fixed inset-0 flex flex-col mb-4 bg-transparent overflow-hidden">
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
              disabled={commandIndex < 0}
              title="Deshacer"
            >
              <RotateCcw className="h-4 w-4" />
            </Button>
            <Button
              variant="ghost"
              size="icon"
              className="h-8 w-8 text-slate-600 hover:text-slate-900 dark:text-slate-400 dark:hover:text-slate-100"
              onClick={handleRedo}
              disabled={commandIndex >= commands.length - 1}
              title="Rehacer"
            >
              <RotateCw className="h-4 w-4" />
            </Button>
          </div>

          {/* Center section - App Name (sin bloque) */}
          <div className="flex flex-1 items-center justify-center">
            <span className="text-sm font-medium text-slate-900 dark:text-slate-100"></span>
          </div>

          {/* Right section - Actions con nombre de proyecto */}
          <div className="flex h-full items-center gap-2 border-l px-2 md:rounded-lg md:border md:border-slate-200 md:px-3 dark:md:border-slate-800">
            {/* Project Title - Visible en todos los dispositivos */}
            <div className="flex items-center gap-2">
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
                  className="border-b border-slate-900 bg-transparent px-1.5 text-xs sm:px-2 sm:text-sm text-slate-900 outline-none dark:border-slate-100 dark:text-slate-100 w-20 sm:w-auto md:w-auto"
                  style={{
                    width: `${Math.max(projectTitle.length * 6, 80)}px`,
                  }}
                  placeholder="Proyecto..."
                />
              ) : (
                <button
                  className="flex items-center gap-1 sm:gap-1.5 text-xs sm:text-sm text-slate-500 hover:text-slate-900 dark:text-slate-500 dark:hover:text-slate-100 truncate max-w-[100px] sm:max-w-none"
                  onClick={handleTitleClick}
                  title="Click para editar el nombre del proyecto"
                >
                  <svg
                    className="h-3 w-3 sm:h-3.5 sm:w-3.5 flex-shrink-0"
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
                  <span className="hidden sm:inline">{projectTitle}</span>
                  <span className="sm:hidden truncate">{projectTitle}</span>
                </button>
              )}
              <div className="hidden h-6 w-px bg-slate-200 dark:bg-slate-800 sm:block" />
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
              isPinching
                ? "cursor-zoom-in"
                : tool === "hand"
                ? isPanning
                  ? "cursor-grabbing"
                  : "cursor-grab"
                : tool === "select"
                ? cursorStyle
                : "cursor-crosshair"
            )}
            onMouseDown={handleMouseDown}
            onMouseMove={handleMouseMove}
            onMouseUp={handleMouseUp}
            onMouseLeave={handleMouseUp}
            // Event handlers táctiles mejorados para móvil con pinch-to-zoom suave
            onTouchStart={(e) => {
              e.preventDefault();

              // Detectar gesto de pinch (exactamente dos dedos)
              if (e.touches.length === 2) {
                const touch1 = e.touches[0];
                const touch2 = e.touches[1];
                startPinchZoom(touch1, touch2);
                return;
              }

              // Si no es pinch, manejar como toque normal para dibujar
              if (e.touches.length === 1 && !isPinching) {
                handleMouseDown(e);
              }
            }}
            onTouchMove={(e) => {
              e.preventDefault();

              // Manejar gesto de pinch con animación suave
              if (e.touches.length === 2 && isPinching) {
                const touch1 = e.touches[0];
                const touch2 = e.touches[1];
                handlePinchZoom(touch1, touch2);
                return;
              }

              // Si no es pinch, manejar como toque normal para dibujar
              if (e.touches.length === 1 && !isPinching) {
                const touch = e.touches[0];
                if (touch) {
                  handleMouseMove({
                    ...e,
                    clientX: touch.clientX,
                    clientY: touch.clientY,
                  } as unknown as React.MouseEvent<HTMLCanvasElement>);
                }
              }
            }}
            onTouchEnd={(e) => {
              e.preventDefault();

              // Finalizar gesto de pinch si quedan menos de 2 dedos
              if (e.touches.length < 2 && isPinching) {
                endPinchZoom();
              }

              // Manejar fin de dibujo si no está en modo pinch
              if (!isPinching && e.touches.length === 0) {
                handleMouseUp();
              }
            }}
          />

          {/* Preview canvas (current transient stroke) */}
          <canvas
            ref={previewCanvasRef}
            className="pointer-events-none absolute inset-0 h-full w-full z-10"
          />

          <input
            ref={imageInputRef}
            type="file"
            accept="image/*"
            onChange={handleImageUpload}
            className="hidden"
          />

          {/* Welcome Message */}
          {showWelcome && shapes.length === 0 && (
            <div className="absolute inset-0 flex items-center justify-center pointer-events-none z-20">
              <div className="text-center px-12 py-20 max-w-2xl mx-4">
                {/* Sample curved line - inspired by the image */}
                <div className="ml-14 sm:ml-0 mb-24 flex justify-center">
                  <svg
                    width="400"
                    height="120"
                    viewBox="0 0 200 80"
                    className="opacity-40 sm:w-[80rem] sm:h-[96rem]"
                  >
                    <path
                      d="M 20 40 Q 60 10, 100 40 T 180 40"
                      stroke="#1e293b"
                      strokeWidth="2"
                      fill="none"
                      strokeLinecap="round"
                    />
                  </svg>
                </div>

                {/* Main title - very minimal */}
                <div
                  className="text-sm font-light text-gray-800 tracking-wide mb-8"
                  style={{ fontFamily: "system-ui, -apple-system, sans-serif" }}
                ></div>

                {/* Subtle hint */}
                <div className="text-xs text-gray-500 font-light opacity-50 tracking-wider"></div>
              </div>
            </div>
          )}

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
                  // Restaurar el redimensionamiento normal del canvas al cancelar
                  if ((window as any).setEditingTextMobile) {
                    (window as any).setEditingTextMobile(false);
                  }

                  // Forzar un repintado suave después de cancelar en móvil
                  if (isTouchDeviceRef.current) {
                    setTimeout(() => {
                      requestRender();
                    }, 100);
                  }
                }
              }}
              placeholder="Escribe texto..."
              style={textEditor.style}
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
                tool === "line" &&
                  "bg-blue-100 text-blue-600 hover:bg-blue-100 dark:bg-blue-950 dark:text-blue-400"
              )}
              onClick={() => setTool("line")}
              title="Línea"
            >
              <Minus className="h-4 w-4 sm:h-5 sm:w-5" />
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
                tool === "line" &&
                  "bg-blue-100 text-blue-600 hover:bg-blue-100 dark:bg-blue-950 dark:text-blue-400"
              )}
              onClick={() => setTool("line")}
              title="Línea"
            >
              <Minus className="h-4 w-4 sm:h-5 sm:w-5" />
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

          {/* Text size control - only show when text tool is selected */}
          {tool === "text" ? (
            <div className="flex items-center gap-0.5 sm:gap-1">
              <span className="text-xs font-medium text-black sm:text-sm">
                Tamaño:
              </span>
              <Button
                variant="ghost"
                size="icon"
                className="h-7 w-7 sm:h-8 sm:w-8"
                onClick={() => setTextSize(Math.max(12, textSize - 2))}
                title="Reducir texto"
              >
                <Minus className="h-3 w-3" />
              </Button>
              <span className="min-w-[24px] text-center text-xs font-medium text-black sm:min-w-[24px] sm:text-sm">
                {textSize}
              </span>
              <Button
                variant="ghost"
                size="icon"
                className="h-7 w-7 sm:h-8 sm:w-8"
                onClick={() => setTextSize(Math.min(72, textSize + 2))}
                title="Aumentar texto"
              >
                <Plus className="h-3 w-3" />
              </Button>
            </div>
          ) : (
            <div className="flex items-center gap-0.5 sm:gap-1">
              <span className="text-xs font-medium text-slate-500 dark:text-slate-400 sm:text-sm">
                Grosor:
              </span>
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
          )}
        </div>

        {/* History controls - Mobile bottom */}
        <div className="absolute top-17 right-4 flex items-center gap-1 rounded-lg border bg-white p-1.5 shadow-lg dark:bg-card sm:top-24 sm:right-6 ">
          <Button
            variant="ghost"
            size="icon"
            className="h-7 w-7 sm:h-8 sm:w-8"
            onClick={handleUndo}
            disabled={commandIndex < 0}
            title="Deshacer"
          >
            <RotateCcw className="h-3.5 w-3.5 sm:h-4 sm:w-4" />
          </Button>
          <Button
            variant="ghost"
            size="icon"
            className="h-7 w-7 sm:h-8 sm:w-8"
            onClick={handleRedo}
            disabled={commandIndex >= commands.length - 1}
            title="Rehacer"
          >
            <RotateCw className="h-3.5 w-3.5 sm:h-4 sm:w-4" />
          </Button>
        </div>

        {/* Zoom controls - Bottom on all screens */}
        <div className="md:flex absolute top-4 left-4 flex items-center gap-1 rounded-lg border bg-white p-1.5 shadow-lg dark:bg-card sm:top-auto sm:bottom-6 sm:left-auto sm:right-6 sm:gap-1 sm:p-2 md:bottom-6 md:right-6">
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
