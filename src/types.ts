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
