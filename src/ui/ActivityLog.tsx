import { GameState } from '../sim/types';
import { ACTIONS } from '../data/actions';

interface ActivityLogProps {
  state: GameState;
}

export default function ActivityLog({ state }: ActivityLogProps) {
  const recentActions = [...state.actionsInProgress].reverse().slice(0, 20);

  const getProgress = (action: any): number => {
    const now = Date.now();
    const elapsed = Math.max(0, now - action.startTime);
    const total = action.endTime - action.startTime;
    // Return progress as 0-1.0 (same as incident mitigationProgress calculation)
    return Math.min(1.0, elapsed / total);
  };

  const getTimeRemaining = (action: any): number => {
    const now = Date.now();
    return Math.max(0, Math.ceil((action.endTime - now) / 1000));
  };

  const getActionName = (action: any): string => {
    // Check if it's an AI action
    if (action.actionId.startsWith('ai_')) {
      // Extract name from ID
      return action.actionId
        .replace(/^ai_/, '')
        .replace(/_/g, ' ')
        .split(' ')
        .map((w: string) => w.charAt(0).toUpperCase() + w.slice(1))
        .join(' ');
    }
    
    // Regular action
    const actionDef = ACTIONS.find(a => a.id === action.actionId);
    return actionDef?.name || 'Unknown Action';
  };

  return (
    <div className="activity-log">
      <div className="activity-header">
        <h3>⚙️ Activity Log</h3>
        <span className="activity-count">{state.actionsInProgress.length} active</span>
      </div>

      <div className="activity-list">
        {recentActions.length === 0 ? (
          <div className="no-activity">
            <p>No actions in progress</p>
          </div>
        ) : (
          recentActions.map(action => {
            const isAIAction = action.actionId.startsWith('ai_');
            const actionName = getActionName(action);
            const progress = getProgress(action);
            const timeLeft = getTimeRemaining(action);

            return (
              <div key={action.id} className={`activity-item ${isAIAction ? 'ai-action-item' : ''}`}>
                <div className="activity-info">
                  <span className="activity-name">
                    {isAIAction && '🤖 '}
                    {actionName}
                  </span>
                  {action.targetNodeId && (
                    <span className="activity-target">→ {action.targetNodeId}</span>
                  )}
                  <span className="activity-time">{timeLeft}s</span>
                </div>
                <div className="activity-progress-bar">
                  <div
                    className="activity-progress-fill"
                    style={{ width: `${progress * 100}%` }}
                  ></div>
                </div>
              </div>
            );
          })
        )}
      </div>
    </div>
  );
}

