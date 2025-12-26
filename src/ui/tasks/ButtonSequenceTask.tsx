// Interactive button sequence task - click buttons in correct order

import { useState } from 'react';

interface ButtonSequenceTaskProps {
  title: string;
  description: string;
  steps: Array<{
    label: string;
    buttonText: string;
    correct: boolean; // Is this the correct next step?
  }>;
  onComplete: () => void;
}

export default function ButtonSequenceTask({
  title,
  description,
  steps,
  onComplete,
}: ButtonSequenceTaskProps) {
  const [currentStep, setCurrentStep] = useState(0);
  const [selectedButtons, setSelectedButtons] = useState<number[]>([]);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState(false);

  const handleButtonClick = (index: number) => {
    if (selectedButtons.includes(index)) return; // Already selected

    const step = steps[index];
    
    if (step.correct && index === currentStep) {
      // Correct next step!
      setSelectedButtons([...selectedButtons, index]);
      setCurrentStep(currentStep + 1);
      setError('');
      
      if (currentStep + 1 >= steps.filter(s => s.correct).length) {
        // All correct steps completed!
        setSuccess(true);
        setTimeout(() => onComplete(), 1000);
      }
    } else {
      // Wrong button or wrong order
      setError(step.correct 
        ? 'Wrong order! Complete previous steps first.' 
        : 'That\'s not the right action. Try another button.');
      setTimeout(() => setError(''), 2000);
    }
  };

  const completedCorrectSteps = selectedButtons.filter(i => steps[i].correct).length;
  const totalCorrectSteps = steps.filter(s => s.correct).length;

  return (
    <div className="task-container button-sequence-task">
      <h3>🎯 {title}</h3>
      <p className="task-description">{description}</p>

      <div className="progress-indicator">
        <div className="progress-bar">
          <div 
            className="progress-fill" 
            style={{ width: `${(completedCorrectSteps / totalCorrectSteps) * 100}%` }}
          />
        </div>
        <span>Step {completedCorrectSteps} of {totalCorrectSteps}</span>
      </div>

      <div className="button-grid">
        {steps.map((step, index) => {
          const isSelected = selectedButtons.includes(index);
          const isCorrect = step.correct;
          const isNext = index === currentStep && isCorrect;
          
          return (
            <button
              key={index}
              className={`action-button ${isSelected ? 'selected' : ''} ${isNext ? 'next-step' : ''} ${!isCorrect ? 'wrong-option' : ''}`}
              onClick={() => handleButtonClick(index)}
              disabled={isSelected || success}
            >
              <span className="button-label">{step.label}</span>
              <span className="button-text">{step.buttonText}</span>
              {isSelected && <span className="check-mark">✓</span>}
            </button>
          );
        })}
      </div>

      {error && <div className="task-error">{error}</div>}
      {success && <div className="task-success">✅ All steps completed correctly!</div>}
    </div>
  );
}

