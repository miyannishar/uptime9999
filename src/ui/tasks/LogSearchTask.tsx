import { useState, useRef, useEffect } from 'react';

interface LogSearchTaskProps {
  logs: string[];
  targetError: string;
  onComplete: () => void;
}

export default function LogSearchTask({
  logs,
  targetError,
  onComplete,
}: LogSearchTaskProps) {
  const [selectedLine, setSelectedLine] = useState<number | null>(null);
  const [error, setError] = useState('');
  const [secondsElapsed, setSecondsElapsed] = useState(0);
  const logContainerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    // Auto-scroll to middle on mount
    if (logContainerRef.current) {
      logContainerRef.current.scrollTop = logContainerRef.current.scrollHeight / 3;
    }

    // Timer for skip button
    const interval = setInterval(() => {
      setSecondsElapsed(prev => prev + 1);
    }, 1000);
    return () => clearInterval(interval);
  }, []);

  const handleLineClick = (index: number, line: string) => {
    setSelectedLine(index);
    if (line.includes(targetError)) {
      setError('');
      setTimeout(() => onComplete(), 500);
    } else {
      setError('That\'s not the right error. Keep looking!');
    }
  };

  return (
    <div className="task-container log-search-task">
      <h3>🔍 Find the Error in Logs</h3>
      <p className="task-description">
        Scroll through the logs and click on the line containing: <code>{targetError}</code>
      </p>

      <div className="task-hints">
        <div className="hint-box">
          <strong>💡 Tip:</strong> Look for ERROR or WARN level logs that mention "{targetError}"
        </div>
      </div>

      <div className="log-viewer" ref={logContainerRef}>
        {logs.map((line, index) => (
          <div
            key={index}
            className={`log-line ${selectedLine === index ? 'selected' : ''} ${
              line.includes('ERROR') ? 'log-error' : line.includes('WARN') ? 'log-warn' : ''
            }`}
            onClick={() => handleLineClick(index, line)}
          >
            <span className="line-number">{String(index + 1).padStart(4, '0')}</span>
            <span className="line-content">{line}</span>
          </div>
        ))}
      </div>

      {error && <div className="task-error">{error}</div>}

      <div className="task-actions">
        <button 
          className="task-skip-btn" 
          onClick={onComplete}
          disabled={secondsElapsed < 10}
        >
          ⏭️ Skip {secondsElapsed < 10 ? `(${10 - secondsElapsed}s)` : '(Auto-find)'}
        </button>
      </div>
    </div>
  );
}

