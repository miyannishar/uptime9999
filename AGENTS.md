# AGENTS.md

This file provides guidance to Codex (Codex.ai/code) when working with code in this repository.

**This file is authoritative over `README.md`.** The README is a design document that has drifted from the code (it still lists deleted modules, "70+ actions", GPT-4, autosave, and a milestone-unlock system that was never implemented). Where they disagree, trust this file and the code.

## What this is

**UPTIME 99.99** — a browser-only DevOps/SRE incident-response game. React 18 + TypeScript + Vite, no backend, no persistence. A 100 ms tick engine simulates a production architecture; incidents are generated at runtime by an LLM that reads live component metrics. A run is capped at 30 minutes.

~13.5k LOC in `src/`: data 4.0k · styles 3.5k · sim 3.1k · ui 2.9k (+1.1k tasks) · services 0.8k · config 0.5k.

## Commands

```bash
npm install
npm run dev          # Vite dev server (http://localhost:5173)
npm run build        # tsc && vite build  <- the only correctness gate in the repo
npm run preview      # serve the production build
npx tsc --noEmit     # typecheck only (faster)
```

**No test suite, no test runner, no ESLint, no CI, no formatter.** `npm run build` is the whole verification story. `tsconfig.json` runs `strict` + `noUnusedLocals` + `noUnusedParameters`, so unused imports and params are build errors. Run it before reporting work done. Since there are no tests, any change to `sim/` is unverified by tooling — see *Risky to change* below.

### Required environment

`.env` in the project root (gitignored):

```
VITE_OPENAI_API_KEY=sk-...     # required — game will not start without it
VITE_LOG_LEVEL=DEBUG           # optional — enables tlog.debug() output
```

The key must literally start with `sk-`. If it's missing or malformed, `App.tsx` shows an `alert()` with **no retry** and renders `LoadingScreen` forever — `aiSessionActive` never flips true, so nothing renders and no ticks run. Vite reads `.env` only at startup: **restart the dev server** after changing it. This is a client-side app, so the key is bundled into the JS.

### Browser → terminal logging

`vite-plugin-terminal-logger.ts` (registered in `vite.config.ts`) adds a `/api/log` dev endpoint; `src/utils/terminalLog.ts` (`tlog.info/warn/error/success/debug`) POSTs to it so browser events print colour-coded in the `npm run dev` terminal. Dev-only. **This is the primary way to observe the running game** — much of the richest narration (incident names, metric deltas, API errors) goes only here and is invisible in the browser. Prefer `tlog` over `console.*`; nothing in `src/sim` or `src/services` uses `console`.

## Architecture

Layering is sound and worth preserving: `sim/` (pure engine) ← `data/` + `config/` (declarative content) ← `services/` (I/O) ← `ui/` (view). `ArchMap` is genuinely read-only over the node map. One class in the whole codebase (`AIGameMaster`), inheritance depth 1.

### The game loop lives in App.tsx, not the reducer

`src/App.tsx` owns the 100 ms tick: `tickSimulation(stateRef.current, rng, dt)` then `dispatch({ type: 'LOAD_GAME', state: newState })`. It also schedules AI incidents and completes deployments. `dt = realElapsed × state.speed` (1/2/4×).

`src/hooks/useGameSubsystems.ts` owns a separate **500 ms** loop for pager, war room, status-page accuracy, stakeholders, scaling hints, post-mortems and achievements. Both loops are gated on `aiSessionActive && !paused && !gameOver`.

The reducer's `TICK` case is a deliberate no-op.

### State-writing rules (read this before touching state)

1. **Use `PATCH` with an updater, never `LOAD_GAME`, for partial writes.**
   ```ts
   dispatch({ type: 'PATCH', fn: s => ({ reputation: Math.max(0, s.reputation - 5) }) });
   ```
   `PATCH` (`reducer.ts`) does `{ ...state, ...action.fn(state) }`. The updater form exists because React batches several dispatches inside one interval tick, and `stateRef.current` only refreshes in `useEffect([state])` — i.e. *after* render. Composing a literal from `stateRef.current` reads a stale snapshot and silently discards every earlier write in that tick. That bug existed (9 dispatches per tick, last writer won, dropping pager/stakeholder/war-room state); `PATCH` fixes it **for PATCH-vs-PATCH**.

   🔴 **It does not fix `LOAD_GAME`.** `LOAD_GAME` returns `action.state` verbatim, so it still overwrites anything dispatched beside it. **Never dispatch another action in the same callback as the tick commit** (`App.tsx`, `dispatch({ type: 'LOAD_GAME', state: newState })`) — see *Deployment is broken* below for the live instance of this. Any new subsystem must write via `PATCH` from its own callback, not alongside the tick.

