# ⚡ UPTIME 99.99

A browser-based DevOps/SRE simulation game where you maintain a production system under chaos. Features **AI-powered incident generation**, **dynamic architecture**, and **realistic infrastructure simulation**.

## 🎮 Game Overview

You're an on-call DevOps engineer managing a production architecture. Your goal: maximize uptime and profit while scaling users and handling incidents. The game uses **OpenAI GPT-4** to generate contextual, realistic incidents based on your actual system metrics.

### Core Features

- **🤖 AI-Powered Incidents**: GPT-4 generates realistic incidents based on your system's actual metrics
- **🏗️ Dynamic Architecture**: Add/remove components dynamically (app instances, DB replicas, workers, microservices)
- **📊 Component Metrics**: Each component has detailed metrics (cache hit rate, DB connections, queue backlog, etc.)
- **💰 Cost Optimization**: Scale down, optimize, and save money to maximize profit
- **📈 Positive Feedback Loops**: Resolving incidents boosts reputation, user growth, and revenue
- **🎯 70+ Actions**: Scale infrastructure, optimize performance, save costs, split services
- **🔗 Redundancy Groups**: Load balancing and failover across component instances
- **📱 Responsive UI**: Resizable panels, zoomable/draggable architecture map
- **🎵 Background Music**: Play your own music tracks
- **💾 Autosave**: Saves every 30 seconds to localStorage

## 🚀 Quick Start

### Prerequisites

- Node.js 18+ and npm
- OpenAI API key (for AI-powered incidents)

### Setup

```bash
# Install dependencies
npm install

# Create .env file in project root
echo "VITE_OPENAI_API_KEY=sk-your-key-here" > .env

# Run development server
npm run dev

# Build for production
npm run build
```

Open your browser to the URL shown (usually `http://localhost:5173`)

### 🎵 Adding Background Music (Optional)

1. Place `.mp3` files in `public/music/` folder
2. The game will automatically detect and play them
3. Click the 🎵 button in-game to control music

## 🎯 How to Play

### Objective

Maintain high uptime (>99.9%) while growing your user base and staying profitable. Resolve incidents quickly to build reputation and grow your business.

### Controls

- **Pause/Play**: Pause the simulation
- **Quick Actions (1-20)**: Use number keys for quick access to actions
- **Click Incidents**: View details and suggested actions
- **Click Nodes**: View component metrics and status
- **Save/Load**: Manual save/load of game state
- **New Run**: Start fresh with a new seed
- **Music Player**: Toggle background music (🎵 button)

### Key Metrics

- **Uptime**: Rolling 5-minute uptime percentage (goal: 99.99%)
- **Users**: Active user count (grows with good service, churns with bad)
- **RPS**: Requests per second (varies by time of day/week)
- **Cash**: Your runway (revenue - costs)
- **Profit/Min**: Revenue per minute minus costs (goal: positive!)
- **Reputation**: 0-100 score affecting growth and revenue multiplier
- **Tech Debt**: Accumulated from quick fixes (increases incident rates)

### Strategy Tips

1. **Resolve Incidents Quickly**: Each resolution boosts reputation, user growth, and revenue
2. **Optimize Before Scaling**: Use "Optimize DB Queries", "Optimize Cache TTL" to improve efficiency
3. **Scale Down When Possible**: Use "Scale Down App/Workers" to save costs
4. **Monitor Profit/Min**: When positive, you're making money! When negative, optimize costs
5. **Build Redundancy**: Add app instances, DB replicas for high availability
6. **Watch Component Metrics**: Cache hit rate, DB connections, queue backlog - optimize bottlenecks
7. **Use Cost-Saving Actions**: Consolidate instances, compress assets, optimize queries
8. **Increase Pricing**: When reputation > 80, raise prices for more revenue
9. **Marketing Campaigns**: Boost user growth when you have cash
10. **Maintain Clean Slate**: 0 active incidents = strong reputation recovery

## 🏗️ Architecture System

### Dynamic Architecture

The architecture is **fully dynamic** - you can add/remove components at runtime:

- **Add App Instances**: Scale horizontally for more capacity
- **Add DB Replicas**: Read scaling and high availability
- **Add Worker Instances**: Process more background jobs
- **Split Services**: Break monolith into microservices (auth, payment, notification)
- **Add Infrastructure**: Message bus, search service, reverse proxy, connection pooler
- **Remove Components**: Scale down to save costs

### Component Types

#### Edge Layer
- **DNS**: Entry point, handles domain resolution
- **CDN**: Content delivery, caches static assets
- **WAF**: Web Application Firewall, blocks attacks

#### Load Balancing
- **Global LB**: Routes across regions
- **Regional LB**: Routes to API gateways

