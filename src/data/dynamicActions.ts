import type { ActionDefinition } from '../sim/types';
import { ACTIONS } from './actions';

const DYNAMIC_ACTIONS_IDS = new Set<string>([
  'add_db_replica', 'add_db_pooler', 'add_app_instance', 'remove_app_instance',
  'split_auth_service', 'split_payment_service', 'split_notification_service',
  'add_worker_instance', 'remove_worker_instance', 'add_cache_node', 'add_cdn_edge',
  'remove_cache_emergency', 'add_apigw_instance', 'enable_anycast_dns',
  'add_distributed_tracing', 'add_log_aggregation', 'enable_dynamic_autoscaling',
  'compress_static_assets', 'add_ddos_protection', 'add_rate_limiting',
  'enable_e2e_encryption', 'add_priority_queue', 'add_dead_letter_queue',
  'add_message_bus', 'add_search_service', 'add_reverse_proxy', 'enable_multi_az',
]);

export const DYNAMIC_ACTIONS: ActionDefinition[] = ACTIONS.filter(a => DYNAMIC_ACTIONS_IDS.has(a.id));
