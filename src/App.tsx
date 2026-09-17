import React, { useReducer, useEffect, useRef, useState } from 'react';
import { createInitialState, tickSimulation } from './sim/engine';
import { gameReducer } from './sim/reducer';
import { SeededRNG, generateSeed } from './sim/rng';
import { initializeAIGameMaster, getAIGameMaster, resetAIGameMaster } from './services/aiGameMaster';
import { resetTaskApiTracking } from './services/taskGenerator';
import { shouldFlavour, flavourIncident } from './services/incidentFlavour';
import { INCIDENTS } from './data/incidents';

import HudBar from './ui/HudBar';
import IncidentFeed from './ui/IncidentFeed';
import ArchMap from './ui/ArchMap';
import DetailPanel from './ui/DetailPanel';
import ActionBar from './ui/ActionBar';
import ActivityLog from './ui/ActivityLog';
import { tlog } from './utils/terminalLog';
import GameOverModal from './ui/GameOverModal';
import { useResizable } from './hooks/useResizable';
import { useGameSubsystems } from './hooks/useGameSubsystems';
import { GAME_CONFIG } from './config/gameConfig';

// Enhancement feature imports
import StatusPage from './ui/StatusPage';
import StakeholderComms from './ui/StakeholderComms';
import PostMortem from './ui/PostMortem';
import PagerAlert from './ui/PagerAlert';
import IncidentTimeline from './ui/IncidentTimeline';
import AchievementToast from './ui/AchievementToast';

import './styles/design-tokens.css';
import './styles/atoms.css';
import './styles/molecules.css';
import './styles/organisms.css';
import './styles/theme.css';
import './styles/tasks.css';
import './styles/taskHints.css';
import './styles/enhancements.css';

