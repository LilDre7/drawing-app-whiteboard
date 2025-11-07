import type { Shape, Point, Tool } from "./canvas-types";

export type ResizeHandle =
  | "nw"
  | "ne"
  | "sw"
  | "se"
  | "n"
  | "s"
  | "e"
  | "w"
  | "text-resize";

export function calculateBounds(shape: Shape): { x: number; y: number; width: number; height: number } {
  if (shape.type === "text" && shape.text) {
    // Create temporary canvas to measure text
    if (typeof window !== "undefined" && typeof document !== "undefined") {
      const canvas = document.createElement("canvas");
      const ctx = canvas.getContext("2d");
      if (ctx) {
        const fontSize = Math.max(12, shape.strokeWidth * 8);
        ctx.font = `${fontSize}px sans-serif`;
        const metrics = ctx.measureText(shape.text);

        // Use actual text metrics with padding
        const textWidth = metrics.width;
        const textHeight = fontSize;
        const padding = Math.max(10, fontSize / 2); // Increased padding for better selection area

        return {
          x: shape.points[0]?.x || 0,
          y: shape.points[0]?.y || 0,
          width: textWidth + padding * 2,
          height: textHeight + padding * 2,
        };
      }
    }
    // Fallback for SSR or canvas creation failure
    const fallbackSize = Math.max(12, shape.strokeWidth * 8);
    return {
      x: shape.points[0]?.x || 0,
      y: shape.points[0]?.y || 0,
      width: fallbackSize * 4,
      height: fallbackSize * 2,
    };
  }

  if (shape.type === "image" && shape.imageWidth && shape.imageHeight) {
    return {
      x: shape.points[0]?.x || 0,
      y: shape.points[0]?.y || 0,
      width: shape.imageWidth,
      height: shape.imageHeight,
    };
  }

  if (shape.type === "rectangle" && shape.points.length >= 2) {
    const start = shape.points[0];
    const end = shape.points[shape.points.length - 1];
    return {
      x: Math.min(start.x, end.x),
      y: Math.min(start.y, end.y),
      width: Math.abs(end.x - start.x),
      height: Math.abs(end.y - start.y),
    };
  }

  if (shape.type === "circle" && shape.points.length >= 2) {
    const center = shape.points[0];
    const edge = shape.points[shape.points.length - 1];
    const radius = Math.sqrt(
      Math.pow(edge.x - center.x, 2) + Math.pow(edge.y - center.y, 2)
    );
    return {
      x: center.x - radius,
      y: center.y - radius,
      width: radius * 2,
      height: radius * 2,
    };
  }

  // For lines, pencils, and other shapes
  const xs = shape.points.map((p) => p.x);
  const ys = shape.points.map((p) => p.y);
  const minX = Math.min(...xs);
  const maxX = Math.max(...xs);
  const minY = Math.min(...ys);
  const maxY = Math.max(...ys);

  // Add padding for better selection
  const padding = Math.max(5, shape.strokeWidth);
  return {
    x: minX - padding,
    y: minY - padding,
    width: maxX - minX + padding * 2,
    height: maxY - minY + padding * 2,
  };
}

export function isPointInShape(
  point: Point,
  shape: Shape,
  isTouchEvent: boolean = false
): boolean {
  const bounds = shape.bounds || calculateBounds(shape);
  const basePadding = isTouchEvent ? 10 : 5;
  const totalPadding = Math.max(basePadding, shape.strokeWidth / 2 + 2);

  // Quick bounds check first
  if (
    point.x < bounds.x - totalPadding ||
    point.x > bounds.x + bounds.width + totalPadding ||
    point.y < bounds.y - totalPadding ||
    point.y > bounds.y + bounds.height + totalPadding
  ) {
    return false;
  }

  // More precise check for different shape types
  if (
    shape.type === "rectangle" ||
    shape.type === "circle" ||
    shape.type === "line"
  ) {
    // For these shapes, use the full bounds for selection
    return true;
  }

  if (
    shape.type === "text" ||
    shape.type === "image" ||
    shape.type === "pencil"
  ) {
    // For text, images, and pencil, use slightly larger bounds
    const largerPadding = totalPadding * 1.5;
    return (
      point.x >= bounds.x - largerPadding &&
      point.x <= bounds.x + bounds.width + largerPadding &&
      point.y >= bounds.y - largerPadding &&
      point.y <= bounds.y + bounds.height + largerPadding
    );
  }

  return false;
}

