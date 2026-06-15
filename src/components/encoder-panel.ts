import { LitElement, html, css, nothing } from 'lit';
import { customElement, property, state } from 'lit/decorators.js';
import type { EncodedColumn } from '../types';
import { sharedStyles } from '../styles';
import { filterText } from '../core/baudot-encoder';
import '@shoelace-style/shoelace/dist/components/textarea/textarea.js';
import '@shoelace-style/shoelace/dist/components/icon/icon.js';

@customElement('encoder-panel')
export class EncoderPanel extends LitElement {
  static styles = [
    sharedStyles,
    css`
      :host {
        display: block;
      }
      .input-area {
        margin-bottom: 12px;
      }
      sl-textarea {
        --sl-input-font-family: 'IBM Plex Mono', monospace;
        --sl-input-font-size: 14px;
        --sl-input-color: #f5f0e8;
        --sl-input-bg-color: #1a1410;
        --sl-input-border-color: #3d3428;
        --sl-input-hover-border-color: #d4a030;
        --sl-input-focus-border-color: #d4a030;
        --sl-input-placeholder-color: #5a5040;
        --sl-input-border-radius: 4px;
        --sl-focus-ring-color: #d4a03040;
      }
      .info-bar {
        display: flex;
        gap: 16px;
        font-size: 11px;
        color: #8b8070;
        margin-bottom: 12px;
        align-items: center;
      }
      .removed-warning {
        color: #c0392b;
        font-weight: 600;
      }
      .encoding-table {
        max-height: 180px;
        overflow-y: auto;
        scrollbar-width: thin;
        scrollbar-color: #d4a030 #1a1410;
      }
      .encoding-table::-webkit-scrollbar {
        width: 6px;
      }
      .encoding-table::-webkit-scrollbar-track {
        background: #1a1410;
        border-radius: 3px;
      }
      .encoding-table::-webkit-scrollbar-thumb {
        background: #d4a030;
        border-radius: 3px;
      }
      table {
        width: 100%;
        border-collapse: collapse;
        font-size: 12px;
      }
      th {
        text-align: left;
        padding: 4px 8px;
        color: #d4a030;
        border-bottom: 1px solid #3d3428;
        font-weight: 600;
        font-size: 10px;
        text-transform: uppercase;
        letter-spacing: 1px;
      }
      td {
        padding: 3px 8px;
        border-bottom: 1px solid #2a2318;
        color: #c8c0b0;
      }
      td.bits {
        font-family: 'Share Tech Mono', monospace;
        letter-spacing: 2px;
      }
      td.char-cell {
        font-weight: 600;
        color: #f5f0e8;
      }
      td.shift-cell {
        color: #d4a030;
        font-style: italic;
      }
      tr:hover {
        background: rgba(212, 160, 48, 0.05);
      }
      .supported-chars {
        margin-top: 8px;
        padding: 8px;
        background: rgba(0, 0, 0, 0.2);
        border-radius: 4px;
        font-size: 11px;
        color: #8b8070;
        line-height: 1.6;
      }
      .supported-chars span {
        display: inline-block;
        margin-right: 4px;
        padding: 1px 4px;
        background: rgba(212, 160, 48, 0.1);
        border-radius: 2px;
        color: #c8c0b0;
      }
    `,
  ];

  @property({ type: Array }) columns: EncodedColumn[] = [];
  @state() private removedCount = 0;

  private handleInput(e: CustomEvent) {
    const value = (e.target as any).value as string;
    const { filtered, removedCount } = filterText(value);
    this.removedCount = removedCount;
    this.dispatchEvent(
      new CustomEvent('text-input', {
        detail: { text: value },
        bubbles: true,
        composed: true,
      })
    );
  }

  render() {
    return html`
      <div class="panel">
        <div class="panel-title">编码面板</div>
        <div class="input-area">
          <sl-textarea
            placeholder="输入文字（仅支持 A-Z、0-9 及常用标点）..."
            rows=3
            resize="auto"
            @sl-input=${this.handleInput}
          ></sl-textarea>
        </div>
        <div class="info-bar">
          <span>编码列数: ${this.columns.length}</span>
          ${this.removedCount > 0
            ? html`<span class="removed-warning">已过滤 ${this.removedCount} 个不支持字符</span>`
            : nothing}
        </div>
        ${this.columns.length > 0
          ? html`
              <div class="encoding-table">
                <table>
                  <thead>
                    <tr>
                      <th>#</th>
                      <th>字符</th>
                      <th>档位</th>
                      <th>编码</th>
                    </tr>
                  </thead>
                  <tbody>
                    ${this.columns.map(
                      (col, i) => html`
                        <tr>
                          <td>${i + 1}</td>
                          <td class="${col.isShiftCode ? 'shift-cell' : 'char-cell'}">
                            ${col.originalChar}
                          </td>
                          <td>${col.shiftState === 'LETTERS' ? '字母' : '数字'}</td>
                          <td class="bits">${col.bits.map(b => (b ? '1' : '0')).join('')}</td>
                        </tr>
                      `
                    )}
                  </tbody>
                </table>
              </div>
            `
          : nothing}
        <div class="supported-chars">
          <strong style="color: #d4a030;">支持的字符：</strong><br />
          ${'A B C D E F G H I J K L M N O P Q R S T U V W X Y Z 0 1 2 3 4 5 6 7 8 9 - \' 8 7 , ! : ( ) " # . ? & / ;'.split(' ').map(ch => html`<span>${ch}</span>`)}
        </div>
      </div>
    `;
  }
}

declare global {
  interface HTMLElementTagNameMap {
    'encoder-panel': EncoderPanel;
  }
}
