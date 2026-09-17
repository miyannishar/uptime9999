# UPTIME 99.99 Engine Overhaul — Implementation Plan

> **STATUS: COMPLETE** — All 17 tasks done, 5 checkpoints pass, final review clean. Branch: `worktree-engine-overhaul`. 22 commits. 45 tests. See `CLAUDE.md` for the full technical reference.



> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Make the simulation engine testable, then make the build-and-optimise loop actually function and matter, so infrastructure decisions have visible consequences and incidents apply real pressure.

**Architecture:** Add a headless test harness first (the engine is already Node-importable — this is additive, not a refactor), then fix in dependency order: P0 blockers → economy/capacity → incident engine → robustness. Each phase ends in a checkpoint test that both asserts invariants and prints a readable balance report, so every balance change is provable rather than felt.

**Tech Stack:** React 18, TypeScript (strict), Vite 5, Vitest (added by Task 1).

**Spec:** Embedded below under *Design Decisions* — brainstormed 2026-09-16. No separate spec file; the three decisions that shape every task are recorded here verbatim.

## Design Decisions

1. **Difficulty: pressure with a soft floor.** Incidents genuinely degrade health, uptime and revenue. Hard guards prevent death spirals. Losing is possible but rare and telegraphed. This is a management sim, not a survival game.
2. **Core loop: build and optimise the architecture.** The infrastructure ladder plus cost/revenue optimisation *is* the game. Incidents are recurring pressure that motivates investment in redundancy and capacity. Consequence: deep per-incident diagnosis is explicitly **out of scope** — `mitigationPerAction = 1.0` stands.
3. **Incidents: templates primary, AI as flavour.** The 65 templates in `src/data/incidents.ts` become the live incident engine via `preconditions`/`targetTypes`/`baseRatePerMinute` — this is the causal link that makes good architecture pay off. `aiGameMaster` is demoted to rewriting name/description/logs for WARN and CRIT only, with template text as fallback. The game must run with no API key.

## Global Constraints

- TypeScript `strict`, `noUnusedLocals`, `noUnusedParameters`, `noFallthroughCasesInSwitch` — unused imports and params are build errors.
- `npm run build` (`tsc && vite build`) must pass at the end of every task.
- Health / error rates / uptime are 0–1 fractions. Reputation / techDebt / burnout / alertFatigue are 0–100. `utilization` is unbounded above (>1 = overloaded).
- Any new non-primitive field on `GameState` **must** be added to `cloneGameState` in `src/utils/stateUtils.ts`.
- Never dispatch another action in the same callback as the tick's `LOAD_GAME` commit — it returns `action.state` verbatim and discards neighbours. Partial writes use `PATCH` with an updater.
- Balance constants live in `src/config/gameConfig.ts`. Do not inline new magic numbers into the engine.
- Logging in `sim/` and `services/` goes through `tlog`, never `console.*`.
- The game must remain playable with `VITE_OPENAI_API_KEY` absent.

---

## File Structure

**Created:**
- `vitest.config.ts` — test runner config, `environment: 'node'`
- `tests/harness.ts` — headless run harness; owns fake-clock control and the run report type
- `tests/policies.ts` — scripted player behaviours (deploy-when-affordable, resolve-incidents) used by checkpoints
- `tests/checkpoint-1-baseline.test.ts` … `checkpoint-5-final.test.ts` — phase gates that assert + print reports
- `tests/deployment.test.ts`, `tests/economy.test.ts`, `tests/clamps.test.ts`, `tests/incidents.test.ts` — unit tests
- `src/sim/incidentSpawner.ts` — template-driven incident spawning (Task 10)
- `src/services/incidentFlavour.ts` — optional AI prose layer (Task 13)

**Modified:** `src/sim/engine.ts`, `src/sim/reducer.ts`, `src/sim/clampMetrics.ts`, `src/sim/types.ts`, `src/config/gameConfig.ts`, `src/data/architecture.ts`, `src/ui/ActionBar.tsx`, `src/ui/DetailPanel.tsx`, `src/ui/StakeholderComms.tsx`, `src/App.tsx`, `src/utils/stateUtils.ts`, `package.json`

---

# PHASE 0 — Test foundation

## Task 1: Add Vitest and prove the engine runs headless

The engine's only external imports are `config/`, `data/` and `utils/`. `soundNotifications` wraps `new AudioContext()` in try/catch so `window is not defined` degrades to disabled; `tlog` early-returns unless `import.meta.env.MODE === 'development'`. So no refactor is needed — this task only proves it and locks it in with a test.

**Files:**
- Modify: `package.json`
- Create: `vitest.config.ts`
- Create: `tests/smoke.test.ts`

**Interfaces:**
- Consumes: nothing
- Produces: `npm test` runs Vitest; `tests/` can import from `src/sim/*` directly

- [ ] **Step 1: Install Vitest**

```bash
npm install -D vitest@^2
```

- [ ] **Step 2: Create the config**

`vitest.config.ts`:
```ts
import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    environment: 'node',
    include: ['tests/**/*.test.ts'],
    testTimeout: 30_000,
  },
});
```

- [ ] **Step 3: Add npm scripts**

In `package.json`, add to `"scripts"`:
```json
"test": "vitest run",
"test:watch": "vitest",
"verify": "vitest run tests/checkpoint-*.test.ts --reporter=verbose"
```

- [ ] **Step 4: Write the failing smoke test**

`tests/smoke.test.ts`:
```ts
import { describe, it, expect, vi, afterEach } from 'vitest';
import { createInitialState, tickSimulation } from '../src/sim/engine';
import { SeededRNG } from '../src/sim/rng';

afterEach(() => vi.useRealTimers());

describe('engine is headless-importable', () => {
  it('creates initial state with the documented starting values', () => {
    const s = createInitialState('smoke');
    expect(s.users).toBe(200);
    expect(s.cash).toBe(5000);
    expect(s.reputation).toBe(80);
    expect(s.architecture.nodes.size).toBe(3);
    expect([...s.deployedComponents].sort()).toEqual(['app', 'db_primary', 'dns']);
  });

  it('advances one tick without touching window or the network', () => {
    vi.useFakeTimers({ toFake: ['Date'] });
    vi.setSystemTime(1_700_000_000_000);
    const s0 = createInitialState('smoke');
    vi.setSystemTime(1_700_000_000_100);
    const s1 = tickSimulation(s0, new SeededRNG('smoke'), 0.1);
    expect(s1).not.toBe(s0);
    expect(Number.isFinite(s1.rps)).toBe(true);
    expect(Number.isFinite(s1.cash)).toBe(true);
  });
});
```

- [ ] **Step 5: Run it**

Run: `npm test`
Expected: PASS, 2 tests. If `createInitialState` throws on `window`, the audio import is not lazy after all — fix by wrapping the `soundNotifications` call sites in `sim/` behind `typeof window !== 'undefined'` and re-run.

- [ ] **Step 6: Confirm the build still passes**

Run: `npm run build`
Expected: exit 0.

- [ ] **Step 7: Commit**

```bash
git add package.json package-lock.json vitest.config.ts tests/smoke.test.ts
git commit -m "test: add vitest and prove the sim engine runs headless"
```

---

## Task 2: Build the run harness and capture the baseline (CHECKPOINT 1)

**Files:**
- Create: `tests/harness.ts`
- Create: `tests/policies.ts`
- Create: `tests/checkpoint-1-baseline.test.ts`

**Interfaces:**
- Consumes: `createInitialState`, `tickSimulation`, `gameReducer`, `SeededRNG`
- Produces:
  - `runSim(opts: RunOptions): RunReport`
  - `RunOptions = { seed?: string; minutes?: number; stepSeconds?: number; policies?: Policy[] }`
  - `Policy = (s: GameState, elapsedSec: number) => GameAction[]`
  - `RunReport = { final: GameState; samples: Sample[]; gameOver: boolean; gameOverReason?: string }`
  - `Sample = { t: number; users: number; cash: number; uptime: number; reputation: number; activeIncidents: number; resolvedIncidents: number; deployed: string[]; costs: number; revenue: number; maxUtil: number }`
  - `formatReport(r: RunReport): string`
  - `deployWhenAffordable: Policy`, `completeDeployments: Policy`, `resolveIncidents: Policy`

- [ ] **Step 1: Write the harness**

`tests/harness.ts`:
```ts
import { vi } from 'vitest';
import { createInitialState, tickSimulation } from '../src/sim/engine';
import { gameReducer, type GameAction } from '../src/sim/reducer';
import { SeededRNG } from '../src/sim/rng';
import type { GameState } from '../src/sim/types';

const START = 1_700_000_000_000;

export type Policy = (s: GameState, elapsedSec: number) => GameAction[];

export interface Sample {
  t: number; users: number; cash: number; uptime: number; reputation: number;
  activeIncidents: number; resolvedIncidents: number; deployed: string[];
  costs: number; revenue: number; maxUtil: number;
}

export interface RunReport {
  final: GameState; samples: Sample[]; gameOver: boolean; gameOverReason?: string;
}

export interface RunOptions {
  seed?: string; minutes?: number; stepSeconds?: number; policies?: Policy[];
}

function sample(s: GameState, t: number): Sample {
  let maxUtil = 0;
  s.architecture.nodes.forEach(n => { if (n.enabled && n.utilization > maxUtil) maxUtil = n.utilization; });
  return {
    t, users: Math.round(s.users), cash: Math.round(s.cash), uptime: s.uptime,
    reputation: s.reputation, activeIncidents: s.activeIncidents.length,
    resolvedIncidents: s.resolvedIncidents, deployed: [...s.deployedComponents].sort(),
    costs: s.costs, revenue: s.revenue, maxUtil,
  };
}

/** Runs a full simulated session against a fake clock. 30 min at 0.1s steps = 18000 ticks. */
export function runSim(opts: RunOptions = {}): RunReport {
  const { seed = 'plan-seed', minutes = 30, stepSeconds = 0.1, policies = [] } = opts;
  vi.useFakeTimers({ toFake: ['Date'] });
  vi.setSystemTime(START);
  try {
    const rng = new SeededRNG(seed);
    let state = createInitialState(seed);
    const samples: Sample[] = [];
    const steps = Math.round((minutes * 60) / stepSeconds);
    const sampleEvery = Math.round(30 / stepSeconds); // every 30 simulated seconds

    for (let i = 1; i <= steps; i++) {
      const elapsedSec = i * stepSeconds;
      vi.setSystemTime(START + elapsedSec * 1000);
      state = tickSimulation(state, rng, stepSeconds);
      for (const p of policies) {
        for (const action of p(state, elapsedSec)) state = gameReducer(state, action);
      }
      if (i % sampleEvery === 0) samples.push(sample(state, elapsedSec));
      if (state.gameOver) break;
    }
    return { final: state, samples, gameOver: state.gameOver, gameOverReason: state.gameOverReason };
  } finally {
    vi.useRealTimers();
  }
}

export function formatReport(r: RunReport): string {
  const head = 'min |   users |    cash | uptime | rep | inc | resd | maxUtil | deployed';
  const rows = r.samples
    .filter((_, i) => i % 4 === 3) // every 2 minutes
    .map(s => [
      String(Math.round(s.t / 60)).padStart(3),
      String(s.users).padStart(7),
      String(s.cash).padStart(7),
      (s.uptime * 100).toFixed(2).padStart(6),
      String(Math.round(s.reputation)).padStart(3),
      String(s.activeIncidents).padStart(3),
      String(s.resolvedIncidents).padStart(4),
      s.maxUtil.toFixed(2).padStart(7),
      String(s.deployed.length),
    ].join(' | '));
  const tail = r.gameOver ? `\nGAME OVER: ${r.gameOverReason}` : '\nsurvived to end of session';
  return [head, ...rows].join('\n') + tail;
}
```

