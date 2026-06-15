import { LitElement, html, css, nothing } from 'lit';
import { customElement, property, state, query } from 'lit/decorators.js';
import type {
  TransmissionColumnState,
  ShiftState,
  EndpointConfig,
  ChatMessage,
  TeletypeEnd,
  FaultInjectionType,
  DualEndCommunicationRecord,
} from '../types';
import {
  transmitColumn,
  processReceivedColumn,
  buildReceivedText,
  getErrorPositions,
  calculateSuccessRate,
  getTotalRetransmits,
  createChatMessage,
  getDefaultEndpointConfig,
  getFaultTypeLabel,
  getFaultTypeDescription,
  createCommunicationRecord,
  calculateSessionStats,
} from '../core/dual-end-transmission';
import { encodeText, filterText } from '../core/baudot-encoder';
import { decodeSingleColumn } from '../core/baudot-decoder';
import { sharedStyles } from '../styles';

const HOLE_RADIUS = 12;

@customElement('teletype-chatroom')
export class TeletypeChatroom extends LitElement {
  static styles = [
    sharedStyles,
    css`
      :host {
        display: block;
      }
      .chatroom-container {
        display: grid;
        grid-template-columns: 1fr 1fr;
        gap: 16px;
      }
      @media (max-width: 1200px) {
        .chatroom-container {
          grid-template-columns: 1fr;
        }
      }
      .terminal-panel {
        display: flex;
        flex-direction: column;
        gap: 12px;
      }
      .terminal-header {
        display: flex;
        align-items: center;
        justify-content: space-between;
        padding: 8px 12px;
        background: rgba(0, 0, 0, 0.3);
        border-radius: 6px;
        border: 1px solid #3d3428;
      }
      .terminal-title {
        font-family: 'Share Tech Mono', monospace;
        font-size: 14px;
        font-weight: 700;
        letter-spacing: 2px;
        text-transform: uppercase;
      }
      .terminal-a .terminal-title { color: #4a9eff; }
      .terminal-b .terminal-title { color: #ff6b6b; }
      .shift-indicator {
        display: flex;
        align-items: center;
        gap: 6px;
      }
      .shift-badge {
        padding: 2px 8px;
        border-radius: 3px;
        font-weight: 600;
        font-size: 10px;
        text-transform: uppercase;
        letter-spacing: 1px;
      }
      .shift-badge.letters {
        background: rgba(45, 139, 70, 0.2);
        color: #2d8b46;
        border: 1px solid #2d8b46;
      }
      .shift-badge.figures {
        background: rgba(212, 160, 48, 0.2);
        color: #d4a030;
        border: 1px solid #d4a030;
      }
      .tape-display {
        background: #f5f0e8;
        border-radius: 6px;
        padding: 12px;
        min-height: 80px;
        overflow-x: auto;
        display: flex;
        gap: 2px;
        align-items: center;
        border: 1px solid #c8c0b0;
      }
      .tape-column {
        display: flex;
        flex-direction: column;
        gap: 2px;
        padding: 4px 2px;
        border-radius: 2px;
        transition: all 0.15s ease;
      }
      .tape-column.transmitting {
        background: rgba(212, 160, 48, 0.3);
        animation: pulse 0.5s ease-in-out infinite;
      }
      .tape-column.corrupted {
        background: rgba(192, 57, 43, 0.3);
      }
      .tape-column.correct {
        background: rgba(45, 139, 70, 0.2);
      }
      @keyframes pulse {
        0%, 100% { opacity: 1; }
        50% { opacity: 0.6; }
      }
      .tape-hole {
        width: 14px;
        height: 14px;
        border-radius: 50%;
        border: 1px solid #8b8070;
      }
      .tape-hole.punched {
        background: #1a1410;
        border-color: #1a1410;
      }
      .tape-hole.unpunched {
        background: #e8e0d0;
      }
      .tape-hole.error {
        box-shadow: 0 0 0 2px rgba(192, 57, 43, 0.6);
        border-color: #c0392b !important;
      }
      .decoded-display {
        background: #0d0b08;
        border-radius: 6px;
        padding: 12px;
        min-height: 60px;
        font-family: 'IBM Plex Mono', monospace;
        font-size: 14px;
        line-height: 1.6;
        white-space: pre-wrap;
        word-break: break-all;
        color: #c8c0b0;
        border: 1px solid #3d3428;
      }
      .decoded-display .error {
        color: #c0392b;
        background: rgba(192, 57, 43, 0.15);
        padding: 1px 2px;
        border-radius: 2px;
      }
      .input-area {
        display: flex;
        gap: 8px;
      }
      .input-area textarea {
        flex: 1;
        background: #0d0b08;
        border: 1px solid #3d3428;
        border-radius: 4px;
        color: #f5f0e8;
        padding: 8px 12px;
        font-family: 'IBM Plex Mono', monospace;
        font-size: 13px;
        resize: none;
        min-height: 60px;
      }
      .input-area textarea:focus {
        outline: none;
        border-color: #d4a030;
        box-shadow: 0 0 0 2px rgba(212, 160, 48, 0.2);
      }
      .send-button {
        align-self: flex-end;
        padding: 10px 20px;
      }
      .config-section {
        background: rgba(0, 0, 0, 0.2);
        border-radius: 6px;
        padding: 12px;
        border: 1px solid #2a2318;
      }
      .config-row {
        display: flex;
        align-items: center;
        gap: 12px;
        margin-bottom: 10px;
      }
      .config-row:last-child {
        margin-bottom: 0;
      }
      .config-row .label {
        min-width: 80px;
        margin-bottom: 0;
      }
      .config-row sl-range {
        flex: 1;
        --sl-color-primary-600: #d4a030;
        --sl-color-primary-500: #d4a030;
      }
      .config-row .value {
        min-width: 50px;
        text-align: right;
        font-family: 'Share Tech Mono', monospace;
        font-size: 12px;
        color: #d4a030;
      }
      select {
        background: #1a1410;
        border: 1px solid #3d3428;
        border-radius: 4px;
        color: #f5f0e8;
        padding: 4px 8px;
        font-family: 'IBM Plex Mono', monospace;
        font-size: 12px;
        flex: 1;
      }
      select:focus {
        outline: none;
        border-color: #d4a030;
      }
      .checkbox-row {
        display: flex;
        align-items: center;
        gap: 8px;
        cursor: pointer;
      }
      .checkbox-row input[type="checkbox"] {
        width: 16px;
        height: 16px;
        accent-color: #d4a030;
      }
      .transmission-line {
        grid-column: 1 / -1;
        display: flex;
        align-items: center;
        justify-content: center;
        padding: 20px;
        background: rgba(0, 0, 0, 0.2);
        border-radius: 8px;
        border: 1px dashed #3d3428;
        min-height: 80px;
      }
      .transmission-content {
        display: flex;
        align-items: center;
        gap: 16px;
      }
      .transmission-arrow {
        font-size: 24px;
        color: #d4a030;
        animation: arrowPulse 0.8s ease-in-out infinite;
      }
      @keyframes arrowPulse {
        0%, 100% { transform: translateX(0); opacity: 1; }
        50% { transform: translateX(10px); opacity: 0.5; }
      }
      .transmission-info {
        text-align: center;
        font-family: 'Share Tech Mono', monospace;
      }
      .transmission-info .status {
        font-size: 12px;
        color: #8b8070;
        text-transform: uppercase;
        letter-spacing: 1px;
      }
      .transmission-info .detail {
        font-size: 18px;
        color: #d4a030;
        font-weight: 700;
        margin-top: 4px;
      }
      .transmission-info .detail.sending-a { color: #4a9eff; }
      .transmission-info .detail.sending-b { color: #ff6b6b; }
      .chat-history {
        grid-column: 1 / -1;
        max-height: 400px;
        overflow-y: auto;
        scrollbar-width: thin;
        scrollbar-color: #d4a030 #1a1410;
      }
      .chat-history::-webkit-scrollbar {
        width: 6px;
      }
      .chat-history::-webkit-scrollbar-track {
        background: #1a1410;
        border-radius: 3px;
      }
      .chat-history::-webkit-scrollbar-thumb {
        background: #d4a030;
        border-radius: 3px;
      }
      .chat-message {
        margin-bottom: 12px;
        padding: 12px;
        border-radius: 6px;
        border: 1px solid #3d3428;
        background: rgba(0, 0, 0, 0.2);
      }
      .chat-message.sent-a {
        border-left: 3px solid #4a9eff;
      }
      .chat-message.sent-b {
        border-left: 3px solid #ff6b6b;
      }
      .chat-message-header {
        display: flex;
        justify-content: space-between;
        align-items: center;
        margin-bottom: 8px;
        font-size: 11px;
        color: #8b8070;
      }
      .chat-message-header .sender {
        font-weight: 600;
        text-transform: uppercase;
        letter-spacing: 1px;
      }
      .chat-message.sent-a .sender { color: #4a9eff; }
      .chat-message.sent-b .sender { color: #ff6b6b; }
      .chat-message-stats {
        display: flex;
        gap: 16px;
        font-size: 10px;
        color: #8b8070;
        margin-top: 8px;
        padding-top: 8px;
        border-top: 1px solid #2a2318;
      }
      .chat-message-stats .stat {
        display: flex;
        align-items: center;
        gap: 4px;
      }
      .chat-message-stats .stat .num {
        font-weight: 600;
        color: #f5f0e8;
        font-family: 'Share Tech Mono', monospace;
      }
      .chat-message-stats .stat.success .num { color: #2d8b46; }
      .chat-message-stats .stat.error .num { color: #c0392b; }
      .chat-message-stats .stat.retransmit .num { color: #d4a030; }
      .original-text, .received-text {
        font-family: 'IBM Plex Mono', monospace;
        font-size: 13px;
        line-height: 1.5;
        white-space: pre-wrap;
        word-break: break-all;
      }
      .original-text {
        color: #8b8070;
        margin-bottom: 4px;
        font-size: 11px;
      }
      .received-text {
        color: #f5f0e8;
      }
      .received-text .error {
        color: #c0392b;
        background: rgba(192, 57, 43, 0.15);
        padding: 1px 2px;
        border-radius: 2px;
      }
      .session-controls {
        grid-column: 1 / -1;
        display: flex;
        justify-content: space-between;
        align-items: center;
        padding: 12px;
        background: rgba(0, 0, 0, 0.2);
        border-radius: 6px;
        border: 1px solid #3d3428;
      }
      .session-stats {
        display: flex;
        gap: 20px;
        font-size: 12px;
      }
      .session-stats .stat {
        display: flex;
        flex-direction: column;
        align-items: center;
      }
      .session-stats .stat .label {
        color: #8b8070;
        font-size: 10px;
        text-transform: uppercase;
        letter-spacing: 1px;
      }
      .session-stats .stat .value {
        font-family: 'Share Tech Mono', monospace;
        font-size: 16px;
        font-weight: 700;
        color: #d4a030;
      }
      .report-modal {
        position: fixed;
        top: 0;
        left: 0;
        right: 0;
        bottom: 0;
        background: rgba(0, 0, 0, 0.8);
        display: flex;
        align-items: center;
        justify-content: center;
        z-index: 1000;
        padding: 20px;
      }
      .report-content {
        background: #1e1a12;
        border: 2px solid #3d3428;
        border-radius: 10px;
        padding: 24px;
        max-width: 900px;
        width: 100%;
        max-height: 85vh;
        overflow-y: auto;
      }
      .report-content h2 {
        color: #d4a030;
        margin-top: 0;
        font-family: 'Share Tech Mono', monospace;
        letter-spacing: 2px;
      }
      .report-section {
        margin-bottom: 20px;
      }
      .report-section h3 {
        color: #8b8070;
        font-size: 12px;
        text-transform: uppercase;
        letter-spacing: 1px;
        margin-bottom: 8px;
        border-bottom: 1px solid #3d3428;
        padding-bottom: 4px;
      }
      .report-stats {
        display: grid;
        grid-template-columns: repeat(4, 1fr);
        gap: 10px;
      }
      .report-stat {
        background: rgba(0, 0, 0, 0.3);
        padding: 10px;
        border-radius: 6px;
        text-align: center;
      }
      .report-stat .value {
        font-size: 24px;
        font-weight: 700;
        font-family: 'Share Tech Mono', monospace;
        color: #f5f0e8;
      }
      .report-stat .label {
        font-size: 10px;
        color: #8b8070;
        text-transform: uppercase;
        letter-spacing: 1px;
        margin-top: 4px;
      }
      .report-stat.accuracy .value { color: #2d8b46; }
      .report-stat.errors .value { color: #c0392b; }
      .report-stat.retransmits .value { color: #d4a030; }
      .message-list {
        display: flex;
        flex-direction: column;
        gap: 12px;
      }
      .message-detail {
        background: rgba(0, 0, 0, 0.25);
        border: 1px solid #3d3428;
        border-radius: 6px;
        padding: 12px;
      }
      .message-detail-header {
        display: flex;
        justify-content: space-between;
        align-items: center;
        margin-bottom: 8px;
        font-size: 11px;
      }
      .message-detail-header .sender {
        font-weight: 600;
        text-transform: uppercase;
        letter-spacing: 1px;
      }
      .message-detail.sent-a .sender { color: #4a9eff; }
      .message-detail.sent-b .sender { color: #ff6b6b; }
      .text-comparison {
        display: grid;
        grid-template-columns: 1fr 1fr;
        gap: 12px;
        margin-bottom: 8px;
      }
      .text-block {
        background: #0d0b08;
        padding: 8px;
        border-radius: 4px;
        font-family: 'IBM Plex Mono', monospace;
        font-size: 12px;
        line-height: 1.5;
        white-space: pre-wrap;
        word-break: break-all;
      }
      .text-block .label {
        font-size: 10px;
        color: #8b8070;
        text-transform: uppercase;
        letter-spacing: 1px;
        margin-bottom: 4px;
      }
      .text-block .content {
        color: #f5f0e8;
      }
      .text-block .content .error {
        color: #c0392b;
        background: rgba(192, 57, 43, 0.15);
        padding: 1px 2px;
        border-radius: 2px;
      }
      .error-detail-list {
        list-style: none;
        padding: 0;
        margin: 0;
        font-size: 11px;
        font-family: 'IBM Plex Mono', monospace;
      }
      .error-detail-list li {
        padding: 2px 4px;
        border-bottom: 1px solid #2a2318;
        display: flex;
        justify-content: space-between;
        color: #8b8070;
      }
      .error-detail-list li .col {
        color: #c0392b;
      }
      .modal-actions {
        display: flex;
        gap: 8px;
        justify-content: flex-end;
        margin-top: 16px;
      }
      .live-column-display {
        display: flex;
        justify-content: center;
        gap: 40px;
        padding: 12px;
        background: rgba(0, 0, 0, 0.15);
        border-radius: 6px;
        border: 1px solid #2a2318;
      }
      .column-view {
        display: flex;
        flex-direction: column;
        align-items: center;
        gap: 6px;
      }
      .column-view .label {
        font-size: 10px;
        text-transform: uppercase;
        letter-spacing: 1px;
        color: #8b8070;
      }
      .column-view .char-display {
        font-size: 24px;
        font-weight: 700;
        font-family: 'Share Tech Mono', monospace;
        min-height: 32px;
      }
      .column-view.sender .char-display { color: #4a9eff; }
      .column-view.receiver .char-display { color: #ff6b6b; }
      .column-view.receiver .char-display.error { color: #c0392b; }
      .holes-visual-small {
        display: flex;
        flex-direction: column;
        gap: 2px;
        padding: 6px;
        background: #f5f0e8;
        border-radius: 4px;
      }
      .hole-row-small {
        display: flex;
        align-items: center;
        gap: 4px;
      }
      .hole-small {
        width: 18px;
        height: 18px;
        border-radius: 50%;
        display: flex;
        align-items: center;
        justify-content: center;
      }
      .hole-small.punched {
        background: #1a1410;
        border: 1px solid #1a1410;
      }
      .hole-small.unpunched {
        background: #e8e0d0;
        border: 1px solid #c8c0b0;
      }
      .hole-small.error {
        box-shadow: 0 0 0 2px rgba(192, 57, 43, 0.6);
        border-color: #c0392b !important;
      }
      .bit-label-small {
        font-size: 8px;
        color: #8b8070;
        width: 14px;
        text-align: right;
        font-family: 'Share Tech Mono', monospace;
      }
      .retransmit-indicator {
        display: inline-flex;
        align-items: center;
        gap: 4px;
        padding: 2px 6px;
        background: rgba(212, 160, 48, 0.2);
        border: 1px solid #d4a030;
        border-radius: 3px;
        font-size: 10px;
        color: #d4a030;
        font-weight: 600;
      }
      .empty-history {
        text-align: center;
        padding: 40px;
        color: #5a5040;
        font-size: 12px;
      }
      .fault-hint {
        font-size: 10px;
        color: #8b8070;
        margin-top: -6px;
        margin-bottom: 8px;
        padding-left: 92px;
      }
    `,
  ];

