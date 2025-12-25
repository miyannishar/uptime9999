// Background music player

export interface MusicTrack {
  id: string;
  name: string;
  url: string;
}

// Music tracks from public/music/ folder
// Add your own .mp3 files to public/music/ directory
export const MUSIC_TRACKS: MusicTrack[] = [
  {
    id: 'track1',
    name: 'Track 1',
    url: '/music/track1.mp3',
  },
  {
    id: 'track2',
    name: 'Track 2',
    url: '/music/track2.mp3',
  },
  {
    id: 'track3',
    name: 'Track 3',
    url: '/music/track3.mp3',
  },
  {
    id: 'track4',
    name: 'Track 4',
    url: '/music/track4.mp3',
  },
  {
    id: 'track5',
    name: 'Track 5',
    url: '/music/track5.mp3',
  },
];

class MusicPlayer {
  private audio: HTMLAudioElement | null = null;
  private currentTrackIndex: number = 0;
  private volume: number = 0.3;
  private muted: boolean = true; // Start muted by default

  constructor() {
    this.audio = new Audio();
    this.audio.loop = false;
    this.audio.volume = this.volume;
    
    // Auto-play next track when current ends
    this.audio.addEventListener('ended', () => {
      this.nextTrack();
    });

    // Handle errors gracefully
    this.audio.addEventListener('error', () => {
      console.warn('Music file not found or failed to load:', this.audio?.src);
      console.warn('Make sure music files exist in public/music/ folder');
      // Try next track on error
      this.nextTrack();
    });
  }

  play() {
    if (!this.audio || this.muted) return;
    
    if (!this.audio.src) {
      this.loadTrack(0);
    }
    
    this.audio.play().catch(err => {
      console.log('Audio play failed:', err);
    });
  }

  pause() {
    if (!this.audio) return;
    this.audio.pause();
  }

  toggleMute() {
    this.muted = !this.muted;
    
    if (this.audio) {
      if (this.muted) {
        this.audio.pause();
      } else {
        this.play();
      }
    }
    
    return this.muted;
  }

  setVolume(vol: number) {
    this.volume = Math.max(0, Math.min(1, vol));
    if (this.audio) {
      this.audio.volume = this.volume;
    }
  }

  getVolume(): number {
    return this.volume;
  }

  isMuted(): boolean {
    return this.muted;
  }

  loadTrack(index: number) {
    if (index < 0 || index >= MUSIC_TRACKS.length) return;
    
    this.currentTrackIndex = index;
    const track = MUSIC_TRACKS[index];
    
    if (this.audio) {
      this.audio.src = track.url;
      if (!this.muted) {
        this.play();
      }
    }
  }

  nextTrack() {
    const nextIndex = (this.currentTrackIndex + 1) % MUSIC_TRACKS.length;
    this.loadTrack(nextIndex);
  }

  prevTrack() {
    const prevIndex = (this.currentTrackIndex - 1 + MUSIC_TRACKS.length) % MUSIC_TRACKS.length;
    this.loadTrack(prevIndex);
  }

  getCurrentTrack(): MusicTrack {
    return MUSIC_TRACKS[this.currentTrackIndex];
  }

  getCurrentTrackIndex(): number {
    return this.currentTrackIndex;
  }
}

// Singleton instance
export const musicPlayer = new MusicPlayer();

