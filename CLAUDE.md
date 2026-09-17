# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

**This file is authoritative over `README.md`.** The README is a player-facing document; where they conflict, trust this file and the code.

---

## What this is

**UPTIME 99.99** — a browser-only DevOps/SRE incident-response game. React 18 + TypeScript + Vite, no backend, no persistence. A 100 ms tick engine simulates a production architecture; incidents are spawned from 65 templates keyed to live system state; the AI rewrites incident prose for novelty. A run is capped at 30 minutes.

~13.5k LOC in `src/`, 19 test files, 45 tests, `npm test` is fully green.

---

## Commands

```bash
npm install
npm run dev          # Vite dev server → http://localhost:5173
npm run build        # tsc && vite build  (the only correctness gate)
npm run preview      # serve production build
npm test             # Vitest unit + integration tests
npm run verify       # all 5 checkpoint tests (balance proofs)
npx tsc --noEmit     # typecheck only
```

**No ESLint, no CI, no formatter.** `npm run build` is the verification story — `strict + noUnusedLocals + noUnusedParameters` makes unused imports a build error. Run it before declaring work done.

### Required environment (`.env`, gitignored)

```
VITE_OPENAI_API_KEY=sk-...   # OPTIONAL since the overhaul — game runs without it
VITE_LOG_LEVEL=DEBUG          # optional — enables tlog.debug() output
```

The key is for AI prose flavouring only (rewrites incident names/description/logs for novelty on WARN/CRIT incidents). Without it the game is fully playable using template incident text. Vite reads `.env` only at startup: **restart the dev server after changing it**.

### Browser → terminal logging

`vite-plugin-terminal-logger.ts` adds a `/api/log` dev endpoint. `src/utils/terminalLog.ts` (`tlog.info/warn/error/success/debug`) POSTs to it. **This is the primary way to observe the running sim** — incident names, metric deltas, and errors all appear here. Prefer `tlog` over `console.*`; nothing in `src/sim` or `src/services` uses `console`.

---

## Architecture

Layering: `sim/` ← `data/` + `config/` (declarative) ← `services/` (I/O) ← `ui/` (view). `ArchMap` is genuinely read-only over `state.architecture.nodes`. One class in the codebase (`AIGameMaster`), depth 1.

### The game loop

`src/App.tsx` owns two intervals:

- **100 ms sim tick** — calls `tickSimulation(stateRef.current, rng, dt)` from `src/sim/engine.ts`, then `dispatch({ type: 'LOAD_GAME', state: newState })`. Also prose-flavours newly spawned incidents async.
- **500 ms "enhancement" loop** — moved into `src/hooks/useGameSubsystems.ts`: pager, war room, status-page accuracy, stakeholders, scaling hints, post-mortems, achievements.

Both loops gate on `!state.paused && !state.gameOver` (NOT on `aiSessionActive` — removed during overhaul; game starts immediately).

The reducer's `TICK` case is a deliberate no-op. The `rng` parameter in `tickSimulation` is now **actively used** by `spawnFromTemplates`.

### State-writing rules

1. **`PATCH` with an updater for partial writes — never `LOAD_GAME`:**
   ```ts
   dispatch({ type: 'PATCH', fn: s => ({ reputation: Math.max(0, s.reputation - 5) }) });
   ```
   `LOAD_GAME` returns `action.state` verbatim; batched dispatches in the same callback clobber each other. `PATCH` merges via `{ ...state, ...action.fn(state) }`. `LOAD_GAME` is now only used for the per-tick commit (one dispatch, no siblings) and new-game.

2. **Inside intervals/async callbacks, read `stateRef.current`, not the `state` closure.**

3. **`cloneGameState()` is hand-maintained.** It enumerates every `Map`, `Set`, array, and nested object. When you add a non-primitive field to `GameState`, add it there too (`src/utils/stateUtils.ts`). `tokenUsage` and all other nested objects are explicitly cloned.

