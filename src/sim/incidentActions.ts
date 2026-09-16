import { ACTIONS } from '../data/actions';
import { INCIDENTS } from '../data/incidents';
import type { ActionDefinition, ActiveIncident } from './types';

/** Actions that help with an incident: template resolutionOptions, or none for AI incidents. */
export function getResolutionActions(incident: ActiveIncident): ActionDefinition[] {
  if (incident.aiGenerated) return [];
  const def = INCIDENTS.find(i => i.id === incident.definitionId);
  if (!def) return [];
  return def.resolutionOptions
    .map(id => ACTIONS.find(a => a.id === id))
    .filter((a): a is ActionDefinition => Boolean(a));
}