  @state() private configA: EndpointConfig = getDefaultEndpointConfig();
  @state() private configB: EndpointConfig = getDefaultEndpointConfig();

  @state() private inputA = '';
  @state() private inputB = '';

  @state() private receivedTextA = '';
  @state() private receivedTextB = '';

  @state() private shiftStateA: ShiftState = 'LETTERS';
  @state() private shiftStateB: ShiftState = 'LETTERS';

  @state() private receivedColumnsA: TransmissionColumnState[] = [];
  @state() private receivedColumnsB: TransmissionColumnState[] = [];

  @state() private messages: ChatMessage[] = [];
  @state() private currentMessage: ChatMessage | null = null;
  @state() private currentColumnIndex = -1;

  @state() private isTransmitting = false;
  @state() private transmittingEnd: TeletypeEnd | null = null;

  @state() private showReport = false;
  @state() private communicationRecord: DualEndCommunicationRecord | null = null;

  @state() private selectedMessageId: string | null = null;

  @state() private configHistory: { timestamp: number; end: TeletypeEnd; config: EndpointConfig }[] = [];

  private transmissionTimer: number | null = null;
  private sessionId = `session-${Date.now()}`;

  @query('#inputA') private inputAreaA!: HTMLTextAreaElement;
  @query('#inputB') private inputAreaB!: HTMLTextAreaElement;