4. Engine helpers mutate the already-cloned `newState` (they don't return new objects). Intentional; follow the pattern.

---

## The 12-phase tick pipeline (`src/sim/engine.ts`)

Phases run in fixed order inside `tickSimulation`. `elapsedSim += dt` happens first.

| Phase | Function | What it does |
|---|---|---|
| 1 | traffic | `baseRPS = users × activityRate × GAME_CONFIG.traffic.rpsPerActiveUser` |
| 2 | `propagateLoad` | BFS from dns; sets `utilization`/`latency`/`errorRate` per node |
| 3 | `applyIncidentEffects` | Applies multipliers from active incidents; decays health; handles escalation + spread. Iterates a **snapshot** `[...state.activeIncidents]` so newly spawned escalation/spread incidents don't take damage in the same tick. |
| 4 | `computeGlobalMetrics` | `globalErrorRate`, `globalLatencyP95` (unweighted mean over enabled nodes) |
| 5 | `updateUptime` | Maintains a 300-second rolling `uptimeWindow` (3000 samples at 0.1s/tick) |
| 6 | `updateBusiness` | Revenue, costs (node sum + `recurringCostAdjustment`), growth, churn, reputation |
| 7 | `spawnFromTemplates` | Rolls 65 template hazard rates against RNG; spawns incidents based on preconditions |
| 8 | prune `recentIncidentTargets` | Wall-clock cleanup, 60 s |
| 9 | `updateIncidents` | Auto-resolves (300 s elapsed sim), mitigation completion, reputation rewards |
| 10 | `updateActions` | Completion detection via `elapsedSim`; applies `recurringCostDelta` on complete |
| 11 | `checkGameOver(state, dt)` | `reputationZeroTimer += dt` (was += 1, now scaled) |
| 12 | `updateStress` | alertFatigue, burnout, techDebt |
| 13 | `completeDeployments` | Checks wall-clock timers, calls `deployComponent`, adds to `deployedComponents` |

**Timing split (important):** Incident durations and action durations use `elapsedSim`/`startSim` (so 2×/4× speed affects them). Cooldowns, deployment progress, and target-pruning stay on wall-clock (UI-facing; player reads them in real seconds).

---

## The incident engine (`src/sim/incidentSpawner.ts`)

This is the causal heart of the game: incidents fire *because of* system state.

```ts
// Per tick, per template:
const perSecond = (def.baseRatePerMinute / 60) * GAME_CONFIG.incidents.spawnRateMultiplier;
if (rng.next() >= perSecond * dt) continue; // seeded — reproducible
// check preconditions: minUtilization, maxUtilization, minErrorRate, minTechDebt, featureDisabled
// check eligibleTargets: enabled, right ComponentType, not already under this def
// spawn ActiveIncident with startSim: state.elapsedSim
```

**Key balance constants:**
- `spawnRateMultiplier: 0.5` — templates sum to ~1.36/min unscaled; at 0.5 a 30-min run sees ~6–12 incidents
- `maxConcurrent: 6`
- Inline CRIT cap: `activeCrits >= 2 → skip CRIT templates` (pre-CP4 balance guard; prevents the "3 CRIT = system collapse" game-over before balance is tuned)
- `spreadAfterSeconds: 45` — unmitigated incidents spread to adjacent node types
- `healthRecoveryDuringIncident: 0` — recovery is fully suppressed while a node is actively under an incident

**Resolution rewards:**
- Player mitigates: `mitigatedReputationReward: 3`
- Auto-resolves (300 s elapsed): `autoResolveReputationReward: 0`

So ignoring incidents costs you reputation relative to fixing them.

---

## Progressive architecture

Runs start with only `dns`, `app`, `db_primary`. Everything else is a `ComponentBlueprint` in `src/config/progressionConfig.ts` with `unlockConditions` and `prerequisites`.

**Deployments complete inside `tickSimulation` (phase 13), not via a reducer dispatch.** The old `DEPLOYMENT_COMPLETE` action was removed — it was being clobbered by the same-tick `LOAD_GAME` commit, causing permanent deployment failure.

Phase 4 tip: `deployWhenAffordable` policy (in `tests/policies.ts`) models a competent player; running `runSim` with it vs an idle policy is how the checkpoint tests prove building beats idling.

**Edge rewiring on deploy:**
- `cdn`: removes `dns→app`, adds `dns→cdn→app`
- `waf`: removes `cdn→app`, adds `cdn→waf→app`
- `cache`: reduces `app→db_primary` edge weight × 0.25 (models cache hit rate reducing DB queries)
- `rlb`: finds furthest downstream node and inserts RLB between it and `app`
- `glb`: removes `waf→app` and `waf→rlb` (GLB sits between WAF and RLB)
- `apigw`: removes `rlb→app`

---

## Cost model

`engine.ts updateBusiness` computes `state.costs = Math.max(0, nodeSum + state.recurringCostAdjustment)`. The `recurringCostAdjustment` field accumulates `actionDef.recurringCostDelta` when actions complete (in `updateActions`). This means cost-saving actions actually save money now.

Breaking even requires ~3.5k users. At `rpsPerActiveUser: 0.75`, infrastructure pressure starts arriving in the first 2–3 minutes — app cluster hits its 0.7 utilization knee around minute 3–5.

---

## Component metrics span four files

`node.specificMetrics` is `Record<string, any>` — TypeScript won't catch mistakes. All four must be kept in sync when adding/changing a metric:

| File | Role |
|---|---|
| `sim/componentMetrics.ts` | Per-type interfaces + `METRIC_BASELINES` (single source of truth) |
| `sim/componentInitializer.ts` | Default values (must match baselines) |
| `sim/engine.ts` → `getDefaultMetricValue()` | Recovery target per tick (reads `METRIC_BASELINES`) |
| `sim/clampMetrics.ts` | Bounds enforcement (explicit `FRACTION_METRICS`/`PERCENT_METRICS` sets) |

`clampMetric` now guards `!Number.isFinite(value) → return 0` first, then dispatches on explicit sets (not substrings). `evictionRate` is a counter (keys/sec, not a fraction) and is no longer crushed to ≤1.

---

## AI integration

All OpenAI traffic goes through `src/services/openai.ts`:
- `chatJSON(apiKey, messages, temperature)` — raw `fetch`, JSON mode, `max_completion_tokens`
- `parseJSON<T>(reply)` — slices outermost `{…}` to survive code fences and stray prose

Model and pricing live in `GAME_CONFIG.ai`. The AI is now a **prose-only layer**: it rewrites incident `name`, `description`, and `logs` for WARN/CRIT incidents after `spawnFromTemplates` has already determined what breaks and why. See `src/services/incidentFlavour.ts`:
- `shouldFlavour(severity, apiKey)` — guards on key presence and `flavourSeverities: ['WARN', 'CRIT']`
- `flavourIncident(def, node, apiKey)` — returns null on any failure; caller keeps template text

Budget: `GAME_CONFIG.session.maxApiCalls: 200` / 30 min. `shouldMakeApiCall()` no longer has the permanent-kill inactivity latch (was: 5 min idle → dead for the rest of the session).

---

## Test harness

`tests/harness.ts` provides `runSim(opts)` which runs a full simulated session headlessly using fake timers (Vitest `vi.useFakeTimers`). 30 min at 0.1 s/step = 18,000 ticks in ~200 ms real time.

`tests/policies.ts` provides `deployWhenAffordable: Policy` — deploys the cheapest unlocked affordable blueprint, one at a time. Mirrors a competent player.

### 5 checkpoint tests (`npm run verify`)

All assertions proved against real simulation runs:

| CP | Key assertions |
|---|---|
| CP1 | Baseline report + numeric sanity |
| CP2 | 5+ deployments, cash > -5000, 40+ actions reachable |
| CP3 | Idler peak util > 0.7; builder has lower peak + higher costs |
| CP4 | Negligent uptime < competent; competent survives; reproducible |
| CP5 | 3 seeds × all deployed > 5, incidents > 5, uptime > 0.5, no NaN |

---

## Known deferred / deliberate scope cuts

These are decisions, not oversights:

- **`warRoomActive`** — cosmetic; no engine or reducer effect
- **`aiSessionActive`** — still dispatched but gates nothing (field kept for backward compat; cleanup later)
- **`unlockedFeatures`, `fundingRound`, `investorPressure`, `milestones`** — dead state; never mutated or read post-overhaul
- **`spawnRateMultiplier: 0.5` with inline CRIT cap** — pre-CP4 balance. The causal mechanism is correct; the numbers need playing and tuning.
- **Task system (no task can fail)** — intentionally unchanged; making tasks a real skill check is its own work
- **`recurringCostDelta` on actions vs dead config keys** — `recurringCostDelta` now works; `GAME_CONFIG.incidents.hazardMultipliers/difficultyTimeScale` were already removed in the code-smell pass
- **Applying `componentMetrics.ts` interfaces to `specificMetrics`** — would require a wholesale change to avoid breaking clamp behaviour

## Known remaining bugs (lower priority)

- **`increase_price` → deleted; `price_increase` → works** — the trap action was removed in T17
- **Escalation test has weak coverage** — the test checks `incidentHistory.length > 0`, not that escalation actually fired (escalation requires an unmitigated incident to survive past `escalationTimeSeconds`, which is rare at current spawn rates)
- **`as any` casts for `aiIncidentName`/`aiLogs` on `ActiveIncident`** — fields are declared on the type but TypeScript's strict mode misses some cast sites
- **105 MB of copyrighted MP3s committed** to `public/music/` — not gitignored

---

## Conventions

- Health, error rates, uptime: **0–1 fractions**. Reputation, techDebt, burnout, alertFatigue: **0–100**. `utilization` unbounded above (>1 = overloaded).
- All balance constants live in `GAME_CONFIG` (`src/config/gameConfig.ts`). Don't inline magic numbers into the engine.
- Logging in `sim/` and `services/`: `tlog`, never `console.*`.
- The `SeededRNG` (`sim/rng.ts`) is now actively used by `spawnFromTemplates` — the same seed produces the same incident history (as long as Date.now() calls in incident IDs stay deterministic, which they do via fake timers in tests).
- CSS: 4 global sheets in `src/styles/`, dark terminal theme, neon accents, JetBrains Mono. 233 custom properties defined but `var(--…)` used only once — components use hardcoded hex. Not ideal, but consistent.

## Risky to change

- **`spawnFromTemplates` + template `preconditions` data** — the causal link between architecture choices and incident rates. Test with `npm run verify` after any change.
- **`applyIncidentEffects` loop** — must iterate `[...state.activeIncidents]` (snapshot) so escalation/spread incidents don't receive effects in the same tick as creation.
- **`cloneGameState` in `stateUtils.ts`** — hand-maintained; every new non-primitive `GameState` field must be added here.
- **`updateBusiness`** — 6 stacked multipliers kept in place from pre-overhaul balancing; don't touch without running all checkpoints.
- **Capacity values in `architecture.ts`** — tuned together with `rpsPerActiveUser: 0.75`; changing one without the other breaks the load tests.
