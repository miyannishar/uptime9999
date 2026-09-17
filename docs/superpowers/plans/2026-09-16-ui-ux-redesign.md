# UPTIME 99.99 — UI/UX Redesign Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use `superpowers:subagent-driven-development` (recommended) or `superpowers:executing-plans` to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.
>
> **⛔ DO NOT BEGIN IMPLEMENTATION** until the user explicitly says "green flag" or equivalent. This plan is for review only.

**Goal:** Redesign the game UI using atomic design methodology — replacing emoji with CSS/Unicode, unifying the color + typography system into design tokens, and restructuring CSS into atoms/molecules/organisms layers — without touching any game simulation logic.

**Architecture:** Introduce a 3-layer CSS architecture (design-tokens → atoms → molecules → organisms) that feeds into the existing theme.css. New React atom components (`SevDot`, `AiBadge`, `ProgressBar`, `StatusBadge`) replace all emoji-as-icon usage. Each phase leaves the game in a buildable, runnable state.

**Tech Stack:** React 18, TypeScript, Vite, plain CSS (no framework), `lucide-react` (new install — 3 icons only: `Pause`, `Play`, `Lock`)

**Spec:** `docs/COMPONENT_DESIGN.md` (existing) + `docs/superpowers/plans/2026-09-16-ui-ux-redesign.md` (this file)

## Global Constraints

- `npm run build` (tsc + vite) must pass after every task — this is the only CI gate
- `npx tsc --noEmit` is the fast type-check shortcut; run it before the full build
- Never touch any file under `src/sim/` or `src/services/` — game logic is out of scope
- Never change function signatures, prop interfaces, or state shape — UI layer only
- All new CSS goes into new files (`design-tokens.css`, `atoms.css`, `molecules.css`, `organisms.css`); existing CSS files are modified in-place to reference the new tokens
- `src/config/gameConfig.ts` UI section (`leftPanelWidth`, etc.) is the source of truth for panel dimensions — read it, don't hardcode
- `GAME_CONFIG.simulation.maxDurationMs` = `30 * 60 * 1000` — derive the 30-min session cap from this constant, do not hardcode `1800`
- All emoji removed from user-visible UI; emoji in `tlog.*` calls (terminal-only) are left alone
- No new state, no new reducers, no new hooks beyond what tasks define

---

## Atomic Design Layer Map

```
ATOMS       — single-element building blocks
              src/styles/design-tokens.css   (CSS custom properties)
              src/styles/atoms.css           (single-element classes)
              src/ui/atoms/SevDot.tsx        (severity dot component)
              src/ui/atoms/AiBadge.tsx       (AI content badge)
              src/ui/atoms/ProgressBar.tsx   (unified progress bar)
              src/ui/atoms/StatusBadge.tsx   (text label badge: CRIT/WARN/INFO)

MOLECULES   — atom compositions, styled interactions
              src/styles/molecules.css       (incident-card, hud-metric, action-btn styles)

ORGANISMS   — full panel sections
              src/styles/organisms.css       (panel layout, arch-map nodes, hud bar)

EXISTING (modified, not replaced)
              src/styles/theme.css           (layout skeleton; imports new layers)
              src/styles/enhancements.css    (colour refs → tokens)
              src/ui/HudBar.tsx              (countdown, remove debug, font classes)
              src/ui/IncidentFeed.tsx        (atom components, severity hierarchy)
              src/ui/ActionBar.tsx           (category headers, emoji → text)
              src/ui/DetailPanel.tsx         (tab labels cleaned)
              src/ui/ArchMap.tsx             (node size, type badges, arrowheads, viewBox)
              src/ui/PostMortem.tsx          (emoji stripped)
              src/ui/LoadingScreen.tsx       (narrative hook copy)
              src/ui/AchievementToast.tsx    (emoji stripped)
              src/ui/ActivityLog.tsx         (🤖 → AI badge)
              src/ui/TaskModal.tsx           (emoji → text)
              src/ui/tasks/*.tsx             (emoji stripped from headings/hints)
              src/data/costSavingActions.ts  (strip emoji from action names)
              src/App.tsx                    (CSS import order updated)
```

---

## Phase A — Foundation: Design Tokens + Font System

### Task A1: Create `design-tokens.css` — the single source of truth

**Files:**
- Create: `src/styles/design-tokens.css`

**Interfaces:**
- Produces: All CSS custom properties consumed by every subsequent task. Variable names are the contract — do not rename them after this task.

- [ ] **Step 1: Create the file with the full token set**

```css
/* src/styles/design-tokens.css
   SINGLE SOURCE OF TRUTH — all other CSS files reference these vars.
   Do not hardcode hex values anywhere else in the project.          */

/* Google Fonts — loaded here once */
@import url('https://fonts.googleapis.com/css2?family=Space+Grotesk:wght@400;500;600;700&family=JetBrains+Mono:wght@400;600&display=swap');

:root {
  /* ── BACKGROUNDS ─────────────────────────────────────────────── */
  --bg-base:      #09090d;   /* page background                     */
  --bg-surface:   #111118;   /* panel backgrounds                   */
  --bg-elevated:  #1a1a24;   /* cards, buttons, stat rows           */
  --bg-overlay:   #22222e;   /* modals, dropdowns                   */

  /* ── BORDERS ────────────────────────────────────────────────── */
  --border-dim:     #1e1e2a;
  --border-default: #2d2d3e;
  --border-bright:  #3d3d50;

  /* ── TEXT ───────────────────────────────────────────────────── */
  --text-primary:   #e8e8f0;
  --text-secondary: #a0a0b0;
  --text-muted:     #7a7a90;   /* raised from #6a6a7a for WCAG 3:1  */
  --text-disabled:  #3e3e52;

  /* ── INTERACTIVE CHROME (one accent) ────────────────────────── */
  --interactive:      #00d997;
  --interactive-dim:  rgba(0, 217, 151, 0.12);
  --interactive-glow: rgba(0, 217, 151, 0.20);

  /* ── GAME STATE SEMANTIC (separate from interactive) ─────────── */
  --status-good: #22c55e;
  --status-warn: #f59e0b;
  --status-crit: #ef4444;
  --status-info: #60a5fa;

  /* ── SPECIAL CONTEXTS ────────────────────────────────────────── */
  --color-ai:     #a78bfa;   /* AI-generated content               */
  --color-deploy: #34d399;   /* deployment in-progress             */
  --color-danger: #f43f5e;   /* pager / war-room                   */

  /* ── TYPOGRAPHY ──────────────────────────────────────────────── */
  --font-ui:   'Space Grotesk', system-ui, sans-serif;
  --font-data: 'JetBrains Mono', 'Fira Code', monospace;

  /* ── MOTION ──────────────────────────────────────────────────── */
  --motion-fast:   150ms;
  --motion-normal: 250ms;
  --motion-slow:   400ms;
  --ease-out:   cubic-bezier(0.0, 0.0, 0.2, 1);
  --ease-in:    cubic-bezier(0.4, 0.0, 1.0, 1);
  --ease-spring: cubic-bezier(0.34, 1.56, 0.64, 1);
  --ease-std:   cubic-bezier(0.4, 0.0, 0.2, 1);

  /* ── Z-INDEX SCALE ───────────────────────────────────────────── */
  --z-base:      10;
  --z-panel:     20;
  --z-overlay:   50;
  --z-modal:     100;
  --z-alert:     200;
  --z-pager:     300;
}

/* Reduced motion — one block covers the entire app */
@media (prefers-reduced-motion: reduce) {
  *, ::before, ::after {
    animation-duration: 0.01ms !important;
    animation-iteration-count: 1 !important;
    transition-duration: 0.01ms !important;
  }
}
```

- [ ] **Step 2: Update `src/App.tsx` CSS import block**

Find the existing import block (currently lines 29–33):
```tsx
import './styles/theme.css';
import './styles/tasks.css';
import './styles/taskHints.css';
import './styles/enhancements.css';
```

Replace with (order is load-order — tokens must come first):
```tsx
import './styles/design-tokens.css';
import './styles/atoms.css';
import './styles/molecules.css';
import './styles/organisms.css';
import './styles/theme.css';
import './styles/tasks.css';
import './styles/taskHints.css';
import './styles/enhancements.css';
```

Note: `atoms.css`, `molecules.css`, `organisms.css` don't exist yet — Vite will error. Create them as empty files right now:
```bash
touch src/styles/atoms.css src/styles/molecules.css src/styles/organisms.css
```

- [ ] **Step 3: Remove the duplicate `@import` and `:root` block from `theme.css`**

In `src/styles/theme.css`:
- Delete lines 1–26 (the `@import url(JetBrains Mono)` + entire `:root { }` block)
- Replace with a single comment: `/* Design tokens are in design-tokens.css — imported before this file in App.tsx */`
- Leave everything else in theme.css untouched

- [ ] **Step 4: Update legacy variable names used in `theme.css` and `enhancements.css`**

