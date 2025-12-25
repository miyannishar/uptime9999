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
}

export default function DetailPanel({
  state,
  selectedNodeId,
  selectedIncidentId,
  onExecuteAction,
  onMitigateIncident,
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

    // Check cash
    if (state.cash < action.oneTimeCost) return false;

    // Check cooldown
    const cooldownEnd = state.actionCooldowns.get(actionId);
    if (cooldownEnd && Date.now() < cooldownEnd) return false;

    // Check requirements
    if (action.requires) {
      const req = action.requires;
      if (req.minCash && state.cash < req.minCash) return false;
      if (req.minUsers && state.users < req.minUsers) return false;
      if (req.nodeEnabled) {
        const node = state.architecture.nodes.get(req.nodeEnabled);
        if (!node || !node.enabled) return false;
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
            {selectedIncident && incidentDef ? (
              <>
                <h3>{incidentDef.name}</h3>
                <div className="incident-details">
                  <div className="stat-row">
                    <span className="stat-label">Severity:</span>
                    <span className={`stat-value severity-${incidentDef.severity.toLowerCase()}`}>
                      {incidentDef.severity}
                    </span>
                  </div>
                  <div className="stat-row">
                    <span className="stat-label">Category:</span>
                    <span className="stat-value">{incidentDef.category}</span>
                  </div>
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
                  <p className="incident-description">{incidentDef.description}</p>

                  <h4>Resolution Options</h4>
                  <div className="action-list">
                    {incidentDef.resolutionOptions.length === 0 ? (
                      <p className="no-actions">This incident auto-resolves over time</p>
                    ) : (
                      incidentDef.resolutionOptions
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
                      })
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

