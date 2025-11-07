import { Tool } from '../../lib/canvas-types';

/**
 * Maneja eventos de teclado para cambio de herramientas
 * @param e Evento de teclado
 * @param onToolChange Función para cambiar herramienta
 */
export function handleToolKeyboard(e: KeyboardEvent, onToolChange: (tool: Tool) => void): void {
  // Teclas de herramientas
  switch (e.key.toLowerCase()) {
    case 'v':
    case 'b':
      onToolChange('select');
      break;
    case 'p':
    case 'd':
      onToolChange('pen');
      break;
    case 'e':
      onToolChange('eraser');
      break;
    case 't':
      onToolChange('text');
      break;
    case 'l':
      onToolChange('line');
      break;
    case 'r':
      onToolChange('rectangle');
      break;
    case 'c':
      onToolChange('circle');
      break;
    case 'g':
      onToolChange('triangle');
      break;
    case 'a':
      onToolChange('arrow');
      break;
    case 'h':
      onToolChange('hand');
      break;
  }
}