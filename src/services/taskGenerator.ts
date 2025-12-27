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
  const systemPrompt = `You are a DevOps task generator. Generate ONE interactive technical task matching the incident and action.

TASK TYPES:
1. config - Edit configuration file
2. log - Find error in logs
3. terminal - Complete command
4. code - Fix bug in code
5. button-sequence - DevOps workflow steps
6. drag-drop - Categorize errors/resources
7. multi-choice - Technical decision
8. diagram - Click infrastructure nodes
9. monitor - Watch metrics and click when threshold hit

TYPE MAPPING:
- Restart/Deploy/Scale/Kill → terminal OR button-sequence
- Configure/Set/Edit config → config
- Find/Debug/Check logs → log
- Fix code/Patch/Optimize → code
- Workflow/Steps → button-sequence
- Categorize/Match → drag-drop
- Choose/Select/Decision → multi-choice
- Infrastructure diagram → diagram
- Monitor/Watch metrics → monitor

REQUIRED JSON FORMATS:

config:
{
  "type": "config",
  "data": {
    "filename": "redis.conf",
    "content": "# Redis Configuration\\nport 6379\\ntimeout 300\\nmaxmemory 8gb",
    "targetKey": "timeout",
    "currentValue": "300",
    "targetValue": "600"
  }
}
NOTE: content MUST include the exact line with targetKey and currentValue.

log:
{
  "type": "log",
  "data": {
    "logs": [
      "[2023-10-10 14:23:15] INFO app: Request processed",
      "[2023-10-10 14:23:16] ERROR db: Connection timeout",
      "[2023-10-10 14:23:17] INFO app: Another request"
    ],
    "targetError": "Connection timeout"
  }
}
NOTE: Generate 50-100 log lines, hide targetError in middle.

terminal:
{
  "type": "terminal",
  "data": {
    "prompt": "Restart the Redis service",
    "command": "systemctl restart ",
    "placeholder": "service-name",
    "expectedCompletion": "redis"
  }
}

code:
{
  "type": "code",
  "data": {
    "filename": "queries.js",
    "code": "function getUsers() {\\n  return db.query('SELECT * FROM users');\\n}",
    "issue": "Slow query - fetching all fields",
    "bugPattern": "SELECT *",
    "expectedFix": "SELECT id, name, email FROM users",
    "fixHint": "Change SELECT * to SELECT id, name, email"
  }
}

button-sequence:
{
  "type": "button-sequence",
  "data": {
    "title": "Deploy Process",
    "description": "Complete the deployment workflow",
    "steps": [
      { "label": "Build", "buttonText": "npm run build", "correct": true },
      { "label": "Test", "buttonText": "npm test", "correct": true },
      { "label": "Deploy", "buttonText": "kubectl apply -f deployment.yaml", "correct": true },
      { "label": "Skip Tests", "buttonText": "deploy without tests", "correct": false }
    ]
  }
}

drag-drop:
{
  "type": "drag-drop",
  "data": {
    "title": "Categorize Errors",
    "description": "Drag each error to its category",
    "items": [
      { "id": "err1", "label": "Connection timeout", "correctTarget": "network" },
      { "id": "err2", "label": "Memory leak", "correctTarget": "resource" }
    ],
    "targets": [
      { "id": "network", "label": "Network Issues", "accepts": ["err1"] },
      { "id": "resource", "label": "Resource Issues", "accepts": ["err2"] }
    ]
  }
}

multi-choice:
{
  "type": "multi-choice",
  "data": {
    "question": "Cache hit rate is 45%. Best solution?",
    "options": [
      { "id": "a", "text": "Increase Redis memory and use LRU eviction", "correct": true },
      { "id": "b", "text": "Disable Redis persistence", "correct": false },
      { "id": "c", "text": "Restart Redis service", "correct": false }
    ]
  }
}

diagram:
{
  "type": "diagram",
  "data": {
    "title": "Fix Infrastructure",
    "description": "Click the failing component",
    "nodes": [
      { "id": "app", "label": "App Server\\nCPU: 95%", "type": "component", "x": 200, "y": 200, "status": "error", "requiredAction": "Scale up instances", "correctAction": "Scale to 5 instances" },
      { "id": "db", "label": "Database\\nNormal", "type": "component", "x": 400, "y": 300, "status": "normal" }
    ]
  }
}

monitor:
{
  "type": "monitor",
  "data": {
    "title": "Monitor Metrics",
    "description": "Click when metric reaches threshold",
    "metrics": [
      { "name": "App CPU", "current": 45, "target": 80, "unit": "%", "threshold": "above" },
      { "name": "Cache Hit Rate", "current": 55, "target": 75, "unit": "%", "threshold": "above" }
    ]
  }
}

RULES:
- Use REAL DevOps tools: systemctl, docker, kubectl, nginx, redis, postgres
- Use REAL technical terms and infrastructure
- NO generic/game-like content
- Make it feel like real DevOps work

Respond with JSON only, no markdown or code blocks.`;

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

    const responseData = await response.json().catch(async () => {
      return null;
    });

    if (!response.ok) {
      return null;
    }

    const data = responseData;
    const content = data.choices[0].message.content;
    
    // Parse JSON response
    const cleanedContent = content
      .replace(/```json\n?/g, '')
      .replace(/```\n?/g, '')
      .trim();
    
    let taskData: TaskData;
    try {
      taskData = JSON.parse(cleanedContent);
    } catch (parseError) {
      return null;
    }
    
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
        return null; // Reject inconsistent tasks
      }
      
      // Also check that target value is different from current
      if (currentValue === targetValue) {
        return null;
      }
    }
    
    return taskData;
  } catch (error) {
    return null;
  }
}