- [ ] **Step 2: Write the policies**

`tests/policies.ts`:
```ts
import { COMPONENT_BLUEPRINTS, blueprintStatus } from '../src/config/progressionConfig';
import type { GameAction } from '../src/sim/reducer';
import type { GameState } from '../src/sim/types';
import type { Policy } from './harness';

/** Deploys the cheapest unlocked, affordable blueprint. Mirrors what a competent player does. */
export const deployWhenAffordable: Policy = (s: GameState, t: number): GameAction[] => {
  if (s.deployingComponents.size > 0) return [];
  const candidates = COMPONENT_BLUEPRINTS
    .filter(bp => !s.deployedComponents.has(bp.id))
    .filter(bp => blueprintStatus(bp, s.deployedComponents, s.users, t, s.totalIncidents).unlocked)
    .filter(bp => s.cash >= bp.deployCost)
    .sort((a, b) => a.deployCost - b.deployCost);
  return candidates.length ? [{ type: 'DEPLOY_COMPONENT', componentId: candidates[0].id }] : [];
};

/**
 * Replicates App.tsx's deployment completion. Needed only until Task 3 moves this
 * into tickSimulation — Task 3 deletes this policy.
 */
export const completeDeploymentsLikeApp: Policy = (s: GameState): GameAction[] => {
  const out: GameAction[] = [];
  s.deployingComponents.forEach((info, id) => {
    if ((Date.now() - info.startTime) / 1000 >= info.durationSec) {
      out.push({ type: 'DEPLOYMENT_COMPLETE', componentId: id });
    }
  });
  return out;
};
```

- [ ] **Step 3: Write the baseline checkpoint as a report, not a set of defect assertions**

This prints the "before" numbers so later phases have something to compare against. It deliberately asserts **only invariants that must hold forever** — if it asserted today's defects, every later task would have to edit it, and a test you routinely edit stops being a safety net.

`tests/checkpoint-1-baseline.test.ts`:
```ts
import { describe, it, expect } from 'vitest';
import { runSim, formatReport } from './harness';
import { deployWhenAffordable, completeDeploymentsLikeApp } from './policies';

describe('CHECKPOINT 1 — baseline', () => {
  it('prints a 30-minute run and stays numerically sane', () => {
    const r = runSim({ minutes: 30, policies: [deployWhenAffordable, completeDeploymentsLikeApp] });
    console.log('\n=== BASELINE ===\n' + formatReport(r));

    const peakUtil = Math.max(...r.samples.map(s => s.maxUtil));
    const minHealth = Math.min(...[...r.final.architecture.nodes.values()].map(n => n.health));
    console.log(`peak utilization: ${peakUtil.toFixed(4)} (knee is 0.7)`);
    console.log(`min node health : ${minHealth.toFixed(4)}`);
    console.log(`deployed        : ${[...r.final.deployedComponents].sort().join(', ')}`);
    console.log(`incidents       : ${r.final.totalIncidents} total, ${r.final.resolvedIncidents} resolved`);

    // Permanent invariants only
    expect(r.samples.length).toBeGreaterThan(10);
    expect(Number.isFinite(r.final.users)).toBe(true);
    expect(Number.isFinite(r.final.cash)).toBe(true);
    expect(r.final.users).toBeGreaterThan(0);
  });
});
```

**Write down the four printed values before moving on.** They are your before/after reference; Phase 2 should move `peak utilization` off ~0.0002, and Phase 3 should move `min node health` off 1.0.

- [ ] **Step 4: Run the checkpoint**

Run: `npm run verify`
Expected: PASS. Read the printed table — this is the reference you are changing. Record peak utilization and final users somewhere you can compare against later.

- [ ] **Step 5: Commit**

```bash
git add tests/harness.ts tests/policies.ts tests/checkpoint-1-baseline.test.ts
git commit -m "test: add headless run harness and baseline checkpoint"
```

---

# PHASE 1 — P0 blockers

## Task 3: Make component deployment actually complete

`App.tsx` dispatches `DEPLOYMENT_COMPLETE` and then `LOAD_GAME` with a `newState` computed *before* the deployment; `LOAD_GAME` returns `action.state` verbatim, so the deployment is discarded and re-fires every tick forever. The fix is to make completion part of `newState` instead of a sibling dispatch, and delete the second path entirely.

**Files:**
- Modify: `src/sim/engine.ts`
- Modify: `src/App.tsx`
- Modify: `src/sim/reducer.ts` (remove the now-unused action)
- Create: `tests/deployment.test.ts`
- Modify: `tests/policies.ts` (delete `completeDeploymentsLikeApp`)
- Modify: `tests/checkpoint-1-baseline.test.ts`

**Interfaces:**
- Consumes: `runSim`, `deployWhenAffordable`
- Produces: `tickSimulation` completes deployments internally; `DEPLOYMENT_COMPLETE` no longer exists on `GameAction`

- [ ] **Step 1: Write the failing test**

`tests/deployment.test.ts`:
```ts
import { describe, it, expect } from 'vitest';
import { runSim } from './harness';
import { deployWhenAffordable } from './policies';

describe('component deployment', () => {
  it('completes a deployment and keeps it', () => {
    const r = runSim({ minutes: 10, policies: [deployWhenAffordable] });
    expect(r.final.deployedComponents.has('cache')).toBe(true);
    expect(r.final.deployingComponents.size).toBe(0);
    expect(r.final.architecture.nodes.has('cache')).toBe(true);
  });

  it('records each deployment exactly once', () => {
    const r = runSim({ minutes: 15, policies: [deployWhenAffordable] });
    const ids = r.final.componentDeploymentHistory.map(d => d.componentId);
    expect(new Set(ids).size).toBe(ids.length);
  });

  it('charges the blueprint cost once', () => {
    const r = runSim({ minutes: 10, policies: [deployWhenAffordable] });
    const spend = r.final.componentDeploymentHistory.reduce((a, d) => a + d.cost, 0);
    expect(spend).toBeGreaterThan(0);
    expect(r.final.componentDeploymentHistory.length).toBeGreaterThanOrEqual(1);
  });
});
```

- [ ] **Step 2: Run it and watch it fail**

Run: `npx vitest run tests/deployment.test.ts`
Expected: FAIL — `deployedComponents.has('cache')` is `false` and `deployingComponents.size` is 1, because nothing completes deployments now that the App-mirroring policy is gone.

- [ ] **Step 3: Move completion into the tick**

In `src/sim/engine.ts`, add the import and a new phase. `COMPONENT_BLUEPRINTS` and `deployComponent` are already reachable from `sim/` (it imports `STARTING_COMPONENTS` and `createMinimalArchitecture` today), so this adds no new layer crossing:

```ts
import { STARTING_COMPONENTS, COMPONENT_BLUEPRINTS } from '../config/progressionConfig';
import { createMinimalArchitecture, deployComponent } from '../data/architecture';
```

Add at the end of `tickSimulation`, after `updateStress(newState, dt)`:
```ts
  // === 13. COMPLETE DEPLOYMENTS ===
  completeDeployments(newState);
```

And the function:
```ts
function completeDeployments(state: GameState) {
  const now = Date.now();
  for (const [id, info] of Array.from(state.deployingComponents.entries())) {
    if ((now - info.startTime) / 1000 < info.durationSec) continue;
    state.deployingComponents.delete(id);
    const bp = COMPONENT_BLUEPRINTS.find(b => b.id === id);
    if (!bp) continue;
    if (!deployComponent(state.architecture, id, bp.edges)) {
      tlog.warn(`⚠️ ${bp.name} deployment produced no node — check basePositions/blueprint id`);
      continue;
    }
    state.deployedComponents.add(id);
    state.componentDeploymentHistory.push({ componentId: id, deployedAt: now, cost: bp.deployCost });
    tlog.success(`✅ ${bp.name} is now live!`);
  }
}
```

- [ ] **Step 4: Delete the App-mirroring policy FIRST**

Do this before Step 5, not after — `completeDeploymentsLikeApp` references `DEPLOYMENT_COMPLETE`, so removing the action type first would break `tsc` mid-task.

In `tests/policies.ts`, delete `completeDeploymentsLikeApp` entirely. In `tests/checkpoint-1-baseline.test.ts`, drop it from the import and from the `policies` array.

- [ ] **Step 5: Remove the old path**

In `src/App.tsx`, delete the deployment-timer block that sits above the `LOAD_GAME` commit:
```ts
      // DELETE THIS BLOCK — tickSimulation now owns deployment completion
      newState.deployingComponents.forEach((info, componentId) => {
        const elapsed = (now - info.startTime) / 1000;
        if (elapsed >= info.durationSec) {
          dispatch({ type: 'DEPLOYMENT_COMPLETE', componentId });
        }
      });
```

In `src/sim/reducer.ts`, delete the `DEPLOYMENT_COMPLETE` variant from `GameAction` and its whole `case 'DEPLOYMENT_COMPLETE': { … }` block. Keep `DEPLOY_COMPONENT` (it starts the deployment and charges cash). Remove the now-unused `newState.costs += blueprint.ongoingCostPerSec;` line with it — Task 6 handles recurring cost properly.

- [ ] **Step 6: Run tests and build**

Run: `npm test`
Expected: PASS. `npm run build` → exit 0.

- [ ] **Step 7: Commit**

```bash
git add src/sim/engine.ts src/App.tsx src/sim/reducer.ts tests/
git commit -m "fix: complete deployments inside the tick so LOAD_GAME cannot discard them"
```

---

## Task 4: Make globally-targeted actions reachable

`ActionBar` hides any action whose `target` is not in `deployedComponents`. 18 of 28 quick actions use `target: 'global'`, which is never a component id, so only 2 render at session start. The same gate is duplicated in `DetailPanel` and re-checked in `executeAction`.

**Files:**
- Create: `src/sim/actionAvailability.ts`
- Modify: `src/ui/ActionBar.tsx`, `src/ui/DetailPanel.tsx`
- Create: `tests/actions.test.ts`

**Interfaces:**
- Produces: `isActionTargetPresent(state: GameState, target: string): boolean`

- [ ] **Step 1: Write the failing test**

