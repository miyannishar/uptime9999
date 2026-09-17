// AI Game Master - GPT-4 powered incident generation and response

import { GameState } from '../sim/types';

import { GAME_CONFIG } from '../config/gameConfig';
import aiSystemPromptData from '../data/json/aiSystemPrompt.json';
import { tlog } from '../utils/terminalLog';
import { chatJSON, parseJSON, errMsg, ChatMessage } from './openai';

export interface AIIncidentResponse {
  incidentId: string;
  incidentName: string;
  description: string;
  severity: 'INFO' | 'WARN' | 'CRIT';
  category: string;
  targetNodeId: string;
  logs: string; // Terminal-style logs showing what's happening (with \n line breaks)
  effects: {
    errorMultiplier?: number;
    latencyMultiplier?: number;
    utilizationMultiplier?: number;
    healthDecayPerSec?: number;
    // Component-specific metric effects
    metricEffects?: Record<string, number>; // e.g., { "hitRate": -0.2, "queueBacklog": +50 }
  };
  suggestedActions: Array<{
    actionId?: string; // Existing action ID, or undefined for new AI action
    actionName: string;
    description: string;
    cost: number;
    durationSeconds: number;
    effectiveness: number; // 0-1, how much this helps
    // What metrics this action will improve
    metricImprovements?: Record<string, number>; // e.g., { "hitRate": +0.15, "sizeGB": +8 }
  }>;
  escalationWarning?: string;
  autoResolveSeconds?: number;
}

export type ConversationMessage = ChatMessage;

class AIGameMaster {
  private apiKey: string;
  private conversationHistory: ConversationMessage[] = [];
  private sessionStarted: boolean = false;
  
  // C4 FIX: Session management
  private sessionStartTime: number = 0;
  private totalApiCalls: number = 0;
  private estimatedTokensUsed: number = 0;
  private estimatedCostUSD: number = 0;

  constructor(apiKey: string) {
    this.apiKey = apiKey;
  }

  // C4: Check if we should make an API call (within limits)
  shouldMakeApiCall(): boolean {
    const cfg = GAME_CONFIG.session;
    const now = Date.now();
    
    // Check call count
    if (this.totalApiCalls >= cfg.maxApiCalls) {
      return false;
    }
    
    // Check session duration
    if (this.sessionStartTime > 0 && (now - this.sessionStartTime) >= cfg.maxDurationMs) {
      return false;
    }
    
    return true;
  }


  getUsage() {
    return {
      totalCalls: this.totalApiCalls,
      estimatedTokens: this.estimatedTokensUsed,
      estimatedCostUSD: this.estimatedCostUSD,
    };
  }

  async startSession(initialState: GameState): Promise<void> {
    if (this.sessionStarted) return;

    // C4.4 FIX: Don't make a wasted API call here.
    // Just set the system prompt and mark the session as ready.
    // The first real call will happen in generateIncident().
    const systemPrompt = this.buildSystemPrompt(initialState);
    this.conversationHistory = [
      {
        role: 'system',
        content: systemPrompt,
      },
    ];

    this.sessionStarted = true;
    this.sessionStartTime = Date.now();
    this.totalApiCalls = 0;
    this.estimatedTokensUsed = 0;
    this.estimatedCostUSD = 0;
  }

