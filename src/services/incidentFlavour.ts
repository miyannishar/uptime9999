import { chatJSON, parseJSON, errMsg } from './openai';
import { tlog } from '../utils/terminalLog';
import { GAME_CONFIG } from '../config/gameConfig';
import type { ComponentNode, IncidentDefinition, IncidentSeverity } from '../sim/types';

export function shouldFlavour(severity: IncidentSeverity, apiKey?: string): boolean {
  if (!apiKey) return false;
  return GAME_CONFIG.ai.flavourSeverities.includes(severity);
}

/** Rewrites a template incident's prose. Returns null on any failure — caller keeps template text. */
export async function flavourIncident(
  def: IncidentDefinition,
  node: ComponentNode,
  apiKey: string,
): Promise<{ name: string; description: string; logs: string } | null> {
  try {
    const { content } = await chatJSON(apiKey, [
      { role: 'system', content: 'You rewrite DevOps incident copy. Reply with JSON only: {"name":string,"description":string,"logs":string}. logs = 5-8 realistic terminal log lines separated by \\n.' },
      { role: 'user', content: `Incident: ${def.name} (${def.category}/${def.severity}) on ${node.name}. Live metrics: ${JSON.stringify(node.specificMetrics).slice(0, 400)}. Utilization ${node.utilization.toFixed(2)}, health ${node.health.toFixed(2)}. Rewrite as JSON.` },
    ], 1.1);
    const parsed = parseJSON<{ name: string; description: string; logs: string }>(content);
    if (!parsed?.name || !parsed?.description) return null;
    return { name: parsed.name, description: parsed.description, logs: parsed.logs ?? '' };
  } catch (e) {
    tlog.warn(`⚠️ Incident flavour failed, using template text: ${errMsg(e)}`);
    return null;
  }
}