function App() {
  const [seed, setSeed] = useState(generateSeed());
  const [state, dispatch] = useReducer(gameReducer, createInitialState(seed));
  const [selectedNode, setSelectedNode] = useState<string | null>(null);
  const [selectedIncident, setSelectedIncident] = useState<string | null>(null);
  const [showGameOver, setShowGameOver] = useState(false);
  
  const rngRef = useRef(new SeededRNG(seed));
  const stateRef = useRef(state);
  const flavouredIdsRef = useRef(new Set<string>());
  
  // Resizable panels (horizontal) - using config defaults
  const leftPanel = useResizable(
    GAME_CONFIG.ui.leftPanelWidth,
    GAME_CONFIG.ui.leftPanelMin,
    GAME_CONFIG.ui.leftPanelMax
  );
  const rightPanel = useResizable(
    GAME_CONFIG.ui.rightPanelWidth,
    GAME_CONFIG.ui.rightPanelMin,
    GAME_CONFIG.ui.rightPanelMax,
    'rtl',
  );
  
  // Resizable bottom panel (vertical)
  const [bottomHeight, setBottomHeight] = useState(GAME_CONFIG.ui.bottomPanelHeight);
  const [isResizingBottom, setIsResizingBottom] = useState(false);

  const handleBottomResizeStart = (e: React.MouseEvent) => {
    setIsResizingBottom(true);
    e.preventDefault();
  };

  useEffect(() => {
    if (!isResizingBottom) return;

    const handleMouseMove = (e: MouseEvent) => {
      const windowHeight = window.innerHeight;
      const maxHeight = windowHeight * GAME_CONFIG.ui.bottomPanelMax;
      const newHeight = Math.max(
        GAME_CONFIG.ui.bottomPanelMin,
        Math.min(maxHeight, windowHeight - e.clientY - 5)
      );
      setBottomHeight(newHeight);
    };

    const handleMouseUp = () => {
      setIsResizingBottom(false);
    };

    document.addEventListener('mousemove', handleMouseMove);
    document.addEventListener('mouseup', handleMouseUp);

    return () => {
      document.removeEventListener('mousemove', handleMouseMove);
      document.removeEventListener('mouseup', handleMouseUp);
    };
  }, [isResizingBottom]);

  // Keep stateRef in sync with latest state
  useEffect(() => {
    stateRef.current = state;
  }, [state]);

  // Always initialize AI Game Master on startup (AI mode is now default)
  // Use a ref to track if we've already initialized to prevent multiple calls
  const hasInitializedRef = useRef(false);
  
  useEffect(() => {
    // Only initialize once
    if (hasInitializedRef.current) {
      return;
    }

    const apiKey = import.meta.env.VITE_OPENAI_API_KEY;

    if (apiKey && apiKey.startsWith('sk-')) {
      // Check if instance already exists and has started
      const existingGameMaster = getAIGameMaster();
      if (existingGameMaster && existingGameMaster.isSessionActive()) {
        // Session already exists and is active, just mark as active
        dispatch({ type: 'SET_AI_SESSION_ACTIVE', active: true });
        hasInitializedRef.current = true;
        return;
      }

      // Create new instance only if needed
      const gameMaster = initializeAIGameMaster(apiKey);
      hasInitializedRef.current = true;

      gameMaster.startSession(state).then(() => {
        dispatch({ type: 'SET_AI_SESSION_ACTIVE', active: true });
      }).catch(err => {
        hasInitializedRef.current = false; // Reset on error so it can retry
        tlog.warn(`⚠️ AI Game Master failed to start: ${err.message} — running without AI prose.`);
      });
    } else {
      // No API key — game runs fine without one; AI prose is disabled.
      tlog.warn('ℹ️ VITE_OPENAI_API_KEY not set — game running without AI incident flavour. Add it to .env to enable.');
    }
  }, []); // Only run once on mount

  // Auto-PAUSE on tab hide, resume when visible again
  useEffect(() => {
    const handleVisibilityChange = () => {
      if (document.hidden && !stateRef.current.paused) {
        // Auto-pause when tab is hidden
        dispatch({ type: 'PATCH', fn: () => ({ autoPaused: true, paused: true }) });
      } else if (!document.hidden && stateRef.current.autoPaused) {
        dispatch({ type: 'PATCH', fn: () => ({ autoPaused: false, paused: false }) });
      }
    };

    document.addEventListener('visibilitychange', handleVisibilityChange);

    return () => {
      document.removeEventListener('visibilitychange', handleVisibilityChange);
    };
  }, []);

  // Game loop - runs whenever not paused or game over (no API key required)
  useEffect(() => {
    if (state.paused || state.gameOver) return;

    let lastTick = Date.now();
    const apiKey = import.meta.env.VITE_OPENAI_API_KEY as string | undefined;

    const interval = setInterval(() => {
      // Always use stateRef.current to capture the latest user actions
      const latestState = stateRef.current;

      if (latestState.paused || latestState.gameOver) {
        return;
      }

      if (document.hidden) {
        return;
      }

      const now = Date.now();
      const realDt = (now - lastTick) / 1000;
      lastTick = now;

      const dt = realDt * latestState.speed;

      // Snapshot incident IDs before tick so we can detect new spawns
      const prevIds = new Set(latestState.activeIncidents.map(i => i.id));

      const newState = tickSimulation(latestState, rngRef.current, dt);
      dispatch({ type: 'LOAD_GAME', state: newState });

      // Flavour newly spawned incidents with AI prose (async, never blocks the tick)
      if (apiKey) {
        const newIncidents = newState.activeIncidents.filter(i => !prevIds.has(i.id));
        for (const incident of newIncidents) {
          if (flavouredIdsRef.current.has(incident.id)) continue;
          if (!shouldFlavour(incident.severity, apiKey)) continue;

          flavouredIdsRef.current.add(incident.id);
          const def = INCIDENTS.find(d => d.id === incident.definitionId);
          const node = newState.architecture.nodes.get(incident.targetNodeId);
          if (!def || !node) continue;

          const id = incident.id;
          flavourIncident(def, node, apiKey).then(r => {
            if (!r) return;
            dispatch({
              type: 'PATCH',
              fn: s => ({
                activeIncidents: s.activeIncidents.map(i =>
                  i.id === id
                    ? { ...i, aiIncidentName: r.name, aiDescription: r.description, aiLogs: r.logs }
                    : i
                ),
              }),
            });
          });
        }
      }
    }, GAME_CONFIG.simulation.tickSeconds * 1000); // tickSeconds * 1000 ms tick

    return () => {
      clearInterval(interval);
    };
  }, [state.paused, state.gameOver]);

  // Stop AI session when game is over
  useEffect(() => {
    if (state.gameOver && state.aiSessionActive) {
      dispatch({ type: 'SET_AI_SESSION_ACTIVE', active: false });
    }
  }, [state.gameOver, state.aiSessionActive]);

  // Check game over
  useEffect(() => {
    if (state.gameOver && !showGameOver) {
      setShowGameOver(true);
    }
  }, [state.gameOver, showGameOver]);

  const resetSubsystems = useGameSubsystems(state, dispatch);

  const handleNewGame = () => {
    const newSeed = generateSeed();
    setSeed(newSeed);
    rngRef.current = new SeededRNG(newSeed);
    const newState = createInitialState(newSeed);
    dispatch({ type: 'LOAD_GAME', state: newState });
    setShowGameOver(false);
    setSelectedNode(null);
    setSelectedIncident(null);
    // I6 FIX: Reset AI singleton for clean new game
    resetAIGameMaster();
    resetTaskApiTracking(); // otherwise a new run inherits the previous run's exhausted task budget
    dispatch({ type: 'SET_AI_SESSION_ACTIVE', active: false });
    hasInitializedRef.current = false;
    flavouredIdsRef.current = new Set();
    resetSubsystems();
  };

  const handleTogglePause = () => {
    dispatch({ type: 'TOGGLE_PAUSE' });
  };

  const handleExecuteAction = (actionId: string, mitigatingIncidentId?: string) => {
    dispatch({ type: 'EXECUTE_ACTION', actionId, rng: rngRef.current, mitigatingIncidentId });
  };

  const handleMitigateIncident = (incidentId: string, actionId: string) => {
    dispatch({ type: 'MITIGATE_INCIDENT', incidentId, actionId });
    handleExecuteAction(actionId, incidentId);
  };

  const handleExecuteAIAction = (actionName: string, cost: number, duration: number, incidentId: string) => {
    dispatch({ type: 'EXECUTE_AI_ACTION', actionName, cost, duration, mitigatingIncidentId: incidentId });
  };

  return (
    <div className={`app ${state.warRoomActive ? 'war-room' : ''}`}>
      <HudBar
        state={state}
        onTogglePause={handleTogglePause}
        onNewGame={handleNewGame}
        onSetSpeed={(speed) => dispatch({ type: 'SET_SPEED', speed })}
      />

      {/* Status Page Widget — sits below HUD */}
      <StatusPage
        state={state}
        onUpdateStatus={(level, message) => dispatch({ type: 'UPDATE_STATUS_PAGE', level, message })}
      />

      <div className="main-layout">
        <div className="left-column" style={{ width: `${leftPanel.width}px` }}>
          <IncidentFeed
            incidents={state.activeIncidents}
            onSelectIncident={setSelectedIncident}
            selectedIncidentId={selectedIncident}
          />
        </div>

        <div 
          className={`resize-handle ${leftPanel.isResizing ? 'resizing' : ''}`}
          onMouseDown={leftPanel.handleMouseDown}
        >
          <div className="resize-handle-bar"></div>
        </div>

        <div className="center-column">
          <ArchMap
            architecture={state.architecture}
            activeIncidents={state.activeIncidents}
            onSelectNode={setSelectedNode}
            selectedNodeId={selectedNode}
            deployedComponents={state.deployedComponents}
            deployingComponents={state.deployingComponents}
            users={state.users}
            elapsedSec={(Date.now() - state.startTime) / 1000}
            totalIncidents={state.totalIncidents}
            cash={state.cash}
            onDeployComponent={(id) => dispatch({ type: 'DEPLOY_COMPONENT', componentId: id })}
          />
        </div>

        <div 
          className={`resize-handle ${rightPanel.isResizing ? 'resizing' : ''}`}
          onMouseDown={rightPanel.handleMouseDown}
        >
          <div className="resize-handle-bar"></div>
        </div>

        <div className="right-column" style={{ width: `${rightPanel.width}px` }}>
          <DetailPanel
            state={state}
            selectedNodeId={selectedNode}
            selectedIncidentId={selectedIncident}
            onExecuteAction={handleExecuteAction}
            onMitigateIncident={handleMitigateIncident}
            onExecuteAIAction={handleExecuteAIAction}
          />
        </div>
      </div>

      <div 
        className={`resize-handle-horizontal ${isResizingBottom ? 'resizing' : ''}`}
        onMouseDown={handleBottomResizeStart}
      >
        <div className="resize-handle-bar-horizontal"></div>
      </div>

      <div className="bottom-bar" style={{ height: `${bottomHeight}px` }}>
        <ActionBar
          state={state}
          onExecuteAction={handleExecuteAction}
        />
        
        <IncidentTimeline state={state} />
        
        <ActivityLog state={state} />
      </div>

      {/* === Enhancement Overlays === */}

      {/* Stakeholder Communications */}
      <StakeholderComms
        state={state}
        onRespond={(messageId, idx) => dispatch({ type: 'RESPOND_STAKEHOLDER', messageId, responseIndex: idx })}
        onDismiss={(messageId) => dispatch({ type: 'DISMISS_STAKEHOLDER', messageId })}
      />

      {/* Pager Alert */}
      <PagerAlert
        state={state}
        onAcknowledge={() => dispatch({ type: 'ACKNOWLEDGE_PAGER' })}
      />

      {/* Post-Mortem Modal */}
      {state.postMortemQueue.length > 0 && (
        <PostMortem
          incident={state.postMortemQueue[0]}
          onComplete={(items) => dispatch({ type: 'COMPLETE_POSTMORTEM', actionItems: items })}
          onSkip={() => dispatch({ type: 'SKIP_POSTMORTEM' })}
        />
      )}

      {/* Achievement Toast */}
      <AchievementToast
        achievementId={state.recentAchievement}
        timestamp={state.recentAchievementTime}
      />

      {/* War Room Banner */}
      {state.warRoomActive && (
        <div className="war-room-banner">
          <span className="war-room-icon">🔴</span>
          <span className="war-room-text">WAR ROOM ACTIVE</span>
          <span className="war-room-timer">
            {Math.floor((Date.now() - state.warRoomStartTime) / 1000)}s
          </span>
        </div>
      )}

      {showGameOver && (
        <GameOverModal
          state={state}
          onNewGame={handleNewGame}
          onClose={() => setShowGameOver(false)}
        />
      )}
    </div>
  );
}

export default App;

