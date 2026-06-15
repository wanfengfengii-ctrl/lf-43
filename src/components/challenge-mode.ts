import { LitElement, html, css, nothing } from 'lit';
import { customElement, property, state, query } from 'lit/decorators.js';
import type { EncodedColumn, TransmissionColumnHistory, ShiftState, TransmissionPhase, TransmissionReport } from '../types';
import { createTransmissionHistory, injectNoiseToColumn, repairColumn, generateTransmissionReport } from '../core/column-transmission';
import { decodeSingleColumn } from '../core/baudot-decoder';
import { sharedStyles } from '../styles';

const HOLE_RADIUS = 16;
const ROW_SPACING = 44;
const COL_WIDTH = 50;

@customElement('challenge-mode')
export class ChallengeMode extends LitElement {
  static styles = [
    sharedStyles,
    css`
      :host {
        display: block;
      }
      .challenge-container {
        display: grid;
        grid-template-columns: 1fr 320px;
        gap: 16px;
      }
      @media (max-width: 900px) {
        .challenge-container {
          grid-template-columns: 1fr;
        }
      }
      .main-panel {
        display: flex;
        flex-direction: column;
        gap: 12px;
      }
      .status-bar {
        display: flex;
        align-items: center;
        justify-content: space-between;
        background: rgba(0, 0, 0, 0.3);
        border-radius: 6px;
        padding: 10px 16px;
        border: 1px solid #3d3428;
      }
      .shift-indicator {
        display: flex;
        align-items: center;
        gap: 8px;
      }
      .shift-badge {
        padding: 4px 12px;
        border-radius: 4px;
        font-weight: 700;
        font-size: 12px;
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
      .progress-info {
        display: flex;
        gap: 16px;
        font-size: 12px;
        color: #8b8070;
      }
      .progress-info .value {
        color: #f5f0e8;
        font-weight: 600;
      }
      .current-column-display {
        display: flex;
        justify-content: center;
        align-items: center;
        gap: 40px;
        padding: 24px;
        background: rgba(0, 0, 0, 0.2);
        border-radius: 8px;
        border: 1px solid #3d3428;
        min-height: 280px;
      }
      .column-view {
        display: flex;
        flex-direction: column;
        align-items: center;
        gap: 12px;
      }
      .column-view .label {
        font-size: 11px;
        text-transform: uppercase;
        letter-spacing: 1px;
        color: #8b8070;
      }
      .column-view .char-display {
        font-size: 36px;
        font-weight: 700;
        font-family: 'Share Tech Mono', monospace;
        min-height: 48px;
        display: flex;
        align-items: center;
        justify-content: center;
      }
      .column-view.original .char-display {
        color: #2d8b46;
      }
      .column-view.received .char-display.corrupted {
        color: #c0392b;
        text-decoration: underline wavy #c0392b;
        text-underline-offset: 6px;
      }
      .column-view.received .char-display.repaired {
        color: #d4a030;
      }
      .holes-visual {
        display: flex;
        flex-direction: column;
        gap: 6px;
        padding: 12px;
        background: #f5f0e8;
        border-radius: 6px;
      }
      .hole-row {
        display: flex;
        align-items: center;
        gap: 8px;
      }
      .hole {
        width: 32px;
        height: 32px;
        border-radius: 50%;
        cursor: pointer;
        transition: all 0.15s ease;
        display: flex;
        align-items: center;
        justify-content: center;
      }
      .hole.punched {
        background: #1a1410;
        border: 2px solid #3d3428;
      }
      .hole.unpunched {
        background: #e8e0d0;
        border: 2px solid #c8c0b0;
      }
      .hole.error {
        box-shadow: 0 0 0 3px rgba(192, 57, 43, 0.5);
        border-color: #c0392b !important;
      }
      .hole.repaired {
        box-shadow: 0 0 0 3px rgba(212, 160, 48, 0.5);
        border-color: #d4a030 !important;
      }
      .hole.editable:hover {
        transform: scale(1.1);
        box-shadow: 0 0 8px rgba(212, 160, 48, 0.6);
      }
      .bit-label {
        font-size: 10px;
        color: #8b8070;
        width: 20px;
        text-align: right;
        font-family: 'Share Tech Mono', monospace;
      }
      .vs-divider {
        display: flex;
        flex-direction: column;
        align-items: center;
        gap: 8px;
        color: #5a5040;
        font-size: 14px;
        font-weight: 700;
      }
      .vs-divider .arrow {
        font-size: 24px;
      }
      .controls-row {
        display: flex;
        gap: 8px;
        flex-wrap: wrap;
        align-items: center;
      }
      .controls-row .spacer {
        flex: 1;
      }
      .speed-control {
        display: flex;
        align-items: center;
        gap: 8px;
      }
      .noise-control {
        display: flex;
        align-items: center;
        gap: 8px;
      }
      sl-range {
        --sl-color-primary-600: #d4a030;
        --sl-color-primary-500: #d4a030;
        --sl-input-font-size: 12px;
        width: 120px;
      }
      .history-panel {
        max-height: 500px;
        overflow-y: auto;
        scrollbar-width: thin;
        scrollbar-color: #d4a030 #1a1410;
      }
      .history-panel::-webkit-scrollbar {
        width: 6px;
      }
      .history-panel::-webkit-scrollbar-track {
        background: #1a1410;
        border-radius: 3px;
      }
      .history-panel::-webkit-scrollbar-thumb {
        background: #d4a030;
        border-radius: 3px;
      }
      .history-item {
        display: flex;
        align-items: center;
        gap: 8px;
        padding: 6px 8px;
        border-radius: 4px;
        cursor: pointer;
        transition: background 0.15s ease;
        font-size: 12px;
        border-bottom: 1px solid #2a2318;
      }
      .history-item:hover {
        background: rgba(212, 160, 48, 0.08);
      }
      .history-item.selected {
        background: rgba(212, 160, 48, 0.15);
      }
      .history-item .col-index {
        width: 36px;
        color: #8b8070;
        font-family: 'Share Tech Mono', monospace;
      }
      .history-item .col-char {
        width: 28px;
        text-align: center;
        font-weight: 600;
        font-family: 'Share Tech Mono', monospace;
      }
      .history-item .col-bits {
        flex: 1;
        font-family: 'Share Tech Mono', monospace;
        font-size: 11px;
        letter-spacing: 1px;
        color: #8b8070;
      }
      .history-item.pending {
        opacity: 0.5;
      }
      .history-item.transmitted .col-char {
        color: #2d8b46;
      }
      .history-item.corrupted .col-char {
        color: #c0392b;
      }
      .history-item.repaired .col-char {
        color: #d4a030;
      }
      .status-icon {
        width: 16px;
        text-align: center;
      }
      .repair-section {
        margin-top: 12px;
        padding: 12px;
        background: rgba(212, 160, 48, 0.08);
        border: 1px solid #d4a030;
        border-radius: 6px;
      }
      .repair-section .repair-title {
        font-size: 12px;
        color: #d4a030;
        font-weight: 600;
        margin-bottom: 8px;
        display: flex;
        align-items: center;
        gap: 6px;
      }
      .repair-section .repair-hint {
        font-size: 11px;
        color: #8b8070;
        margin-top: 8px;
      }
      .comparison-row {
        display: flex;
        justify-content: space-around;
        margin-top: 12px;
        padding-top: 12px;
        border-top: 1px solid #3d3428;
      }
      .comparison-item {
        text-align: center;
      }
      .comparison-item .label {
        font-size: 10px;
        text-transform: uppercase;
        letter-spacing: 1px;
        color: #8b8070;
        margin-bottom: 4px;
      }
      .comparison-item .value {
        font-size: 20px;
        font-weight: 700;
        font-family: 'Share Tech Mono', monospace;
      }
      .comparison-item.before .value {
        color: #c0392b;
      }
      .comparison-item.after .value {
        color: #d4a030;
      }
      .empty-state {
        display: flex;
        flex-direction: column;
        align-items: center;
        justify-content: center;
        padding: 60px 20px;
        color: #8b8070;
        text-align: center;
      }
      .empty-state .icon {
        font-size: 48px;
        margin-bottom: 16px;
        opacity: 0.5;
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
        max-width: 700px;
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
        grid-template-columns: repeat(3, 1fr);
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
      .report-stat.accuracy .value {
        color: #2d8b46;
      }
      .report-stat.errors .value {
        color: #c0392b;
      }
      .report-stat.repaired .value {
        color: #d4a030;
      }
      .report-text {
        background: #0d0b08;
        padding: 12px;
        border-radius: 6px;
        font-family: 'IBM Plex Mono', monospace;
        font-size: 13px;
        line-height: 1.6;
        white-space: pre-wrap;
        word-break: break-all;
        color: #c8c0b0;
      }
      .report-text .error {
        color: #c0392b;
        background: rgba(192, 57, 43, 0.15);
        padding: 1px 3px;
        border-radius: 2px;
      }
      .damage-list {
        list-style: none;
        padding: 0;
        margin: 0;
      }
      .damage-list li {
        padding: 4px 8px;
        font-size: 12px;
        font-family: 'IBM Plex Mono', monospace;
        border-bottom: 1px solid #2a2318;
        display: flex;
        justify-content: space-between;
      }
      .modal-actions {
        display: flex;
        gap: 8px;
        justify-content: flex-end;
        margin-top: 16px;
      }
      .repair-detail-list {
        display: flex;
        flex-direction: column;
        gap: 12px;
      }
      .repair-detail-item {
        background: rgba(0, 0, 0, 0.25);
        border: 1px solid #3d3428;
        border-radius: 6px;
        padding: 12px;
      }
      .repair-detail-header {
        display: flex;
        justify-content: space-between;
        align-items: center;
        margin-bottom: 10px;
        padding-bottom: 8px;
        border-bottom: 1px solid #2a2318;
      }
      .repair-detail-title {
        font-weight: 600;
        font-size: 13px;
        color: #f5f0e8;
      }
      .repair-detail-change {
        font-family: 'Share Tech Mono', monospace;
        font-size: 14px;
      }
      .repair-detail-bits {
        display: flex;
        align-items: center;
        justify-content: space-between;
        gap: 8px;
        margin-bottom: 8px;
      }
      .repair-bit-group {
        flex: 1;
        text-align: center;
      }
      .repair-bit-label {
        font-size: 10px;
        color: #8b8070;
        text-transform: uppercase;
        letter-spacing: 1px;
        margin-bottom: 4px;
      }
      .repair-bit-row {
        display: flex;
        justify-content: center;
        gap: 3px;
        margin-bottom: 4px;
      }
      .repair-bit {
        width: 20px;
        height: 20px;
        border-radius: 50%;
        display: flex;
        align-items: center;
        justify-content: center;
        font-size: 9px;
        font-weight: 700;
        font-family: 'Share Tech Mono', monospace;
      }
      .repair-bit.punched {
        background: #1a1410;
        color: #f5f0e8;
        border: 1px solid #3d3428;
      }
      .repair-bit.unpunched {
        background: #e8e0d0;
        color: #5a5040;
        border: 1px solid #c8c0b0;
      }
      .repair-bit.changed-before {
        box-shadow: 0 0 0 2px rgba(192, 57, 43, 0.6);
        border-color: #c0392b !important;
      }
      .repair-bit.changed-after {
        box-shadow: 0 0 0 2px rgba(45, 139, 70, 0.6);
        border-color: #2d8b46 !important;
      }
      .repair-bit-str {
        font-family: 'Share Tech Mono', monospace;
        font-size: 11px;
        color: #8b8070;
        letter-spacing: 1px;
      }
      .repair-bit-arrow {
        color: #5a5040;
        font-weight: 700;
        font-size: 14px;
      }
      .repair-detail-changed {
        font-size: 11px;
        color: #8b8070;
        text-align: right;
        font-family: 'IBM Plex Mono', monospace;
      }
      .stats-bar {
        display: flex;
        gap: 16px;
        padding: 8px 12px;
        background: rgba(0, 0, 0, 0.2);
        border-radius: 6px;
        font-size: 11px;
      }
      .stats-bar .stat-item {
        display: flex;
        align-items: center;
        gap: 4px;
        color: #8b8070;
      }
      .stats-bar .stat-item .num {
        font-weight: 700;
        color: #f5f0e8;
      }
      .stats-bar .stat-item.error .num {
        color: #c0392b;
      }
      .stats-bar .stat-item.ok .num {
        color: #2d8b46;
      }
      .stats-bar .stat-item.repair .num {
        color: #d4a030;
      }
      .side-panel .panel {
        margin-bottom: 0;
      }
      .empty-history-hint {
        text-align: center;
        color: #5a5040;
        font-size: 11px;
        padding: 20px;
      }
    `,
  ];

