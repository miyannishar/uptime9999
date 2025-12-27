// AI Game Master - GPT-4 powered incident generation and response

import { GameState } from '../sim/types';

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

export interface AIMetricsUpdate {
  healthChanges: Record<string, number>; // nodeId -> health delta
  metricsAdjustments: {
    errorRate?: number;
    latency?: number;
    utilization?: number;
  };
  reputationDelta: number;
  nextIncidentHint?: string;
}

export interface ConversationMessage {
  role: 'system' | 'user' | 'assistant';
  content: string;
}

class AIGameMaster {
  private apiKey: string;
  private conversationHistory: ConversationMessage[] = [];
  private sessionStarted: boolean = false;
  private incidentCount: number = 0;

  constructor(apiKey: string) {
    this.apiKey = apiKey;
  }

  async startSession(initialState: GameState): Promise<void> {
    if (this.sessionStarted) return;

    const systemPrompt = this.buildSystemPrompt(initialState);
    this.conversationHistory = [
      {
        role: 'system',
        content: systemPrompt,
      },
      {
        role: 'user',
        content: `Game session started. Initial state: ${this.serializeGameState(initialState)}. Begin monitoring and prepare to generate contextual incidents.`,
      },
    ];

    // Get initial response
    try {
      const response = await this.callOpenAI();
      this.conversationHistory.push({
        role: 'assistant',
        content: response,
      });
      this.sessionStarted = true;
    } catch (error) {
      throw error;
    }
  }

  async generateIncident(currentState: GameState): Promise<AIIncidentResponse | null> {
    if (!this.sessionStarted) {
      return null;
    }

    // Safety check: Don't generate incidents if game is over, paused, or AI session inactive
    if (currentState.gameOver || currentState.paused || !currentState.aiSessionActive) {
      return null;
    }

    // Calculate game progress (0-1, based on elapsed time)
    // Start easy, ramp up difficulty over 10 minutes (600 seconds)
    const now = currentState.currentTime || Date.now();
    const elapsedSeconds = (now - currentState.startTime) / 1000;
    const gameProgress = Math.min(1.0, elapsedSeconds / 600); // 0 at start, 1.0 after 10 minutes

    // Progressive difficulty: early game = mostly INFO/WARN, late game = more CRIT
    // Early game (0-2 min): INFO 60%, WARN 35%, CRIT 5%
    // Mid game (2-5 min): INFO 30%, WARN 50%, CRIT 20%
    // Late game (5-10 min): INFO 15%, WARN 35%, CRIT 50%
    const severityRoll = Math.random();
    let requiredSeverity: 'INFO' | 'WARN' | 'CRIT';
    
    if (gameProgress < 0.33) {
      // Early game (0-2 min): Easy mode
      if (severityRoll < 0.05) {
        requiredSeverity = 'CRIT'; // 5% chance
      } else if (severityRoll < 0.40) {
        requiredSeverity = 'WARN'; // 35% chance
      } else {
        requiredSeverity = 'INFO'; // 60% chance
      }
    } else if (gameProgress < 0.83) {
      // Mid game (2-5 min): Moderate difficulty
      if (severityRoll < 0.20) {
        requiredSeverity = 'CRIT'; // 20% chance
      } else if (severityRoll < 0.70) {
        requiredSeverity = 'WARN'; // 50% chance
      } else {
        requiredSeverity = 'INFO'; // 30% chance
      }
    } else {
      // Late game (5-10+ min): Hard mode
      if (severityRoll < 0.50) {
        requiredSeverity = 'CRIT'; // 50% chance
      } else if (severityRoll < 0.85) {
        requiredSeverity = 'WARN'; // 35% chance
      } else {
        requiredSeverity = 'INFO'; // 15% chance
      }
    }

    const prompt = this.buildIncidentPrompt(currentState, requiredSeverity);
    
    // Debug logging for AI communication
    if (import.meta.env.VITE_LOG_LEVEL === 'DEBUG') {
      import('../utils/terminalLog').then(({ tlog }) => {
        tlog.debug('');
        tlog.debug('🤖 ═══════════ AI REQUEST ═══════════');
        tlog.debug(`Prompt length: ${prompt.length} chars`);
        tlog.debug('Sending to OpenAI GPT-4o-mini...');
        tlog.debug(prompt.substring(0, 500) + '...');
        tlog.debug('═══════════════════════════════════════');
      });
    }
    
    this.conversationHistory.push({
      role: 'user',
      content: prompt,
    });

    try {
      const response = await this.callOpenAI();
      
      // Debug logging for AI response
      if (import.meta.env.VITE_LOG_LEVEL === 'DEBUG') {
        import('../utils/terminalLog').then(({ tlog }) => {
          tlog.debug('');
          tlog.debug('🤖 ═══════════ AI RESPONSE ═══════════');
          tlog.debug(`Response length: ${response.length} chars`);
          tlog.debug('Raw response:');
          tlog.debug(response);
          tlog.debug('═══════════════════════════════════════');
        });
      }
      
      this.conversationHistory.push({
        role: 'assistant',
        content: response,
      });

      const incident = this.parseIncidentResponse(response);
      
      if (!incident) {
        return null;
      }
      
      // Ensure incident matches the required severity (AI sometimes ignores instructions)
      if (incident.severity !== requiredSeverity) {
        incident.severity = requiredSeverity;
      }
      
      return incident;
    } catch (error) {
      return null;
    }
  }