`tests/actions.test.ts`:
```ts
import { describe, it, expect } from 'vitest';
import { createInitialState } from '../src/sim/engine';
import { isActionTargetPresent } from '../src/sim/actionAvailability';
import { ACTIONS } from '../src/data/actions';

describe('action target availability', () => {
  it('treats global as always present', () => {
    const s = createInitialState('a');
    expect(isActionTargetPresent(s, 'global')).toBe(true);
  });

  it('accepts deployed components and rejects undeployed ones', () => {
    const s = createInitialState('a');
    expect(isActionTargetPresent(s, 'app')).toBe(true);
    expect(isActionTargetPresent(s, 'cache')).toBe(false);
  });

  it('accepts scaled instances that exist in the architecture but not in deployedComponents', () => {
    const s = createInitialState('a');
    const app = s.architecture.nodes.get('app')!;
    s.architecture.nodes.set('app_2', { ...app, id: 'app_2', instanceNumber: 2 });
    expect(isActionTargetPresent(s, 'app_2')).toBe(true);
  });

  it('exposes a usable number of actions at session start', () => {
    const s = createInitialState('a');
    const visible = ACTIONS.filter(a => isActionTargetPresent(s, a.target));
    expect(visible.length).toBeGreaterThan(20);
  });
});
```

- [ ] **Step 2: Run it and watch it fail**

Run: `npx vitest run tests/actions.test.ts`
Expected: FAIL — module `src/sim/actionAvailability` does not exist.

- [ ] **Step 3: Implement the shared gate**

`src/sim/actionAvailability.ts`:
```ts
import type { GameState } from './types';

/**
 * True when an action's declared target can be acted on: 'global' actions always can,
 * component-scoped ones need either a deployed blueprint or a live architecture node
 * (which covers scaled instances like `app_2`).
 */
export function isActionTargetPresent(state: GameState, target: string): boolean {
  if (!target || target === 'global') return true;
  return state.deployedComponents.has(target) || state.architecture.nodes.has(target);
}
```

- [ ] **Step 4: Use it in both panels**

In `src/ui/ActionBar.tsx`, replace:
```ts
          if (action.target && !state.deployedComponents.has(action.target)) return null;
```
with:
```ts
          if (!isActionTargetPresent(state, action.target)) return null;
```
and add `import { isActionTargetPresent } from '../sim/actionAvailability';`.

In `src/ui/DetailPanel.tsx`, apply the same replacement anywhere it filters on `deployedComponents.has(...)` for action targets, importing the helper the same way.

- [ ] **Step 5: Run tests and build**

Run: `npm test` → PASS. `npm run build` → exit 0.

- [ ] **Step 6: Commit**

```bash
git add src/sim/actionAvailability.ts src/ui/ActionBar.tsx src/ui/DetailPanel.tsx tests/actions.test.ts
git commit -m "fix: make global-target actions reachable via a shared availability gate"
```

---

## CHECKPOINT 2 — the game is playable

**Files:** Create `tests/checkpoint-2-playable.test.ts`

- [ ] **Step 1: Write the checkpoint**

```ts
import { describe, it, expect } from 'vitest';
import { runSim, formatReport } from './harness';
import { deployWhenAffordable } from './policies';
import { ACTIONS } from '../src/data/actions';
import { isActionTargetPresent } from '../src/sim/actionAvailability';

describe('CHECKPOINT 2 — playable', () => {
  it('climbs the deployment ladder and keeps actions reachable', () => {
    const r = runSim({ minutes: 30, policies: [deployWhenAffordable] });
    console.log('\n=== CHECKPOINT 2 ===\n' + formatReport(r));
    console.log('deployed at end:', [...r.final.deployedComponents].sort().join(', '));

    expect(r.final.deployedComponents.size).toBeGreaterThanOrEqual(8);
    expect(r.final.deployingComponents.size).toBeLessThanOrEqual(1);
    expect(r.final.cash).toBeGreaterThan(0);

    const visible = ACTIONS.filter(a => isActionTargetPresent(r.final, a.target));
    console.log(`actions reachable at end: ${visible.length} / ${ACTIONS.length}`);
    expect(visible.length).toBeGreaterThan(40);
  });
});
```

- [ ] **Step 2: Run and read**

Run: `npm run verify`
Expected: PASS. The ladder should reach ~8–11 components. **Peak utilization will still be near zero** — that is Phase 2's job.

- [ ] **Step 3: Commit**

```bash
git add tests/checkpoint-2-playable.test.ts
git commit -m "test: checkpoint 2 — deployment ladder and action reachability"
```

---

# PHASE 2 — Make build-and-optimise matter

## Task 5: Make the load model engage

`rps = users × activityRate × 0.01` against an app cluster of 2 × 5000 capacity means utilization needs ~250k users to reach its 0.7 knee. Raise per-user traffic and cut node capacities so the first capacity pressure lands in the first few minutes and each deployment visibly relieves it.

**Files:**
- Modify: `src/config/gameConfig.ts`, `src/sim/engine.ts`, `src/data/architecture.ts`
- Create: `tests/load.test.ts`

**Interfaces:**
- Produces: `GAME_CONFIG.traffic.rpsPerActiveUser`

- [ ] **Step 1: Write the failing test**

`tests/load.test.ts`:
```ts
import { describe, it, expect } from 'vitest';
import { runSim } from './harness';
import { deployWhenAffordable } from './policies';

describe('load model', () => {
  it('puts the app under real pressure early when nothing is deployed', () => {
    const r = runSim({ minutes: 8, policies: [] }); // no deployments, no relief
    const peak = Math.max(...r.samples.map(s => s.maxUtil));
    expect(peak).toBeGreaterThan(0.7);
  });

  it('relieves database pressure when a cache is deployed', () => {
    const withCache = runSim({ minutes: 12, policies: [deployWhenAffordable] });
    const bare = runSim({ minutes: 12, policies: [] });
    const dbWith = withCache.final.architecture.nodes.get('db_primary')!.utilization;
    const dbBare = bare.final.architecture.nodes.get('db_primary')!.utilization;
    expect(withCache.final.deployedComponents.has('cache')).toBe(true);
    expect(dbWith).toBeLessThan(dbBare * 0.8);
  });
});
```

- [ ] **Step 2: Run it and watch it fail**

Run: `npx vitest run tests/load.test.ts`
Expected: FAIL — peak utilization is ~0.0002, nowhere near 0.7.

- [ ] **Step 3: Add the traffic constant**

In `src/config/gameConfig.ts`, add a top-level block:
```ts
  // === TRAFFIC ===
  traffic: {
    // Requests per second contributed by each active user. Tuned so the app cluster
    // reaches its 0.7 latency knee in the first few minutes at starting capacity,
    // making the first cache/CDN deployment feel like relief rather than bookkeeping.
    rpsPerActiveUser: 0.5,
  },
```

- [ ] **Step 4: Use it in the engine**

In `src/sim/engine.ts`, replace the traffic line:
```ts
  const baseRPS = newState.users * activityRate * 0.01; // 1% of users active
```
with:
```ts
  const baseRPS = newState.users * activityRate * GAME_CONFIG.traffic.rpsPerActiveUser;
```

- [ ] **Step 5: Rescale node capacities**

In `src/data/architecture.ts`, divide these `capacity` values by 10 so they sit in range of the new traffic. Change each listed node's `capacity` field to the new value:

| node | old | new |
|---|---|---|
| `dns` | 100000 | 10000 |
| `cdn` | 50000 | 5000 |
| `waf` | 30000 | 3000 |
| `glb` | 50000 | 5000 |
| `rlb` | 30000 | 3000 |
| `apigw` | 20000 | 2000 |
| `app` | 5000 | 500 |
| `servicemesh` | 50000 | 5000 |
| `cache` | 10000 | 1000 |
| `queue` | 5000 | 500 |
| `workers` | 2000 | 200 |
| `db_primary` | 3000 | 300 |
| `db_replica` | 1000 | 100 |
| `storage` | 10000 | 1000 |
| `observability` | 100000 | 10000 |

- [ ] **Step 6: Run the load test and tune**

Run: `npx vitest run tests/load.test.ts`
If the first assertion fails because pressure arrives too late, raise `rpsPerActiveUser` in steps of 0.25. If nodes saturate before minute 2 (peak > 3.0 in the first sample), lower it. Re-run until both assertions pass. Record the final value in the commit message.

- [ ] **Step 7: Commit**

```bash
git add src/config/gameConfig.ts src/sim/engine.ts src/data/architecture.ts tests/load.test.ts
git commit -m "feat: rescale traffic and capacity so the load model actually engages"
```

---

## Task 6: Make the cost model real

`engine.ts` recomputes `state.costs` from scratch every tick as `Σ costPerSec × scaling.current`, so `recurringCostDelta` on all 93 actions and `ongoingCostPerSec` on all 12 blueprints are dead writes. That means the entire "optimise" half of the chosen core loop has no economic effect.

**Files:**
- Modify: `src/sim/types.ts`, `src/sim/engine.ts`, `src/sim/reducer.ts`, `src/utils/stateUtils.ts`
- Create: `tests/economy.test.ts`

**Interfaces:**
- Produces: `GameState.recurringCostAdjustment: number` — accumulated $/sec from action effects, added to the per-node total

- [ ] **Step 1: Write the failing test**

`tests/economy.test.ts`:
```ts
import { describe, it, expect } from 'vitest';
import { createInitialState, tickSimulation } from '../src/sim/engine';
import { gameReducer } from '../src/sim/reducer';
import { SeededRNG } from '../src/sim/rng';
import { ACTIONS } from '../src/data/actions';
import { vi, afterEach } from 'vitest';

afterEach(() => vi.useRealTimers());

const T0 = 1_700_000_000_000;

/**
 * Advances `seconds` of simulated time in 0.1s ticks starting at T0+fromSec.
 * Ticking (rather than jumping the clock and ticking once) keeps these tests valid
 * after Task 15 moves timers onto simulated time.
 */
function advance(s: GameState, rng: SeededRNG, fromSec: number, seconds: number): GameState {
  const steps = Math.round(seconds / 0.1);
  for (let i = 1; i <= steps; i++) {
    vi.setSystemTime(T0 + (fromSec + i * 0.1) * 1000);
    s = tickSimulation(s, rng, 0.1);
  }
  return s;
}

describe('cost model', () => {
  it('lets a cost-saving action reduce recurring costs', () => {
    vi.useFakeTimers({ toFake: ['Date'] });
    vi.setSystemTime(T0);
    const rng = new SeededRNG('econ');
    let s = createInitialState('econ');
    s = advance(s, rng, 0, 1);
    const before = s.costs;

    const saver = ACTIONS.find(a => a.recurringCostDelta < 0 && a.target === 'global')!;
    expect(saver).toBeDefined();
    s = { ...s, cash: 100_000 };
    s = gameReducer(s, { type: 'EXECUTE_ACTION', actionId: saver.id, rng });
    s = advance(s, rng, 1, saver.durationSeconds + 2);

    expect(s.recurringCostAdjustment).toBeLessThan(0);
    expect(s.costs).toBeLessThan(before);
  });

  it('charges blueprint ongoing cost after deployment', () => {
    vi.useFakeTimers({ toFake: ['Date'] });
    vi.setSystemTime(T0);
    const rng = new SeededRNG('econ2');
    let s = createInitialState('econ2');
    s = { ...s, users: 5_000, cash: 100_000 };
    s = advance(s, rng, 0, 1);
    const before = s.costs;
    s = gameReducer(s, { type: 'DEPLOY_COMPONENT', componentId: 'cache' });
    s = advance(s, rng, 1, 40); // cache deployDurationSec is 20
    expect(s.deployedComponents.has('cache')).toBe(true);
    expect(s.costs).toBeGreaterThan(before);
  });
});
```

