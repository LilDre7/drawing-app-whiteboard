"use client"

import type React from "react"

import { useRef, useState, useEffect } from "react"
import { Button } from "@/components/ui/button"
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
  Menu,
  Github,
} from "lucide-react"
import { cn } from "@/lib/utils"
import { Sheet, SheetContent, SheetDescription, SheetHeader, SheetTitle, SheetTrigger } from "@/components/ui/sheet"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"

type Tool = "select" | "pencil" | "line" | "rectangle" | "circle" | "text" | "eraser" | "hand" | "image"

interface Point {
  x: number
  y: number
}

interface Shape {
  id: string
  type: Tool
  points: Point[]
  color: string
  strokeWidth: number
  text?: string
  imageData?: string
  imageWidth?: number
  imageHeight?: number
  bounds?: {
    minX: number
    minY: number
    maxX: number
    maxY: number
  }
}

type ResizeHandle = "nw" | "ne" | "sw" | "se" | null

export default function DrawingCanvas() {
  const canvasRef = useRef<HTMLCanvasElement>(null)
  const textInputRef = useRef<HTMLInputElement>(null)
  const imageInputRef = useRef<HTMLInputElement>(null)
  const imageElementsRef = useRef<Map<string, HTMLImageElement>>(new Map())

  const [tool, setTool] = useState<Tool>("select")
  const [isDrawing, setIsDrawing] = useState(false)
  const [shapes, setShapes] = useState<Shape[]>([])
  const [currentShape, setCurrentShape] = useState<Shape | null>(null)
  const [color, setColor] = useState("#1e293b")
  const [strokeWidth, setStrokeWidth] = useState(2)
  const [zoom, setZoom] = useState(100)
  const [showShareConfirm, setShowShareConfirm] = useState(false)

  const [projectTitle, setProjectTitle] = useState("Untitled Project")
  const [isEditingTitle, setIsEditingTitle] = useState(false)
  const titleInputRef = useRef<HTMLInputElement>(null)

  const [panOffset, setPanOffset] = useState<Point>({ x: 0, y: 0 })
  const [isPanning, setIsPanning] = useState(false)
  const [panStart, setPanStart] = useState<Point>({ x: 0, y: 0 })

  const [isEditingText, setIsEditingText] = useState(false)
  const [textPosition, setTextPosition] = useState<Point>({ x: 0, y: 0 })
  const [textValue, setTextValue] = useState("")

  const [selectedShapeId, setSelectedShapeId] = useState<string | null>(null)
  const [isDragging, setIsDragging] = useState(false)
  const [dragStart, setDragStart] = useState<Point>({ x: 0, y: 0 })
  const [shapeStartPoints, setShapeStartPoints] = useState<Point[]>([])
  const [draggedShape, setDraggedShape] = useState<Shape | null>(null)
  const [history, setHistory] = useState<Shape[][]>([])
  const [historyIndex, setHistoryIndex] = useState(-1)
  const [isErasing, setIsErasing] = useState(false)

  const [isResizing, setIsResizing] = useState(false)
  const [resizeHandle, setResizeHandle] = useState<ResizeHandle>(null)
  const [resizeStart, setResizeStart] = useState<Point>({ x: 0, y: 0 })
  const [originalSize, setOriginalSize] = useState<{ width: number; height: number }>({ width: 0, height: 0 })

  useEffect(() => {
    const canvas = canvasRef.current
    if (!canvas) return

    const resizeCanvas = () => {
      const rect = canvas.getBoundingClientRect()
      canvas.width = rect.width
      canvas.height = rect.height
      redrawCanvas()
    }

    resizeCanvas()
    window.addEventListener("resize", resizeCanvas)
    return () => window.removeEventListener("resize", resizeCanvas)
  }, [])

  useEffect(() => {
    redrawCanvas()
  }, [shapes, selectedShapeId, zoom, panOffset, draggedShape])
  

  const calculateBounds = (shape: Shape) => {
    if (shape.points.length === 0) return null

    if (shape.type === "text" && shape.text) {
      const canvas = canvasRef.current
      if (canvas) {
        const ctx = canvas.getContext("2d")
        if (ctx) {
          ctx.font = `${shape.strokeWidth * 8}px 'Comic Sans MS', cursive, sans-serif`
          const metrics = ctx.measureText(shape.text)
          const textHeight = shape.strokeWidth * 8
          return {
            minX: shape.points[0].x,
            minY: shape.points[0].y - textHeight,
            maxX: shape.points[0].x + metrics.width,
            maxY: shape.points[0].y,
          }
        }
      }
    }

    if (shape.type === "image" && shape.imageWidth && shape.imageHeight) {
      return {
        minX: shape.points[0].x,
        minY: shape.points[0].y,
        maxX: shape.points[0].x + shape.imageWidth,
        maxY: shape.points[0].y + shape.imageHeight,
      }
    }

    if (shape.type === "rectangle" && shape.points.length >= 2) {
      const start = shape.points[0]
      const end = shape.points[shape.points.length - 1]
      return {
        minX: Math.min(start.x, end.x),
        minY: Math.min(start.y, end.y),
        maxX: Math.max(start.x, end.x),
        maxY: Math.max(start.y, end.y),
      }
    }

    if (shape.type === "circle" && shape.points.length >= 2) {
      const start = shape.points[0]
      const end = shape.points[shape.points.length - 1]
      const radius = Math.sqrt(Math.pow(end.x - start.x, 2) + Math.pow(end.y - start.y, 2))
      return {
        minX: start.x - radius,
        minY: start.y - radius,
        maxX: start.x + radius,
        maxY: start.y + radius,
      }
    }

    const xs = shape.points.map((p) => p.x)
    const ys = shape.points.map((p) => p.y)

    return {
      minX: Math.min(...xs),
      minY: Math.min(...ys),
      maxX: Math.max(...xs),
      maxY: Math.max(...ys),
    }
  }

  const isPointInShape = (point: Point, shape: Shape): boolean => {
    const bounds = shape.bounds || calculateBounds(shape)
    if (!bounds) return false

    const padding = 10
    return (
      point.x >= bounds.minX - padding &&
      point.x <= bounds.maxX + padding &&
      point.y >= bounds.minY - padding &&
      point.y <= bounds.maxY + padding
    )
  }

  const getResizeHandle = (point: Point, shape: Shape): ResizeHandle => {
    if (shape.type !== "image" || !shape.bounds) return null

    const handleSize = 8
    const bounds = shape.bounds

    // Check each corner
    if (Math.abs(point.x - bounds.minX) < handleSize && Math.abs(point.y - bounds.minY) < handleSize) {
      return "nw"
    }
    if (Math.abs(point.x - bounds.maxX) < handleSize && Math.abs(point.y - bounds.minY) < handleSize) {
      return "ne"
    }
    if (Math.abs(point.x - bounds.minX) < handleSize && Math.abs(point.y - bounds.maxY) < handleSize) {
      return "sw"
    }
    if (Math.abs(point.x - bounds.maxX) < handleSize && Math.abs(point.y - bounds.maxY) < handleSize) {
      return "se"
    }

    return null
  }

  const redrawCanvas = () => {
    const canvas = canvasRef.current
    if (!canvas) return

    const ctx = canvas.getContext("2d")
    if (!ctx) return

    ctx.setTransform(1, 0, 0, 1, 0, 0)
    ctx.clearRect(0, 0, canvas.width, canvas.height)

    const scale = zoom / 100
    const offsetX = canvas.width / 2
    const offsetY = canvas.height / 2

    ctx.translate(offsetX + panOffset.x, offsetY + panOffset.y)
    ctx.scale(scale, scale)
    ctx.translate(-offsetX, -offsetY)

    shapes.forEach((shape) => {
      if ((isDragging || isResizing) && shape.id === selectedShapeId) return
      drawShape(ctx, shape, shape.id === selectedShapeId)
    })

    if (draggedShape) {
      drawShape(ctx, draggedShape, true)
    }

    if (currentShape) {
      drawShape(ctx, currentShape, false)
    }
  }

  const drawShape = (ctx: CanvasRenderingContext2D, shape: Shape, isSelected: boolean) => {
    ctx.strokeStyle = shape.color
    ctx.lineWidth = shape.strokeWidth
    ctx.lineCap = "round"
    ctx.lineJoin = "round"

    if (shape.type === "pencil") {
      if (shape.points.length < 2) return
      ctx.beginPath()
      ctx.moveTo(shape.points[0].x, shape.points[0].y)
      shape.points.forEach((point) => {
        ctx.lineTo(point.x, point.y)
      })
      ctx.stroke()
    } else if (shape.type === "line") {
      if (shape.points.length < 2) return
      ctx.beginPath()
      ctx.moveTo(shape.points[0].x, shape.points[0].y)
      ctx.lineTo(shape.points[shape.points.length - 1].x, shape.points[shape.points.length - 1].y)
      ctx.stroke()
    } else if (shape.type === "rectangle") {
      if (shape.points.length < 2) return
      const start = shape.points[0]
      const end = shape.points[shape.points.length - 1]
      ctx.strokeRect(start.x, start.y, end.x - start.x, end.y - start.y)
    } else if (shape.type === "circle") {
      if (shape.points.length < 2) return
      const start = shape.points[0]
      const end = shape.points[shape.points.length - 1]
      const radius = Math.sqrt(Math.pow(end.x - start.x, 2) + Math.pow(end.y - start.y, 2))
      ctx.beginPath()
      ctx.arc(start.x, start.y, radius, 0, 2 * Math.PI)
      ctx.stroke()
    } else if (shape.type === "text" && shape.text) {
      ctx.font = `${shape.strokeWidth * 8}px 'Comic Sans MS', cursive, sans-serif`
      ctx.fillStyle = shape.color
      ctx.fillText(shape.text, shape.points[0].x, shape.points[0].y)
    } else if (shape.type === "image" && shape.imageWidth && shape.imageHeight) {
      const img = imageElementsRef.current.get(shape.id)
      if (img && img.complete && img.naturalWidth > 0) {
        ctx.drawImage(img, shape.points[0].x, shape.points[0].y, shape.imageWidth, shape.imageHeight)
      }
    }

    if (isSelected && shape.bounds) {
      ctx.strokeStyle = "#3b82f6"
      ctx.lineWidth = 2
      ctx.setLineDash([5, 5])
      const padding = 5
      ctx.strokeRect(
        shape.bounds.minX - padding,
        shape.bounds.minY - padding,
        shape.bounds.maxX - shape.bounds.minX + padding * 2,
        shape.bounds.maxY - shape.bounds.minY + padding * 2,
      )
      ctx.setLineDash([])

      if (shape.type === "image") {
        const handleSize = 8
        ctx.fillStyle = "#3b82f6"

        // Draw corner handles
        ctx.fillRect(shape.bounds.minX - handleSize / 2, shape.bounds.minY - handleSize / 2, handleSize, handleSize)
        ctx.fillRect(shape.bounds.maxX - handleSize / 2, shape.bounds.minY - handleSize / 2, handleSize, handleSize)
        ctx.fillRect(shape.bounds.minX - handleSize / 2, shape.bounds.maxY - handleSize / 2, handleSize, handleSize)
        ctx.fillRect(shape.bounds.maxX - handleSize / 2, shape.bounds.maxY - handleSize / 2, handleSize, handleSize)
      }
    }
  }

  const getMousePos = (e: React.MouseEvent<HTMLCanvasElement>): Point => {
    const canvas = canvasRef.current
    if (!canvas) return { x: 0, y: 0 }
    const rect = canvas.getBoundingClientRect()
    const scale = zoom / 100
    const offsetX = canvas.width / 2
    const offsetY = canvas.height / 2

    const rawX = e.clientX - rect.left
    const rawY = e.clientY - rect.top

    const x = (rawX - offsetX - panOffset.x) / scale + offsetX
    const y = (rawY - offsetY - panOffset.y) / scale + offsetY

    return { x, y }
  }

  const saveToHistory = () => {
    const newHistory = history.slice(0, historyIndex + 1)
    newHistory.push([...shapes])
    setHistory(newHistory)
    setHistoryIndex(newHistory.length - 1)
  }

  const handleMouseDown = (e: React.MouseEvent<HTMLCanvasElement>) => {
    const point = getMousePos(e)

    if (tool === "hand") {
      setIsPanning(true)
      setPanStart({ x: e.clientX - panOffset.x, y: e.clientY - panOffset.y })
      return
    }

    if (tool === "select") {
      if (selectedShapeId) {
        const selectedShape = shapes.find((s) => s.id === selectedShapeId)
        if (selectedShape && selectedShape.type === "image") {
          const handle = getResizeHandle(point, selectedShape)
          if (handle) {
            setIsResizing(true)
            setResizeHandle(handle)
            setResizeStart(point)
            setOriginalSize({
              width: selectedShape.imageWidth || 0,
              height: selectedShape.imageHeight || 0,
            })
            return
          }
        }
      }

      const clickedShape = [...shapes].reverse().find((shape) => isPointInShape(point, shape))
      if (clickedShape) {
        setSelectedShapeId(clickedShape.id)
        setIsDragging(true)
        setDragStart(point)
        setShapeStartPoints([...clickedShape.points])
      } else {
        setSelectedShapeId(null)
      }
      return
    }

    setIsDrawing(true)

    if (tool === "text") {
      setIsEditingText(true)
      setTextPosition(point)
      setTextValue("")
      setTimeout(() => textInputRef.current?.focus(), 0)
      return
    }

    if (tool === "eraser") {
      setIsErasing(true)
      const eraserRadius = strokeWidth * 5
      const newShapes = shapes.filter((shape) => {
        return !isPointInShape(point, shape)
      })
      if (newShapes.length !== shapes.length) {
        saveToHistory()
        setShapes(newShapes)
      }
      return
    }

    const newShape: Shape = {
      id: Date.now().toString(),
      type: tool,
      points: [point],
      color,
      strokeWidth,
    }
    setCurrentShape(newShape)
  }

  const handleMouseMove = (e: React.MouseEvent<HTMLCanvasElement>) => {
    if (isPanning && tool === "hand") {
      setPanOffset({
        x: e.clientX - panStart.x,
        y: e.clientY - panStart.y,
      })
      return
    }

    const point = getMousePos(e)

    if (isResizing && selectedShapeId && resizeHandle) {
      const shape = shapes.find((s) => s.id === selectedShapeId)
      if (shape && shape.type === "image") {
        const deltaX = point.x - resizeStart.x
        const deltaY = point.y - resizeStart.y

        // Calculate new size based on which handle is being dragged
        let newWidth = originalSize.width
        let newHeight = originalSize.height
        let newX = shape.points[0].x
        let newY = shape.points[0].y

        const aspectRatio = originalSize.width / originalSize.height

        if (resizeHandle === "se") {
          // Bottom-right: increase size
          const delta = Math.max(deltaX, deltaY)
          newWidth = originalSize.width + delta
          newHeight = newWidth / aspectRatio
        } else if (resizeHandle === "nw") {
          // Top-left: decrease size and move position
          const delta = Math.min(deltaX, deltaY)
          newWidth = originalSize.width - delta
          newHeight = newWidth / aspectRatio
          newX = shape.points[0].x + delta
          newY = shape.points[0].y + delta
        } else if (resizeHandle === "ne") {
          // Top-right
          newWidth = originalSize.width + deltaX
          newHeight = newWidth / aspectRatio
          newY = shape.points[0].y + deltaY
        } else if (resizeHandle === "sw") {
          // Bottom-left
          newWidth = originalSize.width - deltaX
          newHeight = newWidth / aspectRatio
          newX = shape.points[0].x + deltaX
        }

        // Ensure minimum size
        if (newWidth > 20 && newHeight > 20) {
          const updatedShape = {
            ...shape,
            points: [{ x: newX, y: newY }],
            imageWidth: newWidth,
            imageHeight: newHeight,
          }
          updatedShape.bounds = calculateBounds(updatedShape) as Shape["bounds"]
          setDraggedShape(updatedShape)
        }
      }
      return
    }

    if (tool === "eraser" && isErasing) {
      const newShapes = shapes.filter((shape) => {
        return !isPointInShape(point, shape)
      })
      if (newShapes.length !== shapes.length) {
        setShapes(newShapes)
      }
      return
    }

    if (tool === "select" && isDragging && selectedShapeId) {
      const shape = shapes.find((s) => s.id === selectedShapeId)
      if (shape && shapeStartPoints.length > 0) {
        const deltaX = point.x - dragStart.x
        const deltaY = point.y - dragStart.y

        const updatedShape = {
          ...shape,
          points: shapeStartPoints.map((p) => ({
            x: p.x + deltaX,
            y: p.y + deltaY,
          })),
          imageWidth: shape.imageWidth,
          imageHeight: shape.imageHeight,
        }
        updatedShape.bounds = calculateBounds(updatedShape) as Shape["bounds"]
        setDraggedShape(updatedShape)
      }
      return
    }

    if (!isDrawing || !currentShape) return

    if (tool === "pencil") {
      setCurrentShape({
        ...currentShape,
        points: [...currentShape.points, point],
      })
    } else {
      setCurrentShape({
        ...currentShape,
        points: [currentShape.points[0], point],
      })
    }

    redrawCanvas()
  }

  const handleMouseUp = () => {
    if (isPanning) {
      setIsPanning(false)
      return
    }

    if (isErasing) {
      setIsErasing(false)
      return
    }

    if (isResizing && selectedShapeId && draggedShape) {
      saveToHistory()
      setShapes(shapes.map((s) => (s.id === selectedShapeId ? draggedShape : s)))
      setDraggedShape(null)
      setIsResizing(false)
      setResizeHandle(null)
      return
    }

    if (isDragging && selectedShapeId && draggedShape) {
      saveToHistory()
      setShapes(shapes.map((s) => (s.id === selectedShapeId ? draggedShape : s)))
      setDraggedShape(null)
      setShapeStartPoints([])
    }

    if (currentShape && isDrawing) {
      const shapeWithBounds = {
        ...currentShape,
        bounds: calculateBounds(currentShape),
      }
      saveToHistory()
      setShapes([...shapes, shapeWithBounds as Shape])
      setCurrentShape(null)
    }
    setIsDrawing(false)
    setIsDragging(false)
  }

  const handleTextComplete = () => {
    if (textValue.trim()) {
      const canvas = canvasRef.current
      let bounds = {
        minX: textPosition.x,
        minY: textPosition.y - strokeWidth * 8,
        maxX: textPosition.x + textValue.length * strokeWidth * 5,
        maxY: textPosition.y,
      }

      if (canvas) {
        const ctx = canvas.getContext("2d")
        if (ctx) {
          ctx.font = `${strokeWidth * 8}px 'Comic Sans MS', cursive, sans-serif`
          const metrics = ctx.measureText(textValue)
          const textHeight = strokeWidth * 8
          bounds = {
            minX: textPosition.x,
            minY: textPosition.y - textHeight,
            maxX: textPosition.x + metrics.width,
            maxY: textPosition.y,
          }
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
      }
      saveToHistory()
      setShapes([...shapes, newShape])
    }
    setIsEditingText(false)
    setTextValue("")
  }

  const saveAsImage = () => {
    const canvas = canvasRef.current
    if (!canvas) return

    const link = document.createElement("a")
    link.download = `whiteboard-${Date.now()}.png`
    link.href = canvas.toDataURL()
    link.click()
  }

  const handleZoomIn = () => setZoom(Math.min(zoom + 10, 200))
  const handleZoomOut = () => setZoom(Math.max(zoom - 10, 50))

  const handleUndo = () => {
    if (historyIndex > 0) {
      setHistoryIndex(historyIndex - 1)
      setShapes(history[historyIndex - 1])
      setSelectedShapeId(null)
    }
  }

  const handleRedo = () => {
    if (historyIndex < history.length - 1) {
      setHistoryIndex(historyIndex + 1)
      setShapes(history[historyIndex + 1])
      setSelectedShapeId(null)
    }
  }

  const handleClear = () => {
    saveToHistory()
    setShapes([])
    setSelectedShapeId(null)
  }

  const handleImageUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (!file) return

    const reader = new FileReader()
    reader.onload = (event) => {
      if (!event.target?.result) return
      
      const imageDataUrl = event.target.result as string

      const img = new Image()
      img.onload = () => {
        const canvas = canvasRef.current
        if (!canvas) return

        const maxWidth = 300
        const maxHeight = 300
        let width = img.width
        let height = img.height

        if (width > maxWidth || height > maxHeight) {
          const ratio = Math.min(maxWidth / width, maxHeight / height)
          width = width * ratio
          height = height * ratio
        }

        // Calculate position in world coordinates (considering zoom and pan)
        // The canvas origin is at (canvas.width/2, canvas.height/2) in world space
        const offsetX = canvas.width / 2
        const offsetY = canvas.height / 2
        
        // Position at the center of the visible viewport
        const centerX = offsetX - width / 2
        const centerY = offsetY - height / 2

        const shapeId = Date.now().toString()

        // Store the image element before creating the shape
        imageElementsRef.current.set(shapeId, img)

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
        }

        saveToHistory()
        setShapes((prevShapes) => [...prevShapes, newShape])
        setTool("select")
        
        // Force a redraw after state update
        requestAnimationFrame(() => {
          redrawCanvas()
        })
      }
      img.onerror = () => {
        console.error("Error loading image")
        alert("Error al cargar la imagen. Por favor, intenta con otra imagen.")
      }
      img.src = imageDataUrl
    }
    reader.onerror = () => {
      console.error("Error reading file")
    }
    reader.readAsDataURL(file)

    if (imageInputRef.current) {
      imageInputRef.current.value = ""
    }
  }

  const handleShare = async () => {
    const url = window.location.href

    if (navigator.share) {
      try {
        await navigator.share({
          title: "Whiteboard",
          text: "Mira mi whiteboard",
          url: url,
        })
      } catch (err) {
        console.log("Error sharing:", err)
      }
    } else {
      try {
        await navigator.clipboard.writeText(url)
        setShowShareConfirm(true)
        setTimeout(() => setShowShareConfirm(false), 2000)
      } catch (err) {
        console.log("Error copying to clipboard:", err)
      }
    }
  }

  const handleTitleClick = () => {
    setIsEditingTitle(true)
    setTimeout(() => titleInputRef.current?.focus(), 0)
  }

  const handleTitleComplete = () => {
    setIsEditingTitle(false)
    if (projectTitle.trim() === "") {
      setProjectTitle("Untitled Project")
    }
  }

  return (
    <div className="flex h-screen flex-col bg-background">
      <header className="flex h-12 items-center border-b bg-white dark:bg-card">
        {/* Left section - Menu and controls */}
        <div className="flex h-full items-center gap-3 border-r px-4">
          <Sheet>
            <SheetTrigger asChild>
              <Button variant="ghost" size="icon" className="h-7 w-7">
                <Menu className="h-4 w-4" />
              </Button>
            </SheetTrigger>
            <SheetContent side="left" className="w-[400px] sm:w-[540px]">
              <SheetHeader>
                <SheetTitle>Menú</SheetTitle>
                <SheetDescription>Información y ayuda sobre la aplicación</SheetDescription>
              </SheetHeader>
              <Tabs defaultValue="help" className="mt-6">
                <TabsList className="grid w-full grid-cols-2">
                  <TabsTrigger value="help">Ayuda</TabsTrigger>
                  <TabsTrigger value="about">Acerca de</TabsTrigger>
                </TabsList>
                <TabsContent value="help" className="mt-4 space-y-4">
                  <div className="space-y-3">
                    <h3 className="font-semibold">Herramientas disponibles</h3>
                    <div className="space-y-3 text-sm">
                      <div className="flex items-start gap-3 rounded-lg border p-3">
                        <MousePointer2 className="mt-0.5 h-5 w-5 shrink-0 text-blue-600" />
                        <div>
                          <p className="font-medium">Seleccionar</p>
                          <p className="text-muted-foreground">
                            Selecciona y mueve objetos en el canvas. Haz clic en un objeto para seleccionarlo y
                            arrástralo para moverlo.
                          </p>
                        </div>
                      </div>
                      <div className="flex items-start gap-3 rounded-lg border p-3">
                        <Hand className="mt-0.5 h-5 w-5 shrink-0 text-blue-600" />
                        <div>
                          <p className="font-medium">Mano (Pan)</p>
                          <p className="text-muted-foreground">
                            Muévete por el canvas. Haz clic y arrastra para desplazarte por el espacio de trabajo.
                          </p>
                        </div>
                      </div>
                      <div className="flex items-start gap-3 rounded-lg border p-3">
                        <Pencil className="mt-0.5 h-5 w-5 shrink-0 text-blue-600" />
                        <div>
                          <p className="font-medium">Dibujo libre</p>
                          <p className="text-muted-foreground">
                            Dibuja a mano alzada. Haz clic y arrastra para crear trazos libres.
                          </p>
                        </div>
                      </div>
                      <div className="flex items-start gap-3 rounded-lg border p-3">
                        <Square className="mt-0.5 h-5 w-5 shrink-0 text-blue-600" />
                        <div>
                          <p className="font-medium">Rectángulo</p>
                          <p className="text-muted-foreground">
                            Crea rectángulos. Haz clic y arrastra para definir el tamaño.
                          </p>
                        </div>
                      </div>
                      <div className="flex items-start gap-3 rounded-lg border p-3">
                        <Circle className="mt-0.5 h-5 w-5 shrink-0 text-blue-600" />
                        <div>
                          <p className="font-medium">Círculo</p>
                          <p className="text-muted-foreground">
                            Crea círculos. Haz clic en el centro y arrastra para definir el radio.
                          </p>
                        </div>
                      </div>
                      <div className="flex items-start gap-3 rounded-lg border p-3">
                        <MessageSquare className="mt-0.5 h-5 w-5 shrink-0 text-blue-600" />
                        <div>
                          <p className="font-medium">Texto</p>
                          <p className="text-muted-foreground">
                            Agrega texto al canvas. Haz clic donde quieras colocar el texto y escribe.
                          </p>
                        </div>
                      </div>
                      <div className="flex items-start gap-3 rounded-lg border p-3">
                        <ImageIcon className="mt-0.5 h-5 w-5 shrink-0 text-blue-600" />
                        <div>
                          <p className="font-medium">Imagen</p>
                          <p className="text-muted-foreground">
                            Sube imágenes desde tu computadora. Puedes moverlas y redimensionarlas con la herramienta de
                            selección.
                          </p>
                        </div>
                      </div>
                      <div className="flex items-start gap-3 rounded-lg border p-3">
                        <Eraser className="mt-0.5 h-5 w-5 shrink-0 text-blue-600" />
                        <div>
                          <p className="font-medium">Borrador</p>
                          <p className="text-muted-foreground">
                            Borra objetos individuales. Haz clic en un objeto o arrastra sobre varios para borrarlos.
                          </p>
                        </div>
                      </div>
                      <div className="flex items-start gap-3 rounded-lg border p-3">
                        <Trash2 className="mt-0.5 h-5 w-5 shrink-0 text-red-600" />
                        <div>
                          <p className="font-medium">Borrar todo</p>
                          <p className="text-muted-foreground">Elimina todos los objetos del canvas de una vez.</p>
                        </div>
                      </div>
                    </div>
                  </div>
                </TabsContent>
                <TabsContent value="about" className="mt-4 space-y-4">
                  <div className="space-y-4">
                    <div className="rounded-lg border p-4">
                      <h3 className="mb-2 font-semibold">Creador</h3>
                      <p className="text-sm text-muted-foreground">
                        Desarrollado por <span className="font-medium text-foreground">Alvaro</span>
                      </p>
                    </div>
                    <div className="rounded-lg border p-4">
                      <h3 className="mb-2 font-semibold">Proyecto</h3>
                      <p className="mb-3 text-sm text-muted-foreground">
                        Aplicación de pizarra colaborativa para crear wireframes, diagramas y notas visuales de forma
                        rápida y sencilla.
                      </p>
                      <a
                        href="https://github.com/tu-usuario/tu-proyecto"
                        target="_blank"
                        rel="noopener noreferrer"
                        className="inline-flex items-center gap-2 text-sm font-medium text-blue-600 hover:underline"
                      >
                        <Github className="h-4 w-4" />
                        Ver en GitHub
                      </a>
                    </div>
                    <div className="rounded-lg border p-4">
                      <h3 className="mb-2 font-semibold">Características</h3>
                      <ul className="space-y-1 text-sm text-muted-foreground">
                        <li>• Herramientas de dibujo básicas</li>
                        <li>• Soporte para imágenes</li>
                        <li>• Zoom y navegación</li>
                        <li>• Deshacer/Rehacer</li>
                        <li>• Exportar como imagen</li>
                        <li>• Interfaz minimalista y moderna</li>
                      </ul>
                    </div>
                  </div>
                </TabsContent>
              </Tabs>
            </SheetContent>
          </Sheet>
          <span className="text-sm font-medium text-foreground">Whiteboard</span>
        </div>

        {/* Center section - History controls */}
        <div className="flex h-full items-center gap-1 border-r px-3">
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
                if (e.key === "Enter") handleTitleComplete()
                if (e.key === "Escape") {
                  setIsEditingTitle(false)
                  setProjectTitle(projectTitle || "Untitled Project")
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
            {showShareConfirm ? <Check className="h-3.5 w-3.5" /> : <Link2 className="h-3.5 w-3.5" />}
          </Button>
        </div>
      </header>

      <div className="relative flex-1 overflow-hidden">
        <div className="canvas-dots absolute inset-0 bg-[oklch(0.98_0_0)] dark:bg-[oklch(0.14_0_0)]">
          <canvas
            ref={canvasRef}
            className={cn(
              "h-full w-full",
              tool === "hand"
                ? isPanning
                  ? "cursor-grabbing"
                  : "cursor-grab"
                : tool === "select"
                  ? "cursor-default"
                  : "cursor-crosshair",
            )}
            onMouseDown={handleMouseDown}
            onMouseMove={handleMouseMove}
            onMouseUp={handleMouseUp}
            onMouseLeave={handleMouseUp}
          />

          <input ref={imageInputRef} type="file" accept="image/*" onChange={handleImageUpload} className="hidden" />

          {isEditingText && (
            <input
              ref={textInputRef}
              type="text"
              value={textValue}
              onChange={(e) => setTextValue(e.target.value)}
              onBlur={handleTextComplete}
              onKeyDown={(e) => {
                if (e.key === "Enter") handleTextComplete()
                if (e.key === "Escape") {
                  setIsEditingText(false)
                  setTextValue("")
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

        <div className="absolute bottom-6 left-1/2 flex -translate-x-1/2 items-center gap-1 rounded-xl border bg-white px-2 py-2 shadow-lg dark:bg-card">
          <Button
            variant="ghost"
            size="icon"
            className={cn(
              "h-10 w-10 rounded-lg",
              tool === "select" && "bg-blue-100 text-blue-600 hover:bg-blue-100 dark:bg-blue-950 dark:text-blue-400",
            )}
            onClick={() => setTool("select")}
            title="Seleccionar"
          >
            <MousePointer2 className="h-5 w-5" />
          </Button>
          <Button
            variant="ghost"
            size="icon"
            className={cn(
              "h-10 w-10 rounded-lg",
              tool === "hand" && "bg-blue-100 text-blue-600 hover:bg-blue-100 dark:bg-blue-950 dark:text-blue-400",
            )}
            onClick={() => setTool("hand")}
            title="Mano (Pan)"
          >
            <Hand className="h-5 w-5" />
          </Button>
          <Button
            variant="ghost"
            size="icon"
            className={cn(
              "h-10 w-10 rounded-lg",
              tool === "pencil" && "bg-blue-100 text-blue-600 hover:bg-blue-100 dark:bg-blue-950 dark:text-blue-400",
            )}
            onClick={() => setTool("pencil")}
            title="Dibujo libre"
          >
            <Pencil className="h-5 w-5" />
          </Button>
          <Button
            variant="ghost"
            size="icon"
            className={cn(
              "h-10 w-10 rounded-lg",
              tool === "rectangle" && "bg-blue-100 text-blue-600 hover:bg-blue-100 dark:bg-blue-950 dark:text-blue-400",
            )}
            onClick={() => setTool("rectangle")}
            title="Rectángulo"
          >
            <Square className="h-5 w-5" />
          </Button>
          <Button
            variant="ghost"
            size="icon"
            className={cn(
              "h-10 w-10 rounded-lg",
              tool === "circle" && "bg-blue-100 text-blue-600 hover:bg-blue-100 dark:bg-blue-950 dark:text-blue-400",
            )}
            onClick={() => setTool("circle")}
            title="Círculo"
          >
            <Circle className="h-5 w-5" />
          </Button>
          <Button
            variant="ghost"
            size="icon"
            className={cn(
              "h-10 w-10 rounded-lg",
              tool === "text" && "bg-blue-100 text-blue-600 hover:bg-blue-100 dark:bg-blue-950 dark:text-blue-400",
            )}
            onClick={() => setTool("text")}
            title="Texto"
          >
            <MessageSquare className="h-5 w-5" />
          </Button>
          <Button
            variant="ghost"
            size="icon"
            className="h-10 w-10 rounded-lg"
            onClick={() => imageInputRef.current?.click()}
            title="Agregar imagen"
          >
            <ImageIcon className="h-5 w-5" />
          </Button>
          <Button
            variant="ghost"
            size="icon"
            className={cn(
              "h-10 w-10 rounded-lg",
              tool === "eraser" && "bg-blue-100 text-blue-600 hover:bg-blue-100 dark:bg-blue-950 dark:text-blue-400",
            )}
            onClick={() => setTool("eraser")}
            title="Borrador"
          >
            <Eraser className="h-5 w-5" />
          </Button>
          <div className="mx-1 h-6 w-px bg-border" />
          <Button
            variant="ghost"
            size="icon"
            className="h-10 w-10 rounded-lg text-red-600 hover:bg-red-50 hover:text-red-700 dark:hover:bg-red-950"
            onClick={handleClear}
            title="Borrar todo"
          >
            <Trash2 className="h-5 w-5" />
          </Button>
          <Button variant="ghost" size="icon" className="h-10 w-10 rounded-lg" onClick={saveAsImage} title="Exportar">
            <Download className="h-5 w-5" />
          </Button>
          <Button variant="ghost" size="icon" className="h-10 w-10 rounded-lg" title="Más opciones">
            <MoreHorizontal className="h-5 w-5" />
          </Button>
        </div>

        <div className="absolute bottom-6 right-6 flex items-center gap-1 rounded-lg border bg-white p-2 shadow-lg dark:bg-card">
          <Button variant="ghost" size="icon" className="h-8 w-8" onClick={handleZoomOut} title="Zoom out">
            <ZoomOut className="h-4 w-4" />
          </Button>
          <div className="mx-1 min-w-[50px] text-center text-sm font-medium">{zoom}%</div>
          <Button variant="ghost" size="icon" className="h-8 w-8" onClick={handleZoomIn} title="Zoom in">
            <ZoomIn className="h-4 w-4" />
          </Button>
        </div>

        <div className="absolute right-6 top-6 flex items-center gap-2 rounded-lg border bg-white p-2 shadow-lg dark:bg-card">
          <input
            type="color"
            value={color}
            onChange={(e) => setColor(e.target.value)}
            className="h-8 w-8 cursor-pointer rounded border-0"
            title="Color"
          />
          <div className="h-6 w-px bg-border" />
          <div className="flex items-center gap-1">
            <Button
              variant="ghost"
              size="icon"
              className="h-8 w-8"
              onClick={() => setStrokeWidth(Math.max(1, strokeWidth - 1))}
            >
              <Minus className="h-3 w-3" />
            </Button>
            <span className="min-w-[20px] text-center text-xs font-medium">{strokeWidth}</span>
            <Button
              variant="ghost"
              size="icon"
              className="h-8 w-8"
              onClick={() => setStrokeWidth(Math.min(10, strokeWidth + 1))}
            >
              <Plus className="h-3 w-3" />
            </Button>
          </div>
        </div>
      </div>
    </div>
  )
}