  @property({ type: Array }) columns: EncodedColumn[] = [];
  @property({ type: String }) originalText = '';

  @state() private transmissionHistory: TransmissionColumnHistory[] = [];
  @state() private currentIndex = -1;
  @state() private phase: TransmissionPhase = 'idle';
  @state() private currentShiftState: ShiftState = 'LETTERS';
  @state() private noiseLevel = 0.15;
  @state() private transmissionSpeed = 1;
  @state() private selectedHistoryIndex = -1;
  @state() private repairBits: [boolean, boolean, boolean, boolean, boolean] | null = null;
  @state() private showReport = false;
  @state() private report: TransmissionReport | null = null;

  private transmissionTimer: number | null = null;

  firstUpdated() {
    if (this.columns.length > 0) {
      this.transmissionHistory = createTransmissionHistory(this.columns);
    }
  }

  updated(changed: Map<string, unknown>) {
    if (changed.has('columns')) {
      this.transmissionHistory = createTransmissionHistory(this.columns);
      this.resetTransmission();
    }
  }

  private getTransmissionInterval(): number {
    return 1000 / this.transmissionSpeed;
  }

  private startTransmission() {
    if (this.columns.length === 0) return;

    if (this.phase === 'idle' || this.phase === 'finished') {
      this.transmissionHistory = createTransmissionHistory(this.columns);
      this.currentIndex = -1;
      this.currentShiftState = 'LETTERS';
      this.selectedHistoryIndex = -1;
      this.repairBits = null;
    }

    this.phase = 'transmitting';
    this.transmitNextColumn();
  }