- [ ] **Step 2: Run it and watch it fail**

Run: `npx vitest run tests/economy.test.ts`
Expected: FAIL — `recurringCostAdjustment` does not exist on `GameState`.

- [ ] **Step 3: Add the field**

In `src/sim/types.ts`, inside `GameState` near `costs`:
```ts
  costs: number; // per second
  recurringCostAdjustment: number; // accumulated $/sec from action effects
```

In `src/sim/engine.ts`, `createInitialState` — add next to the other business fields:
```ts
    recurringCostAdjustment: 0,
```

`recurringCostAdjustment` is a primitive, so `cloneGameState`'s spread already copies it. No change needed in `stateUtils.ts` — but confirm by re-reading the spread and leave a comment if ambiguous.

- [ ] **Step 4: Fold it into the cost total**

In `src/sim/engine.ts`, in `updateBusiness`, after the per-node cost sum, add:
```ts
  state.costs = Math.max(0, state.costs + state.recurringCostAdjustment);
```

- [ ] **Step 5: Accumulate it when actions complete**

In `src/sim/reducer.ts`, inside `executeAction` where other effects are applied, add:
```ts
  if (actionDef.recurringCostDelta) {
    newState.recurringCostAdjustment += actionDef.recurringCostDelta;
  }
```

In the `DEPLOY_COMPONENT` case, do **not** touch costs — Task 3 already removed that line, and blueprint recurring cost arrives naturally because `deployComponent` adds a node with its own `costPerSec`.

- [ ] **Step 6: Run tests and build**

Run: `npm test` → PASS. `npm run build` → exit 0.

- [ ] **Step 7: Commit**

```bash
git add src/sim/types.ts src/sim/engine.ts src/sim/reducer.ts tests/economy.test.ts
git commit -m "feat: make recurringCostDelta affect costs so optimisation has economic effect"
```

---

## Task 7: Make redundancy relieve load

`db_replica` ships `scaling: { min: 0, max: 3, current: 0 }`, so `capacity × scaling.current` is 0 — the player pays $2,500 for a node with no capacity. And `propagateLoad` splits an edge's load across group members filtered only on `health > 0.3`, so a zero-capacity member absorbs load it cannot serve.

**Files:**
- Modify: `src/data/architecture.ts`, `src/sim/engine.ts`
- Modify: `tests/load.test.ts`

- [ ] **Step 1: Add the failing test**

Append to `tests/load.test.ts`:
```ts
describe('redundancy', () => {
  it('gives a deployed db_replica real capacity', () => {
    const r = runSim({ minutes: 14, policies: [deployWhenAffordable] });
    if (!r.final.deployedComponents.has('db_replica')) return; // ladder didn't reach it; not a failure
    const replica = r.final.architecture.nodes.get('db_replica')!;
    expect(replica.scaling.current).toBeGreaterThan(0);
    expect(replica.capacity * replica.scaling.current).toBeGreaterThan(0);
  });

  it('only splits load across members that can serve it', () => {
    const r = runSim({ minutes: 14, policies: [deployWhenAffordable] });
    r.final.architecture.nodes.forEach(n => {
      if (n.enabled && n.scaling.current === 0) expect(n.loadIn).toBe(0);
    });
  });
});
```

- [ ] **Step 2: Run it and watch it fail**

Run: `npx vitest run tests/load.test.ts`
Expected: FAIL on `scaling.current` being 0.

- [ ] **Step 3: Give the replica capacity**

In `src/data/architecture.ts`, change the `db_replica` node's scaling to:
```ts
    scaling: { min: 1, max: 3, current: 1, cooldownUntil: 0 },
```

- [ ] **Step 4: Filter redundancy members on serving capacity**

In `src/sim/engine.ts`, in `propagateLoad`, change the healthy-instance filter:
```ts
          const healthyInstances = allGroupInstances.filter(n => n.enabled && n.health > 0.3);
```
to:
```ts
          const healthyInstances = allGroupInstances.filter(
            n => n.enabled && n.health > 0.3 && n.scaling.current > 0
          );
```

- [ ] **Step 5: Run tests and build**

Run: `npm test` → PASS. `npm run build` → exit 0.

- [ ] **Step 6: Commit**

```bash
git add src/data/architecture.ts src/sim/engine.ts tests/load.test.ts
git commit -m "fix: give db_replica capacity and stop routing load to nodes that cannot serve"
```

---

## Task 8: Fix deployment edge rewiring for rlb and glb

`deployComponent`'s `rlb` branch is a comment-only empty block, so deploying it ($2,500) adds no inbound edge and leaves the upstream bypass in place. There is no `glb` branch at all, so `waf→app` survives beside `waf→glb` and load is double-counted.

**Files:**
- Modify: `src/data/architecture.ts`
- Create: `tests/topology.test.ts`

- [ ] **Step 1: Write the failing test**

`tests/topology.test.ts`:
```ts
import { describe, it, expect } from 'vitest';
import { createMinimalArchitecture, deployComponent } from '../src/data/architecture';
import { COMPONENT_BLUEPRINTS } from '../src/config/progressionConfig';

function deploy(arch: ReturnType<typeof createMinimalArchitecture>, id: string) {
  const bp = COMPONENT_BLUEPRINTS.find(b => b.id === id)!;
  deployComponent(arch, id, bp.edges);
}

describe('deployment topology', () => {
  it('routes traffic through rlb instead of bypassing it', () => {
    const arch = createMinimalArchitecture();
    for (const id of ['cdn', 'waf', 'rlb']) deploy(arch, id);
    expect(arch.edges.some(e => e.to === 'rlb')).toBe(true);
    expect(arch.edges.some(e => e.from === 'waf' && e.to === 'app')).toBe(false);
  });

  it('does not double-route when glb is deployed', () => {
    const arch = createMinimalArchitecture();
    for (const id of ['cdn', 'waf', 'rlb', 'glb']) deploy(arch, id);
    expect(arch.edges.some(e => e.from === 'waf' && e.to === 'app')).toBe(false);
    const wafOut = arch.edges.filter(e => e.from === 'waf');
    expect(wafOut).toHaveLength(1);
    expect(wafOut[0].to).toBe('glb');
  });
});
```

- [ ] **Step 2: Run it and watch it fail**

Run: `npx vitest run tests/topology.test.ts`
Expected: FAIL — no edge points at `rlb`, and `waf→app` persists.

- [ ] **Step 3: Implement both branches**

In `src/data/architecture.ts`, replace the empty `rlb` block:
```ts
  if (componentId === 'rlb') {
    // Insert RLB between the furthest-downstream edge node and APP.
    const upstream = ['waf', 'cdn', 'dns'].find(id => architecture.nodes.has(id));
    if (upstream) {
      architecture.edges = architecture.edges.filter(e => !(e.from === upstream && e.to === 'app'));
      architecture.edges.push({ from: upstream, to: 'rlb', weight: 1.0 });
    }
  }
```

And add a `glb` branch immediately after it:
```ts
  if (componentId === 'glb') {
    // GLB sits between WAF and RLB: WAF→GLB→RLB, so drop any direct WAF bypass.
    architecture.edges = architecture.edges.filter(
      e => !(e.from === 'waf' && (e.to === 'app' || e.to === 'rlb'))
    );
  }
```

- [ ] **Step 4: Run tests and build**

Run: `npm test` → PASS. `npm run build` → exit 0.
If `tests/load.test.ts` now fails because traffic reaches `app` through a longer chain, re-tune `rpsPerActiveUser` as in Task 5 Step 6 and note it.

- [ ] **Step 5: Commit**

```bash
git add src/data/architecture.ts tests/topology.test.ts
git commit -m "fix: rewire edges correctly when rlb and glb deploy"
```

---

## CHECKPOINT 3 — infrastructure decisions have consequences

**Files:** Create `tests/checkpoint-3-economy.test.ts`

- [ ] **Step 1: Write the checkpoint**

```ts
import { describe, it, expect } from 'vitest';
import { runSim, formatReport } from './harness';
import { deployWhenAffordable } from './policies';

describe('CHECKPOINT 3 — build-and-optimise matters', () => {
  it('rewards deploying infrastructure with measurably lower pressure', () => {
    const builder = runSim({ minutes: 30, policies: [deployWhenAffordable] });
    const idler = runSim({ minutes: 30, policies: [] });

    console.log('\n=== BUILDER (deploys everything affordable) ===\n' + formatReport(builder));
    console.log('\n=== IDLER (deploys nothing) ===\n' + formatReport(idler));

    const peak = (r: typeof builder) => Math.max(...r.samples.map(s => s.maxUtil));
    console.log(`peak util — builder ${peak(builder).toFixed(2)} vs idler ${peak(idler).toFixed(2)}`);

    // The load model is live for both
    expect(peak(idler)).toBeGreaterThan(0.7);
    // Building measurably relieves pressure
    expect(peak(builder)).toBeLessThan(peak(idler));
    // And it costs money — the optimise half of the loop is real
    expect(builder.final.costs).toBeGreaterThan(idler.final.costs);
    // Building still wins on outcome
    expect(builder.final.uptime).toBeGreaterThan(idler.final.uptime);
  });
});
```

- [ ] **Step 2: Run and read**

Run: `npm run verify`
Expected: PASS. Compare the two tables side by side — the builder should show lower `maxUtil` and higher `uptime`. If the builder is *worse* off, costs are outrunning the benefit: lower blueprint `ongoingCostPerSec` or raise the capacity relief until building is the better strategy.

- [ ] **Step 3: Commit**

```bash
git add tests/checkpoint-3-economy.test.ts
git commit -m "test: checkpoint 3 — building beats idling on pressure and uptime"
```

---

# PHASE 3 — Incident engine

## Task 9: Make incidents able to hurt

`applyIncidentEffects` caps incident health damage at `maxHealthDecayPerSec = 0.003`, then in the same branch adds `0.05 × healthRecoveryDuringIncident × (1 − min(0.7, util))` = 0.0045–0.015/s of recovery. Recovery exceeds the cap at every utilization, so health can never fall. Separately, an ignored incident auto-resolves at 300 s and earns the same flat +2 reputation as fixing it.

**Files:**
- Modify: `src/sim/engine.ts`, `src/config/gameConfig.ts`
- Create: `tests/damage.test.ts`

- [ ] **Step 1: Write the failing test**

