# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## What this is

**UPTIME 99.99** — a browser-only DevOps/SRE simulation game. React 18 + TypeScript + Vite, no backend. A tick-based simulation engine models a production architecture; incidents are generated at runtime by an LLM that reads the live component metrics.

## Commands

```bash
npm install
npm run dev          # Vite dev server (http://localhost:5173)
npm run build        # tsc && vite build  <- the only correctness gate in the repo
npm run preview      # serve the production build
npx tsc --noEmit     # typecheck only (faster than full build)
```

There is **no test suite, no test runner, and no ESLint config**. `npm run build` (i.e. `tsc`) is the whole verification story, and `tsconfig.json` runs `strict` + `noUnusedLocals` + `noUnusedParameters`, so unused imports/params are build errors. Run it before reporting work done.

### Required environment

`.env` in the project root (gitignored):

```
VITE_OPENAI_API_KEY=sk-...     # required — game will not start without it
VITE_LOG_LEVEL=DEBUG           # optional — enables tlog.debug() output
```

The key must literally start with `sk-`. If it's missing or malformed, `App.tsx` shows an `alert()` and renders `LoadingScreen` **forever** — `aiSessionActive` never flips true, so nothing renders and no ticks run. Vite only reads `.env` at startup: **restart the dev server** after changing it. Note this is a client-side app, so the key is bundled into the JS.

### Browser → terminal logging

`vite-plugin-terminal-logger.ts` (registered in `vite.config.ts`) adds a `/api/log` dev-server endpoint; `src/utils/terminalLog.ts` (`tlog.info/warn/error/success/system/debug`) POSTs to it so browser-side game events print, color-coded, in the `npm run dev` terminal. Dev-only — it no-ops in production builds. This is the primary way to observe the running simulation; prefer adding `tlog` calls over `console.log`.

## Architecture

### The game loop lives in App.tsx, not in the reducer

`src/App.tsx` owns two `setInterval`s, both gated on `state.aiSessionActive && !state.paused && !state.gameOver`:

- **100 ms sim tick** — calls `tickSimulation(stateRef.current, rng, dt)` from `src/sim/engine.ts`, then commits with `dispatch({ type: 'LOAD_GAME', state: newState })`. Also fires the AI incident scheduler and `DEPLOYMENT_COMPLETE`.
- **500 ms "enhancement" loop** — stakeholder messages, pager, war room, status-page accuracy penalty, post-mortem queue, achievement checks, message expiry.

Two consequences that bite:

1. The reducer's `TICK` case is a deliberate **no-op**; `LOAD_GAME` is the generic "replace the entire state" escape hatch and is used all over `App.tsx`, not just for loading saves.
2. Inside any interval or async callback, **always read `stateRef.current`, never the `state` closure**. The 100 ms tick and 500 ms loop both wholesale-replace state, so a stale read silently discards concurrent user actions. Existing code follows this convention — keep it.

`dt` is real elapsed seconds × `state.speed` (1/2/4×).

### `cloneGameState()` is a hand-maintained deep clone — the top gotcha

`src/utils/stateUtils.ts:cloneGameState()` is the single clone entry point, used by `tickSimulation` and every reducer case. It enumerates every `Map`, `Set`, array, and nested object on `GameState` by hand.

**When you add a field to `GameState` in `src/sim/types.ts` that isn't a primitive, you must add it to `cloneGameState()`** (and `cloneComponentNode()` for node fields). Otherwise it aliases across ticks, engine helpers mutate the previous state in place, and you get bugs that look like time travel. Same file also has `validateGameState()` / `sanitizeGameState()`.

Engine helpers (`propagateLoad`, `applyIncidentEffects`, `updateBusiness`, …) **mutate** the already-cloned state rather than returning new objects. That's intentional; follow it.

`src/utils/stateSync.ts` (`stateSyncManager`) exists but nothing imports it.

### Simulation tick order (`src/sim/engine.ts`)

`tickSimulation` runs 12 numbered phases in a fixed order: traffic generation → `propagateLoad` → `applyIncidentEffects` → `computeGlobalMetrics` → `updateUptime` → `updateBusiness` → (phase 7, legacy template-based incident spawning, disabled) → prune `recentIncidentTargets` → `updateIncidents` → `updateActions` → `checkGameOver` → `updateStress`. Order matters — load must propagate before incident effects distort it, and metrics must be computed before uptime/business consume them.

`createInitialState()` also lives here and uses `createMinimalArchitecture()` (not `createInitialArchitecture()`).

### Single source of truth: `state.architecture.nodes`

A `Map<string, ComponentNode>` plus a flat `edges` array. Everything flows from it: actions write to it, the engine reads/writes it, `serializeGameState()` feeds it to the LLM, and `ui/ArchMap.tsx` is a **read-only** SVG view (it must never mutate nodes).

### Component-specific metrics are spread across four files

`node.specificMetrics` is typed `Record<string, any>`, so TypeScript will not catch mistakes here. Adding or changing a per-component metric means touching all four:

| File | Role |
|---|---|
| `src/sim/componentMetrics.ts` | the per-type metric interfaces (`CacheMetrics`, `DatabaseMetrics`, …) |
| `src/sim/componentInitializer.ts` | `initializeComponentMetrics()` — default values per `ComponentType` |
| `src/sim/engine.ts` → `DEFAULT_METRIC_BASELINES` | the value a metric decays back toward when healthy |
| `src/sim/clampMetrics.ts` | `clampMetric()` — bounds, applied on every write |

`clampMetric` dispatches on **substrings of the metric name** (`*Percent` → 0–100, `*Rate` → 0–1, `connections` ≤ `maxConnections`, …), so metric naming is load-bearing.

