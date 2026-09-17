# ⚡ UPTIME 99.99

A browser-based DevOps/SRE simulation game. You manage a production architecture, respond to real infrastructure incidents, and grow your user base — all against a ticking clock and an unforgiving uptime SLA.

## 🚀 Quick Start

```bash
npm install
npm run dev        # → http://localhost:5173
```

An OpenAI API key is **optional**. Without one, incidents use template text. With one, incident names/descriptions are rewritten by AI for variety.

To enable AI prose: create `.env` and add `VITE_OPENAI_API_KEY=sk-...`, then restart the dev server.

```bash
npm run build      # production build
npm test           # 45 unit + integration tests
npm run verify     # 5 balance checkpoint proofs
```

---

## 🎮 How to Play

### Goal
Maximize uptime and profit while scaling your user base from 200 to tens of thousands. Handle incidents fast, deploy infrastructure wisely, and keep costs under control.

### Controls
- **Click incidents** (left panel) to view details and suggested fixes
- **Click architecture nodes** (centre) to see metrics and component actions
- **Quick Actions bar** (bottom) for instant access to common actions
- **Pause/Speed** (top bar) — 1×, 2×, 4×

### Key Metrics (HUD)
| Metric | What it means |
|---|---|
| **Uptime** | 5-minute rolling average — goal is >99.9% |
| **Users** | Active user count — grows with good service, churns with bad |
| **Cash** | Your runway — go below –$5,000 and it's game over |
| **Profit/min** | Revenue minus costs per minute — aim for positive |
| **Reputation** | 0–100 score — affects growth, revenue, and game-over |
| **API spend** | OpenAI tokens consumed this session |

---

## 🏗️ Architecture & Progression

Runs start with just **DNS → App → DB**. You grow by deploying components:

### Phase 2 (300–800 users, ~$1000–$2500 each)
| Component | Effect |
|---|---|
| **Redis Cache** ($1,500) | Reduces DB load by ~75%; dramatically improves response times |
| **CDN** ($2,000) | Absorbs static asset traffic; reduces app load |
| **Message Queue** ($1,200) | Offloads async work from request path |
| **Workers** ($1,000) | Drains the queue; requires Queue deployed first |
| **DB Replica** ($2,500) | Read scaling + high-availability for database |

### Phase 3 (1,500–3,000 users, ~$2500–$4000 each)
| Component | Effect |
|---|---|
| **WAF** ($3,000) | Blocks attacks; prerequisite: CDN |
| **Regional LB** ($2,500) | Distributes traffic across app instances |
| **Global LB** ($4,000) | Multi-region routing; prerequisite: WAF |
| **API Gateway** ($3,500) | Rate limiting, routing; prerequisite: RLB |
| **Object Storage** ($1,500) | File/backup storage |

### Phase 4 (5,000+ users)
| Component | Effect |
|---|---|
| **Observability** ($3,000) | Metrics/logs/traces stack |
| **Service Mesh** ($8,000) | Advanced traffic management; prerequisite: API GW + Observability |

**The economy:** Deploying infrastructure costs money and raises ongoing costs, but reduces incident pressure and improves capacity — so you can serve more users and earn more revenue. Break-even is around 3,500 users.

---

## 🚨 Incident System

Incidents fire *because of* your system state. High utilization = more COMPUTE/DATABASE incidents. Low cache hit rate = more cache incidents. Incidents you ignore eventually spread to neighbouring components.

### Severity
- **INFO** — minor degradation, low urgency
- **WARN** — moderate problem, act within minutes
- **CRIT** — serious; health decays, uptime falls, reputation drops fast

### Resolving Incidents
1. **Click the incident** in the feed (left panel)
2. **View suggested fixes** — each action has a cost, duration, and effectiveness
3. **Click a fix** — it starts running (30% mitigation applied immediately)
4. Once complete, mitigation reaches 100% and the incident resolves

**Reward for fixing:** +3 reputation. **Ignoring until auto-resolve (300s):** +0. Fixing is always better.

### Escalation & Spread
Leave a WARN unmitigated for ~60 seconds and it escalates to CRIT. Leave a CRIT unmitigated for ~45 seconds and it spreads to adjacent node types.

---

## 💰 Economy

### Revenue
`revenue = users × pricing / 86400 × (reputation/100) × uptime²`

At starting values (200 users, rep 80, uptime 1.0): ~$0.046/s. Infrastructure costs ~$0.81/s. You're cash-flow negative until ~3,500 users (~minute 8–10 at normal play).

### Cost Optimization
Quick Actions include cost-saving actions that reduce `recurringCostDelta` (effectively cheaper operation after completion):
- **Scale Down App/Workers** — save on compute
- **Optimize DB Queries** — reduce DB load
- **Compress Assets** — bandwidth savings

### Growth Model
Users grow exponentially via:
```
userDelta = (growthRate - churnRate) × users × dampener × dt
```
- `growthRate` multiplied 2–2.5× when reputation > 70
- `churnRate` spikes during downtime
- Growth dampens at large user counts (prevents infinite exponential)