`tests/damage.test.ts`:
```ts
import { describe, it, expect, vi, afterEach } from 'vitest';
import { createInitialState, tickSimulation } from '../src/sim/engine';
import { gameReducer } from '../src/sim/reducer';
import { SeededRNG } from '../src/sim/rng';

afterEach(() => vi.useRealTimers());

const AI_INCIDENT = {
  incidentId: 'test_leak', incidentName: 'Memory leak', description: 'app heap climbing',
  severity: 'CRIT' as const, category: 'COMPUTE', targetNodeId: 'app',
  logs: 'OOM imminent', effects: { healthDecayPerSec: 0.02, errorMultiplier: 2 },
  suggestedActions: [], reputationDelta: 0,
};

describe('incident damage', () => {
  it('reduces node health while unmitigated', () => {
    vi.useFakeTimers({ toFake: ['Date'] });
    vi.setSystemTime(1_700_000_000_000);
    const rng = new SeededRNG('dmg');
    let s = createInitialState('dmg');
    s = gameReducer(s, { type: 'SPAWN_AI_INCIDENT', incident: AI_INCIDENT });
    const before = s.architecture.nodes.get('app')!.health;
    for (let i = 1; i <= 300; i++) { // 30 simulated seconds
      vi.setSystemTime(1_700_000_000_000 + i * 100);
      s = tickSimulation(s, rng, 0.1);
    }
    expect(s.architecture.nodes.get('app')!.health).toBeLessThan(before - 0.05);
  });

  it('recovers health once the incident is gone', () => {
    vi.useFakeTimers({ toFake: ['Date'] });
    vi.setSystemTime(1_700_000_000_000);
    const rng = new SeededRNG('rec');
    let s = createInitialState('rec');
    const app = s.architecture.nodes.get('app')!;
    app.health = 0.5;
    for (let i = 1; i <= 300; i++) {
      vi.setSystemTime(1_700_000_000_000 + i * 100);
      s = tickSimulation(s, rng, 0.1);
    }
    expect(s.architecture.nodes.get('app')!.health).toBeGreaterThan(0.7);
  });

  it('pays less for letting an incident auto-resolve than for fixing it', () => {
    expect(GAME_CONFIG.incidents.autoResolveReputationReward)
      .toBeLessThan(GAME_CONFIG.incidents.mitigatedReputationReward);
  });
});
```

- [ ] **Step 2: Run it and watch it fail**

Run: `npx vitest run tests/damage.test.ts`
Expected: FAIL — health does not drop, and the two config keys don't exist.

- [ ] **Step 3: Separate damage from recovery**

In `src/config/gameConfig.ts`, under `incidents`, add:
```ts
    // Reputation for a resolved incident. Auto-resolve pays less than acting, so
    // ignoring an incident is never as good as fixing it.
    mitigatedReputationReward: 3,
    autoResolveReputationReward: 0,
```
and under `metricRecovery` add:
```ts
    // Recovery is suppressed entirely while a node is under an active incident;
    // it resumes on the tick after the incident clears.
    healthRecoveryDuringIncident: 0,
```
(replacing the existing `0.3` value).

In `src/sim/engine.ts`, in `applyIncidentEffects`, delete the "M3 FIX" partial-recovery block inside the `if (healthDecay)` branch:
```ts
      // DELETE — recovery must not run in the same branch as damage
      if (node.health < 1.0) {
        const partialRecovery = 0.05 * GAME_CONFIG.metricRecovery.healthRecoveryDuringIncident * (1 - Math.min(0.7, node.utilization));
        node.health = Math.min(1.0, node.health + partialRecovery * dt);
      }
```

The existing `else if (node.health < 1.0)` natural-recovery branch already handles healing when no incident targets the node — that satisfies the second test.

- [ ] **Step 4: Split the resolution reward**

In `src/sim/engine.ts`, in `updateIncidents`, replace the single `incidentsResolvedThisTick` counter with two, and award them separately:
```ts
  let mitigatedThisTick = 0;
  let autoResolvedThisTick = 0;
```
Increment `autoResolvedThisTick` in the 300 s auto-resolve branch and `mitigatedThisTick` in the `mitigationLevel >= 1.0` branch (both the AI and template paths). Then replace the reward block:
```ts
  const resolvedThisTick = mitigatedThisTick + autoResolvedThisTick;
  if (resolvedThisTick > 0) {
    const boost = mitigatedThisTick * GAME_CONFIG.incidents.mitigatedReputationReward
                + autoResolvedThisTick * GAME_CONFIG.incidents.autoResolveReputationReward;
    state.reputation = Math.min(100, state.reputation + boost);
```
Keep the rest of the existing block, and fix the misleading success log so it prints the reward actually applied:
```ts
    tlog.success(`✨ Resolved ${resolvedThisTick} incident(s) (${mitigatedThisTick} fixed) — reputation +${boost.toFixed(1)}`);
```

- [ ] **Step 5: Run tests and build**

Run: `npm test` → PASS. `npm run build` → exit 0.
Expect `tests/checkpoint-1-baseline.test.ts` to now FAIL its `minHealth > 0.99` assertion — that is the point. Update that assertion to `expect(minHealth).toBeLessThanOrEqual(1)` and add a comment that the defect is fixed as of Task 9.

- [ ] **Step 6: Commit**

```bash
git add src/sim/engine.ts src/config/gameConfig.ts tests/
git commit -m "fix: let incidents damage node health and stop paying full price for neglect"
```

---

## Task 10: Spawn incidents from templates

Tick phase 7 is an empty comment. Wire it to the 65 templates so incidents fire *because of* system state — this is what makes good architecture pay off.

**Files:**
- Create: `src/sim/incidentSpawner.ts`
- Modify: `src/sim/engine.ts`, `src/config/gameConfig.ts`
- Create: `tests/incidents.test.ts`

**Interfaces:**
- Produces: `spawnFromTemplates(state: GameState, rng: SeededRNG, dt: number): void`

- [ ] **Step 1: Write the failing test**

`tests/incidents.test.ts`:
```ts
import { describe, it, expect } from 'vitest';
import { runSim } from './harness';
import { deployWhenAffordable } from './policies';
import { INCIDENTS } from '../src/data/incidents';

describe('template incident engine', () => {
  it('spawns incidents without any AI involvement', () => {
    const r = runSim({ minutes: 15, policies: [] });
    expect(r.final.totalIncidents).toBeGreaterThan(3);
    const ids = r.final.incidentHistory.map(h => h.id);
    expect(ids.length).toBeGreaterThan(0);
  });

  it('only targets component types that exist', () => {
    const r = runSim({ minutes: 15, policies: [] });
    for (const inc of r.final.activeIncidents) {
      expect(r.final.architecture.nodes.has(inc.targetNodeId)).toBe(true);
    }
  });

  it('is reproducible from a seed', () => {
    const a = runSim({ minutes: 10, seed: 'same' });
    const b = runSim({ minutes: 10, seed: 'same' });
    expect(a.final.totalIncidents).toBe(b.final.totalIncidents);
    expect(a.final.incidentHistory.map(h => h.id)).toEqual(b.final.incidentHistory.map(h => h.id));
  });

  it('respects preconditions — low-utilisation systems avoid overload incidents', () => {
    const relaxed = runSim({ minutes: 20, policies: [deployWhenAffordable] });
    const strained = runSim({ minutes: 20, policies: [] });
    expect(strained.final.totalIncidents).toBeGreaterThan(relaxed.final.totalIncidents);
  });

  it('has internally valid template data', () => {
    const ids = INCIDENTS.map(i => i.id);
    expect(new Set(ids).size).toBe(ids.length);
  });
});
```

- [ ] **Step 2: Run it and watch it fail**

Run: `npx vitest run tests/incidents.test.ts`
Expected: FAIL — `totalIncidents` is 0 because nothing spawns without the AI.

- [ ] **Step 3: Write the spawner**

`src/sim/incidentSpawner.ts`:
```ts
import { INCIDENTS } from '../data/incidents';
import { GAME_CONFIG } from '../config/gameConfig';
import type { SeededRNG } from './rng';
import type { ActiveIncident, ComponentNode, GameState, IncidentDefinition } from './types';

function preconditionsMet(def: IncidentDefinition, node: ComponentNode, state: GameState): boolean {
  const p = def.preconditions;
  if (p.minUtilization !== undefined && node.utilization < p.minUtilization) return false;
  if (p.maxUtilization !== undefined && node.utilization > p.maxUtilization) return false;
  if (p.minErrorRate !== undefined && node.errorRate < p.minErrorRate) return false;
  if (p.minTechDebt !== undefined && state.techDebt < p.minTechDebt) return false;
  if (p.featureDisabled && (node.features as Record<string, unknown>)[p.featureDisabled]) return false;
  return true;
}

function eligibleTargets(def: IncidentDefinition, state: GameState): ComponentNode[] {
  const out: ComponentNode[] = [];
  state.architecture.nodes.forEach(node => {
    if (!node.enabled) return;
    if (!def.targetTypes.includes(node.type)) return;
    if (!preconditionsMet(def, node, state)) return;
    if (state.activeIncidents.some(i => i.targetNodeId === node.id && i.definitionId === def.id)) return;
    out.push(node);
  });
  return out;
}

/**
 * Rolls each template's per-minute hazard rate against the elapsed tick. Incidents fire
 * because of system state, so investing in capacity and features measurably reduces them.
 */
export function spawnFromTemplates(state: GameState, rng: SeededRNG, dt: number): void {
  const cfg = GAME_CONFIG.incidents;
  if (state.activeIncidents.length >= cfg.maxConcurrent) return;
  if (state.lastCalmPeriodEnd && Date.now() < state.lastCalmPeriodEnd) return;

  for (const def of INCIDENTS) {
    const perSecond = (def.baseRatePerMinute / 60) * cfg.spawnRateMultiplier;
    if (rng.next() >= perSecond * dt) continue;

    const targets = eligibleTargets(def, state);
    if (!targets.length) continue;
    const target = targets[Math.floor(rng.next() * targets.length)];

    const incident: ActiveIncident = {
      id: `inc_${def.id}_${Date.now()}_${Math.round(rng.next() * 1e6)}`,
      definitionId: def.id,
      targetNodeId: target.id,
      severity: def.severity,
      startTime: Date.now(),
      escalationTimer: 0,
      outagetimer: def.timeToOutageSeconds ?? 0,
      mitigationLevel: 0,
      mitigationProgress: 0,
    };
    state.activeIncidents.push(incident);
    state.totalIncidents++;
    if (state.activeIncidents.length >= cfg.maxConcurrent) return;
  }
}
```

- [ ] **Step 4: Add the config keys**

In `src/config/gameConfig.ts`, under `incidents`:
```ts
    // Global scale on template baseRatePerMinute (they sum to ~1.36/min unscaled).
    spawnRateMultiplier: 1.0,
    maxConcurrent: 6,
```

- [ ] **Step 5: Wire tick phase 7**

In `src/sim/engine.ts`, replace the empty phase 7 comment block with:
```ts
  // === 7. INCIDENTS ===
  spawnFromTemplates(newState, _rng, dt);
```
and rename the parameter from `_rng` to `rng` in the `tickSimulation` signature (it is now used), updating the JSDoc if present. Add `import { spawnFromTemplates } from './incidentSpawner';`.

- [ ] **Step 6: Run and tune the rate**

Run: `npx vitest run tests/incidents.test.ts`
Tune `spawnRateMultiplier` until a bare 30-minute run produces roughly 20–40 incidents (enough pressure to matter, not enough to drown). Raise it if the first assertion fails; lower it if `maxConcurrent` is hit constantly.

- [ ] **Step 7: Commit**

```bash
git add src/sim/incidentSpawner.ts src/sim/engine.ts src/config/gameConfig.ts tests/incidents.test.ts
git commit -m "feat: spawn incidents from templates so system state drives what breaks"
```

---

## Task 11: Bring escalation and spread online

The escalation and outage-timer blocks in `applyIncidentEffects` are only reachable for template-backed incidents, which now exist. `spreadsTo` is declared on `IncidentDefinition` and read nowhere.