  private transmitNextColumn() {
    if (this.phase !== 'transmitting') return;

    const nextIndex = this.currentIndex + 1;
    if (nextIndex >= this.transmissionHistory.length) {
      this.phase = 'finished';
      this.currentIndex = this.transmissionHistory.length - 1;
      return;
    }

    let column = this.transmissionHistory[nextIndex];
    
    if (this.noiseLevel > 0) {
      column = injectNoiseToColumn(column, this.noiseLevel);
    } else {
      column = { ...column, status: 'transmitted' };
    }

    const { decodedChar, newShiftState } = decodeSingleColumn(column.receivedBits, this.currentShiftState);
    column = { ...column, receivedDecodedChar: decodedChar };
    this.currentShiftState = newShiftState;

    const newHistory = [...this.transmissionHistory];
    newHistory[nextIndex] = column;
    this.transmissionHistory = newHistory;
    this.currentIndex = nextIndex;
    this.selectedHistoryIndex = nextIndex;

    if (column.status === 'corrupted') {
      this.phase = 'paused';
      this.repairBits = [...column.receivedBits] as [boolean, boolean, boolean, boolean, boolean];
      return;
    }

    this.transmissionTimer = window.setTimeout(() => this.transmitNextColumn(), this.getTransmissionInterval());
  }