  private getTransmissionInterval(end: TeletypeEnd): number {
    const config = end === 'A' ? this.configA : this.configB;
    return 1000 / config.transmissionSpeed;
  }

  private handleInputA(e: Event) {
    const text = (e.target as HTMLTextAreaElement).value;
    const { filtered } = filterText(text);
    this.inputA = filtered;
  }

  private handleInputB(e: Event) {
    const text = (e.target as HTMLTextAreaElement).value;
    const { filtered } = filterText(text);
    this.inputB = filtered;
  }

  private sendMessage(fromEnd: TeletypeEnd) {
    if (this.isTransmitting) return;

    const input = fromEnd === 'A' ? this.inputA : this.inputB;
    if (!input.trim()) return;

    const toEnd: TeletypeEnd = fromEnd === 'A' ? 'B' : 'A';
    const senderConfig = fromEnd === 'A' ? this.configA : this.configB;
    const receiverConfig = fromEnd === 'A' ? this.configB : this.configA;

    this.currentMessage = createChatMessage(fromEnd, toEnd, input, senderConfig, receiverConfig);
    this.currentColumnIndex = -1;
    this.isTransmitting = true;
    this.transmittingEnd = fromEnd;

    if (fromEnd === 'A') {
      this.inputA = '';
      this.receivedColumnsB = [];
      this.shiftStateB = 'LETTERS';
    } else {
      this.inputB = '';
      this.receivedColumnsA = [];
      this.shiftStateA = 'LETTERS';
    }

    this.transmitNextColumn();
  }

