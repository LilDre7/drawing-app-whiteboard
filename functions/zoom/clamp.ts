/**
 * Restringe un valor entre un mínimo y un máximo (clamp function)
 * @param value Valor a restringir
 * @param min Valor mínimo
 * @param max Valor máximo
 * @returns Valor restringido
 */
export function clamp(value: number, min: number, max: number): number {
  return Math.min(Math.max(value, min), max);
}