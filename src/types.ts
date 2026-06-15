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
  repairResults: {
    index: number;
    originalChar: string;
    beforeChar: string | null;
    afterChar: string | null;
    success: boolean;
    originalBits: [boolean, boolean, boolean, boolean, boolean];
    beforeBits: [boolean, boolean, boolean, boolean, boolean];
    afterBits: [boolean, boolean, boolean, boolean, boolean];
    changedBits: number[];
  }[];
  finalDecodedText: string;
  timestamp: number;
}

export type TeletypeEnd = 'A' | 'B';
export type FaultInjectionType = 'random_bit_flip' | 'stuck_bit_0' | 'stuck_bit_1' | 'burst_error' | 'none';

export interface EndpointConfig {
  noiseLevel: number;
  transmissionSpeed: number;
  faultType: FaultInjectionType;
  faultParam: number;
  enableAutoRetransmit: boolean;
  maxRetransmitAttempts: number;
}

export interface TransmissionColumnState {
  index: number;
  originalBits: [boolean, boolean, boolean, boolean, boolean];
  originalChar: string;
  transmittedBits: [boolean, boolean, boolean, boolean, boolean];
  receivedBits: [boolean, boolean, boolean, boolean, boolean];
  status: 'pending' | 'transmitting' | 'corrupted' | 'correct' | 'retransmitting';
  errorBitPositions: number[];
  retransmitCount: number;
  shiftState: ShiftState;
  isShiftCode: boolean;
  decodedChar: string | null;
}

export interface ChatMessage {
  id: string;
  fromEnd: TeletypeEnd;
  toEnd: TeletypeEnd;
  originalText: string;
  sentColumns: TransmissionColumnState[];
  receivedText: string;
  errorPositions: number[];
  totalRetransmits: number;
  successRate: number;
  timestamp: number;
  status: 'sending' | 'sent' | 'failed';
  configSnapshot: {
    sender: EndpointConfig;
    receiver: EndpointConfig;
  };
}

export interface ChatSessionStats {
  totalMessages: number;
  totalChars: number;
  totalErrors: number;
  totalRetransmits: number;
  averageSuccessRate: number;
  messagesByEnd: Record<TeletypeEnd, number>;
}

export interface DualEndCommunicationRecord {
  sessionId: string;
  startTime: number;
  endTime: number;
  messages: ChatMessage[];
  stats: ChatSessionStats;
  configHistory: {
    timestamp: number;
    end: TeletypeEnd;
    config: EndpointConfig;
  }[];
}
