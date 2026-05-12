// Stakeholder definitions — trigger conditions, messages, and response effects

export interface StakeholderDef {
  id: string;
  character: string;
  icon: string;
  triggerCondition: (metrics: StakeholderMetrics) => boolean;
  cooldownMs: number; // Minimum time between messages from same stakeholder
  generateMessage: (metrics: StakeholderMetrics) => {
    message: string;
    responses: Array<{ text: string; effect: string }>;
  };
}

export interface StakeholderMetrics {
  reputation: number;
  uptime: number;
  cash: number;
  revenue: number;
  costs: number;
  critCount: number;
  warnCount: number;
  totalIncidents: number;
  techDebt: number;
  burnout: number;
  users: number;
  warRoomActive: boolean;
  elapsedSeconds: number;
}

const CEO_MESSAGES = [
  "The board is asking me about this outage. I need a clear ETA — investors are watching.",
  "Our stock price is taking a hit. When will systems be back to normal?",
  "I just got off a call with our biggest client. They're NOT happy. What's the status?",
  "I'm seeing red on every dashboard. Is this as bad as it looks?",
  "The press is starting to pick up on our downtime. We need this fixed NOW.",
];

const CTO_MESSAGES = [
  "I'm seeing correlated failures across multiple services. Have we identified the root cause?",
  "Our error budget for this quarter is almost exhausted. We need to stabilize before deploying anything new.",
  "The architecture can't keep handling this load pattern. We need to discuss scaling strategy.",
  "I've been reviewing the incident patterns — we're seeing the same failure mode repeat. We need a systemic fix.",
  "Our tech debt is catching up with us. We need to carve out time for reliability work.",
];

const VP_SALES_MESSAGES = [
  "I have three enterprise deals about to close and they're all asking about our uptime numbers. This is killing us.",
  "Customer churn is accelerating. Sales can't close deals when prospects see our status page.",
  "Our competitors are using our outage in their sales pitches. We need to get this under control.",
  "I need you to update the status page honestly. Customers trust transparency more than spin.",
];

const CUSTOMER_MESSAGES = [
  "Hi, our production pipeline depends on your API. We're seeing 500 errors on every request. What's happening?",
  "We're evaluating our contract renewal and this downtime is concerning. Can you share your incident report?",
  "Our SLA agreement guarantees 99.9% uptime. We're well below that this month. Expecting credit adjustments.",
  "Multiple teams at our company are blocked. We need a realistic timeline for resolution.",
];

const JUNIOR_SRE_MESSAGES = [
  "Hey, I'm on-call and I'm seeing alerts I've never dealt with before. Should I try restarting the pods?",
  "The runbook says to escalate after 15 minutes but I'm not sure if this counts as a P1. What should I do?",
  "I think I found the issue but I'm scared to push the fix to production without review. Can you pair with me?",
  "The monitoring dashboard is all red but I can't tell which alert is the root cause. Everything looks connected.",
];

function pickRandom<T>(arr: T[]): T {
  return arr[Math.floor(Math.random() * arr.length)];
}