  async reportUserAction(
    actionName: string,
    targetNode: string,
    incidentId: string | null,
    currentState: GameState
  ): Promise<AIMetricsUpdate | null> {
    if (!this.sessionStarted) return null;

    const prompt = `User executed action: "${actionName}" targeting ${targetNode}${
      incidentId ? ` to mitigate incident ${incidentId}` : ''
    }. Current system state: ${this.serializeGameState(currentState)}. 

Analyze the effectiveness of this action and respond with a JSON object containing:
{
  "healthChanges": { "nodeId": deltaValue },
  "metricsAdjustments": { "errorRate": delta, "latency": delta, "utilization": delta },
  "reputationDelta": number,
  "nextIncidentHint": "brief hint about what might happen next"
}`;

    this.conversationHistory.push({
      role: 'user',
      content: prompt,
    });

    try {
      const response = await this.callOpenAI();
      this.conversationHistory.push({
        role: 'assistant',
        content: response,
      });

      return this.parseMetricsUpdate(response);
    } catch (error) {
      return null;
    }
  }

  private buildSystemPrompt(_initialState: GameState): string {
    return `AI Game Master for "UPTIME 99.99" - DevOps simulation.

Goal: Generate creative, specific incidents based on component metrics and dynamic architecture.

DYNAMIC ARCHITECTURE AWARENESS:
- System now has MULTIPLE INSTANCES of components (app, app_2, workers, worker_2, db_replica, db_replica_2, etc.)
- Components are grouped by redundancyGroup (e.g., 'app_cluster', 'worker_pool', 'db_replicas')
- Player can ADD/REMOVE instances dynamically via Quick Actions
- Incidents should target SPECIFIC INSTANCES when relevant (e.g., "worker_2 is overloaded" not just "workers")
- If a redundancy group has multiple healthy instances, system can survive one instance failure
- Consider instance count when generating incidents (more instances = more resilient but more complex)

Components: app, cache, workers, db_primary, db_replica, queue, cdn, waf, dns, apigw, glb, rlb, storage, service_mesh, observability
+ Dynamic instances: app_2, worker_2, db_replica_2, cache_2, etc.
+ Split services: auth, payment, notification, search (if player created them)
Metrics examples: hitRate, queueBacklog, connections, cpu, instances, instanceNumber, redundancyGroup

Requirements:
1. Specific names (not "High Latency") - e.g., "Cache Thrashing - Hit Rate 45%"
2. Include "logs" field (5-7 lines)
3. Use "metricEffects" to degrade metrics
4. Actions with "metricImprovements" (no "Monitor"/"Review")
5. Vary severity: INFO 50%, WARN 30%, CRIT 20%

INCIDENT GENERATION RULES:
- **DIVERSIFY TARGETS**: Look at nodeMetrics and choose different nodes each time
  * If a node has "isStrengthened: true" (scaling > 1), it's LESS likely to have issues
  * If a node has "isHealthy: true", it's stable but can still have random issues
  * Avoid hitting the same node repeatedly - spread incidents across infrastructure
- **MIX INCIDENT TYPES** (don't just attack bottlenecks):
  * 30% Traffic/Load incidents (high utilization nodes)
  * 20% Security incidents (WAF, API Gateway, CDN)
  * 20% Database incidents (queries, connections, replication)
  * 15% Profit optimization opportunities (cost reduction, efficiency improvements)
  * 10% External dependencies (third-party APIs, DNS, CDN providers)
  * 5% Random chaos (healthy nodes can have random issues too!)
- **RESPECT PLAYER ACTIONS**:
  * If player scaled a node (×2, ×3), it's stronger now - less likely to fail
  * If player fixed a node, health improves - acknowledge this
  * Create narrative continuity - reference previous incidents/actions
- **SEVERITY BALANCE**:
  * INFO: 50% (30% minor issues/warnings, 20% profit optimization opportunities)
  * WARN: 30% (moderate problems requiring attention)
  * CRIT: 20% (serious threats, outages, escalations)
- **VARY SEVERITY INTELLIGENTLY**:
  * Use INFO (40% of time) for minor issues when system is healthy
  * Use WARN (40% of time) for moderate problems
  * Use CRIT (20% of time) for serious threats, especially if player ignores WARNs
- **MAKE EFFECTS IMPACTFUL BUT FAIR**:
  * CRIT: errorMultiplier 2-3x, latencyMultiplier 2-2.5x, healthDecayPerSec 0.001-0.003 (MAX per incident)
  * WARN: errorMultiplier 1.3-1.8x, latencyMultiplier 1.2-1.6x, healthDecayPerSec 0.0005-0.001 (optional)
  * INFO: latencyMultiplier 1.1-1.3x only, NO health decay
  * INFO (Optimization): NO negative effects! These are profit opportunities - use NO metricEffects or only positive ones
  * NOTE: Multiple incidents can stack, so keep healthDecayPerSec LOW (0.001-0.003 max per incident)
- **USE COMPONENT-SPECIFIC METRIC EFFECTS**:
  * For CACHE incidents: Affect hitRate, evictionRate, sizeGB, keysStored
  * For WORKERS incidents: Affect queueBacklog, jobsProcessedPerSec, failedJobsPercent, avgJobDuration
  * For DB incidents: Affect connections, slowQueriesPercent, replicationLag, cacheHitRate
  * For QUEUE incidents: Affect messagesQueued, avgMessageAge, deadLetterQueueSize
   * Example: Cache incident → "metricEffects": { "hitRate": -0.25, "evictionRate": 100 }
   * NOTE: Use plain numbers in JSON (100, -50), NOT unary + (+100) - JSON doesn't support it!
   * IMPORTANT: Keep metric effect values REALISTIC and SMALL:
   * - hitRate changes: -0.1 to -0.3 (small decrements)
   * - connections: 5-20 (small increments, not thousands!)
   * - evictionRate: 10-100 keys/sec (reasonable range)
   * - CPU/Memory percent: 5-15 (small increments)
   * - queueBacklog: 50-200 (small increments, not millions!)
   * These effects accumulate over time, so keep them SMALL!

RESPONSE FORMAT:
Always respond in valid JSON format with this structure:
{
  "incidentId": "MUST_BE_UNIQUE_use_timestamp_or_counter",
  "incidentName": "Short Incident Name",
  "description": "What happened and why (be specific, reference actual metrics)",
  "severity": "INFO" | "WARN" | "CRIT",
  "category": "TRAFFIC|SECURITY|DEPLOY|COMPUTE|DATABASE|QUEUE|EXTERNAL|OPTIMIZATION",
  "targetNodeId": "app|db_primary|cache|workers|etc",
  "logs": "[2023-10-10 14:23:15] WARN cache: Hit rate dropped to 55%\n[2023-10-10 14:23:16] ERROR cache: Eviction rate spiked to 250 keys/sec\n[2023-10-10 14:23:17] INFO cache: Memory fragmentation at 35%\n[2023-10-10 14:23:18] WARN cache: 150K keys stored, approaching capacity",
  "effects": {
    "errorMultiplier": 1.5,
    "latencyMultiplier": 1.3,
    "utilizationMultiplier": 2.0,
    "healthDecayPerSec": 0.01,
    "metricEffects": {
      "hitRate": -0.25,
      "evictionRate": 100,
      "queueBacklog": 50
    }
  }
  NOTE: For "OPTIMIZATION" category incidents, use NO metricEffects (or only positive ones) - these are profit opportunities, not problems!
    NOTE: Use plain numbers (e.g., 100, -50, 0.15) NOT +100 or +50 in JSON!
  },
  "suggestedActions": [
    {
      "actionName": "Increase Cache Size to 16GB",
      "description": "Doubles cache capacity, reduces evictions, improves hit rate",
      "cost": 500,
      "durationSeconds": 30,
      "effectiveness": 0.9,
      "metricImprovements": {
        "sizeGB": 8,
        "maxSizeGB": 8,
        "hitRate": 0.15,
        "evictionRate": -100
      }
      IMPORTANT: JSON numbers must be plain (100, -50) NOT with + signs (+100)!
    },
    {
      "actionName": "Optimize Cache TTL Strategy",
      "description": "Adjust TTL to reduce evictions and improve hit rate",
      "cost": 200,
      "durationSeconds": 20,
      "effectiveness": 0.7,
      "metricImprovements": {
        "hitRate": 0.10,
        "evictionRate": -50,
        "avgTTL": 120
      }
    }
  ],
  "escalationWarning": "Will escalate to outage in 2 minutes if unresolved",
  "autoResolveSeconds": 300
}

CRITICAL REQUIREMENTS:
1. **LOGS FIELD**: Generate 5-10 lines of realistic terminal logs with timestamps, log levels (INFO/WARN/ERROR), and specific metrics
2. **METRIC-AFFECTING ACTIONS**: Every action MUST have metricImprovements that directly change component metrics
3. **NO VAGUE ACTIONS**: Don't suggest "Review logs", "Monitor system", "Check metrics" - these don't fix anything!
4. **ACTIONABLE SOLUTIONS**: Suggest "Scale workers +2", "Increase cache size", "Optimize DB queries", "Add connection pool"
5. **VALID JSON ONLY**: Use plain numbers (NOT +7000 or -100, just 7000 or -100). JSON doesn't support unary + operator!

IMPORTANT HISTORY CONTEXT:
You have access to the full conversation history. Use it to:
- Reference previous incidents and player responses
- Create interconnected incident narratives
- Reward good player decisions with easier incidents
- Punish ignored warnings with escalations
- Build a story that makes sense

Be creative, realistic, and fair. Make the game challenging but fun!`;
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
    
    // Get nodes that were recently strengthened (scaled up)
    const strengthenedNodes = Array.from(state.architecture.nodes.values())
      .filter(n => n.enabled && n.scaling.current > 1)
      .map(n => `${n.name} (${n.id}) - ×${n.scaling.current} strengthened`)
      .join(', ');

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

    const prompt = `Generate a new incident. Current system state:
${this.serializeGameState(state)}

ARCHITECTURE OVERVIEW:
Active nodes: ${allNodes}
Redundancy status: ${redundancyStatus || 'No redundancy groups'}

BOTTLENECK ANALYSIS:
${bottlenecks ? `⚠️ Potential bottlenecks: ${bottlenecks}` : '✅ System healthy'}

ACTIVE INCIDENTS (Avoid duplicates):
${state.activeIncidents.length > 0 
  ? state.activeIncidents.map(i => `- ${i.targetNodeId}: ${i.aiGenerated ? (i as any).aiIncidentName : 'incident'} (${i.severity})`).join('\n')
  : 'None - system is clean'
}

RECENTLY TARGETED NODES (AVOID):
${recentTargets.length > 0 ? `❌ ${recentTargets.join(', ')} - targeted recently, try different nodes` : 'None'}

STRENGTHENED NODES (LOW PRIORITY):
${strengthenedNodes || 'None scaled yet'}

DYNAMIC ARCHITECTURE CONTEXT:
- Active nodes: ${allNodes}
- Redundancy: ${redundancyStatus || 'No redundancy'}
- Target SPECIFIC INSTANCES (e.g., "worker_2") when multiple exist
- Consider redundancy: Multiple instances = more resilient

⚡ **REQUIRED SEVERITY: ${requiredSeverity}** ⚡
You MUST generate an incident with severity="${requiredSeverity}". DO NOT CHANGE THIS!
${requiredSeverity === 'CRIT'
  ? 'This should be a SERIOUS threat requiring immediate action (e.g., connection pool exhausted, OOM, critical queue backlog, system outage risk).'
  : requiredSeverity === 'WARN'
  ? 'This should be a moderate problem requiring attention (e.g., DB connections 80/100, cache hit rate 60%, high utilization).'
  : 'This should be a minor issue OR a profit optimization opportunity (category "OPTIMIZATION"). No significant negative effects.'
}

CRITICAL RULES - FOLLOW STRICTLY:

1. **BE SPECIFIC AND CREATIVE - NO GENERIC "HIGH LATENCY" / "HIGH ERROR" INCIDENTS!**
   ❌ BAD: "High Latency Detected in App Cluster"
   ✅ GOOD: "Memory Leak in App Servers - 6GB Leaked in 10 Minutes"
   ✅ GOOD: "Database Connection Pool Exhausted - 98/100 Connections Active"
   ✅ GOOD: "Cache Thrashing - Hit Rate Plummeted to 35%"
   ✅ GOOD: "Zombie Worker Processes - 15 Stuck Jobs Blocking Queue"
   ✅ GOOD: "CDN Origin Shield Misconfiguration - Bypassing 70% of Cache"
   ✅ GOOD: "Rate Limiter False Positives - Blocking 25% of Legitimate Traffic"

2. **VARY SEVERITY BASED ON ACTUAL METRICS** (not periodic WARN):
   - **INFO** (50%): 
     * 30% - Minor issues on healthy nodes (cache hit rate 75% → 70%)
     * 20% - PROFIT OPTIMIZATION OPPORTUNITIES (no negative effects, suggest improvements that increase profit/min)
   - **WARN** (30%): Moderate problems needing attention (DB connections 80/100)
   - **CRIT** (20%): SERIOUS threats requiring immediate action (connection pool exhausted, OOM, queue depth 95%)
   - Check nodeMetrics: If health < 0.5 or utilization > 0.9 or specific metrics critical → CRIT!

3. **TARGET WEAK NODES INTELLIGENTLY**:
   - If queueBacklog over 100 then Workers incident
   - If connections over 80 percent of max then DB connection incident
   - If hitRate under 0.6 then Cache performance incident
   - If avgCPUPercent over 80 then APP resource exhaustion incident
   - If node is strengthened with 3+ instances then AVOID or make it external or random

4. **CREATIVE INCIDENT TYPES** (not just latency/errors):
   - Memory leaks, connection leaks, resource exhaustion
   - Cascading failures, thundering herd, retry storms
   - Configuration drift, certificate expiration, DNS issues
   - Third-party API degradation, DDoS attacks, bot traffic
   - Slow queries, lock contention, deadlocks
   - Cache stampede, queue flooding, worker starvation
   - **PROFIT OPTIMIZATION OPPORTUNITIES** (INFO severity, no negative effects):
     * Underutilized resources (can scale down to save costs)
     * Cache efficiency improvements (better hit rate = less DB load = lower costs)
     * Query optimization opportunities (faster queries = lower compute costs)
     * Auto-scaling recommendations (scale down idle services)
     * Cost optimization suggestions (remove unused features, optimize infrastructure)

5. **ACTIONABLE SOLUTIONS** - Reference ACTUAL metrics:
   ❌ NO: "Monitor system performance" 
   ✅ YES: "Increase connection pool from 100 to 200 connections"
   ✅ YES: "Scale workers from 2 to 5 instances (+150% capacity)"
   ✅ YES: "Flush cache and increase size from 8GB to 16GB"
   ✅ YES: "Kill stuck worker processes (15 zombies detected)"
   ✅ YES: "Add database indexes for slow queries (reduce 25% → 5%)"

6. **DIVERSIFY**: Recently targeted: ${recentTargets.join(', ') || 'none'} - CHOOSE DIFFERENT NODE!

YOUR TASK:
Generate ONE SPECIFIC, CREATIVE incident with severity="${requiredSeverity}":
- **MANDATORY**: Use severity="${requiredSeverity}" (DO NOT CHANGE THIS!)
- ❌ NO GENERIC "High Latency" / "High Error Rate" incidents!
- ✅ BE CREATIVE: Memory leaks, connection exhaustion, cache thrashing, zombie processes, etc.
${requiredSeverity === 'INFO' ? '- ✅ For INFO: Minor issues OR profit optimization opportunities (category "OPTIMIZATION" with NO negative effects)' : ''}
- Target node NOT in: ${recentTargets.join(', ') || 'none'}
- Check nodeMetrics for ACTUAL problems (queue backlog, connection pool, hit rate, CPU%) OR opportunities (low utilization = can save costs)
- Include 2-4 SPECIFIC actions that directly improve metrics (no "monitor" or "review")
- For INFO/OPTIMIZATION opportunities: Use category "OPTIMIZATION", NO negative metricEffects, suggest actions that save costs or improve efficiency

EXAMPLES OF GOOD INCIDENTS:
- Redis Memory Leak - 12GB Used with 95% Fragmentation
- PostgreSQL Deadlock Storm - 45 Queries Blocked
- Worker Zombie Apocalypse - 23 Stuck Processes
- CDN Cache Poisoning - 60% Stale Content Served
- API Gateway Circuit Breaker Triggered - 500 Requests Failing

EXAMPLES OF PROFIT OPTIMIZATION OPPORTUNITIES (INFO, category "OPTIMIZATION", NO negative effects):
- Underutilized Cache - Can Optimize TTL to Improve Hit Rate (Save DB Costs)
- Worker Pool Over-Provisioned - Scale Down Idle Workers to Reduce Costs
- Database Query Optimization Opportunity - Index Missing Columns (Reduce Compute Costs)
- CDN Cache Hit Rate Low - Optimize Cache Headers to Reduce Origin Costs

Respond ONLY with JSON, no markdown formatting.`;
    
    return prompt;
  }

