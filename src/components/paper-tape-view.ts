import { LitElement, html, css, nothing } from 'lit';
import { customElement, property, query, state } from 'lit/decorators.js';
import type { EncodedColumn } from '../types';
import { sharedStyles } from '../styles';

const COL_WIDTH = 40;
const ROW_HEIGHT = 36;
const HOLE_RADIUS = 12;
const SPROCKET_RADIUS = 6;
const PADDING_X = 30;
const PADDING_Y = 20;
const TAPE_HEIGHT = ROW_HEIGHT * 6 + PADDING_Y * 2;

@customElement('paper-tape-view')
export class PaperTapeView extends LitElement {
  static styles = [
    sharedStyles,
    css`
      :host {
        display: block;
      }
      .tape-container {
        position: relative;
        overflow: hidden;
        border: 2px solid #3d3428;
        border-radius: 6px;
        background: #0d0b08;
      }
      .tape-scroll {
        overflow-x: auto;
        overflow-y: hidden;
        scrollbar-width: thin;
        scrollbar-color: #d4a030 #1a1410;
      }
      .tape-scroll::-webkit-scrollbar {
        height: 8px;
      }
      .tape-scroll::-webkit-scrollbar-track {
        background: #1a1410;
        border-radius: 4px;
      }
      .tape-scroll::-webkit-scrollbar-thumb {
        background: #d4a030;
        border-radius: 4px;
      }
      canvas {
        display: block;
        cursor: pointer;
      }
      .tape-info {
        display: flex;
        gap: 16px;
        margin-top: 8px;
        font-size: 11px;
        color: #8b8070;
      }
      .tape-info span {
        display: flex;
        align-items: center;
        gap: 4px;
      }
      .legend-dot {
        display: inline-block;
        width: 10px;
        height: 10px;
        border-radius: 50%;
        border: 1px solid #555;
      }
      .legend-dot.open {
        background: #1a1410;
      }
      .legend-dot.closed {
        background: #1a1a1a;
      }
      .legend-dot.sprocket {
        background: #1a1410;
        border: 1px dashed #666;
      }
      .legend-dot.corrupted {
        background: #c0392b;
      }
      .char-row {
        display: flex;
        margin-top: 4px;
        padding-left: ${PADDING_X}px;
        gap: 0;
      }
      .char-label {
        width: ${COL_WIDTH}px;
        text-align: center;
        font-size: 10px;
        color: #8b8070;
        overflow: hidden;
        white-space: nowrap;
        text-overflow: ellipsis;
      }
      .char-label.invalid {
        color: #c0392b;
        font-weight: 700;
      }
      .char-label.shift {
        color: #d4a030;
        font-style: italic;
      }
      .playback-indicator {
        position: absolute;
        top: 4px;
        right: 8px;
        font-size: 10px;
        color: #2d8b46;
        display: flex;
        align-items: center;
        gap: 4px;
      }
      .playback-indicator.paused {
        color: #d4a030;
      }
      .playback-indicator .dot {
        width: 6px;
        height: 6px;
        border-radius: 50%;
        background: currentColor;
        animation: blink 1s infinite;
      }
      @keyframes blink {
        0%, 100% { opacity: 1; }
        50% { opacity: 0.3; }
      }
    `,
  ];

  @property({ type: Array }) columns: EncodedColumn[] = [];
  @property({ type: Boolean }) isPlaying = false;
  @property({ type: Number }) playbackSpeed = 1;
  @property({ type: Number }) currentPosition = 0;

  @query('canvas') canvas!: HTMLCanvasElement;

  @state() private hoveredHole: { col: number; row: number } | null = null;

  private animation: Animation | null = null;
  private animContainer!: HTMLDivElement;
  private dpr = window.devicePixelRatio || 1;

  updated(changed: Map<string, unknown>) {
    if (changed.has('columns')) {
      this.drawTape();
    }
    if (changed.has('isPlaying') || changed.has('playbackSpeed')) {
      this.handlePlaybackChange();
    }
  }

  firstUpdated() {
    this.animContainer = this.shadowRoot!.querySelector('.tape-scroll') as HTMLDivElement;
    this.drawTape();
  }

  private getTapeWidth(): number {
    return PADDING_X * 2 + this.columns.length * COL_WIDTH;
  }

