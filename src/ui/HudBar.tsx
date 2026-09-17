// src/ui/HudBar.tsx
import { GameState } from '../sim/types';
import { GAME_CONFIG } from '../config/gameConfig';
import MusicPlayer from './MusicPlayer';
import { Pause, Play } from 'lucide-react';

interface HudBarProps {
  state: GameState;
  onTogglePause: () => void;
  onNewGame: () => void;
  onSetSpeed: (speed: number) => void;
}

export default function HudBar({ state, onTogglePause, onNewGame, onSetSpeed }: HudBarProps) {
  const fmt = (n: number): string => {
    if (n >= 1_000_000) return `${(n / 1_000_000).toFixed(1)}M`;
    if (n >= 1_000)     return `${(n / 1_000).toFixed(1)}k`;
    return n.toFixed(0);
  };

  const fmtCash = (n: number) => `$${fmt(n)}`;
  const fmtUptime = (u: number) => `${(u * 100).toFixed(2)}%`;

  // Countdown from session max duration
  const maxSec = GAME_CONFIG.session.maxDurationMs / 1000;
  const elapsed = (Date.now() - state.startTime) / 1000;
  const remaining = Math.max(0, maxSec - elapsed);
  const remMin = Math.floor(remaining / 60);
  const remSec = Math.floor(remaining % 60);
  const remainingLabel = `${String(remMin).padStart(2, '0')}:${String(remSec).padStart(2, '0')}`;

  // Session progress 0→1
  const sessionProgress = Math.min(1, elapsed / maxSec);
  const sessionVariant =
    remaining < 60  ? 'critical' :
    remaining < 300 ? 'warning'  : '';

  return (
    <>
      <div className="hud-bar">
        {/* Title */}
        <div className="hud-section hud-title">
          <h1>UPTIME 99.99</h1>
        </div>

        {/* Primary metrics */}
        <div className="hud-section hud-metrics">
          <div className="hud-metric">
            <span className="hud-label">Uptime</span>
            <span className={`hud-value ${
              state.uptime < 0.95 ? 'critical' :
              state.uptime < 0.99 ? 'warning' : 'good'
            }`}>
              {fmtUptime(state.uptime)}
            </span>
          </div>

          <div className="hud-metric">
            <span className="hud-label">Users</span>
            <span className="hud-value">{fmt(state.users)}</span>
          </div>

          <div className="hud-metric">
            <span className="hud-label">RPS</span>
            <span className="hud-value">{fmt(state.rps)}</span>
          </div>

          <div className="hud-metric">
            <span className="hud-label">Cash</span>
            <span className={`hud-value ${
              state.cash < 0     ? 'critical' :
              state.cash < 1000 ? 'warning' : ''
            }`}>
              {fmtCash(state.cash)}
            </span>
          </div>

          <div className="hud-metric">
            <span className="hud-label">Profit/min</span>
            <span className={`hud-value ${
              (state.revenue - state.costs) < 0 ? 'critical' : ''
            }`}>
              {fmtCash((state.revenue - state.costs) * 60)}
            </span>
          </div>

          <div className="hud-metric">
            <span className="hud-label">Reputation</span>
            <span className={`hud-value ${
              state.reputation < 30 ? 'critical' :
              state.reputation < 60 ? 'warning' : ''
            }`}
              title={`Uptime: ${(state.uptime * 100).toFixed(2)}% | Error Rate: ${(state.globalErrorRate * 100).toFixed(2)}% | Active Incidents: ${state.activeIncidents.length}`}
            >
              {state.reputation.toFixed(0)}
            </span>
          </div>
        </div>

        {/* Stress bars */}
        <div className="hud-section hud-stress">
          <div className="hud-stress-item">
            <span className="hud-label">Tech Debt</span>
            <div className="stress-bar">
              <div className="stress-fill" style={{ width: `${state.techDebt}%` }} />
            </div>
          </div>
          <div className="hud-stress-item">
            <span className="hud-label">Fatigue</span>
            <div className="stress-bar">
              <div className="stress-fill" style={{ width: `${state.alertFatigue}%` }} />
            </div>
          </div>
        </div>

        {/* Time remaining (countdown) */}
        <div className="hud-section hud-time">
          <div className="hud-metric">
            <span className="hud-label">Remaining</span>
            <span className={`hud-value ${remaining < 300 ? 'warning' : ''} ${remaining < 60 ? 'critical' : ''}`}>
              {remainingLabel}
            </span>
          </div>
        </div>

        {/* Controls */}
        <div className="hud-section hud-controls">
          <button onClick={onTogglePause} className="hud-button" aria-label={state.paused ? 'Resume' : 'Pause'}>
            {state.paused
              ? <><Play size={12} /> Play</>
              : <><Pause size={12} /> Pause</>
            }
          </button>

          <div className="speed-controls">
            {[1, 2, 4].map(s => (
              <button
                key={s}
                onClick={() => onSetSpeed(s)}
                className={`speed-btn ${state.speed === s ? 'active' : ''}`}
              >
                {s}x
              </button>
            ))}
          </div>

          <button onClick={onNewGame} className="hud-button">↺ New Run</button>

          <MusicPlayer />
        </div>
      </div>

      {/* Session countdown strip — lives outside .hud-bar so it spans full width */}
      <div className={`session-bar ${sessionVariant ? `session-bar--${sessionVariant}` : ''}`}>
        <div
          className="session-bar__fill"
          style={{ width: `${(1 - sessionProgress) * 100}%` }}
        />
      </div>
    </>
  );
}
