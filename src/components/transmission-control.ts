import { LitElement, html, css } from 'lit';
import { customElement, property } from 'lit/decorators.js';
import { sharedStyles } from '../styles';
import '@shoelace-style/shoelace/dist/components/range/range.js';
import '@shoelace-style/shoelace/dist/components/button/button.js';
import '@shoelace-style/shoelace/dist/components/icon/icon.js';
import '@shoelace-style/shoelace/dist/components/icon-button/icon-button.js';

@customElement('transmission-control')
export class TransmissionControl extends LitElement {
  static styles = [
    sharedStyles,
    css`
      :host {
        display: block;
      }
      .controls-row {
        display: flex;
        align-items: center;
        gap: 16px;
        flex-wrap: wrap;
      }
      .control-group {
        display: flex;
        flex-direction: column;
        gap: 4px;
      }
      .slider-group {
        flex: 1;
        min-width: 150px;
      }
      sl-range {
        --sl-color-primary-600: #d4a030;
        --sl-color-primary-500: #d4a030;
        --sl-color-primary-400: #e0b040;
        --sl-color-neutral-0: #1a1410;
        --sl-color-neutral-200: #3d3428;
        --sl-color-neutral-300: #5a5040;
        --sl-input-font-size: 12px;
      }
      .value-display {
        font-size: 13px;
        font-weight: 600;
        color: #d4a030;
        min-width: 40px;
        text-align: center;
      }
      .button-group {
        display: flex;
        gap: 8px;
        align-items: center;
      }
      .status-text {
        font-size: 11px;
        color: #8b8070;
        margin-top: 8px;
      }
    `,
  ];

  @property({ type: Number }) noiseLevel = 0;
  @property({ type: Number }) playbackSpeed = 1;
  @property({ type: Boolean }) isPlaying = false;
  @property({ type: Boolean }) hasColumns = false;

  private handleNoiseChange(e: CustomEvent) {
    const value = (e.target as any).value as number;
    const clamped = Math.max(0, Math.min(100, value));
    this.dispatchEvent(
      new CustomEvent('noise-change', {
        detail: { level: clamped / 100 },
        bubbles: true,
        composed: true,
      })
    );
  }

  private handleSpeedChange(e: CustomEvent) {
    const value = (e.target as any).value as number;
    this.dispatchEvent(
      new CustomEvent('speed-change', {
        detail: { speed: value },
        bubbles: true,
        composed: true,
      })
    );
  }

  private handlePlay() {
    this.dispatchEvent(
      new CustomEvent('playback-control', {
        detail: { action: this.isPlaying ? 'pause' : 'play' },
        bubbles: true,
        composed: true,
      })
    );
  }

  private handleReset() {
    this.dispatchEvent(
      new CustomEvent('playback-control', {
        detail: { action: 'reset' },
        bubbles: true,
        composed: true,
      })
    );
  }

  private handleInjectNoise() {
    this.dispatchEvent(
      new CustomEvent('inject-noise', {
        bubbles: true,
        composed: true,
      })
    );
  }

  render() {
    return html`
      <div class="panel">
        <div class="panel-title">传输控制</div>
        <div class="controls-row">
          <div class="control-group slider-group">
            <div class="label">噪声强度</div>
            <div style="display:flex;align-items:center;gap:8px;">
              <sl-range
                min="0"
                max="100"
                step="1"
                .value=${this.noiseLevel * 100}
                @sl-change=${this.handleNoiseChange}
              ></sl-range>
              <span class="value-display">${Math.round(this.noiseLevel * 100)}%</span>
            </div>
          </div>

          <div class="control-group slider-group">
            <div class="label">传输速度</div>
            <div style="display:flex;align-items:center;gap:8px;">
              <sl-range
                min="0.25"
                max="4"
                step="0.25"
                .value=${this.playbackSpeed}
                @sl-change=${this.handleSpeedChange}
              ></sl-range>
              <span class="value-display">${this.playbackSpeed}x</span>
            </div>
          </div>

          <div class="control-group">
            <div class="label">操作</div>
            <div class="button-group">
              <button
                class="metal-button accent"
                @click=${this.handlePlay}
                ?disabled=${!this.hasColumns}
              >
                ${this.isPlaying ? '⏸ 暂停' : '▶ 播放'}
              </button>
              <button
                class="metal-button"
                @click=${this.handleReset}
                ?disabled=${!this.hasColumns}
              >
                ⟲ 重置
              </button>
              <button
                class="metal-button danger"
                @click=${this.handleInjectNoise}
                ?disabled=${!this.hasColumns || this.noiseLevel === 0}
              >
                ⚡ 注入噪声
              </button>
            </div>
          </div>
        </div>
        <div class="status-text">
          ${this.isPlaying ? '纸带正在传输...' : '就绪 — 点击播放开始纸带传输动画'}
        </div>
      </div>
    `;
  }
}

declare global {
  interface HTMLElementTagNameMap {
    'transmission-control': TransmissionControl;
  }
}
