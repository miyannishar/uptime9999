import { GameState } from '../sim/types';
import MusicPlayer from './MusicPlayer';

interface HudBarProps {
  state: GameState;
  onTogglePause: () => void;
  onSetSpeed: (speed: number) => void;
  onSave: () => void;
  onLoad: () => void;
  onNewGame: () => void;
  hasAutosave: boolean;
}

export default function HudBar({
  state,
  onTogglePause,
  onSetSpeed,
  onSave,
  onLoad,
  onNewGame,
}: HudBarProps) {
  const formatNumber = (num: number): string => {
    if (num >= 1000000) return `${(num / 1000000).toFixed(1)}M`;
    if (num >= 1000) return `${(num / 1000).toFixed(1)}k`;
    return num.toFixed(0);
  };

  const formatCash = (cash: number): string => {
    return `$${formatNumber(cash)}`;
  };

  const formatUptime = (uptime: number): string => {
    return `${(uptime * 100).toFixed(2)}%`;
  };

  const elapsed = (Date.now() - state.startTime) / 1000;
  const hours = Math.floor(elapsed / 3600);
  const minutes = Math.floor((elapsed % 3600) / 60);
  const seconds = Math.floor(elapsed % 60);

  return (
    <div className="hud-bar">
      <div className="hud-section hud-title">
        <h1>⚡ UPTIME 99.99</h1>
      </div>

      <div className="hud-section hud-metrics">
        <div className="hud-metric">
          <span className="hud-label">Uptime</span>
          <span className={`hud-value ${state.uptime < 0.95 ? 'critical' : state.uptime < 0.99 ? 'warning' : 'good'}`}>
            {formatUptime(state.uptime)}
          </span>
        </div>

        <div className="hud-metric">
          <span className="hud-label">Users</span>
          <span className="hud-value">{formatNumber(state.users)}</span>
        </div>

        <div className="hud-metric">
          <span className="hud-label">RPS</span>
          <span className="hud-value">{formatNumber(state.rps)}</span>
        </div>

        <div className="hud-metric">
          <span className="hud-label">Cash</span>
          <span className={`hud-value ${state.cash < 0 ? 'critical' : state.cash < 1000 ? 'warning' : ''}`}>
            {formatCash(state.cash)}
          </span>
        </div>

        <div className="hud-metric">
          <span className="hud-label">Profit/min</span>
          <span className={`hud-value ${(state.revenue - state.costs) < 0 ? 'critical' : ''}`}>
            {formatCash((state.revenue - state.costs) * 60)}
          </span>
        </div>

        <div className="hud-metric">
          <span className="hud-label">Reputation</span>
          <span 
            className={`hud-value ${state.reputation < 30 ? 'critical' : state.reputation < 60 ? 'warning' : ''}`}
            title={`Uptime: ${(state.uptime * 100).toFixed(2)}% | Error Rate: ${(state.globalErrorRate * 100).toFixed(2)}% | Active Incidents: ${state.activeIncidents.length}`}
          >
            {state.reputation.toFixed(0)}
          </span>
        </div>
      </div>

      <div className="hud-section hud-stress">
        <div className="hud-stress-item">
          <span className="hud-label">Tech Debt</span>
          <div className="stress-bar">
            <div className="stress-fill" style={{ width: `${state.techDebt}%` }}></div>
          </div>
        </div>

        <div className="hud-stress-item">
          <span className="hud-label">Alert Fatigue</span>
          <div className="stress-bar">
            <div className="stress-fill" style={{ width: `${state.alertFatigue}%` }}></div>
          </div>
        </div>
      </div>

      <div className="hud-section hud-time">
        <div className="hud-metric">
          <span className="hud-label">Time</span>
          <span className="hud-value">
            {String(hours).padStart(2, '0')}:{String(minutes).padStart(2, '0')}:{String(seconds).padStart(2, '0')}
          </span>
        </div>

        <div className="hud-metric">
          <span className="hud-label">Seed</span>
          <span className="hud-value mono">{state.seed}</span>
        </div>
      </div>

      <div className="hud-section hud-controls">
        <button onClick={onTogglePause} className="hud-button">
          {state.paused ? '▶ Play' : '⏸ Pause'}
        </button>

        <div className="speed-controls">
          <button
            onClick={() => onSetSpeed(1)}
            className={`speed-button ${state.speed === 1 ? 'active' : ''}`}
          >
            1x
          </button>
          <button
            onClick={() => onSetSpeed(2)}
            className={`speed-button ${state.speed === 2 ? 'active' : ''}`}
          >
            2x
          </button>
          <button
            onClick={() => onSetSpeed(4)}
            className={`speed-button ${state.speed === 4 ? 'active' : ''}`}
          >
            4x
          </button>
        </div>

        <button onClick={onSave} className="hud-button">💾 Save</button>
        <button onClick={onLoad} className="hud-button">📂 Load</button>
        <button onClick={onNewGame} className="hud-button">🔄 New Run</button>

        <MusicPlayer />
      </div>
    </div>
  );
}

