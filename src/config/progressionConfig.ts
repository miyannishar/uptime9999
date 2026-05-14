// Progressive Architecture — Component Blueprints & Unlock Conditions
// Defines the growth path from bootstrap (APP+DB+DNS) to full-scale infrastructure

export interface ComponentBlueprint {
  id: string;                    // Node ID (matches architecture.ts)
  name: string;
  icon: string;
  description: string;
  deployCost: number;            // One-time cost
  ongoingCostPerSec: number;     // Recurring cost/sec
  deployDurationSec: number;     // Deployment time (progress bar)
  phase: 1 | 2 | 3 | 4;
  prerequisites: string[];       // Must be deployed first
  unlockConditions: {
    minUsers?: number;
    minElapsedSec?: number;
    minIncidents?: number;
    minReputation?: number;
  };
  edges: Array<{ from: string; to: string; weight: number }>;
  stakeholderHint?: {
    character: string;
    icon: string;
    message: string;
    triggerAtUsers: number;
  };
}

// Components that exist from the start
export const STARTING_COMPONENTS = ['dns', 'app', 'db_primary'];

// Starting edges (DNS → APP → DB)
export const STARTING_EDGES = [
  { from: 'dns', to: 'app', weight: 1.0 },
  { from: 'app', to: 'db_primary', weight: 0.8 },
];

