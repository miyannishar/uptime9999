# ⚡ UPTIME 99.99

A browser-based DevOps/SRE simulation game where you maintain a production system under chaos.

## 🎮 Game Overview

You're an on-call DevOps engineer managing a production architecture. Your goal: maximize uptime and profit while scaling users and handling incidents.

### Core Features

- **15-Component Architecture**: DNS → CDN → WAF → Load Balancers → API Gateway → App Cluster → Cache/Queue/DB/Storage
- **50+ Incidents**: Traffic spikes, DDoS attacks, database issues, memory leaks, and more
- **40+ Actions**: Scale infrastructure, enable reliability patterns, optimize performance, manage security
- **Realistic Simulation**: Non-linear latency/error curves, load propagation, cascading failures
- **Business Mechanics**: Cash flow, user growth/churn, reputation, tech debt, alert fatigue
- **Difficulty Scaling**: Increases with time, users, success (infinite progression)
- **Seedable RNG**: Share your seed for reproducible runs
- **Autosave**: Saves every 30 seconds to localStorage

## 🚀 Quick Start

```bash
# Install dependencies
npm install

# Add background music (optional)
# Place your .mp3 files in public/music/ folder:
# - track1.mp3, track2.mp3, track3.mp3, track4.mp3, track5.mp3
# See public/music/README.txt for details

# Run development server
npm run dev

# Build for production
npm run build
```

Open your browser to the URL shown (usually `http://localhost:5173`)

### 🎵 Adding Background Music

1. Create music files in `public/music/` folder
2. Name them: `track1.mp3`, `track2.mp3`, etc.
3. Or edit `src/utils/musicPlayer.ts` to use your own file names
4. Use royalty-free music from FreePD, Incompetech, or YouTube Audio Library
5. Click the 🔇 button in-game to enable music

## 🎯 How to Play

### Objective

Maintain high uptime (>99.9%) while growing your user base and staying profitable.

### Controls

- **Pause/Play**: Pause the simulation
- **Speed**: 1x, 2x, or 4x simulation speed
- **Quick Actions (1-12)**: Use number keys for quick access to common actions (including cost-saving actions)
- **Save/Load**: Manual save/load of game state
- **New Run**: Start fresh with a new seed
- **Music Player**: Toggle background music, change tracks, adjust volume (🎵 button in top bar)

### Key Metrics

