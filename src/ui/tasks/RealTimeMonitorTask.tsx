// Real-time monitoring task - watch metrics and click when threshold reached

import { useState, useEffect } from 'react';

interface Metric {
  name: string;
  current: number;
  target: number;
  unit: string;
  threshold: 'above' | 'below';
}

interface RealTimeMonitorTaskProps {
  title: string;
  description: string;
  metrics: Metric[];
  onComplete: () => void;
}

export default function RealTimeMonitorTask({
  title,
  description,
  metrics,
  onComplete,
}: RealTimeMonitorTaskProps) {
  const [currentMetrics, setCurrentMetrics] = useState(metrics);
  const [clickedMetrics, setClickedMetrics] = useState<Set<string>>(new Set());
  const [error, setError] = useState('');
  const [success, setSuccess] = useState(false);

  // Simulate real-time metric changes
  useEffect(() => {
    const interval = setInterval(() => {
      setCurrentMetrics(prev => prev.map(metric => {
        // Simulate metric fluctuation
        const change = (Math.random() - 0.5) * (metric.target * 0.1);
        const newValue = Math.max(0, metric.current + change);
        
        return {
          ...metric,
          current: newValue,
        };
      }));
    }, 500);

    return () => clearInterval(interval);
  }, []);

  const handleMetricClick = (metricName: string) => {
    const metric = currentMetrics.find(m => m.name === metricName);
    if (!metric) return;

    const isThresholdReached = metric.threshold === 'above' 
      ? metric.current >= metric.target
      : metric.current <= metric.target;

    if (isThresholdReached) {
      setClickedMetrics(new Set([...clickedMetrics, metricName]));
      setError('');
      
      // Check if all metrics clicked at right time
      const allClicked = currentMetrics.every(m => clickedMetrics.has(m.name) || m.name === metricName);
      if (allClicked) {
        setSuccess(true);
        setTimeout(() => onComplete(), 1000);
      }
    } else {
      setError(`❌ ${metricName} hasn't reached the threshold yet! Wait for it to ${metric.threshold === 'above' ? 'increase' : 'decrease'} to ${metric.target}${metric.unit}`);
      setTimeout(() => setError(''), 2000);
    }
  };

  const isMetricReady = (metric: Metric) => {
    return metric.threshold === 'above' 
      ? metric.current >= metric.target
      : metric.current <= metric.target;
  };

  return (
    <div className="task-container monitor-task">
      <h3>📊 {title}</h3>
      <p className="task-description">{description}</p>

      <div className="metrics-grid">
        {currentMetrics.map(metric => {
          const isReady = isMetricReady(metric);
          const isClicked = clickedMetrics.has(metric.name);
          const progress = metric.threshold === 'above'
            ? Math.min(100, (metric.current / metric.target) * 100)
            : Math.min(100, (metric.target / Math.max(0.1, metric.current)) * 100);

          return (
            <div
              key={metric.name}
              className={`metric-card ${isReady ? 'ready' : ''} ${isClicked ? 'clicked' : ''}`}
              onClick={() => handleMetricClick(metric.name)}
            >
              <div className="metric-name">{metric.name}</div>
              <div className="metric-value">
                {metric.current.toFixed(1)}{metric.unit}
              </div>
              <div className="metric-target">
                Target: {metric.target}{metric.unit} ({metric.threshold === 'above' ? '↑' : '↓'})
              </div>
              <div className="metric-progress">
                <div 
                  className="progress-bar-fill"
                  style={{ width: `${progress}%` }}
                />
              </div>
              {isReady && !isClicked && (
                <div className="click-hint">👆 Click now!</div>
              )}
              {isClicked && <div className="clicked-check">✓</div>}
            </div>
          );
        })}
      </div>

      {error && <div className="task-error">{error}</div>}
      {success && <div className="task-success">✅ All metrics monitored correctly!</div>}

      <div className="task-hint">
        <p>💡 Watch the metrics and click each one when it reaches its target threshold</p>
      </div>
    </div>
  );
}

