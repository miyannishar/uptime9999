import { GameState } from '../sim/types';

interface PostMortemProps {
  incident: GameState['postMortemQueue'][0];
  onComplete: (adoptedActions: string[]) => void;
  onSkip: () => void;
}

const ACTION_ITEMS = [
  { id: 'circuit_breakers', label: '🔌 Implement Circuit Breakers', description: 'Prevent cascading failures between services', benefit: 'Tech debt -5' },
  { id: 'redundant_region', label: '🌍 Add Redundant Region', description: 'Deploy to a secondary cloud region for failover', benefit: 'Reputation +5' },
  { id: 'chaos_testing', label: '🐒 Schedule Chaos Testing', description: 'Regular failure injection to find weaknesses', benefit: 'Tech debt -3' },
  { id: 'runbook_update', label: '📖 Update Runbooks', description: 'Document this failure mode for faster future resolution', benefit: 'Burnout -5' },
  { id: 'alert_tuning', label: '🔔 Tune Alert Thresholds', description: 'Reduce noise, improve signal for on-call engineers', benefit: 'Alert fatigue -5' },
  { id: 'capacity_planning', label: '📊 Capacity Planning Review', description: 'Ensure headroom for traffic spikes', benefit: 'Reputation +3' },
  { id: 'postmortem_review', label: '👥 Team Post-Mortem Review', description: 'Share learnings with the broader engineering team', benefit: 'Reputation +2, Burnout -3' },
];

export default function PostMortem({ incident, onComplete, onSkip }: PostMortemProps) {
  const durationSeconds = Math.floor((incident.resolvedTime - incident.startTime) / 1000);
  const durationStr = durationSeconds < 60 
    ? `${durationSeconds}s` 
    : `${Math.floor(durationSeconds / 60)}m ${durationSeconds % 60}s`;

  // Pick 3 relevant action items randomly
  const shuffled = [...ACTION_ITEMS].sort(() => Math.random() - 0.5);
  const suggestedActions = shuffled.slice(0, 3);

  const handleAdopt = (actionIds: string[]) => {
    onComplete(actionIds);
  };

  return (
    <div className="modal-overlay">
      <div className="modal-content postmortem-modal" onClick={e => e.stopPropagation()}>
        <div className="postmortem-header">
          <h2>📋 Post-Mortem Report</h2>
          <span className={`postmortem-severity severity-${incident.severity.toLowerCase()}`}>
            {incident.severity}
          </span>
        </div>

        <div className="postmortem-title">
          <h3>{incident.incidentName}</h3>
          <p className="postmortem-subtitle">Blameless incident review — learn and improve</p>
        </div>

        <div className="postmortem-timeline">
          <h4>📅 Timeline</h4>
          <div className="timeline-entries">
            <div className="timeline-entry">
              <span className="timeline-dot detected"></span>
              <span className="timeline-label">Detected</span>
              <span className="timeline-time">{new Date(incident.startTime).toLocaleTimeString()}</span>
            </div>
            <div className="timeline-entry">
              <span className="timeline-dot resolved"></span>
              <span className="timeline-label">Resolved</span>
              <span className="timeline-time">{new Date(incident.resolvedTime).toLocaleTimeString()}</span>
            </div>
            <div className="timeline-entry">
              <span className="timeline-dot duration"></span>
              <span className="timeline-label">Duration</span>
              <span className="timeline-time">{durationStr}</span>
            </div>
          </div>
        </div>

        <div className="postmortem-impact">
          <h4>💥 Impact</h4>
          <div className="impact-grid">
            <div className="impact-item">
              <span className="impact-label">Affected Component</span>
              <span className="impact-value">{incident.targetNode}</span>
            </div>
            <div className="impact-item">
              <span className="impact-label">Users Impacted</span>
              <span className="impact-value">{Math.floor(incident.userImpact).toLocaleString()}</span>
            </div>
            <div className="impact-item">
              <span className="impact-label">Revenue Lost</span>
              <span className="impact-value negative">${Math.floor(incident.revenueLost).toLocaleString()}</span>
            </div>
          </div>
        </div>

        <div className="postmortem-actions">
          <h4>🎯 Action Items</h4>
          <p className="action-items-hint">Select items to adopt — each provides real gameplay benefits</p>
          <div className="action-items-list">
            {suggestedActions.map(action => (
              <div key={action.id} className="action-item-card">
                <div className="action-item-header">
                  <span className="action-item-label">{action.label}</span>
                  <span className="action-item-benefit">{action.benefit}</span>
                </div>
                <p className="action-item-desc">{action.description}</p>
                <button 
                  className="action-item-adopt-btn"
                  onClick={() => handleAdopt([action.id])}
                >
                  ✅ Adopt
                </button>
              </div>
            ))}
          </div>
        </div>

        <div className="modal-actions">
          <button className="modal-button primary" onClick={() => handleAdopt([])}>
            📋 Complete Post-Mortem (+5 rep)
          </button>
          <button className="modal-button secondary" onClick={onSkip}>
            Skip
          </button>
        </div>
      </div>
    </div>
  );
}