  private transmitNextColumn() {
    if (!this.currentMessage || !this.transmittingEnd) return;

    const nextIndex = this.currentColumnIndex + 1;
    const columns = this.currentMessage.sentColumns;

    if (nextIndex >= columns.length) {
      this.finishTransmission();
      return;
    }

    this.currentColumnIndex = nextIndex;
    this.transmitColumnAtIndex(nextIndex);
  }

  private transmitColumnAtIndex(index: number) {
    if (!this.currentMessage || !this.transmittingEnd) return;

    const columns = this.currentMessage.sentColumns;
    const column = columns[index];
    const receiverConfig = this.transmittingEnd === 'A' ? this.configB : this.configA;
    const isRetransmission = column.retransmitCount > 0;
    const currentShiftState = this.getShiftStateBeforeIndex(index, isRetransmission);

    const transmissionResult = transmitColumn(column, receiverConfig, index);
    const processResult = processReceivedColumn(
      column,
      transmissionResult.receivedBits,
      transmissionResult.errorPositions,
      currentShiftState
    );

    const updatedColumn = processResult.column;
    updatedColumn.retransmitCount = column.retransmitCount;
    columns[index] = updatedColumn;

    if (this.transmittingEnd === 'A') {
      this.shiftStateB = processResult.newShiftState;
      this.receivedColumnsB = [...columns.slice(0, index + 1)];
      this.receivedTextB = buildReceivedText(this.receivedColumnsB);
    } else {
      this.shiftStateA = processResult.newShiftState;
      this.receivedColumnsA = [...columns.slice(0, index + 1)];
      this.receivedTextA = buildReceivedText(this.receivedColumnsA);
    }

    if (processResult.needsRetransmit && receiverConfig.enableAutoRetransmit) {
      if (updatedColumn.retransmitCount < receiverConfig.maxRetransmitAttempts) {
        updatedColumn.retransmitCount++;
        updatedColumn.status = 'retransmitting';
        this.requestUpdate();

        this.transmissionTimer = window.setTimeout(() => {
          this.transmitColumnAtIndex(index);
        }, this.getTransmissionInterval(this.transmittingEnd));
        return;
      }
    }

    this.requestUpdate();

    this.transmissionTimer = window.setTimeout(() => {
      this.transmitNextColumn();
    }, this.getTransmissionInterval(this.transmittingEnd));
  }

  private getShiftStateBeforeIndex(index: number, isRetransmission: boolean): ShiftState {
    if (index === 0) return 'LETTERS';

    let shift: ShiftState = 'LETTERS';
    const endIndex = isRetransmission ? index : index;

    for (let i = 0; i < endIndex; i++) {
      const col = this.currentMessage?.sentColumns[i];
      if (!col) continue;
      const activeBits = col.receivedBits;
      const key = activeBits.map(b => (b ? '1' : '0')).join('');
      if (key === '11111') {
        shift = 'LETTERS';
      } else if (key === '11011') {
        shift = 'FIGURES';
      }
    }
    return shift;
  }

  private finishTransmission() {
    if (!this.currentMessage) return;

    const columns = this.currentMessage.sentColumns;
    const receivedText = buildReceivedText(columns);
    const errorPositions = getErrorPositions(columns);
    const successRate = calculateSuccessRate(columns);
    const totalRetransmits = getTotalRetransmits(columns);

    this.currentMessage = {
      ...this.currentMessage,
      receivedText,
      errorPositions,
      totalRetransmits,
      successRate,
      status: 'sent',
    };

    this.messages = [...this.messages, this.currentMessage];
    this.selectedMessageId = this.currentMessage.id;

    this.isTransmitting = false;
    this.transmittingEnd = null;
    this.currentColumnIndex = -1;

    if (this.currentMessage.fromEnd === 'A') {
      this.receivedTextB = receivedText;
    } else {
      this.receivedTextA = receivedText;
    }

    this.currentMessage = null;
  }