  async generateIncident(currentState: GameState): Promise<AIIncidentResponse | null> {
    if (!this.sessionStarted) {
      return null;
    }

    // Safety check: Don't generate incidents if game is over, paused, or AI session inactive
    if (currentState.gameOver || currentState.paused || !currentState.aiSessionActive) {
      return null;
    }
    
    // C4: Check API call limits
    if (!this.shouldMakeApiCall()) {
      return null;
    }

    // BREATHER: Don't generate during calm period
    if (currentState.lastCalmPeriodEnd && Date.now() < currentState.lastCalmPeriodEnd) {
      return null;
    }

    // Calculate game progress (0-1, based on elapsed time)
    // Start easy, ramp up difficulty over 10 minutes (600 seconds)
    const now = currentState.currentTime || Date.now();
    const elapsedSeconds = (now - currentState.startTime) / 1000;
    const gameProgress = Math.min(1.0, elapsedSeconds / 600); // 0 at start, 1.0 after 10 minutes

    // ADAPTIVE DIFFICULTY: Back off when player is struggling
    const activeCount = currentState.activeIncidents.length;
    const isStruggling = activeCount >= 4 || currentState.cash < 500;
    const isCruising = activeCount < 2 && currentState.uptime > 0.95 && currentState.cash > 3000;

    // M2 FIX: Rebalanced severity distribution
    // Early game (0-3 min): INFO 60%, WARN 35%, CRIT 5%
    // Mid game (3-5 min): INFO 30%, WARN 50%, CRIT 20%
    // Mid-late (5-8 min): INFO 25%, WARN 45%, CRIT 30% (was 50%)
    // Late game (8+ min): INFO 20%, WARN 45%, CRIT 35% (capped from 50%)
    const severityRoll = Math.random();
    let requiredSeverity: 'INFO' | 'WARN' | 'CRIT';
    
    // Override: struggling player never gets CRIT
    if (isStruggling) {
      requiredSeverity = severityRoll < 0.6 ? 'INFO' : 'WARN';
    } else if (gameProgress < 0.3) {
      // Early game (0-3 min): Easy mode
      if (severityRoll < 0.05) {
        requiredSeverity = 'CRIT';
      } else if (severityRoll < 0.40) {
        requiredSeverity = 'WARN';
      } else {
        requiredSeverity = 'INFO';
      }
    } else if (gameProgress < 0.5) {
      // Mid game (3-5 min): Moderate
      if (severityRoll < 0.20) {
        requiredSeverity = 'CRIT';
      } else if (severityRoll < 0.70) {
        requiredSeverity = 'WARN';
      } else {
        requiredSeverity = 'INFO';
      }
    } else if (gameProgress < 0.8) {
      // Mid-late game (5-8 min): Harder
      const critThreshold = isCruising ? 0.30 : 0.25;
      if (severityRoll < critThreshold) {
        requiredSeverity = 'CRIT';
      } else if (severityRoll < critThreshold + 0.45) {
        requiredSeverity = 'WARN';
      } else {
        requiredSeverity = 'INFO';
      }
    } else {
      // Late game (8+ min): Hard but fair — CRIT capped at 35%
      const critThreshold = isCruising ? 0.35 : 0.30;
      if (severityRoll < critThreshold) {
        requiredSeverity = 'CRIT';
      } else if (severityRoll < critThreshold + 0.45) {
        requiredSeverity = 'WARN';
      } else {
        requiredSeverity = 'INFO';
      }
    }

    const prompt = this.buildIncidentPrompt(currentState, requiredSeverity);
    
    tlog.debug(`🤖 → ${prompt.length} chars: ${prompt.slice(0, 300)}`);

    // Drop prior turns: context lives in the prompt itself, so history would only burn tokens
    this.conversationHistory = [this.conversationHistory[0], { role: 'user', content: prompt }];

    try {
      const response = await this.callOpenAI();
      tlog.debug(`🤖 ← ${response.length} chars: ${response}`);
      this.conversationHistory.push({ role: 'assistant', content: response });

      const incident = this.parseIncidentResponse(response);
      if (!incident) return null;

      // AI sometimes ignores the requested severity
      incident.severity = requiredSeverity;
      return incident;
    } catch (error) {
      tlog.error(`❌ generateIncident failed: ${errMsg(error)}`);
      return null;
    }
  }


  private buildSystemPrompt(_initialState: GameState): string {
    return aiSystemPromptData.systemPrompt;
  }