The old tokens are referenced throughout both CSS files. Do a find-and-replace pass:

| Old variable | New variable |
|---|---|
| `var(--bg-primary)` | `var(--bg-base)` |
| `var(--bg-secondary)` | `var(--bg-surface)` |
| `var(--bg-tertiary)` | `var(--bg-elevated)` |
| `var(--border)` | `var(--border-default)` |
| `var(--shadow)` | `var(--interactive-glow)` |
| `var(--accent-cyan)` | `var(--interactive)` |
| `var(--accent-blue)` | `var(--status-info)` |
| `var(--accent-yellow)` | `var(--status-warn)` |
| `var(--accent-pink)` | `var(--color-danger)` |
| `var(--good)` | `var(--status-good)` |
| `var(--warning)` | `var(--status-warn)` |
| `var(--critical)` | `var(--status-crit)` |

Run this replacement in both `theme.css` and `enhancements.css`. Do not rename any class selectors — only the CSS variable references inside property values.

- [ ] **Step 5: Type-check and build**

```bash
cd /Users/nishar/Programming/uptime9999
npx tsc --noEmit
npm run build
```

Expected: zero TypeScript errors, build succeeds. The game should load and look visually close to before (possibly slightly different border colors, but structurally identical).

---

### Task A2: Font system — apply `--font-ui` and `--font-data`

**Files:**
- Modify: `src/styles/theme.css`
- Modify: `src/styles/design-tokens.css` (body rule only)

**Interfaces:**
- Consumes: `--font-ui`, `--font-data` from Task A1
- Produces: Two font classes (`.font-ui`, `.font-data`) and the body override

- [ ] **Step 1: Override body font in `design-tokens.css`**

Append after the `:root { }` block (before the `@media` block):

```css
body {
  font-family: var(--font-ui);
  /* Note: --font-data is applied to specific data-display selectors below */
}
```

- [ ] **Step 2: Add data-font selector block at the bottom of `theme.css`**

Append to the very end of `theme.css`:

```css
/* ── FONT ROLE ASSIGNMENTS ──────────────────────────────────────
   UI chrome uses --font-ui (Space Grotesk).
   Numeric data, code, and terminal content use --font-data (JetBrains Mono). */

.hud-value,
.stat-value,
.metric-value,
.activity-time,
.incident-time,
.action-cost,
.action-cooldown,
.zoom-indicator,
.terminal-body,
.log-line,
.cursor-blink,
.terminal-title,
.terminal-header,
.volume-display,
.summary-value {
  font-family: var(--font-data);
}

/* Arch map SVG uses inline font — set via ArchMap.tsx renderComponentSpecificMetrics */
/* Node name text in SVG is also set inline in ArchMap.tsx — updated in Task E5 */
```

- [ ] **Step 3: Remove all inline `font-family` declarations from `theme.css` that duplicate the monospace stack**

Search `theme.css` for lines like:
```css
font-family: 'JetBrains Mono', 'Fira Code', 'Consolas', 'Monaco', 'Courier New', monospace;
```
Every occurrence of this exact stack inside a class rule should be replaced with `font-family: var(--font-data);`. The `body` declaration was already removed in A1 step 3.

There are approximately 12 such lines in `theme.css`. Do them all.

- [ ] **Step 4: Remove the `.mono` utility class from `theme.css`** (lines 42–44)

It was `font-family: JetBrains Mono` — now covered by `var(--font-data)` selectors. Delete the entire `.mono` block.

- [ ] **Step 5: Type-check and build**

```bash
npx tsc --noEmit && npm run build
```

Visual check: Panel headers and button labels now render in Space Grotesk (geometric, slightly wider than JetBrains Mono). Numeric HUD values and metric text stay in JetBrains Mono. If Space Grotesk doesn't load (offline), it falls back to system-ui — acceptable.

---

## Phase B — Atoms: React Components

### Task B1: `SevDot` atom — severity indicator dot

**Files:**
- Create: `src/ui/atoms/SevDot.tsx`
- Create: `src/ui/atoms/index.ts`
- Modify: `src/styles/atoms.css`

**Interfaces:**
- Produces: `<SevDot severity="CRIT" | "WARN" | "INFO" />` — an 8px dot with appropriate color and optional glow

- [ ] **Step 1: Create the atoms directory and `SevDot` component**

```tsx
// src/ui/atoms/SevDot.tsx
interface SevDotProps {
  severity: 'CRIT' | 'WARN' | 'INFO';
  pulse?: boolean;       // true = add pulsing animation (for active crits)
  size?: 'sm' | 'md';   // sm=6px, md=8px (default)
}

export default function SevDot({ severity, pulse = false, size = 'md' }: SevDotProps) {
  return (
    <span
      className={`sev-dot sev-dot--${severity.toLowerCase()} sev-dot--${size} ${pulse ? 'sev-dot--pulse' : ''}`}
      aria-label={severity}
    />
  );
}
```

- [ ] **Step 2: Add SevDot styles to `src/styles/atoms.css`**

```css
/* ── ATOM: SevDot ────────────────────────────────────────────────
   Replaces emoji severity icons (🔥 ⚠️ ℹ️) throughout the app.   */

.sev-dot {
  display: inline-block;
  border-radius: 50%;
  flex-shrink: 0;
  align-self: center;
}
.sev-dot--sm { width: 6px;  height: 6px; }
.sev-dot--md { width: 8px;  height: 8px; }

.sev-dot--crit {
  background: var(--status-crit);
  box-shadow: 0 0 5px var(--status-crit);
}
.sev-dot--warn {
  background: var(--status-warn);
}
.sev-dot--info {
  background: var(--status-info);
}

@keyframes sev-pulse {
  0%, 100% { opacity: 1;   box-shadow: 0 0 5px var(--status-crit); }
  50%       { opacity: 0.5; box-shadow: 0 0 10px var(--status-crit); }
}
.sev-dot--pulse {
  animation: sev-pulse 1.2s ease-in-out infinite;
}
```

- [ ] **Step 3: Create `src/ui/atoms/index.ts` barrel export**

```ts
// src/ui/atoms/index.ts
export { default as SevDot } from './SevDot';
```

- [ ] **Step 4: Type-check**

```bash
npx tsc --noEmit
```

Expected: zero errors.

---

### Task B2: `AiBadge` atom — AI-generated content label

**Files:**
- Modify: `src/ui/atoms/AiBadge.tsx` (create)
- Modify: `src/ui/atoms/index.ts`
- Modify: `src/styles/atoms.css`

**Interfaces:**
- Produces: `<AiBadge />` — a small purple `AI` text badge. Replaces every `🤖` in the visible UI.

- [ ] **Step 1: Create the component**

```tsx
// src/ui/atoms/AiBadge.tsx
export default function AiBadge() {
  return <span className="badge-ai" aria-label="AI-generated">AI</span>;
}
```

- [ ] **Step 2: Add styles to `atoms.css`**

```css
/* ── ATOM: AiBadge ───────────────────────────────────────────────
   Replaces 🤖 emoji throughout the app for AI-generated content.  */

.badge-ai {
  display: inline-flex;
  align-items: center;
  padding: 1px 6px;
  border-radius: 3px;
  background: rgba(167, 139, 250, 0.15);
  border: 1px solid rgba(167, 139, 250, 0.30);
  color: var(--color-ai);
  font-family: var(--font-ui);
  font-size: 0.62rem;
  font-weight: 700;
  letter-spacing: 0.06em;
  line-height: 1.4;
  flex-shrink: 0;
}
```

- [ ] **Step 3: Export from barrel**

Add to `src/ui/atoms/index.ts`:
```ts
export { default as AiBadge } from './AiBadge';
```

- [ ] **Step 4: Type-check**

```bash
npx tsc --noEmit
```

---

### Task B3: `StatusBadge` atom — text severity label

**Files:**
- Create: `src/ui/atoms/StatusBadge.tsx`
- Modify: `src/ui/atoms/index.ts`
- Modify: `src/styles/atoms.css`

**Interfaces:**
- Produces: `<StatusBadge level="CRIT" | "WARN" | "INFO" | "GOOD" | "DEPLOY" />` — a small pill label. Replaces text-only severity labels in the incident feed.

- [ ] **Step 1: Create the component**

```tsx
// src/ui/atoms/StatusBadge.tsx
type BadgeLevel = 'CRIT' | 'WARN' | 'INFO' | 'GOOD' | 'DEPLOY';

interface StatusBadgeProps {
  level: BadgeLevel;
  label?: string;   // override display text (defaults to the level string)
}

export default function StatusBadge({ level, label }: StatusBadgeProps) {
  return (
    <span className={`status-badge status-badge--${level.toLowerCase()}`}>
      {label ?? level}
    </span>
  );
}
```

- [ ] **Step 2: Add styles to `atoms.css`**

