import type { EncodedColumn, ShiftState } from '../types';
import { BITS_TO_LETTERS, BITS_TO_FIGURES } from './baudot-table';

export function decodeColumns(columns: EncodedColumn[]): EncodedColumn[] {
  let shiftState: ShiftState = 'LETTERS';
  const result: EncodedColumn[] = [];

  for (let i = 0; i < columns.length; i++) {
    const col = columns[i];
    const key = col.bits.map(b => (b ? '1' : '0')).join('');

    if (key === '11111') {
      shiftState = 'LETTERS';
      result.push({
        ...col,
        shiftState,
        isShiftCode: true,
        isValid: true,
        decodedChar: '⇧L',
      });
    } else if (key === '11011') {
      shiftState = 'FIGURES';
      result.push({
        ...col,
        shiftState,
        isShiftCode: true,
        isValid: true,
        decodedChar: '⇧F',
      });
    } else {
      const map = shiftState === 'LETTERS' ? BITS_TO_LETTERS : BITS_TO_FIGURES;
      const decoded = map.get(key);

      if (decoded === null || decoded === undefined) {
        result.push({
          ...col,
          shiftState,
          isShiftCode: false,
          isValid: false,
          decodedChar: null,
        });
      } else if (decoded === 'WRU' || decoded === 'BELL') {
        result.push({
          ...col,
          shiftState,
          isShiftCode: false,
          isValid: true,
          decodedChar: decoded,
        });
      } else if (decoded.length === 1) {
        let displayChar = decoded;
        if (decoded === '\n') displayChar = '↵';
        if (decoded === '\r') displayChar = '←';
        result.push({
          ...col,
          shiftState,
          isShiftCode: false,
          isValid: true,
          decodedChar: displayChar,
        });
      } else {
        result.push({
          ...col,
          shiftState,
          isShiftCode: true,
          isValid: true,
          decodedChar: decoded,
        });
      }
    }
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