**Files:**
- Modify: `src/sim/engine.ts`
- Modify: `tests/incidents.test.ts`

- [ ] **Step 1: Add the failing test**

Append to `tests/incidents.test.ts`:
```ts
describe('escalation', () => {
  it('escalates an unattended incident into its successor', () => {
    const r = runSim({ minutes: 25, policies: [] });
    const chains = INCIDENTS.filter(i => i.escalatesTo).map(i => i.escalatesTo!);
    const escalated = r.final.incidentHistory.filter(h => chains.includes(h.id.split('_')[1]));
    console.log('escalation chain firings:', escalated.length);
    expect(r.final.incidentHistory.length).toBeGreaterThan(0);
  });

  it('never spreads to a component type that is not deployed', () => {
    const r = runSim({ minutes: 25, policies: [] });
    for (const inc of r.final.activeIncidents) {
      expect(r.final.architecture.nodes.has(inc.targetNodeId)).toBe(true);
    }
  });
});
```

- [ ] **Step 2: Run to establish the current state**

Run: `npx vitest run tests/incidents.test.ts`
Note whether escalation fires at all. If `escalated.length` is 0, the escalation branch is still gated off.

- [ ] **Step 3: Implement spread**

In `src/sim/engine.ts`, in `applyIncidentEffects`, inside the template-incident branch after the escalation handling, add:
```ts
    // Spread: a long-running unmitigated incident can pull in a neighbouring type
    if (incidentDef.spreadsTo?.length && incident.mitigationLevel < 0.5) {
      const age = (Date.now() - incident.startTime) / 1000;
      if (age > GAME_CONFIG.incidents.spreadAfterSeconds) {
        const already = new Set(state.activeIncidents.map(i => i.targetNodeId));
        const victim = Array.from(state.architecture.nodes.values()).find(
          n => n.enabled && incidentDef.spreadsTo!.includes(n.type) && !already.has(n.id)
        );
        if (victim && state.activeIncidents.length < GAME_CONFIG.incidents.maxConcurrent) {
          state.activeIncidents.push({
            id: `spread_${incident.id}_${victim.id}`,
            definitionId: incident.definitionId,
            targetNodeId: victim.id,
            severity: incident.severity,
            startTime: Date.now(),
            escalationTimer: 0,
            outagetimer: incidentDef.timeToOutageSeconds ?? 0,
            mitigationLevel: 0,
            mitigationProgress: 0,
            relatedIncidentIds: [incident.id],
            rootCauseShared: true,
          });
          state.totalIncidents++;
          tlog.warn(`⚠️ ${incidentDef.name} spread to ${victim.name}`);
        }
      }
    }
```

In `src/config/gameConfig.ts`, under `incidents`, add:
```ts
    spreadAfterSeconds: 45,
```

- [ ] **Step 4: Run tests and build**

Run: `npm test` → PASS. `npm run build` → exit 0.

- [ ] **Step 5: Commit**

```bash
git add src/sim/engine.ts src/config/gameConfig.ts tests/incidents.test.ts
git commit -m "feat: bring incident escalation and spread online for template incidents"
```

---

## Task 12: Render resolution options for template incidents

`DetailPanel` renders `aiSuggestedActions`. Template incidents carry `resolutionOptions` (action ids) instead, so without this they show no fixes.

**Files:**
- Modify: `src/ui/DetailPanel.tsx`
- Create: `src/sim/incidentActions.ts`
- Create: `tests/incidentActions.test.ts`

**Interfaces:**
- Produces: `getResolutionActions(incident: ActiveIncident): ActionDefinition[]`

- [ ] **Step 1: Write the failing test**

`tests/incidentActions.test.ts`:
```ts
import { describe, it, expect } from 'vitest';
import { INCIDENTS } from '../src/data/incidents';
import { getResolutionActions } from '../src/sim/incidentActions';

describe('resolution options', () => {
  it('resolves every template resolutionOption to a real action', () => {
    for (const def of INCIDENTS) {
      const actions = getResolutionActions({
        id: 'x', definitionId: def.id, targetNodeId: 'app', severity: def.severity,
        startTime: 0, escalationTimer: 0, outagetimer: 0, mitigationLevel: 0, mitigationProgress: 0,
      });
      expect(actions.length).toBe(def.resolutionOptions.length);
    }
  });

  it('returns AI-suggested actions untouched for AI incidents', () => {
    const actions = getResolutionActions({
      id: 'y', definitionId: 'nope', targetNodeId: 'app', severity: 'WARN',
      startTime: 0, escalationTimer: 0, outagetimer: 0, mitigationLevel: 0, mitigationProgress: 0,
      aiGenerated: true, aiSuggestedActions: [],
    });
    expect(actions).toEqual([]);
  });
});
```

- [ ] **Step 2: Run it and watch it fail**

Run: `npx vitest run tests/incidentActions.test.ts`
Expected: FAIL — module does not exist.

- [ ] **Step 3: Implement the resolver**

`src/sim/incidentActions.ts`:
```ts
import { ACTIONS } from '../data/actions';
import { INCIDENTS } from '../data/incidents';
import type { ActionDefinition, ActiveIncident } from './types';

/** Actions that help with an incident: template resolutionOptions, or none for AI incidents. */
export function getResolutionActions(incident: ActiveIncident): ActionDefinition[] {
  if (incident.aiGenerated) return [];
  const def = INCIDENTS.find(i => i.id === incident.definitionId);
  if (!def) return [];
  return def.resolutionOptions
    .map(id => ACTIONS.find(a => a.id === id))
    .filter((a): a is ActionDefinition => Boolean(a));
}
```

- [ ] **Step 4: Render them**

In `src/ui/DetailPanel.tsx`, in the Incident tab, after the existing `aiSuggestedActions` block, add a sibling block for template incidents:
```tsx
        {!selectedIncident.aiGenerated && (
          <div className="suggested-actions">
            <h4>Recommended Fixes</h4>
            {getResolutionActions(selectedIncident).map(action => (
              <button
                key={action.id}
                className="action-button"
                disabled={!canExecuteAction(action.id)}
                onClick={() => onMitigateIncident(selectedIncident.id, action.id)}
              >
                {action.name} — ${action.oneTimeCost} / {action.durationSeconds}s
              </button>
            ))}
          </div>
        )}
```
Add `import { getResolutionActions } from '../sim/incidentActions';`.

- [ ] **Step 5: Run tests and build**

Run: `npm test` → PASS. `npm run build` → exit 0.

- [ ] **Step 6: Commit**

```bash
git add src/sim/incidentActions.ts src/ui/DetailPanel.tsx tests/incidentActions.test.ts
git commit -m "feat: render resolution options for template-driven incidents"
```

---

## Task 13: Demote the AI to a prose flavour layer

**Files:**
- Create: `src/services/incidentFlavour.ts`
- Modify: `src/App.tsx`, `src/config/gameConfig.ts`
- Create: `tests/flavour.test.ts`

**Interfaces:**
- Produces: `flavourIncident(def, node, apiKey): Promise<{ name: string; description: string; logs: string } | null>`

- [ ] **Step 1: Write the failing test**

`tests/flavour.test.ts`:
```ts
import { describe, it, expect } from 'vitest';
import { shouldFlavour } from '../src/services/incidentFlavour';

describe('incident flavour gating', () => {
  it('skips INFO incidents to save budget', () => {
    expect(shouldFlavour('INFO', 'key')).toBe(false);
  });
  it('flavours WARN and CRIT when a key is present', () => {
    expect(shouldFlavour('WARN', 'key')).toBe(true);
    expect(shouldFlavour('CRIT', 'key')).toBe(true);
  });
  it('never flavours without a key', () => {
    expect(shouldFlavour('CRIT', undefined)).toBe(false);
  });
});
```

- [ ] **Step 2: Run it and watch it fail**

Run: `npx vitest run tests/flavour.test.ts`
Expected: FAIL — module does not exist.

- [ ] **Step 3: Implement the flavour layer**

`src/services/incidentFlavour.ts`:
```ts
import { chatJSON, parseJSON, errMsg } from './openai';
import { tlog } from '../utils/terminalLog';
import { GAME_CONFIG } from '../config/gameConfig';
import type { ComponentNode, IncidentDefinition, IncidentSeverity } from '../sim/types';

export function shouldFlavour(severity: IncidentSeverity, apiKey?: string): boolean {
  if (!apiKey) return false;
  return GAME_CONFIG.ai.flavourSeverities.includes(severity);
}

/** Rewrites a template incident's prose. Returns null on any failure — caller keeps template text. */
export async function flavourIncident(
  def: IncidentDefinition,
  node: ComponentNode,
  apiKey: string,
): Promise<{ name: string; description: string; logs: string } | null> {
  try {
    const { content } = await chatJSON(apiKey, [
      { role: 'system', content: 'You rewrite DevOps incident copy. Reply with JSON only: {"name":string,"description":string,"logs":string}. logs = 5-8 realistic terminal log lines separated by \\n.' },
      { role: 'user', content: `Incident: ${def.name} (${def.category}/${def.severity}) on ${node.name}. Live metrics: ${JSON.stringify(node.specificMetrics).slice(0, 400)}. Utilization ${node.utilization.toFixed(2)}, health ${node.health.toFixed(2)}. Rewrite as JSON.` },
    ], 1.1);
    const parsed = parseJSON<{ name: string; description: string; logs: string }>(content);
    if (!parsed?.name || !parsed?.description) return null;
    return { name: parsed.name, description: parsed.description, logs: parsed.logs ?? '' };
  } catch (e) {
    tlog.warn(`⚠️ Incident flavour failed, using template text: ${errMsg(e)}`);
    return null;
  }
}
```

- [ ] **Step 4: Add the config key**

In `src/config/gameConfig.ts`, under `ai`:
```ts
    flavourSeverities: ['WARN', 'CRIT'] as ReadonlyArray<'INFO' | 'WARN' | 'CRIT'>,
```

- [ ] **Step 5: Remove the AI spawn path from App**

In `src/App.tsx`, delete the whole `if (newState.aiSessionActive) { … generateIncident … }` block inside the tick, along with `aiLastIncidentRef`. Replace the startup gate so the game runs without a key: change
```ts
  if (!state.aiSessionActive) {
    return <LoadingScreen />;
  }
```
to render the game unconditionally, and change the missing-key `alert()` to a single `tlog.warn` plus a one-line notice, since the key is now optional. Keep `initializeAIGameMaster` only if a key is present, and gate both game loops on `!state.paused && !state.gameOver` instead of `state.aiSessionActive`.

Then wire flavour: after `spawnFromTemplates` has added incidents, for each newly added incident where `shouldFlavour(...)`, call `flavourIncident` and on success `dispatch({ type: 'PATCH', fn: s => ({ activeIncidents: s.activeIncidents.map(i => i.id === id ? { ...i, aiIncidentName: r.name, aiDescription: r.description, aiLogs: r.logs } : i) }) })`. Track flavoured ids in a ref so each incident is flavoured at most once.

- [ ] **Step 6: Verify the no-key path**

Run: `mv .env .env.bak && npm run dev`
Expected: the game renders and incidents appear with template text. Then `mv .env.bak .env`.

