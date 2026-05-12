import { useState } from 'react';
import { GameState } from '../sim/types';

interface StatusPageProps {
  state: GameState;
  onUpdateStatus: (level: GameState['statusPageLevel'], message: string) => void;
}

const STATUS_LEVELS = [
  { value: 'operational' as const, label: 'Operational', icon: '🟢', color: '#22c55e' },
  { value: 'degraded' as const, label: 'Degraded Performance', icon: '🟡', color: '#eab308' },
  { value: 'partial_outage' as const, label: 'Partial Outage', icon: '🟠', color: '#f97316' },
  { value: 'major_outage' as const, label: 'Major Outage', icon: '🔴', color: '#ef4444' },
];

export default function StatusPage({ state, onUpdateStatus }: StatusPageProps) {
  const [isExpanded, setIsExpanded] = useState(false);
  const [selectedLevel, setSelectedLevel] = useState(state.statusPageLevel);
  const [message, setMessage] = useState('');

  const currentStatus = STATUS_LEVELS.find(s => s.value === state.statusPageLevel)!;
  const timeSinceUpdate = Math.floor((Date.now() - state.statusPageLastUpdated) / 1000);
  
  // Check if status page is stale (not updated in >60s during incident)
  const isStale = state.activeIncidents.some(i => i.severity === 'CRIT') && timeSinceUpdate > 60;
  
  // Check accuracy: is the status page honest?
  const critCount = state.activeIncidents.filter(i => i.severity === 'CRIT').length;
  const warnCount = state.activeIncidents.filter(i => i.severity === 'WARN').length;
  let expectedLevel: GameState['statusPageLevel'] = 'operational';
  if (critCount >= 2) expectedLevel = 'major_outage';
  else if (critCount >= 1) expectedLevel = 'partial_outage';
  else if (warnCount >= 2) expectedLevel = 'degraded';
  else if (warnCount >= 1 && state.uptime < 0.995) expectedLevel = 'degraded';
  
  const statusOrder = ['operational', 'degraded', 'partial_outage', 'major_outage'];
  const isAccurate = statusOrder.indexOf(state.statusPageLevel) >= statusOrder.indexOf(expectedLevel);
  const isLying = statusOrder.indexOf(state.statusPageLevel) < statusOrder.indexOf(expectedLevel) - 1;

  const handleSubmit = () => {
    onUpdateStatus(selectedLevel, message || `Status updated to ${STATUS_LEVELS.find(s => s.value === selectedLevel)?.label}`);
    setMessage('');
    setIsExpanded(false);
  };

  const formatTime = (seconds: number) => {
    if (seconds < 60) return `${seconds}s ago`;
    const mins = Math.floor(seconds / 60);
    return `${mins}m ago`;
  };

  return (
    <>
      <div 
        className={`status-page-widget ${isStale ? 'stale' : ''} ${isLying ? 'lying' : ''}`}
        onClick={() => setIsExpanded(true)}
        title={isStale ? '⚠️ Status page is stale! Update it!' : isLying ? '🚫 Status page is inaccurate!' : 'Click to update status page'}
      >
        <span className="status-page-icon">{currentStatus.icon}</span>
        <span className="status-page-label">{currentStatus.label}</span>
        {isStale && <span className="status-page-stale-badge">STALE</span>}
        {isLying && <span className="status-page-lie-badge">INACCURATE</span>}
        <span className="status-page-time">{formatTime(timeSinceUpdate)}</span>
      </div>

      {isExpanded && (
        <div className="modal-overlay" onClick={() => setIsExpanded(false)}>
          <div className="modal-content status-page-modal" onClick={e => e.stopPropagation()}>
            <h2>📊 Status Page</h2>
            <p className="status-page-subtitle">
              Your customers and stakeholders are watching. Be transparent.
            </p>

            {!isAccurate && (
              <div className="status-page-warning">
                ⚠️ Your current status ({currentStatus.label}) doesn't match system reality.
                Inaccurate reporting erodes trust 3× faster.
              </div>
            )}

            <div className="status-level-selector">
              {STATUS_LEVELS.map(level => (
                <button
                  key={level.value}
                  className={`status-level-btn ${selectedLevel === level.value ? 'active' : ''}`}
                  style={{ borderColor: selectedLevel === level.value ? level.color : 'transparent' }}
                  onClick={() => setSelectedLevel(level.value)}
                >
                  <span>{level.icon}</span>
                  <span>{level.label}</span>
                </button>
              ))}
            </div>

            <div className="status-message-input">
              <textarea
                placeholder="Write a status update message (optional)..."
                value={message}
                onChange={e => setMessage(e.target.value)}
                rows={3}
                maxLength={280}
              />
              <span className="char-count">{message.length}/280</span>
            </div>

            <div className="status-page-history">
              <h3>Recent Updates</h3>
              {state.statusPageHistory.slice(-5).reverse().map((entry, i) => (
                <div key={i} className="status-history-item">
                  <span className="status-history-level">
                    {STATUS_LEVELS.find(s => s.value === entry.level)?.icon}
                  </span>
                  <span className="status-history-message">{entry.message}</span>
                  <span className="status-history-time">
                    {formatTime(Math.floor((Date.now() - entry.timestamp) / 1000))}
                  </span>
                </div>
              ))}
              {state.statusPageHistory.length === 0 && (
                <p className="no-history">No updates yet</p>
              )}
            </div>

            <div className="modal-actions">
              <button className="modal-button primary" onClick={handleSubmit}>
                📢 Publish Update
              </button>
              <button className="modal-button secondary" onClick={() => setIsExpanded(false)}>
                Cancel
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
