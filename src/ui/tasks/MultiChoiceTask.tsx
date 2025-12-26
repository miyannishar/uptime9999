// Multiple choice task with interactive selection

import { useState } from 'react';

interface Option {
  id: string;
  text: string;
  correct: boolean;
  explanation?: string;
}

interface MultiChoiceTaskProps {
  question: string;
  options: Option[];
  onComplete: () => void;
}

export default function MultiChoiceTask({
  question,
  options,
  onComplete,
}: MultiChoiceTaskProps) {
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [showResult, setShowResult] = useState(false);
  const [attempts, setAttempts] = useState(0);

  const handleSelect = (optionId: string) => {
    if (showResult) return;
    setSelectedId(optionId);
  };

  const handleSubmit = () => {
    if (!selectedId) return;

    const selected = options.find(o => o.id === selectedId);
    if (!selected) return;

    setAttempts(attempts + 1);
    setShowResult(true);

    if (selected.correct) {
      setTimeout(() => onComplete(), 1500);
    }
  };

  const selectedOption = options.find(o => o.id === selectedId);

  return (
    <div className="task-container multi-choice-task">
      <h3>❓ Choose the Best Solution</h3>
      <p className="task-question">{question}</p>

      <div className="options-list">
        {options.map(option => {
          const isSelected = selectedId === option.id;
          const showCorrect = showResult && option.correct;
          const showWrong = showResult && isSelected && !option.correct;

          return (
            <div
              key={option.id}
              className={`option-card ${isSelected ? 'selected' : ''} ${showCorrect ? 'correct' : ''} ${showWrong ? 'wrong' : ''}`}
              onClick={() => handleSelect(option.id)}
            >
              <div className="option-radio">
                {isSelected && <div className="radio-dot" />}
              </div>
              <div className="option-text">{option.text}</div>
              {showCorrect && <span className="result-icon">✓</span>}
              {showWrong && <span className="result-icon">✗</span>}
              {showResult && option.explanation && (
                <div className="option-explanation">{option.explanation}</div>
              )}
            </div>
          );
        })}
      </div>

      {showResult && !selectedOption?.correct && attempts < 3 && (
        <div className="task-hint">
          <p>💡 Not quite right. Try again! {selectedOption?.explanation || ''}</p>
          <button 
            className="task-retry-btn" 
            onClick={() => {
              setShowResult(false);
              setSelectedId(null);
            }}
          >
            Try Again
          </button>
        </div>
      )}

      {showResult && selectedOption?.correct && (
        <div className="task-success">✅ Correct! {selectedOption.explanation}</div>
      )}

      <div className="task-actions">
        <button
          className="task-submit-btn"
          onClick={handleSubmit}
          disabled={!selectedId || showResult}
        >
          {showResult && selectedOption?.correct ? '✅ Correct!' : 'Submit Answer'}
        </button>
      </div>
    </div>
  );
}

