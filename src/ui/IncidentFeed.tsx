import { ActiveIncident } from '../sim/types';
import { INCIDENTS } from '../data/incidents';

interface IncidentFeedProps {
  incidents: ActiveIncident[];
  onSelectIncident: (id: string) => void;
  selectedIncidentId: string | null;
}

export default function IncidentFeed({
  incidents,
  onSelectIncident,
  selectedIncidentId,
}: IncidentFeedProps) {
  const formatTime = (timestamp: number): string => {
    const elapsed = Math.floor((Date.now() - timestamp) / 1000);
    if (elapsed < 60) return `${elapsed}s ago`;
    const minutes = Math.floor(elapsed / 60);
    if (minutes < 60) return `${minutes}m ago`;
    const hours = Math.floor(minutes / 60);
    return `${hours}h ago`;
  };

  const getSeverityClass = (severity: string): string => {
    switch (severity) {
      case 'CRIT': return 'severity-critical';
      case 'WARN': return 'severity-warning';
      case 'INFO': return 'severity-info';
      default: return '';
    }
  };

  const getSeverityIcon = (severity: string): string => {
    switch (severity) {
      case 'CRIT': return '🔥';
      case 'WARN': return '⚠️';
      case 'INFO': return 'ℹ️';
      default: return '•';
    }
  };

  const sortedIncidents = [...incidents].sort((a, b) => {
    // Sort by severity (CRIT > WARN > INFO) then by time
    const severityOrder = { CRIT: 0, WARN: 1, INFO: 2 };
    const severityDiff = severityOrder[a.severity] - severityOrder[b.severity];
    if (severityDiff !== 0) return severityDiff;
    return b.startTime - a.startTime;
  });

  return (
    <div className="incident-feed">
      <div className="panel-header">
        <h2>🚨 Active Incidents</h2>
        <span className="incident-count">{incidents.length}</span>
      </div>

      <div className="incident-list">
        {sortedIncidents.length === 0 ? (
          <div className="no-incidents">
            <p>✅ All systems operational</p>
          </div>
        ) : (
          sortedIncidents.map(incident => {
            const def = INCIDENTS.find(i => i.id === incident.definitionId);
            if (!def) return null;

            return (
              <div
                key={incident.id}
                className={`incident-item ${getSeverityClass(incident.severity)} ${
                  selectedIncidentId === incident.id ? 'selected' : ''
                }`}
                onClick={() => onSelectIncident(incident.id)}
              >
                <div className="incident-header">
                  <span className="incident-icon">{getSeverityIcon(incident.severity)}</span>
                  <span className="incident-severity">{incident.severity}</span>
                  <span className="incident-time">{formatTime(incident.startTime)}</span>
                </div>
                <div className="incident-title">{def.name}</div>
                <div className="incident-target">Target: {incident.targetNodeId}</div>
                {incident.mitigationProgress > 0 && (
                  <div className="mitigation-bar">
                    <div
                      className="mitigation-fill"
                      style={{ width: `${incident.mitigationProgress * 100}%` }}
                    ></div>
                  </div>
                )}
              </div>
            );
          })
        )}
      </div>
    </div>
  );
}