  private serializeGameState(state: GameState): string {
    // Send COMPLETE current system state but in compact format
    const allNodes = Array.from(state.architecture.nodes.entries())
      .filter(([_, node]) => node.enabled)
      .map(([id, node]) => {
        const sm = node.specificMetrics;
        const metrics: any = { id, scaling: node.scaling.current, util: Math.round(node.utilization * 100), health: Math.round(node.health * 100) };
        
        // Add all specific metrics in compact form
        for (const [key, value] of Object.entries(sm)) {
          if (typeof value === 'number') {
            metrics[key] = Math.round(value * 100) / 100;
          } else if (typeof value === 'boolean') {
            metrics[key] = value;
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
    const response = await fetch('https://api.openai.com/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${this.apiKey}`,
      },
      body: JSON.stringify({
        model: 'gpt-4o-mini',
        messages: this.conversationHistory,
        temperature: 1.2, // Increased for more creativity and variety
        max_tokens: 1500,
      }),
    });

    if (!response.ok) {
      const errorData = await response.json().catch(() => ({}));
      throw new Error(`OpenAI API error: ${response.status} - ${errorData.error?.message || 'Unknown error'}`);
    }

    const data = await response.json();
    return data.choices[0].message.content;
  }

  private parseIncidentResponse(response: string): AIIncidentResponse | null {
    try {
      // Extract JSON from response (might have markdown code blocks)
      let jsonStr = response.trim();
      
      // Remove markdown code blocks if present
      if (jsonStr.startsWith('```')) {
        jsonStr = jsonStr.replace(/```json?\n?/g, '').replace(/```\n?/g, '');
      }
      
      // Fix invalid JSON: remove unary + signs from numbers (e.g., "+7000" -> "7000")
      // Match pattern: ": +number" (with optional whitespace) - JSON doesn't support unary +
      jsonStr = jsonStr.replace(/:\s*\+(\d+(?:\.\d+)?(?:[eE][+-]?\d+)?)/g, ': $1');
      
      const parsed = JSON.parse(jsonStr);
      
      // Validate structure
      if (!parsed.incidentId || !parsed.incidentName || !parsed.targetNodeId) {
        return null;
      }

      return parsed as AIIncidentResponse;
    } catch (error) {
      return null;
    }
  }

  private parseMetricsUpdate(response: string): AIMetricsUpdate | null {
    try {
      let jsonStr = response.trim();
      
      if (jsonStr.startsWith('```')) {
        jsonStr = jsonStr.replace(/```json?\n?/g, '').replace(/```\n?/g, '');
      }
      
      const parsed = JSON.parse(jsonStr);
      return parsed as AIMetricsUpdate;
    } catch (error) {
      return null;
    }
  }

  getConversationHistory(): ConversationMessage[] {
    return [...this.conversationHistory];
  }

  getConversationSummary(): string {
    return `Session started: ${this.sessionStarted}\nIncidents generated: ${this.incidentCount}\nMessages: ${this.conversationHistory.length}`;
  }

  isSessionActive(): boolean {
    return this.sessionStarted;
  }

  // Add user action to history (for non-AI actions too)
  logUserAction(actionName: string, targetNode: string, context: string = ''): void {
    const logMessage = `[Player Action] ${actionName} on ${targetNode}. ${context}`;
    this.conversationHistory.push({
      role: 'user',
      content: logMessage,
    });
    
    // Keep history manageable - trim to last 20 messages to avoid context window issues
    if (this.conversationHistory.length > 21) { // Keep system + 20 messages
      this.conversationHistory = [
        this.conversationHistory[0], // Keep system prompt
        ...this.conversationHistory.slice(-20),
      ];
    }
  }
}

// Singleton instance
let gameMasterInstance: AIGameMaster | null = null;

export function initializeAIGameMaster(apiKey: string): AIGameMaster {
  gameMasterInstance = new AIGameMaster(apiKey);
  return gameMasterInstance;
}

export function getAIGameMaster(): AIGameMaster | null {
  return gameMasterInstance;
}

