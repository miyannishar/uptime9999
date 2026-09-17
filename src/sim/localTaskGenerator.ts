/**
 * Generates interactive TaskData from incident + action without any API call.
 * Maps incident category + action type to a realistic DevOps task the player must complete.
 * Large template library so players see variety across many incidents.
 */
import type { TaskData } from '../services/taskGenerator';
import type { ActionDefinition, IncidentDefinition } from './types';
import rawTemplates from '../data/json/taskTemplates.json';

// Deterministic: same category + action class always gives the same task type
function pickTaskType(def: IncidentDefinition, action: ActionDefinition): TaskData['type'] {
  const cat = def.category;
  const act = action.id;

  if (/restart|reboot|kill|bounce/.test(act)) return 'terminal';
  if (/rollback|deploy|canary|release|hotfix/.test(act)) return 'button-sequence';
  if (/optimize.*query|slow.*query|index|explain/.test(act)) return 'code';
  if (/config|ttl|timeout|limit|pool|tune/.test(act)) return 'config';
  if (/log|debug|trace|find|search|grep/.test(act)) return 'log';
  if (/monitor|watch|threshold|alert/.test(act)) return 'monitor';
  if (cat === 'SECURITY') return 'multi-choice';
  if (cat === 'DATABASE') return pickFromList(['log', 'code', 'config'], def.id);
  if (cat === 'CACHE') return pickFromList(['config', 'terminal', 'log'], def.id);
  if (cat === 'COMPUTE') return pickFromList(['terminal', 'log', 'monitor'], def.id);
  if (cat === 'QUEUE' || cat === 'WORKERS') return pickFromList(['terminal', 'log', 'button-sequence'], def.id);
  if (cat === 'DEPLOY') return pickFromList(['button-sequence', 'terminal', 'code'], def.id);
  if (cat === 'TRAFFIC') return pickFromList(['multi-choice', 'terminal', 'monitor'], def.id);
  if (cat === 'DNS') return pickFromList(['terminal', 'config', 'log'], def.id);
  if (cat === 'CDN') return pickFromList(['config', 'terminal', 'log'], def.id);
  if (cat === 'STORAGE') return pickFromList(['terminal', 'log', 'code'], def.id);
  if (cat === 'EXTERNAL') return pickFromList(['multi-choice', 'log', 'button-sequence'], def.id);
  if (cat === 'OBSERVABILITY') return pickFromList(['config', 'terminal', 'log'], def.id);
  return 'terminal';
}

// Hash the incident id to pick deterministically from a list
function pickFromList<T>(list: T[], seed: string): T {
  let h = 0;
  for (let i = 0; i < seed.length; i++) h = (h * 31 + seed.charCodeAt(i)) | 0;
  return list[Math.abs(h) % list.length];
}

// ─── TEMPLATE DATA (loaded from JSON) ────────────────────────────────────────

const TERMINAL_TEMPLATES = rawTemplates.TERMINAL_TEMPLATES as unknown as Record<string, { command: string; completion: string; placeholder: string; prompt: string }[]>;
const CONFIG_TEMPLATES = rawTemplates.CONFIG_TEMPLATES as unknown as Array<{ filename: string; key: string; cur: string; target: string; content: string }>;
const CODE_TEMPLATES = rawTemplates.CODE_TEMPLATES as unknown as Array<{ filename: string; code: string; issue: string; bugPattern: string; expectedFix: string; fixHint: string }>;
const BUTTON_SEQUENCE_TEMPLATES = rawTemplates.BUTTON_SEQUENCE_TEMPLATES as unknown as Array<{ title: string; description: string; steps: Array<{ label: string; buttonText: string; correct: boolean }> }>;
const MULTI_CHOICE_TEMPLATES = rawTemplates.MULTI_CHOICE_TEMPLATES as unknown as Array<{ question: string; options: Array<{ id: string; text: string; correct: boolean }> }>;
const LOG_TARGETS = rawTemplates.LOG_TARGETS as string[];
const MONITOR_TEMPLATES = rawTemplates.MONITOR_TEMPLATES as unknown as Array<{ title: string; description: string; metrics: Array<{ name: string; current: number; target: number; unit: string; threshold: 'above' | 'below' }> }>;