#### Application Layer
- **API Gateway**: Request routing, rate limiting
- **App Cluster**: Core application logic (scalable, supports redundancy)
- **Service Mesh**: Advanced traffic management (unlockable)

#### Data Layer
- **Cache (Redis)**: Fast data access (hit rate, eviction rate metrics)
- **Database Primary**: Main data store (connections, query latency metrics)
- **Database Replica**: Read scaling (scalable, supports redundancy)
- **Object Storage**: File storage
- **Message Queue**: Async job queue (messages queued, queue depth metrics)
- **Workers**: Process async jobs (scalable, queue backlog, jobs/sec metrics)

#### Observability
- **Observability Stack**: Logs/Metrics/Traces (upgradeable)

### Component Metrics

Each component has **detailed metrics** that affect gameplay:

- **Cache**: Hit rate, eviction rate, keys stored, size GB
- **Database**: Connections, max connections, query latency, slow queries %
- **Workers**: Queue backlog, jobs/sec, failed jobs %, avg job duration
- **App**: CPU %, Memory %, requests/sec, active connections
- **Queue**: Messages queued, max queue depth, enqueued/dequeued per sec

These metrics are:
- **Displayed** on the architecture map
- **Sent to AI** for contextual incident generation
- **Updated** by incidents and actions
- **Visualized** with color-coded indicators

## 🤖 AI-Powered Incidents

The game uses **OpenAI GPT-4** to generate realistic incidents based on your actual system state:

1. **AI Analyzes Metrics**: Reads all component metrics, health, utilization
2. **Contextual Incidents**: Generates incidents that make sense for your architecture
3. **Suggested Actions**: AI provides action recommendations with costs and durations
4. **Dynamic Adaptation**: AI learns from your actions and adjusts future incidents

### How It Works

- AI receives complete system state (all component metrics)
- Generates incidents targeting specific components
- Provides metric effects (e.g., "hitRate: -0.2, evictionRate: +50")
- Suggests actions with metric improvements
- Adapts based on your resolution history

## 💰 Economy & Positive Feedback

### Revenue Sources

- **User Subscriptions**: Revenue = users × pricing × reputation factor × uptime factor
- **Reputation Multiplier**: Higher reputation = more revenue per user
- **Uptime Factor**: Better uptime = more revenue

### Cost Optimization Actions

**Scale Down** (Save Money):
- ⬇️ Scale Down App -1: Save $0.15/sec ($9/min)
- ⬇️ Scale Down Workers -1: Save $0.12/sec ($7.2/min)
- 🔧 Consolidate Instances: Save $0.25/sec ($15/min)

**Optimize** (Improve Efficiency):
- 🚀 Optimize DB Queries: Reduce DB load, can scale down later
- 📦 Compress Assets: Save bandwidth costs
- ⏱️ Optimize Cache TTL: Better hit rate = less DB load
- 🧹 Code Cleanup: Reduce tech debt
- 🔍 Performance Audit: Reduce latency

**Revenue Boosters**:
- 💰 Increase Pricing +10%: More revenue per user (when reputation high)
- 📣 Marketing Campaign: Grow user base faster

### Positive Feedback Loops

**Resolving Incidents** → Multiple Benefits:
- ✅ **Reputation Boost**: +2 to +5 reputation per incident
- ✅ **User Growth**: +20% to +30% growth rate
- ✅ **Revenue Boost**: +10% to +15% revenue multiplier
- ✅ **Continuous Recovery**: +0.3 to +0.5 reputation/sec when clean

**The Loop**:
```
Resolve Incident
    ↓
Reputation +2 to +5
    ↓
User Growth +20% to +30%
    ↓
Revenue +10% to +15%
    ↓
Cash Increases
    ↓
Can Afford Optimizations
    ↓
Better Performance
    ↓
Fewer Incidents
    ↓
More Users Join
    ↓
Even More Revenue!
```

## 🚨 Incident System

### Incident Categories

- **TRAFFIC**: Traffic spikes, bot surges, scrapers
- **SECURITY**: DDoS, credential leaks, vulnerabilities
- **DEPLOY**: Bad deploys, config drift, misconfigs
- **DNS**: DNS issues, certificate problems
- **COMPUTE**: Memory leaks, CPU thrashing, disk full
- **DATABASE**: Connection exhaustion, slow queries, replica lag
- **CACHE**: Cache thrashing, hit rate drops, eviction storms
- **QUEUE**: Queue backlogs, poison messages, crash loops
- **WORKERS**: Worker starvation, stuck jobs, zombie processes
- **EXTERNAL**: Third-party API issues, cloud outages
- **OPTIMIZATION**: Profit opportunities (no negative effects!)

### Incident Resolution