### Incidents are AI-generated; `data/incidents.ts` is a legacy catalog

All OpenAI traffic goes through `src/services/openai.ts` — `chatJSON()` (fetch, no SDK; JSON mode, so every prompt must keep the word "JSON" in it; throws an actionable message on any failure, caller logs it) and `parseJSON()` (slices the outermost `{ … }` so fences or stray prose can't break parsing). Model, pricing, and `max_completion_tokens` live in `GAME_CONFIG.ai`; the API takes `max_completion_tokens`, not the deprecated `max_tokens`. Truncation, refusals, and API errors are logged via `tlog`, so if the AI seems dead the reason is in the `npm run dev` terminal.

Its two callers: `aiGameMaster.ts`, a singleton (`initializeAIGameMaster` / `getAIGameMaster` / `resetAIGameMaster`) that resets `conversationHistory` to the system prompt before every call, and `taskGenerator.ts`. There is **no schema validation** beyond a required-fields check, so guard for missing fields.

Despite `ai`, `@ai-sdk/openai`, `@ai-sdk/react`, and `zod` sitting in `package.json`, **nothing imports them** — and the README's "GPT-4" claim is stale.

AI-generated incidents store their content in the `ai*` fields of `ActiveIncident` (`aiIncidentName`, `aiDescription`, `aiLogs`, `aiSuggestedActions`, `aiEffects`). `src/data/incidents.ts` (`INCIDENTS`) is the older hand-written template catalog; it's still read by `engine.ts`, `reducer.ts`, `IncidentFeed`, and `DetailPanel` to resolve `definitionId` → definition for escalation and display, but it is no longer a spawn source.

### API budget guards — check these first when the AI "stops working"

`GAME_CONFIG.session`: `maxApiCalls: 200`, `maxDurationMs: 30 min`, `inactivityTimeoutMs: 5 min`, plus a 30 s calm period after resolving a CRIT. `AIGameMaster.shouldMakeApiCall()` gates every request and silently returns `false` past a limit. `src/services/taskGenerator.ts` keeps its own independent counter capped at 25 % of `maxApiCalls`. Incidents also stop during the calm period and while `document.hidden`.

### Progressive architecture

Runs start with only `dns`, `app`, `db_primary` (`STARTING_COMPONENTS` / `STARTING_EDGES` in `src/config/progressionConfig.ts`). Everything else is a `ComponentBlueprint` in `COMPONENT_BLUEPRINTS`, unlocked by `unlockConditions` (users / elapsed time / incident count / reputation) and `prerequisites`. Flow: `ArchMap` → `DEPLOY_COMPONENT` → `deployComponent()` in `src/data/architecture.ts` writes into `deployingComponents` → App's tick detects the elapsed timer and dispatches `DEPLOYMENT_COMPLETE`. The AI system prompt is explicitly told to only target already-deployed nodes.

### Actions

`ACTIONS` in `src/data/actions.ts` is the concatenation of its own list plus `COST_SAVING_ACTIONS` (`costSavingActions.ts`) and `DYNAMIC_ACTIONS` (`dynamicActions.ts`) — all consumers import `ACTIONS`, so new action files must be spread in there. `ActionDefinition` (in `sim/types.ts`) is declarative: `requires` gates availability, `effects` covers stat changes, feature toggles, `metricImprovements`, and the dynamic-architecture operations `addComponent` / `removeComponent` / `splitService`, all interpreted by `executeAction()` in `src/sim/reducer.ts`. Prefer `getActionTiming('fast'|'medium'|'slow'|'verySlow')` over inline duration/cooldown numbers.

Incidents can share a root cause (`relatedIncidentIds` / `rootCauseShared`); use the shared `applyRelatedMitigation()` helper in `reducer.ts` rather than re-implementing the fan-out.

### Balance and tuning

`src/config/gameConfig.ts` (`GAME_CONFIG`) is the declared single source of truth for economy, growth, reputation, incident hazard/effect caps, session limits, metric recovery rates, action timings, activity-by-hour curve, stress, and UI panel sizes. Tune there; don't reintroduce magic numbers into the engine.

## Known stale/dead spots

- `src/utils/saveLoad.ts` (`saveGame`/`loadGame`/`hasSavedGame`) is **not imported anywhere**, and `GAME_CONFIG.simulation.autosaveIntervalSec` is unused. The README's autosave / Save-Load-button claims do not reflect the code. Achievements *are* persisted separately via `persistAchievements()` in `src/data/achievements.ts`.
- `src/utils/stateSync.ts` is unused.
- The README is long and mostly accurate on game design, but treat its technical claims (GPT-4, autosave, AI SDK usage) as out of date; the code above wins.
- `docs/COMPONENT_DESIGN.md` is an aspirational design doc — its `metrics`/`config` nesting does not match the flat `specificMetrics` shape actually implemented.

## Conventions

- Numbered/lettered comment tags like `// C4.2 FIX`, `// O1`, `// BAL-8`, `// A6 FIX` mark prior fixes and tuning decisions. Leave them in place.
- Health, error rates, and uptime are 0–1 fractions; reputation, tech debt, burnout, and alert fatigue are 0–100. `utilization` is unbounded above (>1 means overloaded).
- Styles are plain CSS in `src/styles/*.css`, imported from `App.tsx` (dark terminal theme, neon accents). No CSS framework.
- `SeededRNG` (`src/sim/rng.ts`) makes the sim deterministic in principle, but LLM responses and `Date.now()` mean runs are not actually reproducible from a seed.