  private handleNoiseChange(end: TeletypeEnd, e: CustomEvent) {
    const value = (e.target as any).value as number;
    const noiseLevel = Math.max(0, Math.min(1, value / 100));
    const baseConfig = end === 'A' ? this.configA : this.configB;
    const newConfig: EndpointConfig = { ...baseConfig, noiseLevel };

    if (end === 'A') {
      this.configA = newConfig;
    } else {
      this.configB = newConfig;
    }

    this.configHistory.push({
      timestamp: Date.now(),
      end,
      config: { ...newConfig },
    });
  }

  private handleSpeedChange(end: TeletypeEnd, e: CustomEvent) {
    const value = (e.target as any).value as number;
    const baseConfig = end === 'A' ? this.configA : this.configB;
    const newConfig: EndpointConfig = { ...baseConfig, transmissionSpeed: value };

    if (end === 'A') {
      this.configA = newConfig;
    } else {
      this.configB = newConfig;
    }

    this.configHistory.push({
      timestamp: Date.now(),
      end,
      config: { ...newConfig },
    });
  }

  private handleFaultTypeChange(end: TeletypeEnd, e: Event) {
    const value = (e.target as HTMLSelectElement).value as FaultInjectionType;
    const baseConfig = end === 'A' ? this.configA : this.configB;
    const newConfig: EndpointConfig = { ...baseConfig, faultType: value };

    if (end === 'A') {
      this.configA = newConfig;
    } else {
      this.configB = newConfig;
    }

    this.configHistory.push({
      timestamp: Date.now(),
      end,
      config: { ...newConfig },
    });
  }

  private handleFaultParamChange(end: TeletypeEnd, e: CustomEvent) {
    const value = (e.target as any).value as number;
    const baseConfig = end === 'A' ? this.configA : this.configB;
    const newConfig: EndpointConfig = { ...baseConfig, faultParam: value };

    if (end === 'A') {
      this.configA = newConfig;
    } else {
      this.configB = newConfig;
    }

    this.configHistory.push({
      timestamp: Date.now(),
      end,
      config: { ...newConfig },
    });
  }

  private handleAutoRetransmitChange(end: TeletypeEnd, e: Event) {
    const checked = (e.target as HTMLInputElement).checked;
    const baseConfig = end === 'A' ? this.configA : this.configB;
    const newConfig: EndpointConfig = { ...baseConfig, enableAutoRetransmit: checked };

    if (end === 'A') {
      this.configA = newConfig;
    } else {
      this.configB = newConfig;
    }

    this.configHistory.push({
      timestamp: Date.now(),
      end,
      config: { ...newConfig },
    });
  }

  private handleMaxRetriesChange(end: TeletypeEnd, e: CustomEvent) {
    const value = (e.target as any).value as number;
    const baseConfig = end === 'A' ? this.configA : this.configB;
    const newConfig: EndpointConfig = { ...baseConfig, maxRetransmitAttempts: Math.round(value) };

    if (end === 'A') {
      this.configA = newConfig;
    } else {
      this.configB = newConfig;
    }

    this.configHistory.push({
      timestamp: Date.now(),
      end,
      config: { ...newConfig },
    });
  }

  private handleGenerateReport() {
    this.communicationRecord = createCommunicationRecord(
      this.sessionId,
      this.messages,
      this.configHistory
    );
    this.showReport = true;
  }

  private closeReport() {
    this.showReport = false;
  }

  private clearSession() {
    this.messages = [];
    this.receivedTextA = '';
    this.receivedTextB = '';
    this.receivedColumnsA = [];
    this.receivedColumnsB = [];
    this.shiftStateA = 'LETTERS';
    this.shiftStateB = 'LETTERS';
    this.sessionId = `session-${Date.now()}`;
    this.configHistory = [];
    this.selectedMessageId = null;
  }

  private getSessionStats() {
    return calculateSessionStats(this.messages);
  }

  private renderHolesSmall(bits: [boolean, boolean, boolean, boolean, boolean], errorPositions: number[] = []) {
    return html`
      <div class="holes-visual-small">
        ${bits.map((bit, i) => html`
          <div class="hole-row-small">
            <span class="bit-label-small">${i + 1}</span>
            <div
              class="hole-small ${bit ? 'punched' : 'unpunched'} ${errorPositions.includes(i) ? 'error' : ''}"
            ></div>
          </div>
        `)}
      </div>
    `;
  }

  private renderTape(columns: TransmissionColumnState[], highlightIndex: number = -1) {
    if (columns.length === 0) {
      return html`<div style="color:#8b8070; font-size:11px; text-align:center; width:100%;">等待接收...</div>`;
    }

    return columns.map((col, i) => html`
      <div
        class="tape-column ${col.status} ${i === highlightIndex ? 'transmitting' : ''}"
        title="${col.originalChar} - ${col.receivedBits.map(b => b ? '1' : '0').join('')}"
      >
        ${col.receivedBits.map((bit, j) => html`
          <div
            class="tape-hole ${bit ? 'punched' : 'unpunched'} ${col.errorBitPositions.includes(j) ? 'error' : ''}"
          ></div>
        `)}
      </div>
    `);
  }

  private renderDecodedText(original: string, received: string) {
    const orig = original.toUpperCase();
    let html = '';
    const maxLen = Math.max(orig.length, received.length);
    for (let i = 0; i < maxLen; i++) {
      const oChar = i < orig.length ? orig[i] : '';
      const dChar = i < received.length ? received[i] : '';
      if (oChar === dChar) {
        html += dChar;
      } else {
        html += `<span class="error">${dChar || '□'}</span>`;
      }
    }
    return html;
  }

