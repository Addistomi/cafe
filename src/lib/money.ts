/** Money is computed in integer santim (1 ETB = 100) so floating point never touches a total. */
export const toMinor = (value: number | string): number => Math.round(Number(value) * 100);
export const fromMinor = (minor: number): number => minor / 100;

export function formatETB(value: number | string): string {
  const n = Number(value);
  const hasFraction = Math.round(n * 100) % 100 !== 0;
  return `${n.toLocaleString('en-US', { minimumFractionDigits: hasFraction ? 2 : 0, maximumFractionDigits: 2 })} ETB`;
}

/** Ingredient quantities have 3 decimals; round after multiplying to keep them clean. */
export const mulQty = (perServing: number, servings: number): number =>
  Math.round(perServing * servings * 1000) / 1000;
