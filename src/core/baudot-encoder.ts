import type { EncodedColumn, ShiftState } from '../types';
import {
  LETTERS_MAP,
  FIGURES_MAP,
  LETTERS_SHIFT,
  FIGURES_SHIFT,
  isLetterChar,
  isFigureChar,
  getSupportedChars,
} from './baudot-table';

const supportedChars = getSupportedChars();

export function filterText(input: string): { filtered: string; removedCount: number } {
  const upper = input.toUpperCase();
  let filtered = '';
  let removedCount = 0;
  for (const ch of upper) {
    if (supportedChars.has(ch) || ch === '\n' || ch === '\r') {
      filtered += ch;
    } else {
      removedCount++;
    }
  }
  return { filtered, removedCount };
}

export function encodeText(text: string): EncodedColumn[] {
  const { filtered } = filterText(text);
  const columns: EncodedColumn[] = [];
  let shiftState: ShiftState = 'LETTERS';

  for (const ch of filtered) {
    if (isLetterChar(ch)) {
      if (shiftState !== 'LETTERS') {
        columns.push(makeShiftColumn(LETTERS_SHIFT, 'LETTERS'));
        shiftState = 'LETTERS';
      }
      const bits = LETTERS_MAP.get(ch);
      if (bits) {
        columns.push(makeDataColumn(bits, ch, shiftState));
      }
    } else if (isFigureChar(ch)) {
      if (shiftState !== 'FIGURES') {
        columns.push(makeShiftColumn(FIGURES_SHIFT, 'FIGURES'));
        shiftState = 'FIGURES';
      }
      const bits = FIGURES_MAP.get(ch);
      if (bits) {
        columns.push(makeDataColumn(bits, ch, shiftState));
      }
    } else if (ch === ' ') {
      const bits: [boolean, boolean, boolean, boolean, boolean] = [false, false, true, false, false];
      columns.push(makeDataColumn(bits, ' ', shiftState));
    } else if (ch === '\n') {
      const bits: [boolean, boolean, boolean, boolean, boolean] = [false, false, false, true, false];
      columns.push(makeDataColumn(bits, '↵', shiftState));
    } else if (ch === '\r') {
      const bits: [boolean, boolean, boolean, boolean, boolean] = [false, true, false, false, false];
      columns.push(makeDataColumn(bits, '←', shiftState));
    }
  }

  return columns;
}

function makeShiftColumn(
  bits: [boolean, boolean, boolean, boolean, boolean],
  label: string
): EncodedColumn {
  return {
    bits: [...bits] as [boolean, boolean, boolean, boolean, boolean],
    originalChar: label === 'LETTERS' ? '⇧L' : '⇧F',
    shiftState: label === 'LETTERS' ? 'LETTERS' : 'FIGURES',
    isShiftCode: true,
    isValid: true,
    decodedChar: label === 'LETTERS' ? '⇧L' : '⇧F',
  };
}

function makeDataColumn(
  bits: [boolean, boolean, boolean, boolean, boolean],
  originalChar: string,
  shiftState: ShiftState
): EncodedColumn {
  return {
    bits: [...bits] as [boolean, boolean, boolean, boolean, boolean],
    originalChar,
    shiftState,
    isShiftCode: false,
    isValid: true,
    decodedChar: originalChar,
  };
}