- **Uptime**: Rolling 5-minute uptime percentage (goal: 99.99%)
- **Users**: Active user count (grows with good service, churns with bad)
- **RPS**: Requests per second (varies by time of day/week)
- **Cash**: Your runway (don't go bankrupt!)
- **Reputation**: 0-100 score affecting growth (drops with outages)
- **Tech Debt**: Accumulated from quick fixes (increases incident rates)
- **Alert Fatigue**: From too many incidents (slows response time)

### Strategy Tips

1. **Start Small**: Don't over-scale early. Balance capacity vs. cost.
2. **Monitor Utilization**: Scale before nodes hit 80% utilization.
3. **Enable Reliability Patterns**: Circuit breakers, autoscaling, rate limiting.
4. **Respond to Incidents**: Click incidents to see resolution options (auto-switches to Incident tab).
5. **Invest in Observability**: Upgrade from Logs → Metrics → Traces to reduce MTTR.
6. **Fundraise Wisely**: Angel/Seed/Series A unlocked by user milestones.
7. **Watch Tech Debt**: Avoid quick fixes that increase long-term incidents.
8. **Plan for Growth**: Enable canary deploys, add read replicas, scale horizontally.
9. **Reduce Costs**: Scale down services, disable cache/observability during low traffic to save cash.
10. **Profit Optimization**: Monitor profit/min (revenue - costs). Reduce costs when profitable to maximize runway.

## 🏗️ Architecture Components

### Edge Layer
- **DNS**: Entry point, handles domain resolution
- **CDN**: Content delivery, caches static assets
- **WAF**: Web Application Firewall, blocks attacks

### Load Balancing
- **Global LB**: Routes across regions
- **Regional LB**: Routes to API gateways

### Application Layer
- **API Gateway**: Request routing, rate limiting
- **App Cluster**: Core application logic (scalable)
- **Service Mesh**: Advanced traffic management (unlockable)

### Data Layer
- **Cache (Redis)**: Fast data access
- **Database Primary**: Main data store
- **Database Replica**: Read scaling (scalable)
- **Object Storage**: File storage
- **Message Queue**: Async job queue
- **Workers**: Process async jobs (scalable)

### Observability
- **Observability Stack**: Logs/Metrics/Traces (upgradeable)

## 💰 Cost Reduction Actions

Save money when you're over-provisioned or during low-traffic periods:

- **Scale Down Services**: Remove APP instances (-1), Workers (-2), CDN capacity
- **Disable Cache**: Turn off Redis to save costs (increases DB load - use carefully!)
- **Downgrade Observability**: Reduce monitoring to save money (increases MTTR)
- **Disable Bot Protection**: Turn off WAF bot detection (security risk!)
- **Reduce DB Connections**: Lower max connections to save resources

💡 **Pro Tip**: Use cost reduction during night hours (low traffic) to maximize profit!

## 🚨 Incident Categories

- **Traffic**: Viral spikes, bot surges, scrapers
- **Security**: DDoS, credential leaks, vulnerability disclosures
- **Deploy/Config**: Bad deploys, config drift, rate limit misconfigs
- **DNS/Cert**: DNS issues, TLS certificate problems
- **Compute/Infra**: Memory leaks, CPU thrashing, disk full, node reboots
- **Database**: Connection exhaustion, slow queries, replica lag, deadlocks
- **Queue/Workers**: Queue backlogs, poison messages, crash loops
- **External**: Third-party API issues, cloud region outages
- **Observability**: Log pipeline failures, metrics lag, alert fatigue

## 🎮 Game Over Conditions

- Cash drops below -$1000 (bankruptcy)
- Reputation reaches 0 (trust destroyed)
- Multiple critical outages (system collapse)

## 🏆 Milestones

- **10k Users**: Unlock canary deployments
- **50k Users**: Unlock database replicas and connection pooler
- **100k Users**: Unlock multi-region expansion
- **20min Uptime Streak**: Unlock advanced observability

## 🛠️ Technical Stack

- **Frontend**: React 18 + TypeScript
- **Build Tool**: Vite
- **Rendering**: SVG for architecture map
- **Storage**: localStorage for saves
- **Simulation**: Tick-based engine (100ms ticks, 1s default sim dt)

## 📊 Architecture

```
/src
  /sim
    types.ts          - Core type definitions
    engine.ts         - Simulation engine with load propagation
    reducer.ts        - Game state reducer and action handlers
    rng.ts            - Seedable random number generator
    formulas.ts       - Game formulas and calculations
  /data
    architecture.ts   - 15-component architecture definition
    actions.ts        - 40+ player action definitions
    incidents.ts      - 50+ incident templates
  /ui
    App.tsx           - Main app component
    HudBar.tsx        - Top metrics bar
    IncidentFeed.tsx  - Left sidebar incident list
    ArchMap.tsx       - SVG architecture visualization
    DetailPanel.tsx   - Right sidebar with node/incident details
    ActionBar.tsx     - Bottom quick action bar
    GameOverModal.tsx - Game over and run summary
  /styles
    theme.css         - Dark theme with neon accents
  /utils
    saveLoad.ts       - localStorage persistence
```

## 🎨 Visual Style

Modern "terminal-ish" dashboard with:
- Dark background (#0a0a0f, #1a1a2e)
- Neon accent colors (cyan #00ffaa, pink #ff3366)
- Monospace fonts for metrics
- Clean cards and bars (not pure ASCII)
- Subtle glow effects on critical alerts
- Smooth transitions and animations

## 🔧 Development

### Adding New Incidents

Edit `/src/data/incidents.ts` and add to the `INCIDENTS` array:

```typescript
{
  id: 'my_incident',
  name: 'My Incident',
  description: 'What happens',
  category: 'COMPUTE',
  severity: 'WARN',
  targetTypes: ['APP'],
  preconditions: {},
  baseRatePerMinute: 0.05,
  effects: {
    latencyMultiplier: 1.5,
  },
  resolutionOptions: ['scale_app_1'],
  autoResolveSeconds: 180,
}
```

### Adding New Actions

Edit `/src/data/actions.ts` and add to the `ACTIONS` array:

```typescript
{
  id: 'my_action',
  name: 'My Action',
  description: 'What it does',
  category: 'Compute',
  target: 'app',
  oneTimeCost: 100,
  recurringCostDelta: 0,
  durationSeconds: 30,
  successChance: 0.95,
  cooldownSeconds: 60,
  effects: {
    statChanges: { capacity: 1000 },
  },
}
```

## 📝 License

MIT - Build upon it, mod it, share it!

## 🎮 Have Fun!

Remember: In production, there are no save points. But here, you have autosave. 😉

**Good luck maintaining your uptime!** ⚡

