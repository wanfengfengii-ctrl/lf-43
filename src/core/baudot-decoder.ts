import type { EncodedColumn, ShiftState } from '../types';
import { BITS_TO_LETTERS, BITS_TO_FIGURES } from './baudot-table';

export function decodeColumn(col: EncodedColumn, shiftState: ShiftState): { column: EncodedColumn; newShiftState: ShiftState } {
  const key = col.bits.map(b => (b ? '1' : '0')).join('');
  let newShiftState = shiftState;

  if (key === '11111') {
    newShiftState = 'LETTERS';
    return {
      column: {
        ...col,
        shiftState: newShiftState,
        isShiftCode: true,
        isValid: true,
        decodedChar: '⇧L',
      },
      newShiftState,
    };
  } else if (key === '11011') {
    newShiftState = 'FIGURES';
    return {
      column: {
        ...col,
        shiftState: newShiftState,
        isShiftCode: true,
        isValid: true,
        decodedChar: '⇧F',
      },
      newShiftState,
    };
  } else {
    const map = shiftState === 'LETTERS' ? BITS_TO_LETTERS : BITS_TO_FIGURES;
    const decoded = map.get(key);

    if (decoded === null || decoded === undefined) {
      return {
        column: {
          ...col,
          shiftState,
          isShiftCode: false,
          isValid: false,
          decodedChar: null,
        },
        newShiftState,
      };
    } else if (decoded === 'WRU' || decoded === 'BELL') {
      return {
        column: {
          ...col,
          shiftState,
          isShiftCode: false,
          isValid: true,
          decodedChar: decoded,
        },
        newShiftState,
      };
    } else if (decoded.length === 1) {
      let displayChar = decoded;
      if (decoded === '\n') displayChar = '↵';
      if (decoded === '\r') displayChar = '←';
      return {
        column: {
          ...col,
          shiftState,
          isShiftCode: false,
          isValid: true,
          decodedChar: displayChar,
        },
        newShiftState,
      };
    } else {
      return {
        column: {
          ...col,
          shiftState,
          isShiftCode: true,
          isValid: true,
          decodedChar: decoded,
        },
        newShiftState,
      };
    }
  }
}

export function decodeSingleColumn(bits: [boolean, boolean, boolean, boolean, boolean], shiftState: ShiftState): { decodedChar: string | null; isValid: boolean; isShiftCode: boolean; newShiftState: ShiftState } {
  const key = bits.map(b => (b ? '1' : '0')).join('');
  let newShiftState = shiftState;

  if (key === '11111') {
    return { decodedChar: '⇧L', isValid: true, isShiftCode: true, newShiftState: 'LETTERS' };
  } else if (key === '11011') {
    return { decodedChar: '⇧F', isValid: true, isShiftCode: true, newShiftState: 'FIGURES' };
  } else {
    const map = shiftState === 'LETTERS' ? BITS_TO_LETTERS : BITS_TO_FIGURES;
    const decoded = map.get(key);

    if (decoded === null || decoded === undefined) {
      return { decodedChar: null, isValid: false, isShiftCode: false, newShiftState };
    } else if (decoded === 'WRU' || decoded === 'BELL') {
      return { decodedChar: decoded, isValid: true, isShiftCode: false, newShiftState };
    } else if (decoded.length === 1) {
      let displayChar = decoded;
      if (decoded === '\n') displayChar = '↵';
      if (decoded === '\r') displayChar = '←';
      return { decodedChar: displayChar, isValid: true, isShiftCode: false, newShiftState };
    } else {
      return { decodedChar: decoded, isValid: true, isShiftCode: true, newShiftState };
    }
  }
}

export function decodeColumns(columns: EncodedColumn[]): EncodedColumn[] {
  let shiftState: ShiftState = 'LETTERS';
  const result: EncodedColumn[] = [];

  for (let i = 0; i < columns.length; i++) {
    const { column, newShiftState } = decodeColumn(columns[i], shiftState);
    shiftState = newShiftState;
    result.push(column);
  }

  return result;
}

export function getDecodedText(columns: EncodedColumn[]): string {
  return columns
    .filter(c => !c.isShiftCode && c.isValid && c.decodedChar)
    .map(c => {
      if (c.decodedChar === '↵') return '\n';
      if (c.decodedChar === '←') return '\r';
      return c.decodedChar!;
    })
    .join('');
}
