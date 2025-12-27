// Simple background music player - play/pause only

// Music tracks from public/music/ folder
// Using actual MP3 files found in the folder
const MUSIC_TRACKS = [
  '/music/Alex Warren - Ordinary (Official Music Video) 4 (1).mp3',
  '/music/Alien F!cking Eyes (Official Audio).mp3',
  '/music/Eminem - Without Me (Instrumental) 4.mp3',
  '/music/empire state of mind - jay-z alicia keys  #newyork.mp3',
  '/music/Follow Jack (Original Mix).mp3',
  '/music/In The End [Official HD Music Video] - Linkin Park 4.mp3',
  '/music/INTO YOU (feat. meat computer) 4.mp3',
  '/music/Intro (Infected).mp3',
  '/music/Jaymes Young - Infinity (Lyrics) \'Cause I love you for infinity.mp3',
  '/music/Kanye_West_-_Runaway_(Instrumental).mp3',
  '/music/Linkin Park - In The End (Mellen Gi & Tommee Profitt Remix) 4.mp3',
  '/music/Mahiya Mahiya (HD) Video Song _ Awarapan Movie _ Mrinalini Sharma, Emraan Hashmi _ Hindi Songs.mp3',
  '/music/Michael Jackson - Billie Jean (Official Video) 4.mp3',
  '/music/Michael Jackson - They Don\'t Care About Us (Brazil Version) (Official Video) 4.mp3',
  '/music/Mike Posner - Move On.mp3',
  '/music/Mo_Beats_-_Righteous_(pepe_lore_song) (1).mp3',
  '/music/Mo_Beats_-_Righteous_(pepe_lore_song).mp3',
  '/music/Sidewalks and Skeletons - GOTH 4.mp3',
  '/music/The Police - Every Breath You Take (Official Music Video) 4.mp3',
  '/music/The Weeknd - Blinding Lights (Official Audio) 4.mp3',
  '/music/TKANDZ - Now Or Never (heavenly audio) _ Official Audio.mp3',
  '/music/VJ_Narvent_-_Memory_Reboot.mp3',
];

class MusicPlayer {
  private audio: HTMLAudioElement | null = null;
  private currentTrackIndex: number = 0;
  private isPlaying: boolean = false;

  constructor() {
    // Pick a random track to start
    this.currentTrackIndex = Math.floor(Math.random() * MUSIC_TRACKS.length);
  }

  private loadTrack() {
    if (this.audio) {
      this.audio.removeEventListener('ended', this.handleTrackEnd);
    }

    this.audio = new Audio(MUSIC_TRACKS[this.currentTrackIndex]);
    this.audio.loop = false; // Loop through playlist instead
    this.audio.volume = 1.0; // Max volume - device controls actual volume
    
    // When track ends, play next one
    this.audio.addEventListener('ended', this.handleTrackEnd);

    // Handle errors gracefully
    this.audio.addEventListener('error', () => {
      // Try next track on error
      this.nextTrack();
    });
  }

  private handleTrackEnd = () => {
    this.nextTrack();
  };

  private nextTrack() {
    this.currentTrackIndex = (this.currentTrackIndex + 1) % MUSIC_TRACKS.length;
    this.loadTrack();
    if (this.isPlaying) {
      this.play();
    }
  }

  play() {
    if (!this.audio) {
      this.loadTrack();
    }
    
    if (this.audio) {
      this.audio.play().catch(() => {
        // Audio play failed - ignore silently
      });
      this.isPlaying = true;
    }
  }

  pause() {
    if (!this.audio) return;
    this.audio.pause();
    this.isPlaying = false;
  }

  toggle() {
    if (this.isPlaying) {
      this.pause();
      return false; // Now paused/stopped
    } else {
      this.play();
      return true; // Now playing
    }
  }

  isMuted(): boolean {
    return !this.isPlaying;
  }
}

// Singleton instance
export const musicPlayer = new MusicPlayer();

