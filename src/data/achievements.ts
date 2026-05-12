// Achievement definitions and checking logic

export interface AchievementDef {
  id: string;
  name: string;
  icon: string;
  description: string;
  rarity: 'common' | 'uncommon' | 'rare' | 'epic' | 'legendary';
  check: (metrics: AchievementMetrics) => boolean;
}

export interface AchievementMetrics {
  uptime: number;
  uptimeStreak: number;
  reputation: number;
  cash: number;
  users: number;
  resolvedIncidents: number;
  totalIncidents: number;
  warRoomsSurvived: number;
  postMortemsCompleted: number;
  techDebt: number;
  elapsedSeconds: number;
  activeIncidents: Array<{ severity: string; aiGenerated?: boolean }>;
  appInstances: number;
  lowestReputation: number;
  highestReputation: number;
}

export const ACHIEVEMENTS: AchievementDef[] = [
  {
    id: 'first_responder',
    name: 'First Responder',
    icon: '🔥',
    description: 'Resolve an incident within 30 seconds',
    rarity: 'common',
    check: (m) => m.resolvedIncidents >= 1 && m.elapsedSeconds < 60,
  },
  {
    id: 'calm_waters',
    name: 'Calm Waters',
    icon: '🌊',
    description: 'Go 2 minutes with zero active incidents',
    rarity: 'common',
    check: (m) => m.activeIncidents.length === 0 && m.uptimeStreak > 120 && m.elapsedSeconds > 120,
  },
  {
    id: 'firefighter',
    name: 'Firefighter',
    icon: '🧯',
    description: 'Resolve 5 incidents in a single session',
    rarity: 'common',
    check: (m) => m.resolvedIncidents >= 5,
  },
  {
    id: 'profitable',
    name: 'Money Maker',
    icon: '💰',
    description: 'Accumulate $50,000 in cash',
    rarity: 'uncommon',
    check: (m) => m.cash >= 50000,
  },
  {
    id: 'speed_demon',
    name: 'Speed Demon',
    icon: '⚡',
    description: 'Maintain 99.99% uptime for 3+ minutes straight',
    rarity: 'uncommon',
    check: (m) => m.uptimeStreak >= 180 && m.uptime >= 0.9999,
  },
  {
    id: 'crowd_puller',
    name: 'Crowd Puller',
    icon: '👥',
    description: 'Reach 10,000 active users',
    rarity: 'uncommon',
    check: (m) => m.users >= 10000,
  },
  {
    id: 'ice_cold',
    name: 'Ice Cold',
    icon: '🧊',
    description: 'Resolve a CRIT incident without any reputation loss',
    rarity: 'rare',
    check: (m) => m.resolvedIncidents >= 1 && m.reputation >= 90 && m.totalIncidents >= 3,
  },
  {
    id: 'war_room_veteran',
    name: 'War Room Veteran',
    icon: '🎖️',
    description: 'Survive 2 war room events',
    rarity: 'rare',
    check: (m) => m.warRoomsSurvived >= 2,
  },
  {
    id: 'blameless',
    name: 'Blameless Culture',
    icon: '📋',
    description: 'Complete 3 post-mortems',
    rarity: 'rare',
    check: (m) => m.postMortemsCompleted >= 3,
  },
  {
    id: 'phoenix',
    name: 'Phoenix Rising',
    icon: '💀',
    description: 'Recover from below 20 reputation to above 70',
    rarity: 'epic',
    check: (m) => m.lowestReputation < 20 && m.reputation >= 70,
  },
  {
    id: 'architect',
    name: 'Cloud Architect',
    icon: '🏗️',
    description: 'Scale to 4+ app instances',
    rarity: 'epic',
    check: (m) => m.appInstances >= 4,
  },
  {
    id: 'marathon',
    name: 'Marathon Runner',
    icon: '🏃',
    description: 'Survive for 15 minutes',
    rarity: 'epic',
    check: (m) => m.elapsedSeconds >= 900,
  },
  {
    id: 'the_nines',
    name: 'The Nines',
    icon: '👑',
    description: 'Maintain 99.99%+ uptime for 5+ minutes',
    rarity: 'legendary',
    check: (m) => m.uptimeStreak >= 300 && m.uptime >= 0.9999,
  },
  {
    id: 'incident_commander',
    name: 'Incident Commander',
    icon: '🎯',
    description: 'Resolve 15 incidents in a single session',
    rarity: 'legendary',
    check: (m) => m.resolvedIncidents >= 15,
  },
];

const RARITY_COLORS: Record<string, string> = {
  common: '#9ca3af',
  uncommon: '#22c55e',
  rare: '#3b82f6',
  epic: '#a855f7',
  legendary: '#f59e0b',
};

export function getRarityColor(rarity: string): string {
  return RARITY_COLORS[rarity] || '#9ca3af';
}

/**
 * Load achievements from localStorage
 */
export function loadPersistedAchievements(): Set<string> {
  try {
    const saved = localStorage.getItem('uptime9999_achievements');
    if (saved) {
      return new Set(JSON.parse(saved));
    }
  } catch {
    // localStorage might not be available
  }
  return new Set();
}

/**
 * Save achievements to localStorage
 */
export function persistAchievements(achievements: Set<string>): void {
  try {
    localStorage.setItem('uptime9999_achievements', JSON.stringify([...achievements]));
  } catch {
    // localStorage might not be available
  }
}