// ─── BUILDER ─────────────────────────────────────────────────────────────────

function buildTerminalTask(def: IncidentDefinition, action: ActionDefinition): TaskData {
  const pool = TERMINAL_TEMPLATES[def.category] ?? TERMINAL_TEMPLATES.DEFAULT;
  const t = pickFromList(pool, def.id + action.id);
  return { type: 'terminal', data: { prompt: t.prompt, command: t.command, placeholder: t.placeholder, expectedCompletion: t.completion } };
}

function buildConfigTask(def: IncidentDefinition, _action: ActionDefinition): TaskData {
  const t = pickFromList(CONFIG_TEMPLATES, def.id);
  return { type: 'config', data: t };
}

function buildCodeTask(def: IncidentDefinition): TaskData {
  const t = pickFromList(CODE_TEMPLATES, def.id);
  return { type: 'code', data: t };
}

function buildButtonSequenceTask(def: IncidentDefinition): TaskData {
  const t = pickFromList(BUTTON_SEQUENCE_TEMPLATES, def.id);
  return { type: 'button-sequence', data: t };
}

function buildMultiChoiceTask(def: IncidentDefinition): TaskData {
  const t = pickFromList(MULTI_CHOICE_TEMPLATES, def.id);
  return { type: 'multi-choice', data: { question: t.question, options: t.options } };
}

function buildLogTask(def: IncidentDefinition): TaskData {
  const target = pickFromList(LOG_TARGETS, def.id);
  const ts = () => new Date().toISOString().slice(0, 19).replace('T', ' ');
  const logs = [
    `[INFO]  ${ts()} app: Health check passed (23ms)`,
    `[INFO]  ${ts()} cache: Hit rate 81%`,
    `[INFO]  ${ts()} app: Request processed (44ms)`,
    `[WARN]  ${ts()} db: Query latency elevated (320ms)`,
    `[INFO]  ${ts()} lb: Routing to 3 healthy backends`,
    `[INFO]  ${ts()} app: Request processed (51ms)`,
    `[ERROR] ${ts()} ${def.category.toLowerCase()}: ${target}`,
    `[INFO]  ${ts()} app: Request processed (48ms)`,
    `[WARN]  ${ts()} app: High memory usage 74%`,
    `[INFO]  ${ts()} cache: Keys 142,000 / 180,000 max`,
    `[INFO]  ${ts()} app: Request processed (55ms)`,
    `[INFO]  ${ts()} db: Connections 67/100`,
    `[INFO]  ${ts()} workers: Processing 42 jobs/sec`,
    `[WARN]  ${ts()} db: Slow query detected (890ms)`,
    `[INFO]  ${ts()} app: Request processed (60ms)`,
  ];
  return { type: 'log', data: { logs, targetError: target.slice(0, 40) } };
}

function buildMonitorTask(def: IncidentDefinition): TaskData {
  const t = pickFromList(MONITOR_TEMPLATES, def.id);
  return { type: 'monitor', data: t };
}

/** Generates a task without any API call. Always succeeds. */
export function generateLocalTask(def: IncidentDefinition, action: ActionDefinition): TaskData {
  const type = pickTaskType(def, action);
  switch (type) {
    case 'terminal':       return buildTerminalTask(def, action);
    case 'config':         return buildConfigTask(def, action);
    case 'code':           return buildCodeTask(def);
    case 'button-sequence':return buildButtonSequenceTask(def);
    case 'multi-choice':   return buildMultiChoiceTask(def);
    case 'log':            return buildLogTask(def);
    case 'monitor':        return buildMonitorTask(def);
    default:               return buildTerminalTask(def, action);
  }
}
