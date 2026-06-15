export type ShiftState = 'LETTERS' | 'FIGURES';

export interface BaudotCodeEntry {
  bits: [boolean, boolean, boolean, boolean, boolean];
  lettersChar: string | null;
  figuresChar: string | null;
}

export interface EncodedColumn {
  bits: [boolean, boolean, boolean, boolean, boolean];
  originalChar: string;
  shiftState: ShiftState;
  isShiftCode: boolean;
  isValid: boolean;
  decodedChar: string | null;
  corrupted?: boolean;
}

export interface BitsChangedDetail {
  index: number;
  bits: [boolean, boolean, boolean, boolean, boolean];
}

export interface PlaybackControlDetail {
  action: 'play' | 'pause' | 'reset';
  position?: number;
}

export type TransmissionPhase = 'idle' | 'transmitting' | 'paused' | 'finished';

export type ColumnStatus = 'pending' | 'transmitted' | 'corrupted' | 'repaired';

export interface TransmissionColumnHistory {
  index: number;
  originalBits: [boolean, boolean, boolean, boolean, boolean];
  originalChar: string;
  receivedBits: [boolean, boolean, boolean, boolean, boolean];
  repairedBits?: [boolean, boolean, boolean, boolean, boolean];
  status: ColumnStatus;
  shiftState: ShiftState;
  isShiftCode: boolean;
  receivedDecodedChar: string | null;
  repairedDecodedChar?: string | null;
  noiseInjected: boolean;
  errorBitPositions: number[];
  repairedErrorBitPositions?: number[];
}

export interface TransmissionReport {
  originalText: string;
  encodedBits: string;
  totalColumns: number;
  corruptedColumns: number;
  repairedColumns: number;
  unrepairableColumns: number;
  correctColumns: number;
  accuracy: number;
  damageLocations: { index: number; originalChar: string; errorBits: number[] }[];
  repairResults: { index: number; originalChar: string; beforeChar: string | null; afterChar: string | null; success: boolean }[];
  finalDecodedText: string;
  timestamp: number;
}