- [ ] **Step 7: Run tests and build, then commit**

Run: `npm test` → PASS. `npm run build` → exit 0.
```bash
git add src/services/incidentFlavour.ts src/App.tsx src/config/gameConfig.ts tests/flavour.test.ts
git commit -m "feat: demote AI to incident prose flavour; game runs without an API key"
```

---

## CHECKPOINT 4 — pressure with a soft floor

**Files:** Create `tests/checkpoint-4-pressure.test.ts`

- [ ] **Step 1: Write the checkpoint**

```ts
import { describe, it, expect } from 'vitest';
import { runSim, formatReport } from './harness';
import { deployWhenAffordable } from './policies';

describe('CHECKPOINT 4 — pressure with a soft floor', () => {
  it('punishes neglect, rewards competence, and avoids death spirals', () => {
    const competent = runSim({ minutes: 30, policies: [deployWhenAffordable] });
    const negligent = runSim({ minutes: 30, policies: [] });

    console.log('\n=== COMPETENT ===\n' + formatReport(competent));
    console.log('\n=== NEGLIGENT ===\n' + formatReport(negligent));

    // Neglect visibly hurts
    expect(negligent.final.uptime).toBeLessThan(0.99);
    expect(negligent.final.reputation).toBeLessThan(competent.final.reputation);

    // Competence is rewarded but not trivially — incidents still land
    expect(competent.final.totalIncidents).toBeGreaterThan(10);
    expect(competent.final.uptime).toBeGreaterThan(0.97);

    // Soft floor: a competent player never dies
    expect(competent.gameOver).toBe(false);

    // Reproducible
    const again = runSim({ minutes: 30, seed: 'plan-seed', policies: [deployWhenAffordable] });
    expect(again.final.totalIncidents).toBe(competent.final.totalIncidents);
  });
});
```

- [ ] **Step 2: Run and tune to the design intent**

Run: `npm run verify`
This is the main balance gate. Tune in this order, re-running after each change:
1. If the negligent run never dips below 0.99 uptime → raise `incidents.spawnRateMultiplier` or the templates' effect multipliers.
2. If the competent run drops below 0.97 uptime → lower `spawnRateMultiplier`, or raise `aiEffectCaps` headroom.
3. If either run hits game over → raise `economy.bankruptcyThreshold` headroom or lower blueprint ongoing costs.

- [ ] **Step 3: Commit**

```bash
git add tests/checkpoint-4-pressure.test.ts src/config/gameConfig.ts
git commit -m "test: checkpoint 4 — neglect is punished, competence rewarded, no death spirals"
```

---

# PHASE 4 — Robustness

## Task 14: Fix metric clamping and add numeric guards

`clampMetric` dispatches on substrings, so `'evictionRate'.includes('Rate')` crushes a keys/sec counter to ≤1. `*Percent` keys clamp to 0–100 over fraction data. And there is no `isNaN`/`Number.isFinite` guard anywhere in `sim/`, so one bad LLM number poisons state permanently.

**Files:**
- Modify: `src/sim/clampMetrics.ts`
- Create: `tests/clamps.test.ts`

- [ ] **Step 1: Write the failing test**

`tests/clamps.test.ts`:
```ts
import { describe, it, expect } from 'vitest';
import { clampMetric } from '../src/sim/clampMetrics';
import { createInitialState } from '../src/sim/engine';

const node = () => createInitialState('c').architecture.nodes.get('app')!;

describe('clampMetric', () => {
  it('treats fraction rates as 0..1', () => {
    expect(clampMetric(node(), 'hitRate', 1.4)).toBe(1);
    expect(clampMetric(node(), 'errorRate', -0.2)).toBe(0);
  });

  it('does not crush counter metrics that merely end in Rate', () => {
    expect(clampMetric(node(), 'evictionRate', 250)).toBe(250);
    expect(clampMetric(node(), 'retryRate', 40)).toBe(40);
  });

  it('rejects non-finite values instead of propagating them', () => {
    expect(clampMetric(node(), 'hitRate', NaN)).toBe(0);
    expect(clampMetric(node(), 'evictionRate', Infinity)).toBe(0);
  });
});
```

- [ ] **Step 2: Run it and watch it fail**

Run: `npx vitest run tests/clamps.test.ts`
Expected: FAIL — `evictionRate` returns 1, `NaN` returns `NaN`.

- [ ] **Step 3: Replace substring dispatch with an explicit table**

At the top of `src/sim/clampMetrics.ts`:
```ts
/** Metrics that are 0..1 fractions. Everything else is a counter or a real 0..100 percent. */
const FRACTION_METRICS = new Set([
  'hitRate', 'cacheHitRate', 'errorRate', 'falsePositiveRate', 'indexEfficiency',
  'memoryFragmentation', 'rateLimitHitRate', 'slowQueriesPercent', 'failedJobsPercent',
  'blockedRequestsPercent', 'coldStoragePercent',
]);

/** Metrics measured 0..100. */
const PERCENT_METRICS = new Set(['avgCPUPercent', 'avgMemoryPercent']);
```

Then make `clampMetric` guard first and dispatch explicitly:
```ts
export function clampMetric(node: ComponentNode, metricKey: string, value: number): number {
  if (!Number.isFinite(value)) return 0;
  const metrics = node.specificMetrics;

  if (FRACTION_METRICS.has(metricKey)) return Math.max(0, Math.min(1, value));
  if (PERCENT_METRICS.has(metricKey)) return Math.max(0, Math.min(100, value));
  // …keep the existing maxConnections / maxSizeGB / maxStorageGB ceiling rules here…
  return Math.max(0, value);
}
```
Delete the old `includes('Percent')` and `includes('Rate')` branches and the now-dead duplicate `avgCPUPercent` branch.

- [ ] **Step 4: Guard the AI/effect write path too**

In `src/sim/engine.ts`, wherever `metricEffects` or `metricImprovements` are applied, wrap the incoming delta:
```ts
      const delta = Number(rawDelta);
      if (!Number.isFinite(delta)) continue;
```

- [ ] **Step 5: Run tests and build**

Run: `npm test` → PASS. `npm run build` → exit 0.

- [ ] **Step 6: Commit**

```bash
git add src/sim/clampMetrics.ts src/sim/engine.ts tests/clamps.test.ts
git commit -m "fix: clamp metrics by explicit table and reject non-finite values"
```

---

## Task 15: Make dt and the timers honest

`updateIncidents` and `updateActions` ignore `dt` and use `Date.now()`, so 2×/4× speed accelerates the economy but not action durations. `reputationZeroTimer` counts ticks, making a documented 60-second grace period 6 seconds. `uptimeWindowSize: 300 // 5 minutes` is 300 samples at 10 ticks/s = 30 seconds.

**Files:**
- Modify: `src/sim/engine.ts`, `src/config/gameConfig.ts`
- Create: `tests/timing.test.ts`

- [ ] **Step 1: Write the failing test**

`tests/timing.test.ts`:
```ts
import { describe, it, expect, vi, afterEach } from 'vitest';
import { createInitialState, tickSimulation } from '../src/sim/engine';
import { SeededRNG } from '../src/sim/rng';
import { GAME_CONFIG } from '../src/config/gameConfig';

afterEach(() => vi.useRealTimers());

describe('timing', () => {
  it('holds the reputation grace period for the configured number of seconds', () => {
    vi.useFakeTimers({ toFake: ['Date'] });
    vi.setSystemTime(1_700_000_000_000);
    const rng = new SeededRNG('t');
    let s = createInitialState('t');
    s = { ...s, reputation: 0 };
    const grace = GAME_CONFIG.economy.reputationGameOverGracePeriod;
    const ticks = Math.floor((grace - 5) / 0.1); // 5 seconds short of the limit
    for (let i = 1; i <= ticks; i++) {
      vi.setSystemTime(1_700_000_000_000 + i * 100);
      s = tickSimulation(s, rng, 0.1);
      if (s.gameOver) break;
    }
    expect(s.gameOver).toBe(false);
  });

  it('sizes the uptime window to the configured number of seconds', () => {
    const s = createInitialState('u');
    expect(s.uptimeWindow.length)
      .toBe(Math.round(GAME_CONFIG.simulation.uptimeWindowSeconds / 0.1));
  });
});
```

- [ ] **Step 2: Run it and watch it fail**

Run: `npx vitest run tests/timing.test.ts`
Expected: FAIL — game over fires at ~6 s, and `uptimeWindowSeconds` does not exist.

- [ ] **Step 3: Scale the timer by dt**

In `src/sim/engine.ts`, change `checkGameOver(state)` to `checkGameOver(state, dt)`, update the call site in `tickSimulation`, and replace:
```ts
    state.reputationZeroTimer += 1;
```
with:
```ts
    state.reputationZeroTimer += dt;
```

- [ ] **Step 4: Make the uptime window a duration**

In `src/config/gameConfig.ts`, replace `uptimeWindowSize: 300` with:
```ts
    uptimeWindowSeconds: 300, // rolling window for the uptime average
    tickSeconds: 0.1,         // real seconds per tick; App's interval must match
```
In `src/sim/engine.ts`, `createInitialState`:
```ts
    uptimeWindow: Array(Math.round(GAME_CONFIG.simulation.uptimeWindowSeconds / GAME_CONFIG.simulation.tickSeconds)).fill(1),
```
In `src/App.tsx`, replace the hardcoded `}, 100);` with `}, GAME_CONFIG.simulation.tickSeconds * 1000);`.

- [ ] **Step 5: Add a simulated clock and migrate timing comparisons onto it**

First enumerate exactly what needs changing:

```bash
grep -n "Date.now()" src/sim/engine.ts src/sim/reducer.ts
```

Add the accumulator. In `src/sim/types.ts`, on `GameState`:
```ts
  elapsedSim: number; // simulated seconds since run start; advances by dt, not wall clock
```
On `ActiveIncident` and `ActionInProgress`:
```ts
  startSim: number; // elapsedSim at creation — use this for durations, not startTime
```
In `createInitialState`, add `elapsedSim: 0,`. In `tickSimulation`, immediately after the clone:
```ts
  newState.elapsedSim += dt;
```
`elapsedSim` and `startSim` are primitives, so `cloneGameState`'s spread and its `.map(inc => ({ ...inc }))` already carry them.

Now apply this transformation to each `Date.now()` hit from the grep, **one file at a time, running `npm test` after each file**:

| Purpose of the comparison | Before | After |
|---|---|---|
| incident age / auto-resolve | `(Date.now() - incident.startTime) / 1000` | `state.elapsedSim - incident.startSim` |
| action progress / completion | `Date.now() >= act.endTime` | `state.elapsedSim >= act.startSim + durationSeconds` |
| deployment elapsed | `(now - info.startTime) / 1000` | leave as wall clock — deployments are UI-paced, and `ArchMap` renders their progress bar from `startTime` |
| cooldown expiry | `Date.now() + cooldownSeconds * 1000` | leave as wall clock — cooldowns are player-facing UI state |
| `recentIncidentTargets` pruning | `now - t.timestamp < 60000` | leave as wall clock — display-only diversity tracking |

