import raw from './json/stakeholders.json';

export interface StakeholderMetrics {
  reputation: number; uptime: number; cash: number; revenue: number; costs: number;
  critCount: number; warnCount: number; totalIncidents: number; techDebt: number;
  burnout: number; users: number; warRoomActive: boolean; elapsedSeconds: number;
}

export interface StakeholderDef {
  id: string; character: string; icon: string; cooldownMs: number;
  triggerCondition: (m: StakeholderMetrics) => boolean;
  generateMessage: (m: StakeholderMetrics) => { message: string; responses: Array<{ text: string; effect: string }> };
}

type PersonaTrigger = {
  maxReputation?: number; minReputation?: number; minCrits?: number; minUsers?: number;
  maxUptime?: number; minElapsedSec?: number; maxBurnout?: number;
  minTechDebt?: number; minIncidents?: number;
};

function buildTrigger(t: PersonaTrigger) {
  return (m: StakeholderMetrics) =>
    (t.maxReputation === undefined || m.reputation < t.maxReputation) &&
    (t.minReputation === undefined || m.reputation >= t.minReputation) &&
    (t.minCrits      === undefined || m.critCount >= t.minCrits) &&
    (t.minUsers      === undefined || m.users >= t.minUsers) &&
    (t.maxUptime     === undefined || m.uptime < t.maxUptime) &&
    (t.minElapsedSec === undefined || m.elapsedSeconds >= t.minElapsedSec) &&
    (t.maxBurnout    === undefined || m.burnout < t.maxBurnout) &&
    (t.minTechDebt   === undefined || m.techDebt >= t.minTechDebt) &&
    (t.minIncidents  === undefined || m.totalIncidents >= t.minIncidents);
}

function pick<T>(arr: T[]): T { return arr[Math.floor(Math.random() * arr.length)]; }

export const STAKEHOLDERS: StakeholderDef[] = (raw.personas as Array<{ id: string; character: string; icon: string; cooldownMs: number; trigger: PersonaTrigger }>).map(p => ({
  id: p.id,
  character: p.character,
  icon: p.icon,
  cooldownMs: p.cooldownMs,
  triggerCondition: buildTrigger(p.trigger),
  generateMessage: (_m: StakeholderMetrics) => ({
    message: pick((raw.messages as Record<string, string[]>)[p.id] ?? ['']),
    responses: (raw.responses as Record<string, Array<{ text: string; effect: string }>>)[p.id] ?? [],
  }),
}));

export function applyStakeholderEffect(effect: string) {
  const e = (raw.effects as Record<string, { rep: number; burnout: number; debt: number; cash: number }>)[effect];
  if (!e) return { reputationDelta: 0, burnoutDelta: 0, techDebtDelta: 0, cashDelta: 0 };
  return { reputationDelta: e.rep, burnoutDelta: e.burnout, techDebtDelta: e.debt, cashDelta: e.cash };
}