2. **Inside intervals and async callbacks, read `stateRef.current`, not the `state` closure.**

3. **`cloneGameState()` (`src/utils/stateUtils.ts`) is a hand-maintained deep clone.** It enumerates every `Map`, `Set`, array and nested object on `GameState` by hand. **When you add a non-primitive field to `GameState`, you must add it there** (and to `cloneComponentNode` for node fields), or it aliases across ticks and engine helpers mutate the previous state in place.

4. Engine helpers (`propagateLoad`, `applyIncidentEffects`, `updateBusiness`, …) **mutate** the already-cloned state rather than returning new objects. Intentional; follow it.

### Tick pipeline (`src/sim/engine.ts`)

`tickSimulation` runs 12 numbered phases: traffic → `propagateLoad` → `applyIncidentEffects` → `computeGlobalMetrics` → `updateUptime` → `updateBusiness` → **phase 7 is an empty comment (vestigial template-incident spawn)** → prune `recentIncidentTargets` → `updateIncidents` → `updateActions` → `checkGameOver` → `updateStress`. Order matters.

The `rng` argument is unused. Phases 9 and 10 use `Date.now()` and ignore `dt`, so the 2×/4× speed multiplier accelerates the simulation but **not** action durations or incident auto-resolve.

### Single source of truth: `state.architecture.nodes`

`Map<string, ComponentNode>` plus a flat `edges` array. Actions write to it, the engine reads/writes it, `serializeGameState` feeds it to the LLM, `ArchMap` renders it read-only.

### Component metrics span four files

`node.specificMetrics` is `Record<string, any>`, so **TypeScript will not catch mistakes here**. Adding or changing a metric means touching all four:

| File | Role |
|---|---|
| `sim/componentMetrics.ts` | per-type metric interfaces (`CacheMetrics`, …) — defined but **never applied** to `specificMetrics` |
| `sim/componentInitializer.ts` | `initializeComponentMetrics()` — default values per `ComponentType` |
| `sim/engine.ts` → `DEFAULT_METRIC_BASELINES` | value a metric decays back toward |
| `sim/clampMetrics.ts` | `clampMetric()` — bounds, applied on every write |

`clampMetric` dispatches on **substrings of the metric name** (`*Percent` → 0–100, `*Rate` → 0–1, `connections` ≤ `maxConnections`), so **metric naming is load-bearing**. A typo fails silently at runtime.

⚠️ The baselines in `engine.ts` and the initializers in `componentInitializer.ts` are two hand-copied sources that **disagree** — e.g. cache `hitRate` initializes at 0.85 but its baseline is 0.80, so cache nodes drift *downward* from their starting value. (Verified.)

### AI integration

