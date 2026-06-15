import { LitElement, html, css, nothing } from 'lit';
import { customElement, property, state, query } from 'lit/decorators.js';
import type {
  TransmissionColumnState,
  ShiftState,
  EndpointConfig,
  TeletypeEnd,
  FaultInjectionType,
  MessagePriority,
  LinkConfig,
  QueuedMessage,
  LinkState,
  CollisionEvent,
  ArbitrationChatMessage,
  ArbitrationCommunicationRecord,
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
  attachQueueInfoToMessage,
  createArbitrationCommunicationRecord,
} from '../core/dual-end-transmission';
import { filterText } from '../core/baudot-encoder';
import { sharedStyles } from '../styles';
import {
  getDefaultLinkConfig,
  getDefaultLinkState,
  createQueuedMessage,
  arbitrateQueue,
  detectCollision,
  createCollisionEvent,
  resolveCollision,
  applyTimeoutStrategy,
  updateLinkUtilization,
  checkMessageTimeout,
  getPriorityLabel,
  getQueueStatusLabel,
  getArbitrationModeLabel,
  getTimeoutStrategyLabel,
  getStatusColor,
  getPriorityColor,
  calculateArbitrationStats,
} from '../core/link-arbitration';

const HOLE_RADIUS = 12;

@customElement('arbitration-chatroom')
export class ArbitrationChatroom extends LitElement {
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
      .priority-select {
        display: flex;
        gap: 4px;
      }
      .priority-btn {
        padding: 4px 10px;
        border: 1px solid #3d3428;
        background: rgba(0,0,0,0.3);
        color: #8b8070;
        border-radius: 4px;
        cursor: pointer;
        font-family: 'IBM Plex Mono', monospace;
        font-size: 11px;
        text-transform: uppercase;
        letter-spacing: 1px;
        transition: all 0.2s ease;
      }
      .priority-btn:hover {
        border-color: #d4a030;
      }
      .priority-btn.active-high { background: rgba(192,57,43,0.2); color: #c0392b; border-color: #c0392b; }
      .priority-btn.active-normal { background: rgba(212,160,48,0.2); color: #d4a030; border-color: #d4a030; }
      .priority-btn.active-low { background: rgba(139,128,112,0.2); color: #8b8070; border-color: #8b8070; }
      .queue-panel {
        grid-column: 1 / -1;
        background: rgba(0, 0, 0, 0.25);
        border: 1px solid #3d3428;
        border-radius: 8px;
        padding: 16px;
      }
      .queue-header {
        display: flex;
        justify-content: space-between;
        align-items: center;
        margin-bottom: 12px;
      }
      .queue-title {
        font-family: 'Share Tech Mono', monospace;
        font-size: 13px;
        font-weight: 700;
        color: #d4a030;
        text-transform: uppercase;
        letter-spacing: 2px;
      }
      .queue-list {
        display: flex;
        flex-direction: column;
        gap: 6px;
        max-height: 240px;
        overflow-y: auto;
      }
      .queue-item {
        display: grid;
        grid-template-columns: auto 80px 1fr auto auto auto auto;
        gap: 10px;
        align-items: center;
        padding: 8px 12px;
        background: rgba(0, 0, 0, 0.3);
        border: 1px solid #2a2318;
        border-radius: 4px;
        font-size: 11px;
        font-family: 'IBM Plex Mono', monospace;
      }
      .queue-item .q-pos {
        width: 24px;
        height: 24px;
        display: flex;
        align-items: center;
        justify-content: center;
        background: rgba(212, 160, 48, 0.15);
        border: 1px solid #d4a030;
        border-radius: 50%;
        color: #d4a030;
        font-weight: 700;
        font-size: 11px;
      }
      .queue-item .q-end {
        font-weight: 700;
        text-transform: uppercase;
      }
      .queue-item .q-end-a { color: #4a9eff; }
      .queue-item .q-end-b { color: #ff6b6b; }
      .queue-item .q-text {
        color: #c8c0b0;
        white-space: nowrap;
        overflow: hidden;
        text-overflow: ellipsis;
        max-width: 200px;
      }
      .queue-item .q-priority {
        padding: 2px 6px;
        border-radius: 3px;
        font-weight: 600;
        font-size: 10px;
        text-transform: uppercase;
      }
      .queue-item .q-status {
        padding: 2px 6px;
        border-radius: 3px;
        font-weight: 600;
        font-size: 10px;
        text-transform: uppercase;
      }
      .queue-item .q-wait {
        color: #8b8070;
        font-size: 10px;
      }
      .queue-item .q-progress {
        width: 40px;
        height: 4px;
        background: #2a2318;
        border-radius: 2px;
        overflow: hidden;
      }
      .queue-item .q-progress-bar {
        height: 100%;
        background: #4a9eff;
        transition: width 0.3s ease;
      }
      .link-status-panel {
        grid-column: 1 / -1;
        background: linear-gradient(135deg, rgba(212,160,48,0.08), rgba(0,0,0,0.3));
        border: 1px solid #3d3428;
        border-radius: 8px;
        padding: 16px;
      }
      .link-status-grid {
        display: grid;
        grid-template-columns: repeat(4, 1fr);
        gap: 16px;
        align-items: center;
      }
      @media (max-width: 800px) {
        .link-status-grid {
          grid-template-columns: repeat(2, 1fr);
        }
      }
      .link-stat {
        display: flex;
        flex-direction: column;
        align-items: center;
        gap: 4px;
      }
      .link-stat .val {
        font-family: 'Share Tech Mono', monospace;
        font-size: 20px;
        font-weight: 700;
        color: #d4a030;
      }
      .link-stat .lbl {
        font-size: 10px;
        color: #8b8070;
        text-transform: uppercase;
        letter-spacing: 1px;
      }
      .link-stat.busy .val { color: #c0392b; }
      .link-stat.idle .val { color: #2d8b46; }
      .link-diagram {
        display: flex;
        align-items: center;
        justify-content: center;
        gap: 20px;
        margin-top: 12px;
      }
      .link-end {
        padding: 10px 20px;
        border-radius: 6px;
        font-family: 'Share Tech Mono', monospace;
        font-weight: 700;
        font-size: 14px;
        text-transform: uppercase;
        letter-spacing: 1px;
      }
      .link-end.a { background: rgba(74,158,255,0.15); border: 2px solid #4a9eff; color: #4a9eff; }
      .link-end.b { background: rgba(255,107,107,0.15); border: 2px solid #ff6b6b; color: #ff6b6b; }
      .link-end.active {
        animation: activeGlow 1s ease-in-out infinite;
      }
      @keyframes activeGlow {
        0%, 100% { box-shadow: 0 0 5px currentColor; }
        50% { box-shadow: 0 0 20px currentColor; }
      }
      .link-line {
        flex: 1;
        max-width: 300px;
        position: relative;
        height: 4px;
        background: #2a2318;
        border-radius: 2px;
      }
      .link-line.busy {
        background: linear-gradient(90deg, #d4a030, #4a9eff, #d4a030);
        background-size: 200% 100%;
        animation: linkFlow 1s linear infinite;
      }
      @keyframes linkFlow {
        0% { background-position: 0% 0%; }
        100% { background-position: 200% 0%; }
      }
      .link-line-label {
        position: absolute;
        top: 50%;
        left: 50%;
        transform: translate(-50%, -50%);
        background: #1a1410;
        padding: 2px 8px;
        border-radius: 3px;
        font-size: 10px;
        font-family: 'Share Tech Mono', monospace;
        color: #8b8070;
        white-space: nowrap;
      }
      .link-collision {
        color: #c0392b;
        font-weight: 700;
        animation: collisionFlash 0.5s ease-in-out infinite;
      }
      @keyframes collisionFlash {
        0%, 100% { opacity: 1; }
        50% { opacity: 0.3; }
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
      .chat-message.sent-a { border-left: 3px solid #4a9eff; }
      .chat-message.sent-b { border-left: 3px solid #ff6b6b; }
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
        flex-wrap: wrap;
        gap: 12px;
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
      .chat-message-stats .stat.collision .num { color: #e67e22; }
      .chat-message-stats .stat.queue .num { color: #8e44ad; }
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
        flex-wrap: wrap;
        gap: 12px;
      }
      .session-stats {
        display: flex;
        gap: 20px;
        font-size: 12px;
        flex-wrap: wrap;
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
        max-width: 1000px;
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
      @media (max-width: 700px) {
        .report-stats { grid-template-columns: repeat(2, 1fr); }
      }
      .report-stat {
        background: rgba(0, 0, 0, 0.3);
        padding: 10px;
        border-radius: 6px;
        text-align: center;
      }
      .report-stat .value {
        font-size: 20px;
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
      .report-stat.collisions .value { color: #e67e22; }
      .report-stat.utilization .value { color: #8e44ad; }
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
        flex-wrap: wrap;
        gap: 8px;
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
      @media (max-width: 600px) {
        .text-comparison { grid-template-columns: 1fr; }
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
      .queue-info-grid {
        display: grid;
        grid-template-columns: repeat(auto-fit, minmax(140px, 1fr));
        gap: 8px;
        margin-top: 8px;
        padding-top: 8px;
        border-top: 1px solid #2a2318;
      }
      .queue-info-item {
        display: flex;
        justify-content: space-between;
        font-size: 11px;
        padding: 4px 8px;
        background: rgba(0, 0, 0, 0.2);
        border-radius: 3px;
      }
      .queue-info-item .k { color: #8b8070; }
      .queue-info-item .v {
        color: #f5f0e8;
        font-weight: 600;
        font-family: 'Share Tech Mono', monospace;
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
      .link-config-panel {
        grid-column: 1 / -1;
        background: rgba(0, 0, 0, 0.2);
        border-radius: 6px;
        padding: 12px;
        border: 1px solid #2a2318;
      }
      .link-config-grid {
        display: grid;
        grid-template-columns: repeat(auto-fit, minmax(200px, 1fr));
        gap: 12px;
      }
      .empty-queue {
        text-align: center;
        padding: 20px;
        color: #5a5040;
        font-size: 11px;
      }
      .collision-banner {
        grid-column: 1 / -1;
        background: rgba(192, 57, 43, 0.15);
        border: 1px solid #c0392b;
        border-radius: 6px;
        padding: 10px 16px;
        color: #ff6b6b;
        font-size: 12px;
        font-family: 'Share Tech Mono', monospace;
        text-transform: uppercase;
        letter-spacing: 1px;
        animation: collisionFlash 0.5s ease-in-out infinite;
        display: flex;
        align-items: center;
        justify-content: center;
        gap: 10px;
      }
    `,
  ];

  @state() private configA: EndpointConfig = getDefaultEndpointConfig();
  @state() private configB: EndpointConfig = getDefaultEndpointConfig();
  @state() private linkConfig: LinkConfig = getDefaultLinkConfig();
  @state() private linkState: LinkState = getDefaultLinkState();

  @state() private inputA = '';
  @state() private inputB = '';
  @state() private priorityA: MessagePriority = 'normal';
  @state() private priorityB: MessagePriority = 'normal';

  @state() private receivedTextA = '';
  @state() private receivedTextB = '';

  @state() private shiftStateA: ShiftState = 'LETTERS';
  @state() private shiftStateB: ShiftState = 'LETTERS';

  @state() private receivedColumnsA: TransmissionColumnState[] = [];
  @state() private receivedColumnsB: TransmissionColumnState[] = [];

  @state() private messages: ArbitrationChatMessage[] = [];
  @state() private queue: QueuedMessage[] = [];
  @state() private currentTransmitting: QueuedMessage | null = null;
  @state() private currentMessage: any = null;
  @state() private currentColumnIndex = -1;

  @state() private collisionEvents: CollisionEvent[] = [];
  @state() private activeCollision: CollisionEvent | null = null;
  @state() private deliveryOrder: string[] = [];

  @state() private lastServedEnd: TeletypeEnd | null = null;

  @state() private showReport = false;
  @state() private communicationRecord: ArbitrationCommunicationRecord | null = null;

  @state() private configHistory: { timestamp: number; end: TeletypeEnd; config: EndpointConfig }[] = [];
  @state() private linkConfigHistory: { timestamp: number; config: LinkConfig }[] = [];

  private transmissionTimer: number | null = null;
  private queueTimer: number | null = null;
  private sessionId = `arb-session-${Date.now()}`;
  private sessionStart = Date.now();

  @query('#inputA') private inputAreaA!: HTMLTextAreaElement;
  @query('#inputB') private inputAreaB!: HTMLTextAreaElement;

  connectedCallback() {
    super.connectedCallback();
    this.startQueueProcessor();
  }

  disconnectedCallback() {
    super.disconnectedCallback();
    if (this.transmissionTimer) clearTimeout(this.transmissionTimer);
    if (this.queueTimer) clearInterval(this.queueTimer);
  }

  private startQueueProcessor() {
    this.queueTimer = window.setInterval(() => {
      this.processQueue();
      this.checkTimeouts();
      this.updateUtilization();
    }, 100);
  }

  private updateUtilization() {
    this.linkState = updateLinkUtilization(this.linkState, this.sessionStart);
  }

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

  private setPriority(end: TeletypeEnd, p: MessagePriority) {
    if (end === 'A') this.priorityA = p;
    else this.priorityB = p;
  }

  private enqueueMessage(fromEnd: TeletypeEnd) {
    const input = fromEnd === 'A' ? this.inputA : this.inputB;
    if (!input.trim()) return;

    const queuedCount = this.queue.filter(q => q.fromEnd === fromEnd).length;
    if (queuedCount >= this.linkConfig.bufferSize) {
      alert(`终端 ${fromEnd} 发送缓冲区已满（${this.linkConfig.bufferSize}条）`);
      return;
    }

    const toEnd: TeletypeEnd = fromEnd === 'A' ? 'B' : 'A';
    const priority = fromEnd === 'A' ? this.priorityA : this.priorityB;
    const senderConfig = fromEnd === 'A' ? this.configA : this.configB;
    const receiverConfig = fromEnd === 'A' ? this.configB : this.configA;

    const chatMsg = createChatMessage(fromEnd, toEnd, input, senderConfig, receiverConfig);
    const queued = createQueuedMessage(
      chatMsg.id,
      fromEnd,
      toEnd,
      input,
      priority,
      chatMsg.sentColumns.length
    );

    (chatMsg as any).queuedId = queued.id;

    this.queue = [...this.queue, queued];

    if (fromEnd === 'A') this.inputA = '';
    else this.inputB = '';

    this.requestUpdate();
  }

  private checkTimeouts() {
    let changed = false;
    const updated = this.queue.map(msg => {
      if (msg.queueStatus === 'queued' || msg.queueStatus === 'waiting_retry') {
        if (checkMessageTimeout(msg, this.linkConfig.timeoutMs)) {
          changed = true;
          return applyTimeoutStrategy(msg, this.linkConfig.timeoutStrategy, this.linkConfig.maxRetryAttempts);
        }
      }
      return msg;
    });
    if (changed) this.queue = updated;

    const timeouts = this.queue.filter(q => q.queueStatus === 'timeout');
    if (timeouts.length > 0) {
      this.queue = this.queue.filter(q => q.queueStatus !== 'timeout');
    }
  }

  private processQueue() {
    if (this.linkState.isBusy || this.activeCollision) return;

    const waiting = this.queue.filter(
      q => q.queueStatus === 'queued' || q.queueStatus === 'waiting_retry'
    );
    if (waiting.length === 0) return;

    if (this.linkConfig.collisionDetectEnabled) {
      const fromA = waiting.filter(q => q.fromEnd === 'A');
      const fromB = waiting.filter(q => q.fromEnd === 'B');
      if (fromA.length > 0 && fromB.length > 0 && this.linkState.totalArbitrations > 0 && Math.random() < 0.3) {
        const candidates = [fromA[0], fromB[0]];
        this.triggerCollision(candidates);
        return;
      }
    }

    const sorted = arbitrateQueue(waiting, this.linkConfig.arbitrationMode, this.lastServedEnd);
    const next = sorted[0];
    this.startTransmission(next);
  }

  private triggerCollision(messages: QueuedMessage[]) {
    const collision = createCollisionEvent(messages);
    this.collisionEvents.push(collision);
    this.activeCollision = collision;
    this.linkState.totalCollisions++;

    this.queue = this.queue.map(q => {
      if (collision.messageIds.includes(q.id)) {
        return { ...q, queueStatus: 'collision' as const, collisionCount: q.collisionCount + 1, lastEvent: '检测到冲突！' };
      }
      return q;
    });

    setTimeout(() => {
      this.resolveActiveCollision();
    }, 1500);
  }

  private resolveActiveCollision() {
    if (!this.activeCollision) return;

    const { winner, losers } = resolveCollision(
      this.activeCollision,
      this.queue,
      this.linkConfig.arbitrationMode,
      this.lastServedEnd
    );

    this.queue = this.queue.map(q => {
      if (winner && q.id === winner.id) {
        return { ...q, lastEvent: '冲突仲裁胜出' };
      }
      if (losers.find(l => l.id === q.id)) {
        return { ...q, queueStatus: 'queued' as const, lastEvent: '冲突仲裁失败，重新排队' };
      }
      return q;
    });

    this.activeCollision.resolved = true;
    this.activeCollision.resolution = winner
      ? `终端 ${winner.fromEnd} 胜出（${getArbitrationModeLabel(this.linkConfig.arbitrationMode)}）`
      : '无胜出者';

    const collisionSaved = this.activeCollision;
    this.activeCollision = null;

    if (winner) {
      setTimeout(() => this.startTransmissionById(winner.id), 300);
    }
  }

  private startTransmissionById(queuedId: string) {
    const msg = this.queue.find(q => q.id === queuedId);
    if (msg) this.startTransmission(msg);
  }

  private startTransmission(queuedMsg: QueuedMessage) {
    const fromEnd = queuedMsg.fromEnd;
    const toEnd: TeletypeEnd = fromEnd === 'A' ? 'B' : 'A';
    const senderConfig = fromEnd === 'A' ? this.configA : this.configB;
    const receiverConfig = fromEnd === 'A' ? this.configB : this.configA;

    const chatMsg = createChatMessage(fromEnd, toEnd, queuedMsg.originalText, senderConfig, receiverConfig);

    const now = Date.now();
    const waitDuration = now - queuedMsg.enqueueTime;

    this.queue = this.queue.map(q => {
      if (q.id === queuedMsg.id) {
        return {
          ...q,
          queueStatus: 'transmitting' as const,
          dequeueTime: now,
          startTime: now,
          waitDurationMs: waitDuration,
          lastEvent: '开始传输',
          transmissionPath: [...q.transmissionPath, toEnd],
        };
      }
      return q;
    });

    this.currentTransmitting = this.queue.find(q => q.id === queuedMsg.id) || queuedMsg;
    this.currentMessage = chatMsg;
    this.currentColumnIndex = -1;
    this.linkState.isBusy = true;
    this.linkState.currentOwner = fromEnd;
    this.linkState.currentMessageId = queuedMsg.chatMessageId;
    this.linkState.totalArbitrations++;
    this.lastServedEnd = fromEnd;

    if (fromEnd === 'A') {
      this.receivedColumnsB = [];
      this.shiftStateB = 'LETTERS';
    } else {
      this.receivedColumnsA = [];
      this.shiftStateA = 'LETTERS';
    }

    this.requestUpdate();
    this.transmitNextColumn();
  }

  private transmitNextColumn() {
    if (!this.currentMessage || !this.currentTransmitting) return;

    const nextIndex = this.currentColumnIndex + 1;
    const columns = this.currentMessage.sentColumns;

    if (nextIndex >= columns.length) {
      this.finishTransmission();
      return;
    }

    this.currentColumnIndex = nextIndex;

    this.queue = this.queue.map(q => {
      if (q.id === this.currentTransmitting?.id) {
        return { ...q, columnProgress: nextIndex + 1, lastEvent: `传输列 ${nextIndex + 1}/${columns.length}` };
      }
      return q;
    });
    if (this.currentTransmitting) {
      this.currentTransmitting.columnProgress = nextIndex + 1;
    }

    this.transmitColumnAtIndex(nextIndex);
  }

  private transmitColumnAtIndex(index: number) {
    if (!this.currentMessage || !this.currentTransmitting) return;

    const columns = this.currentMessage.sentColumns;
    const column = columns[index];
    const fromEnd = this.currentTransmitting.fromEnd;
    const receiverConfig = fromEnd === 'A' ? this.configB : this.configA;
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

    if (fromEnd === 'A') {
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
        }, this.getTransmissionInterval(fromEnd));
        return;
      }
    }

    this.requestUpdate();

    this.transmissionTimer = window.setTimeout(() => {
      this.transmitNextColumn();
    }, this.getTransmissionInterval(fromEnd));
  }

  private getShiftStateBeforeIndex(index: number, isRetransmission: boolean): ShiftState {
    if (index === 0) return 'LETTERS';

    let shift: ShiftState = 'LETTERS';
    const endIndex = index;

    for (let i = 0; i < endIndex; i++) {
      const col = this.currentMessage?.sentColumns[i];
      if (!col) continue;
      const activeBits = col.receivedBits;
      const key = activeBits.map((b: boolean) => (b ? '1' : '0')).join('');
      if (key === '11111') {
        shift = 'LETTERS';
      } else if (key === '11011') {
        shift = 'FIGURES';
      }
    }
    return shift;
  }

  private finishTransmission() {
    if (!this.currentMessage || !this.currentTransmitting) return;

    const now = Date.now();
    const queuedId = this.currentTransmitting.id;
    const fromEnd = this.currentTransmitting.fromEnd;

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

    const transmitDuration = now - (this.currentTransmitting.startTime || now);
    const totalDuration = now - this.currentTransmitting.enqueueTime;

    const nextOrder = this.deliveryOrder.length + 1;
    this.deliveryOrder.push(this.currentMessage.id);

    const arbitrationMsg = attachQueueInfoToMessage(
      this.currentMessage,
      {
        ...this.currentTransmitting,
        startTime: this.currentTransmitting.startTime,
        endTime: now,
        transmitDurationMs: transmitDuration,
        totalDurationMs: totalDuration,
      },
      nextOrder
    );

    this.messages = [...this.messages, arbitrationMsg];

    this.queue = this.queue.filter(q => q.id !== queuedId);

    this.linkState.totalTransmitTimeMs += transmitDuration;
    this.linkState.isBusy = false;
    this.linkState.currentOwner = null;
    this.linkState.currentMessageId = null;

    if (fromEnd === 'A') {
      this.receivedTextB = receivedText;
    } else {
      this.receivedTextA = receivedText;
    }

    this.currentMessage = null;
    this.currentTransmitting = null;
    this.currentColumnIndex = -1;

    this.requestUpdate();
  }

  private handleNoiseChange(end: TeletypeEnd, e: CustomEvent) {
    const value = (e.target as any).value as number;
    const noiseLevel = Math.max(0, Math.min(1, value / 100));
    const baseConfig = end === 'A' ? this.configA : this.configB;
    const newConfig: EndpointConfig = { ...baseConfig, noiseLevel };
    if (end === 'A') this.configA = newConfig;
    else this.configB = newConfig;
    this.configHistory.push({ timestamp: Date.now(), end, config: { ...newConfig } });
  }

  private handleSpeedChange(end: TeletypeEnd, e: CustomEvent) {
    const value = (e.target as any).value as number;
    const baseConfig = end === 'A' ? this.configA : this.configB;
    const newConfig: EndpointConfig = { ...baseConfig, transmissionSpeed: value };
    if (end === 'A') this.configA = newConfig;
    else this.configB = newConfig;
    this.configHistory.push({ timestamp: Date.now(), end, config: { ...newConfig } });
  }

  private handleFaultTypeChange(end: TeletypeEnd, e: Event) {
    const value = (e.target as HTMLSelectElement).value as FaultInjectionType;
    const baseConfig = end === 'A' ? this.configA : this.configB;
    const newConfig: EndpointConfig = { ...baseConfig, faultType: value };
    if (end === 'A') this.configA = newConfig;
    else this.configB = newConfig;
    this.configHistory.push({ timestamp: Date.now(), end, config: { ...newConfig } });
  }

  private handleFaultParamChange(end: TeletypeEnd, e: CustomEvent) {
    const value = (e.target as any).value as number;
    const baseConfig = end === 'A' ? this.configA : this.configB;
    const newConfig: EndpointConfig = { ...baseConfig, faultParam: value };
    if (end === 'A') this.configA = newConfig;
    else this.configB = newConfig;
    this.configHistory.push({ timestamp: Date.now(), end, config: { ...newConfig } });
  }

  private handleAutoRetransmitChange(end: TeletypeEnd, e: Event) {
    const checked = (e.target as HTMLInputElement).checked;
    const baseConfig = end === 'A' ? this.configA : this.configB;
    const newConfig: EndpointConfig = { ...baseConfig, enableAutoRetransmit: checked };
    if (end === 'A') this.configA = newConfig;
    else this.configB = newConfig;
    this.configHistory.push({ timestamp: Date.now(), end, config: { ...newConfig } });
  }

  private handleMaxRetriesChange(end: TeletypeEnd, e: CustomEvent) {
    const value = (e.target as any).value as number;
    const baseConfig = end === 'A' ? this.configA : this.configB;
    const newConfig: EndpointConfig = { ...baseConfig, maxRetransmitAttempts: Math.round(value) };
    if (end === 'A') this.configA = newConfig;
    else this.configB = newConfig;
    this.configHistory.push({ timestamp: Date.now(), end, config: { ...newConfig } });
  }

  private handleBandwidthChange(e: CustomEvent) {
    const value = (e.target as any).value as number;
    this.linkConfig = { ...this.linkConfig, bandwidthBps: Math.round(value) };
    this.linkConfigHistory.push({ timestamp: Date.now(), config: { ...this.linkConfig } });
  }

  private handleBufferSizeChange(e: CustomEvent) {
    const value = (e.target as any).value as number;
    this.linkConfig = { ...this.linkConfig, bufferSize: Math.round(value) };
    this.linkConfigHistory.push({ timestamp: Date.now(), config: { ...this.linkConfig } });
  }

  private handleArbitrationModeChange(e: Event) {
    const value = (e.target as HTMLSelectElement).value as LinkConfig['arbitrationMode'];
    this.linkConfig = { ...this.linkConfig, arbitrationMode: value };
    this.linkConfigHistory.push({ timestamp: Date.now(), config: { ...this.linkConfig } });
  }

  private handleTimeoutStrategyChange(e: Event) {
    const value = (e.target as HTMLSelectElement).value as LinkConfig['timeoutStrategy'];
    this.linkConfig = { ...this.linkConfig, timeoutStrategy: value };
    this.linkConfigHistory.push({ timestamp: Date.now(), config: { ...this.linkConfig } });
  }

  private handleTimeoutMsChange(e: CustomEvent) {
    const value = (e.target as any).value as number;
    this.linkConfig = { ...this.linkConfig, timeoutMs: Math.round(value) * 1000 };
    this.linkConfigHistory.push({ timestamp: Date.now(), config: { ...this.linkConfig } });
  }

  private handleCollisionDetectChange(e: Event) {
    const checked = (e.target as HTMLInputElement).checked;
    this.linkConfig = { ...this.linkConfig, collisionDetectEnabled: checked };
    this.linkConfigHistory.push({ timestamp: Date.now(), config: { ...this.linkConfig } });
  }

  private handleGenerateReport() {
    this.communicationRecord = createArbitrationCommunicationRecord(
      this.sessionId,
      this.messages,
      this.configHistory,
      this.linkConfig,
      this.linkState,
      this.collisionEvents,
      this.queue,
      this.deliveryOrder
    );
    this.showReport = true;
  }

  private closeReport() {
    this.showReport = false;
  }

  private clearSession() {
    this.messages = [];
    this.queue = [];
    this.receivedTextA = '';
    this.receivedTextB = '';
    this.receivedColumnsA = [];
    this.receivedColumnsB = [];
    this.shiftStateA = 'LETTERS';
    this.shiftStateB = 'LETTERS';
    this.sessionId = `arb-session-${Date.now()}`;
    this.sessionStart = Date.now();
    this.configHistory = [];
    this.collisionEvents = [];
    this.deliveryOrder = [];
    this.currentMessage = null;
    this.currentTransmitting = null;
    this.currentColumnIndex = -1;
    this.linkState = getDefaultLinkState();
    this.lastServedEnd = null;
    this.activeCollision = null;
  }

  private getSessionStats() {
    return calculateArbitrationStats(this.messages, this.linkState, this.sessionStart);
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
    let htmlStr = '';
    const maxLen = Math.max(orig.length, received.length);
    for (let i = 0; i < maxLen; i++) {
      const oChar = i < orig.length ? orig[i] : '';
      const dChar = i < received.length ? received[i] : '';
      if (oChar === dChar) {
        htmlStr += dChar;
      } else {
        htmlStr += `<span class="error">${dChar || '□'}</span>`;
      }
    }
    return htmlStr;
  }

  private renderPriorityButtons(end: TeletypeEnd) {
    const current = end === 'A' ? this.priorityA : this.priorityB;
    return html`
      <div class="priority-select">
        <button
          class="priority-btn ${current === 'high' ? 'active-high' : ''}"
          @click=${() => this.setPriority(end, 'high')}
        >高</button>
        <button
          class="priority-btn ${current === 'normal' ? 'active-normal' : ''}"
          @click=${() => this.setPriority(end, 'normal')}
        >普通</button>
        <button
          class="priority-btn ${current === 'low' ? 'active-low' : ''}"
          @click=${() => this.setPriority(end, 'low')}
        >低</button>
      </div>
    `;
  }

  private renderTerminal(end: TeletypeEnd) {
    const isA = end === 'A';
    const config = isA ? this.configA : this.configB;
    const input = isA ? this.inputA : this.inputB;
    const receivedText = isA ? this.receivedTextA : this.receivedTextB;
    const receivedColumns = isA ? this.receivedColumnsA : this.receivedColumnsB;
    const shiftState = isA ? this.shiftStateA : this.shiftStateB;
    const otherEnd: TeletypeEnd = isA ? 'B' : 'A';

    const currentColumn = this.currentMessage && this.currentColumnIndex >= 0
      ? this.currentMessage.sentColumns[this.currentColumnIndex]
      : null;
    const isReceiving = this.currentTransmitting?.fromEnd === otherEnd;

    const queueCount = this.queue.filter(q => q.fromEnd === end).length;

    return html`
      <div class="terminal-panel terminal-${end.toLowerCase()}">
        <div class="panel">
          <div class="panel-title" style="${isA ? 'color: #4a9eff;' : 'color: #ff6b6b;'}">
            ${isA ? '🔵' : '🔴'} 电传机 ${end}
            <span style="font-size:11px; font-weight:400; margin-left:8px; color:#8b8070;">
              队列: ${queueCount}/${this.linkConfig.bufferSize}
            </span>
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

          <div class="config-row" style="margin-bottom: 8px;">
            <span class="label">消息优先级</span>
            ${this.renderPriorityButtons(end)}
          </div>

          <div class="input-area">
            <textarea
              id="input${end}"
              .value=${input}
              @input=${(e: Event) => isA ? this.handleInputA(e) : this.handleInputB(e)}
              placeholder="输入要发送的消息..."
            ></textarea>
            <button
              class="metal-button accent send-button"
              @click=${() => this.enqueueMessage(end)}
              ?disabled=${!input.trim() || queueCount >= this.linkConfig.bufferSize}
            >
              ▶ 排队发送
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
              ></sl-range>
              <span class="value">${config.transmissionSpeed}x</span>
            </div>

            <div class="config-row">
              <span class="label">故障类型</span>
              <select
                .value=${config.faultType}
                @change=${(e: Event) => this.handleFaultTypeChange(end, e)}
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
                ></sl-range>
                <span class="value">${config.maxRetransmitAttempts}次</span>
              </div>
            ` : nothing}
          </div>
        </div>
      </div>
    `;
  }

  private renderQueuePanel() {
    const sortedQueue = arbitrateQueue([...this.queue], this.linkConfig.arbitrationMode, this.lastServedEnd);

    return html`
      <div class="queue-panel">
        <div class="queue-header">
          <span class="queue-title">📋 发送队列 (${sortedQueue.length}/${this.linkConfig.bufferSize * 2})</span>
          <span style="font-size:11px; color:#8b8070; font-family:'Share Tech Mono', monospace;">
            调度算法: ${getArbitrationModeLabel(this.linkConfig.arbitrationMode)}
          </span>
        </div>
        ${sortedQueue.length === 0 ? html`
          <div class="empty-queue">队列为空，等待发送消息...</div>
        ` : html`
          <div class="queue-list">
            ${sortedQueue.map((q, idx) => {
              const waitMs = Date.now() - q.enqueueTime;
              const progress = q.totalColumns > 0 ? (q.columnProgress / q.totalColumns) * 100 : 0;
              return html`
                <div class="queue-item">
                  <div class="q-pos">${idx + 1}</div>
                  <div class="q-end ${q.fromEnd === 'A' ? 'q-end-a' : 'q-end-b'}">端 ${q.fromEnd}</div>
                  <div class="q-text" title="${q.originalText}">${q.originalText}</div>
                  <div class="q-priority" style="background:${getPriorityColor(q.priority)}20; color:${getPriorityColor(q.priority)}; border:1px solid ${getPriorityColor(q.priority)};">
                    ${getPriorityLabel(q.priority)}
                  </div>
                  <div class="q-status" style="background:${getStatusColor(q.queueStatus)}20; color:${getStatusColor(q.queueStatus)}; border:1px solid ${getStatusColor(q.queueStatus)};">
                    ${getQueueStatusLabel(q.queueStatus)}
                  </div>
                  <div class="q-wait">${(waitMs / 1000).toFixed(1)}s</div>
                  <div class="q-progress">
                    <div class="q-progress-bar" style="width:${progress}%;"></div>
                  </div>
                </div>
              `;
            })}
          </div>
        `}
      </div>
    `;
  }

  private renderLinkStatus() {
    const stats = this.getSessionStats();
    return html`
      <div class="link-status-panel">
        <div class="link-status-grid">
          <div class="link-stat ${this.linkState.isBusy ? 'busy' : 'idle'}">
            <div class="val">${this.linkState.isBusy ? 'BUSY' : 'IDLE'}</div>
            <div class="lbl">链路状态</div>
          </div>
          <div class="link-stat">
            <div class="val">${this.linkState.utilizationPercent.toFixed(1)}%</div>
            <div class="lbl">链路利用率</div>
          </div>
          <div class="link-stat">
            <div class="val" style="color:${stats.totalCollisions > 0 ? '#e67e22' : '#2d8b46'};">${stats.totalCollisions}</div>
            <div class="lbl">冲突次数</div>
          </div>
          <div class="link-stat">
            <div class="val">${(stats.avgQueueTimeMs / 1000).toFixed(2)}s</div>
            <div class="lbl">平均等待</div>
          </div>
        </div>
        <div class="link-diagram">
          <div class="link-end a ${this.linkState.currentOwner === 'A' ? 'active' : ''}">
            A ${this.linkState.currentOwner === 'A' ? '◉ 发送中' : ''}
          </div>
          <div class="link-line ${this.linkState.isBusy ? 'busy' : ''}">
            <span class="link-line-label">
              ${this.activeCollision ? html`<span class="link-collision">⚠ 冲突检测中</span>` :
                this.linkState.isBusy ? `${this.linkState.currentOwner} → ${this.linkState.currentOwner === 'A' ? 'B' : 'A'}` :
                `${this.linkConfig.bandwidthBps} bps`}
            </span>
          </div>
          <div class="link-end b ${this.linkState.currentOwner === 'B' ? 'active' : ''}">
            ${this.linkState.currentOwner === 'B' ? '◉ 发送中' : ''} B
          </div>
        </div>
      </div>
    `;
  }

  private renderLinkConfigPanel() {
    return html`
      <div class="link-config-panel">
        <div class="panel-title" style="font-size:12px; margin-bottom:12px;">
          🌐 全局链路仲裁配置
        </div>
        <div class="link-config-grid">
          <div class="config-row">
            <span class="label">链路带宽</span>
            <sl-range
              min="50"
              max="1200"
              step="50"
              .value=${this.linkConfig.bandwidthBps}
              @sl-change=${this.handleBandwidthChange}
            ></sl-range>
            <span class="value">${this.linkConfig.bandwidthBps}bps</span>
          </div>
          <div class="config-row">
            <span class="label">缓冲区大小</span>
            <sl-range
              min="1"
              max="20"
              step="1"
              .value=${this.linkConfig.bufferSize}
              @sl-change=${this.handleBufferSizeChange}
            ></sl-range>
            <span class="value">${this.linkConfig.bufferSize}条</span>
          </div>
          <div class="config-row">
            <span class="label">仲裁模式</span>
            <select .value=${this.linkConfig.arbitrationMode} @change=${this.handleArbitrationModeChange}>
              <option value="priority">${getArbitrationModeLabel('priority')}</option>
              <option value="fifo">${getArbitrationModeLabel('fifo')}</option>
              <option value="round_robin">${getArbitrationModeLabel('round_robin')}</option>
            </select>
          </div>
          <div class="config-row">
            <span class="label">超时策略</span>
            <select .value=${this.linkConfig.timeoutStrategy} @change=${this.handleTimeoutStrategyChange}>
              <option value="drop">${getTimeoutStrategyLabel('drop')}</option>
              <option value="retry">${getTimeoutStrategyLabel('retry')}</option>
              <option value="escalate">${getTimeoutStrategyLabel('escalate')}</option>
            </select>
          </div>
          <div class="config-row">
            <span class="label">超时时间</span>
            <sl-range
              min="5"
              max="120"
              step="5"
              .value=${Math.round(this.linkConfig.timeoutMs / 1000)}
              @sl-change=${this.handleTimeoutMsChange}
            ></sl-range>
            <span class="value">${Math.round(this.linkConfig.timeoutMs / 1000)}s</span>
          </div>
          <div class="config-row">
            <label class="checkbox-row">
              <input
                type="checkbox"
                .checked=${this.linkConfig.collisionDetectEnabled}
                @change=${this.handleCollisionDetectChange}
              >
              <span style="font-size:12px;">启用冲突检测模拟</span>
            </label>
          </div>
        </div>
      </div>
    `;
  }

  render() {
    const stats = this.getSessionStats();

    return html`
      <div class="panel">
        <div class="panel-title">⚖️ 通信仲裁与排队调度模式</div>

        <div class="chatroom-container">
          ${this.renderTerminal('A')}
          ${this.renderTerminal('B')}

          ${this.activeCollision ? html`
            <div class="collision-banner">
              ⚠ 检测到链路冲突！正在仲裁中... 涉及终端: ${this.activeCollision.conflictingEnds.join(' vs ')}
            </div>
          ` : nothing}

          ${this.renderLinkStatus()}

          ${this.renderQueuePanel()}

          <div class="transmission-line">
            ${this.currentTransmitting ? html`
              <div class="transmission-content">
                <span class="transmission-arrow">${this.currentTransmitting.fromEnd === 'A' ? '→' : '←'}</span>
                <div class="transmission-info">
                  <div class="status">传输中</div>
                  <div class="detail sending-${this.currentTransmitting.fromEnd === 'A' ? 'a' : 'b'}">
                    ${this.currentTransmitting.fromEnd} → ${this.currentTransmitting.toEnd}
                    <span style="font-size:12px; margin-left:12px;">
                      列 ${this.currentColumnIndex + 1} / ${this.currentMessage?.sentColumns.length || 0}
                    </span>
                    <span style="font-size:11px; margin-left:12px; color:#8b8070;">
                      优先级: ${getPriorityLabel(this.currentTransmitting.priority)}
                    </span>
                  </div>
                </div>
                <span class="transmission-arrow">${this.currentTransmitting.fromEnd === 'A' ? '→' : '←'}</span>
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

          ${this.renderLinkConfigPanel()}

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
                <span class="label">成功率</span>
                <span class="value" style="color:${stats.averageSuccessRate >= 90 ? '#2d8b46' : stats.averageSuccessRate >= 70 ? '#d4a030' : '#c0392b'};">
                  ${stats.averageSuccessRate.toFixed(1)}%
                </span>
              </div>
              <div class="stat">
                <span class="label">冲突</span>
                <span class="value" style="color:#e67e22;">${stats.totalCollisions}</span>
              </div>
              <div class="stat">
                <span class="label">利用率</span>
                <span class="value" style="color:#8e44ad;">${stats.linkUtilizationPercent.toFixed(1)}%</span>
              </div>
            </div>
            <div style="display: flex; gap: 8px;">
              <button
                class="metal-button"
                @click=${this.handleGenerateReport}
                ?disabled=${this.messages.length === 0}
              >
                📄 生成仲裁报告
              </button>
              <button
                class="metal-button danger"
                @click=${this.clearSession}
                ?disabled=${this.messages.length === 0 && this.queue.length === 0}
              >
                🗑 清空会话
              </button>
            </div>
          </div>

          <div class="chat-history">
            ${this.messages.length === 0 ? html`
              <div class="empty-history">
                <div style="font-size:32px; margin-bottom:8px;">⚖️</div>
                <div>尚无消息记录</div>
                <div style="margin-top:4px;">在任意终端输入文字并点击"排队发送"</div>
              </div>
            ` : html`
              ${this.messages.map(msg => html`
                <div class="chat-message sent-${msg.fromEnd === 'A' ? 'a' : 'b'}">
                  <div class="chat-message-header">
                    <span class="sender">
                      ${msg.fromEnd === 'A' ? '🔵 终端 A' : '🔴 终端 B'}
                      <span style="margin-left:8px; color:#5a5040; font-weight:400;">→</span>
                      <span style="margin-left:8px; color:#8b8070;">${msg.toEnd}</span>
                      <span style="margin-left:12px; padding:1px 6px; border-radius:3px; font-size:10px; background:${getPriorityColor(msg.queueInfo.priority)}20; color:${getPriorityColor(msg.queueInfo.priority)}; border:1px solid ${getPriorityColor(msg.queueInfo.priority)};">
                        ${getPriorityLabel(msg.queueInfo.priority)}优先级
                      </span>
                      ${msg.queueInfo.deliveryOrder ? html`
                        <span style="margin-left:8px; font-size:10px; color:#8e44ad;">送达#${msg.queueInfo.deliveryOrder}</span>
                      ` : nothing}
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
                    <span class="stat collision">
                      冲突: <span class="num">${msg.queueInfo.collisionCount}</span>
                    </span>
                    <span class="stat queue">
                      等待: <span class="num">${(msg.queueInfo.waitDurationMs / 1000).toFixed(2)}s</span>
                    </span>
                    <span class="stat">
                      传输: <span class="num">${(msg.queueInfo.transmitDurationMs / 1000).toFixed(2)}s</span>
                    </span>
                    <span class="stat">
                      路径: <span class="num">${msg.queueInfo.transmissionPath.join('→')}</span>
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
          <h2>⚖️ 通信仲裁与排队调度报告</h2>
          <div style="font-size:11px; color:#8b8070; margin-bottom:16px;">
            会话ID: ${r.sessionId} | 开始时间: ${new Date(r.startTime).toLocaleString()} | 结束时间: ${new Date(r.endTime).toLocaleString()}
          </div>

          <div class="report-section">
            <h3>链路配置</h3>
            <div class="queue-info-grid">
              <div class="queue-info-item"><span class="k">带宽</span><span class="v">${r.linkConfig.bandwidthBps} bps</span></div>
              <div class="queue-info-item"><span class="k">缓冲区</span><span class="v">${r.linkConfig.bufferSize} 条/端</span></div>
              <div class="queue-info-item"><span class="k">仲裁模式</span><span class="v">${getArbitrationModeLabel(r.linkConfig.arbitrationMode)}</span></div>
              <div class="queue-info-item"><span class="k">超时策略</span><span class="v">${getTimeoutStrategyLabel(r.linkConfig.timeoutStrategy)}</span></div>
              <div class="queue-info-item"><span class="k">超时时间</span><span class="v">${Math.round(r.linkConfig.timeoutMs / 1000)}s</span></div>
              <div class="queue-info-item"><span class="k">冲突检测</span><span class="v">${r.linkConfig.collisionDetectEnabled ? '启用' : '禁用'}</span></div>
            </div>
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
              <div class="report-stat collisions">
                <div class="value">${s.totalCollisions}</div>
                <div class="label">冲突次数</div>
              </div>
              <div class="report-stat utilization">
                <div class="value">${s.linkUtilizationPercent.toFixed(1)}%</div>
                <div class="label">链路利用率</div>
              </div>
              <div class="report-stat">
                <div class="value">${(s.avgQueueTimeMs / 1000).toFixed(2)}s</div>
                <div class="label">平均排队</div>
              </div>
              <div class="report-stat">
                <div class="value">${(s.maxQueueTimeMs / 1000).toFixed(2)}s</div>
                <div class="label">最大排队</div>
              </div>
              <div class="report-stat">
                <div class="value">${s.totalRetries}</div>
                <div class="label">超时重试</div>
              </div>
              <div class="report-stat accuracy">
                <div class="value">${s.messagesDeliveredInOrder}</div>
                <div class="label">按序送达</div>
              </div>
              <div class="report-stat errors">
                <div class="value">${s.timeoutDrops}</div>
                <div class="label">超时丢弃</div>
              </div>
            </div>
          </div>

          ${r.collisionEvents.length > 0 ? html`
            <div class="report-section">
              <h3>冲突事件记录 (${r.collisionEvents.length} 次)</h3>
              <ul class="error-detail-list">
                ${r.collisionEvents.map((ev, i) => html`
                  <li>
                    <span>#${i + 1} ${new Date(ev.timestamp).toLocaleTimeString()}</span>
                    <span>
                      终端: ${ev.conflictingEnds.join(' vs ')} |
                      结果: ${ev.resolved ? ev.resolution : '未解决'}
                    </span>
                  </li>
                `)}
              </ul>
            </div>
          ` : nothing}

          <div class="report-section">
            <h3>消息详情与送达顺序 (${r.messages.length} 条)</h3>
            <div class="message-list">
              ${r.messages.map((msg) => html`
                <div class="message-detail sent-${msg.fromEnd === 'A' ? 'a' : 'b'}">
                  <div class="message-detail-header">
                    <span class="sender">
                      ${msg.queueInfo.deliveryOrder ? html`<span style="color:#8e44ad;">#${msg.queueInfo.deliveryOrder}</span> ` : ''}
                      ${msg.fromEnd === 'A' ? '🔵 A' : '🔴 B'} → ${msg.toEnd}
                      <span style="margin-left:8px; padding:1px 6px; border-radius:3px; font-size:10px; background:${getPriorityColor(msg.queueInfo.priority)}20; color:${getPriorityColor(msg.queueInfo.priority)}; border:1px solid ${getPriorityColor(msg.queueInfo.priority)};">
                        ${getPriorityLabel(msg.queueInfo.priority)}优先级
                      </span>
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
                  <div class="queue-info-grid">
                    <div class="queue-info-item"><span class="k">排队耗时</span><span class="v">${(msg.queueInfo.waitDurationMs / 1000).toFixed(3)}s</span></div>
                    <div class="queue-info-item"><span class="k">传输耗时</span><span class="v">${(msg.queueInfo.transmitDurationMs / 1000).toFixed(3)}s</span></div>
                    <div class="queue-info-item"><span class="k">冲突次数</span><span class="v">${msg.queueInfo.collisionCount}</span></div>
                    <div class="queue-info-item"><span class="k">超时重试</span><span class="v">${msg.queueInfo.retryCount}</span></div>
                    <div class="queue-info-item"><span class="k">传输路径</span><span class="v">${msg.queueInfo.transmissionPath.join(' → ')}</span></div>
                    <div class="queue-info-item"><span class="k">状态</span><span class="v" style="color:${getStatusColor(msg.queueInfo.status)};">${getQueueStatusLabel(msg.queueInfo.status)}</span></div>
                  </div>
                  <div style="display:flex; gap:16px; font-size:11px; color:#8b8070; margin-top:8px;">
                    <span>成功率: <strong style="color:${msg.successRate >= 90 ? '#2d8b46' : msg.successRate >= 70 ? '#d4a030' : '#c0392b'};">${msg.successRate.toFixed(1)}%</strong></span>
                    <span>列数: <strong>${msg.sentColumns.length}</strong></span>
                    <span>错误: <strong>${msg.errorPositions.length}</strong></span>
                    <span>发送噪声: <strong>${Math.round(msg.configSnapshot.receiver.noiseLevel * 100)}%</strong></span>
                  </div>
                </div>
              `)}
            </div>
          </div>

          <div class="modal-actions">
            <button class="metal-button" @click=${this.closeReport}>关闭</button>
          </div>
        </div>
      </div>
    `;
  }
}

declare global {
  interface HTMLElementTagNameMap {
    'arbitration-chatroom': ArbitrationChatroom;
  }
}