  private pauseTransmission() {
    if (this.transmissionTimer) {
      clearTimeout(this.transmissionTimer);
      this.transmissionTimer = null;
    }
    if (this.phase === 'transmitting') {
      this.phase = 'paused';
    }
  }

  private resumeTransmission() {
    if (this.phase === 'paused' && this.repairBits === null) {
      this.phase = 'transmitting';
      this.transmissionTimer = window.setTimeout(() => this.transmitNextColumn(), this.getTransmissionInterval());
    }
  }

  private resetTransmission() {
    if (this.transmissionTimer) {
      clearTimeout(this.transmissionTimer);
      this.transmissionTimer = null;
    }
    this.phase = 'idle';
    this.currentIndex = -1;
    this.currentShiftState = 'LETTERS';
    this.selectedHistoryIndex = -1;
    this.repairBits = null;
    if (this.columns.length > 0) {
      this.transmissionHistory = createTransmissionHistory(this.columns);
    }
  }

  private toggleHole(index: number) {
    if (!this.repairBits) return;
    const newBits = [...this.repairBits] as [boolean, boolean, boolean, boolean, boolean];
    newBits[index] = !newBits[index];
    this.repairBits = newBits;
  }

  private applyRepair() {
    if (!this.repairBits || this.selectedHistoryIndex < 0) return;

    const column = this.transmissionHistory[this.selectedHistoryIndex];
    const shiftBefore = this.getEffectiveShiftStateAt(this.selectedHistoryIndex);
    const repaired = repairColumn(column, this.repairBits);
    
    const { decodedChar, newShiftState, isShiftCode } = decodeSingleColumn(this.repairBits, shiftBefore);
    repaired.repairedDecodedChar = decodedChar;
    repaired.isShiftCode = isShiftCode;
    repaired.shiftState = newShiftState;

    const newHistory = [...this.transmissionHistory];
    newHistory[this.selectedHistoryIndex] = repaired;
    this.transmissionHistory = newHistory;

    if (this.selectedHistoryIndex === this.currentIndex) {
      this.currentShiftState = newShiftState;
    } else if (this.selectedHistoryIndex < this.currentIndex) {
      this.recomputeShiftAndDecodeFrom(this.selectedHistoryIndex + 1);
      this.currentShiftState = this.getEffectiveShiftStateAt(this.currentIndex + 1);
    }

    if (repaired.status === 'repaired') {
      this.repairBits = null;
    }
  }

  private recomputeShiftAndDecodeFrom(startIndex: number) {
    const shiftBefore = this.getEffectiveShiftStateAt(startIndex);
    let currentShift = shiftBefore;
    const newHistory = [...this.transmissionHistory];

    for (let i = startIndex; i <= this.currentIndex; i++) {
      const col = newHistory[i];
      const activeBits = col.repairedBits || col.receivedBits;
      const { decodedChar, newShiftState, isShiftCode } = decodeSingleColumn(activeBits, currentShift);
      
      newHistory[i] = {
        ...col,
        receivedDecodedChar: col.repairedBits ? col.receivedDecodedChar : decodedChar,
        repairedDecodedChar: col.repairedBits ? decodedChar : undefined,
        isShiftCode: col.repairedBits ? (isShiftCode || col.isShiftCode) : isShiftCode,
        shiftState: newShiftState,
      };
      currentShift = newShiftState;
    }

    this.transmissionHistory = newHistory;
  }

