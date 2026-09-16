// Task Generator - Uses OpenAI to generate interactive technical tasks
import { GAME_CONFIG } from '../config/gameConfig';
import { tlog } from '../utils/terminalLog';
import { chatJSON, parseJSON, errMsg } from './openai';

// Task calls are counted separately from aiGameMaster's, but against the same
// GAME_CONFIG.session budget, capped at the share below.
let taskApiCallCount = 0;
let taskSessionStart = 0;

export function resetTaskApiTracking() {
  taskApiCallCount = 0;
  taskSessionStart = 0;
}

function shouldAllowTaskApiCall(): boolean {
  const cfg = GAME_CONFIG.session;
  const now = Date.now();
  
  if (taskApiCallCount >= Math.floor(cfg.maxApiCalls * cfg.taskCallShare)) {
    return false;
  }
  
  // Respect session duration limit
  if (taskSessionStart > 0 && (now - taskSessionStart) >= cfg.maxDurationMs) {
    return false;
  }
  
  return true;
}

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
    if (!shouldAllowTaskApiCall()) {
      tlog.warn('⚠️ Task generation skipped: API call budget exhausted');
      return null;
    }

    if (taskSessionStart === 0) taskSessionStart = Date.now();
    taskApiCallCount++;

    const { content } = await chatJSON(apiKey, [
      { role: 'system', content: systemPrompt },
      { role: 'user', content: userPrompt },
    ], 1.0);

    const task = parseJSON<TaskData>(content);
    if (!task?.type || !task.data) {
      tlog.error(`❌ Task JSON missing type/data: ${content.slice(0, 300)}`);
      return null;
    }

    // Config tasks are unplayable unless the file content really contains targetKey/currentValue
    if (task.type === 'config') {
      const { content: file, targetKey, currentValue, targetValue } = task.data;
      const present = typeof file === 'string' && ['=', ': ', ' '].some(sep =>
        file.includes(`${targetKey}${sep}${currentValue}`) || file.includes(`_${targetKey}${sep}${currentValue}`));
      if (!present || currentValue === targetValue) {
        tlog.warn(`⚠️ Rejecting config task "${targetKey}": ${present ? 'currentValue equals targetValue' : 'value absent from file content'}`);
        return null;
      }
    }

    tlog.debug(`✅ Task type=${task.type}`);
    return task;
  } catch (error) {
    tlog.error(`❌ generateTask failed: ${errMsg(error)}`);
    return null;
  }
}

