import { LitElement, html, css } from 'lit';
import { customElement, property } from 'lit/decorators.js';
import type { EncodedColumn } from '../types';
import { sharedStyles } from '../styles';

@customElement('decoder-panel')
export class DecoderPanel extends LitElement {
  static styles = [
    sharedStyles,
    css`
      :host {
        display: block;
      }
      .decoded-text {
        background: #0d0b08;
        border: 1px solid #3d3428;
        border-radius: 4px;
        padding: 12px;
        font-family: 'Share Tech Mono', 'IBM Plex Mono', monospace;
        font-size: 16px;
        line-height: 1.8;
        min-height: 60px;
        white-space: pre-wrap;
        word-break: break-all;
        color: #2d8b46;
      }
      .decoded-text .invalid {
        color: #c0392b;
        font-weight: 700;
        background: rgba(192, 57, 43, 0.15);
        padding: 0 2px;
        border-radius: 2px;
      }
      .decoded-text .shift-marker {
        color: #d4a030;
        font-size: 11px;
        opacity: 0.7;
      }
      .decoded-text .corrupted {
        color: #e74c3c;
        text-decoration: underline wavy #c0392b;
        text-underline-offset: 3px;
      }
      .comparison {
        margin-top: 12px;
        display: grid;
        grid-template-columns: 1fr 1fr;
        gap: 12px;
      }
      .comparison-col {
        background: rgba(0, 0, 0, 0.2);
        border-radius: 4px;
        padding: 8px;
      }
      .comparison-col .label {
        font-size: 10px;
        color: #8b8070;
        text-transform: uppercase;
        letter-spacing: 1px;
        margin-bottom: 6px;
      }
      .comparison-col .text {
        font-family: 'IBM Plex Mono', monospace;
        font-size: 13px;
        line-height: 1.6;
        white-space: pre-wrap;
        word-break: break-all;
      }
      .comparison-col.original .text {
        color: #8b8070;
      }
      .comparison-col.decoded .text {
        color: #2d8b46;
      }
      .comparison-col.decoded .text .diff {
        color: #c0392b;
        font-weight: 700;
        background: rgba(192, 57, 43, 0.15);
        padding: 0 2px;
        border-radius: 2px;
      }
      .stats {
        margin-top: 12px;
        display: flex;
        gap: 16px;
        font-size: 11px;
        color: #8b8070;
      }
      .stats .stat {
        display: flex;
        align-items: center;
        gap: 4px;
      }
      .stats .error-count {
        color: #c0392b;
        font-weight: 600;
      }
      .stats .valid-count {
        color: #2d8b46;
        font-weight: 600;
      }
    `,
  ];

  @property({ type: Array }) decodedColumns: EncodedColumn[] = [];
  @property({ type: String }) originalText = '';

  private getDecodedHtml(): string {
    return this.decodedColumns
      .map(col => {
        if (col.isShiftCode) {
          return `<span class="shift-marker">[${col.decodedChar}]</span>`;
        }
        if (!col.isValid || col.decodedChar === null) {
          return `<span class="invalid">■</span>`;
        }
        if (col.corrupted) {
          return `<span class="corrupted">${col.decodedChar}</span>`;
        }
        return col.decodedChar;
      })
      .join('');
  }

  private getCleanDecodedText(): string {
    return this.decodedColumns
      .filter(c => !c.isShiftCode && c.isValid && c.decodedChar)
      .map(c => c.decodedChar === '↵' ? '\n' : c.decodedChar === '←' ? '\r' : c.decodedChar!)
      .join('');
  }

  private getComparisonHtml(): string {
    const original = this.originalText.toUpperCase();
    const decoded = this.getCleanDecodedText();
    let html = '';
    const maxLen = Math.max(original.length, decoded.length);
    for (let i = 0; i < maxLen; i++) {
      const oChar = i < original.length ? original[i] : '';
      const dChar = i < decoded.length ? decoded[i] : '';
      if (oChar === dChar) {
        html += dChar;
      } else {
        html += `<span class="diff">${dChar || '□'}</span>`;
      }
    }
    return html;
  }

  private getInvalidCount(): number {
    return this.decodedColumns.filter(c => !c.isValid).length;
  }

  private getCorruptedCount(): number {
    return this.decodedColumns.filter(c => c.corrupted).length;
  }

  render() {
    const invalidCount = this.getInvalidCount();
    const corruptedCount = this.getCorruptedCount();

    return html`
      <div class="panel">
        <div class="panel-title">译码面板</div>
        <div class="decoded-text" .innerHTML=${this.getDecodedHtml()}></div>
        ${this.originalText
          ? html`
              <div class="comparison">
                <div class="comparison-col original">
                  <div class="label">原文</div>
                  <div class="text">${this.originalText.toUpperCase()}</div>
                </div>
                <div class="comparison-col decoded">
                  <div class="label">译码</div>
                  <div class="text" .innerHTML=${this.getComparisonHtml()}></div>
                </div>
              </div>
            `
          : nothing}
        <div class="stats">
          <span class="stat">总列数: <strong>${this.decodedColumns.length}</strong></span>
          <span class="stat">
            有效: <strong class="valid-count">${this.decodedColumns.filter(c => c.isValid && !c.isShiftCode).length}</strong>
          </span>
          ${invalidCount > 0
            ? html`<span class="stat">
                无效: <strong class="error-count">${invalidCount}</strong>
              </span>`
            : nothing}
          ${corruptedCount > 0
            ? html`<span class="stat">
                损坏: <strong class="error-count">${corruptedCount}</strong>
              </span>`
            : nothing}
        </div>
      </div>
    `;
  }
}

import { nothing } from 'lit';

declare global {
  interface HTMLElementTagNameMap {
    'decoder-panel': DecoderPanel;
  }
}