  private getEffectiveShiftStateAt(index: number): ShiftState {
    let shift: ShiftState = 'LETTERS';
    for (let i = 0; i < index; i++) {
      const col = this.transmissionHistory[i];
      const activeBits = col.repairedBits || col.receivedBits;
      const key = activeBits.map(b => (b ? '1' : '0')).join('');
      if (key === '11111') {
        shift = 'LETTERS';
      } else if (key === '11011') {
        shift = 'FIGURES';
      }
    }
    return shift;
  }

  private continueAfterRepair() {
    this.repairBits = null;
    if (this.currentIndex < this.transmissionHistory.length - 1) {
      this.phase = 'transmitting';
      this.transmissionTimer = window.setTimeout(() => this.transmitNextColumn(), this.getTransmissionInterval());
    } else {
      this.phase = 'finished';
    }
  }

  private selectHistoryItem(index: number) {
    if (index < 0 || index > this.currentIndex) return;
    if (this.phase === 'transmitting') return;
    this.selectedHistoryIndex = index;
    const col = this.transmissionHistory[index];
    if (col.status === 'corrupted') {
      this.repairBits = [...col.receivedBits] as [boolean, boolean, boolean, boolean, boolean];
    } else if (col.repairedBits) {
      this.repairBits = [...col.repairedBits] as [boolean, boolean, boolean, boolean, boolean];
    } else {
      this.repairBits = [...col.receivedBits] as [boolean, boolean, boolean, boolean, boolean];
    }
  }

  private enterManualRepair() {
    if (this.selectedHistoryIndex < 0 || this.selectedHistoryIndex > this.currentIndex) return;
    const col = this.transmissionHistory[this.selectedHistoryIndex];
    if (col.status === 'corrupted') {
      this.repairBits = [...col.receivedBits] as [boolean, boolean, boolean, boolean, boolean];
    } else if (col.repairedBits) {
      this.repairBits = [...col.repairedBits] as [boolean, boolean, boolean, boolean, boolean];
    } else {
      this.repairBits = [...col.receivedBits] as [boolean, boolean, boolean, boolean, boolean];
    }
  }

  private cancelManualRepair() {
    this.repairBits = null;
  }

  private handleNoiseChange(e: CustomEvent) {
    const value = (e.target as any).value as number;
    this.noiseLevel = Math.max(0, Math.min(1, value / 100));
  }

  private handleSpeedChange(e: CustomEvent) {
    const value = (e.target as any).value as number;
    this.transmissionSpeed = value;
  }

  private handleGenerateReport() {
    this.report = generateTransmissionReport(this.originalText, this.transmissionHistory);
    this.showReport = true;
  }

  private closeReport() {
    this.showReport = false;
  }

  private getCurrentColumn(): TransmissionColumnHistory | null {
    if (this.selectedHistoryIndex >= 0 && this.selectedHistoryIndex < this.transmissionHistory.length) {
      return this.transmissionHistory[this.selectedHistoryIndex];
    }
    return null;
  }

  private getStats() {
    const total = this.transmissionHistory.filter(h => h.status !== 'pending').length;
    const transmitted = this.transmissionHistory.filter(h => h.status === 'transmitted').length;
    const corrupted = this.transmissionHistory.filter(h => h.status === 'corrupted').length;
    const repaired = this.transmissionHistory.filter(h => h.status === 'repaired').length;
    return { total, transmitted, corrupted, repaired };
  }

  private renderHoles(bits: [boolean, boolean, boolean, boolean, boolean], editable: boolean, errorPositions: number[] = [], isRepaired: boolean = false) {
    return html`
      <div class="holes-visual">
        ${bits.map((bit, i) => html`
          <div class="hole-row">
            <span class="bit-label">${i + 1}</span>
            <div
              class="hole ${bit ? 'punched' : 'unpunched'} ${errorPositions.includes(i) ? 'error' : ''} ${isRepaired && errorPositions.includes(i) ? 'repaired' : ''} ${editable ? 'editable' : ''}"
              @click=${editable ? () => this.toggleHole(i) : nothing}
            ></div>
          </div>
        `)}
      </div>
    `;
  }

