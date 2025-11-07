/**
 * Solicita renderizado con requestAnimationFrame
 * @param renderCallback Función de renderizado
 * @param rafRef Referencia al animation frame actual
 */
export function requestRender(
  renderCallback: () => void,
  rafRef: React.MutableRefObject<number | undefined>
): void {
  if (rafRef.current) {
    cancelAnimationFrame(rafRef.current);
  }

  rafRef.current = requestAnimationFrame(() => {
    renderCallback();
    rafRef.current = undefined;
  });
}