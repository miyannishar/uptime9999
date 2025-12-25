// Utility to send logs from browser to terminal via Vite dev server

type LogLevel = 'INFO' | 'WARN' | 'ERROR' | 'SUCCESS' | 'SYSTEM' | 'DEBUG';

const logLevel = import.meta.env.VITE_LOG_LEVEL || 'INFO';
const isDebugMode = logLevel === 'DEBUG';

export async function terminalLog(level: LogLevel, message: string) {
  // Only log in development
  if (import.meta.env.MODE !== 'development') {
    return;
  }

  // Skip DEBUG logs if not in debug mode
  if (level === 'DEBUG' && !isDebugMode) {
    return;
  }

  try {
    await fetch('/api/log', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ level, message }),
    });
  } catch (error) {
    // Silently fail if server not available (production build)
  }
}

// Convenience methods
export const tlog = {
  info: (msg: string) => terminalLog('INFO', msg),
  warn: (msg: string) => terminalLog('WARN', msg),
  error: (msg: string) => terminalLog('ERROR', msg),
  success: (msg: string) => terminalLog('SUCCESS', msg),
  system: (msg: string) => terminalLog('SYSTEM', msg),
  debug: (msg: string) => terminalLog('DEBUG', msg),
};

export function isDebug(): boolean {
  return isDebugMode;
}

