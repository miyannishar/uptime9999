import React, { useReducer, useEffect, useRef, useState } from 'react';
import { createInitialState, tickSimulation } from './sim/engine';
import { gameReducer } from './sim/reducer';
import { SeededRNG, generateSeed } from './sim/rng';
import { saveGame, loadGame, hasSavedGame } from './utils/saveLoad';
import { initializeAIGameMaster, getAIGameMaster } from './services/aiGameMaster';
import { ACTIONS } from './data/actions';

import HudBar from './ui/HudBar';
import IncidentFeed from './ui/IncidentFeed';
import ArchMap from './ui/ArchMap';
import DetailPanel from './ui/DetailPanel';
import ActionBar from './ui/ActionBar';
import ActivityLog from './ui/ActivityLog';
import { tlog, isDebug } from './utils/terminalLog';
import GameOverModal from './ui/GameOverModal';
import { useResizable } from './hooks/useResizable';
import { GAME_CONFIG } from './config/gameConfig';
import './styles/theme.css';
import './styles/tasks.css';
import './styles/taskHints.css';

function App() {
  const [seed, setSeed] = useState(generateSeed());
  const [state, dispatch] = useReducer(gameReducer, createInitialState(seed));
  const [selectedNode, setSelectedNode] = useState<string | null>(null);
  const [selectedIncident, setSelectedIncident] = useState<string | null>(null);
  const [showGameOver, setShowGameOver] = useState(false);
  
  const rngRef = useRef(new SeededRNG(seed));
  const stateRef = useRef(state);
  const aiLastIncidentRef = useRef(0);
  
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

  // Always initialize AI Game Master on startup (AI mode is now default)
  useEffect(() => {
    if (!state.aiSessionActive) {
      const apiKey = import.meta.env.VITE_OPENAI_API_KEY;
      console.log('🔍 Checking API key...', apiKey ? 'Found (length: ' + apiKey.length + ')' : 'Not found');
      
      if (apiKey && apiKey.startsWith('sk-')) {
        console.log('🤖 Initializing AI Game Master...');
        const gameMaster = initializeAIGameMaster(apiKey);
        gameMaster.startSession(state).then(() => {
          dispatch({ type: 'SET_AI_SESSION_ACTIVE', active: true });
          console.log('✅ AI Game Master initialized successfully!');
        }).catch(err => {
          console.error('❌ Failed to start AI session:', err);
          alert(`Failed to initialize AI Game Master: ${err.message}\n\nThe game requires OpenAI API key to run.\n\nSteps:\n1. Create .env file in project root\n2. Add: VITE_OPENAI_API_KEY=sk-your-key\n3. RESTART dev server (npm run dev)\n\nCheck also:\n- API key is valid\n- You have OpenAI API credits\n- Network connection works`);
        });
      } else {
        console.error('❌ API key missing or invalid');
        alert(`⚠️ OpenAI API Key Required!\n\nThis game uses AI to generate dynamic incidents.\n\nSetup:\n1. Create .env file in project root\n2. Add: VITE_OPENAI_API_KEY=sk-your-key\n3. RESTART dev server (npm run dev)\n\nCurrent value: ${apiKey || 'undefined'}`);
      }
    }
  }, [state.aiSessionActive]);

  // Game loop
  useEffect(() => {
    let lastTick = Date.now();
    let autosaveCounter = 0;

    const interval = setInterval(async () => {
      const currentState = stateRef.current;
      
      if (currentState.paused || currentState.gameOver) return;

      const now = Date.now();
      const realDt = (now - lastTick) / 1000;
      lastTick = now;

      const dt = realDt * currentState.speed;

      // Tick simulation - this creates a new state based on the LATEST state
      const newState = tickSimulation(currentState, rngRef.current, dt);
      
      // AI Game Master: Generate contextual incidents based on system metrics
      if (newState.aiSessionActive) {
        // Initialize timer on first run
        if (aiLastIncidentRef.current === 0) {
          aiLastIncidentRef.current = now;
        }
        
        const timeSinceLastAI = now - aiLastIncidentRef.current;
        const elapsed = (now - newState.startTime) / 1000;
        
        // Highly variable timing - feels organic, not periodic
        // Use RNG for deterministic but varied intervals
        const baseMin = Math.max(8000, 15000 - elapsed * 4); // 15s → 8s
        const baseMax = Math.max(25000, 45000 - elapsed * 8); // 45s → 25s
        const randomFactor = rngRef.current.nextFloat(0.6, 1.4); // ±40% variance
        const randomInterval = (baseMin + rngRef.current.next() * (baseMax - baseMin)) * randomFactor;
        const stressMultiplier = Math.min(0.4, newState.activeIncidents.length * 0.15);
        const nextIncidentTime = randomInterval * (1 - stressMultiplier);
        
        // Silent - only log when spawning
        
        if (timeSinceLastAI > nextIncidentTime) {
          console.log('⏰ Spawning AI incident...');
          console.log('📊 State:', {
            users: Math.floor(newState.users),
            uptime: (newState.uptime * 100).toFixed(1) + '%',
            activeIncidents: newState.activeIncidents.length,
          });
          
          aiLastIncidentRef.current = now; // Reset timer IMMEDIATELY to prevent spam
          
          const gameMaster = getAIGameMaster();
          if (gameMaster) {
            // Don't await - let it run async
            gameMaster.generateIncident(newState).then(aiIncident => {
          if (aiIncident) {
            // Log incident to terminal (npm run dev terminal)
            tlog.error('');
            tlog.error('═══════════════════════════════════════════════');
            tlog.error(`🚨 NEW INCIDENT: ${aiIncident.incidentName}`);
            tlog.warn(`   Severity: ${aiIncident.severity} | Target: ${aiIncident.targetNodeId}`);
            tlog.info(`   ${aiIncident.description}`);
            if (aiIncident.effects?.metricEffects) {
              tlog.info('   Metric Effects:');
              for (const [key, val] of Object.entries(aiIncident.effects.metricEffects)) {
                tlog.info(`     ${key}: ${typeof val === 'number' && val > 0 ? '+' : ''}${val}`);
              }
            }
            tlog.error('═══════════════════════════════════════════════');
            
            // Log current component state after incident
            const targetNode = newState.architecture.nodes.get(aiIncident.targetNodeId);
            if (targetNode && isDebug()) {
              tlog.debug('');
              tlog.debug(`📊 ${targetNode.name} State After Incident:`);
              tlog.debug(`   Health: ${(targetNode.health * 100).toFixed(1)}%`);
              tlog.debug(`   Utilization: ${(targetNode.utilization * 100).toFixed(1)}%`);
              tlog.debug(`   Error Rate: ${(targetNode.errorRate * 100).toFixed(2)}%`);
              tlog.debug(`   Latency: ${targetNode.latency.toFixed(0)}ms`);
              if (targetNode.specificMetrics) {
                tlog.debug('   Specific Metrics:');
                for (const [key, val] of Object.entries(targetNode.specificMetrics)) {
                  tlog.debug(`     ${key}: ${JSON.stringify(val)}`);
                }
              }
              tlog.debug('');
            }
            
            // Track this target to encourage diversity
            dispatch({ type: 'TRACK_INCIDENT_TARGET', nodeId: aiIncident.targetNodeId });
            dispatch({ type: 'SPAWN_AI_INCIDENT', incident: aiIncident });
          } else {
            tlog.warn('⚠️ AI returned null - no incident generated');
          }
            }).catch(error => {
              console.error('❌ AI failed:', error.message);
            });
          }
        }
      }
      
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
    
    // Log action to AI history (for context in future incidents)
    if (stateRef.current.aiSessionActive) {
      const gameMaster = getAIGameMaster();
      if (gameMaster) {
        const action = ACTIONS.find(a => a.id === actionId);
        if (action) {
          const context = mitigatingIncidentId 
            ? `Mitigating incident: ${mitigatingIncidentId}` 
            : 'Proactive action';
          gameMaster.logUserAction(action.name, action.target, context);
        }
      }
    }
  };

  const handleMitigateIncident = (incidentId: string, actionId: string) => {
    dispatch({ type: 'MITIGATE_INCIDENT', incidentId, actionId });
    handleExecuteAction(actionId, incidentId);
  };

  const handleExecuteAIAction = (actionName: string, cost: number, duration: number, incidentId: string) => {
    dispatch({ type: 'EXECUTE_AI_ACTION', actionName, cost, duration, mitigatingIncidentId: incidentId });
    
    // Log AI action execution
    const gameMaster = getAIGameMaster();
    if (gameMaster) {
      gameMaster.logUserAction(actionName, 'ai-suggested', `Mitigating: ${incidentId}`);
    }
  };

  // AI is always on - no toggle needed

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
            activeIncidents={state.activeIncidents}
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

