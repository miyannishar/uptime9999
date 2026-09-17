import { useState } from 'react';
import { ActiveIncident, GameState } from '../sim/types';
import { INCIDENTS } from '../data/incidents';
import LogsModal from './LogsModal';
import TaskModal from './TaskModal';
import { SevDot, AiBadge, StatusBadge } from './atoms';
import rawStakeholders from '../data/json/stakeholders.json';
import type { TaskData } from '../services/taskGenerator';

type StakeholderTaskMap = Record<string, TaskData>;
const STAKEHOLDER_TASKS = rawStakeholders.stakeholderTasks as unknown as StakeholderTaskMap;

interface IncidentFeedProps {
  incidents: ActiveIncident[];
  stakeholderMessages: GameState['stakeholderMessages'];
  onSelectIncident: (id: string) => void;
  onRespondStakeholder: (messageId: string, responseIndex: number) => void;
  selectedIncidentId: string | null;
}

export default function IncidentFeed({
  incidents, stakeholderMessages, onSelectIncident, onRespondStakeholder, selectedIncidentId,
}: IncidentFeedProps) {
  const [logsModalOpen, setLogsModalOpen] = useState(false);
  const [selectedLogsIncident, setSelectedLogsIncident] = useState<any>(null);
  const [expandedMessageId, setExpandedMessageId] = useState<string | null>(null);
  const [pendingTask, setPendingTask] = useState<{
    messageId: string; responseIndex: number; taskData: TaskData;
    personaId: string; responseText: string;
  } | null>(null);

  const handleViewLogs = (incident: any, e: React.MouseEvent) => {
    e.stopPropagation();
    setSelectedLogsIncident(incident);
    setLogsModalOpen(true);
  };

  const formatTime = (ts: number) => {
    const s = Math.floor((Date.now() - ts) / 1000);
    if (s < 60) return `${s}s ago`;
    const m = Math.floor(s / 60);
    return m < 60 ? `${m}m ago` : `${Math.floor(m / 60)}h ago`;
  };

  const sevClass = (s: string) =>
    s === 'CRIT' ? 'severity-critical' : s === 'WARN' ? 'severity-warning' : 'severity-info';

  const sorted = [...incidents].sort((a, b) => {
    const o = { CRIT: 0, WARN: 1, INFO: 2 };
    const d = (o[a.severity] ?? 3) - (o[b.severity] ?? 3);
    return d !== 0 ? d : b.startTime - a.startTime;
  });

  // Pending (unanswered) stakeholder messages, newest first
  const pending = stakeholderMessages
    .filter(m => m.selectedResponse === undefined && m.expiresAt > Date.now())
    .sort((a, b) => b.timestamp - a.timestamp);

  const totalItems = sorted.length + pending.length;

  return (
    <div className="incident-feed">
      <div className="panel-header">
        <h2>Active Incidents</h2>
        <span className="incident-count">{totalItems}</span>
      </div>

      <div className="incident-list">
        {totalItems === 0 && (
          <div className="no-incidents"><p>All systems operational</p></div>
        )}

        {/* ── Stakeholder messages ── */}
        {pending.map(msg => {
          const isExpanded = expandedMessageId === msg.id;
          const expiresIn = Math.max(0, Math.ceil((msg.expiresAt - Date.now()) / 1000));
          return (
            <div
              key={msg.id}
              className={`incident-item stakeholder-message-item ${isExpanded ? 'expanded' : ''}`}
              onClick={() => setExpandedMessageId(isExpanded ? null : msg.id)}
            >
              <div className="incident-header">
                <span className="stakeholder-icon">{msg.icon}</span>
                <span className="stakeholder-char">{msg.character}</span>
                <span className="incident-time">{formatTime(msg.timestamp)}</span>
                <span className={`expires-badge ${expiresIn < 10 ? 'urgent' : ''}`}>
                  ⏱ {expiresIn}s
                </span>
              </div>
              <div className="incident-title stakeholder-preview">
                {isExpanded ? msg.message : msg.message.slice(0, 65) + (msg.message.length > 65 ? '…' : '')}
              </div>
              {isExpanded && (
                <div className="stakeholder-responses" onClick={e => e.stopPropagation()}>
                  {msg.responses.map((r, i) => {
                    const resp = r as { text: string; effect: string; requiresTask?: boolean };
                    const taskKey = `${msg.character.toLowerCase().replace(/\s+/g,'_')}_${resp.effect}`;
                    const task = resp.requiresTask ? STAKEHOLDER_TASKS[taskKey] : undefined;
                    return (
                      <button
                        key={i}
                        className={`stakeholder-response-btn ${task ? 'needs-task' : ''}`}
                        onClick={() => {
                          if (task) {
                            setPendingTask({ messageId: msg.id, responseIndex: i, taskData: task,
                              personaId: msg.character, responseText: resp.text });
                            setExpandedMessageId(null);
                          } else {
                            onRespondStakeholder(msg.id, i);
                            setExpandedMessageId(null);
                          }
                        }}
                      >
                        {task ? '🎯 ' : ''}{resp.text}
                      </button>
                    );
                  })}
                </div>
              )}
            </div>
          );
        })}

        {/* ── Active incidents ── */}
        {sorted.map(incident => {
          const def = INCIDENTS.find(i => i.id === incident.definitionId);
          const name = incident.aiGenerated
            ? ((incident as any).aiIncidentName || incident.id.replace(/_/g, ' ').replace(/^ai /, ''))
            : (def?.name || 'Unknown Incident');
          const isCrit = incident.severity === 'CRIT';

          return (
            <div
              key={incident.id}
              className={`incident-item ${sevClass(incident.severity)} ${
                selectedIncidentId === incident.id ? 'selected' : ''
              } ${incident.aiGenerated ? 'ai-incident' : ''}`}
              onClick={() => onSelectIncident(incident.id)}
            >
              <div className="incident-header">
                <SevDot severity={incident.severity as 'CRIT' | 'WARN' | 'INFO'} pulse={isCrit} />
                <StatusBadge level={incident.severity as 'CRIT' | 'WARN' | 'INFO'} />
                {incident.aiGenerated && <AiBadge />}
                <span className="incident-time">{formatTime(incident.startTime)}</span>
              </div>
              <div className="incident-title">{name}</div>
              <div className="incident-target">{incident.targetNodeId}</div>
              {incident.aiGenerated && (incident as any).aiLogs && (
                <button className="view-logs-button" onClick={e => handleViewLogs(incident, e)}>
                  View Logs →
                </button>
              )}
              {incident.mitigationProgress > 0 && (
                <div className="mitigation-bar" style={{ height: '10px', marginTop: '6px' }}>
                  <div className="mitigation-fill" style={{ width: `${incident.mitigationProgress * 100}%` }} />
                </div>
              )}
            </div>
          );
        })}
      </div>

      {logsModalOpen && selectedLogsIncident && (
        <LogsModal
          incidentName={(selectedLogsIncident as any).aiIncidentName || 'Incident'}
          logs={(selectedLogsIncident as any).aiLogs || 'No logs available'}
          onClose={() => setLogsModalOpen(false)}
        />
      )}

      {/* Stakeholder task modal — must complete task before response is sent */}
      {pendingTask && (
        <TaskModal
          incidentName={`${pendingTask.personaId} wants action`}
          incidentDescription="Complete this task to respond"
          actionName={pendingTask.responseText}
          actionDescription="Stakeholder response requires real work"
          targetNode="global"
          initialTaskData={pendingTask.taskData}
          onComplete={() => {
            onRespondStakeholder(pendingTask.messageId, pendingTask.responseIndex);
            setPendingTask(null);
          }}
          onClose={() => setPendingTask(null)}
        />
      )}
    </div>
  );
}
