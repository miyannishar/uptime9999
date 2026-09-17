import type { ActionDefinition } from '../sim/types';
import raw from './json/actions.json';

export const ACTIONS = raw as unknown as ActionDefinition[];
