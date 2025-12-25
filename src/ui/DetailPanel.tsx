import React from 'react';
import { GameState } from '../sim/types';
import { INCIDENTS } from '../data/incidents';
import { ACTIONS } from '../data/actions';

interface DetailPanelProps {
  state: GameState;
  selectedNodeId: string | null;
  selectedIncidentId: string | null;
  onExecuteAction: (actionId: string) => void;
  onMitigateIncident: (incidentId: string, actionId: string) => void;
  onExecuteAIAction: (actionName: string, cost: number, duration: number, incidentId: string) => void;
}

export default function DetailPanel({
  state,
  selectedNodeId,
  selectedIncidentId,
  onExecuteAction,
  onMitigateIncident,
  onExecuteAIAction,
}: DetailPanelProps) {
  const [activeTab, setActiveTab] = React.useState<'node' | 'incident' | 'strategy'>('node');

  // Auto-switch to incident tab when an incident is selected
  React.useEffect(() => {
    if (selectedIncidentId) {
      setActiveTab('incident');
    }
  }, [selectedIncidentId]);

  // Auto-switch to node tab when a node is selected (always, even if incident is selected)
  React.useEffect(() => {
    if (selectedNodeId) {
      setActiveTab('node');
    }
  }, [selectedNodeId]);

  // Node details
  const selectedNode = selectedNodeId ? state.architecture.nodes.get(selectedNodeId) : null;

  // Incident details
  const selectedIncident = selectedIncidentId
    ? state.activeIncidents.find(i => i.id === selectedIncidentId)
    : null;
  const incidentDef = selectedIncident
    ? INCIDENTS.find(i => i.id === selectedIncident.definitionId)
    : null;

  const canExecuteAction = (actionId: string): boolean => {
    const action = ACTIONS.find(a => a.id === actionId);
    if (!action) return false;

    // Check cash (only for positive costs - negative costs add money)
    if (action.oneTimeCost > 0 && state.cash < action.oneTimeCost) return false;

    // Check cooldown
    const cooldownEnd = state.actionCooldowns.get(actionId);
    if (cooldownEnd && Date.now() < cooldownEnd) return false;

    // Check requirements
    if (action.requires) {
      const req = action.requires;
      if (req.minCash !== undefined && state.cash < req.minCash) return false;
      if (req.minUsers !== undefined && state.users < req.minUsers) return false;
      if (req.nodeEnabled) {
        const node = state.architecture.nodes.get(req.nodeEnabled);
        if (!node || !node.enabled) return false;
      }
      if (req.featureEnabled) {
        // Check if feature is enabled on any node
        let featureFound = false;
        for (const node of state.architecture.nodes.values()) {
          if ((node.features as any)[req.featureEnabled]) {
            featureFound = true;
            break;
          }
        }
        if (!featureFound) return false;
      }
      if (req.observabilityLevel && state.observabilityLevel !== req.observabilityLevel) {
        return false;
      }
    }

    return true;
  };

  const getCooldownRemaining = (actionId: string): number => {
    const cooldownEnd = state.actionCooldowns.get(actionId);
    if (!cooldownEnd) return 0;
    return Math.max(0, Math.ceil((cooldownEnd - Date.now()) / 1000));
  };

  return (
    <div className="detail-panel">
      <div className="panel-header">
        <div className="tab-buttons">
          <button
            className={`tab-button ${activeTab === 'node' ? 'active' : ''}`}
            onClick={() => setActiveTab('node')}
          >
            📊 Node
          </button>
          <button
            className={`tab-button ${activeTab === 'incident' ? 'active' : ''}`}
            onClick={() => setActiveTab('incident')}
          >
            🚨 Incident
          </button>
          <button
            className={`tab-button ${activeTab === 'strategy' ? 'active' : ''}`}
            onClick={() => setActiveTab('strategy')}
          >
            📈 Strategy
          </button>
        </div>
      </div>

      <div className="panel-content">
        {activeTab === 'node' && (
          <div className="tab-content">
            {selectedNode ? (
              <>
                <h3>{selectedNode.name}</h3>
                <div className="node-stats">
                  <div className="stat-row">
                    <span className="stat-label">Type:</span>
                    <span className="stat-value">{selectedNode.type}</span>
                  </div>
                  <div className="stat-row">
                    <span className="stat-label">Status:</span>
                    <span className={`stat-value status-${selectedNode.operationalMode}`}>
                      {selectedNode.operationalMode.toUpperCase()}
                    </span>
                  </div>
                  <div className="stat-row">
                    <span className="stat-label">Utilization:</span>
                    <span className="stat-value">{(selectedNode.utilization * 100).toFixed(1)}%</span>
                  </div>
                  <div className="stat-row">
                    <span className="stat-label">Health:</span>
                    <span className="stat-value">{(selectedNode.health * 100).toFixed(1)}%</span>
                  </div>
                  <div className="stat-row">
                    <span className="stat-label">Latency:</span>
                    <span className="stat-value">{selectedNode.latency.toFixed(1)}ms</span>
                  </div>
                  <div className="stat-row">
                    <span className="stat-label">Error Rate:</span>
                    <span className="stat-value">{(selectedNode.errorRate * 100).toFixed(2)}%</span>
                  </div>
                  <div className="stat-row">
                    <span className="stat-label">Instances:</span>
                    <span className="stat-value">
                      {selectedNode.scaling.current} / {selectedNode.scaling.max}
                    </span>
                  </div>
                  <div className="stat-row">
                    <span className="stat-label">Load In:</span>
                    <span className="stat-value">{selectedNode.loadIn.toFixed(0)} RPS</span>
                  </div>
                  <div className="stat-row">
                    <span className="stat-label">Cost:</span>
                    <span className="stat-value">
                      ${(selectedNode.costPerSec * selectedNode.scaling.current * 60).toFixed(2)}/min
                    </span>
                  </div>
                </div>

                {/* Component-Specific Metrics */}
                {selectedNode.specificMetrics && (
                  <div className="specific-metrics">
                    <h4>📊 Component Metrics</h4>
                    <div className="metrics-grid">
                      {Object.entries(selectedNode.specificMetrics).map(([key, value]) => {
                        // Format the value nicely
                        let displayValue: string | number = value;
                        if (typeof value === 'number') {
                          displayValue = value % 1 === 0 ? value : value.toFixed(2);
                        } else if (typeof value === 'boolean') {
                          displayValue = value ? '✓ Enabled' : '✗ Disabled';
                        } else if (Array.isArray(value)) {
                          displayValue = value.length > 0 ? value.join(', ') : 'None';
                        }
                        
                        // Format the key (camelCase → Title Case)
                        const displayKey = key
                          .replace(/([A-Z])/g, ' $1')
                          .replace(/^./, str => str.toUpperCase())
                          .trim();
                        
                        return (
                          <div key={key} className="metric-item">
                            <span className="metric-label">{displayKey}:</span>
                            <span className="metric-value">{displayValue}</span>
                          </div>
                        );
                      })}
                    </div>
                  </div>
                )}

                <h4>Recommended Actions</h4>
                <div className="action-list">
                  {ACTIONS.filter(a => a.target === selectedNode.id).slice(0, 5).map(action => {
                    const canExecute = canExecuteAction(action.id);
                    const cooldown = getCooldownRemaining(action.id);

                    return (
                      <button
                        key={action.id}
                        className="action-button"
                        onClick={() => onExecuteAction(action.id)}
                        disabled={!canExecute || cooldown > 0}
                      >
                        <div className="action-name">{action.name}</div>
                        <div className="action-cost">
                          ${action.oneTimeCost}
                          {cooldown > 0 && ` (${cooldown}s)`}
                        </div>
                      </button>
                    );
                  })}
                </div>
              </>
            ) : (
              <div className="empty-state">
                <p>Select a node from the map to view details</p>
              </div>
            )}
          </div>
        )}

        {activeTab === 'incident' && (
          <div className="tab-content">
            {selectedIncident ? (
              <>
                <h3>
                  {selectedIncident.aiGenerated 
                    ? ((selectedIncident as any).aiIncidentName || 'AI Incident')
                    : incidentDef?.name
                  }
                </h3>
                {selectedIncident.aiGenerated && (
                  <div className="ai-badge">
                    <span>🤖 AI-Generated Incident</span>
                  </div>
                )}
                <div className="incident-details">
                  <div className="stat-row">
                    <span className="stat-label">Severity:</span>
                    <span className={`stat-value severity-${selectedIncident.severity.toLowerCase()}`}>
                      {selectedIncident.severity}
                    </span>
                  </div>
                  {!selectedIncident.aiGenerated && (
                    <div className="stat-row">
                      <span className="stat-label">Category:</span>
                      <span className="stat-value">{incidentDef?.category || 'UNKNOWN'}</span>
                    </div>
                  )}
                  <div className="stat-row">
                    <span className="stat-label">Target:</span>
                    <span className="stat-value">{selectedIncident.targetNodeId}</span>
                  </div>
                  <div className="stat-row">
                    <span className="stat-label">Mitigation:</span>
                    <span className="stat-value">
                      {(selectedIncident.mitigationProgress * 100).toFixed(0)}%
                    </span>
                  </div>
                  {/* Progress bar matching activity log */}
                  {selectedIncident.mitigationProgress > 0 && (
                    <div className="mitigation-bar" style={{ marginTop: '0.5rem', marginBottom: '0.5rem' }}>
                      <div
                        className="mitigation-fill"
                        style={{ width: `${selectedIncident.mitigationProgress * 100}%` }}
                      ></div>
                    </div>
                  )}
                  {selectedIncident.relatedIncidentIds && selectedIncident.relatedIncidentIds.length > 0 && (
                    <div className="stat-row related-incidents-indicator">
                      <span className="stat-label">🔗 Related:</span>
                      <span className="stat-value">
                        {selectedIncident.relatedIncidentIds.length} linked incident{selectedIncident.relatedIncidentIds.length > 1 ? 's' : ''}
                      </span>
                    </div>
                  )}
                  <p className="incident-description">
                    {selectedIncident.aiGenerated 
                      ? ((selectedIncident as any).aiDescription || 'AI-generated contextual incident')
                      : (incidentDef?.description || 'No description')
                    }
                  </p>

                  {/* Show related incidents if any */}
                  {selectedIncident.relatedIncidentIds && selectedIncident.relatedIncidentIds.length > 0 && (
                    <div className="related-incidents-section">
                      <h4>🔗 Related Incidents (Shared Root Cause)</h4>
                      <div className="related-incidents-list">
                        {selectedIncident.relatedIncidentIds.map(relatedId => {
                          const relatedIncident = state.activeIncidents.find(i => i.id === relatedId);
                          if (!relatedIncident) return null;
                          const relatedName = relatedIncident.aiGenerated 
                            ? ((relatedIncident as any).aiIncidentName || 'Related Incident')
                            : INCIDENTS.find(i => i.id === relatedIncident.definitionId)?.name || 'Related Incident';
                          return (
                            <div key={relatedId} className="related-incident-item">
                              <span className={`severity-badge severity-${relatedIncident.severity.toLowerCase()}`}>
                                {relatedIncident.severity}
                              </span>
                              <span className="related-incident-name">{relatedName}</span>
                              <span className="related-incident-progress">
                                {(relatedIncident.mitigationProgress * 100).toFixed(0)}%
                              </span>
                            </div>
                          );
                        })}
                      </div>
                      <p className="related-incidents-note">
                        💡 Fixing this incident will fully resolve all related incidents (shared root cause)
                      </p>
                    </div>
                  )}

                  <h4>Resolution Options</h4>
                  <div className="action-list">
                    {selectedIncident.aiGenerated && selectedIncident.aiSuggestedActions ? (
                      // Show AI-suggested actions
                      selectedIncident.aiSuggestedActions.map((aiAction, idx) => {
                        const canExecute = state.cash >= aiAction.cost;
                        const isInProgress = state.actionsInProgress.some(
                          a => a.actionId === `ai_${aiAction.actionName.replace(/\s+/g, '_').toLowerCase()}` && 
                               a.mitigatingIncidentId === selectedIncident.id
                        );

                        return (
                          <button
                            key={idx}
                            className={`action-button resolution ai-action ${isInProgress ? 'in-progress' : ''}`}
                            onClick={() => onExecuteAIAction(
                              aiAction.actionName,
                              aiAction.cost,
                              aiAction.durationSeconds,
                              selectedIncident.id
                            )}
                            disabled={!canExecute || isInProgress}
                          >
                            <div className="action-name">
                              🤖 {aiAction.actionName}
                              {isInProgress && ' ⏳'}
                            </div>
                            <div className="action-description">{aiAction.description}</div>
                            <div className="action-cost">
                              ${aiAction.cost} • {aiAction.durationSeconds}s • {Math.round(aiAction.effectiveness * 100)}% effective
                            </div>
                          </button>
                        );
                      })
                    ) : !incidentDef || incidentDef.resolutionOptions.length === 0 ? (
                      <p className="no-actions">This incident auto-resolves over time</p>
                    ) : (
                      <>
                        {incidentDef && incidentDef.resolutionOptions
                          .filter(actionId => {
                            // Only show actions that are available (not on long cooldown)
                            const cooldown = getCooldownRemaining(actionId);
                            return cooldown < 30; // Only hide if cooldown > 30s
                          })
                          .map(actionId => {
                        const action = ACTIONS.find(a => a.id === actionId);
                        if (!action) return null;

                        const canExecute = canExecuteAction(actionId);
                        const cooldown = getCooldownRemaining(actionId);
                        const activeAction = state.actionsInProgress.find(
                          a => a.actionId === actionId && a.mitigatingIncidentId === selectedIncident.id
                        );
                        const isInProgress = !!activeAction;

                        // Calculate actual time remaining if in progress
                        let timeDisplay = '';
                        if (isInProgress && activeAction) {
                          const remaining = Math.max(0, Math.ceil((activeAction.endTime - Date.now()) / 1000));
                          timeDisplay = `${remaining}s remaining`;
                        } else if (cooldown > 0) {
                          timeDisplay = `Cooldown: ${cooldown}s`;
                        } else if (action.durationSeconds > 0) {
                          timeDisplay = `Duration: ${action.durationSeconds}s`;
                        }

                        return (
                          <button
                            key={actionId}
                            className={`action-button resolution ${isInProgress ? 'in-progress' : ''}`}
                            onClick={() => onMitigateIncident(selectedIncident.id, actionId)}
                            disabled={!canExecute || cooldown > 0 || isInProgress}
                          >
                            <div className="action-name">
                              {action.name}
                              {isInProgress && ' ⏳'}
                            </div>
                            <div className="action-cost">
                              ${action.oneTimeCost}
                              {timeDisplay && ` • ${timeDisplay}`}
                            </div>
                          </button>
                        );
                          })}
                      </>
                    )}
                  </div>
                </div>
              </>
            ) : (
              <div className="empty-state">
                <p>Select an incident from the feed to view details</p>
              </div>
            )}
          </div>
        )}

        {activeTab === 'strategy' && (
          <div className="tab-content">
            <h3>Business & Growth</h3>
            <div className="strategy-section">
              <h4>Fundraising</h4>
              <div className="action-list">
                {ACTIONS.filter(a => a.category === 'Business').map(action => {
                  const canExecute = canExecuteAction(action.id);
                  const cooldown = getCooldownRemaining(action.id);

                  return (
                    <button
                      key={action.id}
                      className="action-button"
                      onClick={() => onExecuteAction(action.id)}
                      disabled={!canExecute || cooldown > 0}
                    >
                      <div className="action-name">{action.name}</div>
                      <div className="action-cost">
                        {action.oneTimeCost < 0 ? `+$${-action.oneTimeCost}` : `$${action.oneTimeCost}`}
                        {cooldown > 0 && ` (${cooldown}s)`}
                      </div>
                    </button>
                  );
                })}
              </div>

              <h4>Team</h4>
              <div className="action-list">
                {ACTIONS.filter(a => a.id === 'hire_sre').map(action => {
                  const canExecute = canExecuteAction(action.id);
                  const cooldown = getCooldownRemaining(action.id);

                  return (
                    <button
                      key={action.id}
                      className="action-button"
                      onClick={() => onExecuteAction(action.id)}
                      disabled={!canExecute || cooldown > 0}
                    >
                      <div className="action-name">{action.name}</div>
                      <div className="action-cost">
                        ${action.oneTimeCost} (+${action.recurringCostDelta * 60}/min)
                        {cooldown > 0 && ` (${cooldown}s)`}
                      </div>
                    </button>
                  );
                })}
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