---

## 🏆 Achievements & Engagement

### Stakeholder Messages
CEO, CTO, VP Sales, Enterprise Customer, and Junior SRE send messages based on your performance. Respond within 30 seconds or lose reputation. Responses have real effects (reputation, burnout, cash).

### Pager Alerts
Any CRIT incident triggers a full-screen pager. Acknowledge within 30 seconds or: –5 reputation, +5 burnout.

### War Room
3+ concurrent CRITs activate War Room mode. Survive it (resolve down to < 3 CRITs) for a +5 reputation bonus.

### Post-Mortems
After every 3rd resolved CRIT, a post-mortem appears with action items. Completing it improves processes.

### Achievements
14 unlockable achievements across 5 rarities, checked every 500ms. Shown as 4.5-second toast notifications.

---

## 🎵 Background Music

Place `.mp3` files in `public/music/` and click 🔇 in the HUD to toggle. The player loops through all detected tracks.

---

## 🛠️ Technical Stack

- **Frontend:** React 18 + TypeScript + Vite 5
- **Simulation:** 100 ms tick-based engine, `useReducer` state, deep-clone safety
- **Tests:** Vitest 2 — 45 tests including 5 balance checkpoints that prove the economy, load model, and incident pressure behave correctly
- **AI (optional):** OpenAI `gpt-4.1` via `fetch` for incident prose flavouring
- **Rendering:** SVG architecture map (zoomable, draggable)
- **No backend, no persistence** — all state is in-browser

---

## 🎯 Strategy Tips

1. **Deploy Cache first** — it's the single biggest DB relief at 300+ users
2. **Don't over-scale costs early** — break-even takes ~10 minutes; stay cash-positive
3. **Fix CRITs immediately** — they spread and stack; 3 simultaneous CRITs triggers system collapse
4. **Watch the action bar** — many actions only appear once you deploy the component they target
5. **Reputation is king** — above 70 you get 2.5× growth multiplier; below 30 growth stalls
6. **Respond to stakeholders** — ignoring their messages costs 2 reputation each

---

## 📊 Codebase Overview

```
/src
  /sim           # Pure simulation engine (testable headless — no window/network)
    engine.ts      # 12-phase tick + deployment completion
    types.ts       # All types (GameState, ComponentNode, ActiveIncident, …)
    reducer.ts     # Action handlers; PATCH action for safe partial writes
    incidentSpawner.ts  # Template-driven incident spawning
    incidentActions.ts  # Resolves template resolutionOptions → ActionDefinition[]
    formulas.ts    # Revenue, growth, latency, error rate formulas
    clampMetrics.ts    # Metric bounds (explicit set dispatch, not substrings)
    componentMetrics.ts  # Per-type metric interfaces + METRIC_BASELINES
    componentInitializer.ts  # Default metric values per ComponentType

  /data           # Declarative game content
    incidents.ts   # 65 incident templates (the live incident engine)
    actions.ts     # 93 actions (inline + costSaving + dynamic)
    architecture.ts  # All 15 node definitions + deployComponent()
    achievements.ts  # 14 achievement definitions
    stakeholders.ts  # 5 stakeholder personas + response effects

  /config         # Single source of truth
    gameConfig.ts    # All balance constants (traffic, costs, rewards, timers, …)
    progressionConfig.ts  # 12 blueprint definitions + blueprintStatus()

  /services       # External I/O
    openai.ts        # Shared chatJSON() + parseJSON() — used by both callers
    incidentFlavour.ts  # shouldFlavour() + flavourIncident()
    aiGameMaster.ts  # AIGameMaster singleton (now prose-only; doesn't spawn incidents)
    taskGenerator.ts  # Interactive task generation

  /ui             # React components (read-only over game state)
    App.tsx           # 100ms tick, AI flavour wiring, subsystem loop delegation
    ArchMap.tsx       # SVG architecture visualization
    DetailPanel.tsx   # Node/incident details + resolution options
    ActionBar.tsx     # Quick-access action buttons
    /tasks/           # 9 interactive task component types

  /hooks
    useResizable.ts       # Panel drag-resize
    useGameSubsystems.ts  # 500ms loop: pager, war room, stakeholders, achievements

/tests
  harness.ts             # Headless runSim() with fake timers
  policies.ts            # Scripted player behaviours (deployWhenAffordable)
  checkpoint-*.test.ts   # Balance proofs (run with: npm run verify)
  *.test.ts              # Unit tests per system
```

---

## Game Over Conditions

1. **Bankruptcy** — cash drops below –$5,000
2. **Reputation destroyed** — reputation stays at 0 for 300 simulated seconds (~30 real seconds at 1×)
3. **System collapse** — 3+ active CRITs AND rolling uptime < 0.5 simultaneously

---

## Development Notes

See `CLAUDE.md` for the complete technical reference including all engine internals, state-writing rules, and known deferred items.
