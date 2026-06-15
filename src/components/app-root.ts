import { LitElement, html, css } from 'lit';
import { customElement, state, query } from 'lit/decorators.js';
import type { EncodedColumn, ShiftState } from '../types';
import { encodeText, filterText } from '../core/baudot-encoder';
import { decodeColumns, getDecodedText } from '../core/baudot-decoder';
import { injectNoise } from '../core/noise-generator';
import './encoder-panel';
import './paper-tape-view';
import './transmission-control';
import './decoder-panel';

@customElement('app-root')
export class AppRoot extends LitElement {
  static styles = css`
    :host {
      display: block;
      min-height: 100vh;
      background: #1a1410;
      padding: 20px;
      max-width: 1200px;
      margin: 0 auto;
    }
    .header {
      text-align: center;
      margin-bottom: 24px;
      padding: 20px 0;
      border-bottom: 2px solid #3d3428;
    }
    .header h1 {
      font-family: 'Share Tech Mono', 'IBM Plex Mono', monospace;
      font-size: 28px;
      color: #d4a030;
      letter-spacing: 4px;
      text-transform: uppercase;
      margin: 0;
      text-shadow: 0 0 20px rgba(212, 160, 48, 0.3);
    }
    .header .subtitle {
      font-size: 12px;
      color: #8b8070;
      letter-spacing: 2px;
      margin-top: 8px;
      text-transform: uppercase;
    }
    .content {
      display: flex;
      flex-direction: column;
      gap: 0;
    }
    .version-badge {
      display: inline-block;
      background: rgba(212, 160, 48, 0.15);
      border: 1px solid #d4a030;
      color: #d4a030;
      padding: 2px 8px;
      border-radius: 3px;
      font-size: 10px;
      letter-spacing: 1px;
      margin-top: 8px;
    }
  `;

  @state() private encodedColumns: EncodedColumn[] = [];
  @state() private decodedColumns: EncodedColumn[] = [];
  @state() private originalText = '';
  @state() private noiseLevel = 0;
  @state() private playbackSpeed = 1;
  @state() private isPlaying = false;

  private originalEncodedColumns: EncodedColumn[] = [];

  @query('paper-tape-view') tapeView!: import('./paper-tape-view').PaperTapeView;

  private handleTextInput(e: CustomEvent) {
    const text = e.detail.text;
    const { filtered } = filterText(text);
    this.originalText = filtered;
    this.encodedColumns = encodeText(text);
    this.originalEncodedColumns = this.encodedColumns.map(c => ({ ...c, bits: [...c.bits] as [boolean, boolean, boolean, boolean, boolean] }));
    this.decodedColumns = decodeColumns(this.encodedColumns);
    this.isPlaying = false;
    if (this.tapeView) {
      this.tapeView.resetPlayback();
    }
  }

  private handleBitsChanged(e: CustomEvent) {
    const { index, bits } = e.detail;
    const originalBits = this.originalEncodedColumns[index]?.bits;
    const corrupted = originalBits ? bits.some((b: boolean, i: number) => b !== originalBits[i]) : false;
    const newColumns = [...this.encodedColumns];
    newColumns[index] = {
      ...newColumns[index],
      bits,
      corrupted,
    };
    this.encodedColumns = newColumns;
    this.decodedColumns = decodeColumns(this.encodedColumns);
  }

  private handleNoiseChange(e: CustomEvent) {
    this.noiseLevel = e.detail.level;
  }

  private handleSpeedChange(e: CustomEvent) {
    this.playbackSpeed = e.detail.speed;
  }

  private handlePlaybackControl(e: CustomEvent) {
    const { action } = e.detail;
    switch (action) {
      case 'play':
        this.isPlaying = true;
        break;
      case 'pause':
        this.isPlaying = false;
        break;
      case 'reset':
        this.isPlaying = false;
        if (this.tapeView) {
          this.tapeView.resetPlayback();
        }
        break;
    }
  }

  private handleInjectNoise() {
    const noisyColumns = injectNoise(this.encodedColumns, this.noiseLevel);
    this.encodedColumns = noisyColumns.map((col, i) => {
      const originalBits = this.originalEncodedColumns[i]?.bits;
      const corrupted = originalBits ? col.bits.some((b, j) => b !== originalBits[j]) : col.corrupted;
      return { ...col, corrupted };
    });
    this.decodedColumns = decodeColumns(this.encodedColumns);
  }

  private handlePlaybackFinished() {
    this.isPlaying = false;
  }

  render() {
    return html`
      <div class="header">
        <h1>电传打字机纸带编码模拟器</h1>
        <div class="subtitle">BAUDOT ITA2 ENCODING SIMULATOR</div>
        <span class="version-badge">BAUDOT MORK ITA2</span>
      </div>
      <div class="content">
        <encoder-panel
          .columns=${this.encodedColumns}
          @text-input=${this.handleTextInput}
        ></encoder-panel>

        <paper-tape-view
          .columns=${this.encodedColumns}
          .isPlaying=${this.isPlaying}
          .playbackSpeed=${this.playbackSpeed}
          @bits-changed=${this.handleBitsChanged}
          @playback-finished=${this.handlePlaybackFinished}
        ></paper-tape-view>

        <transmission-control
          .noiseLevel=${this.noiseLevel}
          .playbackSpeed=${this.playbackSpeed}
          .isPlaying=${this.isPlaying}
          .hasColumns=${this.encodedColumns.length > 0}
          @noise-change=${this.handleNoiseChange}
          @speed-change=${this.handleSpeedChange}
          @playback-control=${this.handlePlaybackControl}
          @inject-noise=${this.handleInjectNoise}
        ></transmission-control>

        <decoder-panel
          .decodedColumns=${this.decodedColumns}
          .originalText=${this.originalText}
        ></decoder-panel>
      </div>
    `;
  }
}

declare global {
  interface HTMLElementTagNameMap {
    'app-root': AppRoot;
  }
}
