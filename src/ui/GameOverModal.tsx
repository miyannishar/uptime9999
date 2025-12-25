import { GameState } from '../sim/types';

interface GameOverModalProps {
  state: GameState;
  onNewGame: () => void;
  onClose: () => void;
}

export default function GameOverModal({ state, onNewGame, onClose }: GameOverModalProps) {
  const elapsed = (Date.now() - state.startTime) / 1000;
  const hours = Math.floor(elapsed / 3600);
  const minutes = Math.floor((elapsed % 3600) / 60);
  const seconds = Math.floor(elapsed % 60);

  const timeString = `${String(hours).padStart(2, '0')}:${String(minutes).padStart(2, '0')}:${String(
    seconds
  ).padStart(2, '0')}`;

  const formatNumber = (num: number): string => {
    if (num >= 1000000) return `${(num / 1000000).toFixed(1)}M`;
    if (num >= 1000) return `${(num / 1000).toFixed(1)}k`;
    return num.toFixed(0);
  };

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal-content game-over-modal" onClick={e => e.stopPropagation()}>
        <h2 className="game-over-title">💀 GAME OVER</h2>

        <div className="game-over-reason">
          <p>{state.gameOverReason || 'System Failure'}</p>
        </div>

        <div className="run-summary">
          <h3>Run Summary</h3>

          <div className="summary-grid">
            <div className="summary-item">
              <span className="summary-label">Seed</span>
              <span className="summary-value mono">{state.seed}</span>
            </div>

            <div className="summary-item">
              <span className="summary-label">Time Survived</span>
              <span className="summary-value">{timeString}</span>
            </div>

            <div className="summary-item">
              <span className="summary-label">Peak Users</span>
              <span className="summary-value">{formatNumber(state.peakUsers)}</span>
            </div>

            <div className="summary-item">
              <span className="summary-label">Best Uptime</span>
              <span className="summary-value">{(state.uptime * 100).toFixed(2)}%</span>
            </div>

            <div className="summary-item">
              <span className="summary-label">Longest Streak</span>
              <span className="summary-value">
                {Math.floor(state.longestStreak / 60)}m {Math.floor(state.longestStreak % 60)}s
              </span>
            </div>

            <div className="summary-item">
              <span className="summary-label">Incidents Resolved</span>
              <span className="summary-value">{state.resolvedIncidents}</span>
            </div>

            <div className="summary-item">
              <span className="summary-label">Total Profit</span>
              <span className={`summary-value ${state.totalProfit < 0 ? 'negative' : 'positive'}`}>
                ${formatNumber(state.totalProfit)}
              </span>
            </div>

            <div className="summary-item">
              <span className="summary-label">Final Cash</span>
              <span className={`summary-value ${state.cash < 0 ? 'negative' : ''}`}>
                ${formatNumber(state.cash)}
              </span>
            </div>

            <div className="summary-item">
              <span className="summary-label">Final Reputation</span>
              <span className="summary-value">{state.reputation.toFixed(0)}</span>
            </div>
          </div>
        </div>

        <div className="modal-actions">
          <button className="modal-button primary" onClick={onNewGame}>
            🔄 New Run
          </button>
          <button className="modal-button secondary" onClick={onClose}>
            Close
          </button>
        </div>
      </div>
    </div>
  );
}