  private renderTerminal(end: TeletypeEnd) {
    const isA = end === 'A';
    const config = isA ? this.configA : this.configB;
    const input = isA ? this.inputA : this.inputB;
    const receivedText = isA ? this.receivedTextA : this.receivedTextB;
    const receivedColumns = isA ? this.receivedColumnsA : this.receivedColumnsB;
    const shiftState = isA ? this.shiftStateA : this.shiftStateB;
    const otherEnd: TeletypeEnd = isA ? 'B' : 'A';
    const otherConfig = isA ? this.configB : this.configA;

    const currentColumn = this.currentMessage && this.currentColumnIndex >= 0
      ? this.currentMessage.sentColumns[this.currentColumnIndex]
      : null;
    const isReceiving = this.transmittingEnd === otherEnd;

    return html`
      <div class="terminal-panel terminal-${end.toLowerCase()}">
        <div class="panel">
          <div class="panel-title" style="${isA ? 'color: #4a9eff;' : 'color: #ff6b6b;'}">
            ${isA ? '🔵' : '🔴'} 电传机 ${end}
          </div>

          <div class="terminal-header">
            <span class="terminal-title" style="${isA ? 'color: #4a9eff;' : 'color: #ff6b6b;'}">
              终端 ${end}
            </span>
            <div class="shift-indicator">
              <span style="font-size:10px; color:#8b8070;">档位:</span>
              <span class="shift-badge ${shiftState === 'LETTERS' ? 'letters' : 'figures'}">
                ${shiftState === 'LETTERS' ? '字母档' : '数字档'}
              </span>
            </div>
          </div>

          ${isReceiving && currentColumn ? html`
            <div class="live-column-display">
              <div class="column-view sender">
                <div class="label">发送 ${otherEnd}</div>
                <div class="char-display">${currentColumn.originalChar}</div>
                ${this.renderHolesSmall(currentColumn.originalBits)}
              </div>
              <div style="display:flex; flex-direction:column; align-items:center; gap:4px; color:#d4a030;">
                <span style="font-size:20px;">→</span>
                <span style="font-size:10px;">传输</span>
              </div>
              <div class="column-view receiver">
                <div class="label">接收 ${end}</div>
                <div class="char-display ${currentColumn.status === 'corrupted' ? 'error' : ''}">
                  ${currentColumn.decodedChar || '?'}
                </div>
                ${this.renderHolesSmall(currentColumn.receivedBits, currentColumn.errorBitPositions)}
                ${currentColumn.retransmitCount > 0 ? html`
                  <span class="retransmit-indicator">↻ ${currentColumn.retransmitCount}</span>
                ` : nothing}
              </div>
            </div>
          ` : nothing}

          <div style="margin-top: 8px;">
            <div class="label">📼 接收纸带</div>
            <div class="tape-display">
              ${this.renderTape(receivedColumns, isReceiving ? this.currentColumnIndex : -1)}
            </div>
          </div>

          <div>
            <div class="label">📝 译码结果</div>
            <div class="decoded-display">
              ${receivedText || html`<span style="color:#5a5040;">等待接收消息...</span>`}
            </div>
          </div>

          <div class="input-area">
            <textarea
              id="input${end}"
              .value=${input}
              @input=${(e: Event) => isA ? this.handleInputA(e) : this.handleInputB(e)}
              placeholder="输入要发送的消息..."
              ?disabled=${this.isTransmitting}
            ></textarea>
            <button
              class="metal-button accent send-button"
              @click=${() => this.sendMessage(end)}
              ?disabled=${this.isTransmitting || !input.trim()}
            >
              ▶ 发送
            </button>
          </div>
        </div>

        <div class="panel">
          <div class="panel-title" style="font-size:12px;">
            ⚙️ 链路配置 (${end} → ${otherEnd})
          </div>

          <div class="config-section">
            <div class="config-row">
              <span class="label">噪声强度</span>
              <sl-range
                min="0"
                max="50"
                step="1"
                .value=${config.noiseLevel * 100}
                @sl-change=${(e: CustomEvent) => this.handleNoiseChange(end, e)}
                ?disabled=${this.isTransmitting}
              ></sl-range>
              <span class="value">${Math.round(config.noiseLevel * 100)}%</span>
            </div>

            <div class="config-row">
              <span class="label">传输速度</span>
              <sl-range
                min="0.5"
                max="5"
                step="0.25"
                .value=${config.transmissionSpeed}
                @sl-change=${(e: CustomEvent) => this.handleSpeedChange(end, e)}
                ?disabled=${this.isTransmitting}
              ></sl-range>
              <span class="value">${config.transmissionSpeed}x</span>
            </div>

            <div class="config-row">
              <span class="label">故障类型</span>
              <select
                .value=${config.faultType}
                @change=${(e: Event) => this.handleFaultTypeChange(end, e)}
                ?disabled=${this.isTransmitting}
              >
                <option value="none">${getFaultTypeLabel('none')}</option>
                <option value="random_bit_flip">${getFaultTypeLabel('random_bit_flip')}</option>
                <option value="stuck_bit_0">${getFaultTypeLabel('stuck_bit_0')}</option>
                <option value="stuck_bit_1">${getFaultTypeLabel('stuck_bit_1')}</option>
                <option value="burst_error">${getFaultTypeLabel('burst_error')}</option>
              </select>
            </div>
            ${config.faultType !== 'none' ? html`
              <div class="fault-hint">${getFaultTypeDescription(config.faultType)}</div>
              <div class="config-row">
                <span class="label">
                  ${config.faultType === 'random_bit_flip' ? '概率' :
                    config.faultType === 'stuck_bit_0' || config.faultType === 'stuck_bit_1' ? '位位置' :
                    '突发长度'}
                </span>
                <sl-range
                  min=${config.faultType === 'random_bit_flip' ? '0' : '0'}
                  max=${config.faultType === 'random_bit_flip' ? '100' : '4'}
                  step=${config.faultType === 'random_bit_flip' ? '1' : '1'}
                  .value=${config.faultType === 'random_bit_flip' ? config.faultParam * 100 : config.faultParam}
                  @sl-change=${(e: CustomEvent) => this.handleFaultParamChange(end, e)}
                  ?disabled=${this.isTransmitting}
                ></sl-range>
                <span class="value">
                  ${config.faultType === 'random_bit_flip' ? `${Math.round(config.faultParam * 100)}%` :
                    config.faultType === 'stuck_bit_0' || config.faultType === 'stuck_bit_1' ? `第${Math.round(config.faultParam) + 1}位` :
                    `${Math.round(config.faultParam) + 1}位`}
                </span>
              </div>
            ` : nothing}

            <div class="config-row">
              <label class="checkbox-row">
                <input
                  type="checkbox"
                  .checked=${config.enableAutoRetransmit}
                  @change=${(e: Event) => this.handleAutoRetransmitChange(end, e)}
                  ?disabled=${this.isTransmitting}
                >
                <span style="font-size:12px;">启用自动重传</span>
              </label>
            </div>

            ${config.enableAutoRetransmit ? html`
              <div class="config-row">
                <span class="label">最大重传</span>
                <sl-range
                  min="1"
                  max="10"
                  step="1"
                  .value=${config.maxRetransmitAttempts}
                  @sl-change=${(e: CustomEvent) => this.handleMaxRetriesChange(end, e)}
                  ?disabled=${this.isTransmitting}
                ></sl-range>
                <span class="value">${config.maxRetransmitAttempts}次</span>
              </div>
            ` : nothing}
          </div>
        </div>
      </div>
    `;
  }

