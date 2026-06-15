import { css } from 'lit';

export const sharedStyles = css`
  :host {
    display: block;
    font-family: 'IBM Plex Mono', 'Courier New', monospace;
    color: #f5f0e8;
  }

  .panel {
    background: linear-gradient(145deg, #2a2318 0%, #1e1a12 100%);
    border: 1px solid #3d3428;
    border-radius: 8px;
    padding: 16px;
    margin-bottom: 12px;
    box-shadow:
      0 2px 8px rgba(0, 0, 0, 0.4),
      inset 0 1px 0 rgba(245, 240, 232, 0.05);
  }

  .panel-title {
    font-family: 'Share Tech Mono', 'IBM Plex Mono', monospace;
    font-size: 14px;
    font-weight: 600;
    color: #d4a030;
    text-transform: uppercase;
    letter-spacing: 2px;
    margin-bottom: 12px;
    padding-bottom: 8px;
    border-bottom: 1px solid #3d3428;
    display: flex;
    align-items: center;
    gap: 8px;
  }

  .panel-title::before {
    content: '';
    display: inline-block;
    width: 8px;
    height: 8px;
    border-radius: 50%;
    background: #2d8b46;
    box-shadow: 0 0 6px #2d8b46;
  }

  .metal-button {
    background: linear-gradient(180deg, #5a5a5a 0%, #3a3a3a 50%, #4a4a4a 100%);
    border: 1px solid #666;
    border-radius: 4px;
    color: #f5f0e8;
    padding: 6px 14px;
    font-family: 'IBM Plex Mono', monospace;
    font-size: 12px;
    font-weight: 600;
    cursor: pointer;
    text-transform: uppercase;
    letter-spacing: 1px;
    box-shadow:
      0 2px 4px rgba(0, 0, 0, 0.5),
      inset 0 1px 0 rgba(255, 255, 255, 0.15);
    transition: all 0.15s ease;
  }

  .metal-button:hover {
    background: linear-gradient(180deg, #6a6a6a 0%, #4a4a4a 50%, #5a5a5a 100%);
    box-shadow:
      0 2px 6px rgba(0, 0, 0, 0.6),
      inset 0 1px 0 rgba(255, 255, 255, 0.2);
  }

  .metal-button:active {
    background: linear-gradient(180deg, #3a3a3a 0%, #2a2a2a 50%, #3a3a3a 100%);
    box-shadow:
      0 1px 2px rgba(0, 0, 0, 0.5),
      inset 0 1px 0 rgba(255, 255, 255, 0.05);
    transform: translateY(1px);
  }

  .metal-button.accent {
    background: linear-gradient(180deg, #c4992a 0%, #8b6914 50%, #a07a1a 100%);
    border-color: #d4a030;
  }

  .metal-button.accent:hover {
    background: linear-gradient(180deg, #d4a030 0%, #9b7920 50%, #b08a22 100%);
  }

  .metal-button.danger {
    background: linear-gradient(180deg, #a03030 0%, #802020 50%, #902828 100%);
    border-color: #c0392b;
  }

  .metal-button.danger:hover {
    background: linear-gradient(180deg, #b03838 0%, #902828 50%, #a03030 100%);
  }

  .label {
    font-size: 11px;
    color: #8b8070;
    text-transform: uppercase;
    letter-spacing: 1px;
    margin-bottom: 4px;
  }

  .error-badge {
    display: inline-block;
    background: #c0392b;
    color: #fff;
    padding: 1px 6px;
    border-radius: 3px;
    font-size: 11px;
    font-weight: 600;
  }

  .invalid-mark {
    color: #c0392b;
    font-weight: 700;
  }
`;