```css
/* ── ATOM: StatusBadge ───────────────────────────────────────────
   Text pill for severity levels and system states.                */

.status-badge {
  display: inline-block;
  padding: 0.1rem 0.45rem;
  border-radius: 3px;
  font-family: var(--font-data);
  font-size: 0.68rem;
  font-weight: 700;
  letter-spacing: 0.04em;
  line-height: 1.5;
  flex-shrink: 0;
}
.status-badge--crit   { background: rgba(239,68,68,0.20);  color: var(--status-crit); }
.status-badge--warn   { background: rgba(245,158,11,0.20); color: var(--status-warn); }
.status-badge--info   { background: rgba(96,165,250,0.20); color: var(--status-info); }
.status-badge--good   { background: rgba(34,197,94,0.15);  color: var(--status-good); }
.status-badge--deploy { background: rgba(52,211,153,0.15); color: var(--color-deploy); }
```

- [ ] **Step 3: Export from barrel**

```ts
export { default as StatusBadge } from './StatusBadge';
```

- [ ] **Step 4: Type-check**

```bash
npx tsc --noEmit
```

---

### Task B4: `ProgressBar` atom — unified progress/fill bar

**Files:**
- Create: `src/ui/atoms/ProgressBar.tsx`
- Modify: `src/ui/atoms/index.ts`
- Modify: `src/styles/atoms.css`

**Interfaces:**
- Produces: `<ProgressBar value={0–1} variant="mitigation" | "health" | "utilization" | "stress" | "countdown" height={number} />` — replaces the 5 separate progress bar implementations scattered across the codebase.

- [ ] **Step 1: Create the component**

```tsx
// src/ui/atoms/ProgressBar.tsx
type BarVariant = 'mitigation' | 'health' | 'utilization' | 'stress' | 'countdown';

interface ProgressBarProps {
  value: number;          // 0 to 1
  variant: BarVariant;
  height?: number;        // px, default 10
  className?: string;
}

export default function ProgressBar({
  value,
  variant,
  height = 10,
  className = '',
}: ProgressBarProps) {
  const pct = Math.min(100, Math.max(0, value * 100));
  return (
    <div
      className={`progress-bar progress-bar--${variant} ${className}`}
      style={{ height: `${height}px` }}
      role="progressbar"
      aria-valuenow={Math.round(pct)}
      aria-valuemin={0}
      aria-valuemax={100}
    >
      <div
        className="progress-bar__fill"
        style={{ width: `${pct}%` }}
      />
    </div>
  );
}
```

- [ ] **Step 2: Add styles to `atoms.css`**

```css
/* ── ATOM: ProgressBar ───────────────────────────────────────────
   Unified progress bar. Replaces mitigation-bar, stress-bar,
   activity-progress-bar, and arch-map bar rects.                  */

.progress-bar {
  width: 100%;
  background: rgba(255,255,255,0.08);
  border-radius: 99px;
  overflow: hidden;
  flex-shrink: 0;
}

.progress-bar__fill {
  height: 100%;
  border-radius: 99px;
  transition: width var(--motion-normal) var(--ease-out);
}

/* Variant fill colors */
.progress-bar--mitigation .progress-bar__fill {
  background: var(--status-good);
}
.progress-bar--health .progress-bar__fill {
  background: linear-gradient(90deg, var(--status-crit), var(--status-good));
  /* dynamic width does the work — left=red, right=green naturally */
}
.progress-bar--utilization .progress-bar__fill {
  background: var(--status-warn);
}
.progress-bar--stress .progress-bar__fill {
  background: linear-gradient(90deg, var(--status-warn), var(--status-crit));
}
.progress-bar--countdown .progress-bar__fill {
  background: var(--interactive);
  transition: width 1s linear; /* 1s step matches the 1s tick for countdown */
}
```

- [ ] **Step 3: Export from barrel**

```ts
export { default as ProgressBar } from './ProgressBar';
```

- [ ] **Step 4: Type-check**

```bash
npx tsc --noEmit
```

---

### Task B5: Install `lucide-react` — 3 icons only

**Files:**
- Modify: `package.json` (via npm install)

**Interfaces:**
- Produces: `import { Pause, Play, Lock } from 'lucide-react'` available to all components

- [ ] **Step 1: Install**

```bash
cd /Users/nishar/Programming/uptime9999
npm install lucide-react
```

- [ ] **Step 2: Verify types resolve**

```bash
npx tsc --noEmit
```

Expected: zero errors (lucide-react ships its own types).

---

## Phase C — Data Layer Cleanup

### Task C1: Strip emoji from action names in data files

**Files:**
- Modify: `src/data/costSavingActions.ts`

**Interfaces:**
- No interface change. Action `name` field is `string` — removing emoji prefix doesn't change the type.

- [ ] **Step 1: Strip emoji prefixes from the 3 affected actions**

In `src/data/costSavingActions.ts`:

Line 48: `name: '🚀 Optimize Database Queries'` → `name: 'Optimize Database Queries'`
Line 105: `name: '🔧 Consolidate Instances'` → `name: 'Consolidate Instances'`
Line 123: `name: '💰 Increase Pricing +10%'` → `name: 'Increase Pricing +10%'`

- [ ] **Step 2: Type-check and build**

```bash
npx tsc --noEmit && npm run build
```

---

## Phase D — Molecules: CSS Compositions

### Task D1: `molecules.css` — incident card, HUD metric group, action button

**Files:**
- Modify: `src/styles/molecules.css` (populate from empty)

**Interfaces:**
- Consumes: All tokens from `design-tokens.css`
- Produces: `.incident-card` (molecule wrapping SevDot + content), `.hud-metric-group`, `.action-btn` — these are CSS class upgrades, not new component files.

- [ ] **Step 1: Write the molecule styles**

```css
/* src/styles/molecules.css
   Molecule-level compositions built from atoms.
   These classes upgrade existing element structures.              */

/* ── MOLECULE: Incident Card ────────────────────────────────────
   Wraps SevDot + title + target + mitigation bar.
   Applied via severity modifier on existing .incident-item class. */

.incident-item {
  /* Base already in theme.css — these add severity-specific fills */
}
.incident-item.severity-critical {
  background: rgba(239, 68, 68, 0.07);
  border-left: 4px solid var(--status-crit);
}
.incident-item.severity-warning {
  background: rgba(245, 158, 11, 0.05);
  border-left: 3px solid var(--status-warn);
}
.incident-item.severity-info {
  background: transparent;
  border-left: 2px solid var(--status-info);
}

/* CRIT card title gets extra weight */
.incident-item.severity-critical .incident-title {
  font-weight: 700;
  font-size: 0.95rem;
  color: var(--text-primary);
}

/* ── MOLECULE: HUD Metric Group ─────────────────────────────────
   Label above, value below. Already structured correctly — these
   are overrides for spacing and font roles.                       */

.hud-label {
  font-size: 0.72rem;        /* raised from 0.7rem for WCAG         */
  font-weight: 500;
  text-transform: uppercase;
  letter-spacing: 0.05em;
  color: var(--text-secondary);
  white-space: nowrap;
}

/* ── MOLECULE: Quick Action Button ──────────────────────────────
   Name + cost. Category header precedes a group of these.        */

.action-category-header {
  width: 100%;
  padding: 0.35rem 0.5rem;
  font-family: var(--font-ui);
  font-size: 0.68rem;
  font-weight: 700;
  text-transform: uppercase;
  letter-spacing: 0.08em;
  color: var(--text-muted);
  border-bottom: 1px solid var(--border-dim);
  margin-bottom: 0.4rem;
  margin-top: 0.6rem;
}
.action-category-header:first-child {
  margin-top: 0;
}

/* Action name text inside quick-action button */
.action-name {
  font-family: var(--font-ui);
  font-size: 0.82rem;
  font-weight: 600;
  color: var(--text-primary);
  margin-bottom: 0.2rem;
}
.action-cost {
  font-family: var(--font-data);
  font-size: 0.75rem;
  color: var(--text-secondary);
}

/* ── MOLECULE: In-Progress Spinner ──────────────────────────────
   Replaces ⏳ emoji in action buttons.                            */

@keyframes spin {
  to { transform: rotate(360deg); }
}
.action-spinner {
  display: inline-block;
  width: 10px;
  height: 10px;
  border: 1.5px solid var(--border-bright);
  border-top-color: var(--interactive);
  border-radius: 50%;
  animation: spin 0.8s linear infinite;
  flex-shrink: 0;
}
```

- [ ] **Step 2: Type-check**

```bash
npx tsc --noEmit
```

---

### Task D2: `organisms.css` — panel layout + arch map nodes + HUD bar

**Files:**
- Modify: `src/styles/organisms.css` (populate from empty)

**Interfaces:**
- Consumes: Tokens from `design-tokens.css`
- Produces: `.arch-node` (organism class applied to SVG rects via inline style), `.hud-bar` overrides, `.session-bar` (countdown strip)

- [ ] **Step 1: Write organism styles**

