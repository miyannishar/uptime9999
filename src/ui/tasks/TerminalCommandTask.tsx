import { useState } from 'react';
import { useElapsedSeconds } from '../../hooks/useElapsedSeconds';

interface TerminalCommandTaskProps {
  prompt: string;
  command: string;
  placeholder: string;
  expectedCompletion: string;
  onComplete: () => void;
}

export default function TerminalCommandTask({
  prompt,
  command,
  placeholder,
  expectedCompletion,
  onComplete,
}: TerminalCommandTaskProps) {
  const [input, setInput] = useState('');
  const [error, setError] = useState('');
  const [attempts, setAttempts] = useState(0);
  const secondsElapsed = useElapsedSeconds();


  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    
    const fullCommand = `${command}${input}`;
    const expected = `${command}${expectedCompletion}`;
    
    if (fullCommand.trim() === expected.trim()) {
      onComplete();
    } else {
      setAttempts(prev => prev + 1);
      if (attempts >= 2) {
        setError(`Hint: The answer is "${expectedCompletion}"`);
      } else {
        setError('Incorrect. Try again!');
      }
    }
  };

  return (
    <div className="task-container terminal-task">
      <h3>⚡ Terminal Command</h3>
      <p className="task-description">{prompt}</p>

      <div className="task-hints">
        <div className="hint-box">
          <strong>💡 Complete the command:</strong> <code>{command}<span style={{color: 'var(--accent-yellow)'}}>{placeholder}</span></code>
        </div>
        {attempts >= 2 && (
          <div className="hint-box expected-fix">
            <strong>🎯 Answer:</strong> <code>{expectedCompletion}</code>
          </div>
        )}
      </div>

      <div className="terminal-window">
        <div className="terminal-header">
          <span className="terminal-dot"></span>
          <span className="terminal-dot"></span>
          <span className="terminal-dot"></span>
          <span className="terminal-title">Terminal</span>
        </div>
        <form onSubmit={handleSubmit} className="terminal-body">
          <div className="terminal-line">
            <span className="terminal-prompt">$</span>
            <span className="terminal-command">{command}</span>
            <input
              type="text"
              value={input}
              onChange={(e) => setInput(e.target.value)}
              placeholder={placeholder}
              className="terminal-input"
              autoFocus
            />
          </div>
        </form>
      </div>

      {error && <div className="task-error">{error}</div>}

      <div className="task-actions">
        <button className="task-submit-btn" onClick={handleSubmit}>
          ▶️ Execute Command
        </button>
        <button 
          className="task-skip-btn" 
          onClick={onComplete}
          disabled={secondsElapsed < 5}
        >
          ⏭️ Skip {secondsElapsed < 5 ? `(${5 - secondsElapsed}s)` : '(Auto-execute)'}
        </button>
      </div>
    </div>
  );
}

