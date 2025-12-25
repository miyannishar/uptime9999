// Core simulation types for UPTIME 99.99

export type ComponentType =
  | 'DNS' | 'CDN' | 'WAF' | 'GLB' | 'RLB' | 'APIGW' | 'APP'
  | 'SERVICE_MESH' | 'CACHE' | 'QUEUE' | 'WORKERS'
  | 'DB_PRIMARY' | 'DB_REPLICA' | 'OBJECT_STORAGE' | 'OBSERVABILITY';

export type IncidentSeverity = 'INFO' | 'WARN' | 'CRIT';
export type IncidentCategory = 
  | 'TRAFFIC' | 'SECURITY' | 'DEPLOY' | 'DNS' | 'COMPUTE' 
  | 'DATABASE' | 'QUEUE' | 'EXTERNAL' | 'OBSERVABILITY' | 'OPTIMIZATION';

export type ObservabilityLevel = 'BASIC' | 'METRICS' | 'TRACES';

export interface ComponentNode {
  id: string;
  type: ComponentType;
  name: string;
  enabled: boolean;
  locked: boolean;
  
  // Capacity & Performance
  capacity: number; // max RPS
  baseLatency: number; // ms
  baseError: number; // 0-1
  health: number; // 0-1
  reliabilityScore: number; // 0-1
  securityScore: number; // 0-1
  
  // Scaling
  scaling: {
    min: number;
    max: number;
    current: number;
    cooldownUntil: number;
  };
  
  // Runtime stats
  utilization: number; // 0-N (>1 = overloaded)
  latency: number; // ms
  errorRate: number; // 0-1
  loadIn: number; // RPS
  loadOut: number; // RPS
  
  // Costs
  costPerSec: number;
  
  // State
  operationalMode: 'normal' | 'degraded' | 'down';
  
  // Component-specific metrics (detailed metrics for each component type)
  specificMetrics: Record<string, any>; // Will be typed based on component type
  
  // Features
  features: {
    autoscaling?: boolean;
    circuitBreaker?: boolean;
    retries?: boolean;
    canaryDeploy?: boolean;
    rateLimit?: number;
    botProtection?: boolean;
    cacheTTL?: number;
    connectionPool?: boolean;
    maxConnections?: number;
  };
}

export interface ArchitectureEdge {
  from: string;
  to: string;
  weight: number; // load multiplier
}

export interface Architecture {
  nodes: Map<string, ComponentNode>;
  edges: ArchitectureEdge[];
}

export interface ActionDefinition {
  id: string;
  name: string;
  description: string;
  category: string;
  target: string | 'global'; // node id or global
  oneTimeCost: number;
  recurringCostDelta: number; // per second
  durationSeconds: number; // 0 = instant
  successChance: number; // 0-1
  cooldownSeconds: number;
  
  // Conditions
  requires?: {
    minCash?: number;
    minUsers?: number;
    nodeEnabled?: string;
    featureEnabled?: string;
    observabilityLevel?: ObservabilityLevel;
  };
  
  // Effects
  effects: {
    statChanges?: {
      capacity?: number;
      reliability?: number;
      security?: number;
      latency?: number;
      errorRate?: number;
      mttrMultiplier?: number;
    };
    featureToggle?: {
      feature: string;
      value: boolean | number;
    };
    techDebt?: number;
    reputationDelta?: number;
    enableNode?: string;
    scaleNode?: {
      nodeId: string;
      delta: number;
    };
    downtimeRisk?: number; // 0-1 chance of causing outage
  };
}

export interface IncidentDefinition {
  id: string;
  name: string;
  description: string;
  category: IncidentCategory;
  severity: IncidentSeverity;
  targetTypes: ComponentType[];
  
  // Spawn conditions
  preconditions: {
    minUtilization?: number;
    maxUtilization?: number;
    featureDisabled?: string;
    minTechDebt?: number;
    minErrorRate?: number;
  };
  