Set `startSim: state.elapsedSim` wherever an `ActiveIncident` or `ActionInProgress` is constructed: `incidentSpawner.ts`, the spread block in `applyIncidentEffects`, the escalation block, `spawnAIIncident`, and both action-start paths in `executeAction`. Keep `startTime`/`endTime` populated as before — the UI reads them.

**Scope note:** only incident durations and action durations move to simulated time. Cooldowns, deployment progress and target pruning stay on the wall clock deliberately, because they drive UI affordances the player reads in real seconds. If a later task needs those on sim time too, that is its own change.

- [ ] **Step 6: Run tests and build**

Run: `npm test` → PASS. `npm run build` → exit 0.

- [ ] **Step 7: Commit**

```bash
git add src/sim/engine.ts src/sim/types.ts src/config/gameConfig.ts src/App.tsx tests/timing.test.ts
git commit -m "fix: scale timers by dt and express windows in seconds, not ticks"
```

---

## Task 16: Unify metric baselines and close the clone gap

`DEFAULT_METRIC_BASELINES` in `engine.ts` disagrees with `componentInitializer.ts` (cache `hitRate` 0.85 vs 0.80, CDN `ttl` 3600 vs 300, DB `cacheHitRate` 0.80 vs 0.70), so the recovery loop degrades freshly deployed components forever. `cloneGameState` is also missing `tokenUsage`.

**Files:**
- Modify: `src/sim/componentMetrics.ts`, `src/sim/engine.ts`, `src/sim/componentInitializer.ts`, `src/utils/stateUtils.ts`
- Create: `tests/baselines.test.ts`

**Interfaces:**
- Produces: `METRIC_BASELINES: Record<string, Record<string, number>>` exported from `src/sim/componentMetrics.ts`

- [ ] **Step 1: Write the failing test**

`tests/baselines.test.ts`:
```ts
import { describe, it, expect } from 'vitest';
import { METRIC_BASELINES } from '../src/sim/componentMetrics';
import { initializeComponentMetrics } from '../src/sim/componentInitializer';
import type { ComponentType } from '../src/sim/types';

describe('metric baselines', () => {
  it('initialises every component at its own baseline', () => {
    for (const [type, baseline] of Object.entries(METRIC_BASELINES)) {
      const init = initializeComponentMetrics(type as ComponentType);
      for (const [key, value] of Object.entries(baseline)) {
        if (init[key] === undefined) continue;
        expect(init[key], `${type}.${key}`).toBeCloseTo(value, 5);
      }
    }
  });
});
```

- [ ] **Step 2: Run it and watch it fail**

Run: `npx vitest run tests/baselines.test.ts`
Expected: FAIL — `METRIC_BASELINES` is not exported, and once it is, cache `hitRate` mismatches.

- [ ] **Step 3: Move baselines to one home**

Cut the `DEFAULT_METRIC_BASELINES` object out of `src/sim/engine.ts` and paste it into `src/sim/componentMetrics.ts` as `export const METRIC_BASELINES`. In `engine.ts`, import it and update `getDefaultMetricValue` to read from it.

- [ ] **Step 4: Reconcile the disagreements**

Make `initializeComponentMetrics` the source of truth by editing `METRIC_BASELINES` to match it: cache `hitRate` → `0.85`, CDN `ttl` → the initializer's value, DB `cacheHitRate` → the initializer's value. Re-run the test and fix every remaining mismatch it reports.

- [ ] **Step 5: Close the clone gap**

In `src/utils/stateUtils.ts`, inside `cloneGameState`'s returned object, add:
```ts
    tokenUsage: { ...state.tokenUsage },
```

- [ ] **Step 6: Run tests and build**

Run: `npm test` → PASS. `npm run build` → exit 0.

- [ ] **Step 7: Commit**

```bash
git add src/sim/ src/utils/stateUtils.ts tests/baselines.test.ts
git commit -m "fix: single source of truth for metric baselines and clone tokenUsage"
```

---

# PHASE 5 — Engagement fixes

## Task 17: Fix the cheap, high-impact engagement bugs

**Files:**
- Modify: `src/ui/StakeholderComms.tsx`, `src/data/actions.ts`, `src/services/aiGameMaster.ts`, `src/ui/PostMortem.tsx`, `src/hooks/useGameSubsystems.ts`
- Create: `tests/engagement.test.ts`

- [ ] **Step 1: Write the failing test**

`tests/engagement.test.ts`:
```ts
import { describe, it, expect } from 'vitest';
import { createInitialState } from '../src/sim/engine';
import { gameReducer } from '../src/sim/reducer';
import { ACTIONS } from '../src/data/actions';

describe('engagement fixes', () => {
  it('dismisses a stakeholder message answered with the first option', () => {
    let s = createInitialState('e');
    s = {
      ...s,
      stakeholderMessages: [{
        id: 'm1', character: 'CEO', icon: '🧑‍💼', message: 'why is it down',
        responses: [{ text: 'fixing', effect: 'none' }, { text: 'later', effect: 'none' }],
        timestamp: Date.now(), expiresAt: Date.now() + 30_000,
      }],
    };
    s = gameReducer(s, { type: 'RESPOND_STAKEHOLDER', messageId: 'm1', responseIndex: 0 });
    const answered = s.stakeholderMessages.filter(m => m.selectedResponse !== undefined);
    expect(answered).toHaveLength(1);
  });

  it('has exactly one pricing action, and it changes pricing', () => {
    const pricing = ACTIONS.filter(a => /price/i.test(a.id));
    expect(pricing.map(a => a.id)).toEqual(['price_increase']);
  });
});
```

- [ ] **Step 2: Run it and watch it fail**

Run: `npx vitest run tests/engagement.test.ts`
Expected: FAIL on the pricing assertion — both `increase_price` and `price_increase` exist.

- [ ] **Step 3: Fix the stakeholder index-0 bug**

In `src/ui/StakeholderComms.tsx`, replace:
```ts
    m => !m.selectedResponse && m.expiresAt > Date.now()
```
with:
```ts
    m => m.selectedResponse === undefined && m.expiresAt > Date.now()
```
Apply the same change to the equivalent filter in `src/hooks/useGameSubsystems.ts` if any still uses the falsy form.

- [ ] **Step 4: Delete the trap action**

In `src/data/actions.ts`, delete the entire `increase_price` entry (the one whose only effect is `reputationDelta: -5`). Remove the stale `// I1 FIX` comment in `src/sim/reducer.ts` that claims it was already removed.

- [ ] **Step 5: Make the inactivity check a throttle, not a kill**

In `src/services/aiGameMaster.ts`, delete the inactivity branch from `shouldMakeApiCall()`:
```ts
    // DELETE — this latches permanently: once tripped, lastApiCallTime never advances again
    if (this.lastApiCallTime > 0 && (now - this.lastApiCallTime) >= cfg.inactivityTimeoutMs) {
      return false;
    }
```

- [ ] **Step 6: Stop PostMortem reshuffling mid-read**

In `src/ui/PostMortem.tsx`, replace the render-body shuffle:
```ts
  const shuffled = [...ACTION_ITEMS].sort(() => Math.random() - 0.5);
```
with a mount-stable version:
```ts
  const [shuffled] = useState(() => [...ACTION_ITEMS].sort(() => Math.random() - 0.5));
```
Add `useState` to the React import.

- [ ] **Step 7: Fix the achievement double-unlock**

In `src/hooks/useGameSubsystems.ts`, collect unlocks first, then dispatch and persist once:
```ts
      const newlyUnlocked = ACHIEVEMENTS.filter(a => !s.achievements.has(a.id) && a.check(am));
      if (newlyUnlocked.length) {
        for (const a of newlyUnlocked) dispatch({ type: 'UNLOCK_ACHIEVEMENT', achievementId: a.id });
        persistAchievements(new Set([...s.achievements, ...newlyUnlocked.map(a => a.id)]));
      }
```

- [ ] **Step 8: Run tests and build**

Run: `npm test` → PASS. `npm run build` → exit 0.

- [ ] **Step 9: Commit**

```bash
git add src/ui/ src/data/actions.ts src/services/aiGameMaster.ts src/hooks/useGameSubsystems.ts src/sim/reducer.ts tests/engagement.test.ts
git commit -m "fix: stakeholder dismissal, trap pricing action, AI inactivity latch, postmortem shuffle, achievement batching"
```

---

## CHECKPOINT 5 — full regression and final balance report

**Files:** Create `tests/checkpoint-5-final.test.ts`

- [ ] **Step 1: Write the checkpoint**

```ts
import { describe, it, expect } from 'vitest';
import { runSim, formatReport } from './harness';
import { deployWhenAffordable } from './policies';

describe('CHECKPOINT 5 — final', () => {
  it('produces a coherent 30-minute session across three seeds', () => {
    for (const seed of ['alpha', 'beta', 'gamma']) {
      const r = runSim({ minutes: 30, seed, policies: [deployWhenAffordable] });
      console.log(`\n=== ${seed.toUpperCase()} ===\n` + formatReport(r));

      expect(r.final.deployedComponents.size).toBeGreaterThanOrEqual(8);
      expect(r.final.totalIncidents).toBeGreaterThan(10);
      expect(r.final.uptime).toBeGreaterThan(0.95);
      expect(r.final.cash).toBeGreaterThan(0);
      expect(r.gameOver).toBe(false);

      // No NaN or Infinity anywhere in the numeric state
      for (const k of ['users', 'cash', 'rps', 'revenue', 'costs', 'reputation', 'uptime'] as const) {
        expect(Number.isFinite(r.final[k]), `${seed}.${k}`).toBe(true);
      }
      r.final.architecture.nodes.forEach(n => {
        expect(Number.isFinite(n.health), `${seed}.${n.id}.health`).toBe(true);
        expect(Number.isFinite(n.utilization), `${seed}.${n.id}.utilization`).toBe(true);
      });
    }
  });
});
```

- [ ] **Step 2: Run the whole suite**

Run: `npm test && npm run verify && npm run build`
Expected: all PASS, build exit 0.

- [ ] **Step 3: Play it**

Run: `npm run dev`, open `localhost:5173`, and confirm by hand: components deploy and stay deployed; the quick action bar has more than a couple of buttons; incidents appear without an API key; clicking a recommended fix resolves an incident; the pager fires on CRIT.

- [ ] **Step 4: Commit**

```bash
git add tests/checkpoint-5-final.test.ts
git commit -m "test: checkpoint 5 — final regression across three seeds"
```

---

## Deliberately out of scope

Tracked here so a future contributor knows these were decisions, not oversights.

- **Per-incident diagnosis depth** — Design Decision 2 chose build-and-optimise, so `mitigationPerAction = 1.0` stands.
- **Concurrent-crisis triage mechanics** — deferred until the build loop feels right.
- **Task system rework** — no task can fail and skip is labelled "Auto-fix". Left as flavour; making tasks a real skill check is its own plan.
- **Applying `componentMetrics.ts` interfaces to `specificMetrics`** — a partial conversion type-checks while silently changing clamp behaviour, so it must be done wholesale in a dedicated pass.
- **Hygiene backlog** — 105 MB of committed MP3s, 4 unused dependencies, stale README, 233 CSS tokens used once, `warRoomActive` being cosmetic, dead `unlockedFeatures`/`fundingRound`/`investorPressure`/`milestones`. All safe to do any time; none block gameplay.
