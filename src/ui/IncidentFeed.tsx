import { useState } from 'react';
import { ActiveIncident } from '../sim/types';
import { INCIDENTS } from '../data/incidents';
import LogsModal from './LogsModal';
import { SevDot, AiBadge, StatusBadge } from './atoms';

interface IncidentFeedProps {
  incidents: ActiveIncident[];
  onSelectIncident: (id: string) => void;
  selectedIncidentId: string | null;
}

export default function IncidentFeed({ incidents, onSelectIncident, selectedIncidentId }: IncidentFeedProps) {
  const [logsModalOpen, setLogsModalOpen] = useState(false);
  const [selectedLogsIncident, setSelectedLogsIncident] = useState<any>(null);

  const handleViewLogs = (incident: any, e: React.MouseEvent) => {
    e.stopPropagation();
    setSelectedLogsIncident(incident);
    setLogsModalOpen(true);
  };

  const formatTime = (timestamp: number): string => {
    const elapsed = Math.floor((Date.now() - timestamp) / 1000);
    if (elapsed < 60)  return `${elapsed}s ago`;
    const minutes = Math.floor(elapsed / 60);
    if (minutes < 60)  return `${minutes}m ago`;
    return `${Math.floor(minutes / 60)}h ago`;
  };

  const getSeverityClass = (severity: string): string => {
    switch (severity) {
      case 'CRIT': return 'severity-critical';
      case 'WARN': return 'severity-warning';
      case 'INFO': return 'severity-info';
      default: return '';
    }
  };

  const sorted = [...incidents].sort((a, b) => {
    const order = { CRIT: 0, WARN: 1, INFO: 2 };
    const diff = (order[a.severity] ?? 3) - (order[b.severity] ?? 3);
    return diff !== 0 ? diff : b.startTime - a.startTime;
  });

  return (
    <div className="incident-feed">
      <div className="panel-header">
        <h2>Active Incidents</h2>
        <span className="incident-count">{incidents.length}</span>
      </div>

      <div className="incident-list">
        {sorted.length === 0 ? (
          <div className="no-incidents">
            <p>All systems operational</p>
          </div>
        ) : (
          sorted.map(incident => {
            const def = INCIDENTS.find(i => i.id === incident.definitionId);
            const displayName = incident.aiGenerated
              ? ((incident as any).aiIncidentName || incident.id.replace(/_/g, ' ').replace(/^ai /, ''))
              : (def?.name || 'Unknown Incident');
            const isCrit = incident.severity === 'CRIT';

            return (
              <div
                key={incident.id}
                className={`incident-item ${getSeverityClass(incident.severity)} ${
                  selectedIncidentId === incident.id ? 'selected' : ''
                } ${incident.aiGenerated ? 'ai-incident' : ''}`}
                onClick={() => onSelectIncident(incident.id)}
              >
                <div className="incident-header">
                  <SevDot
                    severity={incident.severity as 'CRIT' | 'WARN' | 'INFO'}
                    pulse={isCrit}
                  />
                  <StatusBadge level={incident.severity as 'CRIT' | 'WARN' | 'INFO'} />
                  {incident.aiGenerated && <AiBadge />}
                  <span className="incident-time">{formatTime(incident.startTime)}</span>
                </div>

                <div className="incident-title">{displayName}</div>
                <div className="incident-target">{incident.targetNodeId}</div>

                {incident.aiGenerated && (incident as any).aiLogs && (
                  <button
                    className="view-logs-button"
                    onClick={(e) => handleViewLogs(incident, e)}
                  >
                    View Logs →
                  </button>
                )}

                {incident.mitigationProgress > 0 && (
                  <div className="mitigation-bar" style={{ height: '10px', marginTop: '6px' }}>
                    <div
                      className="mitigation-fill"
                      style={{ width: `${incident.mitigationProgress * 100}%` }}
                    />
                  </div>
                )}
              </div>
            );
          })
        )}
      </div>

      {logsModalOpen && selectedLogsIncident && (
        <LogsModal
          incidentName={(selectedLogsIncident as any).aiIncidentName || 'Incident'}
          logs={(selectedLogsIncident as any).aiLogs || 'No logs available'}
          onClose={() => setLogsModalOpen(false)}
        />
      )}
    </div>
  );
}
