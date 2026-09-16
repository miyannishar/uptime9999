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