  render() {
    const stats = this.getSessionStats();

    return html`
      <div class="panel">
        <div class="panel-title">📡 电传机联机对话室</div>

        <div class="chatroom-container">
          ${this.renderTerminal('A')}
          ${this.renderTerminal('B')}

          <div class="transmission-line">
            ${this.isTransmitting && this.transmittingEnd ? html`
              <div class="transmission-content">
                <span class="transmission-arrow">${this.transmittingEnd === 'A' ? '→' : '←'}</span>
                <div class="transmission-info">
                  <div class="status">传输中</div>
                  <div class="detail sending-${this.transmittingEnd === 'A' ? 'a' : 'b'}">
                    ${this.transmittingEnd} → ${this.transmittingEnd === 'A' ? 'B' : 'A'}
                    ${this.currentMessage ? html`
                      <span style="font-size:12px; margin-left:12px;">
                        列 ${this.currentColumnIndex + 1} / ${this.currentMessage.sentColumns.length}
                      </span>
                    ` : nothing}
                  </div>
                </div>
                <span class="transmission-arrow">${this.transmittingEnd === 'A' ? '→' : '←'}</span>
              </div>
            ` : html`
              <div class="transmission-info">
                <div class="status">链路就绪</div>
                <div class="detail" style="color:#8b8070; font-size:14px;">
                  A ←─── 双向通信通道 ───→ B
                </div>
              </div>
            `}
          </div>

          <div class="session-controls">
            <div class="session-stats">
              <div class="stat">
                <span class="label">消息数</span>
                <span class="value">${stats.totalMessages}</span>
              </div>
              <div class="stat">
                <span class="label">字符数</span>
                <span class="value">${stats.totalChars}</span>
              </div>
              <div class="stat">
                <span class="label">错误数</span>
                <span class="value" style="color:${stats.totalErrors > 0 ? '#c0392b' : '#2d8b46'};">${stats.totalErrors}</span>
              </div>
              <div class="stat">
                <span class="label">平均成功率</span>
                <span class="value" style="color:${stats.averageSuccessRate >= 90 ? '#2d8b46' : stats.averageSuccessRate >= 70 ? '#d4a030' : '#c0392b'};">
                  ${stats.averageSuccessRate.toFixed(1)}%
                </span>
              </div>
              <div class="stat">
                <span class="label">重传次数</span>
                <span class="value" style="color:#d4a030;">${stats.totalRetransmits}</span>
              </div>
            </div>
            <div style="display: flex; gap: 8px;">
              <button
                class="metal-button"
                @click=${this.handleGenerateReport}
                ?disabled=${this.messages.length === 0}
              >
                📄 生成通信记录
              </button>
              <button
                class="metal-button danger"
                @click=${this.clearSession}
                ?disabled=${this.isTransmitting || this.messages.length === 0}
              >
                🗑 清空会话
              </button>
            </div>
          </div>

          <div class="chat-history">
            ${this.messages.length === 0 ? html`
              <div class="empty-history">
                <div style="font-size:32px; margin-bottom:8px;">📟</div>
                <div>尚无消息记录</div>
                <div style="margin-top:4px;">在任意终端输入文字并点击发送开始通信</div>
              </div>
            ` : html`
              ${this.messages.map(msg => html`
                <div
                  class="chat-message sent-${msg.fromEnd === 'A' ? 'a' : 'b'} ${this.selectedMessageId === msg.id ? 'selected' : ''}"
                  @click=${() => { this.selectedMessageId = msg.id; }}
                  style="cursor: pointer;"
                >
                  <div class="chat-message-header">
                    <span class="sender">
                      ${msg.fromEnd === 'A' ? '🔵 终端 A' : '🔴 终端 B'}
                      <span style="margin-left:8px; color:#5a5040; font-weight:400;">→</span>
                      <span style="margin-left:8px; color:#8b8070;">${msg.toEnd}</span>
                    </span>
                    <span>${new Date(msg.timestamp).toLocaleTimeString()}</span>
                  </div>
                  <div class="original-text">原文: ${msg.originalText.toUpperCase()}</div>
                  <div class="received-text">
                    ${this.renderDecodedText(msg.originalText, msg.receivedText)}
                  </div>
                  <div class="chat-message-stats">
                    <span class="stat success">
                      成功率: <span class="num">${msg.successRate.toFixed(1)}%</span>
                    </span>
                    <span class="stat error">
                      错误: <span class="num">${msg.errorPositions.length}</span>
                    </span>
                    <span class="stat retransmit">
                      重传: <span class="num">${msg.totalRetransmits}</span>
                    </span>
                    <span class="stat">
                      列数: <span class="num">${msg.sentColumns.length}</span>
                    </span>
                    <span class="stat">
                      噪声: <span class="num">${Math.round(msg.configSnapshot.receiver.noiseLevel * 100)}%</span>
                    </span>
                  </div>
                </div>
              `)}
            `}
          </div>
        </div>
      </div>

      ${this.showReport && this.communicationRecord ? this.renderReport() : nothing}
    `;
  }

