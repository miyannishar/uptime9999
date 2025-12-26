import { useState } from 'react';
import { musicPlayer } from '../utils/musicPlayer';

export default function MusicPlayer() {
  const [isPlaying, setIsPlaying] = useState(false); // Start muted/paused

  const handleToggle = () => {
    const newState = musicPlayer.toggle();
    setIsPlaying(newState);
  };

  return (
    <div className="music-player">
      <button 
        className="music-toggle"
        onClick={handleToggle}
        title={isPlaying ? 'Pause music' : 'Play music'}
      >
        {isPlaying ? '🎵' : '🔇'}
      </button>
    </div>
  );
}

