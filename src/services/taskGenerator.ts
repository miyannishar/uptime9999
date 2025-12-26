// Task Generator - Uses OpenAI to generate interactive technical tasks

export interface TaskData {
  type: 'config' | 'log' | 'terminal' | 'code' | 'button-sequence' | 'drag-drop' | 'multi-choice' | 'diagram' | 'monitor';
  data: any;
}

export async function generateTask(
  incidentName: string,
  incidentDescription: string,
  actionName: string,
  actionDescription: string,
  targetNode: string,
  apiKey: string
): Promise<TaskData | null> {
  const systemPrompt = `You are a DevOps task generator for the game "UPTIME 99.99".

Your role: Given an incident and the action the player is taking to fix it, generate ONE appropriate interactive technical task.

Available task types (ALL MUST BE TECHNICAL/DEVOPS):
1. **config**: Edit a configuration file (redis.conf, nginx.conf, database.yml, etc.)
2. **log**: Find a specific error in logs using search/filter (click to select)
3. **terminal**: Complete a terminal command (systemctl, docker, kubectl, etc.)
4. **code**: Fix a bug in code (SQL queries, API endpoints, etc.)
5. **button-sequence**: DevOps workflow steps (deploy, restart, scale, etc.)
6. **drag-drop**: Categorize errors, match configs to services, assign resources
7. **multi-choice**: Technical decisions (which algorithm, config value, approach)
8. **diagram**: Click infrastructure components in architecture diagram to fix
9. **monitor**: Watch real-time metrics (CPU, memory, connections) and click when threshold reached

RULES FOR CHOOSING TASK TYPE (ALL MUST BE TECHNICAL):
- "Restart", "Kill", "Deploy", "Rollback", "Scale", "Restart service" → terminal OR button-sequence
- "Configure", "Set", "Adjust TTL", "Update config", "Edit config" → config
- "Find", "Debug", "Investigate", "Check logs", "Search logs" → log (with search/filter)
- "Fix leak", "Remove", "Patch", "Optimize code", "Fix SQL", "Fix query" → code
- "Deploy process", "Troubleshooting steps", "Incident response", "Workflow" → button-sequence (TECHNICAL STEPS)
- "Categorize errors", "Match configs", "Assign resources", "Group services" → drag-drop (TECHNICAL CATEGORIES)
- "Choose algorithm", "Select config", "Which approach", "Technical decision" → multi-choice (TECHNICAL OPTIONS)
- "Architecture diagram", "Component diagram", "Fix infrastructure" → diagram (REAL COMPONENTS)
- "Monitor metrics", "Watch CPU", "Alert threshold", "Resource monitoring" → monitor (REAL METRICS)

CRITICAL: ALL TASKS MUST BE TECHNICAL/DEVOPS FOCUSED:
- Use real DevOps tools: systemctl, docker, kubectl, nginx, redis, postgres, etc.
- Use real technical terms: connection pool, cache hit rate, query latency, etc.
- Use real infrastructure: app servers, databases, load balancers, etc.
- NO generic/game-like content - make it feel like real DevOps work!

RESPOND WITH VALID JSON ONLY (no markdown, no code blocks):
{
  "type": "config|log|slider|terminal|code",
  "data": { ... task-specific fields ... }
}

TASK-SPECIFIC FIELDS:

For type="config":
{
  "type": "config",
  "data": {
    "filename": "redis.conf",
    "content": "# Redis Configuration\\nport 6379\\nmaxmemory 8gb\\nmaxmemory-policy allkeys-lru\\ntimeout 300\\n...",
    "targetKey": "timeout",
    "currentValue": "300",
    "targetValue": "600"
  }
}

⚠️ CRITICAL CONSISTENCY RULE:
- The "content" MUST include the EXACT line with "targetKey" and "currentValue"
- Example: If targetKey="timeout" and currentValue="300", content MUST have "timeout 300" or "timeout=300" or "timeout: 300"
- DO NOT ask to change from X to Y if X is not actually in the content!
- The line should match: "{targetKey} {currentValue}" or "{targetKey}={currentValue}" or "{targetKey}: {currentValue}"

For type="log":
{
  "type": "log",
  "data": {
    "logs": ["[2023-10-10 14:23:15] INFO app: Request processed", "[2023-10-10 14:23:16] ERROR db: Connection timeout", ...],
    "targetError": "Connection timeout"
  }
}

For type="terminal":
{
  "type": "terminal",
  "data": {
    "prompt": "Restart the Redis service to apply changes",
    "command": "systemctl restart ",
    "placeholder": "service-name",
    "expectedCompletion": "redis"
  }
}

For type="code":
{
  "type": "code",
  "data": {
    "filename": "queries.js",
    "code": "function getUsers() {\\n  const results = db.query('SELECT * FROM large_table WHERE condition=true');\\n  return results;\\n}",
    "issue": "Fetching all users is slow with large datasets; should only fetch necessary fields and add pagination",
    "fixHint": "Change SELECT * to SELECT id, name, email and add LIMIT 100",
    "expectedFix": "SELECT id, name, email FROM large_table WHERE condition=true LIMIT 100",
    "bugPattern": "SELECT *"
  }
}
CRITICAL: For code tasks:
- "fixHint" should CLEARLY explain EXACTLY what to change (e.g., "Change SELECT * to SELECT id, name")
- "expectedFix" should show the EXACT line or lines that should appear in the fixed code
- "bugPattern" should be something present in the buggy code but NOT in the fixed code (e.g., "SELECT *")
- Make the fix OBVIOUS and CLEAR - this is a game, not a coding interview!

For type="button-sequence" (TECHNICAL DEVOPS WORKFLOW):
{
  "type": "button-sequence",
  "data": {
    "title": "Deploy Fix to Production",
    "description": "Execute the deployment workflow in the correct order",
    "steps": [
      { "label": "1. Build", "buttonText": "docker build -t app:v2.1", "correct": true },
      { "label": "2. Test", "buttonText": "npm test", "correct": true },
      { "label": "3. Deploy", "buttonText": "kubectl rollout restart deployment/app", "correct": true },
      { "label": "Wrong", "buttonText": "Deploy without tests", "correct": false }
    ]
  }
}
CRITICAL: Use REAL DevOps commands and technical steps! Examples:
- "systemctl restart redis", "docker-compose up -d", "kubectl scale deployment app --replicas=3"
- "Run health checks", "Verify database connection", "Check cache hit rate"
- NO generic "Step 1, Step 2" - use technical action names!

For type="drag-drop" (TECHNICAL CATEGORIZATION):
{
  "type": "drag-drop",
  "data": {
    "title": "Categorize Database Errors",
    "description": "Drag each error to its correct troubleshooting category",
    "items": [
      { "id": "err1", "label": "Connection pool exhausted", "correctTarget": "connection" },
      { "id": "err2", "label": "Slow query (>5s)", "correctTarget": "performance" },
      { "id": "err3", "label": "Deadlock detected", "correctTarget": "locking" }
    ],
    "targets": [
      { "id": "connection", "label": "Connection Issues\n(Fix: Increase pool size)", "accepts": ["err1"] },
      { "id": "performance", "label": "Performance Issues\n(Fix: Add indexes)", "accepts": ["err2"] },
      { "id": "locking", "label": "Locking Issues\n(Fix: Optimize transactions)", "accepts": ["err3"] }
    ]
  }
}
CRITICAL: Use REAL technical errors and categories! Examples:
- Errors: "Connection timeout", "Memory leak", "Cache miss rate high", "Query latency spike"
- Categories: "Network Layer", "Application Layer", "Database Layer", "Cache Layer"
- Include technical fix hints in category labels!

For type="multi-choice" (TECHNICAL DECISION):
{
  "type": "multi-choice",
  "data": {
    "question": "Cache hit rate dropped to 45%. What's the best technical solution?",
    "options": [
      { 
        "id": "opt1", 
        "text": "Increase Redis maxmemory from 8GB to 16GB and adjust eviction policy to allkeys-lru", 
        "correct": true, 
        "explanation": "More memory reduces evictions, LRU policy keeps frequently accessed keys" 
      },
      { 
        "id": "opt2", 
        "text": "Disable Redis persistence (RDB/AOF)", 
        "correct": false, 
        "explanation": "Persistence doesn't affect hit rate, and disabling it risks data loss" 
      },
      { 
        "id": "opt3", 
        "text": "Restart Redis service", 
        "correct": false, 
        "explanation": "Restart clears cache, making hit rate worse temporarily" 
      }
    ]
  }
}
CRITICAL: Use REAL technical solutions with specific tools/configs! Examples:
- "Increase connection pool from 20 to 50 in application.properties"
- "Add index on user_id column in PostgreSQL"
- "Configure nginx rate_limit to 100 req/s per IP"
- NO generic answers - be specific and technical!

For type="diagram" (REAL INFRASTRUCTURE):
{
  "type": "diagram",
  "data": {
    "title": "Fix Infrastructure Components",
    "description": "Click on the failing components and apply the correct fix",
    "nodes": [
      { 
        "id": "app", 
        "label": "App Server\n(CPU: 95%)", 
        "type": "component", 
        "x": 200, 
        "y": 200, 
        "status": "error", 
        "requiredAction": "High CPU utilization detected", 
        "correctAction": "Scale App Instances +2" 
      },
      { 
        "id": "redis", 
        "label": "Redis Cache\n(Hit: 45%)", 
        "type": "component", 
        "x": 400, 
        "y": 200, 
        "status": "warning", 
        "requiredAction": "Low cache hit rate", 
        "correctAction": "Increase Cache Size" 
      },
      { 
        "id": "db", 
        "label": "PostgreSQL\n(Conn: 95/100)", 
        "type": "component", 
        "x": 300, 
        "y": 300, 
        "status": "normal" 
      }
    ]
  }
}
CRITICAL: Use REAL component names and metrics! Examples:
- "App Server (CPU: 95%, Memory: 88%)"
- "Redis Cache (Hit Rate: 45%, Evictions: 50/sec)"
- "PostgreSQL (Connections: 95/100, Query Latency: 2.3s)"
- Actions should be technical: "Scale App Instances", "Increase Connection Pool", "Add DB Replica"

For type="monitor" (REAL METRICS):
{
  "type": "monitor",
  "data": {
    "title": "Monitor System Metrics",
    "description": "Watch the metrics dashboard and click each metric when it reaches the alert threshold",
    "metrics": [
      { "name": "App Server CPU", "current": 45, "target": 80, "unit": "%", "threshold": "above" },
      { "name": "Redis Memory Usage", "current": 90, "target": 70, "unit": "%", "threshold": "below" },
      { "name": "DB Connection Pool", "current": 60, "target": 85, "unit": "/100", "threshold": "above" },
      { "name": "Cache Hit Rate", "current": 55, "target": 75, "unit": "%", "threshold": "above" }
    ]
  }
}
CRITICAL: Use REAL metric names from actual monitoring! Examples:
- "App Server CPU Usage", "Redis Memory Usage", "PostgreSQL Connection Pool"
- "Cache Hit Rate", "Query Latency P95", "Request Error Rate"
- "Worker Queue Backlog", "Database Replication Lag"
- Include component names and real thresholds!

BE CREATIVE AND REALISTIC! Match the task to the incident and action. ALL TASKS MUST BE TECHNICAL/DEVOPS FOCUSED!

CRITICAL VALIDATION RULES:
- For config tasks: The "content" field MUST contain the "targetKey" with "currentValue" that needs changing
- For log tasks: Generate 50-100 varied log lines with REAL log formats (timestamp, level, component, message), hide the error somewhere in the middle
- For terminal tasks: Use REAL DevOps commands (systemctl, docker, kubectl, pm2, redis-cli, psql, etc.)
- For code tasks: Show REAL code (SQL, JavaScript, Python, etc.) with a clear bug that matches the bugPattern
- For button-sequence: Use REAL technical steps with actual commands/tools
- For drag-drop: Use REAL technical errors and infrastructure categories
- For multi-choice: Use REAL technical solutions with specific tools/configs
- For diagram: Use REAL component names with actual metrics
- For monitor: Use REAL metric names from actual monitoring systems

ALL TASKS MUST FEEL LIKE REAL DEVOPS WORK - NO GENERIC/GAME-LIKE CONTENT!`;

  const userPrompt = `Incident: "${incidentName}" - ${incidentDescription}
Action: "${actionName}" - ${actionDescription}
Target Node: ${targetNode}

Generate ONE appropriate interactive task. Respond with JSON only.`;

  try {
    const response = await fetch('https://api.openai.com/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${apiKey}`,
      },
      body: JSON.stringify({
        model: 'gpt-4o-mini',
        messages: [
          { role: 'system', content: systemPrompt },
          { role: 'user', content: userPrompt },
        ],
        temperature: 1.0,
        max_tokens: 1500,
      }),
    });

    if (!response.ok) {
      console.error('Failed to generate task:', response.status);
      return null;
    }

    const data = await response.json();
    const content = data.choices[0].message.content;
    
    // Parse JSON response
    const cleanedContent = content
      .replace(/```json\n?/g, '')
      .replace(/```\n?/g, '')
      .trim();
    
    const taskData: TaskData = JSON.parse(cleanedContent);
    
    // VALIDATE: For config tasks, ensure the content actually contains currentValue
    if (taskData.type === 'config') {
      const { content, targetKey, currentValue, targetValue } = taskData.data;
      
      // Check if content contains the key with current value
      const hasCurrentValue = 
        content.includes(`${targetKey}=${currentValue}`) ||
        content.includes(`${targetKey}: ${currentValue}`) ||
        content.includes(`${targetKey} ${currentValue}`) ||
        content.includes(`_${targetKey}=${currentValue}`) ||
        content.includes(`_${targetKey}: ${currentValue}`) ||
        content.includes(`_${targetKey} ${currentValue}`);
      
      if (!hasCurrentValue) {
        console.warn(`⚠️ AI generated inconsistent config task. currentValue="${currentValue}" not found in content.`);
        console.warn('Rejecting this task...');
        return null; // Reject inconsistent tasks
      }
      
      // Also check that target value is different from current
      if (currentValue === targetValue) {
        console.warn(`⚠️ AI generated task with currentValue === targetValue (${currentValue})`);
        return null;
      }
    }
    
    return taskData;
  } catch (error) {
    console.error('Error generating task:', error);
    return null;
  }
}

