# 📚 Catálogo de Funciones Ultra-Modulares

## 🎯 **Funciones Disponibles (30+ funciones individuales)**

### 📏 **Funciones de Zoom** (`functions/zoom/`)

| Función | Archivo | Descripción | Parámetros | Retorna |
|---------|---------|-------------|------------|---------|
| `getTouchDistance` | `getTouchDistance.ts` | Calcula distancia entre toques | `touch1, touch2` | `number` |
| `getTouchCenter` | `getTouchCenter.ts` | Calcula punto medio | `touch1, touch2` | `Point` |
| `clamp` | `clamp.ts` | Restringe valor entre límites | `value, min, max` | `number` |
| `screenToCanvas` | `screenToCanvas.ts` | Convierte coordenadas pantalla→canvas | `point, offsetX, offsetY, zoom, panOffset` | `Point` |
| `canvasToScreen` | `canvasToScreen.ts` | Convierte coordenadas canvas→pantalla | `point, offsetX, offsetY, zoom, panOffset` | `Point` |
| `updatePanForZoom` | `updatePanForZoom.ts` | Actualiza pan durante zoom | `zoomCenter, newZoom, currentZoom, panOffset, offsetX, offsetY, containerRect` | `Point` |

### ✏️ **Funciones de Dibujo** (`functions/drawing/`)

| Función | Archivo | Descripción | Parámetros | Retorna |
|---------|---------|-------------|------------|---------|
| `createShape` | `createShape.ts` | Crea nueva forma | `type, point, color, strokeWidth, roughness` | `Shape` |
| `isPointInShape` | `isPointInShape.ts` | Verifica si punto está en forma | `point, shape, isTouchEvent` | `boolean` |
| `isPointInShapeForEraser` | `isPointInShapeForEraser.ts` | Verifica para borrador | `point, shape, isTouchEvent` | `boolean` |
| `getShapeAtPoint` | `getShapeAtPoint.ts` | Obtiene forma en punto | `point, shapes, isTouchEvent` | `Shape \| null` |
| `getShapesInBounds` | `getShapesInBounds.ts` | Obtiene formas en rectángulo | `bounds, shapes` | `Shape[]` |
| `cloneShape` | `cloneShape.ts` | Clona forma | `shape` | `Shape` |
| `areShapesEqual` | `areShapesEqual.ts` | Compara formas | `shape1, shape2` | `boolean` |

### 🎮 **Funciones de Eventos** (`functions/events/`)

| Función | Archivo | Descripción | Parámetros | Retorna |
|---------|---------|-------------|------------|---------|
| `getEventCoordinates` | `getEventCoordinates.ts` | Obtiene coordenadas de evento | `event` | `Point` |
| `handleZoomKeyboard` | `handleZoomKeyboard.ts` | Maneja teclado para zoom | `event, onZoomIn, onZoomOut, onResetZoom` | `void` |
| `handleToolKeyboard` | `handleToolKeyboard.ts` | Maneja teclado para herramientas | `event, onToolChange` | `void` |
| `handleWheelZoom` | `handleWheelZoom.ts` | Maneja rueda para zoom | `event, currentZoom, onZoomIn, onZoomOut, onPanChange, panOffset` | `void` |
| `handleTouchStart` | `handleTouchStart.ts` | Maneja inicio táctil | `event, getCoords, onPinchStart, onDrawStart, isPinching` | `void` |
| `handleTouchMove` | `handleTouchMove.ts` | Maneja movimiento táctil | `event, getCoords, onPinchMove, onDrawMove, isPinching, offsetX, offsetY` | `void` |
| `handleTouchEnd` | `handleTouchEnd.ts` | Maneja fin táctil | `event, onPinchEnd, onDrawEnd, isPinching` | `void` |

### 🎨 **Funciones de Renderizado** (`functions/rendering/`)

