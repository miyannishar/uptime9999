// Seedable RNG using Mulberry32

export class SeededRNG {
  private state: number;

  constructor(seed: string) {
    // Convert string seed to number
    let hash = 0;
    for (let i = 0; i < seed.length; i++) {
      hash = ((hash << 5) - hash) + seed.charCodeAt(i);
      hash = hash & hash; // Convert to 32bit integer
    }
    this.state = Math.abs(hash);
  }

  // Returns random float [0, 1)
  next(): number {
    this.state = (this.state + 0x6D2B79F5) | 0;
    let t = Math.imul(this.state ^ (this.state >>> 15), 1 | this.state);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  }

  // Returns random integer [min, max]
  nextInt(min: number, max: number): number {
    return Math.floor(this.next() * (max - min + 1)) + min;
  }

  // Returns random float [min, max)
  nextFloat(min: number, max: number): number {
    return this.next() * (max - min) + min;
  }

  // Returns true with probability p
  chance(p: number): boolean {
    return this.next() < p;
  }

  // Pick random element from array
  pick<T>(arr: T[]): T {
    return arr[Math.floor(this.next() * arr.length)];
  }
}

export function generateSeed(): string {
  return Math.random().toString(36).substring(2, 10);
}

