import type { EncodedColumn, TransmissionColumnHistory, ColumnStatus, ShiftState, TransmissionReport } from '../types';
import { decodeColumn, decodeSingleColumn } from './baudot-decoder';

export function createTransmissionHistory(columns: EncodedColumn[]): TransmissionColumnHistory[] {
  return columns.map((col, index) => ({
    index,
    originalBits: [...col.bits] as [boolean, boolean, boolean, boolean, boolean],
    originalChar: col.originalChar,
    receivedBits: [...col.bits] as [boolean, boolean, boolean, boolean, boolean],
    status: 'pending' as ColumnStatus,
    shiftState: col.shiftState,
    isShiftCode: col.isShiftCode,
    receivedDecodedChar: col.decodedChar,
    noiseInjected: false,
    errorBitPositions: [],
  }));
}

export function injectNoiseToColumn(
  history: TransmissionColumnHistory,
  noiseLevel: number
): TransmissionColumnHistory {
  const clamped = Math.max(0, Math.min(1, noiseLevel));
  if (clamped === 0) return history;

  const newBits = history.originalBits.map((bit, i) => {
    if (Math.random() < clamped) {
      return !bit;
    }
    return bit;
  }) as [boolean, boolean, boolean, boolean, boolean];

  const errorPositions: number[] = [];
  newBits.forEach((bit, i) => {
    if (bit !== history.originalBits[i]) {
      errorPositions.push(i);
    }
  });

  const isCorrupted = errorPositions.length > 0;

  return {
    ...history,
    receivedBits: newBits,
    status: isCorrupted ? 'corrupted' : 'transmitted',
    noiseInjected: isCorrupted,
    errorBitPositions: errorPositions,
  };
}

export function repairColumn(
  history: TransmissionColumnHistory,
  repairedBits: [boolean, boolean, boolean, boolean, boolean]
): TransmissionColumnHistory {
  const repairedErrorPositions: number[] = [];
  repairedBits.forEach((bit, i) => {
    if (bit !== history.originalBits[i]) {
      repairedErrorPositions.push(i);
    }
  });

  const isFullyRepaired = repairedErrorPositions.length === 0;

  return {
    ...history,
    repairedBits,
    repairedErrorBitPositions: repairedErrorPositions,
    status: isFullyRepaired ? 'repaired' : 'corrupted',
  };
}

export function getErrorBitPositions(
  original: [boolean, boolean, boolean, boolean, boolean],
  received: [boolean, boolean, boolean, boolean, boolean]
): number[] {
  const positions: number[] = [];
  for (let i = 0; i < 5; i++) {
    if (original[i] !== received[i]) {
      positions.push(i);
    }
  }
  return positions;
}

export function generateTransmissionReport(
  originalText: string,
  history: TransmissionColumnHistory[]
): TransmissionReport {
  const totalColumns = history.length;
  const corruptedColumns = history.filter(h => h.status === 'corrupted' || h.status === 'repaired').length;
  const repairedColumns = history.filter(h => h.status === 'repaired').length;
  const unrepairableColumns = history.filter(h => h.status === 'corrupted').length;
  const correctColumns = history.filter(h => {
    if (h.isShiftCode) return true;
    if (h.status === 'transmitted') return true;
    if (h.status === 'repaired') return true;
    return false;
  }).length;

  const accuracy = totalColumns > 0 ? (correctColumns / totalColumns) * 100 : 0;

  const damageLocations = history
    .filter(h => h.errorBitPositions.length > 0)
    .map(h => ({
      index: h.index,
      originalChar: h.originalChar,
      errorBits: h.errorBitPositions,
    }));

  const repairResults = history
    .filter(h => h.repairedBits !== undefined)
    .map(h => {
      const beforeChar = h.receivedDecodedChar;
      const afterChar = h.repairedDecodedChar;
      const success = h.status === 'repaired';
      return {
        index: h.index,
        originalChar: h.originalChar,
        beforeChar,
        afterChar: afterChar || null,
        success,
      };
    });

  const encodedBits = history.map(h => h.originalBits.map(b => (b ? '1' : '0')).join('')).join(' ');

  const finalDecodedText = history
    .filter(h => !h.isShiftCode)
    .map(h => {
      const char = h.repairedDecodedChar !== undefined ? h.repairedDecodedChar : h.receivedDecodedChar;
      if (char === '↵') return '\n';
      if (char === '←') return '\r';
      return char || '□';
    })
    .join('');

  return {
    originalText,
    encodedBits,
    totalColumns,
    corruptedColumns,
    repairedColumns,
    unrepairableColumns,
    correctColumns,
    accuracy,
    damageLocations,
    repairResults,
    finalDecodedText,
    timestamp: Date.now(),
  };
}
