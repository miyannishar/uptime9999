import type { IncidentDefinition } from '../sim/types';
import raw from './json/incidents.json';

export const INCIDENTS = raw as unknown as IncidentDefinition[];