1. **Click Incident**: View details, logs, and suggested actions
2. **Choose Action**: Use suggested action or any available action
3. **Wait for Completion**: Progress bar shows real-time progress
4. **Get Rewarded**: Reputation boost, user growth, revenue increase!

## 🎮 Game Over Conditions

- Cash drops below -$1000 (bankruptcy)
- Reputation reaches 0 (trust destroyed)
- Multiple critical outages (system collapse)

## 🏆 Milestones & Achievements

- **Resolve 5 Incidents**: Notice user growth accelerating
- **Resolve 10 Incidents**: See revenue boost kick in
- **Clean Slate (0 incidents)**: Strong reputation recovery
- **High Resolution Rate**: Users trust you → Growth multiplier
- **Positive Profit/Min**: You're making money! 🎉
- **10k Users**: Unlock canary deployments
- **50k Users**: Unlock database replicas
- **100k Users**: Unlock multi-region expansion
- **20min Uptime Streak**: Unlock advanced observability

## 🛠️ Technical Stack

- **Frontend**: React 18 + TypeScript
- **Build Tool**: Vite
- **AI**: OpenAI GPT-4 (via @ai-sdk/openai)
- **Rendering**: SVG for architecture map (zoomable, draggable)
- **Storage**: localStorage for saves
- **Simulation**: Tick-based engine (100ms ticks)
- **State Management**: React useReducer with deep cloning

## 📊 Codebase Architecture

```
/src
  /sim                    # Core simulation engine
    types.ts              # Type definitions (GameState, ComponentNode, etc.)
    engine.ts             # Simulation tick engine (load propagation, business logic)
    reducer.ts            # State reducer (action handlers, deep state cloning)
    rng.ts                # Seedable random number generator
    formulas.ts           # Game formulas (revenue, growth, reputation)
    componentMetrics.ts   # Component-specific metrics definitions
    componentInitializer.ts # Initialize components with proper metrics
    clampMetrics.ts       # Metric bounds validation
  
  /data                   # Game data definitions
    architecture.ts       # Initial architecture setup
    actions.ts            # All action definitions (70+ actions)
    dynamicActions.ts    # Dynamic architecture operations (add/remove components)
    costSavingActions.ts # Cost optimization and revenue boosting actions
    incidents.ts          # Legacy incident templates (AI mode uses AI instead)
  
  /services               # External services
    aiGameMaster.ts       # OpenAI GPT-4 integration for incident generation
    taskGenerator.ts     # Task generation system
  
  /ui                     # React components
    App.tsx               # Main app component (game loop, state management)
    HudBar.tsx            # Top metrics bar
    IncidentFeed.tsx      # Left sidebar incident list
    ArchMap.tsx           # SVG architecture visualization (zoomable, draggable)
    DetailPanel.tsx       # Right sidebar (node/incident details)
    ActionBar.tsx         # Bottom quick action bar
    ActivityLog.tsx       # Action progress log
    GameOverModal.tsx    # Game over and run summary
    MusicPlayer.tsx       # Background music controls
    LoadingScreen.tsx     # Loading screen
    LogsModal.tsx         # Logs viewer
    TaskModal.tsx         # Interactive task system
  
  /utils                  # Utility functions
    saveLoad.ts           # localStorage persistence
    musicPlayer.ts        # Background music management
    soundNotifications.ts # Sound effects
    terminalLog.ts        # Terminal-style logging
    stateUtils.ts         # State cloning and validation
    stateSync.ts          # State synchronization utilities
  
  /config
    gameConfig.ts         # Game configuration constants
  
  /hooks
    useResizable.ts       # Resizable panel hook
```

## 🏗️ System Architecture (Game Design)

### Single Source of Truth

The game uses a **single source of truth** architecture:

```
ComponentNode (Data Layer)
    ↓
state.architecture.nodes (Map)
    ↓
ArchMap.tsx (View Layer - Read Only)
    ↓
AI Game Master (Reads Metrics)
```

- **ComponentNode** contains all data: metrics, health, status
- **ArchMap** is pure visualization (reads, never modifies)
- **AI** reads metrics to generate incidents
- **Actions** update ComponentNode metrics
- **Everything flows from one source**: `state.architecture.nodes`

### Data Flow

