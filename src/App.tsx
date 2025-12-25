import React, { useReducer, useEffect, useRef, useState } from 'react';
import { createInitialState, tickSimulation } from './sim/engine';
import { gameReducer } from './sim/reducer';
import { SeededRNG, generateSeed } from './sim/rng';
import { saveGame, loadGame, hasSavedGame } from './utils/saveLoad';

import HudBar from './ui/HudBar';
import IncidentFeed from './ui/IncidentFeed';
import ArchMap from './ui/ArchMap';
import DetailPanel from './ui/DetailPanel';
import ActionBar from './ui/ActionBar';
import ActivityLog from './ui/ActivityLog';
import GameOverModal from './ui/GameOverModal';
import { useResizable } from './hooks/useResizable';
import { GAME_CONFIG } from './config/gameConfig';
import './styles/theme.css';

function App() {
  const [seed, setSeed] = useState(generateSeed());
  const [state, dispatch] = useReducer(gameReducer, createInitialState(seed));
  const [selectedNode, setSelectedNode] = useState<string | null>(null);
  const [selectedIncident, setSelectedIncident] = useState<string | null>(null);
  const [showGameOver, setShowGameOver] = useState(false);
  
  const rngRef = useRef(new SeededRNG(seed));
  const stateRef = useRef(state);
  
  // Resizable panels (horizontal) - using config defaults
  const leftPanel = useResizable(
    GAME_CONFIG.ui.leftPanelWidth,
    GAME_CONFIG.ui.leftPanelMin,
    GAME_CONFIG.ui.leftPanelMax
  );
  const rightPanel = useResizable(
    GAME_CONFIG.ui.rightPanelWidth,
    GAME_CONFIG.ui.rightPanelMin,
    GAME_CONFIG.ui.rightPanelMax
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

  // Game loop
  useEffect(() => {
    let lastTick = Date.now();
    let autosaveCounter = 0;

    const interval = setInterval(() => {
      const currentState = stateRef.current;
      
      if (currentState.paused || currentState.gameOver) return;

      const now = Date.now();
      const realDt = (now - lastTick) / 1000;
      lastTick = now;

      const dt = realDt * currentState.speed;

      // Tick simulation - this creates a new state based on the LATEST state
      const newState = tickSimulation(currentState, rngRef.current, dt);
      
      // Autosave every 30s
      autosaveCounter += realDt;
      if (autosaveCounter >= 30) {
        saveGame(newState, true);
        autosaveCounter = 0;
      }

      // Update state through dispatch
      dispatch({ type: 'LOAD_GAME', state: newState });
    }, 100); // 100ms tick

    return () => clearInterval(interval);
  }, []); // Empty deps - run once and use ref for latest state

  // Check game over
  useEffect(() => {
    if (state.gameOver && !showGameOver) {
      setShowGameOver(true);
    }
  }, [state.gameOver, showGameOver]);

  const handleNewGame = () => {
    const newSeed = generateSeed();
    setSeed(newSeed);
    rngRef.current = new SeededRNG(newSeed);
    const newState = createInitialState(newSeed);
    dispatch({ type: 'LOAD_GAME', state: newState });
    setShowGameOver(false);
    setSelectedNode(null);
    setSelectedIncident(null);
  };

  const handleLoadGame = () => {
    const loaded = loadGame(false);
    if (loaded) {
      setSeed(loaded.seed);
      rngRef.current = new SeededRNG(loaded.seed);
      dispatch({ type: 'LOAD_GAME', state: loaded });
      setShowGameOver(false);
    }
  };

  const handleSaveGame = () => {
    saveGame(state, false);
  };

  const handleTogglePause = () => {
    dispatch({ type: 'TOGGLE_PAUSE' });
  };

  const handleSetSpeed = (speed: number) => {
    dispatch({ type: 'SET_SPEED', speed });
  };

  const handleExecuteAction = (actionId: string, mitigatingIncidentId?: string) => {
    dispatch({ type: 'EXECUTE_ACTION', actionId, rng: rngRef.current, mitigatingIncidentId });
  };

  const handleMitigateIncident = (incidentId: string, actionId: string) => {
    dispatch({ type: 'MITIGATE_INCIDENT', incidentId, actionId });
    handleExecuteAction(actionId, incidentId);
  };

  return (
    <div className="app">
      <HudBar
        state={state}
        onTogglePause={handleTogglePause}
        onSetSpeed={handleSetSpeed}
        onSave={handleSaveGame}
        onLoad={handleLoadGame}
        onNewGame={handleNewGame}
        hasAutosave={hasSavedGame(true)}
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
            onSelectNode={setSelectedNode}
            selectedNodeId={selectedNode}
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
        
        <ActivityLog state={state} />
      </div>

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