  render() {
    if (this.columns.length === 0) {
      return html`
        <div class="panel">
          <div class="panel-title">逐列传输与纠错挑战</div>
          <div class="empty-state">
            <div class="icon">📟</div>
            <p>请先在编码面板输入文字以开始挑战</p>
          </div>
        </div>
      `;
    }

    const currentCol = this.getCurrentColumn();
    const stats = this.getStats();
    const isCorrupted = currentCol?.status === 'corrupted';
    const isRepaired = currentCol?.status === 'repaired';

    return html`
      <div class="panel">
        <div class="panel-title">逐列传输与纠错挑战</div>
        
        <div class="challenge-container">
          <div class="main-panel">
            <div class="status-bar">
              <div class="shift-indicator">
                <span style="font-size:11px; color:#8b8070;">当前档位:</span>
                <span class="shift-badge ${this.currentShiftState === 'LETTERS' ? 'letters' : 'figures'}">
                  ${this.currentShiftState === 'LETTERS' ? '字母档' : '数字档'}
                </span>
              </div>
              <div class="progress-info">
                <span>进度: <span class="value">${this.currentIndex + 1} / ${this.transmissionHistory.length}</span></span>
                <span>状态: <span class="value">${this.getPhaseLabel()}</span></span>
              </div>
            </div>

            <div class="current-column-display">
              ${currentCol ? html`
                <div class="column-view original">
                  <div class="label">原始发送</div>
                  <div class="char-display">${currentCol.originalChar}</div>
                  ${this.renderHoles(currentCol.originalBits, false)}
                </div>

                <div class="vs-divider">
                  <span class="arrow">↓</span>
                  <span>传输</span>
                  <span class="arrow">↓</span>
                </div>

                <div class="column-view received">
                  <div class="label">接收端</div>
                  <div class="char-display ${isCorrupted ? 'corrupted' : ''} ${isRepaired ? 'repaired' : ''}">
                    ${this.repairBits !== null && currentCol.status === 'corrupted'
                      ? this.getRepairPreviewChar()
                      : currentCol.repairedDecodedChar || currentCol.receivedDecodedChar || '?'}
                  </div>
                  ${this.repairBits !== null
                    ? this.renderHoles(this.repairBits, true, currentCol.errorBitPositions, true)
                    : this.renderHoles(currentCol.receivedBits, false, currentCol.errorBitPositions)}
                </div>
              ` : html`
                <div class="empty-state" style="padding:40px;">
                  <div class="icon">▶</div>
                  <p>点击开始传输按钮开始逐列传输</p>
                </div>
              `}
            </div>

            ${this.repairBits !== null ? html`
              <div class="repair-section">
                <div class="repair-title">
                  🔧 ${currentCol?.status === 'corrupted' ? '错误检测 — ' : ''}手动修补模式
                  <span style="margin-left:8px; font-size:10px; color:#8b8070; font-weight:400;">
                    (第 ${this.selectedHistoryIndex + 1} 列)
                  </span>
                </div>
                <div class="repair-hint">
                  点击孔位切换状态，将接收端的孔位修复为正确值。修复完成后点击"确认修补"。
                </div>
                <div class="comparison-row">
                  <div class="comparison-item before">
                    <div class="label">修复前</div>
                    <div class="value">${currentCol?.receivedDecodedChar || '?'}</div>
                  </div>
                  <div class="comparison-item after">
                    <div class="label">修复后预览</div>
                    <div class="value">${this.getRepairPreviewChar()}</div>
                  </div>
                </div>
              </div>
            ` : nothing}

            <div class="controls-row">
              ${this.phase === 'idle' || this.phase === 'finished' ? html`
                <button class="metal-button accent" @click=${this.startTransmission}>
                  ▶ 开始传输
                </button>
              ` : this.phase === 'transmitting' ? html`
                <button class="metal-button" @click=${this.pauseTransmission}>
                  ⏸ 暂停
                </button>
              ` : this.repairBits !== null ? html`
                <button class="metal-button accent" @click=${this.applyRepair}>
                  ✓ 确认修补
                </button>
                <button class="metal-button" @click=${this.cancelManualRepair}>
                  ✕ 取消修补
                </button>
                ${currentCol?.status === 'repaired' && this.selectedHistoryIndex === this.currentIndex ? html`
                  <button class="metal-button" @click=${this.continueAfterRepair}>
                    ▶ 继续传输
                  </button>
                ` : nothing}
              ` : this.phase === 'paused' ? html`
                <button class="metal-button accent" @click=${this.resumeTransmission}>
                  ▶ 继续传输
                </button>
                <button class="metal-button" @click=${this.enterManualRepair} ?disabled=${this.selectedHistoryIndex < 0}>
                  🔧 手动修补此列
                </button>
              ` : html`
                <button class="metal-button" @click=${this.enterManualRepair} ?disabled=${this.selectedHistoryIndex < 0 || this.selectedHistoryIndex > this.currentIndex}>
                  🔧 手动修补此列
                </button>
              `}
              
              <button class="metal-button" @click=${this.resetTransmission} ?disabled=${this.phase === 'idle'}>
                ⟲ 重置
              </button>

              <div class="spacer"></div>

              <div class="noise-control">
                <span class="label">噪声:</span>
                <sl-range
                  min="0"
                  max="50"
                  step="1"
                  .value=${this.noiseLevel * 100}
                  @sl-change=${this.handleNoiseChange}
                  ?disabled=${this.phase === 'transmitting'}
                ></sl-range>
                <span style="font-size:12px; color:#d4a030; min-width:36px;">${Math.round(this.noiseLevel * 100)}%</span>
              </div>

              <div class="speed-control">
                <span class="label">速度:</span>
                <sl-range
                  min="0.5"
                  max="3"
                  step="0.25"
                  .value=${this.transmissionSpeed}
                  @sl-change=${this.handleSpeedChange}
                ></sl-range>
                <span style="font-size:12px; color:#d4a030; min-width:36px;">${this.transmissionSpeed}x</span>
              </div>
            </div>

            <div class="stats-bar">
              <span class="stat-item">已传输: <span class="num">${stats.total}</span></span>
              <span class="stat-item ok">正确: <span class="num">${stats.transmitted + stats.repaired}</span></span>
              <span class="stat-item error">错误: <span class="num">${stats.corrupted}</span></span>
              <span class="stat-item repair">已修复: <span class="num">${stats.repaired}</span></span>
            </div>

            ${this.phase === 'finished' ? html`
              <button class="metal-button accent" @click=${this.handleGenerateReport}>
                📄 生成传输报告
              </button>
            ` : nothing}
          </div>

          <div class="side-panel">
            <div class="panel" style="margin-bottom:0;">
              <div class="panel-title" style="font-size:12px;">传输历史</div>
              <div class="history-panel">
                ${this.transmissionHistory.map((col, i) => html`
                  <div
                    class="history-item ${col.status} ${i === this.selectedHistoryIndex ? 'selected' : ''}"
                    @click=${() => this.selectHistoryItem(i)}
                  >
                    <span class="col-index">#${i + 1}</span>
                    <span class="col-char">${col.repairedDecodedChar || col.receivedDecodedChar || col.originalChar}</span>
                    <span class="col-bits">${(col.repairedBits || col.receivedBits).map(b => b ? '1' : '0').join('')}</span>
                    <span class="status-icon">${this.getStatusIcon(col.status)}</span>
                  </div>
                `)}
              </div>
            </div>
          </div>
        </div>
      </div>

      ${this.showReport && this.report ? this.renderReport() : nothing}
    `;
  }