```css
/* src/styles/organisms.css
   Organism-level compositions. Panel-wide and section-wide rules. */

/* ── ORGANISM: HUD Bar ───────────────────────────────────────────
   Override to 72px height for breathing room.                     */

.hud-bar {
  height: 72px;
  min-height: 72px;
}

/* ── ORGANISM: Session Countdown Bar ────────────────────────────
   Thin strip immediately below the HUD bar showing time remaining. */

.session-bar {
  height: 3px;
  background: var(--border-dim);
  flex-shrink: 0;
  position: relative;
  overflow: hidden;
}
.session-bar__fill {
  position: absolute;
  left: 0; top: 0; bottom: 0;
  background: var(--interactive);
  transition: width 1s linear;
}
.session-bar--warning .session-bar__fill {
  background: var(--status-warn);
}
.session-bar--critical .session-bar__fill {
  background: var(--status-crit);
  animation: sev-pulse 1.2s ease-in-out infinite;
}

/* ── ORGANISM: Arch Map — Node Type Badges ───────────────────────
   CSS classes for the SVG <rect> type-badge backgrounds.
   Applied via className on SVG <g> elements in ArchMap.tsx        */

.node-type-badge-dns   { fill: rgba(167,139,250,0.25); }
.node-type-badge-app   { fill: rgba(96,165,250,0.20);  }
.node-type-badge-db    { fill: rgba(245,158,11,0.20);  }
.node-type-badge-cache { fill: rgba(0,217,151,0.18);   }
.node-type-badge-net   { fill: rgba(96,165,250,0.15);  }
.node-type-badge-queue { fill: rgba(251,146,60,0.20);  }
.node-type-badge-obs   { fill: rgba(163,230,53,0.20);  }

/* ── ORGANISM: Node Deploy Entrance Animation ────────────────────
   Applied to a new node group in ArchMap.tsx for 400ms after deploy. */

@keyframes node-enter {
  from { opacity: 0; transform: scale(0.75); }
  to   { opacity: 1; transform: scale(1); }
}
.node-entering {
  animation: node-enter var(--motion-slow) var(--ease-spring) forwards;
  transform-origin: center;
}

/* ── ORGANISM: Detail Panel ──────────────────────────────────────
   Reduced default width; content drives expansion via JS          */

/* Already handled via gameConfig.ts + useResizable hook.
   No CSS override needed — defaults are in gameConfig.ui.         */

/* ── ORGANISM: Panel Header ──────────────────────────────────────
   Standardise font role for all panel h2 headers.                 */

.panel-header h2 {
  font-family: var(--font-ui);
  font-size: 0.88rem;
  font-weight: 700;
  letter-spacing: 0.07em;
  text-transform: uppercase;
}
```

- [ ] **Step 2: Type-check**

```bash
npx tsc --noEmit
```

---

## Phase E — Organisms: Component Updates

### Task E1: `HudBar.tsx` — countdown, remove debug fields, emoji → text

**Files:**
- Modify: `src/ui/HudBar.tsx`

**Interfaces:**
- Consumes: `GAME_CONFIG.simulation.maxDurationMs` from gameConfig (already imported in App.tsx; HudBar receives `state` which includes `startTime`)
- Produces: Visible countdown "27:32 remaining", no Seed field, no API spend field, `↺ New Run` button, `SessionBar` markup

- [ ] **Step 1: Update `HudBar.tsx`**

Replace the entire file content:

```tsx
// src/ui/HudBar.tsx
import { GameState } from '../sim/types';
import { GAME_CONFIG } from '../config/gameConfig';
import MusicPlayer from './MusicPlayer';
import { Pause, Play } from 'lucide-react';

interface HudBarProps {
  state: GameState;
  onTogglePause: () => void;
  onNewGame: () => void;
  onSetSpeed: (speed: number) => void;
}

export default function HudBar({ state, onTogglePause, onNewGame, onSetSpeed }: HudBarProps) {
  const fmt = (n: number): string => {
    if (n >= 1_000_000) return `${(n / 1_000_000).toFixed(1)}M`;
    if (n >= 1_000)     return `${(n / 1_000).toFixed(1)}k`;
    return n.toFixed(0);
  };

  const fmtCash = (n: number) => `$${fmt(n)}`;
  const fmtUptime = (u: number) => `${(u * 100).toFixed(2)}%`;

  // Countdown from session max duration
  const maxSec = GAME_CONFIG.simulation.maxDurationMs / 1000;
  const elapsed = (Date.now() - state.startTime) / 1000;
  const remaining = Math.max(0, maxSec - elapsed);
  const remMin = Math.floor(remaining / 60);
  const remSec = Math.floor(remaining % 60);
  const remainingLabel = `${String(remMin).padStart(2, '0')}:${String(remSec).padStart(2, '0')}`;

  // Session progress 0→1
  const sessionProgress = Math.min(1, elapsed / maxSec);
  const sessionVariant =
    remaining < 60  ? 'critical' :
    remaining < 300 ? 'warning'  : '';

  return (
    <>
      <div className="hud-bar">
        {/* Title */}
        <div className="hud-section hud-title">
          <h1>UPTIME 99.99</h1>
        </div>

        {/* Primary metrics */}
        <div className="hud-section hud-metrics">
          <div className="hud-metric">
            <span className="hud-label">Uptime</span>
            <span className={`hud-value ${
              state.uptime < 0.95 ? 'critical' :
              state.uptime < 0.99 ? 'warning' : 'good'
            }`}>
              {fmtUptime(state.uptime)}
            </span>
          </div>

          <div className="hud-metric">
            <span className="hud-label">Users</span>
            <span className="hud-value">{fmt(state.users)}</span>
          </div>

          <div className="hud-metric">
            <span className="hud-label">RPS</span>
            <span className="hud-value">{fmt(state.rps)}</span>
          </div>

          <div className="hud-metric">
            <span className="hud-label">Cash</span>
            <span className={`hud-value ${
              state.cash < 0     ? 'critical' :
              state.cash < 1000 ? 'warning' : ''
            }`}>
              {fmtCash(state.cash)}
            </span>
          </div>

          <div className="hud-metric">
            <span className="hud-label">Profit/min</span>
            <span className={`hud-value ${
              (state.revenue - state.costs) < 0 ? 'critical' : ''
            }`}>
              {fmtCash((state.revenue - state.costs) * 60)}
            </span>
          </div>

          <div className="hud-metric">
            <span className="hud-label">Reputation</span>
            <span className={`hud-value ${
              state.reputation < 30 ? 'critical' :
              state.reputation < 60 ? 'warning' : ''
            }`}
              title={`Uptime: ${(state.uptime * 100).toFixed(2)}% | Error Rate: ${(state.globalErrorRate * 100).toFixed(2)}% | Active Incidents: ${state.activeIncidents.length}`}
            >
              {state.reputation.toFixed(0)}
            </span>
          </div>
        </div>

        {/* Stress bars */}
        <div className="hud-section hud-stress">
          <div className="hud-stress-item">
            <span className="hud-label">Tech Debt</span>
            <div className="stress-bar">
              <div className="stress-fill" style={{ width: `${state.techDebt}%` }} />
            </div>
          </div>
          <div className="hud-stress-item">
            <span className="hud-label">Fatigue</span>
            <div className="stress-bar">
              <div className="stress-fill" style={{ width: `${state.alertFatigue}%` }} />
            </div>
          </div>
        </div>

        {/* Time remaining (countdown) */}
        <div className="hud-section hud-time">
          <div className="hud-metric">
            <span className="hud-label">Remaining</span>
            <span className={`hud-value ${remaining < 300 ? 'warning' : ''} ${remaining < 60 ? 'critical' : ''}`}>
              {remainingLabel}
            </span>
          </div>
        </div>

        {/* Controls */}
        <div className="hud-section hud-controls">
          <button onClick={onTogglePause} className="hud-button" aria-label={state.paused ? 'Resume' : 'Pause'}>
            {state.paused
              ? <><Play size={12} /> Play</>
              : <><Pause size={12} /> Pause</>
            }
          </button>

          <div className="speed-controls">
            {[1, 2, 4].map(s => (
              <button
                key={s}
                onClick={() => onSetSpeed(s)}
                className={`speed-btn ${state.speed === s ? 'active' : ''}`}
              >
                {s}x
              </button>
            ))}
          </div>

          <button onClick={onNewGame} className="hud-button">↺ New Run</button>

          <MusicPlayer />
        </div>
      </div>

      {/* Session countdown strip — lives outside .hud-bar so it spans full width */}
      <div className={`session-bar ${sessionVariant ? `session-bar--${sessionVariant}` : ''}`}>
        <div
          className="session-bar__fill"
          style={{ width: `${(1 - sessionProgress) * 100}%` }}
        />
      </div>
    </>
  );
}
```

- [ ] **Step 2: Update `App.tsx` to accommodate the session bar**

In `App.tsx`, the `<HudBar>` is rendered inside the `.app` flex column. The session bar is now rendered as a sibling to the HUD bar from within HudBar itself — no change needed in App.tsx because HudBar returns a Fragment wrapping both elements.