  private renderReport() {
    if (!this.communicationRecord) return nothing;
    const r = this.communicationRecord;
    const s = r.stats;

    return html`
      <div class="report-modal" @click=${(e: MouseEvent) => { if (e.target === e.currentTarget) this.closeReport(); }}>
        <div class="report-content">
          <h2>📡 双端通信记录</h2>
          <div style="font-size:11px; color:#8b8070; margin-bottom:16px;">
            会话ID: ${r.sessionId} | 开始时间: ${new Date(r.startTime).toLocaleString()} | 结束时间: ${new Date(r.endTime).toLocaleString()}
          </div>

          <div class="report-section">
            <h3>会话统计</h3>
            <div class="report-stats">
              <div class="report-stat">
                <div class="value">${s.totalMessages}</div>
                <div class="label">总消息数</div>
              </div>
              <div class="report-stat">
                <div class="value">${s.totalChars}</div>
                <div class="label">总字符数</div>
              </div>
              <div class="report-stat errors">
                <div class="value">${s.totalErrors}</div>
                <div class="label">总错误数</div>
              </div>
              <div class="report-stat retransmits">
                <div class="value">${s.totalRetransmits}</div>
                <div class="label">总重传</div>
              </div>
              <div class="report-stat accuracy">
                <div class="value">${s.averageSuccessRate.toFixed(1)}%</div>
                <div class="label">平均成功率</div>
              </div>
              <div class="report-stat">
                <div class="value">${s.messagesByEnd.A}</div>
                <div class="label">A发送</div>
              </div>
              <div class="report-stat">
                <div class="value">${s.messagesByEnd.B}</div>
                <div class="label">B发送</div>
              </div>
              <div class="report-stat">
                <div class="value">${(s.totalChars > 0 ? (s.totalErrors / s.totalChars * 100) : 0).toFixed(2)}%</div>
                <div class="label">误码率</div>
              </div>
            </div>
          </div>

          <div class="report-section">
            <h3>消息详情 (${r.messages.length} 条)</h3>
            <div class="message-list">
              ${r.messages.map((msg, idx) => html`
                <div class="message-detail sent-${msg.fromEnd === 'A' ? 'a' : 'b'}">
                  <div class="message-detail-header">
                    <span class="sender">
                      #${idx + 1} ${msg.fromEnd === 'A' ? '🔵 A' : '🔴 B'} → ${msg.toEnd}
                    </span>
                    <span style="color:#8b8070;">
                      ${new Date(msg.timestamp).toLocaleTimeString()}
                      ${msg.totalRetransmits > 0 ? html`
                        <span class="retransmit-indicator" style="margin-left:8px;">↻ ${msg.totalRetransmits}</span>
                      ` : nothing}
                    </span>
                  </div>
                  <div class="text-comparison">
                    <div class="text-block">
                      <div class="label">发送原文</div>
                      <div class="content">${msg.originalText.toUpperCase()}</div>
                    </div>
                    <div class="text-block">
                      <div class="label">接收结果</div>
                      <div class="content">${this.renderDecodedText(msg.originalText, msg.receivedText)}</div>
                    </div>
                  </div>
                  ${msg.errorPositions.length > 0 ? html`
                    <div style="margin-bottom:8px;">
                      <div style="font-size:10px; color:#8b8070; text-transform:uppercase; letter-spacing:1px; margin-bottom:4px;">
                        错误位置 (${msg.errorPositions.length} 处)
                      </div>
                      <ul class="error-detail-list">
                        ${msg.errorPositions.map(pos => {
                          const col = msg.sentColumns[pos];
                          return html`
                            <li>
                              <span>第 ${pos + 1} 列: <span class="col">${col.originalChar}</span></span>
                              <span>
                                原始: ${col.originalBits.map(b => b ? '1' : '0').join('')} →
                                接收: ${col.receivedBits.map(b => b ? '1' : '0').join('')}
                                (错误位: ${col.errorBitPositions.map(b => b + 1).join(', ')})
                              </span>
                            </li>
                          `;
                        })}
                      </ul>
                    </div>
                  ` : nothing}
                  <div style="display:flex; gap:16px; font-size:11px; color:#8b8070;">
                    <span>成功率: <strong style="color:${msg.successRate >= 90 ? '#2d8b46' : msg.successRate >= 70 ? '#d4a030' : '#c0392b'};">${msg.successRate.toFixed(1)}%</strong></span>
                    <span>列数: <strong>${msg.sentColumns.length}</strong></span>
                    <span>发送噪声: <strong>${Math.round(msg.configSnapshot.receiver.noiseLevel * 100)}%</strong></span>
                    <span>故障类型: <strong>${getFaultTypeLabel(msg.configSnapshot.receiver.faultType)}</strong></span>
                    ${msg.configSnapshot.receiver.enableAutoRetransmit ? html`
                      <span>自动重传: <strong style="color:#2d8b46;">启用</strong></span>
                    ` : nothing}
                  </div>
                </div>
              `)}
            </div>
          </div>

          ${r.configHistory.length > 0 ? html`
            <div class="report-section">
              <h3>配置变更历史 (${r.configHistory.length} 次)</h3>
              <ul class="error-detail-list">
                ${r.configHistory.map((entry, i) => html`
                  <li>
                    <span>${new Date(entry.timestamp).toLocaleTimeString()} - 终端 ${entry.end}</span>
                    <span>
                      噪声: ${Math.round(entry.config.noiseLevel * 100)}% |
                      速度: ${entry.config.transmissionSpeed}x |
                      故障: ${getFaultTypeLabel(entry.config.faultType)} |
                      重传: ${entry.config.enableAutoRetransmit ? '启用' : '禁用'}
                    </span>
                  </li>
                `)}
              </ul>
            </div>
          ` : nothing}

          <div class="modal-actions">
            <button class="metal-button" @click=${this.closeReport}>关闭</button>
          </div>
        </div>
      </div>
    `;
  }

  disconnectedCallback() {
    super.disconnectedCallback();
    if (this.transmissionTimer) {
      clearTimeout(this.transmissionTimer);
    }
  }
}

declare global {
  interface HTMLElementTagNameMap {
    'teletype-chatroom': TeletypeChatroom;
  }
}
