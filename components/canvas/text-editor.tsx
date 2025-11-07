"use client";

import React, { useRef, useEffect } from "react";

interface TextEditorProps {
  screenPosition: { x: number; y: number };
  fontSize: number;
  color: string;
  viewport: { width: number; height: number };
  active: boolean;
  value: string;
  onChange: (value: string) => void;
  onComplete: () => void;
  onCancel: () => void;
}

export function TextEditor({
  screenPosition,
  fontSize,
  color,
  viewport,
  active,
  value,
  onChange,
  onComplete,
  onCancel,
}: TextEditorProps) {
  const ref = useRef<HTMLTextAreaElement>(null);

  const minWidth = 100;
  const minHeight = fontSize + 12;
  const padding = 8;

  // Desired absolute position over the canvas (baseline -> top conversion)
  // Ensure text editor stays within reasonable bounds
  const left = Math.max(
    padding,
    Math.min(screenPosition.x, viewport.width - 100)
  );
  const top = Math.max(
    padding,
    Math.min(screenPosition.y - fontSize - 4, viewport.height - 50)
  );

  // Hide only if completely outside viewport with generous tolerance
  const tolerance = 150; // Allow 150px tolerance outside viewport
  // Use safe fallback values for SSR
  const getSafeViewportWidth = () => {
    if (typeof window !== "undefined") {
      return viewport.width || window.innerWidth || 1000;
    }
    return viewport.width || 1000;
  };

  const getSafeViewportHeight = () => {
    if (typeof window !== "undefined") {
      return viewport.height || window.innerHeight || 800;
    }
    return viewport.height || 800;
  };

  const viewportWidth = getSafeViewportWidth();
  const viewportHeight = getSafeViewportHeight();

  const hidden =
    !active ||
    left + minWidth < -tolerance ||
    top + minHeight < -tolerance ||
    left > viewportWidth + tolerance ||
    top > viewportHeight + tolerance;

  const style: React.CSSProperties = {
    position: "absolute",
    left: `${left}px`,
    top: `${top}px`,
    fontSize: `${fontSize}px`,
    color,
    minWidth: "20px",
    minHeight: `${fontSize}px`,
    maxWidth: "500px",
    maxHeight: `${Math.max(40, (viewport.height || 0) - 32)}px`,
    overflow: "auto",
    lineHeight: 1.4,
    whiteSpace: "pre-wrap",
    wordBreak: "break-word",
    padding: "0",
    border: "none",
    outline: "none",
    background: "transparent",
    resize: "none",
    fontFamily: "inherit",
    zIndex: 1000,
    display: hidden ? "none" : "block",
  };

  useEffect(() => {
    if (ref.current && active && !hidden) {
      ref.current.focus();
      // Place cursor at end
      ref.current.setSelectionRange(value.length, value.length);
    }
  }, [active, hidden, value.length]);

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      onComplete();
    } else if (e.key === "Escape") {
      e.preventDefault();
      onCancel();
    }
  };

  return (
    <textarea
      ref={ref}
      value={value}
      onChange={(e) => onChange(e.target.value)}
      onKeyDown={handleKeyDown}
      style={style}
      placeholder="Type text..."
      autoComplete="off"
      autoCorrect="off"
      autoCapitalize="off"
      spellCheck={false}
    />
  );
}