Confirm the `.app` flex layout hasn't broken:
```bash
npx tsc --noEmit
```

- [ ] **Step 3: Build and visually verify**

```bash
npm run build
```

Visual check: HUD shows "Remaining 27:32" (counting down). The thin strip below the HUD drains from right to left, turning orange under 5 min, red under 1 min. No Seed field, no API spend. Title reads "UPTIME 99.99" in Space Grotesk — no emoji. Pause button shows Lucide icons.

---

### Task E2: `IncidentFeed.tsx` — atom components, severity visual hierarchy

**Files:**
- Modify: `src/ui/IncidentFeed.tsx`

**Interfaces:**
- Consumes: `SevDot`, `AiBadge`, `StatusBadge` from `src/ui/atoms/index.ts`

- [ ] **Step 1: Rewrite `IncidentFeed.tsx`**

```tsx
// src/ui/IncidentFeed.tsx
import { useState } from 'react';
import { ActiveIncident } from '../sim/types';
import { INCIDENTS } from '../data/incidents';
import LogsModal from './LogsModal';
import { SevDot, AiBadge, StatusBadge } from './atoms';

interface IncidentFeedProps {
  incidents: ActiveIncident[];
  onSelectIncident: (id: string) => void;
  selectedIncidentId: string | null;
}

export default function IncidentFeed({ incidents, onSelectIncident, selectedIncidentId }: IncidentFeedProps) {
  const [logsModalOpen, setLogsModalOpen] = useState(false);
  const [selectedLogsIncident, setSelectedLogsIncident] = useState<any>(null);

  const handleViewLogs = (incident: any, e: React.MouseEvent) => {
    e.stopPropagation();
    setSelectedLogsIncident(incident);
    setLogsModalOpen(true);
  };

  const formatTime = (timestamp: number): string => {
    const elapsed = Math.floor((Date.now() - timestamp) / 1000);
    if (elapsed < 60)  return `${elapsed}s ago`;
    const minutes = Math.floor(elapsed / 60);
    if (minutes < 60)  return `${minutes}m ago`;
    return `${Math.floor(minutes / 60)}h ago`;
  };

  const getSeverityClass = (severity: string): string => {
    switch (severity) {
      case 'CRIT': return 'severity-critical';
      case 'WARN': return 'severity-warning';
      case 'INFO': return 'severity-info';
      default: return '';
    }
  };

  const sorted = [...incidents].sort((a, b) => {
    const order = { CRIT: 0, WARN: 1, INFO: 2 };
    const diff = (order[a.severity] ?? 3) - (order[b.severity] ?? 3);
    return diff !== 0 ? diff : b.startTime - a.startTime;
  });

  return (
    <div className="incident-feed">
      <div className="panel-header">
        <h2>Active Incidents</h2>
        <span className="incident-count">{incidents.length}</span>
      </div>

      <div className="incident-list">
        {sorted.length === 0 ? (
          <div className="no-incidents">
            <p>All systems operational</p>
          </div>
        ) : (
          sorted.map(incident => {
            const def = INCIDENTS.find(i => i.id === incident.definitionId);
            const displayName = incident.aiGenerated
              ? ((incident as any).aiIncidentName || incident.id.replace(/_/g, ' ').replace(/^ai /, ''))
              : (def?.name || 'Unknown Incident');
            const isCrit = incident.severity === 'CRIT';

            return (
              <div
                key={incident.id}
                className={`incident-item ${getSeverityClass(incident.severity)} ${
                  selectedIncidentId === incident.id ? 'selected' : ''
                } ${incident.aiGenerated ? 'ai-incident' : ''}`}
                onClick={() => onSelectIncident(incident.id)}
              >
                <div className="incident-header">
                  <SevDot
                    severity={incident.severity as 'CRIT' | 'WARN' | 'INFO'}
                    pulse={isCrit}
                  />
                  <StatusBadge level={incident.severity as 'CRIT' | 'WARN' | 'INFO'} />
                  {incident.aiGenerated && <AiBadge />}
                  <span className="incident-time">{formatTime(incident.startTime)}</span>
                </div>

                <div className="incident-title">{displayName}</div>
                <div className="incident-target">{incident.targetNodeId}</div>

                {incident.aiGenerated && (incident as any).aiLogs && (
                  <button
                    className="view-logs-button"
                    onClick={(e) => handleViewLogs(incident, e)}
                  >
                    View Logs →
                  </button>
                )}

                {incident.mitigationProgress > 0 && (
                  <div className="mitigation-bar" style={{ height: '10px', marginTop: '6px' }}>
                    <div
                      className="mitigation-fill"
                      style={{ width: `${incident.mitigationProgress * 100}%` }}
                    />
                  </div>
                )}
              </div>
            );
          })
        )}
      </div>

      {logsModalOpen && selectedLogsIncident && (
        <LogsModal
          incidentName={(selectedLogsIncident as any).aiIncidentName || 'Incident'}
          logs={(selectedLogsIncident as any).aiLogs || 'No logs available'}
          onClose={() => setLogsModalOpen(false)}
        />
      )}
    </div>
  );
}
```

- [ ] **Step 2: Type-check and build**

```bash
npx tsc --noEmit && npm run build
```

Visual check: CRIT incidents have red-tinted background. Severity dots appear before badge labels. No emoji in the feed. Mitigation bar is 10px tall — visible.

---

### Task E3: `ActionBar.tsx` — category headers, emoji → text

**Files:**
- Modify: `src/ui/ActionBar.tsx`

**Interfaces:**
- Produces: Category header elements (`<div className="action-category-header">`) between action groups. In-progress spinner replaces ⏳.

- [ ] **Step 1: Replace the section header and add category grouping**

Find the JSX return in `ActionBar.tsx`. Replace:
```tsx
<div className="action-bar-header">
  <h3>⚡ Quick Actions</h3>
</div>
<div className="action-bar-buttons">
  {quickActionIds.map((actionId, idx) => {
```

With:
```tsx
<div className="action-bar-header">
  <h3>Quick Actions</h3>
</div>
<div className="action-bar-buttons">
  {/* Category headers injected inline before each group */}
  {quickActionIds.map((actionId, idx) => {
```

- [ ] **Step 2: Inject category headers and replace ⏳ spinner**

The `quickActionIds` array is already organized into comment sections. Add category header injection before each group. Replace the entire return's button rendering:

```tsx
// Add this helper above the return, inside the component:
const CATEGORY_BREAKS: Record<string, string> = {
  scale_down_app:          '💲 Cost & Optimize',
  add_app_instance:        '⬆ Scale',
  add_db_replica:          '🗄 Database',
  split_auth_service:      '⚙ Microservices',
  add_cache_node:          '⚡ Performance',
  add_apigw_instance:      '🏗 Infrastructure',
  add_distributed_tracing: '🔭 Observability',
  enable_autoscaling:      '💰 Cost Automation',
  add_ddos_protection:     '🛡 Security',
  add_priority_queue:      '⚙ Advanced',
};
// (emoji here are category headers only — not button labels — acceptable use per plan)
// If you want zero emoji, replace with text abbreviations: "$ COST", "↑ SCALE", etc.
```

Then in the map, before each button render, check if the actionId starts a new category:

```tsx
{quickActionIds.map((actionId, idx) => {
  const action = ACTIONS.find(a => a.id === actionId);
  if (!action) return null;
  if (action.target && !state.deployedComponents.has(action.target)) return null;

  const canExecute = canExecuteAction(actionId);
  const cooldown = getCooldownRemaining(actionId);
  const inProgress = state.actionsInProgress.some(a => a.actionId === actionId);
  const categoryLabel = CATEGORY_BREAKS[actionId];

  return (
    <>
      {categoryLabel && (
        <div key={`cat-${actionId}`} className="action-category-header">
          {categoryLabel}
        </div>
      )}
      <button
        key={actionId}
        className={`quick-action ${!canExecute || cooldown > 0 ? 'disabled' : ''} ${
          inProgress ? 'in-progress' : ''
        }`}
        onClick={() => onExecuteAction(actionId)}
        disabled={!canExecute || cooldown > 0}
        title={action.description}
      >
        <div className="action-hotkey">{idx + 1}</div>
        <div className="action-name">{action.name}</div>
        <div className="action-cost">${action.oneTimeCost}</div>
        {cooldown > 0 && <div className="action-cooldown">{cooldown}s</div>}
        {inProgress && <span className="action-spinner" aria-label="In progress" />}
      </button>
    </>
  );
})}
```

> Note: The `<>` fragment wrapping the header + button will cause a React key warning. Fix by using `React.Fragment key={actionId}`:
```tsx
return (
  <React.Fragment key={actionId}>
    {categoryLabel && <div className="action-category-header">{categoryLabel}</div>}
    <button ...>
```

- [ ] **Step 3: Type-check and build**

```bash
npx tsc --noEmit && npm run build
```

---