  private drawTape() {
    const canvas = this.canvas;
    if (!canvas) return;

    const width = Math.max(this.getTapeWidth(), 600);
    canvas.width = width * this.dpr;
    canvas.height = TAPE_HEIGHT * this.dpr;
    canvas.style.width = `${width}px`;
    canvas.style.height = `${TAPE_HEIGHT}px`;

    const ctx = canvas.getContext('2d')!;
    ctx.scale(this.dpr, this.dpr);

    ctx.fillStyle = '#f5f0e8';
    ctx.fillRect(0, 0, width, TAPE_HEIGHT);

    this.drawTapeTexture(ctx, width);

    for (let i = 0; i < this.columns.length; i++) {
      this.drawColumn(ctx, i);
    }

    if (this.hoveredHole !== null) {
      this.drawHoverHighlight(ctx, this.hoveredHole.col, this.hoveredHole.row);
    }
  }

  private drawTapeTexture(ctx: CanvasRenderingContext2D, width: number) {
    ctx.save();
    ctx.globalAlpha = 0.03;
    for (let y = 0; y < TAPE_HEIGHT; y += 2) {
      for (let x = 0; x < width; x += 2) {
        if (Math.random() > 0.5) {
          ctx.fillStyle = '#000';
          ctx.fillRect(x, y, 1, 1);
        }
      }
    }
    ctx.restore();

    ctx.strokeStyle = '#d4c8b0';
    ctx.lineWidth = 0.5;
    const sprocketY = PADDING_Y + ROW_HEIGHT * 2.5 + ROW_HEIGHT / 2;
    ctx.setLineDash([4, 4]);
    ctx.beginPath();
    ctx.moveTo(0, sprocketY);
    ctx.lineTo(width, sprocketY);
    ctx.stroke();
    ctx.setLineDash([]);
  }

  private drawColumn(ctx: CanvasRenderingContext2D, colIndex: number) {
    const col = this.columns[colIndex];
    if (!col) return;

    const x = PADDING_X + colIndex * COL_WIDTH + COL_WIDTH / 2;

    for (let row = 0; row < 5; row++) {
      const y = PADDING_Y + row * ROW_HEIGHT + ROW_HEIGHT / 2;
      const isPunched = col.bits[row];

      ctx.beginPath();
      ctx.arc(x, y, HOLE_RADIUS, 0, Math.PI * 2);

      if (isPunched) {
        ctx.fillStyle = col.corrupted ? '#c0392b' : '#1a1410';
        ctx.fill();
        ctx.strokeStyle = col.corrupted ? '#e74c3c' : '#3d3428';
        ctx.lineWidth = 1;
        ctx.stroke();
      } else {
        ctx.fillStyle = '#2a2520';
        ctx.fill();
        ctx.strokeStyle = '#555';
        ctx.lineWidth = 0.5;
        ctx.stroke();
      }
    }

    const sprocketY = PADDING_Y + 2 * ROW_HEIGHT + ROW_HEIGHT / 2 + ROW_HEIGHT;
    ctx.beginPath();
    ctx.arc(x, sprocketY, SPROCKET_RADIUS, 0, Math.PI * 2);
    ctx.fillStyle = '#1a1410';
    ctx.fill();
    ctx.strokeStyle = '#3d3428';
    ctx.lineWidth = 1;
    ctx.stroke();
  }

  private drawHoverHighlight(ctx: CanvasRenderingContext2D, col: number, row: number) {
    const x = PADDING_X + col * COL_WIDTH + COL_WIDTH / 2;
    const y = PADDING_Y + row * ROW_HEIGHT + ROW_HEIGHT / 2;
    ctx.beginPath();
    ctx.arc(x, y, HOLE_RADIUS + 3, 0, Math.PI * 2);
    ctx.strokeStyle = '#d4a030';
    ctx.lineWidth = 2;
    ctx.stroke();
  }

  private handleCanvasClick(e: MouseEvent) {
    const rect = this.canvas.getBoundingClientRect();
    const x = e.clientX - rect.left;
    const y = e.clientY - rect.top;

    const colIndex = Math.floor((x - PADDING_X) / COL_WIDTH);
    const rowIndex = Math.floor((y - PADDING_Y) / ROW_HEIGHT);

    if (colIndex < 0 || colIndex >= this.columns.length || rowIndex < 0 || rowIndex >= 5) {
      return;
    }

    const holeX = PADDING_X + colIndex * COL_WIDTH + COL_WIDTH / 2;
    const holeY = PADDING_Y + rowIndex * ROW_HEIGHT + ROW_HEIGHT / 2;
    const dist = Math.sqrt((x - holeX) ** 2 + (y - holeY) ** 2);

    if (dist > HOLE_RADIUS + 4) return;

    const newBits = [...this.columns[colIndex].bits] as [boolean, boolean, boolean, boolean, boolean];
    newBits[rowIndex] = !newBits[rowIndex];

    this.dispatchEvent(
      new CustomEvent('bits-changed', {
        detail: { index: colIndex, bits: newBits },
        bubbles: true,
        composed: true,
      })
    );
  }

