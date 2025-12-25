import { GameState } from '../sim/types';
import { ACTIONS } from '../data/actions';

interface ActionBarProps {
  state: GameState;
  onExecuteAction: (actionId: string) => void;
}

export default function ActionBar({ state, onExecuteAction }: ActionBarProps) {
  // Quick actions - most commonly needed
  const quickActionIds = [
    'scale_app_1',
    'scale_app_2',
    'scale_down_app_1', // Cost reduction
    'enable_rate_limit_waf',
    'rollback_deploy',
    'add_workers_2',
    'scale_down_workers_2', // Cost reduction
    'increase_db_connections',
    'scale_cache',
    'disable_cache', // Cost reduction
    'enable_circuit_breaker',
    'reduce_observability', // Cost reduction
  ];

  const canExecuteAction = (actionId: string): boolean => {
    const action = ACTIONS.find(a => a.id === actionId);
    if (!action) return false;

    if (state.cash < action.oneTimeCost) return false;

    const cooldownEnd = state.actionCooldowns.get(actionId);
    if (cooldownEnd && Date.now() < cooldownEnd) return false;

    return true;
  };

  const getCooldownRemaining = (actionId: string): number => {
    const cooldownEnd = state.actionCooldowns.get(actionId);
    if (!cooldownEnd) return 0;
    return Math.max(0, Math.ceil((cooldownEnd - Date.now()) / 1000));
  };

  return (
    <div className="action-bar">
      <div className="action-bar-header">
        <h3>⚡ Quick Actions</h3>
      </div>
      <div className="action-bar-buttons">
        {quickActionIds.map((actionId, idx) => {
          const action = ACTIONS.find(a => a.id === actionId);
          if (!action) return null;

          const canExecute = canExecuteAction(actionId);
          const cooldown = getCooldownRemaining(actionId);
          const inProgress = state.actionsInProgress.some(a => a.actionId === actionId);

          return (
            <button
              key={actionId}
              className={`quick-action ${!canExecute || cooldown > 0 ? 'disabled' : ''} ${
                inProgress ? 'in-progress' : ''
              }`}
              onClick={() => onExecuteAction(actionId)}
              disabled={!canExecute || cooldown > 0}
              title={action.description}
            >
              <div className="action-hotkey">{idx + 1}</div>
              <div className="action-name">{action.name}</div>
              <div className="action-cost">${action.oneTimeCost}</div>
              {cooldown > 0 && <div className="action-cooldown">{cooldown}s</div>}
              {inProgress && <div className="action-progress">⏳</div>}
            </button>
          );
        })}
      </div>
    </div>
  );
}