```
1. User Action / Quick Action
   ↓
   executeAction() in reducer.ts
   ↓
   Updates component metrics (via effects)
   ↓
   Architecture Map reflects changes immediately
   ↓
   Component metrics updated → sent to AI in next tick

2. AI Incident Generation
   ↓
   generateIncident() in aiGameMaster.ts
   ↓
   Receives: serializeGameState() with all component metrics
   ↓
   AI analyzes metrics and generates:
   • Incident targeting specific component
   • Effects on component metrics (metricEffects)
   • Suggested actions with metricImprovements
   ↓
   Incident added to state.activeIncidents

3. Incident Effects
   ↓
   applyIncidentEffects() in engine.ts (every tick)
   ↓
   • Updates component.specificMetrics based on metricEffects
   • Updates component.health, utilization, latency, errorRate
   • Updates component.operationalMode (normal/degraded/down)
   ↓
   Architecture Map reflects degradation:
   • Health bars turn red/yellow
   • Component-specific metrics show problems
   • Visual indicators (glow, status)

4. User Mitigates Incident
   ↓
   User clicks suggested action or quick action
   ↓
   executeAction() / executeAIAction()
   ↓
   • Applies metricImprovements to component metrics
   • Updates component.specificMetrics
   • Updates component.health, utilization, etc.
   ↓
   Architecture Map reflects improvement:
   • Health bars improve
   • Metrics return to normal
   • Visual indicators clear

5. Incident Resolved
   ↓
   updateIncidents() in engine.ts
   ↓
   • Reputation boost (+2 to +5)
   • User growth boost (+20% to +30%)
   • Revenue boost (+10% to +15%)
   ↓
   Back to step 1 (loop continues)
```

### State Management

- **Deep Cloning**: All state updates use deep cloning to prevent mutations
- **Immutable Updates**: Maps, Sets, and nested objects are properly cloned
- **Race Condition Prevention**: State sync manager prevents concurrent updates
- **Validation**: State validation ensures data integrity

## 🎨 Visual Features

### Architecture Map

- **Zoomable**: Mouse wheel to zoom in/out
- **Draggable**: Click and drag to pan
- **Component Metrics**: Real-time display of health, utilization, component-specific metrics
- **Visual Indicators**:
  - Health bars (green/yellow/red)
  - Utilization bars
  - Instance badges (#1, #2, etc.)
  - Primary indicators (⭐)
  - Scaling indicators (×2, ×3, etc.)
  - Incident glow effects
- **Component-Specific Metrics**: Cache hit rate, DB connections, queue backlog, etc.

### UI Features

- **Resizable Panels**: Drag to resize left/right panels and bottom panel
- **Responsive Layout**: Adapts to window size
- **Dark Theme**: Terminal-inspired with neon accents
- **Smooth Animations**: Transitions and state changes
- **Real-Time Updates**: All metrics update in real-time

## 🔧 Development

### Adding New Actions

Edit `/src/data/actions.ts` or create new action files:

```typescript
{
  id: 'my_action',
  name: 'My Action',
  description: 'What it does',
  category: 'OPTIMIZATION',
  target: 'app',
  oneTimeCost: 100,
  recurringCostDelta: -0.05, // Negative = saves money
  durationSeconds: 30,
  successChance: 1.0,
  cooldownSeconds: 60,
  effects: {
    statChanges: { capacity: 1000 },
    metricImprovements: { hitRate: 0.1 }, // For component metrics
  },
}
```

### Adding Dynamic Components

Edit `/src/data/dynamicActions.ts`:

```typescript
{
  id: 'add_my_component',
  name: 'Add My Component',
  description: 'Adds a new component instance',
  category: 'INFRASTRUCTURE',
  target: 'app',
  oneTimeCost: 500,
  recurringCostDelta: 0.2,
  durationSeconds: 60,
  successChance: 1.0,
  cooldownSeconds: 120,
  effects: {
    addComponent: {
      type: 'APP',
      baseNodeId: 'app',
      redundancyGroup: 'app_cluster',
      isPrimary: false,
      connections: [
        { from: 'apigw', to: 'target', weight: 0.5 },
      ],
    },
  },
}
```

### Component Metrics

Add new metrics in `/src/sim/componentMetrics.ts`:

```typescript
export interface MyComponentMetrics {
  myMetric: number;
  anotherMetric: number;
}
```

Then initialize in `/src/sim/componentInitializer.ts`:

```typescript
case 'MY_COMPONENT':
  return {
    myMetric: 0,
    anotherMetric: 100,
  } as MyComponentMetrics;
```

### AI Incident Generation

The AI automatically generates incidents based on component metrics. To customize:

1. Edit `/src/services/aiGameMaster.ts`
2. Modify the system prompt in `buildSystemPrompt()`
3. Adjust incident generation frequency in `App.tsx`

## 🐛 Known Issues & Limitations

- AI API calls require internet connection
- Large state objects may impact performance (mitigated with deep cloning)
- Some edge cases in component removal validation

## 📝 License

MIT - Build upon it, mod it, share it!

## 🎮 Have Fun!

Remember: In production, there are no save points. But here, you have autosave. 😉

**Good luck maintaining your uptime!** ⚡

---

## 🙏 Acknowledgments

- Built with React, TypeScript, and Vite
- AI-powered by OpenAI GPT-4
- Inspired by real DevOps/SRE challenges
