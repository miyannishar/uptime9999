import React from 'react';
import { GameState } from '../sim/types';
import { ACTIONS } from '../data/actions';
import { isActionTargetPresent } from '../sim/actionAvailability';

interface ActionBarProps {
  state: GameState;
  onExecuteAction: (actionId: string) => void;
}

export default function ActionBar({ state, onExecuteAction }: ActionBarProps) {
  // Quick actions - Mix of scaling AND cost-saving!
  const quickActionIds = [
    // === COST SAVING (Show first - positive actions!) ===
    'scale_down_app',
    'scale_down_workers',
    'optimize_db_queries',
    'optimize_cache_ttl',
    'compress_assets',
    'consolidate_instances',
    'price_increase',
    'code_cleanup',
    
    // === SCALING (Add capacity) ===
    'add_app_instance',
    'remove_app_instance',
    'add_worker_instance',
    'remove_worker_instance',
    
    // === DATABASE ===
    'add_db_replica',
    'add_db_pooler',
    'enable_multi_az',
    
    // === MICROSERVICES ===
    'split_auth_service',
    'split_payment_service',
    'split_notification_service',
    
    // === CACHING & PERFORMANCE ===
    'add_cache_node',
    'add_cdn_edge',
    'remove_cache_emergency',
    
    // === INFRASTRUCTURE ===
    'add_apigw_instance',
    'add_message_bus',
    'add_search_service',
    'add_reverse_proxy',
    
    // === OBSERVABILITY ===
    'add_distributed_tracing',
    'add_log_aggregation',
    
    // === COST OPTIMIZATION ===
    'enable_autoscaling',
    'compress_static_assets',
    
    // === SECURITY ===
    'add_ddos_protection',
    'add_rate_limiting',
    'enable_e2e_encryption',
    
    // === ADVANCED ===
    'add_priority_queue',
    'add_dead_letter_queue',
    'enable_anycast_dns',
  ];

  const CATEGORY_BREAKS: Record<string, string> = {
    scale_down_app:          '💲 Cost & Optimize',
    add_app_instance:        '⬆ Scale',
    add_db_replica:          '🗄 Database',
    split_auth_service:      '⚙ Microservices',
    add_cache_node:          '⚡ Performance',
    add_apigw_instance:      '🏗 Infrastructure',
    add_distributed_tracing: '🔭 Observability',
    enable_autoscaling:      '💰 Cost Automation',
    add_ddos_protection:     '🛡 Security',
    add_priority_queue:      '⚙ Advanced',
  };

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
        <h3>Quick Actions</h3>
      </div>
      <div className="action-bar-buttons">
        {/* Category headers injected inline before each group */}
        {quickActionIds.map((actionId, idx) => {
          const action = ACTIONS.find(a => a.id === actionId);
          if (!action) return null;

          // Hide actions for components not yet deployed
          if (!isActionTargetPresent(state, action.target)) return null;

          const canExecute = canExecuteAction(actionId);
          const cooldown = getCooldownRemaining(actionId);
          const inProgress = state.actionsInProgress.some(a => a.actionId === actionId);
          const categoryLabel = CATEGORY_BREAKS[actionId];

          return (
            <React.Fragment key={actionId}>
              {categoryLabel && (
                <div className="action-category-header">{categoryLabel}</div>
              )}
              <button
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
                {inProgress && <span className="action-spinner" aria-label="In progress" />}
              </button>
            </React.Fragment>
          );
        })}
      </div>
    </div>
  );
}