export const COMPONENT_BLUEPRINTS: ComponentBlueprint[] = [
  // ═══════════════════════════════════════
  // PHASE 2 — SEED (500+ users)
  // ═══════════════════════════════════════
  {
    id: 'cache',
    name: 'Redis Cache',
    icon: '⚡',
    description: 'In-memory cache to reduce DB load. Dramatically improves response times and reduces DB connection pressure.',
    deployCost: 1500,
    ongoingCostPerSec: 0.1,
    deployDurationSec: 20,
    phase: 2,
    prerequisites: [],
    unlockConditions: { minUsers: 300 },
    edges: [
      { from: 'app', to: 'cache', weight: 0.6 },
    ],
    stakeholderHint: {
      character: 'CTO',
      icon: '👩‍💻',
      message: 'Our database is getting hammered with read queries. We should deploy a caching layer — Redis would cut our DB load by 60%.',
      triggerAtUsers: 400,
    },
  },
  {
    id: 'cdn',
    name: 'CDN',
    icon: '🌐',
    description: 'Content Delivery Network. Caches static assets at edge locations, reducing latency for global users.',
    deployCost: 2000,
    ongoingCostPerSec: 0.05,
    deployDurationSec: 25,
    phase: 2,
    prerequisites: [],
    unlockConditions: { minUsers: 500 },
    edges: [
      { from: 'dns', to: 'cdn', weight: 1.0 },
      { from: 'cdn', to: 'app', weight: 0.7 }, // CDN absorbs 30% of requests
    ],
    stakeholderHint: {
      character: 'CEO',
      icon: '🧑‍💼',
      message: "Our page load times are terrible for international users. We need a CDN — our competitors all have one and it's hurting our growth.",
      triggerAtUsers: 600,
    },
  },
  {
    id: 'queue',
    name: 'Message Queue',
    icon: '📬',
    description: 'Async job processing. Offloads heavy tasks (emails, reports, webhooks) from the main request path.',
    deployCost: 1200,
    ongoingCostPerSec: 0.08,
    deployDurationSec: 15,
    phase: 2,
    prerequisites: [],
    unlockConditions: { minUsers: 600 },
    edges: [
      { from: 'app', to: 'queue', weight: 0.2 },
    ],
    stakeholderHint: {
      character: 'CTO',
      icon: '👩‍💻',
      message: "We're processing emails and webhooks synchronously in the request path. It's adding 200ms to every API call. We need a message queue.",
      triggerAtUsers: 700,
    },
  },
  {
    id: 'workers',
    name: 'Workers',
    icon: '⚙️',
    description: 'Background job processors. Consume tasks from the message queue without blocking user requests.',
    deployCost: 1000,
    ongoingCostPerSec: 0.25,
    deployDurationSec: 15,
    phase: 2,
    prerequisites: ['queue'],
    unlockConditions: { minUsers: 700 },
    edges: [
      { from: 'queue', to: 'workers', weight: 1.0 },
      { from: 'workers', to: 'db_primary', weight: 0.8 },
    ],
    stakeholderHint: {
      character: 'Junior SRE',
      icon: '🧑‍🔧',
      message: "The queue is filling up because nothing is consuming the jobs! We need to deploy worker processes to drain it.",
      triggerAtUsers: 800,
    },
  },
  {
    id: 'db_replica',
    name: 'DB Replica',
    icon: '🗄️',
    description: 'Read replica for the primary database. Offloads read queries and provides failover redundancy.',
    deployCost: 2500,
    ongoingCostPerSec: 0.4,
    deployDurationSec: 30,
    phase: 2,
    prerequisites: [],
    unlockConditions: { minUsers: 800 },
    edges: [
      { from: 'db_primary', to: 'db_replica', weight: 1.0 },
    ],
    stakeholderHint: {
      character: 'CTO',
      icon: '👩‍💻',
      message: "Our DB is a single point of failure. One disk corruption and we're down for hours. We need a read replica for redundancy and to offload read traffic.",
      triggerAtUsers: 900,
    },
  },

  // ═══════════════════════════════════════
  // PHASE 3 — GROWTH (2,000+ users)
  // ═══════════════════════════════════════
  {
    id: 'waf',
    name: 'WAF',
    icon: '🛡️',
    description: 'Web Application Firewall. Blocks SQL injection, XSS, and bot attacks before they reach your app.',
    deployCost: 3000,
    ongoingCostPerSec: 0.15,
    deployDurationSec: 20,
    phase: 3,
    prerequisites: ['cdn'],
    unlockConditions: { minUsers: 1500 },
    edges: [
      { from: 'cdn', to: 'waf', weight: 1.0 }, // Replaces CDN→APP edge
      { from: 'waf', to: 'app', weight: 0.95 }, // WAF blocks 5%
    ],
    stakeholderHint: {
      character: 'VP Sales',
      icon: '💰',
      message: "Enterprise customers are asking about our security posture. They won't sign without a WAF. This is blocking three $50K deals.",
      triggerAtUsers: 2000,
    },
  },
  {
    id: 'glb',
    name: 'Global Load Balancer',
    icon: '🔀',
    description: 'Distributes traffic across regions. Essential for high availability and geographic redundancy.',
    deployCost: 4000,
    ongoingCostPerSec: 0.2,
    deployDurationSec: 30,
    phase: 3,
    prerequisites: ['waf'],
    unlockConditions: { minUsers: 2000 },
    edges: [
      { from: 'waf', to: 'glb', weight: 1.0 },
      { from: 'glb', to: 'rlb', weight: 1.0 },
    ],
  },
  {
    id: 'rlb',
    name: 'Regional Load Balancer',
    icon: '⚖️',
    description: 'Distributes requests across app instances within a region. Enables horizontal scaling.',
    deployCost: 2500,
    ongoingCostPerSec: 0.1,
    deployDurationSec: 20,
    phase: 3,
    prerequisites: [],
    unlockConditions: { minUsers: 1800 },
    edges: [
      // Edges depend on what's deployed — GLB→RLB or CDN/WAF→RLB
      { from: 'rlb', to: 'app', weight: 1.0 },
    ],
    stakeholderHint: {
      character: 'CTO',
      icon: '👩‍💻',
      message: "We have multiple app instances but no load balancer distributing traffic. One instance is getting all requests while others idle. We need an LB.",
      triggerAtUsers: 2000,
    },
  },
  {
    id: 'apigw',
    name: 'API Gateway',
    icon: '🚪',
    description: 'Centralized API management with rate limiting, authentication, and request routing.',
    deployCost: 3500,
    ongoingCostPerSec: 0.2,
    deployDurationSec: 25,
    phase: 3,
    prerequisites: ['rlb'],
    unlockConditions: { minUsers: 3000 },
    edges: [
      { from: 'rlb', to: 'apigw', weight: 1.0 },
      { from: 'apigw', to: 'app', weight: 1.0 },
    ],
  },
  {
    id: 'storage',
    name: 'Object Storage',
    icon: '📦',
    description: 'Scalable blob storage for user uploads, backups, and static assets.',
    deployCost: 1500,
    ongoingCostPerSec: 0.05,
    deployDurationSec: 15,
    phase: 3,
    prerequisites: [],
    unlockConditions: { minUsers: 2500 },
    edges: [
      { from: 'app', to: 'storage', weight: 0.1 },
    ],
  },

  // ═══════════════════════════════════════
  // PHASE 4 — SCALE (10,000+ users)
  // ═══════════════════════════════════════
  {
    id: 'observability',
    name: 'Observability Stack',
    icon: '📊',
    description: 'Metrics, logs, and traces. See what\'s happening inside your system before users report it.',
    deployCost: 3000,
    ongoingCostPerSec: 0.05,
    deployDurationSec: 20,
    phase: 4,
    prerequisites: [],
    unlockConditions: { minUsers: 5000 },
    edges: [], // Observability doesn't participate in load flow
    stakeholderHint: {
      character: 'Junior SRE',
      icon: '🧑‍🔧',
      message: "I keep finding out about incidents from customer complaints. We need proper observability — metrics, dashboards, alerting. I'm flying blind here.",
      triggerAtUsers: 5000,
    },
  },
  {
    id: 'servicemesh',
    name: 'Service Mesh',
    icon: '🕸️',
    description: 'Advanced service-to-service communication with circuit breakers, mutual TLS, and distributed tracing.',
    deployCost: 8000,
    ongoingCostPerSec: 0.5,
    deployDurationSec: 45,
    phase: 4,
    prerequisites: ['apigw', 'observability'],
    unlockConditions: { minUsers: 10000 },
    edges: [], // Service mesh wraps existing connections
  },
];

