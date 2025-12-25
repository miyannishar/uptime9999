// Vite plugin to log from browser to terminal
import type { Plugin } from 'vite';

export function terminalLogger(): Plugin {
  return {
    name: 'terminal-logger',
    configureServer(server) {
      server.middlewares.use('/api/log', (req, res) => {
        let body = '';
        req.on('data', chunk => {
          body += chunk.toString();
        });
        req.on('end', () => {
          try {
            const { level, message } = JSON.parse(body);
            const timestamp = new Date().toTimeString().split(' ')[0];
            
            // Color codes for terminal
            const colors = {
              ERROR: '\x1b[31m',     // Red
              WARN: '\x1b[33m',      // Yellow
              INFO: '\x1b[36m',      // Cyan
              SUCCESS: '\x1b[32m',   // Green
              SYSTEM: '\x1b[35m',    // Magenta
              DEBUG: '\x1b[90m',     // Gray
              RESET: '\x1b[0m',
            };
            
            const color = colors[level as keyof typeof colors] || colors.INFO;
            const reset = colors.RESET;
            
            console.log(`${color}[${timestamp}] ${level}${reset} ${message}`);
          } catch (error) {
            console.error('Failed to parse log:', error);
          }
          
          res.writeHead(200, { 'Content-Type': 'text/plain' });
          res.end('ok');
        });
      });
    },
  };
}

