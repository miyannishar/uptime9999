import { GameState } from '../sim/types';
import { ACTIONS } from '../data/actions';

interface ActivityLogProps {
  state: GameState;
}

export default function ActivityLog({ state }: ActivityLogProps) {
  const recentActions = [...state.actionsInProgress].reverse().slice(0, 10);

  const getProgress = (action: any): number => {
    const now = Date.now();
    const elapsed = now - action.startTime;
    const total = action.endTime - action.startTime;
    return Math.min(100, (elapsed / total) * 100);
  };

  const getTimeRemaining = (action: any): number => {
    const now = Date.now();
    return Math.max(0, Math.ceil((action.endTime - now) / 1000));
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
            const actionDef = ACTIONS.find(a => a.id === action.actionId);
            if (!actionDef) return null;

            const progress = getProgress(action);
            const timeLeft = getTimeRemaining(action);

            return (
              <div key={action.id} className="activity-item">
                <div className="activity-info">
                  <span className="activity-name">{actionDef.name}</span>
                  {action.targetNodeId && (
                    <span className="activity-target">→ {action.targetNodeId}</span>
                  )}
                  <span className="activity-time">{timeLeft}s</span>
                </div>
                <div className="activity-progress-bar">
                  <div
                    className="activity-progress-fill"
                    style={{ width: `${progress}%` }}
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