  private handleCanvasMove(e: MouseEvent) {
    const rect = this.canvas.getBoundingClientRect();
    const x = e.clientX - rect.left;
    const y = e.clientY - rect.top;

    const colIndex = Math.floor((x - PADDING_X) / COL_WIDTH);
    const rowIndex = Math.floor((y - PADDING_Y) / ROW_HEIGHT);

    if (
      colIndex >= 0 &&
      colIndex < this.columns.length &&
      rowIndex >= 0 &&
      rowIndex < 5
    ) {
      const holeX = PADDING_X + colIndex * COL_WIDTH + COL_WIDTH / 2;
      const holeY = PADDING_Y + rowIndex * ROW_HEIGHT + ROW_HEIGHT / 2;
      const dist = Math.sqrt((x - holeX) ** 2 + (y - holeY) ** 2);

      if (dist <= HOLE_RADIUS + 4) {
        this.hoveredHole = { col: colIndex, row: rowIndex };
        this.canvas.style.cursor = 'pointer';
        this.drawTape();
        return;
      }
    }

    if (this.hoveredHole !== null) {
      this.hoveredHole = null;
      this.canvas.style.cursor = 'default';
      this.drawTape();
    }
  }

  private handlePlaybackChange() {
    if (!this.animContainer) return;

    if (this.isPlaying && this.columns.length > 0) {
      const totalScroll = this.getTapeWidth() - this.animContainer.clientWidth;
      if (totalScroll <= 0) return;

      if (this.animation) {
        this.animation.playbackRate = this.playbackSpeed;
        if (this.animation.playState === 'paused') {
          this.animation.play();
        }
        return;
      }

      const duration = (this.columns.length * 500) / this.playbackSpeed;
      this.animation = this.animContainer.animate(
        [
          { scrollLeft: 0 },
          { scrollLeft: totalScroll },
        ],
        {
          duration,
          fill: 'forwards',
          playbackRate: this.playbackSpeed,
        }
      );

      this.animation.onfinish = () => {
        this.animation = null;
        this.dispatchEvent(new CustomEvent('playback-finished', { bubbles: true, composed: true }));
      };
    } else {
      if (this.animation && this.animation.playState === 'running') {
        this.animation.pause();
      }
    }
  }

  public resetPlayback() {
    if (this.animation) {
      this.animation.cancel();
      this.animation = null;
    }
    if (this.animContainer) {
      this.animContainer.scrollLeft = 0;
    }
  }

  render() {
    return html`
      <div class="panel">
        <div class="panel-title">纸带视图</div>
        <div class="tape-container">
          <div class="tape-scroll">
            <canvas
              @click=${this.handleCanvasClick}
              @mousemove=${this.handleCanvasMove}
            ></canvas>
          </div>
          ${this.isPlaying
            ? html`<div class="playback-indicator"><span class="dot"></span> 传输中</div>`
            : this.animation?.playState === 'paused'
              ? html`<div class="playback-indicator paused"><span class="dot"></span> 已暂停</div>`
              : nothing}
        </div>
        <div class="char-row">
          ${this.columns.map(
            (col, i) => html`
              <div
                class="char-label ${!col.isValid ? 'invalid' : ''} ${col.isShiftCode ? 'shift' : ''}"
                title="${col.originalChar}: ${col.bits.map(b => (b ? '1' : '0')).join('')}"
              >
                ${col.isShiftCode ? col.originalChar : col.originalChar}
              </div>
            `
          )}
        </div>
        <div class="tape-info">
          <span><span class="legend-dot open"></span> 打孔</span>
          <span><span class="legend-dot closed"></span> 未打孔</span>
          <span><span class="legend-dot sprocket"></span> 齿孔</span>
          <span><span class="legend-dot corrupted"></span> 噪声损坏</span>
          <span>共 ${this.columns.length} 列</span>
        </div>
      </div>
    `;
  }
}

declare global {
  interface HTMLElementTagNameMap {
    'paper-tape-view': PaperTapeView;
  }
}
