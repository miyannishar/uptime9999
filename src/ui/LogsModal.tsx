interface LogsModalProps {
  incidentName: string;
  logs: string;
  onClose: () => void;
}

export default function LogsModal({ incidentName, logs, onClose }: LogsModalProps) {
  const logLines = logs.split('\n').filter(l => l.trim());

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="logs-modal" onClick={(e) => e.stopPropagation()}>
        <div className="logs-modal-header">
          <h3>📋 Incident Logs: {incidentName}</h3>
          <button className="close-button" onClick={onClose}>✕</button>
        </div>
        
        <div className="logs-terminal">
          <div className="terminal-header">
            <span className="terminal-title">$ tail -f /var/log/incidents/{incidentName.replace(/\s+/g, '_').toLowerCase()}.log</span>
          </div>
          <div className="terminal-body">
            {logLines.map((line, idx) => (
              <div key={idx} className={
                line.includes('ERROR') ? 'log-line log-error' :
                line.includes('WARN') ? 'log-line log-warn' :
                line.includes('INFO') ? 'log-line log-info' :
                line.includes('DEBUG') ? 'log-line log-debug' :
                'log-line'
              }>
                {line}
              </div>
            ))}
            {logLines.length === 0 && (
              <div className="log-line log-info">[No logs available]</div>
            )}
            <div className="log-line log-cursor">
              <span className="cursor-blink">_</span>
            </div>
          </div>
        </div>
        
        <div className="logs-modal-footer">
          <button className="modal-button" onClick={onClose}>Close</button>
        </div>
      </div>
    </div>
  );
}

