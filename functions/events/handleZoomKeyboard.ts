/**
 * Maneja eventos de teclado para zoom
 * @param e Evento de teclado
 * @param onZoomIn Función para zoom in
 * @param onZoomOut Función para zoom out
 * @param onResetZoom Función para resetear zoom
 */
export function handleZoomKeyboard(
  e: KeyboardEvent,
  onZoomIn: () => void,
  onZoomOut: () => void,
  onResetZoom?: () => void
): void {
  // Ctrl/Cmd + teclas para zoom
  if (e.ctrlKey || e.metaKey) {
    switch (e.key) {
      case '+':
      case '=':
        e.preventDefault();
        onZoomIn();
        break;
      case '-':
      case '_':
        e.preventDefault();
        onZoomOut();
        break;
      case '0':
        e.preventDefault();
        onResetZoom?.();
        break;
    }
  }
}