"use client";

import React from "react";
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
  Trash2, MessageSquareText,
} from "lucide-react";

import type { Tool } from "@/lib/canvas-types";

interface ToolbarProps {
  tool: Tool;
  color: string;
  strokeWidth: number;
  textSize: number;
  zoom: number;
  projectTitle: string;
  isEditingTitle: boolean;
  onToolChange: (tool: Tool) => void;
  onColorChange: (color: string) => void;
  onStrokeWidthChange: (width: number) => void;
  onTextSizeChange: (size: number) => void;
  onZoomIn: () => void;
  onZoomOut: () => void;
  onResetZoom: () => void;
  onUndo: () => void;
  onRedo: () => void;
  onClear: () => void;
  onDownload: () => void;
  onImageUpload: (e: React.ChangeEvent<HTMLInputElement>) => void;
  onShare: () => void;
  onTitleChange: (title: string) => void;
  onTitleEdit: () => void;
  onTitleComplete: () => void;
  canUndo: boolean;
  canRedo: boolean;
}

export function Toolbar({
  tool,
  color,
  strokeWidth,
  textSize,
  zoom,
  projectTitle,
  isEditingTitle,
  onToolChange,
  onColorChange,
  onStrokeWidthChange,
  onTextSizeChange,
  onZoomIn,
  onZoomOut,
  onResetZoom,
  onUndo,
  onRedo,
  onClear,
  onDownload,
  onImageUpload,
  onShare,
  onTitleChange,
  onTitleEdit,
  onTitleComplete,
  canUndo,
  canRedo,
}: ToolbarProps) {
  const tools = [
    { id: "select", icon: MousePointer2, label: "Seleccionar" },
    { id: "pencil", icon: Pencil, label: "Lápiz" },
    { id: "line", icon: Minus, label: "Línea" },
    { id: "rectangle", icon: Square, label: "Rectángulo" },
    { id: "circle", icon: Circle, label: "Círculo" },
    { id: "text", icon: MessageSquareText, label: "Texto" },
    { id: "eraser", icon: Eraser, label: "Borrar" },
    { id: "hand", icon: Hand, label: "Mover" },
  ] as const;

  return (
    <div className="absolute top-4 left-4 bg-white rounded-lg shadow-lg border border-gray-200 p-2 flex flex-col gap-2 z-10">
      {/* Title */}
      <div className="border-b border-gray-200 pb-2 mb-2">
        {isEditingTitle ? (
          <div className="flex items-center gap-2">
            <input
              type="text"
              value={projectTitle}
              onChange={(e) => onTitleChange(e.target.value)}
              onBlur={onTitleComplete}
              onKeyDown={(e) => e.key === "Enter" && onTitleComplete()}
              className="text-sm font-medium px-2 py-1 border rounded flex-1 min-w-[120px]"
              autoFocus
            />
            <Button size="sm" variant="ghost" onClick={onTitleComplete}>
              <Check className="w-3 h-3" />
            </Button>
          </div>
        ) : (
          <div
            className="text-sm font-medium px-2 py-1 cursor-pointer hover:bg-gray-100 rounded"
            onClick={onTitleEdit}
          >
            {projectTitle}
          </div>
        )}
      </div>

      {/* Tools */}
      <div className="flex flex-col gap-1">
        {tools.map(({ id, icon: Icon, label }) => (
          <Button
            key={id}
            size="sm"
            variant={tool === id ? "default" : "ghost"}
            onClick={() => onToolChange(id as Tool)}
            title={label}
          >
            <Icon className="w-4 h-4" />
          </Button>
        ))}
      </div>

      <div className="border-t border-gray-200 pt-2 flex flex-col gap-2">
        {/* Color */}
        <div className="flex items-center gap-2 px-2">
          <input
            type="color"
            value={color}
            onChange={(e) => onColorChange(e.target.value)}
            className="w-6 h-6 border rounded cursor-pointer"
            title="Color"
          />
        </div>

        {/* Stroke Width */}
        {tool !== "text" && tool !== "select" && (
          <div className="flex items-center gap-2 px-2">
            <input
              type="range"
              min="1"
              max="20"
              value={strokeWidth}
              onChange={(e) => onStrokeWidthChange(Number(e.target.value))}
              className="w-full h-1 bg-gray-200 rounded-lg appearance-none cursor-pointer"
              title="Grosor"
            />
          </div>
        )}

        {/* Text Size */}
        {tool === "text" && (
          <div className="flex items-center gap-2 px-2">
            <input
              type="range"
              min="12"
              max="72"
              value={textSize}
              onChange={(e) => onTextSizeChange(Number(e.target.value))}
              className="w-full h-1 bg-gray-200 rounded-lg appearance-none cursor-pointer"
              title="Tamaño de texto"
            />
          </div>
        )}

        {/* Zoom Controls */}
        <div className="flex items-center gap-1 px-2">
          <Button size="sm" variant="ghost" onClick={onZoomOut} title="Alejar">
            <ZoomOut className="w-4 h-4" />
          </Button>
          <span className="text-xs px-1 min-w-[32px] text-center">{zoom}%</span>
          <Button size="sm" variant="ghost" onClick={onZoomIn} title="Acercar">
            <ZoomIn className="w-4 h-4" />
          </Button>
        </div>

        {/* Actions */}
        <div className="flex flex-col gap-1">
          <Button
            size="sm"
            variant="ghost"
            onClick={onUndo}
            disabled={!canUndo}
            title="Deshacer"
          >
            <RotateCcw className="w-4 h-4" />
          </Button>
          <Button
            size="sm"
            variant="ghost"
            onClick={onRedo}
            disabled={!canRedo}
            title="Rehacer"
          >
            <RotateCw className="w-4 h-4" />
          </Button>
          <Button size="sm" variant="ghost" onClick={onClear} title="Limpiar">
            <Trash2 className="w-4 h-4" />
          </Button>
          <Button size="sm" variant="ghost" onClick={onDownload} title="Descargar">
            <Download className="w-4 h-4" />
          </Button>
        </div>

        {/* Image Upload */}
        <div className="relative">
          <input
            ref={(el) => {
              if (el) {
                el.onchange = onImageUpload as any;
              }
            }}
            type="file"
            accept="image/*"
            className="absolute inset-0 w-full h-full opacity-0 cursor-pointer"
          />
          <Button size="sm" variant="ghost" title="Subir imagen">
            <ImageIcon className="w-4 h-4" />
          </Button>
        </div>

        <Button size="sm" variant="ghost" onClick={onShare} title="Compartir">
          <Link2 className="w-4 h-4" />
        </Button>
      </div>
    </div>
  );
}