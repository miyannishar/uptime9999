// src/ui/atoms/ProgressBar.tsx
type BarVariant = 'mitigation' | 'health' | 'utilization' | 'stress' | 'countdown';

interface ProgressBarProps {
  value: number;          // 0 to 1
  variant: BarVariant;
  height?: number;        // px, default 10
  className?: string;
}

export default function ProgressBar({
  value,
  variant,
  height = 10,
  className = '',
}: ProgressBarProps) {
  const pct = Math.min(100, Math.max(0, value * 100));
  return (
    <div
      className={`progress-bar progress-bar--${variant} ${className}`}
      style={{ height: `${height}px` }}
      role="progressbar"
      aria-valuenow={Math.round(pct)}
      aria-valuemin={0}
      aria-valuemax={100}
    >
      <div
        className="progress-bar__fill"
        style={{ width: `${pct}%` }}
      />
    </div>
  );
}
