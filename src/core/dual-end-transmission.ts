import type {
  EncodedColumn,
  TransmissionColumnState,
  ShiftState,
  EndpointConfig,
  FaultInjectionType,
  ChatMessage,
  ChatSessionStats,
  DualEndCommunicationRecord,
  TeletypeEnd,
} from '../types';
import { encodeText } from './baudot-encoder';
import { decodeSingleColumn } from './baudot-decoder';

export function createTransmissionColumnStates(columns: EncodedColumn[]): TransmissionColumnState[] {
  return columns.map((col, index) => ({
    index,
    originalBits: [...col.bits] as [boolean, boolean, boolean, boolean, boolean],
    originalChar: col.originalChar,
    transmittedBits: [...col.bits] as [boolean, boolean, boolean, boolean, boolean],
    receivedBits: [...col.bits] as [boolean, boolean, boolean, boolean, boolean],
    status: 'pending',
    errorBitPositions: [],
    retransmitCount: 0,
    shiftState: col.shiftState,
    isShiftCode: col.isShiftCode,
    decodedChar: col.decodedChar,
  }));
}

export function applyFaultInjection(
  bits: [boolean, boolean, boolean, boolean, boolean],
  faultType: FaultInjectionType,
  faultParam: number,
  columnIndex: number
): [boolean, boolean, boolean, boolean, boolean] {
  const result = [...bits] as [boolean, boolean, boolean, boolean, boolean];

  switch (faultType) {
    case 'random_bit_flip': {
      const probability = Math.max(0, Math.min(1, faultParam));
      for (let i = 0; i < 5; i++) {
        if (Math.random() < probability) {
          result[i] = !result[i];
        }
      }
      break;
    }
    case 'stuck_bit_0': {
      const bitPosition = Math.floor(Math.max(0, Math.min(4, faultParam)));
      result[bitPosition] = false;
      break;
    }
    case 'stuck_bit_1': {
      const bitPosition = Math.floor(Math.max(0, Math.min(4, faultParam)));
      result[bitPosition] = true;
      break;
    }
    case 'burst_error': {
      const burstLength = Math.floor(Math.max(1, Math.min(5, faultParam)));
      const startBit = Math.floor(Math.random() * (5 - burstLength + 1));
      for (let i = startBit; i < startBit + burstLength; i++) {
        result[i] = !result[i];
      }
      break;
    }
    case 'none':
    default:
      break;
  }

  return result;
}

export function transmitColumn(
  column: TransmissionColumnState,
  config: EndpointConfig,
  columnIndex: number
): {
  receivedBits: [boolean, boolean, boolean, boolean, boolean];
  errorPositions: number[];
  isCorrupted: boolean;
} {
  let transmittedBits = [...column.originalBits] as [boolean, boolean, boolean, boolean, boolean];

  if (config.noiseLevel > 0) {
    const noiseProb = Math.max(0, Math.min(1, config.noiseLevel));
    transmittedBits = transmittedBits.map(bit => {
      if (Math.random() < noiseProb) {
        return !bit;
      }
      return bit;
    }) as [boolean, boolean, boolean, boolean, boolean];
  }

  if (config.faultType !== 'none') {
    transmittedBits = applyFaultInjection(transmittedBits, config.faultType, config.faultParam, columnIndex);
  }

  const errorPositions: number[] = [];
  for (let i = 0; i < 5; i++) {
    if (transmittedBits[i] !== column.originalBits[i]) {
      errorPositions.push(i);
    }
  }

  return {
    receivedBits: transmittedBits,
    errorPositions,
    isCorrupted: errorPositions.length > 0,
  };
}

export function processReceivedColumn(
  column: TransmissionColumnState,
  receivedBits: [boolean, boolean, boolean, boolean, boolean],
  errorPositions: number[],
  currentShiftState: ShiftState
): {
  column: TransmissionColumnState;
  newShiftState: ShiftState;
  needsRetransmit: boolean;
} {
  const isCorrupted = errorPositions.length > 0;
  const { decodedChar, newShiftState } = decodeSingleColumn(receivedBits, currentShiftState);

  const updatedColumn: TransmissionColumnState = {
    ...column,
    receivedBits,
    errorBitPositions: errorPositions,
    transmittedBits: receivedBits,
    decodedChar,
    status: isCorrupted ? 'corrupted' : 'correct',
  };

  return {
    column: updatedColumn,
    newShiftState,
    needsRetransmit: isCorrupted,
  };
}

