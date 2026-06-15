import type { EncodedColumn } from '../types';

export function injectNoise(
  columns: EncodedColumn[],
  noiseLevel: number
): EncodedColumn[] {
  const clamped = Math.max(0, Math.min(1, noiseLevel));
  if (clamped === 0) return columns.map(c => ({ ...c }));

  return columns.map(col => {
    const newBits = col.bits.map(bit => {
      if (Math.random() < clamped) {
        return !bit;
      }
      return bit;
    }) as [boolean, boolean, boolean, boolean, boolean];

    const corrupted = newBits.some((b, i) => b !== col.bits[i]);
    return {
      ...col,
      bits: newBits,
      corrupted,
    };
  });
}