All OpenAI traffic goes through `src/services/openai.ts`:
- `chatJSON(apiKey, messages, temperature)` — `fetch`, no SDK. JSON mode (`response_format: json_object`), so **every prompt must keep the word "JSON" in it**. Throws an actionable message on failure; the caller logs it. Uses `max_completion_tokens` (the API's `max_tokens` is deprecated).
- `parseJSON<T>(reply)` — slices the outermost `{…}` so code fences or stray prose can't break parsing, and strips unary `+` on numbers (models emit `+7000`, which is invalid JSON).

Model, pricing and token cap live in `GAME_CONFIG.ai` — **change the model there**, not in either service. Truncation (`finish_reason === 'length'`), refusals and API errors are all logged via `tlog`, so if the AI seems dead the reason is in the dev terminal.

Two callers: `aiGameMaster.ts` (singleton; resets `conversationHistory` to just the system prompt before every call, so history never accumulates) and `taskGenerator.ts`.

**Budget guards — check these first when the AI "stops working":** `GAME_CONFIG.session` caps at 200 calls / 30 min / 5 min idle, plus a 30 s calm period after resolving a CRIT. `shouldMakeApiCall()` silently returns `false` past a limit. `taskGenerator` keeps a separate counter capped at `session.taskCallShare` (25%). Incidents also pause while `document.hidden`.

AI incident cadence (`App.tsx`): interval ramps from 15–45 s down to 8–25 s over the run, ±40% jitter, then `× (1 - stressMultiplier)` where `stressMultiplier = min(0.4, activeIncidents × 0.15)`. **Note the tension:** frequency *increases* with active incidents while `aiGameMaster` simultaneously caps *severity* when the player is struggling — the two adaptive-difficulty mechanisms pull in opposite directions.

## Content layer (verified counts)

- **93 actions** = 56 in `actions.ts` + 10 `costSavingActions.ts` + 27 `dynamicActions.ts`, concatenated into `ACTIONS`. New action files must be spread in there. (Header comments in those files say "40+" and "20" — both wrong.)
- **Two incompatible category conventions**: the 56 inline actions use Title Case (`'Cost Reduction'`), the 37 imported ones use SCREAMING_SNAKE (`'COST_OPTIMIZATION'`). `DetailPanel` filters on the literal `'Business'`, matching only the inline set.
- **65 incident templates** in `incidents.ts` (COMPUTE 21, DATABASE 10, SECURITY 9, EXTERNAL 6, TRAFFIC/DEPLOY/DNS/QUEUE 4 each, OBSERVABILITY 3) — **all vestigial**, see below.
- **12 blueprints** (5 phase-2, 5 phase-3, 2 phase-4), full ladder costs $33,700.
- **14 achievements** across 5 rarities; **5 stakeholder personas**.
- 15 component types, one node each, built by `createInitialArchitecture` which acts as a template library for `createMinimalArchitecture` (start = `dns`, `app`, `db_primary`) and `deployComponent`.

### Progression pacing (modelled from `engine.ts` growth equation, healthy run at rep 80)

| unlock | reached |
|---|---|
| cache (300 users) | ~2.8 min |
| phase 2 complete — db_replica (800) | ~9.5 min |
| phase 3 complete — apigw (3,000) | ~18.6 min |
| observability (5,000) | ~22.3 min |
| servicemesh (10,000) | ~27.3 min |

Growth compounds ~0.25%/s, so all 12 blueprints are reachable inside the 30-minute cap in a clean run — servicemesh only just. Ends near ~190k users.

## Game-design reality vs. intent

**A future instance must know this: several core systems do not do what the code appears to promise.** These are audited findings, not speculation — the ones marked (verified) I confirmed directly.

0. 🔴 **Component deployment can never complete.** (verified by simulation) In the 100 ms tick callback, `App.tsx` dispatches `DEPLOYMENT_COMPLETE` for each elapsed timer and *then* dispatches `LOAD_GAME` with `newState` — which was computed from the pre-deployment state. The reducer applies them in order, so `LOAD_GAME` discards the deployment and `deployingComponents` still contains the component. Next tick repeats it, forever. Net effect: **no blueprint ever deploys, and `✅ <name> is now live!` prints ~10×/second.** The entire progressive-architecture feature — the thing the pacing table above describes — is inert. Fix: move the deployment check out of the tick callback (or fold it into `tickSimulation` so it's part of `newState`). This is the single highest-value bug in the repo.

1. **The game is effectively unloseable via incidents.** (verified) `engine.ts` caps incident health damage at `maxHealthDecayPerSec = 0.003`, but the "M3 FIX" partial-recovery clause in the *same* branch adds `0.05 × 0.3 × (1 − min(0.7, util))` = 0.0045–0.015/s. Recovery exceeds the damage cap at **every** utilization level, so node health can never fall → uptime stays ~1 → reputation pins high → revenue is never penalised. Only early bankruptcy can end a run.

2. **Ignoring an incident pays the same as fixing it.** (verified) AI incidents auto-resolve at a hardcoded 300 s; both that path and the player-mitigated path increment `resolvedIncidents` and feed the flat `incidentsResolvedThisTick * 2` reputation reward. Only a `wasResolved: false` history flag differs. The success log advertises "+5/+3/+1 by severity" that the code never applies.

3. **One action fully resolves any incident.** `GAME_CONFIG.incidents.mitigationPerAction = 1.0`, and starting an action grants 30% immediately — which `applyIncidentEffects` then double-counts.

4. **The load/capacity/latency model is inert in real play.** Utilization only reaches the 0.7 penalty knee at ~250k users, beyond what a 30-minute run reaches. Also `propagateLoad` propagates `loadIn` (not `loadOut`) and uses the *pre-incident* error rate (verified), so edge weights don't conserve flow and incident-induced errors never shed downstream load. It's BFS, not a topological sort, so a node with two upstreams is finalised on first visit.

5. **Only 2 of 28 quick-action slots render at session start.** (verified) `ActionBar` hides any action whose `target` isn't in `deployedComponents`; 18 quick actions have `target: 'global'`, which is never a deployed component id, so they are permanently unreachable from the Quick Actions bar.

6. **No interactive task can fail.** (verified) There is no `onFail` prop anywhere; the skip button calls the same `onComplete` as success and is literally labelled "(Auto-fix)" after a hardcoded 10 s. Tasks are a 10-second tax with a labelled bypass, and hints give the answer outright. Five of the nine task types have no skip and can dead-end instead.

7. **`incidents.ts` is a dead catalogue.** Its 65 templates are only read for `definitionId` → definition lookups. The only constructors of a template-backed incident are the escalation branch and `debugSpawnIncident`, and `DEBUG_SPAWN_INCIDENT` is dispatched nowhere. So `baseRatePerMinute`, `preconditions`, `targetTypes`, `effects`, `resolutionOptions`, `spreadsTo` and the escalation chains never execute. `mitigateIncident` early-returns for AI incidents.

8. **Deployed `db_replica` is inert** — its template has `scaling.current: 0`, so effective capacity and real cost are both 0 after paying $2,500. (Division is guarded, so it doesn't crash.) `deployComponent`'s `rlb` branch is a **comment-only empty block**, and there is **no `glb` case**, so GLB leaves the old `waf→app` edge in place alongside `waf→glb`.

9. **Timing constants that don't mean what they say.** (verified) `reputationGameOverGracePeriod: 60` is commented "seconds" but `checkGameOver` increments by 1 per *tick* at 10 ticks/s → **6 real seconds**. `simulation.uptimeWindowSize: 300 // 5 minutes` is 300 samples at 10/s → **30 seconds**. `globalLatencyP95` is an unweighted arithmetic mean, not a P95.

10. **Dead state and config.** `GameState.unlockedFeatures`, `fundingRound`, `investorPressure` are initialised and never read or written. `GAME_CONFIG.milestones` has zero readers (and its 50k/100k thresholds are unreachable in a session). `recurringCostDelta` is dead on all 93 actions, and blueprint `ongoingCostPerSec` is added to `costs` then overwritten next tick — because `engine.ts` recomputes `costs` from scratch every tick from `costPerSec × scaling.current`.

11. **Achievement persistence is write-only.** `persistAchievements` writes `localStorage`; nothing reads it back (the loader was unused dead code and has been removed). Either wire loading or drop the write. Also, `useGameSubsystems` persists inside the unlock loop using the pre-tick `achievements` set, so two unlocks in one 500 ms tick lose the first — and only the last is toasted.

12. **`clampMetric` corrupts counter metrics.** (verified) Its `*Rate` branch clamps to 0–1, and `'evictionRate'.includes('Rate')` is true — so eviction rate (a keys/sec counter with baseline 10 and an AI clamp of ±500) is crushed to ≤1 and can never move. Same for `retryRate`. Conversely `*Percent` keys clamp to 0–100 while the data stores fractions (`blockedRequestsPercent: 0.01`), so those can be inflated 100×. The `avgCPUPercent` branch is unreachable (the `*Percent` branch matches first) but harmless — identical bounds.

13. **`increase_price` is a trap action.** (verified) `actions.ts` ships `increase_price` with `effects: { reputationDelta: -5 }` and no pricing change; the working one is `price_increase`, handled by id in `executeAction`. Clicking "Increase Price" costs 5 reputation and raises nothing. A stale `// I1 FIX` comment claims the duplicate was removed.

14. **A 5-minute pause permanently kills incident generation.** (verified by logic) `shouldMakeApiCall()` returns `false` once `now - lastApiCallTime >= inactivityTimeoutMs`, and `lastApiCallTime` only advances inside `callOpenAI` — so once tripped it can never untrip. No message is shown.

15. **~11 action paths charge the player for a guaranteed no-op.** Cash and cooldown are committed before the effect guards run, and those guards silently skip when the target node isn't deployed — roughly 60% of the catalogue at game start. `enable_dynamic_autoscaling` uses `target: 'global'` with a `featureToggle`, and `executeAction` nulls the target for `'global'`, so it can never work. `deployComponent`'s `false` return is discarded and "is now live!" logs regardless.

## Known UI/UX defects

- **Stakeholder cards: choosing the first option doesn't dismiss them.** (verified) `StakeholderComms` filters `!m.selectedResponse` while the reducer stores the *index*, so index 0 is falsy and the card stays active and re-answerable.
- `enhancements.css` defines a second, unrelated palette (slate/blue) and redefines `.modal-overlay` / `.modal-content` / `.modal-button` *after* `theme.css` in import order, so some modals render blue instead of neon. `.action-button`, `.metrics-grid`, `.log-line` are double-defined across stylesheets.
- **No `@media` queries and no `prefers-reduced-motion` in any stylesheet** — desktop-mouse-only, permanently animated.
- **No `aria-*`, no `role`, no keyboard handlers anywhere in `src/ui`.** `ActionBar` renders hotkey badges 1..N with no key listener — decorative. No overlay responds to Escape.
- `PostMortem` shuffles its action items in the render body, and App re-renders ~10×/s, so the options churn continuously.
- `warRoomActive` is cosmetic — no engine or reducer effect.
- `ArchMap`: pan multiplies delta by 2 with no drag threshold, so a nudge also fires `onSelectNode`; per-type metrics are drawn at the same y as the STATUS text; two node positions fall outside the viewBox.
- `MusicPlayer` ships 22 hardcoded MP3s at volume 1.0 with a single mute toggle; `theme.css` still styles a volume slider and track selector that no component renders.
- `burnout` is simulated and penalised but rendered nowhere.

## Workarounds and hacks

Places where the code papers over a problem rather than fixing it. Leave them alone unless you're fixing the underlying cause, and don't trust their comments.

- `engine.ts` "M3 FIX" partial health recovery — nullifies all incident damage (see above).
- `engine.ts` hard-coded per-metric-name clamps on AI output (`±50`, `±100`, `±500`, `±5000`, `±0.5`) selected by substring match, then a flat `× 0.1` "10% per second" fudge.
- `engine.ts` "I5 FIX" stores `_originalCapacity` on the node to undo an in-place capacity mutation — a temp field living on persistent state.
- `engine.ts` six stacked ad-hoc revenue/growth/reputation multipliers whose comments read "(reduced from 10%)", "(reduced from 0.5)" — balance hand-patched rather than fixed at the loop level, then contained by two more clamps.
- `useResizable` reuses one formula for both columns, so dragging the right handle rightwards *widens* the right panel (inverted).
- `TaskModal` cleanup deliberately gutted with the comment "Don't set isMountedRef to false here — it causes race conditions", while `taskData` stays in the dep array of the effect that sets it.
- `theme.css` has `overflow: hidden` immediately followed by `overflow-y: auto /* CSS-5 FIX */`.
- `(incident as any).aiLogs` / `aiIncidentName` casts in ~6 places, because the `ai*` fields were bolted onto `ActiveIncident`.
- Log messages that lie about their own effects: `"Cache DISABLED - DB load will increase 3x!"` (cache is a leaf; disabling it changes DB load by zero), `"User growth +50% for 2 minutes"` (only `reputation += 15` is applied).

### Audit-tag comments

Tags like `// C4.2 FIX`, `// O1`–`// O5`, `// A6 FIX`, `// M2/M3 FIX`, `// I5/I6 FIX`, `// BAL-8`, `// C1 FIX` reference an audit numbering that no longer exists in the repo. **Several are now false** — verify before trusting one. Known-false: the `// CRITICAL: Deep clone` comment in `executeAction`'s failure path sits above a shallow spread (harmless there — that path only sets a cooldown). Leave the tags in place; they're the only record of past fixes.

## Conventions

- Health, error rates and uptime are **0–1 fractions**; reputation, tech debt, burnout and alert fatigue are **0–100**; `utilization` is unbounded above (>1 = overloaded).
- Balance constants belong in `src/config/gameConfig.ts` (`GAME_CONFIG`) — economy, growth, reputation, incident caps, session limits, metric recovery, action timings, activity curve, stress, subsystems, UI sizes. Don't reintroduce magic numbers into the engine.
- Plain CSS in `src/styles/*.css`, imported from `App.tsx`. No framework. Dark terminal theme, neon accents, JetBrains Mono everywhere. **`theme.css` defines 233 custom properties and `var(--…)` appears exactly once in all of `src/**/*.tsx`** — components use ~89 hardcoded hex literals instead (56 in `ArchMap.tsx` alone), and three unreconciled palettes describe the same CRIT state (`#ff3366`, `rgba(239,68,68)`, `#ef4444`). 87 class selectors are defined in two or more sheets and resolved only by import order.
- **Prop patterns are inconsistent:** 9 of 26 components take the whole `state: GameState` (some to read a single field), 15 take narrow props. `PostMortem` shows the cleanest form (`GameState['postMortemQueue'][0]`). `DetailPanel` is the only file using `import React` + `React.useState`.
- **No `React.memo` or `useMemo` anywhere**, and `App.tsx` passes a fresh `Date.now()`-derived float as a prop each tick — so adding memoization without addressing that would accomplish nothing.
- **Seeded determinism is fiction.** `SeededRNG` exists and `tickSimulation` takes an `rng` it never uses; `nextInt`/`chance`/`pick` have zero call sites. Actual randomness comes from `Math.random()` in `engine.ts`, `reducer.ts`, `aiGameMaster.ts` (severity rolls), `stakeholders.ts` and `PostMortem.tsx`.
- **No `isNaN`/`Number.isFinite` guard anywhere in `sim/`** — and `Math.max(0, NaN)` is `NaN`, so one bad LLM number poisons state permanently and undetectably.
- `ai`, `@ai-sdk/openai`, `@ai-sdk/react` and `zod` are in `package.json` but **nothing imports them**. `zod` is the obvious home for the missing LLM-payload validation.
- **105 MB of copyrighted MP3s (24 files) are committed** under `public/music/` with no gitignore entry.

### Layer violations to be aware of

Module *direction* is clean — nothing in `sim/` or `data/` imports `ui/`. The breaches are side-effectful:
- `sim/engine.ts` and `sim/reducer.ts` import `utils/soundNotifications` (touches `window`/`AudioContext`) and `utils/terminalLog` (issues an unawaited `fetch`). So the reducer performs audio and network I/O inside a state transition, and `tickSimulation` is not runnable in Node.
- `sim/engine.ts` imports `applyRelatedMitigation` **from `./reducer`** — a layer inversion on the engine's hot path.
- `data/achievements.ts` calls `localStorage.setItem` from a pure-data module.
- `ui/TaskModal.tsx` reads `import.meta.env.VITE_OPENAI_API_KEY` directly and owns its own API call and budget interaction — the only UI component that does.
- `ui/ArchMap.tsx` evaluates affordability itself, duplicating what the reducer re-checks.

## Risky to change

- **Anything in `sim/engine.ts` or `reducer.ts:executeAction`.** No tests, 280–460 line functions, and the balance is held together by the stacked multipliers above. Add tests before refactoring; a "harmless" cleanup will silently change game feel.
- **Metric names** — `clampMetric` matches on substrings, so renaming a metric changes its clamping behaviour.
- **`GameState` shape** — every non-primitive field must be added to `cloneGameState`. It's already out of date: `tokenUsage` is a nested object and is **missing** (latent only because `getUsage()` returns a fresh literal), and objects one level inside `activeIncidents`, `statusPageHistory` and `stakeholderMessages[].responses` are shared.
- **`ArchMap`'s `basePositions`** is a hardcoded 24-key literal. A new `COMPONENT_BLUEPRINTS` entry without an entry there returns `null` silently and is **never deployable**, with no log.
- **`useGameSubsystems` assigns `stateRef.current = state` during render** while `App.tsx` does the same job inside an effect — two idioms, one unsafe. Don't copy the render-time one.
- **14 `setTimeout`s in `ui/tasks/*` have no `clearTimeout`**, so `TaskModal` can call `onComplete()` — a paid game action — after unmount.
- **CSS import order in `App.tsx`** — later files intentionally (and unintentionally) override earlier ones.
- **Applying the `componentMetrics.ts` interfaces to `specificMetrics`** is the right fix for the `any` hole, but a partial conversion will type-check while silently changing clamp behaviour. Do it wholesale or not at all.
