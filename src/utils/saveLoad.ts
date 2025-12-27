// Save/Load system using localStorage

import { GameState } from '../sim/types';

const SAVE_KEY = 'uptime9999_save';
const AUTOSAVE_KEY = 'uptime9999_autosave';

export function saveGame(state: GameState, isAutosave: boolean = false): boolean {
  try {
    const serialized = serializeGameState(state);
    const key = isAutosave ? AUTOSAVE_KEY : SAVE_KEY;
    localStorage.setItem(key, JSON.stringify(serialized));
    return true;
  } catch (error) {
    return false;
  }
}

export function loadGame(isAutosave: boolean = false): GameState | null {
  try {
    const key = isAutosave ? AUTOSAVE_KEY : SAVE_KEY;
    const saved = localStorage.getItem(key);
    if (!saved) return null;

    const parsed = JSON.parse(saved);
    return deserializeGameState(parsed);
  } catch (error) {
    return null;
  }
}

export function hasSavedGame(isAutosave: boolean = false): boolean {
  const key = isAutosave ? AUTOSAVE_KEY : SAVE_KEY;
  return localStorage.getItem(key) !== null;
}

function serializeGameState(state: GameState): any {
  return {
    ...state,
    architecture: {
      nodes: Array.from(state.architecture.nodes.entries()),
      edges: state.architecture.edges,
    },
    actionCooldowns: Array.from(state.actionCooldowns.entries()),
    unlockedFeatures: Array.from(state.unlockedFeatures),
  };
}

function deserializeGameState(data: any): GameState {
  return {
    ...data,
    architecture: {
      nodes: new Map(data.architecture.nodes),
      edges: data.architecture.edges,
    },
    actionCooldowns: new Map(data.actionCooldowns),
    unlockedFeatures: new Set(data.unlockedFeatures),
  };
}