  private buildIncidentPrompt(state: GameState, requiredSeverity: 'INFO' | 'WARN' | 'CRIT'): string {
    // Identify bottlenecks for AI context
    const bottlenecks = Array.from(state.architecture.nodes.values())
      .filter(n => n.enabled && (n.utilization > 0.8 || n.errorRate > 0.1 || n.health < 0.5))
      .map(n => `${n.name} (${n.id}) - util:${Math.round(n.utilization * 100)}%, err:${Math.round(n.errorRate * 100)}%, health:${Math.round(n.health * 100)}%, scaling:×${n.scaling.current}`)
      .join(', ');

    // Track recently targeted nodes (last 60 seconds)
    const now = Date.now();
    const recentTargets = state.recentIncidentTargets
      .filter(t => now - t.timestamp < 60000)
      .map(t => t.nodeId);
    
    // Get redundancy group info
    const redundancyInfo = new Map<string, number>();
    state.architecture.nodes.forEach(n => {
      if (n.enabled && n.redundancyGroup) {
        const count = redundancyInfo.get(n.redundancyGroup) || 0;
        redundancyInfo.set(n.redundancyGroup, count + 1);
      }
    });
    
    const redundancyStatus = Array.from(redundancyInfo.entries())
      .map(([group, count]) => `${group}: ${count} instances`)
      .join(', ');

    // List all active nodes (including dynamic instances)
    const allNodes = Array.from(state.architecture.nodes.values())
      .filter(n => n.enabled)
      .map(n => `${n.id} (${n.type}${n.redundancyGroup ? `, group:${n.redundancyGroup}` : ''})`)
      .join(', ');

    const prompt = `Generate incident. State: ${this.serializeGameState(state)}

Nodes: ${allNodes}
Redundancy: ${redundancyStatus || 'None'}
Bottlenecks: ${bottlenecks || 'None'}
Active: ${state.activeIncidents.length > 0 
  ? state.activeIncidents.map(i => `${i.targetNodeId}:${i.severity}`).join(',')
  : 'None'
}
Avoid: ${recentTargets.join(',') || 'None'}

⚡ REQUIRED: severity="${requiredSeverity}" ⚡
${requiredSeverity === 'CRIT' ? 'Serious threat (pool exhausted, OOM, queue 95%)' : requiredSeverity === 'WARN' ? 'Moderate problem (DB 80/100, hit rate 60%)' : 'Minor issue or optimization opportunity'}

Rules:
1. Be SPECIFIC: "Memory Leak - 6GB Leaked" not "High Latency"
2. Match metrics: queue>100→Workers, conn>80→DB, hitRate<60→Cache, cpu>80→APP
3. Creative: leaks, exhaustion, thrashing, zombies, deadlocks
4. Target NOT in: ${recentTargets.join(',') || 'none'}
5. Actions: Specific fixes (e.g., "Scale workers 2→5", "Increase pool 100→200")

Respond JSON only.`;
    
    return prompt;
  }

  private serializeGameState(state: GameState): string {
    // Send COMPLETE current system state for realistic incident generation
    const allNodes = Array.from(state.architecture.nodes.entries())
      .filter(([_, node]) => node.enabled)
      .map(([id, node]) => {
        const sm = node.specificMetrics;
        const metrics: any = { 
          id, 
          type: node.type,
          scaling: node.scaling.current, 
          util: Math.round(node.utilization * 100), 
          health: Math.round(node.health * 100),
          err: Math.round(node.errorRate * 1000) / 10
        };
        
        // Add all specific metrics (needed for realistic incident generation)
        if (sm) {
          for (const [key, value] of Object.entries(sm)) {
            if (typeof value === 'number') {
              metrics[key] = Math.round(value * 100) / 100;
            } else if (typeof value === 'boolean') {
              metrics[key] = value;
            }
          }
        }
        
        return metrics;
      });

    return JSON.stringify({
      users: Math.floor(state.users),
      uptime: Math.round(state.uptime * 100),
      cash: Math.floor(state.cash),
      rep: Math.floor(state.reputation),
      rps: Math.floor(state.rps),
      errorRate: Math.round(state.globalErrorRate * 1000) / 1000,
      latency: Math.round(state.globalLatencyP95),
      incidents: state.activeIncidents.length,
      nodes: allNodes,
    });
  }


  private async callOpenAI(): Promise<string> {
    this.totalApiCalls++;

    const { content, usage } = await chatJSON(this.apiKey, this.conversationHistory, 1.2);
    if (usage) {
      this.estimatedTokensUsed += usage.total_tokens ?? 0;
      this.estimatedCostUSD += (usage.prompt_tokens ?? 0) * GAME_CONFIG.ai.inputCostPerToken
                             + (usage.completion_tokens ?? 0) * GAME_CONFIG.ai.outputCostPerToken;
    }
    return content;
  }

  private parseIncidentResponse(response: string): AIIncidentResponse | null {
    const parsed = parseJSON<AIIncidentResponse>(response);
    if (!parsed) return null;
    if (!parsed.incidentId || !parsed.incidentName || !parsed.targetNodeId) {
      tlog.error(`❌ Incident JSON missing incidentId/incidentName/targetNodeId: ${JSON.stringify(parsed).slice(0, 300)}`);
      return null;
    }
    return parsed;
  }




  isSessionActive(): boolean {
    return this.sessionStarted;
  }

}

// Singleton instance
let gameMasterInstance: AIGameMaster | null = null;

export function initializeAIGameMaster(apiKey: string): AIGameMaster {
  // Only create new instance if one doesn't exist
  // If instance exists and is already started, reuse it (don't create new one)
  if (!gameMasterInstance) {
    gameMasterInstance = new AIGameMaster(apiKey);
  }
  return gameMasterInstance;
}

export function getAIGameMaster(): AIGameMaster | null {
  return gameMasterInstance;
}

// I6 FIX: Reset singleton for clean new game
export function resetAIGameMaster(): void {
  gameMasterInstance = null;
}

