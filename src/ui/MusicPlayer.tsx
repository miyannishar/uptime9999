import { useState, useEffect } from 'react';
import { musicPlayer, MUSIC_TRACKS } from '../utils/musicPlayer';

export default function MusicPlayer() {
  const [isMuted, setIsMuted] = useState(musicPlayer.isMuted());
  const [volume, setVolume] = useState(musicPlayer.getVolume());
  const [currentTrackIndex, setCurrentTrackIndex] = useState(0);
  const [showControls, setShowControls] = useState(false);

  useEffect(() => {
    const interval = setInterval(() => {
      setCurrentTrackIndex(musicPlayer.getCurrentTrackIndex());
    }, 1000);

    return () => clearInterval(interval);
  }, []);

  const handleToggleMute = () => {
    const newMuted = musicPlayer.toggleMute();
    setIsMuted(newMuted);
  };

  const handleVolumeChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const newVolume = parseFloat(e.target.value);
    setVolume(newVolume);
    musicPlayer.setVolume(newVolume);
  };

  const handleTrackChange = (e: React.ChangeEvent<HTMLSelectElement>) => {
    const index = parseInt(e.target.value);
    musicPlayer.loadTrack(index);
    setCurrentTrackIndex(index);
  };

  const handleNextTrack = () => {
    musicPlayer.nextTrack();
    setCurrentTrackIndex(musicPlayer.getCurrentTrackIndex());
  };

  const handlePrevTrack = () => {
    musicPlayer.prevTrack();
    setCurrentTrackIndex(musicPlayer.getCurrentTrackIndex());
  };

  return (
    <div className="music-player">
      <button 
        className="music-toggle"
        onClick={handleToggleMute}
        title={isMuted ? 'Unmute music' : 'Mute music'}
      >
        {isMuted ? '🔇' : '🎵'}
      </button>

      {!isMuted && (
        <>
          <button 
            className="music-control-btn"
            onClick={handlePrevTrack}
            title="Previous track"
          >
            ⏮
          </button>

          <button 
            className="music-control-btn"
            onClick={handleNextTrack}
            title="Next track"
          >
            ⏭
          </button>

          <button
            className="music-control-btn"
            onClick={() => setShowControls(!showControls)}
            title="Music settings"
          >
            ⚙️
          </button>
        </>
      )}

      {showControls && !isMuted && (
        <div className="music-controls-panel">
          <div className="music-control-row">
            <label>Track:</label>
            <select value={currentTrackIndex} onChange={handleTrackChange}>
              {MUSIC_TRACKS.map((track, idx) => (
                <option key={track.id} value={idx}>
                  {track.name}
                </option>
              ))}
            </select>
          </div>

          <div className="music-control-row">
            <label>Volume:</label>
            <input
              type="range"
              min="0"
              max="1"
              step="0.1"
              value={volume}
              onChange={handleVolumeChange}
            />
            <span className="volume-display">{Math.round(volume * 100)}%</span>
          </div>
        </div>
      )}
    </div>
  );
}

