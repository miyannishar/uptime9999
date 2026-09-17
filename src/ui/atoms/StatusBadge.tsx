// src/ui/atoms/StatusBadge.tsx
type BadgeLevel = 'CRIT' | 'WARN' | 'INFO' | 'GOOD' | 'DEPLOY';

interface StatusBadgeProps {
  level: BadgeLevel;
  label?: string;   // override display text (defaults to the level string)
}

export default function StatusBadge({ level, label }: StatusBadgeProps) {
  return (
    <span className={`status-badge status-badge--${level.toLowerCase()}`}>
      {label ?? level}
    </span>
  );
}