  private getPhaseLabel(): string {
    switch (this.phase) {
      case 'idle': return '待命';
      case 'transmitting': return '传输中';
      case 'paused': return '已暂停';
      case 'finished': return '已完成';
    }
  }

  private getStatusIcon(status: string): string {
    switch (status) {
      case 'pending': return '○';
      case 'transmitted': return '✓';
      case 'corrupted': return '✗';
      case 'repaired': return '🔧';
      default: return '?';
    }
  }

  private getRepairPreviewChar(): string {
    if (!this.repairBits || this.selectedHistoryIndex < 0) return '?';
    const shiftState = this.getEffectiveShiftStateAt(this.selectedHistoryIndex);
    const { decodedChar } = decodeSingleColumn(this.repairBits, shiftState);
    return decodedChar || '?';
  }

  private renderReport() {
    if (!this.report) return nothing;
    const r = this.report;

    return html`
      <div class="report-modal" @click=${(e: MouseEvent) => { if (e.target === e.currentTarget) this.closeReport(); }}>
        <div class="report-content">
          <h2>📡 传输报告</h2>
          
          <div class="report-section">
            <h3>传输统计</h3>
            <div class="report-stats">
              <div class="report-stat accuracy">
                <div class="value">${r.accuracy.toFixed(1)}%</div>
                <div class="label">正确率</div>
              </div>
              <div class="report-stat">
                <div class="value">${r.totalColumns}</div>
                <div class="label">总列数</div>
              </div>
              <div class="report-stat errors">
                <div class="value">${r.corruptedColumns}</div>
                <div class="label">损坏列</div>
              </div>
              <div class="report-stat repaired">
                <div class="value">${r.repairedColumns}</div>
                <div class="label">已修复</div>
              </div>
              <div class="report-stat errors">
                <div class="value">${r.unrepairableColumns}</div>
                <div class="label">未修复</div>
              </div>
              <div class="report-stat">
                <div class="value">${r.correctColumns}</div>
                <div class="label">正确列</div>
              </div>
            </div>
          </div>

          <div class="report-section">
            <h3>原文</h3>
            <div class="report-text">${r.originalText.toUpperCase()}</div>
          </div>

          <div class="report-section">
            <h3>最终译码</h3>
            <div class="report-text">${this.renderDecodedText(r)}</div>
          </div>

          <div class="report-section">
            <h3>编码序列</h3>
            <div class="report-text" style="font-size:11px;">${r.encodedBits}</div>
          </div>

          ${r.damageLocations.length > 0 ? html`
            <div class="report-section">
              <h3>损坏位置 (共 ${r.damageLocations.length} 处)</h3>
              <ul class="damage-list">
                ${r.damageLocations.map(d => html`
                  <li>
                    <span>第 ${d.index + 1} 列 (${d.originalChar})</span>
                    <span>错误位: ${d.errorBits.map(b => b + 1).join(', ')}</span>
                  </li>
                `)}
              </ul>
            </div>
          ` : nothing}

          ${r.repairResults.length > 0 ? html`
            <div class="report-section">
              <h3>修复记录 (共 ${r.repairResults.length} 处)</h3>
              <div class="repair-detail-list">
                ${r.repairResults.map(rr => html`
                  <div class="repair-detail-item">
                    <div class="repair-detail-header">
                      <span class="repair-detail-title">第 ${rr.index + 1} 列 — ${rr.originalChar} ${rr.success ? '✓' : '✗'}</span>
                      <span class="repair-detail-change" style="color:${rr.success ? '#2d8b46' : '#c0392b'}; font-weight:600;">
                        ${rr.beforeChar || '?'} → ${rr.afterChar || '?'}
                      </span>
                    </div>
                    <div class="repair-detail-bits">
                      <div class="repair-bit-group">
                        <div class="repair-bit-label">原始</div>
                        <div class="repair-bit-row">
                          ${rr.originalBits.map((b, i) => this.renderReportBit(b, i, []))}
                        </div>
                        <div class="repair-bit-str">${rr.originalBits.map(b => b ? '1' : '0').join('')}</div>
                      </div>
                      <div class="repair-bit-arrow">→</div>
                      <div class="repair-bit-group">
                        <div class="repair-bit-label">修复前</div>
                        <div class="repair-bit-row">
                          ${rr.beforeBits.map((b, i) => this.renderReportBit(b, i, rr.changedBits, 'before'))}
                        </div>
                        <div class="repair-bit-str">${rr.beforeBits.map(b => b ? '1' : '0').join('')}</div>
                      </div>
                      <div class="repair-bit-arrow">→</div>
                      <div class="repair-bit-group">
                        <div class="repair-bit-label">修复后</div>
                        <div class="repair-bit-row">
                          ${rr.afterBits.map((b, i) => this.renderReportBit(b, i, rr.changedBits, 'after'))}
                        </div>
                        <div class="repair-bit-str">${rr.afterBits.map(b => b ? '1' : '0').join('')}</div>
                      </div>
                    </div>
                    <div class="repair-detail-changed">
                      改动位: ${rr.changedBits.length > 0
                        ? rr.changedBits.map(p => `第${p + 1}位`).join(', ')
                        : '无'}
                    </div>
                  </div>
                `)}
              </div>
            </div>
          ` : nothing}

          <div class="modal-actions">
            <button class="metal-button" @click=${this.closeReport}>关闭</button>
          </div>
        </div>
      </div>
    `;
  }

  private renderDecodedText(report: TransmissionReport) {
    const original = report.originalText.toUpperCase();
    const decoded = report.finalDecodedText;
    let html = '';
    const maxLen = Math.max(original.length, decoded.length);
    for (let i = 0; i < maxLen; i++) {
      const oChar = i < original.length ? original[i] : '';
      const dChar = i < decoded.length ? decoded[i] : '';
      if (oChar === dChar) {
        html += dChar;
      } else {
        html += `<span class="error">${dChar || '□'}</span>`;
      }
    }
    return html;
  }

  private renderReportBit(bit: boolean, index: number, changedBits: number[], phase?: 'before' | 'after') {
    const isChanged = changedBits.includes(index);
    let className = 'report-bit ';
    className += bit ? 'punched ' : 'unpunched ';
    if (isChanged) {
      className += phase === 'before' ? 'changed-before ' : 'changed-after ';
    }
    return html`
      <div class="${className}" title="位${index + 1}: ${bit ? '1' : '0'}${isChanged ? ' (已改动)' : ''}">
        ${index + 1}
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
    'challenge-mode': ChallengeMode;
  }
}
