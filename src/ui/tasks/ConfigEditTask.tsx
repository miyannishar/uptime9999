import { useState } from 'react';
import { useElapsedSeconds } from '../../hooks/useElapsedSeconds';

interface ConfigEditTaskProps {
  filename: string;
  content: string;
  targetKey: string;
  currentValue: string;
  targetValue: string;
  onComplete: () => void;
}

export default function ConfigEditTask({
  filename,
  content,
  targetKey,
  currentValue,
  targetValue,
  onComplete,
}: ConfigEditTaskProps) {
  const [editedContent, setEditedContent] = useState(content);
  const [error, setError] = useState('');
  const secondsElapsed = useElapsedSeconds();


  const handleSubmit = () => {
    // More flexible validation - check for the target value in various formats
    const hasCorrectValue = 
      editedContent.includes(`${targetKey}=${targetValue}`) ||
      editedContent.includes(`${targetKey}: ${targetValue}`) ||
      editedContent.includes(`${targetKey} ${targetValue}`) ||
      editedContent.includes(`"${targetKey}": "${targetValue}"`) ||
      editedContent.includes(`"${targetKey}": ${targetValue}`) ||
      // Also check for underscored versions (e.g., min_ttl, max_ttl)
      editedContent.includes(`_${targetKey}=${targetValue}`) ||
      editedContent.includes(`_${targetKey}: ${targetValue}`) ||
      editedContent.includes(`_${targetKey} ${targetValue}`);
    
    // Also check if original value was removed (indicating change)
    const originalRemoved = !editedContent.includes(`${targetKey}=${currentValue}`) &&
                           !editedContent.includes(`${targetKey}: ${currentValue}`) &&
                           !editedContent.includes(`${targetKey} ${currentValue}`);
    
    if (hasCorrectValue || (originalRemoved && editedContent.includes(targetValue))) {
      onComplete();
    } else {
      setError(`Please change ${targetKey} from ${currentValue} to ${targetValue}`);
    }
  };

  return (
    <div className="task-container config-edit-task">
      <h3>📝 Edit Configuration File</h3>
      <p className="task-description">
        Update <code>{filename}</code> by changing <strong>{targetKey}</strong> from <code>{currentValue}</code> to <code>{targetValue}</code>
      </p>
      
      <div className="task-hints">
        <div className="hint-box">
          <strong>What to do:</strong> Find the line with <code>{targetKey}</code> and change its value from <code>{currentValue}</code> to <code>{targetValue}</code>
        </div>
        <div className="hint-box">
          <strong>🔍 Look for:</strong> <code>{targetKey} {currentValue}</code> or <code>{targetKey}={currentValue}</code> or <code>{targetKey}: {currentValue}</code>
        </div>
      </div>
      
      <div className="code-editor">
        <div className="editor-header">
          <span className="filename">{filename}</span>
        </div>
        <textarea
          className="config-textarea"
          value={editedContent}
          onChange={(e) => setEditedContent(e.target.value)}
          rows={10}
          spellCheck={false}
        />
      </div>

      {error && <div className="task-error">{error}</div>}

      <div className="task-actions">
        <button className="task-submit-btn" onClick={handleSubmit}>
          Save Configuration
        </button>
        <button 
          className="task-skip-btn" 
          onClick={onComplete}
          disabled={secondsElapsed < 5}
        >
          ⏭️ Skip {secondsElapsed < 5 ? `(${5 - secondsElapsed}s)` : '(Auto-fix)'}
        </button>
      </div>
    </div>
  );
}

