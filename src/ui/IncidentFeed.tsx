import { useState } from 'react';
import { ActiveIncident } from '../sim/types';
import { INCIDENTS } from '../data/incidents';
import LogsModal from './LogsModal';

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
  const [logsModalOpen, setLogsModalOpen] = useState(false);
  const [selectedLogsIncident, setSelectedLogsIncident] = useState<any>(null);

  const handleViewLogs = (incident: any, e: React.MouseEvent) => {
    e.stopPropagation(); // Don't trigger incident selection
    setSelectedLogsIncident(incident);
    setLogsModalOpen(true);
  };
  

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
            const displayName = incident.aiGenerated 
              ? ((incident as any).aiIncidentName || incident.id.replace(/_/g, ' ').replace(/^ai /, ''))
              : (def?.name || 'Unknown Incident');

            return (
              <div
                key={incident.id}
                className={`incident-item ${getSeverityClass(incident.severity)} ${
                  selectedIncidentId === incident.id ? 'selected' : ''
                } ${incident.aiGenerated ? 'ai-incident' : ''}`}
                onClick={() => {
                  console.log('🔍 Selected incident:', incident.id, incident.aiGenerated ? '(AI)' : '(Regular)');
                  onSelectIncident(incident.id);
                }}
              >
                <div className="incident-header">
                  <span className="incident-icon">
                    {incident.aiGenerated ? '🤖' : getSeverityIcon(incident.severity)}
                  </span>
                  <span className="incident-severity">{incident.severity}</span>
                  <span className="incident-time">{formatTime(incident.startTime)}</span>
                </div>
                <div className="incident-title">{displayName}</div>
                <div className="incident-target">Target: {incident.targetNodeId}</div>
                
                {/* View Logs button for AI incidents */}
                {incident.aiGenerated && (incident as any).aiLogs && (
                  <button
                    className="view-logs-button"
                    onClick={(e) => handleViewLogs(incident, e)}
                    title="View incident logs"
                  >
                    📋 View Logs
                  </button>
                )}
                
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
      
      {/* Logs Modal */}
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

