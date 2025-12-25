// Task Generator - Uses OpenAI to generate interactive technical tasks

export interface TaskData {
  type: 'config' | 'log' | 'slider' | 'terminal' | 'code';
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

Available task types:
1. **config**: Edit a configuration file (redis.conf, nginx.conf, database.yml, etc.)
2. **log**: Find a specific error in scrolling logs
3. **slider**: Adjust a resource limit (CPU, memory, connections, instances)
4. **terminal**: Complete a terminal command
5. **code**: Fix a bug in code

RULES FOR CHOOSING TASK TYPE:
- "Scale", "Increase", "Add instances" → slider
- "Restart", "Kill", "Deploy", "Rollback" → terminal
- "Configure", "Set", "Adjust TTL", "Update config" → config
- "Find", "Debug", "Investigate", "Check logs" → log
- "Fix leak", "Remove", "Patch", "Optimize code" → code

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

For type="slider":
{
  "type": "slider",
  "data": {
    "title": "Adjust Worker Instances",
    "description": "Scale workers to handle the increased load",
    "unit": " instances",
    "min": 1,
    "max": 10,
    "current": 2,
    "target": 5,
    "tolerance": 0
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

BE CREATIVE AND REALISTIC! Match the task to the incident and action.

CRITICAL VALIDATION RULES:
- For config tasks: The "content" field MUST contain the "targetKey" with "currentValue" that needs changing
- For log tasks: Generate 50-100 varied log lines, hide the error somewhere in the middle
- For slider tasks: Make "target" achievable between min and max
- For terminal tasks: Use realistic DevOps commands (systemctl, docker, kubectl, pm2, etc.)
- For code tasks: Show real code with a clear bug that matches the bugPattern`;

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

