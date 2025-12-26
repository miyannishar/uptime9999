// Sound notification system for game events
// Uses Web Audio API to generate simple notification sounds

class SoundNotificationService {
  private audioContext: AudioContext | null = null;
  private enabled: boolean = true;

  constructor() {
    // Initialize audio context on first use (requires user interaction)
    if (typeof window !== 'undefined' && 'AudioContext' in window) {
      // Will be created on first play
    }
  }

  private getAudioContext(): AudioContext | null {
    if (!this.enabled) return null;
    
    if (!this.audioContext) {
      try {
        this.audioContext = new (window.AudioContext || (window as any).webkitAudioContext)();
      } catch (e) {
        console.warn('Web Audio API not supported');
        this.enabled = false;
        return null;
      }
    }
    
    // Resume context if suspended (browser autoplay policy)
    if (this.audioContext.state === 'suspended') {
      this.audioContext.resume().catch(() => {
        // Ignore - user interaction required
      });
    }
    
    return this.audioContext;
  }

  private playTone(frequency: number, duration: number, type: OscillatorType = 'sine', volume: number = 0.3) {
    const ctx = this.getAudioContext();
    if (!ctx) return;

    try {
      const oscillator = ctx.createOscillator();
      const gainNode = ctx.createGain();

      oscillator.connect(gainNode);
      gainNode.connect(ctx.destination);

      oscillator.frequency.value = frequency;
      oscillator.type = type;

      // Envelope: quick attack, smooth release
      const now = ctx.currentTime;
      gainNode.gain.setValueAtTime(0, now);
      gainNode.gain.linearRampToValueAtTime(volume, now + 0.01);
      gainNode.gain.exponentialRampToValueAtTime(0.01, now + duration);

      oscillator.start(now);
      oscillator.stop(now + duration);
    } catch (e) {
      // Ignore errors (e.g., autoplay blocked)
    }
  }

  private playChord(frequencies: number[], duration: number, type: OscillatorType = 'sine', volume: number = 0.2) {
    const ctx = this.getAudioContext();
    if (!ctx) return;

    try {
      const now = ctx.currentTime;
      
      frequencies.forEach(freq => {
        const oscillator = ctx.createOscillator();
        const gainNode = ctx.createGain();

        oscillator.connect(gainNode);
        gainNode.connect(ctx.destination);

        oscillator.frequency.value = freq;
        oscillator.type = type;

        gainNode.gain.setValueAtTime(0, now);
        gainNode.gain.linearRampToValueAtTime(volume, now + 0.01);
        gainNode.gain.exponentialRampToValueAtTime(0.01, now + duration);

        oscillator.start(now);
        oscillator.stop(now + duration);
      });
    } catch (e) {
      // Ignore errors
    }
  }

  // Incident sounds - different for each severity
  playIncidentCRIT() {
    // Low, urgent, descending tone (danger)
    this.playTone(200, 0.3, 'sawtooth', 0.4);
    setTimeout(() => {
      this.playTone(150, 0.3, 'sawtooth', 0.4);
    }, 100);
  }

  playIncidentWARN() {
    // Medium, attention-grabbing tone
    this.playTone(400, 0.2, 'square', 0.3);
    setTimeout(() => {
      this.playTone(500, 0.2, 'square', 0.3);
    }, 150);
  }

  playIncidentINFO() {
    // High, pleasant notification tone
    this.playTone(600, 0.15, 'sine', 0.2);
  }

  // Action sounds
  playActionStart() {
    // Upward sweep (positive, starting)
    this.playTone(300, 0.1, 'sine', 0.25);
    setTimeout(() => {
      this.playTone(400, 0.1, 'sine', 0.25);
    }, 50);
  }

  playActionComplete() {
    // Pleasant completion chord (success)
    this.playChord([523, 659, 784], 0.3, 'sine', 0.25); // C major chord
  }

  // System down sound
  playSystemDown() {
    // Urgent, alarming sound
    this.playTone(150, 0.4, 'sawtooth', 0.5);
    setTimeout(() => {
      this.playTone(120, 0.4, 'sawtooth', 0.5);
    }, 200);
    setTimeout(() => {
      this.playTone(100, 0.4, 'sawtooth', 0.5);
    }, 400);
  }

  // Enable/disable sounds
  setEnabled(enabled: boolean) {
    this.enabled = enabled;
  }

  isEnabled(): boolean {
    return this.enabled;
  }
}

// Singleton instance
export const soundNotifications = new SoundNotificationService();

