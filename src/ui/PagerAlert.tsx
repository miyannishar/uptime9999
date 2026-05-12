import { useEffect, useState } from 'react';
import { GameState } from '../sim/types';

interface PagerAlertProps {
  state: GameState;
  onAcknowledge: () => void;
}

export default function PagerAlert({ state, onAcknowledge }: PagerAlertProps) {
  const [flashOn, setFlashOn] = useState(true);

  // Flash effect
  useEffect(() => {
    if (!state.pagerActive || state.pagerAcknowledged) return;
    const interval = setInterval(() => setFlashOn(prev => !prev), 500);
    return () => clearInterval(interval);
  }, [state.pagerActive, state.pagerAcknowledged]);

  if (!state.pagerActive || state.pagerAcknowledged) return null;

  const elapsed = Math.floor((Date.now() - state.pagerStartTime) / 1000);
  const remaining = Math.max(0, 30 - elapsed);
  const urgencyPercent = Math.min(100, (elapsed / 30) * 100);

  // Find the pager incident
  const incident = state.activeIncidents.find(i => i.id === state.pagerIncidentId);
  const incidentName = incident?.aiGenerated 
    ? (incident as any).aiIncidentName 
    : incident?.definitionId?.replace(/_/g, ' ') || 'Unknown';

  return (
    <div className={`pager-overlay ${flashOn ? 'flash-on' : 'flash-off'}`}>
      <div className="pager-content">
        <div className="pager-icon">📟</div>
        <div className="pager-alert-text">CRITICAL INCIDENT</div>
        <div className="pager-incident-name">{incidentName}</div>
        <div className="pager-target">
          Target: {incident?.targetNodeId || 'Unknown'}
        </div>
        
        <div className="pager-countdown">
          <div className="pager-countdown-bar">
            <div 
              className="pager-countdown-fill" 
              style={{ width: `${100 - urgencyPercent}%` }}
            ></div>
          </div>
          <span className="pager-countdown-text">
            Acknowledge in {remaining}s
          </span>
        </div>

        <button className="pager-ack-button" onClick={onAcknowledge}>
          🔔 ACKNOWLEDGE
        </button>

        <p className="pager-warning">
          Auto-escalation in {remaining}s — reputation and incident severity will worsen
        </p>
      </div>
    </div>
  );
}