export function buildReceivedText(columns: TransmissionColumnState[]): string {
  return columns
    .filter(col => !col.isShiftCode)
    .map(col => {
      const char = col.decodedChar || '□';
      if (char === '↵') return '\n';
      if (char === '←') return '\r';
      return char;
    })
    .join('');
}

export function getErrorPositions(columns: TransmissionColumnState[]): number[] {
  return columns
    .filter(col => col.status === 'corrupted')
    .map(col => col.index);
}

export function calculateSuccessRate(columns: TransmissionColumnState[]): number {
  if (columns.length === 0) return 100;
  const correctCount = columns.filter(col => col.status === 'correct').length;
  return (correctCount / columns.length) * 100;
}

export function getTotalRetransmits(columns: TransmissionColumnState[]): number {
  return columns.reduce((sum, col) => sum + col.retransmitCount, 0);
}

export function createChatMessage(
  fromEnd: TeletypeEnd,
  toEnd: TeletypeEnd,
  text: string,
  senderConfig: EndpointConfig,
  receiverConfig: EndpointConfig
): ChatMessage {
  const encodedColumns = encodeText(text);
  const transmissionColumns = createTransmissionColumnStates(encodedColumns);

  return {
    id: `msg-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
    fromEnd,
    toEnd,
    originalText: text,
    sentColumns: transmissionColumns,
    receivedText: '',
    errorPositions: [],
    totalRetransmits: 0,
    successRate: 0,
    timestamp: Date.now(),
    status: 'sending',
    configSnapshot: {
      sender: { ...senderConfig },
      receiver: { ...receiverConfig },
    },
  };
}

export function calculateSessionStats(messages: ChatMessage[]): ChatSessionStats {
  const totalMessages = messages.length;
  const totalChars = messages.reduce((sum, msg) => sum + msg.originalText.length, 0);
  const totalErrors = messages.reduce((sum, msg) => sum + msg.errorPositions.length, 0);
  const totalRetransmits = messages.reduce((sum, msg) => sum + msg.totalRetransmits, 0);
  const avgSuccessRate = totalMessages > 0
    ? messages.reduce((sum, msg) => sum + msg.successRate, 0) / totalMessages
    : 0;

  const messagesByEnd: Record<TeletypeEnd, number> = {
    A: messages.filter(m => m.fromEnd === 'A').length,
    B: messages.filter(m => m.fromEnd === 'B').length,
  };

  return {
    totalMessages,
    totalChars,
    totalErrors,
    totalRetransmits,
    averageSuccessRate: avgSuccessRate,
    messagesByEnd,
  };
}

export function createCommunicationRecord(
  sessionId: string,
  messages: ChatMessage[],
  configHistory: { timestamp: number; end: TeletypeEnd; config: EndpointConfig }[]
): DualEndCommunicationRecord {
  const stats = calculateSessionStats(messages);
  const now = Date.now();

  return {
    sessionId,
    startTime: messages.length > 0 ? messages[0].timestamp : now,
    endTime: now,
    messages: [...messages],
    stats,
    configHistory: [...configHistory],
  };
}

export function getDefaultEndpointConfig(): EndpointConfig {
  return {
    noiseLevel: 0,
    transmissionSpeed: 1,
    faultType: 'none',
    faultParam: 0,
    enableAutoRetransmit: false,
    maxRetransmitAttempts: 3,
  };
}

export function getFaultTypeLabel(type: FaultInjectionType): string {
  switch (type) {
    case 'none': return '无故障';
    case 'random_bit_flip': return '随机位翻转';
    case 'stuck_bit_0': return '固定位为0';
    case 'stuck_bit_1': return '固定位为1';
    case 'burst_error': return '突发错误';
    default: return type;
  }
}

export function getFaultTypeDescription(type: FaultInjectionType): string {
  switch (type) {
    case 'none': return '不注入任何故障';
    case 'random_bit_flip': return '按概率随机翻转数据位';
    case 'stuck_bit_0': return '指定数据位始终为0';
    case 'stuck_bit_1': return '指定数据位始终为1';
    case 'burst_error': return '连续多位同时翻转';
    default: return '';
  }
}
