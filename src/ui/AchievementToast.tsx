import { useEffect, useState } from 'react';
import { ACHIEVEMENTS, getRarityColor } from '../data/achievements';

interface AchievementToastProps {
  achievementId: string | null;
  timestamp: number;
}

export default function AchievementToast({ achievementId, timestamp }: AchievementToastProps) {
  const [visible, setVisible] = useState(false);
  const [exiting, setExiting] = useState(false);

  useEffect(() => {
    if (!achievementId) return;

    setVisible(true);
    setExiting(false);

    const exitTimer = setTimeout(() => setExiting(true), 4000);
    const hideTimer = setTimeout(() => {
      setVisible(false);
      setExiting(false);
    }, 4500);

    return () => {
      clearTimeout(exitTimer);
      clearTimeout(hideTimer);
    };
  }, [achievementId, timestamp]);

  if (!visible || !achievementId) return null;

  const achievement = ACHIEVEMENTS.find(a => a.id === achievementId);
  if (!achievement) return null;

  return (
    <div className={`achievement-toast ${exiting ? 'exiting' : 'entering'}`}>
      <div className="achievement-toast-content">
        <div className="achievement-toast-icon">{achievement.icon}</div>
        <div className="achievement-toast-info">
          <div className="achievement-toast-title">🏆 Achievement Unlocked!</div>
          <div className="achievement-toast-name">{achievement.name}</div>
          <div className="achievement-toast-desc">{achievement.description}</div>
          <div 
            className="achievement-toast-rarity"
            style={{ color: getRarityColor(achievement.rarity) }}
          >
            {achievement.rarity.toUpperCase()}
          </div>
        </div>
      </div>
    </div>
  );
}
