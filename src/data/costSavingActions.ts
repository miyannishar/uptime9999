import type { ActionDefinition } from '../sim/types';
import { ACTIONS } from './actions';

const COST_SAVING_IDS = new Set<string>([
  'scale_down_app', 'scale_down_workers', 'optimize_db_queries',
  'compress_assets', 'optimize_cache_ttl', 'consolidate_instances',
  'price_increase', 'growth_marketing_campaign', 'code_cleanup',
  'performance_audit',
]);

export const COST_SAVING_ACTIONS: ActionDefinition[] = ACTIONS.filter(a => COST_SAVING_IDS.has(a.id));
