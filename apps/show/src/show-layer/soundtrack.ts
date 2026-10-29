import { Howl, Howler } from 'howler';

export const GAME_MUSIC: Readonly<Record<string, string>> = {
  'blade-brawl': 'adventure-2',
  'pong-wars': 'adventure-1',
  'ring-escape': 'adventure-1',
  'marble-race': 'adventure-2',
  'multiplier-cascade': 'factory',
  'light-cycles': 'factory',
  'peg-fever': 'adventure-1',
  'hot-potato': 'adventure-2'
};

/** One local, licensed loop at a time. Playback never touches the simulation RNG. */
export class Soundtrack {
  private loop?: Howl;
  private key = '';
  private requested = false;
  private volume = -1;
  failed = false;

  update(gameId: string, phase: string, active: boolean, enabled: boolean, volume: number): void {
    const key = phase === 'PLAY' ? GAME_MUSIC[gameId] ?? 'adventure-1' : 'menu';
    if (enabled && key !== this.key) this.select(key);
    const loop = this.loop;
    if (!loop) return;
    if (volume !== this.volume) {
      this.volume = volume;
      loop.volume(volume);
    }
    const playing = enabled && (phase !== 'PLAY' || active);
    if (!playing) {
      if (this.requested || loop.playing()) loop.pause();
      this.requested = false;
    } else if (loop.state() === 'loaded' && !this.requested && !this.failed) {
      this.requested = true;
      if (!loop.playing()) loop.play();
    }
  }

  unlock(): void {
    this.requested = false;
    if (Howler.ctx?.state === 'suspended') void Howler.ctx.resume();
  }

  get status(): { track: string; playing: boolean; state: string } {
    return { track: this.key, playing: this.loop?.playing() ?? false,
      state: this.failed ? 'failed' : this.loop?.state() ?? 'idle' };
  }

  private select(key: string): void {
    this.loop?.unload();
    this.key = key;
    this.requested = false;
    this.failed = false;
    this.volume = -1;
    this.loop = new Howl({
      src: [`/music/${key}.ogg`, `/music/${key}.mp3`],
      loop: true,
      volume: 0,
      onloaderror: () => { this.failed = true; },
      onplayerror: () => {
        // Browser autoplay restrictions are retried after the next user gesture.
        this.loop?.once('unlock', () => { this.requested = false; });
      }
    });
  }

  destroy(): void {
    this.loop?.unload();
    this.loop = undefined;
    this.key = '';
  }
}