  baseRatePerMinute: number; // before multipliers
  
  // Effects on target
  effects: {
    utilizationMultiplier?: number;
    latencyMultiplier?: number;
    errorMultiplier?: number;
    healthDecayPerSec?: number;
    capacityMultiplier?: number;
  };
  
  // Escalation
  escalatesTo?: string; // incident id
  escalationTimeSeconds?: number;
  spreadsTo?: ComponentType[]; // can spread to these types
  
  timeToOutageSeconds?: number; // for CRIT
  
  // Resolution
  resolutionOptions: string[]; // action ids that help
  autoResolveSeconds?: number;
}

export interface ActiveIncident {
  id: string;
  definitionId: string;
  targetNodeId: string;
  severity: IncidentSeverity;
  startTime: number;
  escalationTimer: number;
  outagetimer: number;
  mitigationLevel: number; // 0-1, base completed mitigation
  mitigationProgress: number; // 0-1, includes in-progress action
  aiGenerated?: boolean; // Is this an AI-generated incident?
  aiIncidentName?: string; // AI-generated incident name
  aiDescription?: string; // AI-generated description
  aiLogs?: string; // AI-generated terminal-style logs
  aiSuggestedActions?: Array<{
    actionId?: string;
    actionName: string;
    description: string;
    cost: number;
    durationSeconds: number;
    effectiveness: number;
  }>;
  aiEffects?: any; // AI-generated effects
  aiCategory?: string; // AI-generated category (e.g., "OPTIMIZATION")
  relatedIncidentIds?: string[]; // IDs of related/linked incidents (same root cause)
  rootCauseShared?: boolean; // Is this part of a group of related incidents?
}

export interface ActionInProgress {
  id: string;
  actionId: string;
  startTime: number;
  endTime: number;
  targetNodeId?: string;
  mitigatingIncidentId?: string; // Track which incident this action is mitigating
}

export interface GameState {
  // Meta
  seed: string;
  startTime: number;
  currentTime: number;
  dayOfWeek: number;
  hourOfDay: number;
  paused: boolean;
  speed: number; // 1, 2, 4
  
  // AI Game Master (always active)
  aiSessionActive: boolean;
  recentIncidentTargets: Array<{ nodeId: string; timestamp: number }>; // Track recently targeted nodes
  
  // Architecture
  architecture: Architecture;
  
  // Business
  users: number;
  peakUsers: number;
  rps: number;
  cash: number;
  revenue: number; // per second
  costs: number; // per second
  pricing: number; // revenue per user per day
  reputation: number; // 0-100
  
  // Ops metrics
  globalErrorRate: number;
  globalLatencyP95: number;
  uptime: number; // 0-1 current
  uptimeWindow: number[]; // last 300 samples (5min)
  uptimeStreak: number; // seconds of continuous uptime
  longestStreak: number;
  
  // Stress
  techDebt: number; // 0-100
  alertFatigue: number; // 0-100
  burnout: number; // 0-100
  
  // Observability
  observabilityLevel: ObservabilityLevel;
  
  // Incidents
  activeIncidents: ActiveIncident[];
  resolvedIncidents: number;
  
  // Actions
  actionsInProgress: ActionInProgress[];
  actionCooldowns: Map<string, number>; // actionId -> cooldown end time
  
  // Unlocks
  unlockedFeatures: Set<string>;
  
  // Fundraising
  fundingRound: 'bootstrap' | 'angel' | 'seed' | 'seriesA';
  investorPressure: number; // 0-100
  
  // Game state
  gameOver: boolean;
  gameOverReason?: string;
  
  // Run stats
  totalProfit: number;
  totalIncidents: number;
}

export interface RunSummary {
  seed: string;
  duration: number;
  peakUsers: number;
  bestUptime: number;
  longestStreak: number;
  incidentsResolved: number;
  totalProfit: number;
  finalCash: number;
  finalReputation: number;
  gameOverReason?: string;
}

