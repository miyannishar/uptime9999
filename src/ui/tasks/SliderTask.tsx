import { useState, useEffect } from 'react';

interface SliderTaskProps {
  title: string;
  description: string;
  unit: string;
  min: number;
  max: number;
  current: number;
  target: number;
  tolerance?: number; // Allow some margin of error
  onComplete: () => void;
}

export default function SliderTask({
  title,
  description,
  unit,
  min,
  max,
  current,
  target,
  tolerance = 0,
  onComplete,
}: SliderTaskProps) {
  const [value, setValue] = useState(current);
  const [error, setError] = useState('');
  const [secondsElapsed, setSecondsElapsed] = useState(0);

  // Timer for skip button
  useEffect(() => {
    const interval = setInterval(() => {
      setSecondsElapsed(prev => prev + 1);
    }, 1000);
    return () => clearInterval(interval);
  }, []);

  const handleSubmit = () => {
    const diff = Math.abs(value - target);
    if (diff <= tolerance) {
      onComplete();
    } else {
      setError(`Not quite right. Target is ${target}${unit}${tolerance > 0 ? ` (±${tolerance})` : ''}`);
    }
  };

  const percentage = ((value - min) / (max - min)) * 100;

  return (
    <div className="task-container slider-task">
      <h3>🎚️ {title}</h3>
      <p className="task-description">{description}</p>

      <div className="task-hints">
        <div className="hint-box">
          <strong>🎯 Goal:</strong> Adjust from <code>{current}{unit}</code> to <code>{target}{unit}</code>
        </div>
      </div>

      <div className="slider-display">
        <div className="slider-value">
          {value}{unit}
        </div>
        <div className="slider-range">
          {min}{unit} → {max}{unit}
        </div>
      </div>

      <div className="slider-container">
        <input
          type="range"
          min={min}
          max={max}
          value={value}
          onChange={(e) => setValue(Number(e.target.value))}
          className="slider"
          style={{
            background: `linear-gradient(to right, var(--accent-cyan) 0%, var(--accent-cyan) ${percentage}%, var(--bg-tertiary) ${percentage}%, var(--bg-tertiary) 100%)`
          }}
        />
      </div>

      <div className="slider-markers">
        <span>Current: {current}{unit}</span>
        <span className="target-marker">Target: {target}{unit}</span>
      </div>

      {error && <div className="task-error">{error}</div>}

      <div className="task-actions">
        <button className="task-submit-btn" onClick={handleSubmit}>
          ✅ Apply Setting
        </button>
        <button 
          className="task-skip-btn" 
          onClick={onComplete}
          disabled={secondsElapsed < 10}
        >
          ⏭️ Skip {secondsElapsed < 10 ? `(${10 - secondsElapsed}s)` : '(Auto-adjust)'}
        </button>
      </div>
    </div>
  );
}