/**
 * Get blueprints that are unlockable given current game state
 */
export function getAvailableBlueprints(
  deployedComponents: Set<string>,
  users: number,
  elapsedSec: number,
  totalIncidents: number,
): ComponentBlueprint[] {
  return COMPONENT_BLUEPRINTS.filter(bp => {
    // Already deployed
    if (deployedComponents.has(bp.id)) return false;
    
    // Check prerequisites
    if (bp.prerequisites.some(req => !deployedComponents.has(req))) return false;
    
    // Check unlock conditions
    const cond = bp.unlockConditions;
    if (cond.minUsers && users < cond.minUsers) return false;
    if (cond.minElapsedSec && elapsedSec < cond.minElapsedSec) return false;
    if (cond.minIncidents && totalIncidents < cond.minIncidents) return false;
    
    return true;
  });
}

/**
 * Get blueprints that are visible but locked (show requirements)
 */
export function getLockedBlueprints(
  deployedComponents: Set<string>,
  users: number,
): ComponentBlueprint[] {
  return COMPONENT_BLUEPRINTS.filter(bp => {
    if (deployedComponents.has(bp.id)) return false;
    
    // Show locked if in current or next phase
    const currentPhase = users < 500 ? 1 : users < 2000 ? 2 : users < 10000 ? 3 : 4;
    return bp.phase <= currentPhase + 1;
  });
}

/**
 * Get the stakeholder hint that should fire at this user count
 */
export function getScalingHint(
  deployedComponents: Set<string>,
  users: number,
): ComponentBlueprint | null {
  for (const bp of COMPONENT_BLUEPRINTS) {
    if (deployedComponents.has(bp.id)) continue;
    if (!bp.stakeholderHint) continue;
    if (bp.prerequisites.some(req => !deployedComponents.has(req))) continue;
    
    // Trigger within a ±100 user window of the hint threshold
    if (users >= bp.stakeholderHint.triggerAtUsers && 
        users < bp.stakeholderHint.triggerAtUsers + 200) {
      return bp;
    }
  }
  return null;
}
