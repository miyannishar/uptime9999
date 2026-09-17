// src/ui/atoms/SevDot.tsx
interface SevDotProps {
  severity: 'CRIT' | 'WARN' | 'INFO';
  pulse?: boolean;       // true = add pulsing animation (for active crits)
  size?: 'sm' | 'md';   // sm=6px, md=8px (default)
}

export default function SevDot({ severity, pulse = false, size = 'md' }: SevDotProps) {
  return (
    <span
      className={`sev-dot sev-dot--${severity.toLowerCase()} sev-dot--${size} ${pulse ? 'sev-dot--pulse' : ''}`}
      aria-label={severity}
    />
  );
}