### Task E4: `DetailPanel.tsx` — clean tab labels and emoji

**Files:**
- Modify: `src/ui/DetailPanel.tsx`

- [ ] **Step 1: Clean tab label emoji**

Lines 111–125: Replace emoji-prefixed tab labels:
```tsx
// Line 114: '📊 Node'    → 'Node'
// Line 120: '🚨 Incident' → 'Incident'
// Line 126: '📈 Strategy' → 'Strategy'
```

After the change:
```tsx
<button className={`tab-button ${activeTab === 'node' ? 'active' : ''}`}
  onClick={() => setActiveTab('node')}>
  Node
</button>
<button className={`tab-button ${activeTab === 'incident' ? 'active' : ''}`}
  onClick={() => setActiveTab('incident')}>
  Incident
</button>
<button className={`tab-button ${activeTab === 'strategy' ? 'active' : ''}`}
  onClick={() => setActiveTab('strategy')}>
  Strategy
</button>
```

- [ ] **Step 2: Clean remaining emoji in DetailPanel**

| Line | Current | Replace with |
|---|---|---|
| 185 | `📊 Component Metrics` | `Component Metrics` |
| 258 | `🤖 AI-Generated Incident` | `<AiBadge /> AI-Generated Incident` |
| 333 | `💡 Fixing this incident...` | `Fixing this incident...` |
| 369–370 | `🤖 {aiAction.actionName}` + `⏳` | `<AiBadge /> {aiAction.actionName}` + `<span className="action-spinner" />` |
| 420 | `⏳` | `<span className="action-spinner" />` |

Import `AiBadge` at the top:
```tsx
import { AiBadge } from './atoms';
```

- [ ] **Step 3: Type-check and build**

```bash
npx tsc --noEmit && npm run build
```

---

### Task E5: `ArchMap.tsx` — node size, type badges, arrowheads, viewBox

**Files:**
- Modify: `src/ui/ArchMap.tsx`

**Interfaces:**
- Consumes: `Lock` from `lucide-react` (replaces `🔒` emoji in SVG text)
- Note: Lucide icons cannot be rendered inside SVG `<text>` elements. The lock icon is currently rendered as `<text>🔒</text>` — replace with a proper SVG `<path>` or a `<foreignObject>` wrapper. Simplest fix: replace with a styled `<rect>` with a CSS class and the text "LOCKED".

- [ ] **Step 1: Reduce node dimensions in `basePositions` scale**

The SVG viewBox is `0 0 2000 2000`. Node rectangles are 300×200. Change node rect dimensions from `width={300}` `height={200}` to `width={240}` `height={160}` throughout the render function. Update all related constants:

Find all hardcoded `300` width and `200` height references in the node rendering section (lines ~435–730) and replace:
- `width={300 + ...}` → `width={240 + ...}`  
- `height={200 + ...}` → `height={160 + ...}`
- `width="316"` (incident glow rect) → `width="256"`
- `height="216"` → `height="176"`
- `x={pos.x + 150}` (centering) → `x={pos.x + 120}`
- Utilization bar: `width="240"` → `width="200"`, positioned at `pos.x + 20`
- Health bar: same
- Metrics text y-offsets: reduce by 40px proportionally

- [ ] **Step 2: Add arrowhead marker to SVG `<defs>`**

After the existing `</filter>` closing tag inside `<defs>`, add:
```tsx
<marker
  id="arrow"
  markerWidth="8"
  markerHeight="6"
  refX="8"
  refY="3"
  orient="auto"
  markerUnits="strokeWidth"
>
  <polygon points="0 0, 8 3, 0 6" fill="rgba(0,217,151,0.40)" />
</marker>
```

Then update the edge `<line>` elements to `<path>` with the marker:
```tsx
// Replace the <line> in the edges map:
<path
  d={`M${from.x + 120},${from.y + 80} L${to.x + 120},${to.y + 80}`}
  stroke="rgba(0,217,151,0.25)"
  strokeWidth="2"
  strokeDasharray="6,6"
  markerEnd="url(#arrow)"
  fill="none"
/>
```

- [ ] **Step 3: Add node type badges**

The type badge is a small `<rect>` + `<text>` in the top-right of each node. Define the type label mapping above the return:

```tsx
const NODE_TYPE_LABEL: Record<string, string> = {
  DNS: 'DNS', CDN: 'CDN', WAF: 'WAF', GLB: 'GLB', RLB: 'RLB',
  APP: 'APP', APIGW: 'API', CACHE: 'CACHE', QUEUE: 'QUEUE',
  WORKERS: 'WORK', DB_PRIMARY: 'DB', DB_REPLICA: 'DB·R',
  STORAGE: 'STORE', OBSERVABILITY: 'OBS', SERVICE_MESH: 'MESH',
};
```

Inside the node render (after the main `<rect>`), add:
```tsx
{/* Type badge — top-right corner */}
{NODE_TYPE_LABEL[node.type] && (
  <g>
    <rect
      x={pos.x + 170}
      y={pos.y + 8}
      width={60}
      height={18}
      rx={3}
      fill="rgba(255,255,255,0.06)"
      stroke="rgba(255,255,255,0.12)"
      strokeWidth={1}
    />
    <text
      x={pos.x + 200}
      y={pos.y + 21}
      textAnchor="middle"
      fill="rgba(255,255,255,0.45)"
      fontSize={11}
      fontFamily="'Space Grotesk', system-ui, sans-serif"
      fontWeight={600}
      letterSpacing={0.5}
    >
      {NODE_TYPE_LABEL[node.type]}
    </text>
  </g>
)}
```

- [ ] **Step 4: Fix the `🔒` emoji in SVG text (line ~730)**

Current:
```tsx
<text x={pos.x + 150} y={pos.y + 70} textAnchor="middle" fill="#444" fontSize="32">🔒</text>
```

Replace with:
```tsx
<g>
  <rect
    x={pos.x + 60} y={pos.y + 50}
    width={120} height={32}
    rx={4}
    fill="rgba(62,62,82,0.8)"
    stroke="rgba(255,255,255,0.08)"
    strokeWidth={1}
  />
  <text
    x={pos.x + 120} y={pos.y + 71}
    textAnchor="middle"
    fill="rgba(255,255,255,0.25)"
    fontSize={13}
    fontFamily="'Space Grotesk', system-ui, sans-serif"
    fontWeight={600}
    letterSpacing={1}
  >
    LOCKED
  </text>
</g>
```

- [ ] **Step 5: Remove ⚠️ emoji from health warning (line ~668)**

Current:
```tsx
<text ...>⚠️</text>
```

Replace with a CSS-class-styled SVG triangle (no emoji):
```tsx
<polygon
  points={`${pos.x + 116},${pos.y + 142} ${pos.x + 130},${pos.y + 162} ${pos.x + 144},${pos.y + 142}`}
  fill="none"
  stroke="var(--status-warn)"
  strokeWidth={2}
  opacity={0.8}
/>
<text
  x={pos.x + 130}
  y={pos.y + 158}
  textAnchor="middle"
  fill="var(--status-warn)"
  fontSize={10}
  fontFamily="'JetBrains Mono', monospace"
  fontWeight={700}
>
  !
</text>
```

- [ ] **Step 6: Remove `⭐` from blueprint locked node (line ~614)**

Replace `⭐` emoji text with a simple diamond SVG shape:
```tsx
{/* Was: <text ...>⭐</text> */}
<polygon
  points={`${pos.x + 120},${pos.y + 30} ${pos.x + 130},${pos.y + 40} ${pos.x + 120},${pos.y + 50} ${pos.x + 110},${pos.y + 40}`}
  fill="rgba(245,158,11,0.30)"
  stroke="rgba(245,158,11,0.60)"
  strokeWidth={1}
/>
```

- [ ] **Step 7: Clean panel header emoji**

Line ~302: `<h2>🗺️ Architecture Map</h2>` → `<h2>Architecture</h2>`
Line ~305: `<button>🔍 Reset</button>` → `<button>Reset</button>`

- [ ] **Step 8: Type-check and build**

```bash
npx tsc --noEmit && npm run build
```

Visual check: Nodes are smaller (240×160). Edge lines have arrowheads. Type badges appear in top-right of each node. Locked nodes show "LOCKED" text instead of emoji. No emoji anywhere in the arch map.

---

### Task E6: Remaining component emoji cleanup

**Files:**
- Modify: `src/ui/PostMortem.tsx`
- Modify: `src/ui/LoadingScreen.tsx`
- Modify: `src/ui/AchievementToast.tsx`
- Modify: `src/ui/ActivityLog.tsx`
- Modify: `src/ui/TaskModal.tsx`
- Modify: `src/ui/tasks/TerminalCommandTask.tsx`
- Modify: `src/ui/tasks/ButtonSequenceTask.tsx`
- Modify: `src/ui/tasks/DragDropTask.tsx`
- Modify: `src/ui/tasks/MultiChoiceTask.tsx`
- Modify: `src/ui/tasks/LogSearchTask.tsx`
- Modify: `src/ui/tasks/CodeFixTask.tsx`
- Modify: `src/ui/tasks/ConfigEditTask.tsx`
- Modify: `src/ui/tasks/RealTimeMonitorTask.tsx`
- Modify: `src/ui/StatusPage.tsx`
- Modify: `src/ui/GameOverModal.tsx`
- Modify: `src/ui/IncidentTimeline.tsx`

