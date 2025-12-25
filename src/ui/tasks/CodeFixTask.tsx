import { useState, useEffect } from 'react';

interface CodeFixTaskProps {
  filename: string;
  code: string;
  issue: string;
  fixHint: string;
  expectedFix?: string; // What the fix should look like
  validateFix: (code: string) => boolean;
  onComplete: () => void;
}

export default function CodeFixTask({
  filename,
  code,
  issue,
  fixHint,
  expectedFix,
  validateFix,
  onComplete,
}: CodeFixTaskProps) {
  const [editedCode, setEditedCode] = useState(code);
  const [error, setError] = useState('');
  const [showHint, setShowHint] = useState(false);
  const [attempts, setAttempts] = useState(0);
  const [secondsElapsed, setSecondsElapsed] = useState(0);

  // Timer for skip button
  useEffect(() => {
    const interval = setInterval(() => {
      setSecondsElapsed(prev => prev + 1);
    }, 1000);
    return () => clearInterval(interval);
  }, []);

  const handleSubmit = () => {
    if (validateFix(editedCode)) {
      onComplete();
    } else {
      setAttempts(prev => prev + 1);
      if (attempts >= 1) {
        setShowHint(true);
      }
      setError(fixHint);
    }
  };

  return (
    <div className="task-container code-fix-task">
      <h3>🐛 Fix the Bug</h3>
      <p className="task-description">
        <strong>Issue:</strong> {issue}
      </p>
      
      <div className="task-hints">
        <div className="hint-box">
          <strong>💡 Hint:</strong> {fixHint}
        </div>
        {showHint && expectedFix && (
          <div className="hint-box expected-fix">
            <strong>🎯 Expected Fix:</strong>
            <pre>{expectedFix}</pre>
          </div>
        )}
        {!showHint && attempts > 0 && (
          <button className="hint-reveal-btn" onClick={() => setShowHint(true)}>
            👁️ Show Example Solution
          </button>
        )}
      </div>

      <div className="code-editor">
        <div className="editor-header">
          <span className="filename">{filename}</span>
        </div>
        <textarea
          className="code-textarea"
          value={editedCode}
          onChange={(e) => setEditedCode(e.target.value)}
          rows={15}
          spellCheck={false}
        />
      </div>

      {error && <div className="task-error">{error}</div>}

      <div className="task-actions">
        <button className="task-submit-btn" onClick={handleSubmit}>
          🔧 Apply Fix
        </button>
        <button 
          className="task-skip-btn" 
          onClick={onComplete}
          disabled={secondsElapsed < 10}
        >
          ⏭️ Skip {secondsElapsed < 10 ? `(${10 - secondsElapsed}s)` : '(Auto-fix)'}
        </button>
      </div>
    </div>
  );
}