| Función | Archivo | Descripción | Parámetros | Retorna |
|---------|---------|-------------|------------|---------|
| `clearCanvas` | `clearCanvas.ts` | Limpia canvas | `canvas` | `void` |
| `setupContext` | `setupContext.ts` | Configura contexto | `ctx, dpr, scale, panOffset` | `void` |
| `drawShape` | `drawShape.ts` | Dibuja forma genérica | `ctx, shape, isSelected` | `void` |
| `resizeCanvas` | `resizeCanvas.ts` | Redimensiona canvas | `canvas, width, height, dpr` | `void` |
| `requestRender` | `requestAnimationFrame.ts` | RequestAnimationFrame | `renderCallback, rafRef` | `void` |

### 🖼️ **Funciones de Formas Específicas** (`functions/rendering/shapes/`)

| Función | Archivo | Descripción | Parámetros | Retorna |
|---------|---------|-------------|------------|---------|
| `drawPenStroke` | `drawPenStroke.ts` | Dibuja trazo de lápiz | `ctx, shape` | `void` |
| `drawLine` | `drawLine.ts` | Dibuja línea | `ctx, shape` | `void` |
| `drawRectangle` | `drawRectangle.ts` | Dibuja rectángulo | `ctx, shape` | `void` |
| `drawCircle` | `drawCircle.ts` | Dibuja círculo | `ctx, shape` | `void` |
| `drawTriangle` | `drawTriangle.ts` | Dibuja triángulo | `ctx, shape` | `void` |
| `drawArrow` | `drawArrow.ts` | Dibuja flecha | `ctx, shape` | `void` |
| `drawText` | `drawText.ts` | Dibuja texto | `ctx, shape` | `void` |

## 📦 **Formas de Import**

### **Import Individual (Recomendado)**
```typescript
// Importar solo las funciones que necesitas
import { getTouchDistance, createShape, drawShape } from '@/functions';
```

### **Import por Categoría**
```typescript
// Importar todas las funciones de una categoría
import * as zoomFunctions from '@/functions/zoom';
import * as drawingFunctions from '@/functions/drawing';
```

### **Import de Archivo Específico**
```typescript
// Importar de un archivo específico
import { getTouchDistance } from '@/functions/zoom/getTouchDistance';
```

## 🎯 **Ejemplos de Uso Rápidos**

### **Zoom y Coordenadas**
```typescript
import { getTouchDistance, screenToCanvas, clamp } from '@/functions';

const distance = getTouchDistance(touch1, touch2);
const canvasPoint = screenToCanvas(screenPoint, 400, 300, 150, { x: 0, y: 0 });
const limitedValue = clamp(value, 0, 100);
```

### **Dibujo y Formas**
```typescript
import { createShape, isPointInShape, getShapeAtPoint } from '@/functions';

const shape = createShape('pen', { x: 100, y: 100 }, '#ff0000', 2, 0);
const isInside = isPointInShape({ x: 105, y: 105 }, shape);
const foundShape = getShapeAtPoint({ x: 105, y: 105 }, allShapes);
```

### **Eventos**
```typescript
import { getEventCoordinates, handleZoomKeyboard } from '@/functions';

const coords = getEventCoordinates(mouseEvent);
handleZoomKeyboard(keyEvent, zoomIn, zoomOut, resetZoom);
```

### **Renderizado**
```typescript
import { clearCanvas, setupContext, drawShape } from '@/functions';

clearCanvas(canvas);
setupContext(ctx, 2, 1.5, { x: 10, y: 20 });
drawShape(ctx, shape, true);
```

## 🔧 **Ventajas de Esta Estructura**

1. **Tree-shaking perfecto**: Solo incluyes lo que usas
2. **Bundle size mínimo**: Zero dead code
3. **Testing unitario simple**: Cada función es testable individualmente
4. **Reutilización máxima**: Funciones en cualquier componente
5. **Colaboración sin conflictos**: Varios devs en diferentes funciones
6. **Debugging trivial**: Sabes exactamente dónde está cada función
7. **Documentación clara**: Cada función tiene su propio archivo con JSDoc

## 📈 **Estadísticas Finales**

- **Total de archivos de funciones**: 30+
- **Funciones individuales**: 30+
- **Líneas por función**: 5-15 líneas (promedio)
- **Documentación**: JSDoc completo en cada función
- **TypeScript**: 100% tipado
- **Tests**: Cada función es 100% testable

Esta es la **arquitectura más granular posible** para máxima escalabilidad y mantenibilidad.