export function isPointInShapeForEraser(
  point: Point,
  shape: Shape,
  eraserRadius: number
): boolean {
  const bounds = shape.bounds || calculateBounds(shape);
  const basePadding = 5;
  const totalPadding = Math.max(basePadding, eraserRadius);

  // Quick bounds check
  if (
    point.x < bounds.x - totalPadding ||
    point.x > bounds.x + bounds.width + totalPadding ||
    point.y < bounds.y - totalPadding ||
    point.y > bounds.y + bounds.height + totalPadding
  ) {
    return false;
  }

  // For eraser, we want to be more inclusive
  if (
    shape.type === "text" ||
    shape.type === "image" ||
    shape.type === "pencil"
  ) {
    return true;
  }

  if (shape.type === "line" && shape.points.length >= 2) {
    // Check proximity to line segment
    for (let i = 0; i < shape.points.length - 1; i++) {
      const start = shape.points[i];
      const end = shape.points[i + 1];
      if (isPointNearLine(point, start, end, eraserRadius)) {
        return true;
      }
    }
    return false;
  }

  if (shape.type === "rectangle" && shape.points.length >= 2) {
    const start = shape.points[0];
    const end = shape.points[shape.points.length - 1];
    const minX = Math.min(start.x, end.x);
    const minY = Math.min(start.y, end.y);
    const maxX = Math.max(start.x, end.x);
    const maxY = Math.max(start.y, end.y);

    return (
      point.x >= minX - eraserRadius &&
      point.x <= maxX + eraserRadius &&
      point.y >= minY - eraserRadius &&
      point.y <= maxY + eraserRadius
    );
  }

  if (shape.type === "circle" && shape.points.length >= 2) {
    const center = shape.points[0];
    const edge = shape.points[shape.points.length - 1];
    const radius = Math.sqrt(
      Math.pow(edge.x - center.x, 2) + Math.pow(edge.y - center.y, 2)
    );
    const distance = Math.sqrt(
      Math.pow(point.x - center.x, 2) + Math.pow(point.y - center.y, 2)
    );
    return Math.abs(distance - radius) <= eraserRadius + 5;
  }

  return false;
}

function isPointNearLine(
  point: Point,
  lineStart: Point,
  lineEnd: Point,
  threshold: number = 5
): boolean {
  const A = point.x - lineStart.x;
  const B = point.y - lineStart.y;
  const C = lineEnd.x - lineStart.x;
  const D = lineEnd.y - lineStart.y;

  const dot = A * C + B * D;
  const lenSq = C * C + D * D;
  let param = -1;

  if (lenSq !== 0) {
    param = dot / lenSq;
  }

  let xx, yy;

  if (param < 0) {
    xx = lineStart.x;
    yy = lineStart.y;
  } else if (param > 1) {
    xx = lineEnd.x;
    yy = lineEnd.y;
  } else {
    xx = lineStart.x + param * C;
    yy = lineStart.y + param * D;
  }

  const dx = point.x - xx;
  const dy = point.y - yy;
  const distance = Math.sqrt(dx * dx + dy * dy);

  return distance <= threshold;
}

export function getResizeHandle(
  point: Point,
  shape: Shape,
  isTouchEvent: boolean = false
): ResizeHandle | null {
  const bounds = shape.bounds || calculateBounds(shape);
  const handleSize = isTouchEvent ? 20 : 8;
  const cursorPadding = shape.type === "rectangle" || shape.type === "circle" ? 5 : 0;

  // For text shapes, check for text resize handle
  if (shape.type === "text" && shape.bounds) {
    const textHandleSize = isTouchEvent ? 24 : 12;
    const textHandleX = shape.bounds.x + shape.bounds.width - textHandleSize / 2;
    const textHandleY = shape.bounds.y + shape.bounds.height - textHandleSize / 2;

    if (
      Math.abs(point.x - textHandleX) <= textHandleSize / 2 &&
      Math.abs(point.y - textHandleY) <= textHandleSize / 2
    ) {
      return "text-resize";
    }
  }

  // For resizable shapes, check corner and edge handles
  if (
    shape.type === "rectangle" ||
    shape.type === "circle" ||
    shape.type === "image"
  ) {
    const corners = [
      { x: bounds.x, y: bounds.y, type: "nw" as ResizeHandle },
      { x: bounds.x + bounds.width, y: bounds.y, type: "ne" as ResizeHandle },
      { x: bounds.x, y: bounds.y + bounds.height, type: "sw" as ResizeHandle },
      { x: bounds.x + bounds.width, y: bounds.y + bounds.height, type: "se" as ResizeHandle },
    ];

    for (const corner of corners) {
      if (
        Math.abs(point.x - corner.x) <= handleSize + cursorPadding &&
        Math.abs(point.y - corner.y) <= handleSize + cursorPadding
      ) {
        return corner.type;
      }
    }

    // Edge handles for rectangles and images
    if (shape.type !== "circle") {
      const midX = bounds.x + bounds.width / 2;
      const midY = bounds.y + bounds.height / 2;

      if (Math.abs(point.x - midX) <= handleSize && Math.abs(point.y - bounds.y) <= handleSize) {
        return "n";
      }
      if (Math.abs(point.x - midX) <= handleSize && Math.abs(point.y - (bounds.y + bounds.height)) <= handleSize) {
        return "s";
      }
      if (Math.abs(point.y - midY) <= handleSize && Math.abs(point.x - bounds.x) <= handleSize) {
        return "w";
      }
      if (Math.abs(point.y - midY) <= handleSize && Math.abs(point.x - (bounds.x + bounds.width)) <= handleSize) {
        return "e";
      }
    }
  }

  // For lines, check endpoints
  if (shape.type === "line" && shape.points.length >= 2) {
    const start = shape.points[0];
    const end = shape.points[shape.points.length - 1];

    if (Math.abs(point.x - start.x) <= handleSize && Math.abs(point.y - start.y) <= handleSize) {
      return "nw";
    }
    if (Math.abs(point.x - end.x) <= handleSize && Math.abs(point.y - end.y) <= handleSize) {
      return "se";
    }
  }

  return null;
}