export const STAKEHOLDERS: StakeholderDef[] = [
  {
    id: 'ceo',
    character: 'CEO',
    icon: '🧑‍💼',
    cooldownMs: 120000, // 2 minutes
    triggerCondition: (m) => m.reputation < 45 || (m.critCount >= 2 && m.elapsedSeconds > 60),
    generateMessage: (_m) => ({
      message: pickRandom(CEO_MESSAGES),
      responses: [
        { text: "We're actively investigating. ETA within 10 minutes.", effect: 'promise_eta' },
        { text: "It's under control. No need to worry.", effect: 'dismiss' },
        { text: "This is serious. I'll provide updates every 5 minutes.", effect: 'transparent' },
      ],
    }),
  },
  {
    id: 'cto',
    character: 'CTO',
    icon: '👩‍💻',
    cooldownMs: 90000, // 1.5 minutes
    triggerCondition: (m) => m.critCount >= 2 || m.techDebt > 60 || (m.totalIncidents > 5 && m.elapsedSeconds > 90),
    generateMessage: (_m) => ({
      message: pickRandom(CTO_MESSAGES),
      responses: [
        { text: "Agreed — I'll file a tech debt ticket after this incident.", effect: 'tech_debt_commit' },
        { text: "Root cause identified. Implementing fix now.", effect: 'confidence' },
        { text: "We need to discuss this post-incident. Not now.", effect: 'defer' },
      ],
    }),
  },
  {
    id: 'vp_sales',
    character: 'VP Sales',
    icon: '💰',
    cooldownMs: 150000, // 2.5 minutes
    triggerCondition: (m) => m.reputation < 55 && m.users > 500,
    generateMessage: (_m) => ({
      message: pickRandom(VP_SALES_MESSAGES),
      responses: [
        { text: "I'll update the status page with accurate information now.", effect: 'status_page_update' },
        { text: "Tell customers it's a planned maintenance window.", effect: 'lie' },
        { text: "I'll prepare an incident summary for customer-facing teams.", effect: 'report' },
      ],
    }),
  },
  {
    id: 'enterprise_customer',
    character: 'Enterprise Customer',
    icon: '📧',
    cooldownMs: 180000, // 3 minutes
    triggerCondition: (m) => m.uptime < 0.99 && m.elapsedSeconds > 120,
    generateMessage: (_m) => ({
      message: pickRandom(CUSTOMER_MESSAGES),
      responses: [
        { text: "We're aware and actively working on it. I'll send a detailed update shortly.", effect: 'acknowledge' },
        { text: "Apologies for the disruption. Crediting your account now.", effect: 'credit' },
        { text: "This is within our SLA parameters. No action needed.", effect: 'deflect' },
      ],
    }),
  },
  {
    id: 'junior_sre',
    character: 'Junior SRE',
    icon: '🧑‍🔧',
    cooldownMs: 120000, // 2 minutes
    triggerCondition: (m) => m.critCount >= 1 && m.elapsedSeconds > 30 && m.burnout < 50,
    generateMessage: (_m) => ({
      message: pickRandom(JUNIOR_SRE_MESSAGES),
      responses: [
        { text: "Good instinct! Here's what to look for: check the upstream dependency first.", effect: 'mentor' },
        { text: "Escalate to me. I'll handle it.", effect: 'take_over' },
        { text: "Follow the runbook step by step. You've got this.", effect: 'encourage' },
      ],
    }),
  },
];

/**
 * Apply the effect of a stakeholder response to game metrics.
 * Returns a partial state update.
 */
export function applyStakeholderEffect(effect: string): {
  reputationDelta: number;
  burnoutDelta: number;
  techDebtDelta: number;
  cashDelta: number;
} {
  switch (effect) {
    // CEO responses
    case 'promise_eta':
      return { reputationDelta: 3, burnoutDelta: 5, techDebtDelta: 0, cashDelta: 0 };
    case 'dismiss':
      return { reputationDelta: -5, burnoutDelta: -2, techDebtDelta: 0, cashDelta: 0 };
    case 'transparent':
      return { reputationDelta: 5, burnoutDelta: 3, techDebtDelta: 0, cashDelta: 0 };
    
    // CTO responses
    case 'tech_debt_commit':
      return { reputationDelta: 2, burnoutDelta: 0, techDebtDelta: -5, cashDelta: 0 };
    case 'confidence':
      return { reputationDelta: 4, burnoutDelta: 2, techDebtDelta: 0, cashDelta: 0 };
    case 'defer':
      return { reputationDelta: -2, burnoutDelta: -3, techDebtDelta: 3, cashDelta: 0 };
    
    // VP Sales responses
    case 'status_page_update':
      return { reputationDelta: 5, burnoutDelta: 2, techDebtDelta: 0, cashDelta: 0 };
    case 'lie':
      return { reputationDelta: -10, burnoutDelta: -2, techDebtDelta: 0, cashDelta: 0 };
    case 'report':
      return { reputationDelta: 3, burnoutDelta: 5, techDebtDelta: 0, cashDelta: 0 };
    
    // Customer responses
    case 'acknowledge':
      return { reputationDelta: 4, burnoutDelta: 2, techDebtDelta: 0, cashDelta: 0 };
    case 'credit':
      return { reputationDelta: 6, burnoutDelta: 0, techDebtDelta: 0, cashDelta: -2000 };
    case 'deflect':
      return { reputationDelta: -8, burnoutDelta: -2, techDebtDelta: 0, cashDelta: 0 };
    
    // Junior SRE responses
    case 'mentor':
      return { reputationDelta: 3, burnoutDelta: 5, techDebtDelta: -2, cashDelta: 0 };
    case 'take_over':
      return { reputationDelta: 0, burnoutDelta: 8, techDebtDelta: 0, cashDelta: 0 };
    case 'encourage':
      return { reputationDelta: 2, burnoutDelta: -3, techDebtDelta: 0, cashDelta: 0 };
    
    default:
      return { reputationDelta: 0, burnoutDelta: 0, techDebtDelta: 0, cashDelta: 0 };
  }
}
