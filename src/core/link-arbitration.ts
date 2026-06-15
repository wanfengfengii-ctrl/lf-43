import type {
  MessagePriority,
  LinkConfig,
  QueuedMessage,
  LinkState,
  CollisionEvent,
  ArbitrationSessionStats,
  ArbitrationChatMessage,
  TimeoutStrategy,
  QueueStatus,
  TeletypeEnd,
} from '../types';

export const PRIORITY_WEIGHT: Record<MessagePriority, number> = {
  high: 3,
  normal: 2,
  low: 1,
};

export function getDefaultLinkConfig(): LinkConfig {
  return {
    bandwidthBps: 300,
    bufferSize: 10,
    defaultPriority: 'normal',
    timeoutStrategy: 'retry',
    timeoutMs: 30000,
    maxRetryAttempts: 3,
    collisionDetectEnabled: true,
    arbitrationMode: 'priority',
  };
}

export function getDefaultLinkState(): LinkState {
  return {
    isBusy: false,
    currentOwner: null,
    currentMessageId: null,
    utilizationPercent: 0,
    totalTransmitTimeMs: 0,
    totalIdleTimeMs: 0,
    totalCollisions: 0,
    totalArbitrations: 0,
  };
}

export function createQueuedMessage(
  chatMessageId: string,
  fromEnd: TeletypeEnd,
  toEnd: TeletypeEnd,
  originalText: string,
  priority: MessagePriority,
  totalColumns: number
): QueuedMessage {
  return {
    id: `q-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
    chatMessageId,
    fromEnd,
    toEnd,
    originalText,
    priority,
    queueStatus: 'queued',
    enqueueTime: Date.now(),
    dequeueTime: null,
    startTime: null,
    endTime: null,
    waitDurationMs: 0,
    transmitDurationMs: 0,
    totalDurationMs: 0,
    collisionCount: 0,
    retryCount: 0,
    deliveryOrder: null,
    transmissionPath: [fromEnd],
    lastEvent: '已加入发送队列',
    columnProgress: 0,
    totalColumns,
  };
}

function sortByPriority(a: QueuedMessage, b: QueuedMessage): number {
  const weightDiff = PRIORITY_WEIGHT[b.priority] - PRIORITY_WEIGHT[a.priority];
  if (weightDiff !== 0) return weightDiff;
  return a.enqueueTime - b.enqueueTime;
}

function sortByFIFO(a: QueuedMessage, b: QueuedMessage): number {
  return a.enqueueTime - b.enqueueTime;
}

function sortByRoundRobin(
  a: QueuedMessage,
  b: QueuedMessage,
  lastServedEnd: TeletypeEnd | null
): number {
  if (a.fromEnd === b.fromEnd) {
    return a.enqueueTime - b.enqueueTime;
  }
  if (!lastServedEnd) return a.enqueueTime - b.enqueueTime;
  return a.fromEnd === lastServedEnd ? 1 : -1;
}

export function arbitrateQueue(
  queue: QueuedMessage[],
  mode: LinkConfig['arbitrationMode'],
  lastServedEnd: TeletypeEnd | null
): QueuedMessage[] {
  const copy = [...queue];
  switch (mode) {
    case 'priority':
      return copy.sort(sortByPriority);
    case 'fifo':
      return copy.sort(sortByFIFO);
    case 'round_robin':
      return copy.sort((a, b) => sortByRoundRobin(a, b, lastServedEnd));
    default:
      return copy;
  }
}

export function detectCollision(queue: QueuedMessage[]): QueuedMessage[] | null {
  const statuses = queue.filter(
    q => q.queueStatus === 'transmitting' || q.queueStatus === 'arbitrating'
  );
  if (statuses.length > 1) {
    return statuses;
  }
  return null;
}

export function createCollisionEvent(
  conflictingMessages: QueuedMessage[]
): CollisionEvent {
  return {
    id: `col-${Date.now()}-${Math.random().toString(36).substr(2, 6)}`,
    timestamp: Date.now(),
    conflictingEnds: [...new Set(conflictingMessages.map(m => m.fromEnd))],
    messageIds: conflictingMessages.map(m => m.id),
    resolved: false,
    resolution: '待仲裁',
  };
}

export function resolveCollision(
  collision: CollisionEvent,
  messages: QueuedMessage[],
  mode: LinkConfig['arbitrationMode'],
  lastServedEnd: TeletypeEnd | null
): { winner: QueuedMessage | null; losers: QueuedMessage[] } {
  const candidates = messages.filter(m => collision.messageIds.includes(m.id));
  if (candidates.length === 0) {
    return { winner: null, losers: [] };
  }
  const sorted = arbitrateQueue(candidates, mode, lastServedEnd);
  const winner = sorted[0];
  const losers = sorted.slice(1);
  return { winner, losers };
}

export function applyTimeoutStrategy(
  msg: QueuedMessage,
  strategy: TimeoutStrategy,
  maxRetries: number
): QueuedMessage {
  const updated: QueuedMessage = { ...msg };
  switch (strategy) {
    case 'drop':
      updated.queueStatus = 'timeout';
      updated.lastEvent = '超时已丢弃';
      updated.endTime = Date.now();
      updated.totalDurationMs = updated.endTime - updated.enqueueTime;
      break;
    case 'retry':
      if (msg.retryCount < maxRetries) {
        updated.queueStatus = 'waiting_retry';
        updated.retryCount++;
        updated.lastEvent = `等待重试 (${updated.retryCount}/${maxRetries})`;
      } else {
        updated.queueStatus = 'timeout';
        updated.lastEvent = '超过最大重试次数，已丢弃';
        updated.endTime = Date.now();
        updated.totalDurationMs = updated.endTime - updated.enqueueTime;
      }
      break;
    case 'escalate':
      if (msg.priority !== 'high') {
        updated.priority = 'high';
        updated.queueStatus = 'queued';
        updated.lastEvent = '已升级为高优先级，重新排队';
      } else if (msg.retryCount < maxRetries) {
        updated.queueStatus = 'waiting_retry';
        updated.retryCount++;
        updated.lastEvent = `高优先级重试 (${updated.retryCount}/${maxRetries})`;
      } else {
        updated.queueStatus = 'timeout';
        updated.lastEvent = '高优先级重试耗尽，已丢弃';
        updated.endTime = Date.now();
        updated.totalDurationMs = updated.endTime - updated.enqueueTime;
      }
      break;
  }
  return updated;
}

export function updateLinkUtilization(
  state: LinkState,
  sessionStartTime: number
): LinkState {
  const now = Date.now();
  const totalSession = now - sessionStartTime;
  if (totalSession <= 0) return state;
  const utilization = Math.min(100, (state.totalTransmitTimeMs / totalSession) * 100);
  return {
    ...state,
    utilizationPercent: Math.round(utilization * 100) / 100,
  };
}

export function checkMessageTimeout(
  msg: QueuedMessage,
  timeoutMs: number
): boolean {
  return Date.now() - msg.enqueueTime > timeoutMs;
}

export function getPriorityLabel(p: MessagePriority): string {
  switch (p) {
    case 'high': return '高';
    case 'normal': return '普通';
    case 'low': return '低';
  }
}

export function getQueueStatusLabel(s: QueueStatus): string {
  switch (s) {
    case 'queued': return '排队中';
    case 'arbitrating': return '仲裁中';
    case 'transmitting': return '传输中';
    case 'collision': return '冲突';
    case 'waiting_retry': return '等待重试';
    case 'completed': return '已完成';
    case 'timeout': return '超时';
  }
}

export function getArbitrationModeLabel(m: LinkConfig['arbitrationMode']): string {
  switch (m) {
    case 'priority': return '优先级调度';
    case 'fifo': return '先入先出';
    case 'round_robin': return '轮询调度';
  }
}

export function getTimeoutStrategyLabel(s: TimeoutStrategy): string {
  switch (s) {
    case 'drop': return '丢弃';
    case 'retry': return '重试';
    case 'escalate': return '优先级升级';
  }
}

export function calculateArbitrationStats(
  messages: ArbitrationChatMessage[],
  linkState: LinkState,
  sessionStartTime: number
): ArbitrationSessionStats {
  const baseStats = {
    totalMessages: messages.length,
    totalChars: messages.reduce((s, m) => s + m.originalText.length, 0),
    totalErrors: messages.reduce((s, m) => s + m.errorPositions.length, 0),
    totalRetransmits: messages.reduce((s, m) => s + m.totalRetransmits, 0),
    averageSuccessRate: messages.length > 0
      ? messages.reduce((s, m) => s + m.successRate, 0) / messages.length
      : 0,
    messagesByEnd: {
      A: messages.filter(m => m.fromEnd === 'A').length,
      B: messages.filter(m => m.fromEnd === 'B').length,
    },
  };

  const completed = messages.filter(m => m.queueInfo.status === 'completed');
  const queueTimes = completed.map(m => m.queueInfo.waitDurationMs);
  const totalQueue = queueTimes.reduce((s, t) => s + t, 0);
  const maxQueue = queueTimes.length > 0 ? Math.max(...queueTimes) : 0;
  const avgQueue = queueTimes.length > 0 ? totalQueue / queueTimes.length : 0;

  const totalCollisions = messages.reduce((s, m) => s + m.queueInfo.collisionCount, 0);
  const totalRetries = messages.reduce((s, m) => s + m.queueInfo.retryCount, 0);

  let inOrder = 0;
  let outOfOrder = 0;
  let expectedOrder = 1;
  const sorted = [...completed].sort(
    (a, b) => (a.queueInfo.deliveryOrder || 0) - (b.queueInfo.deliveryOrder || 0)
  );
  sorted.forEach(m => {
    if (m.queueInfo.deliveryOrder === expectedOrder) {
      inOrder++;
    } else {
      outOfOrder++;
    }
    expectedOrder++;
  });

  const timeoutDrops = messages.filter(m => m.queueInfo.status === 'timeout').length;

  const now = Date.now();
  const totalSession = now - sessionStartTime;
  const utilization = totalSession > 0
    ? Math.min(100, (linkState.totalTransmitTimeMs / totalSession) * 100)
    : 0;

  return {
    ...baseStats,
    totalQueueTimeMs: totalQueue,
    avgQueueTimeMs: Math.round(avgQueue * 100) / 100,
    maxQueueTimeMs: maxQueue,
    totalCollisions,
    totalRetries,
    linkUtilizationPercent: Math.round(utilization * 100) / 100,
    messagesDeliveredInOrder: inOrder,
    messagesDeliveredOutOfOrder: outOfOrder,
    timeoutDrops,
  };
}

export function getStatusColor(status: QueueStatus): string {
  switch (status) {
    case 'queued': return '#8b8070';
    case 'arbitrating': return '#d4a030';
    case 'transmitting': return '#4a9eff';
    case 'collision': return '#c0392b';
    case 'waiting_retry': return '#e67e22';
    case 'completed': return '#2d8b46';
    case 'timeout': return '#7f8c8d';
  }
}

export function getPriorityColor(p: MessagePriority): string {
  switch (p) {
    case 'high': return '#c0392b';
    case 'normal': return '#d4a030';
    case 'low': return '#8b8070';
  }
}