**Interfaces:**
- All changes are pure string/JSX replacements. No type changes.

- [ ] **Step 1: `PostMortem.tsx` replacements**

| Line | Old | New |
|---|---|---|
| 14 | `'🔔 Tune Alert Thresholds'` | `'Tune Alert Thresholds'` |
| 15 | `'📊 Capacity Planning Review'` | `'Capacity Planning Review'` |
| 37 | `📋 Post-Mortem Report` | `Post-Mortem Report` |
| 70 | `💥 Impact` | `Impact` |
| 88 | `🎯 Action Items` | `Action Items` |
| 102 | `✅ Adopt` | `Adopt` |
| 111 | `📋 Complete Post-Mortem (+5 rep)` | `Complete Post-Mortem (+5 rep)` |

- [ ] **Step 2: `LoadingScreen.tsx` — narrative hook**

Line 8: `<h1>⚡ UPTIME 99.99</h1>` → `<h1>UPTIME 99.99</h1>`
Line 17: `<p className="loading-subtitle">Preparing your infrastructure simulation</p>` →
```tsx
<p className="loading-subtitle">30 minutes. Your startup. Don't let it go down.</p>
```

- [ ] **Step 3: `AchievementToast.tsx`**

Line 41: `🏆 Achievement Unlocked!` → `Achievement Unlocked`

- [ ] **Step 4: `ActivityLog.tsx`**

Line 64: `{isAIAction && '🤖 '}` → `{isAIAction && <AiBadge />}`

Import at top: `import { AiBadge } from './atoms';`

- [ ] **Step 5: `TaskModal.tsx`**

Line 135: `🎯 Action Task` → `Action Required`
Line 161: `⚠️ AI generated an invalid task` → `Invalid task data`
Line 245: `<div className="success-icon">✅</div>` → `<div className="success-icon">✓</div>` (styled with CSS)

- [ ] **Step 6: All `src/ui/tasks/*.tsx`**

Apply these replacements in every task file:

| Pattern | Replacement |
|---|---|
| `🎯 {title}` | `{title}` |
| `💡 Tip:` / `💡 Hint:` | `Hint:` |
| `🎯 Answer:` / `🎯 Expected Fix:` | `Answer:` / `Expected Fix:` |
| `✅ All steps completed` | `All steps completed` |
| `✅ All items placed` | `All items placed` |
| `✅ Correct!` | `Correct!` |
| `❌ "..."` (error messages) | Strip emoji prefix |
| `▶️ Execute Command` | `Execute →` |
| `💾 Save Configuration` | `Save Configuration` |
| `🔧 Apply Fix` | `Apply Fix` |
| `📊 {title}` (RealTimeMonitorTask) | `{title}` |
| `⚡ Terminal Command` | `Terminal Command` |

- [ ] **Step 7: `StatusPage.tsx`**

Line 57: Strip `⚠️` and `🚫` from title strings
Line 69: `📊 Status Page` → `Status Page`
Line 76: `⚠️ Your current status...` → `Your current status...`

- [ ] **Step 8: `GameOverModal.tsx`**

Line 93: `🔄 New Run` → `↺ New Run`

- [ ] **Step 9: `IncidentTimeline.tsx`**

Lines 47, 71: `📊 Incident Timeline` → `Incident Timeline`

- [ ] **Step 10: Type-check and build**

```bash
npx tsc --noEmit && npm run build
```

---

### Task E7: `LoadingScreen.css` — style the narrative hook

**Files:**
- Modify: `src/ui/LoadingScreen.css`

- [ ] **Step 1: Style updates**

Replace the `.loading-subtitle` rule:
```css
.loading-subtitle {
  font-size: 1rem;
  font-family: var(--font-ui);
  color: var(--text-secondary);
  letter-spacing: 0.02em;
  margin: 0;
  font-weight: 400;
}
```

Replace `.loading-logo h1`:
```css
.loading-logo h1 {
  font-family: var(--font-ui);
  font-size: 2.5rem;
  font-weight: 700;
  color: var(--interactive);
  text-shadow: 0 0 20px var(--interactive-glow);
  margin: 0;
  letter-spacing: 0.15em;
  animation: pulse 2s ease-in-out infinite;
}
```

- [ ] **Step 2: Build**

```bash
npm run build
```

---

## Phase F — Animation System

### Task F1: Consolidate animations in `theme.css`

**Files:**
- Modify: `src/styles/theme.css`

- [ ] **Step 1: Remove the 4 redundant scaling animations**

Delete these `@keyframes` blocks entirely from `theme.css`:
- `@keyframes scaleBorderGlow`
- `@keyframes scaleBadgeGlow`
- `@keyframes scaleIconPulse`
- `@keyframes scaleCountPulse`

Delete all class rules that reference them:
- `.scale-border-glow { animation: scaleBorderGlow ... }`
- `.scale-badge-glow { animation: scaleBadgeGlow ... }`
- `.scale-icon { animation: scaleIconPulse ... }`
- `.scale-count-pulse { animation: scaleCountPulse ... }`

Keep: `@keyframes scalePulse` — rename it to `@keyframes node-scaled` and update `.scale-pulse { animation: node-scaled 2s ease-in-out infinite }`. This single animation for scaled nodes is sufficient.

- [ ] **Step 2: Replace `transition: all 0.2s` occurrences**

Search `theme.css` for `transition: all 0.2s`. There are approximately 6 occurrences. Replace each with:
```css
transition:
  background-color var(--motion-fast) var(--ease-out),
  border-color     var(--motion-fast) var(--ease-out),
  box-shadow       var(--motion-fast) var(--ease-out),
  color            var(--motion-fast) var(--ease-out),
  transform        var(--motion-fast) var(--ease-out);
```

- [ ] **Step 3: Reserve `pulse` animation for CRIT-only**

The `@keyframes pulse` animation is used in 6+ places. Audit each `.class { animation: pulse ... }` rule:
- Keep: `.hud-value.critical` — CRIT HUD values should pulse
- Keep: `.incident-item.severity-critical` — active CRIT cards (if a pulse is added there)
- Keep: `.node-group.node-down` — down nodes
- Remove from: `.action-button.resolution.in-progress` — use border color change instead
- Remove from: `.hud-indicator.ai-initializing` — use opacity transition instead
- Remove from: `.hud-button.ai-active` — use a single glow instead

- [ ] **Step 4: Fix `warRoomBlink` step-end**

```css
/* Old */
@keyframes warRoomBlink {
  0%, 100% { opacity: 1; }
  50% { opacity: 0; }
}
/* New — smooth fade instead of binary blink */
@keyframes warRoomBlink {
  0%, 100% { opacity: 1; }
  50% { opacity: 0.3; }
}
/* Also change animation-timing-function from step-end to ease-in-out: */
.war-room-icon {
  animation: warRoomBlink 0.8s ease-in-out infinite;
}
```

- [ ] **Step 5: Type-check and build**

```bash
npx tsc --noEmit && npm run build
```

---

### Task F2: Node deploy entrance animation

**Files:**
- Modify: `src/ui/ArchMap.tsx`

**Interfaces:**
- The `deployingComponents` prop (`Map<string, { startTime, durationSec }>`) already tracks when a deployment started. A "just deployed" state needs tracking for the entrance animation — use a local `Set<string>` of recently-deployed node IDs that clears after 600ms.

- [ ] **Step 1: Add entrance animation tracking to ArchMap**

After the existing state declarations (after `useState` for zoom/pan), add:
```tsx
const [recentlyDeployed, setRecentlyDeployed] = useState<Set<string>>(new Set());
const prevDeployedRef = useRef<Set<string>>(new Set());

// Detect newly deployed nodes and trigger entrance animation
useEffect(() => {
  const prev = prevDeployedRef.current;
  const newNodes: string[] = [];
  deployedComponents.forEach(id => {
    if (!prev.has(id)) newNodes.push(id);
  });
  if (newNodes.length > 0) {
    setRecentlyDeployed(new Set(newNodes));
    const t = setTimeout(() => setRecentlyDeployed(new Set()), 600);
    return () => clearTimeout(t);
  }
  prevDeployedRef.current = new Set(deployedComponents);
}, [deployedComponents]);
```

- [ ] **Step 2: Apply entrance class to node groups**

In the node render, update the `<g>` className:
```tsx
<g
  key={node.id}
  onClick={() => onSelectNode(node.id)}
  style={{ cursor: 'pointer' }}
  className={`node-group
    ${status === 'degraded' ? 'node-degraded' : ''}
    ${status === 'down' ? 'node-down' : ''}
    ${recentlyDeployed.has(node.id) ? 'node-entering' : ''}
  `}
>
```

The `node-entering` class is defined in `organisms.css` (Task D2 Step 1).

- [ ] **Step 3: Type-check and build**

```bash
npx tsc --noEmit && npm run build
```

Visual check: When a blueprint deploys (if the bug were fixed), the node would scale-bounce into view. At current state (deployment bug per CLAUDE.md), this can be tested by temporarily adding a known nodeId to `recentlyDeployed` on mount.

---

## Phase G — Panel Layout Optimisation

### Task G1: Right panel width reduction + detail panel empty state

**Files:**
- Modify: `src/config/gameConfig.ts` (panel defaults only)
- Modify: `src/ui/DetailPanel.tsx` (empty state)

**Interfaces:**
- `GAME_CONFIG.ui.rightPanelWidth` changes from 380 → 300
- `GAME_CONFIG.ui.rightPanelMin` changes from 300 → 240

- [ ] **Step 1: Update `gameConfig.ts` panel defaults**

Find the `ui:` section (lines 182–191). Update:
```ts
ui: {
  leftPanelWidth:  320,   // was 350
  leftPanelMin:    240,   // was 250
  leftPanelMax:    520,   // was 500
  rightPanelWidth: 300,   // was 380 — reduces dead space when empty
  rightPanelMin:   240,   // was 300
  rightPanelMax:   600,   // unchanged
  bottomPanelHeight: 220, // was 200 — gives room for 2 action button rows
  bottomPanelMin:    160, // was 150
  bottomPanelMax:    0.6, // unchanged
},
```

- [ ] **Step 2: Add meaningful empty state to DetailPanel**

In `DetailPanel.tsx`, find the early-return when nothing is selected. Currently it renders nothing or an unhelpful empty div. Replace with:

```tsx
// Find the condition where selectedNode is null and activeTab is 'node'
// Typically around the return for the 'node' tab with no node selected:

if (activeTab === 'node' && !selectedNodeId) {
  return (
    <div className="detail-panel">
      <div className="panel-header">
        <div className="tab-buttons">
          {/* ... same tab buttons ... */}
        </div>
      </div>
      <div className="panel-content">
        <div className="empty-state" style={{ paddingTop: '4rem' }}>
          <div style={{
            fontSize: '0.8rem',
            color: 'var(--text-muted)',
            textAlign: 'center',
            lineHeight: 1.6,
          }}>
            <div style={{ marginBottom: '0.5rem', fontSize: '1.5rem', opacity: 0.3 }}>←</div>
            Select a node or incident<br />to view details
          </div>
        </div>
      </div>
    </div>
  );
}
```

- [ ] **Step 3: Type-check and build**

```bash
npx tsc --noEmit && npm run build
```

---

## Phase H — Final Verification

### Task H1: Full build, visual checklist, and enhancements.css token pass

**Files:**
- Modify: `src/styles/enhancements.css` (hardcoded hex → tokens)

- [ ] **Step 1: Replace hardcoded hex in `enhancements.css`**

The file uses hex values that should now reference tokens. Do a targeted pass:

| Old hex | Token |
|---|---|
| `#ef4444` | `var(--status-crit)` |
| `#f97316` | `var(--status-warn)` |
| `#eab308` | `var(--status-warn)` |
| `#22c55e` | `var(--status-good)` |
| `#3b82f6` | `var(--status-info)` |
| `#a78bfa` | `var(--color-ai)` |
| `rgba(15, 25, 45, ...)` | `var(--bg-overlay)` |
| `rgba(20, 30, 50, ...)` | `var(--bg-surface)` |
| `rgba(30, 40, 60, ...)` | `var(--bg-elevated)` |
| `#c8d6e5` | `var(--text-primary)` |
| `#8899aa` | `var(--text-secondary)` |
| `#6b7b8d` | `var(--text-muted)` |

Leave `rgba(...)` values with opacity intact — just replace the base colour portion where it is a recognisable token colour.

- [ ] **Step 2: Full build**

```bash
npm run build
```

Expected: zero TypeScript errors, zero Vite errors.

- [ ] **Step 3: Visual acceptance checklist**

Start the dev server (`npm run dev`) and verify each item:

**Foundation**
- [ ] HUD bar shows "UPTIME 99.99" in Space Grotesk (wider, geometric)
- [ ] HUD metric values stay in JetBrains Mono (narrow, monospace)
- [ ] Panel headers are Space Grotesk uppercase
- [ ] Session countdown strip visible below HUD bar, draining left-to-right

**Atoms**
- [ ] Incident feed: colored dots precede severity badges
- [ ] CRIT incidents: pulsing red dot, red-tinted card background
- [ ] INFO incidents: quiet blue dot, no background tint
- [ ] AI incidents: "AI" purple badge, no robot emoji
- [ ] Mitigation bar: 10px tall and visible

**Emoji**
- [ ] Zero emoji in: panel headers, tab labels, button labels, incident feed, modal headers
- [ ] "↺ New Run" and Lucide Pause/Play icons in HUD controls
- [ ] Arch map: no emoji in locked/warning/star positions
- [ ] "LOCKED" text badge on locked blueprint nodes
- [ ] Loading screen: "30 minutes. Your startup. Don't let it go down."

**Molecules**
- [ ] Action bar: category headers visible ("Cost & Optimize", "Scale", "Database"…)
- [ ] Quick-action buttons: description text visible below action name
- [ ] In-progress state: CSS spinner, not ⏳

**Organisms**
- [ ] Arch map: smaller nodes (240×160), type badges (DNS/APP/DB/CACHE) in top-right
- [ ] Arch map: edge lines have arrowheads
- [ ] Right panel: 300px default width; empty state shows "← Select a node..."
- [ ] Bottom bar: 220px height

**Color**
- [ ] CRIT color is consistently `#ef4444` — not pink `#ff3366`
- [ ] Interactive chrome (buttons, borders-on-hover) is `#00d997` teal
- [ ] AI content (badges, incident AI highlight) is `#a78bfa` violet
- [ ] Background levels clearly distinct: dark base, lighter panels, elevated cards

**Animation**
- [ ] At most 1–2 simultaneous pulsing elements during calm game state
- [ ] Node deploy entrance: scale-bounce animation on newly appearing nodes
- [ ] `prefers-reduced-motion: reduce` in devtools disables all animations

- [ ] **Step 4: Commit checkpoint**

```bash
git add src/styles/ src/ui/ src/data/costSavingActions.ts package.json package-lock.json
git status  # verify only expected files staged
git commit -m "$(cat <<'EOF'
feat: ui/ux redesign — design tokens, atomic components, emoji cleanup

- Add design-tokens.css (Space Grotesk + JetBrains Mono, new palette,
  motion tokens, prefers-reduced-motion)
- Add atoms: SevDot, AiBadge, StatusBadge, ProgressBar components
- Add molecules.css + organisms.css CSS layers
- Replace all UI emoji with CSS dots, SVG shapes, and Unicode symbols
- HudBar: countdown timer, remove Seed/API spend, Lucide icons
- IncidentFeed: severity visual hierarchy (background tint + dot + badge)
- ActionBar: category headers, CSS spinner
- ArchMap: 240x160 nodes, type badges, arrowhead edges, LOCKED text
- LoadingScreen: narrative hook copy
- Strip emoji from costSavingActions.ts names
- Panel defaults: right 380→300px, bottom 200→220px

Co-Authored-By: Claude Sonnet 4.6 (1M context) <noreply@anthropic.com>
EOF
)"
```

---

## Implementation Notes for Executor

1. **Build after every task.** `npx tsc --noEmit` is fast (5–10s). Use it. `npm run build` is the definitive gate — run it at the end of each Phase.

2. **Do not touch `src/sim/` or `src/services/`.** If a task accidentally pulls you there, stop and re-read the constraint.

3. **Phase order matters.** `design-tokens.css` (A1) must exist before any component task because components reference the CSS variables. If you skip A1, every downstream task will have broken variable references.

4. **The deployment bug (CLAUDE.md §0) is NOT fixed here.** The node entrance animation in F2 will not visibly trigger in a real game session because blueprints never actually deploy. The animation code is correct and will fire if/when that bug is fixed separately.

5. **`theme.css` has duplicate class definitions** (noted in CLAUDE.md — `action-button`, `metrics-grid`, `log-line` defined in multiple sheets). Do not consolidate these — that is a separate refactor outside this plan's scope. The new files go on top; the duplicates resolve by import order as before.

6. **`enhancements.css` imports after `theme.css`** in `App.tsx` (confirmed by CLAUDE.md). The `.modal-overlay` and `.modal-button` override behaviour is intentional — leave import order unchanged.

7. **Test the `prefers-reduced-motion` behaviour** by opening Chrome DevTools → Rendering → "Emulate CSS prefers-reduced-motion: reduce". All animations should stop immediately.
